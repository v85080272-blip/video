// «Свет дали» (блэкаут, ч.7): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// It goes on from part 6: the radio was right, the power is back on the fifth day. The city's windows come back on in a
// wave (part 1's blackout run backwards), the climb home up the stairs, then the flat: everything plugged in at once and
// the lamp flickering, the appliances switched on one at a time, the pipe in the bathroom opened slowly and found
// cracked, the thawed food from the freezer into the bin, and the evening: +20, the ice in the tub gone, the dog asleep
// by the radiator.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
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
const FB = { L0: [0.12, 4.78, 12], L1: [5.18, 12.38, 18], L2: [12.78, 16.41, 10], L3: [16.86, 20.82, 11], L4: [21.22, 27.45, 19], L5: [27.86, 32.94, 13], L6: [33.38, 38.41, 15], L7: [38.87, 42.34, 11] };
export const DUR = VOICE?.dur ?? 42.69;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm, ICE = '#8fd3ff';
const HOT = { СВЕТ: GOLD, ДОМОЙ: GOLD, ДВАДЦАТЫЙ: GOLD, ВСЁ: DANGER, СПЕШИ: DANGER, ПОГАСНЕТ: DANGER, ПРОВЕРКИ: GOLD,
  ОДНОЙ: GOLD, МИНУТ: GOLD, ПОНЕМНОГУ: GOLD, ТЕЧИ: DANGER, ЛОПНУТЬ: DANGER, ПЕРЕКРОЙ: DANGER, ОТТАЯЛО: ICE, ВЫБРОСЬ: DANGER,
  ВЫБРАСЫВАЙ: DANGER, ДВАДЦАТЬ: GOLD, РАСТАЯЛ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster
  on: A.L0w5 - 0.05,                 // «свет дали»: the windows come back on
  climb: A.L0w7 - 0.06,              // «Пора домой, на двадцатый этаж»: up the stairs
  c1: A.L1 - 0.06,                   // «Хочется сразу включить всё»: the flat, everything into one strip
  plug: A.L1w3 - 0.05,
  flick: A.L1w15 - 0.06,             // «и свет опять погаснет»: the lamp flickers
  c2: A.L2 - 0.06,                   // «начни с проверки»: the checklist
  c3: A.L3 - 0.06,                   // step 1: one at a time
  c4: A.L4 - 0.06,                   // step 2: the water, the pipe
  crack: A.L4w12 - 0.06,             // «мог лопнуть»: the drip from the crack
  shut: A.L4w16 - 0.06,              // «сразу перекрой кран»
  c5: A.L5 - 0.06,                   // step 3: the thawed food into the bin
  c6: A.L6 - 0.06,                   // the evening: +20
  tub: A.L6w5 - 0.06,                // «Лёд в ванне растаял»
  dog: A.L6w9 - 0.06,                // «а Пурга уснула прямо у батареи»
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
const ONES = [A.L3w1 - 0.05, A.L3w6 - 0.05, A.L3w9 - 0.05];   // the three plugs in, minutes apart
const TRASH = [A.L5w3 - 0.08, A.L5w5 - 0.08, A.L5w9 - 0.08];
export const CUTS = [T.cover, T.climb, T.c1, T.c4, T.c5, T.c6, T.tub, T.dog, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A, ONES, TRASH };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.climb ? 'city' : t < T.c1 ? 'stairs' : 'flat');

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
const FY = f => Sc.floorY(f);
shot(T.cover, [[T.cover, 0, -1250, 0.42], [T.on, 0, -1300, 0.46], [T.climb, 0, -1350, 0.5]]);
shot(T.climb, [[T.climb, -300, FY(4), 1.0], [T.c1, -300, FY(18), 1.0]]);
shot(T.c1, [[T.c1, 150, -260, 1.25], [T.flick, 160, -270, 1.3], [T.c3, 170, -270, 1.32], [T.c4 - 0.01, 180, -270, 1.34]]);
shot(T.c4, [[T.c4, -760, -300, 1.5], [T.crack, -770, -320, 1.62], [T.c5, -770, -320, 1.66]]);
shot(T.c5, [[T.c5, -160, -280, 1.5], [T.c6, -170, -280, 1.56]]);
shot(T.c6, [[T.c6, 120, -300, 1.2], [T.tub, 120, -300, 1.24]]);
shot(T.tub, [[T.tub, -980, -200, 1.7], [T.dog, -980, -200, 1.76]]);
shot(T.dog, [[T.dog, 330, -150, 2.0], [T.c7, 330, -150, 2.1]]);
shot(T.c7, [[T.c7, 100, -290, 1.25], [DUR, 110, -295, 1.3]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.flick, 6], [T.crack, 4]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// back home: the jacket off, the striped vest; the evening at +20 without the hat and scarf
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const STRIP = [120, -14];                                     // the power strip on the floor by the counter
const PIPE = { x: -800, y0: -720, y1: -230, valve: -330, crack: -500 };
const BAG = [-92, -268];
const SHELF = [-250, -150];                                   // where the thawed food comes out of the freezer
const RAD = { x0: 350, x1: 462, y0: -230, y1: -40 };          // the radiator between the counter and the stove

export function actorsAt(t) {
  if (scene(t) !== 'flat') return { h: null, d: null };
  // —— everything into one strip: the plugs in his hands; the lamp flickers ——
  if (t < T.c3) {
    const o = stand(base(t, { look: [0.4, 0.7], brow: 0.3, lean: 0.12 }), 200);
    const sh = shoulder(o), k = seg(T.plug - 0.2, T.plug + 0.3, t);
    o.hands = { near: { p: [lerp(sh[0] + 40, STRIP[0] + 30, k), lerp(sh[1] + 90, STRIP[1] - 30, k)], shape: 'grip' }, far: { p: [lerp(sh[0] + 20, STRIP[0] - 10, k), lerp(sh[1] + 110, STRIP[1] - 20, k)], shape: 'grip' } };
    if (t > T.flick) { o.look = [-0.2, -0.9]; o.brow = 0.9; o.pop = clamp(sp(t, T.flick, 2.4, 7)) * (1 - seg(T.flick + 0.6, T.flick + 1.1, t)); o.mouth = 0.3; }
    if (t > T.c2) { o.hands = { near: { p: [sh[0] + 30, sh[1] + 120], shape: 'fist' } }; o.look = [0.6, 0]; o.pop = 0; o.brow = 0.4; }
    const d = { x: -60, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: t > T.flick && t < T.c2 ? 1 : 0.5 };
    return { h: o, d };
  }
  // —— step 1: one plug at a time ——
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.4, 0.7], brow: 0.2, lean: 0.12 }), 200);
    const sh = shoulder(o), push = Math.max(...ONES.map(t0 => bump(seg(t0 - 0.3, t0 + 0.2, t, u => u))));
    o.hands = { near: { p: [lerp(sh[0] + 40, STRIP[0] + 30, push), lerp(sh[1] + 90, STRIP[1] - 30, push)], shape: 'grip' } };
    const d = { x: -60, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), wag: 0.4, wagPh: t * 2 };
    return { h: o, d };
  }
  // —— step 2: the bathroom: he opens the valve on the riser a little, sees the drip, shuts it ——
  if (t < T.c5) {
    const o = stand(base(t, { face: -1, look: [-0.5, -0.3], brow: 0.3, lean: 0.06 }), -660);
    const sh = shoulder(o);
    o.hands = { near: { p: [PIPE.x + 20, PIPE.valve + 6], shape: 'grip' } };
    if (t > T.crack) { o.look = [-0.5, 0.2]; o.brow = 0.9; o.pop = 0.4 * (1 - seg(T.crack + 0.6, T.crack + 1.1, t)); }
    void sh;
    const d = { x: -470, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t) };
    return { h: o, d };
  }
  // —— step 3: the thawed food from the freezer into the bin bag ——
  if (t < T.c6) {
    const o = stand(base(t, { face: -1, look: [-0.6, 0.3], brow: -0.2, lean: 0.14 }), 20);
    const reach = Math.max(...TRASH.map(t0 => bump(seg(t0 - 0.35, t0 + 0.15, t, u => u))));
    o.hands = { near: { p: BAG, shape: 'grip' }, far: { p: [lerp(-150, SHELF[0] + 40, reach), lerp(-300, SHELF[1], reach)], shape: reach > 0.5 ? 'grip' : 'open' } };
    o.prop = { kind: 'bag', p: BAG };
    const d = { x: 190, y: 0, s: DS, face: -1, sit: 1, beg: 0.6, look: 0.4, mouth: 0.6, tongue: 0.8, t, blink: dblink(t), wag: 1, wagPh: t * 3 };
    return { h: o, d, freezer: true };
  }
  // —— the evening: +20, the hat off; then the end ——
  const o = stand(base(t, { look: [0.7, 0], brow: 0.3, mouth: 0.25, hat: false }), 120);
  if (t > T.c7) { o.look = [0.8, 0]; o.brow = 0.6; o.mouth = 0.35; const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
  const d = { x: 300, y: 0, s: DS, face: 1, sit: 1, look: -0.5, t, blink: 1, ears: 0.1, asleep: true };
  return { h: o, d };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'bag') o.propNear = () => binBag(p.p[0], p.p[1], t);
  return drawHunter(o);
}

// —— the props ——
function snow(t, x0, y0, w, h, n = 120, size = 5, a = 0.8) {
  for (let i = 0; i < n; i++) {
    const sp2 = 40 + 60 * hash(i * 1.7), y = y0 + ((hash(i * 3.1) * h + t * sp2) % h), x = x0 + ((hash(i * 5.3) * w + 18 * Math.sin(t * 0.9 + i)) % w + w) % w;
    ell(x, y, size * (0.4 + 0.6 * hash(i)), size * (0.4 + 0.6 * hash(i)), rgba('#f3f8ff', a * (0.4 + 0.6 * hash(i * 9.1))));
  }
}
const STOVE = { x0: 470, x1: 770, top: -226 };
function stove() {
  const { x0, x1, top } = STOVE;
  rrect(x0, top, x1 - x0, -top, 10, '#eef0f2'); rect(x0, top, x1 - x0, 18, '#c9d0d6');
  rrect(x0 + 30, top + 70, x1 - x0 - 60, -top - 100, 10, '#3a3f4a'); rrect(x0 + 50, top + 90, x1 - x0 - 100, -top - 150, 8, '#252a33');
  for (let i = 0; i < 4; i++) { const k = [x0 + 60 + i * 56, top + 40]; ell(k[0], k[1], 13, 13, '#2c3140'); }
  for (const bx of [x0 + 80, x0 + 220]) { ell(bx, top - 4, 46, 8, '#2c3140'); ell(bx, top - 8, 22, 5, '#555c6a'); }
}
// the radiator: warm again in the evening (soft waves rising)
function radiator(t, warm) {
  const { x0, x1, y0, y1 } = RAD;
  for (let i = 0; i < 5; i++) rrect(x0 + i * 22, y0, 18, y1 - y0, 8, warm ? '#f2ede4' : '#d9d6cf');
  rect(x0, y0 + 20, x1 - x0, 10, '#c9c4b8'); rect(x0, y1 - 30, x1 - x0, 10, '#c9c4b8');
  if (warm) for (let i = 0; i < 3; i++) { const u = ((t * 0.5 + i / 3) % 1); limb([[x0 + 20 + i * 35, y0 - 10 - 80 * u], [x0 + 30 + i * 35, y0 - 40 - 80 * u], [x0 + 20 + i * 35, y0 - 70 - 80 * u]], 5, rgba('#ffb84d', 0.5 * bump(u)), true); }
}
// the oil heater, the kettle and the washing machine that all want the one strip
function heater(x) { for (let i = 0; i < 6; i++) rrect(x - 90 + i * 30, -230, 26, 200, 10, '#e9e4d8'); rect(x - 96, -40, 192, 14, '#9aa3b2'); ell(x - 80, -14, 12, 12, '#2c3140'); ell(x + 80, -14, 12, 12, '#2c3140'); }
function kettle(x, y) {
  rrect(x - 44, y - 104, 88, 104, 22, '#d9e2ea'); rect(x - 44, y - 16, 88, 16, '#9aa6b8'); rrect(x - 30, y - 118, 60, 18, 8, '#9aa6b8');
  limb([[x + 44, y - 84], [x + 66, y - 70], [x + 56, y - 30], [x + 44, y - 24]], 10, '#9aa6b8'); limb([[x - 44, y - 70], [x - 70, y - 92]], 12, '#d9e2ea', false);
}
function washer(x) { rrect(x - 100, -260, 200, 260, 16, '#f2f2f0'); ell(x, -120, 66, 66, '#9aa6b8'); ell(x, -120, 50, 50, '#3a4a5a'); rect(x - 90, -250, 180, 30, '#dcdcda'); ell(x + 60, -235, 9, 9, '#3ddc84'); }
function strip(t, n) {
  const [x, y] = STRIP;
  rrect(x - 90, y - 26, 180, 30, 10, '#f2efe6');
  for (let i = 0; i < 3; i++) { ell(x - 50 + i * 50, y - 12, 12, 10, '#3a3f52'); if (i < n) { rrect(x - 66 + i * 50, y - 56, 32, 40, 8, '#2c3140'); limb([[x - 50 + i * 50, y - 56], [x - 50 + i * 50 - 40 + 30 * i, y - 140]], 6, '#2c3140'); } }
  limb([[x + 90, y - 12], [x + 200, y - 12], [x + 220, y - 300]], 6, '#e8e4da');
}
// the riser in the bathroom with its valve; a crack that drips once the water is on
function pipe(t, open, crack, shut) {
  limb([[PIPE.x, PIPE.y0], [PIPE.x, PIPE.y1]], 22, '#a9b4c0', false);
  ell(PIPE.x, PIPE.valve, 18, 18, '#7a879a');
  g.save(); g.translate(PIPE.x, PIPE.valve); g.rotate(-Math.PI / 2 * (open * (1 - shut))); rrect(-8, -54, 16, 54, 6, '#d9433b'); g.restore();
  if (crack > 0.01) {
    limb([[PIPE.x - 10, PIPE.crack - 16], [PIPE.x + 4, PIPE.crack], [PIPE.x - 6, PIPE.crack + 14]], 4, '#3a3f52', false);
    const flow = crack * (1 - shut);
    for (let i = 0; i < 3; i++) { const u = ((t * 1.6 + i / 3) % 1); if (flow > 0.05) ell(PIPE.x + 12, PIPE.crack + 260 * u, 6, 9, rgba('#7fc0e8', flow * (1 - u * 0.5))); }
    if (crack > 0.3) ell(PIPE.x + 40, -6, 60 * crack, 8, rgba('#7fc0e8', 0.6));
  }
}
function binBag(x, y, t) {
  const sw = 3 * Math.sin(t * 2.4);
  fill(smoothPath([[x - 18, y], [x + 18, y], [x + 54 + sw, y + 60], [x + 50 + sw, y + 150], [x + sw, y + 170], [x - 50 + sw, y + 150], [x - 54 + sw, y + 60]]), '#2a2d36');
  ell(x, y, 22, 12, '#2a2d36'); ell(x - 10, y - 12, 10, 14, '#2a2d36', -0.5); ell(x + 10, y - 12, 10, 14, '#2a2d36', 0.5);
}
// the thawed packets from the freezer: dripping
function thawed(kind, x, y, a, t) {
  g.save(); g.translate(x, y); g.rotate(a);
  if (kind === 0) { rrect(-40, -24, 80, 48, 8, '#bfe3f2'); ell(-6, 0, 26, 14, '#d9636a'); }
  else if (kind === 1) { rrect(-36, -30, 72, 60, 8, '#e9eef5'); for (let i = 0; i < 3; i++) ell(-16 + i * 16, 0, 9, 7, '#7aa36a'); }
  else { rrect(-34, -26, 68, 52, 6, '#f2d6a8'); rect(-34, -6, 68, 10, '#d9433b'); }
  ell(0, 30 + 10 * ((t * 3) % 1), 4, 6, '#7fc0e8');
  g.restore();
}
// the sleeping dog's «z z z»
function zzz(t, x, y) { for (let i = 0; i < 3; i++) { const u = ((t * 0.5 + i / 3) % 1); Hd.label('z', x + 30 * u + i * 6, y - 80 * u, 30 + 16 * u, rgba('#2c5d9e', 0.9 * bump(u)), { fam: FONTS.mono, shadow: false, stroke: false }); } }

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'city') cityFrame(t, cam);
  else if (sc === 'stairs') stairsFrame(t, cam);
  else flatFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'stairs' ? 0.6 : 1);
}

// —— the city: part 1's blackout run backwards, so the windows come back on in a wave on «свет дали» ——
function cityFrame(t, cam) {
  const back = 2 * T.on - t;
  Cy.drawCity(back, cam, { t0: T.on - 0.8, day: 0, home: 0, fires: [] });
  g.setTransform(1, 0, 0, 1, 0, 0); snow(t, 0, 0, W, H, 120, 6, 0.6);
}
// —— the climb home: the stairwell in section, the two dots going up, the floor counter ——
function stairsFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  Sc.tower(t, P, { level: 23, flow: 0.6, spin: t * 6, power: 1, dots: [], home: 1, dry: 0, labels: 1, mark: null });
  const u = seg(T.climb + 0.1, T.c1 - 0.1, t, v => v), d0 = Sc.stairD(3), d1 = Sc.stairD(20);
  const you = Sc.stairAt(lerp(d0, d1, u)), dog = Sc.stairAt(lerp(d0, d1, u) - 200);
  ell(dog[0], dog[1] - 16, 16, 16, P.warm); ell(you[0], you[1] - 22, 22, 22, P.hi);
  Hd.label('ТЫ', you[0] - 40, you[1] - 40, 30, P.hi, { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
}

// —— the flat on the fifth day: the lamp on, frost still on the window; the evening warm ——
function flatFrame(t, cam) {
  const { h, d, freezer } = actorsAt(t);
  const evening = t >= T.c6;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const flick = t > T.flick && t < T.flick + 0.9 ? (noise(t * 30, 4) > 0 ? 1 : 0) : 1;
  Ap.drawShell(t, { power: flick > 0, lampOn: flick > 0 });
  Ap.drawWindow(t, { day: evening ? 0 : 1 });
  if (!evening) inside(rrPath(Ap.WIN.x0, Ap.WIN.y0, Ap.WIN.x1 - Ap.WIN.x0, Ap.WIN.y1 - Ap.WIN.y0, 2), () => snow(t, Ap.WIN.x0, Ap.WIN.y0, 300, 330, 30, 4, 0.9));
  Ap.drawTub(t, { level: 0.8, run: 0 });
  if (!evening) {                                               // the ice still on the tub until the evening
    const { in0, in1, rim, bot } = Ap.TUB;
    inside(rrPath(in0 + 30, rim + 30, in1 - in0 - 60, bot - rim - 50, 22), () => { rect(in0, -160, in1 - in0, 26, '#dff2ff'); rect(in0, -160, in1 - in0, 6, '#ffffff'); });
  }
  Ap.drawToilet(t, {});
  if (t >= T.c4 && t < T.c5) pipe(t, seg(A.L4w1, A.L4w3, t), seg(T.crack, T.crack + 0.4, t), seg(T.shut, T.shut + 0.3, t));
  else if (t < T.c4) washer(-700);
  Ap.drawFridge(t, { open: freezer ? 1 : 0 });
  if (freezer) { const { x0, x1, split } = Ap.FRIDGE; rect(x1 - 6, split + 10, 34, -split - 30, 'rgba(210,240,255,0.9)'); }
  Ap.drawCounter(t, { fills: [1, 0.6, 0.3, 0, 0] });
  stove(); radiator(t, evening);
  if (t < T.c4) { heater(-60 + 0); kettle(40, Ap.COUNTER.top); }
  if (t < T.c4) strip(t, t < T.c3 ? (t > T.plug + 0.3 ? 3 : 0) : ONES.filter(t0 => t > t0 + 0.15).length);
  if (t >= T.c5 && t < T.c6) TRASH.forEach((t0, i) => { const u = seg(t0, t0 + 0.45, t, v => v); if (u <= 0 || u >= 1) return; thawed(i, lerp(SHELF[0], BAG[0], u), lerp(SHELF[1], BAG[1] + 20, u) - 120 * bump(u), u * 2.4, t); });
  if (d) { drawDog(d); if (d.asleep) zzz(t, d.x + 40, -200); }
  if (h) hunterDraw(t, h);
  // the evening light: warm over the whole flat
  if (evening) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(255,190,110,0.08)'; g.fillRect(0, 0, W, H); }
  else { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(70,110,170,0.06)'; g.fillRect(0, 0, W, H); }
  if (flick === 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,7,17,0.75)'; g.fillRect(0, 0, W, H); }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.climb - 0.1, 'ДЕНЬ 5 — 14:00');
  Hd.timeStamp(t, T.c1 + 0.05, T.c6 - 0.1, 'ДЕНЬ 5 — 15:10');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ДЕНЬ 5 — 21:00');
  if (sc === 'city') Hd.plaque(t, T.on + 0.1, T.climb - 0.05, 540, 330, { icon: 'bolt', title: 'СВЕТ ДАЛИ', sub: 'как и сказали по радио', color: GOLD });
  if (sc === 'stairs') { const f = Math.round(lerp(3, 20, seg(T.climb + 0.1, T.c1 - 0.1, t, v => v))); Hd.plaque(t, T.climb + 0.1, T.c1 - 0.05, 540, 330, { icon: 'stairs', title: `ЭТАЖ ${f}`, sub: 'домой', color: GOLD, size: 50 }); }
  // the mistake: everything into one strip
  if (t >= T.c1 && t < T.c2) { const p = S2([STRIP[0], STRIP[1] - 160]); Hd.redX(p[0], p[1], 80, sp(t, A.L1w8 - 0.05, 2.6, 8)); }
  Hd.ribbon(t, A.L1w8 - 0.05, T.flick - 0.15, 'НЕ ВСЁ СРАЗУ', { y: 760, size: 96 });
  if (t >= T.c2 && t < T.c3) checklist(t, 540, 760, 0);
  // step 1
  Hd.stepHeader(t, 1, 'ПО ОДНОЙ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    const n = ONES.filter(t0 => t > t0 + 0.15).length;
    if (n > 0) Hd.plaque(t, ONES[0] + 0.15, T.c4 - 0.02, 540, 560, { icon: 'plug', title: `ВКЛЮЧЕНО: ${n} ИЗ 3`, sub: n < 3 ? 'подожди пару минут' : 'сеть выдержала', color: OK });
  }
  // step 2
  Hd.stepHeader(t, 2, 'ВОДА ПОНЕМНОГУ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) Hd.plaque(t, T.shut, T.c5 - 0.02, 540, 560, { icon: 'tap', title: 'ТЕЧЁТ — ПЕРЕКРОЙ', sub: 'и зови сантехника', color: DANGER, to: S2([PIPE.x, PIPE.crack]) });
  // step 3
  Hd.stepHeader(t, 3, 'ОТТАЯЛО — В МУСОР', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) Hd.plaque(t, A.L5w10 - 0.08, T.c6 - 0.02, 540, 560, { icon: 'fridge', title: 'СОМНЕВАЕШЬСЯ —', sub: 'выбрасывай', color: DANGER });
  // the evening
  if (t >= T.c6 && t < T.tub) thermometer(t, 880, 620);
  if (t >= T.tub && t < T.dog) Hd.plaque(t, A.L6w8 - 0.1, T.dog - 0.02, 540, 560, { icon: 'bath', title: 'ЛЁД РАСТАЯЛ', sub: 'вода из 1-й серии', color: ICE });
  if (t >= T.dog && t < T.c7) Hd.plaque(t, A.L6w11 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ПУРГА СПИТ', sub: 'у тёплой батареи', color: WARM });
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ЧТО ВКЛЮЧИШЬ ПЕРВЫМ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// the checklist of the three checks
function checklist(t, x, y) {
  const rows = ['техника — по одной', 'вода и трубы', 'морозилка'];
  const k = clamp(sp(t, T.c2 + 0.1, 2.4, 8)) * (1 - seg(T.c3 - 0.25, T.c3 - 0.02, t));
  if (k <= 0.01) return;
  const w = 600, h = 80 + rows.length * 74;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-w / 2, -h / 2, w, h, 16, '#f6f2e7'); g.restore();
  Hd.label('ПРОВЕРКА', -w / 2 + 30, -h / 2 + 56, 44, '#17162f', { align: 'left', shadow: false, stroke: false });
  rows.forEach((r, i) => {
    const yy = -h / 2 + 130 + i * 74, a = clamp((t - T.c2 - 0.3 - i * 0.25) / 0.2);
    rrect(-w / 2 + 30, yy - 34, 40, 40, 8, rgba('#d9d2c2', a));
    Hd.label(`${i + 1}. ${r}`, -w / 2 + 92, yy, 40, rgba('#17162f', a), { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  });
  g.restore();
}
// the evening thermometer: back up to +20
function thermometer(t, x, y) {
  const k = clamp(sp(t, T.c6 + 0.1, 2.4, 8));
  if (k <= 0.01) return;
  const u = seg(A.L6w2, A.L6w4 + 0.4, t), deg = Math.round(lerp(8, 20, u)), h = 420, colH = lerp(0.32, 0.78, u);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.85, 1, k), lerp(0.85, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-90, -h / 2 - 50, 180, h + 170, 30, 'rgba(11,15,26,0.9)'); g.restore();
  rrect(-22, -h / 2, 44, h, 22, '#e9eef5'); ell(0, h / 2 + 30, 44, 44, '#e9eef5');
  const top = h / 2 - h * colH, c = mix('#3b8eea', '#e53935', u);
  rrect(-12, top, 24, h / 2 - top + 20, 12, c); ell(0, h / 2 + 30, 32, 32, c);
  for (let i = 0; i <= 6; i++) rect(24, -h / 2 + 30 + i * (h - 60) / 6, 16, 4, '#9aa8bc');
  Hd.label(`+${deg}°`, 0, -h / 2 - 8, 52, u > 0.6 ? '#ffffff' : ICE, { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}

// —— the poster: the lamp on at last, him and the dog in the warm kitchen ——
function coverFrame(t) {
  const cam = { x: 260, y: -330, z: 1.55, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t, { power: true, lampOn: true }); Ap.drawWindow(t, { day: 0 }); Ap.drawCounter(t, {}); stove(); radiator(t, true);
  ell(Ap.LAMP[0], Ap.ROOM.ceil + 140, 300, 140, 'rgba(255,231,168,0.25)');
  const o = stand(base(t, { s: 0.95, face: 1, pop: 0.3, brow: 0.6, mouth: 0.5, look: [0.6, -0.5], blink: 0, lean: -0.05 }), 120, 120);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 90, sh[1] - 130], shape: 'point', ang: -1.2 } };
  drawDog({ x: 380, y: 60, s: 1.05, face: 1, sit: 1, look: 0.6, t: 0, ears: 1, wag: 1, mouth: 0.6, tongue: 0.8 });
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('СВЕТ', 0, 210, 150, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,200,80,0.9)'; g.shadowBlur = 40; Hd.label('ДАЛИ!', 0, 360, 140, '#ffd23f', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 7 · ДОМОЙ', pw = measure(pl, 56, FONTS.cond) + 60;
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
  return Math.min(m * (0.5 / (2 * h * 60)), 40);
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.3, 'city', -22, 0, { dur: T.climb - 0.3 });
  add(T.on, 'ticks_up', -16, 0, { dur: 0.8 });
  add(T.on + 0.1, 'ding', -10, 0);
  add(T.climb, 'whoosh', -12, 0);
  add(T.climb + 0.1, 'crowd_steps', -22, 0, { dur: T.c1 - T.climb - 0.2 });
  add(T.c1, 'amb_flat', -22, 0, { dur: T.c6 - T.c1 });
  add(T.plug + 0.2, 'click', -8, 0.1);
  add(A.L1w8 - 0.05, 'ribbon', -8, 0);
  add(A.L1w8 - 0.05, 'stamp', -6, 0);
  add(T.flick, 'spark', -8, 0.2);
  add(T.c2, 'paper', -12, 0, { dur: 0.4 });
  ONES.forEach((t0, i) => { add(t0 + 0.12, 'click', -8, 0.1); add(t0 + 0.2, 'fill_plink', -14, 0.1 + 0.05 * i); });
  add(T.c4, 'whoosh', -12, 0);
  add(A.L4w1, 'tap_squeak', -12, -0.3);
  add(T.crack, 'tap_run', -18, -0.3, { dur: T.shut - T.crack + 0.2 });
  add(T.shut, 'tap_squeak', -10, -0.3);
  add(T.shut, 'stamp', -8, 0);
  add(T.c5, 'whoosh', -12, 0);
  TRASH.forEach(t0 => add(t0 + 0.4, 'paper', -12, -0.1, { dur: 0.3 }));
  add(A.L5w10 - 0.08, 'stamp', -8, 0);
  add(T.c6, 'whoosh', -12, 0);
  add(A.L6w2, 'ticks_up', -18, 0.3, { dur: 0.9 });
  add(T.tub, 'whoosh', -14, 0);
  add(T.dog, 'whoosh', -14, 0);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
