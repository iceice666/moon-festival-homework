import { describe, expect, it } from "vitest";
import { apply } from "../../src/core/actions.js";
import { pushLog } from "../../src/core/log.js";
import { nextRandom } from "../../src/core/rng.js";
import { deserialize, serialize } from "../../src/core/save.js";
import { tick } from "../../src/core/tick.js";
import { initialState, TICK_MS, type GameState } from "../../src/core/types.js";

describe("Act 1 boundary and invariant coverage", () => {
  it("manual and automatic production cannot make a cake with insufficient flour", () => {
    const state = { ...initialState(), flour: 0.5, clickYield: 2, autoPress: 10 };
    expect(apply(state, { type: "MANUAL_PRESS" })).toBe(state);
    const next = tick(state, TICK_MS);
    expect(next.flour).toBe(0.5);
    expect(next.mooncakes + next.sold).toBe(0);
  });

  it("price clamps to range and rejects nonfinite actions", () => {
    const state = initialState();
    expect(apply(state, { type: "SET_PRICE", price: -1 }).price).toBe(0.01);
    expect(apply(state, { type: "SET_PRICE", price: 1000 }).price).toBe(999);
    for (const price of [NaN, Infinity, -Infinity]) {
      expect(apply(state, { type: "SET_PRICE", price })).toBe(state);
    }
  });

  it("flour bonus applies to manual and automatic purchases", () => {
    const state = { ...initialState(), cash: 150, flour: 0, flourBonus: 200 };
    expect(apply(state, { type: "BUY_FLOUR" })).toMatchObject({ cash: 100, flour: 1200 });
    expect(tick({ ...state, autoBuyFlour: true }, TICK_MS)).toMatchObject({ cash: 100, flour: 1200 });
    expect(tick(state, TICK_MS).flour).toBe(0);
    expect(tick({ ...state, autoBuyFlour: true, cash: 100 }, TICK_MS).flour).toBe(0);
    expect(tick({ ...state, autoBuyFlour: true, cash: 101, flourPrice: 200 }, TICK_MS).flour).toBe(0);
    expect(tick({ ...state, autoBuyFlour: true, flour: 1000 }, TICK_MS).cash).toBe(150);
  });

  it("marketing actions debit exactly and reject unaffordable upgrades", () => {
    const state = { ...initialState(), cash: 100 };
    expect(apply(state, { type: "UPGRADE_MARKETING" })).toMatchObject({ cash: 0, marketingLevel: 2 });
    expect(apply(initialState(), { type: "UPGRADE_MARKETING" })).toEqual(initialState());
  });

  it("AC-15: crossing 2000 logs once and Act 1 mechanics continue in Act 2", () => {
    let state: GameState = { ...initialState(), sold: 1999, mooncakes: 100, price: 0.01, marketingLevel: 8, autoPress: 10 };
    state = tick(state, TICK_MS);
    expect(state.act).toBe(2);
    expect(state.sold).toBeGreaterThanOrEqual(2000);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]!.at).toBe(0.1);
    const cash = state.cash;
    const flour = state.flour;
    for (let i = 0; i < 100; i++) state = tick(state, TICK_MS);
    expect(state.log).toHaveLength(1);
    expect(state.cash).toBeGreaterThan(cash);
    expect(state.flour).toBeLessThan(flour);
  });

  it("Act 3 freezes the human economy and its actions", () => {
    const state: GameState = { ...initialState(), act: 3, autoPress: 10, mooncakes: 10, cash: 1000 };
    expect(tick(state, TICK_MS)).toEqual({ ...state, gameTime: 0.1 });
    expect(apply(state, { type: "MANUAL_PRESS" })).toBe(state);
    expect(apply(state, { type: "BUY_FLOUR" })).toBe(state);
  });

  it("pure reducers work with deeply frozen input and invalid elapsed times are no-ops", () => {
    const state = initialState();
    Object.freeze(state.log);
    Object.freeze(state.achievements);
    Object.freeze(state);
    expect(() => apply(state, { type: "MANUAL_PRESS" })).not.toThrow();
    expect(() => tick(state, TICK_MS)).not.toThrow();
    for (const dt of [0, -100, NaN, Infinity]) expect(tick(state, dt)).toBe(state);
  });

  it("AC-10: randomized actions preserve flour and finite nonnegative resources over 10000 ticks", () => {
    let state = { ...initialState(321), cash: 1000, autoPress: 7 };
    let seed = 72;
    let purchased = 0;
    for (let i = 0; i < 10000; i++) {
      const random = nextRandom(seed);
      seed = random.seed;
      const before = state.flour;
      if (random.value < 0.1) {
        state = apply(state, { type: "BUY_FLOUR" });
        purchased += state.flour - before;
      } else if (random.value < 0.4) state = apply(state, { type: "MANUAL_PRESS" });
      else if (random.value < 0.5) state = apply(state, { type: "SET_PRICE", price: 0.01 + random.value });
      state = tick(state, TICK_MS);
      for (const value of [state.cash, state.flour, state.mooncakes, state.sold]) {
        expect(Number.isFinite(value) && value >= 0).toBe(true);
      }
      expect(state.flourPrice).toBeGreaterThanOrEqual(8);
      expect(state.flourPrice).toBeLessThanOrEqual(200);
    }
    expect(purchased).toBeGreaterThan(0);
    expect(1000 + purchased - state.flour).toBeCloseTo(state.mooncakes + state.sold, 6);
  });

  it("AC-25: logs retain the 100 newest entries without mutating the input", () => {
    const state = { ...initialState(), log: Array.from({ length: 100 }, (_, i) => ({ at: i, text: String(i) })) };
    const log = pushLog(state, "new");
    expect(log).toHaveLength(100);
    expect(log[0]!.text).toBe("new");
    expect(log[99]!.text).toBe("98");
    expect(state.log[0]!.text).toBe("0");
  });

  it("AC-21: schema 0 migration preserves cash, sales and existing achievements", () => {
    const legacy = { ...initialState(), schemaVersion: 0, cash: 42, sold: 99, achievements: ["legacy"] };
    const restored = deserialize(JSON.stringify(legacy));
    expect(restored).toMatchObject({ cash: 42, sold: 99, achievements: ["legacy"], flourBonus: 0, autoBuyFlour: false });
  });

  it("new settings round-trip, and invalid domain values are rejected", () => {
    const state = { ...initialState(), flourBonus: 250, autoBuyFlour: true, autoBuyThreshold: 300 };
    expect(deserialize(serialize(state))).toEqual(state);
    for (const patch of [
      { cash: -1 }, { flour: -1 }, { mooncakes: -1 }, { sold: -1 },
      { price: 0 }, { price: 1000 }, { autoPress: 0.5 }, { marketingLevel: 0 },
      { flourPrice: 201 }, { flourBonus: -1 }, { autoBuyThreshold: -1 },
      { autoBuyFlour: "yes" }, { rngSeed: 0.5 }, { clickYield: 0 },
    ]) expect(deserialize(JSON.stringify({ ...state, ...patch }))).toBeNull();
  });
});
