import { describe, expect, it } from "vitest";
import {
  festivalMult,
  illumination,
  phaseMult,
  timeToFestival,
} from "../../src/core/economy.js";
import {
  FESTIVAL_PEAK_MULT,
  FESTIVAL_PERIOD,
  LUNAR_CYCLE,
} from "../../src/core/types.js";

describe("lunar phase", () => {
  it("AC-11: 新月為 0、滿月為 1", () => {
    expect(illumination(0)).toBeCloseTo(0, 10);
    expect(illumination(LUNAR_CYCLE / 2)).toBeCloseTo(1, 10);
    expect(illumination(LUNAR_CYCLE)).toBeCloseTo(0, 10);
  });

  it("AC-12: phaseMult 恆落於 [0.6, 1.4]", () => {
    for (let t = 0; t < FESTIVAL_PERIOD * 2; t += 0.5) {
      const m = phaseMult(t);
      expect(m).toBeGreaterThanOrEqual(0.6 - 1e-9);
      expect(m).toBeLessThanOrEqual(1.4 + 1e-9);
    }
  });

  it("AC-13: 中秋當下乘數為 3.0，平日為 1.0", () => {
    expect(festivalMult(360)).toBeCloseTo(FESTIVAL_PEAK_MULT, 10);
    expect(festivalMult(360 + FESTIVAL_PERIOD)).toBeCloseTo(FESTIVAL_PEAK_MULT, 10);
    expect(festivalMult(300)).toBeCloseTo(1, 10);
    expect(festivalMult(0)).toBeCloseTo(1, 10);
  });

  it("AC-13: 中秋乘數恆落於 [1, 3]", () => {
    for (let t = 0; t < FESTIVAL_PERIOD * 2; t += 0.5) {
      const m = festivalMult(t);
      expect(m).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(m).toBeLessThanOrEqual(FESTIVAL_PEAK_MULT + 1e-9);
    }
  });

  it("AC-13: 中秋當下必為滿月", () => {
    expect(illumination(360)).toBeCloseTo(1, 10);
  });

  it("AC-14: 倒數在中秋當下為 0，且恆不為負", () => {
    expect(timeToFestival(360)).toBeCloseTo(0, 10);
    expect(timeToFestival(0)).toBeCloseTo(360, 10);

    for (let t = 0; t < FESTIVAL_PERIOD * 3; t += 0.5) {
      const remaining = timeToFestival(t);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(FESTIVAL_PERIOD);
    }
  });
});
