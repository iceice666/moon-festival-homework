import { describe, expect, it } from "vitest";
import { createGameStore } from "../../src/runtime/store";
import { initialState } from "../../src/core/types";
import { SAVE_KEY, serialize } from "../../src/core/save";

function memoryStorage(raw: string | null = null) {
  const values = new Map<string, string>();
  if (raw !== null) values.set(SAVE_KEY, raw);
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe("browser store adapter", () => {
  it("dispatches once, notifies and persists a reloadable state", () => {
    const storage = memoryStorage();
    const store = createGameStore(storage);
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });
    store.dispatch({ type: "MANUAL_PRESS" });
    expect(store.getState().mooncakes).toBe(1);
    expect(calls).toBe(1);
    store.save();
    expect(createGameStore(storage).getState()).toEqual(store.getState());
    unsubscribe();
    store.dispatch({ type: "MANUAL_PRESS" });
    expect(calls).toBe(2);
  });
  it("keeps a remainder and never adds offline time after resetting the clock", () => {
    const store = createGameStore(memoryStorage());
    store.frame(1000);
    store.frame(1150);
    expect(store.getState().gameTime).toBe(0.1);
    store.resetClock();
    store.frame(9_000_000);
    expect(store.getState().gameTime).toBe(0.1);
    store.frame(9_000_100);
    expect(store.getState().gameTime).toBe(0.2);
  });
  it("rejects invalid imports without overwriting progress, imports and restarts", () => {
    const store = createGameStore(memoryStorage());
    store.dispatch({ type: "MANUAL_PRESS" });
    const previous = store.getState();
    expect(store.importSave("bad json")).toBe(false);
    expect(store.getState()).toBe(previous);
    const saved = { ...initialState(), sold: 123, cash: 50 };
    expect(store.importSave(serialize(saved))).toBe(true);
    expect(store.getState()).toEqual(saved);
    store.restart();
    expect(store.getState()).toEqual(initialState());
  });
  it("recovers from unavailable browser storage without crashing", () => {
    const store = createGameStore({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } });
    expect(store.getState()).toEqual(initialState());
    expect(store.getNotice()).toContain("無法讀取");
    expect(() => store.save()).not.toThrow();
    expect(store.getNotice()).toContain("存檔失敗");
    store.dispatch({ type: "MANUAL_PRESS" });
    expect(store.getState().mooncakes).toBe(1);
  });
});
