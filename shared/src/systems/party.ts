import { PARTY_MAX } from "../types";

/**
 * Party membership registry — pure in-memory state (no I/O), keyed by
 * lower-cased display name with original casing preserved. The server holds
 * one instance (services/party.ts); rooms wire it to netcode. Parties are
 * transient (not persisted): they survive zone travel and brief relogs —
 * members simply show offline via presence — and end only by leaving.
 */
export interface PartyView {
  /** Display name of the leader. */
  leader: string;
  /** Display names of all members (leader included), join order. */
  members: string[];
}

const key = (name: string): string => name.trim().toLowerCase();

export type InviteResult = "ok" | "invitee_in_party" | "party_full" | "self";
export type AcceptResult = "ok" | "no_invite" | "already_in_party" | "party_full";

export class PartyRegistry {
  /** party id → view. Ids are internal only. */
  private readonly parties = new Map<number, PartyView>();
  /** member key → party id. */
  private readonly membership = new Map<string, number>();
  /** invitee key → inviter display name (latest invite wins). */
  private readonly invites = new Map<string, string>();
  private seq = 0;

  /** The party a player belongs to, if any. */
  partyOf(name: string): PartyView | undefined {
    const id = this.membership.get(key(name));
    return id === undefined ? undefined : this.parties.get(id);
  }

  /** Who invited this player, if there's a pending invite. */
  inviteFor(name: string): string | undefined {
    return this.invites.get(key(name));
  }

  /** Record an invite from `inviter` to `invitee` (latest invite wins). */
  invite(inviter: string, invitee: string): InviteResult {
    if (key(inviter) === key(invitee)) return "self";
    if (this.membership.has(key(invitee))) return "invitee_in_party";
    const party = this.partyOf(inviter);
    if (party && party.members.length >= PARTY_MAX) return "party_full";
    this.invites.set(key(invitee), inviter);
    return "ok";
  }

  /**
   * Accept a pending invite: joins the inviter's party, creating it (inviter
   * as leader) if they aren't in one yet. Consumes the invite either way.
   */
  accept(invitee: string): AcceptResult {
    const inviter = this.invites.get(key(invitee));
    if (!inviter) return "no_invite";
    this.invites.delete(key(invitee));
    if (this.membership.has(key(invitee))) return "already_in_party";

    let id = this.membership.get(key(inviter));
    if (id === undefined) {
      id = ++this.seq;
      this.parties.set(id, { leader: inviter, members: [inviter] });
      this.membership.set(key(inviter), id);
    }
    const party = this.parties.get(id)!;
    if (party.members.length >= PARTY_MAX) return "party_full";
    party.members.push(invitee);
    this.membership.set(key(invitee), id);
    return "ok";
  }

  /**
   * Leave the current party. Returns the names still needing a roster update
   * (the leaver + remaining members). Disbands at one member; promotes the
   * next member if the leader left.
   */
  leave(name: string): string[] {
    const id = this.membership.get(key(name));
    if (id === undefined) return [];
    const party = this.parties.get(id)!;
    const affected = [...party.members];
    party.members = party.members.filter((m) => key(m) !== key(name));
    this.membership.delete(key(name));

    if (party.members.length <= 1) {
      for (const m of party.members) this.membership.delete(key(m));
      this.parties.delete(id);
    } else if (key(party.leader) === key(name)) {
      party.leader = party.members[0]!;
    }
    return affected;
  }
}
