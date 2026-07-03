import type { GuildPayload } from "@mmo/shared";

export interface GuildPanelOptions {
  onCreate: (name: string, tag: string) => void;
  onInvite: (name: string) => void;
  onAccept: () => void;
  onLeave: () => void;
  onKick: (name: string) => void;
  onSetRank: (name: string, rank: "officer" | "member") => void;
  onRefresh: () => void;
}

/**
 * The guild panel (toggle G). Guildless: a create form (name + tag) and an
 * accept banner for pending invites. In a guild: the roster with ranks +
 * presence, invite-by-name (officer+), kick/promote controls (rank-gated by
 * the server; the UI only offers what your rank allows), and leave.
 */
export class GuildPanel {
  private readonly root = document.getElementById("guild") as HTMLDivElement;
  private readonly title = document.getElementById("guild-title") as HTMLSpanElement;
  private readonly body = document.getElementById("guild-body") as HTMLDivElement;
  private state: GuildPayload = { members: [] };
  private visible = false;

  constructor(private readonly opts: GuildPanelOptions) {
    document.getElementById("guild-close")?.addEventListener("click", () => this.toggle(false));
  }

  setGuild(state: GuildPayload): void {
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
    this.title.textContent = this.state.name
      ? `${this.state.name} [${this.state.tag ?? ""}]`
      : "Guild (G)";
    this.body.replaceChildren();
    if (this.state.name) this.renderRoster();
    else this.renderGuildless();
  }

  private renderGuildless(): void {
    if (this.state.invitedTo) {
      const banner = document.createElement("div");
      banner.className = "party-invite-banner";
      const text = document.createElement("span");
      text.textContent = `${this.state.invitedTo.by} invited you to ${this.state.invitedTo.guildName}!`;
      const accept = document.createElement("button");
      accept.type = "button";
      accept.id = "guild-accept";
      accept.textContent = "Accept";
      accept.addEventListener("click", () => this.opts.onAccept());
      banner.append(text, accept);
      this.body.appendChild(banner);
    }

    const form = document.createElement("div");
    form.className = "guild-create";
    const nameInput = this.input("guild-name-input", "Guild name (3-24)", 24);
    const tagInput = this.input("guild-tag-input", "TAG", 4);
    const create = document.createElement("button");
    create.type = "button";
    create.id = "guild-create-btn";
    create.textContent = "Found guild";
    create.addEventListener("click", () => {
      const name = nameInput.value.trim();
      const tag = tagInput.value.trim();
      if (name && tag) this.opts.onCreate(name, tag);
    });
    form.append(nameInput, tagInput, create);
    this.body.appendChild(form);
  }

  private renderRoster(): void {
    const canInvite = this.state.myRank === "leader" || this.state.myRank === "officer";
    if (canInvite) {
      const row = document.createElement("div");
      row.className = "guild-invite-row";
      const input = this.input("guild-invite-input", "Invite by name…", 24);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "guild-invite-btn";
      btn.textContent = "Invite";
      btn.addEventListener("click", () => {
        const name = input.value.trim();
        input.value = "";
        if (name) this.opts.onInvite(name);
      });
      row.append(input, btn);
      this.body.appendChild(row);
    }

    const rankIcon: Record<string, string> = { leader: "👑", officer: "⭐", member: "" };
    for (const m of this.state.members) {
      const row = document.createElement("div");
      row.className = "party-row";
      const dot = document.createElement("span");
      dot.className = m.online ? "friend-dot online" : "friend-dot";
      const label = document.createElement("span");
      label.className = "friend-name";
      label.textContent =
        `${rankIcon[m.rank] ?? ""} ${m.name}`.trim() + (m.online ? ` — ${m.zone ?? ""}` : " — offline");
      row.append(dot, label);

      if (this.state.myRank === "leader" && m.rank !== "leader") {
        const flip = document.createElement("button");
        flip.type = "button";
        flip.className = "guild-mini-btn";
        flip.textContent = m.rank === "member" ? "▲" : "▼";
        flip.title = m.rank === "member" ? "Promote to officer" : "Demote to member";
        flip.addEventListener("click", () =>
          this.opts.onSetRank(m.name, m.rank === "member" ? "officer" : "member"),
        );
        row.appendChild(flip);
      }
      if (
        (this.state.myRank === "leader" && m.rank !== "leader") ||
        (this.state.myRank === "officer" && m.rank === "member")
      ) {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "friend-remove";
        kick.textContent = "✕";
        kick.title = "Kick";
        kick.addEventListener("click", () => this.opts.onKick(m.name));
        row.appendChild(kick);
      }
      this.body.appendChild(row);
    }

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "party-leave";
    leave.textContent = "Leave guild";
    leave.addEventListener("click", () => this.opts.onLeave());
    this.body.appendChild(leave);
  }

  /** A text input that pauses game keys while focused (stopPropagation). */
  private input(id: string, placeholder: string, maxLength: number): HTMLInputElement {
    const el = document.createElement("input");
    el.type = "text";
    el.id = id;
    el.placeholder = placeholder;
    el.maxLength = maxLength;
    el.autocomplete = "off";
    el.className = "guild-input";
    el.addEventListener("keydown", (e) => e.stopPropagation());
    return el;
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
