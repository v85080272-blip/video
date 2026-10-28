// «Подлодка, отказала вся электроника»: the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py): another take moves the picture with it (STORYBOARD.md).
// Three worlds: the sea with the whole boat in it (sea.js; the boat also turns into its blueprint, subbp.js), the
// compartment inside (hull.js), and the swimmer's sea, life size, from the escape hatch to the surface.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Se from './sea.js';
import * as Hu from './hull.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawBP } from './subbp.js';
import { drawHunter, framesOf, HUN } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without a voice yet: [start, end, words] of each line, words spread evenly
const FB = { L0: [0.12, 4.6, 12], L1: [4.95, 10.4, 15], L2: [10.8, 16.6, 15], L3: [17.05, 21.0, 11], L4: [21.4, 25.6, 12], L5: [26.0, 32.0, 16], L6: [32.4, 39.4, 18], L7: [39.85, 43.6, 12] };
export const DUR = VOICE?.dur ?? 44.0;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ОТКАЗАЛА: DANGER, ВОЗДУХА: GOLD, ВСТАЛИ: DANGER, УГЛЕКИСЛОГО: DANGER, БАЛЛАСТ: GOLD, ВСПЛЫВЁТ: OK, ВРУЧНУЮ: GOLD, ВСПЛЫЛА: DANGER,
  ЛОЖИСЬ: GOLD, ДВИГАЙСЯ: GOLD, ПОРОШОК: GOLD, СЪЕДАЕТ: OK, ПОЛЧАСА: GOLD, СТУЧИ: GOLD, СЛУШАЮТ: OK, НЕБОЛЬШАЯ: GOLD, ЛЮК: GOLD, ВЫДЫХАЙ: OK,
  ЛЁГКИЕ: DANGER, ПОДПИСЫВАЙСЯ: GOLD, РИСКНУЛ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  dark: A.L0w4 - 0.04,               // «отказала»: the lights die, the screw stops
  scan: A.L0w11 - 0.12,              // «воздуха»: the boat turns into its blueprint
  stop: A.L1w4 - 0.05,               // «встали»: the scrubber stops, the chain goes dark
  co2: A.L1w7 - 0.1,                 // «с каждым часом»: CO₂ fills the hull
  c2: A.L2 - 0.06,                   // step 1: the blow wheel
  bpb: A.L2w3 - 0.08,                // «Сжатый воздух»: the blueprint, air to the tanks
  blow: A.L2w5 - 0.05,               // «выдавит воду»: the water goes out
  rise: A.L2w10 - 0.05,              // «лодка всплывёт»
  close: A.L2w12 - 0.08,             // «Клапан открывают вручную»: the wheel close up
  c3: A.L3 - 0.06,                   // step 2: the boat on the bottom
  bunk: A.L3w5 - 0.08,               // «береги воздух»: the bunk
  lie: A.L3w7 - 0.05,                // «Ложись»
  c4: A.L4 - 0.06,                   // the powder
  pour: A.L4w5 - 0.08,               // «рассыпь»
  eat: A.L4w8 - 0.05,                // «он съедает»
  c5: A.L5 - 0.06,                   // step 3: knocking
  knock: A.L5w6 - 0.08,              // «стучи»
  up: A.L5w9 - 0.08,                 // «В это время…»: outside, the knocks rise to the ship
  c6: A.L6 - 0.06,                   // «А если глубина небольшая»: the whole water column
  hatch: A.L6w4 - 0.08,              // «выходи через спасательный люк»: up the ladder
  open: A.L6w7 - 0.15,               // «люк»: the hatch opens
  swim: A.L6w8 - 0.08,               // «Всплывая без аппарата»: the swim up
  exhale: A.L6w13 - 0.05,            // «выдыхай»
  lungs: A.L6w14 - 0.05,             // «иначе воздух порвёт лёгкие»
  c7: A.L7 - 0.06,                   // the surface
  ask: A.L7w5 - 0.08,                // «А ты бы рискнул…»
};
T.surf = T.c7 - 0.15;                // his head breaks the surface
export const CUTS = [T.cover, T.c2, T.bpb, T.close, T.c3, T.bunk, T.c4, T.c5, T.up, T.hatch, T.swim];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const SCENES = [[0, 'cover'], [T.cover, 'ext'], [T.scan, 'bp'], [T.c2, 'int'], [T.bpb, 'bp'], [T.close, 'int'], [T.c3, 'ext'], [T.bunk, 'int'], [T.up, 'ext'], [T.hatch, 'int'], [T.swim, 'swim']];
const scene = t => { let s = 'cover'; for (const [t0, n] of SCENES) if (t >= t0) s = n; return s; };
const WIPE = 0.55;                   // the exterior-to-blueprint wipe

// —— the boat in the sea: cruising, then dead in the water and sinking a little; later on the bottom ——
const subAx = t => -420 + 120 * Math.min(t, T.dark) + (t > T.dark ? 120 * (1 - Math.exp(-(t - T.dark) * 0.9)) / 0.9 : 0);
const subAy = t => -1150 + 70 * seg(T.dark + 0.2, T.scan + WIPE, t);
const subAang = t => 0.03 * seg(T.dark, T.scan, t) * (1 - seg(T.scan, T.scan + WIPE, t));
const lightsA = t => (t < T.dark ? 1 : t < T.dark + 0.4 ? (hash(Math.floor(t * 30)) > 0.45 ? 0.8 : 0.05) * (1 - seg(T.dark, T.dark + 0.4, t)) : 0);
const spinA = t => (t < T.dark ? t * 9 : T.dark * 9 + 9 * (1 - Math.exp(-(t - T.dark) * 1.3)) / 1.3);
const BP0 = [subAx(T.scan + WIPE), subAy(T.scan + WIPE)];
const BED = { x: 0, y: -600, ang: 0.045 };
const KNOCK = (() => { const k = []; for (let i = 0; i < 9; i++) k.push(T.knock + i * 0.36); return k; })();
const RING0 = [BED.x + 60, BED.y - 160];
const lampW = t => { const a = subAang(t), c = Math.cos(a), s = Math.sin(a), [lx, ly] = Se.SUBG.lamp; return [subAx(t) + lx * c - ly * s, subAy(t) + lx * s + ly * c]; };

// —— the camera: per shot, Hermite keys [t, x, y, z] ——
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
const shot = (t0, keys) => SHOTS.push({ t0, keys });
{
  const a = t => [subAx(t), subAy(t)];
  const [x0, y0] = a(T.cover), [x1, y1] = a(T.dark), [x2, y2] = a(A.L0w7), [x3, y3] = BP0;
  shot(T.cover, [[T.cover, x0 + 900, y0 - 60, 1.15], [T.dark, x1 + 820, y1 - 90, 1.02], [A.L0w7, x2 + 120, y2 + 40, 0.52], [T.scan, x3, y3 + 70, 0.48]]);
  shot(T.scan, [[T.scan, x3, y3 + 70, 0.48], [T.scan + WIPE, x3, y3 + 70, 0.48], [T.stop - 0.25, x3 - 60, y3 + 40, 0.62], [T.stop + 0.15, x3 - 150, y3 - 20, 1.25], [T.co2 + 0.1, x3 - 130, y3 - 10, 1.2],
    [T.co2 + 0.9, x3 - 40, y3 + 80, 0.5], [T.c2, x3 - 20, y3 + 70, 0.52]]);
}
shot(T.c2, [[T.c2, -330, -250, 1.62], [T.bpb, -345, -250, 1.78]]);
shot(T.bpb, [[T.bpb, BP0[0] + 470, BP0[1] - 10, 0.95], [T.rise - 0.15, BP0[0] + 430, BP0[1] - 30, 1.02], [T.rise + 0.7, BP0[0] + 120, BP0[1] - 230, 0.55], [T.close, BP0[0] + 100, BP0[1] - 280, 0.53]]);
shot(T.close, [[T.close, -395, -195, 2.45], [T.c3, -400, -190, 2.65]]);
shot(T.c3, [[T.c3, 420, -720, 0.62], [T.bunk, 40, -700, 0.5]]);
shot(T.bunk, [[T.bunk, 790, -250, 1.75], [T.c4, 780, -245, 1.88]]);
shot(T.c4, [[T.c4, 120, -235, 1.5], [T.pour, 90, -225, 1.55], [T.c5, 10, -215, 1.62]]);
shot(T.c5, [[T.c5, 300, -250, 1.45], [T.knock, 330, -255, 1.62], [T.up, 350, -258, 1.7]]);
shot(T.up, [[T.up, 40, -820, 0.56], [T.up + 0.3, 40, -930, 0.56], [T.up + 1.5, -280, -2560, 0.62], [T.c6, -300, -2540, 0.64], [T.c6 + 0.9, 0, -780, 0.3], [T.hatch, 0, -790, 0.3]]);
shot(T.hatch, [[T.hatch, 1360, -330, 1.3], [T.open, 1380, -480, 1.25], [T.swim, 1390, -560, 1.2]]);
export function camAt(t) {
  if (scene(t) === 'swim') return swimCam(t);
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const t0 of [T.dark, T.stop, T.bpb + 0.2, ...KNOCK.slice(0, 6), T.open]) if (t >= t0 && t < t0 + 0.45) { const e = Math.exp(-(t - t0) * 9); dx += 9 * e * noise(t * 40, 1); dy += 9 * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the swim up (the swimmer's world): he rises from the hatch to the surface, the camera rides with him ——
const SW = Se.SWIMW;
const HIP0 = -250, HIP1 = SW.surf + 120;
const riseCurve = u => (u < 0.2 ? 2.5 * u * u : u < 0.85 ? 0.1 + (u - 0.2) * 1.2 : 1 - 0.12 * Math.pow((1 - u) / 0.15, 2));
const hipY = t => (t < T.surf ? lerp(HIP0, HIP1, riseCurve(clamp((t - T.swim) / (T.surf - T.swim))))
  : HIP1 + 6 * Math.sin((t - T.surf) * 2.2) - 30 * Math.exp(-(t - T.surf) * 4) * Math.sin((t - T.surf) * 9));
function swimCam(t) {
  const y = hipY(t), atSurf = seg(T.surf - 0.4, T.surf + 0.3, t);
  const z = lerp(lerp(1.15, 1.35, seg(T.swim, T.swim + 2, t)), 1.2, atSurf), cy = lerp(y + 90, SW.surf + 140, atSurf);
  const dive = seg(DUR - 0.75, DUR, t, ease.in);           // the loop: the camera sinks back into the deep
  return { x: lerp(-60, 0, atSurf) + 20 * Math.sin(t * 0.5), y: cy + 1500 * dive, z: z - 0.3 * dive, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0.02 * Math.sin(t * 0.7) * atSurf };
}

// —— the hunter and the dog: who stands where in each shot and what they do ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, jacket: false, pack: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function steps(o, x0, x1, t0, t1, t) {
  const u = seg(t0, t1, t), x = lerp(x0, x1, u), n = 3, ph = clamp((t - t0) / (t1 - t0)) * n, i = Math.floor(ph), f = ph - i, dir = Math.sign(x1 - x0);
  stand(o, x);
  if (t > t0 && t < t1) {
    const lift = 22 * Math.sin(Math.PI * f), sw = 26 * dir * (f - 0.5);
    if (i % 2 === 0) o.feet.near = [o.feet.near[0] + sw, -lift]; else o.feet.far = [o.feet.far[0] + sw, -lift];
    o.hip[1] -= 8 * Math.sin(Math.PI * f);
  }
  return o;
}
const shoulder = o => framesOf(o).T.p([-14, -192]);
// the wheel: strokes of 0.7 rad, the hands ride the rim and then take a new grip
const STROKE = 0.62, TURN = 0.7;
const wheelT0 = () => A.L2w1 - 0.12;
function wheelState(t) {
  const u = Math.max(0, t - wheelT0()), n = Math.floor(u / STROKE), f = (u % STROKE) / STROKE;
  const ride = f < 0.75 ? ease.inOut(f / 0.75) : 1 - ease.inOut((f - 0.75) / 0.25);
  return { ang: TURN * (n + (f < 0.75 ? ease.inOut(f / 0.75) : 1)), ride: t < wheelT0() ? 0 : ride };
}
const airLeft = t => 1 - seg(T.bpb + 0.1, T.rise + 0.6, t);
const co2At = t => (t < T.co2 ? 0.1 : t < T.c2 ? lerp(0.1, 0.85, seg(T.co2, A.L1e, t, u => u)) : t < T.eat ? 0.85 : lerp(0.85, 0.42, seg(T.eat, T.eat + 1.6, t, ease.out)));
const takenAt = t => (t > A.L4w2 ? 1 : 0);
// the can held low in front while pouring, and where its mouth is (the can is drawn 60 below the hand, turned by tilt)
const canHand = o => { const sh = shoulder(o); return [sh[0] - 70, sh[1] + 60]; };
const canMouth = (p, tilt) => [p[0] + 97.5 * Math.sin(tilt), p[1] + 60 - 97.5 * Math.cos(tilt)];
const pourX = t => { const o = steps(base(t, { face: -1, lean: 0.2 }), 150, -40, T.pour + 0.1, A.L4w8 + 0.2, t); return canMouth(canHand(o), -2.1)[0] - 10; };
const knockAt = t => { let best = -1e9; for (const k of KNOCK) if (t >= k) best = k; return t - best; };   // seconds since the last knock

export function actorsAt(t) {
  const sc = scene(t);
  // —— the blow wheel: he turns it, the dog lights it ——
  if (sc === 'int' && t < T.c3) {
    const o = stand(base(t, { lean: 0.2, look: [-0.7, 0.3], brow: -0.5, mouth: 0.15 + 0.1 * Math.abs(Math.sin(t * 6)), headTilt: 0.08 }), -318);
    const ws = wheelState(t), c = Hu.WHEEL, r = Hu.WHEEL_R;
    const a1 = -0.6 + 0.7 * ws.ride, a2 = 0.4 + 0.55 * ws.ride;
    o.hands = { near: { p: [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r], shape: 'grip' }, far: { p: [c[0] + Math.cos(a2) * r, c[1] + Math.sin(a2) * r], shape: 'grip' } };
    if (t > T.close + 0.4) { o.brow = 0.2; o.mouth = 0.1; }
    const d = { x: -110, y: 0, s: DS, face: -1, sit: 1, torch: true, look: 0.15, tilt: 0.04 * Math.sin(t * 2), t, blink: dblink(t), ears: 0.2 };
    return { h: o, d, wheel: ws.ang };
  }
  // —— the bunk: he lies under the blanket, the dog lies on the floor and lights him ——
  if (sc === 'int' && t < T.c4) {
    const k = seg(T.lie - 0.1, T.lie + 0.5, t), breathe = Math.sin((t - T.bunk) * lerp(5.5, 2.4, k));
    const o = stand(base(t, { face: -1, lean: 0, headTilt: -0.12, look: [0.2, -1], brow: lerp(0.3, -0.1, k), lid: lerp(0.3, 0.75, k), mouth: lerp(0.25 + 0.15 * Math.max(0, breathe), 0, k), blink: k > 0.9 ? 0 : blinkAt(t) }), 0);
    o.hands = { near: { p: [-70, -260], shape: 'fist' }, far: { p: [-60, -230], shape: 'fist' } };
    o.lying = { x: 640, y: -238, breathe };
    const d = { x: 540, y: 0, s: DS, face: 1, lying: true, torch: true, look: 0.45, headDy: 20, t, blink: lerp(dblink(t), 0.6, k), ears: 0.4 * k };
    return { h: o, d, blanket: k };
  }
  // —— the powder: a can from the locker's lower shelf, poured along the deck as he walks ——
  if (sc === 'int' && t < T.c5) {
    let o;
    if (t < T.pour) {
      o = stand(base(t, { face: 1, lean: 0.18, look: [0.6, 0.4], brow: 0.2 }), 70);
      const sh = shoulder(o), reach = seg(T.c4 + 0.1, A.L4w2, t) * (1 - seg(A.L4w2 + 0.05, A.L4w4, t));
      o.hands = { near: { p: [lerp(sh[0] + 30, 172, reach), lerp(sh[1] + 90, -292, reach)], shape: 'grip' }, far: { p: [sh[0] + 14, sh[1] + 100], shape: 'fist' } };
      if (t > A.L4w2) o.prop = { kind: 'can', p: o.hands.near.p, tilt: 0 };
    } else {
      o = steps(base(t, { face: -1, lean: 0.2, look: [-0.5, 0.6], brow: 0.2 }), 150, -40, T.pour + 0.1, A.L4w8 + 0.2, t);
      const p = canHand(o), k = seg(T.pour - 0.05, T.pour + 0.3, t);
      o.prop = { kind: 'can', p, tilt: -2.1 * k, open: true };
      o.hands = { near: { p, shape: 'grip' }, far: { p: [p[0] + 30, p[1] - 30], shape: 'grip' } };
      if (t > T.eat + 0.3) { o.look = [-0.6, -0.4]; o.brow = 0.5; o.mouth = 0.2; }
    }
    const d = { x: 380, y: 0, s: DS, face: -1, sit: 1, torch: true, look: -0.3, tilt: 0.05 * Math.sin(t * 2.4), t, blink: dblink(t), wag: t > T.eat ? 1 : 0, wagPh: t * 2.4 };
    return { h: o, d };
  }
  // —— knocking on the hull with a wrench in the far hand (wound up behind his head), the dog's ears go back on every knock ——
  if (sc === 'int' && t < T.up) {
    const o = stand(base(t, { face: 1, lean: 0.08, look: [0.6, 0.1], brow: 0.1 }), 300);
    const sh = shoulder(o), since = knockAt(t), hit = t >= T.knock ? 1 - ease.out(clamp(since / 0.3)) : 0;
    const lift = t < T.knock ? seg(T.knock - 0.5, T.knock - 0.15, t) : since < 0.06 ? 0 : 1 - hit;
    const p = [lerp(345, sh[0] - 20, lift), lerp(-200, sh[1] - 110, lift)];
    o.hands = { far: { p, shape: 'grip' }, near: { p: [sh[0] + 30, sh[1] + 100], shape: 'fist' } };
    o.prop = { kind: 'wrench', p, ang: lerp(1.25, -0.4, lift) };
    if (t < T.knock - 0.5) { o.look = [-0.2, -0.8]; o.headTilt = 0.18; o.brow = 0.4; o.hands.far = { p: [sh[0] + 20, sh[1] + 100], shape: 'grip' }; o.prop.p = o.hands.far.p; o.prop.ang = 2.6; }
    if (t >= T.knock) { o.brow = -0.4; o.mouth = 0.1 + 0.25 * hit; }
    const flinch = t >= T.knock ? Math.exp(-since * 6) : 0;
    const d = { x: 90, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.25, t, blink: flinch > 0.6 ? 1 : dblink(t), ears: flinch, tilt: 0.06 * flinch };
    return { h: o, d };
  }
  // —— up the ladder in the jacket and the vest; the dog waits at the foot, in her vest too ——
  if (sc === 'int') {
    const climb = Math.max(0, t - T.hatch - 0.1) * 2.6, f = climb % 1, n = Math.floor(climb), RUNG = 86;
    const o = base(t, { face: 1, jacket: true, vest: true, lean: 0.02, look: [0.5, -1], brow: 0.3, headTilt: -0.2 });
    const x = Hu.LADDER.x - 70;
    o.hip = [x, -LEG - RUNG * climb + 8 * Math.sin(Math.PI * f)];
    const up = RUNG * 0.5 * (1 - Math.cos(Math.PI * f));
    o.feet = n % 2 === 0 ? { near: [x + 20, -n * RUNG - up], far: [x + 34, -n * RUNG] } : { near: [x + 20, -n * RUNG], far: [x + 34, -n * RUNG - up] };
    const hy = o.hip[1] - 330;
    o.hands = { near: { p: [Hu.LADDER.x - 40, hy + 120 - (n % 2 ? up * 0.4 : 0)], shape: 'grip' }, far: { p: [Hu.LADDER.x - 22, hy - (n % 2 ? 0 : up * 0.5)], shape: 'grip' } };
    const d = { x: 1230, y: 0, s: DS, face: 1, sit: 1, vest: true, torch: true, look: 1, t, blink: dblink(t), wag: 1, wagPh: t * 2.6, ears: 0.1 };
    return { h: o, d };
  }
  // —— the swim up and the surface ——
  if (sc === 'swim') {
    const at = t > T.surf, k = (t - T.swim) * 2.4, up = at ? clamp(sp(t, A.L7 + 0.05, 2.4, 7)) : 0;
    const y = hipY(t) - 25 * up;                     // «Подписывайся»: he bobs up in his vest for the thumbs up
    const o = base(t, { face: 1, jacket: true, vest: true, lean: at ? 0.02 : -0.04, headTilt: at ? 0.05 : -0.25, look: at ? [0.7, -0.1] : [0.4, -1], brow: at ? 0.5 : 0.2, mouth: at ? 0.3 : 0.32 });
    o.hip = [0, y];
    o.feet = { near: [-14 + 14 * Math.sin(k * 3), y + LEG + 6 * Math.cos(k * 3)], far: [18 - 14 * Math.sin(k * 3), y + LEG - 4] };
    const sh = shoulder(o);
    o.hands = at ? { near: { p: [sh[0] + 120, sh[1] + 50], shape: 'open' }, far: { p: [sh[0] + 60, sh[1] + 70], shape: 'open' } }
      : { near: { p: [sh[0] + 30, sh[1] - 170], shape: 'open' }, far: { p: [sh[0] + 40, sh[1] + 90 + 20 * Math.sin(k * 2)], shape: 'open' } };
    if (at && t > A.L7 - 0.05) {                    // «Подписывайся»: a thumbs up out of the water, under his beard
      o.hands.near = { p: [sh[0] + 110 - 15 * up, sh[1] + 40 - 70 * up], shape: 'thumb', ang: Math.PI, bend: -1 };   // facing right the hand frame is mirrored: π puts the thumb up
      o.mouth = 0.4; o.brow = 0.7;
    }
    const dy = at ? SW.surf + 110 + 6 * Math.sin((t - T.surf) * 2.2 + 1) : y + 60;
    const d = { x: -300, y: dy, s: DS, face: 1, walk: 1, ph: t * (at ? 1.2 : 2.2), rot: at ? 0 : -0.35, vest: true, look: at ? 0.2 : 0.6, mouth: at ? 0.7 : 0, tongue: at ? 0.8 : 0, t, blink: dblink(t), wag: at ? 1 : 0, wagPh: t * 3 };
    return { h: o, d, bubbles: !at || t < T.surf + 0.2 };
  }
  return { h: null, d: null };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'can') o.propNear = () => Hu.can(p.p[0], p.p[1] + 60, 0.75, p.tilt, p.open);
  if (p?.kind === 'wrench') o.propFar = () => wrench(p.p[0], p.p[1], p.ang);
  if (o.vest) o.faceProp = A2 => lifeVest(A2.T, o.s ?? S);
  if (o.lying) {
    const { x, y } = o.lying;
    g.save(); g.translate(x, y); g.rotate(Math.PI / 2);
    const A2 = drawHunter(o);
    g.restore();
    return A2;
  }
  return drawHunter(o);
}
function wrench(x, y, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  limb([[0, 0], [0, -110]], 22, '#9aa6b8', false); limb([[-6, 0], [-6, -100]], 6, '#c7d0dc', false);
  g.lineWidth = 22; g.strokeStyle = '#9aa6b8'; g.beginPath(); g.arc(0, -128, 26, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  limb([[0, 10], [0, 50]], 26, '#c23b2f', false);
  g.restore();
}
// the life vest on his chest and back (drawn after the head, before the near arm)
function lifeVest(T2, s) {
  fill(smoothPath(T2.pts([[-74, -60], [-80, -150], [-58, -200], [-22, -206], [-12, -150], [-14, -60]])), '#ffd23f');
  fill(smoothPath(T2.pts([[18, -204], [60, -192], [76, -80], [34, -70]])), '#e0a91f');
  limb(T2.pts([[-76, -110], [74, -120]]), 12 * s, '#24232f', false);
  const b = T2.p([-48, -114]); rrect(b[0] - 12 * s, b[1] - 9 * s, 24 * s, 18 * s, 4 * s, '#c7d0dc');
  limb(T2.pts([[-60, -170], [-30, -176]]), 8 * s, '#ffffff', false);
}
// the dog lying on the deck: drawn standing, sunk to her belly, the deck in front hides the legs
function dogDraw(d) {
  if (!d.lying) return drawDog(d);
  const r = drawDog({ ...d, y: d.y + 92 * d.s });
  rect(d.x - 220 * d.s, Hu.DECK, 440 * d.s, 140, '#0f131b'); rect(d.x - 220 * d.s, Hu.DECK, 440 * d.s, 34, '#4b5568'); rect(d.x - 220 * d.s, Hu.DECK, 440 * d.s, 7, '#64708a');
  return r;
}

// —— darkness with holes where the lamps, the torch and the hatch light it ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
function lighting(t, cam, lights, amount = 0.86) {
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(4,7,17,${amount})`; dk.fillRect(0, 0, W, H);
  dk.globalCompositeOperation = 'destination-out';
  const z = scaleOf(cam), shapes = [];
  for (const L of lights) {
    const [x, y] = toScreen(cam, L.p), r = L.r * z;
    if (L.cone) {
      const a = L.a, s = L.spread ?? 0.36, gr = dk.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${L.k})`); gr.addColorStop(0.65, `rgba(0,0,0,${L.k * 0.85})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = gr; dk.beginPath(); dk.moveTo(x, y); dk.arc(x, y, r, a - s, a + s); dk.closePath(); dk.fill();
      const g2 = dk.createRadialGradient(x, y, 0, x, y, 70 * z); g2.addColorStop(0, `rgba(0,0,0,${L.k})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = g2; dk.beginPath(); dk.arc(x, y, 70 * z, 0, TAU); dk.fill();
    } else {
      const gr = dk.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${L.k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, r, 0, TAU); dk.fill();
    }
    shapes.push({ x, y, r, L });
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(DK, 0, 0);
  for (const { x, y, r, L } of shapes) {
    if (!L.tint) continue;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(L.tint, (L.ta ?? 0.22) * L.k)); gr.addColorStop(1, rgba(L.tint, 0));
    g.fillStyle = gr; g.beginPath();
    if (L.cone) { g.moveTo(x, y); g.arc(x, y, r, L.a - (L.spread ?? 0.36), L.a + (L.spread ?? 0.36)); g.closePath(); } else g.arc(x, y, r, 0, TAU);
    g.fill();
  }
}

// —— frame ——
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'ext') extFrame(t, cam);
  else if (sc === 'bp') {
    if (t < T.scan + WIPE) wipeFrame(t, cam); else bpFrame(t, cam);
  } else if (sc === 'int') intFrame(t, cam);
  else swimFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'bp' ? 0.6 : 1);
}

// —— the sea with the whole boat ——
const BW = Se.BOATW;
function extFrame(t, cam) {
  Se.water(t, cam, BW);
  Se.rays(t, cam, BW, 0.9);
  Se.snow(t, cam, BW);
  Se.school(t, cam, 0.6, -200 - (t > T.up ? 600 : 0), -1500, 14, { s: 1.1 });
  if (t > T.up) Se.school(t, cam, 0.7, 900, -2200, 10, { dir: 1 });
  view(cam, 1);
  if (t < T.c3) {
    // cruising, then dead in the water
    const L = lightsA(t), st = { x: subAx(t), y: subAy(t), ang: subAang(t), lights: L, spin: spinA(t) };
    const sb = Se.drawSub(t, st);
    Se.beam(t, sb.lamp, sb.beamAng + 0.3, 1, L);
    propWash(t, st);
    Se.seabed(t, cam, BW);
  } else {
    // on the bottom: half sunk in silt, a few bubbles leaking from the vents; the ship far up on the surface
    if (t > T.up) { view(cam, 1); const hp = Se.drawShip(t, 250, BW, 1, 330); hydrophone(t, hp); Se.surface(t, cam, BW); }
    view(cam, 1);
    Se.drawSub(t, { ...BED, lights: 0, spin: 1.3 });
    Se.seabed(t, cam, BW);
    Se.silt(t, BED.x - 200, BED.y + 150, 0.9 + 0.05 * Math.sin(t), 0.55);
    view(cam, 1);
    for (let i = 0; i < 10; i++) { const u = ((t - T.c3) * 0.35 + i / 10) % 1; Se.bubble(BED.x + 860 + 20 * Math.sin(u * 9 + i), BED.y - 40 - u * 900, 8 + 10 * u, bump(u)); }
    if (t > T.up) rings(t, cam);
    if (t > T.c6 - 0.1) depthRuler(t, cam);
  }
}
// bubbles behind the turning screw
function propWash(t, st) {
  const k = t < T.dark ? 1 : Math.exp(-(t - T.dark) * 1.5);
  if (k < 0.02) return;
  for (let i = 0; i < 18; i++) {
    const u = (t * 1.3 + i / 18) % 1, x = st.x - 1060 - u * 600, y = st.y + 60 * (hash(i * 3.3) - 0.5) + 80 * u * (hash(i * 5.1) - 0.5) - 40 * u;
    Se.bubble(x, y, 6 + 10 * u * hash(i), (1 - u) * k);
  }
}
// knock rings rising from the hull; the hydrophone flashes when they reach it
function rings(t, cam) {
  view(cam, 1);
  for (const k of KNOCK) {
    const age = t - k;
    if (age <= 0 || age > 1.8) continue;
    const r = 1700 * age, a = (1 - age / 1.8) * 0.8;
    g.lineWidth = (10 + 20 * (1 - age / 1.8)) / scaleOf(cam) * 0.6; g.strokeStyle = rgba('#bfefff', a);
    g.beginPath(); g.arc(RING0[0], RING0[1], r, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  }
}
let HP = [0, 0];
function hydrophone(t, hp) {
  HP = hp;
  const d = Math.hypot(hp[0] - RING0[0], hp[1] - RING0[1]) / 1700;
  let glow = 0;
  for (const k of KNOCK) { const a = t - k - d; if (a > 0 && a < 0.4) glow = Math.max(glow, 1 - a / 0.4); }
  if (glow > 0) { ell(hp[0], hp[1], 70 * glow + 30, 70 * glow + 30, rgba('#7dffb2', 0.35 * glow)); ell(hp[0], hp[1], 22, 22, rgba('#7dffb2', glow)); }
}
// the water column with a depth scale on the left: 0 m at the surface, 50 m at the bottom
function depthRuler(t, cam) {
  const a = seg(T.c6 + 0.3, T.c6 + 0.8, t) * (1 - seg(T.hatch - 0.15, T.hatch, t));
  if (a <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  const top = toScreen(cam, [-1500, BW.surf]), bot = toScreen(cam, [-1500, BW.bed]), x = 84;
  rect(x - 4, top[1], 8, bot[1] - top[1], '#ffffff');
  for (let i = 0; i <= 5; i++) {
    const y = lerp(top[1], bot[1], i / 5);
    rect(x - 4, y - 3, 40, 6, '#ffffff');
    Hd.label(i === 0 ? '0 м' : i === 5 ? '50 м' : String(i * 10), x + 50, y + 12, 34, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: true, stroke: false });
  }
  g.restore();
}

// —— the blueprint ——
const bpSt = t => {
  if (t < T.c2) return { x: BP0[0], y: BP0[1], power: 1 - seg(T.stop, T.stop + 0.4, t), spin: t < T.stop ? t * 6 : T.stop * 6 + 6 * 0.5 * (1 - Math.exp(-(t - T.stop) * 2)), co2: co2At(t), tanks: 1 };
  return { x: BP0[0], y: BP0[1] - 300 * seg(T.rise, T.rise + 1.1, t), power: 0, spin: T.stop * 6 + 3, co2: co2At(t), tanks: 1 - seg(T.blow, T.rise + 0.3, t, ease.inOut),
    blow: seg(T.bpb + 0.15, T.bpb + 0.4, t), valve: seg(T.bpb + 0.05, T.bpb + 0.3, t), out: seg(T.blow, T.blow + 0.3, t) };
};
function bpFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const st = bpSt(t);
  drawBP(t, P, st);
  if (t > T.rise) {                                 // the arrow up beside the rising boat
    const k = clamp(sp(t, T.rise, 2.2, 7)), x = st.x + 1180, y = st.y - 60 - 120 * Math.sin((t - T.rise) * 3);
    g.save(); g.translate(x, y); g.scale(k, k); Hd.icon('up', 120, P.ok); g.restore();
  }
}
// the wipe: the sea on the left of a glowing scan line, the blueprint on its right
function wipeFrame(t, cam) {
  extFrame(t, cam);
  const u = seg(T.scan, T.scan + WIPE, t, ease.inOut), sx = lerp(W + 40, -40, u);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.beginPath(); g.rect(sx, 0, W - sx + 10, H); g.clip();
  bpFrame(t, cam);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(sx - 3, 0, 6, H, '#bfe4ff'); rect(sx - 18, 0, 36, H, 'rgba(59,142,234,0.25)');
}

// —— inside the boat ——
function intFrame(t, cam) {
  const a = actorsAt(t), { h, d } = a;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0a0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Hu.shell(t);
  Hu.console_(t, { power: 0 });
  Hu.panel(t, { wheel: a.wheel ?? wheelState(Math.min(t, T.c3)).ang, air: t < T.hatch ? airLeft(t) : 0 });
  Hu.locker(t, { taken: takenAt(t) });
  Hu.bunks(t);
  Hu.ladder(t, { open: seg(T.open, T.open + 0.45, t, ease.out) });
  wallClock(t, 160, -700);
  if (t >= T.pour + 0.15 && t < T.c5) Hu.powder(t, pourX(Math.min(t, A.L4w8 + 0.15)), pourX(T.pour + 0.15) + 30, 1);
  if (t >= T.c4 && t < T.c5) co2Dots(t);
  if (h?.prop?.kind === 'can' && h.prop.open && t > T.pour + 0.1) powderStream(t, h);
  let dl = null;
  if (d) dl = dogDraw(d);
  if (h) hunterDraw(t, h);
  if (a.blanket != null) Hu.blanket(t, 600, 880, -300, h.lying.breathe);
  if (h && t >= T.knock && t < T.up) { const since = knockAt(t); if (since < 0.12) sparks(t, [450, -240], since); }
  const lights = Hu.LAMPS.map(x => ({ p: [x, Hu.CEIL + 186], r: 620, k: 0.5, tint: '#ff3b2a', ta: 0.35 }));
  if (dl?.lens) lights.push({ p: dl.lens, a: dl.beamAng, r: 1150, k: 0.97, cone: true, spread: 0.42, tint: '#ffcf7a' });
  const op = seg(T.open, T.open + 0.45, t);
  if (op > 0) lights.push({ p: [(Hu.HATCH.x0 + Hu.HATCH.x1) / 2, Hu.CEIL - 100], a: Math.PI / 2, r: 1500, k: 0.95 * op, cone: true, spread: 0.5, tint: '#7fd6ff', ta: 0.4 });
  lighting(t, cam, lights, 0.72);
  Hu.lampGlow(t, cam, toScreen, 0.9);
}
function wallClock(t, x, y) {
  ell(x, y, 54, 54, '#20262f'); ell(x, y, 44, 44, '#e6e9ee');
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; rect(x + Math.cos(a) * 36 - 3, y + Math.sin(a) * 36 - 3, 6, 6, '#20262f'); }
  const m = -Math.PI / 2 + (t > T.c5 ? TAU * 0.5 : TAU * 0.48) + 0.02 * t, hh = -Math.PI / 2 + TAU * 0.2;
  limb([[x, y], [x + Math.cos(hh) * 22, y + Math.sin(hh) * 22]], 6, '#20262f', false);
  limb([[x, y], [x + Math.cos(m) * 34, y + Math.sin(m) * 34]], 4, '#c23b2f', false);
}
function sparks(t, p, age) {
  for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.9 + i * 0.32, r = 30 + 260 * age; limb([[p[0] + Math.cos(a) * r * 0.6, p[1] + Math.sin(a) * r * 0.6], [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]], 6, '#ffe7a8', false); }
}
// CO₂ specks in the air, pulled down into the powder after «он съедает»
function co2Dots(t) {
  for (let i = 0; i < 40; i++) {
    const x0 = lerp(-500, 700, hash(i * 2.3)), y0 = lerp(-700, -120, hash(i * 4.9)), x1 = lerp(pourX(A.L4w8), pourX(T.pour + 0.15), hash(i * 7.7));
    const ta = T.eat + 0.05 + hash(i * 1.9) * 1.1, u = seg(ta, ta + 0.55, t, ease.in);
    if (t > ta + 0.65) continue;
    const x = lerp(x0 + 20 * Math.sin(t + i), x1, u), y = lerp(y0 + 12 * Math.sin(t * 1.3 + i), -10, u);
    if (t > ta + 0.55) { const k = (t - ta - 0.55) / 0.1; ell(x1, -12, 10 + 30 * k, 10 + 30 * k, rgba('#ffffff', 0.7 * (1 - k))); continue; }
    ell(x, y, 11, 11, rgba(DANGER, 0.25)); ell(x, y, 6, 6, rgba('#ff6b5e', 0.8));
  }
}
function powderStream(t, h) {
  const m = canMouth(h.prop.p, h.prop.tilt), k = seg(T.pour + 0.1, T.pour + 0.3, t) * (1 - seg(A.L4w8 + 0.1, A.L4w8 + 0.3, t));
  if (k <= 0.01) return;
  for (let i = 0; i < 24; i++) { const u = (t * 2.5 + i / 24) % 1, x = m[0] - 20 * u + 10 * Math.sin(i * 7 + t * 9), y = lerp(m[1], -6, u * u); ell(x, y, 6, 6, rgba('#f2f4f6', k)); }
}

// —— the swim up from the hatch to the surface ——
function swimFrame(t, cam) {
  const { h, d, bubbles } = actorsAt(t);
  Se.water(t, cam, SW);
  Se.sky(t, cam, SW);
  if (t > T.surf - 1) farShip(t, cam);
  Se.rays(t, cam, SW, 1.4);
  Se.snow(t, cam, SW, { size: 1.2 });
  Se.school(t, cam, 0.7, 600, -2200, 12, { s: 1.2, dir: -1, color: 'rgba(20,60,100,0.5)' });
  if (t < T.swim + 2) Se.hatchDeck(t, cam, 0, 0, 1);
  view(cam, 1);
  const dl = drawDog(d);
  const ha = hunterDraw(t, h);
  if (bubbles) {
    for (let i = 0; i < 14; i++) { const u = (t * 1.8 + i / 14) % 1, m = ha.mouth; Se.bubble(m[0] - 20 + 14 * Math.sin(u * 8 + i), m[1] - 20 - u * 380, 5 + 15 * u, Math.min(1, (1 - u) * 2.5) * (t < T.surf ? 1 : 1 - seg(T.surf, T.surf + 0.2, t))); }
    for (let i = 0; i < 4; i++) { const u = (t * 1.3 + i / 4) % 1; Se.bubble(dl.nose[0] + 8 * Math.sin(u * 6), dl.nose[1] - 10 - u * 200, 4 + 8 * u, 1 - u); }
  }
  Se.surface(t, cam, SW);
  Se.veil(t, cam, SW, 0.32);
  if (t > T.surf - 0.05 && t < T.surf + 0.8) splash(t, cam, [ha.head[0], SW.surf]);
  if (t > T.surf) { g.setTransform(1, 0, 0, 1, 0, 0); gulls(t); }
}
function farShip(t, cam) {
  const ys = toScreen(cam, [0, SW.surf])[1];
  if (ys < -200) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Se.drawShip(t, 930 - cam.x * 0.2, { surf: ys - 6 }, 0.2, 40);
}
function splash(t, cam, p) {
  view(cam, 1);
  const u = (t - T.surf + 0.05) / 0.85;
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (hash(i * 3.7) - 0.5) * 2.2, v = 500 + 400 * hash(i * 1.3), x = p[0] + Math.cos(a) * v * u, y = p[1] + Math.sin(a) * v * u + 900 * u * u;
    ell(x, y, 12 * (1 - u) + 4, 12 * (1 - u) + 4, rgba('#ffffff', 0.9 * (1 - u)));
  }
}
function gulls(t) {
  for (let i = 0; i < 3; i++) {
    const x = (200 + i * 330 + t * 40 * (1 + 0.3 * i)) % 1300 - 100, y = 520 + 60 * i + 20 * Math.sin(t + i), w = Math.sin(t * 7 + i * 2) * 14;
    limb([[x - 34, y - w], [x - 14, y - 8], [x, y], [x + 14, y - 8], [x + 34, y - w]], 6, '#24324a');
  }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  // L0: the boat goes dark
  Hd.timeStamp(t, T.cover + 0.15, T.scan, '14:20 — ГЛУБИНА 50 м');
  if (sc === 'ext' && t < T.c3) Hd.plaque(t, T.dark + 0.12, T.scan, 760, 640, { icon: 'bolt', title: 'ЭЛЕКТРИКА', sub: 'отказала', color: DANGER, to: S2(lampW(t)) });
  Hd.ribbon(t, A.L0w7 - 0.06, A.L1 + 0.15, 'НЕ ВОДА, А ВОЗДУХ', { y: 380, size: 84 });
  // L1: the chain dies, CO₂ rises
  Sc.chain(t, A.L1 + 0.05, T.co2 + 0.25, [['bolt', 'ТОК', WARM], ['fan', 'ОЧИСТКА', Hd.NIGHT.line], ['lungs', 'ВОЗДУХ', '#5bb4ff']], [T.stop, T.stop + 0.25, T.stop + 0.5], 420);
  Sc.gauge(t, T.co2 + 0.15, T.c2 - 0.05, 920, 460, co2At(t), 'CO₂', { bad: 'high', dots: true });
  if (t >= T.co2 + 0.15 && t < T.c2) Hd.timeStamp(t, T.co2 + 0.15, T.c2 - 0.05, `ЧАС ${1 + Math.floor(5 * seg(T.co2 + 0.2, A.L1e, t, u => u))}`);
  // L2: step 1
  Hd.stepHeader(t, 1, 'ПРОДУЙ БАЛЛАСТ', A.L2 + 0.02, A.L2e - 0.05);
  if (sc === 'bp' && t > T.bpb) {
    const st = bpSt(t);
    Hd.plaque(t, T.blow - 0.05, T.rise - 0.05, 300, 560, { icon: 'drop', title: 'СЖАТЫЙ ВОЗДУХ', sub: 'выдавит воду', color: GOLD, to: S2([st.x + 860, st.y + 20]) });
    Hd.plaque(t, T.rise + 0.05, T.close, 300, 560, { icon: 'up', title: 'ВСПЛЫВЁТ', sub: 'лодка легче воды', color: OK });
  }
  if (t >= T.close && t < T.c3) Hd.plaque(t, A.L2w14 - 0.15, T.c3, 300, 560, { icon: 'valve', title: 'ВРУЧНУЮ', sub: 'без тока', color: GOLD, to: S2([Hu.WHEEL[0] - 40, Hu.WHEEL[1] - 60]) });
  // L3: step 2
  Hd.stepHeader(t, 2, 'БЕРЕГИ ВОЗДУХ', A.L3 + 0.02, A.L3e - 0.05);
  if (sc === 'ext' && t >= T.c3 && t < T.bunk) Hd.plaque(t, A.L3w3 - 0.1, T.bunk, 760, 560, { icon: 'x', title: 'НЕ ВСПЛЫЛА', sub: 'лодка на дне', color: DANGER, to: S2([BED.x + 200, BED.y - 160]) });
  if (t >= T.bunk && t < T.c4) {
    Hd.timeStamp(t, T.bunk + 0.05, T.c4 - 0.05, 'ЧАС 9 — ЖДЁМ ПОМОЩЬ');
    Hd.plaque(t, T.lie, T.c4, 330, 560, { icon: 'lungs', title: 'В ПОКОЕ', sub: 'меньше дышишь', color: OK, to: S2([980, -330]) });
  }
  // L4: the powder
  if (t >= T.c4 && t < T.c5) {
    Sc.gauge(t, T.c4 + 0.1, T.c5 - 0.05, 920, 460, co2At(t), 'CO₂', { bad: 'high', dots: true });
    Hd.plaque(t, T.eat - 0.05, T.c5, 330, 560, { icon: 'can', title: 'ПОГЛОТИТЕЛЬ', sub: 'съедает CO₂', color: GOLD, to: S2([60, -30]) });
  }
  // L5: step 3
  Hd.stepHeader(t, 3, 'СТУЧИ ПО КОРПУСУ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.up) {
    Hd.plaque(t, A.L5w1 - 0.05, T.up, 330, 560, { icon: 'clock', title: 'КАЖДЫЕ 30 МИН', sub: 'по 3 минуты', color: GOLD, to: S2([160, -700]) });
    if (t >= T.knock) knockWord(t, S2([560, -300]));
  }
  if (sc === 'ext' && t >= T.up) {
    Hd.plaque(t, A.L5w12 - 0.1, T.c6 + 0.2, 560, 560, { icon: 'ear', title: 'СПАСАТЕЛИ', sub: 'молчат и слушают', color: OK, to: S2(HP) });
    if (t < T.c6 + 0.2) { const p = S2([HP[0] + 150, HP[1] - 120]); Hd.tick(p[0], p[1], sp(t, A.L5w15, 2.6, 8) * (1 - seg(T.c6, T.c6 + 0.2, t)), 52); }
    Hd.plaque(t, A.L6w3 - 0.1, T.hatch, 640, 560, { icon: 'ruler', title: 'НЕГЛУБОКО', sub: '50 м до верха', color: GOLD });
  }
  // L6: the swim
  if (sc === 'swim' && t < T.surf + 0.3) {
    const head = hipY(t) - 330, m = Math.max(0, Math.round(50 * clamp((head - SW.surf) / (0 - SW.surf))));
    Hd.timeStamp(t, T.swim + 0.05, T.surf + 0.2, `ГЛУБИНА ${String(m).padStart(2, ' ')} м`);
    Hd.plaque(t, T.exhale, T.lungs + 0.05, 720, 560, { icon: 'lungs', title: 'ВЫДЫХАЙ', sub: 'всё время', color: OK });
    Hd.plaque(t, T.lungs + 0.05, T.surf - 0.55, 720, 560, { icon: 'lungs', title: 'НЕ ДЕРЖИ ВДОХ', sub: 'порвёт лёгкие', color: DANGER });
  }
  // L7: subscribe, then the question
  Hd.endCard(t, A.L7 - 0.05, seg(T.ask - 0.15, T.ask + 0.05, t), 300);
  Hd.plaque(t, T.ask, DUR + 1, 540, 360, { icon: 'comment', title: 'А ТЫ БЫ РИСКНУЛ?', sub: 'пиши в комментариях', color: GOLD, size: 52 });
}
// «ТУК!» at every knock: pops, tilts and fades
function knockWord(t, p) {
  const since = knockAt(t);
  if (since > 0.3) return;
  const k = clamp(spring(since, 2.8, 8)), a = 1 - clamp((since - 0.18) / 0.12), n = KNOCK.findIndex(x => Math.abs(t - since - x) < 1e-6);
  g.setTransform(1, 0, 0, 1, 0, 0);
  Hd.label('ТУК!', p[0] + (n % 2 ? 60 : -20), p[1] - 40 - 50 * since, 96 * (0.8 + 0.3 * k), '#ffd23f', { rot: n % 2 ? 0.15 : -0.12, a, strokeW: 10 });
}

// —— the poster in the first frames: him and the dog in red emergency light, the words over them ——
function coverFrame(t) {
  const cam = { x: -700, y: -430, z: 1.35, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0a0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Hu.shell(t); Hu.console_(t, { power: 0 }); Hu.panel(t, { wheel: 0.3 });
  const o = stand(base(t, { s: 0.92, face: 1, pop: 0.85, brow: 0.9, mouth: 0.55, look: [0.7, -0.2], blink: 0, lean: -0.05 }), -880, 80);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 175, sh[1] - 30], shape: 'open' }, far: { p: [sh[0] + 150, sh[1] - 120], shape: 'open' } };
  const dl = drawDog({ x: -600, y: 30, s: 0.95, face: 1, sit: 1, torch: true, look: 0.1, t: 0, ears: 0.9 });
  hunterDraw(t, o);
  const lights = Hu.LAMPS.map(x => ({ p: [x, Hu.CEIL + 186], r: 700, k: 0.6, tint: '#ff3b2a', ta: 0.45 }));
  lights.push({ p: dl.lens, a: dl.beamAng - 0.5, r: 900, k: 0.95, cone: true, spread: 0.6, tint: '#ffcf7a' }, { p: [-860, -560], r: 520, k: 0.75, tint: '#ff6a4a' });
  lighting(t, cam, lights, 0.75);
  Hu.lampGlow(t, cam, toScreen, 1);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ПОДЛОДКА', 0, 190, 132, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('БЕЗ ТОКА!', 0, 350, 150, '#ff3b30', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'НА ДНЕ · ВОЗДУХ КОНЧАЕТСЯ', pw = measure(pl, 50, FONTS.cond) + 60;
  rect(-pw + 8, 410 + 8, pw, 86, INK); rect(-pw, 410, pw, 86, '#ffd43b'); text(pl, -pw / 2, 470, 50, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o && !o.lying) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (d) out.push(toScreen(cam, [d.x, d.y - 150 * DS]));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
    if (scene(tt) === 'ext' && tt < T.c3) out.push(toScreen(cam, [subAx(tt), subAy(tt)]));
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
  add(0.3, 'deep', -18, 0, { dur: T.c2 - 0.3 });
  add(0.3, 'engine', -16, -0.1, { dur: T.dark - 0.3 + 0.8, off: T.dark - 0.3 });
  add(0.5, 'sonar', -14, 0.2); add(2.3, 'sonar', -16, 0.2);
  add(T.dark, 'power_down', -6, 0);
  add(T.dark + 0.05, 'relays', -12, 0.2);
  add(T.dark + 0.12, 'blip', -10, 0.3);
  add(T.dark + 0.6, 'creak', -14, -0.3);
  add(A.L0w7 - 0.06, 'ribbon', -8, 0);
  add(T.scan, 'scan', -10, 0, { dur: WIPE });
  add(A.L1 + 0.05, 'blip', -12, -0.3); add(A.L1 + 0.14, 'blip', -12, 0); add(A.L1 + 0.23, 'blip', -12, 0.3);
  add(A.L1 - 0.1, 'fan', -14, 0, { dur: T.stop - A.L1 + 0.9, off: T.stop - A.L1 + 0.1 });
  for (let i = 0; i < 3; i++) add(T.stop + i * 0.25, 'node_off', -10, -0.4 + 0.4 * i);
  add(T.co2 + 0.15, 'gas', -16, 0.2, { dur: T.c2 - T.co2 });
  add(T.co2 + 0.15, 'clock', -8, -0.2, { dur: T.c2 - T.co2 - 0.1 });
  add(T.c2, 'amb_hull', -20, 0, { dur: T.c3 - T.c2 });
  add(wheelT0(), 'valve', -12, -0.2, { dur: T.bpb - wheelT0() + 0.1 });
  add(T.bpb, 'whoosh', -12, 0);
  add(T.bpb + 0.15, 'air_blow', -10, 0, { dur: T.rise - T.bpb + 0.4 });
  add(T.blow - 0.05, 'blip', -10, -0.2);
  add(T.blow, 'bubbles', -14, 0.3, { dur: T.rise - T.blow + 0.6 });
  add(T.rise, 'rise', -12, 0);
  add(T.rise + 0.05, 'blip', -10, -0.2);
  add(T.close, 'valve', -12, 0, { dur: T.c3 - T.close });
  add(A.L2w14 - 0.15, 'blip', -10, -0.2);
  add(T.c3, 'deep', -18, 0, { dur: T.bunk - T.c3 + 0.2 });
  add(T.c3 + 0.05, 'thud_bed', -10, 0);
  add(T.c3 + 0.3, 'creak', -14, 0.2);
  add(A.L3w3 - 0.1, 'stamp', -6, 0.1);
  add(T.bunk, 'amb_hull', -20, 0, { dur: T.up - T.bunk });
  add(T.bunk + 0.05, 'breath', -16, 0.1, { dur: T.c4 - T.bunk });
  add(T.lie - 0.05, 'cloth', -12, 0.1);
  add(T.lie, 'blip', -10, -0.3);
  add(T.c4 + 0.1, 'locker', -12, 0.2);
  add(A.L4w2, 'can_out', -12, 0.2);
  add(T.pour - 0.05, 'can_open', -10, -0.1);
  add(T.pour + 0.1, 'pour', -12, -0.1, { dur: A.L4w8 - T.pour + 0.1 });
  add(T.eat - 0.05, 'blip', -10, -0.3);
  add(T.eat + 0.1, 'sparkle', -14, 0, { dur: 1.3 });
  add(A.L5w1 - 0.05, 'blip', -10, -0.3);
  add(A.L5w1 + 0.1, 'clock', -10, -0.2, { dur: T.knock - A.L5w1 - 0.1 });
  for (const k of KNOCK) add(k, k < T.up ? 'knock' : 'knock_far', k < T.up ? -6 : -12, 0.25);
  add(T.up, 'whoosh_up', -12, 0);
  add(T.up, 'deep', -18, 0, { dur: T.hatch - T.up });
  add(T.up + 0.2, 'ship', -18, 0.2, { dur: T.hatch - T.up - 0.1, off: Math.max(0.6, A.L5w12 - T.up - 0.2) });
  add(A.L5w12 - 0.1, 'blip', -10, 0.2);
  add(A.L5w15, 'ding', -10, 0.1);
  add(T.c6, 'whoosh', -14, 0);
  add(A.L6w3 - 0.1, 'blip', -10, -0.2);
  add(T.hatch, 'amb_hull', -20, 0, { dur: T.swim - T.hatch });
  for (let i = 0; i < 4; i++) add(T.hatch + 0.15 + i * 0.38, 'rung', -14, 0.2);
  add(T.open, 'hatch', -8, 0.1);
  add(T.open + 0.1, 'rush', -12, 0.1, { dur: T.swim - T.open + 0.3 });
  add(T.swim, 'swim', -16, 0, { dur: T.surf - T.swim });
  add(T.swim, 'exhale', -14, 0, { dur: T.surf - T.swim });
  add(T.exhale, 'blip', -10, 0.3);
  add(T.lungs + 0.05, 'stamp', -8, 0.3);
  add(T.surf, 'splash', -6, 0);
  add(T.surf + 0.1, 'sea_top', -18, 0, { dur: DUR - T.surf });
  add(T.surf + 0.5, 'gulls', -20, 0.3, { dur: DUR - T.surf - 0.5 });
  for (const t0 of [A.L2, A.L3, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(T.ask, 'blip', -8, 0);
  add(DUR - 0.75, 'whoosh_down', -14, 0);
  return c.sort((a, b) => a.t - b.t);
}
