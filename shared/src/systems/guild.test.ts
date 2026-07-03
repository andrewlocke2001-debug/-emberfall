import { describe, it, expect } from "vitest";
import { validGuildName, validGuildTag, canKick, canSetRank } from "./guild";

describe("validGuildName / validGuildTag", () => {
  it("accepts sensible names and rejects junk", () => {
    expect(validGuildName("The Emberfall Watch")).toBe(true);
    expect(validGuildName("ab")).toBe(false); // too short
    expect(validGuildName(" leading")).toBe(true); // trimmed
    expect(validGuildName("bad<script>")).toBe(false);
    expect(validGuildName("x".repeat(25))).toBe(false);
  });

  it("tags are 2-4 alphanumerics", () => {
    expect(validGuildTag("EFW")).toBe(true);
    expect(validGuildTag("A1")).toBe(true);
    expect(validGuildTag("TOOLONG")).toBe(false);
    expect(validGuildTag("a!")).toBe(false);
  });
});

describe("canKick", () => {
  it("leaders kick officers/members; officers kick members only", () => {
    expect(canKick("leader", "officer")).toBe(true);
    expect(canKick("leader", "member")).toBe(true);
    expect(canKick("leader", "leader")).toBe(false);
    expect(canKick("officer", "member")).toBe(true);
    expect(canKick("officer", "officer")).toBe(false);
    expect(canKick("member", "member")).toBe(false);
  });
});

describe("canSetRank", () => {
  it("only the leader promotes/demotes, never to/from leader", () => {
    expect(canSetRank("leader", "member", "officer")).toBe(true);
    expect(canSetRank("leader", "officer", "member")).toBe(true);
    expect(canSetRank("leader", "member", "leader")).toBe(false);
    expect(canSetRank("leader", "leader", "member")).toBe(false);
    expect(canSetRank("officer", "member", "officer")).toBe(false);
  });
});
