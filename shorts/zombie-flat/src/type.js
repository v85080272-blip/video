// Lettering in the same flat language: solid letters with a solid offset shadow, single letters that fall, stamps.
import { g, col, rrPath, fill, polyPath } from './flat.js';
import { rgba } from './lib.js';

export const FONTS = { block: 'Russo', cond: 'Oswald' };
export const INK = '#17162f';

function font(size, fam) { g.font = fam === FONTS.cond ? `700 ${size}px ${fam}` : `${size}px ${fam}`; }
export function measure(str, size, fam = FONTS.block) { font(size, fam); return g.measureText(str).width; }

// one run of text centred at (x, y) on its baseline, with a flat shadow below-right
export function text(str, x, y, size, color, o = {}) {
  const fam = o.fam ?? FONTS.block, a = o.a ?? 1;
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y);
  if (o.rot) g.rotate(o.rot);
  if (o.sx || o.sy) g.scale(o.sx ?? 1, o.sy ?? 1);
  font(size, fam);
  g.textAlign = o.align ?? 'center'; g.textBaseline = 'alphabetic';
  if (o.shadow !== false) { g.fillStyle = col(o.shadowColor ?? INK); g.fillText(str, size * 0.05, size * 0.07); }
  g.fillStyle = col(color); g.fillText(str, 0, 0);
  g.restore();
}
// a red stamp: rounded box and letters in one piece
export function stamp(str, x, y, size, o = {}) {
  const w = measure(str, size) + size * 0.6, h = size * 1.25, a = o.a ?? 1;
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(o.rot ?? 0); g.scale(o.k ?? 1, o.k ?? 1);
  fill(rrPath(-w / 2 + size * 0.06, -h / 2 + size * 0.09, w, h, size * 0.18), INK);
  fill(rrPath(-w / 2, -h / 2, w, h, size * 0.18), o.color ?? '#ff4d4d');
  font(size, FONTS.block); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col(o.ink ?? '#fff3d6'); g.fillText(str, 0, size * 0.04);
  g.restore();
}
// a red button with white letters ("subscribe"), scaled from its centre
export function pill(str, x, y, size, o = {}) {
  const a = o.a ?? 1, k = o.k ?? 1;
  if (a <= 0 || k <= 0) return;
  const w = measure(str, size, FONTS.cond) + size * 1.1, h = size * 1.6;
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(k, k);
  fill(rrPath(-w / 2 + size * 0.07, -h / 2 + size * 0.1, w, h, h / 2), INK);
  fill(rrPath(-w / 2, -h / 2, w, h, h / 2), o.color ?? '#ff4d4d');
  font(size, FONTS.cond); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col(o.ink ?? '#fff3d6'); g.fillText(str, 0, size * 0.04);
  g.restore();
}
// speech bubble with three dots: "write in the comments"
export function bubble(x, y, r, o = {}) {
  const a = o.a ?? 1, k = o.k ?? 1;
  if (a <= 0 || k <= 0) return;
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(k, k);
  const w = r * 2.3, h = r * 1.55;
  const body = rrPath(-w / 2, -h / 2, w, h, r * 0.5);
  const tail = polyPath([[-w * 0.18, h / 2 - 2], [-w * 0.36, h / 2 + r * 0.55], [-w * 0.02, h / 2 - 2]]);
  g.translate(r * 0.08, r * 0.1); fill(body, INK); fill(tail, INK); g.translate(-r * 0.08, -r * 0.1);
  fill(body, o.color ?? '#fff3d6'); fill(tail, o.color ?? '#fff3d6');
  for (let i = -1; i <= 1; i++) {
    const p = o.dots ? Math.max(0, Math.sin((o.dots - i * 0.18) * Math.PI * 2)) : 0;
    g.fillStyle = col(o.dot ?? '#ff8a3d'); g.beginPath(); g.arc(i * r * 0.55, -p * r * 0.12, r * 0.16, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
export { rgba };
