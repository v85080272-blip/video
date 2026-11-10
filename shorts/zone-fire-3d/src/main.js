// «Лес горит» («Зона», серия 5, в 3D): Blender draws the picture (blender/fire.py, one run per shot); this file draws the
// 2D layer on a transparent canvas (OVERLAY=1): the hook (ЛЕС ГОРИТ? / НЕ БЕГИ ПО ВЕТРУ!) from the very first frame, the
// dips at the cuts, the dosimeter, the plaques, the STOP with two buttons and a countdown, the 2020 facts, the next-place
// vote and «возьми с собой», the subtitles; and it gives the cues for the sound. On the rules of the Studio export (10.11).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 78; Hd.SUB.lead = 92;            // over 3D: low, clear of the people
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ЧЕРНОБЫЛЬСКОЙ: GOLD, ГОРИТ: DANGER, ВЕТРУ: DANGER, БЫСТРЕЕ: DANGER, ПОПЕРЁК: OK, ДОРОГЕ: OK, РЕКЕ: OK, РАДИОАКТИВНУЮ: DANGER,
  ПЫЛЬ: DANGER, СТОП: GOLD, ПРОСКОЧИТЬ: DANGER, МОКРОЙ: OK, ТКАНЬЮ: OK, ПРИГНУТЬСЯ: OK, ДВА: OK, ЧИЩЕ: OK, ПРОПУСКНОЙ: GOLD, РАДИАЦИЮ: DANGER,
  ПО_НАСТОЯЩЕМУ: DANGER, КИЛОМЕТРА: DANGER, КИЕВА: DANGER, СОБОЙ: GOLD };

// —— the beats: one shot per line ——
// L3: Стоп(0) Дым(1) уже(2) рядом(3) Один(4) —(5) проскочить(6) сквозь(7) него(8) Два(9) —(10) закрыть(11) нос(12) мокрой(13) тканью(14) и(15) пригнуться(16)
// L6: В(0) апреле(1) двадцатого(2) года(3) Зона(4) горела(5) по-настоящему(6) Огонь(7) подошёл(8) к(9) станции(10) на(11) два(12) километра(13) а(14) дым(15) дошёл(16) до(17) Киева(18)
// L7: Куда(0) пойдём(1) дальше(2) Пиши(3) в(4) комментариях(5) А(6) напиши(7) «возьми(8) с(9) собой»(10) —(11) и(12) пойдёшь(13) с(14) нами(15)
const T = { c1: A.L1 - 0.06, c2: A.L2 - 0.06, c3: A.L3 - 0.06, c4: A.L4 - 0.06, c5: A.L5 - 0.06, c6: A.L6 - 0.06, c7: A.L7 - 0.06, ans: A.L4 - 0.04 };
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c3], ['D', T.c3, T.c4], ['E', T.c4, T.c5], ['F', T.c5, T.c6], ['G', T.c6, T.c7], ['H', T.c7, DUR]];
export const EV = {};
export const STEP = { A: 3, B: 4, C: 3, D: 6, E: 3, F: 4, G: 6, H: 3 };          // the slow shots every 4th–6th frame, the rest in between (tools/bg.py)
export const NF = Object.fromEntries(SHOTS.map(([n, a, b]) => [n, Math.round((b - a) * 30) + STEP[n]]));
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS, ev: EV, step: STEP, nf: NF };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const shotAt = t => { let s = 'A'; for (const [n, a] of SHOTS) if (t >= a) s = n; return s; };

export function init() { Hd.initHud(); }

// —— the frame (OVERLAY): transparent but for what is drawn here; no fade-in at 0 s — the first frame is the hook ——
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = shotAt(t);
  if (process.env.OVERLAY !== '1') { g.fillStyle = '#6a7a8a'; g.fillRect(0, 0, W, H); text(sh, 540, 980, 300, '#4a5560', { fam: FONTS.block, shadow: false }); }
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.18) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.15)));
  if (dip > 0.002) { g.globalAlpha = dip * 0.85; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
}

// —— the dosimeter in the corner (µSv/h): up in the smoke ——
function dosimeter(t) {
  const sh = shotAt(t);
  const a = clamp((t - T.c1) / 0.4) * (1 - seg(T.c6 - 0.3, T.c6, t));
  if (a <= 0.01 || sh === 'D') return;
  const base = { B: 0.4, C: 0.4 + 2.0 * seg(T.c2, T.c3 - 0.4, t), E: 1.1, F: 0.35 }[sh] ?? 0.4, hot = sh === 'C' && t > A.L2w4;
  const v = base * (1 + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
  const x = 1080 - 60 - 250, y = 118, w = 250, h = 112, blink = hot && (t * 4) % 1 < 0.5;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = hot ? 'rgba(255,60,40,0.8)' : 'rgba(0,0,0,0.5)'; g.shadowBlur = hot ? 30 : 18; g.shadowOffsetY = 6; fill(rrPath(x, y, w, h, 18), '#f2b705'); g.restore();
  fill(rrPath(x + 12, y + 12, w - 24, h - 40, 10), hot ? (blink ? '#ff6b5a' : '#e8b0a8') : '#9fd39b');
  text(v.toFixed(2).replace('.', ','), x + w - 26, y + 62, 52, '#14231a', { fam: FONTS.mono, align: 'right', shadow: false });
  text('мкЗв/ч', x + 22, y + h - 10, 24, INK, { fam: FONTS.mono, align: 'left', shadow: false });
  ell(x + w - 30, y + h - 18, 8, 8, hot ? '#d62828' : '#2f7d32');
  g.restore();
}
function headline(t) {
  if (t > T.c1 + 0.3) return;
  const a = 1 - seg(T.c1 - 0.1, T.c1 + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = 'ЛЕС ГОРИТ?', sw = measure(s, 104) + 90; rrect(-sw / 2 + 10, -74 + 10, sw, 148, 24, INK); rrect(-sw / 2, -74, sw, 148, 24, '#ffd23f'); text(s, 0, 38, 104, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, T.c1 - 0.1, 'НЕ БЕГИ ПО ВЕТРУ!', { y: 500, size: 84 });
}
function progress(t) {
  const a = clamp((t - T.c1) / 0.3) * (1 - seg(T.c7 - 0.3, T.c7, t));
  if (a <= 0.01 || shotAt(t) === 'D') return;
  const marks = [['ОГОНЬ', 0], ['ДЫМ', T.c3], ['ПРОПУСК', T.c5], ['2020', T.c6]], x0 = 70, w = 940, y = 262, seg_ = w / marks.length;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  fill(rrPath(x0, y - 22, w, 44, 22), 'rgba(11,15,26,0.72)');
  marks.forEach(([s, t0], i) => {
    const next = i + 1 < marks.length ? marks[i + 1][1] : T.c7, done = t >= next, on = t >= t0 && !done, x = x0 + i * seg_;
    if (done || on) fill(rrPath(x + 6, y - 16, (seg_ - 12) * (done ? 1 : clamp((t - t0) / (next - t0))), 32, 16), done ? 'rgba(47,143,78,0.55)' : 'rgba(255,210,63,0.35)');
    text((done ? '✓ ' : '') + s, x + seg_ / 2, y + 9, 26, done ? '#c8f5d4' : on ? '#ffe9a0' : '#8b97ad', { fam: FONTS.mono, shadow: false });
  });
  g.restore();
}
function choice(t) {
  if (t < T.c3 || t >= T.c4 + 0.6) return;
  const done = t >= T.ans;
  [['1', 'ПРОСКОЧИТЬ СКВОЗЬ ДЫМ', -1, A.L3w4], ['2', 'ТКАНЬ НА НОС И ПРИГНУТЬСЯ', 1, A.L3w9]].forEach(([n, s, side, t0]) => {
    const k = clamp(sp(t, t0 - 0.08, 2.6, 8)) * (1 - seg(T.c4 + 0.2, T.c4 + 0.6, t)); if (k <= 0.01) return;
    const right = side > 0, c = done ? (right ? '#2f8f4e' : '#8a2a2a') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 240, 820); g.scale(k * (done && right ? 1 + 0.1 * bump(clamp((t - T.ans) / 0.3)) : 1), k);
    rrect(-225 + 6, -105 + 8, 450, 210, 30, INK); rrect(-225, -105, 450, 210, 30, c);
    text(n, 0, -16, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
    text(s, 0, 56, 30, tc, { fam: FONTS.cond, shadow: false });
    if (done) Hd.label(right ? '✓' : '✗', 185, -70, 60, '#ffffff', { shadow: false, stroke: false });
    g.restore();
  });
  if (t >= A.L3e && !done) {
    const u = clamp((t - A.L3e) / Math.max(0.6, T.ans - A.L3e));
    g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 960, 700, 26, 13), 'rgba(255,255,255,0.25)'); fill(rrPath(190, 960, 700 * (1 - u), 26, 13), GOLD);
    Hd.label('ДУМАЙ', 540, 1040, 44, '#ffffff', { fam: FONTS.mono });
  }
  if (t < A.L3w1) {
    const k = clamp(sp(t, A.L3w0 - 0.05, 3, 7));
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.12); g.scale(lerp(1.8, 1, Math.min(1, k)), lerp(1.8, 1, Math.min(1, k))); g.globalAlpha = Math.min(1, k * 3) * (1 - seg(A.L3w1 - 0.15, A.L3w1 + 0.1, t));
    rrect(-250 + 10, -100 + 10, 500, 200, 26, INK); rrect(-250, -100, 500, 200, 26, '#d62828'); text('СТОП', 0, 50, 140, '#fff3d6', { shadow: false }); g.restore();
  }
}
function overlays(t) {
  const sh = shotAt(t), P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  headline(t);
  Hd.timeStamp(t, T.c1 + 0.1, T.c6 - 0.1, 'ЧЕРНОБЫЛЬСКАЯ ЗОНА · 14:20', { color: WARM, dot: DANGER });
  dosimeter(t); progress(t); choice(t);
  if (sh === 'B') { P(A.L1w1, T.c2 - 0.05, 400, { icon: 'x', title: 'ПО ВЕТРУ ОГОНЬ БЫСТРЕЕ', color: DANGER, size: 44 }); P(A.L1w6, T.c2 - 0.05, 520, { icon: 'check', title: 'ПОПЕРЁК — К ДОРОГЕ ИЛИ РЕКЕ', color: OK, size: 40 }); }
  if (sh === 'C') P(A.L2w4, T.c3 - 0.05, 420, { icon: 'x', title: 'В ДЫМУ — РАДИОАКТИВНАЯ ПЫЛЬ', sub: 'огонь поднимает её из леса', color: DANGER, size: 38 });
  if (sh === 'E') { P(A.L4w1, T.c5 - 0.05, 400, { icon: 'drop', title: 'МОКРАЯ ТКАНЬ — НА НОС', color: OK, size: 44 }); P(A.L4w9, T.c5 - 0.05, 520, { icon: 'check', title: 'У ЗЕМЛИ ВОЗДУХ ЧИЩЕ', color: OK, size: 44 }); }
  if (sh === 'F') { P(A.L5w3, T.c6 - 0.05, 400, { icon: 'house', title: 'ПРОПУСКНОЙ ПУНКТ', sub: 'дозиметрический контроль', color: GOLD, size: 44 }); P(A.L5w11, T.c6 - 0.05, 540, { icon: 'check', title: 'ЧИСТО — ПРОХОДИ', color: OK, size: 44 }); }
  if (sh === 'G') {
    Hd.timeStamp(t, T.c6 + 0.1, T.c7 - 0.1, 'АПРЕЛЬ 2020', { color: WARM, dot: DANGER });
    P(A.L6w7, T.c7 - 0.05, 420, { icon: 'flame', title: '2 КМ ДО АРКИ НАД РЕАКТОРОМ', color: DANGER, size: 38 });
    P(A.L6w15, T.c7 - 0.05, 540, { icon: 'cloud', title: 'ДЫМ ДОШЁЛ ДО КИЕВА', color: DANGER, size: 44 });
  }
  if (t >= T.c7) {
    [['1', 'НОЧЬ В ЗОНЕ', A.L7w0], ['2', 'ПРУД С ГИГАНТСКИМИ СОМАМИ', A.L7w1]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(A.L7w6 - 0.1, A.L7w6 + 0.2, t));
      if (k <= 0.01) return;
      const w = measure(s, 46, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 16, 46, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
    if (t >= A.L7w6 - 0.1) P(A.L7w6 - 0.1, DUR + 1, 620, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в следующей серии ты с нами', color: GOLD, size: 52 });
    Hd.label('В Зону — только с гидом и по пропуску; сейчас она закрыта для туристов', 540, 1840, 24, '#ffffff', { fam: FONTS.mono });
  }
  Hd.endCard(t, A.L7w12, 0, 300);
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'fire', -10, -0.2, { dur: T.c3 }); add(0.02, 'stamp', -12, 0); add(0.1, 'roof_wind', -16, 0, { dur: T.c5 });
  add(T.c1 + 0.2, 'steps_out', -14, 0, { dur: T.c2 - T.c1 - 0.3 }); add(A.L2w4, 'beep', -14, 0.4); add(A.L2w6, 'beep', -12, 0.4);
  add(A.L3w0 - 0.05, 'stamp', -6, 0); add(A.L3w4 - 0.08, 'pop_word', -10, -0.3); add(A.L3w9 - 0.08, 'pop_word', -10, 0.3);
  add(A.L3e, 'ticks_up', -14, 0, { dur: Math.max(0.6, T.ans - A.L3e) }); add(T.ans, 'stamp', -6, 0); add(T.ans + 0.05, 'ding', -8, 0);
  add(T.c4, 'cloth', -14, 0); add(T.c4 + 0.2, 'breath', -12, 0, { dur: T.c5 - T.c4 - 0.3 });
  add(T.c5 + 0.3, 'beep', -14, 0.2); add(T.c5 + 0.9, 'beep', -14, 0.2); add(A.L5w11, 'ding', -10, 0);
  add(T.c6, 'fire', -18, 0, { dur: T.c7 - T.c6 }); add(T.c6 + 0.2, 'heli_far', -22, -0.4, { dur: T.c7 - T.c6 - 0.3 });
  add(T.c7, 'roof_wind', -20, 0, { dur: DUR - T.c7 }); add(A.L7w0 + 0.02, 'pop_word', -8, -0.3); add(A.L7w1 + 0.02, 'pop_word', -8, 0.3);
  add(A.L7w6 - 0.1, 'blip', -8, 0); add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
