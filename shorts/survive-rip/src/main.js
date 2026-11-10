// «Выживи за 30 секунд», №1 «Тягун» — a new short 2D format: one situation, three decisions in a row. Each: the narrator
// gives two options (two numbered buttons pop in on «Один» and «Два»), the viewer has a countdown while the music drops
// out, then the answer (the right button lights up, the other dims, a stamp «ВЕРНО: 2») and why. Right answers 2, 1, 2.
// On the rules of the Studio export (10.11): a bright first frame (the beach from above, the swimmer in the rip channel,
// «ТЕБЯ УНОСИТ В МОРЕ?», «ВЫЖИВИ ЗА 30 СЕКУНД»), ≈42 s; three dots at the top show the decisions made; «Сколько угадал?»
// at the end. Beats are anchored to the narrator's words (build/words.json; before the voice, from voice/script.json).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter } from './hunter.js';
import { drawDog } from './dog.js';
import { SAND, RIP, topBeach, swimmerTop, sideSea, smallPerson } from './rip.js';
import { text, measure, FONTS, INK } from './type.js';

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
Hd.SUB.y = 1500; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok;
const HOT = { УНОСИТ: DANGER, ОТБОЙНОЕ: DANGER, ТРИДЦАТЬ: GOLD, ОДИН: GOLD, ДВА: GOLD, ВДОЛЬ: OK, ВБОК: OK, ОТПУСТИТ: OK, УСТАНЕШЬ: DANGER,
  СПИНЕ: OK, СПИНУ: GOLD, ОСЛАБНЕТ: OK, КРИЧАТЬ: GOLD, ЗАМЕТИТЬ: OK, ПОМОЩЬ: OK, УГАДАЛ: GOLD, ПЯТИ: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

// the decisions: [question line, answer line, the two options, the right one (0 or 1)]
// L1: Первое(0) Один(1) —(2) грести(3) к(4) берегу(5) изо(6) всех(7) сил(8) Два(9) —(10) плыть(11) вдоль(12) берега(13)
// L3: Второе(0) Ты(1) устал(2) Один(3) —(4) лечь(5) на(6) спину(7) и(8) держаться(9) на(10) воде(11) Два(12) —(13) бороться(14) дальше(15)
// L5: Третье(0) На(1) берегу(2) люди(3) Один(4) —(5) молча(6) беречь(7) силы(8) Два(9) —(10) махать(11) рукой(12) и(13) кричать(14)
const Q = [['L1', 'L2', ['ГРЕСТИ К БЕРЕГУ', 'ВДОЛЬ БЕРЕГА'], 1, [1, 9]], ['L3', 'L4', ['ЛЕЧЬ НА СПИНУ', 'БОРОТЬСЯ'], 0, [3, 12]], ['L5', 'L6', ['БЕРЕЧЬ СИЛЫ', 'МАХАТЬ И КРИЧАТЬ'], 1, [4, 9]]];
const T = { c1: A.L1 - 0.06, c3: A.L3 - 0.06, c5: A.L5 - 0.06, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; });
export const CUTS = [T.c3, T.c5, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c3 ? 'top' : t < T.c5 ? 'float' : t < T.c7 ? 'shore' : 'end');
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w5, T.v0, T.v1, T.v2, A.L2w4, A.L4w2, A.L6w5];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }

// —— the scenes ——
function topScene(t) {
  topBeach(t, { flow: 1 });
  // the swimmer: drifting out in the channel; after «Два!» he swims sideways out of it, then in to the shore on the waves
  const cx = (RIP[0] + RIP[1]) / 2, drift = seg(0, T.v0, t, x => x), side = seg(T.v0 + 0.1, A.L2w7, t), home = seg(A.L2w7, T.c3, t);
  const x = lerp(cx, 860, side), y = lerp(lerp(1250, 1010, drift), 1380, home);
  swimmerTop(x, y, 0.9, t, { ang: side > 0 && side < 1 ? Math.PI / 2 : home > 0 ? Math.PI : 0, panic: t < T.v0 });
  // the two ways: straight in against the current, or sideways out of it
  const a1 = seg(A.L1w1 - 0.1, A.L1w8, t), a2 = seg(A.L1w9 - 0.1, A.L1w13, t), done = t > T.v0;
  if (t < T.v0 + 1.2) {
    if (a1 > 0) { g.save(); g.setLineDash([24, 14]); g.globalAlpha = done ? 0.35 : 1; limb([[cx, 1070], [cx, lerp(1070, 1420, a1)]], 12, done ? DANGER : '#ffd23f', false); g.restore(); text('1', cx - 60, 1200, 70, '#ffffff', { fam: FONTS.block }); }
    if (a2 > 0) { g.save(); g.setLineDash([24, 14]); limb([[cx + 60, 1010], [lerp(cx + 60, 900, a2), 1010]], 12, done ? OK : '#ffd23f', false); g.restore(); text('2', cx + 230, 975, 70, '#ffffff', { fam: FONTS.block }); }
  }
}
function floatScene(t) {
  sideSea(t, 1150);
  const rev = t > T.v1, struggle = !rev ? 1 : 0, rest = seg(T.v1, T.v1 + 0.8, t);
  // struggling upright, splashing — then on his back, calm, rising and falling with the swell
  const bob = 10 * Math.sin(t * 2);
  if (rest < 1) {
    g.save(); g.globalAlpha = 1 - rest;
    drawHunter({ hip: [520, 1290 + bob], feet: { near: [490, 1550], far: [550, 1540] }, s: 0.8, face: 1, look: [0, -0.5], brow: 0.9, pop: 1, mouth: 0.7, blink: 0, scarf: 'neck',
      hands: { near: { p: [420 + 40 * Math.sin(t * 12), 1000], shape: 'open' }, far: { p: [640 - 40 * Math.sin(t * 12), 1000], shape: 'open' } } });
    g.restore();
    for (let i = 0; i < 8; i++) ell(420 + 220 * hash(i + Math.floor(t * 6)), 1140 - 40 * hash(i * 3), 16, 10, 'rgba(255,255,255,0.9)');
  }
  if (rest > 0) {
    g.save(); g.globalAlpha = rest; g.translate(540, 1150 + bob); g.rotate(-1.5); g.translate(-540, -(1150 + bob));
    drawHunter({ hip: [540, 1150 + bob], feet: { near: [510, 1150 + bob + 210], far: [570, 1150 + bob + 200] }, s: 0.8, face: 1, look: [0, 0.5], brow: 0.2, mouth: 0.2, blink: 0, scarf: 'neck',
      hands: { near: { p: [420, 1120 + bob], shape: 'open' }, far: { p: [660, 1130 + bob], shape: 'open' } } });
    g.restore();
  }
  g.save(); g.globalAlpha = 0.6; g.fillStyle = 'rgba(29,111,154,0.9)'; g.fillRect(0, 1175 + bob, W, 745); g.restore();
  // the rip weakening beyond the surf: the arrows fade
  if (rev) for (let i = 0; i < 3; i++) { const k = 1 - seg(A.L4w4, A.L4e, t); g.save(); g.globalAlpha = 0.8 * k; limb([[200 + i * 300, 1300], [200 + i * 300, 1220]], 8, '#ffffff', false); poly([[200 + i * 300, 1200], [186 + i * 300, 1226], [214 + i * 300, 1226]], '#ffffff'); g.restore(); }
}
function shoreScene(t) {
  sideSea(t, 1200, { shore: true });
  const rev = t > T.v2, wave = rev || t > A.L5w11 - 0.2;
  [[180, '#ff6f59'], [300, '#3aa6cf'], [420, '#ffd23f'], [600, '#7bc67b']].forEach(([x, c], i) => smallPerson(x, 1135, 0.55, c, t, { wave: rev && i === 1 }));
  smallPerson(rev ? lerp(820, 640, seg(T.v2 + 0.3, T.c7, t)) : 820, 1135, 0.6, '#d9433b', t, { buoy: true });      // the lifeguard runs in with the buoy
  const bob = 10 * Math.sin(t * 2);
  drawHunter({ hip: [520, 1330 + bob], feet: { near: [490, 1580], far: [550, 1570] }, s: 0.8, face: -1, look: [0, -0.2], brow: 0.5, pop: 0.4, mouth: wave ? 0.8 : 0.2, blink: 0, scarf: 'neck',
    hands: wave ? { near: { p: [470 + 40 * Math.sin(t * 9), 940], shape: 'open' }, far: { p: [600, 1180], shape: 'open' } } : { near: { p: [440, 1190], shape: 'open' }, far: { p: [600, 1190], shape: 'open' } } });
  g.save(); g.globalAlpha = 0.85; g.fillStyle = 'rgba(47,154,196,0.85)'; g.fillRect(0, 1210 + bob, W, 710); g.restore();
}
function endScene(t) {
  topBeach(t, { flow: 0.3 });
  swimmerTop(860, 1520, 0.9, t, { ang: Math.PI });
}

// —— the 2D layer ——
function headline(t) {
  if (t > T.c1 + 0.3) return;
  const a = 1 - seg(T.c1 - 0.1, T.c1 + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = 'ТЕБЯ УНОСИТ В МОРЕ?', sw = measure(s, 80) + 80; rrect(-sw / 2 + 10, -64 + 10, sw, 128, 22, INK); rrect(-sw / 2, -64, sw, 128, 22, '#ffd23f'); text(s, 0, 30, 80, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, T.c1 - 0.1, 'ВЫЖИВИ ЗА 30 СЕКУНД', { y: 500, size: 76 });
}
function tag(t) {
  const s = 'ВЫЖИВИ ЗА 30 СЕКУНД', tw = measure(s, 36, FONTS.cond) + 50;
  if (t < T.c1) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(60 + tw, 150); g.rotate(-0.03); rect(-tw + 6, -30 + 6, tw, 60, INK); rect(-tw, -30, tw, 60, '#ff4d4d'); text(s, -tw / 2, 13, 36, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
}
function dots(t) {
  if (t < T.c1 - 0.1) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Q.forEach((q, i) => {
    const x = 760 + i * 100, y = 150, done = t > T['v' + i] + 0.1, cur = qOf(t) === i && t < T.c7;
    ell(x, y, 38, 38, done ? '#2f8f4e' : cur ? '#ffd23f' : 'rgba(255,255,255,0.35)');
    text(done ? String(q[3] + 1) : String(i + 1), x, y + 16, 44, done || cur ? '#ffffff' : '#e8eef4', { fam: FONTS.block, shadow: false });
  });
}
function choice(t) {
  Q.forEach(([ql, al, opts, right, wi], i) => {
    const g0 = T['g' + i], v0 = T['v' + i];
    if (t < A[ql] || t > v0 + 1.4) return;
    const done = t >= v0, out = seg(v0 + 1.0, v0 + 1.4, t);
    opts.forEach((s, j) => {
      const k = clamp(sp(t, A[ql + 'w' + wi[j]] - 0.08, 2.6, 8)) * (1 - out); if (k <= 0.01) return;
      const ok = j === right, c = done ? (ok ? '#2f8f4e' : 'rgba(80,80,90,0.85)') : '#fff3d6', tc = done ? '#ffffff' : INK;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + (j ? 240 : -240), 760); g.scale(k * (done && ok ? 1 + 0.1 * bump(clamp((t - v0) / 0.3)) : 1), k);
      rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
      text(String(j + 1), 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
      text(s, 0, 62, 38, tc, { fam: FONTS.cond, shadow: false });
      if (done) Hd.label(ok ? '✓' : '✗', 180, -66, 60, '#ffffff', { shadow: false, stroke: false });
      g.restore();
    });
    if (t >= g0 && !done) {
      const u = clamp((t - g0) / Math.max(0.5, v0 - g0));
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 890, 700, 26, 13), 'rgba(255,255,255,0.25)'); fill(rrPath(190, 890, 700 * (1 - u), 26, 13), GOLD);
      Hd.label('РЕШАЙ', 540, 960, 44, '#ffffff', { fam: FONTS.mono });
    }
    if (done) {
      const ks = sp(t, v0, 2.2, 8); if (ks > 0.01 && out < 1) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 470); g.rotate(-0.07); const z = lerp(1.9, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3) * (1 - out);
        const s = 'ВЕРНО: ' + (right + 1), sw = measure(s, 110) + 100; rrect(-sw / 2 + 12, -80 + 12, sw, 160, 24, INK); rrect(-sw / 2, -80, sw, 160, 24, '#2f8f4e'); text(s, 0, 40, 110, '#fff3d6', { shadow: false }); g.restore();
      }
    }
  });
}
function plaques(t) {
  const sc = scene(t), P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  if (sc === 'top' && t > T.v0 + 1.2) { P(A.L2w1, T.c3 - 0.05, 320, { icon: 'check', title: 'ТЕЧЕНИЕ УЗКОЕ — ПЛЫВИ ВБОК', color: OK, size: 40 }); P(A.L2w8, T.c3 - 0.05, 440, { icon: 'x', title: 'ПРОТИВ НЕГО ТОЛЬКО УСТАНЕШЬ', color: DANGER, size: 38 }); }
  if (sc === 'float' && t > T.v1 + 1.2) { P(A.L4w1, T.c5 - 0.05, 320, { icon: 'check', title: 'ОТДОХНИ НА СПИНЕ', color: OK, size: 44 }); P(A.L4w5, T.c5 - 0.05, 440, { icon: 'check', title: 'ЗА ПРИБОЕМ ТЕЧЕНИЕ СЛАБЕЕТ', color: OK, size: 38 }); }
  if (sc === 'shore' && t > T.v2 + 1.2) { P(A.L6w1, T.c7 - 0.05, 320, { icon: 'check', title: 'МАШИ РУКОЙ И ЗОВИ НА ПОМОЩЬ', color: OK, size: 38 }); }
  if (sc === 'end') {
    const k = clamp(sp(t, T.c7 + 0.05, 2.4, 8)) * (1 - seg(A.L7w5 - 0.3, A.L7w5, t));
    if (k > 0.01) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.scale(k, k);
      rrect(-420 + 8, -230 + 10, 840, 460, 30, INK); rrect(-420, -230, 840, 460, 30, '#fff3d6');
      text('СКОЛЬКО УГАДАЛ?', 0, -140, 64, INK, { shadow: false });
      [['ВДОЛЬ БЕРЕГА', '2'], ['НА СПИНУ', '1'], ['МАХАТЬ', '2']].forEach(([s, n], i) => {
        const x = -270 + i * 270; ell(x, -10, 70, 70, '#2f8f4e'); text(n, x, 18, 70, '#ffffff', { fam: FONTS.block, shadow: false });
        text(s, x, 110, 34, INK, { fam: FONTS.cond, shadow: false });
      });
      g.restore();
    }
    P(A.L7w5, DUR + 1, 560, { icon: 'x', title: '4 ИЗ 5 СПАСЕНИЙ НА ПЛЯЖАХ — ТАКИЕ ТЕЧЕНИЯ', color: DANGER, size: 32 });
  }
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ top: topScene, float: floatScene, shore: shoreScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); tag(t); dots(t); plaques(t); choice(t);
  Hd.endCard(t, A.L7w15 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.5);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'surf', -14, 0, { dur: DUR }); add(0.02, 'stamp', -12, 0); add(0.4, 'gulls', -22, 0.3, { dur: 3.0 });
  Q.forEach(([ql, al, opts, right, wi], i) => {
    add(A[ql + 'w' + wi[0]] - 0.08, 'pop_word', -10, -0.3); add(A[ql + 'w' + wi[1]] - 0.08, 'pop_word', -10, 0.3);
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, 'ding', -8, 0);
  });
  add(T.c3, 'splash', -14, 0); add(T.v2 + 0.3, 'steps_run', -16, 0.3, { dur: 1.2 });
  add(T.c7, 'paper', -12, 0); for (let i = 0; i < 3; i++) add(T.c7 + 0.25 + i * 0.18, 'pop_word', -12, -0.3 + i * 0.3);
  add(A.L7w15 - 0.1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
