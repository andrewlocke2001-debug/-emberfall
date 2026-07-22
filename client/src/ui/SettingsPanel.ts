import {
  loadSettings,
  saveSettings,
  eventToKeyName,
  DEFAULT_KEYS,
  RESERVED_KEYS,
  type Settings,
  type KeyBinds,
} from "../settings";

export interface SettingsPanelOptions {
  /** Fired whenever a setting changes (toggles apply live; keys on reload). */
  onChange: (s: Settings) => void;
  /** Replay the tutorial from step one. */
  onReplayTutorial: () => void;
  /** Playtest cheats (single-player only): runs a sandbox slash-command. */
  cheats?: { run: (cmd: string) => void };
}

const KEY_LABELS: Record<keyof KeyBinds, string> = {
  inventory: "Inventory",
  quests: "Quest log",
  craft: "Crafting",
  bank: "Bank",
  friends: "Friends",
  party: "Party",
  guild: "Guild",
  trade: "Trade",
  exchange: "Exchange",
  mount: "Mount / dismount",
  skills: "Skill tree",
  ability1: "Ability 1 (Strike)",
  ability2: "Ability 2 (Special)",
  ability3: "Ability 3 (AOE)",
  ability4: "Ability 4 (Mend)",
};

/** Pretty display for Phaser key names ("ONE" → "1"). */
const pretty = (k: string): string => {
  const digits: Record<string, string> = {
    ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4",
    FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9",
  };
  return digits[k] ?? k;
};

/**
 * The Settings panel (play-test ask): custom key bindings + gameplay toggles.
 * Click a key chip, press the new key; Escape cancels. Key changes apply on
 * the next zone change or reload (the scene registers keys at create time).
 */
export class SettingsPanel {
  private readonly root = document.getElementById("settings") as HTMLDivElement;
  private readonly body = document.getElementById("settings-body") as HTMLDivElement;
  private settings: Settings = loadSettings();
  private listening: HTMLButtonElement | null = null;
  /** Cancels a pending key-capture (rebind) — MUST run on close/destroy. */
  private cancelListen: (() => void) | null = null;

  constructor(private readonly opts: SettingsPanelOptions) {
    document.getElementById("settings-close")?.addEventListener("click", () => this.toggle(false));
  }

  current(): Settings {
    return this.settings;
  }

  toggle(force?: boolean): void {
    const show = force ?? this.root.style.display !== "flex";
    // Closing mid-rebind must release the window key-capture, or it swallows
    // every keystroke forever (WASD/chat/panels all dead — a "frozen" game).
    if (!show) this.cancelListen?.();
    this.root.style.display = show ? "flex" : "none";
    if (show) this.render();
  }

  private commit(): void {
    saveSettings(this.settings);
    this.opts.onChange(this.settings);
  }

  private render(): void {
    this.body.replaceChildren();

    const section = (label: string): void => {
      const el = document.createElement("div");
      el.className = "set-section";
      el.textContent = label;
      this.body.appendChild(el);
    };

    section("Controls");
    const fixed = document.createElement("div");
    fixed.className = "set-row";
    fixed.innerHTML = `<span style="color:var(--muted)">Move — WASD / arrows · Attack — hold Space</span>`;
    this.body.appendChild(fixed);

    (Object.keys(KEY_LABELS) as (keyof KeyBinds)[]).forEach((action) => {
      const row = document.createElement("div");
      row.className = "set-row";
      const label = document.createElement("span");
      label.textContent = KEY_LABELS[action];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "set-key";
      btn.textContent = pretty(this.settings.keys[action]);
      btn.addEventListener("click", () => this.listen(btn, action));
      row.append(label, btn);
      this.body.appendChild(row);
    });

    section("Gameplay");
    this.toggleRow("Floating damage numbers", this.settings.showDamage, (v) => {
      this.settings.showDamage = v;
      this.commit();
    });
    this.toggleRow("Ambient particles (leaves, embers)", this.settings.particles, (v) => {
      this.settings.particles = v;
      this.commit();
    });

    // Playtest cheats — single-player only (the server never honors these).
    if (this.opts.cheats) {
      const { run } = this.opts.cheats;
      section("Playtest cheats");
      const grid = document.createElement("div");
      grid.className = "cheat-grid";
      const btn = (label: string, cmds: string[]): void => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cheat-btn";
        b.textContent = label;
        b.addEventListener("click", () => {
          for (const c of cmds) run(c);
          b.blur(); // Space (attack) must never re-fire a cheat
        });
        grid.appendChild(b);
      };
      btn("Max all skills", ["/maxme"]);
      btn("+1,000 coins", ["/give coins 1000"]);
      btn("Iron weapon kit", [
        "/give iron_sword 1",
        "/give iron_axe 1",
        "/give iron_dagger 1",
        "/give hunter_longbow 1",
        "/give cinder_staff 1",
      ]);
      btn("Own a mount", ["/mount"]);
      btn("Full heal", ["/heal"]);
      btn("Reset raid lockout", ["/raidreset"]);
      btn("Weaken foes to 25%", ["/weaken 25"]);
      this.body.appendChild(grid);

      const travel = document.createElement("div");
      travel.className = "cheat-grid";
      for (const [label, id] of [
        ["→ Meadowbrook", "meadowbrook"],
        ["→ Greenreach", "greenreach"],
        ["→ Marrowgate Downs", "marrowgate_downs"],
        ["→ Tanglewood", "tanglewood"],
        ["→ Vossmere", "vossmere"],
        ["→ Dolmholt", "dolmholt"],
        ["→ Cinderfen", "cinderfen"],
        ["→ Ashreach (PvP)", "ashreach"],
        ["→ Graywastes", "graywastes"],
        ["→ Kindlecourt", "kindlecourt"],
        ["→ Emberheart Caldera", "emberheart_caldera"],
        ["→ Refused Column", "refused_column"],
        ["→ Cinder Depths", "cinder_depths"],
        ["→ Molten Throne (raid)", "molten_throne"],
      ] as const) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cheat-btn";
        b.textContent = label;
        b.addEventListener("click", () => {
          this.toggle(false); // close before the zone reboots the scene
          run(`/goto ${id}`);
        });
        travel.appendChild(b);
      }
      this.body.appendChild(travel);
    }

    const note = document.createElement("div");
    note.className = "set-row";
    note.innerHTML = `<span style="color:var(--muted);font-size:12px">Key changes apply immediately.</span>`;
    this.body.appendChild(note);

    const actions = document.createElement("div");
    actions.className = "set-actions";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset keys";
    reset.addEventListener("click", () => {
      this.settings.keys = { ...DEFAULT_KEYS };
      this.commit();
      this.render();
    });
    const replay = document.createElement("button");
    replay.type = "button";
    replay.textContent = "Replay tutorial";
    replay.addEventListener("click", () => {
      this.toggle(false);
      this.opts.onReplayTutorial();
    });
    actions.append(reset, replay);
    this.body.appendChild(actions);
  }

  private toggleRow(label: string, value: boolean, onSet: (v: boolean) => void): void {
    const row = document.createElement("div");
    row.className = "set-row";
    const span = document.createElement("span");
    span.textContent = label;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = value;
    box.addEventListener("change", () => onSet(box.checked));
    row.append(span, box);
    this.body.appendChild(row);
  }

  /** Capture the next keypress as the new binding (Escape cancels). */
  private listen(btn: HTMLButtonElement, action: keyof KeyBinds): void {
    if (this.listening) return;
    this.listening = btn;
    btn.classList.add("listening");
    btn.textContent = "press…";
    const done = (): void => {
      window.removeEventListener("keydown", onKey, true);
      btn.classList.remove("listening");
      this.listening = null;
      this.cancelListen = null;
      this.render();
    };
    this.cancelListen = done;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return done();
      const name = eventToKeyName(e);
      if (!name || RESERVED_KEYS.has(name)) {
        btn.textContent = "reserved — try another"; // tell them, keep listening
        return;
      }
      // Swap with any action already using this key (no dead bindings).
      for (const other of Object.keys(this.settings.keys) as (keyof KeyBinds)[]) {
        if (this.settings.keys[other] === name) this.settings.keys[other] = this.settings.keys[action];
      }
      this.settings.keys[action] = name;
      this.commit();
      done();
    };
    window.addEventListener("keydown", onKey, true);
  }

  destroy(): void {
    this.cancelListen?.();
    this.root.style.display = "none";
  }
}
