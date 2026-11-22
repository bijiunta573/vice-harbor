// Rendering: camera, the city (roads, beach, harbor, buildings, palms), every entity,
// and the particle layer (tire smoke, sparks, muzzle flashes, cash popups).
import { WORLD_W, WORLD_H, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';
import { WATER_Y, BEACH_Y, roadXs, roadYs } from './world.js';

export function makeCamera() { return { x: 0, y: 0, shake: 0 }; }
export function updateCamera(cam, target, dt, viewW, viewH) {
  const tx = clamp(target.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
  const ty = clamp(target.y - viewH / 2, 0, Math.max(0, WORLD_H - viewH));
  const k = Math.min(1, dt * 5.5);
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  cam.shake = Math.max(0, cam.shake - dt * 26);
}
export function addShake(cam, amount) { cam.shake = Math.min(16, cam.shake + amount); }

export function spawnParticle(list, p) { if (list.length < 420) list.push({ life: 0.6, maxLife: 0.6, size: 4, color: '#ffffff', vx: 0, vy: 0, text: null, ...p }); }
export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= (p.text ? 26 : 0) * dt;
  }
}

function drawWorldBase(ctx, world, cam, viewW, viewH) {
  // Land, sand and water with a soft daylight gradient.
  const g = ctx.createLinearGradient(0, -cam.y, 0, WORLD_H - cam.y);
  g.addColorStop(0, '#8fce6e'); g.addColorStop(0.75, '#6db85f'); g.addColorStop(1, '#5fae5f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, BEACH_Y - cam.y, viewW, WATER_Y - BEACH_Y);
  const wg = ctx.createLinearGradient(0, WATER_Y - cam.y, 0, WORLD_H - cam.y);
  wg.addColorStop(0, PALETTE.water); wg.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = wg; ctx.fillRect(0, WATER_Y - cam.y, viewW, WORLD_H - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const wy = WATER_Y + 26 + i * 16 - cam.y;
    if (wy < -10 || wy > viewH + 10) continue;
    ctx.beginPath();
    for (let x = -20; x < viewW + 20; x += 46) ctx.lineTo(x, wy + Math.sin((x + i * 71) * 0.02) * 3);
    ctx.stroke();
  }
  // Parks.
  for (const p of world.props) {
    if (p.kind !== 'park') continue;
    ctx.fillStyle = '#57a773';
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.strokeStyle = '#3f8a58'; ctx.strokeRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
  }
  // Sidewalks then roads.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of roadXs()) ctx.fillRect(rx - 58 - cam.x, 0 - cam.y, 116, BEACH_Y);
  for (const ry of roadYs()) ctx.fillRect(0 - cam.x, ry - 58 - cam.y, WORLD_W, 116);
  ctx.fillStyle = PALETTE.road;
  for (const rx of roadXs()) ctx.fillRect(rx - 46 - cam.x, 0 - cam.y, 92, BEACH_Y);
  for (const ry of roadYs()) ctx.fillRect(0 - cam.x, ry - 46 - cam.y, WORLD_W, 92);
  ctx.strokeStyle = PALETTE.roadLine; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (const rx of roadXs()) { ctx.moveTo(rx - cam.x, -cam.y); ctx.lineTo(rx - cam.x, BEACH_Y - cam.y); }
  for (const ry of roadYs()) { ctx.moveTo(-cam.x, ry - cam.y); ctx.lineTo(WORLD_W - cam.x, ry - cam.y); }
  ctx.stroke(); ctx.setLineDash([]);
  // Piers and bridge.
  ctx.fillStyle = '#8d6e63';
  for (const pier of world.piers) ctx.fillRect(pier.x - cam.x, pier.y - cam.y, pier.w, pier.h);
  for (const p of world.props) if (p.kind === 'bridge') {
    ctx.fillStyle = '#6d7278'; ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.fillStyle = '#f5d76e'; ctx.fillRect(p.x - cam.x, p.y + p.h / 2 - 3 - cam.y, p.w, 6);
  }
  // District labels.
  ctx.font = 'bold 21px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const d of world.districts) {
    const dx = d.x - cam.x, dy = d.y - cam.y;
    if (dx < -160 || dy < -40 || dx > viewW + 160 || dy > viewH + 40) continue;
    ctx.fillStyle = 'rgba(20,40,50,0.4)';
    ctx.fillText(d.name.toUpperCase(), dx, dy);
  }
}

function drawBuildings(ctx, world, cam, viewW, viewH) {
  for (const b of world.buildings) {
    const x = b.x - cam.x, y = b.y - cam.y;
    if (x + b.w < -30 || y + b.h < -30 || x > viewW + 30 || y > viewH + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; // soft shadow
    ctx.fillRect(x + 9, y + 11, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, b.w, 7);
    ctx.strokeStyle = 'rgba(60,50,40,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, b.w, b.h);
    // Windows lit by a per-building seed pattern.
    ctx.fillStyle = '#3d5a73';
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = Math.sin(b.seed + i * 12.9 + j * 78.2) > 0.25;
      ctx.fillStyle = lit ? '#ffe9a3' : '#46617a';
      ctx.fillRect(x + 8 + i * 24, y + 12 + j * 24, 13, 15);
    }
    if (b.neon && b.sign) {
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = b.neon;
      ctx.shadowColor = b.neon; ctx.shadowBlur = 9;
      ctx.fillText(b.sign, x + b.w / 2, y + b.h / 2 + 4);
      ctx.shadowBlur = 0;
    }
  }
}

function drawPalmsAndProps(ctx, world, cam, viewW, viewH, t) {
  for (const p of world.palms) {
    const x = p.x - cam.x, y = p.y - cam.y;
    if (x < -40 || y < -40 || x > viewW + 40 || y > viewH + 40) continue;
    ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 5 * p.s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5 * p.s, y - 16 * p.s, x + 9 * p.s, y - 26 * p.s); ctx.stroke();
    ctx.strokeStyle = '#2e9e4f'; ctx.lineWidth = 3.4 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.sin(t * 1.3 + p.x) * 0.06;
      ctx.beginPath(); ctx.moveTo(x + 9 * p.s, y - 26 * p.s);
      ctx.quadraticCurveTo(x + 9 * p.s + Math.cos(a) * 15 * p.s, y - 26 * p.s + Math.sin(a) * 8 * p.s - 4, x + 9 * p.s + Math.cos(a) * 24 * p.s, y - 26 * p.s + Math.sin(a) * 13 * p.s + 5);
      ctx.stroke();
    }
  }
  for (const p of world.props) {
    if (p.kind !== 'boat') continue;
    const x = p.x - cam.x, y = p.y - cam.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.a);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-28, -8, 62, 22);
    ctx.fillStyle = p.color; ctx.fillRect(-30, -11, 60, 20);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-8, -7, 22, 12);
    ctx.restore();
  }
}

export function drawCar(ctx, car, cam) {
  const x = car.x - cam.x, y = car.y - cam.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 5, car.w, car.h);
  ctx.fillStyle = car.color;
  ctx.beginPath(); ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath(); ctx.roundRect(-car.w * 0.16, -car.h * 0.36, car.w * 0.34, car.h * 0.72, 4); ctx.fill();
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(car.w / 2 - 4, -car.h * 0.32, 4, 6); ctx.fillRect(car.w / 2 - 4, car.h * 0.32 - 6, 4, 6);
  ctx.fillStyle = '#e33';
  ctx.fillRect(-car.w / 2, -car.h * 0.32, 4, 6); ctx.fillRect(-car.w / 2, car.h * 0.32 - 6, 4, 6);
  if (car.isPolice) {
    ctx.fillStyle = '#1c2733'; ctx.fillRect(-car.w * 0.3, -car.h / 2, car.w * 0.6, car.h);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('VHPD', 0, 3);
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  }
  if (car.health < 45) { ctx.fillStyle = 'rgba(40,40,40,0.5)'; ctx.beginPath(); ctx.arc(-car.w * 0.3, 0, 8 + Math.sin(performance.now() / 90) * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function drawPerson(ctx, px, py, cam, color, angle, walkCycle, opts = {}) {
  const x = px - cam.x, y = py - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 10, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const step = Math.sin(walkCycle) * 4;
  ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x - 4 + step * 0.4, y + 12); ctx.moveTo(x, y + 2); ctx.lineTo(x + 4 - step * 0.4, y + 12); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(x, y - 4, 5.4, 0, Math.PI * 2); ctx.fill();
  if (opts.aim !== undefined && opts.aim !== null) {
    ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 3.4;
    const ax = x + Math.cos(opts.aim) * 15, ay = y + Math.sin(opts.aim) * 15;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(ax - 2, ay - 2, 7, 4);
  }
  if (opts.badge) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + 6, y - 8, 3.4, 0, Math.PI * 2); ctx.fill(); }
}

export function renderScene(ctx, state, viewW, viewH, t) {
  const cam = state.camera;
  const sx = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const sy = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const view = { x: cam.x + sx, y: cam.y + sy };
  const vcam = { x: view.x, y: view.y };
  drawWorldBase(ctx, state.world, vcam, viewW, viewH);
  drawBuildings(ctx, state.world, vcam, viewW, viewH);
  // Pickups and packages.
  for (const pk of state.world.packages) {
    if (pk.taken) continue;
    const x = pk.x - vcam.x, y = pk.y - vcam.y + Math.sin(t * 3 + pk.x) * 3;
    ctx.fillStyle = '#c56cf0'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('?', x, y + 4);
  }
  for (const hp of state.world.healthPickups) {
    if (!hp.active) continue;
    const x = hp.x - vcam.x, y = hp.y - vcam.y;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - 11, y - 11, 22, 22, 5); ctx.fill();
    ctx.fillStyle = '#e33'; ctx.fillRect(x - 3, y - 8, 6, 16); ctx.fillRect(x - 8, y - 3, 16, 6);
  }
  // Mission / chop markers.
  drawMarker(ctx, state.marker, vcam, t);
  if (state.chopMarker) drawMarker(ctx, { ...state.chopMarker, gold: false, label: 'CHOP SHOP' }, vcam, t);
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    drawPerson(ctx, ped.x, ped.y, vcam, ped.color, 0, ped.walkCycle, {});
    if (ped.panic > 0.3) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', ped.x - vcam.x, ped.y - vcam.y - 18); }
  }
  for (const car of state.cars) drawCar(ctx, car, vcam);
  for (const off of state.officers) drawPerson(ctx, off.x, off.y, vcam, '#24406b', 0, off.walkCycle, { badge: true });
  const p = state.player;
  if (!p.inCar) {
    const aim = state.aimAngle;
    drawPerson(ctx, p.x, p.y, vcam, '#ff5da2', p.angle, p.walkCycle, { aim });
  }
  // Particles.
  for (const pt of state.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.text) {
      ctx.globalAlpha = a; ctx.fillStyle = pt.color; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(pt.text, pt.x - vcam.x, pt.y - vcam.y);
    } else {
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x - vcam.x, pt.y - vcam.y, pt.size * (1.4 - a * 0.4), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Tracer lines.
  ctx.strokeStyle = 'rgba(255,240,180,0.75)'; ctx.lineWidth = 2;
  for (const tr of state.tracers) {
    ctx.beginPath(); ctx.moveTo(tr.x1 - vcam.x, tr.y1 - vcam.y); ctx.lineTo(tr.x2 - vcam.x, tr.y2 - vcam.y); ctx.stroke();
  }
}

function drawMarker(ctx, marker, cam, t) {
  if (!marker) return;
  const x = marker.x - cam.x, y = marker.y - cam.y + Math.sin(t * 2.6) * 5;
  const color = marker.gold ? '#ffd23f' : '#3ee6c4';
  ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(marker.x - cam.x, marker.y - cam.y, 30 + Math.sin(t * 2.6) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.lineTo(x - 11, y - 66); ctx.lineTo(x + 11, y - 66); ctx.closePath(); ctx.fill();
  if (marker.label) { ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(marker.label, x, y - 74); }
}
