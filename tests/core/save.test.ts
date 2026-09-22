import { describe, expect, it } from "vitest";
import { apply } from "../../src/core/actions.js";
import { deserialize, loadState, serialize } from "../../src/core/save.js";
import { tick } from "../../src/core/tick.js";
import { initialState, SCHEMA_VERSION, TICK_MS } from "../../src/core/types.js";

/** A state that has actually been played, not a pristine initial state. */
function playedState() {
  let s = initialState(4242);
  s = apply(s, { type: "MANUAL_PRESS" });
  s = apply(s, { type: "SET_PRICE", price: 0.4 });
  for (let i = 0; i < 300; i++) s = tick(s, TICK_MS);
  return s;
}

describe("save", () => {
  it("AC-20: serialize -> deserialize 為完整 round-trip", () => {
    const before = playedState();
    const after = deserialize(serialize(before));

    expect(after).toEqual(before);
  });

  it("AC-20: round-trip 後繼續模擬會得到相同結果", () => {
    const before = playedState();
    const restored = deserialize(serialize(before))!;

    let a = before;
    let b = restored;
    for (let i = 0; i < 100; i++) {
      a = tick(a, TICK_MS);
      b = tick(b, TICK_MS);
    }

    expect(b).toEqual(a);
  });

  it("AC-21: 舊版存檔可遷移且不遺失 sold / cash / 成就", () => {
    // Schema v1 predates the achievements field.
    const legacy = JSON.stringify({
      schemaVersion: 1,
      rngSeed: 99,
      gameTime: 123.4,
      act: 1,
      cash: 555.5,
      flour: 800,
      mooncakes: 12,
      sold: 345,
      price: 0.3,
      clickYield: 1,
      autoPress: 4,
      marketingLevel: 2,
      flourPrice: 61.25,
      log: [{ at: 10, text: "舊日誌" }],
    });

    const state = deserialize(legacy)!;

    expect(state).not.toBeNull();
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.cash).toBe(555.5);
    expect(state.sold).toBe(345);
    expect(state.autoPress).toBe(4);
    expect(state.log).toEqual([{ at: 10, text: "舊日誌" }]);
    expect(state.achievements).toEqual([]);
  });

  it("AC-21: 遷移後的存檔可直接用於模擬", () => {
    const legacy = serialize({ ...initialState(7), sold: 50 });
    const migrated = deserialize(legacy)!;
    const advanced = tick(migrated, TICK_MS);

    expect(Number.isFinite(advanced.gameTime)).toBe(true);
    expect(advanced.sold).toBeGreaterThanOrEqual(50);
  });

  it("AC-22: 非法輸入回傳全新初始狀態且不拋例外", () => {
    const bad = [
      "",
      "{",
      "null",
      "[]",
      '"a string"',
      "{}",
      '{"schemaVersion":1}',
      JSON.stringify({ ...initialState(), cash: "十元" }),
      JSON.stringify({ ...initialState(), sold: Number.NaN }),
      JSON.stringify({ ...initialState(), log: "not an array" }),
    ];

    for (const raw of bad) {
      expect(() => deserialize(raw)).not.toThrow();
      expect(deserialize(raw)).toBeNull();

      const { state, recovered } = loadState(raw);
      expect(recovered).toBe(false);
      expect(state).toEqual({ ...initialState(state.rngSeed), log: state.log });
      expect(state.log).toHaveLength(1);
      expect(state.log[0]!.text).toContain("存檔");
    }
  });

  it("AC-22: 來自未來版本的存檔視為不可用", () => {
    const future = JSON.stringify({
      ...initialState(),
      schemaVersion: SCHEMA_VERSION + 1,
    });

    expect(deserialize(future)).toBeNull();
  });

  it("AC-22: null 輸入（首次遊玩）回傳初始狀態", () => {
    const { state, recovered } = loadState(null);

    expect(recovered).toBe(false);
    expect(state).toEqual(initialState(state.rngSeed));
  });

  it("AC-22: 有效存檔的 loadState 回報 recovered", () => {
    const { state, recovered } = loadState(serialize(playedState()));

    expect(recovered).toBe(true);
    expect(state).toEqual(playedState());
  });

  it("AC-23: 序列化結果不含函式或 undefined，且長度有限", () => {
    const raw = serialize(playedState());
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    for (const value of Object.values(parsed)) {
      expect(typeof value).not.toBe("function");
      expect(value).not.toBeUndefined();
    }
    expect(raw.length).toBeLessThan(64_000);
  });

  it("AC-23: 日誌長滿時序列化長度仍有界", () => {
    const noisy = {
      ...playedState(),
      log: Array.from({ length: 100 }, (_, i) => ({
        at: i,
        text: "玉兔搗藥的聲音在廣寒宮迴盪".repeat(4),
      })),
    };

    expect(serialize(noisy).length).toBeLessThan(64_000);
  });
});
