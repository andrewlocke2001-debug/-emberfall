import { describe, it, expect } from "vitest";
import { RateLimiter } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("a", 100)).toBe(true);
    expect(rl.allow("a", 200)).toBe(true);
    expect(rl.allow("a", 300)).toBe(false); // 4th within 1s
  });

  it("frees up as old hits fall out of the window", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("a", 500)).toBe(true);
    expect(rl.allow("a", 900)).toBe(false);
    expect(rl.allow("a", 1100)).toBe(true); // the t=0 hit aged out
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("b", 0)).toBe(true);
    expect(rl.allow("a", 1)).toBe(false);
  });

  it("forget() resets a key", () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("a", 1)).toBe(false);
    rl.forget("a");
    expect(rl.allow("a", 2)).toBe(true);
  });
});
