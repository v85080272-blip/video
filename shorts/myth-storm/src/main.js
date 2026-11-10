// «Правда или миф», №2 «Мифы про холод» — the short 2D quiz on the rules of the Studio export (10.11): a bright first
// frame (a snowy day, «ПРАВДА ИЛИ МИФ?», three cards, «2 ИЗ 3 — ОПАСНЫЙ МИФ»), ≈40 s. Three tips against the cold, each:
// the tip (the hunter acts it out) → the viewer guesses (ПРАВДА / МИФ, a countdown, the music drops out) → the verdict and
// what to do instead. 1 a drink of vodka to warm up — myth (a thermometer of the body falls; hot sweet tea instead);
// 2 thin layers warm better than one thick coat — truth (warm air between them, take one off before you sweat);
// 3 rub frostbitten hands with snow — myth (warm water, don't rub). «Сколько угадал?» at the end. The hunter and Пурга.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { flask } from './hunter.js';
import { winterDay, layers, thickCoat, mug, bowl, thermometer, snowPuff, steam, card } from './story.js';
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
const HOT = { ЗАМЁРЗНУТЬ: GOLD, НАВРЕДЯТ: DANGER, ПРАВДА: OK, ВОДКИ: DANGER, МИФ: DANGER, КАЖЕТСЯ: DANGER, БЫСТРЕЕ: DANGER, ЧАЙ: OK,
  СЛОЁВ: GOLD, СЛОЯМИ: OK, ВОЗДУХ: OK, ВСПОТЕЕШЬ: OK, СНЕГОМ: DANGER, ЦАРАПАЕТ: DANGER, СИЛЬНЕЕ: DANGER, ТЁПЛОЙ: OK, ТРИ: DANGER,
  УГАДАЛ: GOLD, МЁРЗНЕТ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the three: [setup line, verdict line, scene, the true answer]
const Q = [['L1', 'L2', 'vodka', false], ['L3', 'L4', 'layers', true], ['L5', 'L6', 'snow', false]];
const T = { c1: A.L1 - 0.06, c3: A.L3 - 0.06, c5: A.L5 - 0.06, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; });     // the guess window, the verdict
export const CUTS = [T.c1, T.c3, T.c5, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c3 ? 'vodka' : t < T.c5 ? 'layers' : t < T.c7 ? 'snow' : 'end');
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w9, T.v0, T.v1, T.v2, A.L1w3, A.L3w3, A.L5w4];      // «навредят», the three verdicts, «водки», «слоёв», «снегом»
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
  winterDay(t, 1250);
  // all three cards are on screen from the very first frame (the feed shows it before the sound); each one bumps on its word
  const ks = [A.L0w0, A.L0w1, A.L0w4].map(t0 => 1 + 0.12 * (t >= t0 - 0.1 ? Math.exp(-(t - t0 + 0.1) / 0.15) : 0));
  [['vodka', 220], ['layers', 540], ['snow', 860]].forEach(([k, x], i) => card(x, 760, 0.9 * ks[i], k, t));
  hunter(t, 360, 1300, 0.62, { face: 1, look: [0.6, -0.3], brow: 0.4, mouth: 0.3 });
  drawDog({ x: 720, y: 1462, s: 0.55, face: -1, t, sit: 1, look: -0.3 });
}
const shiver = t => 4 * Math.sin(t * 40);
function vodkaScene(t) {
  winterDay(t, 1250);
  const rev = t > T.v0, tea = t > A.L2w11 - 0.1;
  const x = 420 + (rev ? 0 : shiver(t));
  hunter(t, x, 1150, 0.9, { face: 1, look: rev ? [0.6, 0] : [0.2, -0.2], brow: rev ? -0.3 : 0.7, pop: 0, mouth: rev ? 0.2 : 0.1,
    hands: o => { const m = mouthOf(o); return tea ? { near: { p: [m[0] + 30, m[1] + 110], shape: 'fist' } } : !rev && t > A.L1w3 - 0.2 ? { near: { p: [m[0] + 10, m[1] + 4], shape: 'fist' } } : { near: { p: [m[0] + 60, m[1] + 160], shape: 'fist' } }; } });
  if (!tea) { const o = { hip: [x, 1150], s: 0.9, face: 1 }; const m = mouthOf(o); flask(!rev && t > A.L1w3 - 0.2 ? m[0] + 20 : m[0] + 70, !rev && t > A.L1w3 - 0.2 ? m[1] - 6 : m[1] + 150, 1.6, !rev && t > A.L1w3 - 0.2 ? -2.2 : 0); }
  else { const o = { hip: [x, 1150], s: 0.9, face: 1 }; const m = mouthOf(o); mug(m[0] + 40, m[1] + 120, 0.9, t); }
  if (rev && !tea) { const v = lerp(36.6, 35.2, clamp((t - A.L2w7) / 1.2)); thermometer(900, 1190, 0.7 * clamp((t - A.L2w7 + 0.2) / 0.3), v); if (t > A.L2w7 - 0.2) Hd.label(v.toFixed(1).replace('.', ',') + ' °C  ↓', 900, 1360, 50, '#1d6fb8', { fam: FONTS.mono }); }
  drawDog({ x: 900, y: 1560, s: 0.5, face: -1, t, look: 0.2, mouth: 0.6, ears: 0.6 });
}
function layersScene(t) {
  winterDay(t, 1250);
  const rev = t > T.v1, off = rev && t > A.L4w8 - 0.1;
  hunter(t, 300, 1180, 0.82, { face: 1, look: [0.6, -0.1], brow: 0.3, mouth: 0.3 });
  // the diagram: one thick coat or three thin layers with warm air between them
  thickCoat(760, 1120, 0.72); Hd.label('ОДНА ТОЛСТАЯ', 760, 1215, 42, INK, { fam: FONTS.cond, shadow: false });
  layers(760, 800, 0.8, t, rev ? clamp((t - A.L4w1) / 0.6) : 0); Hd.label('ТРИ ТОНКИХ', 760, 880, 42, INK, { fam: FONTS.cond, shadow: false });
  if (off) { const u = clamp((t - A.L4w8 + 0.1) / 0.6); g.save(); g.globalAlpha = 1 - u; g.translate(760 + 200 * u, 800 - 120 * u); g.rotate(0.8 * u); g.lineWidth = 22 * 0.8; g.strokeStyle = '#3a6aa8'; g.beginPath(); g.arc(0, 0, 0.8 * 220, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.restore(); }
  drawDog({ x: 560, y: 1540, s: 0.5, face: 1, t, sit: 1, look: 0.4, wag: 1, wagPh: t * 3 });
}
function snowScene(t) {
  winterDay(t, 1250);
  const rev = t > T.v2, warm = rev && t > A.L6w8 - 0.1, rub = !rev && t > A.L5w4 - 0.2;
  const ph = Math.sin(t * 18);
  hunter(t, 400, 1150, 0.9, { face: 1, look: [0.5, 0.7], brow: rev ? 0.2 : 0.8, mouth: rev ? 0.2 : 0.4,
    hands: () => (warm ? { near: { p: [500, 1170], shape: 'open' }, far: { p: [555, 1175], shape: 'open' } }
      : { near: { p: [620 + (rub ? 26 * ph : 0), 1250], shape: 'open' }, far: { p: [660 - (rub ? 26 * ph : 0), 1262], shape: 'open' } }) });
  if (rub) snowPuff(640, 1250, t, 1);
  if (warm) bowl(525, 1195, 0.5, t);
  if (rev && !warm) Hd.redX(640, 1250, 160, clamp((t - T.v2) / 0.25));
  drawDog({ x: 900, y: 1560, s: 0.5, face: -1, t, look: 0.2, mouth: 0.5 });
}
function endScene(t) {
  winterDay(t, 1250);
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
    Hd.ribbon(t, -1, T.c1 - 0.05, '2 ИЗ 3 — ОПАСНЫЙ МИФ', { y: 1060, size: 66 });
  }
  if (sc === 'vodka' && t > T.v0) {
    P(A.L2w1, T.c3 - 0.05, 320, { icon: 'x', title: 'ТЕПЛО ТОЛЬКО КАЖЕТСЯ', color: DANGER, size: 42 });
    P(A.L2w6, T.c3 - 0.05, 440, { icon: 'x', title: 'ТЕЛО ОСТЫВАЕТ БЫСТРЕЕ', color: DANGER, size: 42 });
    P(A.L2w10, T.c3 - 0.05, 560, { icon: 'check', title: 'ГОРЯЧИЙ СЛАДКИЙ ЧАЙ', color: OK, size: 42 });
  }
  if (sc === 'layers' && t > T.v1) {
    P(A.L4w1, T.c5 - 0.05, 320, { icon: 'check', title: 'МЕЖДУ СЛОЯМИ — ТЁПЛЫЙ ВОЗДУХ', color: OK, size: 38 });
    P(A.L4w6, T.c5 - 0.05, 440, { icon: 'check', title: 'ЖАРКО — СНИМИ ОДИН', sub: 'мокрая одежда не греет', color: OK, size: 42 });
  }
  if (sc === 'snow' && t > T.v2) {
    P(A.L6w1, T.c7 - 0.05, 320, { icon: 'x', title: 'СНЕГ ЦАРАПАЕТ И МОРОЗИТ', color: DANGER, size: 42 });
    P(A.L6w8, T.c7 - 0.05, 440, { icon: 'drop', title: 'ГРЕЙ В ТЁПЛОЙ ВОДЕ', sub: 'не горячей', color: OK, size: 42 });
    P(A.L6w13, T.c7 - 0.05, 560, { icon: 'x', title: 'НЕ ТРИ', color: DANGER, size: 46 });
  }
  if (sc === 'end') {
    const k = clamp(sp(t, T.c7 + 0.05, 2.4, 8)) * (1 - seg(A.L7w10 - 0.4, A.L7w10, t));
    if (k > 0.01) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.scale(k, k);
      rrect(-420 + 8, -230 + 10, 840, 460, 30, INK); rrect(-420, -230, 840, 460, 30, '#fff3d6');
      text('СКОЛЬКО УГАДАЛ?', 0, -140, 64, INK, { shadow: false });
      [['ВОДКА', false], ['СЛОИ', true], ['СНЕГ', false]].forEach(([s, tr], i) => {
        const x = -270 + i * 270; ell(x, -10, 70, 70, tr ? '#2f8f4e' : '#d62828'); text(tr ? '✓' : '✗', x, 18, 70, '#ffffff', { fam: FONTS.block, shadow: false });
        text(s, x, 110, 38, INK, { fam: FONTS.cond, shadow: false }); text(tr ? 'ПРАВДА' : 'МИФ', x, 158, 30, tr ? '#2f8f4e' : '#d62828', { fam: FONTS.mono, shadow: false });
      });
      g.restore();
    }
    P(A.L7w6, DUR + 1, 900, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, КТО МЁРЗНЕТ', color: GOLD, size: 42 });
  }
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ hook, vodka: vodkaScene, layers: layersScene, snow: snowScene, end: endScene })[scene(t)](t);
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
  add(0, 'ice_wind', -18, 0, { dur: DUR }); add(0.02, 'stamp', -12, 0);
  for (const t0 of [A.L0w0, A.L0w1, A.L0w4]) add(t0 - 0.08, 'pop_word', -10, 0);
  add(A.L1w3 - 0.1, 'pour', -14, 0.2, { dur: 0.6 }); add(A.L2w11, 'pour', -16, 0.2, { dur: 0.6 });
  add(T.c3 + 0.1, 'cloth', -14, -0.2); add(A.L4w8 - 0.1, 'whoosh', -14, 0.3);
  add(A.L5w4 - 0.2, 'crawl', -12, 0.1, { dur: Math.max(0.6, T.g2 - A.L5w4 + 0.2) }); add(A.L6w8 - 0.1, 'splash', -14, 0.2);
  Q.forEach((q, i) => {
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, q[3] ? 'ding' : 'wall_hit', q[3] ? -8 : -14, 0);
  });
  add(T.c7, 'paper', -12, 0); for (let i = 0; i < 3; i++) add(T.c7 + 0.25 + i * 0.18, 'pop_word', -12, -0.3 + i * 0.3);
  add(A.L7w6, 'blip', -10, 0); add(A.L7w10, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
