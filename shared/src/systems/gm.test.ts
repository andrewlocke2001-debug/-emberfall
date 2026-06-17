import { describe, it, expect } from "vitest";
import { parseGmAllowlist, isGm, parseCommand } from "./gm";

describe("parseGmAllowlist", () => {
  it("splits, trims, lowercases, and drops blanks", () => {
    const set = parseGmAllowlist("Andre, GMTest ,, bob");
    expect([...set].sort()).toEqual(["andre", "bob", "gmtest"]);
  });

  it("is empty for undefined / empty input", () => {
    expect(parseGmAllowlist(undefined).size).toBe(0);
    expect(parseGmAllowlist("").size).toBe(0);
    expect(parseGmAllowlist("  ,  ").size).toBe(0);
  });
});

describe("isGm", () => {
  const allow = parseGmAllowlist("Andre, GMTest");
  it("matches case-insensitively", () => {
    expect(isGm("andre", allow)).toBe(true);
    expect(isGm("GMTEST", allow)).toBe(true);
    expect(isGm("  Andre ", allow)).toBe(true);
  });
  it("rejects non-GMs and an empty allowlist", () => {
    expect(isGm("Mallory", allow)).toBe(false);
    expect(isGm("Andre", parseGmAllowlist(""))).toBe(false);
  });
});

describe("parseCommand", () => {
  it("returns null for non-commands", () => {
    expect(parseCommand("hello world")).toBeNull();
    expect(parseCommand("  not a / command")).toBeNull();
    expect(parseCommand("/")).toBeNull();
    expect(parseCommand("/   ")).toBeNull();
  });

  it("parses the command name (lower-cased) and args", () => {
    expect(parseCommand("/tp 100 200")).toEqual({ cmd: "tp", args: ["100", "200"] });
    expect(parseCommand("/HEAL")).toEqual({ cmd: "heal", args: [] });
    expect(parseCommand("  /spawn   wolf  ")).toEqual({ cmd: "spawn", args: ["wolf"] });
  });

  it("preserves arg case (names are case-sensitive) while collapsing spaces", () => {
    expect(parseCommand("/kick Bob")).toEqual({ cmd: "kick", args: ["Bob"] });
  });
});
