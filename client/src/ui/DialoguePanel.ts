import { MOUNT_COST, type ItemStack } from "@mmo/shared";
import type { NpcDef } from "@mmo/shared/data/npcs";
import { QUESTS } from "@mmo/shared/data/quests";
import { canAccept, findQuest, questReady, type QuestLog } from "@mmo/shared/systems/quests";

export interface DialoguePanelOptions {
  onAccept: (questId: string) => void;
  onComplete: (questId: string) => void;
  onBuyMount: () => void;
}

/**
 * The NPC conversation panel. Opens when you talk to an NPC, showing its
 * greeting and the quests it offers as accept / turn-in / status rows. The
 * dialogue content is data (client-side); the server gates the actual
 * accept/turn-in. Full branching trees are a later enhancement.
 */
export class DialoguePanel {
  private readonly root = document.getElementById("dialogue") as HTMLDivElement;
  private readonly nameEl = document.getElementById("dialogue-name") as HTMLDivElement;
  private readonly greetEl = document.getElementById("dialogue-text") as HTMLDivElement;
  private readonly optsEl = document.getElementById("dialogue-opts") as HTMLDivElement;
  private npc: NpcDef | undefined = undefined;
  private log: QuestLog = [];
  private bag: ItemStack[] = [];
  private mountOwned = false;

  constructor(private readonly opts: DialoguePanelOptions) {
    document.getElementById("dialogue-close")?.addEventListener("click", () => this.close());
  }

  setQuests(log: QuestLog): void {
    this.log = log;
    if (this.npc) this.render();
  }

  setMountOwned(owned: boolean): void {
    this.mountOwned = owned;
    if (this.npc) this.render();
  }

  setBag(bag: ItemStack[]): void {
    this.bag = bag;
    if (this.npc) this.render();
  }

  open(npc: NpcDef): void {
    this.npc = npc;
    this.root.style.display = "flex";
    this.render();
  }

  close(): void {
    this.npc = undefined;
    this.root.style.display = "none";
  }

  private render(): void {
    if (!this.npc) return;
    this.nameEl.textContent = this.npc.name;
    this.greetEl.textContent = this.npc.greeting;
    this.optsEl.replaceChildren();

    for (const questId of this.npc.quests) {
      const def = QUESTS[questId];
      if (!def) continue;
      const qp = findQuest(this.log, questId);

      if (!qp) {
        if (canAccept(this.log, def)) this.option(`Accept: ${def.name}`, () => this.opts.onAccept(questId));
      } else if (qp.status === "complete") {
        this.note(`✓ ${def.name}`);
      } else if (questReady(def, qp, this.bag)) {
        this.option(`Turn in: ${def.name}`, () => this.opts.onComplete(questId));
      } else {
        this.note(`… ${def.name} (in progress)`);
      }
    }

    // The Stabler sells mounts (a one-time coin sink).
    if (this.npc.id === "stabler_bran") {
      if (this.mountOwned) this.note("✓ You own a mount — press M to ride.");
      else this.option(`Buy a mount (${MOUNT_COST}g)`, () => this.opts.onBuyMount());
    }
  }

  private option(label: string, onClick: () => void): void {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dialogue-opt";
    b.textContent = label;
    b.addEventListener("click", onClick);
    this.optsEl.appendChild(b);
  }

  private note(text: string): void {
    const d = document.createElement("div");
    d.className = "dialogue-note";
    d.textContent = text;
    this.optsEl.appendChild(d);
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
