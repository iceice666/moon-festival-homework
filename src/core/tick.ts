/**
 * SPEC §2 S-2: the only way game state advances over time.
 * Pure: no Date.now(), no Math.random(), no DOM, no storage.
 */
import { demandRate } from "./economy.js";
import { apply } from "./actions.js";
import { produce, sell } from "./resources.js";
import { pushLog } from "./log.js";
import { nextRandom } from "./rng.js";
import {
  ACT2_SOLD_THRESHOLD,
  FLOUR_BATCH_SIZE,
  FLOUR_PER_CAKE,
  FLOUR_PRICE_MAX,
  FLOUR_PRICE_MIN,
  type GameState,
} from "./types.js";

/** Mean-reverting spot price walk, so the series never pins to a bound. */
const FLOUR_PRICE_MEAN = 50;
const FLOUR_REVERSION = 0.001;
const FLOUR_VOLATILITY = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function tick(state: GameState, dtMs: number): GameState {
  const dt = dtMs / 1000;
  if (!Number.isFinite(dt) || dt <= 0) return state;

  const gameTime = state.gameTime + dt;
  if (!Number.isFinite(gameTime)) return state;
  if (state.act === 3) return { ...state, gameTime };

  // Refill at most once per tick when unlocked, low on flour and above the
  // cash reserve. Purchases still require the actual spot price in cash.
  let economy = state;
  if (
    state.autoBuyFlour &&
    state.flour < FLOUR_BATCH_SIZE &&
    state.cash > state.autoBuyThreshold
  ) {
    economy = apply(economy, { type: "BUY_FLOUR" });
  }
  // Progress is not stock: consume flour only when a whole cake is finished.
  // Normalize tiny floating-point error (ten 0.1 steps must complete one cake).
  const splitProgress = (value: number) => {
    const nearest = Math.round(value);
    const normalized = Math.abs(value - nearest) < 1e-9 ? nearest : value;
    return { whole: Math.floor(normalized), fraction: normalized % 1 };
  };
  const work = splitProgress(state.productionProgress + state.autoPress * dt);
  economy = produce(economy, work.whole);
  const productionProgress = economy.flour >= FLOUR_PER_CAKE ? work.fraction : 0;

  // Unfulfilled demand expires; an empty shop cannot bank future orders.
  let salesProgress = 0;
  if (economy.mooncakes > 0) {
    const demand = splitProgress(state.salesProgress + demandRate(state) * dt);
    economy = sell(economy, demand.whole);
    if (economy.mooncakes > 0) salesProgress = demand.fraction;
  }
  economy = { ...economy, productionProgress, salesProgress };

  const { value, seed } = nextRandom(state.rngSeed);
  const drift = (FLOUR_PRICE_MEAN - state.flourPrice) * FLOUR_REVERSION;
  const shock = (value - 0.5) * FLOUR_VOLATILITY;
  const flourPrice = clamp(
    state.flourPrice + drift + shock,
    FLOUR_PRICE_MIN,
    FLOUR_PRICE_MAX,
  );

  let next: GameState = {
    ...economy,
    gameTime,
    rngSeed: seed,
    flourPrice,
  };

  if (next.act === 1 && next.sold >= ACT2_SOLD_THRESHOLD) {
    next = {
      ...next,
      act: 2,
      log: pushLog(next, "玉兔自月中探出頭來，願意為你搗藥。"),
    };
  }

  return next;
}
