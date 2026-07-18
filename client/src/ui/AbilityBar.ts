import { ABILITIES, GCD_MS, type AbilityId } from "@mmo/shared";

export interface AbilityBarOptions {
  /** Called when a slot is clicked / tapped. */
  onUse: (id: AbilityId) => void;
}

/**
 * The on-screen ability bar: an energy meter plus one slot per ability
 * (number-keyed), each with a shrinking cooldown overlay. Cooldown/GCD timing
 * is tracked client-side for responsive feedback; the server stays the
 * authority on whether an ability actually fires.
 */
export class AbilityBar {
  private readonly root = document.getElementById("abilities") as HTMLDivElement;
  private readonly energyFill: HTMLDivElement;
  private readonly slots = new Map<AbilityId, HTMLDivElement>();
  private gcdUntil = 0;
  private readonly readyAt = new Map<AbilityId, number>();
  private readonly row: HTMLDivElement;
  /** The three slots shown — swapped when the equipped weapon class changes (P13). */
  private kit: AbilityId[] = ["strike", "power_strike", "mend"];

  constructor(private readonly opts: AbilityBarOptions) {
    this.root.replaceChildren(); // rebuild cleanly across scene restarts

    const energy = document.createElement("div");
    energy.className = "energy";
    this.energyFill = document.createElement("div");
    this.energyFill.className = "energy-fill";
    energy.appendChild(this.energyFill);
    this.root.appendChild(energy);

    this.row = document.createElement("div");
    this.row.className = "ability-row";
    this.buildSlots();
    this.root.appendChild(this.row);
    this.root.style.display = "flex";
  }

  /** Swap the bar to a weapon class's kit (no-op when unchanged). */
  setKit(kit: AbilityId[]): void {
    if (kit.length === this.kit.length && kit.every((id, i) => id === this.kit[i])) return;
    this.kit = [...kit];
    this.buildSlots();
  }

  private buildSlots(): void {
    this.row.replaceChildren();
    this.slots.clear();
    this.kit.forEach((id, i) => {
      const def = ABILITIES[id];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "ability-slot";

      const cd = document.createElement("div");
      cd.className = "ability-cd";
      const key = document.createElement("div");
      key.className = "ability-key";
      key.textContent = String(i + 1);
      const name = document.createElement("div");
      name.className = "ability-name";
      name.textContent = def.name;

      slot.append(cd, key, name);
      slot.addEventListener("click", () => this.opts.onUse(id));
      this.row.appendChild(slot);
      this.slots.set(id, cd);
    });
  }

  /** True if the ability is off cooldown/GCD and the player can afford it. */
  canUse(id: AbilityId, energy: number): boolean {
    const def = ABILITIES[id];
    const now = performance.now();
    if ((def.energyCost ?? 0) > energy) return false;
    if ((def.onGcd ?? true) && now < this.gcdUntil) return false;
    return now >= (this.readyAt.get(id) ?? 0);
  }

  /** Record a use locally so the cooldown/GCD overlays animate immediately. */
  markUsed(id: AbilityId): void {
    const def = ABILITIES[id];
    const now = performance.now();
    if (def.onGcd ?? true) this.gcdUntil = now + GCD_MS;
    if (def.cooldownMs > 0) this.readyAt.set(id, now + def.cooldownMs);
  }

  setEnergy(energy: number, maxEnergy: number): void {
    const pct = maxEnergy > 0 ? Math.max(0, Math.min(1, energy / maxEnergy)) : 0;
    this.energyFill.style.width = `${pct * 100}%`;
  }

  /** Refresh the cooldown overlays (call each frame). */
  render(): void {
    const now = performance.now();
    for (const [id, cd] of this.slots) {
      const def = ABILITIES[id];
      const ownLeft = (this.readyAt.get(id) ?? 0) - now;
      const gcdLeft = (def.onGcd ?? true) ? this.gcdUntil - now : 0;
      const remaining = Math.max(ownLeft, gcdLeft, 0);
      const duration = Math.max(def.cooldownMs, (def.onGcd ?? true) ? GCD_MS : 0, 1);
      cd.style.height = `${Math.min(1, remaining / duration) * 100}%`;
    }
  }

  destroy(): void {
    this.root.style.display = "none";
    this.root.replaceChildren();
  }
}
