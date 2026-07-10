import type { ExchangePayload, ExchangeOrderEntry } from "@mmo/shared";
import { ITEMS } from "@mmo/shared/data/items";

export interface ExchangePanelOptions {
  onPost: (side: "buy" | "sell", itemId: string, qty: number, price: number) => void;
  onCancel: (orderId: string) => void;
  onCollect: (orderId: string) => void;
  onRefresh: (itemId?: string) => void;
}

/**
 * The Exchange panel (toggle X): post buy/sell orders, watch your open orders
 * fill, collect proceeds, and check an item's recent trade prices. The server
 * gates posting to the clerk (vendor proximity) and owns the book; this only
 * renders the last Exchange message and forwards intents.
 */
export class ExchangePanel {
  private readonly root = document.getElementById("exchange") as HTMLDivElement;
  private readonly body = document.getElementById("exchange-body") as HTMLDivElement;
  private state: ExchangePayload = { orders: [] };
  private visible = false;

  constructor(private readonly opts: ExchangePanelOptions) {
    document.getElementById("exchange-close")?.addEventListener("click", () => this.toggle(false));
  }

  setExchange(state: ExchangePayload): void {
    this.state = state;
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

  private input(placeholder: string, type = "text", width = ""): HTMLInputElement {
    const el = document.createElement("input");
    el.type = type;
    el.placeholder = placeholder;
    el.className = "trade-input";
    if (width) el.style.flex = `0 0 ${width}`;
    el.autocomplete = "off";
    el.addEventListener("keydown", (e) => e.stopPropagation());
    return el;
  }

  private render(): void {
    this.body.replaceChildren();

    // --- post form -----------------------------------------------------------
    const form = document.createElement("div");
    form.className = "trade-row";
    const side = document.createElement("select");
    side.className = "trade-input";
    side.style.flex = "0 0 70px";
    for (const s of ["buy", "sell"]) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      side.appendChild(o);
    }
    const item = this.input("item id (e.g. iron_ore)");
    const qty = this.input("qty", "number", "64px");
    const price = this.input("price", "number", "72px");
    const post = document.createElement("button");
    post.type = "button";
    post.className = "trade-btn";
    post.textContent = "Post";
    post.addEventListener("click", () => {
      const id = item.value.trim();
      const q = Math.floor(Number(qty.value) || 0);
      const p = Math.floor(Number(price.value) || 0);
      if (id && q > 0 && p > 0) this.opts.onPost(side.value as "buy" | "sell", id, q, p);
    });
    form.append(side, item, qty, price, post);
    this.body.appendChild(form);

    // Price-feed lookup for the typed item.
    const feedBtn = document.createElement("button");
    feedBtn.type = "button";
    feedBtn.className = "trade-btn ghost";
    feedBtn.textContent = "Recent prices";
    feedBtn.addEventListener("click", () => {
      const id = item.value.trim();
      if (id) this.opts.onRefresh(id);
    });
    this.body.appendChild(feedBtn);

    if (this.state.item && this.state.prices) {
      const feed = document.createElement("div");
      feed.className = "exchange-feed";
      const name = ITEMS[this.state.item]?.name ?? this.state.item;
      feed.textContent =
        this.state.prices.length === 0
          ? `${name}: no trades yet`
          : `${name}: ` + this.state.prices.map((p) => `${p.qty}× @${p.price}c`).join(" · ");
      this.body.appendChild(feed);
    }

    // --- my orders -----------------------------------------------------------
    const title = document.createElement("h4");
    title.className = "exchange-title";
    title.textContent = "My orders";
    this.body.appendChild(title);
    if (this.state.orders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "trade-empty";
      empty.textContent = "No open orders.";
      this.body.appendChild(empty);
    }
    for (const o of this.state.orders) this.body.appendChild(this.orderRow(o));
  }

  private orderRow(o: ExchangeOrderEntry): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "exchange-order";
    const label = document.createElement("span");
    label.className = "friend-name";
    const name = ITEMS[o.itemId]?.name ?? o.itemId;
    const filled = o.qty - o.remaining;
    label.textContent =
      `[${o.side.toUpperCase()}] ${name} ${filled}/${o.qty} @ ${o.price}c` +
      (o.coinsToCollect > 0 || o.itemsToCollect > 0
        ? ` — collect ${o.itemsToCollect > 0 ? `${o.itemsToCollect} items ` : ""}${o.coinsToCollect > 0 ? `${o.coinsToCollect}c` : ""}`.trimEnd()
        : "");
    row.appendChild(label);
    if (o.coinsToCollect > 0 || o.itemsToCollect > 0) {
      const collect = document.createElement("button");
      collect.type = "button";
      collect.className = "guild-mini-btn";
      collect.textContent = "Collect";
      collect.addEventListener("click", () => this.opts.onCollect(o.id));
      row.appendChild(collect);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "friend-remove";
    cancel.textContent = "✕";
    cancel.title = "Cancel order (returns escrow)";
    cancel.addEventListener("click", () => this.opts.onCancel(o.id));
    row.appendChild(cancel);
    return row;
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
