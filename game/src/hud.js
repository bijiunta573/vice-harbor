// HUD and minimap: health, cash, weapon, wanted stars, objective, prompts,
// dialogue boxes, banners, and the live radar minimap with blips.
import { WORLD_W, WORLD_H } from './config.js';
import { WATER_Y } from './world.js';

const MAP_W = 196, MAP_H = 142, MAP_X = 14, MAP_Y = 14;

export function drawMinimap(ctx, state) {
  const sx = MAP_W / WORLD_W, sy = MAP_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,26,34,0.82)';
  ctx.beginPath(); ctx.roundRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 26, 9); ctx.fill();
  ctx.fillStyle = '#69a85e'; ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H * (WATER_Y / WORLD_H));
  ctx.fillStyle = '#1d7f9e'; ctx.fillRect(MAP_X, MAP_Y + MAP_H * (WATER_Y / WORLD_H), MAP_W, MAP_H - MAP_H * (WATER_Y / WORLD_H));
  ctx.strokeStyle = '#454b54'; ctx.lineWidth = 2;
  for (let gx = 230; gx < WORLD_W; gx += 460) { ctx.beginPath(); ctx.moveTo(MAP_X + gx * sx, MAP_Y); ctx.lineTo(MAP_X + gx * sx, MAP_Y + MAP_H); ctx.stroke(); }
  for (let gy = 230; gy < 2060; gy += 460) { ctx.beginPath(); ctx.moveTo(MAP_X, MAP_Y + gy * sy); ctx.lineTo(MAP_X + MAP_W, MAP_Y + gy * sy); ctx.stroke(); }
  const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(MAP_X + x * sx, MAP_Y + y * sy, r, 0, Math.PI * 2); ctx.fill(); };
  for (const car of state.cars) if (car.isPolice) dot(car.x, car.y, '#54a0ff', 3);
  if (state.marker) dot(state.marker.x, state.marker.y, '#ffd23f', 4.4);
  if (state.chopMarker) dot(state.chopMarker.x, state.chopMarker.y, '#3ee6c4', 3.4);
  // Player arrow.
  const p = state.player;
  const px = MAP_X + p.x * sx, py = MAP_Y + p.y * sy;
  const ang = p.inCar ? p.inCar.angle : p.angle;
  ctx.fillStyle = '#ffffff';
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-5, 4.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('N ▲', MAP_X + 2, MAP_Y + MAP_H + 17);
  ctx.textAlign = 'right';
  ctx.fillText(state.districtName || '', MAP_X + MAP_W, MAP_Y + MAP_H + 17);
  ctx.restore();
}

export function drawHUD(ctx, state, viewW, viewH) {
  drawMinimap(ctx, state);
  const p = state.player;
  // Health bar bottom-left.
  const hx = 16, hy = viewH - 58;
  ctx.fillStyle = 'rgba(8,16,22,0.72)'; ctx.beginPath(); ctx.roundRect(hx - 4, hy - 22, 224, 66, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('HEALTH', hx, hy - 8);
  ctx.fillStyle = '#3a3f46'; ctx.fillRect(hx, hy, 210, 13);
  ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(hx, hy, 210 * Math.max(0, p.health) / 100, 13);
  ctx.font = 'bold 14px system-ui';
  ctx.fillText(p.inCar ? 'IN VEHICLE — ' + p.inCar.typeName : 'ON FOOT', hx, hy + 32);
  // Cash + weapon top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,16,22,0.72)'; ctx.beginPath(); ctx.roundRect(viewW - 236, 12, 222, 84, 8); ctx.fill();
  ctx.fillStyle = '#7bed6a'; ctx.font = 'bold 25px system-ui';
  ctx.fillText('$' + state.cash.toLocaleString('en-US'), viewW - 26, 44);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui';
  ctx.fillText(p.reloading > 0 ? 'PISTOL — RELOADING…' : 'PISTOL  ' + p.ammo + ' / ' + p.reserve, viewW - 26, 70);
  ctx.font = '12px system-ui'; ctx.fillStyle = '#ffd23f';
  ctx.fillText('Packages ' + state.missions.packagesFound + '/12 · Chop deliveries ' + state.missions.chopDeliveries, viewW - 26, 88);
  // Wanted stars top-center.
  const stars = state.wanted.stars;
  ctx.textAlign = 'center'; ctx.font = '30px system-ui';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', viewW / 2 - 64 + i * 32, 40);
  }
  if (stars > 0 && state.wanted.hiddenTimer > 2 && state.wanted.heat > 0) {
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#aee9ff';
    ctx.fillText('LOSING THE HEAT… stay hidden', viewW / 2, 62);
  }
  // Objective bar bottom-center.
  ctx.font = 'bold 15px system-ui';
  const obj = state.objective || '';
  const w = Math.min(viewW - 420, ctx.measureText(obj).width + 34);
  ctx.fillStyle = 'rgba(8,16,22,0.78)';
  ctx.beginPath(); ctx.roundRect(viewW / 2 - w / 2, viewH - 46, w, 32, 8); ctx.fill();
  ctx.fillStyle = '#ffe9a3'; ctx.fillText(obj, viewW / 2, viewH - 24);
  // Interaction prompt.
  if (state.prompt) {
    ctx.font = 'bold 16px system-ui';
    ctx.fillStyle = 'rgba(8,16,22,0.8)';
    const pw = ctx.measureText(state.prompt).width + 30;
    ctx.beginPath(); ctx.roundRect(viewW / 2 - pw / 2, viewH - 92, pw, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(state.prompt, viewW / 2, viewH - 71);
  }
  // Dialogue box.
  if (state.missions.dialogue && state.missions.dialogueTimer > 0) {
    const lines = state.missions.dialogue;
    ctx.fillStyle = 'rgba(8,14,20,0.88)';
    ctx.beginPath(); ctx.roundRect(viewW / 2 - 330, 78, 660, 26 + lines.length * 21, 10); ctx.fill();
    ctx.textAlign = 'left'; ctx.font = '14.5px system-ui'; ctx.fillStyle = '#f5f0dc';
    lines.forEach((ln, i) => ctx.fillText(ln, viewW / 2 - 312, 102 + i * 21));
  }
  // Mission banner.
  if (state.missions.banner && state.missions.bannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,14,20,0.85)';
    ctx.beginPath(); ctx.roundRect(viewW / 2 - 300, 168, 600, 54, 10); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 23px system-ui';
    ctx.fillText(state.missions.banner, viewW / 2, 203);
  }
  if (state.toast) {
    ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui'; ctx.fillStyle = '#aee9ff';
    ctx.fillText(state.toast, viewW / 2, viewH - 108);
  }
}
