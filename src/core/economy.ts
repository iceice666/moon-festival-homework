/**
 * SPEC §3.1: pricing, demand, lunar phase and 中秋 formulas.
 * Every function here is pure and depends only on its arguments.
 */
import type { GameState } from "./types.js";

/** Fraction of the moon lit, in [0, 1]. 0 at new moon, 1 at full moon. */
export function illumination(_gameTime: number): number {
  throw new Error("not implemented");
}

/** Demand multiplier from the lunar phase, in [0.6, 1.4]. */
export function phaseMult(_gameTime: number): number {
  throw new Error("not implemented");
}

/** Demand multiplier from 中秋 proximity, in [1, 3]. */
export function festivalMult(_gameTime: number): number {
  throw new Error("not implemented");
}

/** Seconds until the next 中秋 peak. Never negative. */
export function timeToFestival(_gameTime: number): number {
  throw new Error("not implemented");
}

/** Mooncakes demanded per second at the current price. */
export function demandRate(_state: GameState): number {
  throw new Error("not implemented");
}

/** Cost of the next auto press when `owned` are already held. */
export function autoPressCost(_owned: number): number {
  throw new Error("not implemented");
}

/** Cost to upgrade marketing from `level` to `level + 1`. */
export function marketingCost(_level: number): number {
  throw new Error("not implemented");
}
