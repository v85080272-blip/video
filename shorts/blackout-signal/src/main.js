// «Пропала связь» (блэкаут, ч.6): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// It goes on from part 5: the fourth day in the warming centre (the school gym of ../blackout-cold). New here: the phone
// losing its bars, the rumours passed along the camp beds, the city on the blueprint with dead cell towers and a live
// radio mast, the crank radio, the family's messages all going through one person in another town, the car in the
// yard charging a phone against the one in a shut garage, and the radio's news that the power comes back tomorrow.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 5.57, 16], L1: [5.97, 10.71, 15], L2: [11.11, 14.9, 10], L3: [15.36, 21.08, 14], L4: [21.48, 27.09, 15], L5: [27.49, 34.29, 17], L6: [34.74, 41.44, 19], L7: [41.88, 45.65, 11] };
export const DUR = VOICE?.dur ?? 46.0;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm, ICE = '#8fd3ff';
const HOT = { ВЫШКИ: DANGER, СЕТИ: DANGER, СЛУХАМ: DANGER, РАДИО: GOLD, БАТАРЕЙКАХ: GOLD, РУЧКОЙ: GOLD, ОФИЦИАЛЬНЫМ: GOLD,
  ОДНОМУ: GOLD, ЧЕЛОВЕКУ: GOLD, УЛИЦЕ: OK, ГАРАЖЕ: DANGER, УГАРНЫМ: DANGER, ГАЗОМ: DANGER, ЗАВТРА: GOLD, СВЕТ: GOLD,
  ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster
  bars: A.L0w9 - 0.06,               // «вышки сели»: the bars go one by one
  c1: A.L1 - 0.06,                   // «Ты не знаешь…»: the rumours along the camp beds
  rum: A.L1w10 - 0.06,               // «И начинаешь верить любым слухам»: the bubbles
  c2: A.L2 - 0.06,                   // «А новости никуда не делись»: the city on the blueprint, the radio mast
  waves: A.L2w7 - 0.06,              // «передают по радио»
  c3: A.L3 - 0.06,                   // step 1: the crank radio
  crank: A.L3w6 - 0.06,              // «с ручкой»
  c4: A.L4 - 0.06,                   // step 2: one person in another town
  relay: A.L4w10 - 0.06,             // «а он передаёт новости остальным»
  c5: A.L5 - 0.06,                   // step 3: the car in the yard
  garage: A.L5w10 - 0.06,            // «В гараже…»: the shut garage
  c6: A.L6 - 0.06,                   // the evening: the radio's news
  news: A.L6w4 - 0.06,               // «завтра … дадут свет»
  nb: A.L6w10 - 0.06,                // «А сосед всё ещё ждал…»
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c2 ? 'hall' : t < T.c3 ? 'city' : t < T.c4 ? 'hall' : t < T.c5 ? 'schema' : t < T.c6 ? 'yard' : 'hall');

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
shot(T.cover, [[T.cover, -40, -330, 1.3], [T.c1, -20, -330, 1.36]]);
shot(T.c1, [[T.c1, -700, -330, 1.0], [T.rum, -650, -340, 1.08], [T.c2, -620, -340, 1.12]]);
shot(T.c2, [[T.c2, 0, -500, 0.62], [T.waves, 0, -520, 0.66], [T.c3, 0, -520, 0.68]]);
shot(T.c3, [[T.c3, -120, -300, 1.6], [T.c4, -110, -300, 1.68]]);
shot(T.c4, [[T.c4, 0, -700, 1.0], [T.c5, 0, -700, 1.04]]);
shot(T.c5, [[T.c5, -150, -260, 1.15], [T.garage - 0.2, -200, -260, 1.2], [T.garage + 0.5, 520, -260, 1.2], [T.c6, 540, -260, 1.22]]);
shot(T.c6, [[T.c6, -40, -330, 1.25], [T.nb - 0.2, -60, -330, 1.3], [T.nb + 0.5, -620, -330, 1.3], [T.c7, -640, -330, 1.32]]);
shot(T.c7, [[T.c7, -40, -330, 1.25], [DUR, -30, -335, 1.3]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.garage + 0.6, 6], [T.news, 5]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// in the warming centre: the jacket and the scarf on, the hat and the backpack off
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: false, hat: true, scarf: 'neck', scarfWave: 0.2 * Math.sin(t * 2), ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function sitOn(o, x, y) { const k = (o.s ?? S) / S; o.hip = [x, y]; o.feet = { near: [x + 70 * k, 0], far: [x + 92 * k, 0] }; o.lean = -0.02; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const BED_Y = -150;                                             // the top of a camp bed

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'hall' && sc !== 'yard') return { h: null, d: null };
  if (sc === 'yard') {
    // —— step 3: by the car in the yard, the phone on its cable through the open window ——
    const o = stand(base(t, { look: [0.6, 0.3], brow: 0.3 }), -380);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 60, sh[1] + 60], shape: 'grip' } };
    o.prop = { kind: 'phone', p: [sh[0] + 64, sh[1] + 34] };
    if (t > T.garage + 0.4) { o.look = [0.9, 0]; o.brow = 0.9; o.pop = 0.5 * clamp(sp(t, T.garage + 0.4, 2.4, 7)); }
    const d = { x: -560, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 0.8 };
    return { h: o, d, cold: true };
  }
  // —— the hook: sitting on a camp bed, the phone in his hand ——
  if (t < T.c1) {
    const o = sitOn(base(t, { look: [0.7, 0.6], brow: 0.3, headTilt: 0.16 }), -60, BED_Y);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 60, sh[1] + 40], shape: 'grip' }, far: { p: [sh[0] + 46, sh[1] + 56], shape: 'point' } };
    o.prop = { kind: 'phone', p: [sh[0] + 64, sh[1] + 14] };
    if (t > T.bars + 0.8) { o.brow = 0.8; o.look = [0.6, 0.7]; o.mouth = 0.2; }
    const d = { x: 160, y: 0, s: DS, face: -1, sit: 1, look: 0.4, t, blink: dblink(t) };
    return { h: o, d };
  }
  // —— the rumours: he listens to the beds next to his ——
  if (t < T.c2) {
    const o = sitOn(base(t, { face: -1, look: [-0.7, 0.1], brow: 0.5 }), -60, BED_Y);
    if (t > T.rum + 0.6) { o.pop = 0.5; o.brow = 0.9; o.mouth = 0.3; }
    return { h: o, d: { x: 160, y: 0, s: DS, face: -1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 } };
  }
  // —— step 1: the crank radio on his knees ——
  if (t < T.c4) {
    const o = sitOn(base(t, { look: [0.7, 0.6], brow: 0.4, headTilt: 0.14 }), -200, BED_Y);
    const sh = shoulder(o), a = t > T.crank ? (t - T.crank) * 9 : 0;
    o.hands = { near: { p: [-30 + 24 * Math.cos(a), -250 + 24 * Math.sin(a)], shape: 'grip' } };
    const d = { x: 60, y: 0, s: DS, face: -1, sit: 1, look: 0.5, t, blink: dblink(t), ears: 1, tilt: 0.14 };
    void sh;
    return { h: o, d, radio: [-80, -230] };
  }
  // —— the evening: the radio on the bed, the news; then the end ——
  const o = sitOn(base(t, { look: [0.7, 0.4], brow: 0.3 }), -60, BED_Y);
  if (t > T.news + 0.2) { const k = clamp(sp(t, T.news + 0.2, 2.4, 7)); o.brow = 0.7; o.mouth = 0.4 * k; o.lid = 0.1; }
  if (t > T.c7) { o.look = [0.8, 0]; o.brow = 0.6; o.mouth = 0.35; const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
  const happy = t > T.news + 0.3;
  const d = { x: 160, y: 0, s: DS, face: -1, sit: 1, look: 0.4, t, blink: dblink(t), wag: happy ? 1 : 0, wagPh: t * 3.4, mouth: happy ? 0.6 : 0, tongue: happy ? 0.8 : 0, ears: 1 };
  return { h: o, d, radio: t < T.c7 ? [110, -150] : null };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, t > T.bars + 0.8 && t < T.c5 ? '#5a5f6e' : '#9fd8ff'); g.restore(); };
  return drawHunter(o);
}

// —— the props ——
function snow(t, x0, y0, w, h, n = 120, size = 5, a = 0.8) {
  for (let i = 0; i < n; i++) {
    const sp2 = 40 + 60 * hash(i * 1.7), y = y0 + ((hash(i * 3.1) * h + t * sp2) % h), x = x0 + ((hash(i * 5.3) * w + 18 * Math.sin(t * 0.9 + i)) % w + w) % w;
    ell(x, y, size * (0.4 + 0.6 * hash(i)), size * (0.4 + 0.6 * hash(i)), rgba('#f3f8ff', a * (0.4 + 0.6 * hash(i * 9.1))));
  }
}
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
// the crank radio (x, y = its bottom centre): the red case, the grille, the dial, the crank on its side, the aerial
function radio(t, [x, y], s = 1, crank = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  limb([[60, -120], [130, -300]], 5, '#9aa3b2', false);
  rrect(-110, -130, 220, 130, 16, '#c0533a'); rrect(-96, -116, 110, 100, 10, '#3a2a24');
  for (let i = 0; i < 6; i++) rect(-90, -108 + i * 15, 98, 6, '#5a3c32');
  rrect(26, -116, 70, 40, 6, '#f2e6c8'); rect(30 + 30 * (0.5 + 0.5 * Math.sin(t * 0.7)), -112, 3, 32, '#d9433b');
  ell(60, -46, 16, 16, '#2c3140');
  // the crank on the right side
  ell(110, -66, 10, 10, '#2c3140'); limb([[110, -66], [110 + 40 * Math.cos(crank), -66 + 40 * Math.sin(crank)]], 8, '#2c3140', false); ell(110 + 40 * Math.cos(crank), -66 + 40 * Math.sin(crank), 9, 9, '#ffd23f');
  if ((t % 0.8) < 0.5) for (let i = 1; i <= 3; i++) { g.lineWidth = 4; g.strokeStyle = rgba('#ffd23f', 0.7 - i * 0.18); g.beginPath(); g.arc(-40, -66, 60 + i * 26, -0.7, 0.7); g.stroke(); }
  g.restore();
}
// a dark figure on a camp bed: the neighbours of the hall (MONO hunters without hats)
function neighbour(t, x, face, extra = {}) {
  MONO.on = true; MONO.color = extra.color ?? '#5d6a86';
  const o = sitOn({ s: 0.56, face, lean: 0.03, look: [0.6 * face, 0], hat: false, jacket: true, boots: true, pack: false, blink: 0, ...extra }, x, BED_Y);
  if (extra.phone) { const sh = framesOf(o).T.p([-14, -192]); const shake = 8 * Math.sin(t * 30); o.hands = { near: { p: [sh[0] + 60 * face + shake, sh[1] + 30], shape: 'grip' } }; }
  const A2 = drawHunter(o);
  MONO.on = false;
  if (extra.phone) { const p = o.hands.near.p; g.save(); g.translate(p[0], p[1] - 30); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.lineWidth = 4; g.strokeStyle = '#2c3140'; g.beginPath(); g.arc(0, 0, 10, t * 6, t * 6 + 4.2); g.stroke(); g.restore(); }
  return A2;
}
function campBed(x) { rect(x - 115, -130, 230, 30, '#3f6b5a'); rect(x - 95, -100, 8, 100, '#2c3a33'); rect(x + 85, -100, 8, 100, '#2c3a33'); rect(x - 85, -150, 120, 26, '#c4473a'); }

// —— frame ——
let DK = null;
export function init() { DK = createCanvas(4, 4); Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'city') cityFrame(t, cam);
  else if (sc === 'schema') schemaFrame(t, cam);
  else if (sc === 'yard') yardFrame(t, cam);
  else hallFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'city' || sc === 'schema' ? 0.6 : 1);
}

// —— the warming centre (the gym of part 5): camp beds in a row, the neighbours on them ——
const NBS = [{ x: -1100, face: 1, say: 'свет дадут через месяц' }, { x: -820, face: 1, say: 'воды не будет до весны' }, { x: -540, face: -1, say: 'всех увезут из города!' }];
function hallFrame(t, cam) {
  const { h, d, radio: rad } = actorsAt(t);
  const evening = t >= T.c6;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2230'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-1400, -900, 2800, 900, evening ? '#d9be94' : '#f1dcb0');
  for (let i = 0; i < 5; i++) {
    const x0 = -1300 + i * 560, w = { x0, x1: x0 + 300, y0: -820, y1: -480 };
    rect(w.x0 - 16, w.y0 - 16, 332, 372, '#e9e2d2'); rect(w.x0, w.y0, 300, 340, evening ? '#2c3a5a' : '#9fb4c6'); frost(t, w, 0.9);
    rect(w.x0 + 143, w.y0, 14, 340, '#e9e2d2');
  }
  rect(-1400, -40, 2800, 40, '#c98d5a'); rect(-1400, 0, 2800, 200, '#b27546');
  for (const n of NBS) campBed(n.x);
  campBed(-60); campBed(300); campBed(660);
  NBS.forEach((n, i) => neighbour(t, n.x, n.face, { phone: evening && i === 2 }));
  if (evening) neighbour(t, 600, -1, { phone: false });
  if (rad) radio(t, rad, 0.6, 0);
  if (d) drawDog(d);
  if (h) {
    const A2 = hunterDraw(t, h);
    if (t >= T.c3 && t < T.c4) radio(t, [-80, -230], 0.7, t > T.crank ? (t - T.crank) * 9 : 0);
    void A2;
  }
  if (evening) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(255,170,90,0.08)'; g.fillRect(0, 0, W, H); }
}

// —— the city on the blueprint: the cell towers dark and crossed, the radio mast sending waves ——
const TOWERS = [-1100, -600, 600, 1100];
function cityFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  for (let i = 0; i < 14; i++) {                               // the blocks of the city
    const x = -1500 + i * 220, h = 300 + 500 * hash(i * 3.7);
    Sc.gline([[x, 0], [x, -h], [x + 170, -h], [x + 170, 0]], 3, P.faint, P);
  }
  Sc.gline([[-1600, 0], [1600, 0]], 4, P.line, P);
  for (const [i, x] of TOWERS.entries()) {                     // the cell towers: dead, a cross on each
    const y = -900 - 120 * (i % 2);
    Sc.gline([[x - 50, -300], [x, y], [x + 50, -300]], 4, P.line, P); Sc.gline([[x - 36, y + 120], [x + 36, y + 120]], 3, P.line, P);
    const k = clamp(sp(t, T.c2 + 0.2 + i * 0.12, 2.6, 8)); g.save(); g.translate(x, y - 40); g.scale(k, k); Hd.icon('x', 46, P.danger); g.restore();
  }
  // the radio mast in the middle: tall, its light blinking, its waves going out over the city
  Sc.gline([[-90, -100], [0, -1500], [90, -100]], 6, P.warm, P); for (let j = 1; j < 6; j++) Sc.gline([[-90 + j * 15, -100 - j * 250], [90 - j * 15, -100 - j * 250]], 3, P.warm, P);
  ell(0, -1510, 16, 16, (t % 1) < 0.5 ? '#ff4d4d' : '#7a2020');
  const k = seg(T.c2 + 0.1, T.waves + 0.4, t);
  if (k > 0.01) for (let i = 0; i < 5; i++) {
    const u = ((t * 0.5 + i / 5) % 1), r = 200 + 1300 * u;
    g.save(); g.globalAlpha = k * (1 - u) * 0.9; g.lineWidth = 8; g.strokeStyle = P.warm; g.beginPath(); g.arc(0, -1400, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.restore();
  }
}

// —— step 2: the family's messages all going to one person in another town, then out from him ——
const FAM = [['ТЫ', -380, -1050], ['МАМА', 380, -1050], ['СЕСТРА', -380, -520], ['БРАТ', 380, -520]];
const HUB = [0, -785];
function schemaFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  // the other town: a dashed ring round the hub
  g.save(); g.setLineDash([16, 14]); g.lineWidth = 4; g.strokeStyle = rgba(P.warm, 0.7); g.beginPath(); g.arc(HUB[0], HUB[1], 150, 0, TAU); g.stroke(); g.restore();
  Hd.label('ДРУГОЙ ГОРОД', HUB[0] + 330, HUB[1] + 12, 36, P.warm, { fam: FONTS.mono, shadow: false, stroke: false });
  const inK = seg(A.L4w4 - 0.1, A.L4w9, t), outK = seg(T.relay, T.relay + 1.2, t);
  FAM.forEach(([n, x, y], i) => {
    const show = clamp(sp(t, T.c4 + 0.1 + i * 0.12, 2.6, 8));
    ell(x, y, 54 * show, 54 * show, i === 0 ? P.warm : P.hi);
    Hd.label(n, x, y - 80, 40, i === 0 ? P.warm : P.text, { fam: FONTS.mono, shadow: false, stroke: false, a: show });
    // the message to the hub, then the news back out to the others
    const ki = clamp(inK * 1.3 - i * 0.1);
    if (ki > 0) Sc.gline([[x, y], [lerp(x, HUB[0], ki), lerp(y, HUB[1], ki)]], 6, P.line, P);
    if (ki > 0 && ki < 1) ell(lerp(x, HUB[0], ki), lerp(y, HUB[1], ki), 14, 14, '#ffffff');
    if (outK > 0 && i > 0) { const u = (outK * 1.4 - i * 0.12 + 1) % 1; ell(lerp(HUB[0], x, u), lerp(HUB[1], y, u), 14, 14, P.warm); }
  });
  ell(HUB[0], HUB[1], 70, 70, P.warm);
  g.save(); g.translate(HUB[0], HUB[1]); Hd.icon('phone', 40, '#17162f'); g.restore();
}

// —— step 3: the snowy yard: the car with its window open charging the phone; the shut garage with the engine running ——
function car(x, inside) {
  fill(smoothPath([[x - 220, -40], [x - 210, -130], [x - 120, -150], [x - 70, -230], [x + 90, -230], [x + 150, -150], [x + 220, -130], [x + 225, -40]]), inside ? '#5f6c8a' : '#3c7ad6');
  fill(polyPath([[x - 50, -150], [x - 10, -215], [x + 40, -215], [x + 40, -150]]), '#cfe3ea');
  fill(polyPath([[x + 52, -150], [x + 52, -215], [x + 84, -215], [x + 128, -150]]), inside ? '#cfe3ea' : '#1d2a48');
  for (const wx of [x - 130, x + 140]) { ell(wx, -40, 44, 44, '#1d1e26'); ell(wx, -40, 18, 18, '#9aa3b2'); }
  ell(x + 215, -100, 10, 8, '#ffe7a8');
}
function yardFrame(t, cam) {
  const { h, d } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fb4c6'); gr.addColorStop(1, '#dfe8ef'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-1600, -700, 900, 700, '#cdb48a'); for (let i = 0; i < 3; i++) rect(-1520 + i * 260, -560, 160, 140, '#ffd58a');      // the school behind
  rect(-1600, 0, 3400, 300, '#f4f8fb'); rect(-1600, -10, 3400, 14, '#dfe8ef');
  // the car with the phone on a cable through the open window
  car(-120, false);
  const ph = h?.prop?.p ?? [-300, -200];
  limb([[-70, -170], [-160, -110], [ph[0], ph[1] + 10]], 5, '#2c3140');
  // exhaust from the car outside: a thin plume blown away
  for (let i = 0; i < 4; i++) { const u = ((t * 0.7 + i / 4) % 1); ell(-350 - 120 * u, -40 - 40 * u, 14 + 26 * u, 10 + 18 * u, rgba('#ffffff', 0.4 * (1 - u))); }
  // the garage across the yard: shut, the car inside, the grey gas filling it
  const gx = 520;
  rect(gx - 300, -460, 600, 460, '#8a8f99'); rect(gx - 300, -480, 600, 30, '#5d6270');
  g.save(); g.beginPath(); g.rect(gx - 260, -420, 520, 420); g.clip();
  rect(gx - 260, -420, 520, 420, '#3a3f4a');
  car(gx, true);
  const gas = seg(T.garage, T.garage + 1.5, t);
  for (let i = 0; i < 12; i++) { const u = clamp(gas * 1.4 - i * 0.05), r = (50 + 70 * u) * (0.7 + 0.5 * hash(i * 3.3)); if (u > 0) ell(gx - 240 + 480 * hash(i * 7.1), -40 - 360 * u * hash(i * 1.9), r, r * 0.7, rgba('#9aa4b2', 0.45 * u)); }
  g.restore();
  for (let i = 0; i < 6; i++) rect(gx - 260, -420 + i * 70, 520, 4, 'rgba(0,0,0,0.0)');
  let A2 = null;
  if (d) drawDog(d);
  if (h) A2 = hunterDraw(t, h);
  if (A2?.mouth) breath(t, A2.mouth, 1);
  g.setTransform(1, 0, 0, 1, 0, 0); snow(t, 0, 0, W, H, 120, 6, 0.8);
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, 'ДЕНЬ 4 — 10:20');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ДЕНЬ 4 — 19:45');
  if (t >= T.cover && t < T.c1) phoneCard(t, 540, 640);
  // the rumours: three bubbles, each a little worse than the one before
  if (t >= T.c1 && t < T.c2) NBS.forEach((n, i) => {
    const t0 = T.c1 + 0.5 + i * ((T.rum - T.c1) / 3);
    const p = S2([n.x, BED_Y - 330]);
    bubble(t, t0, T.c2 - 0.05, p[0], p[1] - 110 * i, n.say, i === 2 ? DANGER : '#17162f');
  });
  if (t >= T.c1 && t < T.c2) Hd.plaque(t, T.rum + 0.4, T.c2 - 0.05, 540, 1560, { icon: 'x', title: 'СЛУХИ', sub: 'растут с каждым пересказом', color: DANGER });
  if (sc === 'city') Hd.plaque(t, T.waves, T.c3 - 0.05, 540, 330, { icon: 'check', title: 'РАДИО РАБОТАЕТ', sub: 'когда вышки сели', color: GOLD });
  // step 1
  Hd.stepHeader(t, 1, 'РАДИО', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    Hd.plaque(t, T.crank, T.c4 - 0.02, 540, 560, { icon: 'battery', title: 'БАТАРЕЙКИ ИЛИ РУЧКА', sub: 'заряд не нужен', color: GOLD });
    Hd.plaque(t, A.L3w8 - 0.08, T.c4 - 0.02, 540, 1560, { icon: 'check', title: 'ОФИЦИАЛЬНЫЕ НОВОСТИ', sub: 'а не слухи', color: OK });
  }
  // step 2
  Hd.stepHeader(t, 2, 'ОДИН ЧЕЛОВЕК', A.L4 + 0.02, A.L4e - 0.05);
  // step 3
  Hd.stepHeader(t, 3, 'ЗАРЯДКА В МАШИНЕ', A.L5 + 0.02, A.L5e - 0.05);
  if (sc === 'yard') {
    { const p = S2([-120, -330]); Hd.tick(p[0], p[1], sp(t, A.L5w7 - 0.05, 2.6, 8) * (1 - seg(T.garage - 0.2, T.garage, t)), 60); }
    if (t < T.garage) Hd.plaque(t, A.L5w7 - 0.05, T.garage - 0.05, 540, 560, { icon: 'phone', title: 'ТОЛЬКО НА УЛИЦЕ', sub: 'окно приоткрыто', color: OK });
    { const p = S2([520, -560]); Hd.redX(p[0], p[1], 80, sp(t, T.garage + 0.6, 2.6, 8)); }
    Hd.plaque(t, A.L5w14 - 0.08, T.c6 - 0.02, 540, 560, { icon: 'cloud', title: 'В ГАРАЖЕ — УГАРНЫЙ ГАЗ', sub: 'даже при открытой двери', color: DANGER });
  }
  // the evening: the radio's news, the neighbour still waiting
  if (t >= T.c6 && t < T.c7) {
    radioCard(t, 540, 640);
    if (t > T.nb) Hd.plaque(t, T.nb + 0.4, T.c7 - 0.02, 540, 1560, { icon: 'clock', title: 'СОСЕД ВСЁ ЖДЁТ', sub: 'лента не грузится', color: ICE });
  }
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'А У ТЕБЯ ЕСТЬ РАДИО?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// a speech bubble with a rumour in it
function bubble(t, t0, t1, x, y, str, color) {
  if (t < t0 || t > t1 + 0.2) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - clamp((t - t1) / 0.2));
  if (k <= 0.01) return;
  const size = 34, w = measure(str, size, FONTS.cond) + 50, h = 74;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(clamp(x, w / 2 + 20, W - w / 2 - 20), y); g.scale(k, k); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 5; rrect(-w / 2, -h / 2, w, h, 20, '#fff8e6'); poly([[-30, h / 2 - 2], [10, h / 2 - 2], [-20, h / 2 + 30]], '#fff8e6'); g.restore();
  text(str, 0, 12, size, color, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// the hook: the phone close-up, the bars going one by one, «Нет сети»
function phoneCard(t, cx, cy) {
  const k = clamp(sp(t, A.L0w4 - 0.1, 2.4, 8)) * (1 - seg(T.c1 - 0.25, T.c1 - 0.02, t));
  if (k <= 0.01) return;
  const w = 380, h = 560, bars = Math.max(0, 5 - Math.floor(seg(T.bars, T.bars + 0.9, t, u => u) * 5.01)), none = bars === 0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(-0.04); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, '#16233a'); rrect(-40, -h / 2 + 26, 80, 18, 9, '#0d0f16');
  for (let i = 0; i < 5; i++) rect(-60 + i * 26, 20 - 12 - i * 14, 18, 12 + i * 14, i < bars ? '#ffffff' : 'rgba(255,255,255,0.18)');
  Hd.label(none ? 'Нет сети' : 'Поиск сети…', 0, 110, 44, none ? '#ff8a8a' : '#c9d6ea', { shadow: false, stroke: false });
  if (none) { g.save(); g.translate(0, -130); Hd.icon('x', 46, DANGER); g.restore(); }
  g.restore();
}
// the evening: the radio's words typed out
function radioCard(t, cx, cy) {
  const k = clamp(sp(t, A.L6w2 - 0.15, 2.4, 8)) * (1 - seg(T.c7 - 0.25, T.c7 - 0.02, t));
  if (k <= 0.01) return;
  const msg = '…завтра в Северном районе подадут электричество…', n = Math.round(msg.length * seg(T.news - 0.3, A.L6w9 + 0.6, t, u => u));
  const w = 820, h = 200;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-w / 2, -h / 2, w, h, 22, 'rgba(11,15,26,0.92)'); g.restore();
  g.lineWidth = 3; g.strokeStyle = '#ffd23f'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 21));
  ell(-w / 2 + 50, -h / 2 + 44, 10, 10, (t % 1) < 0.6 ? '#e53935' : 'rgba(229,57,53,0.3)');
  Hd.label('РАДИО · 98,6 FM', -w / 2 + 72, -h / 2 + 56, 30, '#ffd23f', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  const shown = msg.slice(0, n), cut = shown.length > 28 ? shown.lastIndexOf(' ', 28) : -1;
  Hd.label(cut > 0 ? shown.slice(0, cut) : shown, -w / 2 + 40, 20, 40, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label(cut > 0 ? shown.slice(cut + 1) : '', -w / 2 + 40, 70, 40, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  g.restore();
}

// —— the poster: him on the camp bed with the crank radio, the dog's head tilted to it ——
function coverFrame(t) {
  const cam = { x: -60, y: -300, z: 1.6, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2230'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-1400, -900, 2800, 900, '#e6cfa2');
  { const w = { x0: -420, x1: -120, y0: -820, y1: -480 }; rect(w.x0 - 16, w.y0 - 16, 332, 372, '#e9e2d2'); rect(w.x0, w.y0, 300, 340, '#9fb4c6'); frost(0.5, w, 0.9); }
  rect(-1400, -40, 2800, 40, '#c98d5a'); rect(-1400, 0, 2800, 200, '#b27546');
  campBed(-200);
  const o = sitOn(base(t, { s: 0.9, look: [0.8, 0.4], brow: 0.8, pop: 0.4, mouth: 0.3, blink: 0 }), -260, -120);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 120, sh[1] + 60], shape: 'grip' } };
  drawDog({ x: 160, y: 40, s: 1.0, face: -1, sit: 1, look: 0.5, t: 0, ears: 1, tilt: 0.2 });
  drawHunter(o);
  radio(t, [sh[0] + 180, sh[1] + 140], 0.9, 1.2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('НЕТ', 0, 200, 150, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('СЕТИ', 0, 350, 140, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 6 · ПРОПАЛА СВЯЗЬ', pw = measure(pl, 50, FONTS.cond) + 60;
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
  add(0.3, 'city_day', -24, 0, { dur: T.c2 - 0.3 });
  add(A.L0w4 - 0.1, 'whoosh_in', -12, 0);
  for (let i = 0; i < 5; i++) add(T.bars + i * 0.18, 'click', -16, 0.1);
  add(T.bars + 0.9, 'stamp', -8, 0);
  add(T.c1, 'whoosh', -12, 0);
  NBS.forEach((_, i) => add(T.c1 + 0.5 + i * ((T.rum - T.c1) / 3), 'pop_word', -12, -0.3 + 0.3 * i));
  add(T.rum + 0.4, 'blip', -10, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.waves, 'ding', -10, 0);
  add(T.c3, 'amb_flat', -22, 0, { dur: T.c4 - T.c3 });
  add(T.crank, 'ticks_up', -18, 0.2, { dur: Math.min(1.2, A.L3w8 - T.crank - 0.1) });
  add(A.L3w8 - 0.08, 'blip', -10, 0);
  add(T.c4, 'whoosh', -12, 0);
  add(A.L4w4 - 0.1, 'whoosh_in', -14, 0.2);
  add(T.relay, 'ding', -12, 0);
  add(T.c5, 'city', -22, 0, { dur: T.c6 - T.c5 });
  add(A.L5w7 - 0.05, 'ding', -10, -0.2);
  add(T.garage + 0.6, 'stamp', -6, 0.3);
  add(A.L5w14 - 0.08, 'puff', -12, 0.3);
  add(T.c6, 'whoosh', -12, 0);
  add(T.news, 'blip', -8, 0);
  add(T.nb + 0.4, 'blip', -12, -0.3);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
