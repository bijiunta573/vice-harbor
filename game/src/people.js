// People: the player character on foot and the pedestrians who stroll the sidewalks
// and flee when danger gets close.
import { PLAYER } from './config.js';
import { makeRng, pick, randRange, clamp } from './random.js';
import { collideCircle, roadXs, roadYs } from './world.js';

const PED_COLORS = ['#e17055', '#00b894', '#0984e3', '#6c5ce7', '#d63031', '#e84393', '#fdcb6e', '#00cec9'];

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: 0, health: PLAYER.maxHealth,
    ammo: PLAYER.magazine, reserve: 48, reloading: 0, fireTimer: 0,
    inCar: null, walkCycle: 0, dead: false,
  };
}

export function stepPlayerOnFoot(player, dt, input, world, sprinting) {
  const axis = input.moveAxis();
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.x += axis.x * speed * dt;
  player.y += axis.y * speed * dt;
  if (axis.active) { player.angle = Math.atan2(axis.y, axis.x); player.walkCycle += dt * (sprinting ? 13 : 9); }
  const fixed = collideCircle(world, player.x, player.y, PLAYER.radius);
  player.x = fixed.x; player.y = fixed.y;
  return axis.active;
}

export function spawnPedestrians(rng, count) {
  const peds = [];
  const xs = roadXs(); const ys = roadYs();
  for (let i = 0; i < count; i++) {
    const horiz = rng() < 0.5;
    let x, y, dir;
    if (horiz) { const ry = pick(rng, ys); x = randRange(rng, 90, 3510); y = ry + (rng() < 0.5 ? -62 : 62); dir = rng() < 0.5 ? 1 : -1; }
    else { const rx = pick(rng, xs); x = rx + (rng() < 0.5 ? -62 : 62); y = randRange(rng, 90, 1990); dir = rng() < 0.5 ? 1 : -1; }
    peds.push({
      x, y, horiz, dir, speed: randRange(rng, 42, 78), color: pick(rng, PED_COLORS),
      fleeing: 0, walkCycle: randRange(rng, 0, 6), panic: 0, down: 0,
    });
  }
  return peds;
}

export function updatePedestrian(ped, dt, world, danger) {
  if (ped.down > 0) { ped.down -= dt; return; }
  let speed = ped.speed;
  let dx = ped.horiz ? ped.dir : 0;
  let dy = ped.horiz ? 0 : ped.dir;
  if (danger) {
    const ddx = ped.x - danger.x, ddy = ped.y - danger.y;
    const d = Math.hypot(ddx, ddy);
    if (d < 190) { ped.fleeing = 0.7; ped.panic = 1; dx = ddx / (d || 1); dy = ddy / (d || 1); speed = 215; }
  }
  if (ped.fleeing > 0) ped.fleeing -= dt;
  ped.x += dx * speed * dt; ped.y += dy * speed * dt;
  ped.walkCycle += dt * (speed > 120 ? 14 : 8);
  // Turn around at world edges.
  if (ped.x < 70) { ped.x = 70; ped.dir = 1; ped.horiz = true; }
  if (ped.x > 3530) { ped.x = 3530; ped.dir = -1; ped.horiz = true; }
  if (ped.y < 70) { ped.y = 70; ped.dir = 1; ped.horiz = false; }
  if (ped.y > 2010) { ped.y = 2010; ped.dir = -1; ped.horiz = false; }
  if (ped.fleeing <= 0) {
    const fixed = collideCircle(world, ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
  }
  ped.panic = Math.max(0, ped.panic - dt * 0.5);
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export { clamp };
