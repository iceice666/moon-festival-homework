import { LOG_LIMIT, type GameState, type LogEntry } from "./types.js";

/**
 * SPEC §3.5: newest first, capped at LOG_LIMIT entries.
 * Returns a new array; never mutates the input.
 */
export function pushLog(state: GameState, text: string): LogEntry[] {
  return [{ at: state.gameTime, text }, ...state.log].slice(0, LOG_LIMIT);
}
