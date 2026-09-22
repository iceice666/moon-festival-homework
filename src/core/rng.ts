/**
 * SPEC §2 S-4: deterministic seeded PRNG (mulberry32).
 * Math.random() is forbidden anywhere in src/core.
 */

/** Returns a float in [0, 1) plus the advanced seed. Pure. */
export function nextRandom(_seed: number): { value: number; seed: number } {
  throw new Error("not implemented");
}
