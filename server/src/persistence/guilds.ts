import type { GuildRank } from "@mmo/shared/systems/guild";
import { prisma } from "./db";

/**
 * Guild persistence. Guilds are durable (they ARE the long-term social
 * structure); membership lives on the Player row (guildId + guildRank), so
 * roster queries are one indexed select. All rank/permission rules are the
 * pure helpers in @mmo/shared/systems/guild — this module only touches the DB.
 */
export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
}

export interface GuildMemberRow {
  id: string;
  name: string;
  rank: GuildRank;
}

export type CreateGuildResult = { ok: true; guild: GuildInfo } | { ok: false; error: string };

/** Found a guild and enroll the founder as leader. */
export async function createGuild(
  accountId: string,
  name: string,
  tag: string,
): Promise<CreateGuildResult> {
  const cleanName = name.trim();
  const cleanTag = tag.trim().toUpperCase();
  const nameTaken = await prisma.guild.findFirst({
    where: { name: { equals: cleanName, mode: "insensitive" } },
    select: { id: true },
  });
  if (nameTaken) return { ok: false, error: "That guild name is taken." };
  const tagTaken = await prisma.guild.findFirst({
    where: { tag: { equals: cleanTag, mode: "insensitive" } },
    select: { id: true },
  });
  if (tagTaken) return { ok: false, error: "That guild tag is taken." };

  const guild = await prisma.guild.create({
    data: { name: cleanName, tag: cleanTag, leaderId: accountId },
  });
  await prisma.player.update({
    where: { id: accountId },
    data: { guildId: guild.id, guildRank: "leader" },
  });
  return { ok: true, guild };
}

export async function getGuild(guildId: string): Promise<GuildInfo | null> {
  return prisma.guild.findUnique({ where: { id: guildId } });
}

/** All members of a guild (name + rank), leader first then by join order. */
export async function listGuildMembers(guildId: string): Promise<GuildMemberRow[]> {
  const rows = await prisma.player.findMany({
    where: { guildId },
    select: { id: true, name: true, guildRank: true },
    orderBy: { createdAt: "asc" },
  });
  const members = rows.map((r) => ({
    id: r.id,
    name: r.name,
    rank: (r.guildRank ?? "member") as GuildRank,
  }));
  members.sort((a, b) => (a.rank === "leader" ? -1 : b.rank === "leader" ? 1 : 0));
  return members;
}

/** Set (or clear, with nulls) a player's guild membership. */
export async function setMembership(
  accountId: string,
  guildId: string | null,
  rank: GuildRank | null,
): Promise<void> {
  await prisma.player.update({ where: { id: accountId }, data: { guildId, guildRank: rank } });
}

/** A player's current membership straight from the DB. */
export async function membershipOf(
  accountId: string,
): Promise<{ guildId: string; rank: GuildRank } | null> {
  const row = await prisma.player.findUnique({
    where: { id: accountId },
    select: { guildId: true, guildRank: true },
  });
  if (!row?.guildId) return null;
  return { guildId: row.guildId, rank: (row.guildRank ?? "member") as GuildRank };
}

/**
 * Remove a member. If the leader leaves and others remain, leadership passes
 * to the first officer (else first member); the guild disbands when empty.
 * Returns the display names whose guild state changed (for roster pushes).
 */
export async function removeMember(guildId: string, accountId: string): Promise<string[]> {
  const members = await listGuildMembers(guildId);
  const leaving = members.find((m) => m.id === accountId);
  if (!leaving) return [];
  await setMembership(accountId, null, null);

  const remaining = members.filter((m) => m.id !== accountId);
  if (remaining.length === 0) {
    await prisma.guild.delete({ where: { id: guildId } });
    return [leaving.name];
  }
  if (leaving.rank === "leader") {
    const heir = remaining.find((m) => m.rank === "officer") ?? remaining[0]!;
    await prisma.player.update({ where: { id: heir.id }, data: { guildRank: "leader" } });
    await prisma.guild.update({ where: { id: guildId }, data: { leaderId: heir.id } });
  }
  return [leaving.name, ...remaining.map((m) => m.name)];
}
