/**
 * SPEC §2 S-2: the only way game state advances over time.
 * Pure: no Date.now(), no Math.random(), no DOM, no storage.
 */
import { demandRate } from "./economy.js";
import { pushLog } from "./log.js";
import { nextRandom } from "./rng.js";
import {
  ACT2_SOLD_THRESHOLD,
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

  // Production is capped by available flour, so the two can never desync.
  const capacity = state.flour / FLOUR_PER_CAKE;
  const produced = Math.min(state.autoPress * dt, Math.max(capacity, 0));
  const flour = state.flour - produced * FLOUR_PER_CAKE;
  const stock = state.mooncakes + produced;

  // Sales are capped by stock, so `sold` can never exceed what was produced.
  const sellQty = Math.min(stock, demandRate(state) * dt);
  const mooncakes = stock - sellQty;
  const sold = state.sold + sellQty;
  const cash = state.cash + sellQty * state.price;

  const { value, seed } = nextRandom(state.rngSeed);
  const drift = (FLOUR_PRICE_MEAN - state.flourPrice) * FLOUR_REVERSION;
  const shock = (value - 0.5) * FLOUR_VOLATILITY;
  const flourPrice = clamp(
    state.flourPrice + drift + shock,
    FLOUR_PRICE_MIN,
    FLOUR_PRICE_MAX,
  );

  let next: GameState = {
    ...state,
    gameTime: state.gameTime + dt,
    rngSeed: seed,
    flour: Math.max(flour, 0),
    mooncakes: Math.max(mooncakes, 0),
    sold,
    cash: Math.max(cash, 0),
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
