// Lettering in the same flat language: solid letters with a solid offset shadow, single letters that fall, stamps.
import { g, col, rrPath, fill, polyPath } from './flat.js';
import { rgba, clamp, spring } from './lib.js';

export const FONTS = { block: 'Russo', cond: 'Oswald', black: 'InterBlack', mono: 'MonoBold' };
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
// word-by-word subtitles of the narration: groups of up to three words, each word pops in as it is spoken
export const SUB = { y: 1430, size: 86, maxW: 860, cx: 500 };      // above the Shorts caption, clear of the side buttons
// danger in orange-red, what to do in green
const DANGER = '#ff7a4d', DO = '#9be37a';
const HOT = { ВЗОРВАЛАСЬ: DANGER, АТОМНАЯ: DANGER, РАДИОАКТИВНУЮ: DANGER, ПЫЛЬ: DANGER, ИЗЛУЧЕНИЕ: DANGER, ЙОД: DANGER, ЙОДА: DANGER,
  ЗАКРОЙ: DO, ОКНА: DO, ДВЕРИ: DO, ЗАСЛОНКУ: DO, ВЫКЛЮЧИ: DO, ВЕНТИЛЯЦИЮ: DO, ПОГРЕБ: DO, БУТЫЛОК: DO, БАНОК: DO, ХОЛОДИЛЬНИКА: DO,
  РАДИО: DO, СУТКИ: DO, ЩИТОВИДКУ: '#ffd23f', ПОДПИСЫВАЙСЯ: '#ffd23f' };
const bare = w => w.replace(/[.,!?…:;«»]/g, '').toUpperCase();
// words: [{w, s, e}] in absolute seconds; sizes = how many words each group takes (dashes aside), so phrases like
// «всё равно» stay together; without sizes a group ends at a full stop or when it would grow past maxWords / maxChars
export function groupWords(words, sizes = null, maxWords = 3, maxChars = 16) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (const w of words) {
    if (w.w === '—' || w.w === '-') continue;
    if (sizes) {
      cur.push(w);
      if (cur.length >= sizes[out.length]) flush();
      continue;
    }
    const len = cur.reduce((a, x) => a + bare(x.w).length + 1, 0) + bare(w.w).length;
    if (cur.length >= maxWords || (cur.length && len > maxChars)) flush();
    cur.push(w);
    if (/[.?!]$/.test(w.w)) flush();
  }
  flush();
  return out;
}
// the group being spoken at t, from its first word until the next group starts (or `hold` after its last word)
export function subtitles(t, groups, o = {}) {
  let gi = -1;
  for (let i = 0; i < groups.length; i++) if (t >= groups[i][0].s - 0.05) gi = i;
  if (gi < 0) return;
  const grp = groups[gi], next = groups[gi + 1];
  const hideAt = Math.min(next ? next[0].s - 0.05 : Infinity, grp[grp.length - 1].e + (o.hold ?? 0.35));
  if (t > hideAt + 0.12) return;
  const out = clamp((t - hideAt) / 0.12), size = SUB.size;
  const words = grp.map(w => ({ ...w, txt: bare(w.w) }));
  const sp = size * 0.36;
  for (const w of words) w.wd = measure(w.txt, size, FONTS.cond);
  const lw = words.reduce((a, w) => a + w.wd, 0) + sp * (words.length - 1), fit = Math.min(1, SUB.maxW / lw);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  let x = SUB.cx - lw * fit / 2;
  for (const w of words) {
    const age = t - w.s + 0.05;
    if (age >= 0) {
      const s = 1 - spring(age, 2.6, 9), k = 1 + 0.14 * s - 0.2 * out, cx = x + w.wd * fit / 2;
      text(w.txt, cx, SUB.y + 14 * s, size * fit * k, HOT[w.txt] ?? '#fff3d6', { fam: FONTS.cond, a: Math.min(1, age / 0.05) * (1 - out) });
    }
    x += (w.wd + sp) * fit;
  }
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
