// «Заливают соседи, ты дома»: the ceiling lamp with water running out of it, the wet stain spreading over the ceiling,
// drips, the puddle, basins and a bucket, the wall switch, a laptop carried away; the phone cards (a call, recording a
// video). World units as in smoke.js: the floor at y = 0, the ceiling at y = −760.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

export const LAMP = { x: 0, top: -760, y: -520 };          // the lamp hangs from the ceiling to y
export const SWITCH = [-200, -330];
export const DRIPS = [[LAMP.x - 110, LAMP.y + 60], [LAMP.x + 110, LAMP.y + 60], [LAMP.x + 300, -760]];
// the lamp: a cord, a brass body, three shades; o.lit 0…1, o.wet the water running down it
export function lamp(t, o = {}) {
  const { x, top, y } = LAMP;
  limb([[x, top], [x, y - 60]], 6, '#3b3f48');
  ell(x, y - 60, 24, 18, '#b9935a'); limb([[x - 110, y], [x, y - 45], [x + 110, y]], 12, '#b9935a');
  for (const dx of [-110, 0, 110]) {
    const sx = x + dx, sy = y + (dx ? 0 : 14);
    fill(polyPath([[sx - 40, sy + 60], [sx - 18, sy], [sx + 18, sy], [sx + 40, sy + 60]]), o.lit ? '#fff1c0' : '#efe6d0');
    if (o.lit) { g.save(); g.globalAlpha = 0.3 * o.lit; ell(sx, sy + 100, 100, 56, '#fff6c8'); g.restore(); }
  }
  if (o.wet > 0.01) {
    g.save(); g.globalAlpha = 0.8 * o.wet; limb([[x + 4, top], [x + 4, y - 60]], 7, '#6fa8d6'); ell(x, y - 60, 26, 20, '#6fa8d6', 0, 0.4); g.restore();
    // a thin stream from the middle shade to the floor, wobbling
    if (o.wet > 0.6) { g.save(); g.lineWidth = 7; g.strokeStyle = 'rgba(111,168,214,0.85)'; g.beginPath();
      for (let i = 0; i <= 20; i++) { const yy = lerp(y + 74, -4, i / 20), xx = x + 3 * Math.sin(yy * 0.03 + t * 12); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.restore(); }
  }
}
// the wet stain on the ceiling around the lamp, k 0…1
export function stain(k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = 0.8;
  fill(smoothPath([[LAMP.x - 320 * k, LAMP.top], [LAMP.x - 200 * k, LAMP.top + 30 * k], [LAMP.x + 60 * k, LAMP.top + 40 * k], [LAMP.x + 320 * k, LAMP.top + 26 * k], [LAMP.x + 380 * k, LAMP.top]]), '#7d7360');
  g.restore();
}
// drops falling from each source to the floor (or to a basin's rim at y = stop), k 0…1 how heavy
export function drips(t, k, stops = []) {
  if (k <= 0.01) return;
  DRIPS.forEach(([x, y0], j) => {
    if (j === 2 && k < 0.5) return;
    const stop = stops[j] ?? 0;
    for (let i = 0; i < 3; i++) {
      const ph = (t * (1.4 + 0.3 * j) + i / 3 + hash(j)) % 1, y = lerp(y0, stop, ph * ph);
      ell(x, y, 9, 15, '#6fa8d6', 0, 0.95);
    }
    // the splash where it lands
    const sp = (t * 2.2 + j * 0.3) % 1;
    g.save(); g.globalAlpha = (1 - sp) * k; g.lineWidth = 3; g.strokeStyle = '#9fd0ee'; g.beginPath(); g.ellipse(x, stop - 2, 10 + 30 * sp, 3 + 6 * sp, 0, Math.PI, TAU); g.stroke(); g.restore();
  });
}
// the puddle on the floor, k 0…1
export function puddle(k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = 0.6;
  fill(smoothPath([[LAMP.x - 260 * k, -2], [LAMP.x - 140 * k, -12 * k], [LAMP.x + 180 * k, -10 * k], [LAMP.x + 340 * k, -2], [LAMP.x + 160 * k, 8 * k], [LAMP.x - 160 * k, 8 * k]]), '#6fa8d6');
  g.restore();
}
// a basin (wide, blue) or a bucket (tall, grey) at x; k 0…1 shown (it drops in from above); fill 0…1 water
export function basin(x, k, fillK = 0) {
  if (k <= 0.01) return;
  const y = lerp(-140, 0, ease.out(clamp(k)));
  fill(polyPath([[x - 70, y - 50], [x + 70, y - 50], [x + 54, y], [x - 54, y]]), '#3c7ad6');
  ell(x, y - 50, 70, 12, '#2a5aa8'); if (fillK > 0.01) ell(x, y - 50, 62 * fillK, 9 * fillK, '#9fd0ee');
}
export function bucket(x, k) {
  if (k <= 0.01) return;
  const y = lerp(-140, 0, ease.out(clamp(k)));
  fill(polyPath([[x - 44, y - 90], [x + 44, y - 90], [x + 36, y], [x - 36, y]]), '#9aa3ad');
  ell(x, y - 90, 44, 9, '#7f8892'); limb([[x - 44, y - 90], [x, y - 140], [x + 44, y - 90]], 4, '#5d6570');
}
// the light switch on the wall
export function wallSwitch() {
  const [x, y] = SWITCH;
  rrect(x - 26, y - 36, 52, 72, 8, '#f4f2ec'); g.lineWidth = 2; g.strokeStyle = '#c9c4b8'; g.stroke(rrPath(x - 26, y - 36, 52, 72, 8));
  rrect(x - 10, y - 22, 20, 44, 5, '#e2ded4');
}
// a laptop held at p
export function laptop(p) {
  g.save(); g.translate(p[0], p[1]); g.rotate(-0.1);
  rrect(-60, -8, 120, 14, 4, '#9aa3ad'); fill(polyPath([[-56, -8], [-48, -80], [48, -80], [56, -8]]), '#5d6570'); fill(polyPath([[-48, -14], [-42, -74], [42, -74], [48, -14]]), '#9fd8ff');
  g.restore();
}

// —— the phone cards (screen space) ——
// a call: title, number line, «ВЫЗОВ…»
export function callCard(cx, cy, k, t, title, sub) {
  if (k <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate(-0.04);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 30; g.shadowOffsetY = 10; rrect(-170, -290, 340, 580, 44, '#1b1e29'); g.restore();
  rrect(-152, -270, 304, 540, 30, '#16233a');
  ell(0, -140, 60, 60, '#e78a2f'); text('☎', 0, -116, 64, '#ffffff', { shadow: false });
  text(title, 0, -20, 46, '#ffffff', { fam: FONTS.cond, shadow: false });
  text(sub, 0, 30, 30, '#9fd3ff', { fam: FONTS.cond, shadow: false });
  const pulse = 1 + 0.08 * Math.sin(t * 8); ell(0, 180, 46 * pulse, 46 * pulse, '#2fbf5a');
  g.restore();
}
// recording a video of the ceiling: the viewfinder with the stain and the drips, REC and the date
export function recCard(cx, cy, k, t, stamp) {
  if (k <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate(0.03);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 30; g.shadowOffsetY = 10; rrect(-200, -330, 400, 660, 44, '#1b1e29'); g.restore();
  g.save(); g.beginPath(); g.rect(-180, -300, 360, 600); g.clip();
  rect(-180, -300, 360, 600, '#e8eef0');
  g.globalAlpha = 0.6; fill(smoothPath([[-170, -300], [-120, -230], [40, -200], [170, -250], [180, -300]]), '#9a8f78'); g.globalAlpha = 1;
  limb([[0, -300], [0, -180]], 4, '#3b3f48'); limb([[-50, -150], [0, -175], [50, -150]], 8, '#b9935a');
  for (let i = 0; i < 4; i++) { const ph = (t * 1.5 + i / 4) % 1; ell(-20 + 40 * (i % 2), -150 + 420 * ph, 6, 10, '#6fa8d6'); }
  g.globalAlpha = 0.6; ell(0, 260, 150, 20, '#6fa8d6'); g.globalAlpha = 1;
  g.restore();
  const blink = Math.floor(t * 2) % 2;
  if (blink) ell(-140, -264, 12, 12, '#e53935');
  text('REC', -92, -254, 30, '#e53935', { fam: FONTS.mono, shadow: false });
  rrect(-170, 228, 340, 56, 10, 'rgba(0,0,0,0.55)'); text(stamp, 0, 266, 30, '#ffffff', { fam: FONTS.mono, shadow: false });
  g.restore();
}
