/**
 * Player settings (play-test ask): rebindable action keys + gameplay toggles,
 * persisted per browser. Movement stays WASD/arrows (hardcoded muscle memory);
 * everything else is bindable. Key names use Phaser's KeyCodes vocabulary
 * ("I", "J", "ONE", …) so ZoneScene can feed them straight into addKeys().
 */
export interface KeyBinds {
  inventory: string;
  quests: string;
  craft: string;
  bank: string;
  friends: string;
  party: string;
  guild: string;
  trade: string;
  exchange: string;
  mount: string;
  skills: string;
  ability1: string;
  ability2: string;
  ability3: string;
}

export interface Settings {
  keys: KeyBinds;
  /** Floating damage/miss numbers over combatants. */
  showDamage: boolean;
  /** Ambient zone particles (pollen/leaves/embers). */
  particles: boolean;
}

export const DEFAULT_KEYS: KeyBinds = {
  inventory: "I",
  quests: "J",
  craft: "C",
  bank: "B",
  friends: "F",
  party: "P",
  guild: "G",
  trade: "T",
  exchange: "X",
  mount: "M",
  skills: "K",
  ability1: "ONE",
  ability2: "TWO",
  ability3: "THREE",
};

/** Keys the game reserves (movement/attack/chat/UI) — never bindable. */
export const RESERVED_KEYS = new Set(["W", "A", "S", "D", "SPACE", "ENTER", "ESC"]);

const STORE_KEY = "mmo:settings";

export function loadSettings(): Settings {
  const base: Settings = { keys: { ...DEFAULT_KEYS }, showDamage: true, particles: true };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    if (parsed.keys && typeof parsed.keys === "object") {
      for (const k of Object.keys(DEFAULT_KEYS) as (keyof KeyBinds)[]) {
        const v = parsed.keys[k];
        if (typeof v === "string" && /^[A-Z]+$/.test(v) && !RESERVED_KEYS.has(v)) base.keys[k] = v;
      }
    }
    if (typeof parsed.showDamage === "boolean") base.showDamage = parsed.showDamage;
    if (typeof parsed.particles === "boolean") base.particles = parsed.particles;
  } catch {
    /* corrupted settings fall back to defaults */
  }
  return base;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — settings just don't persist */
  }
}

/** Map a raw KeyboardEvent to a Phaser key name, or null if unbindable. */
export function eventToKeyName(e: KeyboardEvent): string | null {
  const k = e.key.toUpperCase();
  if (/^[A-Z]$/.test(k)) return k;
  const digits = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
  if (/^[0-9]$/.test(k)) return digits[Number(k)]!;
  return null;
}
