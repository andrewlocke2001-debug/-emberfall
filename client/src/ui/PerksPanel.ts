import { PERK_TIERS, RESPEC_COST } from "@mmo/shared/data/perks";
import { canChoosePerk } from "@mmo/shared/systems/perks";
import { CALLINGS, CALLING_IDS, CALLING_RESPEC_COST } from "@mmo/shared/data/callings";
import { talentPointsFor, pointsSpent, canSpendTalent, type Talents } from "@mmo/shared/systems/callings";
import type { CallingId, TalentEffects } from "@mmo/shared/data/callings";
import { WEB_NODES, WEB_EDGES, WEB_STARTS, webNode } from "@mmo/shared/data/web";
import type { CallingPayload } from "@mmo/shared/protocol/messages";

export interface PerksPanelOptions {
  onChoose: (id: string) => void;
  onRespec: () => void;
  onChooseCalling: (id: string) => void;
  onSpendTalent: (id: string) => void;
  onRespecCalling: () => void;
  onRefresh: () => void;
}

const SVG = "http://www.w3.org/2000/svg";
/** Web coords are centered at 0; shift into a positive SVG canvas. */
const CENTER = 560;
const CANVAS = CENTER * 2;

/** Human-readable one-liner for a node's effects. */
function describe(effects: TalentEffects): string {
  const parts: string[] = [];
  const pct = (v: number | undefined, label: string): void => { if (v) parts.push(`+${v}% ${label}`); };
  pct(effects.attackPct, "attack");
  pct(effects.strengthPct, "strength");
  pct(effects.defencePct, "defence");
  if (effects.maxHpFlat) parts.push(`+${effects.maxHpFlat} max HP`);
  if (effects.gcdPct) parts.push(`-${effects.gcdPct}% cooldown`);
  if (effects.lifesteal) parts.push(`+${effects.lifesteal} HP on hit`);
  pct(effects.executePct, "execute dmg");
  if (effects.critChance) parts.push(`+${effects.critChance}% crit`);
  if (effects.energyCostPct) parts.push(`-${effects.energyCostPct}% energy cost`);
  pct(effects.healPowerPct, "healing");
  return parts.join(", ");
}

/**
 * The skill panel (toggle K). Top: your Calling — pick one of six, then
 * allocate the shared PASSIVE WEB (P15.2), a Path-of-Exile-style graph you
 * grow outward node-by-node from your Calling's gate. Bottom: the Fighter's
 * Trunk (the original perk tiers). Pure presentation over server state —
 * eligibility mirrors the same shared rules the server enforces.
 */
export class PerksPanel {
  private readonly root = document.getElementById("perks") as HTMLDivElement;
  private readonly body = document.getElementById("perks-body") as HTMLDivElement;
  private chosen: string[] = [];
  private calling: string = "";
  private talents: Talents = {};
  private meleeLevel = 1;
  private rangedLevel = 1;
  private magicLevel = 1;
  private visible = false;
  private centeredOnce = false;

  constructor(private readonly opts: PerksPanelOptions) {
    document.getElementById("perks-close")?.addEventListener("click", () => this.toggle(false));
  }

  setPerks(chosen: string[]): void {
    this.chosen = chosen;
    if (this.visible) this.render();
  }

  setCalling(payload: CallingPayload): void {
    if (payload.calling !== this.calling) this.centeredOnce = false;
    this.calling = payload.calling;
    this.talents = payload.talents;
    if (this.visible) this.render();
  }

  setCombatLevels(melee: number, ranged: number, magic: number): void {
    if (melee === this.meleeLevel && ranged === this.rangedLevel && magic === this.magicLevel) return;
    this.meleeLevel = melee;
    this.rangedLevel = ranged;
    this.magicLevel = magic;
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
    if (this.calling === "") this.renderCallingChoice();
    else this.renderWeb(this.calling as CallingId);
    this.renderTrunk();
  }

  /** No Calling yet: the six cards (offered from level 1). */
  private renderCallingChoice(): void {
    const intro = document.createElement("div");
    intro.className = "perk-intro";
    intro.textContent =
      "Choose your Calling — it decides where you enter the passive web. Pick one; abandoning it later costs coins.";
    this.body.appendChild(intro);

    const grid = document.createElement("div");
    grid.className = "calling-grid";
    for (const id of CALLING_IDS) {
      const def = CALLINGS[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "calling-card";
      card.innerHTML = `<span class="perk-name">${def.name}</span><span class="perk-desc">${def.fantasy}</span>`;
      card.addEventListener("click", () => this.opts.onChooseCalling(id));
      grid.appendChild(card);
    }
    this.body.appendChild(grid);
  }

  /** A chosen Calling: points header + the pannable passive web (SVG). */
  private renderWeb(calling: CallingId): void {
    const def = CALLINGS[calling];
    const points = talentPointsFor(this.meleeLevel, this.rangedLevel, this.magicLevel);
    const spent = pointsSpent(this.talents);

    const head = document.createElement("div");
    head.className = "perk-intro";
    head.textContent =
      `${def.name} — passive points: ${points - spent} free / ${points} earned ` +
      `(2 per 5 combat levels) · drag to pan, click a lit node to allocate`;
    this.body.appendChild(head);

    const gate = WEB_STARTS[calling];
    const viewport = document.createElement("div");
    viewport.className = "web-viewport";
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("width", String(CANVAS));
    svg.setAttribute("height", String(CANVAS));
    svg.setAttribute("class", "web-svg");

    // Edges first (under the nodes).
    for (const [a, b] of WEB_EDGES) {
      const na = webNode(a)!;
      const nb = webNode(b)!;
      const line = document.createElementNS(SVG, "line");
      line.setAttribute("x1", String(na.x + CENTER));
      line.setAttribute("y1", String(na.y + CENTER));
      line.setAttribute("x2", String(nb.x + CENTER));
      line.setAttribute("y2", String(nb.y + CENTER));
      const lit = (this.talents[a] || a === gate) && (this.talents[b] || b === gate);
      line.setAttribute("class", lit ? "web-edge lit" : "web-edge");
      svg.appendChild(line);
    }

    // Nodes.
    for (const node of Object.values(WEB_NODES)) {
      const owned = !!this.talents[node.id] || node.id === gate;
      const allocatable = canSpendTalent(calling, this.talents, node.id, points);
      const r = node.kind === "keystone" ? 16 : node.kind === "notable" ? 11 : 7;

      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class",
        `web-node ${node.kind}` +
        (owned ? " owned" : allocatable ? " open" : " locked"));
      const c = document.createElementNS(SVG, "circle");
      c.setAttribute("cx", String(node.x + CENTER));
      c.setAttribute("cy", String(node.y + CENTER));
      c.setAttribute("r", String(r));
      g.appendChild(c);

      const title = document.createElementNS(SVG, "title");
      title.textContent = `${node.name} — ${describe(node.effects)}` + (owned ? " (allocated)" : "");
      g.appendChild(title);

      if (node.kind !== "small") {
        const label = document.createElementNS(SVG, "text");
        label.setAttribute("x", String(node.x + CENTER));
        label.setAttribute("y", String(node.y + CENTER - r - 4));
        label.setAttribute("class", "web-label");
        label.textContent = node.name;
        g.appendChild(label);
      }

      g.setAttribute("data-node", node.id);
      if (allocatable) g.addEventListener("click", () => this.opts.onSpendTalent(node.id));
      svg.appendChild(g);
    }

    viewport.appendChild(svg);
    this.enablePan(viewport);
    this.body.appendChild(viewport);

    // Center the view on the Calling gate the first time it's shown.
    requestAnimationFrame(() => {
      if (this.centeredOnce) return;
      const g = webNode(gate);
      if (g) {
        viewport.scrollLeft = g.x + CENTER - viewport.clientWidth / 2;
        viewport.scrollTop = g.y + CENTER - viewport.clientHeight / 2;
        this.centeredOnce = true;
      }
    });

    const respec = document.createElement("button");
    respec.type = "button";
    respec.className = "trade-btn";
    respec.textContent = `Abandon Calling — clears the whole web (${CALLING_RESPEC_COST} coins)`;
    respec.addEventListener("click", () => this.opts.onRespecCalling());
    this.body.appendChild(respec);
  }

  /** Click-drag to pan the web viewport (mouse + touch). */
  private enablePan(vp: HTMLDivElement): void {
    let down = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;
    let moved = 0;
    const start = (x: number, y: number): void => {
      down = true; moved = 0; sx = x; sy = y; ox = vp.scrollLeft; oy = vp.scrollTop;
    };
    const move = (x: number, y: number): void => {
      if (!down) return;
      moved += Math.abs(x - sx) + Math.abs(y - sy);
      vp.scrollLeft = ox - (x - sx);
      vp.scrollTop = oy - (y - sy);
    };
    vp.addEventListener("pointerdown", (e) => start(e.clientX, e.clientY));
    vp.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
    // Suppress the node-click that a drag would otherwise trigger.
    vp.addEventListener("click", (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } }, true);
    const end = (): void => { down = false; };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointerleave", end);
  }

  /** The original melee perk tiers — every Calling shares this trunk. */
  private renderTrunk(): void {
    const head = document.createElement("div");
    head.className = "perk-tier";
    head.textContent = `Fighter's Trunk — Melee ${this.meleeLevel} (shared by every Calling)`;
    this.body.appendChild(head);

    PERK_TIERS.forEach((tier, i) => {
      const label = document.createElement("div");
      label.className = "perk-tier";
      const unlocked = this.meleeLevel >= tier.level;
      label.textContent = `Tier ${i + 1} — Melee ${tier.level}${unlocked ? "" : " 🔒"}`;
      this.body.appendChild(label);

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
      respec.textContent = `Respec trunk — forget all choices (${RESPEC_COST} coins)`;
      respec.addEventListener("click", () => this.opts.onRespec());
      this.body.appendChild(respec);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
