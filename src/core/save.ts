/**
 * SPEC §3.4: persistence, validation and schema migration.
 * Pure string <-> state conversion; touching localStorage is the UI's job.
 */
import {
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
  "price",
  "clickYield",
  "autoPress",
  "marketingLevel",
  "flourPrice",
] as const satisfies readonly (keyof GameState)[];

type Loose = Record<string, unknown>;

/**
 * Migrations are applied in ascending order: migrations[v] upgrades a
 * version-v payload to version v+1.
 */
const migrations: Record<number, (save: Loose) => Loose> = {
  // v1 -> v2: achievements were introduced.
  1: (save) => ({ ...save, schemaVersion: 2, achievements: [] }),
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
    price: state.price,
    clickYield: state.clickYield,
    autoPress: state.autoPress,
    marketingLevel: state.marketingLevel,
    flourPrice: state.flourPrice,
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
  return Number.isFinite(entry["at"]) && typeof entry["text"] === "string";
}

function validate(save: Loose): GameState | null {
  if (save["schemaVersion"] !== SCHEMA_VERSION) return null;

  for (const field of NUMERIC_FIELDS) {
    if (!Number.isFinite(save[field])) return null;
  }

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
    price: save["price"] as number,
    clickYield: save["clickYield"] as number,
    autoPress: save["autoPress"] as number,
    marketingLevel: save["marketingLevel"] as number,
    flourPrice: save["flourPrice"] as number,
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
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
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
  if (state === null) return { state: initialState(), recovered: false };

  return { state, recovered: true };
}
