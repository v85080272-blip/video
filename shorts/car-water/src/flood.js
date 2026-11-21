// «Прорвало дамбу, ты дома»: the muddy flood water rising up the panel block (its surface at y = level), the roof with
// its parapet at ROOF, a car tipped over by the stream, a tree and a pole in the water leaning as they are washed out,
// a white sheet, the light of a torch at night. World units as in smoke.js (our balcony slab at y = 0, a floor = 640).
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { puff } from './smoke.js';

export const ROOF = -2200;
// the water: brown, with a wavy surface, foam and bits of debris drifting with the stream (to the right)
export function water(t, level, o = {}) {
  const x0 = -2400, x1 = 2400, bottom = 3000;
  g.beginPath(); g.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 40) g.lineTo(x, level + 10 * Math.sin(x * 0.012 - t * 3) + 6 * noise(x * 0.01 + t, 2));
  g.lineTo(x1, bottom); g.closePath();
  const gr = g.createLinearGradient(0, level, 0, level + 900); gr.addColorStop(0, 'rgba(140,110,70,0.96)'); gr.addColorStop(1, 'rgba(90,70,45,0.98)');
  g.fillStyle = gr; g.fill();
  g.save(); g.lineWidth = 6; g.strokeStyle = 'rgba(240,230,210,0.7)'; g.beginPath();
  for (let x = x0; x <= x1; x += 40) { const y = level + 10 * Math.sin(x * 0.012 - t * 3) + 6 * noise(x * 0.01 + t, 2); x === x0 ? g.moveTo(x, y) : g.lineTo(x, y); }
  g.stroke(); g.restore();
  for (let i = 0; i < 10; i++) {                             // the stream: streaks and debris drifting right
    const ph = (t * 0.25 + hash(i * 3.3)) % 1, x = lerp(x0, x1, ph), y = level + 40 + 300 * hash(i * 1.7);
    limb([[x - 60, y], [x + 60, y]], 4, 'rgba(230,215,190,0.35)');
    if (i % 3 === 0) rrect(x - 30, level - 8, 60, 14, 4, '#6b4a33');
  }
}
// a car at (x, level) swept along and tipped by angle a
export function car(x, y, a = 0, c = '#c94a3a') {
  g.save(); g.translate(x, y); g.rotate(a);
  rrect(-170, -90, 340, 80, 24, c); fill(polyPath([[-100, -90], [-60, -150], [70, -150], [110, -90]]), c);
  fill(polyPath([[-88, -92], [-56, -140], [0, -140], [0, -92]]), '#9fc0d6'); fill(polyPath([[12, -92], [12, -140], [64, -140], [96, -92]]), '#9fc0d6');
  ell(-100, -10, 34, 34, '#2b2f38'); ell(100, -10, 34, 34, '#2b2f38'); ell(-100, -10, 14, 14, '#9aa3ad'); ell(100, -10, 14, 14, '#9aa3ad');
  g.restore();
}
// a tree and a wooden pole standing in the water, leaning as the stream washes them out (lean 0…1)
export function treeAndPole(t, level, lean = 0) {
  const sway = 0.03 * Math.sin(t * 2);
  g.save(); g.translate(-420, level + 200); g.rotate(-(0.55 * ease.in(lean) + sway));
  rect(-22, -900, 44, 900, '#6b4a33');
  for (const [dx, dy, r] of [[0, -980, 200], [-140, -860, 150], [140, -860, 150], [0, -760, 170]]) ell(dx, dy, r, r * 0.8, '#4f7f3a');
  g.restore();
  g.save(); g.translate(520, level + 200); g.rotate(0.45 * ease.in(clamp(lean * 1.2 - 0.1)) + sway);
  rect(-16, -1100, 32, 1100, '#7a5a3c'); rect(-120, -1040, 240, 18, '#5f4630'); for (const dx of [-100, 0, 100]) ell(dx, -1050, 9, 12, '#e6e9ec');
  g.restore();
  // the swirl of water round their feet
  for (let i = 0; i < 6; i++) { const ph = (t * 0.8 + i / 6) % 1; g.save(); g.globalAlpha = 1 - ph; g.lineWidth = 5; g.strokeStyle = 'rgba(240,230,210,0.8)'; g.beginPath(); g.ellipse(i < 3 ? -420 : 520, level + 4, 40 + 120 * ph, 10 + 20 * ph, 0, 0, TAU); g.stroke(); g.restore(); }
}
// the roof: a flat roof with its parapet, an aerial and a vent; drawn over the top of the facade
export function roof(t) {
  rect(-1400, ROOF - 30, 2800, 40, '#9a958a'); rect(-1400, ROOF, 2800, 60, '#b9b3a6');
  rect(700, ROOF - 220, 140, 190, '#8a857b'); rect(690, ROOF - 240, 160, 24, '#7a756b');
  limb([[-700, ROOF - 30], [-700, ROOF - 420]], 6, '#5d6570'); for (let i = 0; i < 4; i++) limb([[-780 + i * 10, ROOF - 360 + i * 30], [-620 - i * 10, ROOF - 360 + i * 30]], 4, '#5d6570');
}
// a white sheet held up in the hand at p, flapping
export function sheet(p, t) {
  const [x, y] = p, f = Math.sin(t * 7);
  fill(smoothPath([[x, y - 10], [x + 90 + 50 * f, y - 80 - 20 * f], [x + 200 + 70 * f, y - 40 + 30 * f], [x + 170 + 50 * f, y + 90], [x + 40, y + 60]]), '#f7f7f2');
  limb([[x + 30, y + 10], [x + 150 + 50 * f, y - 20 + 20 * f]], 4, '#d8d8d0');
}
// the torch flashing at p at night: a bright star of light, on and off (k 0…1)
export function torchFlash(p, t, k) {
  if (k <= 0.01) return;
  const on = (Math.floor(t * 3) % 2) === 0 ? 1 : 0.15;
  g.save(); g.globalAlpha = k * on;
  const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 260); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,240,180,0.5)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = gr; g.fillRect(p[0] - 260, p[1] - 260, 520, 520);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; limb([[p[0] + Math.cos(a) * 30, p[1] + Math.sin(a) * 30], [p[0] + Math.cos(a) * 120, p[1] + Math.sin(a) * 120]], 5, '#fff6c8'); }
  g.restore();
}
// a document folder and a water bottle (props)
export function folder(p) { g.save(); g.translate(p[0], p[1]); g.rotate(-0.15); rrect(-40, -54, 80, 108, 6, '#3c7ad6'); rect(-30, -40, 60, 8, '#f4f2ec'); g.restore(); }
export function bottle(p) { g.save(); g.translate(p[0], p[1]); rrect(-16, -50, 32, 90, 10, 'rgba(160,210,240,0.85)'); rect(-8, -66, 16, 18, '#3c7ad6'); g.restore(); }
