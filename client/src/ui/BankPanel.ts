import type { ItemStack } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";

export interface BankPanelOptions {
  /** Deposit `qty` of an item (server validates proximity + ownership). */
  onDeposit: (itemId: string, qty: number) => void;
  /** Withdraw `qty` of an item back into the bag. */
  onWithdraw: (itemId: string, qty: number) => void;
}

/** Sum stacks by item id into one entry each (the bank shows one row per item). */
function aggregate(slots: ItemStack[]): ItemStack[] {
  const totals = new Map<string, number>();
  for (const s of slots) totals.set(s.itemId, (totals.get(s.itemId) ?? 0) + s.qty);
  return [...totals].map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * The DOM bank panel — two columns (Bank | Bag). Owns the #bank element
 * (hidden in index.html), opened when standing at a town bank. Clicking a bank
 * row withdraws that whole item; clicking a bag row deposits it. The server is
 * authoritative; this only renders pushed state and forwards intents.
 */
export class BankPanel {
  private readonly root = document.getElementById("bank") as HTMLDivElement;
  private readonly bankList = document.getElementById("bank-items") as HTMLDivElement;
  private readonly bagList = document.getElementById("bank-bag") as HTMLDivElement;
  private bank: ItemStack[] = [];
  private bag: ItemStack[] = [];
  private visible = false;

  constructor(private readonly opts: BankPanelOptions) {
    document.getElementById("bank-close")?.addEventListener("click", () => this.toggle(false));
  }

  setBank(slots: ItemStack[]): void {
    this.bank = slots;
    if (this.visible) this.render();
  }

  setBag(slots: ItemStack[]): void {
    this.bag = slots;
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
    this.fill(this.bankList, aggregate(this.bank), (s) => this.opts.onWithdraw(s.itemId, s.qty));
    this.fill(this.bagList, aggregate(this.bag), (s) => this.opts.onDeposit(s.itemId, s.qty));
  }

  private fill(list: HTMLDivElement, items: ItemStack[], onClick: (s: ItemStack) => void): void {
    list.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "bank-empty";
      empty.textContent = "(empty)";
      list.appendChild(empty);
      return;
    }
    for (const s of items) {
      const def = ITEMS[s.itemId];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bank-row";
      row.textContent = `${def?.name ?? s.itemId} ×${s.qty}`;
      row.addEventListener("click", () => onClick(s));
      list.appendChild(row);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
