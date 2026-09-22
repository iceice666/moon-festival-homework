/**
 * SPEC §3.1: pricing, demand, lunar phase and 中秋 formulas.
 * Every function here is pure and depends only on its arguments.
 */
import {
  BASE_DEMAND,
  ELASTICITY,
  FESTIVAL_PEAK_MULT,
  FESTIVAL_PEAK_OFFSET,
  FESTIVAL_PERIOD,
  FESTIVAL_WINDOW,
  LUNAR_CYCLE,
  MARKETING_STEP,
  REFERENCE_PRICE,
  type GameState,
} from "./types.js";

/** Always-positive modulo, so negative game times stay well defined. */
function mod(value: number, m: number): number {
  return ((value % m) + m) % m;
}

/** Fraction of the moon lit, in [0, 1]. 0 at new moon, 1 at full moon. */
export function illumination(gameTime: number): number {
  const phase = mod(gameTime, LUNAR_CYCLE) / LUNAR_CYCLE;
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** Demand multiplier from the lunar phase, in [0.6, 1.4]. */
export function phaseMult(gameTime: number): number {
  return 0.6 + 0.8 * illumination(gameTime);
}

/** Demand multiplier from 中秋 proximity, in [1, 3]. */
export function festivalMult(gameTime: number): number {
  const fromPeak = mod(gameTime - FESTIVAL_PEAK_OFFSET, FESTIVAL_PERIOD);
  const distance = Math.min(fromPeak, FESTIVAL_PERIOD - fromPeak);
  if (distance >= FESTIVAL_WINDOW) return 1;
  return 1 + (FESTIVAL_PEAK_MULT - 1) * (1 - distance / FESTIVAL_WINDOW);
}

/** Seconds until the next 中秋 peak. Never negative. */
export function timeToFestival(gameTime: number): number {
  return mod(FESTIVAL_PEAK_OFFSET - gameTime, FESTIVAL_PERIOD);
}

/** Mooncakes demanded per second at the current price. */
export function demandRate(state: GameState): number {
  const priceFactor = Math.pow(REFERENCE_PRICE / state.price, ELASTICITY);
  const marketing = Math.pow(MARKETING_STEP, state.marketingLevel - 1);
  return (
    BASE_DEMAND *
    priceFactor *
    marketing *
    phaseMult(state.gameTime) *
    festivalMult(state.gameTime)
  );
}

/** Cost of the next auto press when `owned` are already held. */
export function autoPressCost(owned: number): number {
  return Math.ceil(5 * Math.pow(1.1, owned));
}

/** Cost to upgrade marketing from `level` to `level + 1`. */
export function marketingCost(level: number): number {
  return Math.round(100 * Math.pow(3, level - 1));
}
