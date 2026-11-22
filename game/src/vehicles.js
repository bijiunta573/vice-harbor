// Vehicles: driving physics with drift, parked cars to steal, and traffic AI that
// follows the road grid, brakes for obstacles and honks when blocked.
import { CAR_TYPES } from './config.js';
import { makeRng, pick, randRange, clamp, wrapAngle } from './random.js';
import { roadXs, roadYs, rectsOverlapCar, isWater } from './world.js';

let nextId = 1;
export function makeCar(rng, x, y, angle, opts = {}) {
  const type = opts.type ?? pick(rng, CAR_TYPES);
  return {
    id: nextId++, x, y, angle, speed: 0, steer: 0,
    w: type.w, h: type.h, top: type.top, accel: type.accel,
    color: opts.color ?? pick(rng, type.colors), typeName: type.name,
    parked: !!opts.parked, driver: opts.driver ?? null, // 'traffic' | 'police' | 'player' | null
    health: 100, smoke: 0, honkTimer: randRange(rng, 2, 9),
    laneAxis: opts.laneAxis ?? (rng() < 0.5 ? 'x' : 'y'), laneDir: opts.laneDir ?? (rng() < 0.5 ? 1 : -1),
    targetSpeed: randRange(rng, 120, 200), stuck: 0,
  };
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  const xs = roadXs(); const ys = roadYs();
  for (let i = 0; i < count; i++) {
    const horiz = rng() < 0.5;
    if (horiz) {
      const y = pick(rng, ys); const dir = rng() < 0.5 ? 1 : -1;
      cars.push(makeCar(rng, randRange(rng, 100, 3500), y + dir * 22, dir > 0 ? 0 : Math.PI, { driver: 'traffic', laneAxis: 'x', laneDir: dir }));
    } else {
      const x = pick(rng, xs); const dir = rng() < 0.5 ? 1 : -1;
      cars.push(makeCar(rng, x + dir * 22, randRange(rng, 100, 1900), dir > 0 ? Math.PI / 2 : -Math.PI / 2, { driver: 'traffic', laneAxis: 'y', laneDir: dir }));
    }
  }
  return cars;
}

export function spawnParked(world, rng, count) {
  const cars = [];
  const xs = roadXs(); const ys = roadYs();
  for (let i = 0; i < count; i++) {
    const horiz = rng() < 0.5;
    let x, y, a;
    if (horiz) { const ry = pick(rng, ys); x = randRange(rng, 120, 3480); y = ry + (rng() < 0.5 ? -58 : 58); a = 0; }
    else { const rx = pick(rng, xs); x = rx + (rng() < 0.5 ? -58 : 58); y = randRange(rng, 120, 1980); a = Math.PI / 2; }
    if (rectsOverlapCar(world, x, y, 30, 30)) continue;
    cars.push(makeCar(rng, x, y, a, { parked: true }));
  }
  return cars;
}

export function stepCarPhysics(car, dt, throttle, steerInput, brake) {
  const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) car.speed -= car.accel * 0.7 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 420 * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (!brake && throttle === 0 && Math.abs(car.speed) < 4) car.speed = 0;
  car.speed = clamp(car.speed, -car.top * 0.42, car.top);
  const grip = clamp(1 - Math.abs(car.speed) / (car.top * 3.2), 0.45, 1);
  car.steer = steerInput;
  car.angle += steerInput * (car.speed / 46) * grip * dt * 1.55;
  car.x += fwdX * car.speed * dt + Math.cos(car.angle) * car.speed * dt * 0.0;
  car.y += fwdY * car.speed * dt;
  // Recompute with the new heading for a drift feel: blend velocity direction.
  car.x += Math.cos(car.angle) * car.speed * dt * 0.12;
  car.y += Math.sin(car.angle) * car.speed * dt * 0.12;
  return { fwdX, fwdY };
}

export function collideCarWithWorld(world, car) {
  let hit = false;
  const hw = car.w / 2, hh = car.h / 2;
  if (car.x < hw) { car.x = hw; hit = true; }
  if (car.y < hh) { car.y = hh; hit = true; }
  if (car.x > 3600 - hw) { car.x = 3600 - hw; hit = true; }
  if (car.y > 2600 - hh) { car.y = 2600 - hh; hit = true; }
  const c = rectsOverlapCar(world, car.x, car.y, hw * 0.82, hh * 0.9);
  if (c) {
    const left = Math.abs(car.x + hw * 0.82 - c.x), right = Math.abs(c.x + c.w - (car.x - hw * 0.82));
    const top = Math.abs(car.y + hh * 0.9 - c.y), bot = Math.abs(c.y + c.h - (car.y - hh * 0.9));
    const m = Math.min(left, right, top, bot);
    if (m === left) car.x = c.x - hw * 0.82; else if (m === right) car.x = c.x + c.w + hw * 0.82;
    else if (m === top) car.y = c.y - hh * 0.9; else car.y = c.y + c.h + hh * 0.9;
    hit = true;
  }
  if (isWater(car.x, car.y) && car.y > 2440) { car.y = 2440; hit = true; }
  if (hit && Math.abs(car.speed) > 60) { car.health -= Math.abs(car.speed) * 0.05; car.smoke = 1; }
  if (hit) car.speed *= -0.25;
  return hit;
}

export function updateTrafficCar(car, dt, world, allCars, playerPos, events) {
  // Follow lane; at intersections sometimes turn onto the crossing road.
  const aheadX = car.x + Math.cos(car.angle) * 74;
  const aheadY = car.y + Math.sin(car.angle) * 74;
  let blocked = false;
  for (const other of allCars) {
    if (other === car) continue;
    const dx = other.x - aheadX, dy = other.y - aheadY;
    if (dx * dx + dy * dy < 42 * 42) { blocked = true; break; }
  }
  if (!blocked && playerPos) {
    const dx = playerPos.x - aheadX, dy = playerPos.y - aheadY;
    if (dx * dx + dy * dy < 40 * 40) blocked = true;
  }
  let throttle = 0, brake = false;
  if (blocked) {
    brake = Math.abs(car.speed) > 12;
    car.honkTimer -= dt;
    if (car.honkTimer <= 0) { car.honkTimer = randRange(Math.random, 1.5, 4); events.push({ kind: 'honk', x: car.x, y: car.y }); }
    car.stuck += dt;
  } else {
    car.stuck = 0;
    throttle = car.speed < car.targetSpeed ? 0.75 : 0;
    if (car.speed > car.targetSpeed + 24) brake = true;
  }
  // Intersection turning.
  const xs = roadXs(); const ys = roadYs();
  if (car.laneAxis === 'x') {
    for (const rx of xs) {
      if (Math.abs(car.x - rx) < 8 && Math.abs(car.speed) > 20 && Math.random() < 0.006) {
        car.laneAxis = 'y'; car.laneDir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = rx + car.laneDir * 22;
      }
    }
  } else {
    for (const ry of ys) {
      if (Math.abs(car.y - ry) < 8 && Math.abs(car.speed) > 20 && Math.random() < 0.006) {
        car.laneAxis = 'x'; car.laneDir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.laneDir > 0 ? 0 : Math.PI;
        car.y = ry + car.laneDir * 22;
      }
    }
  }
  // Keep to the lane offset.
  if (car.laneAxis === 'x') {
    let best = null, bd = 1e9;
    for (const ry of ys) { const d = Math.abs(car.y - ry); if (d < bd) { bd = d; best = ry; } }
    if (best !== null) car.y += clamp((best + car.laneDir * 22) - car.y, -60 * dt, 60 * dt);
  } else {
    let best = null, bd = 1e9;
    for (const rx of xs) { const d = Math.abs(car.x - rx); if (d < bd) { bd = d; best = rx; } }
    if (best !== null) car.x += clamp((best + car.laneDir * 22) - car.x, -60 * dt, 60 * dt);
  }
  const want = car.laneAxis === 'x' ? (car.laneDir > 0 ? 0 : Math.PI) : (car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.angle += wrapAngle(want - car.angle) * Math.min(1, dt * 3);
  stepCarPhysics(car, dt, throttle, 0, brake);
  collideCarWithWorld(world, car);
  if (car.x < 70 || car.x > 3530 || car.y < 70 || car.y > 2000) {
    // Recycle far-out traffic back onto a road.
    car.x = clamp(car.x, 90, 3510); car.y = clamp(car.y, 90, 1980);
    if (car.laneAxis === 'x') car.angle = car.laneDir > 0 ? 0 : Math.PI; else car.angle = car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}
