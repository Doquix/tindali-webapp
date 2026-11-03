import { describe, expect, it } from "vitest";
import { codeMatches, parseCodes, RateLimiter } from "./guard";

describe("access codes", () => {
  it("parses a comma list and drops codes shorter than 6", () => {
    expect(parseCodes(" store-one, store-two ,abc,, ")).toEqual(["store-one", "store-two"]);
    expect(parseCodes(undefined)).toEqual([]);
  });

  it("accepts only a configured code", () => {
    const codes = ["store-one", "store-two"];
    expect(codeMatches("store-two", codes)).toBe(true);
    expect(codeMatches(" store-one ", codes)).toBe(true);
    expect(codeMatches("store-thr", codes)).toBe(false);
    expect(codeMatches("", codes)).toBe(false);
    expect(codeMatches(undefined, codes)).toBe(false);
    expect(codeMatches(["store-one"], codes)).toBe(false);
  });

  it("rejects everything when no codes are configured", () => {
    expect(codeMatches("anything", [])).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows 20 per hour per IP, then says when to retry", () => {
    let now = 0;
    const limiter = new RateLimiter(20, 60 * 60 * 1000, () => now);
    for (let i = 0; i < 20; i++) {
      expect(limiter.hit("1.1.1.1").ok).toBe(true);
      now += 60_000;
    }
    const blocked = limiter.hit("1.1.1.1");
    expect(blocked).toEqual({ ok: false, retryAfterSec: 40 * 60 });
    expect(limiter.hit("2.2.2.2").ok).toBe(true);
  });

  it("frees a slot once the oldest hit leaves the window", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    limiter.hit("ip");
    now = 500;
    limiter.hit("ip");
    expect(limiter.hit("ip").ok).toBe(false);
    now = 1001;
    expect(limiter.hit("ip").ok).toBe(true);
  });
});
