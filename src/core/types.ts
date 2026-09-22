/**
 * Core game types and tuning constants.
 *
 * SPEC §2 S-1: all game state lives in one serializable object.
 * Nothing in this file may import DOM, React, or any I/O.
 */

/** Bumped whenever GameState gains, drops or reshapes a field. See save.ts. */
export const SCHEMA_VERSION = 2;

/** SPEC §2 S-3: fixed timestep. */
export const TICK_MS = 100;
/** SPEC §2 S-3: at most 5 seconds of catch-up per frame. */
export const MAX_CATCHUP_TICKS = 50;

/** SPEC §3.1 */
export const FLOUR_PER_CAKE = 1;
export const BASE_DEMAND = 0.5;
export const REFERENCE_PRICE = 0.25;
export const ELASTICITY = 1.15;
export const MARKETING_STEP = 1.5;
export const MIN_PRICE = 0.01;
export const MAX_PRICE = 999;

/** SPEC §3.1: lunar cycle is 180s; 中秋 every 4th cycle (720s = 12min). */
export const LUNAR_CYCLE = 180;
export const FESTIVAL_PERIOD = 720;
/**
 * 中秋 must fall on a full moon, and full moons sit at LUNAR_CYCLE/2 + k*LUNAR_CYCLE.
 * Therefore (FESTIVAL_PEAK_OFFSET - LUNAR_CYCLE/2) % LUNAR_CYCLE must be 0.
 * 450 = 90 + 180*2 satisfies this and puts the first 中秋 at 7.5 minutes.
 */
export const FESTIVAL_PEAK_OFFSET = 450;
export const FESTIVAL_WINDOW = 30;
export const FESTIVAL_PEAK_MULT = 3.0;

/** SPEC §3.1: Act 1 -> Act 2 transition. */
export const ACT2_SOLD_THRESHOLD = 2000;

export const FLOUR_BATCH_SIZE = 1000;
export const FLOUR_PRICE_MIN = 8;
export const FLOUR_PRICE_MAX = 200;

export const LOG_LIMIT = 100;

export interface LogEntry {
  /** Game time in seconds when the entry was produced. */
  at: number;
  text: string;
}

export interface GameState {
  schemaVersion: number;
  /** SPEC §2 S-4: seeded PRNG state. Advanced in place by rng draws. */
  rngSeed: number;
  /** Elapsed in-game seconds. */
  gameTime: number;
  act: 1 | 2 | 3;

  // Act 1 resources
  cash: number;
  flour: number;
  mooncakes: number;
  sold: number;

  // Act 1 production & market
  price: number;
  clickYield: number;
  autoPress: number;
  marketingLevel: number;
  flourPrice: number;

  /** Unlocked achievement ids. Added in schema v2. */
  achievements: string[];
  log: LogEntry[];
}

export type Action =
  | { type: "MANUAL_PRESS" }
  | { type: "BUY_AUTO_PRESS" }
  | { type: "BUY_FLOUR" }
  | { type: "SET_PRICE"; price: number }
  | { type: "UPGRADE_MARKETING" };

export function initialState(seed = 0x9e3779b9): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    rngSeed: seed,
    gameTime: 0,
    act: 1,
    cash: 0,
    flour: 1000,
    mooncakes: 0,
    sold: 0,
    price: 0.25,
    clickYield: 1,
    autoPress: 0,
    marketingLevel: 1,
    flourPrice: 50,
    achievements: [],
    log: [],
  };
}
