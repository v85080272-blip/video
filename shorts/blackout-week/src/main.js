// «Неделя без света» (блэкаут, ч.2): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it (STORYBOARD.md).
// Same flat, hunter, dog, city and blueprint as part 1 (../blackout-flat); new here: the neighbours' grills and the gas
// on the blueprint, the camping burner, the food without cooking, the fridge cleared out, the text instead of the call,
// the lights coming back and the neighbour's TV burning from the surge.
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
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 5.29, 16], L1: [5.7, 10.1, 12], L2: [10.45, 15.02, 15], L3: [15.46, 20.84, 14], L4: [21.24, 26.55, 16], L5: [26.95, 32.76, 14], L6: [33.21, 39.17, 18], L7: [39.62, 43.53, 11] };
export const DUR = VOICE?.dur ?? 43.9;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { НЕДЕЛЯ: GOLD, ОПАСНОЕ: DANGER, МАНГАЛЫ: DANGER, ГОРЕЛКИ: DANGER, УГАРНЫЙ: DANGER, ЗАПАХА: DANGER, НЕЛЬЗЯ: DANGER,
  ОГНЯ: DANGER, КОНСЕРВЫ: GOLD, МУСОР: DANGER, ЧЕТЫРЕ: GOLD, ОПАСНО: DANGER, ЗВОНИ: DANGER, СООБЩЕНИЕ: GOLD, СВЕТ: GOLD,
  РОЗЕТОК: GOLD, СГОРЕЛ: DANGER, ПОДПИСЫВАЙСЯ: GOLD, ПРОДЕРЖИШЬСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  c1: A.L1 - 0.06,                   // «Соседи несут домой…»: the blueprint, fires light up in the flats
  f1: A.L1w3 - 0.05,                 // «мангалы»
  f2: A.L1w5 - 0.05,                 // «газовые горелки»
  c2: A.L2 - 0.06,                   // «От них угарный газ»: grey gas spreads from every fire, up through the floors
  co: A.L2w2 - 0.1,
  c3: A.L3 - 0.06,                   // step 1: the table, the burner is lit
  off: A.L3w1 - 0.05,                // «никакого огня»: he turns it off, the cross
  food: A.L3w5 - 0.08,               // «Ешь то, что не надо греть»: a tin, bread, nuts
  c4: A.L4 - 0.06,                   // step 2: the fridge, a bin bag
  c5: A.L5 - 0.06,                   // step 3: the phone
  ph: A.L5w2 - 0.1,                  // «Не звони»: the call screen
  chat: A.L5w5 - 0.08,               // «а пиши»: the message
  c6: A.L6 - 0.06,                   // day 7: the flat in the dark, the kettle unplugged in his hand
  on: A.L6w3 - 0.04,                 // «свет»: the lamp comes on
  nb: A.L6w11 - 0.1,                 // «а у соседа»: the floors around as a blueprint
  burn: A.L6w16 - 0.05,              // «сгорел»: the neighbour's TV pops and smokes
  c7: A.L7w5 - 0.08,                 // «А сколько ты продержишься…»: the city at night, every window lit again
};
export const CUTS = [T.cover, T.c1, T.c3, T.c4, T.c5, T.c6, T.nb, T.c7];
export const SNAPS = [T.on];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'city' : t < T.c3 ? 'bp' : t < T.nb ? 'night' : t < T.c7 ? 'nb' : 'citylit');
const lit = t => seg(T.on, T.on + 0.3, t);              // the power back: 0 dark, 1 the lamp on

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
const FY = f => Sc.floorY(f);
shot(T.cover, [[T.cover, 0, -1250, 0.4], [A.L0w2, 20, -1420, 0.5], [A.L0w7, WX, -1700, 0.85], [A.L0w10, WX, WY + 6, 1.9], [T.c1, WX, WY, 2.25]]);
shot(T.c1, [[T.c1, 0, FY(14), 0.8], [T.f2 + 0.6, 20, FY(15), 0.86], [T.c2, 30, FY(16), 0.9], [A.L2w8, 50, FY(18) - 40, 1.2], [T.c3, 60, FY(19) - 30, 1.3]]);
shot(T.c3, [[T.c3, 600, -215, 1.5], [T.food, 625, -215, 1.6], [T.c4, 640, -210, 1.64]]);
shot(T.c4, [[T.c4, -150, -215, 1.5], [A.L4w8, -145, -215, 1.58], [T.c5, -135, -210, 1.62]]);
shot(T.c5, [[T.c5, 380, -215, 1.5], [T.c6, 395, -210, 1.62]]);
shot(T.c6, [[T.c6, 110, -235, 1.3], [T.on + 0.5, 120, -230, 1.38], [T.nb, 135, -225, 1.46]]);
shot(T.nb, [[T.nb, -180, -270, 0.44], [A.L7 - 0.1, -170, -270, 0.47], [A.L7 + 0.8, 120, -215, 1.5], [T.c7, 130, -210, 1.55]]);
shot(T.c7, [[T.c7, WX, WY, 2.0], [T.c7 + 1.2, 20, -1500, 0.62], [DUR, 0, -1300, 0.5]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const t0 of [T.off, T.on, T.burn]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += 9 * e * noise(t * 40, 1); dy += 9 * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog: who stands where in each shot and what they do ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [-0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const talk = (t, a, b) => (t > a && t < b ? 0.3 + 0.25 * Math.abs(Math.sin(t * 13)) : 0);

// the props of part 2 (world units, floor at y = 0)
const BURNER = [560, Ap.TABLE.top];                            // the camping burner on the table
const KNOB = [BURNER[0] + 44, BURNER[1] - 26];
const FOOD = [{ x: 680, kind: 'tin' }, { x: 748, kind: 'bread' }, { x: 812, kind: 'nuts' }];
const KETTLE = [230, Ap.COUNTER.top];
const OUTLET = [318, -404];
const PLUG = [262, -436];                                      // where his hand holds the plug he pulled out
const BAG = [-92, -268];                                       // the bin bag's mouth, in his hand by the fridge
const SHELF = [-246, -452];                                    // where the food comes out of the fridge
const flameK = t => (t < T.c3 ? 1 : t < T.off + 0.2 ? 1 : 1 - seg(T.off + 0.2, T.off + 0.55, t));
const foodK = t => FOOD.map((f, i) => clamp(sp(t, [A.L3w11, A.L3w12, A.L3w13][i] - 0.05, 2.6, 8)));
const TRASH = () => [A.L4w1 - 0.1, A.L4w2 - 0.1, A.L4w4 - 0.1];

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'night' && sc !== 'nb') return { h: null, d: null };
  // —— step 1, the table: his hand on the burner's knob; «никакого огня» he turns it off; then a tin for supper ——
  if (t < T.c4) {
    const o = stand(base(t, { face: 1, lean: 0.12, look: [0.6, 0.4], brow: 0.2 }), 410);
    const sh = shoulder(o), back = seg(T.off + 0.25, T.off + 0.6, t);
    o.hands = { near: { p: [lerp(KNOB[0] - 4, sh[0] + 30, back), lerp(KNOB[1], sh[1] + 80, back)], shape: back < 0.5 ? 'grip' : 'fist', ang: -0.4 - 1.2 * seg(T.off, T.off + 0.25, t) } };
    if (t > T.off) { o.pop = clamp(sp(t, T.off, 2.4, 7)) * (1 - seg(T.off + 0.6, T.off + 1.1, t)); o.brow = 0.7; o.mouth = 0.15; }
    if (t > T.food) {
      const k = clamp(sp(t, T.food, 2.4, 7));
      o.hands = { near: { p: [sh[0] + 70 * k, sh[1] + 40 - 30 * k], shape: 'grip' }, far: { p: [sh[0] + 50 * k, sh[1] + 60 - 10 * k], shape: 'grip' } };
      o.prop = { kind: 'tin', p: [sh[0] + 64 * k, sh[1] + 26 - 30 * k], open: seg(A.L3w8, A.L3w10, t) };
      o.look = [0.7, 0.5]; o.brow = 0.3; o.mouth = 0.2 + 0.2 * Math.abs(Math.sin(t * 6)) * seg(A.L3w12, A.L3e, t);
    }
    const d = { x: 290, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.42, tilt: 0.04 * Math.sin(t * 2), t, blink: dblink(t), ears: t > T.off ? 0.9 : 0.2 };
    return { h: o, d };
  }
  // —— step 2, the fridge: the bin bag in one hand, the meat, the milk and the eggs go in; the dog begs for the meat ——
  if (t < T.c5) {
    const o = stand(base(t, { face: -1, lean: 0.14, look: [-0.6, -0.1], brow: -0.2 }), 20);
    const reach = Math.max(...TRASH().map(t0 => bump(seg(t0 - 0.35, t0 + 0.15, t, u => u))));
    o.hands = { near: { p: BAG, shape: 'grip' }, far: { p: [lerp(-150, SHELF[0] + 40, reach), lerp(-380, SHELF[1] + 10, reach)], shape: reach > 0.5 ? 'grip' : 'open' } };
    o.prop = { kind: 'bag', p: BAG };
    if (t > A.L4w8) { o.face = 1; o.look = [0.6, 0.3]; o.brow = 0.5; o.mouth = talk(t, A.L4w8, A.L4e - 0.3); o.headTilt = 0.12; }
    const begK = 1 - seg(A.L4w5, A.L4w7, t);
    const d = { x: 170, y: 0, s: DS, face: -1, sit: 1, beg: begK, mouth: 0.8 * begK, tongue: 0.9 * begK, ears: 1 - begK, look: 0.25 + 0.35 * begK, wag: begK, wagPh: t * 3, t, blink: dblink(t), brow: begK > 0.5 ? null : -0.6 };
    return { h: o, d, torchOnCounter: true };
  }
  // —— step 3, the phone: the call fails, he types instead; the dog lights his hands ——
  if (t < T.c6) {
    const o = stand(base(t, { face: 1, lean: 0.1, look: [0.6, 0.6], brow: 0.2, headTilt: 0.18 }), 420);
    const sh = shoulder(o);
    if (t < T.chat) { o.hands = { near: { p: [sh[0] + 34, sh[1] - 44], shape: 'grip' } }; o.prop = { kind: 'phone', p: [sh[0] + 30, sh[1] - 74], ang: -0.2 }; o.look = [0.5, -0.2]; o.brow = t > A.L5w3 ? 0.7 : 0.2; }
    else { o.hands = { near: { p: [sh[0] + 56, sh[1] + 30], shape: 'grip' }, far: { p: [sh[0] + 44, sh[1] + 44], shape: 'point' } }; o.prop = { kind: 'phone', p: [sh[0] + 60, sh[1] + 4], ang: 0.3 }; }
    const d = { x: 250, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.5, t, blink: dblink(t) };
    return { h: o, d };
  }
  // —— day 7: he holds up the kettle's plug, pulled out before; the lamp comes on; the tick ——
  if (t < A.L7) {
    const o = stand(base(t, { face: 1, lean: 0.06, look: [0.6, -0.2], brow: 0.3 }), 120);
    const sh = shoulder(o), show = clamp(sp(t, A.L6w6 - 0.1, 2.4, 7));
    o.hands = { near: { p: [lerp(PLUG[0], sh[0] + 90, show), lerp(PLUG[1], sh[1] - 40, show)], shape: 'grip' }, far: { p: [sh[0] - 10, sh[1] + 90], shape: 'fist' } };
    o.prop = { kind: 'plug', p: o.hands.near.p };
    if (t > T.on) { const k = clamp(sp(t, T.on, 2.4, 7)); o.look = [-0.2, -0.8]; o.brow = 0.6 + 0.3 * k * (1 - seg(T.on + 0.6, T.on + 1.2, t)); o.mouth = 0.4 * k * (1 - seg(T.on + 0.8, T.on + 1.3, t)); }
    if (t > A.L6w6) { o.look = [0.8, 0.1]; o.brow = 0.5; o.mouth = 0.3; }
    if (t > T.burn) { o.look = [-0.5, 0]; o.brow = 0.9; o.pop = clamp(sp(t, T.burn, 2.4, 7)) * (1 - seg(T.burn + 0.6, T.burn + 1.1, t)); }
    const d = { x: -150, y: 0, s: DS, face: 1, sit: 1, torch: t < T.on + 0.4, torchOff: t > T.on, look: t < T.on ? 0.5 : 0.25, t, blink: dblink(t), ears: t > T.on ? 1 : 0.3, wag: t > T.on ? 1 : 0, wagPh: t * 2.6, mouth: t > T.on ? 0.5 : 0, tongue: t > T.on ? 0.6 : 0 };
    return { h: o, d };
  }
  // —— «Подписывайся»: a thumbs up to us ——
  const o = stand(base(t, { face: 1, look: [0.8, 0], brow: 0.6, mouth: 0.35, lean: 0.02 }), 120);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  const d = { x: -150, y: 0, s: DS, face: 1, sit: 1, look: 0.4, mouth: 0.7, tongue: 0.8, wag: 1, wagPh: t * 3, t, blink: dblink(t) };
  return { h: o, d };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(p.ang ?? 0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, t < T.chat ? '#c95a5a' : '#9fd8ff'); g.restore(); };
  if (p?.kind === 'tin') o.propNear = () => tin(p.p[0], p.p[1], 0.9, p.open);
  if (p?.kind === 'bag') o.propNear = () => binBag(p.p[0], p.p[1], t);
  if (p?.kind === 'plug') o.propNear = () => plug(p.p[0], p.p[1]);
  return drawHunter(o);
}

// —— the new props ——
// the camping burner: a red gas canister, the burner head and its pot stand; lit 0…1 a blue flame with orange tips
function burner(x, y, lit, t) {
  rrect(x - 40, y - 74, 80, 74, 14, '#d8452f'); rect(x - 40, y - 52, 80, 22, '#f0e6d2'); rect(x - 28, y - 46, 40, 10, '#d8452f');
  rrect(x - 30, y - 92, 60, 20, 6, '#6e7584'); rrect(x - 20, y - 104, 40, 14, 4, '#9aa3b2');
  for (const dx of [-34, 34]) limb([[x + dx * 0.6, y - 100], [x + dx, y - 116]], 6, '#555c6a', false);
  ell(KNOB[0], KNOB[1], 11, 11, '#2c3140'); rect(KNOB[0] - 2, KNOB[1] - 12, 4, 10, '#9aa3b2');
  if (lit > 0.01) {
    const fl = 1 + 0.1 * noise(t * 14, 5);
    for (let i = -2; i <= 2; i++) {
      const fx = x + i * 9, fh = (34 + 10 * (2 - Math.abs(i))) * lit * fl;
      fill(smoothPath([[fx - 6, y - 104], [fx + 2 * noise(t * 9 + i, 2), y - 104 - fh], [fx + 6, y - 104]]), '#5aa0ff', 0.9);
      fill(smoothPath([[fx - 3, y - 104 - fh * 0.55], [fx + 3 * noise(t * 11 + i, 3), y - 104 - fh * 1.1], [fx + 3, y - 104 - fh * 0.55]]), '#ffb84d', 0.8);
    }
    ell(x, y - 104, 40 * lit, 8 * lit, 'rgba(120,180,255,0.5)');
  }
}
// a tin of food: open 0…1 lifts the lid
function tin(x, y, s = 1, open = 0) {
  rrect(x - 26 * s, y - 70 * s, 52 * s, 70 * s, 8 * s, '#b9c2cc'); rect(x - 26 * s, y - 52 * s, 52 * s, 30 * s, '#d9433b');
  rect(x - 16 * s, y - 44 * s, 32 * s, 6 * s, '#fff3d6'); rect(x - 26 * s, y - 70 * s, 52 * s, 6 * s, '#8c96a3');
  if (open > 0.02) { g.save(); g.translate(x + 26 * s, y - 70 * s); g.rotate(-1.9 * open); ell(-26 * s, 0, 26 * s, 6 * s, '#cfd6de'); g.restore(); ell(x, y - 70 * s, 22 * s, 4 * s, '#8a5a3a'); }
}
function bread(x, y) { ell(x, y - 26, 46, 28, '#c98a4a'); ell(x - 6, y - 34, 38, 18, '#d99c5a'); for (let i = -1; i <= 1; i++) limb([[x + i * 18 - 6, y - 44], [x + i * 18 + 6, y - 30]], 4, '#a86a34', false); }
function nuts(x, y) { fill(polyPath([[x - 34, y - 26], [x + 34, y - 26], [x + 24, y], [x - 24, y]]), '#4f86c6'); for (let i = 0; i < 6; i++) ell(x - 22 + i * 9, y - 30 - 6 * (i % 2), 9, 7, '#a8743e'); }
// the black bin bag, held at its knot (x, y)
function binBag(x, y, t) {
  const sw = 3 * Math.sin(t * 2.4);
  fill(smoothPath([[x - 18, y], [x + 18, y], [x + 54 + sw, y + 60], [x + 50 + sw, y + 150], [x + sw, y + 170], [x - 50 + sw, y + 150], [x - 54 + sw, y + 60]]), '#2a2d36');
  limb([[x - 14, y + 30], [x - 30 + sw, y + 140]], 5, '#3b3f4c', false); limb([[x + 18, y + 40], [x + 28 + sw, y + 130]], 5, '#3b3f4c', false);
  ell(x, y, 22, 12, '#2a2d36'); ell(x - 10, y - 12, 10, 14, '#2a2d36', -0.5); ell(x + 10, y - 12, 10, 14, '#2a2d36', 0.5);
}
// the food that goes into the bag: kind 0 meat, 1 milk, 2 eggs
function trashItem(kind, x, y, a) {
  g.save(); g.translate(x, y); g.rotate(a);
  if (kind === 0) { ell(0, 0, 40, 26, '#d9636a'); ell(-6, -4, 30, 18, '#ec8a8a'); ell(22, -2, 10, 8, '#fff3e6'); }
  else if (kind === 1) { rect(-20, -34, 40, 64, '#f6f3ec'); poly([[-20, -34], [0, -50], [20, -34]], '#dcd7cc'); rect(-20, -6, 40, 14, '#3c7ad6'); }
  else { ell(-12, 0, 16, 21, '#f3e6cf'); ell(12, 2, 16, 21, '#ead8b8'); }
  g.restore();
}
// the fridge with its top door swung open: dark inside (no power), a few shelves, the smell rising
function fridgeOpen(t, k) {
  const { x0, x1, top, split } = Ap.FRIDGE;
  if (k <= 0.01) return;
  rrect(x0 + 12, top + 14, x1 - x0 - 24, split - top - 30, 10, '#9fb0b8');
  for (const y of [top + 140, top + 270]) rect(x0 + 14, y, x1 - x0 - 28, 6, '#c9d6dc');
  ell(x0 + 70, top + 262, 22, 18, '#e0b84a'); rrect(x0 + 120, top + 92, 40, 48, 6, '#7aa36a');
  const dx = 110 * k;
  fill(polyPath([[x1, top + 4], [x1 + dx, top + 30], [x1 + dx, split - 20], [x1, split - 6]]), '#e2e6ea');
  rect(x1 + dx - 14, top + 120, 10, 140, Ap.COLORS.chrome);
  for (let i = 0; i < 3; i++) {                                 // the smell: wavy green lines rising
    const u = ((t * 0.7 + i / 3) % 1), x = x0 + 50 + i * 60;
    limb([[x, top + 40 - 30 * u], [x + 14, top + 10 - 30 * u], [x - 6, top - 20 - 30 * u], [x + 10, top - 50 - 30 * u]], 6, rgba('#8fcf5a', 0.7 * bump(u) * k));
  }
}
function kettle(x, y) {
  rrect(x - 44, y - 104, 88, 104, 22, '#d9e2ea'); rect(x - 44, y - 16, 88, 16, '#9aa6b8'); rrect(x - 30, y - 118, 60, 18, 8, '#9aa6b8');
  limb([[x + 44, y - 84], [x + 66, y - 70], [x + 56, y - 30], [x + 44, y - 24]], 10, '#9aa6b8'); limb([[x - 44, y - 70], [x - 70, y - 92]], 12, '#d9e2ea', false);
}
function outlet(x, y, lit) { rrect(x - 30, y - 30, 60, 60, 8, '#f6f3ec'); rrect(x - 30, y - 30, 60, 60, 8, 'rgba(0,0,0,0.06)'); ell(x - 10, y, 5, 7, '#3a3f52'); ell(x + 10, y, 5, 7, '#3a3f52'); if (lit) ell(x, y - 20, 3, 3, '#3ddc84'); }
function plug(x, y) { rrect(x - 16, y - 20, 32, 40, 8, '#f2efe6'); rect(x - 10, y - 34, 5, 16, '#c8a24a'); rect(x + 5, y - 34, 5, 16, '#c8a24a'); }
// the cable from the kettle to the plug in his hand
function cable(from, to) { limb([from, [lerp(from[0], to[0], 0.3), from[1] + 60], [lerp(from[0], to[0], 0.7), to[1] + 90], [to[0], to[1] + 20]], 6, '#e8e4da'); }

// —— the night light: darkness over the flat with holes where the torch, the burner, the lamp and the window light it ——
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
  if (sc === 'city' || sc === 'citylit') cityFrame(t, cam, sc === 'citylit');
  else if (sc === 'bp') blueprintFrame(t, cam);
  else flatFrame(t, cam, sc);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'bp' ? 0.6 : 1);
}

// —— outside: the city a week into the blackout (a few neighbours' windows flicker with fire), or lit again at the end ——
const CITY_FIRES = [[1, 19], [4, 21], [0, 16], [5, 14], [2, 11], [3, 17], [1, 8]];
function cityFrame(t, cam, back) {
  Cy.drawCity(t, cam, { t0: back ? 1e9 : -1e9, day: 0, home: back ? 0 : 1, fires: back ? [] : CITY_FIRES, inside: (x, y, w, h) => ourWindow(t, x, y, w, h) });
}
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

// —— the blueprint: the tower a week on (no water above the 9th floor), fires in the flats, the gas spreading up ——
const BP_FIRES = [{ f: 19, x: 150, at: 0 }, { f: 21, x: 320, at: 0.22 }, { f: 16, x: 60, at: 0.4 }, { f: 13, x: 260, at: 0.55 }, { f: 17, x: 380, at: 0.7 }, { f: 11, x: 120, at: 0.85 }, { f: 8, x: 300, at: 1.0 }];
const fireOn = (t, F) => clamp(sp(t, (F.at < 0.5 ? T.f1 : T.f2) + F.at * 0.5, 2.6, 8));
function blueprintFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const you = [Sc.BLD.stair[1] + 70, FY(20) - 30];
  Sc.tower(t, P, { level: 9.5, flow: 0, spin: 0, power: 0, dots: [[you[0], you[1] - 6 * Math.abs(Math.sin(t * 3)), WARM, 13]], home: 1, dry: 1, labels: seg(T.c1, T.c1 + 0.8, t), mark: null });
  Hd.label('ТЫ', you[0] + 26, you[1] - 22, 30, WARM, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  // the gas: grey clouds that grow from every fire and creep up through the floors above it
  const gas = seg(T.co, T.c3 - 0.2, t, u => u);
  if (gas > 0) for (const F of BP_FIRES) {
    const y0 = FY(F.f + 1) + Sc.FH * 0.55;
    for (let i = 0; i < 9; i++) {
      const u = clamp(gas * 1.6 - i * 0.12), up = u * (110 + 60 * hash(i + F.f)) * (1 + (i % 3)), r = (40 + 50 * u) * (0.7 + 0.5 * hash(i * 3 + F.f));
      if (u <= 0) continue;
      ell(F.x - 120 + 240 * hash(i * 7 + F.f) + 20 * Math.sin(t * 1.5 + i), y0 - up, r, r * 0.7, rgba('#b8c2d0', 0.16 * u));
    }
  }
  // the fires: a flame icon glowing in each flat that lit a grill or a burner
  for (const F of BP_FIRES) {
    const k = fireOn(t, F);
    if (k <= 0.01) continue;
    const y = FY(F.f + 1) + Sc.FH * 0.58, fl = 1 + 0.12 * noise(t * 9 + F.f, 2);
    ell(F.x, y, 46 * k, 40 * k, rgba('#ff7a2a', 0.22));
    g.save(); g.translate(F.x, y); g.scale(k * fl, k * fl); Hd.icon('flame', 28, '#ff8a3d'); g.restore();
  }
}

// —— the flat: at night (the torch, the burner), lit again on day 7, then among the neighbours ——
function flatFrame(t, cam, sc) {
  const { h, d, torchOnCounter } = actorsAt(t);
  const on = lit(t), inNb = sc === 'nb' && t < A.L7 + 0.9;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = inNb ? '#e8e1cf' : '#090c16'; g.fillRect(0, 0, W, H);
  if (inNb) neighbours(t, cam);
  view(cam, 1);
  Ap.drawShell(t, { power: on > 0.5, lampOn: on > 0.5 });
  Ap.drawWindow(t, { day: 0 });
  Ap.drawTub(t, { level: 0.35, run: 0 });
  Ap.drawToilet(t, {});
  Ap.drawFridge(t);
  if (t >= T.c4 && t < T.c5) {
    fridgeOpen(t, seg(T.c4 - 0.05, T.c4 + 0.3, t));
    TRASH().forEach((t0, i) => {                                // each item arcs from the shelf into the bag
      const u = seg(t0, t0 + 0.45, t, u => u);
      if (u <= 0 || u >= 1) return;
      const x = lerp(SHELF[0], BAG[0], u), y = lerp(SHELF[1], BAG[1] + 20, u) - 120 * bump(u);
      trashItem(i, x, y, u * 2.4);
    });
  }
  Ap.drawCounter(t, { fills: [1, 0.6, 0, 0, 0.3] });
  if (t >= T.c6) { kettle(KETTLE[0], KETTLE[1]); outlet(OUTLET[0], OUTLET[1], on > 0.5); }
  Ap.drawTable(t, { candle: false });
  if (t < T.c4) { burner(BURNER[0], BURNER[1], flameK(t), t); const fk = foodK(t); FOOD.forEach((f, i) => { if (fk[i] < 0.01) return; g.save(); g.translate(f.x, BURNER[1]); g.scale(fk[i], fk[i]); f.kind === 'tin' ? tin(0, 0, 1, 1) : f.kind === 'bread' ? bread(0, 0) : nuts(0, 0); g.restore(); }); }
  else burner(BURNER[0], BURNER[1], 0, t);
  Ap.drawBowl(t, 0.3);
  if (torchOnCounter) torchProp(190, -306);
  if (on > 0.01) { const [lx, ly] = [Ap.LAMP[0], Ap.ROOM.ceil + 112]; ell(lx, ly + 30, 260, 120, rgba('#ffe7a8', 0.18 * on)); }
  let dl = null;
  if (d) dl = drawDog(d);
  if (h?.prop?.kind === 'plug') cable([KETTLE[0] + 44, KETTLE[1] - 24], h.prop.p);
  if (h) hunterDraw(t, h);
  // the darkness until the power comes back
  const dark = 0.76 * (1 - on);
  if (dark > 0.005) {
    const lights = [{ p: [(Ap.WIN.x0 + Ap.WIN.x1) / 2, (Ap.WIN.y0 + Ap.WIN.y1) / 2], r: 480, k: 0.45 }];
    if (dl?.lens && d.torch && !d.torchOff) lights.push({ p: dl.lens, a: dl.beamAng, r: 1150, k: 0.97, cone: true, spread: 0.42, tint: '#ffcf7a' });
    if (torchOnCounter) lights.push({ p: [186, -306], a: Math.PI + 0.08, r: 900, k: 0.95, cone: true, spread: 0.45, tint: '#ffcf7a' });
    const fk = t < T.c4 ? flameK(t) : 0;
    if (fk > 0.01) lights.push({ p: [BURNER[0], BURNER[1] - 130], r: (360 + 40 * noise(t * 10, 3)) * fk, k: 0.9 * fk, tint: '#7fb2ff' });
    if (h?.prop?.kind === 'phone') { const sh = shoulder(h); lights.push({ p: [sh[0] + 50, sh[1]], r: 220, k: 0.7, tint: t < T.chat ? '#ff8a8a' : '#9fd8ff' }); }
    lighting(t, cam, lights, dark);
  }
}
function torchProp(x, y) {
  limb([[x + 8, y], [x + 80, y]], 22, '#2b3346', false); limb([[x + 12, y - 6], [x + 76, y - 6]], 6, '#55607a', false);
  rrect(x - 8, y - 16, 20, 32, 6, '#2b3346'); ell(x - 6, y, 7, 13, '#ffe7a8');
}
// day 7: the floors above, below and to the sides as a blueprint on paper, a TV in every flat; next door it burns
const BURNT = [0, -1];                                        // the flat right above ours, the 21st floor
function neighbours(t, cam) {
  const P = Sc.palette('paper');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const { x0, x1, ceil, slab } = Ap.ROOM, w = x1 - x0 + 120, h = -ceil + slab + 70;
  for (const [i, j] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    const ox = i * w, oy = j * h, burnt = i === BURNT[0] && j === BURNT[1];
    g.save(); g.translate(ox, oy);
    Sc.gline([[x0, ceil], [x1, ceil], [x1, 0], [x0, 0]], 4, P.line, P, true);
    Sc.gline([[Ap.PART.x0, ceil], [Ap.PART.x0, Ap.PART.door]], 3, P.faint, P);
    const tb = Ap.TUB; Sc.gline([[tb.x0, tb.rim], [tb.x1, tb.rim], [tb.x1 - 30, -12], [tb.x0 + 30, -12]], 3, P.faint, P, true);
    const c = Ap.COUNTER; Sc.gline([[c.x0, c.top], [c.x1, c.top], [c.x1, 0], [c.x0, 0]], 3, P.faint, P, true);
    Sc.gline([[Ap.FRIDGE.x0, Ap.FRIDGE.top], [Ap.FRIDGE.x1, Ap.FRIDGE.top], [Ap.FRIDGE.x1, 0], [Ap.FRIDGE.x0, 0]], 3, P.faint, P, true);
    Sc.gline([[Ap.WIN.x0, Ap.WIN.y0], [Ap.WIN.x1, Ap.WIN.y0], [Ap.WIN.x1, Ap.WIN.y1], [Ap.WIN.x0, Ap.WIN.y1]], 3, P.faint, P, true);
    // the TV on its stand, its screen; the neighbour in front of it
    const tv = [700, -150];
    Sc.gline([[tv[0] - 150, tv[1]], [tv[0] + 150, tv[1]], [tv[0] + 150, 0], [tv[0] - 150, 0]], 3, P.faint, P, true);
    const k = burnt ? seg(T.burn, T.burn + 0.15, t) : 0;
    fill(rrPath(tv[0] - 130, tv[1] - 170, 260, 160, 10), burnt && k > 0 ? mix('#9fd0ff', '#2a2d36', k) : (t > T.on ? 'rgba(59,142,234,0.35)' : 'rgba(44,93,158,0.08)'));
    Sc.gline([[tv[0] - 130, tv[1] - 170], [tv[0] + 130, tv[1] - 170], [tv[0] + 130, tv[1] - 10], [tv[0] - 130, tv[1] - 10]], 4, P.line, P, true);
    MONO.on = true; MONO.color = '#8fb0d8';
    const o = stand(base(t, { face: 1, hat: false, lean: 0.06, look: [0.6, -0.1] }), 260 + 40 * hash(i * 3 + j));
    if (burnt && t > T.burn) { const kk = clamp(sp(t, T.burn, 2.4, 7)); o.pop = kk; o.brow = 1; o.lean = -0.15 * kk; o.hatJump = 20 * bump((t - T.burn) / 0.3); const sh = framesOf(o).T.p([-14, -192]); o.hands = { near: { p: [sh[0] + 40, sh[1] - 80 * kk], shape: 'open' }, far: { p: [sh[0] - 20, sh[1] - 90 * kk], shape: 'open' } }; }
    drawHunter(o);
    MONO.on = false;
    if (burnt && t > T.burn) {                                    // the flash, the sparks, the smoke from the dead set
      const u = t - T.burn;
      if (u < 0.25) ell(tv[0], tv[1] - 90, 260 * (1 - u * 3), 200 * (1 - u * 3), rgba('#ffffff', 0.8 * (1 - u * 4)));
      for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (hash(s * 3.7) - 0.5) * 2.4, v = 220 + 200 * hash(s), q = Math.min(u, 0.6); ell(tv[0] + Math.cos(a) * v * q, tv[1] - 170 + Math.sin(a) * v * q + 300 * q * q, 7, 7, '#ffb84d', 0, clamp(1 - u / 0.6)); }
      for (let s = 0; s < 6; s++) { const q = ((u * 0.5 + s / 6) % 1); ell(tv[0] - 40 + 18 * s + 20 * Math.sin(u * 3 + s), tv[1] - 180 - 220 * q, 26 + 40 * q, 26 + 40 * q, '#5f6470', 0, 0.5 * (1 - q) * clamp(u * 3)); }
      g.save(); g.translate(tv[0], tv[1] - 90); const kx = clamp(sp(t, T.burn + 0.15, 2.6, 8)); g.scale(kx, kx); Hd.icon('x', 70, P.danger); g.restore();
    }
    g.restore();
  }
  for (const [j, f] of [[-1, 21], [0, 20], [1, 19]]) Hd.label(`${f} ЭТАЖ`, x1 + 90, j * h - 300, 70, f === 20 ? P.warm : P.line, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false, rot: -Math.PI / 2 });
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  // time stamps
  Hd.timeStamp(t, T.cover + 0.15, T.c3 - 0.1, 'ДЕНЬ 7 — 19:30');
  Hd.timeStamp(t, T.c3 + 0.05, T.c6 - 0.1, 'ДЕНЬ 7 — 21:10');
  Hd.timeStamp(t, T.c6 + 0.05, T.nb - 0.05, 'ДЕНЬ 7 — 22:47');
  // the hook: the days counted up to a week
  if (sc === 'city') {
    const n = Math.round(lerp(1, 7, seg(A.L0, A.L0w2 + 0.1, t, u => u)));
    Hd.plaque(t, A.L0 - 0.05, T.c1 - 0.05, 300, 560, { icon: 'calendar', title: `ДЕНЬ ${n}`, sub: 'света нет', color: WARM, to: S2([WX - 40, WY - 10]) });
  }
  // the blueprint: the grills, the gas
  if (sc === 'bp') {
    const F = BP_FIRES[0];
    Hd.plaque(t, T.f1, T.c2 + 0.3, 700, 720, { icon: 'flame', title: 'МАНГАЛ ДОМА', sub: 'и газовая горелка', color: DANGER, to: S2([F.x, FY(F.f + 1) + Sc.FH * 0.58]) });
    Hd.plaque(t, A.L2w7 - 0.05, T.c3 - 0.05, 540, 330, { icon: 'cloud', title: 'НЕ ВИДНО', sub: 'и не пахнет', color: DANGER });
  }
  Hd.ribbon(t, A.L2w2 - 0.06, A.L2w6, 'УГАРНЫЙ ГАЗ', { y: 820 });
  // step 1
  Hd.stepHeader(t, 1, 'БЕЗ ОГНЯ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    const p = S2([BURNER[0], BURNER[1] - 120]); Hd.redX(p[0], p[1], 80, sp(t, T.off, 2.6, 8) * (1 - seg(T.food - 0.1, T.food + 0.15, t)));
    Hd.plaque(t, A.L3w11 - 0.1, T.c4 - 0.02, 540, 560, { icon: 'can', title: 'ЕДА БЕЗ ОГНЯ', sub: 'консервы, хлеб, орехи', color: OK, to: S2([FOOD[1].x, BURNER[1] - 60]) });
    { const q = S2([FOOD[2].x, BURNER[1] - 130]); Hd.tick(q[0], q[1], sp(t, A.L3e + 0.05, 2.6, 8), 52); }
  }
  // step 2
  Hd.stepHeader(t, 2, 'В МУСОР', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) {
    Hd.paperCard(t, A.L4w8 - 0.05, T.c5 - 0.02, 540, 610, [
      { icon: 'fridge', label: 'Без холода', note: '4 часа', value: 0.08, color: '#d98a1c' },
      { icon: 'calendar', label: 'Без света', note: '7 дней', value: 1, color: '#d6342f' }]);
  }
  // step 3
  Hd.stepHeader(t, 3, 'ПИШИ, НЕ ЗВОНИ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.ph && t < T.c6) phoneCard(t, 540, 720);
  // day 7
  if (sc === 'night' && t >= T.c6) {
    Hd.plaque(t, A.L6w7 - 0.05, T.nb, 540, 560, { icon: 'plug', title: 'ВИЛКИ ИЗ РОЗЕТОК', sub: 'техника цела', color: OK, to: S2(actorsAt(t).h?.prop?.p ?? PLUG) });
    const q = S2([OUTLET[0] + 120, OUTLET[1] - 120]); Hd.tick(q[0], q[1], sp(t, A.L6w10 - 0.05, 2.6, 8), 52);
  }
  if (sc === 'nb' && t < A.L7 + 0.2) {
    const { x0, x1, ceil, slab } = Ap.ROOM, w = x1 - x0 + 120, h = -ceil + slab + 70;
    Hd.plaque(t, T.burn - 0.05, A.L7 + 0.1, 330, 300, { icon: 'tv', title: 'У СОСЕДА', sub: 'сгорел телевизор', color: DANGER, to: S2([BURNT[0] * w + 700, BURNT[1] * h - 240]) });
  }
  // the end: subscribe, then «how long would you last?»
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (sc === 'citylit') Hd.plaque(t, A.L7w6 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'СКОЛЬКО ПРОДЕРЖИШЬСЯ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// —— the phone close-up: the call that won't go through, then the message that does ——
function phoneCard(t, cx, cy) {
  const k = clamp(sp(t, T.ph + 0.08, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const chat = seg(T.chat, T.chat + 0.25, t), w = 380, h = 600;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(-0.04); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, mix('#3a1f2a', '#16233a', chat));
  rrect(-40, -h / 2 + 26, 80, 18, 9, '#0d0f16');
  // the bars: one of five, the network is busy
  for (let i = 0; i < 5; i++) rect(w / 2 - 120 + i * 16, -h / 2 + 64 - 8 - i * 6, 10, 8 + i * 6, i === 0 ? '#ffffff' : 'rgba(255,255,255,0.25)');
  if (chat < 1) {                                                // the call: a contact, «вызов…», then «сеть перегружена» and the red button
    g.save(); g.globalAlpha *= 1 - chat;
    ell(0, -110, 70, 70, '#5a6a86'); ell(0, -128, 28, 28, '#c9d6ea'); ell(0, -80, 46, 26, '#c9d6ea');
    Hd.label('МАМА', 0, 10, 52, '#ffffff', { shadow: false, stroke: false });
    const busy = t > A.L5w3;
    Hd.label(busy ? 'сеть перегружена' : 'вызов…', 0, 64, 30, busy ? '#ff8a8a' : '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
    ell(0, 190, 46, 46, '#e53935'); limb([[-22, 196], [-8, 182], [8, 182], [22, 196]], 10, '#ffffff');
    g.restore();
  }
  if (chat > 0) {                                                // the message: typed, sent, delivered ✓✓
    g.save(); g.globalAlpha *= chat;
    Hd.label('МАМА', 0, -h / 2 + 120, 40, '#ffffff', { shadow: false, stroke: false });
    rect(-w / 2 + 16, -h / 2 + 150, w - 32, 2, 'rgba(255,255,255,0.15)');
    const msg = 'Мы живы. Всё хорошо', n = Math.round(msg.length * seg(T.chat + 0.15, A.L5w8, t, u => u)), sent = t > A.L5w9;
    if (sent) {
      const bw = 290, by = -40;
      rrect(w / 2 - 34 - bw, by - 50, bw, 100, 22, '#2f8f4e');
      Hd.label('Мы живы.', w / 2 - 34 - bw + 22, by - 8, 32, '#ffffff', { align: 'left', shadow: false, stroke: false });
      Hd.label('Всё хорошо', w / 2 - 34 - bw + 22, by + 30, 32, '#ffffff', { align: 'left', shadow: false, stroke: false });
      const dv = t > A.L5w10 - 0.05;
      Hd.label(dv ? '✓✓' : '✓', w / 2 - 50, by + 30, 26, dv ? '#9fe8ff' : '#d6ecff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
    }
    rrect(-w / 2 + 34, h / 2 - 120, w - 68, 70, 35, 'rgba(255,255,255,0.1)');
    Hd.label(sent ? '' : msg.slice(0, n) + ((t * 2) % 1 < 0.5 ? '|' : ''), -w / 2 + 56, h / 2 - 74, 28, '#ffffff', { align: 'left', shadow: false, stroke: false });
    g.restore();
  }
  g.restore();
  // the cross over the failed call, the tick when the message is delivered
  Hd.redX(cx, cy + 190, 60, sp(t, A.L5w3, 2.6, 8) * (1 - seg(T.chat - 0.1, T.chat + 0.1, t)));
  Hd.tick(cx + 150, cy - 220, sp(t, A.L5w10, 2.6, 8), 52);
}

// —— the poster in the first frames: him and the dog in the torch light, the burner on the table, the words on the right ——
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
  Hd.label('НЕДЕЛЯ', 0, 210, 140, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('БЕЗ СВЕТА', 0, 370, 120, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 2 · 20 ЭТАЖ', pw = measure(pl, 56, FONTS.cond) + 60;
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
  return m * (0.5 / (2 * h * 60));
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.3, 'amb_flat', -18, 0, { dur: T.c1 - 0.3 });
  add(A.L0, 'ticks_up', -14, 0.1, { dur: A.L0w2 - A.L0 + 0.2 });
  add(A.L0w2, 'blip', -10, 0);
  add(T.c1, 'whoosh', -12, 0);
  for (let i = 0; i < BP_FIRES.length; i++) add((BP_FIRES[i].at < 0.5 ? T.f1 : T.f2) + BP_FIRES[i].at * 0.5, 'fire_whoosh', -16, -0.4 + 0.12 * i);
  add(T.f1, 'blip', -10, 0.3);
  add(T.f1 + 0.1, 'fire', -18, 0, { dur: T.c3 - T.f1 });
  add(A.L2w2 - 0.06, 'ribbon', -8, 0);
  add(A.L2w7 - 0.05, 'blip', -10, -0.2);
  add(T.c3, 'amb_flat', -20, 0, { dur: T.c6 - T.c3 });
  add(T.c3, 'candle', -18, 0.2, { dur: T.off - T.c3 + 0.3 });
  add(T.off, 'stamp', -4, 0.1);
  add(T.off + 0.2, 'puff', -10, 0.2);
  add(T.food, 'click', -10, 0.1);
  for (const t0 of [A.L3w11, A.L3w12, A.L3w13]) add(t0 - 0.05, 'fill_plink', -12, 0.2);
  add(A.L3w11 - 0.1, 'blip', -10, 0);
  add(A.L3e + 0.05, 'ding', -10, 0.1);
  add(T.c4, 'tap_squeak', -14, -0.2);
  add(A.L4w1 - 0.2, 'whine', -14, 0.2, { dur: 0.9 });
  for (const t0 of TRASH()) add(t0 + 0.4, 'paper', -12, -0.1, { dur: 0.3 });
  add(A.L4w8 - 0.05, 'paper', -10, 0);
  add(T.ph + 0.08, 'whoosh_in', -12, 0);
  add(A.L5w3, 'stamp', -6, 0);
  add(T.chat, 'toggle', -10, 0);
  add(A.L5w9, 'blip', -8, 0.1);
  add(A.L5w10, 'ding', -10, 0.1);
  add(T.c6, 'amb_flat', -20, 0, { dur: T.on - T.c6 });
  add(T.on - 0.03, 'click', -6, 0);
  add(T.on, 'city', -20, 0, { dur: T.nb - T.on });
  add(A.L6w7 - 0.05, 'blip', -10, 0.2);
  add(A.L6w10 - 0.05, 'ding', -10, 0.2);
  add(T.nb, 'whoosh', -12, 0);
  add(T.burn, 'spark', -6, 0.3);
  add(T.burn + 0.15, 'stamp', -8, 0.3);
  add(T.burn + 0.1, 'puff', -12, 0.3);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(T.c7, 'whoosh', -12, 0);
  add(A.L7w6 - 0.1, 'blip', -8, 0);
  add(T.c7, 'city', -18, 0, { dur: DUR - T.c7 });
  return c.sort((a, b) => a.t - b.t);
}
