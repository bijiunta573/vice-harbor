// Wanted system and police AI: heat builds from witnessed crimes, stars follow heat,
// cruisers spawn in proportion to stars and pursue; officers on foot close in near
// the player; staying hidden lets the heat cool off. Busted when an officer holds
// the player at close range; wasted when health runs out.
import { WANTED } from './config.js';
import { clamp, wrapAngle, dist } from './random.js';
import { makeCar, stepCarPhysics, collideCarWithWorld } from './vehicles.js';
import { collideCircle } from './world.js';

export function makeWanted() {
  return { heat: 0, stars: 0, seenTimer: 0, hiddenTimer: 0, bustTimer: 0 };
}

export function addHeat(wanted, amount) {
  wanted.heat = clamp(wanted.heat + amount, 0, WANTED.heatForStar * WANTED.maxStars);
  wanted.stars = Math.min(WANTED.maxStars, Math.floor(wanted.heat / WANTED.heatForStar) + (wanted.heat > 0 ? 1 : 0));
  if (wanted.heat <= 0) wanted.stars = 0;
}

export function updateWanted(wanted, dt, playerVisibleToPolice) {
  if (playerVisibleToPolice) { wanted.seenTimer = 0; wanted.hiddenTimer = 0; }
  else {
    wanted.hiddenTimer += dt; wanted.seenTimer += dt;
    if (wanted.hiddenTimer > WANTED.decayDelay && wanted.heat > 0) {
      wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
      wanted.stars = wanted.heat <= 0 ? 0 : Math.min(WANTED.maxStars, Math.floor(wanted.heat / WANTED.heatForStar) + 1);
    }
  }
}

export function wantedCruiserTarget(stars) { return stars === 0 ? 0 : 1 + stars; }

export function spawnCruiser(rng, world, player, existing) {
  // Spawn off-screen on a road near the player.
  for (let tries = 0; tries < 12; tries++) {
    const a = rng() * Math.PI * 2;
    const x = clamp(player.x + Math.cos(a) * 620, 80, 3520);
    const y = clamp(player.y + Math.sin(a) * 620, 80, 2000);
    if (existing.some((c) => dist(c.x, c.y, x, y) < 90)) continue;
    const car = makeCar(rng, x, y, a + Math.PI, { driver: 'police', color: '#eef2f5' });
    car.typeName = 'Cruiser'; car.top = 345; car.accel = 285; car.isPolice = true;
    return car;
  }
  return null;
}

export function updateCruiser(car, dt, world, target) {
  const dx = target.x - car.x, dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  const diff = wrapAngle(want - car.angle);
  const steer = clamp(diff * 1.6, -1, 1);
  const d = Math.hypot(dx, dy);
  let throttle = 1;
  if (Math.abs(diff) > 2.4) throttle = -0.6; // reverse out of a bad angle
  if (d < 60) throttle = 0.35;
  stepCarPhysics(car, dt, throttle, steer, false);
  collideCarWithWorld(world, car);
  return d;
}

export function makeOfficer(x, y) {
  return { x, y, speed: 196, walkCycle: 0, shootTimer: 1.2, active: true };
}

export function updateOfficer(officer, dt, world, player, events) {
  const d = dist(officer.x, officer.y, player.x, player.y);
  if (d > 46) {
    const a = Math.atan2(player.y - officer.y, player.x - officer.x);
    officer.x += Math.cos(a) * officer.speed * dt;
    officer.y += Math.sin(a) * officer.speed * dt;
    officer.walkCycle += dt * 11;
    const f = collideCircle(world, officer.x, officer.y, 11);
    officer.x = f.x; officer.y = f.y;
  }
  officer.shootTimer -= dt;
  if (d < 300 && d > 40 && officer.shootTimer <= 0) {
    officer.shootTimer = 0.9 + Math.random() * 0.7;
    events.push({ kind: 'officerShot', x: officer.x, y: officer.y, tx: player.x, ty: player.y, hit: Math.random() < 0.55 });
  }
  return d;
}
