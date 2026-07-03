/**
 * Guild rules — pure validation + rank permissions, shared by server
 * (authority) and client (form affordance). Guild storage itself is Prisma
 * (server/src/persistence/guilds.ts); these are the testable rules.
 */
export const GUILD_MEMBERS_MAX = 50;

export const GUILD_RANKS = ["leader", "officer", "member"] as const;
export type GuildRank = (typeof GUILD_RANKS)[number];

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,23}$/;
const TAG_RE = /^[A-Za-z0-9]{2,4}$/;

/** 3–24 chars, alnum/space/_/-, must start alphanumeric. */
export function validGuildName(name: string): boolean {
  return NAME_RE.test(name.trim());
}

/** 2–4 alphanumeric characters (shown as [TAG]). */
export function validGuildTag(tag: string): boolean {
  return TAG_RE.test(tag.trim());
}

/** Can `actor` kick `target`? Leaders kick anyone below; officers kick members. */
export function canKick(actor: GuildRank, target: GuildRank): boolean {
  if (actor === "leader") return target !== "leader";
  if (actor === "officer") return target === "member";
  return false;
}

/** Only the leader changes ranks, and only between officer/member. */
export function canSetRank(actor: GuildRank, target: GuildRank, next: GuildRank): boolean {
  return actor === "leader" && target !== "leader" && next !== "leader";
}
