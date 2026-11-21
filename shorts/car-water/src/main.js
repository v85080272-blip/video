// «Машина упала в воду, ты внутри» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t.
// The owner, 21.11: «роликов за сегодня нету, а выходные — самое лучшее потребление». On the formula of «Облако хлора».
// The car is in the river and sinking: not the door — the water presses on it from outside → unbuckle, then the children,
// the eldest first → while it floats, the window down → out through the window, swim to the bank → the secret: the
// headlights on, rescuers find the car faster → «Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as Cw from './carwater.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{ let t = 0.12; for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.38, n]; t += n * 0.38; } }
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]) + 20; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { МАШИНА: DANGER, РЕКУ: DANGER, ТОНЕТ: DANGER, ДВЕРЬ: DANGER, НЕЛЬЗЯ: DANGER, ДАВИТ: DANGER, ОТСТЕГНИ: OK,
  РЕМЕНЬ: OK, ДЕТЕЙ: OK, СТАРШЕГО: OK, ПЛАВУ: OK, ОКНО: OK, БЕРЕГУ: OK, СЕКРЕТ: GOLD, ФАРЫ: GOLD, СПАСАТЕЛИ: GOLD, ПИШИ: GOLD,
  ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  sink: A.L0w8,                      // «и тонет»
  c1: A.L1 - 0.06,                   // «открыть дверь… Нельзя»
  push: A.L1w3,
  nope: A.L1w5,
  c2: A.L2 - 0.06,                   // step 1: the belt
  belt: A.L2w1,
  c3: A.L3 - 0.06,                   // step 2: the window down
  glass: A.L3w6,
  c4: A.L4 - 0.06,                   // step 3: out and to the bank
  out: A.L4w1,
  c5: A.L5 - 0.06,                   // the secret: the headlights
  lights: A.L5w3,
  c6: A.L6 - 0.06,
  sub: A.L6w9,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.sink, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.belt, c6: T.c5, growl: T.lights, c7: T.c6, end: T.c6 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const CS = 0.9;                                                               // the car's scale

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
const SHOTS = [];
const shot = (t0, keys) => SHOTS.push({ t0, keys });
shot(T.cover, [[T.cover, 80, -120, 0.82], [T.sink, 80, -100, 0.86], [T.c1, 80, -90, 0.88]]);
shot(T.c1, [[T.c1, 120, -120, 1.25], [T.c2, 120, -120, 1.3]]);
shot(T.c2, [[T.c2, 130, -170, 1.9], [T.c3, 130, -170, 1.95]]);
shot(T.c3, [[T.c3, 120, -150, 1.35], [T.c4, 120, -120, 1.3]]);
shot(T.c4, [[T.c4, 200, -60, 0.85], [T.c5, 420, -60, 0.85]]);
shot(T.c5, [[T.c5, 200, 330, 0.8], [T.c6, 220, 330, 0.82]]);
shot(T.c6, [[T.c6, 760, -260, 1.0], [DUR, 760, -260, 1.04]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[0.15, 7], [T.nope, 6]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);


// —— the car: where it floats, how it tilts, the water inside ——
function carAt(t) {
  const bob = 6 * Math.sin(t * 2.2);
  if (t < T.c4) return { y: lerp(-40, 40, seg(0, T.c4, t)) + bob, a: 0.04 * Math.sin(t * 1.3) + 0.06 * seg(T.sink - 0.2, T.sink + 0.8, t), inside: 0.15 * seg(T.sink, T.c4, t) };
  if (t < T.c5) return { y: lerp(40, 420, seg(T.out + 0.4, T.c5, t)), a: lerp(0.06, 0.32, seg(T.out + 0.4, T.c5, t)), inside: lerp(0.15, 1, seg(T.out, T.c5, t)) };
  return { y: 520, a: 0.32, inside: 1 };
}
// the driver: seated in the car (local coords); his look and brow
function driver(t) {
  const o = base(t, { s: 0.45, look: [0.8, 0], brow: 0.6 });
  const [hx, hy] = Cw.SEAT; o.hip = [hx, hy]; o.feet = { near: [hx + 150, -30], far: [hx + 170, -30] };
  if (t < T.c1) { o.look = [0.4, -0.5]; o.brow = t > T.sink ? 0.9 : 0.5; o.pop = t > T.sink ? 0.5 : 0; o.mouth = t > T.sink ? 0.4 : 0; }
  else if (t < T.c2) { o.face = -1; o.look = [-0.8, 0]; const sh = framesOf(o).T.p([-14, -192]); o.hands = { near: { p: [sh[0] - 70, sh[1] + 40 + 6 * Math.sin(t * 18) * seg(T.push - 0.1, T.push + 0.2, t) * (1 - seg(T.nope, T.nope + 0.3, t))], shape: 'open' } }; if (t > T.nope) o.brow = 1; }
  else if (t < T.c3) { const sh = framesOf(o).T.p([-14, -192]); o.hands = { near: { p: [hx + 20, hy - 20], shape: 'grip' } }; o.look = [0.3, 0.6]; }
  else { const sh = framesOf(o).T.p([-14, -192]), r = seg(T.glass - 0.3, T.glass + 0.2, t); o.hands = { near: { p: [lerp(hx + 20, sh[0] + 90, r), lerp(hy, sh[1] + 40, r)], shape: 'point' } }; o.look = [0.6, -0.2]; }
  return o;
}
export function actorsAt(t) {
  if (t < T.out + 0.3) return { inCar: driver(t) };
  if (t < T.c6) return { swim: lerp(200, Cw.BANK_X - 60, seg(T.out + 0.3, T.c5 - 0.3, t)) };
  const o = stand(base(t, { look: [0.6, 0], brow: 0.5, mouth: 0.3 }), 900, -125);   // the end: on the bank, thumbs up
  const sh = shoulder(o), k = clamp(sp(t, T.c6 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o };
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (t < T.cover) { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t), a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fbcd6'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  sceneDraw(t, a);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function sceneDraw(t, a) {
  Cw.riverBack(t);
  const c = carAt(t), beltOn = t < T.belt + 0.1;
  Cw.carFrame(0, c.y, c.a, CS, () => {
    if (a.inCar) {
      drawHunter(a.inCar);
      if (beltOn) { const F = framesOf(a.inCar), sh = F.T.p([-14, -192]); limb([[sh[0] + 20, sh[1] - 10], [Cw.SEAT[0] + 40, Cw.SEAT[1] + 10]], 10, '#2b2f38', false); }
    }
    Cw.car(t, { glass: t >= T.c3 ? seg(T.glass - 0.2, T.glass + 0.6, t) : 0, inside: c.inside, lights: t >= T.c5 ? seg(T.lights - 0.1, T.lights + 0.3, t) : 0 });
    if (t >= T.c1 && t < T.c2) Cw.pressure(t, seg(A.L1w6 - 0.1, A.L1w6 + 0.3, t));
  });
  Cw.river(t, { splash: t < T.c1 ? 1 - seg(0.2, T.c1, t) : 0, sx: 0 });
  if (t >= T.c5) Cw.carFrame(0, c.y, c.a, CS, () => Cw.beam(t, seg(T.lights - 0.1, T.lights + 0.3, t)));
  if (a.swim != null) Cw.swimmer(t, a.swim, 0.9);
  if (a.h) drawHunter(a.h);
}

// —— everything over the picture ——
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «открыть дверь… Нельзя»
  if (t >= T.c1 && t < T.c2) { const c = carAt(t), b = S2([140 * CS, c.y - 120 * CS]); Hd.redX(b[0], b[1], 110, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); }
  Hd.plaque(t, A.L1w6 - 0.05, T.c2 - 0.1, 540, 330, { icon: 'x', title: 'ДВЕРЬ НЕ ОТКРЫТЬ', sub: 'её держит вода снаружи', color: DANGER, size: 48 });
  // step 1
  Hd.stepHeader(t, 1, 'ОТСТЕГНИ РЕМЕНЬ', A.L2 + 0.02, A.L2e - 0.05);
  Hd.plaque(t, A.L2w3 - 0.05, T.c3 - 0.1, 540, 1040, { icon: 'check', title: 'ПОТОМ ДЕТЕЙ — СТАРШЕГО ПЕРВЫМ', color: OK, size: 38 });
  // step 2
  Hd.stepHeader(t, 2, 'ОТКРОЙ ОКНО', A.L3 + 0.02, A.L3e - 0.05);
  Hd.plaque(t, A.L3w1 - 0.05, T.c4 - 0.1, 540, 1040, { icon: 'clock', title: 'ПОКА МАШИНА НА ПЛАВУ', color: GOLD, size: 44 });
  // step 3
  Hd.stepHeader(t, 3, 'ЧЕРЕЗ ОКНО — К БЕРЕГУ', A.L4 + 0.02, A.L4e - 0.05);
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 200, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  Hd.plaque(t, T.lights - 0.05, T.c6 - 0.1, 540, 330, { icon: 'torch', title: 'ФАРЫ ВКЛЮЧЕНЫ — НАЙДУТ БЫСТРЕЕ', color: GOLD, size: 40 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 1440, { icon: 'comment', title: 'ЗНАЛ, ЧТО ДВЕРЬ НЕ ОТКРОЕТСЯ?', sub: 'пиши в комментариях', color: GOLD, size: 40 });
  Hd.endCard(t, T.sub - 0.05, 0, 300);
}
// the hook: «ЧТО ДЕЛАТЬ,» from the first frame, then the question word by word
function questionTitle(t) {
  const k1 = sp(t, 0.02, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w7 - 0.05, 2.4, 7);
  const out = seg(A.L1 - 0.15, A.L1 + 0.1, t);
  if (k1 > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 540, 300); g.scale(k1 * (1 - out), k1 * (1 - out)); g.rotate(-0.03); text('ЧТО ДЕЛАТЬ,', 0, 0, 120, '#fff3d6'); g.restore(); }
  const plq = (y, str, k, size, c = '#ffd23f') => {
    if (k <= 0.01) return;
    const w = measure(str, size, FONTS.cond) + 70, h = size * 1.45;
    g.save(); g.setTransform(1, 0, 0, 1, 540, y); g.rotate(-0.03); g.scale(k * (1 - out), k * (1 - out));
    rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, c);
    text(str, 0, size * 0.36, size, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  };
  plq(440, 'ЕСЛИ МАШИНА В РЕКЕ', k2, 78, '#ffd23f');
  plq(560, 'И ТОНЕТ, А ТЫ ВНУТРИ?', k3, 74, '#6fc3ff');
}
function speech(t, t0, t1, x, y, str) {
  if (t < t0 || t > t1 + 0.2) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - clamp((t - t1) / 0.2));
  if (k <= 0.01) return;
  const size = 40, w = measure(str, size, FONTS.cond) + 60, h = 90;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(clamp(x, w / 2 + 20, W - w / 2 - 20), y); g.scale(k, k); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20; g.shadowOffsetY = 6; rrect(-w / 2, -h / 2, w, h, 24, '#fff8e6'); poly([[-w / 2 + 50, h / 2 - 2], [-w / 2 + 90, h / 2 - 2], [-w / 2 + 30, h / 2 + 34]], '#fff8e6'); g.restore();
  text(str, 0, 14, size, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
// —— the cover: the car in the river, the driver inside; the question and the ban ——
function coverFrame(t) {
  const cam = { x: 80, y: -170, z: 0.95, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fbcd6'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Cw.riverBack(3);
  Cw.carFrame(0, 20, 0.1, CS, () => { const o = base(3, { s: 0.45, look: [0.4, -0.5], brow: 1, pop: 1, mouth: 0.6 }); o.hip = [...Cw.SEAT]; o.feet = { near: [Cw.SEAT[0] + 150, -30], far: [Cw.SEAT[0] + 170, -30] }; drawHunter(o); Cw.car(3, { inside: 0.3 }); });
  Cw.river(3, { splash: 0.8 });
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('МАШИНА В ВОДЕ?', 540, 380, 130, 980, '#6fc3ff', { rot: -0.03 });
  fitText('НЕ ОТКРЫВАЙ ДВЕРЬ!', 540, 530, 110, 960, '#ff5a4a', { rot: -0.03 });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o } = actorsAt(tt), d = null, out = [];
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
  add(0.02, 'flush', -8, 0); add(0.05, 'tap_run', -22, 0, { dur: DUR - 0.2 }); add(0.3, 'drain', -16, 0, { dur: 1.0 });
  add(T.sink, 'drain', -12, 0, { dur: 1.2 });
  add(T.c1, 'whoosh', -12, 0); add(T.push, 'stamp', -14, -0.2); add(T.push + 0.3, 'stamp', -16, -0.2);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh_in', -14, 0); add(T.belt, 'click', -6, 0.1);
  add(T.c3, 'whoosh', -12, 0); add(T.glass - 0.1, 'squeak_dry', -10, 0.2); add(T.glass + 0.2, 'pour', -12, 0.2, { dur: 0.8 });
  add(T.c4, 'whoosh', -12, 0); add(T.out + 0.3, 'flush', -10, 0.2); add(T.out + 0.6, 'pour', -20, 0, { dur: T.c5 - T.out });
  add(T.c5, 'whoosh_down', -12, 0); add(T.lights, 'toggle', -8, 0);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
