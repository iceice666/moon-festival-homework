/**
 * SPEC §2 S-2: the only way game state advances over time.
 * Pure: no Date.now(), no Math.random(), no DOM, no storage.
 */
import type { GameState } from "./types.js";

export function tick(_state: GameState, _dtMs: number): GameState {
  throw new Error("not implemented");
}
