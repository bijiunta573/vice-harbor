// Vice Harbor — boot, state machine, game loop, combat, crime, saves and the
// screenshot staging hooks (?shot= and ?seed=). Everything ties together here.
import { VIEW_W, VIEW_H, PLAYER, SAVE_KEY } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildWorld, isOnRoad } from './world.js';
import { spawnTraffic, spawnParked, stepCarPhysics, collideCarWithWorld, updateTrafficCar } from './vehicles.js';
import { makePlayer, stepPlayerOnFoot, spawnPedestrians, updatePedestrian, nearestCar } from './people.js';
import { makeWanted, addHeat, updateWanted, wantedCruiserTarget, spawnCruiser, updateCruiser, makeOfficer, updateOfficer } from './police.js';
import { makeMissionState, startNextMission, objectiveText, missionMarker, advanceStage, currentStage } from './missions.js';
import { makeCamera, updateCamera, addShake, renderScene, spawnParticle, updateParticles } from './render.js';
import { drawHUD } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '7', 10) || 7;
const SHOT = params.get('shot');

const rng = makeRng(SEED * 131 + 5);
const world = buildWorld(SEED);
const input = new Input(canvas);
const sound = new SoundBank();

const state = {
  mode: 'menu', // menu | playing | paused | wasted | busted
  world, camera: makeCamera(),
  player: makePlayer(world.playerSpawn.x, world.playerSpawn.y),
  cars: [], peds: [], officers: [], particles: [], tracers: [],
  wanted: makeWanted(), missions: makeMissionState(),
  cash: 250, time: 0, aimAngle: 0, prompt: '', toast: '', toastTimer: 0,
  marker: null, chopMarker: { x: world.chopShop.x, y: world.chopShop.y },
  objective: '', districtName: '', chopCarId: null, endTimer: 0, menuPulse: 0,
  hasSave: false, muted: false,
};
state.cars.push(...spawnTraffic(world, rng, 15), ...spawnParked(world, rng, 17));
state.peds.push(...spawnPedestrians(rng, 26));
state.hasSave = !!localStorage.getItem(SAVE_KEY);
state.marker = missionMarker(state.missions);

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, missionIndex: state.missions.index,
      packages: world.packages.map((p) => p.taken),
      x: state.player.x, y: state.player.y, storyComplete: state.missions.storyComplete,
      chop: state.missions.chopDeliveries, found: state.missions.packagesFound,
    }));
  } catch { /* storage unavailable */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.cash = s.cash | 0;
    state.missions.index = s.missionIndex | 0;
    state.missions.storyComplete = !!s.storyComplete;
    state.missions.chopDeliveries = s.chop | 0;
    state.missions.packagesFound = s.found | 0;
    (s.packages || []).forEach((t, i) => { if (world.packages[i]) world.packages[i].taken = !!t; });
    state.player.x = s.x || world.playerSpawn.x; state.player.y = s.y || world.playerSpawn.y;
    state.marker = missionMarker(state.missions);
    return true;
  } catch { return false; }
}

function toast(msg, secs = 2.6) { state.toast = msg; state.toastTimer = secs; }
function cashPopup(x, y, amount, label) {
  state.cash += amount;
  spawnParticle(state.particles, { x, y: y - 24, vx: 0, vy: -34, life: 1.3, maxLife: 1.3, color: '#7bed6a', text: '+$' + amount + (label ? ' ' + label : '') });
  sound.cash();
}
function crime(amount, x, y) { addHeat(state.wanted, amount); }

function respawn() {
  const p = state.player;
  p.health = PLAYER.maxHealth; p.inCar = null; p.ammo = PLAYER.magazine; p.reserve = 48;
  p.x = world.playerSpawn.x; p.y = world.playerSpawn.y;
  state.wanted.heat = 0; state.wanted.stars = 0;
  state.officers.length = 0;
  state.cars = state.cars.filter((c) => !c.isPolice);
  state.mode = 'playing';
  saveGame();
}

function startRun(fresh) {
  sound.ensure();
  if (!fresh) loadGame();
  state.mode = 'playing';
  state.missions.dialogue = ['Marisol Vega works the docks of Vice Harbor — and she is hiring.',
    'Find the gold marker. Press Enter to take the job. Steal cars, dodge the VHPD, get paid.'];
  state.missions.dialogueTimer = 8;
}

// ---------- shooting ----------
function tryShoot() {
  const p = state.player;
  if (p.inCar || p.reloading > 0 || p.fireTimer > 0) return;
  if (p.ammo <= 0) { sound.reload(); startReload(); return; }
  p.ammo -= 1; p.fireTimer = PLAYER.fireCooldown;
  sound.shot();
  crime(16, p.x, p.y);
  if (state.missions.active) state.missions.active.noiseDone = true;
  const range = 430;
  const tx = p.x + Math.cos(state.aimAngle) * range, ty = p.y + Math.sin(state.aimAngle) * range;
  let hx = tx, hy = ty, hitSomething = false;
  // Pedestrian hit?
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const d = Math.abs((ped.x - p.x) * Math.sin(state.aimAngle) - (ped.y - p.y) * Math.cos(state.aimAngle));
    const along = (ped.x - p.x) * Math.cos(state.aimAngle) + (ped.y - p.y) * Math.sin(state.aimAngle);
    if (d < 15 && along > 0 && along < range) { ped.down = 4; crime(55, p.x, p.y); hx = ped.x; hy = ped.y; hitSomething = true; break; }
  }
  if (!hitSomething) for (const car of state.cars) {
    const along = (car.x - p.x) * Math.cos(state.aimAngle) + (car.y - p.y) * Math.sin(state.aimAngle);
    const d = Math.abs((car.x - p.x) * Math.sin(state.aimAngle) - (car.y - p.y) * Math.cos(state.aimAngle));
    if (d < 30 && along > 0 && along < range) { car.health -= PLAYER.pistolDamage; hx = car.x; hy = car.y; hitSomething = true; spawnParticle(state.particles, { x: hx, y: hy, vx: 20, vy: -20, color: '#ffd23f', size: 3 }); break; }
  }
  state.tracers.push({ x1: p.x, y1: p.y, x2: hx, y2: hy, life: 0.07 });
  spawnParticle(state.particles, { x: p.x + Math.cos(state.aimAngle) * 20, y: p.y + Math.sin(state.aimAngle) * 20, vx: 0, vy: 0, color: '#ffe9a3', size: 5, life: 0.08, maxLife: 0.08 });
}
function startReload() {
  const p = state.player;
  if (p.reloading > 0 || p.ammo === PLAYER.magazine || p.reserve <= 0) return;
  p.reloading = PLAYER.reloadTime; sound.reload();
}

// ---------- vehicles ----------
function enterExitCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x - Math.sin(car.angle) * 30; p.y = car.y + Math.cos(car.angle) * 30;
    car.driver = car.wasTraffic ? 'traffic' : null; car.parked = !car.wasTraffic;
    p.inCar = null; sound.blip(300, 0.08, 'square', 0.12);
    return;
  }
  const car = nearestCar(state.cars, p.x, p.y, 56);
  if (!car) return;
  if (car.driver === 'traffic') { crime(34, p.x, p.y); toast('Carjacked! The VHPD noticed.'); }
  else if (!car.isPolice) crime(10, p.x, p.y);
  else crime(60, p.x, p.y);
  car.wasTraffic = car.driver === 'traffic';
  car.driver = 'player'; car.parked = false;
  p.inCar = car;
  sound.blip(420, 0.08, 'square', 0.12);
}

// ---------- per-frame update ----------
function update(dt) {
  state.time += dt;
  const p = state.player;
  const m = state.missions;
  if (m.dialogueTimer > 0) m.dialogueTimer -= dt;
  if (m.bannerTimer > 0) m.bannerTimer -= dt;
  if (state.toastTimer > 0) { state.toastTimer -= dt; if (state.toastTimer <= 0) state.toast = ''; }
  for (const tr of state.tracers) tr.life -= dt;
  state.tracers = state.tracers.filter((t) => t.life > 0);
  updateParticles(state.particles, dt);

  state.aimAngle = Math.atan2(input.mouseY + state.camera.y - p.y, input.mouseX + state.camera.x - p.x);
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = PLAYER.magazine - p.ammo; const take = Math.min(need, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
  }

  const events = [];
  // Player movement / driving.
  let speedRatio = 0;
  if (p.inCar) {
    const car = p.inCar;
    let throttle = 0, steer = 0, brake = false;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle = 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle = -1;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer = -1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer = 1;
    if (input.down('Space')) brake = true;
    const before = Math.abs(car.speed);
    stepCarPhysics(car, dt, throttle, steer, brake);
    const hitWall = collideCarWithWorld(world, car);
    if (hitWall && before > 130) { addShake(state.camera, 7); sound.crash(); p.health -= 4; crime(10, car.x, car.y); }
    if (Math.abs(car.speed) > 190 && (steer !== 0)) {
      spawnParticle(state.particles, { x: car.x - Math.cos(car.angle) * 22, y: car.y - Math.sin(car.angle) * 22, vx: (Math.random() - 0.5) * 22, vy: (Math.random() - 0.5) * 22, color: '#dddddd', size: 6 });
    }
    // Running over a pedestrian is a serious crime.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (Math.abs(car.speed) > 60 && dist(car.x, car.y, ped.x, ped.y) < 30) { ped.down = 5; crime(60, car.x, car.y); addShake(state.camera, 4); sound.crash(); }
    }
    // Collisions with other cars.
    for (const other of state.cars) {
      if (other === car) continue;
      if (dist(car.x, car.y, other.x, other.y) < 44) {
        other.speed += car.speed * 0.3; car.speed *= 0.55;
        if (Math.abs(car.speed) > 50) { crime(14, car.x, car.y); sound.crash(); addShake(state.camera, 3); }
        spawnParticle(state.particles, { x: (car.x + other.x) / 2, y: (car.y + other.y) / 2, vx: 26, vy: -14, color: '#ffb84d', size: 4 });
      }
    }
    p.x = car.x; p.y = car.y;
    speedRatio = car.speed / car.top;
    sound.setEngine(speedRatio, true);
  } else {
    sound.setEngine(0, false);
    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    stepPlayerOnFoot(p, dt, input, world, sprinting);
    if (input.mouseDown || input.down('Space')) tryShoot();
    if (input.hit('KeyR')) startReload();
  }
  if (input.hit('KeyE')) enterExitCar();
  if (input.hit('KeyM')) { state.muted = sound.toggleMute(); toast(state.muted ? 'Sound muted (M)' : 'Sound on (M)'); }

  // Traffic.
  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, dt, world, state.cars, p, events);
  }
  for (const e of events) if (e.kind === 'honk' && dist(e.x, e.y, p.x, p.y) < 320) sound.honk();

  // Pedestrians react to a fast car, gunfire or a wanted player nearby.
  const danger = (state.wanted.stars > 0 || (p.inCar && Math.abs(p.inCar.speed) > 150)) ? p : (p.fireTimer > -0.5 && state.lastShotAt && state.time - state.lastShotAt < 2 ? p : null);
  for (const ped of state.peds) updatePedestrian(ped, dt, world, danger);

  // Wanted + police.
  const policeNear = state.cars.some((c) => c.isPolice && dist(c.x, c.y, p.x, p.y) < 430) || state.officers.some((o) => dist(o.x, o.y, p.x, p.y) < 300);
  // Heat only cools while no police unit is near; updateWanted tracks the hidden timer.
  updateWanted(state.wanted, dt, policeNear);
  const wantCruisers = wantedCruiserTarget(state.wanted.stars);
  const cruisers = state.cars.filter((c) => c.isPolice);
  if (cruisers.length < wantCruisers) {
    const c = spawnCruiser(rng, world, p, state.cars);
    if (c) state.cars.push(c);
  } else if (cruisers.length > wantCruisers + 1) {
    const far = cruisers.find((c) => dist(c.x, c.y, p.x, p.y) > 900);
    if (far) state.cars.splice(state.cars.indexOf(far), 1);
  }
  for (const car of state.cars) if (car.isPolice && car.driver !== 'player') updateCruiser(car, dt, world, p);
  sound.setSiren(cruisers.length > 0 && state.wanted.stars > 0, state.time);
  // Officers on foot when police are close and player is on foot.
  if (!p.inCar && state.wanted.stars >= 1 && state.officers.length < state.wanted.stars && Math.random() < dt * 0.7) {
    const a = Math.random() * Math.PI * 2;
    state.officers.push(makeOfficer(clamp(p.x + Math.cos(a) * 330, 40, 3560), clamp(p.y + Math.sin(a) * 330, 40, 2540)));
  }
  const officerEvents = [];
  let busting = false;
  for (let i = state.officers.length - 1; i >= 0; i--) {
    const off = state.officers[i];
    if (dist(off.x, off.y, p.x, p.y) > 760 || state.wanted.stars === 0) { state.officers.splice(i, 1); continue; }
    const d = updateOfficer(off, dt, world, p, officerEvents);
    if (d < 30 && !p.inCar) busting = true;
  }
  for (const e of officerEvents) {
    sound.shot();
    state.tracers.push({ x1: e.x, y1: e.y, x2: e.tx, y2: e.ty, life: 0.07 });
    if (e.hit) { p.health -= 6; sound.hurt(); addShake(state.camera, 2.5); }
  }
  if (busting) {
    state.wanted.bustTimer += dt;
    state.prompt = 'THE VHPD IS ON YOU — break free!';
    if (state.wanted.bustTimer > 1.6) { state.mode = 'busted'; state.endTimer = 0; state.cash = Math.max(0, state.cash - 200); sound.fail(); }
  } else state.wanted.bustTimer = Math.max(0, state.wanted.bustTimer - dt * 2);

  // Pickups.
  for (const pk of world.packages) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 30) { pk.taken = true; m.packagesFound += 1; cashPopup(pk.x, pk.y, 100, 'package'); sound.pickup(); saveGame(); }
  }
  for (const hp of world.healthPickups) {
    if (hp.active && dist(p.x, p.y, hp.x, hp.y) < 30 && p.health < PLAYER.maxHealth) { hp.active = false; p.health = Math.min(PLAYER.maxHealth, p.health + 40); toast('+40 health'); sound.pickup(); setTimeout(() => { hp.active = true; }, 20000); }
  }

  // Missions.
  state.marker = missionMarker(m);
  const stage = currentStage(m);
  if (input.hit('Enter') && !m.active && !m.storyComplete) {
    const mk = state.marker;
    if (mk && dist(p.x, p.y, mk.x, mk.y) < 90) { startNextMission(m, world); sound.pickup(); }
  }
  if (m.active && stage) {
    if (stage.kind === 'timed') {
      m.active.timer -= dt;
      if (m.active.timer <= 0) { m.active = null; m.dialogue = ['The job fell through. Come back and try again.']; m.dialogueTimer = 4; sound.fail(); }
    } else if (stage.kind === 'survive') {
      if (state.wanted.stars === 0) { const r = advanceStage(m); if (r.finished) { cashPopup(p.x, p.y, r.reward); sound.sting(); saveGame(); } }
    } else if (dist(p.x, p.y, stage.x, stage.y) < stage.r) {
      if (stage.kind === 'drive' && !p.inCar) { state.prompt = 'You need to be in a car for this.'; }
      else if (stage.needsNoise && !m.active.noiseDone) { state.prompt = 'Make some noise — fire your pistol (click / Space).'; }
      else { const r = advanceStage(m); if (r.finished) { cashPopup(p.x, p.y, r.reward); sound.sting(); saveGame(); } }
    }
  }
  // Chop shop: deliver any stolen car.
  if (p.inCar && dist(p.x, p.y, world.chopShop.x, world.chopShop.y) < 84) {
    state.prompt = 'Press Enter to sell this car to the chop shop (+$220)';
    if (input.hit('Enter')) {
      const car = p.inCar; p.inCar = null;
      state.cars.splice(state.cars.indexOf(car), 1);
      m.chopDeliveries += 1; cashPopup(world.chopShop.x, world.chopShop.y, 220, 'chop shop');
      p.x = world.chopShop.x + 40; p.y = world.chopShop.y + 30; saveGame();
    }
  } else if (!busting) {
    const near = !p.inCar ? nearestCar(state.cars, p.x, p.y, 56) : null;
    state.prompt = near ? 'Press E to enter the ' + near.typeName : (m.active || m.storyComplete ? state.prompt === 'Press Enter to sell this car to the chop shop (+$220)' ? '' : state.prompt : '');
    if (!p.inCar && state.marker && !m.active && dist(p.x, p.y, state.marker.x, state.marker.y) < 90) state.prompt = 'Press Enter to start the mission';
    else if (!near && !(m.active && currentStage(m)?.needsNoise)) state.prompt = near ? state.prompt : '';
  }
  state.objective = objectiveText(m, world);
  // District name for HUD.
  let bestD = '', bd = 1e9;
  for (const d of world.districts) { const dd = dist(p.x, p.y, d.x, d.y); if (dd < bd) { bd = dd; bestD = d.name; } }
  state.districtName = bestD;

  updateCamera(state.camera, p, dt, VIEW_W, VIEW_H);
  sound.updateAmbience(dt);

  if (p.health <= 0) { state.mode = 'wasted'; state.endTimer = 0; sound.fail(); }
  input.endFrame();
}

// ---------- screens ----------
function drawMenu() {
  const t = state.time;
  ctx.fillStyle = '#0e2233'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#ff9e64'); g.addColorStop(0.55, '#ff5da2'); g.addColorStop(1, '#173f5f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.72);
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(VIEW_W * 0.78, 150 + Math.sin(t) * 6, 58, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#173f5f'; ctx.fillRect(0, VIEW_H * 0.72, VIEW_W, VIEW_H * 0.28);
  ctx.fillStyle = '#1d7f9e'; ctx.fillRect(0, VIEW_H * 0.72, VIEW_W, 26);
  // Skyline silhouettes.
  ctx.fillStyle = 'rgba(23,42,63,0.85)';
  const heights = [150, 220, 120, 260, 180, 300, 140, 230, 170, 250, 130, 210];
  heights.forEach((h, i) => ctx.fillRect(i * 112 + 8, VIEW_H * 0.72 - h, 84, h));
  ctx.fillStyle = '#ffe9a3';
  heights.forEach((h, i) => { for (let wnd = 0; wnd < 8; wnd++) if ((i * 7 + wnd * 13) % 3) ctx.fillRect(i * 112 + 18 + (wnd % 3) * 24, VIEW_H * 0.72 - h + 16 + Math.floor(wnd / 3) * 42, 11, 14); });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ff5da2'; ctx.shadowBlur = 26;
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.fillText('VICE HARBOR', VIEW_W / 2, 240);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 22px system-ui'; ctx.fillStyle = '#fff7d6';
  ctx.fillText('Sun, surf — and every car in the city has your name on it.', VIEW_W / 2, 284);
  ctx.font = '17px system-ui'; ctx.fillStyle = '#eaf6ff';
  ctx.fillText('Dock fixer Marisol Vega is hiring. Work her five jobs, outrun the VHPD,', VIEW_W / 2, 348);
  ctx.fillText('feed the chop shop, and own the harbor by sundown.', VIEW_W / 2, 374);
  ctx.font = 'bold 21px system-ui'; ctx.fillStyle = '#ffd23f';
  ctx.fillText(state.hasSave ? 'Press ENTER for New Game · C to Continue' : 'Press ENTER to Start', VIEW_W / 2, 470);
  ctx.font = '15.5px system-ui'; ctx.fillStyle = '#d7ecf7';
  const controls = ['WASD / Arrows — move & drive', 'Shift — sprint · Mouse — aim · Click / Space — shoot', 'E — enter / exit car · R — reload · Enter — missions & confirm', 'P / Esc — pause · M — mute'];
  controls.forEach((c, i) => ctx.fillText(c, VIEW_W / 2, 528 + i * 25));
}
function drawEndScreen(kind) {
  ctx.fillStyle = kind === 'wasted' ? 'rgba(90,8,8,0.88)' : 'rgba(10,26,60,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = '900 92px system-ui';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', VIEW_W / 2, 330);
  ctx.font = '19px system-ui';
  ctx.fillText(kind === 'wasted' ? 'The harbor medics patch you up — for a price.' : 'The VHPD impounds your ride and fines you $200.', VIEW_W / 2, 384);
  ctx.font = 'bold 20px system-ui'; ctx.fillStyle = '#ffd23f';
  ctx.fillText('Press ENTER to respawn at Solana Docks', VIEW_W / 2, 448);
}
function drawPaused() {
  renderScene(ctx, state, VIEW_W, VIEW_H, state.time);
  drawHUD(ctx, state, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(6,14,20,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = '900 54px system-ui'; ctx.fillText('PAUSED', VIEW_W / 2, 320);
  ctx.font = '18px system-ui';
  ctx.fillText('P / Esc — resume · S — save game · M — ' + (state.muted ? 'unmute' : 'mute'), VIEW_W / 2, 372);
  ctx.fillText('Cash $' + state.cash + ' · Mission ' + Math.min(state.missions.index + 1, 5) + ' of 5 · Packages ' + state.missions.packagesFound + '/12', VIEW_W / 2, 404);
}

// ---------- screenshot staging ----------
function stageShot(kind) {
  state.mode = 'playing';
  const p = state.player;
  state.missions.dialogueTimer = 0;
  if (kind === 'start') { state.mode = 'menu'; return; }
  if (kind === 'foot') {
    p.x = 1190; p.y = 760; p.inCar = null; p.angle = 0.4;
    state.camera.x = clamp(p.x - VIEW_W / 2, 0, 2320); state.camera.y = clamp(p.y - VIEW_H / 2, 0, 1800);
    startNextMission(state.missions, world);
  }
  if (kind === 'drive') {
    const car = state.cars.find((c) => c.driver === 'traffic') || state.cars[0];
    car.x = 1150; car.y = 712; car.angle = 0; car.speed = 215; car.driver = 'player'; car.parked = false;
    p.inCar = car; p.x = car.x; p.y = car.y;
    state.camera.x = clamp(p.x - VIEW_W / 2, 0, 2320); state.camera.y = clamp(p.y - VIEW_H / 2, 0, 1800);
    startNextMission(state.missions, world);
  }
  if (kind === 'chase') {
    const car = state.cars.find((c) => c.driver === 'traffic') || state.cars[0];
    car.x = 1610; car.y = 712; car.angle = 0; car.speed = 250; car.driver = 'player'; car.parked = false;
    p.inCar = car; p.x = car.x; p.y = car.y;
    addHeat(state.wanted, 320);
    for (let i = 0; i < 3; i++) {
      const c = spawnCruiser(makeRng(SEED + i * 31), world, { x: car.x - 190 - i * 120, y: car.y + (i - 1) * 66 }, state.cars);
      if (c) { c.x = car.x - 190 - i * 130; c.y = car.y + (i - 1) * 70; c.angle = 0; c.speed = 230; state.cars.push(c); }
    }
    startNextMission(state.missions, world);
    state.camera.x = clamp(p.x - VIEW_W / 2, 0, 2320); state.camera.y = clamp(p.y - VIEW_H / 2, 0, 1800);
  }
  state.marker = missionMarker(state.missions);
  state.objective = objectiveText(state.missions, world);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  state.menuPulse += dt;
  if (state.mode === 'menu') {
    state.time += dt;
    drawMenu();
    if (input.hit('Enter')) startRun(true);
    else if (input.hit('KeyC') && state.hasSave) startRun(false);
    input.endFrame();
  } else if (state.mode === 'paused') {
    drawPaused();
    if (input.hit('KeyP') || input.hit('Escape')) state.mode = 'playing';
    if (input.hit('KeyS')) { saveGame(); toast('Game saved'); state.mode = 'playing'; }
    if (input.hit('KeyM')) state.muted = sound.toggleMute();
    input.endFrame();
  } else if (state.mode === 'wasted' || state.mode === 'busted') {
    state.endTimer += dt;
    renderScene(ctx, state, VIEW_W, VIEW_H, state.time);
    drawEndScreen(state.mode);
    if (input.hit('Enter') && state.endTimer > 0.4) respawn();
    input.endFrame();
  } else {
    if (input.hit('KeyP') || input.hit('Escape')) { state.mode = 'paused'; input.endFrame(); }
    else {
      update(dt);
      renderScene(ctx, state, VIEW_W, VIEW_H, state.time);
      drawHUD(ctx, state, VIEW_W, VIEW_H);
    }
  }
  requestAnimationFrame(frame);
}

if (SHOT) stageShot(SHOT);
window.__viceHarbor = state;
requestAnimationFrame(frame);
