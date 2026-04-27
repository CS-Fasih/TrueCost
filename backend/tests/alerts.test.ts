import { describe, expect, it } from "vitest";
import { shouldTriggerAlert } from "../src/services/alerts";

describe("shouldTriggerAlert", () => {
  it("triggers when current price is at or below target", () => {
    expect(shouldTriggerAlert(99, 100)).toBe(true);
    expect(shouldTriggerAlert(100, 100)).toBe(true);
  });

  it("does not trigger when the price is above target", () => {
    expect(shouldTriggerAlert(101, 100)).toBe(false);
  });
});
