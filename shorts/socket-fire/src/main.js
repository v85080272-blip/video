// «Загорелась проводка, ты дома» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t.
// The owner, 20.11: «делай и го выкладывать больше роликов», «в течение дня дропать каждый час». On the formula of «Облако
// хлора» and «Дым в подъезде». The socket by the sofa sparks, the heater's cord catches fire: not water — the cord is live
// and water conducts the current → pull the plug or switch the breakers off → a small fire: a thick cloth over it, not a
// synthetic one → it doesn't go out: leave, shut the door, call 101 → the secret: with the power off, water is fine →
// «А у тебя дома есть огнетушитель? Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as El from './elec.js';
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
  for (let i = 0; i < Math.max(n, FB[id][2]) + 2; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { РОЗЕТКА: DANGER, ЗАИСКРИЛА: DANGER, ЗАГОРЕЛСЯ: DANGER, ШНУР: DANGER, ВОДОЙ: DANGER, НЕЛЬЗЯ: DANGER, ТОКОМ: DANGER, ТОК: DANGER,
  ВЫДЕРНИ: OK, ВИЛКУ: OK, АВТОМАТЫ: OK, ЩИТКЕ: OK, НАКРОЙ: OK, ПЛОТНОЙ: OK, ТКАНЬЮ: OK, СИНТЕТИКОЙ: DANGER, УХОДИ: OK, ДВЕРЬ: OK,
  ОДИН: OK, СЕКРЕТ: GOLD, ВЫКЛЮЧЕН: GOLD, МОЖНО: GOLD, ОГНЕТУШИТЕЛЬ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  spark: A.L0w4,                     // «розетка заискрила»
  fire: A.L0w7,                      // «загорелся провод»
  c1: A.L1 - 0.06,                   // «плеснуть водой… Нельзя»
  nope: A.L1w5,
  c2: A.L2 - 0.06,                   // step 1: the plug out; the breakers
  pull: A.L2w1,
  board: A.L2w6 - 0.1,
  c3: A.L3 - 0.06,                   // step 2: the blanket
  throw: A.L3w4,
  c4: A.L4 - 0.06,                   // step 3: it doesn't go out — out of the room, the door, 101
  grow: A.L4w1,
  leave: A.L4w3,
  dial: A.L4w10,
  c5: A.L5 - 0.06,                   // the secret: power off — water is fine
  water: A.L5w7,
  c6: A.L6 - 0.06,                   // the extinguisher; «Пиши!»; subscribe
  sub: A.L6w7,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.fire, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.dial, c6: T.c5, growl: T.grow, c7: T.c6, end: T.c6 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : 'room');

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
shot(T.cover, [[T.cover, 20, -80, 1.5], [T.fire, 50, -70, 1.6], [T.c1, 40, -80, 1.6]]);
shot(T.c1, [[T.c1, -40, -90, 1.45], [T.c2, -30, -90, 1.5]]);
shot(T.c2, [[T.c2, 40, -60, 1.9], [T.board, 50, -60, 1.95], [T.c3, 50, -60, 1.95]]);
shot(T.c3, [[T.c3, 30, -80, 1.55], [T.c4, 20, -80, 1.6]]);
shot(T.c4, [[T.c4, -40, -100, 1.4], [T.leave, -200, -120, 1.3], [T.c5, -230, -120, 1.3]]);
shot(T.c5, [[T.c5, 40, -70, 1.7], [T.c6, 50, -70, 1.75]]);
shot(T.c6, [[T.c6, -60, -110, 1.45], [DUR, -60, -110, 1.5]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.spark, 6], [T.nope, 6], [T.grow, 5]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);

// —— what burns when ——
function fireAt(t) {
  if (t < T.fire - 0.1) return 0;
  if (t < T.throw + 0.3) return seg(T.fire - 0.1, T.fire + 0.8, t);          // until the blanket
  if (t < T.grow - 0.1) return 0;                                              // smothered
  if (t < T.c5) return 1.2 * seg(T.grow - 0.1, T.grow + 0.5, t);              // «не гаснет?» — the other case
  return 0.9 * (1 - seg(T.water, T.water + 0.7, t));                          // the secret: water once the power is off
}
const sparksAt = t => (t < T.spark - 0.05 ? 0 : t < T.pull ? 1 : 0);
const pullAt = t => (t < T.pull - 0.2 ? 0 : t < T.c3 ? seg(T.pull - 0.2, T.pull + 0.25, t) : 1);
const blanketAt = t => (t >= T.throw - 0.35 && t < T.grow - 0.1 ? seg(T.throw - 0.35, T.throw + 0.25, t) : 0);

export function actorsAt(t) {
  if (t < T.c1) {                                                              // the hook: he turns to the sparks
    const o = stand(base(t, { look: [0.9, 0.4], brow: t > T.spark ? 0.9 : 0.3, pop: t > T.spark ? 0.6 : 0, mouth: t > T.fire ? 0.4 : 0 }), -190);
    return { h: o, d: { x: -420, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c2) {                                                              // the glass of water; «Нельзя» — he stops
    const o = stand(base(t, { look: [0.8, 0.4], brow: 0.6, lean: 0.06 }), -170);
    const sh = shoulder(o), up = seg(A.L1w3 - 0.3, A.L1w3 + 0.1, t), back = seg(T.nope, T.nope + 0.3, t);
    o.hands = { near: { p: [sh[0] + 60 + 40 * up - 50 * back, sh[1] - 20 * up + 60 * back], shape: 'grip' } };
    o.prop = { kind: 'glass', p: o.hands.near.p, tilt: 0.25 * up * (1 - back) };
    if (t > T.nope) { o.brow = 1; o.pop = 0.5; o.lean = -0.05; }
    return { h: o, d: { x: -420, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c3) {                                                              // the plug out
    const o = stand(base(t, { look: [0.8, 0.6], brow: 0.5, lean: 0.25 }), -40);
    const sh = shoulder(o), reach = seg(T.pull - 0.4, T.pull - 0.1, t), pl = pullAt(t);
    o.hands = { near: { p: [lerp(sh[0] + 40, El.SOCK.x - 4 + 36 * pl, reach), lerp(sh[1] + 60, El.SOCK.y + 4 + 50 * pl, reach)], shape: 'grip' } };
    o.hip[1] += 30 * reach;
    return { h: o };
  }
  if (t < T.c4) {                                                              // the blanket over the fire
    const o = stand(base(t, { look: [0.7, 0.5], brow: 0.5, lean: 0.12 }), -110);
    const sh = shoulder(o), th = seg(T.throw - 0.35, T.throw + 0.1, t);
    if (th < 0.99) { const p = [lerp(sh[0] + 60, El.FIRE_AT[0] - 60, th), lerp(sh[1] - 60, -120, th)]; o.hands = { near: { p, shape: 'grip' }, far: { p: [p[0] + 50, p[1] + 10], shape: 'grip' } }; o.prop = th < 0.05 ? { kind: 'blanket', p } : null; }
    return { h: o, d: { x: -420, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 0.8 } };
  }
  if (t < T.c5) {                                                              // it grows: out of the room, the door shut; 101
    const w = seg(T.leave - 0.2, T.leave + 1.0, t, x => x);
    const D = Sm.ROOM2.door, x = lerp(-150, D.x0 + 40, w);
    const o = stand(base(t, { face: w > 0.02 ? -1 : 1, look: [w > 0.02 ? -0.8 : 0.8, 0], brow: 0.8, pop: 0.3 }), x);
    if (w > 0.85) o.hidden = true;
    if (t > T.dial - 0.2) o.hidden = true;
    return { h: o.hidden ? null : o, door: w > 0.85 ? 0 : seg(T.leave - 0.1, T.leave + 0.3, t) };
  }
  if (t < T.c6) {                                                              // the secret: the breakers off, the glass poured
    const o = stand(base(t, { look: [0.8, 0.5], brow: 0.3, lean: 0.08 }), -120);
    const sh = shoulder(o), up = seg(T.water - 0.4, T.water, t);
    o.hands = { near: { p: [sh[0] + 70 + 40 * up, sh[1] - 10 * up], shape: 'grip' } };
    o.prop = { kind: 'glass', p: o.hands.near.p, tilt: up };
    return { h: o, pour: up > 0.9 ? [o.hands.near.p, [El.FIRE_AT[0], -10]] : null };
  }
  const o = stand(base(t, { look: [0.6, 0], brow: 0.5, mouth: 0.3 }), -200);   // the end: the extinguisher, thumbs up
  const sh = shoulder(o), k = clamp(sp(t, T.c6 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 }, far: { p: [sh[0] + 30, sh[1] + 70], shape: 'grip' } };
  o.prop = { kind: 'ext', p: [sh[0] + 30, sh[1] + 60] };
  return { h: o, d: { x: -460, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1 } };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'glass') o.propNear = () => El.glass(p.p, p.tilt);
  if (p?.kind === 'blanket') o.propNear = () => El.blanket(p.p[0] + 20, p.p[1] + 120, 0);
  if (p?.kind === 'ext') o.propFar = () => El.extinguisher(p.p, 0.9);
  return drawHunter(o);
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (t < T.cover) { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  roomFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function roomFrame(t, cam) {
  const a = actorsAt(t), f = fireAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const smoke = clamp(f * 0.5 + (t > T.grow && t < T.c5 ? 0.3 * seg(T.grow, T.c5, t) : 0));
  Sm.farRoom(t, { wisps: 0, smoke: smoke * 0.8 });
  if (a.door != null && a.door > 0.01) { const D = Sm.ROOM2.door; g.save(); g.globalAlpha = a.door; rect(D.x0, D.top, D.x1 - D.x0, -D.top, '#3a3530'); g.restore(); }
  El.socketScene(t, { pull: pullAt(t), sparks: sparksAt(t), fire: f, blanket: blanketAt(t), scorch: clamp((t - T.fire) / 2), burnt: t > T.fire + 1,
    steam: t > T.water ? 1 - seg(T.water + 1.2, T.c6, t) : 0, wet: t > T.water + 0.3 ? 1 : 0 });
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (a.pour) El.pour(a.pour[0], a.pour[1], t, 1);
  // the orange light of the fire on the room
  if (f > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = 0.12 * f * (0.8 + 0.2 * noise(t * 8, 3)); g.fillStyle = '#ff8a3d'; g.fillRect(0, 0, W, H); g.restore(); }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «плеснуть водой… Нельзя»
  if (t >= T.c1 && t < T.c2) { const h = actorsAt(t).h; if (h?.hands) { const b = S2(h.hands.near.p); Hd.redX(b[0], b[1], 100, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); } }
  Hd.plaque(t, A.L1w6 - 0.05, T.c2 - 0.1, 540, 560, { icon: 'bolt', title: 'ВОДА ПРОВОДИТ ТОК', sub: 'провод под напряжением', color: DANGER, size: 50 });
  // step 1
  Hd.stepHeader(t, 1, 'ВЫДЕРНИ ВИЛКУ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) El.boardCard(560, 720, clamp(sp(t, T.board, 2.4, 8)) * (1 - seg(T.c3 - 0.25, T.c3 - 0.02, t)), 4 * seg(T.board + 0.3, A.L2e + 0.2, t, x => x));
  // step 2
  Hd.stepHeader(t, 2, 'НАКРОЙ ТКАНЬЮ', A.L3 + 0.02, A.L3e - 0.05);
  Hd.plaque(t, A.L3w8 - 0.05, T.c4 - 0.1, 540, 560, { icon: 'x', title: 'НЕ СИНТЕТИКОЙ', sub: 'плотная ткань: шерсть, хлопок', color: DANGER, size: 46 });
  // step 3
  Hd.stepHeader(t, 3, 'УХОДИ · ДВЕРЬ · 101', A.L4 + 0.02, A.L4e - 0.05);
  Hd.plaque(t, T.grow - 0.05, T.leave - 0.1, 540, 560, { icon: 'flame', title: 'НЕ ГАСНЕТ?', color: GOLD, size: 50 });
  if (t >= T.dial - 0.1 && t < T.c5) dialCard(t, 560, 720);
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 300, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  if (t >= T.c5 && t < T.c6) El.boardCard(800, 700, 0.55 * clamp(sp(t, A.L5w3 - 0.1, 2.4, 8)) * (1 - seg(T.water - 0.3, T.water, t)), 4, 1);
  Hd.plaque(t, A.L5w4 - 0.05, T.c6 - 0.1, 540, 480, { icon: 'check', title: 'ТОК ВЫКЛЮЧЕН — МОЖНО ВОДОЙ', color: OK, size: 42 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 700, { icon: 'comment', title: 'ЕСТЬ ДОМА ОГНЕТУШИТЕЛЬ?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
  Hd.endCard(t, T.sub - 0.05, 0, 300);
}
// the hook: «ЧТО ДЕЛАТЬ,» from the first frame, then the question word by word
function questionTitle(t) {
  const k1 = sp(t, 0.02, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, T.fire - 0.15, 2.4, 7);
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
  plq(440, 'ЕСЛИ РОЗЕТКА ЗАИСКРИЛА', k2, 72, '#ffd23f');
  plq(560, 'И ЗАГОРЕЛСЯ ШНУР?', k3, 80, '#ff8a3d');
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
function dialCard(t, cx, cy) {
  const k = clamp(sp(t, T.dial - 0.1, 2.4, 8)) * (1 - seg(T.c5 - 0.25, T.c5 - 0.02, t));
  if (k <= 0.01) return;
  const w = 360, h = 560;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, '#16233a');
  const num = '101', t0 = T.dial, n = Math.min(3, Math.floor((t - t0) / 0.15) + 1);
  Hd.label(num.slice(0, Math.max(1, n)), 0, -120, 96, '#ffffff', { shadow: false, stroke: false });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ell(-90 + c * 90, -10 + r * 80, 30, 30, 'rgba(255,255,255,0.12)');
  ell(0, 220, 40, 40, '#2f8f4e');
  g.restore();
}

function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
// —— the cover: the burning socket by the sofa; the question and the ban ——
function coverFrame(t) {
  const tc = T.fire + 1.5, cam = { x: 60, y: -80, z: 1.75, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.farRoom(tc, { smoke: 0.4 });
  El.socketScene(tc, { sparks: 1, fire: 1, scorch: 1, burnt: true });
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = 0.12; g.fillStyle = '#ff8a3d'; g.fillRect(0, 0, W, H); g.restore();
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ЗАГОРЕЛАСЬ РОЗЕТКА?', 540, 380, 120, 980, '#ffd23f', { rot: -0.03 });
  fitText('НЕ ЛЕЙ ВОДУ!', 540, 530, 130, 960, '#ff5a4a', { rot: -0.03 });
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
  add(0.05, 'amb_flat', -22, 0, { dur: DUR - 0.2 });
  add(T.spark - 0.05, 'spark', -8, 0.2); add(T.spark + 0.4, 'spark', -10, 0.2); add(T.spark + 0.9, 'spark', -12, 0.2);
  add(T.fire - 0.1, 'fire_whoosh', -10, 0.2); add(T.fire, 'fire', -18, 0.2, { dur: T.throw + 0.3 - T.fire });
  add(T.c1, 'whoosh', -12, 0);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.pull, 'click', -6, 0.2); add(T.pull + 0.05, 'hum_stop', -12, 0.2);
  for (let i = 0; i < 4; i++) add(T.board + 0.3 + i * ((A.L2e - T.board) / 4), 'toggle', -8, 0.1);
  add(T.c3, 'whoosh', -12, 0);
  add(T.throw - 0.1, 'whoosh_down', -10, 0); add(T.throw + 0.2, 'puff', -10, 0.1);
  add(T.c4, 'whoosh', -12, 0);
  add(T.grow - 0.05, 'fire_whoosh', -10, 0.2); add(T.grow, 'fire', -16, 0.2, { dur: T.c5 - T.grow });
  add(T.leave + 0.9, 'click', -6, -0.3);
  for (let i = 0; i < 3; i++) add(T.dial + i * 0.15, 'click', -10, 0.1);
  add(T.c5, 'whoosh_in', -14, 0);
  add(T.c5, 'fire', -20, 0.2, { dur: T.water + 0.5 - T.c5 });
  add(T.water, 'pour', -10, 0.2, { dur: 0.8 }); add(T.water + 0.3, 'puff', -10, 0.2);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
