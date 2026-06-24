import { INVENTORY_SLOTS, type ItemStack } from "@mmo/shared";
import { ITEMS, EQUIP_SLOTS, type EquipSlot } from "@mmo/shared/data/items";

export interface InventoryPanelOptions {
  /** Equip an inventory item (server validates ownership + slot). */
  onEquip: (itemId: string) => void;
  /** Unequip a gear slot back into the bag. */
  onUnequip: (slot: EquipSlot) => void;
  /** Eat/consume an inventory item (food/potions). */
  onConsume: (itemId: string) => void;
}

/**
 * The DOM inventory + equipment panel — a 28-slot bag grid plus a row of gear
 * slots. Owns the #inventory element (hidden in index.html), toggled with 'I'.
 * The server is authoritative: this only renders the last Inventory/Equipment
 * messages and forwards click intents. Item text is set via textContent (never
 * innerHTML) so item ids can't inject markup.
 */
export class InventoryPanel {
  private readonly root = document.getElementById("inventory") as HTMLDivElement;
  private readonly grid = document.getElementById("inv-grid") as HTMLDivElement;
  private readonly gearRow: HTMLDivElement;
  private slots: ItemStack[] = [];
  private equipment: Partial<Record<EquipSlot, string>> = {};
  private visible = false;

  constructor(private readonly opts: InventoryPanelOptions) {
    // Equipment strip, built once above the bag grid.
    this.gearRow = document.createElement("div");
    this.gearRow.id = "inv-gear";
    this.root.insertBefore(this.gearRow, this.grid);
    for (const slot of EQUIP_SLOTS) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "gear-slot";
      cell.dataset["slot"] = slot;
      cell.addEventListener("click", () => {
        if (this.equipment[slot]) this.opts.onUnequip(slot);
      });
      this.gearRow.appendChild(cell);
    }

    // Bag cells, built once (clear first so a scene restart doesn't duplicate).
    this.grid.replaceChildren();
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "inv-slot";
      const index = i;
      cell.addEventListener("click", () => {
        const stack = this.slots[index];
        if (!stack) return;
        const def = ITEMS[stack.itemId];
        if (def?.equipSlot) this.opts.onEquip(stack.itemId);
        else if (def?.heal) this.opts.onConsume(stack.itemId);
      });
      this.grid.appendChild(cell);
    }
    document.getElementById("inv-close")?.addEventListener("click", () => this.toggle(false));
  }

  setInventory(slots: ItemStack[]): void {
    this.slots = slots;
    if (this.visible) this.renderBag();
  }

  setEquipment(equipment: Partial<Record<EquipSlot, string>>): void {
    this.equipment = equipment;
    if (this.visible) this.renderGear();
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) {
      this.renderGear();
      this.renderBag();
    }
  }

  private renderBag(): void {
    const cells = this.grid.children;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as HTMLButtonElement;
      cell.replaceChildren();
      cell.className = "inv-slot";
      const stack = this.slots[i];
      if (!stack) continue;
      const def = ITEMS[stack.itemId];
      this.fill(cell, def?.name ?? stack.itemId, stack.qty);
      cell.classList.add("filled");
      if (def && def.rarity !== "common") cell.classList.add(def.rarity);
      if (def?.equipSlot || def?.heal) cell.classList.add("equippable"); // clickable affordance
      cell.title = this.tooltip(stack.itemId);
    }
  }

  private renderGear(): void {
    for (const cell of Array.from(this.gearRow.children) as HTMLButtonElement[]) {
      const slot = cell.dataset["slot"] as EquipSlot;
      cell.replaceChildren();
      cell.className = "gear-slot";
      const id = this.equipment[slot];
      const label = document.createElement("span");
      label.className = "gear-label";
      if (id) {
        const def = ITEMS[id];
        label.textContent = def?.name ?? id;
        cell.classList.add("filled");
        if (def && def.rarity !== "common") cell.classList.add(def.rarity);
        cell.title = `${this.tooltip(id)} (click to unequip)`;
      } else {
        label.textContent = slot;
        label.classList.add("empty");
        cell.title = `${slot} (empty)`;
      }
      cell.appendChild(label);
    }
  }

  private fill(cell: HTMLElement, name: string, qty: number): void {
    const label = document.createElement("span");
    label.className = "inv-name";
    label.textContent = name;
    cell.appendChild(label);
    if (qty > 1) {
      const q = document.createElement("span");
      q.className = "inv-qty";
      q.textContent = qty > 9999 ? `${Math.floor(qty / 1000)}k` : String(qty);
      cell.appendChild(q);
    }
  }

  private tooltip(itemId: string): string {
    const def = ITEMS[itemId];
    if (!def) return itemId;
    return def.desc ? `${def.name} — ${def.desc}` : def.name;
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
