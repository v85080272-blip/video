// «Правда или миф», №4 «Землетрясение» — the short 2D quiz on the rules of the Studio export (10.11): a bright first frame
// (a sunny flat, «ПРАВДА ИЛИ МИФ?», three cards, «2 ИЗ 3 — ОПАСНЫ»), ≈40 s. Three tips, the viewer guesses before each
// verdict: 1 stand in the doorway — myth (no stronger than a wall, things fly, the door swings); 2 under the table and hold
// its leg — truth (drop, cover, hold on; it covers you from what falls); 3 run outside at once — myth (glass and bricks
// fall; go out when the shaking stops). «Сколько угадал?» at the end. The hunter and Пурга.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { FLOOR, room, table, wallCracks, street, card } from './quake.js';
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
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ЗЕМЛЕТРЯСЕНИИ: GOLD, ОПАСНЫ: DANGER, ПРАВДА: OK, ПРОЁМ: DANGER, МИФ: DANGER, КРЕПЧЕ: DANGER, СПАСЁТ: DANGER, СТОЛ: OK,
  ПРИГНИСЬ: OK, УКРОЙСЯ: OK, ДЕРЖИСЬ: OK, СВЕРХУ: GOLD, УЛИЦУ: DANGER, РАНИТ: DANGER, СТЁКЛА: DANGER, ЗАКОНЧАТСЯ: OK, УГАДАЛ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the three: [setup line, verdict line, scene, the true answer]
const Q = [['L1', 'L2', 'door', false], ['L3', 'L4', 'table', true], ['L5', 'L6', 'out', false]];
const T = { c1: A.L1 - 0.06, c3: A.L3 - 0.06, c5: A.L5 - 0.06, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; });     // the guess window, the verdict
export const CUTS = [T.c1, T.c3, T.c5, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c3 ? 'door' : t < T.c5 ? 'table' : t < T.c7 ? 'out' : 'end');
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w7, T.v0, T.v1, T.v2, A.L1w6, A.L3w3, A.L5w5];      // «опасны», the three verdicts, «проём», «стол», «улицу»
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.07 * z; }

// —— the hunter, standing: hip at (x, y) ——
function hunter(t, x, y, s, o = {}) {
  const base = { hip: [x, y], feet: { near: [x - 30 * s, y + 262 * s], far: [x + 34 * s, y + 262 * s] }, s, face: o.face ?? -1, look: o.look ?? [0, 0],
    brow: o.brow ?? 0, pop: o.pop ?? 0, mouth: o.mouth ?? 0.15, blink: ((t + 0.7) % 3.4) < 0.12 ? 1 : 0, scarf: 'neck', ...o.extra };
  if (o.hands) base.hands = o.hands(base);
  return drawHunter(base);
}
const mouthOf = o => framesOf(o).H.p([-34, 40]);

// —— the scenes ——
// the shaking: the whole picture jitters while it shakes (the 2D layer stays still)
const shakeAt = t => (t > T.c1 && t < T.c7 ? 1 : 0) * (0.6 + 0.4 * Math.sin(t * 1.3));
function jitter(t, k) { if (k > 0) { g.translate(9 * k * Math.sin(t * 47), 6 * k * Math.sin(t * 61 + 1)); } }
function hook(t) {
  room(t, { shake: 0.2 });
  const ks = [A.L0w0, A.L0w1, A.L0w3].map(t0 => 1 + 0.12 * (t >= t0 - 0.1 ? Math.exp(-(t - t0 + 0.1) / 0.15) : 0));
  [['door', 220], ['table', 540], ['out', 860]].forEach(([k, x], i) => card(x, 760, 0.9 * ks[i], k, t));
  hunter(t, 360, 1300, 0.62, { face: 1, look: [0.6, -0.3], brow: 0.4, mouth: 0.3 });
  drawDog({ x: 720, y: 1462, s: 0.55, face: -1, t, sit: 1, look: -0.3 });
}
function doorScene(t) {
  const rev = t > T.v0, sh = shakeAt(t);
  g.save(); jitter(t, sh);
  room(t, { shake: sh, door: rev ? 0.5 + 0.5 * Math.sin(t * 6) : 0.1 * Math.sin(t * 8), fall: rev ? seg(T.v0, T.v0 + 1.0, t) : 0 });
  wallCracks(seg(T.c1, T.c3, t));
  table(330, 1);
  hunter(t, 900, FLOOR - 262 * 0.8, 0.8, { face: -1, look: [-0.4, -0.6], brow: 0.8, pop: rev ? 1 : 0.4, mouth: 0.5,
    hands: o => ({ near: { p: [840, FLOOR - 470], shape: 'open' }, far: { p: [980, FLOOR - 470], shape: 'open' } }) });
  if (rev) Hd.redX(900, FLOOR - 260, 200, clamp((t - T.v0 - 0.2) / 0.25));
  drawDog({ x: 600, y: FLOOR + 140, s: 0.5, face: 1, t, look: 0.4, ears: 1, mouth: 0.7 });
  g.restore();
}
function tableScene(t) {
  const rev = t > T.v1, sh = shakeAt(t), under = seg(A.L3w1 - 0.1, A.L3w3 + 0.2, t);
  g.save(); jitter(t, sh);
  room(t, { shake: sh, fall: seg(A.L4w5, A.L4w10, t) });
  wallCracks(1);
  // the hunter goes down under the table and holds a leg; things land on the table top
  const s = 0.72, hx = lerp(700, 360, under), hy = lerp(FLOOR - 262 * s, FLOOR - 120, under);
  g.save(); g.translate(hx, hy); g.rotate(-0.9 * under); g.translate(-hx, -hy);
  drawHunter({ hip: [hx, hy], feet: { near: [hx - 30 * s, hy + 262 * s * lerp(1, 0.6, under)], far: [hx + 34 * s, hy + 262 * s * lerp(1, 0.6, under)] }, s, face: -1,
    look: [0.2, 0.4], brow: 0.7, pop: 0.3, mouth: 0.4, blink: 0, scarf: 'neck',
    hands: under > 0.5 ? { near: { p: [hx - 160, hy - 120], shape: 'fist' }, far: { p: [hx - 200, hy - 60], shape: 'open' } } : null });
  g.restore();
  table(330, 1);
  for (let i = 0; i < 3; i++) { const k = seg(A.L4w10 + i * 0.12, A.L4w10 + i * 0.12 + 0.3, t, ease.in); if (k > 0) rect(220 + i * 90, lerp(560, FLOOR - 330, k), 40, 30, ['#d9433b', '#3a6aa8', '#e0a030'][i]); }
  drawDog({ x: 460, y: FLOOR - 10, s: 0.42, face: -1, t, sit: under > 0.5 ? 1 : 0, look: 0.2, ears: 0.8 });
  g.restore();
}
function outScene(t) {
  const rev = t > T.v2, sh = shakeAt(t), run = seg(A.L5w3 - 0.1, A.L5e + 0.4, t, x => x);
  g.save(); jitter(t, sh);
  street(t, rev ? seg(T.v2 - 0.4, T.v2 + 1.0, t) : seg(A.L5w3, T.g2, t) * 0.25);
  const s = 0.62, x = lerp(540, 820, run);
  drawHunter({ hip: [x, 1560 - 262 * s], feet: { near: [x - 30 * s + 40 * Math.sin(t * 14), 1560], far: [x + 34 * s - 40 * Math.sin(t * 14), 1560] }, s, face: 1, lean: 0.15,
    look: [0, -0.8], brow: 0.8, pop: rev ? 1 : 0.4, mouth: 0.5, blink: 0, scarf: 'neck', hands: { near: { p: [x - 20, 1560 - 262 * s - 330 * s], shape: 'open' }, far: { p: [x + 40, 1560 - 262 * s - 340 * s], shape: 'open' } } });
  if (rev && t < A.L6w8) Hd.redX(x, 1360, 180, clamp((t - T.v2 - 0.2) / 0.25));
  g.restore();
}
function endScene(t) {
  room(t, { shake: 0 });
  hunter(t, 380, 1300, 0.62, { face: 1, look: [0.8, 0], brow: 0.6, mouth: 0.35, hands: o => ({ near: { p: [470, 1060], shape: 'thumb', ang: -Math.PI / 2 } }) });
  drawDog({ x: 720, y: 1462, s: 0.55, face: -1, t, sit: 1, mouth: 0.7, tongue: 0.9, wag: 1, wagPh: t * 3 });
}

// —— the 2D layer: the quiz ——
function tag(t) {
  const s = 'ПРАВДА ИЛИ МИФ', tw = measure(s, 40, FONTS.cond) + 50;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(60 + tw, 150); g.rotate(-0.03); rect(-tw + 6, -32 + 6, tw, 64, INK); rect(-tw, -32, tw, 64, '#ff4d4d'); text(s, -tw / 2, 14, 40, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
}
function dots(t) {                                     // three dots at the top right: the answered ones show their verdict
  if (t < T.c1 - 0.1 || t > T.c7) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Q.forEach(([, , , truth], i) => {
    const x = 760 + i * 100, y = 150, done = t > T['v' + i] + 0.1, cur = qOf(t) === i;
    ell(x, y, 38, 38, done ? (truth ? '#2f8f4e' : '#d62828') : cur ? '#ffd23f' : 'rgba(255,255,255,0.25)');
    text(done ? (truth ? '✓' : '✗') : String(i + 1), x, y + 16, 44, done || cur ? '#ffffff' : '#c9d6ea', { fam: FONTS.block, shadow: false });
  });
}
function guess(t) {
  // during the guess window: two buttons and a countdown; at the verdict the true one grows, the other fades
  Q.forEach(([s, v, , truth], i) => {
    const g0 = T['g' + i], v0 = T['v' + i];
    if (t < g0 - 0.05 || t > v0 + 1.4) return;
    const k = clamp(sp(t, g0 - 0.05, 2.8, 8)) * (1 - seg(v0 + 1.0, v0 + 1.4, t)), done = t >= v0;
    [['ПРАВДА', '#2f8f4e', true], ['МИФ', '#d62828', false]].forEach(([lbl, c, val], j) => {
      const right = val === truth, sc = done ? (right ? 1 + 0.12 * bump(clamp((t - v0) / 0.35)) : 0.85) : 1, a = done && !right ? 0.35 : 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540 + (j ? 230 : -230), 1000); g.scale(k * sc, k * sc);
      rrect(-200 + 6, -90 + 8, 400, 180, 30, INK); rrect(-200, -90, 400, 180, 30, done && right ? c : '#fff3d6');
      text(lbl, 0, 28, 72, done && right ? '#ffffff' : c, { fam: FONTS.block, shadow: false }); g.restore();
    });
    if (!done && k > 0.01) {
      const u = clamp((t - g0) / Math.max(0.5, v0 - g0));
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1130, 700, 26, 13), 'rgba(255,255,255,0.2)'); fill(rrPath(190, 1130, 700 * (1 - u), 26, 13), GOLD);
      Hd.label('УГАДАЙ', 540, 1210, 44, '#ffffff', { fam: FONTS.mono });
    }
  });
}
function verdict(t) {
  Q.forEach(([, v, , truth], i) => {
    const v0 = T['v' + i], ks = sp(t, v0, 2.2, 8), out = seg(v0 + 1.3, v0 + 1.6, t);
    if (ks <= 0.01 || out >= 1) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.07); const z = lerp(1.9, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3) * (1 - out);
    const s = truth ? 'ПРАВДА' : 'МИФ', sw = measure(s, 130) + 100;
    rrect(-sw / 2 + 12, -92 + 12, sw, 184, 24, INK); rrect(-sw / 2, -92, sw, 184, 24, truth ? '#2f8f4e' : '#d62828'); text(s, 0, 46, 130, '#fff3d6', { shadow: false });
    g.restore();
  });
}
function plaques(t) {
  const sc = scene(t);
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  if (sc === 'hook') {
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 360); g.rotate(-0.03);
    const s = 'ПРАВДА ИЛИ МИФ?', sw = measure(s, 84) + 80; rrect(-sw / 2 + 10, -66 + 10, sw, 132, 22, INK); rrect(-sw / 2, -66, sw, 132, 22, '#ffd23f'); text(s, 0, 30, 84, INK, { shadow: false }); g.restore();
    Hd.ribbon(t, -1, T.c1 - 0.05, '2 ИЗ 3 — ОПАСНЫ', { y: 1060, size: 70 });
  }
  if (sc === 'door' && t > T.v0) {
    P(A.L2w1, T.c3 - 0.05, 320, { icon: 'x', title: 'ПРОЁМ НЕ КРЕПЧЕ СТЕНЫ', color: DANGER, size: 42 });
    P(A.L2w6, T.c3 - 0.05, 440, { icon: 'x', title: 'ВЕЩИ ЛЕТЯТ, ДВЕРЬ БЬЁТ', color: DANGER, size: 42 });
  }
  if (sc === 'table' && t > T.v1) {
    P(A.L4w1, T.c5 - 0.05, 320, { icon: 'check', title: 'ПРИГНИСЬ · УКРОЙСЯ · ДЕРЖИСЬ', color: OK, size: 40 });
    P(A.L4w5, T.c5 - 0.05, 440, { icon: 'check', title: 'СТОЛ ПРИКРОЕТ СВЕРХУ', color: OK, size: 42 });
  }
  if (sc === 'out' && t > T.v2) {
    P(A.L6w1, T.c7 - 0.05, 320, { icon: 'x', title: 'НА БЕГУ — СТЁКЛА И ОБЛОМКИ', color: DANGER, size: 40 });
    P(A.L6w8, T.c7 - 0.05, 440, { icon: 'check', title: 'ВЫХОДИ, КОГДА ТРЯСТИ ПЕРЕСТАНЕТ', color: OK, size: 36 });
  }
  if (sc === 'end') {
    const k = clamp(sp(t, T.c7 + 0.05, 2.4, 8)) * (1 - seg(A.L7w12 - 0.4, A.L7w12, t));
    if (k > 0.01) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.scale(k, k);
      rrect(-420 + 8, -230 + 10, 840, 460, 30, INK); rrect(-420, -230, 840, 460, 30, '#fff3d6');
      text('СКОЛЬКО УГАДАЛ?', 0, -140, 64, INK, { shadow: false });
      [['ПРОЁМ', false], ['СТОЛ', true], ['НА УЛИЦУ', false]].forEach(([s, tr], i) => {
        const x = -270 + i * 270; ell(x, -10, 70, 70, tr ? '#2f8f4e' : '#d62828'); text(tr ? '✓' : '✗', x, 18, 70, '#ffffff', { fam: FONTS.block, shadow: false });
        text(s, x, 110, 38, INK, { fam: FONTS.cond, shadow: false }); text(tr ? 'ПРАВДА' : 'МИФ', x, 158, 30, tr ? '#2f8f4e' : '#d62828', { fam: FONTS.mono, shadow: false });
      });
      g.restore();
    }
    P(A.L7w6, DUR + 1, 900, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, КТО ЖИВЁТ В ВЫСОТКЕ', color: GOLD, size: 36 });
  }
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ hook, door: doorScene, table: tableScene, out: outScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  tag(t); dots(t); plaques(t); guess(t); verdict(t);
  Hd.endCard(t, A.L7w12 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0);
  for (const t0 of [A.L0w0, A.L0w1, A.L0w3]) add(t0 - 0.08, 'pop_word', -10, 0);
  add(T.c1, 'rumble', -10, 0, { dur: T.c7 - T.c1, near: 0.8 });
  add(T.v0 + 0.1, 'thud', -12, 0.3); add(T.v0 + 0.3, 'thud', -14, 0.1); add(T.v0 + 0.5, 'clang', -16, 0.2);
  add(A.L3w1, 'cloth', -14, -0.2); add(A.L4w10, 'thud', -12, -0.2); add(A.L4w10 + 0.15, 'thud', -14, -0.1);
  add(A.L5w3 - 0.1, 'steps_run', -14, 0.2, { dur: 1.2 }); add(T.v2 + 0.1, 'glass', -10, 0.1); add(T.v2 + 0.4, 'glass', -14, -0.2);
  Q.forEach((q, i) => {
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, q[3] ? 'ding' : 'wall_hit', q[3] ? -8 : -14, 0);
  });
  add(T.c7, 'paper', -12, 0); for (let i = 0; i < 3; i++) add(T.c7 + 0.25 + i * 0.18, 'pop_word', -12, -0.3 + i * 0.3);
  add(A.L7w6, 'blip', -10, 0); add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
