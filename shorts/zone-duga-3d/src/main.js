// «Дуга» («Зона», серия 3, в 3D): Blender draws the picture (blender/duga.py, one run per shot); this file draws the 2D layer
// on a transparent canvas (OVERLAY=1): the dips at the cuts, the flashes, the rain, the dosimeter, the plaques, the nick, the
// timer, the choice, the subtitles; and it gives the cues for the sound. Beats are anchored to the narrator's words
// (build/words.json from tools/voice.py; before the voice exists, a rough timing from voice/script.json).
// The viewers chose the Duga radar, and Богдан wrote «возьми с собой». Over you, 150 m of rusty iron — and a storm is
// coming. Its tapping was heard on radios all over the world: the «Russian Woodpecker». One: don't climb it. Then thunder:
// if you hear it, lightning can reach you. Two: away from the radar — it strikes the highest, and the current runs through
// the ground. Three: not under a lone tree; spread apart. Into the concrete block: not by the window, not against the wall
// (rebar in the concrete). The bolt hits the radar. Thunder gone? Wait 30 minutes more. Next: the dead town or «Изумрудный»?
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath } from './flat.js';
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
const HOT = { ЖЕЛЕЗА: WARM, ГРОЗА: DANGER, ДУГА: GOLD, БОГДАН: GOLD, СОБОЙ: GOLD, ДЯТЕЛ: GOLD, НАВЕРХ: DANGER, ЭТАЖА: DANGER, ГРОМ: DANGER,
  ТЕБЯ: DANGER, УХОДИ: GOLD, ВЫСОКОЕ: DANGER, ЗЕМЛЕ: DANGER, ДЕРЕВОМ: DANGER, РАЗОЙДИТЕСЬ: GOLD, ЗДАНИЕ: GOLD, ОКНА: DANGER, СТЕНЕ: DANGER,
  АРМАТУРА: DANGER, УДАР: DANGER, РАДАР: DANGER, ТРИДЦАТЬ: GOLD, МИНУТ: GOLD, ГОРОД: GOLD, ИЗУМРУДНЫЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the beats: one shot per line ——
const T = {
  c1: A.L1 - 0.06, c2: A.L2 - 0.06, c3: A.L3 - 0.06, c4: A.L4 - 0.3, c5: A.L5 - 0.06, c6: A.L6 - 0.06, c7: A.L7 - 0.06,
  c8: A.L8 - 0.06, c9: A.L9 - 0.42, c10: A.L10 - 0.06, c11: A.L11 - 0.06,
  storm: A.L0w9 - 0.1,                 // «гроза»: a far flash
  nick: A.L1w4,                        // «Богдан»
  tap: A.L2w1,                         // «стук»
  thunder: A.L4w2 - 0.25,              // «И тут гром»
  run: A.L5w1,
  spread: A.L6w7,                      // «разойдитесь»
  win: A.L8w4, wall: A.L8w7,           // «окна», «стене»
};
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c3], ['D', T.c3, T.c4], ['E', T.c4, T.c5], ['F', T.c5, T.c6],
  ['G', T.c6, T.c7], ['H', T.c7, T.c8], ['I', T.c8, T.c9], ['J', T.c9, T.c10], ['K', T.c10, T.c11], ['L', T.c11, DUR]];
// the flashes are keyed in blender/duga.py at fractions of each shot (EV): the 2D flash and the thunder follow them
export const EV = { A: [0.78], E: [0.04, 0.6], F: [0.5], G: [0.3], H: [0.35], I: [0.15, 0.7], J: [0.12] };
const shotOf = n => SHOTS.find(s => s[0] === n);
// Blender renders every STEP-th frame of a shot (tools/bg.py fills the rest); a flash falls on a rendered frame
export const STEP = { A: 3, B: 2, C: 3, D: 2, E: 3, F: 2, G: 2, H: 2, I: 3, J: 2, K: 3, L: 3 };
// a shot is rendered STEP frames longer than it is cut (so its last frame is there): blender/duga.py gets NF frames
export const NF = Object.fromEntries(SHOTS.map(([n, a, b]) => [n, Math.round((b - a) * 30) + STEP[n]]));
const evT = (n, k) => { const f = Math.floor(NF[n] * EV[n][k]); return shotOf(n)[1] + (f - f % STEP[n]) / 30; };
T.hit = evT('J', 0);
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS, ev: EV, step: STEP, nf: NF };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const shotAt = t => { let s = 'A'; for (const [n, a] of SHOTS) if (t >= a) s = n; return s; };

export function init() { Hd.initHud(); }

// —— the frame (OVERLAY): transparent but for what is drawn here ——
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = shotAt(t);
  if (process.env.OVERLAY !== '1') { g.fillStyle = '#2a2d36'; g.fillRect(0, 0, W, H); text(sh, 540, 980, 300, '#3a3e4a', { fam: FONTS.block, shadow: false }); }
  let dip = 1 - ease.out(clamp(t / 0.45));
  for (const c of CUTS) if (t >= c && t < c + 0.2) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  flashes(t); rainFx(t);
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
}
// a white flash over the frame on each strike (the 3D has its own light; this is the blink of the eye)
function flashes(t) {
  let a = 0;
  for (const n of Object.keys(EV)) for (let k = 0; k < EV[n].length; k++) {
    const t0 = evT(n, k), big = n === 'J' ? 0.75 : n === 'A' || n === 'E' && k === 0 ? 0.18 : 0.3, u = t - t0;
    if (u >= -0.02 && u < 0.5) a = Math.max(a, big * (u < 0.04 ? 1 : u < 0.08 ? 0.3 : u < 0.12 ? 0.8 : Math.exp(-(u - 0.12) / 0.09)));
  }
  if (a > 0.003) { g.globalAlpha = a; rect(0, 0, W, H, '#e8eeff'); g.globalAlpha = 1; }
}
// rain from the block on: thick outside (H), lighter through the door (J); a little at the end of the meadow (G)
function rainFx(t) {
  const sh = shotAt(t);
  const k = sh === 'G' ? 0.35 * seg(T.c7 - 1.5, T.c7, t) : sh === 'H' ? 1 : sh === 'J' ? 0.55 : 0;
  if (k <= 0) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < Math.round(260 * k); i++) {
    const sp_ = 2600 + 900 * hash(i * 3.1), len = 60 + 70 * hash(i * 5.7), x0 = W * hash(i * 1.7) + 200 * hash(i * 9.1);
    const y = ((t * sp_ + 2000 * hash(i * 2.3)) % (H + 300)) - 150, x = x0 - 0.18 * y;
    g.strokeStyle = `rgba(200,212,235,${(0.18 + 0.22 * hash(i * 4.4)) * Math.min(1, k * 1.5)})`; g.lineWidth = 2 + 2 * hash(i * 6.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.18 * len, y + len); g.stroke();
  }
  g.restore();
  g.fillStyle = `rgba(30,40,60,${0.12 * k})`; g.fillRect(0, 0, W, H);
}

// —— the dosimeter in the corner (µSv/h): low by the radar, calm ——
function dosimeter(t) {
  const a = clamp((t - 0.3) / 0.4) * (1 - seg(T.c11 + 0.2, T.c11 + 0.6, t));
  if (a <= 0.01) return;
  const v = (shotAt(t) <= 'G' ? 0.42 : 0.31) * (1 + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
  const x = 1080 - 60 - 250, y = 118, w = 250, h = 112;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18; g.shadowOffsetY = 6; fill(rrPath(x, y, w, h, 18), '#f2b705'); g.restore();
  fill(rrPath(x + 12, y + 12, w - 24, h - 40, 10), '#9fd39b');
  text(v.toFixed(2).replace('.', ','), x + w - 26, y + 62, 52, '#14231a', { fam: FONTS.mono, align: 'right', shadow: false });
  text('мкЗв/ч', x + 22, y + h - 10, 24, INK, { fam: FONTS.mono, align: 'left', shadow: false });
  ell(x + w - 30, y + h - 18, 8, 8, '#2f7d32');
  g.restore();
}
// the height of the radar in the hook: a ruler up the left edge counting to 150 m
function ruler(t) {
  const a = clamp((t - 0.2) / 0.3) * (1 - seg(T.c1 - 0.4, T.c1 - 0.05, t));
  if (a <= 0.01) return;
  const u = seg(A.L0w1, A.L0w5, t, ease.out), x = 80, y0 = 1300, y1 = 300, y = lerp(y0, y1, u);
  g.save(); g.globalAlpha = a; g.lineWidth = 6; g.strokeStyle = WARM; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y); g.stroke();
  for (let k = 0; k <= 15; k++) { const yy = lerp(y0, y1, k / 15); if (yy < y - 1) continue; g.lineWidth = 3; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + (k % 5 ? 18 : 34), yy); g.stroke(); }
  const m = Math.round(150 * u / 5) * 5;
  Hd.label(`${m} м`, x + 110, y + 18, 54, WARM, { fam: FONTS.mono, align: 'left' });
  g.restore();
}
// the «woodpecker»: a shortwave set's dial with the tapping drawn as pulses
function woodpecker(t) {
  if (shotAt(t) !== 'C') return;
  const k = clamp(sp(t, T.tap - 0.1, 2.6, 8)) * (1 - seg(T.c3 - 0.3, T.c3 - 0.02, t));
  if (k <= 0.01) return;
  g.save(); g.translate(540, 760); g.scale(k, k);
  rrect(-400 + 6, -110 + 8, 800, 220, 26, 'rgba(0,0,0,0.45)'); rrect(-400, -110, 800, 220, 26, 'rgba(14,18,30,0.9)');
  g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(rrPath(-400, -110, 800, 220, 26));
  g.lineWidth = 5; g.strokeStyle = '#9fe0a8'; g.beginPath();
  for (let i = 0; i <= 300; i++) {
    const x = -360 + i * 2.4, tt = t - (300 - i) / 300 * 1.2, ph = (tt * 10) % 1, pulse = ph < 0.18 ? Math.exp(-ph / 0.05) : 0;
    const yv = -70 * pulse * Math.sin(i * 1.7) + 6 * Math.sin(i * 0.9 + t * 20) * hash(i + Math.floor(tt * 50));
    if (i) g.lineTo(x, yv); else g.moveTo(x, yv);
  }
  g.stroke();
  text('ТУК-ТУК-ТУК · 10 РАЗ В СЕКУНДУ', 0, 92, 34, '#c9d6ea', { fam: FONTS.mono, shadow: false });
  g.restore();
}
// the 30 minutes: a clock card counting down fast while they wait
function timer(t) {
  if (shotAt(t) !== 'K') return;
  const k = clamp(sp(t, A.L10w2, 2.6, 8)) * (1 - seg(T.c11 - 0.3, T.c11 - 0.02, t));
  if (k <= 0.01) return;
  const u = seg(A.L10w3, T.c11 - 0.6, t, x => x), s = Math.round(1800 * (1 - u)), mm = String(Math.floor(s / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
  g.save(); g.translate(540, 520); g.scale(k, k);
  rrect(-250 + 6, -90 + 8, 500, 180, 26, 'rgba(0,0,0,0.45)'); rrect(-250, -90, 500, 180, 26, 'rgba(14,18,30,0.92)');
  g.lineWidth = 4; g.strokeStyle = u >= 1 ? OK : GOLD; g.stroke(rrPath(-250, -90, 500, 180, 26));
  g.save(); g.translate(-160, 0); Hd.icon('clock', 56, u >= 1 ? OK : GOLD); g.restore();
  text(`${mm}:${ss}`, 60, 40, 110, u >= 1 ? OK : '#ffffff', { fam: FONTS.mono, shadow: false });
  g.restore();
}
// Богдан's nick from the comments, as a card that pops in by him
function nickCard(t) {
  if (shotAt(t) !== 'B') return;
  const k = clamp(sp(t, T.nick - 0.05, 2.6, 8)) * (1 - seg(T.c2 - 0.3, T.c2 - 0.02, t));
  if (k <= 0.01) return;
  const s1 = '@БогданУзун-6б6', s2 = 'написал «возьми с собой»', w = Math.max(measure(s1, 50, FONTS.cond), measure(s2, 32, FONTS.mono)) + 150;
  g.save(); g.translate(540, 470); g.rotate(-0.025); g.scale(k, k);
  rrect(-w / 2 + 6, -70 + 8, w, 140, 22, INK); rrect(-w / 2, -70, w, 140, 22, '#fff3d6');
  g.save(); g.translate(-w / 2 + 62, -6); Hd.icon('comment', 30, '#3b8eea'); g.restore();
  text(s1, 40, 0, 50, INK, { fam: FONTS.cond, shadow: false });
  text(s2, 40, 46, 30, '#5a5f6e', { fam: FONTS.mono, shadow: false });
  g.restore();
}
function overlays(t) {
  const sh = shotAt(t);
  Hd.timeStamp(t, 0.3, T.c4 - 0.1, 'РАДАР «ДУГА» · 16:40', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c4 + 0.15, T.c7 - 0.1, 'ГРОЗА · 16:52', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c7 + 0.15, T.c10 - 0.1, 'ВОЕННАЯ ЧАСТЬ · 16:55', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c11 + 0.15, DUR, 'ВЕЧЕР · 17:40', { color: WARM, dot: OK });
  dosimeter(t); ruler(t); woodpecker(t); timer(t); nickCard(t);
  if (sh === 'A') Hd.plaque(t, T.storm, T.c1 - 0.05, 540, 420, { icon: 'cloud', title: 'ИДЁТ ГРОЗА', sub: 'а ты под самой высокой железкой', color: DANGER, size: 46 });
  if (sh === 'C') Hd.plaque(t, A.L2w6 - 0.05, T.c3 - 0.05, 540, 420, { icon: 'tv', title: 'РУССКИЙ ДЯТЕЛ', sub: 'его слышали по радио с 1976 по 1989', color: GOLD, size: 46 });
  Hd.stepHeader(t, 1, 'НАВЕРХ НЕ ЛЕЗЬ', A.L3 + 0.02, T.c4 - 0.05);
  if (sh === 'D') Hd.plaque(t, A.L3w4, T.c4 - 0.05, 540, 470, { icon: 'x', title: '150 М — 50 ЭТАЖЕЙ', sub: 'ступени ржавые, страховки нет', color: DANGER, size: 42 });
  if (sh === 'E') Hd.plaque(t, A.L4w6, T.c5 - 0.05, 540, 420, { icon: 'bolt', title: 'СЛЫШИШЬ ГРОМ —', sub: 'молния может ударить и сюда', color: DANGER, size: 46 });
  Hd.stepHeader(t, 2, 'УХОДИ ОТ РАДАРА', A.L5 + 0.02, T.c6 - 0.05);
  if (sh === 'F') Hd.plaque(t, A.L5w5, T.c6 - 0.05, 540, 470, { icon: 'bolt', title: 'БЬЁТ В САМОЕ ВЫСОКОЕ', sub: 'а ток расходится по земле', color: DANGER, size: 40 });
  Hd.stepHeader(t, 3, 'НЕ ПОД ДЕРЕВОМ', A.L6 + 0.02, T.c7 - 0.05);
  if (sh === 'G') Hd.plaque(t, T.spread - 0.05, T.c7 - 0.05, 540, 470, { icon: 'check', title: 'РАЗОЙДИТЕСЬ', sub: 'на несколько метров', color: OK, size: 44 });
  if (sh === 'H') Hd.plaque(t, A.L7w1, T.c8 - 0.05, 540, 400, { icon: 'house', title: 'В ЗДАНИЕ', sub: 'или в машину с крышей', color: OK, size: 46 });
  if (sh === 'I') [['НЕ У ОКНА', T.win - 0.1], ['НЕ К СТЕНЕ: АРМАТУРА', T.wall - 0.1]].forEach(([s, t0], i) =>
    Hd.plaque(t, t0, T.c9 - 0.05, 540, 360 + i * 120, { icon: 'x', title: s, color: DANGER, size: 40 }));
  if (sh === 'K' && t > T.c11 - 0.9) Hd.plaque(t, T.c11 - 0.9, T.c11 - 0.05, 540, 700, { icon: 'check', title: 'ТЕПЕРЬ МОЖНО', color: OK, size: 44 });
  if (t >= T.c11) {
    [['1', 'МЁРТВЫЙ ГОРОД', A.L11w2], ['2', 'ЛАГЕРЬ «ИЗУМРУДНЫЙ»', A.L11w6]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(A.L12 - 0.06, A.L12 + 0.24, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= A.L12) Hd.plaque(t, A.L12w1 - 0.1, DUR + 1, 540, 730, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 4 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L12w12 - 0.1, 0, 300);
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.2, 'roof_wind', -18, 0, { dur: T.c8 - 0.2 });
  add(evT('A', 0), 'thunder', -14, -0.4, { dur: 4.0, near: 0.2 });
  add(T.c2 + 0.1, 'woodpecker', -12, 0.2, { dur: T.c3 - T.c2 - 0.3 });
  add(A.L3w4 - 0.2, 'wood_clack', -16, 0.2);
  add(evT('E', 0) - 0.1, 'thunder', -6, 0.3, { dur: 4.0, near: 0.7 });
  add(T.thunder + 0.1, 'dog_growl', -14, -0.3, { dur: 0.9 });
  add(evT('E', 1), 'thunder', -9, 0.5, { dur: 3.5, near: 0.5 });
  add(T.c5 + 0.05, 'steps_out', -10, 0, { dur: T.c8 - T.c5 - 0.2 });
  add(T.c5 + 0.1, 'breath', -14, 0, { dur: T.c8 - T.c5 - 0.3 });
  add(evT('F', 0), 'thunder', -10, -0.3, { dur: 3.0, near: 0.4 });
  add(evT('G', 0), 'thunder', -11, 0.4, { dur: 3.0, near: 0.4 });
  add(T.c7 - 1.5, 'rain', -14, 0, { dur: T.c11 - T.c7 + 1.5 });
  add(evT('H', 0), 'thunder', -10, 0, { dur: 3.0, near: 0.5 });
  add(T.c8 - 0.35, 'door_creak', -14, 0.2, { dur: 0.8 });
  for (const k of [0, 1]) add(evT('I', k), 'thunder', -12, k ? 0.4 : -0.4, { dur: 3.0, near: 0.4 });
  add(T.hit, 'strike', -2, 0.1, { dur: 4.5 });
  add(T.c10 + 0.4, 'tweet', -18, 0.4, { dur: 1.2 });
  add(T.c11 + 0.2, 'morning', -16, 0, { dur: DUR - T.c11 - 0.3 });
  for (let i = 0; i < 2; i++) add((i ? A.L11w6 : A.L11w2) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L12w1 - 0.1, 'blip', -8, 0);
  add(A.L12w13, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
