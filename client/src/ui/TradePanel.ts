import type { ItemStack, TradeStatePayload } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";
import { countItem } from "@mmo/shared/systems/inventory";

export interface TradePanelOptions {
  onRequest: (name: string) => void;
  onRespond: (accept: boolean) => void;
  onOffer: (items: ItemStack[], coins: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The trade panel (toggle T). Idle: ask a nearby player to trade by name, or an
 * incoming-request banner (Accept/Decline). Active: your offer vs theirs, add
 * items from your bag / set coins, and confirm. The server owns everything; the
 * panel builds the desired offer and sends it whole, then renders the
 * authoritative state it gets back (so a partner's change resets confirmations
 * live).
 */
export class TradePanel {
  private readonly root = document.getElementById("trade") as HTMLDivElement;
  private readonly body = document.getElementById("trade-body") as HTMLDivElement;
  private bag: ItemStack[] = [];
  private state: TradeStatePayload = { active: false };
  private visible = false;

  constructor(private readonly opts: TradePanelOptions) {
    document.getElementById("trade-close")?.addEventListener("click", () => this.toggle(false));
  }

  setBag(bag: ItemStack[]): void {
    this.bag = bag;
    if (this.visible) this.render();
  }

  setTrade(state: TradeStatePayload): void {
    const wasActive = this.state.active || !!this.state.requestFrom;
    this.state = state;
    // Auto-open when a request arrives or a trade begins.
    if (!this.visible && (state.active || state.requestFrom) && !wasActive) this.toggle(true);
    if (this.visible) this.render();
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.root.style.display = this.visible ? "flex" : "none";
    if (this.visible) this.render();
  }

  private render(): void {
    this.body.replaceChildren();
    if (this.state.active) this.renderActive();
    else if (this.state.requestFrom) this.renderRequest(this.state.requestFrom);
    else this.renderIdle();
  }

  private renderIdle(): void {
    const row = document.createElement("div");
    row.className = "trade-row";
    const input = document.createElement("input");
    input.type = "text";
    input.id = "trade-name";
    input.placeholder = "Trade with… (name)";
    input.maxLength = 24;
    input.autocomplete = "off";
    input.className = "trade-input";
    input.addEventListener("keydown", (e) => e.stopPropagation());
    const ask = document.createElement("button");
    ask.type = "button";
    ask.className = "trade-btn";
    ask.textContent = "Ask to trade";
    ask.addEventListener("click", () => {
      const name = input.value.trim();
      if (name) this.opts.onRequest(name);
    });
    row.append(input, ask);
    this.body.appendChild(row);
  }

  private renderRequest(from: string): void {
    const banner = document.createElement("div");
    banner.className = "party-invite-banner";
    const text = document.createElement("span");
    text.textContent = `${from} wants to trade.`;
    const accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept";
    accept.className = "trade-btn";
    accept.addEventListener("click", () => this.opts.onRespond(true));
    const decline = document.createElement("button");
    decline.type = "button";
    decline.textContent = "Decline";
    decline.className = "trade-btn ghost";
    decline.addEventListener("click", () => this.opts.onRespond(false));
    banner.append(text, accept, decline);
    this.body.appendChild(banner);
  }

  private renderActive(): void {
    const me = this.state.me!;
    const them = this.state.them!;

    const cols = document.createElement("div");
    cols.className = "trade-cols";
    cols.append(
      this.offerColumn("Your offer", me.items, me.coins, me.confirmed, true),
      this.offerColumn(`${them.name}'s offer`, them.items, them.coins, them.confirmed, false),
    );
    this.body.appendChild(cols);

    // Add-from-bag: the coins you'd add via the input aren't listed here.
    const add = document.createElement("div");
    add.className = "trade-add";
    const addTitle = document.createElement("h4");
    addTitle.textContent = "Add from your bag";
    add.appendChild(addTitle);
    const nonCoin = this.bag.filter((s) => s.itemId !== "coins" && !this.offered(me.items, s.itemId));
    if (nonCoin.length === 0) {
      const empty = document.createElement("div");
      empty.className = "trade-empty";
      empty.textContent = "(nothing to add)";
      add.appendChild(empty);
    }
    for (const stack of nonCoin) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "trade-item";
      b.textContent = `${ITEMS[stack.itemId]?.name ?? stack.itemId} ×${stack.qty}`;
      b.addEventListener("click", () => this.offer([...me.items, { ...stack }], me.coins));
      add.appendChild(b);
    }
    // Coins input.
    const coinRow = document.createElement("div");
    coinRow.className = "trade-row";
    const coinInput = document.createElement("input");
    coinInput.type = "number";
    coinInput.min = "0";
    coinInput.value = String(me.coins);
    coinInput.className = "trade-input";
    coinInput.addEventListener("keydown", (e) => e.stopPropagation());
    const setCoins = document.createElement("button");
    setCoins.type = "button";
    setCoins.className = "trade-btn";
    setCoins.textContent = "Set coins";
    setCoins.addEventListener("click", () => {
      const c = Math.max(0, Math.min(countItem(this.bag, "coins"), Math.floor(Number(coinInput.value) || 0)));
      this.offer(me.items, c);
    });
    coinRow.append(coinInput, setCoins);
    add.appendChild(coinRow);
    this.body.appendChild(add);

    // Confirm / cancel.
    const actions = document.createElement("div");
    actions.className = "trade-actions";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = me.confirmed ? "trade-btn confirmed" : "trade-btn";
    confirm.textContent = me.confirmed ? "Confirmed ✓" : "Confirm";
    confirm.disabled = me.confirmed;
    confirm.addEventListener("click", () => this.opts.onConfirm());
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "trade-btn ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.opts.onCancel());
    actions.append(confirm, cancel);
    this.body.appendChild(actions);
  }

  private offerColumn(
    title: string,
    items: ItemStack[],
    coins: number,
    confirmed: boolean,
    mine: boolean,
  ): HTMLDivElement {
    const col = document.createElement("div");
    col.className = "trade-col";
    const h = document.createElement("h4");
    h.textContent = `${title}${confirmed ? " ✓" : ""}`;
    if (confirmed) h.classList.add("confirmed");
    col.appendChild(h);
    for (const stack of items) {
      const row = document.createElement(mine ? "button" : "div");
      row.className = "trade-offered";
      row.textContent = `${ITEMS[stack.itemId]?.name ?? stack.itemId} ×${stack.qty}`;
      if (mine) {
        (row as HTMLButtonElement).type = "button";
        row.title = "Click to remove";
        row.addEventListener("click", () =>
          this.offer(items.filter((s) => s !== stack), coins),
        );
      }
      col.appendChild(row);
    }
    if (coins > 0) {
      const c = document.createElement("div");
      c.className = "trade-offered coins";
      c.textContent = `${coins} coins`;
      col.appendChild(c);
    }
    if (items.length === 0 && coins === 0) {
      const empty = document.createElement("div");
      empty.className = "trade-empty";
      empty.textContent = "(nothing yet)";
      col.appendChild(empty);
    }
    return col;
  }

  private offered(items: ItemStack[], itemId: string): boolean {
    return items.some((s) => s.itemId === itemId);
  }

  /** Send a new full offer to the server (which re-validates + broadcasts). */
  private offer(items: ItemStack[], coins: number): void {
    this.opts.onOffer(
      items.map((s) => ({ itemId: s.itemId, qty: s.qty })),
      coins,
    );
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
