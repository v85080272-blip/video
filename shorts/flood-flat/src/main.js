// «Заливают соседи, ты дома» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t.
// The owner, 20.11: «сделай ещё мультов, чтоб сегодня выпустить уже сейчас парочку». On the formula of «Облако хлора».
// Water runs from the ceiling lamp: not the light switch — water and current mean a short circuit and a shock → the
// breakers off → basins under it, the laptop away → upstairs to the neighbours; nobody — the emergency service → the
// secret: film it all and say the date, for the flooding report → «Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as El from './elec.js';
import * as Wt from './water.js';
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
const HOT = { ЗАЛИВАЮТ: DANGER, ЛЮСТРЫ: DANGER, СВЕТ: DANGER, НЕЛЬЗЯ: DANGER, ЗАМЫКАНИЕ: DANGER, ТОКОМ: DANGER, АВТОМАТЫ: OK,
  ЩИТКЕ: OK, ОБЕСТОЧЬ: OK, ВЕДРО: OK, ТЕХНИКУ: OK, ПОДАЛЬШЕ: OK, СОСЕДЯМ: OK, ВОДУ: OK, АВАРИЙНУЮ: OK, СЕКРЕТ: GOLD, ВИДЕО: GOLD,
  ДАТУ: GOLD, АКТА: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  pour: A.L0w9,                      // «вода течёт прямо из люстры»
  c1: A.L1 - 0.06,                   // «включить свет… Нельзя»
  reach: A.L1w3,
  nope: A.L1w7,
  c2: A.L2 - 0.06,                   // step 1: the switchboard
  c3: A.L3 - 0.06,                   // step 2: basins, the laptop away
  basin: A.L3w4,
  carry: A.L3w6,
  c4: A.L4 - 0.06,                   // step 3: upstairs; the emergency service
  shout: A.L4w2,
  call: A.L4w11,
  c5: A.L5 - 0.06,                   // the secret: film it, say the date
  rec: A.L5w3,
  c6: A.L6 - 0.06,
  sub: A.L6w6,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.pour, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.call, c6: T.c5, growl: T.rec, c7: T.c6, end: T.c6 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;

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
shot(T.cover, [[T.cover, 0, -430, 1.1], [T.pour, 0, -400, 1.15], [T.c1, 0, -380, 1.18]]);
shot(T.c1, [[T.c1, -120, -140, 1.15], [T.c2, -110, -140, 1.2]]);
shot(T.c2, [[T.c2, -60, -150, 1.0], [T.c3, -60, -150, 1.02]]);
shot(T.c3, [[T.c3, 40, -130, 1.12], [T.c4, 40, -130, 1.16]]);
shot(T.c4, [[T.c4, -100, -150, 1.05], [T.c5, -100, -150, 1.08]]);
shot(T.c5, [[T.c5, 0, -160, 1.0], [T.c6, 0, -160, 1.02]]);
shot(T.c6, [[T.c6, -60, -130, 1.12], [DUR, -60, -130, 1.16]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.pour, 5], [T.nope, 6]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);


// —— the water ——
const flowAt = t => (t < T.pour - 0.6 ? 0.25 : 1);
const stainAt = t => clamp(0.35 + 0.65 * seg(0, T.c3, t, x => x));
const puddleAt = t => (t < T.basin ? clamp(0.2 + 0.8 * seg(0, T.basin, t, x => x)) : 1);
const basinAt = t => (t < T.basin - 0.1 ? 0 : seg(T.basin - 0.1, T.basin + 0.3, t));

export function actorsAt(t) {
  if (t < T.c1) {                                                              // the hook: he looks up at the lamp
    const o = stand(base(t, { look: [0.3, -0.9], brow: t > T.pour ? 0.9 : 0.4, pop: t > T.pour ? 0.5 : 0, mouth: t > T.pour ? 0.4 : 0 }), -230);
    return { h: o, d: { x: -460, y: 0, s: DS, face: 1, sit: 1, look: 0.5, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c2) {                                                              // to the switch; «Нельзя» — the hand back
    const o = stand(base(t, { face: -1, look: [-0.7, 0], brow: 0.5 }), -110);
    const sh = shoulder(o), r = seg(T.reach - 0.3, T.reach + 0.1, t) * (1 - seg(T.nope, T.nope + 0.3, t));
    o.hands = { near: { p: [lerp(sh[0] - 40, Wt.SWITCH[0] + 10, r), lerp(sh[1] + 60, Wt.SWITCH[1], r)], shape: 'point' } };
    if (t > T.nope) { o.brow = 1; o.pop = 0.5; }
    return { h: o, d: { x: -460, y: 0, s: DS, face: 1, sit: 1, look: 0.5, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c3) {                                                              // the switchboard card; he waits
    const o = stand(base(t, { look: [0.4, -0.6], brow: 0.4 }), -250);
    return { h: o };
  }
  if (t < T.c4) {                                                              // the laptop carried away to the left
    const w = seg(T.carry - 0.2, T.carry + 1.2, t, x => x);
    const o = stand(base(t, { face: w > 0.02 ? -1 : 1, look: [w > 0.02 ? -0.6 : 0.5, 0.2], brow: 0.3 }), lerp(220, -280, w));
    const sh = shoulder(o);
    if (t > T.carry - 0.3) { o.hands = { near: { p: [sh[0] - 20, sh[1] + 60], shape: 'grip' }, far: { p: [sh[0] + 30, sh[1] + 64], shape: 'grip' } }; o.prop = { kind: 'laptop', p: [sh[0] + 5, sh[1] + 60] }; }
    return { h: o };
  }
  if (t < T.c5) {                                                              // shouting up; then the phone
    const o = stand(base(t, { look: [0.2, -0.9], brow: 0.8, mouth: t < T.call - 0.3 ? 0.6 : 0.2 }), -200);
    const sh = shoulder(o);
    if (t < T.call - 0.3) o.hands = { near: { p: [sh[0] + 20, sh[1] - 150], shape: 'fist' } };
    else { o.hands = { near: { p: [sh[0] + 30, sh[1] - 60], shape: 'grip' } }; o.prop = { kind: 'phone', p: [sh[0] + 28, sh[1] - 90] }; o.look = [0.6, 0.3]; }
    return { h: o };
  }
  if (t < T.c6) {                                                              // filming the ceiling
    const o = stand(base(t, { look: [0.2, -0.7], brow: 0.3, mouth: t > A.L5w8 ? 0.3 * Math.abs(Math.sin(t * 12)) : 0 }), -180);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 60, sh[1] - 120], shape: 'grip' } };
    o.prop = { kind: 'phoneUp', p: [sh[0] + 60, sh[1] - 150] };
    return { h: o };
  }
  const o = stand(base(t, { look: [0.6, 0], brow: 0.5, mouth: 0.3 }), -200);   // the end: thumbs up
  const sh = shoulder(o), k = clamp(sp(t, T.c6 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o, d: { x: -460, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1 } };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.2); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.restore(); };
  if (p?.kind === 'phoneUp') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(-0.3); rrect(-30, -18, 60, 36, 7, '#24232f'); ell(-16, 0, 6, 6, '#e53935'); g.restore(); };
  if (p?.kind === 'laptop') o.propNear = () => Wt.laptop(p.p);
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
function roomFrame(t, cam, still = false) {
  const a = still ? {} : actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.farRoom(t, { wisps: 0, smoke: 0 });
  Wt.stain(stainAt(t)); Wt.wallSwitch();
  const off = t >= T.c2 + 1.0;                                                 // the breakers are down: the lamp is dark
  Wt.lamp(t, { lit: off ? 0 : 1, wet: flowAt(t) });
  // the laptop on the sofa until he takes it
  if (t < T.carry - 0.3) Wt.laptop([300, -170]);
  Wt.puddle(puddleAt(t));
  const bk = basinAt(t);
  Wt.basin(Wt.DRIPS[0][0] + 10, bk, seg(T.basin, T.c6, t) * 0.8); Wt.bucket(Wt.DRIPS[2][0], seg(T.basin + 0.3, T.basin + 0.7, t));
  Wt.drips(t, flowAt(t), bk > 0.5 ? [-50, -50, -90] : []);
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  // the room darker once the power is off
  if (off) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = 0.18; g.fillStyle = '#0b0f1a'; g.fillRect(0, 0, W, H); g.restore(); }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «включить свет… Нельзя»
  if (t >= T.c1 && t < T.c2) { const b = S2(Wt.SWITCH); Hd.redX(b[0], b[1], 90, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); }
  Hd.plaque(t, A.L1w8 - 0.05, T.c2 - 0.1, 540, 560, { icon: 'bolt', title: 'ВОДА + ТОК = ЗАМЫКАНИЕ', sub: 'и удар током', color: DANGER, size: 46 });
  // step 1
  Hd.stepHeader(t, 1, 'ОБЕСТОЧЬ КВАРТИРУ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) El.boardCard(560, 720, clamp(sp(t, A.L2w1 - 0.1, 2.4, 8)) * (1 - seg(T.c3 - 0.25, T.c3 - 0.02, t)), 4 * seg(A.L2w2, A.L2e + 0.2, t, x => x));
  // step 2
  Hd.stepHeader(t, 2, 'ВЕДРО · ТЕХНИКУ ПРОЧЬ', A.L3 + 0.02, A.L3e - 0.05);
  // step 3
  Hd.stepHeader(t, 3, 'К СОСЕДЯМ · АВАРИЙКА', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) { const h = actorsAt(t).h; if (h) { const p = S2([h.hip[0] + 100, h.hip[1] - 330]); speech(t, T.shout - 0.05, T.call - 0.3, p[0], p[1], '«СОСЕДИ, ПЕРЕКРОЙТЕ ВОДУ!»'); } }
  if (t >= T.c4 && t < T.c5) Wt.callCard(720, 660, clamp(sp(t, T.call - 0.1, 2.4, 8)) * (1 - seg(T.c5 - 0.25, T.c5 - 0.02, t)), t, 'АВАРИЙНАЯ', 'служба дома · вызов…');
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 300, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  if (t >= T.c5 && t < T.c6) Wt.recCard(700, 720, clamp(sp(t, T.rec - 0.1, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t)), t, '20.11.2026  12:40');
  Hd.plaque(t, A.L5w13 - 0.05, T.c6 - 0.1, 540, 1040, { icon: 'check', title: 'ДЛЯ АКТА О ЗАЛИВЕ', color: GOLD, size: 46 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 700, { icon: 'comment', title: 'ТЕБЯ ЗАЛИВАЛИ СОСЕДИ?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
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
  plq(440, 'ЕСЛИ ЗАЛИВАЮТ СОСЕДИ', k2, 74, '#ffd23f');
  plq(560, 'И ВОДА ИЗ ЛЮСТРЫ?', k3, 80, '#6fc3ff');
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
// —— the cover: water running out of the lamp; the question and the ban ——
function coverFrame(t) {
  const cam = { x: 0, y: -330, z: 1.25, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.farRoom(3, {}); Wt.stain(1); Wt.wallSwitch(); Wt.lamp(3, { lit: 1, wet: 1 }); Wt.puddle(0.8); Wt.drips(3.2, 1);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ВОДА ИЗ ЛЮСТРЫ?', 540, 380, 130, 980, '#6fc3ff', { rot: -0.03 });
  fitText('НЕ ВКЛЮЧАЙ СВЕТ!', 540, 530, 120, 960, '#ff5a4a', { rot: -0.03 });
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
  add(0.05, 'tap_run', -24, 0, { dur: T.c6 - 0.1 });
  for (let i = 0; i < 6; i++) add(0.3 + i * 0.55, 'fill_plink', -16, 0.1);
  add(T.pour - 0.1, 'pour', -12, 0, { dur: 1.0 });
  add(T.c1, 'whoosh', -12, 0);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh', -12, 0);
  for (let i = 0; i < 4; i++) add(A.L2w2 + i * ((A.L2e + 0.2 - A.L2w2) / 4), 'toggle', -8, 0.1);
  add(T.c2 + 1.0, 'hum_stop', -12, 0);
  add(T.c3, 'whoosh', -12, 0);
  add(T.basin + 0.2, 'click', -10, 0.1); add(T.basin + 0.6, 'click', -12, 0.3);
  add(T.c4, 'whoosh', -12, 0);
  for (let i = 0; i < 3; i++) add(T.shout + 0.1 + i * 0.3, 'click', -8, 0);
  for (let i = 0; i < 3; i++) add(T.call + i * 0.15, 'click', -10, 0.1);
  add(T.c5, 'whoosh_in', -14, 0);
  add(T.rec, 'blip', -8, 0);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
