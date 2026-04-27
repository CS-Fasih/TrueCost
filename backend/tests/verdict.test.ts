import { describe, expect, it } from "vitest";
import { computeVerdict, daysUntilNextSaleSeason } from "../src/services/verdict";
import type { PricePoint } from "../src/types";

const history: PricePoint[] = [100, 120, 160, 200].map((price, index) => ({
  price,
  currency: "USD",
  source: "test",
  observedAt: new Date(Date.UTC(2025, index, 1)).toISOString()
}));

describe("computeVerdict", () => {
  it("flags bottom 20 percent prices as great deals", () => {
    expect(computeVerdict(110, history, 10, new Date("2026-04-01")).tone).toBe("great");
  });

  it("flags top 20 percent prices as overpriced", () => {
    expect(computeVerdict(190, history, 10, new Date("2026-04-01")).tone).toBe("overpriced");
  });

  it("recommends waiting near sale windows", () => {
    expect(computeVerdict(150, history, 10, new Date("2026-11-03")).tone).toBe("wait");
  });

  it("calculates days until a sale season", () => {
    expect(daysUntilNextSaleSeason(new Date("2026-11-01"))).toBe(10);
  });
});
