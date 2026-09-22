/**
 * SPEC §3.4: persistence, validation and schema migration.
 * Pure string <-> state conversion; touching localStorage is the UI's job.
 */
import type { GameState } from "./types.js";

/** localStorage key. Stays stable across schema versions. */
export const SAVE_KEY = "mooncake-save-v1";

export function serialize(_state: GameState): string {
  throw new Error("not implemented");
}

/** Returns null when the payload is unusable. Never throws. */
export function deserialize(_raw: string): GameState | null {
  throw new Error("not implemented");
}

/** Always yields a playable state, falling back to a fresh game. */
export function loadState(_raw: string | null): {
  state: GameState;
  recovered: boolean;
} {
  throw new Error("not implemented");
}
