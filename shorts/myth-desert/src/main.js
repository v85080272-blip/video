// «Правда или миф», №6 «Пустыня» — the first in three columns (the viewer's idea of 11.11: the three situations side by
// side, so the screen is never empty while they guess). The first frame (from 0 s): the screen split in three — the
// hunter about to cut a cactus, the hunter with a flask at noon, the hunter and Пурга walking at night — «ПРАВДА ИЛИ
// МИФ?», «2 ИЗ 3 МОГУТ УБИТЬ», a number over each column. Before each question its column opens to the whole screen;
// after the verdict it closes back and gets its stamp. The end is the three columns again with the stamps and «Сколько
// угадал?» — the loop back to the first frame. Tips: 1 cactus juice — myth (acid and alkaloids: you vomit and thirst
// more); 2 drink by drops to stretch the water — myth (a heat stroke; drink when thirsty, save sweat); 3 walk at night,
// hide from the sun by day — truth (cool: you sweat less, the flask lasts longer).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf, flask } from './hunter.js';
import { drawDog } from './dog.js';
import { FLOOR, dayBg, nightBg, saguaro, rock, thermo, drop, sick, stars } from './desert.js';
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
const HOT = { ПУСТЫНЕ: GOLD, УБИТЬ: DANGER, ПРАВДА: OK, КАКТУС: GOLD, СОК: DANGER, МИФ: DANGER, ВЫРВЕТ: DANGER, КАПЛЕ: GOLD, ТЕПЛОВОГО: DANGER,
  УДАРА: DANGER, ХОЧЕТСЯ: OK, ПОТ: OK, НОЧЬЮ: OK, ПРОХЛАДНО: OK, НАДОЛЬШЕ: OK, УГАДАЛ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the three: [setup line, verdict line, the true answer, the column's label]
const Q = [['L1', 'L2', false, 'СОК КАКТУСА'], ['L3', 'L4', false, 'ПИТЬ ПО КАПЛЕ'], ['L5', 'L6', true, 'ИДТИ НОЧЬЮ']];
const OPEN = 0.45, CLOSE = 0.3;
const T = { c1: A.L1 - OPEN, c3: A.L3 - OPEN, c5: A.L5 - OPEN, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; T['x' + i] = A[v + 'e'] + 0.05; });   // guess, verdict, close
export const CUTS = [];
export const SNAPS = [];
export const MARKS = { ...T, A, truth: Q.map(q => q[2]) };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const focus = (i, t) => seg(A[Q[i][0]] - OPEN, A[Q[i][0]] - 0.05, t) * (1 - seg(T['x' + i], T['x' + i] + CLOSE, t));
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w8, T.v0, T.v1, T.v2, A.L1w4, A.L3w7, A.L5w2];   // «убить», the verdicts, «разрежь», «капле», «ночью»
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }

// —— the hunter, standing: hip at (x, y) ——
const S = 0.62, HIP = FLOOR - 262 * S;
function hunter(t, x, y, s, o = {}) {
  const base = { hip: [x, y], feet: o.feet ?? { near: [x - 30 * s, y + 262 * s], far: [x + 34 * s, y + 262 * s] }, s, face: o.face ?? -1, look: o.look ?? [0, 0],
    brow: o.brow ?? 0, pop: o.pop ?? 0, mouth: o.mouth ?? 0.15, blink: ((t + 0.7) % 3.4) < 0.12 ? 1 : 0, scarf: 'neck', lean: o.lean, ...o.extra };
  if (o.hands) base.hands = o.hands(base);
  return drawHunter(base);
}
const mouthOf = (x, y, s, face, lean) => framesOf({ hip: [x, y], s, face, lean }).H.p([-34, 40]);
function knife(x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  rrect(-8, -6, 40, 14, 5, '#6b4a2b'); fill(polyPath([[30, -7], [92, -2], [30, 9]]), '#d9dee6'); limb([[32, -4], [86, -1]], 2, '#ffffff', false);
  g.restore();
}
function walkFeet(x, y, s, ph) { return { near: [x - 10 * s + 46 * s * Math.sin(ph), y + 262 * s - 14 * s * Math.max(0, Math.cos(ph))], far: [x + 14 * s - 46 * s * Math.sin(ph), y + 262 * s - 14 * s * Math.max(0, -Math.cos(ph))] }; }

// —— the three scenes; st: 'idle' (before its question: the first frame), 'live' (its question), 'done' (after it) ——
function cactusScene(t, st) {
  const live = st === 'live', after = st === 'done' || (live && t > T.v0);
  dayBg(t, { sunX: 820 });
  const cut = after ? 1 : live ? seg(A.L1w4 - 0.1, A.L1w5 + 0.1, t) : 0;
  saguaro(t, 650, FLOOR + 10, 640, { cut, drip: cut > 0.5 });
  drawDog({ x: 250, y: FLOOR + 150, s: 0.5, face: 1, t, sit: 1, look: 0.3, ears: after ? 0.9 : 0.4, mouth: after ? 0.5 : 0.2 });
  if (after) {
    const k = st === 'done' ? 1 : seg(T.v0, T.v0 + 0.4, t), lean = 0.05 + 0.35 * k;
    hunter(t, 430, HIP + 20 * k, S, { face: 1, lean, look: [0.2, 0.6], brow: 0.9, pop: 1, mouth: 0.65,
      hands: o => ({ near: { p: [470, HIP - 40], shape: 'open' }, far: { p: [400, HIP - 30], shape: 'open' } }) });
    const m = mouthOf(430, HIP + 20 * k, S, 1, lean);
    sick(m[0] - 10, m[1] - 230, t, k);
    if (live && t < T.v0 + 1.2) Hd.redX(760, 880, 220, clamp((t - T.v0 - 0.15) / 0.25));
    return;
  }
  const drink = live && t > A.L1w7 - 0.25, cutting = live && t > A.L1w4 - 0.3 && !drink;
  if (drink) {
    const m = mouthOf(430, HIP, S, 1, 0.05), k = seg(A.L1w7 - 0.25, A.L1w7 + 0.1, t);
    hunter(t, 430, HIP, S, { face: 1, look: [0.4, 0], brow: 0.2, mouth: 0.4, hands: o => ({ near: { p: [lerp(560, m[0] + 20, k), lerp(HIP - 260, m[1] + 30, k)], shape: 'grip' } }) });
    drop(lerp(560, m[0] + 24, k), lerp(HIP - 290, m[1] + 4, k), 0.8, '#a9dc7e');
  } else {
    const hx = cutting ? lerp(530, 600, bump(clamp((t - A.L1w4 + 0.3) / 0.6))) : 530 + 6 * Math.sin(t * 3), hy = cutting ? HIP - 200 : HIP - 170 + 8 * Math.sin(t * 3);
    hunter(t, 430, HIP, S, { face: 1, look: [0.8, -0.4], brow: 0.3, mouth: 0.2, hands: o => ({ near: { p: [hx, hy], shape: 'fist' } }) });
    knife(hx + 6, hy - 6, cutting ? 0.05 : -0.45);
  }
}
function flaskScene(t, st) {
  const live = st === 'live', fallen = live && t > T.v1 && t < A.L4w6 - 0.1;
  dayBg(t, { heat: 1, sunX: 300, sunY: 260 });
  const shadeK = st === 'done' ? 1 : live ? seg(A.L4w10 - 0.2, A.L4w10 + 0.3, t) : 0;
  if (shadeK > 0) { g.save(); g.globalAlpha = shadeK; rock(380, FLOOR + 30, 1.25, 1); g.restore(); }
  const temp = thermo(650, FLOOR - 70, 0.85 + 0.05 * Math.sin(t * 4), '+45°');
  text(temp, 650, FLOOR - 470, 46, '#c62828', { fam: FONTS.block });
  if (fallen) {                                                        // the heat stroke: he sways and falls back
    const k = seg(T.v1 + 0.1, T.v1 + 0.6, t, ease.in), fx = 470, fy = FLOOR;
    g.save(); g.translate(fx, fy); g.rotate(1.35 * k); g.translate(-fx, -fy);
    hunter(t, 470, HIP, S, { face: 1, look: [0, -0.6], brow: 0.9, pop: 1, mouth: 0.6, hands: o => ({ near: { p: [560, HIP - 300], shape: 'open' }, far: { p: [380, HIP - 280], shape: 'open' } }) });
    g.restore();
    const hd = [lerp(470, 470 + 360, k), lerp(HIP - 380, FLOOR - 80, k)];
    stars(hd[0], hd[1] - 40, t, seg(T.v1 + 0.5, T.v1 + 0.8, t));
    if (t < T.v1 + 1.2) Hd.redX(300, 820, 220, clamp((t - T.v1 - 0.15) / 0.25));
    return;
  }
  const gulp = st === 'done' || (live && t > A.L4w6 - 0.1);
  const shake = live && t > A.L3w1 - 0.1 && t < A.L3w5 - 0.1;
  const hx = shadeK > 0.5 ? 330 : 470;
  const m = mouthOf(hx, HIP, S, 1, 0.05);
  if (shake) {
    const sx = m[0] + 70, sy = m[1] - 60 + 12 * Math.sin(t * 30);
    hunter(t, hx, HIP, S, { face: 1, look: [0.6, -0.5], brow: 0.6, mouth: 0.3, hands: o => ({ near: { p: [sx, sy + 30], shape: 'grip' } }) });
    flask(sx, sy, 1.1, 0.5 * Math.sin(t * 30));
  } else {
    const ang = gulp ? -2.4 : -2.0, fpx = m[0] + 34, fpy = m[1] - 24;
    hunter(t, hx, HIP, S, { face: 1, look: [0.3, -0.6], brow: gulp ? 0 : 0.5, mouth: 0.5, lean: -0.05, hands: o => ({ near: { p: [fpx + 10, fpy + 40], shape: 'grip' } }) });
    flask(fpx, fpy, 1.1, ang);
    if (gulp) { for (let i = 0; i < 3; i++) drop(fpx - 18 - i * 4, fpy + 10 + ((t * 3 + i / 3) % 1) * 30, 0.35); }
    else { const u = (t * 0.9) % 1; drop(fpx - 22, fpy + 8 + u * 24, 0.5); }
  }
  drawDog({ x: 880, y: FLOOR + 150, s: 0.48, face: -1, t, sit: 1, look: -0.3, mouth: 0.7, tongue: 1 });
}
function nightScene(t, st) {
  const live = st === 'live';
  const kd = live ? seg(A.L5w4 - 0.1, A.L5w4 + 0.3, t) * (1 - seg(T.v2 - 0.2, T.v2 + 0.2, t)) : 0;   // the day: hide from the sun
  const sc = t * 120;
  nightBg(t, { scroll: sc });
  if (kd > 0) { g.save(); g.globalAlpha = kd; dayBg(t, { heat: 1, sunX: 820, sunY: 260 }); g.restore(); }
  if (kd > 0.5) {
    rock(560, FLOOR + 30, 1.4, 1);
    const hx = 520, hy = FLOOR - 100;
    hunter(t, hx, hy, S, { face: 1, look: [0.6, 0.2], brow: 0.1, mouth: 0.2, feet: { near: [hx + 120, FLOOR + 10], far: [hx + 160, FLOOR + 12] } });
    drawDog({ x: 330, y: FLOOR + 140, s: 0.45, face: 1, t, sit: 1, look: 0.2, mouth: 0.6, tongue: 1 });
    return;
  }
  const ph = t * 5.2, bob = 6 * Math.abs(Math.sin(ph));
  hunter(t, 440, HIP - bob, S, { face: 1, look: [0.8, -0.1], brow: 0.0, mouth: 0.25, feet: walkFeet(440, HIP - bob, S, ph),
    hands: o => ({ near: { p: [440 + 45 * Math.sin(ph), HIP + 10], shape: 'fist' }, far: { p: [440 - 45 * Math.sin(ph), HIP], shape: 'fist' } }) });
  drawDog({ x: 612, y: FLOOR + 140, s: 0.42, face: 1, t, walk: 1, ph: t * 2.6, look: 0.2, ears: 0.6 });
  if (live && t > T.v2 && t < T.x2) {
    const k = clamp(sp(t, T.v2 + 0.1, 2.4, 8));
    g.save(); g.translate(880, 1180); g.scale(k, k); thermo(0, 0, 0.25, '', '#42a5f5'); g.restore();
    if (k > 0.5) text('+20°', 880, 770, 50, '#90caf9', { fam: FONTS.block });
  }
}
const SCENES = [cactusScene, flaskScene, nightScene];
const stateOf = (i, t) => (t < A[Q[i][0]] - OPEN ? 'idle' : t < T['x' + i] + CLOSE ? 'live' : 'done');

// —— the columns ——
const CW = 352, X0 = [0, 364, 728], CX = X0.map(x => x + CW / 2);
function column(i, t, x0, w, off) {
  g.save(); g.beginPath(); g.rect(x0, 0, w, H); g.clip(); g.translate(off, 0);
  SCENES[i](t, stateOf(i, t));
  g.restore();
}
function columns(t) {
  const F = Q.map((q, i) => focus(i, t)), top = F.findIndex(f => f > 0);
  if (top >= 0 && F[top] >= 1) { column(top, t, 0, W, 0); return F; }
  rect(0, 0, W, H, INK);
  for (let j = 0; j < 3; j++) if (j !== top) column(j, t, X0[j], CW, CX[j] - 540);
  if (top >= 0) { const e = ease.inOut(F[top]); column(top, t, lerp(X0[top], 0, e), lerp(CW, W, e), lerp(CX[top] - 540, 0, e)); }
  return F;
}

// —— the 2D layer: the quiz ——
function tag(t) {
  const s = 'ПРАВДА ИЛИ МИФ', tw = measure(s, 40, FONTS.cond) + 50;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(60 + tw, 150); g.rotate(-0.03); rect(-tw + 6, -32 + 6, tw, 64, INK); rect(-tw, -32, tw, 64, '#ff4d4d'); text(s, -tw / 2, 14, 40, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
}
function dots(t, open) {                               // three dots at the top right while a column is open
  if (open < 0.5) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Q.forEach(([, , truth], i) => {
    const x = 760 + i * 100, y = 150, done = t > T['v' + i] + 0.1, cur = qOf(t) === i;
    ell(x, y, 38, 38, done ? (truth ? '#2f8f4e' : '#d62828') : cur ? '#ffd23f' : 'rgba(255,255,255,0.25)');
    text(done ? (truth ? '✓' : '✗') : String(i + 1), x, y + 16, 44, done || cur ? '#ffffff' : '#c9d6ea', { fam: FONTS.block, shadow: false });
  });
}
function headline(s, y, k, color = '#ffd23f') {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.03); g.scale(k, k);
  const sw = measure(s, 84) + 80; rrect(-sw / 2 + 10, -66 + 10, sw, 132, 22, INK); rrect(-sw / 2, -66, sw, 132, 22, color); text(s, 0, 30, 84, INK, { shadow: false }); g.restore();
}
function badges(t, open) {                             // over each column: its number, or its stamp once answered; its label below
  const k = 1 - open; if (k <= 0.01) return;
  const bumpAt = [A.L0w0, A.L0w1, A.L0w3];
  Q.forEach(([, , truth, label], i) => {
    const x = CX[i], done = t > T['x' + i], b = 1 + 0.18 * (t >= bumpAt[i] - 0.1 && t < T.c1 ? Math.exp(-(t - bumpAt[i] + 0.1) / 0.15) : 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k; g.translate(x, 680);
    if (done) {
      const ks = clamp(sp(t, T['x' + i] + CLOSE * 0.6, 2.6, 8)), z = lerp(1.8, 1, Math.min(1, ks)); g.rotate(-0.12); g.scale(z, z); g.globalAlpha = k * Math.min(1, ks * 3);
      const s = truth ? 'ПРАВДА' : 'МИФ', sw = measure(s, 62) + 50;
      rrect(-sw / 2 + 8, -48 + 8, sw, 96, 18, INK); rrect(-sw / 2, -48, sw, 96, 18, truth ? '#2f8f4e' : '#d62828'); text(s, 0, 22, 62, '#fff3d6', { shadow: false });
    } else {
      g.scale(b, b); ell(4, 6, 62, 62, INK); ell(0, 0, 62, 62, '#fff3d6'); text(String(i + 1), 0, 30, 84, '#c0392b', { fam: FONTS.block, shadow: false });
    }
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
    const lw = measure(label, 34, FONTS.cond) + 36; rrect(x - lw / 2 + 5, 1300 + 6, lw, 62, 14, INK); rrect(x - lw / 2, 1300, lw, 62, 14, '#fff3d6');
    text(label, x, 1343, 34, INK, { fam: FONTS.cond, shadow: false }); g.restore();
  });
}
function guess(t) {
  // during the guess window: two buttons and a countdown; at the verdict the true one grows, the other fades
  Q.forEach(([s, v, truth], i) => {
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
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1130, 700, 26, 13), 'rgba(255,255,255,0.3)'); fill(rrPath(190, 1130, 700 * (1 - u), 26, 13), GOLD);
      Hd.label('УГАДАЙ', 540, 1210, 44, '#ffffff', { fam: FONTS.mono });
    }
  });
}
function verdict(t) {
  Q.forEach(([, v, truth], i) => {
    const v0 = T['v' + i], ks = sp(t, v0, 2.2, 8), out = seg(v0 + 1.3, v0 + 1.6, t);
    if (ks <= 0.01 || out >= 1) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.07); const z = lerp(1.9, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3) * (1 - out);
    const s = truth ? 'ПРАВДА' : 'МИФ', sw = measure(s, 130) + 100;
    rrect(-sw / 2 + 12, -92 + 12, sw, 184, 24, INK); rrect(-sw / 2, -92, sw, 184, 24, truth ? '#2f8f4e' : '#d62828'); text(s, 0, 46, 130, '#fff3d6', { shadow: false });
    g.restore();
  });
}
function plaques(t, open) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  const k0 = 1 - seg(T.c1, T.c1 + 0.25, t);
  if (k0 > 0.01) { g.save(); g.globalAlpha = k0; headline('ПРАВДА ИЛИ МИФ?', 330, 1); g.restore(); }
  if (t < T.c1 + 0.2) Hd.ribbon(t, -1, T.c1 - 0.05, '2 ИЗ 3 МОГУТ УБИТЬ', { y: 510, size: 64, rot: -0.05 });
  P(A.L2w1, T.x0, 320, { icon: 'x', title: 'В СОКЕ КИСЛОТА И ЯДЫ', color: DANGER, size: 42 });
  P(A.L2w7, T.x0, 440, { icon: 'x', title: 'ВЫРВЕТ — ЖАЖДА СИЛЬНЕЕ', color: DANGER, size: 42 });
  P(A.L4w2, T.x1, 320, { icon: 'x', title: 'ПО КАПЛЕ — ТЕПЛОВОЙ УДАР', color: DANGER, size: 40 });
  P(A.L4w6, T.x1, 440, { icon: 'check', title: 'ПЕЙ, КОГДА ХОЧЕТСЯ', color: OK, size: 44 });
  P(A.L4w10, T.x1, 560, { icon: 'check', title: 'БЕРЕГИ ПОТ: ДНЁМ В ТЕНЬ', color: OK, size: 40 });
  P(A.L5w4, T.v2 - 0.1, 320, { icon: 'check', title: 'ДНЁМ — В УКРЫТИЕ', color: OK, size: 44 });
  P(A.L6w1, T.x2, 320, { icon: 'check', title: 'НОЧЬЮ ПРОХЛАДНО', color: OK, size: 44 });
  P(A.L6w3, T.x2, 440, { icon: 'check', title: 'МЕНЬШЕ ПОТА — ВОДЫ ХВАТИТ ДОЛЬШЕ', color: OK, size: 34 });
  if (t >= T.c7 - 0.3) {
    headline('СКОЛЬКО УГАДАЛ?', 330, clamp(sp(t, T.c7 - 0.2, 2.4, 8)) * (1 - seg(A.L7w11 - 0.4, A.L7w11 - 0.1, t)));
    P(A.L7w6, A.L7w11 - 0.25, 520, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, КТО ЛЮБИТ ПОХОДЫ', color: GOLD, size: 38 });
  }
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  const F = columns(t), open = Math.max(...F);
  g.setTransform(1, 0, 0, 1, 0, 0);
  tag(t); dots(t, open); badges(t, open); plaques(t, open); guess(t); verdict(t);
  Hd.endCard(t, A.L7w11 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0); add(0, 'roof_wind', -26, 0, { dur: DUR });
  for (const t0 of [A.L0w0, A.L0w1, A.L0w3]) add(t0 - 0.08, 'pop_word', -10, 0);
  Q.forEach(([s], i) => { add(A[s] - OPEN, 'whoosh', -14, -0.3 + 0.3 * i); add(T['x' + i], 'whoosh', -16, 0); });
  add(A.L1w4, 'scrape', -14, 0.2, { dur: 0.5 }); add(A.L1w7, 'fill_plink', -12, 0);
  add(A.L3w1, 'fill_plink', -14, 0.1); add(A.L3w7, 'fill_plink', -12, 0); add(T.v1 + 0.55, 'thud', -10, -0.2); add(A.L4w6, 'pour', -18, 0, { dur: 0.6 });
  add(A.L5w1, 'steps_out', -16, 0, { dur: A.L5w4 - A.L5w1 }); add(T.v2 + 0.3, 'steps_out', -16, 0, { dur: T.x2 - T.v2 - 0.3 });
  Q.forEach((q, i) => {
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, q[2] ? 'ding' : 'wall_hit', q[2] ? -8 : -14, 0);
    add(T['x' + i] + CLOSE * 0.6, 'stamp', -12, 0);
  });
  add(A.L7w6, 'blip', -10, 0); add(A.L7w11, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
