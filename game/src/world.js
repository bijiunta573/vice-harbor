// City generation for Vice Harbor: a seeded coastal grid of roads, blocks, buildings,
// palms, parks, a beach and a working harbor. Produces collision data and spawn points.
import { WORLD_W, WORLD_H, BLOCK, TILE_ROAD, DISTRICTS } from './config.js';
import { makeRng, pick, randInt, randRange } from './random.js';

export const WATER_Y = 2180; // south of this line is harbor water / beach edge
export const BEACH_Y = 2060;

const BUILDING_COLORS = ['#f4e3c1', '#e8b4b8', '#a8d8ea', '#f7d794', '#dfe6e9', '#fab1a0', '#81ecec', '#ffeaa7', '#d6a2e0', '#fdcb6e'];
const NEON = ['#ff5da2', '#3ee6c4', '#ffd23f', '#54a0ff', '#ff7f50', '#c56cf0'];

export function roadXs() { const xs = []; for (let x = BLOCK / 2; x < WORLD_W; x += BLOCK) xs.push(x); return xs; }
export function roadYs() { const ys = []; for (let y = BLOCK / 2; y < BEACH_Y; y += BLOCK) ys.push(y); return ys; }

export function isOnRoad(x, y) {
  if (y >= BEACH_Y) return false;
  for (const rx of roadXs()) if (Math.abs(x - rx) < TILE_ROAD / 2) return true;
  for (const ry of roadYs()) if (Math.abs(y - ry) < TILE_ROAD / 2) return true;
  return false;
}
export function isWater(x, y) { return y >= WATER_Y; }
export function isSand(x, y) { return y >= BEACH_Y && y < WATER_Y; }

export function buildWorld(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const buildings = [];
  const palms = [];
  const props = [];
  const xs = roadXs(); const ys = roadYs();
  // Blocks sit between roads; each block holds 1-4 buildings or becomes a park.
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + TILE_ROAD / 2 + 14;
      const y0 = ys[bj] + TILE_ROAD / 2 + 14;
      const bw = BLOCK - TILE_ROAD - 28;
      const bh = BLOCK - TILE_ROAD - 28;
      const roll = rng();
      if (roll < 0.14) { // park block
        props.push({ kind: 'park', x: x0, y: y0, w: bw, h: bh });
        for (let t = 0; t < 9; t++) palms.push({ x: x0 + rng() * bw, y: y0 + rng() * bh, s: randRange(rng, 0.8, 1.3) });
        continue;
      }
      const cols = roll < 0.5 ? 1 : 2; const rows = roll < 0.72 ? 1 : 2;
      for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
        const w = bw / cols - 16, h = bh / rows - 16;
        const bx = x0 + cx * (bw / cols) + 8, by = y0 + cy * (bh / rows) + 8;
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, BUILDING_COLORS),
          floors: randInt(rng, 2, 9),
          neon: rng() < 0.4 ? pick(rng, NEON) : null,
          sign: pick(rng, ['HOTEL', 'CAFE', 'BAR', 'SHOP', 'GYM', 'CLUB', 'DELI', 'SPA', '']),
          seed: rng() * 1000,
        });
      }
      if (rng() < 0.6) palms.push({ x: x0 - 6, y: y0 + rng() * bh, s: randRange(rng, 0.8, 1.2) });
    }
  }
  // Palm boulevards along the beach road and harbor piers.
  for (let x = 120; x < WORLD_W - 80; x += 130) palms.push({ x: x + randRange(rng, -14, 14), y: BEACH_Y - 26, s: randRange(rng, 1, 1.45) });
  const piers = [];
  for (let i = 0; i < 5; i++) {
    const px = 420 + i * 680;
    piers.push({ x: px, y: WATER_Y, w: 90, h: 260 });
    props.push({ kind: 'boat', x: px + 130, y: WATER_Y + 60 + rng() * 120, a: rng() * 0.6 - 0.3, color: pick(rng, BUILDING_COLORS) });
    props.push({ kind: 'boat', x: px - 90, y: WATER_Y + 40 + rng() * 140, a: rng() * 0.6 - 0.3, color: pick(rng, BUILDING_COLORS) });
  }
  // Bridges over the harbor inlet on the east side.
  props.push({ kind: 'bridge', x: 3060, y: WATER_Y - 40, w: 340, h: 300 });
  const colliders = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  return {
    seed, buildings, palms, props, piers, colliders,
    districts: DISTRICTS,
    playerSpawn: { x: xs[1], y: ys[1] + 90 },
    chopShop: { x: xs[xs.length - 2] + 120, y: ys[0] + 60 },
    dockPoint: { x: 420 + 45, y: BEACH_Y + 40 },
    packages: Array.from({ length: 12 }, () => {
      for (let tries = 0; tries < 40; tries++) {
        const x = randRange(rng, 120, WORLD_W - 120), y = randRange(rng, 120, BEACH_Y - 60);
        if (!colliders.some((c) => x > c.x - 20 && x < c.x + c.w + 20 && y > c.y - 20 && y < c.y + c.h + 20)) return { x, y, taken: false };
      }
      return { x: 300, y: 300, taken: false };
    }),
    healthPickups: [
      { x: xs[2], y: ys[2], active: true }, { x: xs[4] + 90, y: ys[1], active: true },
      { x: xs[1] + 90, y: ys[3], active: true }, { x: xs[5], y: ys[3] + 80, active: true },
    ],
  };
}

export function collideCircle(world, x, y, r) {
  // Returns corrected position after pushing a circle out of building rects and world bounds.
  let nx = Math.max(r, Math.min(WORLD_W - r, x));
  let ny = Math.max(r, Math.min(WORLD_H - r, y));
  for (const c of world.colliders) {
    const cx = Math.max(c.x, Math.min(nx, c.x + c.w));
    const cy = Math.max(c.y, Math.min(ny, c.y + c.h));
    const dx = nx - cx, dy = ny - cy; const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { ny = c.y - r; continue; }
      const d = Math.sqrt(d2); nx = cx + (dx / d) * r; ny = cy + (dy / d) * r;
    }
  }
  return { x: nx, y: ny };
}

export function rectsOverlapCar(world, x, y, hw, hh) {
  for (const c of world.colliders) {
    if (x + hw > c.x && x - hw < c.x + c.w && y + hh > c.y && y - hh < c.y + c.h) return c;
  }
  return null;
}
