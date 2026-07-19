import { PERK_TIERS, RESPEC_COST } from "@mmo/shared/data/perks";
import { canChoosePerk } from "@mmo/shared/systems/perks";
import { CALLINGS, CALLING_IDS, CALLING_RESPEC_COST, TALENT_TIER_STEP, talentsOf } from "@mmo/shared/data/callings";
import { talentPointsFor, pointsSpent, canSpendTalent, type Talents } from "@mmo/shared/systems/callings";
import type { CallingId } from "@mmo/shared/data/callings";
import type { CallingPayload } from "@mmo/shared/protocol/messages";

export interface PerksPanelOptions {
  onChoose: (id: string) => void;
  onRespec: () => void;
  onChooseCalling: (id: string) => void;
  onSpendTalent: (id: string) => void;
  onRespecCalling: () => void;
  onRefresh: () => void;
}

/**
 * The skill-tree panel (toggle K). Top: your Calling — pick one of six, then
 * shape its three-branch talent tree with points earned by combat levels.
 * Bottom: the Fighter's Trunk (the original perk tiers). Pure presentation
 * over server state — eligibility mirrors the same shared rules the server
 * enforces.
 */
export class PerksPanel {
  private readonly root = document.getElementById("perks") as HTMLDivElement;
  private readonly body = document.getElementById("perks-body") as HTMLDivElement;
  private chosen: string[] = [];
  private calling: string = "";
  private talents: Talents = {};
  private meleeLevel = 1;
  private rangedLevel = 1;
  private magicLevel = 1;
  private visible = false;

  constructor(private readonly opts: PerksPanelOptions) {
    document.getElementById("perks-close")?.addEventListener("click", () => this.toggle(false));
  }

  setPerks(chosen: string[]): void {
    this.chosen = chosen;
    if (this.visible) this.render();
  }

  setCalling(payload: CallingPayload): void {
    this.calling = payload.calling;
    this.talents = payload.talents;
    if (this.visible) this.render();
  }

  setCombatLevels(melee: number, ranged: number, magic: number): void {
    if (melee === this.meleeLevel && ranged === this.rangedLevel && magic === this.magicLevel) return;
    this.meleeLevel = melee;
    this.rangedLevel = ranged;
    this.magicLevel = magic;
    if (this.visible) this.render();
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) {
      this.opts.onRefresh();
      this.render();
    }
  }

  private render(): void {
    this.body.replaceChildren();
    if (this.calling === "") this.renderCallingChoice();
    else this.renderTree(this.calling as CallingId);
    this.renderTrunk();
  }

  /** No Calling yet: the six cards. */
  private renderCallingChoice(): void {
    const intro = document.createElement("div");
    intro.className = "perk-intro";
    intro.textContent =
      "Choose your Calling — the discipline that shapes how you fight. One choice; abandoning it later costs coins.";
    this.body.appendChild(intro);

    const grid = document.createElement("div");
    grid.className = "calling-grid";
    for (const id of CALLING_IDS) {
      const def = CALLINGS[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "calling-card";
      card.innerHTML = `<span class="perk-name">${def.name}</span><span class="perk-desc">${def.fantasy}</span>`;
      card.addEventListener("click", () => this.opts.onChooseCalling(id));
      grid.appendChild(card);
    }
    this.body.appendChild(grid);
  }

  /** A chosen Calling: points header + three branch columns. */
  private renderTree(calling: CallingId): void {
    const def = CALLINGS[calling];
    const points = talentPointsFor(this.meleeLevel, this.rangedLevel, this.magicLevel);
    const spent = pointsSpent(this.talents);

    const head = document.createElement("div");
    head.className = "perk-intro";
    head.textContent = `${def.name} — ${def.fantasy}  ·  Points: ${points - spent} free / ${points} earned (2 per 5 combat levels)`;
    this.body.appendChild(head);

    const tree = document.createElement("div");
    tree.className = "talent-tree";
    for (const branch of def.branches) {
      const col = document.createElement("div");
      col.className = "talent-branch";
      const title = document.createElement("div");
      title.className = "perk-tier";
      title.textContent = branch;
      col.appendChild(title);

      for (const node of talentsOf(calling).filter((t) => t.branch === branch)) {
        const rank = this.talents[node.id] ?? 0;
        const buyable = canSpendTalent(calling, this.talents, node.id, points);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "talent-node";
        if (rank >= node.ranks) btn.classList.add("maxed");
        else if (!buyable) btn.classList.add("locked");
        btn.title = spent < node.tier * TALENT_TIER_STEP
          ? `${node.desc} (unlocks after ${node.tier * TALENT_TIER_STEP} points spent)`
          : node.desc;
        btn.innerHTML =
          `<span class="perk-name">${node.name}</span>` +
          `<span class="talent-rank">${rank}/${node.ranks}</span>` +
          `<span class="perk-desc">${node.desc}</span>`;
        if (buyable) btn.addEventListener("click", () => this.opts.onSpendTalent(node.id));
        col.appendChild(btn);
      }
      tree.appendChild(col);
    }
    this.body.appendChild(tree);

    const respec = document.createElement("button");
    respec.type = "button";
    respec.className = "trade-btn";
    respec.textContent = `Abandon Calling — clears all talents (${CALLING_RESPEC_COST} coins)`;
    respec.addEventListener("click", () => this.opts.onRespecCalling());
    this.body.appendChild(respec);
  }

  /** The original melee perk tiers — every Calling shares this trunk. */
  private renderTrunk(): void {
    const head = document.createElement("div");
    head.className = "perk-tier";
    head.textContent = `Fighter's Trunk — Melee ${this.meleeLevel} (shared by every Calling)`;
    this.body.appendChild(head);

    PERK_TIERS.forEach((tier, i) => {
      const label = document.createElement("div");
      label.className = "perk-tier";
      const unlocked = this.meleeLevel >= tier.level;
      label.textContent = `Tier ${i + 1} — Melee ${tier.level}${unlocked ? "" : " 🔒"}`;
      this.body.appendChild(label);

      const row = document.createElement("div");
      row.className = "perk-row";
      for (const perk of tier.choices) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "perk-card";
        const picked = this.chosen.includes(perk.id);
        const pickable = canChoosePerk(perk.id, this.meleeLevel, this.chosen);
        if (picked) card.classList.add("picked");
        if (!picked && !pickable) card.classList.add("locked");
        card.innerHTML = `<span class="perk-name">${perk.name}</span><span class="perk-desc">${perk.desc}</span>`;
        if (pickable) card.addEventListener("click", () => this.opts.onChoose(perk.id));
        row.appendChild(card);
      }
      this.body.appendChild(row);
    });

    if (this.chosen.length > 0) {
      const respec = document.createElement("button");
      respec.type = "button";
      respec.className = "trade-btn";
      respec.textContent = `Respec trunk — forget all choices (${RESPEC_COST} coins)`;
      respec.addEventListener("click", () => this.opts.onRespec());
      this.body.appendChild(respec);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
