// «Чернобыль: к реактору» («Зона», серия 1, в 3D): only the 2D layer over the Blender shots — the place and time, the
// dosimeter in the corner, the four rules, the arch against the Statue of Liberty, the date of the evacuation, the choice,
// the subtitles, the dips to black at the cuts. The picture is rendered by blender/zone.py (one run per shot) and put
// together by tools/bg.py; render.mjs draws this layer on a transparent canvas (OVERLAY=1 FPS=30) and ffmpeg lays it over.
// Every beat is anchored to the narrator's words. The shots, one per line (the last holds L7 and L8):
//   A L0 road · B N1 arch · C L1 bumper cars · D L2 moss · E L3 sign · F N3 water · G L4 wheel · H N2 street · I L5 dogs ·
//   J L6 frame · K L7–L8 end
import fs from 'node:fs';
import { lerp, clamp, ease, spring } from './lib.js';
import { g, W, H, rect, rrect, ell, fill, rrPath, polyPath } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const ORDER = SCRIPT.lines.map(l => l.id);
const LN = id => VOICE?.lines.find(l => l.id === id);
// before the voice exists: a rough timing from the word counts (0.38 s a word and the pauses of the script)
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) {
    const n = l.text.split(/\s+/).filter(w => w !== '—').length;
    t += l.after ?? 0; FB[l.id] = [t, t + n * 0.38, n]; t += n * 0.38;
  }
}
export const DUR = VOICE?.dur ?? FB.L8[1] + 0.4;
const A = {};
for (const id of ORDER) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 78; Hd.SUB.lead = 92;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ЧЕРНОБЫЛЯ: GOLD, ГИДОМ: GOLD, ПРОПУСКУ: GOLD, МЕТРОВ: GOLD, СВОБОДЫ: GOLD, ОДЕЖДА: OK, ТРОГАЙ: DANGER, ЗЕМЛЮ: DANGER,
  МОХ: DANGER, ГУБКА: DANGER, ЗАДЕРЖИВАЙСЯ: GOLD, ДОЗА: OK, УЛИЦЕ: DANGER, ВНУТРЬ: DANGER, ПРИПЯТЬ: GOLD, ШЕСТОГО: GOLD,
  ЧАСОВ: GOLD, ДНЯ: DANGER, СОБАК: GOLD, НЕЛЬЗЯ: DANGER, ЧИСТО: OK, САМОЛЁТЕ: GOLD, ДУГА: GOLD, ЛЕС: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const SH = [['A', 'L0'], ['B', 'N1'], ['C', 'L1'], ['D', 'L2'], ['E', 'L3'], ['F', 'N3'], ['G', 'L4'], ['H', 'N2'], ['I', 'L5'], ['J', 'L6'], ['K', 'L7']];
const T = {};
SH.forEach(([s, id], i) => { T['c' + s] = i === 0 ? 0 : A[id] - 0.06; });
T.c8 = A.L8 - 0.06;
T.lamp = T.cJ + (T.cK - T.cJ) * 0.52;            // the frame's lamp goes green (zone.py: at 0.5–0.55 of the shot)
export const SHOTS = SH.map(([s], i) => [s, T['c' + s], i + 1 < SH.length ? T['c' + SH[i + 1][0]] : DUR]);
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const inShot = (t, s) => { const x = SHOTS.find(q => q[0] === s); return t >= x[1] && t < x[2]; };

// —— the dosimeter in the top right corner: a yellow case, a green screen, µSv/h; it reads what the shot is near ——
const READ = { A: [0.31, 0.38], B: [1.1, 1.4], C: [0.42, 0.47], D: [0.45, 9.8], E: [2.6, 2.9], F: [0.36, 0.4], G: [0.52, 0.6],
  H: [0.48, 0.55], I: [0.9, 1.0], J: [0.14, 0.12], K: [0.12, 0.11] };
function dosimeter(t) {
  const sh = SHOTS.find(q => t >= q[1] && t < q[2]) ?? SHOTS[SHOTS.length - 1];
  const [v0, v1] = READ[sh[0]], u = clamp((t - sh[1]) / Math.max(0.1, sh[2] - sh[1]));
  let v = sh[0] === 'D' ? lerp(v0, v1, ease.in(clamp((u - 0.3) / 0.45))) : lerp(v0, v1, u);
  v *= 1 + 0.04 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
  const high = v > 2, blink = high && (t * 3) % 1 < 0.5;
  const a = clamp(t / 0.4) * (1 - seg(T.c8 + 0.2, T.c8 + 0.6, t));
  if (a <= 0.01) return;
  const x = 1080 - 60 - 250, y = 118, w = 250, h = 112;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18; g.shadowOffsetY = 6; fill(rrPath(x, y, w, h, 18), '#f2b705'); g.restore();
  fill(rrPath(x + 12, y + 12, w - 24, h - 40, 10), high ? (blink ? '#ff5a4a' : '#d9473a') : '#9fd39b');
  const s = v < 10 ? v.toFixed(2).replace('.', ',') : v.toFixed(1).replace('.', ',');
  text(s, x + w - 26, y + 62, 52, '#14231a', { fam: FONTS.mono, align: 'right', shadow: false });
  text('мкЗв/ч', x + 22, y + h - 10, 24, INK, { fam: FONTS.mono, align: 'left', shadow: false });
  ell(x + w - 30, y + h - 18, 8, 8, high ? '#e53935' : '#2f7d32');
  g.restore();
}

// —— the arch against the Statue of Liberty: two bars to scale, 108 m and 93 m ——
function heights(t, t0, t1) {
  const a = clamp((t - t0) / 0.2) * (1 - clamp((t - t1) / 0.25));
  if (a <= 0.01) return;
  const base = 1240, k = 4.4, x1 = 690, x2 = 900;
  const g1 = seg(t0, t0 + 0.7, t, ease.out), g2 = seg(t0 + 0.35, t0 + 1.05, t, ease.out);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  fill(rrPath(x1 - 60, base - 108 * k * g1, 120, 108 * k * g1, 12), 'rgba(205,212,220,0.92)');
  const h2 = 93 * k * g2;                               // the statue: a stepped silhouette on its pedestal, the torch up
  g.save(); g.translate(x2, base); g.fillStyle = 'rgba(120,200,170,0.95)';
  g.fill(polyPath([[-48, 0], [48, 0], [40, -h2 * 0.5], [22, -h2 * 0.52], [18, -h2 * 0.82], [8, -h2 * 0.88], [14, -h2 * 0.94], [10, -h2], [2, -h2],
    [-2, -h2 * 0.9], [-12, -h2 * 0.86], [-20, -h2 * 0.6], [-22, -h2 * 0.52], [-40, -h2 * 0.5]]));
  g.restore();
  rect(x1 - 120, base, 380, 4, '#ffffff');
  text('108 м', x1, base - 108 * k * g1 - 18, 52, '#ffffff', { fam: FONTS.block });
  text('93 м', x2, base - h2 - 18, 44, '#ffffff', { fam: FONTS.block, a: g2 });
  text('АРКА', x1, base + 50, 34, '#ffffff', { fam: FONTS.mono }); text('СТАТУЯ СВОБОДЫ', x2 + 10, base + 50, 28, '#ffffff', { fam: FONTS.mono, a: g2 });
  g.restore();
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 1 - ease.out(clamp(t / 0.45));
  for (const c of CUTS) if (t >= c && t < c + 0.2) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  const st = { y: 170, color: '#e6c84a', dot: '#e6c84a' };
  Hd.timeStamp(t, 0.35, T.cC - 0.2, 'ЗОНА · 4-Й ЭНЕРГОБЛОК', st);
  Hd.timeStamp(t, T.cC + 0.2, T.cH - 0.2, 'ПРИПЯТЬ · ПАРК', st);
  Hd.timeStamp(t, T.cH + 0.2, T.cI - 0.2, 'ПРИПЯТЬ · 27.04.1986', { ...st, dot: DANGER });
  Hd.timeStamp(t, T.cI + 0.2, DUR, 'ЧАЭС · КПП', st);
  dosimeter(t);
  if (inShot(t, 'A')) Hd.plaque(t, A.L0w5, T.cB - 0.05, 540, 420, { icon: 'check', title: 'ТОЛЬКО С ГИДОМ', sub: 'и по пропуску; сейчас Зона закрыта', color: GOLD, size: 44 });
  if (inShot(t, 'B')) {
    Hd.plaque(t, A.N1w1, T.cC - 0.05, 540, 330, { icon: 'house', title: 'АРКА НАД РЕАКТОРОМ', sub: '257 м в пролёте, 2016', color: GOLD, size: 42 });
    heights(t, A.N1w4 - 0.1, T.cC - 0.05);
  }
  Hd.stepHeader(t, 1, 'ЗАКРЫТАЯ ОДЕЖДА', A.L1 + 0.02, A.L1e - 0.05);
  if (inShot(t, 'C')) Hd.plaque(t, A.L1w3 - 0.05, T.cD - 0.05, 540, 470, { icon: 'x', title: 'НЕ ТРОГАЙ · НЕ САДИСЬ', sub: 'и вещи на землю не клади', color: DANGER, size: 40 });
  Hd.stepHeader(t, 2, 'ОБХОДИ МОХ', A.L2 + 0.02, A.L2e - 0.05);
  if (inShot(t, 'D')) Hd.plaque(t, A.L2w3 - 0.05, T.cE - 0.05, 540, 470, { icon: 'x', title: 'МОХ КОПИТ ЦЕЗИЙ', sub: 'дозиметр в разы выше', color: DANGER, size: 40 });
  Hd.stepHeader(t, 3, 'МЕНЬШЕ ВРЕМЕНИ', A.L3 + 0.02, A.L3e - 0.05);
  if (inShot(t, 'E')) Hd.plaque(t, A.L3w3 - 0.05, T.cF - 0.05, 540, 470, { icon: 'clock', title: 'ДОЗА = ФОН × ВРЕМЯ', sub: 'прошёл быстрее — получил меньше', color: OK, size: 40 });
  Hd.stepHeader(t, 4, 'НЕ ЕШЬ НА УЛИЦЕ', A.N3 + 0.02, A.N3e - 0.05);
  if (inShot(t, 'F')) Hd.plaque(t, A.N3w8 - 0.05, T.cG - 0.05, 540, 470, { icon: 'bottle', title: 'ПЫЛЬ С РУК — ВНУТРЬ', sub: 'ешь и пей только в помещении', color: DANGER, size: 40 });
  if (inShot(t, 'G')) Hd.plaque(t, A.L4w4 - 0.05, T.cH - 0.05, 540, 330, { icon: 'calendar', title: '1 МАЯ 1986', sub: 'открытие парка; авария — 26 апреля', color: GOLD, size: 46 });
  if (inShot(t, 'H')) {
    Hd.plaque(t, A.N2w2 - 0.05, T.cI - 0.05, 540, 330, { icon: 'clock', title: 'ЧЕРЕЗ 36 ЧАСОВ', sub: '27 апреля, 14:00 — автобусы', color: WARM, size: 42 });
    Hd.plaque(t, A.N2w7 - 0.1, T.cI - 0.05, 540, 520, { icon: 'comment', title: '«НА ТРИ ДНЯ»', sub: 'около 45 000 человек', color: DANGER, size: 46 });
  }
  if (inShot(t, 'I')) Hd.plaque(t, A.L5w4 - 0.05, T.cJ - 0.05, 540, 420, { icon: 'x', title: 'НЕ ГЛАДЬ', sub: 'на шерсти бывает пыль', color: DANGER, size: 46 });
  if (inShot(t, 'J')) {
    const k = clamp(sp(t, T.lamp, 2.6, 8));
    if (k > 0.01) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.scale(k, k);
      fill(rrPath(-190, -62, 380, 124, 26), 'rgba(11,26,16,0.9)'); g.lineWidth = 5; g.strokeStyle = OK; g.stroke(rrPath(-187, -59, 374, 118, 24));
      text('ЧИСТО', 0, 26, 74, OK, { fam: FONTS.block, shadow: false }); g.restore();
    }
    Hd.plaque(t, A.L6w5 - 0.05, T.cK - 0.05, 540, 600, { icon: 'check', title: 'ЗА ДЕНЬ ≈ 2–7 мкЗв', sub: 'как 1–2 часа в самолёте', color: OK, size: 40 });
  }
  if (t >= T.cK) {
    [['1', 'РАДАР «ДУГА»', A.L7w1], ['2', 'РЫЖИЙ ЛЕС', A.L7w5]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c8, T.c8 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c8) Hd.plaque(t, A.L8w1 - 0.1, DUR + 1, 540, 730, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 2 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L8w12 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
}
export function motion() { return 0; }

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.0, 'zone_wind', -14, 0, { dur: DUR });
  // the dosimeter, quiet all through; fast over the moss, a burst by the sign
  for (const [s, e] of SHOTS) {
    const r = { D: [3, 40], E: [14, 18], B: [7, 9], I: [5, 6] }[s] ?? [2.5, 3];
    add(e, 'geiger', s === 'D' ? -9 : -15, 0.5, { dur: SHOTS.find(q => q[0] === s)[2] - e, rate: r[0], rate2: r[1] });
  }
  add(T.cA + 0.1, 'steps_out', -12, 0, { dur: T.cB - T.cA - 0.2 });
  add(T.cB + 0.6, 'crow', -16, -0.6); add(T.cG + 1.2, 'crow', -18, 0.5);
  add(T.cC + (T.cD - T.cC) * 0.42, 'cloth', -10, 0.2);
  add(T.cE, 'steps_out', -10, 0.1, { dur: T.cF - T.cE - 0.2 });
  add(T.cF + (T.cG - T.cF) * 0.3, 'bottle', -8, -0.2); add(T.cF + (T.cG - T.cF) * 0.8, 'bottle', -12, -0.2);
  add(T.cG + 0.2, 'wheel_creak', -10, 0.3, { dur: Math.min(2.6, T.cH - T.cG - 0.4) });
  add(T.cH + 0.3, 'bus_far', -12, 0, { dur: T.cI - T.cH - 0.4 });
  add(T.cI + 0.4, 'sniff', -8, -0.1, { dur: 1.0 }); add(T.cI + 1.8, 'sniff', -10, 0.2, { dur: 0.8 });
  add(T.cJ + 0.1, 'steps_out', -12, 0, { dur: (T.cK - T.cJ) * 0.5 });
  add(T.lamp, 'beep', -8, 0, { dur: 0.35, f: 1320 }); add(T.lamp + 0.08, 'ding', -12, 0);
  for (let i = 0; i < 2; i++) add((i ? A.L7w5 : A.L7w1) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L8w1 - 0.1, 'blip', -8, 0);
  add(A.L8w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
