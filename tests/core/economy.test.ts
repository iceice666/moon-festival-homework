import { describe, expect, it } from "vitest";
import { apply } from "../../src/core/actions.js";
import {
  autoPressCost,
  demandRate,
  marketingCost,
} from "../../src/core/economy.js";
import { tick } from "../../src/core/tick.js";
import { initialState, TICK_MS } from "../../src/core/types.js";

describe("economy", () => {
  it("AC-6: 需求對價格嚴格單調遞減", () => {
    const base = initialState();
    const prices = [0.05, 0.1, 0.25, 0.5, 1, 5, 20, 100, 999];
    const rates = prices.map((price) => demandRate({ ...base, price }));

    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!).toBeLessThan(rates[i - 1]!);
    }
  });

  it("AC-7: 行銷每升一級，需求恰為 1.5 倍", () => {
    const base = initialState();
    const l1 = demandRate({ ...base, marketingLevel: 1 });
    const l2 = demandRate({ ...base, marketingLevel: 2 });
    const l3 = demandRate({ ...base, marketingLevel: 3 });

    expect(l2 / l1).toBeCloseTo(1.5, 10);
    expect(l3 / l2).toBeCloseTo(1.5, 10);
  });

  it("AC-8: 售出量不超過庫存，且現金與庫存永不為負", () => {
    let s = { ...initialState(), mooncakes: 5, price: 0.01, autoPress: 0, flour: 0 };
    for (let i = 0; i < 600; i++) s = tick(s, TICK_MS);

    expect(s.mooncakes).toBeGreaterThanOrEqual(0);
    expect(s.cash).toBeGreaterThanOrEqual(0);
    expect(s.sold).toBeLessThanOrEqual(5);
  });

  it("AC-9: 第 n 台壓模機價格為 ceil(5 * 1.1^n)", () => {
    expect(autoPressCost(0)).toBe(5);
    expect(autoPressCost(1)).toBe(Math.ceil(5 * 1.1));
    expect(autoPressCost(10)).toBe(Math.ceil(5 * Math.pow(1.1, 10)));
  });

  it("AC-9: 購買後現金恰減該金額且機台加一", () => {
    const before = { ...initialState(), cash: 1000 };
    const after = apply(before, { type: "BUY_AUTO_PRESS" });

    expect(after.autoPress).toBe(1);
    expect(after.cash).toBe(1000 - autoPressCost(0));
  });

  it("AC-9: 現金不足時購買為 no-op", () => {
    const broke = { ...initialState(), cash: 1 };
    expect(apply(broke, { type: "BUY_AUTO_PRESS" })).toEqual(broke);
  });

  it("行銷升級成本為 100 * 3^(l-1)", () => {
    expect(marketingCost(1)).toBe(100);
    expect(marketingCost(2)).toBe(300);
    expect(marketingCost(3)).toBe(900);
  });

  it("AC-10: 麵粉守恆 — 消耗量恰等於產量", () => {
    const start = { ...initialState(), autoPress: 7, flour: 5000, price: 0.2 };
    let s = start;
    let bought = 0;

    for (let i = 0; i < 10_000; i++) {
      s = tick(s, TICK_MS);
      if (i % 500 === 0) {
        const before = s;
        s = apply(s, { type: "BUY_FLOUR" });
        bought += s.flour - before.flour;
      }
    }

    // Guard against a vacuous test: the run must actually restock at least once.
    expect(bought).toBeGreaterThan(0);

    const produced = s.mooncakes + s.sold;
    const consumed = start.flour + bought - s.flour;
    expect(consumed).toBeCloseTo(produced, 6);
  });

  it("AC-10: 模擬後所有資源皆為有限非負數", () => {
    let s = { ...initialState(), autoPress: 7, flour: 5000 };
    for (let i = 0; i < 10_000; i++) s = tick(s, TICK_MS);

    for (const key of ["cash", "flour", "mooncakes", "sold"] as const) {
      expect(Number.isFinite(s[key])).toBe(true);
      expect(s[key]).toBeGreaterThanOrEqual(0);
    }
  });
});
