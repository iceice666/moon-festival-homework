/**
 * SPEC §2 S-4: deterministic seeded PRNG (mulberry32).
 * Math.random() is forbidden anywhere in src/core.
 */

/** Returns a float in [0, 1) plus the advanced seed. Pure. */
export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: next };
}
