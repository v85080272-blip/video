// The places of «Правда или миф», №9 «Собака» in flat shapes, straight in screen space; each subject sits near x = 540
// so that a 352-px column shows it. A park by day (sky, a path, bushes); a person in a blue jacket who can run, stand
// «like a tree», reach out to pet, stare or look away and step back; a stray dog (Пурга's rig in brown) that runs, eats
// from a bowl, sits, lays its ears back; the bowl, «Р-Р-Р», «Zzz», the gaze line.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
import { drawDog, DOG } from './dog.js';

export const FLOOR = 1000;
const SKIN = '#f2c19b', SKIN_D = '#d9a07a', HAIR = '#4a2f22', JACKET = '#3f7fd8', JACKET_D = '#2f62ad', JEANS = '#2c3550', SHOE = '#1f2230';
function grad(stops, y0 = 0, y1 = 1920, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
// a park by day: sky, far trees, a lawn and a sandy path
export function park(t, o = {}) {
  grad([[0, o.sky ?? '#9fd8f5'], [1, o.sky2 ?? '#e4f5fb']], 0, FLOOR - 160);
  for (let i = 0; i < 9; i++) { const x = -120 + i * 160, r = 90 + 30 * ((i * 37) % 5) / 5; ell(x, FLOOR - 240, r, r * 0.9, i % 2 ? '#7cc36a' : '#69b35c'); rect(x - 10, FLOOR - 200, 20, 60, '#7a5a3c'); }
  grad([[0, '#8fd06f'], [1, '#6fb556']], FLOOR - 160, 1920);
  fill(smoothPath([[-400, FLOOR - 40], [1480, FLOOR - 70], [1480, FLOOR + 60], [-400, FLOOR + 90]]), '#e8d3a5');
  for (let i = 0; i < 14; i++) ell(-80 + i * 90, FLOOR + 140 + 30 * Math.sin(i * 1.7), 20, 8, '#5fa64a');
}
// the stray dog: Пурга's rig recoloured brown with a darker back; everything drawDog takes, plus o.growl (ears back, «Р-Р-Р»)
const STRAY = { coat: '#c08a52', coatSh: '#9c6b3c', saddle: '#7a5232', saddleSh: '#5f3f26', collar: '#7a5232', tag: '#7a5232' };
export function stray(o) {
  const keep = {}; for (const k of Object.keys(STRAY)) { keep[k] = DOG[k]; DOG[k] = STRAY[k]; }
  const r = drawDog({ ears: 0.15, ...o, ears: Math.max(o.ears ?? 0.15, o.growl ?? 0) });
  for (const k of Object.keys(keep)) DOG[k] = keep[k];
  return r;
}
export function growl(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = Math.min(1, k * 2); g.translate(x + 3 * Math.sin(t * 40), y); g.rotate(-0.08); g.scale(k, k);
  text('Р-Р-Р!', 0, 0, 58, '#e53935', { fam: FONTS.block }); g.restore();
}
export function zzz(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  for (let i = 0; i < 3; i++) { const u = (t * 0.6 + i / 3) % 1; text('Z', x + 30 * u + i * 6, y - 90 * u, 34 + 18 * i, '#ffffff', { fam: FONTS.block, a: 1 - u }); }
  g.restore();
}
export function bowl(x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  ell(0, -34, 86, 22, '#8b5a2b'); for (let i = 0; i < 7; i++) ell(-60 + i * 20, -40 - 6 * Math.sin(i), 14, 9, '#a86b35');
  fill(smoothPath([[-92, -34], [92, -34], [70, 6], [-70, 6]]), '#e53935'); rect(-70, -2, 140, 8, '#b71c1c');
  text('МИСКА', 0, -8, 22, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
// a person in a blue jacket, feet at (x, y), ≈ 400·s tall, facing right (face 1) or left (-1).
// o.run 0…1 (+ o.ph): running; o.tree 0…1: standing straight, arms pressed to the body; o.reach 0…1: the front arm out to
// pet; o.stare 0…1: wide eyes; o.away 0…1: the head turned away, eyes down; o.step: a slow step back (phase)
export function person(x, y, s, t, o = {}) {
  const f = o.face ?? 1, run = clamp(o.run ?? 0), tree = clamp(o.tree ?? 0), ph = (o.ph ?? t * 2.2) * TAU;
  g.save(); g.translate(x, y - 10 * run * Math.abs(Math.sin(ph))); g.scale(s * f, s);
  const lean = 0.18 * run;
  g.rotate(lean);
  const leg = k => { const a = run * 0.7 * Math.sin(ph + k) + 0.12 * (o.step ?? 0) * Math.sin(t * 3 + k); return [Math.sin(a) * 170, -Math.cos(a) * 170 + 170]; };
  for (const [k, c] of [[Math.PI, '#232b42'], [0, JEANS]]) {
    const [dx, dy] = leg(k), knee = [dx * 0.5 + 12 * run, -95 + dy * 0.5 - 14 * run];
    limb([[0, -180], knee, [dx, -10 + dy * 0.05]], 34, c, false); ell(dx + 14, -6, 30, 14, SHOE);
  }
  rrect(-48, -330, 96, 170, 30, JACKET); rect(-4, -320, 8, 150, JACKET_D);
  // arms: running swing, «tree» (pressed to the body), reaching out
  const arm = (k, back) => {
    const sw = run * 0.9 * Math.sin(ph + k), out = back ? 0 : clamp(o.reach ?? 0);
    const sh = [back ? -26 : 26, -306];
    const hand = tree > 0.5 && !out ? [back ? -40 : 40, -168] : [sh[0] + Math.sin(sw + out * 1.35) * 150 + (1 - tree) * 8, sh[1] + Math.cos(sw + out * 1.35) * 150];
    const el = [lerp(sh[0], hand[0], 0.5) - 14 * (1 - out), lerp(sh[1], hand[1], 0.5) + 6];
    limb([sh, el, hand], 28, back ? JACKET_D : JACKET, false); ell(hand[0], hand[1], 17, 17, SKIN);
  };
  arm(Math.PI, true);
  // head
  const hy = -390, aw = clamp(o.away ?? 0);
  ell(4, -322, 22, 16, SKIN_D);
  ell(0, hy, 54, 60, SKIN);
  fill(smoothPath([[-56, hy - 6], [-50, hy - 56], [0, hy - 70], [46, hy - 52], [56, hy - 20], [20, hy - 44], [-30, hy - 30]]), HAIR);
  const st = clamp(o.stare ?? 0), ex = lerp(24, -18, aw), ey = hy - 6 + 14 * aw, er = 7 + 7 * st;
  if (aw < 0.5) { ell(ex, ey, er, er * 1.2, '#ffffff'); ell(ex + 3, ey, er * 0.55, er * 0.7, INK); }
  else limb([[ex - 9, ey], [ex + 9, ey + 2]], 5, INK, false);
  limb([[ex - 12, ey - 18 - 6 * st], [ex + 12, ey - 20 - 8 * st]], 5, HAIR, false);
  limb([[lerp(34, 6, aw), hy + 30], [lerp(48, 18, aw), hy + 28]], 5, '#a05a4a', false);
  arm(0, false);
  g.restore();
}
// the gaze: a dashed line from the eyes to the dog's eyes, with two «laser» tips
export function gaze(a, b, k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k; g.setLineDash([22, 14]); g.lineWidth = 10; g.strokeStyle = '#e53935'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(lerp(a[0], b[0], k), lerp(a[1], b[1], k)); g.stroke(); g.setLineDash([]); g.restore();
}
// a little tree beside the person: «stand like a tree»
export function treeIcon(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rect(-10, -60, 20, 60, '#7a5a3c'); ell(0, -100, 56, 60, '#3f9a4a'); ell(-24, -80, 34, 30, '#4fae5a'); g.restore();
}
