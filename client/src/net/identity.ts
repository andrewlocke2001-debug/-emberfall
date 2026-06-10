const KEY = "mmo:playerId";

/**
 * A stable per-browser id so a page refresh (a brand-new server session)
 * restores the same character from the server's persistence store.
 */
export function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `p_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
