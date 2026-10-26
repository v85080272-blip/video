// «Вулкан проснулся»: the whole short as pure functions of time t (seconds), so any frame or motion-blur sub-frame can
// be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from tools/voice.py): another
// take moves the picture with it (STORYBOARD.md).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix } from './lib.js';
import { g, W, H, ell, limb, rect } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Wd from './world.js';
import { drawHunter, framesOf, binoculars, phone, flask, cloth, HUN } from './hunter.js';
import { text, groupWords, subtitles, INK } from './type.js';
import * as O from './overlay.js';

const { F } = Wd;
// —— the narration ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SUBS = VOICE ? VOICE.lines.flatMap(l => groupWords(l.words, Array.isArray(l.sub) ? l.sub : null)) : [];
const LN = id => VOICE?.lines.find(l => l.id === id);
const at = (id, d) => LN(id)?.at ?? d, end = (id, d) => LN(id)?.end ?? d;
const wd = (id, i, d) => LN(id)?.words[i]?.s ?? d;
export const DUR = VOICE?.dur ?? 38.7;
const A = {
  L1w1: wd('L1', 1, 0.49), L1w2: wd('L1', 2, 1.25), L1w6: wd('L1', 6, 2.35), L1e: end('L1', 2.79),
  L2: at('L2', 3.14), L2w4: wd('L2', 4, 4.4), L2e: end('L2', 5.47),
  L3: at('L3', 5.87), L3w2: wd('L3', 2, 6.63), L3w3: wd('L3', 3, 7.19), L3w6: wd('L3', 6, 8.31), L3w10: wd('L3', 10, 9.41),
  L3w11: wd('L3', 11, 9.95), L3w15: wd('L3', 15, 10.59), L3w16: wd('L3', 16, 10.95), L3e: end('L3', 11.36),
  L4: at('L4', 12.26), L4w1: wd('L4', 1, 12.87), L4w2: wd('L4', 2, 13.51), L4w3: wd('L4', 3, 13.67), L4w4: wd('L4', 4, 14.03),
  L4w6: wd('L4', 6, 15.11), L4w8: wd('L4', 8, 15.6), L4w10: wd('L4', 10, 16.49), L4w13: wd('L4', 13, 17.15), L4e: end('L4', 18.05),
  L5: at('L5', 18.45), L5w1: wd('L5', 1, 18.98), L5w4: wd('L5', 4, 19.74), L5w5: wd('L5', 5, 20.2), L5w9: wd('L5', 9, 21.3),
  L5w14: wd('L5', 14, 23.42), L5w15: wd('L5', 15, 23.8), L5e: end('L5', 24.97),
  L6: at('L6', 25.47), L6w1: wd('L6', 1, 26.03), L6w5: wd('L6', 5, 27.09), L6w6: wd('L6', 6, 27.79), L6w11: wd('L6', 11, 29.29),
  L6w12: wd('L6', 12, 29.85), L6e: end('L6', 31.03),
  L7: at('L7', 31.43), L7w3: wd('L7', 3, 32.55), L7w7: wd('L7', 7, 33.71), L7w9: wd('L7', 9, 34.29), L7e: end('L7', 35.1),
  L8: at('L8', 35.55), L8w5: wd('L8', 5, 37.05), L8e: end('L8', 38.32),
};
// —— the shots ——
const T = {
  cover: 0.3,                                    // the poster: the first frames
  te: A.L1w1 + 0.06,                             // the blast, on «проснулся»
  c1: A.L1w2 - 0.06,                             // from the binoculars to his face: «а ты…»
  c2: A.L3 - 0.04,                               // «Первое»: the phone on the platform
  c3: A.L3w6 - 0.06,                             // «В туче пепла бьют молнии»: the whole cloud
  c4: A.L3w11 - 0.06,                            // «и на вышке ты лёгкая цель»: the tower as a target
  strike: A.L3e + 0.14,                          // the bolt hits the tower
  c5: A.L4 - 0.04,                               // «Второе»: the wind
  mapIn: A.L4w2 - 0.14, mapOut: A.L4e - 0.16,    // the paper map
  c6: A.L5 - 0.04,                               // «Третье»: the fork
  down: A.L5w5 - 0.05, up: A.L5w14 - 0.05,       // the camera goes down to the river and back
  c7: A.L6 - 0.04,                               // «Четвёртое»: ash is glass
  c8: A.L7 - 0.04,                               // «Пятое»: the UAZ and the hut
  win: A.L7w9 - 0.1,                             // in close on the window
};
T.lahar0 = T.down + 0.3;                        // its head comes in on the right…
T.boatHit = T.lahar0 + (-1250 - (Wd.BOAT.x + 40)) / 950;
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.c7, T.c8];
export const MARKS = { ...T, A };                // the score follows these (filled in below, once the moments are known)
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.5, LEG = 114;                        // the hunter's scale; hip height over the soles when standing

// —— the mudflow's head: x over time ——
const laharX = t => (t < T.lahar0 ? null : -1250 - 950 * (t - T.lahar0));

// —— walking and running: plants for each foot, the hip gliding over them ——
const PL = { near: [], far: [] };
const RUNS = [];                                 // hip x on foot: { t0, t1, x0, x1, ease }
function plant(foot, t, x, swing = 0.22, lift = 30) { PL[foot].push({ t, p: [x, Wd.groundY(x)], swing, lift }); }
const EASES = { 'in-out': ease.inOut, 'lin-out': u => 1 - (1 - u) * (1 - u), 'in-lin': u => u * u, 'lin-lin': u => u };
function invert(f, y) { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (f(m) < y) a = m; else b = m; } return (a + b) / 2; }
// a run from x0 to x1 between t0 and t1 with steps about L long; each foot lands half a step ahead of the hip
function run(t0, t1, x0, x1, L, first = 'near', ef = 'in-out', lift = 30) {
  const e = EASES[ef], n = Math.max(2, Math.round(Math.abs(x1 - x0) / L)), dir = Math.sign(x1 - x0), step = (x1 - x0) / n;
  RUNS.push({ t0, t1, x0, x1, e });
  let foot = first, prev = t0 - 0.2;
  for (let i = 1; i <= n; i++) {
    const tt = lerp(t0, t1, invert(e, (i - 0.5) / n));
    plant(foot, tt, x0 + step * i - (i === n ? dir * 14 : 0), Math.min(0.3, (tt - prev) * 0.9 + 0.04), lift);
    prev = tt; foot = foot === 'near' ? 'far' : 'near';
  }
  plant(foot, t1 + 0.1, x1 + dir * 22, 0.18, 14);   // the trailing foot closes up
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
const PLANTS = () => [...PL.near.map(p => [p.t, 1]), ...PL.far.map(p => [p.t, -1])].sort((a, b) => a[0] - b[0]);
let ALL = null;
// 0 … 1 … 0 between two plants (the flight of a run), and which arm is forward (flips each step)
function stepAt(t) {
  ALL ??= PLANTS();
  let i = -1; while (i + 1 < ALL.length && ALL[i + 1][0] <= t) i++;
  if (i < 0 || i + 1 >= ALL.length || ALL[i + 1][0] - ALL[i][0] > 0.45) return { up: 0, sw: 0 };
  const u = (t - ALL[i][0]) / (ALL[i + 1][0] - ALL[i][0]);
  return { up: Math.sin(Math.PI * u), sw: ALL[i][1] * Math.cos(Math.PI * u) };
}

// the route on foot
const LAND = T.c3 - 0.14;                         // off the ladder
const X0 = Wd.LADDER.a[0] - 46;
run(LAND + 0.18, T.strike - 0.06, X0, -900, 105, 'near');
run(T.mapIn + 0.2, T.c6 + 0.3, -900, -1730, 120, 'far');
run(T.up + 0.1, A.L5e - 0.05, -1730, -2420, 110, 'near');
run(T.c8, A.L7w3 + 0.02, -3260, -3990, 125, 'near', 'lin-out');

// —— the hunter's acting, shot by shot ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.05, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, scarf: 'neck', glasses: null, ...extra });
function armTo(F, side, p, shape = 'fist', ang) { return { p, shape, ang }; }
function swingArms(o, sw, k = 1) {
  const F = framesOf(o), dir = o.face, s = S;
  const arm = (side, a) => {
    const Sh = F.T.p(side === 'near' ? [-14, -192] : [18, -198]);
    const len = 160 * s;
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

export function hunterAt(t) {
  // —— on the platform: binoculars, the face, the phone ——
  if (t < LADDER_T0) {
    const o = base(t, { face: 1, look: [0.6, -0.1] });
    let hx = 14, feet = { near: [2, Wd.TOWER.floor], far: [36, Wd.TOWER.floor] };
    o.hip = [hx, Wd.TOWER.floor - LEG];
    o.feet = feet;
    const F0 = framesOf(o), eye = F0.H.p([-34, -22]);
    if (t < T.c2) {
      // binoculars at the eyes, then lowered to the chest: the shock
      const low = seg(T.c1 + 0.05, T.c1 + 0.4, t, ease.out);
      const chest = F0.T.p([-70, -150]);
      const bp = [lerp(eye[0] + 22 * S, chest[0], low), lerp(eye[1], chest[1], low)];
      const k = sp(t, T.c1 + 0.08, 2.2, 6);
      o.pop = 0.9 * k; o.brow = 0.9 * k; o.mouth = 0.55 * clamp(k) + 0.1 * Math.sin(t * 9) * clamp(k) * 0;
      o.hatJump = 26 * bump((t - T.c1 - 0.1) / 0.35) * S / 0.5; o.lean = 0.05 - 0.12 * clamp(k);
      o.look = [0.7, -0.05]; o.blink = t < T.c1 + 0.3 ? 0 : o.blink;
      if (t > A.L2w4 - 0.1) { o.brow = lerp(o.brow, -0.6, seg(A.L2w4 - 0.1, A.L2w4 + 0.2, t)); o.mouth = lerp(o.mouth, 0.05, seg(A.L2w4 - 0.1, A.L2w4 + 0.2, t)); o.pop = lerp(o.pop, 0.2, seg(A.L2w4 - 0.1, A.L2w4 + 0.3, t)); }
      o.hands = { near: { p: [bp[0] + 6, bp[1] + 18 * S], shape: 'grip' }, far: { p: [bp[0] + 22 * S, bp[1] + 6 * S], shape: 'grip' } };
      o.prop = { kind: 'binoc', p: bp, ang: 0, hang: low };
      return { o, mode: 'platform' };
    }
    // the phone: held up at the volcano, the red cross, into the pocket, then he turns to the ladder
    const shoulder = F0.T.p([-14, -192]);
    const up = [shoulder[0] + 185 * S, shoulder[1] - 50 * S];
    PHONE_UP = [up[0] + 10 * S, up[1] - 34 * S];
    const pocket = F0.T.p([-30, 10]);
    const put = seg(A.L3w2 + 0.22, A.L3w2 + 0.5, t);
    const pp = [lerp(up[0], pocket[0], put), lerp(up[1], pocket[1], put)];
    const flinch = sp(t, A.L3w2 + 0.06, 2.6, 7);
    o.lean = 0.05 - 0.08 * clamp(flinch) * (1 - put); o.pop = 0.6 * clamp(flinch) * (1 - seg(A.L3w3, A.L3w3 + 0.2, t)); o.brow = 0.6 * clamp(flinch) - 0.3 * seg(A.L3w3, A.L3w3 + 0.2, t);
    o.look = [lerp(0.7, 0.2, put), lerp(-0.2, 0.3, put)]; o.mouth = 0.3 * clamp(flinch) * (1 - put);
    o.hands = { near: { p: pp, shape: 'grip' } };
    if (put < 1) o.prop = { kind: 'phone', p: [pp[0] + 10 * S, pp[1] - 34 * S], ang: -0.12 + 0.3 * put, glow: 1 - put };
    // turn to the ladder and step to its top
    if (t > TURN_T) {
      o.face = -1; o.look = [-0.6, 0.4]; o.brow = -0.3;
      const u = seg(TURN_T, LADDER_T0, t);
      o.hip = [lerp(14, -70, u), Wd.TOWER.floor - LEG - 6 * bump(u)];
      o.feet = { near: [lerp(2, -86, seg(TURN_T, LADDER_T0 - 0.05, t)), Wd.TOWER.floor - 18 * bump(seg(TURN_T, LADDER_T0 - 0.05, t))], far: [lerp(36, -40, seg(TURN_T + 0.08, LADDER_T0, t)), Wd.TOWER.floor - 18 * bump(seg(TURN_T + 0.08, LADDER_T0, t))] };
      o.hands = null; delete o.prop;
    }
    return { o, mode: 'platform' };
  }
  // —— down the ladder: facing it, hands sliding on the rails ——
  if (t < LAND) {
    const v = 1 - seg(LADDER_T0, LAND, t, ease.inQuad), P = Wd.ladderAt;
    const o = base(t, { face: 1, look: [0.4, 0.6], brow: -0.2, lean: -0.08 });
    const hp = P(clamp(v - 0.02)), off = [-46, 0];
    o.hip = [hp[0] + off[0], hp[1] - 40];
    o.feet = { near: [P(clamp(v - 0.17))[0] - 22, P(clamp(v - 0.17))[1]], far: [P(clamp(v - 0.11))[0] - 18, P(clamp(v - 0.11))[1]] };
    o.hands = { near: { p: [P(clamp(v + 0.2))[0] - 20, P(clamp(v + 0.2))[1]], shape: 'grip' }, far: { p: [P(clamp(v + 0.24))[0] - 6, P(clamp(v + 0.24))[1]], shape: 'grip' } };
    return { o, mode: 'ladder' };
  }
  // —— on foot: off the ladder, away from the tower; the strike; the wind ——
  if (t < T.c6 + 0.3 || (t >= T.c6 + 0.3 && t < T.up + 0.1)) {
    const o = onFoot(t, base(t, { face: -1, look: [-0.7, 0.1], brow: -0.2 }));
    const sw = stepAt(t).sw, moving = Math.abs(sw) > 0;
    if (t < LAND + 0.2) { const k = 1 - seg(LAND, LAND + 0.2, t); o.hip[1] += 22 * bump(seg(LAND, LAND + 0.24, t)); o.face = t < LAND + 0.1 ? 1 : -1; }
    if (moving) { o.lean = 0.16; o.hands = swingArms(o, sw); o.mouth = 0.15; }
    // the strike: he ducks, hands over his head, the hat jumps; then he looks back at the tower
    if (t >= T.strike - 0.04 && t < T.c5) {
      const k = sp(t, T.strike, 2.2, 6), dk = clamp(k) * (1 - seg(T.strike + 0.45, T.strike + 0.7, t));
      o.hip[1] += 34 * dk; o.lean = lerp(0.16, 0.45, dk); o.pop = clamp(k); o.brow = 0.8 * clamp(k); o.mouth = 0.6 * dk + 0.2;
      o.hatJump = 30 * bump((t - T.strike) / 0.3);
      const F = framesOf(o), top = F.H.p([0, -90]);
      if (dk > 0.05) o.hands = { near: { p: [lerp(o.hands?.near.p[0] ?? top[0], top[0] - 20 * S, dk), lerp(o.hands?.near.p[1] ?? top[1], top[1], dk)], shape: 'open' }, far: { p: [top[0] + 30 * S, top[1] + 10 * S], shape: 'open' } };
      if (t > T.strike + 0.55) { o.face = 1; o.look = [0.8, -0.4]; o.pop = 0.8; o.brow = 0.7; o.mouth = 0.45; o.hands = null; o.lean = 0; }
    }
    // the wind: he licks a finger and holds it up
    if (t >= T.c5 && t < T.mapIn + 0.2) {
      o.face = 1; o.lean = 0; o.pop = 0; o.brow = 0.2; o.look = [0.5, -0.8];
      const F = framesOf(o), mouth = F.H.p([-44, 22]), sh = F.T.p([-14, -192]);
      const up = [sh[0] + 64 * S, sh[1] - 186 * S];
      const lick = seg(T.c5 + 0.1, T.c5 + 0.3, t) * (1 - seg(T.c5 + 0.55, T.c5 + 0.8, t));
      const raise = seg(T.c5 + 0.55, T.c5 + 0.85, t, ease.outBack);
      const rest = F.T.p([-40, -60]);
      const p = lick > 0 ? [lerp(rest[0], mouth[0] + 16 * S, lick), lerp(rest[1], mouth[1], lick)] : [lerp(rest[0], up[0], raise), lerp(rest[1], up[1], raise)];
      o.hands = { near: { p, shape: 'point', ang: raise > 0.3 ? -Math.PI / 2 : undefined } };
      o.mouth = 0.25 * lick; o.look = raise > 0.2 ? [0.3, -1] : [0.6, 0];
      o.scarfWave = 0.9 + Math.sin(t * 9) * 0.6;
    }
    // at the fork: a step toward the river, the cross, a step back; then he watches the flow
    if (t >= T.c6 + 0.3) {
      const ds = seg(A.L5w1 + 0.05, A.L5w1 + 0.4, t) * (1 - seg(A.L5w4 + 0.15, A.L5w4 + 0.5, t));
      const fk = Wd.FORK.down;
      const nearStep = [lerp(-1740, fk[0][0] - 50, ds), lerp(Wd.groundY(-1740), fk[0][1] + 40, ds)];
      o.feet.near = [nearStep[0], nearStep[1] - 22 * bump(seg(A.L5w1 + 0.05, A.L5w1 + 0.4, t)) - 22 * bump(seg(A.L5w4 + 0.15, A.L5w4 + 0.5, t))];
      o.hip = [o.hip[0] - 34 * ds, o.hip[1] + 18 * ds];
      o.lean = 0.12 * ds; o.look = [-0.4, 0.7];
      const shock = sp(t, A.L5w4, 2.4, 7);
      o.pop = 0.7 * clamp(shock); o.brow = 0.6 * clamp(shock);
      if (t > T.down + 0.3) { o.look = [-0.5, 0.9]; o.pop = 0.9; o.brow = 0.8; o.mouth = 0.35 + 0.25 * seg(T.lahar0 + 0.2, T.lahar0 + 0.5, t); o.lean = -0.08; }
    }
    return { o, mode: 'ground' };
  }
  // —— up the slope, away from the river ——
  if (t < T.c7) {
    const o = onFoot(t, base(t, { face: -1, look: [-0.7, -0.1], brow: -0.4 }));
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.14; o.hands = swingArms(o, sw, 0.8); }
    return { o, mode: 'ground' };
  }
  // —— ash is glass: the palm, the flask, the scarf over nose and mouth, the glasses ——
  if (t < T.c8) {
    const x = -2900, o = base(t, { face: -1, look: [-0.5, 0.2], brow: -0.2 });
    o.hip = [x, Wd.groundY(x) - LEG]; o.feet = { near: [x - 14, Wd.groundY(x - 14)], far: [x + 22, Wd.groundY(x + 22)] };
    const F = framesOf(o), sh = F.T.p([-14, -192]);
    const palm = [sh[0] - 120 * S, sh[1] + 70 * S];
    const pOut = seg(A.L6w1 - 0.35, A.L6w1 - 0.05, t) * (1 - seg(A.L6w6 - 0.25, A.L6w6, t));
    const rest = F.T.p([-30, -60]);
    let near = { p: [lerp(rest[0], palm[0], pOut), lerp(rest[1], palm[1], pOut)], shape: pOut > 0.5 ? 'open' : 'fist', ang: pOut > 0.5 ? Math.PI - 0.3 : undefined };
    if (pOut > 0.3) o.look = [-0.6, 0.8];
    // the scarf off the neck into the far hand, held out in front; the flask from the belt pours water on it
    const fl0 = A.L6w6 - 0.05, fl1 = A.L6w11 - 0.35, tie0 = fl1 + 0.1, tie1 = A.L6w12 - 0.05;
    const neck = F.T.p([-44, -226]), clothP = [sh[0] - 150 * S, sh[1] + 90 * S];
    const offU = seg(fl0 - 0.15, fl0 + 0.15, t);
    if (t >= fl0 - 0.15 && t < tie0 + 0.15) {
      o.hands = { far: { p: [lerp(neck[0], clothP[0], offU), lerp(neck[1], clothP[1], offU)], shape: 'grip' } };
      o.scarf = null;
      o.cloth = { wet: seg(fl0 + 0.5, fl1, t), wave: Math.sin(t * 8) * 0.6 };
    }
    const flU = seg(fl0 + 0.05, fl0 + 0.35, t) * (1 - seg(fl1, fl1 + 0.2, t));
    const over = [clothP[0] + 30 * S, clothP[1] - 84 * S];
    if (flU > 0) { near = { p: [lerp(rest[0], over[0], flU), lerp(rest[1], over[1], flU)], shape: 'grip' }; o.look = [-0.6, 0.7]; }
    o.prop = flU > 0 ? { kind: 'flask', p: null, tilt: seg(fl0 + 0.35, fl0 + 0.55, t) * (1 - seg(fl1 - 0.1, fl1 + 0.1, t)) } : null;
    // the wet scarf goes up over nose and mouth, tied at the back
    const tieU = seg(tie0, tie0 + 0.25, t) * (1 - seg(tie1 - 0.2, tie1, t));
    if (t >= tie0) {
      const back = F.H.p([70, -10]), face = F.H.p([-40, 10]);
      near = { p: [lerp(rest[0], face[0], tieU), lerp(rest[1], face[1], tieU)], shape: 'grip' };
      o.hands = { far: { p: [lerp(clothP[0], back[0], tieU), lerp(clothP[1], back[1], tieU)], shape: 'grip' } };
      if (t > tie0 + 0.15) { o.scarf = 'mask'; o.cloth = null; }
      o.scarfWet = true;
    }
    // the glasses come down off the hat
    const gl0 = A.L6w12 + 0.1;
    const glU = seg(gl0, gl0 + 0.35, t);
    if (t >= gl0 - 0.25) {                       // out of the breast pocket and onto the eyes
      const pocket = F.T.p([-40, -150]), eye = F.H.p([-36, -22]);
      const reach = seg(gl0 - 0.25, gl0 - 0.05, t) * (1 - seg(gl0 + 0.4, gl0 + 0.65, t));
      const tp = [lerp(pocket[0], eye[0], glU) - 14 * S, lerp(pocket[1], eye[1], glU)];
      near = { p: [lerp(rest[0], tp[0], reach), lerp(rest[1], tp[1], reach)], shape: 'grip' };
      if (glU > 0.85) o.glasses = 0.75 + 0.25 * seg(gl0 + 0.28, gl0 + 0.4, t);
      else if (t > gl0 - 0.05) o.prop = { kind: 'glasses', p: [tp[0] - 6, tp[1] - 10 * S] };
      o.scarf = 'mask'; o.scarfWet = true;
    }
    if (t > gl0 + 0.65) { o.brow = -0.5; o.look = [-0.8, 0]; near = { p: [sh[0] - 70 * S, sh[1] - 40 * S], shape: 'thumb', ang: -Math.PI / 2 }; o.hands = null; }
    o.hands = { ...(o.hands ?? {}), near };
    return { o, mode: 'ground' };
  }
  // —— to the UAZ, the door, inside ——
  if (t < IN_T) {
    const o = onFoot(t, base(t, { face: -1, scarf: 'mask', glasses: 1, look: [-0.7, 0], brow: -0.5 }));
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.18; o.hands = swingArms(o, sw); }
    if (t > DOOR_T - 0.15) {
      const h = Wd.UAZ.x - Wd.UAZ.len / 2 + 250;
      o.hands = { near: { p: [h, Wd.UAZ.y - 70 - 150], shape: 'grip' } };
      const u = seg(JUMP_T, IN_T, t);
      o.hip = [lerp(o.hip[0], Wd.UAZ.x - Wd.UAZ.len / 2 + 200, u), o.hip[1] - 110 * Math.sin(Math.PI * Math.min(1, u * 1.2)) - 40 * u];
      if (u > 0) { o.feet = { near: [o.hip[0] - 20, o.hip[1] + LEG - 30 * u], far: [o.hip[0] + 30, o.hip[1] + LEG - 60 * u] }; }
    }
    return { o, mode: 'ground', into: seg(JUMP_T, IN_T, t) };
  }
  // —— in the driver's seat ——
  const o = base(t, { face: -1, scarf: 'mask', glasses: 1, look: [-0.6, 0], brow: -0.3 });
  return { o, mode: 'uaz' };
}
const TURN_T = A.L3w3 + 0.05, LADDER_T0 = TURN_T + 0.32;
let PHONE_UP = null;
const DOOR_T = A.L7w3 - 0.06, JUMP_T = DOOR_T + 0.3, IN_T = JUMP_T + 0.32, SLAM_T = IN_T + 0.14;

// —— camera: smooth keys (non-uniform Catmull-Rom), one list per shot ——
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
// keys: [t, x, y, z, lens, ty]
const SHOTS = [];
function shot(t0, keys) { SHOTS.push({ t0, keys: keys.map(k => [k[0], k[1], k[2], k[3], k[4] ?? 1, k[5] ?? 0]) }); }
shot(T.c1, [[T.c1, 70, -975, 2.6], [T.c1 + 0.55, 66, -970, 2.75], [T.c1 + 0.75, 60, -960, 2.6], [A.L1e + 0.1, -40, -660, 0.74],
  [A.L2w4 - 0.1, 70, -600, 0.6], [A.L2w4 + 0.7, 80, -640, 0.6, 0.88, 520], [T.c2, 85, -650, 0.62, 0.86, 600]]);
shot(T.c2, [[T.c2, 150, -880, 1.45], [TURN_T, 165, -900, 1.55], [LADDER_T0, -40, -820, 1.35], [LAND - 0.1, -300, -300, 1.0], [T.c3, -330, -250, 1.0]]);
shot(T.c3, [[T.c3, 150, -600, 0.6, 0.75, 430], [T.c4, 110, -610, 0.6, 0.77, 450]]);
shot(T.c4, [[T.c4, -180, -570, 0.5], [T.strike, -230, -560, 0.53], [T.strike + 0.6, -300, -540, 0.56], [T.c5, -380, -500, 0.6]]);
shot(T.c5, [[T.c5, -900, -230, 1.3], [T.mapIn, -915, -240, 1.4], [T.mapIn + 0.6, -1000, -200, 1.1], [T.mapOut, -1520, -110, 1.0], [T.c6, -1660, -80, 1.0]]);
shot(T.c6, [[T.c6, -1680, -100, 1.1], [A.L5w1, -1800, -110, 1.2], [T.down, -1820, -100, 1.18], [T.down + 0.55, -2060, 560, 1.1],
  [T.up - 0.15, -2160, 580, 1.12], [T.up + 0.55, -1950, -120, 0.9], [A.L5e, -2350, -140, 0.95], [T.c7, -2420, -150, 0.95]]);
shot(T.c7, [[T.c7, -2860, -240, 1.6], [A.L6w5, -2880, -250, 1.7], [A.L6w6 + 0.3, -2900, -260, 1.9], [A.L6w12, -2905, -290, 2.1], [T.c8, -2905, -290, 2.15]]);
shot(T.c8, [[T.c8, -3980, -330, 0.86], [A.L7w3, -4080, -340, 0.9], [A.L7w7, -4300, -350, 0.92], [T.win, -4180, -340, 0.95], [T.win + 0.7, -4030, -450, 1.9], [A.L8w5, -4025, -455, 2.0],
  [A.L8e, -3900, -560, 0.75, 0.9, 120], [DUR, -3880, -600, 0.62, 0.8, 260]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z, lens, ty] = hermite(sh.keys, t);
  let dx = 0, dy = 0, r = 0;
  // the strike: a jolt; the mudflow: a long rumble
  if (t >= T.strike) { const e = Math.exp(-(t - T.strike) * 6); dx += 30 * e * noise(t * 40, 1); dy += 26 * e * noise(t * 37, 2); r += 0.02 * e * noise(t * 30, 3); }
  if (t >= T.lahar0 && t < T.up + 0.5) { const e = clamp((t - T.lahar0) / 0.3) * (1 - seg(T.up - 0.3, T.up + 0.5, t)); dx += 9 * e * noise(t * 31, 4); dy += 9 * e * noise(t * 29, 5); }
  if (t >= SLAM_T && t < SLAM_T + 0.6) { const e = Math.exp(-(t - SLAM_T) * 9); dy += 16 * e * Math.sin((t - SLAM_T) * 60); }
  return { x, y, z, lens, ty, dx, dy, r };
}

// —— the sky, the ash, lightning ——
const keysAt = (k, t) => { if (t <= k[0][0]) return k[0][1]; for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], ease.inOut((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]))); return k[k.length - 1][1]; };
const skyK = t => keysAt([[T.te, 0], [T.te + 3, 0.12], [T.c3, 0.3], [T.c5, 0.42], [A.L5, 0.55], [A.L6, 0.78], [A.L7, 0.86]], t);
const ashFall = t => keysAt([[A.L4w8 - 0.3, 0], [A.L5, 0.3], [T.up, 0.4], [T.c7, 0.95], [T.c8, 1.0]], t);
const groundAsh = t => keysAt([[A.L4, 0], [T.c7, 0.4], [T.c8, 0.65]], t);
// lightning in the cloud (in the volcano's layer): t, how long, seed, where; `to` sends a stroke down to the ground
const BOLTS = [
  { t: A.L2w4 + 0.2, d: 0.22, seed: 3, v: 0.75, dx: 120 }, { t: A.L2w4 + 0.65, d: 0.18, seed: 5, v: 0.92, dx: 400, ex: 300, len: 300 },
  { t: T.c3 + 0.25, d: 0.25, seed: 7, v: 0.9, dx: 260 }, { t: A.L3w10 - 0.05, d: 0.3, seed: 9, v: 0.95, dx: 380, to: [-560, -330], w: 10 },
  { t: A.L3w10 + 0.38, d: 0.26, seed: 12, v: 0.95, dx: 760, to: [1450, -330], w: 9 }, { t: T.c4 + 0.3, d: 0.2, seed: 14, v: 0.85, dx: 300 },
  { t: T.c5 + 0.4, d: 0.2, seed: 17, v: 0.9, dx: 500 }, { t: A.L5 + 0.5, d: 0.2, seed: 21, v: 0.9, dx: 300 }, { t: T.c7 + 0.6, d: 0.2, seed: 23, v: 0.95, dx: 600 },
  { t: T.c8 + 0.4, d: 0.2, seed: 27, v: 0.95, dx: 200 }, { t: A.L8 + 1.2, d: 0.22, seed: 29, v: 0.9, dx: 420 }, { t: DUR - 0.5, d: 0.25, seed: 31, v: 0.92, dx: 300 },
];
const flashAt = t => { let f = 0; for (const b of BOLTS) if (t >= b.t && t < b.t + b.d + 0.15) f = Math.max(f, (b.to ? 0.5 : 0.25) * Math.exp(-(t - b.t) * 9)); if (t >= T.strike) f = Math.max(f, 0.9 * Math.exp(-(t - T.strike) * 7)); return f; };

// —— frame ——
export function init() {}
function drawProp(hn, A2) {
  const p = hn.o.prop;
  if (!p) return;
  if (p.kind === 'binoc') {
    const neck = A2.T.p([-20, -222]);
    if (p.hang > 0.3) limb([neck, [p.p[0], p.p[1] - 6]], 4, HUN.frameDark, false);
    binoculars(p.p[0], p.p[1], 0.62 * S / 0.5, hn.o.face === 1 ? 1 : -1, (hn.o.face === 1 ? 1 : -1) * Math.PI / 2 * ease.inOut(clamp((p.hang - 0.4) / 0.6)));
  }
  else if (p.kind === 'phone') phone(p.p[0], p.p[1], 0.95 * S / 0.5, p.ang, p.glow, true);
  else if (p.kind === 'glasses') { g.save(); g.translate(p.p[0], p.p[1]); limb([[0, 0], [34 * S, -4 * S]], 5 * S, HUN.frameDark, false); ell(-6 * S, 2 * S, 26 * S, 18 * S, HUN.frameDark); ell(-6 * S, 2 * S, 21 * S, 14 * S, HUN.lens); g.restore(); }
}
function hunterDraw(t, hn) {
  const o = { ...hn.o };
  if (o.prop?.kind === 'binoc' || o.prop?.kind === 'phone') o.faceProp = A2 => drawProp(hn, A2);
  if (o.cloth) o.propFar = hf => cloth(hf.p([14, 0]), S, o.cloth.wet, o.cloth.wave);
  if (o.prop?.kind === 'flask') o.propNear = hf => {
    const tilt = o.prop.tilt, c = hf.p([22, 0]), ang = -0.2 - 2.0 * tilt;
    flask(c[0], c[1] - 8, 0.8, ang);
    const m = [c[0] + 40 * Math.sin(ang), c[1] - 8 - 40 * Math.cos(ang)];   // the flask's mouth
    if (tilt > 0.6) for (let i = 0; i < 8; i++) { const ph = (t * 4 + i / 8) % 1; ell(m[0] - 4 * ph, m[1] + 64 * ph * ph + 10 * ph, 4, 7, '#9fd3ff', 0, 1 - ph * 0.6); }
  };
  return drawHunter(o);
}
// a big red cross stamped over a world point
function redX(cam, p, size, t0, t, out = Infinity) {
  if (t < t0 || t > out + 0.25) return;
  const k = sp(t, t0, 2.6, 8) * (1 - clamp((t - out) / 0.25)), [x, y] = toScreen(cam, p);
  g.save(); g.setTransform(1, 0, 0, 1, x, y); g.scale(lerp(1.8, 1, Math.min(1, k)) * Math.min(1, k * 4), lerp(1.8, 1, Math.min(1, k)) * Math.min(1, k * 4)); g.rotate(-0.08);
  for (const [c, d] of [[INK, 8], ['#ff4d4d', 0]]) for (const s of [-1, 1]) limb([[-size + d, -size * s + d], [size + d, size * s + d]], size * 0.42, c, false);
  g.restore();
}
function dust(t, t0, x, y, n = 6, w = 70) {
  const u = (t - t0) / 0.5;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1) - 0.5, r = 12 + 22 * ease.out(u) * (0.6 + hash(i * 3.1) * 0.6);
    ell(x + s * w * (0.6 + 1.4 * ease.out(u)), y - 10 - 26 * ease.out(u) * (0.5 + hash(i * 1.7)), r, r, '#a99c86', 0, 0.8 * (1 - u));
  }
}
function sparks(t, t0, x, y) {
  const u = (t - t0) / 0.6;
  if (u <= 0 || u >= 1) return;
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * hash(i + 5), v = 300 + 400 * hash(i + 6), px = x + Math.cos(a) * v * u, py = y + Math.sin(a) * v * u + 700 * u * u;
    ell(px, py, 6 * (1 - u) + 2, 6 * (1 - u) + 2, i % 2 ? '#ffd36a' : '#fff3d6');
  }
}

export function frame(t) {
  if (t < T.cover) return coverFrame(t);
  if (t < T.c1) {
    O.binocularView(t, T.te, { kick: Math.exp(-Math.max(0, t - T.te) * 5) * (t > T.te ? 1 : 0), bolts: [] });
    subtitles(t, SUBS);
    return;
  }
  const cam = camAt(t), hn = hunterAt(t), sky = skyK(t), gash = groundAsh(t), wind = t > A.L4w1 ? 1 : 0.2;
  const flash = flashAt(t);
  Wd.drawSky(sky, flash, cam);
  view(cam, F.VOLC); Wd.drawVolcano(t, T.te, { bolts: BOLTS, dark: sky });
  view(cam, F.FAR); Wd.drawFar(sky * 0.7);
  view(cam, F.MID); Wd.drawMid(t, sky * 0.7);
  Wd.drawAsh(t, cam, ashFall(t) * 0.8, F.MID, { n: 120, size: 5, seed: 3, a: 0.7, speed: 0.6 });
  view(cam, 1);
  Wd.drawSlope(t, { ash: gash });
  const xf = laharX(t);
  if (xf != null) Wd.drawLahar(t, xf);
  Wd.drawNearBank(t, gash, wind);
  Wd.drawBoat(t, T.boatHit);
  Wd.drawSign({ wob: 0.08 * Math.exp(-Math.max(0, t - A.L5w4) * 6) * Math.sin(Math.max(0, t - A.L5w4) * 30) * (t > A.L5w4 ? 1 : 0) });
  Wd.drawTrees(t, gash, wind);
  Wd.drawHut(t, { ash: gash, light: t > A.L7w7 - 0.1 ? 0.6 + 0.4 * sp(t, A.L7w7 - 0.1, 2, 5) : 0.25 });
  const door = t < DOOR_T ? 0 : t < IN_T ? seg(DOOR_T, DOOR_T + 0.22, t, ease.out) : 1 - seg(IN_T, SLAM_T, t, ease.inQuad);
  const winUp = t < T.win + 0.2 ? 0 : seg(T.win + 0.25, A.L7e, t);
  Wd.drawUAZ(t, {
    ash: gash, door, win: winUp, bounce: (t > SLAM_T ? 6 * Math.exp(-(t - SLAM_T) * 8) * Math.sin((t - SLAM_T) * 40) : 0) + (t > A.L7w3 && t < A.L7w3 + 0.5 ? 0 : 0),
    inside: hn.mode === 'uaz' ? dw => insideCab(t, hn, dw) : null,
  });
  Wd.drawLadder();
  Wd.drawTower(t, { scorch: t > T.strike ? 1 : 0, smoke: t > T.strike ? (t - T.strike) * 0.6 : 0 });
  if (hn.mode !== 'uaz') {
    if (hn.into > 0) {
      const d = Wd.drawUAZ;   // into the open door: clipped by its frame
      const x0 = Wd.UAZ.x - Wd.UAZ.len / 2, yb = Wd.UAZ.y - 70;
      g.save(); g.beginPath(); g.rect(x0 + 130 + (1 - hn.into) * -600, yb - 330 - 400, 140 + (1 - hn.into) * 1200, 1200); g.clip();
      hunterDraw(t, hn); g.restore();
    } else hunterDraw(t, hn);
  }
  if (hn.mode === 'platform') Wd.drawTowerFront();
  if (t >= T.strike && t < T.strike + 0.3) {
    const pts = Wd.boltPath(41, [-260, -3600], [0, Wd.TOWER.peak], 12, 120);
    Wd.strokeBolt(pts, 30, Wd.flick(t, T.strike), 43);
  }
  sparks(t, T.strike, 0, Wd.TOWER.peak);
  dust(t, LAND, X0, 0, 7, 90);
  if (hn.mode === 'ground' && t > T.c8 && t < SLAM_T + 0.6) dust(t, SLAM_T, Wd.UAZ.x - 120, Wd.UAZ.y, 5, 120);
  Wd.drawAsh(t, cam, ashFall(t), F.FG, { n: 150, size: 8, seed: 11 });
  windStreaks(t, seg(A.L4w3 - 0.35, A.L4w3 + 0.05, t) * (1 - 0.5 * seg(T.mapOut, T.mapOut + 0.4, t)) * (1 - seg(T.c6 - 0.2, T.c6, t)));
  // —— overlays ——
  if (t >= T.c2 && t < T.c3) {
    if (PHONE_UP) redX(cam, PHONE_UP, 70, A.L3w2 + 0.02, t, A.L3w3 - 0.05);
  }
  if (t >= T.c4 && t < T.c5) {
    const k = sp(t, A.L3w15 - 0.1, 2.2, 7), [x, y] = toScreen(cam, [0, Wd.TOWER.peak + 40]);
    O.crosshair(x, y, 150, k, 1 - seg(T.strike - 0.05, T.strike + 0.05, t));
  }
  if (t >= T.c6 && t < T.c7) redX(cam, [Wd.FORK.sign[0] - 100, Wd.FORK.sign[1] - 205], 74, A.L5w4 - 0.02, t, T.down + 0.2);
  if (t >= T.up && t < T.c7) {   // «выше по склону»: away from the river, up the path
    const out = 1 - seg(A.L5e - 0.2, A.L5e + 0.1, t);
    O.arrow(toScreen(cam, [-1760, -60]), toScreen(cam, [-2260, -330]), seg(A.L5w15 - 0.1, A.L5w15 + 0.35, t) * out);
  }
  if (t >= T.c7 && t < T.c8) {
    const pk = sp(t, A.L6w5 - 0.45, 2.2, 7) * (1 - seg(A.L6w6 - 0.2, A.L6w6 + 0.05, t, ease.in));
    const F0 = framesOf(hn.o), palm = toScreen(cam, F0.T.p([-14, -192]).map((v, i) => v + (i ? 70 * S + 10 : -120 * S - 20)));
    O.magnifier(t, 790, 620, 210, pk, palm);
    if (pk > 0.3) text('СТЕКЛО', 790, 900, 74 * clamp(sp(t, A.L6w5, 2.4, 7)), '#9fd3ff', { fam: 'Oswald' });
  }
  if (t >= T.c8 && t < T.win + 0.3) {          // both are shelter: the car and the hut get a tick
    const out = 1 - seg(T.win, T.win + 0.25, t);
    tick(...toScreen(cam, [Wd.UAZ.x - 60, Wd.UAZ.y - 520]), sp(t, A.L7w3 + 0.1, 2.6, 8) * out);
    tick(...toScreen(cam, [Wd.HUT.x, Wd.HUT.y - 560]), sp(t, A.L7w7 + 0.1, 2.6, 8) * out);
  }
  O.drawMap(t, mapState(t));
  stepHeaders(t);
  O.endCard(t, A.L8 - 0.05, 0);
  subtitles(t, SUBS);
  if (flash > 0.3 && t >= T.strike) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = (flash - 0.3) * 0.8; g.fillStyle = '#f3e9ff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}
// a green tick stamped on screen at (x, y)
function tick(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.setTransform(1, 0, 0, 1, x, y); const z = lerp(1.6, 1, Math.min(1, k)) * Math.min(1, k * 4); g.scale(z, z); g.rotate(-0.06);
  ell(6, 8, 74, 74, INK); ell(0, 0, 74, 74, '#fff3d6');
  for (const [c, d] of [[INK, 6], ['#3e9a4a', 0]]) limb([[-34 + d, 2 + d], [-8 + d, 30 + d], [38 + d, -28 + d]], 22, c, false);
  g.restore();
}
// the wind made visible: thin tapering streaks blowing to the right, the way the cloud drifts
function windStreaks(t, k) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const per = 0.8 + 0.5 * hash(i + 31), ph = ((t + per * hash(i + 32)) / per) % 1;
    const y0 = 380 + 1200 * hash(i + 33), x = -400 + (W + 800) * ph, len = 320 + 260 * hash(i + 34), w = 7 + 4 * hash(i + 35);
    const a = k * 0.85 * Math.sin(Math.PI * ph);
    g.strokeStyle = `rgba(255,246,230,${a.toFixed(3)})`;
    let prev = null;
    for (let j = 0; j <= 14; j++) {
      const u = j / 14, pt = [x - len * u, y0 + 16 * Math.sin(u * 4.5 - t * 7 + i)];
      if (prev) { g.lineWidth = w * (1 - u * 0.85); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(pt[0], pt[1]); g.stroke(); }
      prev = pt;
    }
  }
}
function insideCab(t, hn, dw) {
  const o = { ...hn.o };
  const seat = [dw.x + dw.w / 2 + 6, dw.y + dw.h + 95];
  o.hip = seat; o.feet = { near: [seat[0] - 90, seat[1] + 120], far: [seat[0] - 70, seat[1] + 120] };
  o.lean = -0.05;
  const F = framesOf(o), sh = F.T.p([-14, -192]);
  // cranks the window up: the hand circles low by the door
  if (t > T.win + 0.15 && t < A.L7e + 0.1) { const a = (t - T.win) * 14; o.hands = { near: { p: [sh[0] - 40 * S + 30 * S * Math.cos(a), sh[1] + 150 * S + 30 * S * Math.sin(a)], shape: 'grip' } }; o.look = [-0.2, 0.6]; }
  // turns to us and gives a thumbs-up
  if (t > A.L8 - 0.1) {
    const u = sp(t, A.L8, 2.2, 7);
    o.hands = { near: { p: [sh[0] - 60 * S, sh[1] - 60 * S * clamp(u) - 10], shape: 'thumb', ang: -Math.PI / 2 } };
    o.look = [0.6, 0.1]; o.brow = 0.3; o.headTilt = -0.05;
  }
  drawHunter(o);
}
function mapState(t) {
  if (t < T.mapIn || t > T.mapOut + 0.5) return { k: 0 };
  return {
    k: sp(t, T.mapIn, 1.8, 7), out: seg(T.mapOut, T.mapOut + 0.4, t, ease.in),
    wind: seg(A.L4w3 - 0.05, A.L4w3 + 0.35, t), fan: seg(A.L4w4 - 0.05, A.L4w6 + 0.2, t), ash: seg(A.L4w8 - 0.15, A.L4w8 + 0.5, t), ashT: A.L4w8,
    red: seg(A.L4w10 - 0.05, A.L4w10 + 0.3, t), crossT: A.L4w10 + 0.35, green: seg(A.L4w13 - 0.1, A.L4w13 + 0.3, t),
    walk: seg(A.L4w13 + 0.05, T.mapOut - 0.1, t), checkT: T.mapOut - 0.25,
  };
}
function stepHeaders(t) {
  O.stepHeader(t, 1, 'СЛЕЗАЙ С ВЫШКИ', A.L3 + 0.02, Math.min(T.c5 - 0.1, A.L3e + 0.7));
  if (t < T.mapIn + 0.1 || t > T.mapOut + 0.3) O.stepHeader(t, 2, 'ПОПЕРЁК ВЕТРА', A.L4 + 0.02, Math.min(A.L4e, T.mapIn));
  O.stepHeader(t, 3, 'НЕ К РЕКЕ', A.L5 + 0.02, A.L5e - 0.05);
  O.stepHeader(t, 4, 'ЗАКРОЙ ЛИЦО', A.L6 + 0.02, A.L6e - 0.05);
  O.stepHeader(t, 5, 'В УКРЫТИЕ', A.L7 + 0.02, A.L7e - 0.05);
}

// —— the cover: his face against the eruption, two words and the series tag ——
function coverFrame(t) {
  const te = -9;
  Wd.drawSky(0.35, 0);
  g.setTransform(1.25, 0, 0, 1.25, 700 - Wd.VOLC.x * 1.25, 1010 - Wd.VOLC.y * 1.25);
  Wd.drawVolcano(t + 9, 0, { dark: 0.3, bolts: [{ t: 0, d: 10, seed: 9, v: 0.95, dx: 380, to: [-300, -360], w: 11 }, { t: 0, d: 10, seed: 3, v: 0.8, dx: 140 }] });
  g.setTransform(1.2, 0, 0, 1.2, 540, 1640); Wd.drawFar(0.3);
  g.setTransform(1, 0, 0, 1, 540, 1800); Wd.drawMid(t, 0.3);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const o = base(t, { s: 1.9, face: 1, pop: 1, brow: 1, mouth: 0.75, look: [0.8, -0.2], hatJump: 30, blink: 0, lean: -0.1, headTilt: 0.1 });
  o.hip = [330, 1930]; o.feet = { near: [300, 2400], far: [360, 2400] };
  const F0 = framesOf(o), chest = F0.T.p([-70, -150]);
  o.hands = { near: { p: [chest[0] + 10, chest[1] + 20], shape: 'grip' }, far: { p: [chest[0] + 40, chest[1]], shape: 'grip' } };
  o.faceProp = () => binoculars(chest[0], chest[1], 1.7, 1, 0.3);
  drawHunter(o);
  // the words
  text('ВУЛКАН', 540, 470, 210, '#fff3d6', { rot: -0.03 });
  const w = 640, h = 130;
  g.save(); g.translate(540, 600); g.rotate(-0.03);
  rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, '#ffd23f');
  g.restore();
  text('ЧТО ДЕЛАТЬ?', 540, 640, 104, INK, { fam: 'Oswald', rot: -0.03, shadow: false });
  g.save(); g.translate(540, 300); rect(-150 + 5, -28 + 6, 300, 56, INK); rect(-150, -28, 300, 56, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 316, 40, '#fff3d6', { fam: 'Oswald', shadow: false });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.c1) return t > T.te && t < T.te + 0.6 ? 8 : 0;
  let t0 = t - h, t1 = t + h;
  for (const c of CUTS) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), hn = hunterAt(tt), o = hn.o;
    const w = hn.mode === 'uaz' ? [[Wd.UAZ.x - 200, Wd.UAZ.y - 300]] : [o.hip, o.feet.near, o.feet.far, [o.hip[0], o.hip[1] - 200 * S]];
    const out = w.map(p => toScreen(cam, p));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
    const xf = laharX(tt);
    if (xf != null) out.push(toScreen(cam, [xf, Wd.RIVER.top]));
    return out;
  };
  const a = pts(t0), b = pts(t1), on = ([x, y]) => x > -200 && x < W + 200 && y > -200 && y < H + 200;
  let m = 0;
  for (let i = 0; i < a.length; i++) if (on(a[i]) || on(b[i])) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return m * (0.5 / (2 * h * 60));
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(T.te - 0.02, 'eruption', 0, 0.3);
  for (const b of BOLTS) add(b.t, b.to ? 'thunder_far' : 'crackle', b.to ? -4 : -10, 0.3);
  add(T.c1 - 0.05, 'whoosh_short', -8, 0);                               // out of the binoculars
  add(A.L3w2 - 0.25, 'phone', -6, 0.2);
  add(A.L3w2 + 0.02, 'stamp', -2, 0.2);
  add(TURN_T, 'cloth', -8, 0);
  add(LADDER_T0, 'ladder', -4, 0, { dur: LAND - LADDER_T0 });
  add(LAND, 'thud', -4, 0);
  for (const f of ['near', 'far']) for (const p of PL[f]) add(p.t, 'step', -10, f === 'near' ? 0.05 : -0.05);
  add(A.L3w15 - 0.1, 'lock', -6, 0);
  add(T.strike - 0.01, 'thunder_hit', 2, 0);
  add(T.c5 - 0.1, 'gust', -4, -0.3, { sec: 3.2 });
  add(T.mapIn, 'paper', -6, 0);
  add(A.L4w3 - 0.05, 'marker', -10, 0.2, { dur: 0.4 });
  add(A.L4w10 - 0.05, 'marker', -10, 0, { dur: 0.35 });
  add(A.L4w10 + 0.35, 'stamp', -4, 0);
  add(A.L4w13 - 0.1, 'marker', -10, -0.2, { dur: 0.4 });
  add(T.mapOut - 0.25, 'ding', -6, -0.2);
  add(T.mapOut, 'paper', -8, 0);
  add(A.L5w4 - 0.02, 'stamp', -2, -0.2);
  add(T.down, 'whoosh', -10, 0);
  add(T.lahar0, 'lahar', 0, 0.4, { dur: T.up - T.lahar0 + 0.8 });
  add(T.boatHit, 'crunch', -4, -0.2);
  add(A.L5w15 - 0.1, 'marker', -10, -0.2, { dur: 0.35 });
  add(A.L6w5 - 0.45, 'whoosh_in', -12, 0.2);
  add(A.L6w5 - 0.05, 'glass', -6, 0.2);
  const fl0 = A.L6w6 - 0.05, fl1 = A.L6w11 - 0.35, tie0 = fl1 + 0.1, gl0 = A.L6w12 + 0.1;
  add(fl0 - 0.15, 'cloth', -8, -0.1);
  add(fl0 + 0.4, 'pour', -8, -0.1, { dur: fl1 - fl0 - 0.35 });
  add(tie0, 'cloth', -8, 0.1);
  add(gl0 + 0.3, 'glasses', -6, 0);
  add(A.L7w3 + 0.1, 'ding', -8, 0.2);
  add(DOOR_T, 'door', -6, -0.2);
  add(A.L7w7 - 0.1, 'lamp', -10, -0.4);
  add(A.L7w7 + 0.1, 'ding', -8, -0.3);
  add(SLAM_T, 'slam', -2, -0.1);
  add(T.win + 0.25, 'crank', -8, 0, { dur: A.L7e - T.win - 0.2 });
  for (const t0 of [A.L3, A.L4, A.L5, A.L6, A.L7]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L8 + 0.1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
Object.assign(MARKS, { turn: TURN_T, ladder: LADDER_T0, land: LAND, door: DOOR_T, slam: SLAM_T });
