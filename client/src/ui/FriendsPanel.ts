import type { FriendEntry } from "@mmo/shared";

export interface FriendsPanelOptions {
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  /** Ask the server for a fresh list (presence changes over time). */
  onRefresh: () => void;
}

/**
 * The friends list panel (toggle F). Shows each friend with online/offline +
 * zone, an add-by-name input, and per-row remove. The server owns the list;
 * this renders the last Friends message and refreshes on open.
 */
export class FriendsPanel {
  private readonly root = document.getElementById("friends") as HTMLDivElement;
  private readonly list = document.getElementById("friends-list") as HTMLDivElement;
  private readonly input = document.getElementById("friends-input") as HTMLInputElement;
  private friends: FriendEntry[] = [];
  private visible = false;

  constructor(private readonly opts: FriendsPanelOptions) {
    document.getElementById("friends-close")?.addEventListener("click", () => this.toggle(false));
    document.getElementById("friends-add")?.addEventListener("click", () => this.submit());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      }
      e.stopPropagation(); // typing a name must not move the character
    });
  }

  private submit(): void {
    const name = this.input.value.trim();
    this.input.value = "";
    if (name) this.opts.onAdd(name);
  }

  setFriends(friends: FriendEntry[]): void {
    this.friends = friends;
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
    if (this.friends.length === 0) {
      const empty = document.createElement("div");
      empty.className = "friends-empty";
      empty.textContent = "No friends yet — add one by name above.";
      this.list.appendChild(empty);
      return;
    }
    for (const f of this.friends) {
      const row = document.createElement("div");
      row.className = "friend-row";
      const status = document.createElement("span");
      status.className = f.online ? "friend-dot online" : "friend-dot";
      const label = document.createElement("span");
      label.className = "friend-name";
      label.textContent = f.online ? `${f.name} — ${f.zone ?? ""}` : `${f.name} — offline`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "friend-remove";
      remove.textContent = "✕";
      remove.addEventListener("click", () => this.opts.onRemove(f.name));
      row.append(status, label, remove);
      this.list.appendChild(row);
    }
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
