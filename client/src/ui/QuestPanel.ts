import type { ItemStack } from "@mmo/shared";
import { QUESTS } from "@mmo/shared/data/quests";
import {
  canAccept,
  objectiveStatus,
  questReady,
  findQuest,
  type QuestLog,
} from "@mmo/shared/systems/quests";

export interface QuestPanelOptions {
  onAccept: (questId: string) => void;
  onComplete: (questId: string) => void;
}

/**
 * The DOM quest log (toggle J). Lists available quests (with an Accept button),
 * active quests with live objective progress (collect checked against the bag),
 * and completed quests. The server re-validates accept/complete; this is just
 * the UI.
 */
export class QuestPanel {
  private readonly root = document.getElementById("quests") as HTMLDivElement;
  private readonly list = document.getElementById("quest-list") as HTMLDivElement;
  private log: QuestLog = [];
  private bag: ItemStack[] = [];
  private visible = false;

  constructor(private readonly opts: QuestPanelOptions) {
    document.getElementById("quest-close")?.addEventListener("click", () => this.toggle(false));
  }

  setQuests(log: QuestLog): void {
    this.log = log;
    if (this.visible) this.render();
  }

  setBag(bag: ItemStack[]): void {
    this.bag = bag;
    if (this.visible) this.render();
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) this.render();
  }

  private render(): void {
    this.list.replaceChildren();
    let shown = 0;
    for (const def of Object.values(QUESTS)) {
      const qp = findQuest(this.log, def.id);
      // Hide quests that aren't taken and can't yet be accepted (locked).
      if (!qp && !canAccept(this.log, def)) continue;
      shown++;

      const card = document.createElement("div");
      card.className = "quest-card";
      const title = document.createElement("div");
      title.className = "quest-title";
      title.textContent = def.name + (qp?.status === "complete" ? "  ✓" : "");
      const summary = document.createElement("div");
      summary.className = "quest-summary";
      summary.textContent = def.summary;
      card.append(title, summary);

      if (qp?.status === "active") {
        def.objectives.forEach((obj, i) => {
          const s = objectiveStatus(obj, qp.progress[i] ?? 0, this.bag);
          const line = document.createElement("div");
          line.className = s.done ? "quest-obj done" : "quest-obj";
          const text = "desc" in obj ? obj.desc : "Objective";
          line.textContent = `${s.done ? "✓" : "•"} ${text} (${s.current}/${s.required})`;
          card.appendChild(line);
        });
        if (questReady(def, qp, this.bag)) {
          card.appendChild(this.button("Turn in", () => this.opts.onComplete(def.id)));
        }
      } else if (!qp) {
        card.appendChild(this.button("Accept", () => this.opts.onAccept(def.id)));
      }
      this.list.appendChild(card);
    }
    if (shown === 0) {
      const empty = document.createElement("div");
      empty.className = "quest-empty";
      empty.textContent = "No quests available right now.";
      this.list.appendChild(empty);
    }
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quest-btn";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
