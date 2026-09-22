import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "../../src/core/save.js";
import { FLOUR_PER_CAKE, initialState, LOG_LIMIT, SCHEMA_VERSION } from "../../src/core/types.js";

function legacy(overrides: Record<string, unknown> = {}) {
  const { productionProgress: _production, salesProgress: _sales, ...state } = initialState(42);
  return { ...state, schemaVersion: 3, ...overrides };
}

describe("integer save schema", () => {
  it.each([0, 1, 2, 3])("migrates schema %i fractions while preserving flour accounting and cash", (schemaVersion) => {
    const before = legacy({ schemaVersion, mooncakes: 12.75, sold: 34.125, flour: 100.5, cash: 27.31 });
    const after = deserialize(JSON.stringify(before))!;
    expect(after).not.toBeNull();
    expect(after.schemaVersion).toBe(SCHEMA_VERSION);
    expect(after.mooncakes).toBe(12);
    expect(after.sold).toBe(34);
    expect(after.flour).toBe(100.5 + 0.875 * FLOUR_PER_CAKE);
    expect(after.flour + (after.mooncakes + after.sold) * FLOUR_PER_CAKE)
      .toBeCloseTo(100.5 + (12.75 + 34.125) * FLOUR_PER_CAKE, 12);
    expect(after.cash).toBe(27.31);
    expect(after.productionProgress).toBe(0);
    expect(after.salesProgress).toBe(0);
    expect(after.log[0]?.text).toContain("退回麵粉");
    expect(after.log[0]?.text).toContain("現金保留");
  });

  it("keeps whole legacy resource counts and logs unchanged", () => {
    const before = legacy({ mooncakes: 12, sold: 34, log: [{ at: 0, text: "old" }] });
    const after = deserialize(JSON.stringify(before))!;
    expect(after.log).toEqual(before.log);
    expect(after.flour).toBe(before.flour);
    expect(after.productionProgress).toBe(0);
    expect(after.salesProgress).toBe(0);
  });

  it("bounds migration logs while retaining the newest entry", () => {
    const before = legacy({ mooncakes: 0.5, log: Array.from({ length: LOG_LIMIT }, (_, at) => ({ at, text: "old" })) });
    const after = deserialize(JSON.stringify(before))!;
    expect(after.log).toHaveLength(LOG_LIMIT);
    expect(after.log[0]?.text).toContain("整顆月餅");
  });

  it("round-trips current partial progress without migration", () => {
    const before = { ...initialState(42), mooncakes: 8, sold: 14, productionProgress: 0.375, salesProgress: 0.875 };
    expect(deserialize(serialize(before))).toEqual(before);
  });

  for (const field of ["productionProgress", "salesProgress"]) {
    it.each([-0.1, 1, 1.1, null, "0.5", Number.NaN, Number.POSITIVE_INFINITY])(`rejects invalid current ${field}: %s`, (value) => {
      expect(deserialize(JSON.stringify({ ...initialState(), [field]: value }))).toBeNull();
    });
    it(`rejects missing current ${field}`, () => {
      const state: Record<string, unknown> = { ...initialState() };
      delete state[field];
      expect(deserialize(JSON.stringify(state))).toBeNull();
    });
  }

  for (const field of ["mooncakes", "sold", "clickYield"]) {
    it.each([0.5, -0.5, Number.MAX_SAFE_INTEGER + 1])(`rejects invalid current integer ${field}: %s`, (value) => {
      expect(deserialize(JSON.stringify({ ...initialState(), [field]: value }))).toBeNull();
    });
  }

  for (const field of ["mooncakes", "sold", "flour"]) {
    it.each([-0.1, -1, null, "0.5", Number.NaN, Number.POSITIVE_INFINITY])(`does not sanitize invalid legacy ${field}: %s`, (value) => {
      expect(deserialize(JSON.stringify(legacy({ mooncakes: 0.75, sold: 0.5, [field]: value })))).toBeNull();
    });
    it(`rejects nonfinite legacy ${field} in raw JSON`, () => {
      const raw = JSON.stringify(legacy({ [field]: "OVERFLOW" })).replace('"OVERFLOW"', "1e400");
      expect(deserialize(raw)).toBeNull();
    });
  }

  it("does not hide a malformed legacy log with a migration note", () => {
    expect(deserialize(JSON.stringify(legacy({ mooncakes: 0.5, log: [{ at: -1, text: "bad" }] })))).toBeNull();
  });
});
