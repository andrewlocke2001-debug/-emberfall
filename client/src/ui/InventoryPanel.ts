import { INVENTORY_SLOTS, type ItemStack } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";

/**
 * The DOM inventory panel — a 28-slot grid (RuneScape's bag). Owns the #inventory
 * element (hidden in index.html), toggled with the 'I' key. The server is
 * authoritative: this only renders the last Inventory message it was handed.
 * Item text is set via textContent (never innerHTML) so item ids can't inject
 * markup.
 */
export class InventoryPanel {
  private readonly root = document.getElementById("inventory") as HTMLDivElement;
  private readonly grid = document.getElementById("inv-grid") as HTMLDivElement;
  private slots: ItemStack[] = [];
  private visible = false;

  constructor() {
    // Build the 28 fixed cells once (clear first so a scene restart on zone
    // travel doesn't stack duplicates).
    this.grid.replaceChildren();
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const cell = document.createElement("div");
      cell.className = "inv-slot";
      this.grid.appendChild(cell);
    }
    document.getElementById("inv-close")?.addEventListener("click", () => this.toggle(false));
  }

  setInventory(slots: ItemStack[]): void {
    this.slots = slots;
    if (this.visible) this.render();
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) this.render();
  }

  private render(): void {
    const cells = this.grid.children;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as HTMLDivElement;
      cell.replaceChildren();
      cell.className = "inv-slot";
      const stack = this.slots[i];
      if (!stack) continue;

      const def = ITEMS[stack.itemId];
      const name = document.createElement("span");
      name.className = "inv-name";
      name.textContent = def?.name ?? stack.itemId;
      cell.appendChild(name);

      if (stack.qty > 1) {
        const qty = document.createElement("span");
        qty.className = "inv-qty";
        qty.textContent = stack.qty > 9999 ? `${Math.floor(stack.qty / 1000)}k` : String(stack.qty);
        cell.appendChild(qty);
      }

      cell.classList.add("filled");
      if (def && def.rarity !== "common") cell.classList.add(def.rarity);
      cell.title = def ? (def.desc ? `${def.name} — ${def.desc}` : def.name) : stack.itemId;
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
