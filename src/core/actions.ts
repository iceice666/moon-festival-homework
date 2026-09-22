/**
 * SPEC §2 S-2: the only way player input mutates state.
 * Returns the input state unchanged when an action is not affordable
 * or otherwise invalid.
 */
import { autoPressCost, marketingCost } from "./economy.js";
import {
  FLOUR_BATCH_SIZE,
  FLOUR_PER_CAKE,
  MAX_PRICE,
  MIN_PRICE,
  type Action,
  type GameState,
} from "./types.js";

export function apply(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "MANUAL_PRESS": {
      const need = state.clickYield * FLOUR_PER_CAKE;
      if (state.flour < need) return state;
      return {
        ...state,
        flour: state.flour - need,
        mooncakes: state.mooncakes + state.clickYield,
      };
    }

    case "BUY_AUTO_PRESS": {
      const cost = autoPressCost(state.autoPress);
      if (state.cash < cost) return state;
      return { ...state, cash: state.cash - cost, autoPress: state.autoPress + 1 };
    }

    case "BUY_FLOUR": {
      const cost = state.flourPrice;
      if (state.cash < cost) return state;
      return {
        ...state,
        cash: state.cash - cost,
        flour: state.flour + FLOUR_BATCH_SIZE,
      };
    }

    case "SET_PRICE": {
      if (!Number.isFinite(action.price)) return state;
      const price = Math.min(MAX_PRICE, Math.max(MIN_PRICE, action.price));
      if (price === state.price) return state;
      return { ...state, price };
    }

    case "UPGRADE_MARKETING": {
      const cost = marketingCost(state.marketingLevel);
      if (state.cash < cost) return state;
      return {
        ...state,
        cash: state.cash - cost,
        marketingLevel: state.marketingLevel + 1,
      };
    }

    default:
      return state;
  }
}
