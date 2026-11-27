// «Загорелась проводка, ты дома»: the wall socket low by the sofa with the plug of an oil heater, its cord along the
// floor; sparks and flames along the cord; a thick blanket thrown over them; water and steam; the switchboard card with
// its breakers; the props in his hands (a glass of water, an extinguisher). World units as in smoke.js: floor y = 0.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
import { flames } from './apt.js';
import { puff } from './smoke.js';

export const SOCK = { x: 60, y: -110 };                     // the socket's centre
export const HEATER = { x0: 230, x1: 340, top: -170 };
// the cord: the plug in the socket (or pulled out, k 0…1), down to the floor and along it to the heater
const cordPts = pull => {
  const px = SOCK.x + 36 * pull, py = SOCK.y + 30 + 60 * pull;
  return [[px, py], [px + 10, -40], [110, -6], [180, -6], [HEATER.x0 + 4, -40]];
};
export const FIRE_AT = [92, -30];                            // where the cord burns, near the socket
export function socketScene(t, o = {}) {
  const pull = clamp(o.pull ?? 0);
  // the heater: an oil radiator with its fins, on little wheels
  for (let i = 0; i < 6; i++) rrect(HEATER.x0 + i * 18, HEATER.top, 16, -HEATER.top - 20, 6, '#e9ebee');
  rect(HEATER.x0, HEATER.top + 20, HEATER.x1 - HEATER.x0, 10, '#c9cdd3'); rect(HEATER.x0, -40, HEATER.x1 - HEATER.x0, 10, '#c9cdd3');
  ell(HEATER.x0 + 12, -8, 8, 8, '#3b3f48'); ell(HEATER.x1 - 12, -8, 8, 8, '#3b3f48');
  // the socket: its plate, the two holes (or the plug in them), scorch marks once it burnt
  rrect(SOCK.x - 34, SOCK.y - 34, 68, 68, 10, '#f4f2ec'); g.lineWidth = 2; g.strokeStyle = '#c9c4b8'; g.stroke(rrPath(SOCK.x - 34, SOCK.y - 34, 68, 68, 10));
  if (o.scorch) { g.save(); g.globalAlpha = 0.6 * o.scorch; ell(SOCK.x + 10, SOCK.y - 30, 50, 40, '#2a2420'); g.restore(); }
  ell(SOCK.x - 12, SOCK.y, 5, 5, '#3b3f48'); ell(SOCK.x + 12, SOCK.y, 5, 5, '#3b3f48');
  // the cord and the plug
  const P = cordPts(pull);
  limb(P.slice(0), 8, o.burnt ? '#2a2420' : '#f4f4f4', true);
  const plug = [lerp(SOCK.x, P[0][0], pull), lerp(SOCK.y, P[0][1] - 10, pull)];
  rrect(plug[0] - 16, plug[1] - 18, 32, 40, 8, '#eceae4');
  if (pull > 0.4) { limb([[plug[0] - 7, plug[1] - 18], [plug[0] - 7, plug[1] - 34]], 4, '#c9a36a'); limb([[plug[0] + 7, plug[1] - 18], [plug[0] + 7, plug[1] - 34]], 4, '#c9a36a'); }
  // the fire: sparks first, then flames along the cord by the socket
  if (o.sparks > 0.01) sparks(SOCK.x + 8, SOCK.y + 14, t, o.sparks);
  if (o.fire > 0.01) {
    const k = o.fire, w = lerp(40, 110, k), h = lerp(40, 150, k);
    flames(FIRE_AT[0], -4, w, h, t, clamp(k * 1.5));
    flames(SOCK.x + 6, SOCK.y + 30, w * 0.6, h * 0.55, t + 0.3, clamp(k * 1.2));
    for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i / 5) % 1; puff(FIRE_AT[0] + 20 * Math.sin(i * 2 + t), -h - 200 * ph, 40 + 70 * ph, k * 0.6 * (1 - ph), i); }
  }
  // the blanket thrown over it (k 0…1 how far down)
  if (o.blanket > 0.01) blanket(FIRE_AT[0] - 20, -4, o.blanket);
  // water hitting the cord, steam rising
  if (o.steam > 0.01) for (let i = 0; i < 8; i++) { const ph = (t * 0.7 + i / 8) % 1; puff(FIRE_AT[0] - 30 + i * 12, -20 - 280 * ph, 30 + 70 * ph, o.steam * (1 - ph) * 0.7, 3); }
  if (o.wet) { g.save(); g.globalAlpha = 0.5 * o.wet; ell(FIRE_AT[0], -2, 110, 14, '#6fa8d6'); g.restore(); }
}
export function sparks(x, y, t, k) {
  for (let i = 0; i < 9; i++) {
    const ph = (t * 3.1 + hash(i * 3.3)) % 1, a = -0.4 - hash(i * 1.9) * 2.2, d = 30 + 110 * ph;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 120 * ph * ph;
    g.save(); g.globalAlpha = k * (1 - ph); limb([[px, py], [px - Math.cos(a) * 16, py - Math.sin(a) * 16]], 5, '#fff3a8', false); g.restore();
  }
  const fl = 0.6 + 0.4 * noise(t * 20, 4);
  g.save(); g.globalAlpha = k * fl; const gr = g.createRadialGradient(x, y, 0, x, y, 70); gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(x - 70, y - 70, 140, 140); g.restore();
}
// a thick grey-brown woollen blanket dropped over (x, y): k 0 held high … 1 lying in a heap
export function blanket(x, y, k) {
  const e = ease.out(clamp(k)), top = lerp(-240, -80, e), w = lerp(120, 170, e);
  fill(smoothPath([[x - w, y], [x - w * 0.8, top + 40], [x - w * 0.3, top], [x + w * 0.4, top + 10], [x + w * 0.85, top + 50], [x + w, y]]), '#7a6248');
  for (let i = 0; i < 4; i++) limb([[x - w * 0.7 + i * w * 0.45, top + 30 + 6 * i], [x - w * 0.8 + i * w * 0.45, y - 6]], 4, 'rgba(0,0,0,0.18)');
  limb([[x - w * 0.9, y - 14], [x + w * 0.9, y - 14]], 6, '#5f4b36');
}
// a glass of water in the hand at p; tilt 0…1 (1 = poured)
export function glass(p, tilt = 0) {
  g.save(); g.translate(p[0], p[1]); g.rotate(-1.2 * tilt);
  fill(polyPath([[-22, -50], [22, -50], [17, 30], [-17, 30]]), 'rgba(200,230,250,0.75)');
  fill(polyPath([[-19, -20 + 40 * tilt], [19, -20 + 40 * tilt], [17, 30], [-17, 30]]), '#6fa8d6');
  g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(polyPath([[-22, -50], [22, -50], [17, 30], [-17, 30]], true));
  g.restore();
}
// water poured from a to b (an arc of drops), k 0…1
export function pour(a, b, t, k) {
  if (k <= 0.01) return;
  for (let i = 0; i < 14; i++) {
    const u = ((t * 2.5 + i / 14) % 1);
    if (u > k) continue;
    const x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u) - 120 * Math.sin(u * Math.PI);
    ell(x, y, 8, 11, '#6fa8d6', 0, 0.9);
  }
}
// a red extinguisher held at p (its handle), s scale
export function extinguisher(p, s = 1) {
  g.save(); g.translate(p[0], p[1]); g.scale(s, s);
  rrect(-26, 10, 52, 150, 22, '#d63a2f'); rect(-26, 60, 52, 34, '#f4f2ec'); text('ОП', 0, 86, 22, INK, { fam: FONTS.cond, shadow: false });
  rect(-8, -6, 16, 18, '#2b2f38'); limb([[-4, -6], [-30, -20]], 8, '#2b2f38'); limb([[8, 0], [40, 30], [44, 120]], 8, '#1f2228');
  g.restore();
}

// —— the switchboard card (screen space): a grey box, four breakers; off 0…4 how many are down (fractional = moving) ——
export function boardCard(cx, cy, k, off, ok = 0) {
  if (k <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate(0.02);
  const w = 520, h = 520;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 28; g.shadowOffsetY = 10; rrect(-w / 2, -h / 2, w, h, 20, '#c9ced4'); g.restore();
  rrect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, 14, '#e6e9ec');
  text('ЩИТОК', 0, -h / 2 + 80, 48, '#3b3f48', { fam: FONTS.block, shadow: false });
  rect(-w / 2 + 50, -40, w - 100, 14, '#9aa0a8');
  for (let i = 0; i < 4; i++) {
    const x = -165 + i * 110, d = clamp(off - i), y0 = -110, y1 = 120;
    rrect(x - 42, y0, 84, y1 - y0, 10, '#ffffff'); g.lineWidth = 3; g.strokeStyle = '#b9bec4'; g.stroke(rrPath(x - 42, y0, 84, y1 - y0, 10));
    const ly = lerp(-60, 50, ease.inOut(d));
    rrect(x - 22, ly - 26, 44, 52, 8, d > 0.5 ? '#3b3f48' : '#2f8f4e');
    text(d > 0.5 ? '0' : 'I', x, 104, 30, '#3b3f48', { fam: FONTS.cond, shadow: false });
  }
  text(off >= 3.99 ? 'ТОКА НЕТ' : 'ТОК ЕСТЬ', 0, h / 2 - 50, 44, off >= 3.99 ? '#2f8f4e' : '#d63a2f', { fam: FONTS.block, shadow: false });
  if (ok > 0.01) { g.save(); g.globalAlpha = ok; ell(w / 2 - 50, -h / 2 + 50, 46, 46, '#2f8f4e'); limb([[w / 2 - 72, -h / 2 + 50], [w / 2 - 54, -h / 2 + 68], [w / 2 - 26, -h / 2 + 32]], 10, '#ffffff', false); g.restore(); }
  g.restore();
}
