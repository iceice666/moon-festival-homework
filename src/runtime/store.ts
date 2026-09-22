import { apply } from "../core/actions";
import { deserialize, loadState, SAVE_KEY, serialize } from "../core/save";
import { initialState, type Action, type GameState } from "../core/types";
import { advanceFrame } from "./loop";

// This adapter alone owns browser I/O; the core remains deterministic.
export function createGameStore(storage: Pick<Storage, "getItem" | "setItem">) {
  let raw: string | null = null;
  let notice = "每 10 秒自動存檔；離線期間不累積進度。";
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    notice = "無法讀取瀏覽器存檔，請使用匯出存檔保留進度。";
  }
  let state: GameState = loadState(raw).state;
  const listeners = new Set<() => void>();
  let remainderMs = 0;
  let previous: number | null = null;
  function emit() { listeners.forEach((listener) => listener()); }
  function save() {
    try {
      storage.setItem(SAVE_KEY, serialize(state));
      notice = "進度已儲存於此瀏覽器。";
    } catch {
      notice = "存檔失敗：瀏覽器儲存空間不可用，請匯出存檔。";
    }
    emit();
  }
  function resetClock() { previous = null; remainderMs = 0; }
  return {
    getState: () => state,
    getNotice: () => notice,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispatch(action: Action) { state = apply(state, action); emit(); },
    frame(now: number) {
      if (previous !== null) {
        const result = advanceFrame(state, remainderMs, now - previous);
        state = result.state;
        remainderMs = result.remainderMs;
        if (result.ticks > 0) emit();
      }
      previous = now;
    },
    resetClock,
    save,
    exportSave: () => serialize(state),
    importSave(text: string) {
      const restored = deserialize(text);
      if (!restored) {
        notice = "匯入失敗：存檔格式或版本不正確，目前進度未變更。";
        emit();
        return false;
      }
      state = restored;
      resetClock();
      save();
      return true;
    },
    restart() { state = initialState(); resetClock(); save(); },
    notify(message: string) { notice = message; emit(); },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;

export function startGame(store: GameStore): () => void {
  let frameId = 0;
  function frame(now: number) {
    if (!document.hidden) store.frame(now);
    frameId = requestAnimationFrame(frame);
  }
  function visibility() {
    store.resetClock();
    if (document.hidden) store.save();
  }
  frameId = requestAnimationFrame(frame);
  const timer = window.setInterval(store.save, 10_000);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    cancelAnimationFrame(frameId);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visibility);
  };
}
