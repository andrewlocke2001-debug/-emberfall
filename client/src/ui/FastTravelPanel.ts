import { FAST_TRAVEL_COST } from "@mmo/shared";
import { WAYSTONES } from "@mmo/shared/data/waystones";

export interface FastTravelPanelOptions {
  onTravel: (destId: string) => void;
}

/**
 * The waystone fast-travel menu (P11.2). Opens when you click a waystone,
 * listing every OTHER waystone as a destination. The server charges the coin
 * fee and performs the zone transfer; this only forwards the chosen id.
 */
export class FastTravelPanel {
  private readonly root = document.getElementById("fasttravel") as HTMLDivElement;
  private readonly body = document.getElementById("fasttravel-body") as HTMLDivElement;
  private fromId = "";

  constructor(private readonly opts: FastTravelPanelOptions) {
    document.getElementById("fasttravel-close")?.addEventListener("click", () => this.close());
  }

  open(fromId: string): void {
    this.fromId = fromId;
    this.body.replaceChildren();
    const fee = document.createElement("div");
    fee.className = "trade-empty";
    fee.textContent = `Fee: ${FAST_TRAVEL_COST} coins per jump.`;
    this.body.appendChild(fee);
    for (const w of Object.values(WAYSTONES)) {
      if (w.id === fromId) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "trade-btn";
      b.textContent = `Travel to ${w.name}`;
      b.addEventListener("click", () => {
        this.opts.onTravel(w.id);
        this.close();
      });
      this.body.appendChild(b);
    }
    this.root.style.display = "flex";
  }

  close(): void {
    this.root.style.display = "none";
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
