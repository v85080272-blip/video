// «Уезжаешь в отпуск» («Квартира под защитой», ч.1): the whole short as pure functions of time t (seconds), so any frame
// or motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The same hunter, dog and flat on the 20th floor as the blackout season; new here: the landing outside the flat
// (landing.js: our steel door, the neighbour's door, the lift, the neighbour herself), the phone post that tells
// everyone you're away, the tower at night with one dark window, the key under the mat, the lamp on a timer.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Ap from './apt.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import * as Ld from './landing.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.84, 13], L1: [5.25, 11.56, 16], L2: [11.96, 16.74, 11], L3: [17.19, 22.07, 15], L4: [22.47, 28.4, 17], L5: [28.8, 32.89, 12], L6: [33.34, 40.03, 21], L7: [40.48, 44.99, 12] };
export const DUR = VOICE?.dur ?? 45.34;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ОТПУСК: GOLD, ПУСТОЙ: DANGER, УЛЕТАЕМ: DANGER, НАДО: DANGER, НИКОГО: DANGER, ПУСТЫМИ: DANGER, ЖИЛОЙ: GOLD,
  ЗАМКИ: GOLD, ОКОН: GOLD, ОТКРЫТОЕ: DANGER, СОСЕДКУ: GOLD, ПОЧТУ: GOLD, КЛЮЧ: GOLD, КОВРИКОМ: DANGER, ТАЙМЕР: GOLD,
  МЕСТЕ: OK, КОТЛЕТАМИ: WARM, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster
  c1: A.L1 - 0.06,                   // «выложить фото чемоданов»: the phone post
  no: A.L1w7 - 0.05,                 // «Не надо»
  all: A.L1w10 - 0.06,               // «так все узнают»: the eyes on the post
  c2: A.L2 - 0.06,                   // the tower at night: one dark window
  live: A.L2w6 - 0.06,               // «Значит, твоя должна выглядеть жилой»: our window lights up
  c3: A.L3 - 0.06,                   // step 1: the locks, the windows
  c4: A.L4 - 0.06,                   // step 2: the neighbour, the post, the key
  mat: A.L4w13 - 0.06,               // «а не под ковриком»
  c5: A.L5 - 0.06,                   // step 3: the lamp on a timer in the empty flat
  lamp: A.L5w6 - 0.06,               // «свет включится сам»
  c6: A.L6 - 0.06,                   // two weeks later: back home
  dog: A.L6w9 - 0.06,                // «А Пурга…»: the neighbour's door, the cutlets
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
const TURNS = [A.L3w1 - 0.05, A.L3w4 - 0.05];               // the two locks turned
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c5, T.c6, T.c7];
export const SNAPS = [T.lamp];
export const MARKS = { ...T, A, TURNS };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'landing' : t < T.c2 ? 'phone' : t < T.c3 ? 'tower' : t < T.c5 ? 'landing' : t < T.c6 ? 'flat' : 'landing');

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
shot(T.cover, [[T.cover, 60, -300, 1.15], [T.c1, 80, -310, 1.22]]);
shot(T.c2, [[T.c2, 200, FY(12), 0.55], [T.live, 250, FY(17), 0.7], [T.c3, 260, FY(19), 0.78]]);
shot(T.c3, [[T.c3, 60, -300, 1.6], [TURNS[1] + 0.3, 70, -300, 1.7], [T.c4 - 0.01, 70, -300, 1.72]]);
shot(T.c4, [[T.c4, 260, -280, 1.05], [T.mat - 0.2, 220, -260, 1.1], [T.mat + 0.4, 60, -120, 1.7], [T.c5, 60, -120, 1.75]]);
shot(T.c5, [[T.c5, 200, -330, 1.25], [T.lamp, 220, -340, 1.3], [T.c6, 230, -340, 1.32]]);
shot(T.c6, [[T.c6, 40, -290, 1.1], [T.dog - 0.2, 60, -290, 1.12], [T.dog + 0.5, 420, -270, 1.15], [T.c7, 430, -270, 1.18]]);
shot(T.c7, [[T.c7, 220, -290, 1.05], [DUR, 230, -295, 1.1]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.no, 8], [T.mat + 0.4, 5]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter, the dog, the neighbour ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// travelling: the jacket and the hat, no backpack (the suitcase instead)
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: false, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'landing') return { h: null, d: null };
  // —— the hook: locking up with the suitcase beside him ——
  if (t < T.c1) {
    const o = stand(base(t, { look: [0.6, 0.1], brow: 0.2 }), -260);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 70, sh[1] + 120], shape: 'grip' } };
    return { h: o, d: { x: -470, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), wag: 0.6, wagPh: t * 3 }, case: [-150, 0] };
  }
  // —— step 1: the key in each lock, turned; then a tick ——
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.6, -0.2], brow: 0.3, lean: 0.1 }), -60);
    const k = Math.max(0, ...TURNS.map((t0, i) => (t > t0 - 0.4 && t < t0 + 0.5 ? 1 : 0)));
    const lock = t < TURNS[1] - 0.4 ? Ld.LOCKS[0] : Ld.LOCKS[1];
    const sh = shoulder(o);
    o.hands = { near: { p: k ? [lock[0] - 10, lock[1] + 6] : [sh[0] + 50, sh[1] + 100], shape: 'grip' } };
    return { h: o, d: { x: -330, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t) }, case: [-200, 0], keyAt: k ? lock : null };
  }
  // —— step 2: the neighbour at her door; he gives her the spare key; then the mat ——
  if (t < T.c5) {
    const o = stand(base(t, { look: [0.7, 0], brow: 0.3 }), 220);
    const sh = shoulder(o), give = seg(A.L4w10 - 0.2, A.L4w11 + 0.2, t);
    o.hands = { near: { p: [lerp(sh[0] + 40, 360, give), lerp(sh[1] + 100, -260, give)], shape: 'grip' } };
    if (t > T.mat - 0.3) { o.face = -1; o.look = [-0.6, 0.6]; o.brow = 0.6; o.hands = { near: { p: [sh[0] - 60, sh[1] + 120], shape: 'point', ang: 0.8 } }; }
    const gr = { x: 520, face: -1, reach: [lerp(70, 180, give), -230], smile: 0.7, look: -0.5, t };
    return { h: o, d: { x: -60, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t), wag: 0.6, wagPh: t * 3 }, granny: gr, nOpen: true, case: [80, 0], keyFly: give > 0.02 && give < 0.98 ? [lerp(sh[0] + 40, 360, give), lerp(sh[1] + 100, -260, give)] : null };
  }
  // —— two weeks later: back with the suitcase, tanned; the dog comes out of the neighbour's with a cutlet ——
  const o = stand(base(t, { look: [0.6, 0], brow: 0.4, mouth: 0.3, jacket: false, hat: false }), -200);
  if (t > T.dog) { o.look = [0.8, 0.2]; o.brow = 0.8; o.mouth = 0.5; o.pop = 0.3 * (1 - seg(T.dog + 0.6, T.dog + 1.2, t)); }
  if (t > T.c7) { const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; o.pop = 0; }
  const out = seg(T.dog, T.dog + 1.0, t);
  const d = { x: lerp(560, 300, out), y: 0, s: DS, face: -1, sit: out >= 1 ? 1 : 0, walk: out > 0 && out < 1 ? 1 : 0, ph: t * 1.6, look: 0.2, t, blink: dblink(t), wag: 1, wagPh: t * 3.4, mouth: 0.4 };
  const gr = t > T.dog + 0.3 ? { x: 600, face: -1, reach: [140, -260], smile: 0.9, look: -0.6, t, wave: t > T.c7 } : null;
  return { h: o, d: t > T.dog ? d : null, granny: gr, nOpen: t > T.dog, case: [-60, 0], cutlet: t > T.dog };
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'phone') phoneFrame(t, cam);
  else if (sc === 'tower') towerFrame(t, cam);
  else if (sc === 'flat') flatFrame(t, cam);
  else landingFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'tower' ? 0.6 : 1);
}

function landingFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(t, { nOpen: a.nOpen });
  const flyers = t >= T.c6 ? 0 : 0;
  Ld.drawDoor(t, { flyers });
  Ld.drawMat(t, { lift: t >= T.mat - 0.1 && t < T.c5 ? seg(T.mat - 0.1, T.mat + 0.3, t) : 0, key: t >= T.c4 && t < T.c5 });
  if (a.keyAt) Ld.key(a.keyAt[0] - 4, a.keyAt[1] + 2, 0.7, t > TURNS[0] && (t < TURNS[0] + 0.5 || t > TURNS[1]) ? Math.PI / 2 * seg(0, 0.3, (t - (t < TURNS[1] - 0.4 ? TURNS[0] : TURNS[1])), u => u) : 0);
  if (a.case) Ld.suitcase(a.case[0], a.case[1], 0.75);
  if (a.granny) Ld.drawGranny(a.granny);
  if (a.d) drawDog(a.d);
  if (a.cutlet && a.d) { const p = [a.d.x - 80, -110]; ell(p[0], p[1], 24, 14, '#a8643a'); ell(p[0] - 4, p[1] - 4, 18, 9, '#c98a4a'); }
  if (a.h) drawHunter(a.h);
  if (a.keyFly) Ld.key(a.keyFly[0], a.keyFly[1], 0.7, t * 6);
}

// —— the phone post: suitcases, «Улетаем! ✈», the likes; then eyes all round it ——
function phoneFrame(t, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a1f33'); gr.addColorStop(1, '#2a2240'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const cx = 540, cy = 760, w = 520, h = 900;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(cx - w / 2, cy - h / 2, w, h, 56, '#1b1e29'); g.restore();
  rrect(cx - w / 2 + 18, cy - h / 2 + 18, w - 36, h - 36, 40, '#f6f6f8');
  ell(cx - 190, cy - 360, 26, 26, '#c4473a'); Hd.label('твой_профиль', cx - 150, cy - 350, 28, '#17162f', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  rect(cx - w / 2 + 18, cy - 310, w - 36, 420, '#9fd8ff');                              // the photo: two suitcases by the door
  rect(cx - w / 2 + 18, cy - 10, w - 36, 120, '#b8a68c');
  g.save(); g.translate(cx - 70, cy + 100); Ld.suitcase(0, 0, 0.9); g.restore(); g.save(); g.translate(cx + 90, cy + 100); Ld.suitcase(0, 0, 0.7); g.restore();
  const likes = Math.round(lerp(0, 148, seg(A.L1w5, T.all + 0.8, t, u => u)));
  Hd.label('♥ ' + likes, cx - 220, cy + 180, 34, '#e53935', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  Hd.label('Улетаем на 2 недели!', cx - 220, cy + 240, 34, '#17162f', { align: 'left', shadow: false, stroke: false });
  Hd.label('квартира пустая :)', cx - 220, cy + 290, 30, '#5d6570', { align: 'left', shadow: false, stroke: false });
  // the eyes: everyone sees it, a dark figure among them
  const k = seg(T.all, T.all + 0.8, t);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, r = 430, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r * 1.15, kk = clamp(k * 1.6 - i * 0.08);
    if (kk <= 0) continue;
    g.save(); g.globalAlpha = kk; g.translate(ex, ey);
    ell(0, 0, 46, 28, i === 5 ? '#2c2c34' : '#ffffff'); ell(Math.cos(a + Math.PI) * 10, Math.sin(a + Math.PI) * 6, 14, 14, i === 5 ? '#e53935' : '#17162f');
    g.restore();
  }
}

// —— the tower at night: lit windows everywhere but one dark flat; then ours lit «as if someone's home» ——
function towerFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  Sc.tower(t, P, { level: 23, flow: 0, spin: 0, power: 1, dots: [], home: seg(T.live, T.live + 0.5, t), dry: 0, labels: 1, mark: null });
  // the flats' windows: most warm, ours dark until «жилой»
  for (let f = 2; f <= Sc.FLOORS; f++) {
    const y = Sc.floorY(f + 1) + 26, lit = f === 20 ? seg(T.live, T.live + 0.5, t) : hash(f * 3.7) > 0.25 ? 1 : 0;
    fill(rrPath(Sc.BLD.x1 - 90, y, 54, 44, 4), lit > 0 ? rgba(P.warm, 0.7 * lit) : 'rgba(20,24,40,0.9)');
  }
  const y20 = Sc.floorY(21) + 48;
  if (t < T.live) { g.save(); g.translate(Sc.BLD.x1 - 63, y20); const k = clamp(sp(t, T.c2 + 0.6, 2.6, 8)); g.scale(k, k); g.lineWidth = 8; g.strokeStyle = P.danger; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke(); g.restore(); }
}

// —— the empty flat in the evening: the lamp on its timer comes on by itself ——
function flatFrame(t, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const on = t >= T.lamp;
  Ap.drawShell(t, { power: true, lampOn: false });
  Ap.drawWindow(t, { day: 0 });
  Ap.drawFridge(t); Ap.drawCounter(t, { fills: [1, 1, 1, 0.6, 0.3] }); Ap.drawTable(t, { candle: false });
  // the floor lamp by the window, its plug in the timer
  const lx = 380;
  limb([[lx, 0], [lx, -420]], 10, '#3a3f4a', false); fill(polyPath([[lx - 70, -420], [lx - 40, -520], [lx + 40, -520], [lx + 70, -420]]), on ? '#ffd58a' : '#c9b48a');
  rrect(lx - 130, -60, 60, 60, 8, '#f2efe6'); ell(lx - 100, -36, 18, 18, '#e9e4d8'); limb([[lx - 100, -36], [lx - 100 + 12 * Math.cos(t), -36 + 12 * Math.sin(t)]], 3, '#2c3140', false);
  if (!on) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,7,17,0.78)'; g.fillRect(0, 0, W, H); }
  else { const [x, y] = toScreen(cam, [lx, -440]); const gr = g.createRadialGradient(x, y, 0, x, y, 700); gr.addColorStop(0, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(4,7,17,0.25)'; g.fillRect(0, 0, W, H); }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c1 - 0.1, 'ДЕНЬ 1 — 06:30');
  Hd.timeStamp(t, T.c5 + 0.05, T.c6 - 0.1, 'ДЕНЬ 3 — 19:00');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ДЕНЬ 15 — 18:20');
  if (t < T.c1) Hd.plaque(t, A.L0w4 - 0.08, T.c1 - 0.02, 540, 330, { icon: 'calendar', title: '14 ДНЕЙ', sub: 'квартира пустая', color: GOLD });
  if (sc === 'phone') { Hd.redX(540, 760, 120, sp(t, T.no, 2.6, 8)); }
  Hd.ribbon(t, T.no, T.all - 0.15, 'НЕ ПИШИ, ЧТО УЕХАЛ', { y: 330, size: 84 });
  if (sc === 'phone') Hd.plaque(t, T.all + 0.4, T.c2 - 0.05, 540, 1560, { icon: 'x', title: 'ФОТО — ПОСЛЕ ОТПУСКА', sub: 'когда вернёшься', color: DANGER });
  if (sc === 'tower') Hd.plaque(t, T.live + 0.2, T.c3 - 0.05, 540, 330, { icon: 'house', title: 'ВЫГЛЯДИТ ЖИЛОЙ', sub: 'свет, почта, тишина у двери', color: WARM });
  // step 1
  Hd.stepHeader(t, 1, 'ДВЕРЬ И ОКНА', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    TURNS.forEach((t0, i) => { const p = S2([Ld.LOCKS[i][0] + 90, Ld.LOCKS[i][1]]); Hd.tick(p[0], p[1], sp(t, t0 + 0.4, 2.6, 8), 40); });
    Hd.plaque(t, A.L3w10 - 0.08, T.c4 - 0.02, 540, 1560, { icon: 'x', title: 'ЧАСТО ВХОДЯТ', sub: 'через открытое', color: DANGER });
  }
  // step 2
  Hd.stepHeader(t, 2, 'СОСЕДКА', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) {
    Hd.plaque(t, A.L4w4 - 0.08, T.mat - 0.1, 540, 560, { icon: 'check', title: 'ПОЧТА И РЕКЛАМА', sub: 'соседка заберёт', color: OK });
    const p = S2([Ld.MAT.x1 - 70, -10]); Hd.redX(p[0], p[1] - 90, 70, sp(t, T.mat + 0.3, 2.6, 8));
  }
  // step 3
  Hd.stepHeader(t, 3, 'ЛАМПА НА ТАЙМЕРЕ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) Hd.plaque(t, T.lamp + 0.1, T.c6 - 0.02, 540, 560, { icon: 'clock', title: '19:00 — СВЕТ', sub: 'будто ты дома', color: GOLD });
  // back
  if (t >= T.c6 && t < T.c7) {
    { const p = S2([0, -640]); Hd.tick(p[0], p[1], sp(t, A.L6w7 - 0.05, 2.6, 8), 56); }
    Hd.plaque(t, A.L6w19 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ПУРГА — К СОСЕДКЕ', sub: 'за котлетами', color: WARM });
  }
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ФОТО СРАЗУ ИЛИ ПОТОМ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}

// —— the poster: him with the suitcase at the door, the dog; the words on the right ——
function coverFrame(t) {
  const cam = { x: -60, y: -300, z: 1.45, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(t, {}); Ld.drawDoor(t, {}); Ld.drawMat(t, {});
  const o = stand(base(t, { s: 0.9, face: 1, pop: 0.3, brow: 0.6, mouth: 0.5, look: [0.7, -0.1], blink: 0 }), -360, 100);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 100, sh[1] + 120], shape: 'grip' } };
  Ld.suitcase(-160, 100, 1.1);
  drawDog({ x: -620, y: 60, s: 1.0, face: 1, sit: 1, look: 0.4, t: 0, ears: 1 });
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('УЕЗЖАЕШЬ', 0, 200, 120, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,200,80,0.9)'; g.shadowBlur = 40; Hd.label('В ОТПУСК?', 0, 340, 120, '#ffd23f', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'КВАРТИРА ПОД ЗАЩИТОЙ · 1', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw + 8, 410 + 8, pw, 84, INK); rect(-pw, 410, pw, 84, '#ffd43b'); text(pl, -pw / 2, 468, 48, '#111111', { fam: FONTS.cond, shadow: false });
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
  add(0.3, 'amb_flat', -22, 0, { dur: T.c1 - 0.3 });
  add(A.L0w4 - 0.08, 'blip', -10, 0);
  add(T.c1, 'whoosh_in', -12, 0);
  add(A.L1w5, 'ticks_up', -18, 0.2, { dur: Math.min(1.2, T.no - A.L1w5 - 0.05) });
  add(T.no, 'stamp', -5, 0);
  add(T.no, 'ribbon', -8, 0);
  add(T.all, 'whoosh', -14, 0);
  add(T.all + 0.4, 'blip', -10, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.c2, 'city', -22, 0, { dur: T.c3 - T.c2 });
  add(T.live, 'ding', -10, 0);
  add(T.c3, 'whoosh', -12, 0);
  TURNS.forEach(t0 => { add(t0, 'click', -8, 0.2); add(t0 + 0.4, 'pop_word', -12, 0.2); });
  add(A.L3w10 - 0.08, 'blip', -10, 0);
  add(T.c4, 'whoosh', -12, 0);
  add(A.L4w4 - 0.08, 'paper', -12, 0.3, { dur: 0.4 });
  add(A.L4w10, 'fill_plink', -12, 0.3);
  add(T.mat + 0.3, 'stamp', -8, -0.2);
  add(T.c5, 'whoosh', -12, 0);
  add(T.c5, 'amb_flat', -24, 0, { dur: T.c6 - T.c5 });
  add(T.lamp - 0.02, 'click', -6, 0.3);
  add(T.lamp, 'ding', -12, 0.3);
  add(T.c6, 'whoosh', -12, 0);
  add(A.L6w7 - 0.05, 'ding', -10, 0);
  add(T.dog, 'whine', -16, 0.3, { dur: 0.6 });
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
