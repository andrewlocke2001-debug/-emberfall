import type { QuestDef, QuestObjective } from "../data/quests";
import { countItem, type Inventory } from "./inventory";

/**
 * Quest log state + pure progression. The log is per-player; the server owns it
 * and persists it. `kill` objectives use a stored counter (bumped on kill);
 * `collect` objectives are checked live against the bag at turn-in (so banking
 * or dropping the items is reflected). No I/O — fully unit-tested.
 */
export type QuestStatus = "active" | "complete";

export interface QuestProgress {
  questId: string;
  status: QuestStatus;
  /** Per-objective counter (used by kill/talk; collect is checked live). */
  progress: number[];
}

export type QuestLog = QuestProgress[];
export type QuestLookup = (id: string) => QuestDef | undefined;

export function findQuest(log: QuestLog, questId: string): QuestProgress | undefined {
  return log.find((q) => q.questId === questId);
}

/** Can this quest be accepted? (not already taken; prerequisite complete) */
export function canAccept(log: QuestLog, def: QuestDef): boolean {
  if (findQuest(log, def.id)) return false;
  if (def.requires) {
    const req = findQuest(log, def.requires);
    if (!req || req.status !== "complete") return false;
  }
  return true;
}

export function acceptQuest(log: QuestLog, def: QuestDef): QuestLog {
  if (!canAccept(log, def)) return log;
  return [...log, { questId: def.id, status: "active", progress: def.objectives.map(() => 0) }];
}

/** Bump kill counters on every active quest whose objective matches the mob. */
export function recordKill(log: QuestLog, mobKind: string, lookup: QuestLookup): QuestLog {
  return log.map((qp) => {
    if (qp.status !== "active") return qp;
    const def = lookup(qp.questId);
    if (!def) return qp;
    let changed = false;
    const progress = qp.progress.map((p, i) => {
      const obj = def.objectives[i];
      if (obj?.type === "kill" && obj.mob === mobKind && p < obj.count) {
        changed = true;
        return p + 1;
      }
      return p;
    });
    return changed ? { ...qp, progress } : qp;
  });
}

export interface ObjStatus {
  current: number;
  required: number;
  done: boolean;
}

export function objectiveStatus(obj: QuestObjective, stored: number, inv: Inventory): ObjStatus {
  if (obj.type === "collect") {
    const current = Math.min(obj.count, countItem(inv, obj.itemId));
    return { current, required: obj.count, done: current >= obj.count };
  }
  if (obj.type === "kill") {
    const current = Math.min(stored, obj.count);
    return { current, required: obj.count, done: stored >= obj.count };
  }
  return { current: Math.min(stored, 1), required: 1, done: stored >= 1 }; // talk
}

/** Are all of a quest's objectives satisfied (collect checked vs the bag)? */
export function questReady(def: QuestDef, qp: QuestProgress, inv: Inventory): boolean {
  return def.objectives.every((obj, i) => objectiveStatus(obj, qp.progress[i] ?? 0, inv).done);
}

export function completeQuest(log: QuestLog, questId: string): QuestLog {
  return log.map((qp) => (qp.questId === questId ? { ...qp, status: "complete" as const } : qp));
}
