// «Зима, батареи остыли» (блэкаут, ч.4): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// Same flat, hunter, dog, city and blueprint as parts 1–2 (../blackout-week); new here: snow and frost, the breath in
// the cold, the gas stove, the flat on a thermal camera, the plan with the doors closing, the layers of clothes flying
// on, the hypothermia card, the blanket with the dog's nose under it and the ice on the tub from part 1.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Ap from './apt.js';
import * as Cy from './city.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.22, 12], L1: [4.62, 10.57, 18], L2: [10.97, 15.38, 13], L3: [15.83, 19.89, 10], L4: [20.29, 25.73, 13], L5: [26.13, 32.8, 19], L6: [33.25, 39.84, 22], L7: [40.3, 45.26, 13] };
export const DUR = VOICE?.dur ?? 45.61;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm, ICE = '#8fd3ff';
const HOT = { ЗИМОЙ: ICE, ОСТЫЛИ: ICE, БАТАРЕИ: ICE, ГАЗОВУЮ: DANGER, НЕЛЬЗЯ: DANGER, УГАРНЫЙ: DANGER, ГАЗ: DANGER, УХОДИТ: ICE,
  СЕБЯ: GOLD, ОДНОЙ: GOLD, КОМНАТЕ: GOLD, ЗАКРОЙТЕ: GOLD, ТОНКИХ: GOLD, ШАПКА: GOLD, ШАРФ: GOLD, ДРОЖЬ: DANGER, МЫСЛИ: DANGER,
  СОН: DANGER, ПЕРЕОХЛАЖДЕНИЕ: DANGER, ВРАЧУ: DANGER, ОДЕЯЛОМ: GOLD, ЛЬДОМ: ICE, ПОДПИСЫВАЙСЯ: GOLD, ХОЛОДНАЯ: ICE };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  cold: A.L0w10 - 0.05,              // «остыли батареи»: the thermometer falls
  c1: A.L1 - 0.06,                   // «Хочется зажечь газовую плиту…»: the kitchen, the stove
  knob: A.L1w1 - 0.05,               // «зажечь»: his hand on the knob
  no: A.L1w8 - 0.05,                 // «Нельзя»: the cross
  gas: A.L1w12 - 0.08,               // «угарный газ»: the grey cloud
  c2: A.L2 - 0.06,                   // the thermal camera: the heat leaves the whole flat
  self: A.L2w7 - 0.06,               // «греть нужно не квартиру, а себя»: the warm figures
  c3: A.L3 - 0.06,                   // step 1: the plan, the doors close
  c4: A.L4 - 0.06,                   // step 2: the layers fly on
  c5: A.L5 - 0.06,                   // step 3: the hypothermia card
  c6: A.L6 - 0.06,                   // the morning: under one blanket
  tub: A.L6w8 - 0.06,                // «А вода в ванне»: the bathroom, the ice
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
const LAYERS = [A.L4w2 - 0.08, A.L4w3 - 0.08, A.L4w4 - 0.08];   // «тонких», «слоёв», «одежды»: one thin layer each
const HAT = A.L4w10 - 0.06, SCARF = A.L4w12 - 0.06;
const SIGNS = [A.L5w2 - 0.06, A.L5w5 - 0.06, A.L5w8 - 0.06];    // «дрожь», «путаются мысли», «клонит в сон»
const KNOCKS = [A.L6w20 - 0.05, A.L6w21 - 0.05];               // «покрылась льдом»: two knocks on the ice
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.tub, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A, LAYERS, HAT, SCARF, SIGNS, KNOCKS };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'city' : t < T.c2 ? 'night' : t < T.c3 ? 'thermal' : t < T.c4 ? 'plan' : t < T.c6 ? 'night' : 'day');
const layersOn = t => LAYERS.filter(t0 => t >= t0 + 0.35).length;   // how many layers have landed on him
const dressed = t => t >= T.c5;                                // steps 3 on: everything on

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
// the plan of the flat seen from above (step 1), in blueprint units
const PL = { x0: -480, x1: 480, y0: -1300, y1: 0 };
shot(T.cover, [[T.cover, 0, -1250, 0.4], [A.L0w2, 20, -1420, 0.5], [A.L0w6, WX, -1700, 0.85], [A.L0w9, WX, WY + 6, 1.9], [T.c1, WX, WY, 2.25]]);
shot(T.c1, [[T.c1, 560, -250, 1.5], [T.no, 580, -250, 1.6], [T.c2, 600, -240, 1.66]]);
shot(T.c2, [[T.c2, -200, -360, 0.62], [T.self, -120, -330, 0.72], [T.c3, -100, -320, 0.76]]);
shot(T.c3, [[T.c3, 0, -700, 0.86], [T.c4, 0, -700, 0.9]]);
shot(T.c4, [[T.c4, 130, -260, 1.55], [HAT, 130, -280, 1.65], [T.c5, 130, -285, 1.7]]);
shot(T.c5, [[T.c5, -10, -150, 1.35], [T.c6, -20, -150, 1.4]]);
shot(T.c6, [[T.c6, 110, -170, 1.5], [T.tub, 120, -170, 1.56]]);
shot(T.tub, [[T.tub, -860, -230, 1.6], [KNOCKS[0], -880, -220, 1.8], [T.c7, -890, -215, 1.86]]);
shot(T.c7, [[T.c7, 150, -250, 1.3], [DUR, 160, -255, 1.36]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.no, 9], [KNOCKS[0], 6], [KNOCKS[1], 6]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function sitDown(o, x) { const k = (o.s ?? S) / S; o.hip = [x, -30 * k]; o.feet = { near: [x + 118 * k, 0], far: [x + 140 * k, 0] }; o.lean = -0.08; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const shiver = (o, t, k = 1) => { o.hip = [o.hip[0] + 2.5 * k * Math.sin(t * 47), o.hip[1]]; return o; };
// everything on him after step 2: the thin layers (the jacket over the striped vest), the hat, the scarf
const dressUp = (o, t) => { o.jacket = true; o.hat = true; o.scarf = 'neck'; o.scarfWave = 0.3 * Math.sin(t * 2); return o; };

const STOVE = { x0: 470, x1: 770, top: -226 };
const KNOB = [STOVE.x0 + 60, STOVE.top + 40];
const ICE_Y = -150;                                            // the ice on the tub's water

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'night' && sc !== 'day') return { h: null, d: null };
  // —— the stove: in the striped vest, shivering; the hand goes to the knob, «Нельзя» pulls it back ——
  if (t < T.c2) {
    const o = shiver(stand(base(t, { look: [0.6, 0.4], brow: 0.3, lean: 0.1 }), 380), t);
    const sh = shoulder(o), reach = seg(T.knob - 0.2, T.knob + 0.3, t) * (1 - seg(T.no, T.no + 0.35, t));
    o.hands = { near: { p: [lerp(sh[0] + 40, KNOB[0] - 6, reach), lerp(sh[1] + 100, KNOB[1], reach)], shape: reach > 0.6 ? 'grip' : 'open' }, far: { p: [sh[0] + 10, sh[1] + 60], shape: 'fist' } };
    if (t > T.no) { o.pop = clamp(sp(t, T.no, 2.4, 7)) * (1 - seg(T.no + 0.6, T.no + 1.1, t)); o.brow = 0.8; o.mouth = 0.3; }
    if (t > T.gas) { o.look = [0.3, -0.6]; o.brow = 0.9; }
    const d = { x: 200, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.35, t, blink: dblink(t), ears: t > T.no ? 1 : 0.4 };
    return { h: o, d, breath: true };
  }
  // —— step 2: standing in the middle of the kitchen; three thin layers, the hat, the scarf ——
  if (t < T.c5) {
    const n = layersOn(t);
    const o = shiver(stand(base(t, { look: [0.8, 0], brow: 0.2, lean: 0.02 }), 130), t, 1 - n / 3);
    if (n >= 3) o.jacket = true;
    if (t > HAT - 0.35) { o.hat = true; o.hatJump = 260 * (1 - clamp(sp(t, HAT - 0.35, 2.4, 9))); }
    if (t > SCARF) { o.scarf = 'neck'; o.scarfWave = 0.4 * Math.sin(t * 2); }
    if (t > SCARF + 0.1) { o.mouth = 0.3; o.brow = 0.5; o.lid = 0.1; }
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 40, sh[1] + 140], shape: 'fist' }, far: { p: [sh[0] - 10, sh[1] + 150], shape: 'fist' } };
    if (n >= 3) o.hands = { near: { p: [sh[0] + 60, sh[1] + 90], shape: 'thumb', ang: -Math.PI / 2 * clamp(sp(t, LAYERS[2] + 0.35, 2.4, 7)) } };
    const d = { x: -60, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.45, t, blink: dblink(t), wag: n >= 3 ? 0.6 : 0, wagPh: t * 3 };
    return { h: o, d, breath: n < 3 };
  }
  // —— step 3: dressed, sitting by the wall with the dog; listening ——
  if (t < T.c6) {
    const o = dressUp(sitDown(base(t, { look: [0.6, 0.2], brow: 0.3 }), -160), t);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 90, sh[1] + 90], shape: 'fist' }, far: { p: [sh[0] + 70, sh[1] + 110], shape: 'fist' } };
    const d = { x: 60, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.4, t, blink: dblink(t), ears: 0.5 };
    return { h: o, d, breath: true };
  }
  // —— the morning: under one blanket by the wall; the dog's nose out from under it ——
  if (t < T.tub) {
    const o = dressUp(sitDown(base(t, { look: [0.7, -0.1], brow: 0.1, lid: 0.55, mouth: 0.1 }), -60), t);
    if (t > A.L6w3) { o.lid = 0.3; o.mouth = 0.25; o.look = [-0.7, 0.4]; }
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 90, sh[1] + 90], shape: 'fist' } };
    return { h: o, d: null, blanket: true, breath: true };
  }
  // —— the bathroom: he knocks on the ice in the tub ——
  if (t < T.c7) {
    const o = dressUp(stand(base(t, { face: -1, look: [-0.6, 0.6], brow: 0.6, lean: 0.14 }), -640), t);
    const sh = shoulder(o), knock = Math.max(...KNOCKS.map(k => bump(seg(k - 0.25, k + 0.12, t, u => u)))), hit = KNOCKS.some(k => t > k && t < k + 0.3);
    o.hands = { near: { p: [lerp(sh[0] - 60, -880, Math.max(knock, 0.6)), lerp(sh[1] + 40, ICE_Y - 30 - 50 * (1 - knock), Math.max(knock, 0.6))], shape: 'fist' } };
    if (hit) { o.pop = 0.6; o.brow = 0.9; o.mouth = 0.35; }
    const d = { x: -470, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t), ears: 1, mouth: 0.3, tongue: 0.4 };
    return { h: o, d, breath: true };
  }
  // —— «Подписывайся»: a thumbs up to us ——
  const o = dressUp(stand(base(t, { look: [0.8, 0], brow: 0.6, mouth: 0.35, lean: 0.02 }), 150), t);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  const d = { x: -60, y: 0, s: DS, face: 1, sit: 1, look: 0.4, mouth: 0.7, tongue: 0.8, wag: 1, wagPh: t * 3, t, blink: dblink(t) };
  return { h: o, d, breath: true };
}

// —— the new props ——
// the gas stove: four burners, the oven door, the knobs along the front
function stove(t) {
  const { x0, x1, top } = STOVE;
  rrect(x0, top, x1 - x0, -top, 10, '#eef0f2'); rect(x0, top, x1 - x0, 18, '#c9d0d6');
  rrect(x0 + 30, top + 70, x1 - x0 - 60, -top - 100, 10, '#3a3f4a'); rrect(x0 + 50, top + 90, x1 - x0 - 100, -top - 150, 8, '#252a33');
  rect(x0 + 60, top + 76, x1 - x0 - 120, 8, '#c9d0d6');
  for (let i = 0; i < 4; i++) { const k = [KNOB[0] + i * 56, KNOB[1]]; ell(k[0], k[1], 13, 13, '#2c3140'); rect(k[0] - 2, k[1] - 12, 4, 10, '#9aa3b2'); }
  for (const bx of [x0 + 80, x0 + 220]) { ell(bx, top - 4, 46, 8, '#2c3140'); ell(bx, top - 8, 22, 5, '#555c6a'); }
}
// the grey cloud of carbon monoxide rolling out of the stove
function coCloud(t, k) {
  if (k <= 0.01) return;
  for (let i = 0; i < 12; i++) {
    const u = clamp(k * 1.4 - i * 0.06), r = (50 + 70 * u) * (0.7 + 0.5 * hash(i * 3.3));
    if (u <= 0) continue;
    ell(STOVE.x0 + 150 + (hash(i * 7.1) - 0.5) * 420 * u + 20 * Math.sin(t * 1.2 + i), STOVE.top - 40 - 300 * u * hash(i * 1.9), r, r * 0.7, rgba('#9aa4b2', 0.22 * u));
  }
}
// snowflakes over a rectangle (screen or world), falling and drifting
function snow(t, x0, y0, w, h, n = 120, size = 5, a = 0.8) {
  for (let i = 0; i < n; i++) {
    const sp2 = 40 + 60 * hash(i * 1.7), y = y0 + ((hash(i * 3.1) * h + t * sp2) % h), x = x0 + ((hash(i * 5.3) * w + 18 * Math.sin(t * 0.9 + i)) % w + w) % w;
    ell(x, y, size * (0.4 + 0.6 * hash(i)), size * (0.4 + 0.6 * hash(i)), rgba('#f3f8ff', a * (0.4 + 0.6 * hash(i * 9.1))));
  }
}
// frost round the edges of the kitchen window, falling snow in it
function frost(t, day) {
  const { x0, x1, y0, y1 } = Ap.WIN;
  inside(rrPath(x0, y0, x1 - x0, y1 - y0, 2), () => {
    snow(t, x0, y0, x1 - x0, y1 - y0, 40, 4, day ? 0.9 : 0.6);
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 170); gr.addColorStop(0, 'rgba(235,246,255,0.85)'); gr.addColorStop(1, 'rgba(235,246,255,0)');
      g.fillStyle = gr; g.fillRect(cx - 170, cy - 170, 340, 340);
    }
    for (let i = 0; i < 18; i++) {                                // the crystal feathers in the corners
      const c = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]][i % 4], a = (i % 4 === 0 ? 0.8 : i % 4 === 1 ? 2.35 : i % 4 === 2 ? -0.8 : -2.35) + (hash(i) - 0.5) * 0.9, l = 50 + 70 * hash(i * 2.3);
      const p = [c[0] + Math.cos(a) * l, c[1] + Math.sin(a) * l];
      limb([c, p], 3, 'rgba(255,255,255,0.75)', false);
      for (const s of [-1, 1]) limb([[lerp(c[0], p[0], 0.6), lerp(c[1], p[1], 0.6)], [lerp(c[0], p[0], 0.6) + Math.cos(a + s * 0.7) * 18, lerp(c[1], p[1], 0.6) + Math.sin(a + s * 0.7) * 18]], 2, 'rgba(255,255,255,0.7)', false);
    }
  });
}
// a puff of breath in the cold from (x, y): small clouds every 1.4 s that rise and fade
function breath(t, [x, y], dir = 1) {
  for (let i = 0; i < 2; i++) {
    const u = ((t + i * 0.7) % 1.4) / 1.4;
    if (u > 0.85) continue;
    ell(x + dir * (20 + 70 * u), y - 30 * u, 12 + 26 * u, 9 + 18 * u, rgba('#eef6ff', 0.55 * (1 - u / 0.85)));
  }
}
// the plaid blanket over him and the dog, the dog's nose out from under its edge
function blanket(t, x) {
  const sw = 2 * Math.sin(t * 1.6);
  const p = smoothPath([[x - 60, -140], [x + 120, -175 + sw], [x + 330, -150], [x + 380, -40], [x + 360, 0], [x - 80, 0], [x - 90, -100]]);
  fill(p, '#c4473a');
  inside(p, () => {
    for (let i = 0; i < 10; i++) { rect(x - 100 + i * 52, -260, 16, 280, 'rgba(255,236,200,0.45)'); rect(x - 100, -230 + i * 30, 520, 8, 'rgba(60,20,20,0.18)'); }
    ell(x + 250, -80, 120, 60, 'rgba(0,0,0,0.08)');
  });
  const nx = x + 372 + 3 * Math.sin(t * 2.3), ny = -52;                   // the dog's nose and a bit of muzzle
  ell(nx - 18, ny + 4, 30, 18, '#f2efe6'); ell(nx, ny, 13, 10, '#1e1f26'); ell(nx - 4, ny - 4, 4, 3, '#6b6f80');
  if ((t % 2.4) < 0.6) for (let i = 0; i < 2; i++) { const u = ((t % 2.4) / 0.6 + i * 0.4) % 1; ell(nx + 20 + 40 * u, ny - 10 - 20 * u, 8 + 12 * u, 6 + 8 * u, rgba('#eef6ff', 0.5 * (1 - u))); }
}
// the ice on the tub: a white-blue crust at the water, cracks where he knocks
function tubIce(t) {
  const { in0, in1, rim, bot } = Ap.TUB;
  const win = rrPath(in0 + 30, rim + 30, in1 - in0 - 60, bot - rim - 50, 22);
  inside(win, () => {
    rect(in0, ICE_Y - 10, in1 - in0, 26, '#dff2ff'); rect(in0, ICE_Y - 10, in1 - in0, 6, '#ffffff');
    for (let i = 0; i < 7; i++) limb([[in0 + 40 + i * 60, ICE_Y - 6], [in0 + 70 + i * 60, ICE_Y + 14]], 2, 'rgba(120,170,210,0.6)', false);
  });
  // the crust seen over the rim: a pale sheet with a glint
  rect(Ap.TUB.x0 + 14, rim - 18, Ap.TUB.x1 - Ap.TUB.x0 - 28, 8, '#e6f6ff');
  const n = KNOCKS.filter(k => t > k).length;
  for (let j = 0; j < n; j++) for (let i = 0; i < 5; i++) { const a = -Math.PI + i * 0.5 + j * 0.3; limb([[-880, rim - 14], [-880 + Math.cos(a) * 60, rim - 14 + Math.sin(a) * 8]], 3, 'rgba(110,160,200,0.8)', false); }
}

// —— the night light: darkness over the flat with holes where the torch, the window and the stove light it ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
function lighting(t, cam, lights, amount = 0.86) {
  if (amount <= 0.005) return;
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(4,7,17,${amount})`; dk.fillRect(0, 0, W, H);
  dk.globalCompositeOperation = 'destination-out';
  const z = scaleOf(cam);
  const shapes = [];
  for (const L of lights) {
    const [x, y] = toScreen(cam, L.p), r = L.r * z;
    if (!(r > 1)) continue;                       // a light that has shrunk to nothing (a gradient of radius ≤ 0 throws)
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
  if (sc === 'city') cityFrame(t, cam);
  else if (sc === 'thermal') thermalFrame(t, cam);
  else if (sc === 'plan') planFrame(t, cam);
  else flatFrame(t, cam, sc === 'day');
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'plan' || sc === 'thermal' ? 0.6 : 1);
}

// —— outside: the city at night in the snow ——
function cityFrame(t, cam) {
  Cy.drawCity(t, cam, { t0: -1e9, day: 0, home: 1, fires: [], inside: (x, y, w, h) => ourWindow(t, x, y, w, h) });
  g.setTransform(1, 0, 0, 1, 0, 0);
  snow(t, 0, 0, W, H, 160, 7, 0.75);
}
function ourWindow(t, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  rect(x, y, w, h, '#151a2b');
  const sw = 0.3 * Math.sin(t * 1.7), ox = x + w * 0.2, oy = y + h * 0.72;
  fill(polyPath([[ox, oy], [ox + Math.cos(-0.4 + sw) * 160, oy + Math.sin(-0.4 + sw) * 160], [ox + Math.cos(0.3 + sw) * 160, oy + Math.sin(0.3 + sw) * 160]]), 'rgba(255,196,110,0.75)');
  ell(ox, oy, 6, 6, '#fff2c8');
  MONO.on = true; MONO.color = '#0b0f1a';
  drawHunter(shiver(stand(base(t, { s: 0.11, face: -1, look: [-1, 0] }), x + w * 0.62, y + h + 10), t, 0.2));
  drawDog({ x: x + w * 0.2, y: y + h + 4, s: 0.12, face: 1, sit: 1, t });
  MONO.on = false;
  // frost in the corners of our window
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) ell(cx, cy, w * 0.3, h * 0.3, 'rgba(230,244,255,0.5)');
  g.restore();
}

// —— the flat: at night (the torch, the window), or on the morning after ——
function flatFrame(t, cam, day) {
  const { h, d, blanket: under, breath: cold } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t, {});
  Ap.drawWindow(t, { day: day ? 1 : 0 });
  frost(t, day);
  Ap.drawTub(t, { level: 0.8, run: 0 });
  if (day && t >= T.tub) tubIce(t);
  Ap.drawToilet(t, {});
  Ap.drawFridge(t);
  Ap.drawCounter(t, { fills: [1, 1, 1, 0.6, 0.3] });
  stove(t);
  Ap.drawBowl(t, 0.3);
  let dl = null, A2 = null;
  if (d) dl = drawDog(d);
  if (h) A2 = drawHunter(h);
  if (under) blanket(t, h.hip[0] - 20);
  if (t >= T.c1 && t < T.c2) coCloud(t, seg(T.gas, T.gas + 1.0, t, u => u));
  if (cold && A2?.mouth) breath(t, A2.mouth, h.face === -1 ? -1 : 1);
  // the darkness at night
  if (!day) {
    const lights = [{ p: [(Ap.WIN.x0 + Ap.WIN.x1) / 2, (Ap.WIN.y0 + Ap.WIN.y1) / 2], r: 480, k: 0.5, tint: '#9fc8ff' }];
    if (dl?.lens && d.torch) lights.push({ p: dl.lens, a: dl.beamAng, r: 1150, k: 0.97, cone: true, spread: 0.42, tint: '#ffcf7a' });
    if (h) lights.push({ p: [h.hip[0] + 30, h.hip[1] - 140], r: 420, k: 0.55, tint: '#ffcf7a' });
    lighting(t, cam, lights, 0.78);
  }
}

// —— the thermal camera: the flat in section in false colour; the heat leaves every room, then two warm figures ——
const THERM = ['#140a36', '#3a1a8a', '#9c2a86', '#e2572e', '#ffb340', '#fff3c0'];
function therm(v) {
  v = clamp(v) * (THERM.length - 1);
  const i = Math.min(THERM.length - 2, Math.floor(v));
  return mix(THERM[i], THERM[i + 1], v - i);
}
function thermalFrame(t, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0a0620'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const cool = seg(A.L2w1 - 0.1, A.L2w5 + 0.3, t);              // «тепло уходит … сразу»
  const { x0, x1, ceil } = Ap.ROOM;
  // three floors of the block: ours in the middle, the neighbours above and below colder still
  for (const j of [-1, 0, 1]) {
    const oy = j * 900, base0 = j === 0 ? lerp(0.8, 0.16, cool) : 0.12;
    g.save(); g.translate(0, oy);
    for (const [a, b] of [[x0, Ap.PART.x0], [Ap.PART.x1, x1]]) {
      fill(rrPath(a, ceil, b - a, -ceil, 6), therm(base0));
      for (let i = 0; i < 6; i++) {                              // warm patches that shrink as the flat cools
        const cx = lerp(a + 80, b - 80, hash(i * 3.3 + j)), cy = lerp(ceil + 100, -80, hash(i * 7.7 + j)), r = (180 + 120 * hash(i)) * (j === 0 ? 1 - 0.6 * cool : 0.6);
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, rgba(therm(base0 + (j === 0 ? 0.22 * (1 - cool) + 0.06 : 0.05)), 0.9)); gr.addColorStop(1, rgba(therm(base0), 0));
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    }
    if (j === 0) {                                             // the furniture as pale silhouettes: the rooms read as our flat
      MONO.on = true; MONO.color = 'rgba(200,215,255,0.16)';
      Ap.drawTub(t, { level: 0 }); Ap.drawToilet(t, {}); Ap.drawFridge(t); Ap.drawCounter(t, {}); stove(t); Ap.drawWindow(t, {});
      MONO.on = false;
    }
    g.lineWidth = 6; g.strokeStyle = 'rgba(160,190,255,0.35)'; g.strokeRect(x0, ceil, x1 - x0, -ceil);
    g.restore();
  }
  // the heat leaving through the walls and the window: chevrons drifting outward
  if (cool > 0.01 && cool < 0.99 || t < T.self + 0.5) for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, u = ((t * 0.6 + i * 0.13) % 1), y = lerp(ceil + 80, -80, hash(i * 2.1)), x = (side > 0 ? x1 : x0) + side * 160 * u;
    g.save(); g.globalAlpha = 0.8 * bump(u) * (1 - seg(T.self, T.self + 0.6, t)); g.translate(x, y);
    limb([[-14 * side, -18], [10 * side, 0], [-14 * side, 18]], 10, therm(0.7 - 0.5 * u), false); g.restore();
  }
  // «а себя»: the hunter and the dog glowing warm in the cold flat
  const k = clamp(sp(t, T.self, 2.4, 8));
  if (k > 0.01) {
    for (const [cx, cy, r] of [[-60, -230, 330], [130, -90, 180]]) { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * k); gr.addColorStop(0, rgba(therm(0.75), 0.6)); gr.addColorStop(1, rgba(therm(0.4), 0)); g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    MONO.on = true; MONO.color = therm(0.9);
    drawHunter(dressUp(stand(base(t, { s: 0.6 }), -60), t));
    drawDog({ x: 130, y: 0, s: DS, face: 1, sit: 1, t });
    MONO.on = false;
    Hd.label('+36,6°', -60, -560, 64, therm(1), { fam: FONTS.mono, shadow: false, stroke: false, a: k });
  }
}

// —— step 1, the plan from above: the family gathers in one room, the doors to the others close one after another ——
const ROOMS = [
  { n: 'КОМНАТА', x0: -480, y0: -1300, x1: 480, y1: -760, warm: true },
  { n: 'СПАЛЬНЯ', x0: -480, y0: -760, x1: -80, y1: 0 },
  { n: 'КУХНЯ', x0: 80, y0: -760, x1: 480, y1: -300 },
  { n: 'ВАННАЯ', x0: 80, y0: -300, x1: 480, y1: 0 },
];
// each door: hinge, the direction along the wall when shut, the direction into the corridor when open
const DOORS = [
  { h: [-80, -560], shut: [0, 1], open: [1, 0] },
  { h: [80, -700], shut: [0, 1], open: [-1, 0] },
  { h: [80, -240], shut: [0, 1], open: [-1, 0] },
];
const doorClose = (t, i) => seg(A.L3w6 - 0.1 + i * 0.32, A.L3w6 + 0.25 + i * 0.32, t);
function planFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const gather = seg(A.L3w1 - 0.1, A.L3w4, t), warm = seg(A.L3w2, A.L3e, t);
  for (const [i, R] of ROOMS.entries()) {
    const shut = R.warm ? 0 : doorClose(t, i - 1);
    fill(rrPath(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, 4), R.warm ? rgba(P.warm, 0.32 * warm) : rgba('#3b8eea', 0.18 * shut));
    Hd.label(R.n, (R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 + 14, 46, R.warm ? mix(P.text, P.warm, warm) : P.text, { fam: FONTS.mono, shadow: false, stroke: false });
    if (!R.warm && shut > 0.9) Hd.label('холодно', (R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2 + 64, 30, rgba(ICE, shut), { fam: FONTS.mono, shadow: false, stroke: false });
  }
  // the walls (with a gap for each doorway) and the corridor
  const wall = (pts, w = 8) => Sc.gline(pts, w, P.line, P);
  wall([[PL.x0, PL.y0], [PL.x1, PL.y0], [PL.x1, PL.y1], [PL.x0, PL.y1], [PL.x0, PL.y0]]);
  wall([[PL.x0, -760], [-60, -760]]); wall([[60, -760], [PL.x1, -760]]);
  wall([[-80, -760], [-80, -560]]); wall([[-80, -450], [-80, 0]]);
  wall([[80, -760], [80, -700]]); wall([[80, -590], [80, -300], [PL.x1, -300]]); wall([[80, -300], [80, -240]]); wall([[80, -130], [80, 0]]);
  for (const [i, D] of DOORS.entries()) {
    const k = doorClose(t, i), a0 = Math.atan2(D.open[1], D.open[0]), a1 = Math.atan2(D.shut[1], D.shut[0]);
    let da = a1 - a0; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
    const a = a0 + da * k, L = 110;
    Sc.gline([D.h, [D.h[0] + Math.cos(a) * L, D.h[1] + Math.sin(a) * L]], 7, k > 0.95 ? P.hi : P.warm, P);
    g.save(); g.setLineDash([10, 10]); g.lineWidth = 3; g.strokeStyle = rgba(P.line, 0.6); g.beginPath(); g.arc(D.h[0], D.h[1], L, Math.min(a0, a0 + da), Math.max(a0, a0 + da)); g.stroke(); g.restore();
  }
  // the two of them: warm dots walking up the corridor into the room
  const path = u => [lerp(0, -260, u), lerp(-200, -900, u)];
  const p1 = path(gather), p2 = path(Math.max(0, gather - 0.12));
  ell(p1[0], p1[1], 26, 26, P.warm); ell(p2[0] + 70, p2[1] + 40, 18, 18, P.warm);
  Hd.label('ТЫ', p1[0] - 50, p1[1] + 10, 34, P.warm, { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c3 - 0.1, 'ДЕНЬ 2 — 21:30');
  Hd.timeStamp(t, T.c4 + 0.05, T.c6 - 0.1, 'ДЕНЬ 2 — 22:15');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ДЕНЬ 3 — 07:40');
  // the hook: the thermometer in the room falls from +22 to +12
  if (sc === 'city') thermometer(t, 860, 560);
  // the stove
  if (t >= T.c1 && t < T.c2) {
    const p = S2([STOVE.x0 + 150, STOVE.top - 40]); Hd.redX(p[0], p[1], 80, sp(t, T.no, 2.6, 8));
    Hd.plaque(t, T.gas, T.c2 - 0.05, 540, 330, { icon: 'cloud', title: 'УГАРНЫЙ ГАЗ', sub: 'как в прошлой серии', color: DANGER, to: S2([STOVE.x0 + 150, STOVE.top - 200]) });
  }
  Hd.ribbon(t, T.no, T.gas - 0.15, 'НЕ ГРЕЙСЯ У ПЛИТЫ', { y: 760, size: 92 });
  // the thermal camera: the scale, then the thought
  if (sc === 'thermal') {
    thermScale(t, 990, 600);
    Hd.plaque(t, T.self + 0.1, T.c3 - 0.05, 540, 330, { icon: 'snow', title: 'ГРЕЙ СЕБЯ', sub: 'а не квартиру', color: WARM });
  }
  // step 1
  Hd.stepHeader(t, 1, 'ОДНА КОМНАТА', A.L3 + 0.02, A.L3e - 0.05);
  if (sc === 'plan') Hd.plaque(t, A.L3w6 + 0.6, T.c4 - 0.02, 540, 1640, { icon: 'house', title: 'ДВЕРИ ЗАКРЫТЫ', sub: 'тепло остаётся с тобой', color: GOLD, to: S2([60, -760]) }); 
  // step 2: the layers fly on, the counter
  Hd.stepHeader(t, 2, 'СЛОИ ОДЕЖДЫ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) {
    const o = actorsAt(t).h, chest = o ? S2([o.hip[0], o.hip[1] - 120]) : [540, 900];
    layerIcons(t, chest);
    const n = layersOn(t);
    if (n > 0) Hd.plaque(t, LAYERS[0] + 0.35, A.L4w8 - 0.1, 830, 620, { icon: 'check', title: `СЛОЙ ×${n}`, color: OK, size: 50 });
    Hd.plaque(t, A.L4w5 - 0.08, T.c5 - 0.02, 540, 1560, { icon: 'check', title: 'ТОНКИЕ СЛОИ ТЕПЛЕЕ', sub: 'чем один толстый', color: OK });
  }
  // step 3: the card
  Hd.stepHeader(t, 3, 'ПЕРЕОХЛАЖДЕНИЕ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) hypoCard(t, 540, 760);
  // the morning
  if (t >= T.c6 && t < T.tub) Hd.plaque(t, A.L6w3 - 0.05, T.tub - 0.02, 540, 560, { icon: 'snow', title: 'ПОД ОДНИМ ОДЕЯЛОМ', sub: 'вдвоём теплее', color: WARM });
  if (t >= T.tub && t < T.c7) Hd.plaque(t, A.L6w20 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'bath', title: 'ЛЁД В ВАННЕ', sub: 'вода из 1-й серии', color: ICE, to: S2([-980, ICE_Y - 20]) });
  // the end
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'САМАЯ ХОЛОДНАЯ ЗИМА?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// the room thermometer on the right: the red column falls with «остыли батареи»
function thermometer(t, x, y) {
  const k = clamp(sp(t, A.L0w2, 2.4, 8));
  if (k <= 0.01) return;
  const deg = Math.round(lerp(22, 12, seg(T.cold, T.cold + 1.4, t))), h = 420, col = lerp(0.84, 0.46, seg(T.cold, T.cold + 1.4, t));
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.85, 1, k), lerp(0.85, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-90, -h / 2 - 50, 180, h + 170, 30, 'rgba(11,15,26,0.9)'); g.restore();
  rrect(-22, -h / 2, 44, h, 22, '#e9eef5'); ell(0, h / 2 + 30, 44, 44, '#e9eef5');
  const top = h / 2 - h * col;
  rrect(-12, top, 24, h / 2 - top + 20, 12, deg > 16 ? '#e53935' : mix('#e53935', '#3b8eea', 0.6)); ell(0, h / 2 + 30, 32, 32, deg > 16 ? '#e53935' : mix('#e53935', '#3b8eea', 0.6));
  for (let i = 0; i <= 6; i++) rect(24, -h / 2 + 30 + i * (h - 60) / 6, 16, 4, '#9aa8bc');
  Hd.label(`+${deg}°`, 0, -h / 2 - 8, 52, deg > 16 ? '#ffffff' : ICE, { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
// the thermal camera's scale bar on the right
function thermScale(t, x, y) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const h = 520, gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  THERM.slice().reverse().forEach((c, i) => gr.addColorStop(i / (THERM.length - 1), c));
  rrect(x - 26, y - h / 2 - 10, 52, h + 20, 12, 'rgba(11,15,26,0.8)'); g.fillStyle = gr; g.fillRect(x - 14, y - h / 2, 28, h);
  Hd.label('+36', x - 40, y - h / 2 + 14, 30, '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  Hd.label('+10', x - 40, y + h / 2, 30, '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  rrect(36, 230, 300, 64, 12, 'rgba(11,15,26,0.8)');
  ell(66, 262, 10, 10, (t % 1) < 0.6 ? '#e53935' : 'rgba(229,57,53,0.3)');
  Hd.label('ТЕПЛОВИЗОР', 90, 274, 34, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
}
// the three thin layers as flat icons that fly in from the right and land on his chest
const LAYER_C = [['#e9e4d8', '#c9c2b2'], ['#4f86c6', '#3c6aa3'], ['#7a9a5a', '#5f7c45']];
function layerIcons(t, [cx, cy]) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  LAYERS.forEach((t0, i) => {
    const u = seg(t0 - 0.05, t0 + 0.35, t, ease.out);
    if (u <= 0 || u >= 1) return;
    const x = lerp(1180, cx, u), y = lerp(500 + i * 90, cy, u) - 160 * bump(u), s = lerp(1.2, 0.6, u);
    g.save(); g.translate(x, y); g.rotate(0.6 * (1 - u)); g.scale(s, s); g.globalAlpha = 1 - 0.6 * seg(0.7, 1, u, u2 => u2);
    const [c, c2] = LAYER_C[i];
    poly([[-60, -70], [-24, -84], [24, -84], [60, -70], [100, -20], [76, 4], [50, -18], [50, 80], [-50, 80], [-50, -18], [-76, 4], [-100, -20]], c);
    rect(-50, 50, 100, 30, c2);
    if (i === 1) for (let j = 0; j < 3; j++) rect(-50, -20 + j * 26, 100, 8, c2);
    g.restore();
  });
}
// step 3: the paper card with the three signs, the red frame «СРОЧНО В ТЕПЛО»
function hypoCard(t, cx, cy) {
  const k = clamp(sp(t, T.c5 + 0.08, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const w = 760, h = 640;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(-0.02); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 36; g.shadowOffsetY = 12; rrect(-w / 2, -h / 2, w, h, 18, '#f6f2e7'); g.restore();
  for (let i = 0; i < 9; i++) rect(-w / 2 + 30, -h / 2 + 140 + i * 56, w - 60, 2, 'rgba(59,142,234,0.25)');
  rect(-w / 2 + 90, -h / 2, 3, h, 'rgba(214,52,47,0.35)');
  Hd.label('ПРИЗНАКИ', -w / 2 + 120, -h / 2 + 90, 54, '#17162f', { align: 'left', shadow: false, stroke: false });
  const rows = ['дрожь не проходит', 'путаются мысли', 'клонит в сон'];
  rows.forEach((r, i) => {
    const a = clamp((t - SIGNS[i]) / 0.15);
    if (a <= 0) return;
    const y = -h / 2 + 200 + i * 100;
    ell(-w / 2 + 140, y - 14, 22, 22, rgba('#d6342f', a));
    Hd.label(String(i + 1), -w / 2 + 140, y, 30, rgba('#ffffff', a), { fam: FONTS.mono, shadow: false, stroke: false });
    Hd.label(r, -w / 2 + 186, y, 44, rgba('#17162f', a), { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  });
  const urg = clamp(sp(t, A.L5w13 - 0.08, 2.6, 8));
  if (urg > 0.01) {
    g.save(); g.translate(0, h / 2 - 90); g.scale(lerp(1.4, 1, Math.min(1, urg)), lerp(1.4, 1, Math.min(1, urg))); g.rotate(-0.03);
    rrect(-320, -48, 640, 96, 12, '#d6342f'); rrect(-312, -40, 624, 80, 8, '#e53935');
    Hd.label('СРОЧНО В ТЕПЛО И К ВРАЧУ', 0, 16, 42, '#ffffff', { shadow: false, stroke: false });
    g.restore();
  }
  g.restore();
}

// —— the poster in the first frames: him in all his layers, the dog in a plaid, breath in the torch light ——
function coverFrame(t) {
  const cam = { x: 360, y: -330, z: 1.55, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t); Ap.drawWindow(t, {}); frost(t, 0); Ap.drawCounter(t, {}); stove(t);
  const o = dressUp(stand(base(t, { s: 0.95, face: 1, pop: 0.6, brow: 0.9, mouth: 0.5, look: [0.7, -0.1], blink: 0, lean: -0.05 }), 220, 120), t);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 60, sh[1] + 120], shape: 'fist' }, far: { p: [sh[0] + 30, sh[1] + 130], shape: 'fist' } };
  const dl = drawDog({ x: 460, y: 60, s: 1.05, face: 1, sit: 1, torch: true, look: 0.15, t: 0, ears: 0.2 });
  // the plaid over the dog's back
  fill(smoothPath([[300, -150], [420, -230], [520, -170], [540, -40], [300, -30]]), '#c4473a');
  inside(smoothPath([[300, -150], [420, -230], [520, -170], [540, -40], [300, -30]]), () => { for (let i = 0; i < 6; i++) { rect(290 + i * 44, -240, 14, 220, 'rgba(255,236,200,0.45)'); rect(290, -220 + i * 34, 260, 7, 'rgba(60,20,20,0.18)'); } });
  const A2 = drawHunter(o);
  breath(0.6, A2.mouth, 1); breath(1.1, A2.mouth, 1);
  lighting(t, cam, [{ p: dl.lens, a: dl.beamAng - 0.55, r: 900, k: 0.97, cone: true, spread: 0.55, tint: '#ffcf7a' }, { p: [Ap.WIN.x0 + 150, Ap.WIN.y0 + 160], r: 380, k: 0.5, tint: '#9fc8ff' }, { p: [260, -420], r: 560, k: 0.78, tint: '#ffcf7a' }], 0.8);
  g.setTransform(1, 0, 0, 1, 0, 0);
  snow(0.5, 0, 0, W, 700, 50, 6, 0.5);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ЗИМА', 0, 210, 150, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(120,200,255,0.9)'; g.shadowBlur = 40; Hd.label('БЕЗ ТЕПЛА', 0, 370, 120, ICE, { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 4 · 20 ЭТАЖ', pw = measure(pl, 56, FONTS.cond) + 60;
  rect(-pw + 8, 430 + 8, pw, 92, INK); rect(-pw, 430, pw, 92, '#ffd43b'); text(pl, -pw / 2, 494, 56, '#111111', { fam: FONTS.cond, shadow: false });
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
  // the shiver is a few pixels at 47 rad/s: blur it rather than let it strobe
  return Math.min(m * (0.5 / (2 * h * 60)), 40);
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.3, 'city', -20, 0, { dur: T.c1 - 0.3 });
  add(A.L0w2, 'blip', -10, 0.3);
  add(T.cold, 'ticks_up', -16, 0.3, { dur: 1.2 });
  add(T.c1, 'amb_flat', -20, 0, { dur: T.c2 - T.c1 });
  add(T.knob - 0.05, 'click', -10, 0.2);
  add(T.no, 'stamp', -5, 0.1);
  add(T.no, 'ribbon', -8, 0);
  add(T.gas, 'puff', -10, 0.2);
  add(T.gas, 'blip', -10, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.self, 'ding', -10, 0);
  add(T.c3, 'whoosh', -12, 0);
  DOORS.forEach((_, i) => add(A.L3w6 + 0.2 + i * 0.32, 'stamp', -12, -0.2 + 0.2 * i));
  add(A.L3w6 + 0.6, 'blip', -10, 0);
  add(T.c4, 'amb_flat', -20, 0, { dur: T.c6 - T.c4 });
  LAYERS.forEach((t0, i) => { add(t0, 'whoosh_in', -14, 0.4); add(t0 + 0.35, 'pop_word', -10, 0.1 + 0.05 * i); });
  add(HAT, 'pop_word', -8, 0);
  add(SCARF, 'paper', -12, 0, { dur: 0.3 });
  add(A.L4w5 - 0.08, 'blip', -10, 0);
  add(T.c5 + 0.08, 'paper', -10, 0, { dur: 0.4 });
  SIGNS.forEach(t0 => add(t0, 'fill_plink', -12, 0.1));
  add(A.L5w13 - 0.08, 'stamp', -6, 0);
  add(T.c6, 'whoosh', -12, 0);
  add(T.c6, 'morning', -22, 0.3, { dur: T.tub - T.c6 });
  add(A.L6w3 - 0.05, 'whine', -16, 0.3, { dur: 0.6 });
  add(T.tub, 'whoosh', -14, 0);
  KNOCKS.forEach(k => add(k, 'stamp', -8, -0.3));
  add(A.L6w20 - 0.1, 'blip', -10, 0);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
