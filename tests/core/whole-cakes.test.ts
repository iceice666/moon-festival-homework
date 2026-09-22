import { describe, expect, it } from "vitest";
import { tick } from "../../src/core/tick";
import { produce, sell } from "../../src/core/resources";
import { initialState } from "../../src/core/types";

describe("whole mooncakes", () => {
  it("accumulates work without consuming flour until a cake is complete", () => {
    let state = { ...initialState(), autoPress: 1, price: 999 };
    for (let i = 0; i < 9; i++) state = tick(state, 100);
    expect(state.mooncakes).toBe(0);
    expect(state.flour).toBe(1000);
    expect(state.productionProgress).toBeCloseTo(0.9);
    state = tick(state, 100);
    expect(state.mooncakes).toBe(1);
    expect(state.flour).toBe(999);
    expect(state.productionProgress).toBe(0);
  });

  it("accumulates demand and receives money only for complete sales", () => {
    let state = { ...initialState(), mooncakes: 10 };
    state = tick(state, 100);
    expect(state.salesProgress).toBeCloseTo(0.03);
    expect(state.sold).toBe(0);
    expect(state.cash).toBe(0);
    for (let i = 0; i < 33; i++) state = tick(state, 100);
    expect(state.sold).toBe(1);
    expect(state.mooncakes).toBe(9);
    expect(state.cash).toBe(0.25);
  });

  it("does not bank demand while out of stock or work while out of flour", () => {
    let state = { ...initialState(), flour: 0.5, autoPress: 10, price: 0.01 };
    for (let i = 0; i < 1000; i++) state = tick(state, 100);
    expect(state.productionProgress).toBe(0);
    expect(state.salesProgress).toBe(0);
    state = tick({ ...state, flour: 1000, autoPress: 1, mooncakes: 1, price: 0.25 }, 100);
    expect(state.sold).toBe(0);
    expect(state.mooncakes).toBe(1);
    expect(state.productionProgress).toBeCloseTo(0.1);
  });

  it("discards excess demand after selling the last cake", () => {
    const state = tick({ ...initialState(), mooncakes: 1, marketingLevel: 10, price: 0.01, salesProgress: 0.8 }, 100);
    expect(state.sold).toBe(1);
    expect(state.salesProgress).toBe(0);
    expect(state.cash).toBe(0.01);
  });

  it("resource helpers never create or sell fractional cakes", () => {
    const state = { ...initialState(), flour: 2.5 };
    const produced = produce(state, 9.9);
    expect(produced.mooncakes).toBe(2);
    expect(produced.flour).toBe(0.5);
    expect(sell(produced, 0.9)).toBe(produced);
    expect(sell(produced, 1.9)).toMatchObject({ mooncakes: 1, sold: 1, cash: 0.25 });
  });

  it("maintains integer stock and sales, bounded progress and conservation over 10000 ticks", () => {
    let state = { ...initialState(), autoPress: 7, flour: 10000, price: 0.08 };
    for (let i = 0; i < 10000; i++) {
      state = tick(state, 100);
      expect(Number.isInteger(state.mooncakes)).toBe(true);
      expect(Number.isInteger(state.sold)).toBe(true);
      for (const progress of [state.productionProgress, state.salesProgress]) {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThan(1);
      }
    }
    expect(10000 - state.flour).toBe(state.mooncakes + state.sold);
    expect(state.mooncakes + state.sold).toBe(7000);
  });
});
