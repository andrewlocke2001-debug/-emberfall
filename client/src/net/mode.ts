/**
 * Single-player mode flag. Baked at build time (VITE_SOLO=1 → the static
 * GitHub Pages build), or forced at runtime with `?solo` for a quick local
 * check against the dev server build. In solo mode the client runs the whole
 * game in-browser (see net/localRoom) with no server or login.
 */
export const SOLO =
  (import.meta.env["VITE_SOLO"] as string | undefined) === "1" ||
  new URLSearchParams(window.location.search).has("solo");
