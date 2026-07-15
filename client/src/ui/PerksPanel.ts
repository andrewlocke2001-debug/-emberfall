import { PERK_TIERS, RESPEC_COST } from "@mmo/shared/data/perks";
import { canChoosePerk } from "@mmo/shared/systems/perks";

export interface PerksPanelOptions {
  onChoose: (id: string) => void;
  onRespec: () => void;
  onRefresh: () => void;
}

/**
 * The Melee skill tree panel (toggle K): three tiers, one permanent choice
 * each, respec for coins. Pure presentation over the server's chosen list —
 * eligibility mirrors the same shared rules the server enforces.
 */
export class PerksPanel {
  private readonly root = document.getElementById("perks") as HTMLDivElement;
  private readonly body = document.getElementById("perks-body") as HTMLDivElement;
  private chosen: string[] = [];
  private meleeLevel = 1;
  private visible = false;

  constructor(private readonly opts: PerksPanelOptions) {
    document.getElementById("perks-close")?.addEventListener("click", () => this.toggle(false));
  }

  setPerks(chosen: string[]): void {
    this.chosen = chosen;
    if (this.visible) this.render();
  }

  setMeleeLevel(level: number): void {
    if (level === this.meleeLevel) return;
    this.meleeLevel = level;
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
    const intro = document.createElement("div");
    intro.className = "perk-intro";
    intro.textContent = `Melee ${this.meleeLevel} — choose one path per tier. Choices are permanent until you respec.`;
    this.body.appendChild(intro);

    PERK_TIERS.forEach((tier, i) => {
      const head = document.createElement("div");
      head.className = "perk-tier";
      const unlocked = this.meleeLevel >= tier.level;
      head.textContent = `Tier ${i + 1} — Melee ${tier.level}${unlocked ? "" : " 🔒"}`;
      this.body.appendChild(head);

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
      respec.textContent = `Respec — forget all choices (${RESPEC_COST} coins)`;
      respec.addEventListener("click", () => this.opts.onRespec());
      this.body.appendChild(respec);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
