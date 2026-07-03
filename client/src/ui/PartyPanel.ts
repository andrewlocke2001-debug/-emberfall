import type { PartyPayload } from "@mmo/shared";

export interface PartyPanelOptions {
  onInvite: (name: string) => void;
  onAccept: () => void;
  onLeave: () => void;
  onRefresh: () => void;
}

/**
 * The party panel (toggle P). Shows the roster (leader crown, presence dots,
 * zones), an invite-by-name input, an Accept banner for pending invites, and
 * Leave. The server owns all party state; this renders the last Party message.
 */
export class PartyPanel {
  private readonly root = document.getElementById("party") as HTMLDivElement;
  private readonly list = document.getElementById("party-list") as HTMLDivElement;
  private readonly input = document.getElementById("party-input") as HTMLInputElement;
  private state: PartyPayload = { members: [] };
  private visible = false;

  constructor(private readonly opts: PartyPanelOptions) {
    document.getElementById("party-close")?.addEventListener("click", () => this.toggle(false));
    document.getElementById("party-invite")?.addEventListener("click", () => this.submit());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      }
      e.stopPropagation();
    });
  }

  private submit(): void {
    const name = this.input.value.trim();
    this.input.value = "";
    if (name) this.opts.onInvite(name);
  }

  setParty(state: PartyPayload): void {
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

  private render(): void {
    this.list.replaceChildren();

    if (this.state.invitedBy) {
      const banner = document.createElement("div");
      banner.className = "party-invite-banner";
      const text = document.createElement("span");
      text.textContent = `${this.state.invitedBy} invited you!`;
      const accept = document.createElement("button");
      accept.type = "button";
      accept.id = "party-accept";
      accept.textContent = "Accept";
      accept.addEventListener("click", () => this.opts.onAccept());
      banner.append(text, accept);
      this.list.appendChild(banner);
    }

    if (this.state.members.length === 0) {
      const empty = document.createElement("div");
      empty.className = "party-empty";
      empty.textContent = "Not in a party — invite someone by name above.";
      this.list.appendChild(empty);
      return;
    }

    for (const m of this.state.members) {
      const row = document.createElement("div");
      row.className = "party-row";
      const dot = document.createElement("span");
      dot.className = m.online ? "friend-dot online" : "friend-dot";
      const label = document.createElement("span");
      label.className = "friend-name";
      label.textContent =
        `${m.leader ? "👑 " : ""}${m.name}` + (m.online ? ` — ${m.zone ?? ""}` : " — offline");
      row.append(dot, label);
      this.list.appendChild(row);
    }

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "party-leave";
    leave.textContent = "Leave party";
    leave.addEventListener("click", () => this.opts.onLeave());
    this.list.appendChild(leave);
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
