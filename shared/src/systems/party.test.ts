import { describe, it, expect } from "vitest";
import { PartyRegistry } from "./party";
import { PARTY_MAX } from "../types";

describe("PartyRegistry", () => {
  it("invite + accept forms a party with the inviter as leader", () => {
    const r = new PartyRegistry();
    expect(r.invite("Alice", "Bob")).toBe("ok");
    expect(r.inviteFor("bob")).toBe("Alice"); // case-insensitive lookup
    expect(r.accept("Bob")).toBe("ok");
    expect(r.partyOf("alice")).toEqual({ leader: "Alice", members: ["Alice", "Bob"] });
    expect(r.partyOf("Bob")).toEqual(r.partyOf("Alice"));
    expect(r.inviteFor("Bob")).toBeUndefined(); // invite consumed
  });

  it("rejects self-invites and inviting someone already in a party", () => {
    const r = new PartyRegistry();
    expect(r.invite("Alice", "alice")).toBe("self");
    r.invite("Alice", "Bob");
    r.accept("Bob");
    expect(r.invite("Carol", "Bob")).toBe("invitee_in_party");
  });

  it("caps the party at PARTY_MAX", () => {
    const r = new PartyRegistry();
    for (let i = 1; i < PARTY_MAX; i++) {
      r.invite("Lead", `M${i}`);
      expect(r.accept(`M${i}`)).toBe("ok");
    }
    expect(r.partyOf("Lead")!.members).toHaveLength(PARTY_MAX);
    expect(r.invite("Lead", "Extra")).toBe("party_full");
  });

  it("accept without an invite fails", () => {
    const r = new PartyRegistry();
    expect(r.accept("Nobody")).toBe("no_invite");
  });

  it("leave removes the member, promotes a new leader, and disbands at one", () => {
    const r = new PartyRegistry();
    r.invite("Alice", "Bob");
    r.accept("Bob");
    r.invite("Alice", "Carol");
    r.accept("Carol");

    // Leader leaves → Bob promoted, both remaining still partied.
    expect(r.leave("Alice").sort()).toEqual(["Alice", "Bob", "Carol"]);
    expect(r.partyOf("Bob")).toEqual({ leader: "Bob", members: ["Bob", "Carol"] });

    // Down to one → disband.
    r.leave("Carol");
    expect(r.partyOf("Bob")).toBeUndefined();
    expect(r.leave("Bob")).toEqual([]); // already out
  });
});
