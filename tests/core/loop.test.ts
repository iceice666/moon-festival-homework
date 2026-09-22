import { describe, expect, it } from "vitest";
import { apply } from "../../src/core/actions.js";
import { tick } from "../../src/core/tick.js";
import { initialState, TICK_MS } from "../../src/core/types.js";

/**
 * A price high enough that demand is effectively zero, so AC-3 measures
 * production in isolation from sales.
 */
const MAX_UNSELLABLE = 999;

/** Advance `seconds` of game time in TICK_MS steps. */
function run(state = initialState(), seconds: number) {
  const steps = Math.round((seconds * 1000) / TICK_MS);
  let s = state;
  for (let i = 0; i < steps; i++) s = tick(s, TICK_MS);
  return s;
}

describe("core loop", () => {
  it("AC-1: 單次點擊恰好產出一顆並消耗一兩麵粉", () => {
    const before = initialState();
    const after = apply(before, { type: "MANUAL_PRESS" });

    expect(after.mooncakes).toBe(1);
    expect(after.flour).toBe(before.flour - 1);
  });

  it("AC-1: N 次點擊恰好產出 N 顆（不得重複計分）", () => {
    let s = initialState();
    for (let i = 0; i < 25; i++) s = apply(s, { type: "MANUAL_PRESS" });

    expect(s.mooncakes).toBe(25);
    expect(s.flour).toBe(initialState().flour - 25);
  });

  it("AC-2: 麵粉耗盡時點擊為 no-op，狀態完全不變", () => {
    const empty = { ...initialState(), flour: 0 };
    const after = apply(empty, { type: "MANUAL_PRESS" });

    expect(after).toEqual(empty);
  });

  it("AC-3: 10 台壓模機跑 10 秒恰好產出 100 顆", () => {
    const s = run({ ...initialState(), autoPress: 10, flour: 1e6, price: MAX_UNSELLABLE }, 10);

    expect(s.mooncakes + s.sold).toBeCloseTo(100, 6);
  });

  it("AC-4: tick 不得就地修改傳入的狀態", () => {
    const before = { ...initialState(), autoPress: 5 };
    const snapshot = structuredClone(before);
    tick(before, TICK_MS);

    expect(before).toEqual(snapshot);
  });

  it("AC-5: 相同 seed 的兩條模擬在 10000 tick 後完全相同", () => {
    const a = run({ ...initialState(1234), autoPress: 3 }, 1000);
    const b = run({ ...initialState(1234), autoPress: 3 }, 1000);

    expect(a).toEqual(b);
  });

  it("AC-5: 不同 seed 會產生不同的麵粉現貨價走勢", () => {
    const a = run(initialState(1), 1000);
    const b = run(initialState(2), 1000);

    expect(a.flourPrice).not.toBe(b.flourPrice);
  });
});
