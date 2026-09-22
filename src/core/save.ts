/**
 * SPEC §3.4: persistence, validation and schema migration.
 * Pure string <-> state conversion; touching localStorage is the UI's job.
 */
import { pushLog } from "./log.js";
import {
  FLOUR_PER_CAKE,
  FLOUR_PRICE_MIN,
  FLOUR_PRICE_MAX,
  MIN_PRICE,
  MAX_PRICE,
  initialState,
  LOG_LIMIT,
  SCHEMA_VERSION,
  type GameState,
  type LogEntry,
} from "./types.js";

/** localStorage key. Stays stable across schema versions. */
export const SAVE_KEY = "mooncake-save-v1";

const NUMERIC_FIELDS = [
  "rngSeed",
  "gameTime",
  "cash",
  "flour",
  "mooncakes",
  "sold",
  "productionProgress",
  "salesProgress",
  "price",
  "clickYield",
  "autoPress",
  "marketingLevel",
  "flourPrice",
  "flourBonus",
  "autoBuyThreshold",
] as const satisfies readonly (keyof GameState)[];

type Loose = Record<string, unknown>;

/**
 * Migrations are applied in ascending order: migrations[v] upgrades a
 * version-v payload to version v+1.
 */
const migrations: Record<number, (save: Loose) => Loose> = {
  0: (save) => ({ ...save, schemaVersion: 1 }),
  // Preserve any legacy achievement ids while filling the previously absent field.
  1: (save) => ({ ...save, schemaVersion: 2, achievements: save["achievements"] ?? [] }),
  2: (save) => ({
    ...save,
    schemaVersion: 3,
    flourBonus: 0,
    autoBuyFlour: false,
    autoBuyThreshold: 100,
  }),
  3: (save) => {
    const migrated = {
      ...save,
      schemaVersion: 4,
      productionProgress: 0,
      salesProgress: 0,
    };
    const mooncakes = save["mooncakes"];
    const sold = save["sold"];
    const flour = save["flour"];
    // Never turn invalid legacy resources into valid ones by rounding/refunding.
    if (
      typeof mooncakes !== "number" || !Number.isFinite(mooncakes) || mooncakes < 0 ||
      typeof sold !== "number" || !Number.isFinite(sold) || sold < 0 ||
      typeof flour !== "number" || !Number.isFinite(flour) || flour < 0
    ) return migrated;

    const remainder = (mooncakes - Math.floor(mooncakes)) + (sold - Math.floor(sold));
    const log = save["log"];
    return {
      ...migrated,
      mooncakes: Math.floor(mooncakes),
      sold: Math.floor(sold),
      // Historical sale prices are unavailable: retain earned cash and refund
      // both fractional resources as flour to preserve total flour accounting.
      flour: flour + remainder * FLOUR_PER_CAKE,
      log: remainder > 0 && Array.isArray(log) && log.every(isLogEntry)
        ? [{
          at: save["gameTime"],
          text: "存檔已升級為整顆月餅：庫存與累計銷量的小數已退回麵粉，既有現金保留。",
        }, ...log].slice(0, LOG_LIMIT)
        : log,
    };
  },
};

export function serialize(state: GameState): string {
  // Listing fields explicitly keeps stray runtime properties, functions and
  // undefined out of the payload (AC-23).
  const payload: GameState = {
    schemaVersion: SCHEMA_VERSION,
    rngSeed: state.rngSeed,
    gameTime: state.gameTime,
    act: state.act,
    cash: state.cash,
    flour: state.flour,
    mooncakes: state.mooncakes,
    sold: state.sold,
    productionProgress: state.productionProgress,
    salesProgress: state.salesProgress,
    price: state.price,
    clickYield: state.clickYield,
    autoPress: state.autoPress,
    marketingLevel: state.marketingLevel,
    flourPrice: state.flourPrice,
    flourBonus: state.flourBonus,
    autoBuyFlour: state.autoBuyFlour,
    autoBuyThreshold: state.autoBuyThreshold,
    achievements: [...state.achievements],
    log: state.log.slice(0, LOG_LIMIT).map((entry) => ({
      at: entry.at,
      text: entry.text,
    })),
  };
  return JSON.stringify(payload);
}

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Loose;
  return Number.isFinite(entry["at"]) && (entry["at"] as number) >= 0 && typeof entry["text"] === "string";
}

function validate(save: Loose): GameState | null {
  if (save["schemaVersion"] !== SCHEMA_VERSION) return null;

  for (const field of NUMERIC_FIELDS) {
    if (!Number.isFinite(save[field])) return null;
  }

  for (const field of NUMERIC_FIELDS) {
    if (field !== "rngSeed" && (save[field] as number) < 0) return null;
  }
  if (
    !Number.isInteger(save["rngSeed"]) ||
    (save["rngSeed"] as number) < -0x80000000 ||
    (save["rngSeed"] as number) > 0xffffffff ||
    !Number.isSafeInteger(save["mooncakes"]) ||
    !Number.isSafeInteger(save["sold"]) ||
    !Number.isSafeInteger(save["clickYield"]) ||
    (save["productionProgress"] as number) >= 1 ||
    (save["salesProgress"] as number) >= 1 ||
    !Number.isSafeInteger(save["autoPress"]) ||
    !Number.isSafeInteger(save["marketingLevel"]) ||
    (save["marketingLevel"] as number) < 1 ||
    (save["clickYield"] as number) <= 0 ||
    (save["price"] as number) < MIN_PRICE ||
    (save["price"] as number) > MAX_PRICE ||
    (save["flourPrice"] as number) < FLOUR_PRICE_MIN ||
    (save["flourPrice"] as number) > FLOUR_PRICE_MAX ||
    typeof save["autoBuyFlour"] !== "boolean"
  ) return null;

  const act = save["act"];
  if (act !== 1 && act !== 2 && act !== 3) return null;

  const achievements = save["achievements"];
  if (
    !Array.isArray(achievements) ||
    achievements.some((id) => typeof id !== "string")
  ) {
    return null;
  }

  const log = save["log"];
  if (!Array.isArray(log) || !log.every(isLogEntry)) return null;

  return {
    schemaVersion: SCHEMA_VERSION,
    rngSeed: save["rngSeed"] as number,
    gameTime: save["gameTime"] as number,
    act,
    cash: save["cash"] as number,
    flour: save["flour"] as number,
    mooncakes: save["mooncakes"] as number,
    sold: save["sold"] as number,
    productionProgress: save["productionProgress"] as number,
    salesProgress: save["salesProgress"] as number,
    price: save["price"] as number,
    clickYield: save["clickYield"] as number,
    autoPress: save["autoPress"] as number,
    marketingLevel: save["marketingLevel"] as number,
    flourPrice: save["flourPrice"] as number,
    flourBonus: save["flourBonus"] as number,
    autoBuyFlour: save["autoBuyFlour"] as boolean,
    autoBuyThreshold: save["autoBuyThreshold"] as number,
    achievements: [...(achievements as string[])],
    log: (log as LogEntry[])
      .slice(0, LOG_LIMIT)
      .map((entry) => ({ at: entry.at, text: entry.text })),
  };
}

/** Returns null when the payload is unusable. Never throws. */
export function deserialize(raw: string): GameState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  let save = parsed as Loose;
  const version = save["schemaVersion"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    return null;
  }
  // A save from a newer build may contain fields this version cannot honour.
  if (version > SCHEMA_VERSION) return null;

  for (let v = version; v < SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) return null;
    save = migrate(save);
  }

  return validate(save);
}

/** Always yields a playable state, falling back to a fresh game. */
export function loadState(raw: string | null): {
  state: GameState;
  recovered: boolean;
} {
  if (raw === null) return { state: initialState(), recovered: false };

  const state = deserialize(raw);
  if (state === null) {
    const fresh = initialState();
    return {
      state: { ...fresh, log: pushLog(fresh, "存檔損毀或格式不相容，已開始新局。") },
      recovered: false,
    };
  }

  return { state, recovered: true };
}
