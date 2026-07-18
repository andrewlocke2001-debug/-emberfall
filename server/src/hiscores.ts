import { SKILL_IDS, type SkillId } from "@mmo/shared";
import { levelForXp } from "@mmo/shared/systems/progression";
import { prisma } from "./persistence/db";

/**
 * Public hiscores (kit pillar: "public and crawlable — it's marketing").
 * Served by the game server: /hiscores (HTML) + /api/hiscores (JSON).
 * Read-only queries over the Player table; levels derived from XP with the
 * same shared curve the game uses.
 */
const PAGE_SIZE = 50;

const XP_COLUMNS: Record<
  SkillId,
  "meleeXp" | "rangedXp" | "magicXp" | "vitalityXp" | "miningXp" | "fishingXp" | "smithingXp" | "cookingXp"
> = {
  melee: "meleeXp",
  ranged: "rangedXp",
  magic: "magicXp",
  vitality: "vitalityXp",
  mining: "miningXp",
  fishing: "fishingXp",
  smithing: "smithingXp",
  cooking: "cookingXp",
};

export type HiscoreBoard = SkillId | "total";

export interface HiscoreRow {
  rank: number;
  name: string;
  /** Skill level (skill boards) or total level = sum of all skill levels. */
  level: number;
  /** XP in the skill (skill boards) or summed XP (total board). */
  xp: number;
  /** Ironman account (marked ⚒ on the board). */
  ironman: boolean;
}

/** Ironman flags for a set of player ids (player id = account id). */
async function ironmanFlags(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.account.findMany({
    where: { id: { in: ids }, ironman: true },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export function isHiscoreBoard(s: string): s is HiscoreBoard {
  return s === "total" || (SKILL_IDS as readonly string[]).includes(s);
}

export async function getHiscores(board: HiscoreBoard): Promise<HiscoreRow[]> {
  if (board === "total") {
    // Order by summed XP (a monotone proxy for total level at equal curves).
    const rows = await prisma.$queryRaw<
      { id: string; name: string; meleeXp: number; rangedXp: number; magicXp: number; vitalityXp: number; miningXp: number; fishingXp: number; smithingXp: number; cookingXp: number }[]
    >`SELECT "id","name","meleeXp","rangedXp","magicXp","vitalityXp","miningXp","fishingXp","smithingXp","cookingXp"
      FROM "Player"
      ORDER BY ("meleeXp"+"rangedXp"+"magicXp"+"vitalityXp"+"miningXp"+"fishingXp"+"smithingXp"+"cookingXp") DESC
      LIMIT ${PAGE_SIZE}`;
    const irons = await ironmanFlags(rows.map((r) => r.id));
    return rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      level: SKILL_IDS.reduce((sum, s) => sum + levelForXp(r[XP_COLUMNS[s]]), 0),
      xp: SKILL_IDS.reduce((sum, s) => sum + r[XP_COLUMNS[s]], 0),
      ironman: irons.has(r.id),
    }));
  }
  const col = XP_COLUMNS[board];
  const rows = await prisma.player.findMany({
    orderBy: { [col]: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      meleeXp: true,
      rangedXp: true,
      magicXp: true,
      vitalityXp: true,
      miningXp: true,
      fishingXp: true,
      smithingXp: true,
      cookingXp: true,
    },
  });
  const irons = await ironmanFlags(rows.map((r) => r.id));
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    level: levelForXp(r[col]),
    xp: r[col],
    ironman: irons.has(r.id),
  }));
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A small server-rendered page — no client bundle, fully crawlable. */
export function renderHiscoresHtml(board: HiscoreBoard, rows: HiscoreRow[]): string {
  const boards: HiscoreBoard[] = ["total", ...SKILL_IDS];
  const nav = boards
    .map((b) =>
      b === board
        ? `<strong>${b}</strong>`
        : `<a href="/hiscores?skill=${b}">${b}</a>`,
    )
    .join(" · ");
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.rank}</td><td>${r.ironman ? "⚒ " : ""}${escapeHtml(r.name)}</td><td>${r.level}</td><td>${r.xp}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Emberfall Hiscores — ${board}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0d1018;color:#e6e6e6;max-width:640px;margin:24px auto;padding:0 12px}
a{color:#7cc7ff}table{width:100%;border-collapse:collapse;margin-top:12px}
td,th{padding:6px 8px;border-bottom:1px solid #2a3142;text-align:left}th{color:#8893a7}
h1{color:#ffe066;font-size:22px}</style></head>
<body><h1>⚔ Emberfall Hiscores</h1><nav>${nav}</nav>
<table><thead><tr><th>#</th><th>Name</th><th>${board === "total" ? "Total level" : "Level"}</th><th>XP</th></tr></thead>
<tbody>${body}</tbody></table>
<p><a href="/">Play Emberfall</a></p></body></html>`;
}
