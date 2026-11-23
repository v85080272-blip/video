// The «bait» cover: the frame people see before they tap. YouTube picks a Shorts thumbnail from the middle of the clip
// unless one is set, so this frame goes both into the clip's first frames and out as a JPEG for the thumbnail.
// The owner, 21.11: «превью байтящее, чтоб человеку хотелось нажать». Rules: one big scared face, 2–3 huge words
// in a thick ink outline, one red mark on the danger, saturated colours. All in screen space (1080×1920).
import { lerp, hash, TAU } from './lib.js';
import { g, ell, limb, poly } from './flat.js';
import { measure, FONTS, INK } from './type.js';

// a line of huge text with a thick ink outline and a drop, shrunk to fit maxW
export function outlined(str, x, y, size, color, o = {}) {
  const fam = o.fam ?? FONTS.block, maxW = o.maxW ?? 1000;
  let w = measure(str, size, fam);
  if (w > maxW) { size *= maxW / w; measure(str, size, fam); }
  g.save(); g.translate(x, y); g.rotate(o.rot ?? -0.04);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.lineWidth = size * 0.24; g.strokeStyle = INK; g.strokeText(str, size * 0.05, size * 0.08);
  g.fillStyle = INK; g.fillText(str, size * 0.05, size * 0.08);
  g.strokeText(str, 0, 0);
  g.fillStyle = color; g.fillText(str, 0, 0);
  g.restore();
}
// a tilted plate with a word on it (e.g. «ЧТО ДЕЛАТЬ?»)
export function plate(str, x, y, size, bg, fg = '#ffffff', rot = 0.03) {
  const w = measure(str, size, FONTS.block) + size * 0.9, h = size * 1.45;
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = INK; g.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
  g.fillStyle = bg; g.fillRect(-w / 2, -h / 2, w, h);
  measure(str, size, FONTS.block); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(str, 0, size * 0.06);
  g.restore();
}
// rays of light from (cx, cy)
export function rays(cx, cy, color, n = 14, alpha = 0.18, len = 2400) {
  g.save(); g.globalAlpha = alpha; g.fillStyle = color;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, d = TAU / n / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - d) * len, cy + Math.sin(a - d) * len); g.lineTo(cx + Math.cos(a + d) * len, cy + Math.sin(a + d) * len); g.closePath(); g.fill(); }
  g.restore();
}
// a dark edge round the frame so the middle pops
export function vignette(k = 0.55) {
  const r = g.createRadialGradient(540, 980, 380, 540, 980, 1250); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, `rgba(0,0,0,${k})`);
  g.fillStyle = r; g.fillRect(0, 0, 1080, 1920);
}
// a red ring with a cross, the mark on the danger
export function redMark(x, y, r, cross = true) {
  g.save(); g.lineCap = 'round';
  g.lineWidth = r * 0.22; g.strokeStyle = INK; g.beginPath(); g.arc(x + 6, y + 8, r, 0, TAU); g.stroke();
  g.strokeStyle = '#ff2d2d'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  if (cross) { const c = r * 0.55; g.lineWidth = r * 0.26; g.beginPath(); g.moveTo(x - c, y - c); g.lineTo(x + c, y + c); g.moveTo(x + c, y - c); g.lineTo(x - c, y + c); g.stroke(); }
  g.restore();
}
// a fat red arrow from a to b
export function arrow([x0, y0], [x1, y1], w = 46, color = '#ff2d2d') {
  const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
  g.save(); g.translate(x0, y0); g.rotate(a);
  for (const [dx, c] of [[8, INK], [0, color]]) { g.save(); g.translate(dx, dx); g.fillStyle = c; g.beginPath(); g.moveTo(0, -w / 2); g.lineTo(L - w * 1.4, -w / 2); g.lineTo(L - w * 1.4, -w * 1.2); g.lineTo(L, 0); g.lineTo(L - w * 1.4, w * 1.2); g.lineTo(L - w * 1.4, w / 2); g.lineTo(0, w / 2); g.closePath(); g.fill(); g.restore(); }
  g.restore();
}
// bubbles rising in water
export function bubbles(seed = 1, n = 26, y0 = 0, y1 = 1920) {
  for (let i = 0; i < n; i++) { const x = 80 + 920 * hash(i * 3.1 + seed), y = lerp(y0, y1, hash(i * 7.7 + seed)), r = 8 + 22 * hash(i * 1.9 + seed); g.save(); g.globalAlpha = 0.55; g.lineWidth = 4; g.strokeStyle = '#d9f4ff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.globalAlpha = 0.5; ell(x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.25, '#ffffff'); g.restore(); }
}
