// «Блэкаут, ты на 20-м этаже»: the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py): another take moves the picture with it (STORYBOARD.md).
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Ap from './apt.js';
import * as Cy from './city.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf, HUN } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without a voice yet: [start, end, words] of each line, words spread evenly
const FB = { L0: [0.12, 4.2, 14], L1: [4.55, 9.2, 15], L2: [9.55, 14.7, 15], L3: [15.1, 19.3, 11], L4: [19.7, 25.6, 15], L5: [26.0, 31.6, 14], L6: [32.05, 37.0, 14], L7: [37.45, 41.0, 11] };
export const DUR = VOICE?.dur ?? 41.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ПОГАС: DANGER, ВНИЗ: DANGER, ЛЕСТНИЦУ: DANGER, ВОДА: GOLD, НАСОСЫ: GOLD, ВСТАЮТ: DANGER, ВОДЫ: DANGER, ВАННУ: GOLD, БУТЫЛКИ: GOLD,
  ХОЛОДИЛЬНИК: DANGER, ЧЕТЫРЕ: GOLD, ДНЯ: GOLD, СВЕЧЕЙ: DANGER, ПОЖАРЫ: DANGER, ФОНАРИКОМ: GOLD, ЭКОНОМИИ: GOLD, СУХИЕ: DANGER, ВАННЫ: GOLD,
  ПОДПИСЫВАЙСЯ: GOLD, ЖИВЁШЬ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  out: A.L0w4 - 0.04,                // «погас»: the wave of darkness across the city
  c1: A.L1 - 0.06,                   // the blueprint: everyone down the stairs
  riser: A.L1w7 - 0.05,              // «А в это время…»: over to the riser
  drain: A.L1w11,                    // «из труб уходит вода»: the top of the riser empties
  c2: A.L2 - 0.06,                   // the pump in the basement
  dead: A.L2w4 - 0.04,               // «Без света»: the grid dies, the pump stops
  pull: A.L2w8 - 0.1,                // «и верхние этажи…»: the whole tower drains from the top
  c3: A.L3 - 0.06,                   // step 1: the bath
  ck: A.L3w3 - 0.1,                  // «а питьевую воду…»: the kitchen counter
  c4: A.L4 - 0.06,                   // step 2: the fridge
  x4: A.L4w3,                        // «холодильник»: the cross on the door
  c5: A.L5 - 0.06,                   // step 3: the candle
  fire: A.L5w5 - 0.1,                // «пожары»: the curtain catches
  torch: A.L5w6 - 0.08,              // «Свети фонариком»: the room in the torch beam
  ph: A.L5w8 - 0.08,                 // «а телефон…»: the phone
  c6: A.L6 - 0.06,                   // day 3: the blueprint of the floors, our flat in colour
  dive: A.L6w7 - 0.15,               // «а ты»: into our bathroom
  pour: A.L6w10 - 0.2,               // «унитаз»: the bucket into the toilet (once the camera is in)
  c7: A.L7w5 - 0.08,                 // «А на каком этаже…»: outside by day
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.ck, T.c4, T.c5, T.torch, T.ph, T.c6, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'city' : t < T.c3 ? 'bp' : t < T.c6 ? 'night' : t < T.c7 ? 'day' : 'cityday');

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
const [WX, WY] = Cy.winCenter(Cy.WIN20.col, Cy.WIN20.floor);
const F20 = Sc.floorY(20);
shot(T.cover, [[T.cover, 0, -1250, 0.4], [T.out, 20, -1420, 0.48], [A.L0w8, WX, -1700, 0.85], [A.L0w11, WX, WY + 6, 1.9], [T.c1, WX, WY, 2.25]]);
shot(T.c1, [[T.c1, -250, F20 - 80, 1.22], [T.riser, -250, F20 + 60, 1.3], [T.riser + 0.55, -40, F20 + 30, 1.5], [T.c2, -30, F20 + 60, 1.55]]);
shot(T.c2, [[T.c2, -470, 30, 1.12], [T.dead, -440, 20, 1.2], [T.pull, -430, 10, 1.22], [T.pull + 0.9, -100, -1120, 0.56], [T.c3, -80, -1150, 0.6]]);
shot(T.c3, [[T.c3, -830, -215, 1.5], [T.ck, -815, -205, 1.6]]);
shot(T.ck, [[T.ck, 140, -215, 1.55], [T.c4, 150, -205, 1.62]]);
shot(T.c4, [[T.c4, -70, -215, 1.55], [T.x4 + 0.3, -80, -205, 1.66], [T.c5, -60, -215, 1.55]]);
shot(T.c5, [[T.c5, 530, -215, 1.55], [T.fire, 560, -220, 1.62], [T.torch, 580, -225, 1.72]]);
shot(T.torch, [[T.torch, 330, -235, 1.3], [T.ph, 350, -225, 1.36]]);
shot(T.ph, [[T.ph, 380, -215, 1.6], [T.c6, 395, -210, 1.7]]);
shot(T.c6, [[T.c6, -180, -270, 0.44], [T.dive, -190, -260, 0.48], [T.dive + 0.9, -640, -215, 1.5], [A.L7, -630, -210, 1.55], [T.c7, -620, -205, 1.6]]);
shot(T.c7, [[T.c7, WX, WY, 2.0], [T.c7 + 1.2, 20, -1500, 0.62], [DUR, 0, -1300, 0.5]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const t0 of [T.out, T.dead, T.fire, T.x4]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += 10 * e * noise(t * 40, 1); dy += 10 * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog: who stands where in each shot and what they do ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
// a few steps from x0 to x1 between t0 and t1 (feet lift in turn, the hip bobs)
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
const talk = (t, a, b) => (t > a && t < b ? 0.3 + 0.25 * Math.abs(Math.sin(t * 13)) : 0);
// the water: in the bath, in the held bottle, in the pots and bottles on the counter
const bathLevel = t => (t < A.L3w1 ? 0.12 : t < T.c6 ? 0.12 + 0.76 * seg(A.L3w1, A.L3w3 + 0.6, t, u => u) : t < T.dive ? 0.88 - 0.06 * seg(T.c6 + 0.6, T.dive, t) : 0.82);
const bathRun = t => (t < A.L3w1 - 0.05 ? 0 : t < T.ck ? 1 : 0);
const kRun = t => (t < T.ck + 0.1 ? 1 : t < A.L3e - 0.35 ? 1 : t < A.L3e + 0.25 ? 0.25 : 0);
const potFills = t => [sp(t, A.L3w8 - 0.05, 2, 8), sp(t, A.L3w8 + 0.1, 2, 8), sp(t, A.L3w10 - 0.05, 2, 8), sp(t, A.L3w10 + 0.07, 2, 8), sp(t, A.L3w10 + 0.19, 2, 8)].map(v => clamp(v));
const heldFill = t => seg(T.ck + 0.15, A.L3w8 - 0.1, t, u => u);
const fireK = t => (t < T.fire ? 0 : t < T.torch ? seg(T.fire, T.fire + 0.45, t, ease.out) : 0);
const candleLit = t => (t >= T.c5 && t < T.torch ? 1 : 0);
const sweep = t => 0.28 * Math.sin((t - T.torch) * 2.6);

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'night' && sc !== 'day') return { h: null, d: null };
  // —— step 1, the bath: he turns on the tap, the dog lights it ——
  if (t < T.ck) {
    const o = stand(base(t, { lean: 0.3, look: [-0.6, -0.3], brow: -0.3, mouth: 0.1 }), -755);
    const tw = seg(A.L3w1 - 0.15, A.L3w1 + 0.1, t);
    o.hands = { near: { p: [Ap.BTAP.x + 4, Ap.BTAP.y - 44], shape: 'grip', ang: -1.6 + 1.2 * tw }, far: { p: [o.hip[0] + 30, o.hip[1] - 20], shape: 'fist' } };
    if (t > A.L3w2 + 0.2) { o.look = [0.4, 0.2]; o.brow = 0.3; }
    const d = { x: -480, y: 0, s: DS, face: -1, sit: 1, torch: true, look: 0.45, tilt: 0.05 * Math.sin(t * 2), t, blink: dblink(t), ears: 0.1 };
    return { h: o, d };
  }
  // —— the kitchen counter: a bottle under the tap, the pots and bottles fill ——
  if (t < T.c4) {
    const o = stand(base(t, { lean: 0.12, look: [-0.7, 0.2], brow: 0.1 }), 300);
    o.hands = { near: { p: [206, -292], shape: 'grip' }, far: { p: [190, -270], shape: 'grip' } };
    o.prop = { kind: 'bottle', p: [196, -272], f: heldFill(t) };
    if (t > A.L3e - 0.3) { o.look = [-0.4, -0.5]; o.brow = 0.6; o.pop = 0.4 * bump(seg(A.L3e - 0.3, A.L3e + 0.4, t)); }
    const d = { x: -20, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.55, tilt: 0.04 * Math.sin(t * 2.3), t, blink: dblink(t) };
    return { h: o, d };
  }
  // —— step 2, the fridge: his hand goes for the door, the dog begs; the cross; he lets go ——
  if (t < T.c5) {
    const o = stand(base(t, { lean: 0.16, look: [-0.6, 0], brow: 0.2 }), -95);
    const reach = seg(A.L4w1 - 0.25, A.L4w2, t) * (1 - seg(T.x4 + 0.15, T.x4 + 0.45, t));
    const rest = [o.hip[0] - 20, o.hip[1] + 10];
    o.hands = { near: { p: [lerp(rest[0], -184, reach), lerp(rest[1], -362, reach)], shape: reach > 0.6 ? 'grip' : 'fist' } };
    if (t > T.x4) { o.pop = clamp(sp(t, T.x4, 2.4, 7)) * (1 - seg(T.x4 + 0.6, T.x4 + 1.2, t)); o.brow = 0.7; o.look = [0.6, 0.3]; o.mouth = 0.15; }
    if (t > A.L4w5) { o.face = 1; o.look = [0.5, 0.4]; o.brow = -0.2; o.mouth = talk(t, A.L4w5, A.L4w8); o.lean = 0.1; o.headTilt = 0.15; }
    const begK = 1 - seg(T.x4 + 0.2, T.x4 + 0.6, t);
    const d = { x: 160, y: 0, s: DS, face: -1, sit: 1, beg: begK, mouth: 0.8 * begK, tongue: 0.9 * begK, ears: 1 - begK, look: 0.2 + 0.4 * begK, wag: begK, wagPh: t * 3, t, blink: dblink(t), brow: begK > 0.5 ? null : -0.5 };
    return { h: o, d, torchOnCounter: true };
  }
  // —— step 3, the candle by the window; the curtain catches ——
  if (t < T.torch) {
    const o = stand(base(t, { face: 1, lean: 0.05, look: [0.6, 0.2], brow: 0.3, mouth: 0.1 }), 420);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 30, sh[1] + 60], shape: 'fist' }, far: { p: [sh[0] + 10, sh[1] + 70], shape: 'fist' } };
    if (t > T.fire + 0.1) { const k = clamp(sp(t, T.fire + 0.1, 2.4, 7)); o.pop = k; o.brow = 1; o.mouth = 0.6 * k; o.lean = -0.12 * k; o.hatJump = 26 * bump((t - T.fire - 0.1) / 0.3);
      o.hands = { near: { p: [sh[0] + 60, sh[1] - 60 * k], shape: 'open' }, far: { p: [sh[0] - 10, sh[1] - 70 * k], shape: 'open' } }; }
    const d = { x: 290, y: 0, s: DS, face: 1, sit: 1, torch: true, torchOff: true, look: 0.3, ears: 0.6, t, blink: dblink(t) };
    if (t > T.fire + 0.1) { d.ears = 1; d.look = 0.6; }
    return { h: o, d };
  }
  // —— the room in the torch beam: the dog sweeps it about, he gives a thumbs up ——
  if (t < T.ph) {
    const o = stand(base(t, { face: -1, look: [-0.6, 0.3], brow: 0.5, mouth: 0.25 }), 540);
    const sh = shoulder(o), k = clamp(sp(t, T.torch + 0.25, 2.4, 7));
    o.hands = { near: { p: [sh[0] - 40 * k, sh[1] - 50 * k + 40], shape: k > 0.5 ? 'thumb' : 'fist', ang: -Math.PI / 2 } };
    const d = { x: 170, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.25, tilt: 0.12 + 0.6 * sweep(t), t, blink: dblink(t), wag: 1, wagPh: t * 2.6 };
    return { h: o, d };
  }
  // —— the phone: he switches on the power saving, the dog lights his hands ——
  if (t < T.c6) {
    const o = stand(base(t, { face: 1, lean: 0.1, look: [0.6, 0.6], brow: 0.2, headTilt: 0.18 }), 420);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 56, sh[1] + 30], shape: 'grip' }, far: { p: [sh[0] + 44, sh[1] + 44], shape: 'point' } };
    o.prop = { kind: 'phone', p: [sh[0] + 60, sh[1] + 4] };
    const d = { x: 250, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.5, t, blink: dblink(t) };
    return { h: o, d };
  }
  // —— day 3: he scoops the bath with the bucket, steps to the toilet and pours it in ——
  if (t < A.L7) {
    if (t < T.c6 + 1.1) {
      const o = stand(base(t, { lean: 0.28, look: [-0.5, 0.5], brow: 0.2 }), -820);
      const dip = bump(seg(T.c6, T.c6 + 1.0, t, u => u));
      o.prop = { kind: 'bucket', p: [-905, -330 + 80 * dip], f: 0.4 + 0.6 * seg(T.c6 + 0.3, T.c6 + 0.8, t), tilt: 0.2 * dip };
      o.hands = { near: { p: o.prop.p, shape: 'grip' } };
      return { h: o, d: dogDay(t) };
    }
    const o = steps(base(t, { face: 1, lean: 0.12, look: [0.6, 0.5], brow: 0.3 }), -820, -700, T.c6 + 1.1, T.dive - 0.05, t);
    const k = seg(T.pour, T.pour + 0.45, t), sh = shoulder(o), tilt = 1.45 * k;
    o.prop = { kind: 'bucket', p: [lerp(sh[0] + 40, -545, k), lerp(sh[1] + 70, -238, k)], f: 1 - seg(T.pour + 0.3, T.pour + 1.1, t), tilt, front: k > 0.05 };
    const bot = [o.prop.p[0] - Math.sin(tilt) * 118, o.prop.p[1] + Math.cos(tilt) * 118];       // he lifts the bucket by its bottom
    o.hands = { near: { p: o.prop.p, shape: 'grip' }, far: { p: [lerp(sh[0] + 20, bot[0], k), lerp(sh[1] + 90, bot[1], k)], shape: 'grip' } };
    return { h: o, d: dogDay(t) };
  }
  // —— «Подписывайся»: a thumbs up to us ——
  const o = stand(base(t, { face: 1, look: [0.8, 0], brow: 0.6, mouth: 0.35, lean: 0.02 }), -700);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  const d = { x: -440, y: 0, s: DS, face: -1, sit: 1, look: 0.4, mouth: 0.7, tongue: 0.8, wag: 1, wagPh: t * 3, t, blink: dblink(t) };
  return { h: o, d };
}
function dogDay(t) { return { x: -380, y: 0, s: DS, face: -1, sit: 1, look: 0.3, mouth: 0.5, tongue: 0.6, wag: 1, wagPh: t * 2.2, t, blink: dblink(t) }; }
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'bottle') o.propNear = () => Ap.bottle(p.p[0], p.p[1], p.f, 1);
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, phoneSaver(t) > 0.5 ? '#6f8fb0' : '#9fd8ff'); g.restore(); };
  if (p?.kind === 'bucket') o[p.front ? 'propNear' : 'propFar'] = () => Ap.drawBucket(p.p[0], p.p[1], 0.8, p.f, p.tilt);   // tipped, it is held against his belly, in front
  return drawHunter(o);
}
const phoneSaver = t => seg(A.L5w12 - 0.1, A.L5w12 + 0.15, t);

// —— the night light: darkness over the flat with holes where the torch, the candle, the fire and the window light it ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
function lighting(t, cam, lights, amount = 0.86) {
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(4,7,17,${amount})`; dk.fillRect(0, 0, W, H);
  dk.globalCompositeOperation = 'destination-out';
  const z = scaleOf(cam);
  const shapes = [];
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
  // a warm tint inside the light
  for (const { x, y, r, L } of shapes) {
    if (!L.tint) continue;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(L.tint, 0.22 * L.k)); gr.addColorStop(1, rgba(L.tint, 0));
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
  if (sc === 'city' || sc === 'cityday') cityFrame(t, cam, sc === 'cityday');
  else if (sc === 'bp') blueprintFrame(t, cam);
  else flatFrame(t, cam, sc === 'day');
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'bp' ? 0.6 : 1);
}

// —— outside: the city, the blackout wave, our window ——
function cityFrame(t, cam, day) {
  Cy.drawCity(t, cam, { t0: day ? -1e9 : T.out, day: day ? 1 : 0, home: day ? 0 : 1, inside: (x, y, w, h) => ourWindow(t, x, y, w, h) });
}
// in our window after the blackout: the torch beam and two silhouettes, him and the dog
function ourWindow(t, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  rect(x, y, w, h, '#151a2b');
  const sw = 0.3 * Math.sin(t * 1.7), ox = x + w * 0.2, oy = y + h * 0.72;
  fill(polyPath([[ox, oy], [ox + Math.cos(-0.4 + sw) * 160, oy + Math.sin(-0.4 + sw) * 160], [ox + Math.cos(0.3 + sw) * 160, oy + Math.sin(0.3 + sw) * 160]]), 'rgba(255,196,110,0.75)');
  ell(ox, oy, 6, 6, '#fff2c8');
  MONO.on = true; MONO.color = '#0b0f1a';
  drawHunter(stand(base(t, { s: 0.11, face: -1, look: [-1, 0] }), x + w * 0.62, y + h + 10));
  drawDog({ x: x + w * 0.2, y: y + h + 4, s: 0.12, face: 1, sit: 1, t });
  MONO.on = false;
  g.restore();
}

// —— the blueprint: the stairs, the riser, the pump, the whole tower ——
const waterLevel = t => (t < T.drain ? 23 : t < T.pull ? lerp(23, 20.4, seg(T.drain, T.c2, t, ease.out)) : lerp(20.4, 9.5, seg(T.pull + 0.2, T.c3 - 0.2, t, ease.inOut)));
const pumpOn = t => (t < T.dead ? 1 : 1 - seg(T.dead, T.dead + 0.7, t, ease.out));
const pumpAngle = t => (t < T.dead ? t * 7 : T.dead * 7 + 7 * 0.7 * (1 - Math.exp(-(t - T.dead) * 1.4)) / 1);
function blueprintFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const dots = t > A.L1w1 - 0.1 ? Sc.crowd(t, A.L1w1 - 0.1) : [];
  // you: a warm dot by your door on the 20th floor
  const you = [Sc.BLD.stair[1] + 70, F20 - 30];
  dots.push([you[0], you[1] - 6 * Math.abs(Math.sin(t * 3)), WARM, 13]);
  Sc.tower(t, P, { level: waterLevel(t), flow: t < T.c2 ? 0 : pumpOn(t), spin: pumpAngle(t), power: t < T.c2 ? 1 : pumpOn(t), dots, home: 1, dry: seg(T.pull + 0.3, T.c3 - 0.2, t, u => u), labels: seg(T.c1, T.c1 + 0.8, t), mark: T.dead });
  Hd.label('ТЫ', you[0] + 26, you[1] - 22, 30, WARM, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
}

// —— the flat at night or by day ——
function flatFrame(t, cam, day) {
  const { h, d, torchOnCounter } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = day ? '#e8e1cf' : '#090c16'; g.fillRect(0, 0, W, H);
  if (day && t < T.dive + 0.9) neighbours(t, cam);
  view(cam, 1);
  Ap.drawShell(t, { power: false });
  Ap.drawWindow(t, { day: day ? 1 : 0, fire: fireK(t) });
  Ap.drawTub(t, { level: bathLevel(t), run: bathRun(t) });
  Ap.drawToilet(t, { swirl: seg(T.pour + 0.5, T.pour + 0.8, t) * (1 - seg(T.pour + 2.2, T.pour + 3, t)) });
  Ap.drawFridge(t);
  Ap.drawCounter(t, { run: scene(t) === 'night' && t < T.c4 ? kRun(t) : 0, fills: t >= T.ck ? potFills(t) : [0, 0, 0, 0, 0], streamTo: t >= T.ck && t < T.c4 ? -272 - 92 : -300 });
  Ap.drawTable(t, { lit: candleLit(t), lean: t > A.L5w3 ? 0.8 : 0.1 });
  if (t >= T.torch && t < T.ph + 0.8 && !day) smoke(t, Ap.CANDLE[0], Ap.CANDLE[1] - 102);
  Ap.drawBowl(t, 1);
  if (torchOnCounter) torchProp(60, -306);
  let dl = null;
  if (d) dl = drawDog({ ...d, torch: d.torch && !d.torchOff ? true : d.torch });
  if (h) hunterDraw(t, h);
  if (h?.prop?.kind === 'bucket' && t > T.pour + 0.25 && t < T.pour + 1.2) {             // the pour: water from the lip into the bowl
    const k = seg(T.pour + 0.25, T.pour + 0.45, t) * (1 - seg(T.pour + 1.0, T.pour + 1.2, t)), lip = Ap.bucketLip(h.prop.p[0], h.prop.p[1], 0.8, h.prop.tilt);
    const bowl = [Ap.TOILET.x - 10, -176];
    limb([lip, [lerp(lip[0], bowl[0], 0.4) + 10, lerp(lip[1], bowl[1], 0.4)], bowl], 24 * k, Ap.COLORS.water); limb([lip, [lerp(lip[0], bowl[0], 0.5) + 6, lerp(lip[1], bowl[1], 0.5)]], 7 * k, '#c8ecff');
  }
  if (!day) {
    const lights = [{ p: [(Ap.WIN.x0 + Ap.WIN.x1) / 2, (Ap.WIN.y0 + Ap.WIN.y1) / 2], r: 480, k: 0.45 }];
    if (dl?.lens && !d.torchOff) lights.push({ p: dl.lens, a: dl.beamAng, r: 1150, k: 0.97, cone: true, spread: 0.42, tint: '#ffcf7a' });
    if (torchOnCounter) lights.push({ p: [56, -306], a: Math.PI + 0.06, r: 900, k: 0.95, cone: true, spread: 0.45, tint: '#ffcf7a' });
    if (candleLit(t)) lights.push({ p: [Ap.CANDLE[0], Ap.CANDLE[1] - 120], r: 420 + 20 * noise(t * 10, 3), k: 0.9, tint: '#ffb84d' });
    const fk = fireK(t); if (fk > 0) lights.push({ p: [Ap.WIN.x1 + 10, Ap.WIN.y1 - 40], r: 380 + 520 * fk, k: 0.95 * fk, tint: '#ff7a3d' });
    if (h?.prop?.kind === 'phone') { const sh = shoulder(h); lights.push({ p: [sh[0] + 60, sh[1]], r: 200, k: 0.7, tint: '#9fd8ff' }); }
    lighting(t, cam, lights, 0.76);
  }
}
// the candle's smoke after it is put out
function smoke(t, x, y) {
  for (let i = 0; i < 5; i++) { const u = ((t - T.torch) * 0.6 + i / 5) % 1; ell(x + 20 * Math.sin(u * 6 + i), y - u * 160, 10 + 14 * u, 10 + 14 * u, 'rgba(200,200,210,0.5)', 0, 1 - u); }
}
function torchProp(x, y) {
  limb([[x + 8, y], [x + 80, y]], 22, '#2b3346', false); limb([[x + 12, y - 6], [x + 76, y - 6]], 6, '#55607a', false);
  rrect(x - 8, y - 16, 20, 32, 6, '#2b3346'); ell(x - 6, y, 7, 13, '#ffe7a8');
}
// day 3: the floors above, below and to the sides as a blueprint on paper, the neighbours at dry taps
function neighbours(t, cam) {
  const P = Sc.palette('paper');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const { x0, x1, ceil, slab } = Ap.ROOM, w = x1 - x0 + 120, h = -ceil + slab + 70;
  const dry = seg(A.L6w5 - 0.1, A.L6w6, t);
  for (const [i, j] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const ox = i * w, oy = j * h;
    g.save(); g.translate(ox, oy);
    Sc.gline([[x0, ceil], [x1, ceil], [x1, 0], [x0, 0]], 4, P.line, P, true);
    Sc.gline([[Ap.PART.x0, ceil], [Ap.PART.x0, Ap.PART.door]], 3, P.faint, P);
    const tb = Ap.TUB; Sc.gline([[tb.x0, tb.rim], [tb.x1, tb.rim], [tb.x1 - 30, -12], [tb.x0 + 30, -12]], 3, P.faint, P, true);
    const c = Ap.COUNTER; Sc.gline([[c.x0, c.top], [c.x1, c.top], [c.x1, 0], [c.x0, 0]], 3, P.faint, P, true);
    Sc.gline([[Ap.FRIDGE.x0, Ap.FRIDGE.top], [Ap.FRIDGE.x1, Ap.FRIDGE.top], [Ap.FRIDGE.x1, 0], [Ap.FRIDGE.x0, 0]], 3, P.faint, P, true);
    Sc.gline([[Ap.WIN.x0, Ap.WIN.y0], [Ap.WIN.x1, Ap.WIN.y0], [Ap.WIN.x1, Ap.WIN.y1], [Ap.WIN.x0, Ap.WIN.y1]], 3, P.faint, P, true);
    // the neighbour at the kitchen tap, shaking it; the tap's red cross
    const nx = 300 + 40 * hash(i * 3 + j), shake = 6 * Math.sin(t * 22 + i);
    MONO.on = true; MONO.color = '#8fb0d8';
    const o = stand(base(t, { face: -1, hat: false, lean: 0.1 }), nx);
    const sh = framesOf(o).T.p([-14, -192]);
    o.hands = { near: { p: [Ap.KTAP.x + 40 + shake, -330], shape: 'grip' }, far: { p: [sh[0] - 30, sh[1] - 80 - 20 * Math.abs(Math.sin(t * 5 + j))], shape: 'open' } };
    drawHunter(o);
    MONO.on = false;
    Sc.gline([Ap.KTAP.base, [Ap.KTAP.x, -400], [Ap.KTAP.x + 30, -420], Ap.KTAP.spout], 5, P.line, P);
    if (dry > 0) { const k = clamp(dry * 2 - Math.abs(i) * 0.3 - (j + 1) * 0.15); g.save(); g.translate(Ap.KTAP.spout[0] + 10, Ap.KTAP.spout[1] + 60); g.scale(k, k); Hd.icon('x', 46, P.danger); g.restore(); }
    g.restore();
  }
  // the floor numbers on the slabs
  for (const [j, f] of [[-1, 21], [0, 20], [1, 19]]) Hd.label(`${f} ЭТАЖ`, x1 + 90, j * h - 300, 70, f === 20 ? P.warm : P.line, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false, rot: -Math.PI / 2 });
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  // time stamps
  Hd.timeStamp(t, T.cover + 0.15, T.c3 - 0.1, 'ДЕНЬ 1 — 18:04');
  Hd.timeStamp(t, T.c5 + 0.05, T.c6 - 0.1, 'НОЧЬ — 23:40');
  Hd.timeStamp(t, T.c6 + 0.05, T.dive + 0.8, 'ДЕНЬ 3 — 09:12', { color: '#2c5d9e' });
  // the hook: our floor counted up, the ribbon
  if (sc === 'city') {
    const n = Math.round(lerp(1, 20, seg(A.L0w8, A.L0w10 + 0.1, t, u => u)));
    Hd.plaque(t, A.L0w8 - 0.05, T.c1 - 0.05, 300, 560, { icon: 'house', title: `ЭТАЖ ${n}`, sub: 'света нет', color: WARM, to: S2([WX - 40, WY - 10]) });
  }
  Hd.ribbon(t, A.L0w11 - 0.06, A.L1 + 0.1, 'НЕ БЕГИ ВНИЗ', { y: 820 });
  // the blueprint
  if (sc === 'bp') {
    Hd.plaque(t, A.L1w3 - 0.05, T.riser, 700, 470, { icon: 'stairs', title: 'ЛЕСТНИЦА', sub: 'все бегут вниз', color: DANGER, to: S2(Sc.stairAt(Sc.stairD(18) + 120)) });
    Sc.gauge(t, T.drain - 0.1, T.c2 - 0.05, 930, 700, 1 - 0.55 * seg(T.drain, T.c2, t, ease.out), 'ВОДА·20');
    Sc.chain(t, T.c2 + 0.08, T.pull + 0.9, [T.dead, T.dead + 0.25, T.dead + 0.5], 470);
    Hd.plaque(t, T.pull + 0.6, T.c3 - 0.05, 560, 300, { icon: 'drop', title: '20 ЭТАЖ', sub: 'воды нет', color: DANGER, to: S2([Sc.BLD.x1 - 60, F20 - 55]) });
  }
  // step 1
  Hd.stepHeader(t, 1, 'НАБЕРИ ВОДУ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.ck) Hd.plaque(t, A.L3w2 - 0.05, T.ck - 0.02, 300, 560, { icon: 'bath', title: 'ВАННА', sub: 'для унитаза', color: GOLD, to: S2([-980, -190]) });
  if (t >= T.ck && t < T.c4) {
    Hd.plaque(t, A.L3w8 - 0.1, T.c4 - 0.02, 760, 560, { icon: 'drop', title: 'ПИТЬ', sub: 'кастрюли, бутылки', color: OK, to: S2([270, -400]) });
    { const p = S2([270, -470]); Hd.tick(p[0], p[1], sp(t, A.L3e + 0.05, 2.6, 8), 52); }
  }
  // step 2
  Hd.stepHeader(t, 2, 'НЕ ОТКРЫВАЙ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) {
    const p = S2([-250, -420]); Hd.redX(p[0], p[1], 90, sp(t, T.x4, 2.6, 8) * (1 - seg(A.L4w4 - 0.1, A.L4w4 + 0.15, t)));
    Hd.paperCard(t, A.L4w4 - 0.05, T.c5 - 0.02, 540, 610, [
      { icon: 'fridge', label: 'Холодильник', note: '≈ 4 часа', value: 0.25, color: '#3b8eea' },
      { icon: 'snow', label: 'Полная морозилка', note: '≈ 2 дня', value: 1, color: '#2f6fd0' }]);
  }
  // step 3
  Hd.stepHeader(t, 3, 'БЕЗ СВЕЧЕЙ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.torch) {
    const p = S2([Ap.CANDLE[0], Ap.CANDLE[1] - 70]); Hd.redX(p[0], p[1], 80, sp(t, A.L5w2 - 0.05, 2.6, 8) * (1 - seg(T.fire - 0.15, T.fire, t)));
    Hd.plaque(t, T.fire + 0.1, T.torch, 330, 560, { icon: 'flame', title: 'ПОЖАР', sub: 'от одной свечи', color: DANGER, to: S2([Ap.WIN.x1 + 10, Ap.WIN.y1 - 60]) });
  }
  if (t >= T.torch && t < T.ph) { const d = actorsAt(t).d, dl = d && lensOf(d); Hd.plaque(t, T.torch + 0.12, T.ph, 720, 560, { icon: 'torch', title: 'ФОНАРИК', sub: 'без огня', color: OK, to: dl ? S2(dl) : null }); }
  if (t >= T.ph && t < T.c6) phoneCard(t, 540, 720);
  // day 3
  if (sc === 'day' && t < T.dive + 0.6) {
    Hd.plaque(t, A.L6w5 - 0.05, T.dive + 0.3, 540, 380, { icon: 'tap', title: 'У СОСЕДЕЙ', sub: 'сухие краны', color: DANGER });
  }
  if (sc === 'day') Hd.tick(760, 640, sp(t, T.pour + 0.75, 2.6, 8) * (1 - seg(A.L7 - 0.2, A.L7, t)), 60);
  // the end: subscribe, then «what floor are you on?»
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (sc === 'cityday') Hd.plaque(t, A.L7w7 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'А ТВОЙ ЭТАЖ?', sub: 'пиши в комментариях', color: GOLD, size: 52 });
}
function lensOf(d) {
  // where the dog's torch lens is, without drawing her (draw into a muted state)
  const sv = g.globalAlpha; g.globalAlpha = 0; const r = drawDog(d); g.globalAlpha = sv; return r.lens;
}
// —— the phone close-up: the battery in red, the power-saving switch flips on ——
function phoneCard(t, cx, cy) {
  const k = clamp(sp(t, T.ph + 0.08, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const on = phoneSaver(t), w = 360, h = 560;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(-0.04); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, mix('#2b4a78', '#141b2c', on * 0.6));
  rrect(-40, -h / 2 + 26, 80, 18, 9, '#0d0f16');
  // the battery
  const lv = 0.23, bc = on > 0.5 ? GOLD : DANGER;
  g.save(); g.translate(0, -110); g.lineWidth = 8; g.strokeStyle = bc; g.stroke(rrPath(-110, -50, 200, 100, 16)); rect(96, -20, 18, 40, bc); rect(-96, -36, 172 * lv, 72, bc); g.restore();
  Hd.label('23%', 0, 10, 64, '#ffffff', { shadow: false, stroke: false });
  // the switch row
  rrect(-w / 2 + 34, 70, w - 68, 110, 24, 'rgba(255,255,255,0.08)');
  Hd.label('ЭКОНОМИЯ', -w / 2 + 56, 116, 34, '#ffffff', { align: 'left', shadow: false, stroke: false });
  Hd.label('заряда', -w / 2 + 56, 156, 34, '#c9d6ea', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  const sx = w / 2 - 110;
  rrect(sx, 100, 80, 46, 23, mix('#4a5064', OK, on)); ell(sx + 23 + 34 * ease.inOut(on), 123, 19, 19, '#ffffff');
  g.restore();
  // a finger presses it
  if (t > A.L5w12 - 0.5 && t < A.L5w12 + 0.4) {
    const u = seg(A.L5w12 - 0.5, A.L5w12 - 0.1, t) * (1 - seg(A.L5w12 + 0.1, A.L5w12 + 0.4, t));
    g.setTransform(1, 0, 0, 1, 0, 0); ell(cx + 105 + 80 * (1 - u), cy + 140 + 160 * (1 - u), 34, 40, HUN.skin, -0.4, u);
  }
}

// —— the poster in the first frames: him and the dog in the torch light, the words on the right ——
function coverFrame(t) {
  const cam = { x: 360, y: -330, z: 1.55, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t); Ap.drawWindow(t, {}); Ap.drawCounter(t, {}); Ap.drawTable(t, { candle: false });
  const o = stand(base(t, { s: 0.95, face: 1, pop: 0.8, brow: 0.9, mouth: 0.5, look: [0.7, -0.1], blink: 0, lean: -0.05 }), 220, 120);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 120, sh[1] - 60], shape: 'point', ang: -0.5 } };
  const dl = drawDog({ x: 420, y: 60, s: 1.05, face: 1, sit: 1, torch: true, look: 0.15, t: 0, ears: 0.2 });
  hunterDraw(t, o);
  lighting(t, cam, [{ p: dl.lens, a: dl.beamAng - 0.55, r: 900, k: 0.97, cone: true, spread: 0.55, tint: '#ffcf7a' }, { p: [Ap.WIN.x0 + 150, Ap.WIN.y0 + 160], r: 380, k: 0.4 }, { p: [260, -420], r: 520, k: 0.75, tint: '#ffcf7a' }], 0.8);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('НЕ БЕГИ', 0, 210, 150, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('ВНИЗ!', 0, 390, 190, '#ff3b30', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'СВЕТ ПОГАС · 20 ЭТАЖ', pw = measure(pl, 56, FONTS.cond) + 60;
  rect(-pw + 8, 450 + 8, pw, 92, INK); rect(-pw, 450, pw, 92, '#ffd43b'); text(pl, -pw / 2, 514, 56, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (d) out.push(toScreen(cam, [d.x, d.y - 150 * DS]));
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
  add(0.3, 'city', -16, 0, { dur: T.out - 0.3 + 0.4 });
  add(T.out, 'power_down', -6, 0);
  add(T.out + 0.05, 'hum_stop', -12, 0);
  add(A.L0w8, 'ticks_up', -14, 0.1, { dur: A.L0w10 - A.L0w8 + 0.2 });
  add(A.L0w11 - 0.06, 'ribbon', -8, 0);
  add(T.c1, 'whoosh', -12, 0);
  add(A.L1w1 - 0.1, 'crowd_steps', -14, -0.2, { dur: T.riser - A.L1w1 + 0.6 });
  add(A.L1w3 - 0.05, 'blip', -10, 0.3);
  add(T.drain, 'drain', -12, 0.1, { dur: T.c2 - T.drain });
  add(T.c2, 'whoosh_down', -12, 0);
  add(T.c2, 'pump', -14, -0.1, { dur: T.dead - T.c2 + 0.9, off: T.dead - T.c2 });
  add(T.c2 + 0.08, 'blip', -12, -0.3); add(T.c2 + 0.17, 'blip', -12, 0); add(T.c2 + 0.26, 'blip', -12, 0.3);
  add(T.dead, 'spark', -6, -0.3);
  for (let i = 0; i < 3; i++) add(T.dead + i * 0.25, 'node_off', -10, -0.4 + 0.4 * i);
  add(T.pull + 0.2, 'drain', -12, 0, { dur: T.c3 - T.pull });
  add(T.pull + 0.6, 'blip', -10, 0.2);
  add(T.c3, 'amb_flat', -20, 0, { dur: T.c6 - T.c3 });
  add(A.L3w1 - 0.1, 'tap_squeak', -12, -0.2);
  add(A.L3w1 - 0.05, 'tap_run', -12, -0.2, { dur: T.ck - A.L3w1 + 0.1 });
  add(A.L3w2 - 0.05, 'blip', -10, -0.1);
  add(T.ck, 'tap_run', -12, 0.1, { dur: A.L3e - T.ck - 0.3 });
  add(A.L3e - 0.35, 'tap_cough', -10, 0.1);
  add(A.L3w8 - 0.1, 'blip', -10, 0.2);
  for (let i = 0; i < 5; i++) add([A.L3w8 - 0.05, A.L3w8 + 0.1, A.L3w10 - 0.05, A.L3w10 + 0.07, A.L3w10 + 0.19][i], 'fill_plink', -14, 0.1 + 0.05 * i);
  add(A.L3e + 0.05, 'ding', -10, 0.1);
  add(T.x4, 'stamp', -4, -0.2);
  add(A.L4w1 - 0.2, 'whine', -14, 0.2, { dur: 0.9 });
  add(A.L4w4 - 0.05, 'paper', -10, 0);
  add(T.c5 + 0.1, 'candle', -18, 0.2, { dur: T.fire - T.c5 });
  add(A.L5w2 - 0.05, 'stamp', -4, 0.1);
  add(T.fire, 'fire_whoosh', -6, 0.3);
  add(T.fire + 0.1, 'fire', -14, 0.3, { dur: T.torch - T.fire });
  add(T.fire + 0.1, 'blip', -10, -0.2);
  add(T.torch - 0.05, 'puff', -10, 0.3);
  add(T.torch + 0.02, 'click', -8, -0.1);
  add(T.torch + 0.12, 'blip', -10, 0.2);
  add(T.ph + 0.08, 'whoosh_in', -12, 0);
  add(A.L5w12 - 0.05, 'toggle', -8, 0);
  add(T.c6, 'morning', -18, 0, { dur: A.L7 - T.c6 });
  add(A.L6w5 - 0.05, 'squeak_dry', -12, -0.3);
  add(A.L6w5 + 0.15, 'squeak_dry', -14, 0.3);
  add(T.dive, 'whoosh_in', -12, 0);
  add(T.pour + 0.25, 'pour', -10, 0, { dur: 0.9 });
  add(T.pour + 0.6, 'flush', -12, 0);
  add(T.pour + 0.75, 'ding', -10, 0.1);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(T.c7, 'whoosh', -12, 0);
  add(A.L7w7 - 0.1, 'blip', -8, 0);
  add(T.c7, 'city_day', -18, 0, { dur: DUR - T.c7 });
  return c.sort((a, b) => a.t - b.t);
}
