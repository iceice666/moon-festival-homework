import { tick } from "../core/tick.js";
import { MAX_CATCHUP_TICKS, TICK_MS, type GameState } from "../core/types.js";

export interface FrameResult {
  state: GameState;
  remainderMs: number;
  ticks: number;
}

/** Advance fixed simulation steps, dropping excess catch-up but not fractional time. */
export function advanceFrame(
  state: GameState,
  remainderMs: number,
  elapsedMs: number,
): FrameResult {
  const remainder = Number.isFinite(remainderMs) && remainderMs >= 0
    ? remainderMs % TICK_MS
    : 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return { state, remainderMs: remainder, ticks: 0 };
  }

  const accumulated = remainder + elapsedMs;
  const ticks = Math.min(Math.floor(accumulated / TICK_MS), MAX_CATCHUP_TICKS);
  let next = state;
  for (let i = 0; i < ticks; i++) next = tick(next, TICK_MS);
  return { state: next, remainderMs: accumulated % TICK_MS, ticks };
}

/** Round up so a future event never displays zero seconds prematurely. */
export function formatCountdown(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const remainder = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
