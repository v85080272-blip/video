// «Радиоактивное озеро»: the whole short as pure functions of time t (seconds), so any frame or motion-blur sub-frame can
// be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from tools/voice.py): another
// take moves the picture with it (STORYBOARD.md).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Wd from './world.js';
import { drawHunter, framesOf, rod, floatAt, fish, oar, dosimeter, HUN } from './hunter.js';
import { text, groupWords, subtitles, INK, FONTS, measure } from './type.js';
import * as O from './overlay.js';

const { F } = Wd;
// —— the narration ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
// the opening question is a title, not a subtitle
const SUBS = VOICE ? VOICE.lines.filter(l => l.id !== 'L0').flatMap(l => groupWords(l.words, Array.isArray(l.sub) ? l.sub : null)) : [];
const LN = id => VOICE?.lines.find(l => l.id === id);
const at = (id, d) => LN(id)?.at ?? d, end = (id, d) => LN(id)?.end ?? d;
const wd = (id, i, d) => LN(id)?.words[i]?.s ?? d;
export const DUR = VOICE?.dur ?? 42.5;
const A = {
  L0w0: wd('L0', 0, 0.12), L0w2: wd('L0', 2, 0.85), L0w6: wd('L0', 6, 1.95), L0e: end('L0', 3.0),
  L1: at('L1', 3.35), L1w1: wd('L1', 1, 3.6), L1w3: wd('L1', 3, 4.3), L1w4: wd('L1', 4, 4.65), L1w5: wd('L1', 5, 5.15), L1e: end('L1', 5.75),
  L2: at('L2', 6.1), L2w2: wd('L2', 2, 6.95), L2w3: wd('L2', 3, 7.15), L2w4: wd('L2', 4, 7.6), L2w6: wd('L2', 6, 7.9), L2w7: wd('L2', 7, 8.55), L2w9: wd('L2', 9, 9.3), L2e: end('L2', 9.75),
  L3: at('L3', 10.15), L3w2: wd('L3', 2, 10.95), L3w4: wd('L3', 4, 11.5), L3w5: wd('L3', 5, 12.1), L3w7: wd('L3', 7, 12.6), L3w9: wd('L3', 9, 13.3), L3e: end('L3', 14.4),
  L4: at('L4', 14.8), L4w1: wd('L4', 1, 15.5), L4w4: wd('L4', 4, 16.15), L4w7: wd('L4', 7, 16.65), L4w8: wd('L4', 8, 16.95), L4w9: wd('L4', 9, 17.3),
  L4w10: wd('L4', 10, 17.95), L4w13: wd('L4', 13, 18.7), L4w16: wd('L4', 16, 19.4), L4e: end('L4', 19.9),
  L5: at('L5', 20.3), L5w1: wd('L5', 1, 21.0), L5w3: wd('L5', 3, 21.4), L5w5: wd('L5', 5, 21.8), L5w6: wd('L5', 6, 22.35), L5w8: wd('L5', 8, 22.85),
  L5w10: wd('L5', 10, 23.25), L5w11: wd('L5', 11, 23.8), L5w12: wd('L5', 12, 24.0), L5w14: wd('L5', 14, 24.5), L5w15: wd('L5', 15, 24.8), L5e: end('L5', 25.3),
  L6: at('L6', 25.7), L6w2: wd('L6', 2, 26.6), L6w3: wd('L6', 3, 26.95), L6w4: wd('L6', 4, 27.3), L6w6: wd('L6', 6, 27.9), L6w7: wd('L6', 7, 28.5),
  L6w10: wd('L6', 10, 29.15), L6w12: wd('L6', 12, 30.1), L6w13: wd('L6', 13, 30.85), L6e: end('L6', 31.3),
  L7: at('L7', 31.7), L7w1: wd('L7', 1, 32.3), L7w3: wd('L7', 3, 32.85), L7w5: wd('L7', 5, 33.4), L7w7: wd('L7', 7, 34.05), L7w8: wd('L7', 8, 34.3),
  L7w9: wd('L7', 9, 35.15), L7w10: wd('L7', 10, 35.35), L7w13: wd('L7', 13, 36.1), L7e: end('L7', 36.6),
  L8: at('L8', 37.05), L8w3: wd('L8', 3, 37.85), L8w7: wd('L8', 7, 38.7), L8e: end('L8', 40.0),
};
// —— the shots ——
const T = {
  cover: 0.3,                                    // the poster: the first frames
  c1: A.L1 - 0.06,                               // «Ты рыбачишь»: the boat, closer
  crack: A.L1w4 - 0.04,                          // «затрещал»: the dosimeter
  c2: A.L2 - 0.06,                               // «Радиоактивная вода…»: the film cliché
  greenOff: A.L2w6 + 0.32,                       // back to the real lake after «кино»
  c3: A.L3 - 0.05,                               // «Первое»: don't jump
  c4: A.L4 - 0.05,                               // «Второе»: the fish
  c5: A.L5 - 0.05,                               // «Третье»: the oars
  row0: A.L5w1 - 0.12, row1: Math.min(A.L5w6 + 0.35, A.L5w8 - 0.35),     // rowing to the shore, done before the jump
  jump: A.L5w8 - 0.1,                            // «уходи от воды»: out of the boat
  c6: A.L6 - 0.05,                               // «Четвёртое»: at the gate
  jacket: A.L6w4 - 0.12, boots: A.L6w6 - 0.12,   // off and into the bag
  c7: A.L7 - 0.05,                               // «Пятое»: the summer shower
  c8: A.L8 - 0.05,                               // the end: thumbs up, pull back to the lake
};
T.land = T.jump + 0.42;
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.c7];
export const SNAPS = [T.greenOff, T.jacket + 0.1, T.boots + 0.1];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.5, LEG = 114;

// —— the boat on the water: where it is, and how it rocks ——
const BOAT_END = Wd.SHORE + 300;
function boatAt(t) {
  const x = t < T.row0 ? Wd.BOAT0.x : lerp(Wd.BOAT0.x, BOAT_END, seg(T.row0, T.row1, t, u => ease.inOut(u) * 0.3 + u * 0.7));
  let tilt = 0;
  if (t > A.L3 && t < A.L3w5) tilt += 0.06 * Math.sin((t - A.L3) * 9) * Math.exp(-(t - A.L3) * 1.2);     // he stands up: it rocks
  if (t > T.jump && t < T.jump + 1.4) tilt += 0.07 * Math.sin((t - T.jump) * 10) * Math.exp(-(t - T.jump) * 3);
  return Wd.boatFrame(x, 0, t, tilt);
}

// —— walking and running on the shore: plants for each foot, the hip gliding over them (as in «Вулкан») ——
const PL = { near: [], far: [] };
const RUNS = [];
function plant(foot, t, x, swing = 0.22, lift = 30) { PL[foot].push({ t, p: [x, Wd.groundY(x)], swing, lift }); }
const EASES = { 'in-out': ease.inOut, 'lin-out': u => 1 - (1 - u) * (1 - u), 'in-lin': u => u * u, 'lin-lin': u => u };
function invert(f, y) { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (f(m) < y) a = m; else b = m; } return (a + b) / 2; }
function run(t0, t1, x0, x1, L, first = 'near', ef = 'in-out', lift = 30) {
  const e = EASES[ef], n = Math.max(2, Math.round(Math.abs(x1 - x0) / L)), dir = Math.sign(x1 - x0), step = (x1 - x0) / n;
  RUNS.push({ t0, t1, x0, x1, e });
  let foot = first, prev = t0 - 0.2;
  for (let i = 1; i <= n; i++) {
    const tt = lerp(t0, t1, invert(e, (i - 0.5) / n));
    plant(foot, tt, x0 + step * i - (i === n ? dir * 14 : 0), Math.min(0.3, (tt - prev) * 0.9 + 0.04), lift);
    prev = tt; foot = foot === 'near' ? 'far' : 'near';
  }
  plant(foot, t1 + 0.1, x1 + dir * 22, 0.18, 14);
}
function footAt(foot, t, fallback) {
  const L = PL[foot];
  let i = -1; while (i + 1 < L.length && L[i + 1].t <= t) i++;
  const cur = i >= 0 ? L[i].p : fallback, nx = L[i + 1];
  if (!nx || t < nx.t - nx.swing) return cur;
  const u = clamp((t - (nx.t - nx.swing)) / nx.swing), e = ease.inOut(u);
  return [lerp(cur[0], nx.p[0], e), lerp(cur[1], nx.p[1], e) - nx.lift * Math.sin(Math.PI * u)];
}
function hipXAt(t) {
  let r = RUNS[0];
  for (const q of RUNS) if (t >= q.t0) r = q;
  if (t <= r.t0) return r.x0;
  if (t >= r.t1) return r.x1;
  return lerp(r.x0, r.x1, r.e((t - r.t0) / (r.t1 - r.t0)));
}
let ALL = null;
function stepAt(t) {
  ALL ??= [...PL.near.map(p => [p.t, 1]), ...PL.far.map(p => [p.t, -1])].sort((a, b) => a[0] - b[0]);
  let i = -1; while (i + 1 < ALL.length && ALL[i + 1][0] <= t) i++;
  if (i < 0 || i + 1 >= ALL.length || ALL[i + 1][0] - ALL[i][0] > 0.45) return { up: 0, sw: 0 };
  const u = (t - ALL[i][0]) / (ALL[i + 1][0] - ALL[i][0]);
  return { up: Math.sin(Math.PI * u), sw: ALL[i][1] * Math.cos(Math.PI * u) };
}
// the route on foot: off the boat, up the path, past the birches toward the gate (the cut jumps to the gate)
const LANDX = Wd.SHORE - 70, GATE_STOP = Wd.GATE.x + 300, MIDWAY = -2080;
run(T.land + 0.12, A.L5e + 0.35, LANDX, MIDWAY, 115, 'near');
run(T.c6 - 0.05, A.L6w3 - 0.15, MIDWAY - 60, GATE_STOP, 115, 'far', 'lin-out');

// —— the hunter's acting ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.05, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, scarf: null, glasses: null, pack: false, ...extra });
function swingArms(o, sw, k = 1) {
  const F0 = framesOf(o), dir = o.face;
  const arm = (side, a) => {
    const Sh = F0.T.p(side === 'near' ? [-14, -192] : [18, -198]), len = 160 * S;
    return { p: [Sh[0] + dir * Math.sin(a) * len, Sh[1] + Math.cos(a) * len * 0.9], shape: 'fist' };
  };
  return { near: arm('near', 0.15 + 0.85 * sw * k), far: arm('far', 0.15 - 0.85 * sw * k) };
}
function onFoot(t, o) {
  const x = hipXAt(t);
  o.feet = { near: footAt('near', t, [x - 10, Wd.groundY(x - 10)]), far: footAt('far', t, [x + 14, Wd.groundY(x + 14)]) };
  o.hip = [x, Wd.groundY(x) - LEG - 12 * stepAt(t).up];
  return o;
}
// the dosimeter: how hard it clicks (0 … 1) and its lamp
const dose = t => {
  if (t < T.crack) return 0.12;
  if (t < T.row0) return 0.95;
  if (t < T.land) return lerp(0.95, 0.45, seg(T.row0, T.land, t));
  return lerp(0.45, 0.08, seg(A.L5w11, A.L5w15 + 0.2, t));
};
const ledAt = t => { const r = 3 + 30 * dose(t); return ((t * r) % 1) < 0.35 ? 1 : 0; };

export function hunterAt(t) {
  const b = boatAt(t);
  // —— in the boat ——
  if (t < T.jump) {
    const o = base(t, { face: -1, dosi: { led: ledAt(t), jump: 0 } });
    o.hip = Wd.boatP(b, [10, -128]);
    o.feet = { near: Wd.boatP(b, [-110, -40]), far: Wd.boatP(b, [-80, -40]) };
    const F0 = framesOf(o);
    let fl = [b.x - 520, 4 + 4 * Math.sin(t * 2.3)], bend = 0, rodA = -2.7, hand = F0.T.p([-110, -110]);
    o.prop = { kind: 'rod', fl, bend, ang: rodA };
    // calm, a little sleepy; the crack wakes him up
    o.lid = 0.55; o.look = [-0.6, 0.3];
    if (t > T.crack) {
      const k = sp(t, T.crack, 2.4, 6);
      o.lid = 0.2; o.pop = 0.9 * clamp(k) * (1 - seg(A.L2, A.L2 + 0.5, t) * 0.5); o.brow = 0.8 * clamp(k); o.mouth = 0.5 * clamp(k) * (1 - seg(A.L1e, A.L2, t));
      o.hatJump = 30 * bump((t - T.crack) / 0.35); o.look = [0.2, 0.7];
      o.dosi.jump = 18 * bump((t - T.crack) / 0.3) + 6 * bump(((t - T.crack) * 6) % 1) * (t < A.L2 ? 1 : 0);
    }
    // «Радиоактивная вода…»: he leans over the side to look at the water
    if (t > A.L2 - 0.2 && t < T.c3) {
      const u = seg(A.L2 - 0.2, A.L2 + 0.3, t);
      o.lean = 0.05 + 0.32 * u; o.look = [-0.5, 0.8]; o.brow = lerp(o.brow, t > T.greenOff ? -0.3 : 0.9, 0.7); o.pop = t < T.greenOff ? 0.9 : 0.2;
      o.mouth = t < T.greenOff ? 0.4 : 0;
      if (t > A.L2w7) { o.look = [0.6, -0.1]; o.brow = 0.5; o.headTilt = -0.1; }     // «Радиацию не видно»: he looks at us, puzzled
    }
    // «Первое: не прыгай в воду»: he stands up to jump, freezes at the cross, sits back down
    if (t >= T.c3 && t < T.c4) {
      const up = seg(A.L3 - 0.05, A.L3 + 0.4, t) * (1 - seg(A.L3w4, A.L3w4 + 0.4, t));
      o.hip = Wd.boatP(b, [lerp(10, -40, up), lerp(-128, -200, up)]);
      o.lean = 0.05 + 0.35 * up; o.feet = { near: Wd.boatP(b, [-70, -40]), far: Wd.boatP(b, [-30, -40]) };
      const F1 = framesOf(o), sh = F1.T.p([-14, -192]);
      if (up > 0.05) { o.hands = { near: { p: [sh[0] - 150 * S * up, sh[1] - 110 * S * up], shape: 'open' }, far: { p: [sh[0] - 120 * S * up, sh[1] - 140 * S * up], shape: 'open' } }; o.prop = null; }
      const frz = sp(t, A.L3w2, 2.4, 7);
      o.pop = 0.9 * clamp(frz); o.brow = 0.9 * clamp(frz); o.mouth = 0.35 * clamp(frz) * up;
      if (t > A.L3w5) { o.look = [0.5, -0.3]; o.brow = -0.3; o.pop = 0; o.mouth = 0; }
    }
    // «Второе»: a bite! he pulls a fish out, is pleased, the cross, he throws it back
    if (t >= T.c4 && t < T.c5) {
      const bite = A.L4 + 0.1, pull = seg(A.L4w1 - 0.1, A.L4w4, t, ease.out), toss = seg(A.L4w9 + 0.45, A.L4w9 + 0.75, t, ease.in);
      fl = [lerp(b.x - 520, b.x - 220, pull), lerp(10 + 14 * Math.sin(t * 30) * (t > bite ? 1 : 0), -330, pull)];
      bend = (t > bite ? 0.5 : 0) * (1 - pull) + 0.25 * pull * (1 - toss);
      rodA = lerp(-2.7, -1.95, pull);
      o.prop = { kind: 'rod', fl, bend, ang: rodA, fish: pull > 0.05 && toss < 0.98 ? { p: fl, flap: t * 14, toss } : null };
      o.look = [-0.6, -0.4]; o.brow = 0.4; o.pop = 0.3; o.mouth = 0.45 * pull * (1 - seg(A.L4w9, A.L4w9 + 0.2, t)); o.lid = 0.2;
      if (t > A.L4w9) { o.brow = -0.5; o.mouth = 0; o.pop = 0; }
      if (t > A.L4w10) { o.look = [0.6, 0]; o.brow = -0.2; }
      hand = F0.T.p([-110, -130 - 30 * pull]);
    }
    if (o.prop?.kind === 'rod') o.hands = { near: { p: hand, shape: 'grip' }, far: { p: [hand[0] + 30, hand[1] + 6], shape: 'grip' } };
    // «Третье»: rowing, facing the stern; the strokes speed up
    if (t >= T.c5) {
      o.face = 1; o.prop = { kind: 'oars' };
      const ph = rowPhase(t), F1 = framesOf({ ...o, face: 1 });
      o.hip = Wd.boatP(b, [20, -128]);
      const sh = F1.T.p([-14, -192]);
      const hx = sh[0] + (40 + 70 * Math.cos(ph)) * S * 1.6, hy = sh[1] + (110 + 40 * Math.sin(ph)) * S * 1.6;
      o.hands = { near: { p: [hx, hy], shape: 'grip' }, far: { p: [hx + 10, hy - 8], shape: 'grip' } };
      o.lean = -0.15 + 0.3 * Math.cos(ph); o.look = [0.5, 0]; o.brow = -0.6; o.mouth = 0.2 + 0.2 * Math.max(0, Math.sin(ph)); o.pop = 0;
      o.dosi = { led: ledAt(t), jump: 0 };
      if (t > T.row1) { o.lean = 0.1; o.hands = null; o.prop = { kind: 'oarsRest' }; o.look = [-0.6, 0]; }
    }
    return { o, mode: 'boat', b };
  }
  // —— out of the boat: a jump to the shore, then up the path ——
  if (t < T.c6) {
    const o = base(t, { face: -1, dosi: { led: ledAt(t), jump: 0 }, look: [-0.7, 0], brow: -0.4 });
    if (t < T.land) {
      const u = seg(T.jump, T.land, t, u => u), from = Wd.boatP(b, [20, -128]), to = [LANDX, Wd.groundY(LANDX) - LEG];
      o.hip = [lerp(from[0], to[0], u), lerp(from[1], to[1], u) - 130 * Math.sin(Math.PI * u)];
      o.feet = { near: [o.hip[0] - 40, o.hip[1] + LEG - 20], far: [o.hip[0] + 30, o.hip[1] + LEG - 30] };
      o.lean = 0.25; const F1 = framesOf(o), sh = F1.T.p([-14, -192]);
      o.hands = { near: { p: [sh[0] - 90 * S, sh[1] - 60 * S], shape: 'open' }, far: { p: [sh[0] + 60 * S, sh[1] - 40 * S], shape: 'open' } };
      return { o, mode: 'ground', b };
    }
    onFoot(t, o);
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.18; o.hands = swingArms(o, sw); o.mouth = 0.15; }
    if (t < T.land + 0.15) o.hip[1] += 20 * bump(seg(T.land, T.land + 0.2, t));
    return { o, mode: 'ground', b };
  }
  // —— at the gate: jacket and boots off, into the bag ——
  if (t < T.c7) {
    const jacketOff = t >= T.jacket + 0.1, bootsOff = t >= T.boots + 0.1;
    const o = onFoot(t, base(t, { face: -1, jacket: jacketOff ? false : undefined, boots: bootsOff ? false : undefined, look: [-0.5, 0.1], brow: -0.2 }));
    if (jacketOff) o.jacket = false;
    if (!jacketOff) o.dosi = { led: 0, jump: 0 };
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.16; o.hands = swingArms(o, sw); }
    const F1 = framesOf(o), sh = F1.T.p([-14, -192]);
    // pulling the jacket off over his head, then a kick for each boot
    if (t > T.jacket - 0.35 && t < T.jacket + 0.25) {
      const u = seg(T.jacket - 0.35, T.jacket + 0.1, t);
      o.hands = { near: { p: [sh[0] - 30 * S, sh[1] - 150 * S * u], shape: 'grip' }, far: { p: [sh[0] + 20 * S, sh[1] - 160 * S * u], shape: 'grip' } };
      o.hatJump = 20 * u * (1 - seg(T.jacket + 0.1, T.jacket + 0.25, t));
    }
    if (t > T.boots - 0.2 && t < T.boots + 0.4) {
      const u = bump(seg(T.boots - 0.2, T.boots + 0.3, t));
      o.feet = { ...o.feet, near: [o.feet.near[0] + 60 * u, o.feet.near[1] - 50 * u] };
      o.lean = -0.1 * u;
    }
    if (t > A.L6w7) { o.face = 1; o.look = [0.6, 0]; o.brow = 0.3; }
    // he ties the bag
    if (t > A.L6w12 - 0.2) { const u = sp(t, A.L6w12 - 0.2, 2, 6); o.face = 1; o.hands = { near: { p: [BAG.x - 20, Wd.groundY(BAG.x) - 150], shape: 'grip' }, far: { p: [BAG.x + 10, Wd.groundY(BAG.x) - 160 + 10 * Math.sin(t * 20)], shape: 'grip' } }; o.lean = 0.4 * clamp(u); o.look = [0.4, 0.7]; }
    return { o, mode: 'ground', b };
  }
  // —— in the shower booth: head above the door, foam ——
  const o = base(t, { face: 1, hat: false, jacket: false, legs: false, look: [0.6, 0], foam: seg(A.L7w5 - 0.2, A.L7w5 + 0.5, t), foamT: t });
  o.hip = [Wd.SHOWER.x + 10, Wd.SHOWER.y - 150]; o.feet = { near: [Wd.SHOWER.x, Wd.SHOWER.y], far: [Wd.SHOWER.x + 20, Wd.SHOWER.y] };
  const F1 = framesOf(o), head = F1.H.p([0, -40]);
  // scrubbing his head, then a thumbs-up over the door
  if (t > A.L7w5 - 0.3 && t < A.L7w8) o.hands = { near: { p: [head[0] - 30 + 20 * Math.sin(t * 16), head[1] - 30 + 10 * Math.cos(t * 16)], shape: 'open' }, far: { p: [head[0] + 50 + 20 * Math.cos(t * 15), head[1] - 40], shape: 'open' } };
  o.look = t > A.L7w8 ? [0.8, 0] : [0.3, -0.5]; o.lid = t > A.L7w5 && t < A.L7w8 ? 0.8 : 0.25; o.mouth = t > A.L7w5 && t < A.L7w8 ? 0.15 : 0;
  if (t > A.L7w8) { o.brow = 0.5; o.pop = 0.4 * clamp(sp(t, A.L7w8, 2, 6)); }
  if (t > A.L8 - 0.1) { const u = sp(t, A.L8, 2.2, 7), sh = F1.T.p([-14, -192]); o.hands = { near: { p: [sh[0] + 80 * S, sh[1] - 100 * S * clamp(u) - 20], shape: 'thumb', ang: -Math.PI / 2 } }; o.look = [0.4, 0.2]; o.brow = 0.4; o.mouth = 0.3; }
  return { o, mode: 'shower', b };
}
const rowPhase = t => { if (t < T.row0) return 0; const u = t - T.row0; return TAU * (u * 1.6 + 0.3 * u * u); };
// Stroke times (blade enters the water), shared by the oar sound and the score
const STROKES = [];
for (let k = 0; k <= Math.floor(rowPhase(T.row1) / TAU); k++) { const ts = T.row0 + (Math.sqrt(2.56 + 1.2 * (k + 0.1)) - 1.6) / 0.6; if (ts < T.row1 - 0.05) STROKES.push(ts); }
MARKS.strokes = STROKES;
const BAG = { x: Wd.GATE.x + 150 };

// —— camera: smooth keys (non-uniform Catmull-Rom), one list per shot; keys [t, x, y, z, lens, ty] ——
function hermite(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (keys[i + 1][0] < t) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h;
  const tan = j => {
    if (j === 0 || j === n - 1) return keys[j].slice(1).map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return a.slice(1).map((v, c) => (b[c + 1] - v) / (b[0] - a[0]));
  };
  const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
  return k0.slice(1).map((p0, c) => (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0[c] + (-2 * u3 + 3 * u2) * k1[c + 1] + (u3 - u2) * h * m1[c]);
}
const SHOTS = [];
function shot(t0, keys) { SHOTS.push({ t0, keys: keys.map(k => [k[0], k[1], k[2], k[3], k[4] ?? 1, k[5] ?? 0]) }); }
// a key that puts the water line (world y = 0) at screen y wy and the far shore `gap` px above it (the far shore sits at
// y = -420 in the FAR layer, see camera.js for how layers line up); returns [t, x, y, z, lens, ty]
function K(t, x, z, wy = 1150, gap = 300) {
  if (Array.isArray(x)) x = x[0] - (x[1] - W / 2) / z;            // [world x, where it should sit on screen]
  const zf = Math.pow(z, F.FAR), y = -(gap + 175 * zf) / (z - 0.15 * zf);
  return [t, x, y, z, 1, wy - H / 2 + y * z];
}
const BX = Wd.BOAT0.x;
shot(T.cover, [K(T.cover, BX + 330, 0.72, 1180, 320), K(A.L0e, BX + 250, 0.86, 1200, 320), K(T.c1, BX + 230, 0.9, 1200, 320)]);
const HX = BX + 10;                               // the hunter in the boat
shot(T.c1, [K(T.c1, [HX, 430], 1.7, 1240), K(T.crack, [HX, 420], 1.8, 1250), K(T.crack + 0.25, [HX, 400], 2.05, 1290), K(T.c2, [HX, 400], 2.1, 1300)]);
shot(T.c2, [K(T.c2, [HX, 470], 1.25, 1180), K(A.L2w7, [HX, 460], 1.35, 1200), K(T.c3, [HX, 450], 1.55, 1240)]);
shot(T.c3, [K(T.c3, [HX, 470], 1.55, 1330), K(A.L3w2, [HX, 480], 1.65, 1360), K(A.L3w5, [HX, 330], 1.6, 1300), K(A.L3e, [HX, 320], 1.6, 1280), K(T.c4, [HX, 320], 1.6, 1280)]);
shot(T.c4, [K(T.c4, [HX, 600], 1.25, 1230), K(A.L4w4, [HX, 620], 1.35, 1300), K(A.L4w9, [HX, 600], 1.45, 1300), K(A.L4e, [HX, 330], 1.45, 1260), K(T.c5, [HX, 320], 1.45, 1260)]);
shot(T.c5, [K(T.c5, BX + 120, 1.45, 1260), K(T.row0, BX + 80, 1.35, 1250), K(lerp(T.row0, T.row1, 0.5), lerp(BX, BOAT_END, 0.5) - 60, 1.15, 1220),
  K(T.row1, BOAT_END + 40, 1.1, 1220), K(T.jump, BOAT_END - 20, 1.08, 1230), K(T.land, LANDX - 160, 1.05, 1260), K(A.L5e, -2050, 1.05, 1400), K(T.c6, -2100, 1.05, 1420)]);
shot(T.c6, [K(T.c6, Wd.GATE.x + 170, 1.15, 1540), K(A.L6w3, Wd.GATE.x + 150, 1.25, 1580), K(A.L6w7, Wd.GATE.x + 130, 1.25, 1580), K(T.c7, Wd.GATE.x + 120, 1.27, 1590)]);
shot(T.c7, [K(T.c7, Wd.SHOWER.x + 120, 1.6, 1640), K(A.L7w7, Wd.SHOWER.x + 140, 1.7, 1680), K(A.L8w3, Wd.SHOWER.x + 120, 1.75, 1700),
  K(A.L8e, Wd.SHOWER.x + 1500, 0.7, 1250, 300), K(DUR, Wd.SHOWER.x + 2700, 0.62, 1200, 300)]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z, lens, ty] = hermite(sh.keys, t);
  let dx = 0, dy = 0, r = 0;
  if (t >= T.crack && t < T.crack + 0.6) { const e = Math.exp(-(t - T.crack) * 8); dx += 16 * e * noise(t * 40, 1); dy += 14 * e * noise(t * 37, 2); }
  if (t >= T.c6 && t < T.c7) for (const t0 of [T.jacket + 0.1, T.boots + 0.1]) if (t >= t0 && t < t0 + 0.4) { const e = Math.exp(-(t - t0) * 10); dy += 10 * e * Math.sin((t - t0) * 50); }
  return { x, y, z, lens, ty, dx, dy, r };
}

// —— the film cliché: how green the lake looks (only while «как в кино» is on) ——
const greenAt = t => (t >= A.L2 - 0.15 && t < T.greenOff ? seg(A.L2 - 0.15, A.L2 + 0.15, t) : 0);

// —— props drawn with the hunter ——
function hunterDraw(t, hn) {
  const o = { ...hn.o };
  if (o.prop?.kind === 'rod') {
    const p = o.prop;
    o.propNear = hf => {
      const tip = rod(hf.p([16, 0]), p.ang, 400, p.fish ? null : p.fl, p.bend, 1);
      if (p.fish) {
        const tossU = p.fish.toss, fp = [lerp(tip[0], tip[0] - 160, tossU), lerp(tip[1] + 70, tip[1] + 350, tossU * tossU) - 120 * Math.sin(Math.PI * tossU)];
        if (tossU < 0.02) { g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(fp[0], fp[1] - 30); g.stroke(); }
        fish(fp[0], fp[1], 1.05, Math.PI / 2 + 2.5 * tossU, p.fish.flap);
      } else floatAt(p.fl[0], p.fl[1]);
    };
  }
  if (o.prop?.kind === 'oars' || o.prop?.kind === 'oarsRest') {
    const b = hn.b, ph = rowPhase(t);
    // the far oar behind him (drawn first), the near oar in front of his hands
    o.propFar = hf => { const lock = Wd.boatP(b, [-30, -118]); oar(hf.p([16, 0]), lock, 420, 0.9, 24); };
    o.propNear = hf => {
      if (o.prop.kind === 'oarsRest') { const lock = Wd.boatP(b, [120, -118]); limb([lock, [lock[0] + 300, lock[1] + 60]], 14, '#a8703f', false); return; }
      const lock = Wd.boatP(b, [120, -118]); oar(hf.p([16, 0]), lock, 440, 1, 36);
    };
  }
  return drawHunter(o);
}
// the jacket and the boots in flight from his body into the bag
function flyingClothes(t) {
  const by = Wd.groundY(BAG.x);
  if (t > T.jacket + 0.1 && t < T.jacket + 0.65) {
    const u = seg(T.jacket + 0.1, T.jacket + 0.6, t, u => u), x0 = hipXAt(T.jacket), y0 = Wd.groundY(x0) - 300;
    const x = lerp(x0, BAG.x, u), y = lerp(y0, by - 200, u) - 260 * Math.sin(Math.PI * u);
    g.save(); g.translate(x, y); g.rotate(u * 6); g.scale(0.5 * (1 - 0.4 * u), 0.5 * (1 - 0.4 * u));
    fill(smoothPath([[-66, 84], [-70, -110], [-110, -40], [-130, -60], [-80, -190], [-30, -212], [44, -206], [100, -170], [130, -60], [110, -40], [70, -110], [58, 84]]), HUN.jacket);
    rect(-50, 0, 36, 44, HUN.jacketSh);
    g.restore();
  }
  if (t > T.boots + 0.1 && t < T.boots + 0.6) {
    for (const [i, d] of [[0, 0], [1, 0.08]]) {
      const u = seg(T.boots + 0.1 + d, T.boots + 0.55 + d, t, u => u), x0 = hipXAt(T.boots) + 40, y0 = Wd.groundY(x0) - 30;
      const x = lerp(x0, BAG.x + i * 20, u), y = lerp(y0, by - 200, u) - 220 * Math.sin(Math.PI * u);
      if (u <= 0 || u >= 1) continue;
      g.save(); g.translate(x, y); g.rotate(u * 9 + i);
      limb([[0, -26], [0, 6]], 22, HUN.boot, false); ell(-10, 12, 18, 9, HUN.boot);
      g.restore();
    }
  }
}
function drawBag(t) {
  const x = BAG.x, y = Wd.groundY(x), full = (t > T.jacket + 0.6 ? 0.6 : 0.2) + (t > T.boots + 0.55 ? 0.3 : 0), tied = t > A.L6w13;
  const squash = 1 + 0.12 * Math.exp(-Math.max(0, t - T.jacket - 0.6) * 8) * (t > T.jacket + 0.6 ? 1 : 0) + 0.1 * Math.exp(-Math.max(0, t - T.boots - 0.55) * 8) * (t > T.boots + 0.55 ? 1 : 0);
  const h = (110 + 90 * full) / squash, w = 120 * squash;
  ell(x + 10, y - 4, w * 0.9, 18, 'rgba(23,22,47,0.35)');
  fill(smoothPath([[x - w * 0.8, y], [x - w * 0.9, y - h * 0.5], [x - w * 0.5, y - h], [x + w * 0.5, y - h], [x + w * 0.9, y - h * 0.5], [x + w * 0.8, y]]), '#24232f');
  ell(x - w * 0.4, y - h * 0.55, 14, h * 0.25, '#3a3948', -0.2);
  if (tied) { poly([[x - 30, y - h - 4], [x, y - h - 40], [x + 30, y - h - 4]], '#24232f'); ell(x, y - h - 40, 16, 12, '#24232f'); }
  else ell(x, y - h, w * 0.5, 20, '#121119');
}

// —— frame ——
export function init() {}
export function frame(t) {
  if (t < T.cover) return coverFrame(t);
  const cam = camAt(t), hn = hunterAt(t), green = greenAt(t);
  Wd.drawSky(green, cam);
  view(cam, F.FAR); Wd.drawSun(green); Wd.drawFar(t, { green }); Wd.drawMist(t, -430, 0.3, 1);
  view(cam, F.MID); Wd.drawMid(t, { green }); Wd.drawMist(t, -180, 0.25, 5);
  view(cam, 1);
  Wd.drawWater(t, { green });
  Wd.drawShore(t);
  Wd.drawTrees(t);
  Wd.drawFence(t, { open: 0 });
  Wd.drawHouse(t, { light: 0.25 });
  const water = hn.mode === 'shower' && t > A.L7w1 - 0.3;
  Wd.drawShowerBack(t, { water });
  if (hn.mode === 'shower') hunterDraw(t, hn);
  const sh = Wd.drawShowerFront(t, { open: 0 });
  shelf(t, sh.shelf, cam);
  if (hn.mode === 'shower' && water) for (let i = 0; i < 4; i++) { const ph = (t * 2.5 + i / 4) % 1; ell(Wd.SHOWER.x + 30 + i * 18, Wd.SHOWER.y - 270 + 60 * ph, 5, 9, '#cfe6f2', 0, 1 - ph); }
  Wd.drawReeds(t, -1950, -1500, 30, 1, 0);
  Wd.drawSign(t);
  const b = hn.b ?? boatAt(t);
  Wd.boatWater(b, t);
  Wd.drawBoatBack(b);
  if (hn.mode === 'boat') hunterDraw(t, hn);
  Wd.drawBoatFront(b);
  if (hn.mode === 'boat' && hn.o.prop?.kind === 'oars') oarSplashes(t, b);
  if (t > T.c4 && t < T.c5) { Wd.splash(t, A.L4w9 + 0.75, b.x - 380, 0, 1); Wd.ripples(t, A.L4w9 + 0.75, b.x - 380, 6, 3); Wd.ripples(t, A.L4 + 0.1, b.x - 520, 6, 2, 0.6); }
  if (t > T.c2 && t < T.c3) Wd.ripples(t, A.L2 + 0.4, b.x - 300, 6, 2, 0.8);
  if (t < T.c4) Wd.ripples(t, Math.floor(t / 2.2) * 2.2, b.x - 520, 6, 1, 0.5);
  if (hn.mode === 'ground') {
    if (t >= T.c6) drawBag(t);
    hunterDraw(t, hn);
    flyingClothes(t);
  }
  Wd.drawReeds(t, -1560, -1380, 70, 0.8, 9);
  // —— overlays ——
  overlays(t, cam, hn, b);
  stepHeaders(t);
  if (t < T.c1) questionTitle(t);
  O.endCard(t, A.L8 - 0.05, 0);
  subtitles(t, SUBS);
  if (green > 0.01) O.filmFrame(t, green);
}
function oarSplashes(t, b) {
  for (const t0 of STROKES) {
    if (t < t0 || t > t0 + 1.6) continue;
    Wd.splash(t, t0, b.x + 330, 0, 0.6); Wd.ripples(t, t0, b.x + 340, 6, 2, 0.7);
  }
}
const SH = { soap: 40, sham: 120, cond: 200 };       // the bottles on the shelf (x from its left end)
function shelf(t, [sx, sy], cam) {
  if (t < T.c7 - 1) return;
  Wd.soap(SH.soap + sx, sy, 1.2);
  Wd.bottle(SH.sham + sx, sy, 1.0, '#4fa3d9', '#2f6f9a');
  if (t < A.L7w8 + 0.5) Wd.bottle(SH.cond + sx, sy, 1.0, '#e07ab0', '#a84a80');
  else { const u = seg(A.L7w8 + 0.5, A.L7w8 + 1.0, t, ease.in); if (u < 1) { g.save(); g.translate(sx + SH.cond + 160 * u, sy + 600 * u * u); g.rotate(u * 3); Wd.bottle(0, 0, 1.0, '#e07ab0', '#a84a80'); g.restore(); } }
}
function overlays(t, cam, hn, b) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  // the dosimeter close-up when it cracks
  if (t >= T.crack && t < T.c2 + 0.4) {
    const k = sp(t, T.crack + 0.05, 2.4, 7) * (1 - seg(T.c2 + 0.1, T.c2 + 0.4, t, ease.in));
    const F0 = framesOf(hn.o), chest = S2(F0.T.p([-34, -140]));
    O.dosiInset(t, 760, 760, 220, k, dose(t), ledAt(t), chest);
  }
  // the small gauge from «Радиацию не видно» to the shore
  if (t >= A.L2w7 - 0.1 && t < A.L5e + 0.6) {
    const k = sp(t, A.L2w7 - 0.1, 2.4, 7) * (1 - seg(A.L5e + 0.2, A.L5e + 0.6, t, ease.in));
    O.doseHud(t, 880, 520, k * 1.0, dose(t), ledAt(t));
  }
  // «не светится»: the cross over the green lake
  if (t >= A.L2w2 - 0.05 && t < T.greenOff + 0.2) O.redX(540, 1100, 150, sp(t, A.L2w2 + 0.05, 2.6, 8) * (1 - seg(T.greenOff - 0.05, T.greenOff + 0.15, t)));
  scr();
  if (t >= A.L2w2 && t < T.greenOff) text('КАК В КИНО', 540, 700, 110 * clamp(sp(t, A.L2w4 - 0.05, 2.4, 7)), '#6dff57', { rot: -0.05 });
  if (t >= A.L2w7 && t < T.c3) text('НЕ ВИДНО', 540, 650, 100 * clamp(sp(t, A.L2w9 - 0.05, 2.4, 7)) * (1 - seg(T.c3 - 0.2, T.c3, t)), '#fff3d6', { rot: -0.04 });
  // step 1: the cross on the jump, then swimming would be worse
  if (t >= T.c3 && t < T.c4) {
    const F0 = framesOf(hn.o), body = S2(F0.T.p([0, -150]));
    O.redX(body[0], body[1], 110, sp(t, A.L3w2 + 0.04, 2.6, 8) * (1 - seg(A.L3w4, A.L3w4 + 0.25, t)));
    const k = sp(t, A.L3w5 - 0.15, 2.4, 7) * (1 - seg(A.L3e + 0.05, A.L3e + 0.35, t, ease.in));
    O.swimInset(t, 720, 820, 230, k, S2([b.x - 300, 0]));
    O.redX(720, 820, 120, sp(t, A.L3w9 + 0.1, 2.6, 8) * (1 - seg(A.L3e + 0.05, A.L3e + 0.35, t, ease.in)));
  }
  // step 2: the cross on the fish, then what gets inside stays there
  if (t >= T.c4 && t < T.c5) {
    if (hn.o.prop?.fish) { const tip = hn.o.prop.fl; }
    const fx = S2([b.x - 230, -360]);
    O.redX(fx[0], fx[1], 90, sp(t, A.L4w9 + 0.02, 2.6, 8) * (1 - seg(A.L4w9 + 0.4, A.L4w9 + 0.6, t)));
    const k = sp(t, A.L4w10 - 0.15, 2.4, 7) * (1 - seg(A.L4e + 0.1, A.L4e + 0.4, t, ease.in));
    O.insideInset(t, 700, 800, 240, k, null);
    scr();
    if (k > 0.3) text('НЕ СМЫТЬ', 700, 1130, 84 * clamp(sp(t, A.L4w16 - 0.05, 2.4, 7)), '#ff7a4d', { rot: -0.04 });
  }
  // step 3: an arrow to the shore while he rows; «уходи от воды»: an arrow up the path
  if (t >= T.c5 && t < T.c6) {
    O.arrow(S2([b.x - 330, -60]), S2([b.x - 760, -60]), seg(A.L5w5 - 0.2, A.L5w6, t) * (1 - seg(T.row1 - 0.1, T.row1 + 0.2, t)));
    O.arrow(S2([LANDX - 80, -520]), S2([-2350, -720]), seg(A.L5w8 - 0.05, A.L5w10 + 0.2, t) * (1 - seg(A.L5e, A.L5e + 0.3, t)));
  }
  // step 4: the 90 % card
  if (t >= T.c6 && t < T.c7) {
    const k = sp(t, A.L6w10 - 0.15, 2.4, 7) * (1 - seg(A.L6e + 0.05, A.L6e + 0.35, t, ease.in));
    O.percentCard(t, 540, 720, k, 90 * clamp(seg(A.L6w10 - 0.15, A.L6w10 + 0.5, t, ease.out)));
  }
  // step 5: ticks for soap and shampoo, a cross for the conditioner, and why
  if (t >= T.c7 && t < T.c8 + 0.3) {
    const sh = [Wd.SHOWER.x + Wd.SHOWER.w / 2 + 10, Wd.SHOWER.y - 230];      // the shelf, as drawShowerFront puts it
    const out = 1 - seg(T.c8 - 0.1, T.c8 + 0.2, t);
    O.tick(...S2([sh[0] + SH.soap, sh[1] - 100]), sp(t, A.L7w3, 2.6, 8) * out, 50);
    O.tick(...S2([sh[0] + SH.sham, sh[1] - 185]), sp(t, A.L7w5, 2.6, 8) * out, 50);
    O.redX(...S2([sh[0] + SH.cond, sh[1] - 60]), 70, sp(t, A.L7w8 + 0.05, 2.6, 8) * (1 - seg(A.L7w8 + 0.45, A.L7w8 + 0.6, t)));
    scr();
    if (t > A.L7w8) { const k = clamp(sp(t, A.L7w8 - 0.05, 2.4, 7)) * out; text('КОНДИЦИОНЕР', 540, 1160, 92 * k, '#ff7a4d', { rot: -0.03 }); }
    if (t > A.L7w10 - 0.1) { const k = clamp(sp(t, A.L7w10 - 0.1, 2.4, 7)) * out; text('КЛЕИТ ПЫЛЬ', 540, 1270, 76 * k, '#fff3d6', { fam: FONTS.cond, rot: -0.03 }); }
  }
}
function stepHeaders(t) {
  O.stepHeader(t, 1, 'НЕ ПРЫГАЙ', A.L3 + 0.02, A.L3e - 0.05);
  O.stepHeader(t, 2, 'НЕ ЕШЬ И НЕ ПЕЙ', A.L4 + 0.02, A.L4e - 0.05);
  O.stepHeader(t, 3, 'К БЕРЕГУ', A.L5 + 0.02, A.L5e - 0.05);
  O.stepHeader(t, 4, 'СНИМИ КУРТКУ', A.L6 + 0.02, A.L6e - 0.05);
  O.stepHeader(t, 5, 'В ДУШ', A.L7 + 0.02, A.L7e - 0.05);
}

// «Что делать, если ты оказался посреди радиоактивного озера?»: a title word by word over the wide lake
function questionTitle(t) {
  const k1 = sp(t, A.L0w0 - 0.05, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w6 - 0.05, 2.4, 7);
  const out = seg(T.c1 - 0.2, T.c1, t);
  if (k1 > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 540, 330); g.scale(k1 * (1 - out), k1 * (1 - out)); g.rotate(-0.03); text('ЧТО ДЕЛАТЬ,', 0, 0, 120, '#fff3d6'); g.restore(); }
  const plaque = (y, str, k, size) => {
    if (k <= 0.01) return;
    const w = measure(str, size, FONTS.cond) + 70, h = size * 1.45;
    g.save(); g.setTransform(1, 0, 0, 1, 540, y); g.rotate(-0.03); g.scale(k * (1 - out), k * (1 - out));
    rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, '#ffd23f');
    text(str, 0, size * 0.36, size, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  };
  plaque(470, 'ЕСЛИ ТЫ ПОСРЕДИ', k2, 80);
  plaque(590, 'РАДИОАКТИВНОГО ОЗЕРА?', k3, 80);
}

// —— the cover: his scared face, the clicking dosimeter, the sign; the words ——
function coverFrame(t) {
  Wd.drawSky(0, null);
  g.setTransform(1.1, 0, 0, 1.1, 540 - 300, 1230); Wd.drawFar(t, {}); Wd.drawMist(t, -430, 0.3, 1);
  g.setTransform(1, 0, 0, 1, 540 - 200, 1500); Wd.drawMid(t, {});
  g.setTransform(1.3, 0, 0, 1.3, 540 - 1000 * 1.3 + 200, 1560); Wd.drawWater(t, {}); Wd.drawSign(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const o = base(t, { s: 1.9, face: 1, pop: 1, brow: 1, mouth: 0.75, look: [0.8, 0.3], hatJump: 30, blink: 0, lean: -0.1, headTilt: 0.12, dosi: { led: 1, jump: 0 } });
  o.hip = [330, 1930]; o.feet = { near: [300, 2400], far: [360, 2400] };
  o.dosi = null;
  const F0 = framesOf(o), chest = F0.T.p([-60, -160]);
  o.hands = { near: { p: [chest[0] + 40, chest[1] + 30], shape: 'grip' }, far: { p: [chest[0] + 80, chest[1] + 10], shape: 'grip' } };
  o.faceProp = () => { dosimeter(chest[0] + 60, chest[1] - 40, 2.0, 1, 0.15, 1); for (let i = 0; i < 3; i++) { const a = -1.2 + i * 0.45; limb([[chest[0] + 60 + Math.cos(a) * 170, chest[1] - 40 + Math.sin(a) * 170], [chest[0] + 60 + Math.cos(a) * 230, chest[1] - 40 + Math.sin(a) * 230]], 14, '#ffd23f', false); } };
  drawHunter(o);
  g.save(); g.translate(540, 300); rect(-150 + 5, -28 + 6, 300, 56, INK); rect(-150, -28, 300, 56, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 316, 40, '#fff3d6', { fam: FONTS.cond, shadow: false });
  text('РАДИОАКТИВНОЕ', 540, 440, 100, '#fff3d6', { rot: -0.03 });
  text('ОЗЕРО', 540, 640, 220, '#6dff57', { rot: -0.03 });
  const w = 620, h = 120;
  g.save(); g.translate(540, 760); g.rotate(-0.03);
  rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, '#ffd23f');
  g.restore();
  text('ЧТО ДЕЛАТЬ?', 540, 797, 100, INK, { fam: FONTS.cond, rot: -0.03, shadow: false });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), hn = hunterAt(tt), o = hn.o, b = boatAt(tt);
    const out = [o.hip, o.feet.near, o.feet.far, [o.hip[0], o.hip[1] - 200 * S]].map(p => toScreen(cam, p));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]), toScreen(cam, [b.x, b.y]));
    return out;
  };
  const a = pts(t0), b = pts(t1), on = ([x, y]) => x > -200 && x < W + 200 && y > -200 && y < H + 200;
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (on(a[i]) || on(b[i])) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return m * (0.5 / (2 * h * 60));
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(A.L0w0 - 0.03, 'pop_word', -8, 0);
  add(A.L0w2 - 0.03, 'pop_word', -8, 0);
  add(A.L0w6 - 0.03, 'pop_word', -8, 0);
  // the dosimeter: sparse ticks, the crack, steady crackle, quieter as he gets away, gone in the yard
  const rate = [[0, 0.6], [T.crack - 0.01, 0.8], [T.crack, 28], [A.L2, 20], [T.row0, 18], [T.land, 8], [A.L5w11, 6], [A.L5w15 + 0.2, 1.2], [T.c6 - 0.3, 0.6], [T.c6, 0]];
  add(0, 'geiger', -6, 0.15, { dur: T.c6 + 0.1, rate });
  add(T.crack - 0.02, 'jolt', -6, 0.1);
  add(T.c1 - 0.05, 'whoosh_short', -10, 0);
  add(A.L2 - 0.2, 'projector', -10, 0, { dur: T.greenOff - A.L2 + 0.2 });
  add(A.L2 - 0.15, 'kino_sting', -8, 0);
  add(A.L2w2 + 0.05, 'stamp', -2, 0);
  add(T.greenOff - 0.02, 'snap', -6, 0);
  add(A.L2w9 - 0.05, 'pop_word', -8, 0);
  add(A.L3 + 0.05, 'creak', -8, -0.1);
  add(A.L3w2 + 0.04, 'stamp', -2, 0);
  add(A.L3w4 + 0.1, 'thud', -8, 0);
  add(A.L3w5 - 0.15, 'whoosh_in', -12, 0.2);
  add(A.L3w5 + 0.2, 'bubbles', -10, 0.2, { dur: A.L3e - A.L3w5 });
  add(A.L3w9 + 0.1, 'stamp', -4, 0.2);
  add(A.L4 + 0.1, 'plop', -8, -0.3);
  add(A.L4w1 - 0.1, 'reel', -10, -0.2, { dur: A.L4w4 - A.L4w1 + 0.1 });
  add(A.L4w4, 'splash_small', -8, -0.2);
  add(A.L4w4 + 0.2, 'flop', -10, -0.2, { dur: A.L4w9 + 0.45 - A.L4w4 });
  add(A.L4w9 + 0.02, 'stamp', -2, -0.1);
  add(A.L4w9 + 0.75, 'splash', -6, -0.3);
  add(A.L4w10 - 0.15, 'whoosh_in', -12, 0.2);
  add(A.L4w16 - 0.05, 'pop_word', -8, 0);
  for (const t of STROKES) add(t, 'oar', -8, 0.2);
  add(A.L5w5 - 0.2, 'marker', -10, -0.2, { dur: 0.4 });
  add(T.row1 - 0.05, 'bump', -6, -0.2);
  add(T.jump + 0.05, 'whoosh_short', -10, -0.2);
  add(T.land, 'thud', -4, -0.2);
  for (const f of ['near', 'far']) for (const p of PL[f]) add(p.t, 'step', -10, f === 'near' ? 0.05 : -0.05);
  add(A.L5w8 - 0.05, 'marker', -10, -0.2, { dur: 0.4 });
  add(A.L5w15 - 0.05, 'ding', -8, 0.3);
  add(T.jacket - 0.3, 'cloth', -8, 0);
  add(T.jacket + 0.1, 'whoosh', -10, 0.2);
  add(T.jacket + 0.6, 'bag', -6, 0.3);
  add(T.boots + 0.1, 'whoosh_short', -10, 0.2);
  add(T.boots + 0.55, 'bag', -6, 0.3);
  add(A.L6w10 - 0.15, 'pop_word', -6, 0);
  add(A.L6w12 - 0.2, 'bag', -10, 0.3);
  add(A.L7w1 - 0.3, 'shower', -10, -0.1, { dur: DUR - A.L7w1 + 0.3 });
  add(A.L7w3, 'ding', -8, 0.2);
  add(A.L7w5 - 0.2, 'squish', -10, 0, { dur: A.L7w8 - A.L7w5 + 0.2 });
  add(A.L7w5, 'ding', -8, 0.2);
  add(A.L7w8 + 0.05, 'stamp', -2, 0.2);
  add(A.L7w8 + 0.95, 'clatter', -8, 0.3);
  for (const t0 of [A.L3, A.L4, A.L5, A.L6, A.L7]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L8 + 0.1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
