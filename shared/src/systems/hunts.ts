import { HUNT_TARGETS, type HuntTargetDef } from "../data/hunts";

/**
 * Hunt task logic (pure). The server rolls a task from the Huntmaster, counts
 * qualifying kills, and pays points on completion.
 */
export interface HuntTask {
  mob: string;
  remaining: number;
  points: number;
}

/** Roll a new task with the given RNG (0..1). */
export function rollHunt(rng: () => number, targets: HuntTargetDef[] = HUNT_TARGETS): HuntTask {
  const t = targets[Math.floor(rng() * targets.length)] ?? targets[0]!;
  const count = t.min + Math.floor(rng() * (t.max - t.min + 1));
  return { mob: t.mob, remaining: count, points: t.points };
}

/**
 * Record a kill against the task. Returns the updated task (or null when it
 * just completed) and the points earned (0 unless completed).
 */
export function recordHuntKill(
  task: HuntTask | null,
  mobKind: string,
): { task: HuntTask | null; earned: number } {
  if (!task || task.mob !== mobKind) return { task, earned: 0 };
  const remaining = task.remaining - 1;
  if (remaining <= 0) return { task: null, earned: task.points };
  return { task: { ...task, remaining }, earned: 0 };
}
