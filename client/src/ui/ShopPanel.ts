import type { ItemStack } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";
import type { VendorDef } from "@mmo/shared/data/vendors";
import { buyCost, sellValue } from "@mmo/shared/systems/shop";
import { countItem } from "@mmo/shared/systems/inventory";

export interface ShopPanelOptions {
  onBuy: (vendorId: string, itemId: string, qty: number) => void;
  onSell: (vendorId: string, itemId: string, qty: number) => void;
  /** Repair all worn gear for coins (the server computes + charges). */
  onRepair: () => void;
}

/**
 * The vendor shop panel. Opens when you click a vendor: a Buy column (the
 * vendor's stock at buy price) and a Sell column (your sellable items at the
 * buyback price). Clicking trades one at a time; the server re-validates
 * proximity, coins, and space.
 */
export class ShopPanel {
  private readonly root = document.getElementById("shop") as HTMLDivElement;
  private readonly nameEl = document.getElementById("shop-name") as HTMLDivElement;
  private readonly coinsEl = document.getElementById("shop-coins") as HTMLDivElement;
  private readonly buyList = document.getElementById("shop-buy") as HTMLDivElement;
  private readonly sellList = document.getElementById("shop-sell") as HTMLDivElement;
  private vendor: VendorDef | undefined = undefined;
  private bag: ItemStack[] = [];

  constructor(private readonly opts: ShopPanelOptions) {
    document.getElementById("shop-close")?.addEventListener("click", () => this.close());
    // A "Repair gear" action lives in the shop footer (built once).
    const repair = document.createElement("button");
    repair.type = "button";
    repair.id = "shop-repair";
    repair.className = "shop-repair";
    repair.textContent = "Repair gear";
    repair.addEventListener("click", () => this.opts.onRepair());
    this.root.appendChild(repair);
  }

  setBag(bag: ItemStack[]): void {
    this.bag = bag;
    if (this.vendor) this.render();
  }

  open(vendor: VendorDef): void {
    this.vendor = vendor;
    this.root.style.display = "flex";
    this.render();
  }

  close(): void {
    this.vendor = undefined;
    this.root.style.display = "none";
  }

  private render(): void {
    if (!this.vendor) return;
    const v = this.vendor;
    this.nameEl.textContent = v.name;
    this.coinsEl.textContent = `${countItem(this.bag, "coins")} coins`;

    this.buyList.replaceChildren();
    for (const itemId of v.stock) {
      const def = ITEMS[itemId];
      if (!def) continue;
      this.row(this.buyList, `${def.name} — ${buyCost(def)}c`, () => this.opts.onBuy(v.id, itemId, 1));
    }

    this.sellList.replaceChildren();
    for (const stack of this.bag) {
      const def = ITEMS[stack.itemId];
      if (!def || def.value <= 0 || stack.itemId === "coins") continue;
      this.row(
        this.sellList,
        `${def.name} ×${stack.qty} — ${sellValue(def)}c`,
        () => this.opts.onSell(v.id, stack.itemId, 1),
      );
    }
    if (this.sellList.childElementCount === 0) {
      const empty = document.createElement("div");
      empty.className = "shop-empty";
      empty.textContent = "(nothing to sell)";
      this.sellList.appendChild(empty);
    }
  }

  private row(list: HTMLDivElement, label: string, onClick: () => void): void {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "shop-row";
    b.textContent = label;
    b.addEventListener("click", onClick);
    list.appendChild(b);
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
