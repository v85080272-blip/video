// «Правда или миф», №1 «Три совета из кино» — a short (≈35 s) 2D quiz: three survival tips you hear in films, two of
// them can kill. Each: the tip (the hunter acts it out) → the viewer guesses (ПРАВДА / МИФ, a countdown, the music drops
// out) → the verdict stamp and what to do instead. At the end «Сколько угадал?» with the three answers, for the comments.
// The hunter and Пурга host it. Beats are anchored to the narrator's words (build/words.json; before the voice, a rough
// timing from voice/script.json).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { forest, snake, beach, jellyfish, bog, sandOver, card } from './story.js';
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
const HOT = { КИНО: GOLD, УБИТЬ: DANGER, ПРАВДА: OK, ЗМЕЯ: DANGER, ВЫСОСИ: GOLD, МИФ: DANGER, КРОВИ: DANGER, ЗАРАЗУ: DANGER, ВРАЧУ: OK,
  МЕДУЗОЙ: DANGER, ПОМОЧИСЬ: GOLD, БОЛЬНЕЕ: DANGER, МОРСКАЯ: OK, ПИНЦЕТ: OK, ЩУПАЛЕЦ: GOLD, ЗЫБУЧИЙ: DANGER, СПИНУ: GOLD, ЛЕГЧЕ: OK,
  УТОНЕШЬ: OK, МЕДЛЕННО: OK, УГАДАЛ: GOLD, ХОЛОД: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the three: [setup line, verdict line, scene, the true answer]
const Q = [['L1', 'L2', 'snake', false], ['L3', 'L4', 'jelly', false], ['L5', 'L6', 'sand', true]];
const T = { c1: A.L1 - 0.06, c3: A.L3 - 0.06, c5: A.L5 - 0.06, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; });     // the guess window, the verdict
export const CUTS = [T.c1, T.c3, T.c5, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c3 ? 'snake' : t < T.c5 ? 'jelly' : t < T.c7 ? 'sand' : 'end');
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w8, T.v0, T.v1, T.v2, A.L1w4, A.L3w4, A.L5w5];      // «высоси», «помочись», «ляг»
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
function hook(t) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2a44'); gr.addColorStop(1, '#3a2240'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) ell(1080 * hash(i * 1.3), 1920 * hash(i * 2.7), 3, 3, 'rgba(255,255,255,0.35)');
  const ks = [A.L0w0, A.L0w1, A.L0w3].map(t0 => clamp(sp(t, t0 - 0.1, 2.6, 8)));
  [['snake', 220], ['jelly', 540], ['sand', 860]].forEach(([k, x], i) => { if (ks[i] > 0.01) card(x, 760, 0.9 * ks[i], k, t); });
  hunter(t, 360, 1300, 0.62, { face: 1, look: [0.6, -0.3], brow: 0.4, mouth: 0.3 });
  drawDog({ x: 720, y: 1462, s: 0.55, face: -1, t, sit: 1, look: -0.3 });
}
function snakeScene(t) {
  forest(t, 1250);
  const rev = t > T.v0, strike = seg(T.c1 + 0.2, T.c1 + 0.5, t, ease.out) * (1 - seg(T.c1 + 0.6, T.c1 + 1.0, t));
  snake(760, 1420, 0.85, t, strike);
  hunter(t, 400, 1150, 0.9, { face: 1, look: rev ? [0.8, 0.2] : [0.3, -0.2], brow: rev ? -0.4 : 0.6, pop: rev ? 0 : 0.7, mouth: t > A.L1w4 && !rev ? 0.05 : 0.3,
    hands: o => (!rev && t > A.L1w4 - 0.2 ? { near: { p: mouthOf(o), shape: 'fist' }, far: { p: [mouthOf(o)[0] + 40, mouthOf(o)[1] + 10], shape: 'open' } } : null) });
  drawDog({ x: 900, y: 1560, s: 0.5, face: -1, t, look: 0.2, mouth: 0.8, tongue: 0, ears: 1 });
}
function jellyScene(t) {
  beach(t, 1300);
  const rev = t > T.v1;
  hunter(t, 520, 1100, 0.9, { face: -1, look: [-0.4, 0.6], brow: rev ? 0.2 : -0.6, mouth: rev ? 0.2 : 0.5, pop: rev ? 0 : 0.5,
    hands: o => (rev ? null : { near: { p: [470, 1260], shape: 'open' } }) });
  g.save(); g.globalAlpha = 0.7; g.fillStyle = 'rgba(80,170,210,0.75)'; g.fillRect(0, 1240, W, 70); g.restore();      // the water round his shins
  jellyfish(330, 1230, 0.8, t);
  drawDog({ x: 870, y: 1500, s: 0.5, face: -1, t, sit: 1, look: -0.4 });
}
function sandScene(t) {
  bog(t, 1150);
  const rev = t > T.v2, lie = seg(T.v2 + 0.2, T.v2 + 1.2, t);
  const sink = lerp(lerp(1215, 1255, seg(T.c5, T.v2, t, x => x)), 1182, lie);          // waist-deep, then floating on his back
  g.save(); g.translate(520, sink); g.rotate(-1.15 * lie); g.translate(-520, -sink);
  const up = !rev && Math.sin(t * 9) > 0;
  hunter(t, 520, sink, 0.85, { face: -1, look: rev ? [0, -1] : [0.2, -0.6], brow: rev ? 0.4 : 0.9, pop: rev ? 0 : 1, mouth: rev ? 0.1 : 0.7,
    hands: () => (rev ? { near: { p: [380, sink - 300], shape: 'open' }, far: { p: [680, sink - 300], shape: 'open' } }
      : { near: { p: [440, sink - (up ? 520 : 460)], shape: 'open' }, far: { p: [620, sink - (up ? 460 : 520)], shape: 'open' } }) });
  g.restore();
  sandOver(t, lerp(1190, 1222, lie), 520, lerp(260, 560, lie));
  drawDog({ x: 930, y: 1130, s: 0.48, face: -1, t, look: 0.4, mouth: 0.5, ears: 0.2 });
}
function endScene(t) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2a44'); gr.addColorStop(1, '#2a3a2a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
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
    const k = clamp(sp(t, 0.05, 2.4, 8));
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 360); g.scale(k, k); g.rotate(-0.03);
    const s = 'ПРАВДА ИЛИ МИФ?', sw = measure(s, 84) + 80; rrect(-sw / 2 + 10, -66 + 10, sw, 132, 22, INK); rrect(-sw / 2, -66, sw, 132, 22, '#ffd23f'); text(s, 0, 30, 84, INK, { shadow: false }); g.restore();
    Hd.ribbon(t, A.L0w4 - 0.05, T.c1 - 0.05, '2 ИЗ 3 МОГУТ УБИТЬ', { y: 1060, size: 70 });
  }
  if (sc === 'snake' && t > T.v0) {
    P(A.L2w1, T.c3 - 0.05, 320, { icon: 'x', title: 'ЯД УЖЕ В КРОВИ', color: DANGER, size: 42 });
    P(A.L2w6, T.c3 - 0.05, 440, { icon: 'x', title: 'РТОМ — ЗАРАЗА В РАНКУ', color: DANGER, size: 40 });
    P(A.L2w12, T.c3 - 0.05, 560, { icon: 'medkit', title: 'НЕ ДВИГАЙСЯ → К ВРАЧУ', color: OK, size: 42 });
  }
  if (sc === 'jelly' && t > T.v1) {
    P(A.L4w1, T.c5 - 0.05, 320, { icon: 'x', title: 'СТАНЕТ БОЛЬНЕЕ', color: DANGER, size: 42 });
    P(A.L4w4, T.c5 - 0.05, 440, { icon: 'drop', title: 'ПРОМОЙ МОРСКОЙ ВОДОЙ', sub: 'не пресной', color: OK, size: 42 });
    P(A.L4w8, T.c5 - 0.05, 580, { icon: 'check', title: 'ЩУПАЛЬЦА — ПИНЦЕТОМ', color: OK, size: 42 });
  }
  if (sc === 'sand' && t > T.v2) {
    P(A.L6w1, T.c7 - 0.05, 320, { icon: 'check', title: 'ТЫ ЛЕГЧЕ МОКРОГО ПЕСКА', color: OK, size: 40 });
    P(A.L6w9, T.c7 - 0.05, 440, { icon: 'check', title: 'НЕ ДЁРГАЙСЯ, ТЯНИ МЕДЛЕННО', color: OK, size: 38 });
  }
  if (sc === 'end') {
    const k = clamp(sp(t, T.c7 + 0.05, 2.4, 8)) * (1 - seg(A.L7w10 - 0.4, A.L7w10, t));
    if (k > 0.01) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.scale(k, k);
      rrect(-420 + 8, -230 + 10, 840, 460, 30, INK); rrect(-420, -230, 840, 460, 30, '#fff3d6');
      text('СКОЛЬКО УГАДАЛ?', 0, -140, 64, INK, { shadow: false });
      [['ЗМЕЯ', false], ['МЕДУЗА', false], ['ПЕСОК', true]].forEach(([s, tr], i) => {
        const x = -270 + i * 270; ell(x, -10, 70, 70, tr ? '#2f8f4e' : '#d62828'); text(tr ? '✓' : '✗', x, 18, 70, '#ffffff', { fam: FONTS.block, shadow: false });
        text(s, x, 110, 38, INK, { fam: FONTS.cond, shadow: false }); text(tr ? 'ПРАВДА' : 'МИФ', x, 158, 30, tr ? '#2f8f4e' : '#d62828', { fam: FONTS.mono, shadow: false });
      });
      g.restore();
    }
    P(A.L7w5, DUR + 1, 900, { icon: 'snow', title: 'ДАЛЬШЕ: МИФЫ ПРО ХОЛОД', color: GOLD, size: 44 });
  }
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ hook, snake: snakeScene, jelly: jellyScene, sand: sandScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  tag(t); dots(t); plaques(t); guess(t); verdict(t);
  Hd.endCard(t, A.L7w10 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  for (const t0 of [A.L0w0, A.L0w1, A.L0w3]) add(t0 - 0.08, 'pop_word', -10, 0);
  add(A.L0w4 - 0.05, 'stamp', -10, 0);
  add(T.c1, 'tweet', -16, 0.3, { dur: 1.2 }); add(T.c1 + 0.2, 'snort', -14, 0.4); add(T.c1 + 0.4, 'bark', -10, 0.4);
  add(T.c3, 'tap_run', -18, 0, { dur: T.c5 - T.c3 }); add(T.c3 + 0.1, 'tweet', -20, -0.3, { dur: 1.0 });
  add(T.c5, 'roof_wind', -16, 0, { dur: T.c7 - T.c5 }); add(T.c5 + 0.3, 'scrape', -14, 0, { dur: 0.8 });
  Q.forEach((q, i) => {
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, q[3] ? 'ding' : 'wall_hit', q[3] ? -8 : -14, 0);
  });
  add(T.c7, 'paper', -12, 0); for (let i = 0; i < 3; i++) add(T.c7 + 0.25 + i * 0.18, 'pop_word', -12, -0.3 + i * 0.3);
  add(A.L7w5, 'blip', -10, 0); add(A.L7w10, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
