/** The sole production and sales paths (SPEC S-5). Pure and conservative. */
import { FLOUR_PER_CAKE, type GameState } from "./types.js";

/** Only completed whole cakes consume flour; manual callers preflight. */
export function produce(state: GameState, requested: number): GameState {
  if (state.act === 3 || !Number.isFinite(requested) || requested <= 0) return state;
  const quantity = Math.min(Math.floor(requested), Math.floor(state.flour / FLOUR_PER_CAKE));
  if (quantity <= 0 || !Number.isFinite(state.mooncakes + quantity)) return state;
  return {
    ...state,
    flour: Math.max(0, state.flour - quantity * FLOUR_PER_CAKE),
    mooncakes: state.mooncakes + quantity,
  };
}

export function sell(state: GameState, requested: number): GameState {
  if (state.act === 3 || Number.isNaN(requested) || requested <= 0) return state;
  const quantity = Math.min(state.mooncakes, Math.floor(requested));
  const cash = state.cash + quantity * state.price;
  const sold = state.sold + quantity;
  if (quantity <= 0 || !Number.isFinite(cash) || !Number.isFinite(sold)) return state;
  return { ...state, mooncakes: state.mooncakes - quantity, cash, sold };
}
