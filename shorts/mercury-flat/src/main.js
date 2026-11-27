// «Разбился градусник, ты дома» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t.
// The owner, 20.11: «в течение дня дропать каждый час». On the formula of «Облако хлора»: the thermometer slips and breaks,
// the mercury rolls over the floor: not the vacuum cleaner or a broom — it scatters into tiny beads → the children and pets
// out, the window open, the door shut → the beads on a damp paper towel into a jar of water → the jar shut, 112, they say
// where to hand it over → the secret: a torch along the floor makes the beads glint → «Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as Mc from './merc.js';
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
const HOT = { РАЗБИЛСЯ: DANGER, ГРАДУСНИК: DANGER, РТУТЬ: DANGER, ПЫЛЕСОС: DANGER, НЕЛЬЗЯ: DANGER, ПЫЛЕСОСОМ: DANGER,
  ВЕНИКОМ: DANGER, ШАРИКИ: GOLD, УВЕДИ: OK, ОКНО: OK, ДВЕРЬ: OK, ЗАКРОЙ: OK, ВЛАЖНОЙ: OK, САЛФЕТКОЙ: OK, БАНКУ: OK, ВОДОЙ: OK,
  ДВЕНАДЦАТЬ: OK, СДАТЬ: OK, СЕКРЕТ: GOLD, ФОНАРИКА: GOLD, ЗАБЛЕСТЯТ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  drop: A.L0w3,                      // «разбился»
  roll: A.L0w7,                      // «ртуть раскатилась»
  c1: A.L1 - 0.06,                   // «пропылесосить… Нельзя»
  vac: A.L1w3,
  nope: A.L1w5,
  split: A.L1w12,
  c2: A.L2 - 0.06,                   // step 1: the dog out, the window open, the door shut
  out: A.L2w1,
  win: A.L2w7,
  door: A.L2w10,
  c3: A.L3 - 0.06,                   // step 2: the damp towel, the jar
  wipe: A.L3w1,
  intoJar: A.L3w8,
  c4: A.L4 - 0.06,                   // step 3: the lid, 112
  lid: A.L4w2,
  dial: A.L4w5,
  c5: A.L5 - 0.06,                   // the secret: the torch
  torch: A.L5w3,
  glint: A.L5w8,
  c6: A.L6 - 0.06,
  sub: A.L6w9,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.drop, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.dial, c6: T.c5, growl: T.glint, c7: T.c6, end: T.c6 };
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
shot(T.cover, [[T.cover, -20, -80, 1.45], [T.drop, 20, -70, 1.55], [T.c1, 50, -60, 1.7]]);
shot(T.c1, [[T.c1, 0, -90, 1.45], [T.split, 40, -70, 1.7], [T.c2, 50, -70, 1.75]]);
shot(T.c2, [[T.c2, -60, -115, 1.15], [T.c3, -60, -115, 1.18]]);
shot(T.c3, [[T.c3, 60, -60, 1.8], [T.c4, 70, -60, 1.85]]);
shot(T.c4, [[T.c4, 0, -90, 1.5], [T.c5, 0, -90, 1.52]]);
shot(T.c5, [[T.c5, 20, -75, 1.6], [T.c6, 40, -70, 1.7]]);
shot(T.c6, [[T.c6, -60, -110, 1.45], [DUR, -60, -110, 1.5]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.drop + 0.35, 6], [T.nope, 6]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);


// —— the state of the floor ——
const broken = t => t >= T.drop + 0.35;
const goneAt = t => (t < T.wipe ? 0 : t < T.c5 ? 0.8 * seg(T.wipe, T.intoJar, t, x => x) : 0.8);
const splitAt = t => (t >= T.split - 0.1 && t < T.c2 ? seg(T.split - 0.1, T.split + 0.5, t) : 0);
const dogAt = t => ({ x: t < T.out ? -380 : lerp(-380, -560, seg(T.out, T.out + 1.2, t)), gone: t > T.out + 1.2 && t < T.c6 });

export function actorsAt(t) {
  if (t < T.c1) {                                                              // the hook: shaking it down — it slips
    const o = stand(base(t, { look: [0.7, 0.3], brow: broken(t) ? 0.9 : 0.2, pop: broken(t) ? 0.6 : 0, mouth: broken(t) ? 0.4 : 0 }), -120);
    const sh = shoulder(o), shake = t < T.drop ? Math.sin(t * 18) * 30 : 0;
    o.hands = { near: { p: [sh[0] + 70, sh[1] - 40 + shake], shape: 'grip' } };
    const fall = seg(T.drop - 0.05, T.drop + 0.35, t, x => x * x);
    return { h: o, therm: t < T.drop + 0.35 ? { p: [lerp(o.hands.near.p[0] + 10, Mc.SPOT[0], fall), lerp(o.hands.near.p[1] - 30, Mc.SPOT[1] - 20, fall)], a: 0.3 + 2.5 * fall } : null,
      d: { x: -380, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c2) {                                                              // the vacuum cleaner; «Нельзя» — he lets go
    const o = stand(base(t, { look: [0.7, 0.5], brow: 0.5, lean: 0.06 }), -170);
    const sh = shoulder(o), hold = seg(T.vac - 0.3, T.vac, t) * (1 - seg(T.nope, T.nope + 0.4, t));
    o.hands = { near: { p: [sh[0] + 60, sh[1] + 40], shape: 'grip' } };
    if (t > T.nope) { o.brow = 1; o.pop = 0.5; o.lean = -0.05; }
    return { h: o, vac: t > T.vac - 0.3 ? { x: -20, p: hold > 0.01 ? o.hands.near.p : [-20 + 120, -150] } : null, d: { x: -380, y: 0, s: DS, face: 1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 } };
  }
  if (t < T.c3) {                                                              // the dog out, the window, the door
    const o = stand(base(t, { look: [t < T.win ? -0.8 : 0.8, -0.2], brow: 0.4, face: t < T.win - 0.2 ? -1 : 1 }), -120);
    const sh = shoulder(o);
    o.hands = { near: { p: t < T.win ? [sh[0] - 90, sh[1] - 20] : [sh[0] + 100, sh[1] - 60], shape: 'point' } };
    const dg = dogAt(t);
    return { h: o, d: dg.gone ? null : { x: dg.x, y: 0, s: DS, face: -1, sit: 0, walk: t > T.out && t < T.out + 1.2 ? 1 : 0, ph: t * 2.2, look: 0.2, t, blink: dblink(t), ears: 1, wag: 1 } };
  }
  if (t < T.c4) {                                                              // the damp towel; into the jar
    const o = base(t, { look: [0.5, 0.8], brow: 0.3, lean: 0.4 });
    const x = -60; o.hip = [x, -LEG + 120]; o.feet = { near: [x - 52, 0], far: [x + 66, 0] };
    const sh = shoulder(o), sweep = (t - T.wipe) * 2.2, into = seg(T.intoJar - 0.3, T.intoJar, t);
    const hp = t < T.wipe ? [sh[0] + 60, sh[1] + 40] : [lerp(Mc.SPOT[0] - 60 + 120 * (0.5 + 0.5 * Math.sin(sweep)), 200, into), lerp(-30, -120, into)];
    o.hands = { near: { p: hp, shape: 'grip' } };
    o.prop = { kind: 'towel', p: hp, hide: into > 0.95 };
    return { h: o };
  }
  if (t < T.c5) {                                                              // the lid; the phone
    const o = stand(base(t, { look: [0.6, 0.3], brow: 0.3, headTilt: 0.12 }), -150);
    const sh = shoulder(o);
    if (t > T.dial - 0.3) { o.hands = { near: { p: [sh[0] + 30, sh[1] - 60], shape: 'grip' } }; o.prop = { kind: 'phone', p: [sh[0] + 28, sh[1] - 90] }; o.mouth = 0.3 + 0.2 * Math.abs(Math.sin(t * 12)) * (t > A.L4w8 ? 1 : 0); }
    else o.hands = { near: { p: [lerp(sh[0] + 60, 200, seg(T.lid - 0.4, T.lid, t)), lerp(sh[1] + 40, -130, seg(T.lid - 0.4, T.lid, t))], shape: 'grip' } };
    return { h: o };
  }
  if (t < T.c6) {                                                              // the secret: the torch along the floor
    const o = base(t, { look: [0.6, 0.8], brow: 0.2, lean: 0.25 });
    const x = -170; o.hip = [x, -LEG + 50]; o.feet = { near: [x - 30, 0], far: [x + 40, 0] };
    const sh = shoulder(o), on = seg(T.torch - 0.2, T.torch + 0.2, t);
    o.hands = { near: { p: [sh[0] + 80, sh[1] + 30], shape: 'grip' } };
    o.prop = { kind: 'torch', p: o.hands.near.p, a: 0.35 + 0.08 * Math.sin(t * 1.5), on };
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
  if (p?.kind === 'towel' && !p.hide) o.propNear = () => Mc.towel(p.p);
  if (p?.kind === 'torch') o.propNear = () => Mc.torch(p.p, p.a, p.on);
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
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.farRoom(t, { wisps: 0, smoke: 0 });
  const R = Sm.ROOM2;
  // the window open (from step 1 on): the right sash swung in, the cold air
  const wo = t >= T.c2 ? seg(T.win - 0.1, T.win + 0.4, t) : 0;
  if (wo > 0.01) { const Wn = R.win, mx = (Wn.x0 + Wn.x1) / 2; fill(polyPath([[mx + 6, Wn.y0], [mx + 6 + 120 * wo, Wn.y0 + 30 * wo], [mx + 6 + 120 * wo, Wn.y1 - 30 * wo], [mx + 6, Wn.y1]]), 'rgba(200,225,240,0.7)'); Mc.coldAir(t, Wn.x0, Wn.x1, Wn.y0, Wn.y1, wo); }
  // the door shut: a darker leaf over it while open before
  const dOpen = t >= T.c2 && t < T.door ? 1 : t >= T.door ? 1 - seg(T.door, T.door + 0.4, t) : 0;
  if (dOpen > 0.01) { const D = R.door; g.save(); g.globalAlpha = dOpen; rect(D.x0, D.top, D.x1 - D.x0, -D.top, '#3a3530'); g.restore(); }
  // the floor: the thermometer, the beads, the jar
  if (broken(t)) Mc.spill(t, { roll: seg(T.drop + 0.35, T.roll + 0.8, t, x => x), split: splitAt(t), gone: goneAt(t) });
  if (t >= T.c3 && t < T.c6) Mc.jar(200, t < T.c3 + 0.4 ? clamp(sp(t, T.c3, 2.6, 8)) : 1, t >= T.c4 ? seg(T.lid - 0.2, T.lid + 0.2, t) : 0, t > T.intoJar ? 1 : 0);
  if (a.vac) Mc.vacuum(a.vac.x, a.vac.p);
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (a.therm) Mc.thermometer(a.therm.p, a.therm.a, 1);
  // the torch scene: the room dim, the beads glint in the beam
  if (t >= T.c5 && t < T.c6) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.35 * seg(T.c5, T.torch, t); g.fillStyle = '#0b0f1a'; g.fillRect(0, 0, W, H); g.restore();
    view(cam, 1);
    if (a.h?.prop?.kind === 'torch') Mc.torch(a.h.prop.p, a.h.prop.a, a.h.prop.on);
    Mc.glints(t, seg(T.glint - 0.2, T.glint + 0.3, t), 0.8);
  }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «пропылесосить… Нельзя»
  if (t >= T.c1 && t < T.c2) { const b = S2([-20, -60]); Hd.redX(b[0], b[1], 110, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); }
  Hd.plaque(t, A.L1w6 - 0.05, T.c2 - 0.1, 540, 560, { icon: 'x', title: 'НИ ПЫЛЕСОСОМ, НИ ВЕНИКОМ', sub: 'ртуть разлетится на мелкие шарики', color: DANGER, size: 44 });
  // step 1
  Hd.stepHeader(t, 1, 'ОКНО ОТКРОЙ', A.L2 + 0.02, A.L2e - 0.05);
  Hd.plaque(t, A.L2w1 - 0.05, T.win - 0.1, 540, 560, { icon: 'check', title: 'ДЕТЕЙ И ЖИВОТНЫХ — ИЗ КОМНАТЫ', color: OK, size: 38 });
  // step 2
  Hd.stepHeader(t, 2, 'ВЛАЖНАЯ САЛФЕТКА', A.L3 + 0.02, A.L3e - 0.05);
  Hd.plaque(t, T.intoJar - 0.05, T.c4 - 0.1, 540, 560, { icon: 'drop', title: 'В БАНКУ С ВОДОЙ', color: OK, size: 48 });
  // step 3
  Hd.stepHeader(t, 3, 'ЗАКРОЙ · ЗВОНИ 112', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.dial - 0.1 && t < T.c5) dialCard(t, 620, 700);
  Hd.plaque(t, A.L4w10 - 0.05, T.c5 - 0.1, 540, 330, { icon: 'check', title: 'РТУТЬ СДАЮТ СПЕЦИАЛИСТАМ', color: OK, size: 42 });
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 300, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  Hd.plaque(t, T.glint - 0.05, T.c6 - 0.1, 540, 480, { icon: 'torch', title: 'ШАРИКИ БЛЕСТЯТ В ЛУЧЕ', color: GOLD, size: 46 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 700, { icon: 'comment', title: 'ЕСТЬ РТУТНЫЙ ГРАДУСНИК?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
  Hd.endCard(t, T.sub - 0.05, 0, 300);
}
// the hook: «ЧТО ДЕЛАТЬ,» from the first frame, then the question word by word
function questionTitle(t) {
  const k1 = sp(t, 0.02, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w6 - 0.05, 2.4, 7);
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
  plq(440, 'ЕСЛИ РАЗБИЛСЯ ГРАДУСНИК', k2, 72, '#ffd23f');
  plq(560, 'И РТУТЬ НА ПОЛУ?', k3, 80, '#c9d0d8');
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
  const num = '112', t0 = T.dial, n = Math.min(3, Math.floor((t - t0) / 0.15) + 1);
  Hd.label(num.slice(0, Math.max(1, n)), 0, -120, 96, '#ffffff', { shadow: false, stroke: false });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ell(-90 + c * 90, -10 + r * 80, 30, 30, 'rgba(255,255,255,0.12)');
  ell(0, 220, 40, 40, '#2f8f4e');
  g.restore();
}

function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
// —— the cover: the broken thermometer and the beads on the floor; the question and the ban ——
function coverFrame(t) {
  const cam = { x: 70, y: -120, z: 2.2, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Sm.farRoom(3, {});
  Mc.spill(3, { roll: 1 });
  Mc.thermometer([Mc.SPOT[0] + 40, -12], 1.45, 1);
  Mc.glints(3, 0.7, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('РАЗБИЛСЯ ГРАДУСНИК?', 540, 380, 120, 980, '#ffd23f', { rot: -0.03 });
  fitText('НЕ ПЫЛЕСОСЬ!', 540, 530, 130, 960, '#ff5a4a', { rot: -0.03 });
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
  add(T.drop + 0.33, 'stamp', -10, 0.1); add(T.drop + 0.36, 'spark', -14, 0.1);
  for (let i = 0; i < 5; i++) add(T.roll + i * 0.18, 'fill_plink', -16, 0.1 + 0.05 * i);
  add(T.c1, 'whoosh', -12, 0);
  add(T.vac, 'hum_stop', -12, -0.1);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.win, 'squeak_dry', -10, 0.3); add(T.win + 0.2, 'city', -24, 0.3, { dur: A.L2e - T.win });
  add(T.door + 0.2, 'click', -6, -0.3);
  add(T.c3, 'whoosh', -12, 0);
  add(T.intoJar, 'pour', -14, 0.2, { dur: 0.4 });
  add(T.c4, 'whoosh', -12, 0);
  add(T.lid + 0.1, 'click', -8, 0.2);
  for (let i = 0; i < 3; i++) add(T.dial + i * 0.15, 'click', -10, 0.1);
  add(T.c5, 'whoosh_in', -14, 0);
  add(T.torch, 'toggle', -8, 0);
  for (let i = 0; i < 4; i++) add(T.glint + i * 0.2, 'fill_plink', -14, -0.2 + 0.15 * i);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
