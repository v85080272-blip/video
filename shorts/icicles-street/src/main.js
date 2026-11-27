// «Сосульки, ты на улице» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t. The
// owner, 20.11: «сделай ещё мультов, чтоб сегодня выпустить». On the formula of «Облако хлора». Walking along a house,
// a crack overhead: not looking up — it may be snow or a block of ice → don't run from the building, don't stop → press
// against the wall, the eave covers you (the snow lands in front) → ice mounds on the pavement: go round, it fell there
// before → the secret: most icicles hang over the drainpipes → «Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as Ic from './ice.js';
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
const HOT = { ТРЕСК: DANGER, ГОЛОВУ: DANGER, НЕЛЬЗЯ: DANGER, СНЕГ: DANGER, ГЛЫБА: DANGER, ЛЬДА: DANGER, БЕГИ: DANGER,
  ОСТАНАВЛИВАЙСЯ: DANGER, ПРИЖМИСЬ: OK, СТЕНЕ: OK, КОЗЫРЁК: OK, ПРИКРОЕТ: OK, ХОЛМИКИ: GOLD, ОБХОДИ: OK, СЕКРЕТ: GOLD,
  СОСУЛЕК: GOLD, ВОДОСТОКАМИ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  crack: A.L0w9,                     // «раздался треск»
  c1: A.L1 - 0.06,                   // «поднять голову… Нельзя»
  look: A.L1w3,
  nope: A.L1w7,
  c2: A.L2 - 0.06,                   // step 1: not away, not stopping
  stop: A.L2w5,
  c3: A.L3 - 0.06,                   // step 2: to the wall; the snow lands in front
  wall: A.L3w2,
  fall: A.L3w4,
  c4: A.L4 - 0.06,                   // step 3: the ice mounds
  ring: A.L4w4,
  round: A.L4w6,
  c5: A.L5 - 0.06,                   // the secret: the drainpipes
  pipe: A.L5w6,
  no: A.L5w9,
  c6: A.L6 - 0.06,
  sub: A.L6w6,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.crack, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.fall, c6: T.c5, growl: T.pipe, c7: T.c6, end: T.c6 };
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
shot(T.cover, [[T.cover, -40, -500, 0.8], [T.crack, -40, -480, 0.84], [T.c1, -40, -470, 0.85]]);
shot(T.c1, [[T.c1, -20, -420, 0.85], [T.c2, -20, -400, 0.88]]);
shot(T.c2, [[T.c2, 60, -140, 0.9], [T.c3, 60, -140, 0.92]]);
shot(T.c3, [[T.c3, -20, -150, 0.9], [T.c4, -20, -150, 0.92]]);
shot(T.c4, [[T.c4, 200, -130, 0.95], [T.c5, 220, -130, 0.98]]);
shot(T.c5, [[T.c5, -200, -150, 0.9], [T.c6, -200, -150, 0.93]]);
shot(T.c6, [[T.c6, 40, -140, 0.95], [DUR, 40, -140, 0.98]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.crack, 5], [T.nope, 6], [T.fall + 0.6, 10]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: false, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);



const fallAt = t => (t < T.fall - 0.1 ? 0 : t < T.c4 ? seg(T.fall - 0.1, T.fall + 1.0, t, x => x) : 0);
const goneAt = t => (t >= T.fall + 0.2 && t < T.c4 ? 1 : t >= T.c4 ? 1 : 0);

export function actorsAt(t) {
  const walk = t < T.c3 ? Math.abs(Math.sin(t * 5)) * 6 : 0;
  if (t < T.c1) {                                                              // the hook: walking past, a crack overhead
    const o = stand(base(t, { look: [0.8, t > T.crack ? -0.4 : 0], brow: t > T.crack ? 0.9 : 0.2, pop: t > T.crack ? 0.5 : 0 }), 60);
    o.hip[1] -= walk;
    return { h: o };
  }
  if (t < T.c2) {                                                              // looking up; «Нельзя»
    const up = seg(T.look - 0.2, T.look + 0.2, t) * (1 - seg(T.nope, T.nope + 0.3, t));
    const o = stand(base(t, { look: [0.2, -1 * up], headTilt: -0.35 * up, brow: 0.6 }), 60);
    return { h: o };
  }
  if (t < T.c3) {                                                              // walking on, not away from the wall
    const o = stand(base(t, { look: [0.6, 0], brow: 0.4 }), 60);
    o.hip[1] -= walk;
    return { h: o };
  }
  if (t < T.c4) {                                                              // to the wall, under the eave; the snow comes down
    const w = seg(T.wall - 0.2, T.wall + 0.4, t);
    const o = stand(base(t, { face: -1, look: [-0.6, 0], brow: 0.6, lean: -0.05 }), lerp(60, Ic.WALL + 70, w));
    if (t > T.fall + 0.6) { o.face = 1; o.look = [0.8, 0.2]; o.brow = 0.9; o.pop = 0.4; }
    return { h: o };
  }
  if (t < T.c5) {                                                              // round the ice mounds
    const w = seg(T.round - 0.2, T.c5, t, x => x);
    const o = stand(base(t, { look: [0.6, 0.5], brow: 0.3 }), lerp(80, 700, w));
    o.hip[1] -= Math.abs(Math.sin(t * 5)) * 6 * (w > 0 && w < 1 ? 1 : 0);
    return { h: o };
  }
  if (t < T.c6) {                                                              // pointing at the drainpipe
    const o = stand(base(t, { face: -1, look: [-0.5, -0.6], brow: 0.4 }), 40);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] - 90, sh[1] - 90], shape: 'point' } };
    return { h: o };
  }
  const o = stand(base(t, { look: [0.6, 0], brow: 0.5, mouth: 0.3 }), 120);    // the end: thumbs up
  const sh = shoulder(o), k = clamp(sp(t, T.c6 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o };
}
function hunterDraw(t, o) { return drawHunter(o); }

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (t < T.cover) { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  streetFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function streetFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fb8d6'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ic.street(t, { crack: t >= T.crack - 0.1 && t < T.fall + 0.2 ? seg(T.crack - 0.1, T.crack + 0.2, t) : 0, gone: goneAt(t),
    ring: t >= T.c4 && t < T.c5 ? seg(T.ring - 0.1, T.ring + 0.3, t) : 0, pipeMark: t >= T.c5 && t < T.c6 ? seg(T.pipe - 0.1, T.pipe + 0.3, t) : 0 });
  // a few flakes from the cornice while it cracks
  if (t >= T.crack && t < T.fall) for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i / 6) % 1; ell(Ic.EAVE.x1 + 20 + 40 * Math.sin(i * 3 + t), lerp(Ic.EAVE.y, -10, ph), 5, 5, '#ffffff'); }
  if (a.h) hunterDraw(t, a.h);
  Ic.avalanche(t, fallAt(t));
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «поднять голову… Нельзя»
  if (t >= T.c1 && t < T.c2) { const h = actorsAt(t).h; if (h) { const b = S2([h.hip[0], h.hip[1] - 200]); Hd.redX(b[0], b[1], 100, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t))); } }
  Hd.plaque(t, A.L1w8 - 0.05, T.c2 - 0.1, 540, 330, { icon: 'x', title: 'НЕ ЗАДИРАЙ ГОЛОВУ', sub: 'оттуда летят снег и лёд', color: DANGER, size: 48 });
  // step 1: the arrow away from the house crossed out
  Hd.stepHeader(t, 1, 'НЕ БЕГИ ОТ ЗДАНИЯ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) {
    const h = actorsAt(t).h, k = seg(A.L2w1 - 0.1, A.L2w2 + 0.2, t);
    if (h && k > 0.01) { const p0 = S2([h.hip[0] + 60, h.hip[1] - 60]), p1 = S2([h.hip[0] + 460, h.hip[1] - 60]); g.save(); g.globalAlpha = k; g.lineWidth = 16; g.strokeStyle = '#ff5a4a'; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(lerp(p0[0], p1[0], k), p1[1]); g.stroke(); poly([[lerp(p0[0], p1[0], k) + 30, p1[1]], [lerp(p0[0], p1[0], k) - 10, p1[1] - 30], [lerp(p0[0], p1[0], k) - 10, p1[1] + 30]], '#ff5a4a'); g.restore(); Hd.redX((p0[0] + p1[0]) / 2, p0[1], 80, sp(t, A.L2w3, 2.6, 8)); }
  }
  Hd.plaque(t, T.stop - 0.05, T.c3 - 0.1, 540, 560, { icon: 'x', title: 'И НЕ ОСТАНАВЛИВАЙСЯ', color: DANGER, size: 48 });
  // step 2
  Hd.stepHeader(t, 2, 'ПРИЖМИСЬ К СТЕНЕ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) { const b = S2([Ic.WALL + 70, -520]); Hd.tick(b[0], b[1], sp(t, A.L3w9 - 0.05, 2.6, 8), 60); }
  Hd.plaque(t, A.L3w6 - 0.05, T.c4 - 0.1, 540, 560, { icon: 'house', title: 'КОЗЫРЁК КРЫШИ ПРИКРОЕТ', color: OK, size: 44 });
  // step 3
  Hd.stepHeader(t, 3, 'ОБХОДИ ХОЛМИКИ', A.L4 + 0.02, A.L4e - 0.05);
  Hd.plaque(t, A.L4w8 - 0.05, T.c5 - 0.1, 540, 560, { icon: 'x', title: 'СЮДА УЖЕ ПАДАЛО', color: GOLD, size: 48 });
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 200, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  Hd.plaque(t, T.pipe - 0.05, T.c6 - 0.1, 540, 330, { icon: 'x', title: 'НЕ ХОДИ ПОД ВОДОСТОКАМИ', color: DANGER, size: 44 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 700, { icon: 'comment', title: 'ХОДИШЬ ПОД СОСУЛЬКАМИ?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
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
  plq(440, 'ЕСЛИ ИДЁШЬ ВДОЛЬ ЗДАНИЯ', k2, 72, '#ffd23f');
  plq(560, 'И СВЕРХУ ТРЕСК?', k3, 84, '#ff8a3d');
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
// —— the cover: the eave with its cornice and icicles over the pavement; the question and the ban ——
function coverFrame(t) {
  const cam = { x: -60, y: -620, z: 1.0, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fb8d6'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ic.street(3, { crack: 1 });
  const o = stand(base(3, { look: [0.2, -0.9], brow: 1, pop: 1, mouth: 0.6, headTilt: -0.3, s: 0.6 }), 60); drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ТРЕСК НАД ГОЛОВОЙ?', 540, 380, 120, 980, '#ffd23f', { rot: -0.03 });
  fitText('НЕ СМОТРИ ВВЕРХ!', 540, 530, 120, 960, '#ff5a4a', { rot: -0.03 });
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
  add(0.05, 'city_day', -22, 0, { dur: DUR - 0.2 });
  add(T.crack - 0.1, 'squeak_dry', -8, -0.2); add(T.crack + 0.2, 'spark', -18, -0.2);
  add(T.c1, 'whoosh', -12, 0);
  add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(A.L2w3, 'stamp', -10, 0.2);
  add(T.c3, 'whoosh', -12, 0);
  add(T.wall, 'whoosh_in', -14, -0.2);
  add(T.fall, 'whoosh_down', -8, 0); add(T.fall + 0.6, 'puff', -6, 0); add(T.fall + 0.62, 'stamp', -10, 0);
  add(T.c4, 'whoosh', -12, 0);
  add(T.ring, 'blip', -10, 0.2);
  add(T.c5, 'whoosh_in', -14, 0);
  add(T.pipe, 'blip', -8, -0.2); add(T.no, 'stamp', -10, -0.2);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
