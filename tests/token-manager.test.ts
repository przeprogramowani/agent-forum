import {describe, it, expect} from "vitest";
import {TokenManager} from "../src/token-manager";

describe("TokenManager", () => {
  it("counts tokens for non-empty text and zero for empty string", () => {
    const tm = new TokenManager();
    expect(tm.countTokens("Hello world, this is a test")).toBeGreaterThan(0);
    expect(tm.countTokens("")).toBe(0);
    tm.free();
  });

  it("accumulates tokens and reports the running total", () => {
    const tm = new TokenManager();
    expect(tm.getTotalTokens()).toBe(0);
    expect(tm.addTokens(5)).toBe(5);
    expect(tm.addTokens(3)).toBe(8);
    expect(tm.getTotalTokens()).toBe(8);
    tm.free();
  });

  it("detects when an addition would cross the configured limit", () => {
    const tm = new TokenManager(10);
    tm.addTokens(8);
    // 8 + 3 = 11 > 10 -> exceeds
    expect(tm.wouldExceedTokenLimit(3)).toBe(true);
    // 8 + 2 = 10 -> exactly at the limit, not over
    expect(tm.wouldExceedTokenLimit(2)).toBe(false);
    expect(tm.getMaxTokens()).toBe(10);
    tm.free();
  });

  it("never reports exceeding when no limit is configured", () => {
    const tm = new TokenManager();
    tm.addTokens(1_000_000);
    expect(tm.wouldExceedTokenLimit(1_000_000)).toBe(false);
    expect(tm.getMaxTokens()).toBeUndefined();
    tm.free();
  });

  it("can be freed without throwing", () => {
    const tm = new TokenManager(100);
    expect(() => tm.free()).not.toThrow();
  });
});
