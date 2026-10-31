// «Третий день в холоде» (блэкаут, ч.5): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// It opens where part 4 ends: the ice on the tub, +8 in the flat. Same flat, hunter, dog, blueprint, frost, breath and
// thermal camera as part 4 (../blackout-winter); new here: the body on the thermal camera losing heat to the bottle,
// the route down the stairs to the warming centre, the ice in the bucket for the toilet, the battery radio, the bag
// packed item by item, the descent behind the dog's torch and the warm hall where the dog is fed first.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Ap from './apt.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.41, 14], L1: [4.8, 10.71, 16], L2: [11.12, 15.97, 15], L3: [16.43, 22.05, 16], L4: [22.45, 27.41, 12], L5: [27.8, 34.41, 17], L6: [34.86, 41.13, 19], L7: [41.58, 46.4, 14] };
export const DUR = VOICE?.dur ?? 46.75;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm, ICE = '#8fd3ff';
const HOT = { ЗАМЁРЗЛА: ICE, ВОСЕМЬ: ICE, ВОДКОЙ: DANGER, НАДО: DANGER, АЛКОГОЛЬ: DANGER, БЫСТРЕЕ: DANGER, УХОДИТЬ: GOLD,
  ПЛАНУ: GOLD, РЕГУЛЯРНО: GOLD, ТУАЛЕТА: ICE, ОБОГРЕВА: GOLD, РАДИО: GOLD, ДОКУМЕНТЫ: GOLD, ЛЕКАРСТВА: GOLD, ФОНАРИК: GOLD,
  ГАЗ: DANGER, РОДНЫМ: GOLD, ПЕШКОМ: GOLD, КАШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  eight: A.L0w12 - 0.05,             // «плюс восемь»: the thermometer drops the last degrees
  c1: A.L1 - 0.06,                   // «Сосед зовёт согреться водкой»: the body on the thermal camera, a bottle in hand
  no: A.L1w4 - 0.05,                 // «Не надо»: the cross over the bottle
  seems: A.L1w8 - 0.06,              // «кажется тёплым»: the skin glows
  loss: A.L1w11 - 0.06,              // «а тепло из тела уходит быстрее»: the heat leaves, the body goes blue
  c2: A.L2 - 0.06,                   // «пора уходить»: the tower, the route to the warming centre
  route: A.L2w7 - 0.06,
  c3: A.L3 - 0.06,                   // step 1: food in the kitchen
  ice: A.L3w9 - 0.06,                // «а лёд из ванны»: the bucket of ice by the toilet
  c4: A.L4 - 0.06,                   // step 2: the radio
  c5: A.L5 - 0.06,                   // step 3: the bag
  shut: A.L5w8 - 0.06,               // «Перекрой воду и газ»
  c6: A.L6 - 0.06,                   // «Двадцать этажей вниз пешком»: the stairs behind the dog's torch
  hall: A.L6w10 - 0.06,              // «а в пункте обогрева»: the warm hall
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
const ITEMS = [A.L5w2 - 0.08, A.L5w3 - 0.08, A.L5w4 - 0.08, A.L5w7 - 0.08];   // documents, medicines, warm things, the torch
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.hall, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A, ITEMS };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'flat' : t < T.c2 ? 'body' : t < T.c3 ? 'tower' : t < T.c6 ? 'flat' : t < T.hall ? 'stairs' : 'hall');

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
const WARMPT = [-1500, 0];                                   // the warming centre on the blueprint: a school across the yard
shot(T.cover, [[T.cover, -880, -230, 1.75], [A.L0w4, -870, -240, 1.7], [T.c1, -850, -250, 1.62]]);
shot(T.c1, [[T.c1, 0, -330, 1.3], [T.loss, 0, -330, 1.38], [T.c2, 0, -330, 1.42]]);
shot(T.c2, [[T.c2, -200, FY(20), 0.9], [T.route, -300, FY(14), 0.6], [A.L2e, -700, FY(6), 0.45], [T.c3, -720, FY(6), 0.45]]);
shot(T.c3, [[T.c3, 160, -250, 1.5], [T.ice - 0.1, 140, -250, 1.55], [T.ice + 0.5, -600, -230, 1.6], [T.c4, -620, -230, 1.62]]);
shot(T.c4, [[T.c4, 150, -260, 1.3], [T.c5, 160, -260, 1.36]]);
shot(T.c5, [[T.c5, 60, -270, 1.6], [T.shut, 70, -270, 1.66], [T.c6, 80, -270, 1.7]]);
shot(T.c6, [[T.c6, -300, FY(20), 1.1], [T.hall, -300, FY(8), 1.1]]);
shot(T.hall, [[T.hall, 170, -330, 1.18], [T.c7, 160, -330, 1.24]]);
shot(T.c7, [[T.c7, 160, -330, 1.24], [DUR, 165, -335, 1.28]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.no, 9], [T.shut, 5]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// the third day: all the layers from part 4 on him (the jacket over the striped vest, the hat, the scarf)
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: false, pack: false, hat: true, scarf: 'neck', scarfWave: 0.3 * Math.sin(t * 2), ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const ICE_Y = -150;
const BUCKET = [-640, -190];                                 // the bucket of ice by the toilet (top of its handle)

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'flat') {
    // —— the hook: by the frozen tub, as part 4 ended ——
    if (t < T.c1) {
      const o = stand(base(t, { face: -1, look: [-0.6, 0.5], brow: 0.5, lean: 0.1 }), -640);
      const sh = shoulder(o);
      o.hands = { near: { p: [sh[0] - 40, sh[1] + 120], shape: 'fist' } };
      if (t > T.eight) { o.face = 1; o.look = [0.8, -0.2]; o.brow = 0.8; o.pop = clamp(sp(t, T.eight, 2.4, 7)) * (1 - seg(T.eight + 0.6, T.eight + 1.1, t)); }
      const d = { x: -470, y: 0, s: DS, face: -1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 0.6 };
      return { h: o, d, day: true };
    }
    // —— step 1: a tin and bread at the counter; the dog eats from her bowl ——
    if (t < T.ice) {
      const o = stand(base(t, { look: [0.6, 0.5], brow: 0.2, lean: 0.06 }), 100);
      const sh = shoulder(o), k = clamp(sp(t, A.L3w1 - 0.1, 2.4, 7));
      o.hands = { near: { p: [sh[0] + 70 * k, sh[1] + 40 - 30 * k], shape: 'grip' }, far: { p: [sh[0] + 50 * k, sh[1] + 60 - 10 * k], shape: 'grip' } };
      o.prop = { kind: 'tin', p: [sh[0] + 64 * k, sh[1] + 26 - 30 * k] };
      o.mouth = 0.2 + 0.2 * Math.abs(Math.sin(t * 6)) * seg(A.L3w1, A.L3w5, t);
      const d = { x: 300, y: 0, s: DS, face: 1, sit: 0, look: -0.9, t, blink: dblink(t), wag: 1, wagPh: t * 3, mouth: 0.4 };
      return { h: o, d, day: true };
    }
    // —— «лёд из ванны оставь для туалета»: the bucket of ice by the toilet ——
    if (t < T.c4) {
      const o = stand(base(t, { face: -1, look: [-0.5, 0.6], brow: 0.3 }), -720);
      const sh = shoulder(o);
      o.hands = { near: { p: [sh[0] - 50, sh[1] + 110], shape: 'point', ang: 0.6 } };
      const d = { x: -470, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t) };
      return { h: o, d, day: true, bucket: true };
    }
    // —— step 2: listening to the battery radio on the counter ——
    if (t < T.c5) {
      const o = stand(base(t, { look: [0.7, 0.3], brow: 0.5, headTilt: 0.16 }), 30);
      const sh = shoulder(o);
      o.hands = { near: { p: [sh[0] + 60, sh[1] + 70], shape: 'fist' } };
      const d = { x: 260, y: 0, s: DS, face: -1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1, tilt: 0.12 };
      return { h: o, d, day: true, radio: true };
    }
    // —— step 3: the backpack on, the things fly into it; a hand on the gas tap ——
    const o = stand(base(t, { look: [0.6, 0], brow: 0.3, pack: true }), 60);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 40, sh[1] + 130], shape: 'fist' } };
    if (t > T.shut - 0.2) { const k = seg(T.shut - 0.2, T.shut + 0.2, t) * (1 - seg(A.L5w12, A.L5w13, t)); o.hands = { near: { p: [lerp(sh[0] + 40, 380, k), lerp(sh[1] + 130, -180, k)], shape: 'grip' } }; }
    if (t > A.L5w13 - 0.1) { o.hands = { near: { p: [sh[0] + 50, sh[1] + 40], shape: 'grip' }, far: { p: [sh[0] + 36, sh[1] + 56], shape: 'point' } }; o.prop = { kind: 'phone', p: [sh[0] + 54, sh[1] + 14] }; o.look = [0.6, 0.7]; o.headTilt = 0.18; }
    const d = { x: -150, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.3, t, blink: dblink(t), wag: 0.5, wagPh: t * 3 };
    return { h: o, d, day: true, bag: true };
  }
  if (sc === 'hall') {
    // —— the warming centre: the volunteer pours porridge for the dog first; he waits with his bowl ——
    const o = stand(base(t, { look: [0.6, 0.3], brow: 0.4, pack: true, scarf: t > T.c7 ? 'neck' : 'neck' }), -200);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 70, sh[1] + 70], shape: 'grip' } };
    o.prop = { kind: 'bowl', p: [sh[0] + 76, sh[1] + 60] };
    if (t > A.L6w14) { o.brow = 0.8; o.pop = 0.4 * clamp(sp(t, A.L6w14, 2.4, 7)) * (1 - seg(A.L6w14 + 0.6, A.L6w14 + 1.2, t)); o.mouth = 0.3; }
    if (t > T.c7) { o.prop = null; o.look = [0.8, 0]; o.brow = 0.6; o.mouth = 0.35; const k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
    const eat = t > A.L6w16 + 0.3;
    const d = { x: 140, y: 0, s: DS, face: 1, sit: eat ? 0 : 1, look: eat ? -0.95 : 0.6, t, blink: dblink(t), wag: 1, wagPh: t * 3.4, mouth: eat ? 0.5 : 0.6, tongue: eat ? 0.3 : 0.8, ears: 1 };
    return { h: o, d };
  }
  return { h: null, d: null };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'tin') o.propNear = () => tin(p.p[0], p.p[1], 0.9, 1);
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.restore(); };
  if (p?.kind === 'bowl') o.propNear = () => { fill(polyPath([[p.p[0] - 44, p.p[1] - 20], [p.p[0] + 44, p.p[1] - 20], [p.p[0] + 32, p.p[1] + 12], [p.p[0] - 32, p.p[1] + 12]]), '#e9eef5'); };
  return drawHunter(o);
}

// —— the props ——
function tin(x, y, s = 1, open = 0) {
  rrect(x - 26 * s, y - 70 * s, 52 * s, 70 * s, 8 * s, '#b9c2cc'); rect(x - 26 * s, y - 52 * s, 52 * s, 30 * s, '#d9433b');
  rect(x - 16 * s, y - 44 * s, 32 * s, 6 * s, '#fff3d6'); rect(x - 26 * s, y - 70 * s, 52 * s, 6 * s, '#8c96a3');
  if (open > 0.02) { g.save(); g.translate(x + 26 * s, y - 70 * s); g.rotate(-1.9 * open); ell(-26 * s, 0, 26 * s, 6 * s, '#cfd6de'); g.restore(); ell(x, y - 70 * s, 22 * s, 4 * s, '#8a5a3a'); }
}
function bread(x, y) { ell(x, y - 26, 46, 28, '#c98a4a'); ell(x - 6, y - 34, 38, 18, '#d99c5a'); for (let i = -1; i <= 1; i++) limb([[x + i * 18 - 6, y - 44], [x + i * 18 + 6, y - 30]], 4, '#a86a34', false); }
// the gas stove from part 4
const STOVE = { x0: 470, x1: 770, top: -226 };
function stove(t) {
  const { x0, x1, top } = STOVE;
  rrect(x0, top, x1 - x0, -top, 10, '#eef0f2'); rect(x0, top, x1 - x0, 18, '#c9d0d6');
  rrect(x0 + 30, top + 70, x1 - x0 - 60, -top - 100, 10, '#3a3f4a'); rrect(x0 + 50, top + 90, x1 - x0 - 100, -top - 150, 8, '#252a33');
  rect(x0 + 60, top + 76, x1 - x0 - 120, 8, '#c9d0d6');
  for (let i = 0; i < 4; i++) { const k = [x0 + 60 + i * 56, top + 40]; ell(k[0], k[1], 13, 13, '#2c3140'); rect(k[0] - 2, k[1] - 12, 4, 10, '#9aa3b2'); }
  for (const bx of [x0 + 80, x0 + 220]) { ell(bx, top - 4, 46, 8, '#2c3140'); ell(bx, top - 8, 22, 5, '#555c6a'); }
}
// the gas tap on the pipe beside the stove: the yellow handle turns across the pipe when it is shut
const GASTAP = [400, -300];
function gasTap(t, shut) {
  limb([[GASTAP[0], -720], [GASTAP[0], GASTAP[1] - 20], [GASTAP[0] + 70, GASTAP[1] - 20], [GASTAP[0] + 70, -180], [STOVE.x0 + 20, -180]], 14, '#c9a24a', false);
  ell(GASTAP[0], GASTAP[1] - 20, 16, 16, '#9a7a30');
  g.save(); g.translate(GASTAP[0], GASTAP[1] - 20); g.rotate(-Math.PI / 2 * shut); rrect(-8, -60, 16, 60, 6, '#ffd23f'); g.restore();
}
// snowflakes over a rectangle, falling and drifting
function snow(t, x0, y0, w, h, n = 120, size = 5, a = 0.8) {
  for (let i = 0; i < n; i++) {
    const sp2 = 40 + 60 * hash(i * 1.7), y = y0 + ((hash(i * 3.1) * h + t * sp2) % h), x = x0 + ((hash(i * 5.3) * w + 18 * Math.sin(t * 0.9 + i)) % w + w) % w;
    ell(x, y, size * (0.4 + 0.6 * hash(i)), size * (0.4 + 0.6 * hash(i)), rgba('#f3f8ff', a * (0.4 + 0.6 * hash(i * 9.1))));
  }
}
// frost round the edges of a window, falling snow in it
function frost(t, { x0, x1, y0, y1 }, a = 0.9) {
  inside(rrPath(x0, y0, x1 - x0, y1 - y0, 2), () => {
    snow(t, x0, y0, x1 - x0, y1 - y0, 40, 4, a);
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 170); gr.addColorStop(0, 'rgba(235,246,255,0.85)'); gr.addColorStop(1, 'rgba(235,246,255,0)');
      g.fillStyle = gr; g.fillRect(cx - 170, cy - 170, 340, 340);
    }
  });
}
function breath(t, [x, y], dir = 1) {
  for (let i = 0; i < 2; i++) {
    const u = ((t + i * 0.7) % 1.4) / 1.4;
    if (u > 0.85) continue;
    ell(x + dir * (20 + 70 * u), y - 30 * u, 12 + 26 * u, 9 + 18 * u, rgba('#eef6ff', 0.55 * (1 - u / 0.85)));
  }
}
// the ice on the tub, cracked where he knocked in part 4
function tubIce() {
  const { in0, in1, rim, bot } = Ap.TUB;
  const win = rrPath(in0 + 30, rim + 30, in1 - in0 - 60, bot - rim - 50, 22);
  inside(win, () => {
    rect(in0, ICE_Y - 10, in1 - in0, 26, '#dff2ff'); rect(in0, ICE_Y - 10, in1 - in0, 6, '#ffffff');
    for (let i = 0; i < 7; i++) limb([[in0 + 40 + i * 60, ICE_Y - 6], [in0 + 70 + i * 60, ICE_Y + 14]], 2, 'rgba(120,170,210,0.6)', false);
  });
  rect(Ap.TUB.x0 + 14, rim - 18, Ap.TUB.x1 - Ap.TUB.x0 - 28, 8, '#e6f6ff');
  for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) { const a = -Math.PI + i * 0.5 + j * 0.3; limb([[-880, rim - 14], [-880 + Math.cos(a) * 60, rim - 14 + Math.sin(a) * 8]], 3, 'rgba(110,160,200,0.8)', false); }
}
// the bucket by the toilet with chunks of ice from the tub in it
function iceBucket() {
  const [x, y] = BUCKET;
  Ap.drawBucket(x, y, 1, 0, 0);
  for (let i = 0; i < 5; i++) poly([[x - 44 + i * 20, y + 64], [x - 30 + i * 20, y + 30 - 10 * (i % 2)], [x - 12 + i * 20, y + 40], [x - 10 + i * 20, y + 66]], i % 2 ? '#dff2ff' : '#c8e8fb');
}
// the battery radio on the counter: a dial, a speaker grille, the aerial up
const RADIO = [200, -300];
function radio(t) {
  const [x, y] = RADIO;
  limb([[x + 60, y - 120], [x + 130, y - 300]], 5, '#9aa3b2', false);
  rrect(x - 110, y - 130, 220, 130, 16, '#c0533a'); rrect(x - 96, y - 116, 110, 100, 10, '#3a2a24');
  for (let i = 0; i < 6; i++) rect(x - 90, y - 108 + i * 15, 98, 6, '#5a3c32');
  rrect(x + 26, y - 116, 70, 40, 6, '#f2e6c8'); rect(x + 30 + 30 * (0.5 + 0.5 * Math.sin(t * 0.7)), y - 112, 3, 32, '#d9433b');
  ell(x + 60, y - 46, 16, 16, '#2c3140');
  if ((t % 0.8) < 0.5) for (let i = 1; i <= 3; i++) { g.lineWidth = 4; g.strokeStyle = rgba('#ffd23f', 0.7 - i * 0.18); g.beginPath(); g.arc(x - 40, y - 66, 60 + i * 26, -0.7, 0.7); g.stroke(); }
}

// —— the night light (the stairs) ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }

// —— frame ——
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'body') bodyFrame(t, cam);
  else if (sc === 'tower') towerFrame(t, cam);
  else if (sc === 'stairs') stairsFrame(t, cam);
  else if (sc === 'hall') hallFrame(t, cam);
  else flatFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'tower' || sc === 'body' || sc === 'stairs' ? 0.6 : 1);
}

// —— the flat on the third morning: grey daylight, frost, the ice ——
function flatFrame(t, cam) {
  const { h, d, bucket, radio: rad, bag } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t, {});
  Ap.drawWindow(t, { day: 1 });
  frost(t, Ap.WIN);
  Ap.drawTub(t, { level: 0.8, run: 0 });
  tubIce();
  Ap.drawToilet(t, {});
  if (t >= T.ice) iceBucket();
  Ap.drawFridge(t);
  Ap.drawCounter(t, { fills: [1, 0.6, 0.3, 0, 0] });
  stove(t);
  gasTap(t, t >= T.c5 ? seg(T.shut, T.shut + 0.4, t) : 0);
  if (t >= T.c3 && t < T.ice) { bread(-20, Ap.COUNTER.top); tin(60, Ap.COUNTER.top, 1, 1); }
  if (rad) radio(t);
  // the dog's bowl: food in it during step 1
  Ap.drawBowl(t, 0); if (t >= T.c3 && t < T.ice) ell(Ap.BOWL[0], Ap.BOWL[1] - 36, 40, 8, '#c98a4a');
  let A2 = null;
  if (d) drawDog(d);
  if (h) A2 = hunterDraw(t, h);
  if (A2?.mouth) breath(t, A2.mouth, h.face === -1 ? -1 : 1);
  // a cold grey-blue tint over the morning
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(70,110,170,0.12)'; g.fillRect(0, 0, W, H);
}

// —— the body on the thermal camera: the bottle seems to warm, the heat leaves faster ——
const THERM = ['#140a36', '#3a1a8a', '#9c2a86', '#e2572e', '#ffb340', '#fff3c0'];
function therm(v) {
  v = clamp(v) * (THERM.length - 1);
  const i = Math.min(THERM.length - 2, Math.floor(v));
  return mix(THERM[i], THERM[i + 1], v - i);
}
function bodyFrame(t, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = therm(0.12); g.fillRect(0, 0, W, H);
  view(cam, 1);
  for (let i = 0; i < 8; i++) { const x = -500 + 140 * i, y = -600 + 300 * hash(i); ell(x, y, 160, 120, rgba(therm(0.18), 0.6)); }
  const glow = seg(T.seems, T.seems + 0.5, t) * (1 - seg(T.loss + 0.6, T.loss + 1.6, t)), cool = seg(T.loss, T.loss + 1.8, t);
  const core = lerp(0.82, 0.5, cool);
  const o = stand(base(t, { s: 0.75, face: 1, look: [0.6, 0], pack: false }), -20);
  const sh = shoulder(o);
  o.hands = { near: { p: [sh[0] + 80, sh[1] + 40], shape: 'grip' } };
  // the warm halo of the skin: brighter when the drink «seems» to warm
  const hx = o.hip[0], hy = o.hip[1] - 140;
  const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 380); gr.addColorStop(0, rgba(therm(0.7 + 0.25 * glow), 0.55)); gr.addColorStop(1, rgba(therm(0.3), 0));
  g.fillStyle = gr; g.fillRect(hx - 400, hy - 400, 800, 800);
  MONO.on = true; MONO.color = therm(core + 0.12 * glow);
  drawHunter(o);
  MONO.on = false;
  // the bottle in his hand, cold blue on the camera
  const b = o.hands.near.p;
  rrect(b[0] - 14, b[1] - 90, 28, 110, 8, therm(0.3)); rrect(b[0] - 7, b[1] - 120, 14, 34, 4, therm(0.3));
  // the heat leaving the body: chevrons out in every direction
  if (cool > 0.01) for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU, u = ((t * 0.8 + i * 0.27) % 1), r = 200 + 260 * u;
    g.save(); g.globalAlpha = 0.9 * bump(u) * clamp(cool * 2); g.translate(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 1.3); g.rotate(a);
    limb([[-14, -18], [10, 0], [-14, 18]], 10, therm(0.8 - 0.5 * u), false); g.restore();
  }
  const label = cool > 0.5 ? '+35,0°' : '+36,6°';
  Hd.label(label, hx, o.hip[1] - 440, 72, therm(cool > 0.5 ? 0.55 : 0.95), { fam: FONTS.mono, shadow: false, stroke: false });
}

// —— the plan: the tower in section, the route from the 20th floor down the stairs and across to the warming centre ——
const routeK = t => seg(T.route, A.L2e + 0.2, t, u => u);
function routePoint(u) {
  const d0 = Sc.stairD(20), d1 = Sc.stairD(1) + 400;
  const stairEnd = Sc.stairAt(1e9);
  if (u < 0.75) return Sc.stairAt(lerp(d0, d1, u / 0.75));
  return [lerp(stairEnd[0], WARMPT[0] + 160, (u - 0.75) / 0.25), lerp(stairEnd[1], WARMPT[1] - 20, (u - 0.75) / 0.25)];
}
function towerFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  Sc.tower(t, P, { level: 0, flow: 0, spin: 0, power: 0, dots: [], home: 1, dry: 0, labels: 1, mark: null });
  // the warming centre: a low school across the yard, warm windows
  const [wx, wy] = WARMPT;
  Sc.gline([[wx - 300, wy], [wx - 300, wy - 360], [wx + 300, wy - 360], [wx + 300, wy]], 5, P.warm, P);
  for (let i = 0; i < 4; i++) fill(rrPath(wx - 260 + i * 140, wy - 300, 100, 90, 6), rgba(P.warm, 0.35 + 0.15 * Math.sin(t * 2 + i)));
  fill(rrPath(wx - 50, wy - 160, 100, 160, 6), rgba(P.warm, 0.5));
  // the route: dashes appear from the 20th floor down to the door of the school
  const k = routeK(t);
  if (k > 0.001) {
    const n = 80;
    for (let i = 0; i < n * k; i += 1) { const a = routePoint(i / n), b = routePoint(Math.min(k, (i + 0.55) / n)); Sc.gline([a, b], 9, P.warm, P); }
    const p = routePoint(k); ell(p[0], p[1], 26, 26, P.warm);
  }
  ell(Sc.BLD.stair[1] + 70, FY(20) - 30, 18, 18, P.warm);
}

// —— the descent: the stairwell in section, the dog's torch first, him behind; the floor counter runs down ——
function stairsFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  Sc.tower(t, P, { level: 0, flow: 0, spin: 0, power: 0, dots: [], home: 0.4, dry: 0, labels: 1, mark: null });
  const u = seg(T.c6 + 0.1, T.hall - 0.1, t, u2 => u2), d0 = Sc.stairD(20), d1 = Sc.stairD(8);
  const dog = Sc.stairAt(lerp(d0, d1, u) + 260), you = Sc.stairAt(lerp(d0, d1, u));
  // the torch: a warm cone ahead of the dog, down the next flight
  const ahead = Sc.stairAt(lerp(d0, d1, u) + 380), a = Math.atan2(ahead[1] - dog[1], ahead[0] - dog[0]);
  fill(polyPath([dog, [dog[0] + Math.cos(a - 0.35) * 420, dog[1] + Math.sin(a - 0.35) * 420], [dog[0] + Math.cos(a + 0.35) * 420, dog[1] + Math.sin(a + 0.35) * 420]]), rgba('#ffcf7a', 0.35));
  ell(dog[0], dog[1] - 16, 16, 16, P.warm); ell(you[0], you[1] - 22, 22, 22, P.hi);
  Hd.label('ПУРГА', dog[0] + 40, dog[1] + 50, 30, P.warm, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  Hd.label('ТЫ', you[0] - 40, you[1] - 40, 30, P.hi, { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
}

// —— the warming centre: a school gym, camp beds, a table with a pot; the volunteer pours for the dog first ——
const POT = [430, -300];
function hallFrame(t, cam) {
  const { h, d } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2230'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-1300, -900, 2600, 900, '#f1dcb0');
  for (let i = 0; i < 4; i++) {                              // the tall windows with snow outside
    const x0 = -1100 + i * 560, w = { x0, x1: x0 + 300, y0: -820, y1: -480 };
    rect(w.x0 - 16, w.y0 - 16, 332, 372, '#e9e2d2'); rect(w.x0, w.y0, 300, 340, '#9fb4c6'); frost(t, w, 0.9);
    rect(w.x0 + 143, w.y0, 14, 340, '#e9e2d2');
  }
  for (let i = 0; i < 9; i++) rect(-1250 + i * 50, -460, 10, 420, '#c48a52');      // the wall bars of the gym
  rect(-1250, -460, 440, 10, '#c48a52'); rect(-1250, -260, 440, 10, '#c48a52');
  rect(-1300, -40, 2600, 40, '#c98d5a'); rect(-1300, 0, 2600, 200, '#b27546');
  for (let i = 0; i < 3; i++) {                              // camp beds with blankets
    const x = -1150 + i * 280; rect(x, -130, 230, 30, '#3f6b5a'); rect(x + 20, -100, 8, 100, '#2c3a33'); rect(x + 200, -100, 8, 100, '#2c3a33'); rect(x + 30, -150, 120, 26, '#c4473a');
  }
  // the table with the pot of porridge and its steam
  rect(260, -230, 380, 20, '#9d6c43'); rect(280, -210, 16, 210, '#7a5434'); rect(604, -210, 16, 210, '#7a5434');
  rrect(POT[0] - 80, POT[1] - 10, 160, 90, 14, '#9aa6b8'); rect(POT[0] - 96, POT[1] - 14, 192, 14, '#7a879a');
  for (let i = 0; i < 3; i++) { const u = ((t * 0.6 + i / 3) % 1); ell(POT[0] - 30 + i * 30 + 10 * Math.sin(t + i), POT[1] - 30 - 120 * u, 18 + 20 * u, 14 + 14 * u, rgba('#ffffff', 0.5 * (1 - u))); }
  // the volunteer: a dark figure in a vest with the ladle, pouring into the dog's bowl
  const pour = seg(A.L6w15 - 0.3, A.L6w16 + 0.1, t) * (1 - seg(A.L6e, A.L6e + 0.5, t));
  MONO.on = true; MONO.color = '#4b5c7a';
  const v = stand({ s: 0.6, face: -1, lean: 0.05 + 0.2 * pour, look: [-0.6, 0.6], hat: false, jacket: true, boots: true, pack: false, blink: 0 }, 560);
  const vs = framesOf(v).T.p([-14, -192]);
  const lad = [lerp(POT[0] + 10, 260, pour), lerp(POT[1] - 30, -120, pour)];
  v.hands = { near: { p: lad, shape: 'grip' } };
  drawHunter(v);
  MONO.on = false;
  limb([lad, [lad[0] - 40, lad[1] + 20]], 8, '#9aa6b8', false); ell(lad[0] - 46, lad[1] + 26, 18, 12, '#9aa6b8');
  if (pour > 0.6 && pour < 0.99) limb([[lad[0] - 50, lad[1] + 32], [lad[0] - 54, -40]], 10, '#e8c27a', false);
  void vs;
  // the dog's bowl on the floor, filling
  const bx = 250, fillK = seg(A.L6w16, A.L6w16 + 0.8, t);
  fill(polyPath([[bx - 50, -34], [bx + 50, -34], [bx + 40, 0], [bx - 40, 0]]), '#d9433b');
  if (fillK > 0.02) ell(bx, -34, 44, 8 * fillK, '#e8c27a');
  if (d) drawDog(d);
  if (h) hunterDraw(t, h);
  // the warm light of the hall
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(255,190,110,0.06)'; g.fillRect(0, 0, W, H);
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c1 - 0.1, 'ДЕНЬ 3 — 08:10');
  Hd.timeStamp(t, T.c3 + 0.05, T.c6 - 0.1, 'ДЕНЬ 3 — 09:30');
  Hd.timeStamp(t, T.hall + 0.05, T.c7 - 0.1, 'ДЕНЬ 3 — 11:05');
  // the hook: the thermometer drops to +8
  if (t < T.c1) thermometer(t, 170, 640);
  // the body
  if (sc === 'body') {
    const b = actorsAt(t).h ? null : null; void b;
    const p = S2([110, -420]); Hd.redX(p[0], p[1], 80, sp(t, T.no, 2.6, 8) * (1 - seg(T.seems - 0.2, T.seems, t)));
    thermScale(t, 990, 600);
    Hd.plaque(t, T.loss + 0.1, T.c2 - 0.05, 540, 330, { icon: 'snow', title: 'ТЕПЛО УХОДИТ', sub: 'быстрее, чем без водки', color: ICE });
  }
  Hd.ribbon(t, T.no, T.seems - 0.15, 'АЛКОГОЛЬ НЕ ГРЕЕТ', { y: 760, size: 92 });
  // the plan
  if (sc === 'tower') {
    Hd.plaque(t, T.route + 0.4, T.c3 - 0.05, 540, 330, { icon: 'house', title: 'ПУНКТ ОБОГРЕВА', sub: 'тепло, еда, люди', color: WARM, to: S2([WARMPT[0], WARMPT[1] - 380]) });
    Hd.plaque(t, A.L2w13 - 0.08, T.c3 - 0.05, 540, 1560, { icon: 'stairs', title: 'ПО ПЛАНУ', sub: 'а не наугад', color: GOLD });
  }
  // step 1
  Hd.stepHeader(t, 1, 'ЕШЬ И ПЕЙ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.ice) Hd.plaque(t, A.L3w5 - 0.08, T.ice - 0.02, 540, 560, { icon: 'can', title: 'ЕДА ГРЕЕТ', sub: 'ешь каждые несколько часов', color: OK });
  if (t >= T.ice && t < T.c4) Hd.plaque(t, T.ice + 0.3, T.c4 - 0.02, 540, 560, { icon: 'toilet', title: 'ЛЁД — ДЛЯ ТУАЛЕТА', sub: 'не для питья', color: ICE, to: S2([BUCKET[0], BUCKET[1] + 40]) });
  // step 2
  Hd.stepHeader(t, 2, 'ГДЕ ПУНКТ ОБОГРЕВА', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) radioCard(t, 540, 620);
  // step 3
  Hd.stepHeader(t, 3, 'СОБЕРИСЬ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) {
    const o = actorsAt(t).h, pack = o ? S2([o.hip[0] - 70, o.hip[1] - 120]) : [540, 900];
    bagItems(t, pack);
    checklist(t, 820, 720);
  }
  // the descent: the floor counter
  if (sc === 'stairs') {
    const f = Math.round(lerp(20, 8, seg(T.c6 + 0.1, T.hall - 0.1, t, u => u)));
    Hd.plaque(t, T.c6 + 0.1, T.hall - 0.05, 540, 330, { icon: 'stairs', title: `ЭТАЖ ${f}`, sub: 'лифт не работает', color: GOLD, size: 50 });
  }
  if (sc === 'hall' && t < T.c7) Hd.plaque(t, A.L6w14 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ПУРГЕ — ПЕРВОЙ', sub: 'тёплая каша', color: WARM, to: S2([250, -60]) });
  // the end
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ГДЕ ТВОЙ ПУНКТ ОБОГРЕВА?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
}
// the room thermometer: from +12 (where part 4 left it) down to +8 on «плюс восемь»
function thermometer(t, x, y) {
  const k = clamp(sp(t, A.L0w1, 2.4, 8));
  if (k <= 0.01) return;
  const u = seg(T.eight, T.eight + 1.0, t), deg = Math.round(lerp(12, 8, u)), h = 420, colH = lerp(0.46, 0.32, u);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.85, 1, k), lerp(0.85, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-90, -h / 2 - 50, 180, h + 170, 30, 'rgba(11,15,26,0.9)'); g.restore();
  rrect(-22, -h / 2, 44, h, 22, '#e9eef5'); ell(0, h / 2 + 30, 44, 44, '#e9eef5');
  const top = h / 2 - h * colH, c = mix('#e53935', '#3b8eea', 0.6 + 0.3 * u);
  rrect(-12, top, 24, h / 2 - top + 20, 12, c); ell(0, h / 2 + 30, 32, 32, c);
  for (let i = 0; i <= 6; i++) rect(24, -h / 2 + 30 + i * (h - 60) / 6, 16, 4, '#9aa8bc');
  Hd.label(`+${deg}°`, 0, -h / 2 - 8, 52, ICE, { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function thermScale(t, x, y) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const h = 520, gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  THERM.slice().reverse().forEach((c, i) => gr.addColorStop(i / (THERM.length - 1), c));
  rrect(x - 26, y - h / 2 - 10, 52, h + 20, 12, 'rgba(11,15,26,0.8)'); g.fillStyle = gr; g.fillRect(x - 14, y - h / 2, 28, h);
  Hd.label('+37', x - 40, y - h / 2 + 14, 30, '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  Hd.label('+10', x - 40, y + h / 2, 30, '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  rrect(36, 230, 300, 64, 12, 'rgba(11,15,26,0.8)');
  ell(66, 262, 10, 10, (t % 1) < 0.6 ? '#e53935' : 'rgba(229,57,53,0.3)');
  Hd.label('ТЕПЛОВИЗОР', 90, 274, 34, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
}
// step 2: the radio's words typed out under it
function radioCard(t, cx, cy) {
  const k = clamp(sp(t, A.L4w8 - 0.15, 2.4, 8)) * (1 - seg(T.c5 - 0.25, T.c5 - 0.02, t));
  if (k <= 0.01) return;
  const msg = '…пункт обогрева открыт в школе № 12, есть горячая еда…', n = Math.round(msg.length * seg(A.L4w8, A.L4e + 0.6, t, u => u));
  const w = 820, h = 200;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-w / 2, -h / 2, w, h, 22, 'rgba(11,15,26,0.92)'); g.restore();
  g.lineWidth = 3; g.strokeStyle = '#ffd23f'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 21));
  ell(-w / 2 + 50, -h / 2 + 44, 10, 10, (t % 1) < 0.6 ? '#e53935' : 'rgba(229,57,53,0.3)');
  Hd.label('РАДИО · 98,6 FM', -w / 2 + 72, -h / 2 + 56, 30, '#ffd23f', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  const shown = msg.slice(0, n), cut = shown.length > 28 ? shown.lastIndexOf(' ', 28) : -1;
  const l1 = cut > 0 ? shown.slice(0, cut) : shown, l2 = cut > 0 ? shown.slice(cut + 1) : '';
  Hd.label(l1, -w / 2 + 40, 20, 40, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label(l2, -w / 2 + 40, 70, 40, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  g.restore();
}
// step 3: the four things fly into the backpack
function bagItems(t, [cx, cy]) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  ITEMS.forEach((t0, i) => {
    const u = seg(t0 - 0.05, t0 + 0.4, t, ease.out);
    if (u <= 0 || u >= 1) return;
    const x = lerp(1180, cx, u), y = lerp(520 + i * 70, cy, u) - 160 * bump(u), s = lerp(1.2, 0.5, u);
    g.save(); g.translate(x, y); g.rotate(0.5 * (1 - u)); g.scale(s, s); g.globalAlpha = 1 - 0.6 * seg(0.7, 1, u, u2 => u2);
    if (i === 0) { rrect(-60, -44, 120, 88, 8, '#3c7ad6'); rect(-48, -30, 70, 8, '#ffffff'); rect(-48, -12, 50, 8, '#ffffff'); }
    else if (i === 1) { rrect(-46, -36, 92, 72, 10, '#ffffff'); rect(-8, -24, 16, 48, '#e53935'); rect(-24, -8, 48, 16, '#e53935'); }
    else if (i === 2) { poly([[-60, -60], [-24, -74], [24, -74], [60, -60], [96, -16], [72, 6], [48, -14], [48, 70], [-48, 70], [-48, -14], [-72, 6], [-96, -16]], '#7a9a5a'); for (let j = 0; j < 3; j++) rect(-48, -10 + j * 24, 96, 8, '#5f7c45'); }
    else { limb([[-60, 0], [40, 0]], 34, '#2b3346', false); ell(56, 0, 14, 22, '#ffe7a8'); }
    g.restore();
  });
}
// step 3: the checklist card on the right, ticked line by line
function checklist(t, x, y) {
  const rows = [['документы', ITEMS[0]], ['лекарства', ITEMS[1]], ['тёплые вещи', ITEMS[2]], ['фонарик', ITEMS[3]], ['вода и газ', T.shut + 0.3], ['родным', A.L5w14]];
  const k = clamp(sp(t, ITEMS[0] + 0.3, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const w = 380, h = 70 + rows.length * 62;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-w / 2, -h / 2, w, h, 16, '#f6f2e7'); g.restore();
  rows.forEach(([r, t0], i) => {
    const yy = -h / 2 + 64 + i * 62, on = clamp((t - t0 - 0.35) / 0.15);
    rrect(-w / 2 + 24, yy - 30, 34, 34, 6, '#d9d2c2');
    if (on > 0) limb([[-w / 2 + 30, yy - 14], [-w / 2 + 40, yy - 4], [-w / 2 + 58, yy - 30]], 7, rgba('#2f8f4e', on), false);
    Hd.label(r, -w / 2 + 76, yy, 36, '#17162f', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  });
  g.restore();
}

// —— the poster: him with the backpack and the dog with her torch at the door, frost, breath; the words on the right ——
function coverFrame(t) {
  const cam = { x: -120, y: -330, z: 1.55, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t); Ap.drawWindow(t, { day: 1 }); frost(t, Ap.WIN); Ap.drawFridge(t); Ap.drawCounter(t, {});
  const o = stand(base(t, { s: 0.95, face: 1, pop: 0.5, brow: 0.8, mouth: 0.4, look: [0.7, -0.1], blink: 0, lean: -0.05, pack: true }), -260, 120);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 120, sh[1] + 40], shape: 'point', ang: 0 } };
  drawDog({ x: 40, y: 60, s: 1.05, face: 1, sit: 1, torch: true, look: 0.15, t: 0, ears: 1 });
  const A2 = drawHunter(o);
  breath(0.6, A2.mouth, 1); breath(1.1, A2.mouth, 1);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(70,110,170,0.14)'; g.fillRect(0, 0, W, H);
  snow(0.5, 0, 0, W, 700, 50, 6, 0.5);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ТРЕТИЙ ДЕНЬ', 0, 200, 112, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(120,200,255,0.9)'; g.shadowBlur = 40; Hd.label('В ХОЛОДЕ', 0, 340, 120, ICE, { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 5 · ПОРА УХОДИТЬ', pw = measure(pl, 52, FONTS.cond) + 60;
  rect(-pw + 8, 410 + 8, pw, 88, INK); rect(-pw, 410, pw, 88, '#ffd43b'); text(pl, -pw / 2, 472, 52, '#111111', { fam: FONTS.cond, shadow: false });
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
  add(0.3, 'amb_flat', -20, 0, { dur: T.c1 - 0.3 });
  add(A.L0w1, 'blip', -10, 0.3);
  add(T.eight, 'ticks_up', -18, 0.3, { dur: Math.min(0.9, A.L0e - T.eight - 0.05) });
  add(T.c1, 'whoosh', -12, 0);
  add(T.no, 'stamp', -5, 0.1);
  add(T.no, 'ribbon', -8, 0);
  add(T.loss, 'puff', -12, 0);
  add(T.loss + 0.1, 'blip', -10, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.route + 0.4, 'blip', -10, -0.2);
  add(A.L2w13 - 0.08, 'ding', -10, 0);
  add(T.c3, 'amb_flat', -20, 0, { dur: T.c6 - T.c3 });
  add(A.L3w1 - 0.1, 'click', -10, 0.1);
  add(A.L3w5 - 0.08, 'blip', -10, 0);
  add(T.ice + 0.3, 'fill_plink', -12, -0.3);
  add(T.c4 + 0.2, 'toggle', -12, 0.2);
  add(A.L4w8 - 0.15, 'whoosh_in', -14, 0);
  ITEMS.forEach((t0, i) => { add(t0, 'whoosh_in', -14, 0.4); add(t0 + 0.4, 'pop_word', -10, 0.1 + 0.05 * i); });
  add(T.shut, 'tap_squeak', -12, 0.3);
  add(A.L5w14, 'ding', -10, 0.1);
  add(T.c6, 'whoosh', -12, 0);
  add(T.c6 + 0.1, 'crowd_steps', -22, 0, { dur: T.hall - T.c6 - 0.2 });
  add(T.hall, 'whoosh', -12, 0);
  add(T.hall, 'city_day', -24, 0, { dur: DUR - T.hall });
  add(A.L6w16, 'pour', -12, 0.2, { dur: 0.6 });
  add(A.L6w14 - 0.1, 'blip', -10, 0);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
