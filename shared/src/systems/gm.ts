/**
 * Game-master commands v1 — role gating + command parsing (pure, testable).
 *
 * Who is a GM is configured by the `GM_USERNAMES` env var (comma-separated,
 * case-insensitive), parsed by the server into an allowlist — no DB column, so
 * granting/revoking is a deploy-time secret a client can never set. The actual
 * command effects (heal/tp/spawn/kick) live in the server's ZoneRoom, which
 * owns the authoritative state; these helpers only decide *who* may run a
 * command and *parse* the text. Pure so they're unit-tested here and reusable
 * (the client can use parseCommand to detect a slash command locally too).
 */

/** Parse the `GM_USERNAMES` allowlist into a normalized lookup set. */
export function parseGmAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Is this display name a configured GM? Comparison is case-insensitive. */
export function isGm(username: string, allowlist: Set<string>): boolean {
  return allowlist.has(username.trim().toLowerCase());
}

export interface GmCommand {
  cmd: string;
  args: string[];
}

/**
 * Parse a chat line into a command, or null if it isn't one. A command is any
 * message starting with "/", e.g. "/tp 100 200" → { cmd: "tp", args:
 * ["100","200"] }. Whitespace-collapsed; the command name is lower-cased.
 */
export function parseCommand(text: string): GmCommand | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const parts = t.slice(1).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const [cmd, ...args] = parts;
  return { cmd: cmd!.toLowerCase(), args };
}
