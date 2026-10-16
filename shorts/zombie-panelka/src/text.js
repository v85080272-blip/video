// On-screen text: word-by-word subtitles, the dripping title, step slams, the countdown HUD, the end card.
import { g, W, H, glow } from './draw.js';
import { clamp, lerp, ease, spring, inv, rgba, noise } from './lib.js';

export const SUB = { y: 470, size: 92, maxW: 800, cx: 510 };
const HOT = {                                      // keyword → highlight colour
  'ЗОМБИ-АПОКАЛИПСИС': '#9be15d', 'ДЕВЯТОМ': '#ffd23f', 'КОТОМ': '#ff9d3a', 'ДЕСЯТЬ': '#ff4d4d', 'ПОГАСНЕТ': '#ff4d4d',
  'ДВЕРЬ': '#9be15d', 'ЗАДВИЖКУ': '#ffd23f', 'ШКАФ': '#ffd23f', 'НЕВИДИМЫМ': '#9be15d', 'ШТОРЫ': '#ffd23f', 'СВЕТ': '#ffd23f',
  'БЕЗЗВУЧНЫЙ': '#ffd23f', 'ВОДА': '#7cc8ff', 'ВАННУ': '#7cc8ff', 'НАСОСЫ': '#ff4d4d', 'РЮКЗАК': '#9be15d', 'КОТ': '#ff9d3a',
  'ОТХОДА': '#9be15d', 'ЛОВУШКА': '#ff4d4d', 'ОНИ': '#ff4d4d', 'КРЫШЕ': '#9be15d', 'ГАСНЕТ': '#ff4d4d', 'УСПЕЛ': '#9be15d',
  'СКРЕБЁТСЯ': '#ff4d4d', 'ОТКРЫЛ': '#ff4d4d', 'ПИРОЖКОВ': '#ffb35c', 'ВНУЧОК': '#ffb35c', 'ВОДЫ': '#7cc8ff',
};
const clean = w => w.replace(/[.,!?…:;«»]/g, '').toUpperCase();

// words: [{w, s, e}] absolute times; groups of ≤ 3 words / 17 letters, each shown from its first word until the next group
export function groupWords(words, maxWords = 3, maxChars = 17) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (const w of words) {
    if (w.w === '—' || w.w === '-') continue;
    const len = cur.reduce((a, x) => a + clean(x.w).length + 1, 0) + clean(w.w).length;
    if (cur.length >= maxWords || (cur.length && len > maxChars)) flush();
    cur.push(w);
    if (/[.?!]$/.test(w.w)) flush();
  }
  flush();
  return out;
}

function outlined(text, x, y, fill, size, o = {}) {
  g.font = `700 ${size}px Oswald`;
  g.lineJoin = 'round'; g.miterLimit = 2;
  g.lineWidth = size * 0.2; g.strokeStyle = 'rgba(10,6,14,.95)'; g.strokeText(text, x, y + size * 0.05);
  g.lineWidth = size * 0.16; g.strokeStyle = '#120d18'; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
  if (o.glowA) { g.save(); g.globalAlpha = o.glowA; g.globalCompositeOperation = 'lighter'; g.fillText(text, x, y); g.restore(); }
}

// draw the subtitle groups active at t; groups = groupWords(...) with absolute times; endT = when the last group hides
export function subtitles(t, groups, o = {}) {
  let gi = -1;
  for (let i = 0; i < groups.length; i++) if (t >= groups[i][0].s - 0.04) gi = i;
  if (gi < 0) return;
  const grp = groups[gi];
  const next = groups[gi + 1];
  const hideAt = Math.min(next ? next[0].s - 0.04 : Infinity, grp[grp.length - 1].e + (o.hold ?? 0.6));
  if (t > hideAt) return;
  const size = o.size ?? SUB.size;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `700 ${size}px Oswald`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  // layout: one or two lines
  const words = grp.map(w => ({ ...w, txt: clean(w.w) }));
  const sp = size * 0.26;
  for (const w of words) w.wd = g.measureText(w.txt).width;
  let lines = [words];
  const total = words.reduce((a, w) => a + w.wd, 0) + sp * (words.length - 1);
  if (total > SUB.maxW && words.length > 1) { const k = Math.ceil(words.length / 2); lines = [words.slice(0, k), words.slice(k)]; }
  const y0 = (o.y ?? SUB.y) - (lines.length - 1) * size * 0.55;
  lines.forEach((ln, li) => {
    const lw = ln.reduce((a, w) => a + w.wd, 0) + sp * (ln.length - 1);
    let fit = Math.min(1, SUB.maxW / lw);
    let x = SUB.cx - lw * fit / 2;
    for (const w of ln) {
      const age = t - w.s;
      if (age < -0.04) { x += (w.wd + sp) * fit; continue; }
      const k = clamp((age + 0.04) / 0.08);
      const pop = 1 + 0.32 * (1 - spring(clamp(age + 0.04) * 1.0, 2.2, 9));
      const col = HOT[w.txt] || o.color || '#ffffff';
      g.save(); g.globalAlpha = k;
      const cx = x + w.wd * fit / 2, cy = y0 + li * size * 1.1 - size * 0.35;
      g.translate(cx, cy); g.scale(pop * fit, pop * fit); g.translate(-w.wd / 2, size * 0.35);
      outlined(w.txt, 0, 0, col, size, { glowA: HOT[w.txt] ? 0.12 : 0 });
      g.restore();
      x += (w.wd + sp) * fit;
    }
  });
  g.restore();
}

// big dripping title (the first line), shrunk to fit o.maxW
export function title(t, text, t0, o = {}) {
  const age = t - t0;
  if (age < 0) return;
  const a = clamp(age / 0.12) * (o.fade ?? 1);
  if (a <= 0) return;
  const s = 1 + 0.6 * (1 - spring(age, 1.8, 7));
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = a;
  g.font = `${o.size ?? 118}px WetPaint`; g.textAlign = 'center';
  const fit = Math.min(1, (o.maxW ?? 980) / g.measureText(text).width);
  g.translate(540 + noise(t * 30, 1) * 6 * clamp(1 - age), o.y ?? 420); g.rotate(-0.04 + noise(t * 2, 3) * 0.01); g.scale(s * fit, s * fit);
  g.lineJoin = 'round';
  g.lineWidth = 26; g.strokeStyle = '#0b0710'; g.strokeText(text, 0, 0);
  g.fillStyle = o.color ?? '#8fe04a'; g.fillText(text, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18 * a; g.fillText(text, 0, 0); g.restore();
  g.restore();
}

// step slam: huge dripping number at t0, the step's word under it at o.wordAt; o.colors = [top, bottom] of the number
export function slam(t, num, word, t0, dur, o = {}) {
  const age = t - t0;
  if (age < 0 || age > dur) return;
  const out = clamp((age - (dur - 0.15)) / 0.15);
  const s = 1 + 1.6 * (1 - spring(age * 1.1, 1.6, 8));
  const [c0, c1] = o.colors ?? ['#c6ff7a', '#54b82c'];
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1 - out;
  glow(540, 900, 620, c1, 0.22 * (1 - clamp(age / 0.6)));
  g.translate(540, 980); g.rotate(-0.06 + 0.06 * Math.sin(age * 9) * Math.exp(-age * 4)); g.scale(s, s);
  g.font = '520px WetPaint'; g.textAlign = 'center';
  g.lineJoin = 'round'; g.lineWidth = 46; g.strokeStyle = '#0b0710'; g.strokeText(num, 0, 0);
  const gr = g.createLinearGradient(0, -420, 0, 60); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillText(num, 0, 0);
  g.restore();
  // the word under it
  const wt = (o.wordAt ?? t0 + 0.12) - t0;
  const wa = clamp((age - wt + 0.04) / 0.1) * (1 - out);
  if (wa <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = wa;
  const ws = 1 + 0.3 * (1 - spring(Math.max(0, age - wt + 0.04), 2, 8));
  const size = 124;
  g.font = `700 ${size}px Oswald`;
  const fit = Math.min(1, 960 / g.measureText(word).width);
  g.translate(540, 1210); g.scale(ws * fit, ws * fit);
  g.textAlign = 'center';
  outlined(word, 0, 0, '#ffffff', size);
  g.restore();
}

// countdown HUD (seconds left in the story clock)
export function hud(t, secLeft, appear, o = {}) {
  if (appear <= 0) return;
  const a = clamp(appear);
  const m = Math.floor(secLeft / 60), s = Math.floor(secLeft % 60);
  const txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a;
  const x = o.x ?? 66, y = o.y ?? 176, sc = o.scale ?? 1;
  g.translate(x, y); g.scale(sc, sc);
  g.fillStyle = 'rgba(8,6,14,.72)';
  g.beginPath(); g.roundRect(0, 0, 300, 132, 26); g.fill();
  g.strokeStyle = 'rgba(255,80,80,.55)'; g.lineWidth = 4; g.stroke();
  g.font = '700 30px Oswald'; g.fillStyle = '#ffd9d9'; g.textAlign = 'left'; g.fillText('ДО ТЕМНОТЫ', 62, 42);
  const blink = Math.sin(t * 8) > 0 ? 1 : 0.35;
  g.fillStyle = `rgba(255,60,60,${blink})`; g.beginPath(); g.arc(34, 31, 11, 0, Math.PI * 2); g.fill();
  const urgent = secLeft < 60;
  g.font = '700 84px Oswald'; g.fillStyle = urgent ? '#ff4d4d' : '#ffffff';
  g.fillText(txt, 22, 118);
  g.restore();
}

export function endCard(t, t0) {
  const age = t - t0;
  if (age < 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const a = clamp(age / 0.25);
  g.globalAlpha = a;
  g.textAlign = 'center';
  const s = 1 + 0.25 * (1 - spring(age, 1.8, 8));
  g.translate(540, 820); g.scale(s, s);
  outlined('ТЫ БЫ ОТКРЫЛ?', 0, 0, '#ffffff', 132);
  g.restore();
  const b = clamp((age - 0.6) / 0.3);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = b; g.textAlign = 'center';
  g.font = '700 54px Oswald'; g.fillStyle = '#9be15d'; g.fillText('ЧАСТЬ 2 — СКОРО', 540, 940);
  g.font = '600 36px Oswald'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('ЗОМБИ В ПАНЕЛЬКЕ · СЕРИЯ 1', 540, 300);
  g.restore();
}
