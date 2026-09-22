import { describe, expect, it } from "vitest";
import { tick } from "../../src/core/tick.js";
import { initialState, TICK_MS } from "../../src/core/types.js";
import { advanceFrame, formatCountdown } from "../../src/runtime/loop.js";

describe("fixed frame accumulator", () => {
  it("advances in exact 100 ms steps without mutating the input", () => {
    const state = initialState();
    const snapshot = structuredClone(state);
    const frame = advanceFrame(state, 0, 200);
    expect(frame).toEqual({
      state: tick(tick(state, TICK_MS), TICK_MS),
      remainderMs: 0,
      ticks: 2,
    });
    expect(state).toEqual(snapshot);
  });

  it("carries sub-tick time into the next frame", () => {
    const state = initialState();
    const first = advanceFrame(state, 0, 65);
    expect(first.state).toBe(state);
    expect(first.ticks).toBe(0);
    expect(first.remainderMs).toBe(65);
    const second = advanceFrame(first.state, first.remainderMs, 60);
    expect(second.state).toEqual(tick(state, TICK_MS));
    expect(second.ticks).toBe(1);
    expect(second.remainderMs).toBe(25);
  });

  it("caps at 50 ticks and discards whole excess ticks, keeping the remainder", () => {
    const state = initialState();
    const frame = advanceFrame(state, 35, 60_050);
    let expected = state;
    for (let i = 0; i < 50; i++) expected = tick(expected, TICK_MS);
    expect(frame).toEqual({ state: expected, ticks: 50, remainderMs: 85 });
    const next = advanceFrame(frame.state, frame.remainderMs, 15);
    expect(next.ticks).toBe(1);
    expect(next.remainderMs).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "ignores invalid or nonpositive elapsed time %s without losing the remainder",
    (elapsed) => {
      const state = initialState();
      const frame = advanceFrame(state, 35, elapsed);
      expect(frame).toEqual({ state, ticks: 0, remainderMs: 35 });
      expect(frame.state).toBe(state);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "recovers from an invalid remainder %s",
    (remainder) => {
      expect(advanceFrame(initialState(), remainder, 125).remainderMs).toBe(25);
    },
  );
});

describe("countdown formatting", () => {
  it.each([
    [0, "00:00"],
    [-1, "00:00"],
    [0.01, "00:01"],
    [59.1, "01:00"],
    [60, "01:00"],
    [450, "07:30"],
    [6000, "100:00"],
    [Number.NaN, "00:00"],
    [Number.POSITIVE_INFINITY, "00:00"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});
