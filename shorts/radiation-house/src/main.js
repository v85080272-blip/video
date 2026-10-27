// «Взрыв на станции, ты дома»: the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py): another take moves the picture with it (STORYBOARD.md).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath } from './flat.js';
import { view, toScreen, REF } from './camera.js';
import * as Wd from './world.js';
import * as Hs from './house.js';
import { drawHunter, framesOf, dosimeter, HUN } from './hunter.js';
import { text, groupWords, subtitles, INK, FONTS, measure } from './type.js';
import * as O from './overlay.js';

const { F } = Wd;
// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SUBS = VOICE ? VOICE.lines.filter(l => l.id !== 'L0').flatMap(l => groupWords(l.words, Array.isArray(l.sub) ? l.sub : null)) : [];
const LN = id => VOICE?.lines.find(l => l.id === id);
// without a voice yet: [start, end, words] of each line, words spread evenly
const FB = { L0: [0.12, 3.3, 10], L1: [3.65, 8.6, 15], L2: [9.0, 14.4, 14], L3: [14.8, 20.6, 16], L4: [21.0, 25.4, 13], L5: [25.8, 32.4, 20], L6: [32.8, 37.6, 14], L7: [38.05, 41.0, 10] };
export const DUR = VOICE?.dur ?? 41.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? (ws[Math.min(i, n - 1)].s) : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
// —— the shots ——
const T = {
  cover: 0.3,                                    // the poster: the first frames
  boom: A.L0w4 - 0.05,                           // «взорвалась»: the flash in the window
  nope: A.L1w9,                                  // «Не надо»: the cross at the door
  c2: A.L1w11 - 0.08,                            // «ветер несёт…»: outside, the plume and the dust
  c3: A.L2 - 0.05,                               // «Первое: закрой окна»: the window, close
  cd: A.L2w3 - 0.12,                             // «двери»: the door and its bolt
  cs: A.L2w5 - 0.12,                             // «заслонку печки»: the stove
  cf: A.L2w7 - 0.12,                             // «выключи вентиляцию»: the fan
  cr: A.L2w9 - 0.1,                              // «Так пыль не затянет»: the whole room
  c4: A.L3 - 0.05,                               // «Второе»: into the cellar
  c5: A.L4 - 0.05,                               // «Третье»: water and jars
  c6: A.L5 - 0.05,                               // «Четвёртое»: the iodine
  c7: A.L6 - 0.05,                               // «Пятое»: the radio, a day
  iodX: A.L5w3 - 0.05,                           // «йод»: the cross on the bottle at his mouth
};
const PUT = { a: T.boom + 0.6, b: Math.max(T.boom + 1.0, A.L0w7 - 0.25) }, MUG_SILL = [Hs.WIN.x + 110, Hs.WIN.y + Hs.WIN.h / 2 + 22];
export const CUTS = [T.cover, T.c2, T.c3, T.cd, T.cs, T.cf, T.cr, T.c4, T.c5, T.c6, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, FLOOR = 0, CFLOOR = Hs.CEL.floor;

// —— walking on a flat floor: plants for each foot, the hip gliding over them ——
const PL = { near: [], far: [] };
const RUNS = [];
function plant(foot, t, x, y, swing = 0.22, lift = 30) { PL[foot].push({ t, p: [x, y], swing, lift }); }
function invert(f, y) { let a = 0, b = 1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (f(m) < y) a = m; else b = m; } return (a + b) / 2; }
function walk(t0, t1, x0, x1, gy, L = 120, first = 'near', e = ease.inOut) {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / L)), dir = Math.sign(x1 - x0), step = (x1 - x0) / n;
  RUNS.push({ t0, t1, x0, x1, gy, e });
  let foot = first, prev = t0 - 0.2;
  for (let i = 1; i <= n; i++) {
    const tt = lerp(t0, t1, invert(e, (i - 0.5) / n));
    plant(foot, tt, x0 + step * i - (i === n ? dir * 14 : 0), gy, Math.min(0.3, (tt - prev) * 0.9 + 0.04), 28);
    prev = tt; foot = foot === 'near' ? 'far' : 'near';
  }
  plant(foot, t1 + 0.1, x1 + dir * 22, gy, 0.18, 14);
}
function footAt(foot, t, fallback) {
  const L = PL[foot].filter(p => Math.abs(p.p[1] - fallback[1]) < 1);
  let i = -1; while (i + 1 < L.length && L[i + 1].t <= t) i++;
  const cur = i >= 0 ? L[i].p : fallback, nx = L[i + 1];
  if (!nx || t < nx.t - nx.swing) return cur;
  const u = clamp((t - (nx.t - nx.swing)) / nx.swing), e = ease.inOut(u);
  return [lerp(cur[0], nx.p[0], e), lerp(cur[1], nx.p[1], e) - nx.lift * Math.sin(Math.PI * u)];
}
function runAt(t) { let r = null; for (const q of RUNS) if (t >= q.t0 - 0.3) r = q; return r; }
function stepAt(t) {
  const all = [...PL.near.map(p => [p.t, 1]), ...PL.far.map(p => [p.t, -1])].sort((a, b) => a[0] - b[0]);
  let i = -1; while (i + 1 < all.length && all[i + 1][0] <= t) i++;
  if (i < 0 || i + 1 >= all.length || all[i + 1][0] - all[i][0] > 0.45) return { up: 0, sw: 0 };
  const u = (t - all[i][0]) / (all[i + 1][0] - all[i][0]);
  return { up: Math.sin(Math.PI * u), sw: all[i][1] * Math.cos(Math.PI * u) };
}
// stand at x on floor y, or walk along a run that covers t
function onFloor(t, o, x, y) {
  const r = runAt(t), on = r && r.gy === y && t >= r.t0 - 0.3 && t <= r.t1 + 0.4;
  if (on) x = t <= r.t0 ? r.x0 : t >= r.t1 ? r.x1 : lerp(r.x0, r.x1, r.e((t - r.t0) / (r.t1 - r.t0)));
  // off a run the feet stand under him (the plants of an earlier walk are somewhere else after a cut)
  o.feet = on ? { near: footAt('near', t, [x - 12, y]), far: footAt('far', t, [x + 16, y]) } : { near: [x - 12, y], far: [x + 16, y] };
  o.hip = [x, y - LEG - 12 * stepAt(t).up];
  return o;
}
const WALK_DOOR = { t0: A.L1w3 - 0.15, t1: A.L1w9 - 0.3, x0: Hs.WIN.x + 210, x1: Hs.DOOR.x - 190 };
walk(WALK_DOOR.t0, WALK_DOOR.t1, WALK_DOOR.x0, WALK_DOOR.x1, FLOOR, 125, 'far');
const DESC = { t0: A.L3w1 + 0.25, t1: A.L3w8 };                // down the ladder
const WALK_JARS = { t0: A.L4 + 0.05, t1: A.L4w4 - 0.05, x0: 0, x1: 220 };
walk(WALK_JARS.t0, WALK_JARS.t1, WALK_JARS.x0, WALK_JARS.x1, CFLOOR, 120, 'near');
const WALK_CRATE = { t0: A.L5 - 0.1, t1: A.L5w1 + 0.05, x0: 220, x1: -120 };
walk(WALK_CRATE.t0, WALK_CRATE.t1, WALK_CRATE.x0, WALK_CRATE.x1, CFLOOR, 130, 'near');

// —— the hunter's acting ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, scarf: null, glasses: null, pack: false, jacket: false, boots: false, ...extra });
function swingArms(o, sw, k = 1) {
  const F0 = framesOf(o), dir = o.face;
  const arm = (side, a) => { const Sh = F0.T.p(side === 'near' ? [-14, -192] : [18, -198]), len = 160 * S; return { p: [Sh[0] + dir * Math.sin(a) * len, Sh[1] + Math.cos(a) * len * 0.9], shape: 'fist' }; };
  return { near: arm('near', 0.15 + 0.85 * sw * k), far: arm('far', 0.15 - 0.85 * sw * k) };
}
const shoulder = o => framesOf(o).T.p([-14, -192]);
// the dose the meter shows (0 … 1) and its blinking lamp
const dose = t => {
  if (t < T.c2) return 0.1;
  if (t < A.L3w1) return lerp(0.1, 0.85, seg(T.c2, A.L2, t));
  if (t < A.L3w12) return lerp(0.85, 0.35, seg(A.L3w1, A.L3w8, t));
  return lerp(0.35, 0.15, seg(A.L3w12, A.L3w15 + 0.3, t));
};
const ledAt = t => { const r = 3 + 30 * dose(t); return ((t * r) % 1) < 0.35 ? 1 : 0; };
// the fan: how far the blades have turned (they spin down after the switch)
const FAN_OFF = A.L2w7 + 0.05;
Object.assign(MARKS, { fanOff: FAN_OFF, desc0: DESC.t0, desc1: DESC.t1 });
const fanAngle = t => (t < FAN_OFF ? t * 9 : FAN_OFF * 9 + 3 * (1 - Math.exp(-(t - FAN_OFF) * 3)));
// states of the room
const winOpen = t => 1 - seg(A.L2w2 - 0.3, A.L2w2 + 0.05, t);
const doorOpen = t => (t < WALK_DOOR.t1 - 0.05 ? 0 : t < T.cd ? 0.4 * seg(WALK_DOOR.t1 - 0.05, WALK_DOOR.t1 + 0.3, t) : 0.4 * (1 - seg(T.cd, T.cd + 0.12, t, ease.in)));
const boltShut = t => seg(T.cd + 0.16, A.L2w3 + 0.3, t);
const damper = t => seg(T.cs + 0.08, A.L2w6 + 0.1, t);
const hatchOpen = t => seg(A.L3w1 - 0.1, A.L3w1 + 0.3, t);
const radioOn = t => seg(A.L6w1 + 0.05, A.L6w1 + 0.3, t);

export function hunterAt(t) {
  // —— the opening and the first line: at the window with tea, then to the door with the phone ——
  if (t < T.c2) {
    const o = onFloor(t, base(t, { face: -1, lid: 0.55, look: [-0.7, -0.1], dosi: { led: 0, jump: 0 } }), t < WALK_DOOR.t0 ? WALK_DOOR.x0 : WALK_DOOR.x1, FLOOR);
    const sh = shoulder(o);
    o.prop = { kind: 'mug', p: [sh[0] - 46, sh[1] + 10 - 30 * bump(seg(0.6, 1.6, t))] };
    o.hands = { near: { p: [sh[0] - 50, sh[1] + 34 - 30 * bump(seg(0.6, 1.6, t))], shape: 'grip' } };
    if (t > T.boom) {                                          // the flash: he jumps, tea flies, he stares
      const k = sp(t, T.boom, 2.4, 6);
      o.hatJump = 40 * bump((t - T.boom) / 0.35); o.pop = clamp(k); o.brow = clamp(k); o.mouth = 0.6 * clamp(k); o.lid = 0.1; o.look = [-0.8, -0.3];
      o.lean = -0.12 * clamp(k);
      o.prop.p = [o.prop.p[0] + 10 * bump((t - T.boom) / 0.3), o.prop.p[1] - 30 * bump((t - T.boom) / 0.3)];
      o.prop.spill = t - T.boom;
    }
    if (t > PUT.a) {                                           // the mug goes on the sill
      const k = seg(PUT.a, PUT.b, t), m = o.prop.p;
      o.prop.p = [lerp(m[0], MUG_SILL[0], k), lerp(m[1], MUG_SILL[1], k) - 50 * bump(k)];
      o.hands = { near: { p: [o.prop.p[0] - 4, o.prop.p[1] + 24], shape: 'grip' } }; o.lean = 0.15 * bump(k);
      if (t > PUT.b) { o.prop = null; o.hands = {}; }
    }
    if (t > A.L0w7 - 0.1) {                                    // «а ты дома?»: to us, hands up
      const k = sp(t, A.L0w7 - 0.1, 2.4, 7);
      o.face = 1; o.look = [0.7, 0]; o.mouth = 0.45; o.brow = 0.8; o.prop = null;
      o.hands = { near: { p: [o.hip[0] + 40 + 40 * k, o.hip[1] - 60 - 110 * k], shape: 'open' }, far: { p: [o.hip[0] - 30 - 30 * k, o.hip[1] - 70 - 110 * k], shape: 'open' } };
    }
    // «Первая мысль…»: the mug goes on the sill, out comes the phone, off to the door
    if (t > A.L1w0) {
      o.prop = null; o.face = 1; o.brow = 0.6; o.pop = 0.3; o.mouth = 0.25; o.look = [0.6, -0.1];
      const F1 = framesOf(o), s1 = F1.T.p([-14, -192]);
      const sw = stepAt(t).sw;
      o.hands = Math.abs(sw) > 0 ? { ...swingArms(o, sw, 0.6) } : {};
      if (t > A.L1w3 - 0.3) { o.hands.far = { p: [s1[0] + 90, s1[1] - 40], shape: 'grip' }; o.prop = { kind: 'phone', lit: seg(A.L1w5 - 0.2, A.L1w5, t) }; o.lean = 0.12; }
      if (t > WALK_DOOR.t1 - 0.15) { o.hands.near = { p: Hs.drawDoorInfo(doorOpen(t), 0).handle, shape: 'grip' }; }
      if (t > T.nope) {                                        // the cross: he freezes, then looks at us, caught out
        const k = sp(t, T.nope, 2.4, 7); o.pop = clamp(k); o.brow = 0.9; o.mouth = 0.1; o.hatJump = 20 * bump((t - T.nope) / 0.3);
        if (t > A.L1w10) { o.look = [0.9, 0.1]; o.brow = -0.2; o.mouth = 0.2; o.headTilt = -0.12; }
      }
    }
    return { o, where: 'room' };
  }
  if (t < T.c3) return { o: null, where: 'none' };
  // —— step 1: the close-ups; he is wherever the thing to shut is ——
  if (t < T.c4) {
    const o = base(t, { brow: -0.5, look: [-0.6, 0], mouth: 0.15, dosi: { led: ledAt(t), jump: 0 } });
    if (t < T.cd) {                                            // the window: both leaves, the near hand on the right one
      onFloor(t, o, Hs.WIN.x + 230, FLOOR); o.face = -1; o.lean = 0.2;
      const op = winOpen(t), lw = (Hs.WIN.w / 2) * Math.cos(op * 1.35), ex = Hs.WIN.x + Hs.WIN.w / 2 - lw;
      o.hands = { near: { p: [ex, Hs.WIN.y + 10], shape: 'open' }, far: { p: [ex - 20, Hs.WIN.y - 40], shape: 'open' } };
    } else if (t < T.cs) {                                     // the door: slam, bolt
      onFloor(t, o, Hs.DOOR.x - 240, FLOOR); o.face = 1; o.lean = 0.15; o.look = [0.6, 0];
      const d = Hs.drawDoorInfo(doorOpen(t), boltShut(t));
      o.hands = { near: { p: t < T.cd + 0.15 ? d.handle : d.bolt, shape: 'grip' } };
    } else if (t < T.cf) {                                     // the stove: the damper over the mouth
      onFloor(t, o, Hs.STOVE.x + 300, FLOOR); o.face = -1; o.lean = 0.3; o.look = [-0.6, 0.4];
      const h = Hs.damperAt(damper(t)).handle;
      o.hands = { near: { p: [h[0] + 10, h[1]], shape: 'grip' }, far: { p: [h[0] + 40, h[1] - 10], shape: 'grip' } };
    } else if (t < T.cr) {                                     // the fan: flick the switch
      onFloor(t, o, Hs.SWITCH[0] - 130, FLOOR); o.face = 1; o.look = [0.5, -0.4];
      const k = seg(T.cf, FAN_OFF, t);
      o.hands = { near: { p: [lerp(Hs.SWITCH[0] - 40, Hs.SWITCH[0], k), lerp(Hs.SWITCH[1] + 40, Hs.SWITCH[1] - 6, k)], shape: 'point' } };
      if (t > FAN_OFF + 0.4) o.look = [-0.2, -0.8];
    } else {                                                   // the room: hands on hips, pleased
      onFloor(t, o, 40, FLOOR); o.face = 1; o.look = [0.6, 0]; o.brow = 0.4; o.mouth = 0.2;
      const sh = shoulder(o);
      o.hands = { near: { p: [o.hip[0] + 40, o.hip[1] - 10], shape: 'fist' }, far: { p: [o.hip[0] - 30, o.hip[1] - 20], shape: 'fist' } };
    }
    return { o, where: 'room' };
  }
  // —— step 2: the hatch, down the ladder ——
  if (t < T.c5) {
    const o = base(t, { face: 1, look: [0.6, 0.4], brow: -0.3, dosi: { led: ledAt(t), jump: 0 } });
    if (t < DESC.t0) {
      onFloor(t, o, Hs.HATCH.x0 - 90, FLOOR);
      const u = seg(A.L3w1 - 0.3, A.L3w1 + 0.1, t) * (1 - seg(A.L3w1 + 0.2, DESC.t0, t));
      o.lean = 0.5 * u;
      const L = Hs.HATCH.x1 - Hs.HATCH.x0, a = -hatchOpen(t) * 1.65, lid = [Hs.HATCH.x0 + Math.cos(a) * (L - 40), Math.sin(a) * (L - 40)];
      o.hands = { near: { p: u > 0.05 ? lid : [o.hip[0] + 30, o.hip[1] + 20], shape: 'grip' } };
      return { o, where: 'room' };
    }
    if (t < DESC.t1 + 0.35) {                                  // on the ladder, facing it, stepping down rung by rung
      const u = seg(DESC.t0, DESC.t1, t, u => u), y0 = -LEG, y1 = CFLOOR - LEG;
      const hy = lerp(y0, y1, u), footY = hy + LEG - 6, lx = Hs.ladderX(footY);
      o.hip = [lx - 90, hy]; o.lean = -0.05; o.look = [0.3, 0.8];
      const rung = y => Hs.RUNGS.reduce((b, r) => (Math.abs(r - y) < Math.abs(b - y) ? r : b), Hs.RUNGS[0]);
      const ph = (u * 6) % 1, ry = Math.min(CFLOOR, rung(footY)), ry2 = Math.min(CFLOOR, rung(footY - 90));
      o.feet = { near: [Hs.ladderX(ry) - 40, ry], far: [Hs.ladderX(ry2) - 40, ry2 - 20 * bump(ph)] };
      if (t >= DESC.t1) { o.feet = { near: [lx - 100, CFLOOR], far: [lx - 70, CFLOOR] }; o.hip = [lx - 90, CFLOOR - LEG]; }
      const hr = hy - 200;
      o.hands = { near: { p: [Hs.ladderX(hr + 40) - 40, hr + 40], shape: 'grip' }, far: { p: [Hs.ladderX(hr - 10) - 30, hr - 10], shape: 'grip' } };
      if (t >= DESC.t1) o.hands = {};
      return { o, where: 'cellar' };
    }
    onFloor(t, o, Hs.ladderX(CFLOOR) - 90, CFLOOR);            // in the cellar, looking up at the floor over his head
    o.face = -1; o.look = [0.3, -0.9]; o.brow = 0.3; o.mouth = 0.1;
    if (t > A.L3w12) { o.face = 1; o.look = [0.7, -0.2]; o.brow = 0.5; }
    return { o, where: 'cellar' };
  }
  // —— step 3: water from bottles, food from jars ——
  if (t < T.c6) {
    const o = onFloor(t, base(t, { face: 1, look: [0.6, 0.2], dosi: { led: 0, jump: 0 } }), t < WALK_JARS.t0 ? WALK_JARS.x0 : WALK_JARS.x1, CFLOOR);
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.12; o.hands = swingArms(o, sw, 0.8); }
    const grab = seg(A.L4w4 - 0.15, A.L4w5 + 0.1, t);
    if (t > A.L4w4 - 0.15) {
      const sh = shoulder(o), bx = lerp(330, sh[0] + 70, grab), by = lerp(CFLOOR - 60, sh[1] + 10, grab);
      o.hands = { near: { p: [bx - 10, by], shape: 'grip' } }; o.prop = { kind: 'bottle', p: [bx, by + 60] };
      o.lean = 0.3 * bump(grab); o.look = [0.6, 0.5 - grab];
    }
    if (t > A.L4w9 - 0.2) { o.look = [0.5, -0.8]; o.brow = 0.5; o.mouth = 0.25; }
    return { o, where: 'cellar' };
  }
  // —— step 4: the iodine: he reaches for it, the cross, he puts it back ——
  if (t < T.c7) {
    const o = onFloor(t, base(t, { face: -1, look: [-0.6, 0.3], dosi: { led: 0, jump: 0 } }), t < WALK_CRATE.t0 ? WALK_CRATE.x0 : WALK_CRATE.x1, CFLOOR);
    const sw = stepAt(t).sw;
    if (Math.abs(sw) > 0) { o.lean = 0.12; o.hands = swingArms(o, sw, 0.8); }
    const BOT = [IOD.x, IOD.y], up = seg(A.L5w1 + 0.05, A.L5w3, t) * (1 - seg(A.L5w6 - 0.1, A.L5w7, t));
    if (t > A.L5w1 - 0.1) {
      const sh = shoulder(o), mouth = framesOf(o).H.p([-60, 30]);
      const p = t < A.L5w1 + 0.05 ? BOT : [lerp(BOT[0], mouth[0] - 10, up), lerp(BOT[1] - 30, mouth[1] + 30, up)];
      o.hands = { near: { p: [p[0] + 14, p[1] - 30], shape: 'grip' } };
      if (t < A.L5w7) o.prop = { kind: 'iodine', p, a: -0.9 * up };
      o.look = [-0.7, 0.2 - 0.4 * up]; o.mouth = 0.3 * up;
    }
    if (t > T.iodX) { const k = sp(t, T.iodX, 2.4, 7); o.pop = clamp(k) * (1 - seg(A.L5w6, A.L5w7, t)); o.brow = 0.9; o.hatJump = 18 * bump((t - T.iodX) / 0.3); }
    if (t > A.L5w7) { o.look = [0.6, -0.1]; o.brow = 0.3; o.pop = 0; o.mouth = 0.1; o.face = 1; o.hands = {}; }
    return { o, where: 'cellar' };
  }
  // —— step 5: the radio on, sit down for a day; the end: thumbs up ——
  const o = base(t, { face: -1, look: [-0.6, 0.4], dosi: { led: 0, jump: 0 } });
  const sit = seg(A.L6w4 - 0.2, A.L6w5 + 0.1, t);
  const x = lerp(-120, Hs.STOOL.x + 6, sit), seatY = CFLOOR - Hs.STOOL.h;
  o.hip = [x, lerp(CFLOOR - LEG, seatY - 8, sit) - 30 * bump(sit)];
  o.feet = { near: [lerp(x - 12, x - 64, sit), CFLOOR], far: [lerp(x + 16, x - 30, sit), CFLOOR] };
  const knob = [RADIO.x + 52 * RADIO.k, RADIO.y - 36 * RADIO.k];
  if (t < A.L6w4) {
    const k = seg(A.L6w1 - 0.35, A.L6w1, t) * (1 - seg(A.L6w2 + 0.1, A.L6w4, t));
    if (k > 0.01) o.hands = { near: { p: [lerp(o.hip[0] - 40, knob[0] + 10, k), lerp(o.hip[1] + 20, knob[1], k)], shape: 'grip' } };
    o.lean = 0.25 * k; o.look = [-0.7, 0.5];
  } else { o.look = [-0.4, 0]; o.brow = 0.2; o.lid = 0.4; }
  if (t > A.L7 - 0.1) {
    const u = sp(t, A.L7, 2.2, 7), F1 = framesOf(o), sh = F1.T.p([-14, -192]);
    o.face = 1; o.look = [0.6, 0.1]; o.brow = 0.5; o.mouth = 0.3; o.lid = 0.2;
    o.hands = { near: { p: [sh[0] + 50 + 32 * clamp(u), sh[1] + 40 - 50 * clamp(u)], shape: 'thumb', ang: -Math.PI / 2 }, far: { p: [o.hip[0] - 20, o.hip[1] - 10], shape: 'fist' } };
  }
  return { o, where: 'cellar' };
}
// things on the crate in the cellar
const RADIO = { x: Hs.CRATE.x + 70, y: CFLOOR - Hs.CRATE.h, k: 0.62 };
const KIT = { x: Hs.CRATE.x - 70, y: CFLOOR - Hs.CRATE.h, k: 0.7 };
const IOD = { x: Hs.CRATE.x + 0, y: CFLOOR - Hs.CRATE.h };

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
const CAM0 = { x: -235, y: -425, z: 1.36 };
const FAR_IN = { off: farOff(CAM0, toScreen(CAM0, [Hs.WIN.x - 10, Hs.WIN.y + 85])), s: 0.45 };
const CAM_OUT = { x: 60, y: -880, z: 0.38 };
const FAR_OUT = { off: farOff(CAM_OUT, [690, 700]), s: 0.8, boom: { rise: 1000, drift: 2200 } };
const SHOTS = [];
function shot(t0, kind, keys) { SHOTS.push({ t0, kind, keys: keys.map(k => [k[0], k[1], k[2], k[3], k[4] ?? 1, k[5] ?? 0]) }); }
// outside: a key that puts the water line at screen y wy and the far shore `gap` px above it
function K(t, x, z, wy = 1150, gap = 300) {
  const zf = Math.pow(z, F.FAR), y = -(gap + 175 * zf) / (z - 0.15 * zf);
  return [t, x, y, z, 1, wy - H / 2 + y * z];
}
// inside: the camera's centre and zoom
const IK = (t, x, y, z) => [t, x, y, z, 1, 0];
shot(T.cover, 'in', [IK(T.cover, -230, -430, 1.3), IK(T.boom, -235, -425, 1.36), IK(A.L0e, -240, -410, 1.45), IK(A.L1w3, -150, -380, 1.35),
  IK(A.L1w8, 330, -360, 1.3), IK(T.c2, 380, -350, 1.38)]);
shot(T.c2, 'out', [IK(T.c2, CAM_OUT.x, CAM_OUT.y, CAM_OUT.z), IK(T.c3, -40, -800, 0.44)]);
shot(T.c3, 'in', [IK(T.c3, Hs.WIN.x + 110, Hs.WIN.y + 60, 1.85), IK(T.cd, Hs.WIN.x + 100, Hs.WIN.y + 60, 1.95)]);
shot(T.cd, 'in', [IK(T.cd, Hs.DOOR.x - 120, -320, 1.85), IK(T.cs, Hs.DOOR.x - 110, -320, 1.95)]);
shot(T.cs, 'in', [IK(T.cs, Hs.STOVE.x + 160, -300, 1.75), IK(T.cf, Hs.STOVE.x + 150, -300, 1.85)]);
shot(T.cf, 'in', [IK(T.cf, Hs.FAN.x + 40, -440, 1.75), IK(T.cr, Hs.FAN.x + 40, -440, 1.85)]);
shot(T.cr, 'in', [IK(T.cr, 0, -360, 0.6), IK(T.c4, 0, -340, 0.64)]);
shot(T.c4, 'in', [IK(T.c4, -20, -60, 1.0), IK(A.L3w1 + 0.2, 0, -20, 1.05), IK(DESC.t1, -10, 330, 1.1), IK(A.L3w12, -20, 330, 1.05), IK(T.c5, -20, 340, 1.08)]);
shot(T.c5, 'in', [IK(T.c5, 140, 400, 1.45), IK(A.L4w5, 270, 420, 1.55), IK(A.L4w9, 330, 340, 1.5), IK(T.c6, 330, 350, 1.5)]);
shot(T.c6, 'in', [IK(T.c6, -60, 420, 1.55), IK(A.L5w2, -150, 400, 1.7), IK(A.L5w7, -160, 400, 1.6), IK(T.c7, -160, 400, 1.6)]);
shot(T.c7, 'in', [IK(T.c7, -190, 430, 1.6), IK(A.L6w4, -170, 440, 1.55), IK(A.L7, -160, 430, 1.55), IK(A.L7w5, -60, 120, 0.82), IK(DUR, 0, -260, 0.5)]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z, lens, ty] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  if (t >= T.boom && t < T.boom + 1.2) { const e = Math.exp(-(t - T.boom) * 4); dx += 26 * e * noise(t * 40, 1); dy += 22 * e * noise(t * 37, 2); }
  for (const t0 of [T.cd + 0.1, A.L2w3 + 0.3, A.L2w6 + 0.1]) if (t >= t0 && t < t0 + 0.3) { const e = Math.exp(-(t - t0) * 12); dy += 9 * e * Math.sin((t - t0) * 60); }
  return { x, y, z, lens, ty, dx, dy, r: 0, kind: sh.kind };
}

// the far land (FAR layer) is placed per view: its anchor (the horizon under the plant) lands on a screen point Qs
// for a reference camera, then moves with the FAR layer's parallax
function farOff(c, Qs) {
  const f = F.FAR, zF = Math.pow(c.z, f) * (c.lens ?? 1), o = [c.x * f + REF[0] * (1 - f), c.y * f + REF[1] * (1 - f)];
  return [(Qs[0] - W / 2) / zF + o[0], (Qs[1] - H / 2) / zF + o[1]];
}
// the last pull-back ends outside, where the plume should stand over the roof: the far land slides there meanwhile
const CAM_END = { x: 0, y: -260, z: 0.5 };
const FAR_END = { off: farOff(CAM_END, [880, 800]), s: 0.75 };
function farIn(t) {
  const k = seg(A.L7w2, DUR, t);
  if (k <= 0) return FAR_IN;
  return { off: [lerp(FAR_IN.off[0], FAR_END.off[0], k), lerp(FAR_IN.off[1], FAR_END.off[1], k)], s: lerp(FAR_IN.s, FAR_END.s, k) };
}
function farland(t, cam, fl) {
  Wd.drawSky(0, cam);
  view(cam, F.FAR); g.translate(fl.off[0], fl.off[1]); g.scale(fl.s, fl.s);
  Hs.farSun(-1100, -560);
  Hs.drawFarland(t, T.boom, { k: 0.5, ...fl.boom });
  Hs.dust(t, T.boom + 2.2, -1800, 1400, -1200, -40, 50, 1.8, 420);
}

// —— props drawn with the hunter ——
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'mug') o.propNear = () => {
    Hs.mug(p.p[0], p.p[1], 1, t < T.boom ? 1 : 0, t);
    if (p.spill != null && p.spill < 0.8) for (let i = 0; i < 6; i++) { const u = p.spill / 0.8; ell(p.p[0] - 20 + (i - 2.5) * 16 * (1 + u * 3), p.p[1] - 60 - 120 * u + 260 * u * u + 10 * i, 9, 12, '#a0582a', 0, 1 - u); }
  };
  if (p?.kind === 'phone') o.propFar = hf => Hs.phone(hf.p([30, 0])[0], hf.p([30, 0])[1] - 30, 0.1, 1.2, p.lit);
  if (p?.kind === 'bottle') o.propNear = () => Hs.waterBottle(p.p[0], p.p[1], 0.9);
  if (p?.kind === 'iodine') o.propNear = () => Hs.iodineBottle(p.p[0], p.p[1], p.a, 1.3);
  return drawHunter(o);
}

// —— frame ——
export function init() {}
export function frame(t) {
  if (t < T.cover) return coverFrame(t);
  const cam = camAt(t), hn = hunterAt(t);
  if (cam.kind === 'out') outsideFrame(t, cam);
  else insideFrame(t, cam, hn);
  // —— overlays ——
  overlays(t, cam, hn);
  stepHeaders(t);
  if (t < A.L1 + 0.1) questionTitle(t);
  O.endCard(t, A.L7 - 0.05, 0);
  subtitles(t, SUBS);
  // the flash of the explosion
  if (t > T.boom && t < T.boom + 1.2) { g.setTransform(1, 0, 0, 1, 0, 0); rect(0, 0, W, H, '#fff8e0', 0.9 * Math.exp(-(t - T.boom) * 5)); }
}
function insideFrame(t, cam, hn) {
  farland(t, cam, farIn(t));
  view(cam, 1);
  Hs.drawGround(t);
  Hs.drawRoomBack(t);
  Hs.drawWindow(t, { open: winOpen(t) });
  if (t > A.L2w2) Hs.dustAtWindow(t, A.L2w2 + 0.1, true, 1);
  Hs.drawStove(t, { shut: damper(t) });
  Hs.drawFan(t, { spinAngle: fanAngle(t), on: t < FAN_OFF ? 1 : 0 });
  Hs.drawDoor(t, { open: doorOpen(t), bolt: boltShut(t) });
  Hs.drawTable(t);
  if (t > PUT.b && t < T.c3) Hs.mug(MUG_SILL[0], MUG_SILL[1], 1, 0, t);        // on the sill
  Hs.drawCellar(t, { bottleTaken: t > A.L4w4 && t < T.c6 });
  // on the crate: the first-aid kit, the iodine (unless in his hand), the radio
  Hs.firstAidKit(KIT.x, KIT.y, KIT.k, 0);
  if (!(hn.o?.prop?.kind === 'iodine')) Hs.iodineBottle(IOD.x, IOD.y, 0, 1.3);
  Hs.radio(RADIO.x, RADIO.y, RADIO.k, radioOn(t), t);
  Hs.drawLadder(t);
  if (hn.o) hunterDraw(t, hn.o);
  Hs.drawFloor(t, { hatch: hatchOpen(t) });
}
function outsideFrame(t, cam) {
  farland(t, cam, FAR_OUT);
  view(cam, 1);
  Hs.drawFacade(t, { light: 0.3, open: winOpen(t) });
  Hs.wind(t, -2000, 2000, -2400, 0, 20, 2.4);
  Hs.dust(t, T.c2 - 0.6, -2000, 2000, -2600, 120, 70, 2.4, 1000);
}

function overlays(t, cam, hn) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  // «Не надо»: the cross on him at the door
  if (t >= T.nope - 0.05 && t < T.c2) { const F0 = framesOf(hn.o), b = S2(F0.T.p([0, -150])); O.redX(b[0], b[1], 110, sp(t, T.nope + 0.03, 2.6, 8)); }
  // the dose from the wind outside to the cellar
  if (t >= T.c2 + 0.1 && t < A.L3e + 0.5) {
    const k = sp(t, T.c2 + 0.1, 2.4, 7) * (1 - seg(A.L3e + 0.1, A.L3e + 0.5, t, ease.in));
    O.doseHud(t, 880, 520, k, dose(t), ledAt(t));
  }
  // step 1: a tick at each thing as it shuts; in the room, all four
  if (t >= T.c3 && t < T.c4) {
    const items = [[Hs.WIN.x + Hs.WIN.w / 2 + 60, Hs.WIN.y - Hs.WIN.h / 2, A.L2w2 + 0.05], [Hs.DOOR.x + 40, Hs.DOOR.top + 120, A.L2w3 + 0.32],
      [Hs.STOVE.x + 90, Hs.STOVE.mouth[2] - 80, A.L2w6 + 0.12], [Hs.FAN.x - 110, Hs.FAN.y, FAN_OFF + 0.05]];
    const out = 1 - seg(T.c4 - 0.15, T.c4, t);
    for (const [x, y, t0] of items) { const p = S2([x, y]); O.tick(p[0], p[1], sp(t, t0, 2.6, 8) * out, t >= T.cr ? 46 : 60); }
  }
  // step 2: walls between you and the dust
  if (t >= T.c4 && t < T.c5) {
    const k = sp(t, A.L3w12 - 0.1, 2.4, 7) * (1 - seg(A.L3e + 0.05, A.L3e + 0.35, t, ease.in));
    O.shieldCard(t, 540, 760, k, seg(A.L3w13 - 0.1, A.L3w15 + 0.2, t, u => u));
  }
  // step 3: the tap no, bottles yes, jars yes, the fridge yes
  if (t >= T.c5 && t < T.c6) {
    const out = 1 - seg(T.c6 - 0.15, T.c6, t);
    const kt = sp(t, A.L4w3 - 0.1, 2.4, 7) * (1 - seg(A.L4w5 + 0.3, A.L4w5 + 0.6, t, ease.in));
    O.tapInset(t, 300, 760, 170, kt); O.redX(300, 760, 90, sp(t, A.L4w3 + 0.1, 2.6, 8) * (1 - seg(A.L4w5 + 0.3, A.L4w5 + 0.6, t)));
    const pb = S2([400, CFLOOR - 200]); O.tick(pb[0], pb[1], sp(t, A.L4w5 + 0.05, 2.6, 8) * out, 56);
    for (const s of Hs.SHELVES) { const p = S2([s.x1 + 10, s.y - 60]); O.tick(p[0], p[1], sp(t, A.L4w10 + (s.y > 300 ? 0.12 : 0), 2.6, 8) * out, 50); }
    const kf = sp(t, A.L4w12 - 0.1, 2.4, 7) * out;
    O.fridgeInset(t, 300, 760, 170, kf); O.tick(400, 860, sp(t, A.L4w12 + 0.25, 2.6, 8) * out, 56);
  }
  // step 4: the cross on the iodine; the tablets only on a signal; they guard only the thyroid
  if (t >= T.c6 && t < T.c7) {
    if (hn.o?.prop?.kind === 'iodine') { const p = S2(hn.o.prop.p); O.redX(p[0], p[1] - 40, 90, sp(t, T.iodX, 2.6, 8) * (1 - seg(A.L5w6, A.L5w7, t))); }
    const kp = sp(t, A.L5w7 - 0.1, 2.4, 7) * (1 - seg(A.L5w16 - 0.25, A.L5w16, t, ease.in));
    O.pillsCard(t, 540, 720, kp);
    const kth = sp(t, A.L5w16 - 0.1, 2.4, 7) * (1 - seg(A.L5e + 0.05, A.L5e + 0.35, t, ease.in));
    O.thyroidInset(t, 540, 720, 220, kth);
  }
  // step 5: a whole day
  if (t >= T.c7 && t < A.L7) {
    const k = sp(t, A.L6w6 - 0.1, 2.4, 7) * (1 - seg(A.L6e + 0.05, A.L6e + 0.35, t, ease.in));
    O.clockCard(t, A.L6w6, 290, 640, k);
  }
}
function stepHeaders(t) {
  O.stepHeader(t, 1, 'ЗАКРОЙ ВСЁ', A.L2 + 0.02, A.L2e - 0.05);
  O.stepHeader(t, 2, 'В ПОГРЕБ', A.L3 + 0.02, A.L3e - 0.05);
  O.stepHeader(t, 3, 'ВОДА И ЕДА', A.L4 + 0.02, A.L4e - 0.05);
  O.stepHeader(t, 4, 'НЕ ПЕЙ ЙОД', A.L5 + 0.02, A.L5e - 0.05);
  O.stepHeader(t, 5, 'ЖДИ СУТКИ', A.L6 + 0.02, A.L6e - 0.05);
}

// «Что делать, если рядом взорвалась атомная станция, а ты дома?»: a title word by word
function questionTitle(t) {
  const k1 = sp(t, A.L0w0 - 0.05, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w7 - 0.05, 2.4, 7);
  const out = seg(A.L1 - 0.15, A.L1 + 0.1, t);
  if (k1 > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 540, 300); g.scale(k1 * (1 - out), k1 * (1 - out)); g.rotate(-0.03); text('ЧТО ДЕЛАТЬ,', 0, 0, 120, '#fff3d6'); g.restore(); }
  const plaque = (y, str, k, size, c = '#ffd23f') => {
    if (k <= 0.01) return;
    const w = measure(str, size, FONTS.cond) + 70, h = size * 1.45;
    g.save(); g.setTransform(1, 0, 0, 1, 540, y); g.rotate(-0.03); g.scale(k * (1 - out), k * (1 - out));
    rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, c);
    text(str, 0, size * 0.36, size, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  };
  plaque(440, 'ЕСЛИ РЯДОМ ВЗОРВАЛАСЬ АЭС,', k2, 72);
  plaque(560, 'А ТЫ ДОМА?', k3, 80, '#ff7a4d');
}

// —— the cover: his face lit by the flash, the window with the fireball; the words ——
function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
function coverFrame(t) {
  const tb = T.boom + 0.9;                       // what the explosion looks like a moment after the flash
  const cam = { x: -250, y: -540, z: 1.6, lens: 1, ty: 0, dx: 0, dy: 0, r: 0 };
  farland(T.boom + 0.3, cam, { off: farOff(cam, toScreen(cam, [Hs.WIN.x + 20, Hs.WIN.y + 110])), s: 0.5, boom: { k: 1.15, rise: 700, drift: 700 } });
  view(cam, 1); Hs.drawRoomBack(tb); Hs.drawWindow(tb, { open: 1 }); Hs.drawTable(tb);
  g.setTransform(1, 0, 0, 1, 0, 0); rect(0, 0, W, H, 'rgba(255,190,110,0.16)');
  const o = base(t, { s: 1.9, face: -1, pop: 1, brow: 1, mouth: 0.75, look: [-0.9, -0.2], hatJump: 30, blink: 0, lean: -0.15, headTilt: -0.1 });
  o.hip = [730, 2150]; o.feet = { near: [700, 2700], far: [760, 2700] };
  const F0 = framesOf(o), sh = F0.T.p([-14, -192]);
  o.hands = { near: { p: [sh[0] - 150, sh[1] - 80], shape: 'open' }, far: { p: [sh[0] + 60, sh[1] - 120], shape: 'open' } };
  drawHunter(o);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ВЗРЫВ НА АЭС', 540, 380, 150, 980, '#ffd23f', { rot: -0.03 });
  fitText('А ТЫ ДОМА?', 540, 530, 120, 900, '#fff3d6', { rot: -0.03 });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), hn = hunterAt(tt), o = hn.o;
    const out = o ? [o.hip, o.feet.near, o.feet.far, [o.hip[0], o.hip[1] - 200 * S]].map(p => toScreen(cam, p)) : [];
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
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
  for (const w of ['L0w0', 'L0w2', 'L0w7']) add(A[w] - 0.03, 'pop_word', -8, 0);
  add(0.3, 'birds', -14, -0.2, { dur: T.boom - 0.3 });
  add(T.boom, 'boom', -2, 0.3);
  add(T.boom + 0.05, 'rattle', -8, -0.2, { dur: 1.2 });
  add(T.boom + 0.1, 'splash_small', -12, -0.1);
  add(A.L1w3 - 0.3, 'phone_beep', -12, 0.1);
  for (const f of ['near', 'far']) for (const p of PL[f]) add(p.t, 'step', -12, f === 'near' ? 0.05 : -0.05);
  add(A.L1w8 - 0.1, 'creak', -10, 0.3);
  add(T.nope + 0.03, 'stamp', -2, 0);
  add(T.c2 - 0.05, 'whoosh', -10, 0);
  add(T.c2, 'wind', -10, 0, { dur: T.c3 - T.c2 + 0.3 });
  // the dosimeter from the wind outside to the cellar
  const rate = [[0, 0], [T.c2 - 0.01, 0], [T.c2, 3], [A.L2, 22], [A.L3w1, 22], [A.L3w8, 8], [A.L3w15 + 0.3, 3], [A.L3e + 0.4, 0]];
  add(T.c2, 'geiger', -8, 0.15, { dur: A.L3e - T.c2 + 0.5, rate });
  add(A.L2w2 - 0.05, 'window_slam', -6, -0.2);
  add(T.cd + 0.08, 'slam', -4, 0.2);
  add(A.L2w3 + 0.25, 'bolt', -6, 0.2);
  add(A.L2w6 + 0.08, 'clank', -6, -0.2);
  add(FAN_OFF, 'switch', -8, 0.1);
  add(T.cf - 0.4, 'fan', -14, 0.1, { dur: FAN_OFF - T.cf + 1.6, off: FAN_OFF - T.cf + 0.4 });
  for (const t0 of [A.L2w2 + 0.05, A.L2w3 + 0.32, A.L2w6 + 0.12, FAN_OFF + 0.05]) add(t0, 'ding', -10, 0.2);
  add(A.L2w9, 'ticks', -14, -0.2, { dur: A.L2e - A.L2w9 });
  add(A.L3w1 - 0.1, 'hatch', -6, 0);
  for (let i = 0; i < 6; i++) add(lerp(DESC.t0, DESC.t1, (i + 0.5) / 6), 'ladder', -10, 0);
  add(A.L3w12 - 0.1, 'whoosh_in', -12, 0.2);
  add(A.L3w13, 'thud', -10, 0); add(A.L3w14, 'thud', -12, 0); add(A.L3w15, 'thud', -14, 0);
  add(A.L4w3 + 0.1, 'stamp', -4, -0.1);
  add(A.L4w5 - 0.05, 'slosh', -8, 0.2);
  add(A.L4w5 + 0.05, 'ding', -10, 0.2);
  add(A.L4w10, 'jar', -8, 0.2); add(A.L4w10 + 0.12, 'jar', -10, 0.25);
  add(A.L4w12 + 0.25, 'ding', -10, 0);
  add(A.L5w1 + 0.05, 'clink', -10, -0.2);
  add(T.iodX, 'stamp', -2, -0.1);
  add(A.L5w6 + 0.1, 'clink', -12, -0.2);
  add(A.L5w7 - 0.1, 'whoosh_in', -12, 0);
  add(A.L5w8, 'pills', -10, 0);
  add(A.L5w16 - 0.1, 'whoosh_in', -12, 0);
  add(A.L6w1 + 0.05, 'switch', -8, -0.2);
  add(A.L6w1 + 0.1, 'radio', -14, -0.2, { dur: DUR - A.L6w1 });
  add(A.L6w4, 'creak', -12, 0);
  add(A.L6w6 - 0.1, 'clock', -10, 0, { dur: 1.7 });
  for (const t0 of [A.L2, A.L3, A.L4, A.L5, A.L6]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
