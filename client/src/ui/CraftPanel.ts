import type { ItemStack } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";
import { RECIPES } from "@mmo/shared/data/recipes";
import { canCraft } from "@mmo/shared/systems/crafting";

export interface CraftPanelOptions {
  /** Craft one of a recipe (server validates inputs + level). */
  onCraft: (recipeId: string) => void;
}

/**
 * The DOM crafting panel — lists every recipe, shows its inputs → output, and
 * enables the button only when the bag holds the inputs and the player meets
 * the level. Toggle with C. The server re-validates everything; this is just
 * affordance. (No crafting station gating in v1 — craft anywhere.)
 */
export class CraftPanel {
  private readonly root = document.getElementById("craft") as HTMLDivElement;
  private readonly list = document.getElementById("craft-list") as HTMLDivElement;
  private bag: ItemStack[] = [];
  private levels: Record<string, number> = {};
  private visible = false;

  constructor(private readonly opts: CraftPanelOptions) {
    document.getElementById("craft-close")?.addEventListener("click", () => this.toggle(false));
  }

  setBag(slots: ItemStack[]): void {
    this.bag = slots;
    if (this.visible) this.render();
  }

  setLevels(levels: Record<string, number>): void {
    this.levels = levels;
    if (this.visible) this.render();
  }

  isOpen(): boolean {
    return this.visible;
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) this.render();
  }

  private render(): void {
    this.list.replaceChildren();
    for (const recipe of Object.values(RECIPES)) {
      const out = ITEMS[recipe.output.itemId];
      const haveLevel = (this.levels[recipe.skill] ?? 1) >= recipe.levelReq;
      const haveMats = canCraft(this.bag, recipe);

      const row = document.createElement("button");
      row.type = "button";
      row.className = "craft-row";
      row.disabled = !(haveLevel && haveMats);
      const title = document.createElement("div");
      title.className = "craft-title";
      title.textContent = `${out?.name ?? recipe.output.itemId} — ${recipe.skill} ${recipe.levelReq}`;
      const detail = document.createElement("div");
      detail.className = "craft-detail";
      if (!haveLevel) {
        detail.textContent = `Requires ${recipe.skill} level ${recipe.levelReq}`;
        detail.classList.add("craft-missing");
      } else {
        // Per-material have/need so a greyed row says exactly what's missing.
        recipe.inputs.forEach((input, i) => {
          const have = this.bag.reduce((n, s) => (s.itemId === input.itemId ? n + s.qty : n), 0);
          if (i > 0) detail.append(" + ");
          const span = document.createElement("span");
          span.textContent = `${ITEMS[input.itemId]?.name ?? input.itemId} ${Math.min(have, input.qty)}/${input.qty}`;
          if (have < input.qty) span.className = "craft-missing";
          detail.appendChild(span);
        });
      }
      row.append(title, detail);
      row.addEventListener("click", () => this.opts.onCraft(recipe.id));
      this.list.appendChild(row);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
