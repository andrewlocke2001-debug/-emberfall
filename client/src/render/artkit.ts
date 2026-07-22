import Phaser from "phaser";
import type { ZoneMap } from "@mmo/shared/systems/zonemap";

/**
 * The Emberfall art kit — the game's entire visual identity, painted at
 * runtime. Emberfall deliberately ships ZERO image files (the single-file
 * offline build must stay self-contained), so "assets" here are procedural:
 * hand-tuned canvas painting for terrain, generated silhouette textures for
 * every creature, soft-light sprites, and particle textures. Deterministic
 * (seeded per tile) so the world looks authored, not random.
 *
 * Art direction: painterly-dark fantasy — deep mossy greens, ember ambers,
 * cool slate stone — with readability first: entities always pop from
 * terrain, danger reads red, interactables glow.
 */

// --- deterministic per-tile randomness --------------------------------------

/** Cheap seeded hash → [0,1). Stable per (x,y,salt) so the world is authored. */
function h2(x: number, y: number, salt = 0): number {
  let n = x * 374761393 + y * 668265263 + salt * 1274126177;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/** Mix two 0xRRGGBB colors. */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

// --- terrain painting ---------------------------------------------------------

/** gid meanings (see tools/mapgen): 1 grass · 2 path · 3 wall · 4 tree · 5 water · 6 floor · 7 fence */
const GRASS = 1, PATH = 2, WALL = 3, TREE = 4, WATER = 5, FLOOR = 6, FENCE = 7;

/** Per-zone terrain palettes (ground base, grass accent, wall tone, water). */
interface ZonePalette {
  grass: number;
  grassDark: number;
  blade: number;
  flower: number;
  path: number;
  wall: number;
  water: number;
  canopy: number;
  canopyLit: number;
  floor: number;
}

const PALETTES: Record<string, ZonePalette> = {
  default: {
    grass: 0x2c4423, grassDark: 0x24391d, blade: 0x3d5c2e, flower: 0xd9c96a,
    path: 0x59492f, wall: 0x646a73, water: 0x1d3f66, canopy: 0x1c3a22,
    canopyLit: 0x2c5232, floor: 0x5d4a34,
  },
  ashreach: {
    grass: 0x3d3230, grassDark: 0x342a28, blade: 0x53403a, flower: 0xd97b3f,
    path: 0x554038, wall: 0x4c4348, water: 0x6e3020, canopy: 0x402e26,
    canopyLit: 0x59402f, floor: 0x574238,
  },
  cinder_depths: {
    grass: 0x27222b, grassDark: 0x201c24, blade: 0x38303e, flower: 0xc9694a,
    path: 0x3c3340, wall: 0x37323d, water: 0x8a4020, canopy: 0x2a2430,
    canopyLit: 0x3b3244, floor: 0x413644,
  },
  molten_throne: {
    grass: 0x2d2126, grassDark: 0x241a1e, blade: 0x452c30, flower: 0xe2703a,
    path: 0x4a3033, wall: 0x453238, water: 0xa14a1c, canopy: 0x33232a,
    canopyLit: 0x4a3038, floor: 0x4e3237,
  },
  marrowgate_downs: {
    grass: 0x47503e, grassDark: 0x3b4334, blade: 0x60694e, flower: 0xc9d4d8,
    path: 0x6f6a58, wall: 0x8e979c, water: 0x24455c, canopy: 0x2f3f2b,
    canopyLit: 0x43563c, floor: 0x635c4d,
  },
  refused_column: {
    grass: 0x2e3134, grassDark: 0x27292c, blade: 0x3f434a, flower: 0x9fb4bd,
    path: 0x4a4a44, wall: 0x5a6165, water: 0x1d3346, canopy: 0x2b3236,
    canopyLit: 0x3b444a, floor: 0x565149,
  },
  vossmere: {
    grass: 0x39473f, grassDark: 0x2f3c35, blade: 0x4e6154, flower: 0xa8c8c3,
    path: 0x6d6350, wall: 0x33363b, water: 0x1e4a56, canopy: 0x27402f,
    canopyLit: 0x3a5843, floor: 0x6a5a44,
  },
  dolmholt: {
    grass: 0x3c4038, grassDark: 0x33362f, blade: 0x525748, flower: 0xb9c4c9,
    path: 0x5c5648, wall: 0x6b6f78, water: 0x1d3c50, canopy: 0x263528,
    canopyLit: 0x374b39, floor: 0x5e564a,
  },
  cinderfen: {
    grass: 0x414a3a, grassDark: 0x373f31, blade: 0x59654c, flower: 0xd08a4e,
    path: 0x574f3e, wall: 0x707a6c, water: 0x3a5a52, canopy: 0x33452f,
    canopyLit: 0x49603f, floor: 0x5e5744,
  },
  graywastes: {
    grass: 0x475056, grassDark: 0x3c444a, blade: 0x5d686e, flower: 0xd8e8f0,
    path: 0x5a5b55, wall: 0x77828c, water: 0x2a5666, canopy: 0x2e3e3c,
    canopyLit: 0x415852, floor: 0x565a5e,
  },
  kindlecourt: {
    grass: 0x4a4440, grassDark: 0x3f3a36, blade: 0x5f5850, flower: 0xe0b070,
    path: 0x6b6157, wall: 0x8a8078, water: 0x27424e, canopy: 0x3a352e,
    canopyLit: 0x504839, floor: 0x6e6257,
  },
  emberheart_caldera: {
    grass: 0x332a28, grassDark: 0x2b2321, blade: 0x4a3a34, flower: 0xff9e5e,
    path: 0x4e3c34, wall: 0x3f3438, water: 0xb85a1e, canopy: 0x33232a,
    canopyLit: 0x4a3038, floor: 0x503a34,
  },
  sunken_pyre: {
    grass: 0x21313a, grassDark: 0x1b2931, blade: 0x2f4450, flower: 0x7fb0ba,
    path: 0x35434c, wall: 0x2c3b42, water: 0x1d4a56, canopy: 0x22333a,
    canopyLit: 0x30474f, floor: 0x4a3c30,
  },
  bg_arena: {
    grass: 0x33383f, grassDark: 0x2b3037, blade: 0x454c56, flower: 0x8fa3bd,
    path: 0x4a5058, wall: 0x555d68, water: 0x1d3f66, canopy: 0x2c3e35,
    canopyLit: 0x3d5246, floor: 0x525a64,
  },
};

export function paletteFor(zoneId: string): ZonePalette {
  return PALETTES[zoneId] ?? PALETTES["default"]!;
}

/**
 * Paint the whole zone into ONE canvas texture ("zone-art"): base terrain with
 * authored variation, soft terrain transitions, pseudo-3D walls, dappled tree
 * canopies with cast shadows, pebbled paths, flowing-looking water. Replaces
 * the old flat-color tile fill; pure presentation (collision untouched).
 */
export function paintZoneTexture(scene: Phaser.Scene, map: ZoneMap, zoneId: string): string {
  const key = `zone-art-${zoneId}`;
  if (scene.textures.exists(key)) return key;
  const p = paletteFor(zoneId);
  const t = map.tileSize;
  const tex = scene.textures.createCanvas(key, map.cols * t, map.rows * t)!;
  const ctx = tex.getContext();

  const gidAt = (cx: number, cy: number): number => {
    if (cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows) return WALL;
    const ob = map.obstacles[cy * map.cols + cx]!;
    return ob !== 0 ? ob : map.ground[cy * map.cols + cx]!;
  };

  // Pass 1: ground.
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      const x = cx * t, y = cy * t;
      const g = map.ground[cy * map.cols + cx]!;
      if (g === PATH) paintPath(ctx, x, y, t, cx, cy, p);
      else if (g === FLOOR) paintFloor(ctx, x, y, t, cx, cy, p);
      else paintGrass(ctx, x, y, t, cx, cy, p);
    }
  }

  // Pass 2: soft transitions where grass meets path/floor (authored edges).
  ctx.globalAlpha = 0.28;
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      const g = map.ground[cy * map.cols + cx]!;
      if (g !== PATH && g !== FLOOR) continue;
      const x = cx * t, y = cy * t;
      ctx.fillStyle = css(p.grassDark);
      if (gidAt(cx, cy - 1) === GRASS) ctx.fillRect(x, y, t, 3);
      if (gidAt(cx, cy + 1) === GRASS) ctx.fillRect(x, y + t - 3, t, 3);
      if (gidAt(cx - 1, cy) === GRASS) ctx.fillRect(x, y, 3, t);
      if (gidAt(cx + 1, cy) === GRASS) ctx.fillRect(x + t - 3, y, 3, t);
    }
  }
  ctx.globalAlpha = 1;

  // Pass 3: obstacles (walls/water/fences), with simple neighbor-aware shading.
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      const ob = map.obstacles[cy * map.cols + cx]!;
      if (ob === 0 || ob === TREE) continue;
      const x = cx * t, y = cy * t;
      if (ob === WALL) {
        // A wall directly above interior flooring is a building's south face:
        // render timber-and-plaster facade instead of bare rock.
        const floorBelow = map.ground[Math.min(map.rows - 1, cy + 1) * map.cols + cx] === FLOOR &&
          map.obstacles[Math.min(map.rows - 1, cy + 1) * map.cols + cx] === 0;
        if (floorBelow) paintFacade(ctx, x, y, t, cx, cy);
        else paintWall(ctx, x, y, t, cx, cy, p, gidAt(cx, cy - 1) !== WALL, gidAt(cx, cy + 1) !== WALL);
      }
      else if (ob === WATER) paintWater(ctx, x, y, t, cx, cy, p, gidAt(cx, cy - 1) !== WATER);
      else if (ob === FENCE) paintFence(ctx, x, y, t, cx, cy, p);
    }
  }

  // Pass 4: tree shadows then canopies (drawn last so canopies overlap edges).
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      if (map.obstacles[cy * map.cols + cx]! !== TREE) continue;
      const x = cx * t + t / 2, y = cy * t + t / 2;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 6, t * 0.52, t * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      if (map.obstacles[cy * map.cols + cx]! !== TREE) continue;
      paintCanopy(ctx, cx * t + t / 2, cy * t + t / 2, t, cx, cy, p);
    }
  }

  tex.refresh();
  return key;
}

function paintGrass(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette): void {
  const v = h2(cx, cy, 1);
  ctx.fillStyle = css(mix(p.grass, p.grassDark, v * 0.7));
  ctx.fillRect(x, y, t, t);
  // Mottled patches.
  ctx.fillStyle = css(mix(p.grassDark, p.grass, h2(cx, cy, 2)));
  ctx.globalAlpha = 0.35;
  const px = x + h2(cx, cy, 3) * t * 0.6, py = y + h2(cx, cy, 4) * t * 0.6;
  ctx.fillRect(px, py, t * 0.5, t * 0.5);
  ctx.globalAlpha = 1;
  // Blades (a few short strokes).
  ctx.strokeStyle = css(p.blade);
  ctx.lineWidth = 1;
  const blades = 2 + Math.floor(h2(cx, cy, 5) * 3);
  for (let i = 0; i < blades; i++) {
    const bx = x + h2(cx, cy, 6 + i) * (t - 4) + 2;
    const by = y + h2(cx, cy, 10 + i) * (t - 6) + 4;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (h2(cx, cy, 14 + i) - 0.5) * 3, by - 4 - h2(cx, cy, 18 + i) * 3);
    ctx.stroke();
  }
  // The occasional flower/ember-bloom (readable pop of accent, ~4% of tiles).
  if (h2(cx, cy, 22) > 0.96) {
    ctx.fillStyle = css(p.flower);
    const fx = x + 6 + h2(cx, cy, 23) * (t - 12), fy = y + 6 + h2(cx, cy, 24) * (t - 12);
    ctx.beginPath();
    ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPath(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette): void {
  ctx.fillStyle = css(mix(p.path, 0x000000, h2(cx, cy, 1) * 0.18));
  ctx.fillRect(x, y, t, t);
  // Wheel-worn tone bands.
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = css(mix(p.path, 0xffffff, 0.2));
  ctx.fillRect(x, y + t * 0.3, t, 3);
  ctx.globalAlpha = 1;
  // Pebbles.
  const stones = 2 + Math.floor(h2(cx, cy, 2) * 3);
  for (let i = 0; i < stones; i++) {
    const sx = x + h2(cx, cy, 3 + i) * (t - 6) + 3;
    const sy = y + h2(cx, cy, 8 + i) * (t - 6) + 3;
    const r = 1 + h2(cx, cy, 13 + i) * 1.8;
    ctx.fillStyle = css(mix(p.path, 0xffffff, 0.25 + h2(cx, cy, 18 + i) * 0.15));
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(sx + 0.6, sy + 0.8, r * 0.8, Math.PI * 0.1, Math.PI * 0.9);
    ctx.fill();
  }
}

function paintFloor(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette): void {
  ctx.fillStyle = css(mix(p.floor, 0x000000, h2(cx, cy, 1) * 0.16));
  ctx.fillRect(x, y, t, t);
  // Flagstone grout: offset every other row for a laid-stone look.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, t - 1, t - 1);
  const half = cy % 2 === 0 ? t / 2 : t / 3;
  ctx.beginPath();
  ctx.moveTo(x + half, y);
  ctx.lineTo(x + half, y + t);
  ctx.stroke();
  // Highlight the top edge (light from the north).
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, t, 2);
  // The odd crack.
  if (h2(cx, cy, 5) > 0.85) {
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.moveTo(x + t * 0.2, y + t * (0.3 + h2(cx, cy, 6) * 0.4));
    ctx.lineTo(x + t * 0.5, y + t * (0.5 + h2(cx, cy, 7) * 0.3));
    ctx.lineTo(x + t * 0.85, y + t * (0.35 + h2(cx, cy, 8) * 0.4));
    ctx.stroke();
  }
}

function paintWall(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette, openTop: boolean, openBottom: boolean): void {
  ctx.fillStyle = css(mix(p.wall, 0x000000, h2(cx, cy, 1) * 0.22));
  ctx.fillRect(x, y, t, t);
  // Chiseled rock facets.
  for (let i = 0; i < 3; i++) {
    const fx = x + h2(cx, cy, 2 + i) * (t - 10);
    const fy = y + h2(cx, cy, 6 + i) * (t - 8);
    ctx.fillStyle = css(mix(p.wall, i % 2 ? 0xffffff : 0x000000, 0.12 + h2(cx, cy, 10 + i) * 0.1));
    ctx.fillRect(fx, fy, 8 + h2(cx, cy, 14 + i) * 6, 5 + h2(cx, cy, 18 + i) * 4);
  }
  // Pseudo-3D: lit crown where the wall meets open ground above, heavy foot
  // shadow where it meets open ground below.
  if (openTop) {
    ctx.fillStyle = css(mix(p.wall, 0xffffff, 0.28));
    ctx.fillRect(x, y, t, 4);
  }
  if (openBottom) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y + t - 5, t, 5);
  }
}

function paintWater(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette, shoreTop: boolean): void {
  ctx.fillStyle = css(mix(p.water, 0x000000, h2(cx, cy, 1) * 0.25));
  ctx.fillRect(x, y, t, t);
  // Depth gradient + drifting highlight streaks (reads as gentle current;
  // in the ember zones this palette turns it to lava, same physics).
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = css(mix(p.water, 0xffffff, 0.35));
  const wy = y + (h2(cx, cy, 2) * t * 0.7 + 4);
  ctx.fillRect(x + h2(cx, cy, 3) * 8, wy, t * (0.35 + h2(cx, cy, 4) * 0.3), 2);
  ctx.globalAlpha = 1;
  if (shoreTop) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, t, 2);
  }
}

function paintFacade(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number): void {
  // Timber-framed plaster: a building's street-facing wall.
  const plaster = 0x9a8a72;
  const beam = 0x4a3423;
  ctx.fillStyle = css(mix(plaster, 0x000000, h2(cx, cy, 1) * 0.14));
  ctx.fillRect(x, y, t, t);
  // Weathering streaks.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#000";
  ctx.fillRect(x + h2(cx, cy, 2) * (t - 6), y, 4, t);
  ctx.globalAlpha = 1;
  // Timber frame: posts + top beam; some tiles get a cross-brace.
  ctx.fillStyle = css(beam);
  ctx.fillRect(x, y, t, 4);
  ctx.fillRect(x, y, 3.5, t);
  ctx.fillRect(x + t - 3.5, y, 3.5, t);
  if (h2(cx, cy, 3) > 0.5) {
    ctx.save();
    ctx.strokeStyle = css(beam);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 5);
    ctx.lineTo(x + t - 3, y + t - 2);
    ctx.stroke();
    ctx.restore();
  }
  // A small shuttered window on the rest.
  if (h2(cx, cy, 3) <= 0.5 && h2(cx, cy, 4) > 0.35) {
    ctx.fillStyle = "#22190f";
    ctx.fillRect(x + t / 2 - 5, y + 10, 10, 11);
    ctx.fillStyle = "rgba(255,209,102,0.55)"; // lamplit within
    ctx.fillRect(x + t / 2 - 3.5, y + 11.5, 7, 8);
    ctx.strokeStyle = css(beam);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + t / 2 - 5, y + 10, 10, 11);
  }
  // Eave shadow at the foot.
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x, y + t - 4, t, 4);
  // Lit roofline crown.
  ctx.fillStyle = css(mix(beam, 0xffffff, 0.25));
  ctx.fillRect(x, y, t, 1.6);
}

function paintFence(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette): void {
  // Grass shows through beneath a fence line.
  paintGrass(ctx, x, y, t, cx, cy, p);
  const wood = 0x6b4f30;
  ctx.fillStyle = css(mix(wood, 0x000000, 0.2));
  ctx.fillRect(x, y + t / 2 - 3, t, 3); // rail shadow
  ctx.fillStyle = css(wood);
  ctx.fillRect(x, y + t / 2 - 5, t, 3); // rail
  ctx.fillStyle = css(mix(wood, 0x000000, 0.35));
  ctx.fillRect(x + 4, y + 8, 4, t - 14); // posts
  ctx.fillRect(x + t - 8, y + 8, 4, t - 14);
  ctx.fillStyle = css(mix(wood, 0xffffff, 0.2));
  ctx.fillRect(x + 4, y + 8, 4, 2);
  ctx.fillRect(x + t - 8, y + 8, 4, 2);
}

function paintCanopy(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cx: number, cy: number, p: ZonePalette): void {
  // A GRAND canopy: spans ~1.5 tiles so forest rows melt into one painterly
  // mass instead of a grid of broccoli. Trunk hint, three leaf tones lit from
  // the NW, and irregular blob offsets seeded per tree.
  ctx.fillStyle = "rgba(30,20,12,0.9)";
  ctx.fillRect(x - 2.5, y + 4, 5, 9);
  const R = t * 0.78; // canopy reach (overlaps neighbours on purpose)
  const blobs = 7;
  // Dark under-layer.
  for (let i = 0; i < blobs; i++) {
    const a = (Math.PI * 2 * i) / blobs + h2(cx, cy, i) * 0.9;
    const r = R * (0.38 + h2(cx, cy, 8 + i) * 0.2);
    ctx.fillStyle = css(mix(p.canopy, 0x000000, 0.22));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.42 + 2, y + Math.sin(a) * R * 0.38 + 2.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mid tone.
  for (let i = 0; i < blobs; i++) {
    const a = (Math.PI * 2 * i) / blobs + h2(cx, cy, 16 + i) * 0.9;
    const r = R * (0.32 + h2(cx, cy, 24 + i) * 0.18);
    ctx.fillStyle = css(mix(p.canopy, p.canopyLit, h2(cx, cy, 32 + i) * 0.5));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.36, y + Math.sin(a) * R * 0.32, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = css(p.canopy);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // NW light clusters.
  ctx.fillStyle = css(p.canopyLit);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      x - R * 0.22 - h2(cx, cy, 40 + i) * R * 0.18,
      y - R * 0.2 - h2(cx, cy, 44 + i) * R * 0.16,
      R * (0.14 + h2(cx, cy, 48 + i) * 0.1),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,240,0.10)";
  ctx.beginPath();
  ctx.arc(x - R * 0.34, y - R * 0.32, R * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A transparent overlay holding ONLY the water highlight streaks — added
 * above the terrain and drift-tweened by the scene, so rivers and lava seams
 * visibly flow. Returns null when the zone has no water.
 */
export function paintWaterOverlay(scene: Phaser.Scene, map: ZoneMap, zoneId: string): string | null {
  const key = `zone-water-${zoneId}`;
  if (scene.textures.exists(key)) return key;
  const p = paletteFor(zoneId);
  const t = map.tileSize;
  let any = false;
  const tex = scene.textures.createCanvas(key, map.cols * t, map.rows * t)!;
  const ctx = tex.getContext();
  for (let cy = 0; cy < map.rows; cy++) {
    for (let cx = 0; cx < map.cols; cx++) {
      if (map.obstacles[cy * map.cols + cx]! !== WATER) continue;
      any = true;
      const x = cx * t, y = cy * t;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = css(mix(p.water, 0xffffff, 0.5));
      const wy = y + h2(cx, cy, 60) * (t - 6) + 3;
      ctx.fillRect(x + h2(cx, cy, 61) * 10, wy, t * (0.3 + h2(cx, cy, 62) * 0.3), 1.6);
      if (h2(cx, cy, 63) > 0.55) {
        ctx.fillRect(x + h2(cx, cy, 64) * 14, y + h2(cx, cy, 65) * (t - 8) + 4, t * 0.2, 1.4);
      }
    }
  }
  ctx.globalAlpha = 1;
  tex.refresh();
  if (!any) {
    scene.textures.remove(key);
    return null;
  }
  return key;
}

// --- entity + particle textures ------------------------------------------------

/** Draw a soft radial-gradient disc into a canvas texture (light/shadow/glow). */
function softDisc(scene: Phaser.Scene, key: string, size: number, inner: string, outer: string): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

/**
 * Generate every entity + particle texture the scene needs. Idempotent —
 * textures are global to the game, so zone changes reuse them.
 */
export function ensureArtTextures(scene: Phaser.Scene): void {
  softDisc(scene, "fx-shadow", 48, "rgba(0,0,0,0.4)", "rgba(0,0,0,0)");
  softDisc(scene, "fx-glow", 96, "rgba(255,209,102,0.55)", "rgba(255,209,102,0)");
  softDisc(scene, "fx-glow-blue", 96, "rgba(125,211,252,0.5)", "rgba(125,211,252,0)");
  softDisc(scene, "fx-soft", 16, "rgba(255,255,255,0.9)", "rgba(255,255,255,0)");
  softDisc(scene, "fx-vignette-core", 32, "rgba(0,0,0,0)", "rgba(0,0,0,0.8)");

  // Tiny shaped particles.
  if (!scene.textures.exists("fx-spark")) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 0, 2, 6);
    g.fillRect(0, 2, 6, 2);
    g.generateTexture("fx-spark", 6, 6);
    g.destroy();
  }
  if (!scene.textures.exists("fx-leaf")) {
    const g = scene.add.graphics();
    g.fillStyle(0x86b36a, 1);
    g.fillEllipse(3, 4, 5, 8);
    g.generateTexture("fx-leaf", 7, 9);
    g.destroy();
  }

  ensureCharacterTextures(scene);
  ensureMobTextures(scene);
}

/** The hero + other-player puppets: full humanoids — head/hair, armored
 *  torso with shoulder pads, arms, legs, and a sheathed sword — in TWO walk
 *  frames (legs swapped) so movement reads as a real stride. */
function ensureCharacterTextures(scene: Phaser.Scene): void {
  const paintFrame = (
    key: string,
    tunic: number,
    trim: number,
    hair: number,
    stride: number, // -1 | 0 | 1 : left-forward, standing, right-forward
  ): void => {
    if (scene.textures.exists(key)) return;
    const W = 40, H = 46;
    const tex = scene.textures.createCanvas(key, W, H)!;
    const ctx = tex.getContext();
    const cx2 = W / 2;
    const skin = 0xe8c39e;
    const o = (fn: () => void): void => {
      ctx.strokeStyle = "rgba(8,10,14,0.85)";
      ctx.lineWidth = 1.4;
      fn();
    };

    // Legs (dark trousers + boots); stride swings them apart.
    const legY = 32, legH = 9;
    const lOff = stride * 2.6, rOff = -stride * 2.6;
    ctx.fillStyle = css(mix(tunic, 0x000000, 0.62));
    ctx.fillRect(cx2 - 6 + lOff * 0.4, legY, 4.6, legH - Math.abs(lOff) * 0.5);
    ctx.fillRect(cx2 + 1.4 + rOff * 0.4, legY, 4.6, legH - Math.abs(rOff) * 0.5);
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(cx2 - 6.4 + lOff, legY + legH - 3.5, 5.4, 3.5);
    ctx.fillRect(cx2 + 1 + rOff, legY + legH - 3.5, 5.4, 3.5);

    // Sword sheathed at the left hip (reads as "armed hero").
    ctx.save();
    ctx.translate(cx2 - 10, 26);
    ctx.rotate(-0.5);
    ctx.fillStyle = "#c9d2de";
    ctx.fillRect(-1.2, -10, 2.4, 11);
    ctx.fillStyle = css(trim);
    ctx.fillRect(-3, 0, 6, 2);
    ctx.fillStyle = "#6b4f30";
    ctx.fillRect(-1, 2, 2, 4);
    ctx.restore();

    // Torso: tunic with a lit chest plate + belt.
    ctx.fillStyle = css(mix(tunic, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(cx2 - 8.5, 33);
    ctx.quadraticCurveTo(cx2 - 9.5, 20, cx2 - 7, 17);
    ctx.lineTo(cx2 + 7, 17);
    ctx.quadraticCurveTo(cx2 + 9.5, 20, cx2 + 8.5, 33);
    ctx.closePath();
    ctx.fill();
    o(() => ctx.stroke());
    ctx.fillStyle = css(tunic);
    ctx.beginPath();
    ctx.moveTo(cx2 - 7, 31);
    ctx.quadraticCurveTo(cx2 - 8, 20, cx2 - 6, 18);
    ctx.lineTo(cx2 + 6, 18);
    ctx.quadraticCurveTo(cx2 + 8, 20, cx2 + 7, 31);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(mix(tunic, 0xffffff, 0.28));
    ctx.beginPath();
    ctx.moveTo(cx2 - 5.5, 28);
    ctx.quadraticCurveTo(cx2 - 6.5, 20, cx2 - 4, 18.5);
    ctx.lineTo(cx2 - 1, 18.5);
    ctx.quadraticCurveTo(cx2 - 3, 23, cx2 - 3, 28);
    ctx.closePath();
    ctx.fill();
    // Belt + buckle.
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(cx2 - 7.5, 27, 15, 2.6);
    ctx.fillStyle = css(trim);
    ctx.fillRect(cx2 - 1.5, 26.6, 3, 3.4);

    // Arms (swing opposite the legs) + leather gloves.
    const armSwing = stride * 1.8;
    ctx.fillStyle = css(mix(tunic, 0x000000, 0.18));
    ctx.fillRect(cx2 - 10.5, 19 - armSwing * 0.4, 3.4, 9.5);
    ctx.fillRect(cx2 + 7.1, 19 + armSwing * 0.4, 3.4, 9.5);
    ctx.fillStyle = css(skin);
    ctx.fillRect(cx2 - 10.3, 27.5 - armSwing * 0.4, 3, 3);
    ctx.fillRect(cx2 + 7.3, 27.5 + armSwing * 0.4, 3, 3);

    // Shoulder pads (metal, lit).
    ctx.fillStyle = css(mix(trim, 0x000000, 0.25));
    ctx.beginPath();
    ctx.ellipse(cx2 - 8.2, 18.6, 3.6, 2.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx2 + 8.2, 18.6, 3.6, 2.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(mix(trim, 0xffffff, 0.3));
    ctx.beginPath();
    ctx.ellipse(cx2 - 8.6, 17.9, 2, 1.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head: skin, face hints, hair with a lit fringe.
    ctx.fillStyle = css(skin);
    ctx.beginPath();
    ctx.arc(cx2, 10.5, 6, 0, Math.PI * 2);
    ctx.fill();
    o(() => {
      ctx.beginPath();
      ctx.arc(cx2, 10.5, 6, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = "#3b2c20";
    ctx.beginPath();
    ctx.arc(cx2 - 2.2, 11.3, 0.9, 0, Math.PI * 2);
    ctx.arc(cx2 + 2.2, 11.3, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(hair);
    ctx.beginPath();
    ctx.arc(cx2, 8.6, 6.1, Math.PI * 0.95, Math.PI * 2.05);
    ctx.quadraticCurveTo(cx2 + 4, 7.5, cx2 + 2, 6.5);
    ctx.fill();
    ctx.fillStyle = css(mix(hair, 0xffffff, 0.25));
    ctx.beginPath();
    ctx.arc(cx2 - 2.4, 6.4, 2.4, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  };

  const paintSet = (base: string, tunic: number, trim: number, hair: number): void => {
    paintFrame(base, tunic, trim, hair, 0);
    paintFrame(`${base}-w1`, tunic, trim, hair, 1);
    paintFrame(`${base}-w2`, tunic, trim, hair, -1);
  };
  paintSet("char-self", 0x3f9e63, 0xd9a441, 0x6b4a2a);
  paintSet("char-player", 0x4f7ec2, 0x9aa7bd, 0x2f2a26);
  paintSet("char-red", 0xb0433c, 0xd9a441, 0x2f2a26);
  paintSet("char-blue", 0x3f6fb5, 0x9ad0e8, 0x6b4a2a);

  // The elk mount — a horizontal quadruped drawn under the rider.
  if (!scene.textures.exists("mount-elk")) {
    const tex = scene.textures.createCanvas("mount-elk", 52, 30)!;
    const ctx = tex.getContext();
    const body = 0x7a5b3a;
    ctx.fillStyle = css(mix(body, 0x000000, 0.25));
    ctx.beginPath();
    ctx.ellipse(26, 16, 17, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(body);
    ctx.beginPath();
    ctx.ellipse(25, 14.5, 16, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.strokeStyle = css(mix(body, 0x000000, 0.4));
    ctx.lineWidth = 3;
    for (const lx of [14, 20, 32, 38]) {
      ctx.beginPath();
      ctx.moveTo(lx, 20);
      ctx.lineTo(lx - 1, 28);
      ctx.stroke();
    }
    // Head + antlers.
    ctx.fillStyle = css(body);
    ctx.beginPath();
    ctx.ellipse(43, 10, 6, 4.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(mix(body, 0xffffff, 0.35));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(45, 6);
    ctx.lineTo(48, 1);
    ctx.moveTo(46.5, 3.5);
    ctx.lineTo(50, 3);
    ctx.moveTo(43, 6);
    ctx.lineTo(42, 1);
    ctx.stroke();
    tex.refresh();
  }
}

/** One authored silhouette per mob family — unique shapes, shared language. */
function ensureMobTextures(scene: Phaser.Scene): void {
  const done = (k: string): boolean => scene.textures.exists(k);
  const canvas = (k: string, w: number, hgt: number): CanvasRenderingContext2D | null => {
    if (done(k)) return null;
    return scene.textures.createCanvas(k, w, hgt)!.getContext();
  };
  const finish = (k: string): void => {
    (scene.textures.get(k) as Phaser.Textures.CanvasTexture).refresh();
  };
  const outline = (ctx: CanvasRenderingContext2D, fn: () => void): void => {
    ctx.strokeStyle = "rgba(5,7,10,0.85)";
    ctx.lineWidth = 1.5;
    fn();
  };

  // Training dummy: post + crossbar + straw head.
  let ctx = canvas("mob-dummy", 36, 42);
  if (ctx) {
    ctx.fillStyle = "#6b4f30";
    ctx.fillRect(16, 12, 4, 26);
    ctx.fillRect(6, 16, 24, 4);
    ctx.fillStyle = "#8a6a40";
    ctx.fillRect(16, 12, 4, 3);
    ctx.fillStyle = "#c9b26a";
    ctx.beginPath();
    ctx.arc(18, 9, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a68f4c";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(14 + i * 2.5, 4);
      ctx.lineTo(15 + i * 2.5, 1);
      ctx.stroke();
    }
    finish("mob-dummy");
  }

  // Wolf: lean quadruped, ears + tail, pale eyes.
  ctx = canvas("mob-wolf", 46, 30);
  if (ctx) {
    const fur = 0x5a5f6b;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(fur, 0x000000, 0.25));
    ctx.beginPath();
    ctx.ellipse(22, 17, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(fur);
    ctx.beginPath();
    ctx.ellipse(21, 15.5, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail sweep + head + ears.
    ctx.strokeStyle = css(fur);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 14);
    ctx.quadraticCurveTo(1, 10, 3, 4);
    ctx.stroke();
    ctx.fillStyle = css(mix(fur, 0xffffff, 0.12));
    ctx.beginPath();
    ctx.ellipse(37, 12, 7, 5.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(34, 7);
    ctx.lineTo(36, 1);
    ctx.lineTo(39, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, 7);
    ctx.lineTo(43, 2);
    ctx.lineTo(44, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(40, 11, 1.2, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-wolf");
  }

  // Emberling: a living flame — teardrop with a molten core.
  ctx = canvas("mob-emberling", 34, 40);
  if (ctx) {
    const grd = ctx.createLinearGradient(0, 0, 0, 40);
    grd.addColorStop(0, "#f59e0b");
    grd.addColorStop(1, "#b03a12");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(17, 2);
    ctx.quadraticCurveTo(30, 16, 26, 28);
    ctx.quadraticCurveTo(23, 37, 17, 37);
    ctx.quadraticCurveTo(11, 37, 8, 28);
    ctx.quadraticCurveTo(4, 16, 17, 2);
    ctx.fill();
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.moveTo(17, 12);
    ctx.quadraticCurveTo(23, 20, 21, 28);
    ctx.quadraticCurveTo(19, 33, 17, 33);
    ctx.quadraticCurveTo(15, 33, 13, 28);
    ctx.quadraticCurveTo(11, 20, 17, 12);
    ctx.fill();
    ctx.fillStyle = "#3b1d10";
    ctx.beginPath();
    ctx.arc(14, 22, 1.6, 0, Math.PI * 2);
    ctx.arc(20, 22, 1.6, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-emberling");
  }

  // Bandit: hooded figure with a knife glint.
  ctx = canvas("mob-bandit", 36, 42);
  if (ctx) {
    const cloth = 0x74504a;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 38);
    ctx.quadraticCurveTo(5, 18, 18, 12);
    ctx.quadraticCurveTo(31, 18, 29, 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 36);
    ctx.quadraticCurveTo(8, 19, 18, 13);
    ctx.quadraticCurveTo(28, 19, 27, 36);
    ctx.closePath();
    ctx.fill();
    // Hood with shadowed face.
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.15));
    ctx.beginPath();
    ctx.arc(18, 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#120d0b";
    ctx.beginPath();
    ctx.ellipse(18, 11, 4.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e2d0";
    ctx.beginPath();
    ctx.arc(16.4, 10.6, 0.9, 0, Math.PI * 2);
    ctx.arc(19.6, 10.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Knife.
    ctx.strokeStyle = "#cfd6e2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(29, 26);
    ctx.lineTo(34, 21);
    ctx.stroke();
    finish("mob-bandit");
  }

  // Thorn stalker: bristled beast — spiky back ridge. Olive-tan hide with a
  // heavy outline so it NEVER melts into Tanglewood's greens (readability
  // first — this one failed the art review on grass and was repainted).
  ctx = canvas("mob-thorn_stalker", 46, 32);
  if (ctx) {
    const hide = 0x8a9150;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(hide);
    ctx.beginPath();
    ctx.ellipse(23, 19, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(mix(hide, 0x2b1e12, 0.55));
    for (let i = 0; i < 6; i++) {
      const sx = 10 + i * 5;
      ctx.beginPath();
      ctx.moveTo(sx, 14);
      ctx.lineTo(sx + 2.5, 3 + (i % 2) * 3);
      ctx.lineTo(sx + 5, 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = css(mix(hide, 0xffffff, 0.25));
    ctx.beginPath();
    ctx.ellipse(37, 17, 6.5, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff5a4d";
    ctx.beginPath();
    ctx.arc(39, 15.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-thorn_stalker");
  }

  // Ruin sentinel: cracked stone golem with a glowing core.
  ctx = canvas("mob-ruin_sentinel", 40, 44);
  if (ctx) {
    const stone = 0x6a7280;
    ctx.fillStyle = css(mix(stone, 0x000000, 0.25));
    ctx.fillRect(6, 8, 28, 32);
    ctx.fillStyle = css(stone);
    ctx.fillRect(8, 6, 24, 30);
    ctx.fillStyle = css(mix(stone, 0xffffff, 0.18));
    ctx.fillRect(8, 6, 24, 4);
    ctx.fillRect(8, 6, 4, 30);
    // Shoulder blocks.
    ctx.fillStyle = css(mix(stone, 0x000000, 0.12));
    ctx.fillRect(2, 10, 8, 10);
    ctx.fillRect(30, 10, 8, 10);
    // Cracks + core.
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(18, 18);
    ctx.lineTo(15, 26);
    ctx.moveTo(26, 12);
    ctx.lineTo(23, 20);
    ctx.stroke();
    const core = ctx.createRadialGradient(20, 22, 1, 20, 22, 7);
    core.addColorStop(0, "#9ad0e8");
    core.addColorStop(1, "rgba(80,140,180,0)");
    ctx.fillStyle = core;
    ctx.fillRect(12, 14, 16, 16);
    finish("mob-ruin_sentinel");
  }

  // Fen Creeper (P14.5): a bog mound that stood up, ember eyes in the moss.
  ctx = canvas("mob-fen_creeper", 40, 34);
  if (ctx) {
    const moss = 0x5b6a4a;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(moss, 0x000000, 0.3));
    ctx.beginPath();
    ctx.ellipse(20, 20, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(moss);
    ctx.beginPath();
    ctx.ellipse(20, 18, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dripping arms + two ember eyes.
    ctx.fillStyle = css(mix(moss, 0x000000, 0.2));
    ctx.fillRect(5, 20, 4, 9);
    ctx.fillRect(31, 21, 4, 8);
    ctx.fillStyle = css(0xffa04d);
    ctx.beginPath();
    ctx.arc(15, 16, 1.8, 0, Math.PI * 2);
    ctx.arc(24, 16, 1.8, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-fen_creeper");
  }

  // Glass Stalker (P14.5): angular vitrified legs under a thin bright body.
  ctx = canvas("mob-glass_stalker", 44, 34);
  if (ctx) {
    const glass = 0xa8c9c2;
    ctx.strokeStyle = css(mix(glass, 0x000000, 0.45));
    ctx.lineWidth = 2.4;
    ctx.beginPath(); // four bent legs
    ctx.moveTo(8, 30); ctx.lineTo(15, 18); ctx.lineTo(19, 24);
    ctx.moveTo(14, 31); ctx.lineTo(19, 20);
    ctx.moveTo(36, 30); ctx.lineTo(29, 18); ctx.lineTo(25, 24);
    ctx.moveTo(30, 31); ctx.lineTo(25, 20);
    ctx.stroke();
    ctx.fillStyle = css(glass);
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(22, 16, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(0xe8fff8);
    ctx.beginPath();
    ctx.arc(22, 15, 2, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-glass_stalker");
  }

  // Harvest Enforcer (P14.5): the Order's muscle — slate-blue hood, no pick.
  ctx = canvas("mob-harvest_enforcer", 36, 42);
  if (ctx) {
    const cloth = 0x4e5c78;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 38);
    ctx.quadraticCurveTo(5, 18, 18, 12);
    ctx.quadraticCurveTo(31, 18, 29, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 36);
    ctx.quadraticCurveTo(8, 19, 18, 13);
    ctx.quadraticCurveTo(28, 19, 27, 36);
    ctx.closePath();
    ctx.fill();
    // The Order's lamp-sigil at the chest.
    ctx.fillStyle = css(0xffd34d);
    ctx.fillRect(16, 22, 4, 6);
    ctx.strokeStyle = css(0x2a2f3a);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(16, 22, 4, 6);
    finish("mob-harvest_enforcer");
  }

  // The Pyre Admiral (P17.1): a burned coat still standing its watch.
  ctx = canvas("mob-pyre_admiral", 44, 52);
  if (ctx) {
    const coat = 0x3c5560;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(coat, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(8, 48);
    ctx.quadraticCurveTo(6, 20, 22, 12);
    ctx.quadraticCurveTo(38, 20, 36, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(coat);
    ctx.beginPath();
    ctx.moveTo(10, 46);
    ctx.quadraticCurveTo(9, 21, 22, 13);
    ctx.quadraticCurveTo(35, 21, 34, 46);
    ctx.closePath();
    ctx.fill();
    // Charred epaulettes still faintly aglow + the bicorn silhouette.
    ctx.fillStyle = css(0xff8a3c);
    ctx.fillRect(10, 22, 5, 3);
    ctx.fillRect(29, 22, 5, 3);
    ctx.fillStyle = css(mix(coat, 0x000000, 0.45));
    ctx.beginPath();
    ctx.ellipse(22, 10, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // The watch-lantern, held and hollow.
    ctx.fillStyle = css(0xbfe6ff);
    ctx.beginPath();
    ctx.arc(34, 34, 2.6, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-pyre_admiral");
  }

  // Cinder Husk (P16.3): a kindled remnant walking — charcoal, ember seams.
  ctx = canvas("mob-cinder_husk", 38, 46);
  if (ctx) {
    const char = 0x3a2e28;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(char, 0x000000, 0.2));
    ctx.fillRect(8, 8, 22, 34);
    ctx.strokeRect(8, 8, 22, 34);
    ctx.fillStyle = css(char);
    ctx.fillRect(10, 10, 18, 30);
    // Ember seams — the fire that never finished with it.
    ctx.strokeStyle = css(0xff8a3c);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(14, 12); ctx.lineTo(16, 22); ctx.lineTo(13, 32);
    ctx.moveTo(24, 13); ctx.lineTo(22, 24); ctx.lineTo(25, 36);
    ctx.moveTo(18, 26); ctx.lineTo(20, 30);
    ctx.stroke();
    ctx.fillStyle = css(0xffb066);
    ctx.beginPath();
    ctx.arc(19, 17, 2.6, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-cinder_husk");
  }

  // Throne Herald (P16.3): the court's crier — gilt-red hood, crown sigil.
  ctx = canvas("mob-throne_herald", 38, 44);
  if (ctx) {
    const cloth = 0x7a3428;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 40);
    ctx.quadraticCurveTo(5, 18, 19, 12);
    ctx.quadraticCurveTo(33, 18, 31, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 38);
    ctx.quadraticCurveTo(8, 19, 19, 13);
    ctx.quadraticCurveTo(30, 19, 29, 38);
    ctx.closePath();
    ctx.fill();
    // The Molten King's crown sigil at the chest.
    ctx.fillStyle = css(0xe8b13a);
    ctx.beginPath();
    ctx.moveTo(14, 28); ctx.lineTo(16, 23); ctx.lineTo(19, 27);
    ctx.lineTo(22, 23); ctx.lineTo(24, 28); ctx.closePath();
    ctx.fill();
    finish("mob-throne_herald");
  }

  // Court Sentinel (P16.2): the capital's parade construct — marble + gilt.
  ctx = canvas("mob-court_sentinel", 42, 46);
  if (ctx) {
    const stone = 0x8a8078;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(stone, 0x000000, 0.25));
    ctx.fillRect(7, 8, 28, 34);
    ctx.strokeRect(7, 8, 28, 34);
    ctx.fillStyle = css(stone);
    ctx.fillRect(9, 10, 24, 30);
    // Gilt chestplate band + a dead lamp where a face should be.
    ctx.fillStyle = css(0xc9b45a);
    ctx.fillRect(9, 24, 24, 4);
    ctx.fillStyle = css(0x3a352e);
    ctx.beginPath();
    ctx.arc(21, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(0xc9b45a);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    finish("mob-court_sentinel");
  }

  // Archive Warden (P16.2): Order robes gone wrong — gilt hood, lamp sigil.
  ctx = canvas("mob-archive_warden", 36, 42);
  if (ctx) {
    const cloth = 0x6e6247;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 38);
    ctx.quadraticCurveTo(5, 18, 18, 12);
    ctx.quadraticCurveTo(31, 18, 29, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 36);
    ctx.quadraticCurveTo(8, 19, 18, 13);
    ctx.quadraticCurveTo(28, 19, 27, 36);
    ctx.closePath();
    ctx.fill();
    // The Order's lamp-sigil — but LIT, which it should not be.
    ctx.fillStyle = css(0xffd34d);
    ctx.fillRect(16, 22, 4, 6);
    ctx.strokeStyle = css(0x2a2f3a);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(16, 22, 4, 6);
    ctx.fillStyle = css(0xfff3c0);
    ctx.beginPath();
    ctx.arc(18, 25, 1.4, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-archive_warden");
  }

  // Cache-Reaver (P16.1): a cold-weather bandit — furs, hood, pale lamp.
  ctx = canvas("mob-cache_reaver", 36, 42);
  if (ctx) {
    const cloth = 0x556270;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 38);
    ctx.quadraticCurveTo(5, 18, 18, 12);
    ctx.quadraticCurveTo(31, 18, 29, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 36);
    ctx.quadraticCurveTo(8, 19, 18, 13);
    ctx.quadraticCurveTo(28, 19, 27, 36);
    ctx.closePath();
    ctx.fill();
    // Fur ruff at the hood + a cold-blue expedition lamp.
    ctx.strokeStyle = css(0x8a97a5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18, 15, 6, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
    ctx.fillStyle = css(0xbfe6ff);
    ctx.beginPath();
    ctx.arc(26, 30, 2.2, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-cache_reaver");
  }

  // Open-Vein Cutter (P14.4): a hooded digger, slate-clothed, pick on back.
  ctx = canvas("mob-open_vein_cutter", 36, 42);
  if (ctx) {
    const cloth = 0x5c584e;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(cloth, 0x000000, 0.3));
    ctx.beginPath();
    ctx.moveTo(7, 38);
    ctx.quadraticCurveTo(5, 18, 18, 12);
    ctx.quadraticCurveTo(31, 18, 29, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css(cloth);
    ctx.beginPath();
    ctx.moveTo(9, 36);
    ctx.quadraticCurveTo(8, 19, 18, 13);
    ctx.quadraticCurveTo(28, 19, 27, 36);
    ctx.closePath();
    ctx.fill();
    // The pick haft over the shoulder + a lamp at the belt.
    ctx.strokeStyle = css(0x3a332b);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 10);
    ctx.lineTo(31, 26);
    ctx.stroke();
    ctx.fillStyle = css(0xffd34d);
    ctx.beginPath();
    ctx.arc(12, 30, 2.2, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-open_vein_cutter");
  }

  // Deep Echo (P14.4): a cracked stone slab walking, ember light in the seams.
  ctx = canvas("mob-deep_echo", 38, 46);
  if (ctx) {
    const stone = 0x77705f;
    ctx.strokeStyle = "rgba(5,7,10,0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = css(mix(stone, 0x000000, 0.25));
    ctx.fillRect(7, 8, 24, 34);
    ctx.strokeRect(7, 8, 24, 34);
    ctx.fillStyle = css(stone);
    ctx.fillRect(9, 10, 20, 30);
    // Ember veins — the cracked seam's light leaking through.
    ctx.strokeStyle = css(0xff8a3c);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, 12);
    ctx.lineTo(17, 22);
    ctx.lineTo(13, 30);
    ctx.moveTo(24, 14);
    ctx.lineTo(21, 24);
    ctx.lineTo(25, 34);
    ctx.stroke();
    ctx.fillStyle = css(0xffb066);
    ctx.beginPath();
    ctx.arc(19, 18, 2.4, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-deep_echo");
  }

  // The Unreturned (P14.1): lost heat walking — hooded, lantern-pale figures
  // with a guttering inner light. One silhouette, three sizes/glows.
  for (const [kind, w, h, robe, glow] of [
    ["barrow_wisp", 26, 30, 0x9db8c4, 0xd9f2ff],
    ["unreturned_wanderer", 30, 38, 0x8aa6b4, 0xc4e6f5],
    ["marrow_warden", 36, 44, 0x7d9aab, 0xb5dced],
    ["gatewright", 46, 54, 0x6e8fa2, 0xe8fbff],
    ["salt_shade", 32, 40, 0x8fb8bd, 0xd6f4f0],
    ["frost_wight", 30, 38, 0x9eb4c8, 0xe8f6ff],
    ["unreturned_courtier", 32, 40, 0xcfc0a0, 0xfff3d6],
    ["wound_wraith", 36, 44, 0xc97a4a, 0xffd9a8],
    ["beacon_congregant", 34, 42, 0x8296ad, 0xdceeff],
  ] as const) {
    ctx = canvas(`mob-${kind}`, w, h);
    if (ctx) {
      const cx = w / 2;
      ctx.strokeStyle = "rgba(5,7,10,0.9)";
      ctx.lineWidth = 2;
      // Tattered robe: a tapering hooded teardrop that never touches ground.
      ctx.fillStyle = css(mix(robe, 0x000000, 0.35));
      ctx.beginPath();
      ctx.moveTo(cx, 3);
      ctx.quadraticCurveTo(w - 3, h * 0.35, w * 0.72, h - 6);
      ctx.lineTo(w * 0.58, h - 10);
      ctx.lineTo(cx, h - 4);
      ctx.lineTo(w * 0.42, h - 10);
      ctx.lineTo(w * 0.28, h - 6);
      ctx.quadraticCurveTo(3, h * 0.35, cx, 3);
      ctx.fill();
      ctx.stroke();
      // Hood shadow + the guttering spark where a face should be.
      ctx.fillStyle = "rgba(5,7,10,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.26, w * 0.22, h * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(glow);
      ctx.beginPath();
      ctx.arc(cx, h * 0.27, 2.4, 0, Math.PI * 2);
      ctx.fill();
      // A dim chest-ember (the spark that never made it home).
      ctx.fillStyle = css(mix(glow, robe, 0.5));
      ctx.beginPath();
      ctx.arc(cx, h * 0.55, 1.8, 0, Math.PI * 2);
      ctx.fill();
      finish(`mob-${kind}`);
    }
  }

  // Ember wraith: tattered translucent shade.
  ctx = canvas("mob-ember_wraith", 38, 46);
  if (ctx) {
    const grd = ctx.createLinearGradient(0, 0, 0, 46);
    grd.addColorStop(0, "rgba(255,158,94,0.95)");
    grd.addColorStop(1, "rgba(120,50,30,0.15)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(19, 3);
    ctx.quadraticCurveTo(32, 10, 29, 26);
    ctx.lineTo(31, 42);
    ctx.lineTo(25, 34);
    ctx.lineTo(22, 43);
    ctx.lineTo(18, 33);
    ctx.lineTo(13, 43);
    ctx.lineTo(11, 32);
    ctx.lineTo(6, 40);
    ctx.quadraticCurveTo(6, 18, 19, 3);
    ctx.fill();
    ctx.fillStyle = "#2b0f08";
    ctx.beginPath();
    ctx.ellipse(19, 14, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(16.5, 13.5, 1.4, 0, Math.PI * 2);
    ctx.arc(21.5, 13.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    finish("mob-ember_wraith");
  }

  // Bosses share a language: bigger mass, crown/horn features, aura ring is
  // added by EntityView. Painted per kind for unique silhouettes.
  const bossBody = (key: string, base: number, decorate: (c: CanvasRenderingContext2D) => void): void => {
    const c = canvas(key, 56, 60);
    if (!c) return;
    c.fillStyle = css(mix(base, 0x000000, 0.3));
    c.beginPath();
    c.moveTo(10, 54);
    c.quadraticCurveTo(4, 26, 28, 14);
    c.quadraticCurveTo(52, 26, 46, 54);
    c.closePath();
    c.fill();
    c.fillStyle = css(base);
    c.beginPath();
    c.moveTo(13, 52);
    c.quadraticCurveTo(8, 27, 28, 16);
    c.quadraticCurveTo(48, 27, 43, 52);
    c.closePath();
    c.fill();
    c.fillStyle = css(mix(base, 0xffffff, 0.2));
    c.beginPath();
    c.moveTo(15, 44);
    c.quadraticCurveTo(12, 27, 24, 18);
    c.quadraticCurveTo(19, 28, 18, 44);
    c.closePath();
    c.fill();
    decorate(c);
    outline(c, () => {
      c.beginPath();
      c.moveTo(10, 54);
      c.quadraticCurveTo(4, 26, 28, 14);
      c.quadraticCurveTo(52, 26, 46, 54);
      c.stroke();
    });
    finish(key);
  };

  bossBody("mob-warden_of_ash", 0x8a3d24, (c) => {
    // Ash horns + furnace eyes.
    c.strokeStyle = "#d9c9b0";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(18, 16);
    c.quadraticCurveTo(12, 8, 15, 2);
    c.moveTo(38, 16);
    c.quadraticCurveTo(44, 8, 41, 2);
    c.stroke();
    c.fillStyle = "#ffb74a";
    c.beginPath();
    c.arc(23, 26, 2.2, 0, Math.PI * 2);
    c.arc(33, 26, 2.2, 0, Math.PI * 2);
    c.fill();
  });
  bossBody("mob-magmar_broodmother", 0xa14a1c, (c) => {
    // Egg clutch bulges + many eyes.
    c.fillStyle = "rgba(255,190,120,0.5)";
    for (const [ex, ey] of [[20, 40], [30, 44], [38, 38]] as const) {
      c.beginPath();
      c.arc(ex, ey, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#ffd166";
    for (const [ex, ey] of [[22, 24], [28, 21], [34, 24], [25, 28], [31, 28]] as const) {
      c.beginPath();
      c.arc(ex, ey, 1.6, 0, Math.PI * 2);
      c.fill();
    }
  });
  bossBody("mob-obsidian_colossus", 0x3f3f46, (c) => {
    // Faceted obsidian plates.
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(16, 24);
    c.lineTo(28, 30);
    c.lineTo(40, 22);
    c.moveTo(28, 30);
    c.lineTo(28, 48);
    c.stroke();
    c.fillStyle = "#9ad0e8";
    c.beginPath();
    c.arc(24, 25, 2, 0, Math.PI * 2);
    c.arc(33, 25, 2, 0, Math.PI * 2);
    c.fill();
  });
  bossBody("mob-pyre_shade", 0x6d28d9, (c) => {
    // Violet flame crown.
    c.fillStyle = "#c084fc";
    for (let i = 0; i < 4; i++) {
      const fx = 18 + i * 7;
      c.beginPath();
      c.moveTo(fx, 16);
      c.quadraticCurveTo(fx + 2, 6 - (i % 2) * 3, fx + 4, 16);
      c.fill();
    }
    c.fillStyle = "#f5d0fe";
    c.beginPath();
    c.arc(24, 26, 2, 0, Math.PI * 2);
    c.arc(32, 26, 2, 0, Math.PI * 2);
    c.fill();
  });
  bossBody("mob-herald_of_cinders", 0x14b8a6, (c) => {
    // War-banner spine.
    c.strokeStyle = "#0f766e";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(28, 14);
    c.lineTo(28, 0);
    c.stroke();
    c.fillStyle = "#f59e0b";
    c.beginPath();
    c.moveTo(28, 1);
    c.lineTo(42, 5);
    c.lineTo(28, 10);
    c.closePath();
    c.fill();
    c.fillStyle = "#ecfeff";
    c.beginPath();
    c.arc(24, 25, 2, 0, Math.PI * 2);
    c.arc(32, 25, 2, 0, Math.PI * 2);
    c.fill();
  });
  bossBody("mob-molten_king", 0xdc2626, (c) => {
    // The crown.
    c.fillStyle = "#ffd166";
    c.beginPath();
    c.moveTo(17, 15);
    c.lineTo(19, 5);
    c.lineTo(23, 12);
    c.lineTo(28, 3);
    c.lineTo(33, 12);
    c.lineTo(37, 5);
    c.lineTo(39, 15);
    c.closePath();
    c.fill();
    c.fillStyle = "#7f1d1d";
    c.beginPath();
    c.ellipse(28, 27, 8, 4.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fef08a";
    c.beginPath();
    c.arc(24, 26.4, 2, 0, Math.PI * 2);
    c.arc(32, 26.4, 2, 0, Math.PI * 2);
    c.fill();
  });
  bossBody("mob-invasion_herald", 0x0f766e, (c) => {
    c.strokeStyle = "#134e4a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(28, 14);
    c.lineTo(28, 0);
    c.stroke();
    c.fillStyle = "#2dd4bf";
    c.beginPath();
    c.moveTo(28, 1);
    c.lineTo(41, 6);
    c.lineTo(28, 11);
    c.closePath();
    c.fill();
    c.fillStyle = "#ccfbf1";
    c.beginPath();
    c.arc(24, 25, 2, 0, Math.PI * 2);
    c.arc(32, 25, 2, 0, Math.PI * 2);
    c.fill();
  });
}

/** Which generated texture renders a mob kind (fallback: tinted wolf shape). */
export function mobTextureKey(scene: Phaser.Scene, kind: string): string {
  const key = `mob-${kind}`;
  return scene.textures.exists(key) ? key : "mob-wolf";
}

// --- atmosphere -----------------------------------------------------------------

interface Atmosphere {
  /** Ambient particle config, or null for still air. */
  particle: { texture: string; tint: number; lifespan: number; speedY: [number, number]; alpha: number; freq: number } | null;
  vignette: number;
  fog: number;
  fogAlpha: number;
}

const ATMOS: Record<string, Atmosphere> = {
  meadowbrook: { particle: { texture: "fx-soft", tint: 0xfff2b0, lifespan: 9000, speedY: [-6, 6], alpha: 0.16, freq: 900 }, vignette: 0.3, fog: 0xbfd6a8, fogAlpha: 0.035 },
  greenreach: { particle: { texture: "fx-soft", tint: 0xd7f0b0, lifespan: 9000, speedY: [-8, 4], alpha: 0.15, freq: 800 }, vignette: 0.32, fog: 0xa8d6b6, fogAlpha: 0.04 },
  tanglewood: { particle: { texture: "fx-leaf", tint: 0xffffff, lifespan: 8000, speedY: [12, 30], alpha: 0.5, freq: 700 }, vignette: 0.4, fog: 0x39543c, fogAlpha: 0.08 },
  refused_column: { particle: { texture: "fx-soft", tint: 0xb8d4e2, lifespan: 10000, speedY: [4, 12], alpha: 0.22, freq: 1100 }, vignette: 0.55, fog: 0x54646e, fogAlpha: 0.14 },
  vossmere: { particle: { texture: "fx-soft", tint: 0xa9d2d9, lifespan: 8000, speedY: [-16, -6], alpha: 0.24, freq: 800 }, vignette: 0.42, fog: 0x4e6d74, fogAlpha: 0.11 },
  dolmholt: { particle: { texture: "fx-soft", tint: 0xe8f2f8, lifespan: 9000, speedY: [10, 24], alpha: 0.3, freq: 750 }, vignette: 0.44, fog: 0x707c88, fogAlpha: 0.09 },
  cinderfen: { particle: { texture: "fx-soft", tint: 0xd8e8dc, lifespan: 7000, speedY: [-24, -10], alpha: 0.26, freq: 500 }, vignette: 0.46, fog: 0x4e6455, fogAlpha: 0.12 },
  graywastes: { particle: { texture: "fx-soft", tint: 0xeef6fc, lifespan: 8000, speedY: [14, 30], alpha: 0.34, freq: 420 }, vignette: 0.52, fog: 0x8895a2, fogAlpha: 0.13 },
  kindlecourt: { particle: { texture: "fx-soft", tint: 0xf0c890, lifespan: 7000, speedY: [-20, -8], alpha: 0.25, freq: 650 }, vignette: 0.5, fog: 0x6e6257, fogAlpha: 0.1 },
  emberheart_caldera: { particle: { texture: "fx-soft", tint: 0xff9e5e, lifespan: 5000, speedY: [-44, -20], alpha: 0.38, freq: 260 }, vignette: 0.55, fog: 0x5e2f1e, fogAlpha: 0.12 },
  sunken_pyre: { particle: { texture: "fx-soft", tint: 0x9fd4de, lifespan: 9000, speedY: [-14, -4], alpha: 0.22, freq: 900 }, vignette: 0.58, fog: 0x27454e, fogAlpha: 0.15 },
  marrowgate_downs: { particle: { texture: "fx-soft", tint: 0xcfe3ee, lifespan: 9000, speedY: [8, 20], alpha: 0.28, freq: 900 }, vignette: 0.45, fog: 0x6f8290, fogAlpha: 0.1 },
  ashreach: { particle: { texture: "fx-soft", tint: 0xff9e5e, lifespan: 6000, speedY: [-30, -12], alpha: 0.35, freq: 350 }, vignette: 0.45, fog: 0x5e2f1e, fogAlpha: 0.09 },
  cinder_depths: { particle: { texture: "fx-soft", tint: 0xcabdd6, lifespan: 8000, speedY: [-10, 10], alpha: 0.12, freq: 900 }, vignette: 0.55, fog: 0x161320, fogAlpha: 0.14 },
  molten_throne: { particle: { texture: "fx-soft", tint: 0xffb066, lifespan: 5000, speedY: [-40, -18], alpha: 0.4, freq: 260 }, vignette: 0.5, fog: 0x571f14, fogAlpha: 0.1 },
  bg_arena: { particle: { texture: "fx-soft", tint: 0xcfe0f5, lifespan: 7000, speedY: [-8, 8], alpha: 0.12, freq: 1000 }, vignette: 0.4, fog: 0x2b3446, fogAlpha: 0.06 },
};

/**
 * Zone mood: a screen-space vignette, a slow-drifting fog wash, and ambient
 * particles (pollen / leaves / embers / ash) per zone. Everything is fixed to
 * the camera and never blocks input (all overlays are non-interactive).
 */
export function applyAtmosphere(
  scene: Phaser.Scene,
  zoneId: string,
  worldW: number,
  worldH: number,
  particles = true,
): void {
  const a = ATMOS[zoneId] ?? ATMOS["meadowbrook"]!;

  // Vignette: four soft gradient edges (cheap + resolution independent).
  const w = scene.scale.width, hgt = scene.scale.height;
  const vg = scene.add.graphics().setScrollFactor(0).setDepth(900);
  vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, a.vignette, a.vignette, 0, 0);
  vg.fillRect(0, 0, w, Math.round(hgt * 0.22));
  vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, a.vignette, a.vignette);
  vg.fillRect(0, hgt - Math.round(hgt * 0.22), w, Math.round(hgt * 0.22));
  vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, a.vignette, 0, a.vignette, 0);
  vg.fillRect(0, 0, Math.round(w * 0.14), hgt);
  vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, a.vignette, 0, a.vignette);
  vg.fillRect(w - Math.round(w * 0.14), 0, Math.round(w * 0.14), hgt);
  scene.scale.on("resize", () => vg.setVisible(false)); // simplest safe resize behavior

  // Fog wash: a huge soft tint that drifts (world-space, above tiles, below actors).
  const fog = scene.add
    .image(worldW / 2, worldH / 2, "fx-soft")
    .setDisplaySize(worldW * 1.6, worldH * 1.6)
    .setTint(a.fog)
    .setAlpha(a.fogAlpha)
    .setDepth(-6);
  scene.tweens.add({
    targets: fog,
    x: worldW / 2 + 120,
    y: worldH / 2 + 60,
    duration: 24000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Ambient particles across the whole zone (toggleable in Settings).
  if (a.particle && particles) {
    scene.add
      .particles(0, 0, a.particle.texture, {
        x: { min: 0, max: worldW },
        y: { min: 0, max: worldH },
        lifespan: a.particle.lifespan,
        speedY: { min: a.particle.speedY[0], max: a.particle.speedY[1] },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.9, end: 0.2 },
        alpha: { start: a.particle.alpha, end: 0 },
        tint: a.particle.tint,
        frequency: a.particle.freq,
        rotate: a.particle.texture === "fx-leaf" ? { min: 0, max: 360 } : 0,
      })
      .setDepth(-4);
  }
}

/** A pulsing warm glow under a world landmark (waystones, NPCs, forges…). */
export function addLandmarkGlow(scene: Phaser.Scene, x: number, y: number, tint: number, scale = 1): void {
  const glow = scene.add
    .image(x, y, tint === 0x7dd3fc ? "fx-glow-blue" : "fx-glow")
    .setTint(tint)
    .setAlpha(0.5)
    .setScale(scale)
    .setDepth(0)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: 0.28,
    scale: scale * 0.85,
    duration: 1400 + Math.random() * 600,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

// --- combat + feedback VFX ---------------------------------------------------------

/** A quick burst of sparks (hits, crits, gathers). */
export function sparkBurst(scene: Phaser.Scene, x: number, y: number, tint: number, count = 7): void {
  const p = scene.add.particles(x, y, "fx-spark", {
    speed: { min: 60, max: 160 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 200, max: 420 },
    scale: { start: 1, end: 0 },
    tint,
    quantity: count,
    emitting: false,
  });
  p.setDepth(30);
  p.explode(count);
  scene.time.delayedCall(600, () => p.destroy());
}

/** A soft dust puff (deaths, landings, mounts). */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, tint = 0x9c9587): void {
  const p = scene.add.particles(x, y, "fx-soft", {
    speed: { min: 20, max: 70 },
    angle: { min: 200, max: 340 },
    lifespan: { min: 300, max: 650 },
    scale: { start: 1.4, end: 0.2 },
    alpha: { start: 0.5, end: 0 },
    tint,
    quantity: 8,
    emitting: false,
  });
  p.setDepth(30);
  p.explode(8);
  scene.time.delayedCall(800, () => p.destroy());
}

/** The gold level-up fountain. */
export function levelUpBurst(scene: Phaser.Scene, x: number, y: number): void {
  const p = scene.add.particles(x, y, "fx-spark", {
    speed: { min: 80, max: 220 },
    angle: { min: 220, max: 320 },
    gravityY: 300,
    lifespan: { min: 500, max: 900 },
    scale: { start: 1.3, end: 0 },
    tint: [0xffd166, 0xffe8a3, 0xf59e0b],
    quantity: 26,
    emitting: false,
  });
  p.setDepth(40);
  p.explode(26);
  scene.time.delayedCall(1100, () => p.destroy());
}
