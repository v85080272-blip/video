// «Рыжий лес» («Зона», серия 2, в 2D): the whole short as pure functions of time t (seconds). Scene beats are anchored to
// the narrator's words (build/words.json from tools/voice.py; before the voice exists, a rough timing from voice/script.json).
// You fell behind the group: the bus is gone, and around you is the Red Forest. 1986: the pines turned ginger and died,
// were pushed into trenches and buried — the counter still clicks. Three rules to get out: only by the road (less dust on
// asphalt than in the forest); cover your nose and mouth (the wind lifts the dust); no mushrooms (they collect it most),
// and no water from the river. Then Пурга growls: there are seven times more wolves here than in the reserves. Don't
// run: be big, be loud, back away facing them. The wolves go; a fork in the road — to the Duga radar or to Pripyat?
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
export const DUR = VOICE?.dur ?? FB.L11[1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ГРУППЫ: DANGER, РЫЖИЙ: WARM, ГРЯЗНОЕ: DANGER, РЫЖИМИ: WARM, ПОГИБЛИ: DANGER, ЗАКОПАЛИ: WARM, ЩЁЛКАЕТ: DANGER, ДОРОГЕ: GOLD,
  АСФАЛЬТЕ: GOLD, РОТ: GOLD, ПЫЛЬ: DANGER, ГРИБОВ: DANGER, РЕКИ: DANGER, ЗАРЫЧАЛА: DANGER, ВОЛКИ: DANGER, СЕМЬ: DANGER, БЕГИ: DANGER, ВЫШЕ: GOLD,
  ЛИЦОМ: GOLD, РАЗВИЛКА: GOLD, ДУГА: GOLD, ПРИПЯТЬ: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the beats ——
const T = {
  cover: 0.3,
  bus: A.L0w2,                       // «от группы»: the bus far off, leaving
  c1: A.L1 - 0.06,                   // 1986: the pines go ginger
  dead: A.L1w10 - 0.05,
  c2: A.L2 - 0.06,                   // the bulldozer, the trenches, the sand
  click: A.L2w7 - 0.05,
  c3: A.L3 - 0.06,                   // out of the forest onto the asphalt
  asphalt: A.L3w6 - 0.05,
  c4: A.L4 - 0.06,                   // the wind; the scarf over the nose
  mask: A.L4w1 - 0.05,
  gust: A.L4w5 - 0.1,
  c5: A.L5 - 0.06,                   // mushrooms
  c6: A.L6 - 0.06,                   // the river
  c7: A.L7 - 0.06,                   // the growl, the wolves
  wolves: A.L7w4 - 0.05,
  c8: A.L8 - 0.06,                   // big, loud, backing away
  shout: A.L8w4 - 0.05,
  c9: A.L9 - 0.06,                   // they go; the fork
  c10: A.L10 - 0.06,
  c11: A.L11 - 0.06,
};
export const CUTS = [T.cover, T.c1, T.c3, T.c5, T.c7, T.c9];
export const SNAPS = [T.c2, T.c4, T.c6];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7, FLOORY = 1160;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'lost' : t < T.c3 ? 'past' : t < T.c5 ? 'road' : t < T.c6 ? 'mush' : t < T.c7 ? 'river' : t < T.c9 ? 'wolves' : 'fork');

// —— the world, side on: the forest x < 1300, the road from 1500, mushrooms at 2500, the river 3200–3700, the wolves'
//    wood from 4980, the fork at 6100 ——
const ROAD0 = 1500, RIVER = [3200, 3700], FORK = 6260;
const hunterX = t => {
  const sc = scene(t);
  if (sc === 'lost' || sc === 'past' || sc === 'cover') return 0;
  if (sc === 'road') return lerp(900, 1700, seg(T.c3, T.asphalt + 0.4, t));
  if (sc === 'mush') return lerp(2240, 2300, seg(T.c5, T.c6, t));
  if (sc === 'river') return 3080;
  if (sc === 'wolves') return lerp(4460, 4260, seg(T.shout, T.c9 - 0.2, t));
  return lerp(5700, 5880, seg(T.c9, T.c10, t));
};

// —— the camera ——
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
const KEYS = {
  lost: [[T.cover, 60, 0, 1.3], [T.bus - 0.2, 60, 0, 1.25], [T.bus + 0.5, 420, 0, 0.9], [T.c1, 320, 0, 0.92]],
  past: [[T.c1, 0, 0, 0.9], [T.c3, 100, 0, 0.94]],
  wolves: [[T.c7, 4520, 0, 1.15], [T.wolves + 0.2, 4720, 0, 0.88], [T.c8, 4680, 0, 0.9], [T.c9, 4560, 0, 0.92]],
  fork: [[T.c9, 5900, 0, 0.95], [T.c10, 6060, 0, 0.82], [DUR, 6090, 0, 0.8]],
};
export function camAt(t) {
  const sc = scene(t);
  let x, z;
  if (sc === 'road' && t >= T.c4) { x = hunterX(t) + 60; z = lerp(1.25, 1.3, seg(T.c4, T.c5, t)); }       // the scarf, close
  else if (sc === 'road') { x = hunterX(t) + 120; z = lerp(1.0, 0.92, seg(T.c3, T.c4, t)); }
  else if (sc === 'mush') { x = 2440; z = lerp(1.3, 1.36, seg(T.c5, T.c6, t)); }
  else if (sc === 'river') { x = 3250; z = 1.12; }
  else if (sc === 'cover') { x = 100; z = 1.0; }
  else [x, , z] = hermite(KEYS[sc], t);
  const y = -(FLOORY - 960) / z;
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.gust, 5], [T.wolves, 7], [T.shout, 9]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0,
  jacket: true, boots: true, pack: true, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function walking(o, x, ph) { const fa = x + 30 * Math.sin(ph), fb = x - 30 * Math.sin(ph); o.hip = [x, -LEG + 7 * Math.abs(Math.sin(ph))]; o.feet = { near: [fa, -14 * Math.max(0, Math.cos(ph))], far: [fb, -14 * Math.max(0, -Math.cos(ph))] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const WOLF = { coat: '#9a9a96', coatSh: '#7e7e7a', saddle: '#5d5f63', saddleSh: '#4a4c50', inner: '#7a6a66', eye: '#2a2a20' };

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'cover' || sc === 'past') return {};
  const x = hunterX(t);
  if (sc === 'lost') {
    const look = t < T.bus ? [Math.sin(t * 2.2), 0] : [0.9, -0.1];
    const o = stand(base(t, { face: 1, look, brow: 0.8, pop: t > T.bus && t < T.bus + 1.4 ? 0.6 * bump(seg(T.bus, T.bus + 1.4, t)) : 0 }), x);
    const d = { x: x - 170, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 0.5, mouth: 0.3, tongue: 0.2, look: 0.3, tilt: 0.2 * Math.sin(t * 1.3) };
    return { h: o, d };
  }
  if (sc === 'road') {
    const walk = t < T.asphalt + 0.4, ph = x / 62;
    const o = walk ? walking(base(t, { face: 1, look: [0.8, 0], brow: 0.4, lean: 0.08 }), x, ph) : stand(base(t, { face: 1, look: [0.6, 0], brow: 0.4 }), x);
    if (t >= T.c4) {
      o.scarf = t >= T.mask + 0.3 ? 'mask' : 'neck'; o.scarfWave = t > T.gust ? 1 : 0.3; o.brow = t > T.gust ? 0.9 : 0.5; o.look = [0.4, 0.1];
      if (t >= T.mask && t < T.mask + 0.6) { const sh = shoulder(o), u = seg(T.mask, T.mask + 0.4, t); o.hands = { near: { p: [sh[0] + 40, lerp(sh[1] + 120, sh[1] - 60, u)], shape: 'grip' } }; }
    }
    const d = { x: x - 180, y: 0, s: DS, face: 1, walk: walk ? 1 : 0, ph: x / 120, t, blink: t > T.gust ? 1 : dblink(t), ears: t > T.gust ? 1 : 0.3, mouth: 0.3, tongue: 0.2 };
    return { h: o, d };
  }
  if (sc === 'mush') {
    const o = stand(base(t, { face: 1, look: [0.6, 0.9], brow: 0.5, scarf: 'mask', headTilt: -0.15 }), x);
    const sh = shoulder(o), reach = seg(T.c5 + 0.2, T.c5 + 0.7, t) * (1 - seg(A.L5w3, A.L5w3 + 0.4, t));
    o.hands = { near: { p: [sh[0] + lerp(30, 110, reach), lerp(sh[1] + 120, sh[1] + 200, reach)], shape: reach > 0.3 ? 'point' : 'fist' } };
    const d = { x: x - 190, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 0.4, mouth: 0.2, look: -0.4 };
    return { h: o, d };
  }
  if (sc === 'river') {
    const o = stand(base(t, { face: 1, look: [0.7, 0.9], brow: 0.6, scarf: 'mask' }), x);
    const sh = shoulder(o), r = seg(T.c6 + 0.1, T.c6 + 0.6, t) * (1 - seg(A.L6w5, A.L6w5 + 0.5, t));
    o.hands = { near: { p: [sh[0] + lerp(30, 120, r), lerp(sh[1] + 120, sh[1] + 210, r)], shape: 'open' } };
    const d = { x: x - 200, y: 0, s: DS, face: 1, sit: 0, t, blink: dblink(t), ears: 0.6, mouth: 0.1, look: 0.2 };
    return { h: o, d };
  }
  if (sc === 'wolves') {
    const big = seg(T.c8 + 0.2, T.c8 + 0.6, t), shout = t > T.shout && t < T.c9 - 0.3;
    const o = stand(base(t, { face: 1, look: [0.9, 0.05], brow: 1, scarf: 'mask', pop: shout ? 0.5 + 0.3 * Math.sin(t * 20) : 0, lean: lerp(0.04, -0.06, big) }), x);
    if (big > 0) { const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 60, lerp(sh[1] + 100, sh[1] - 170, big)], shape: 'open' }, far: { p: [sh[0] - 30, lerp(sh[1] + 100, sh[1] - 150, big)], shape: 'open' } }; }
    const growl = t > T.c7 + 0.1;
    const d = { x: x + 210, y: 0, s: DS, face: 1, sit: 0, t, blink: 0, ears: 0, mouth: growl ? 0.55 + 0.1 * Math.sin(t * 30) : 0.2, tongue: 0, brow: 1, look: 0 };
    // the wolves: eyes in the dark at first, then two of them step out of the trees; they turn and go on «Волки ушли»
    const out = seg(T.wolves, T.wolves + 1.2, t), leave = seg(T.c9 - 0.6, T.c9, t);
    const ws = [[5250, 0.8], [5420, 0.74]].map(([wx, s], i) => ({ x: lerp(wx + 200, wx - 260 + i * 90, out) + 500 * leave, y: 0, s, face: leave > 0.4 ? 1 : -1, walk: out < 1 || leave > 0 ? 1 : 0,
      ph: t * 1.4 + i, t, blink: 0, ears: 0, mouth: 0.5, tongue: 0, brow: 1, pal: WOLF, noCollar: true, look: -0.1 }));
    return { h: o, d, wolves: ws, eyes: out < 0.3 };
  }
  const o = stand(base(t, { face: 1, look: [Math.sin((t - T.c9) * 1.2) * 0.8, -0.2], brow: 0.3, scarf: 'mask' }), x);
  const d = { x: x - 180, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 0.2, mouth: 0.4, tongue: 0.4, look: 0.3, wag: 1, wagPh: t * 3 };
  return { h: o, d };
}

// —— the sets ——
function sky(t, sc) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const dusk = sc === 'wolves' || sc === 'fork' ? 1 : 0, past = sc === 'past' ? 1 : 0;
  const gr = g.createLinearGradient(0, 0, 0, H);
  if (past) { gr.addColorStop(0, '#6b4a3a'); gr.addColorStop(0.6, '#c98a52'); gr.addColorStop(1, '#e6b070'); }
  else if (dusk) { gr.addColorStop(0, '#2b2a48'); gr.addColorStop(0.55, '#8a5a6a'); gr.addColorStop(1, '#e09a6a'); }
  else { gr.addColorStop(0, '#6f7f8c'); gr.addColorStop(0.55, '#b9a58a'); gr.addColorStop(1, '#d9b98c'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// the far layer: the arch on the horizon, the Duga radar (a long lattice of masts) and Pripyat's towers further on
function far(t, cam, sc) {
  view(cam, 0.15);
  const c = sc === 'wolves' || sc === 'fork' ? '#3d3a52' : '#7a8088';
  rect(-6000, 520, 16000, 1400, c);
  fill(smoothPath([[-1300, 520], [-1260, 380], [-1000, 330], [-740, 380], [-700, 520]]), c);
  for (let i = 0; i < 18; i++) { const mx = 300 + i * 34; limb([[mx, 520], [mx, 200 - 30 * Math.sin(i / 17 * Math.PI)]], 4, c, false); }
  for (let j = 0; j < 6; j++) limb([[300, 240 + j * 45], [878, 240 + j * 45]], 2, c, false);
  for (let i = 0; i < 6; i++) rect(1400 + i * 90, 300 - 40 * hash(i), 60, 230 + 40 * hash(i), c);
  g.setTransform(1, 0, 0, 1, 0, 0); const hz = g.createLinearGradient(0, 700, 0, 1250); hz.addColorStop(0, 'rgba(240,210,170,0)'); hz.addColorStop(1, 'rgba(240,210,170,0.25)'); g.fillStyle = hz; g.fillRect(0, 700, W, 550);
}
function mixHex(a, b, u) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A_ = p(a), B_ = p(b);
  return '#' + A_.map((v, i) => Math.round(lerp(v, B_[i], u)).toString(16).padStart(2, '0')).join('');
}
// a pine: a trunk and three tiers of needles; u goes green → ginger (1986), above 0.85 the needles are gone
function pine(x, h, u, k = 1, lean = 0) {
  g.save(); g.translate(x, 0); g.rotate(lean);
  rect(-10 * k, -h, 20 * k, h, '#6a4a32');
  const green = ['#2f5a3a', '#3c6b45', '#4a7a50'], ginger = ['#b5562a', '#c96a32', '#d9823c'];
  if (u < 0.85) for (let i = 0; i < 3; i++) {
    const w = (150 - 34 * i) * k, y = -h * (0.42 + 0.2 * i);
    poly([[-w, y + 40 * k], [0, y - 170 * k], [w, y + 40 * k]], mixHex(green[i], ginger[i], clamp(u / 0.7)));
  }
  g.restore();
}
function forest(t, cam, x0, x1, o = {}) {
  view(cam, 0.6);
  for (let i = 0; i < 40; i++) { const px = x0 + i * 120 + 60 * hash(i * 3); if (px > x1) break; pine(px, 900 + 300 * hash(i), o.u ?? 0.3, 0.8, 0.02 * (hash(i) - 0.5)); }
  view(cam, 1);
  for (let i = 0; i < 22; i++) { const px = x0 + i * 230 + 90 * hash(i * 7); if (px > x1) break; pine(px, 1100 + 300 * hash(i + 4), o.u ?? 0.4, 1, 0.02 * (hash(i + 2) - 0.5)); }
}
function ground(t, cam) {
  view(cam, 1);
  const half = W / 2 / cam.z + 400, x0 = cam.x - half, x1 = cam.x + half;
  rect(x0, 0, x1 - x0, 900, '#6b4a34');
  for (let i = 0; i < 60; i++) { const px = x0 + (i / 60) * (x1 - x0); ell(px, 20 + 30 * hash(i), 40, 8, '#8a5a3a'); }
  if (x1 > ROAD0) { const a = Math.max(x0, ROAD0); rect(a, 0, x1 - a, 900, '#4a4b50'); rect(a, 0, x1 - a, 12, '#8a8c92');
    for (let x = Math.max(ROAD0, Math.floor(x0 / 260) * 260); x < x1; x += 260) rect(x, 60, 130, 10, '#d8d4c4'); }
  if (x1 > RIVER[0] && x0 < RIVER[1]) {
    rect(RIVER[0], -4, RIVER[1] - RIVER[0], 900, '#3b5d6e');
    for (let i = 0; i < 6; i++) { const yy = 40 + i * 50, sh = 30 * Math.sin(t * 1.2 + i); limb([[RIVER[0] + 60 + sh, yy], [RIVER[0] + 260 + sh, yy]], 5, 'rgba(200,230,240,0.35)', false); }
    for (let i = 0; i < 8; i++) { const rx = RIVER[0] - 40 + 12 * i; limb([[rx, 0], [rx + 6, -60 - 30 * hash(i)]], 5, '#6a7a3a', false); }      // reeds at the bank
  }
}
function trefoil(x, y, r, c) {
  ell(x, y, r * 0.2, r * 0.2, c);
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, a - Math.PI / 6, a + Math.PI / 6); g.closePath(); g.fillStyle = c; g.fill(); }
}
function radSign(x, k = 1) {
  rect(x - 6, -320 * k, 12, 320 * k, '#5a5f66');
  poly([[x - 90 * k, -300 * k], [x + 90 * k, -300 * k], [x, -460 * k]], '#f2c94c');
  trefoil(x, -350 * k, 40 * k, '#2c2c34');
}
// 1986: the pines go ginger, then the bulldozer pushes them over into a trench; then the sand and young pines
function pastSet(t, cam) {
  view(cam, 1);
  const u = seg(T.c1 + 0.2, T.dead + 0.3, t), fall = seg(T.c2 + 0.1, T.click - 0.2, t), sand = seg(T.click - 0.3, T.c3 - 0.2, t);
  rect(-3000, 0, 6000, 900, '#7a5236');
  for (let i = 0; i < 9; i++) { const px = -900 + i * 240; if (sand < 0.5) pine(px, 640 + 140 * hash(i), u, 1, 1.3 * clamp((fall * 9 - (8 - i)) / 1.5)); }
  if (fall > 0 && sand < 0.6) {
    const bx = lerp(1300, -300, fall);
    rrect(bx - 180, -260, 360, 200, 20, '#d9a520'); rect(bx - 40, -380, 160, 130, '#d9a520'); rect(bx - 20, -360, 110, 90, '#3a4a5a');
    rect(bx - 260, -200, 40, 200, '#5a5f66'); rrect(bx - 200, -70, 400, 80, 40, '#2a2d38');
  }
  if (sand > 0) {
    g.save(); g.globalAlpha = sand; fill(smoothPath([[-1300, 0], [-1100, -120], [0, -160], [1100, -120], [1300, 0]]), '#d9c08a');
    for (let i = 0; i < 7; i++) pine(-700 + i * 230, 260 + 40 * hash(i), 0, 0.35, 0);
    g.restore();
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(120,70,30,0.18)'; g.fillRect(0, 0, W, H);
}
function busFar(t, cam) {
  view(cam, 0.6);
  const bx = 380 + 600 * seg(T.bus - 0.5, T.c1, t, x => x);
  const by = -260;                               // its wheels on the far road, above the near ground's edge
  rrect(bx - 120, by - 90, 240, 90, 14, '#d9a520'); rect(bx - 100, by - 78, 200, 36, '#2a3a4a'); ell(bx - 70, by, 20, 20, '#1a1a1e'); ell(bx + 70, by, 20, 20, '#1a1a1e');
  for (let j = 0; j < 4; j++) { const v = ((t * 0.8 + j / 4) % 1); ell(bx + 140 + 120 * v, by - 20 - 20 * v, 30 + 40 * v, 20 + 20 * v, `rgba(160,140,120,${0.4 * (1 - v)})`); }
}
function mushrooms() {
  for (const [mx, k] of [[2470, 1], [2560, 0.8], [2640, 1.15], [2520, 0.7]]) {
    rect(mx - 10 * k, -60 * k, 20 * k, 60 * k, '#efe6d2');
    fill(smoothPath([[mx - 50 * k, -50 * k], [mx - 40 * k, -95 * k], [mx, -110 * k], [mx + 40 * k, -95 * k], [mx + 50 * k, -50 * k]]), '#9a4a2a');
    ell(mx - 16 * k, -86 * k, 8 * k, 6 * k, '#c9784a');
  }
}
function wolfWood(t, cam, a) {
  view(cam, 1);
  for (let i = 0; i < 9; i++) pine(4980 + i * 170 + 40 * hash(i), 1100 + 200 * hash(i + 2), 0.15, 1, 0);
  if (a.eyes) for (const [ex, ey] of [[5250, -330], [5330, -300], [5460, -320], [5530, -300]]) if ((t * 2 + ex / 100) % 1.7 > 0.15) ell(ex, ey, 11, 7, '#f2d14a');
}
function forkSet() {
  rect(FORK - 8, -330, 16, 330, '#5a4a3a');
  for (const [y, s, dir] of [[-300, 'ДУГА', -1], [-210, 'ПРИПЯТЬ', 1]]) {
    const w = 300; g.save(); g.translate(FORK, y);
    poly(dir < 0 ? [[-w, 0], [-w + 50, -40], [10, -40], [10, 40], [-w + 50, 40]] : [[w, 0], [w - 50, -40], [-10, -40], [-10, 40], [w - 50, 40]], '#e8e2cf');
    Hd.label(s, dir * (w / 2 - 10), 16, 40, '#2c2c34', { fam: FONTS.cond, shadow: false, stroke: false });
    g.restore();
  }
  radSign(FORK + 400, 0.9);
}

// —— frame ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t), a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  sky(t, sc);
  if (sc === 'past') pastSet(t, cam);
  else {
    far(t, cam, sc);
    forest(t, cam, -2400, ROAD0 - 200);
    if (sc === 'lost') busFar(t, cam);           // far off, between the trunks, going away
    if (sc === 'wolves') wolfWood(t, cam, a);
    ground(t, cam);
    view(cam, 1);
    if (sc === 'mush') mushrooms();
    if (sc === 'road' || sc === 'mush') radSign(2000, 0.85);
    if (sc === 'fork') forkSet();
  }
  view(cam, 1);
  if (a.wolves) for (const w of a.wolves) drawDog(w);
  if (a.d) drawDog(a.d);
  if (a.h) drawHunter(a.h);
  if (sc === 'road' && t > T.gust) dustGust(t);
  const dark = sc === 'wolves' || sc === 'fork' ? 0.42 : sc === 'past' ? 0 : 0.12;
  if (dark > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
    dk.fillStyle = `rgba(14,16,40,${dark})`; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
    if (a.h) { const [x, y] = toScreen(cam, [a.h.hip[0], a.h.hip[1] - 120]), rr = 700 * scaleOf(cam); const gr = dk.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, rr, 0, TAU); dk.fill(); }
    g.drawImage(DK, 0, 0);
  }
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.7);
}
// the gust: a sheet of dust from the right, motes streaming past him
function dustGust(t) {
  const u = clamp((t - T.gust) / 1.6);
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 90; i++) {
    const y = 300 + 1200 * hash(i * 1.3), v = 900 + 700 * hash(i * 2.1), x = W + 200 - ((t - T.gust) * v + 400 * hash(i)) % (W + 400);
    ell(x, y + 30 * Math.sin(t * 3 + i), 4 + 5 * hash(i), 3, `rgba(210,180,140,${0.55 * (1 - 0.5 * u)})`);
  }
  g.fillStyle = `rgba(200,170,130,${0.18 * Math.sin(Math.PI * Math.min(1, u * 1.5))})`; g.fillRect(0, 0, W, H);
}

// —— the dosimeter in the corner (µSv/h): it goes red in the forest and over the mushrooms ——
const READ = { lost: [4.2, 6.5], road: [3.0, 0.9], mush: [0.9, 7.8], river: [1.2, 1.4], wolves: [0.8, 0.9], fork: [0.6, 0.5] };
function dosimeter(t) {
  const sc = scene(t);
  if (sc === 'past' || sc === 'cover') return;
  const sh = { lost: [T.cover, T.c1], road: [T.c3, T.c5], mush: [T.c5, T.c6], river: [T.c6, T.c7], wolves: [T.c7, T.c9], fork: [T.c9, DUR] }[sc];
  const [v0, v1] = READ[sc], u = clamp((t - sh[0]) / Math.max(0.1, sh[1] - sh[0]));
  let v = sc === 'mush' ? lerp(v0, v1, ease.in(clamp((u - 0.15) / 0.5))) : sc === 'road' ? lerp(v0, v1, seg(T.asphalt - 0.3, T.asphalt + 0.4, t)) : lerp(v0, v1, u);
  v *= 1 + 0.04 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
  const high = v > 2, blink = high && (t * 3) % 1 < 0.5, a = clamp((t - T.cover) / 0.4) * (1 - seg(T.c11 + 0.2, T.c11 + 0.6, t));
  if (a <= 0.01) return;
  const x = 1080 - 60 - 250, y = 118, w = 250, h = 112;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 18; g.shadowOffsetY = 6; fill(rrPath(x, y, w, h, 18), '#f2b705'); g.restore();
  fill(rrPath(x + 12, y + 12, w - 24, h - 40, 10), high ? (blink ? '#ff5a4a' : '#d9473a') : '#9fd39b');
  text(v.toFixed(2).replace('.', ','), x + w - 26, y + 62, 52, '#14231a', { fam: FONTS.mono, align: 'right', shadow: false });
  text('мкЗв/ч', x + 22, y + h - 10, 24, INK, { fam: FONTS.mono, align: 'left', shadow: false });
  ell(x + w - 30, y + h - 18, 8, 8, high ? '#e53935' : '#2f7d32');
  g.restore();
}
function yearStamp(t) {
  if (scene(t) !== 'past') return;
  const k = clamp(sp(t, T.c1 + 0.1, 2.4, 8));
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.rotate(-0.05); g.scale(k, k);
  rrect(-180, -70, 360, 140, 16, 'rgba(40,20,10,0.75)'); g.lineWidth = 6; g.strokeStyle = WARM; g.stroke(rrPath(-180, -70, 360, 140, 16));
  text('1986', 0, 36, 100, WARM, { fam: FONTS.block, shadow: false }); g.restore();
}
function overlays(t, cam, a) {
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c1 - 0.1, 'РЫЖИЙ ЛЕС · 17:20', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c3 + 0.15, T.c7 - 0.1, 'ДОРОГА · 17:45', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c7 + 0.15, DUR, 'СУМЕРКИ · 18:30', { color: WARM, dot: DANGER });
  dosimeter(t); yearStamp(t);
  if (sc === 'lost') Hd.plaque(t, T.bus + 0.4, T.c1 - 0.05, 540, 420, { icon: 'x', title: 'АВТОБУС УЕХАЛ', sub: 'ты один с Пургой', color: DANGER });
  if (sc === 'past' && t > T.click) Hd.plaque(t, T.click, T.c3 - 0.05, 540, 600, { icon: 'x', title: 'ПОД ПЕСКОМ', sub: 'сосны 1986 года', color: WARM });
  Hd.stepHeader(t, 1, 'ТОЛЬКО ПО ДОРОГЕ', A.L3 + 0.02, A.L3e - 0.05);
  if (sc === 'road' && t < T.c4) Hd.plaque(t, T.asphalt + 0.2, T.c4 - 0.05, 540, 470, { icon: 'check', title: 'НА АСФАЛЬТЕ', sub: 'пыли меньше, чем в лесу', color: OK, size: 42 });
  Hd.stepHeader(t, 2, 'ЗАКРОЙ НОС И РОТ', A.L4 + 0.02, A.L4e - 0.05);
  if (sc === 'road' && t >= T.c4) Hd.plaque(t, T.gust + 0.2, T.c5 - 0.05, 540, 470, { icon: 'x', title: 'ВЕТЕР ПОДНЯЛ ПЫЛЬ', sub: 'шарф, маска, ворот', color: DANGER, size: 40 });
  Hd.stepHeader(t, 3, 'НИКАКИХ ГРИБОВ', A.L5 + 0.02, A.L5e - 0.05);
  if (sc === 'mush') Hd.plaque(t, A.L5w3 - 0.05, T.c6 - 0.05, 540, 470, { icon: 'x', title: 'ГРИБЫ КОПЯТ ЦЕЗИЙ', sub: 'больше всего в лесу', color: DANGER, size: 40 });
  if (sc === 'river') Hd.plaque(t, A.L6w2 - 0.05, T.c7 - 0.05, 540, 420, { icon: 'drop', title: 'НЕ ПЕЙ ИЗ РЕКИ', sub: 'даже если очень хочется', color: DANGER, size: 42 });
  if (sc === 'wolves') {
    if (t < T.c8) Hd.plaque(t, A.L7w9 - 0.05, T.c8 - 0.05, 540, 400, { icon: 'x', title: 'ВОЛКОВ ×7', sub: 'чем в заповедниках', color: DANGER, size: 52 });
    else [['НЕ БЕГИ', A.L8], ['СТАНЬ ВЫШЕ И КРИЧИ', A.L8w2], ['ОТХОДИ ЛИЦОМ К НИМ', A.L8w6]].forEach(([s, t0], i) =>
      Hd.plaque(t, t0, T.c9 - 0.05, 540, 330 + i * 120, { icon: i ? 'check' : 'x', title: s, color: i ? OK : DANGER, size: 40 }));
  }
  if (t >= T.c10) {
    [['1', 'РАДАР «ДУГА»', A.L10w1], ['2', 'ПРИПЯТЬ', A.L10w4]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c11, T.c11 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c11) Hd.plaque(t, A.L11w1 - 0.1, DUR + 1, 540, 730, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 3 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L11w12 - 0.1, 0, 300);
}

// —— the poster: him and Пурга at the edge of the ginger forest at dusk, the title ——
function coverFrame(t) {
  const cam = { x: 100, y: -(FLOORY - 960), z: 1.0, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  sky(0, 'wolves'); far(0, cam, 'wolves'); forest(0, cam, -2400, 1300, { u: 0.6 }); ground(0, cam); view(cam, 1);
  drawDog({ x: -80, y: 0, s: DS, face: 1, sit: 1, t: 0, ears: 0.6, mouth: 0.3, tongue: 0.2 });
  drawHunter(stand(base(0, { face: 1, look: [0.9, -0.1], brow: 0.8, blink: 0, scarf: 'mask' }), 120));
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(10,14,28,0.22)'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.save(); g.translate(540, 560);
  g.save(); g.shadowColor = 'rgba(255,140,60,0.9)'; g.shadowBlur = 40; Hd.label('РЫЖИЙ ЛЕС', 0, 0, 140, '#ff9a4a', { shadow: false, strokeW: 12 }); g.restore();
  const pl = 'ЗОНА · СЕРИЯ 2', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw / 2 + 8, 50 + 8, pw, 84, INK); rect(-pw / 2, 50, pw, 84, '#ffd43b'); text(pl, 0, 108, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  if (scene(t0) !== scene(t1)) return 0;
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S]].map(p => toScreen(cam, p)));
    if (d) out.push(toScreen(cam, [d.x, d.y - 150 * DS]));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
    return out;
  };
  const a = pts(t0), b = pts(t1), on = ([x, y]) => x > -200 && x < W + 200 && y > -200 && y < H + 200;
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (on(a[i]) || on(b[i])) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return Math.min(m * (0.5 / (2 * h * 60)), 40);
}

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(T.cover, 'roof_wind', -18, 0, { dur: DUR - T.cover });
  add(T.cover, 'ticks_up', -18, 0.4, { dur: T.c1 - T.cover });
  add(T.bus, 'whoosh', -14, 0.6); add(T.bus + 0.3, 'breath', -14, 0, { dur: T.c1 - T.bus });
  add(T.c1, 'whoosh_down', -10, 0); add(T.dead, 'wood_clack', -12, -0.2);
  add(T.c2 + 0.1, 'pump', -14, 0.3, { dur: T.click - T.c2 }); add(T.click - 0.2, 'thud', -8, 0);
  add(T.click, 'ticks_up', -10, 0.4, { dur: T.c3 - T.click });
  add(T.c3, 'steps_out', -10, 0, { dur: T.asphalt + 0.4 - T.c3 });
  add(T.mask, 'cloth', -8, -0.1); add(T.gust, 'wind_gust', -6, 0.5, { dur: 2.2 });
  add(T.c5 + 0.3, 'ticks_up', -10, 0.4, { dur: T.c6 - T.c5 - 0.3 });
  add(T.c6, 'tap_run', -16, 0.3, { dur: T.c7 - T.c6 });
  add(T.c7 + 0.1, 'dog_growl', -6, 0.2, { dur: 1.4 }); add(T.wolves, 'heartbeat', -12, 0, { dur: T.c9 - T.wolves, bpm: 120 });
  add(T.wolves + 0.4, 'dog_growl', -10, 0.6, { dur: 1.0 });
  add(T.shout, 'bark', -8, 0.2); add(T.shout + 0.5, 'bark', -10, 0.2);
  add(T.c9 - 0.4, 'whoosh', -14, 0.6);
  for (let i = 0; i < 2; i++) add((i ? A.L10w4 : A.L10w1) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L11w1 - 0.1, 'blip', -8, 0);
  add(A.L11w13, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
