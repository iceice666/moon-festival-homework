/**
 * SPEC §2 S-2: the only way player input mutates state.
 * Returns the input state unchanged (same value, new object not required)
 * when an action is not affordable or otherwise invalid.
 */
import type { Action, GameState } from "./types.js";

export function apply(_state: GameState, _action: Action): GameState {
  throw new Error("not implemented");
}
