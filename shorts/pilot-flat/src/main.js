// «Мёртвые восстали, а ты пилот»: the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py): another take moves the picture with it (STORYBOARD.md).
// Worlds: the cemetery under the dusk sky with the plane high above (sky.js), the cockpit (cab.js), three blueprints
// (bp.js: the door, the map, the parked plane with its slide) and the airfield with its runway (sky.js again).
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Sk from './sky.js';
import * as Cb from './cab.js';
import * as Bp from './bp.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf, HUN } from './hunter.js';
import { drawDog } from './dog.js';
import { zombie, shamble, reachUp, tray } from './zoms.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without a voice yet: [start, end, words] of each line, words spread evenly
const FB = { L0: [0.12, 5.4, 14], L1: [5.7, 11.0, 14], L2: [11.3, 16.6, 14], L3: [16.9, 19.9, 8], L4: [20.2, 25.5, 14], L5: [25.8, 31.6, 15], L6: [31.9, 36.9, 13], L7: [37.2, 42.4, 13] };
export const DUR = VOICE?.dur ?? 42.8;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words?.filter(w => /[\p{L}\d]/u.test(w.w)), n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok;
const HOT = { ВОССТАЛИ: DANGER, ЗАПРИ: GOLD, БРОНИРОВАННАЯ: GOLD, ЗАКРЫТО: OK, ЭКИПАЖА: DANGER, АЭРОПОРТ: DANGER, МЕРТВЕЦОВ: DANGER, АЭРОДРОМ: OK, ГЛУШИ: OK,
  НИЗКО: GOLD, ТОЛПА: DANGER, КРУГ: GOLD, ОТКРЫВАЙ: DANGER, САМ: DANGER, ЛЕСТНИЦЕЙ: DANGER, МЕТРОВ: OK, ДОСТАТЬ: OK, УЙДУТ: OK, ПОДПИСЫВАЙСЯ: GOLD, СТЮАРДЕССА: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  rise: A.L0w2 - 0.12,               // «восстали»: the dead burst out of the graves
  up: A.L0w3 - 0.05,                 // «а ты пилот в небе»: the camera rises to the plane
  cab: A.L0w8 - 0.12,                // «запри кабину»: the cockpit, the knocking
  flip: A.L0w9 - 0.05,               // «кабину»: his hand flips the lock
  mon: A.L0w10 - 0.08,               // «кто бы ни стучал»: the door camera
  bpd: A.L1 - 0.06,                  // the door as a blueprint
  sw: A.L1w6 - 0.1,                  // «закрыто»: the switch to ЗАКР, the bolts
  code: A.L1w7 - 0.05,               // «и её не откроет даже код экипажа»: the keypad
  deny: A.L1w13 - 0.05,              // «экипажа»: ОТКАЗ
  map: A.L2 - 0.06,                  // step 1: the map
  people: A.L2w7 - 0.05,             // «Где было много людей»
  dead: A.L2w11 - 0.05,              // «теперь много мертвецов»
  bend: A.L3 - 0.05,                 // «Ищи маленький аэродром»
  low: A.L4 - 0.06,                  // step 2: the runway, the low pass
  ga: A.L4w10 - 0.08,                // «уходи на второй круг»
  land: A.L5 - 0.06,                 // step 3: the landing
  td: A.L5w2 - 0.06,                 // «сел»: touchdown
  bpp: A.L5w6 - 0.12,                // «Надувной трап»: the plane as a blueprint
  slide: A.L5w8 - 0.08,              // «раскроется сам»
  climb: A.L5w11 - 0.1,              // «и станет для них лестницей»
  park: A.L6 - 0.06,                 // the parked plane, the dead under the door
  wait: A.L6w9 - 0.06,               // «Жди, пока они уйдут»
  end: A.L7 - 0.06,                  // the cockpit, subscribe
  ask: A.L7w5 - 0.08,                // «А ты бы открыл…»
};
export const CUTS = [T.cover, T.cab, T.map, T.low, T.land, T.park, T.end];
export const SNAPS = [T.mon];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const SCENES = [[0, 'cover'], [T.cover, 'cem'], [T.cab, 'cab'], [T.bpd, 'bpd'], [T.map, 'map'], [T.low, 'low'], [T.land, 'land'], [T.bpp, 'bpp'], [T.park, 'park'], [T.end, 'end']];
const scene = t => { let s = 'cover'; for (const [t0, n] of SCENES) if (t >= t0) s = n; return s; };
const WIPE = 0.5;

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

// the plane high over the cemetery: it crosses left to right
const PL0 = { y: -3000, s: 0.42 };
const plX0 = t => -2300 + 900 * (t - T.cover);
shot(T.cover, [[T.cover, 0, 40, 0.95], [T.rise, 0, 50, 0.98], [T.up, 0, 30, 0.97], [T.up + 1.0, plX0(T.up + 1.0) + 120, PL0.y + 300, 0.55], [T.cab, plX0(T.cab) + 260, PL0.y + 260, 0.6]]);
// the cockpit: wide on the knock, in on the lock switch, then the door camera
shot(T.cab, [[T.cab, -90, -430, 1.0], [T.flip - 0.1, -60, -420, 1.05], [T.mon, 60, -440, 1.12], [T.mon + 0.05, Cb.MON.x + 75, Cb.MON.y + 120, 2.6], [T.bpd, Cb.MON.x + 75, Cb.MON.y + 110, 2.85]]);
// the door blueprint: the door, down to the switch, across to the keypad
shot(T.bpd, [[T.bpd, -100, -620, 0.62], [T.sw - 0.3, 0, -450, 0.85], [T.sw + 0.2, 0, -220, 0.95], [T.code, -200, -480, 0.85], [T.code + 0.5, -420, -720, 0.95], [T.map, -430, -730, 1.0]]);
// the map: over the city, then up to the airfield
shot(T.map, [[T.map, 200, 600, 0.36], [T.people, 150, 150, 0.42], [T.dead + 0.4, 220, 20, 0.5], [T.bend, 260, 0, 0.48], [T.bend + 1.2, 900, -900, 0.36], [T.low, 1200, -1300, 0.4]]);
// the runway: the low pass and the go-around
const LOWY = -280;
const lowX = t => 600 + 1400 * (t - T.ga);
const gaK = t => clamp((t - T.ga) / 1.6);
const lowY = t => LOWY - 2000 * Math.pow(gaK(t), 2) - 300 * gaK(t);
const lowAng = t => -0.24 * ease.out(clamp((t - T.ga) / 0.5));
shot(T.low, [[T.low, -2200, -60, 0.55], [T.ga - 0.3, 300, -60, 0.55], [T.ga + 0.8, 1500, -500, 0.5], [T.land, 2600, -1500, 0.42]]);
// the landing: the plane comes down from the left and rolls out
const tdX = 0, stopX = 2600;
const landX = t => (t < T.td ? tdX - 2000 * (T.td - t) : tdX + (stopX - tdX) * (1 - Math.pow(1 - clamp((t - T.td) / 2.6), 2)));
const landY = t => (t < T.td ? -260 * Math.pow((T.td - t) / 1.2, 1.4) * (T.td - t < 1.2 ? 1 : 1) - 0 : 0);
const landAng = t => (t < T.td ? -0.06 * clamp((T.td - t) / 0.8) - 0.03 : -0.03 * Math.exp(-(t - T.td) * 3));
shot(T.land, [[T.land, landX(T.land) + 400, -260, 0.48], [T.td, tdX + 500, -220, 0.5], [T.td + 1.0, landX(T.td + 1.0) + 300, -200, 0.52], [T.bpp, stopX + 700, -200, 0.6]]);
// the plane blueprint: the front door and the slide
const DOORW = [Sk.PLANE.door1[0] * Sk.PLANE.sx, Sk.PLANE.sill];
shot(T.bpp, [[T.bpp, 600, -500, 0.62], [T.slide, 900, -380, 0.8], [T.park, 960, -360, 0.86]]);
// the parked plane, close on the front door; the dead under it
shot(T.park, [[T.park, DOORW[0] + 60, -420, 1.25], [T.wait, DOORW[0] + 90, -430, 1.18], [T.end, DOORW[0] + 120, -480, 1.05]]);
// the end: the cockpit, him and Пурга, the door and its camera
shot(T.end, [[T.end, -40, -440, 1.0], [T.ask, -60, -450, 1.04], [DUR, -80, -460, 1.08]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const t0 of [...KNOCK0, ...KNOCK1, T.td, T.sw]) if (t >= t0 && t < t0 + 0.4) { const e = Math.exp(-(t - t0) * 9); dx += 8 * e * noise(t * 40, 1); dy += 8 * e * noise(t * 37, 2); }
  // the loop: the short ends in the cockpit on the knocking, and starts there too (the poster in the first frames)
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the knocks on the cockpit door: at the cut in, and again under the closing question ——
const KNOCK0 = [T.cab + 0.12, T.cab + 0.34, T.cab + 0.56, T.mon + 0.2, T.mon + 0.42];
const KNOCK1 = [T.ask + 0.05, T.ask + 0.27, T.ask + 0.49];
const sinceKnock = (t, list) => { let b = -1e9; for (const k of list) if (t >= k) b = k; return t - b; };

// —— the cockpit: who sits where and what they do ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const HS = 0.75, DS = 0.62;
function pilot(t, extra = {}) {
  return { s: HS, face: 1, hip: Cb.SEAT.hip, feet: { near: Cb.SEAT.feet, far: [Cb.SEAT.feet[0] + 22, 0] }, lean: -0.03, headTilt: 0.02, pilot: true, headset: true, pack: false,
    brow: 0.1, pop: 0, lid: 0.2, blink: blinkAt(t), look: [-0.6, 0], mouth: 0, ...extra };
}
const shoulder = o => framesOf(o).T.p([-14, -192]);
const YOKEH = (t, roll = 0) => [Cb.YOKE[0] - 6, Cb.YOKE[1] - 40 + 6 * Math.sin(t * 1.3)];
export function cabActors(t) {
  const end = t >= T.end;
  const k = sinceKnock(t, end ? KNOCK1 : KNOCK0), knocked = t >= (end ? KNOCK1[0] : KNOCK0[0]);
  const flinch = knocked ? Math.exp(-k * 5) : 0;
  let o, d, lock = 0.5, light = 0, bolts = 0;
  if (!end) {
    // flying; the knock: he looks back over his shoulder; on «кабину» he leans and flips the switch; then watches the screen
    const back = seg(KNOCK0[0], KNOCK0[0] + 0.25, t), reach = seg(T.flip - 0.35, T.flip, t) * (1 - seg(T.flip + 0.35, T.flip + 0.7, t));
    o = pilot(t, { look: [lerp(-0.6, 1, back * (1 - seg(T.mon - 0.1, T.mon + 0.2, t))), lerp(0, -0.2, back)], brow: lerp(0.1, 0.8, back), pop: 0.5 * back * (1 - reach), mouth: 0.2 * back,
      lean: lerp(-0.03, 0.3, reach), headTilt: lerp(0.02, -0.1, back) });
    if (t > T.mon - 0.1) { o.look = [-0.4, -0.6]; o.brow = 0.6; o.pop = 0.3; }
    const sh = shoulder(o);
    o.hands = { far: { p: YOKEH(t), shape: 'grip' }, near: reach > 0.02 ? { p: [lerp(sh[0] + 60, Cb.LOCKSW[0] - 6, reach), lerp(sh[1] + 120, Cb.LOCKSW[1] - 14, reach)], shape: 'point' } : { p: YOKEH(t), shape: 'grip' } };
    lock = t < T.flip ? 0.5 : lerp(0.5, 1, seg(T.flip, T.flip + 0.12, t));
    light = t > T.flip + 0.12 ? 1 : 0; bolts = seg(T.flip + 0.1, T.flip + 0.25, t, ease.out);
    d = { x: Cb.JUMP.x, y: Cb.JUMP.y, s: DS, face: 1, sit: 1, headset: true, t, blink: flinch > 0.5 ? 1 : dblink(t), look: 0.15, mouth: knocked ? 0 : 0.5, tongue: knocked ? 0 : 0.6, ears: flinch, tilt: -0.1 * flinch };
  } else {
    // the end: he turns to us with a smile and a thumbs up; Пурга wags; the knock again under the question
    const turn = seg(T.end, T.end + 0.3, t), up = clamp(sp(t, T.end + 0.05, 2.4, 7));
    o = pilot(t, { look: [lerp(-0.6, 0.15, turn), 0.1], brow: 0.5, smile: true, headTilt: lerp(0.02, 0.08, turn) });
    if (t > KNOCK1[0]) { o.look = [lerp(0.15, 1, seg(KNOCK1[0], KNOCK1[0] + 0.2, t)), -0.1]; o.brow = 0.9; }
    const sh = shoulder(o);
    o.hands = { far: { p: YOKEH(t), shape: 'grip' }, near: { p: [sh[0] + 110 - 10 * up, sh[1] + 30 - 60 * up], shape: 'bare', bend: -1 } };
    o.thumb = up;
    lock = 1; light = 1; bolts = 1;
    d = { x: Cb.JUMP.x, y: Cb.JUMP.y, s: DS, face: 1, sit: 1, headset: true, t, blink: flinch > 0.5 ? 1 : dblink(t), look: 0.25, mouth: 0.8 * (1 - flinch), tongue: 1 - flinch,
      wag: 1 - flinch, wagPh: t * 2.6, ears: flinch, tilt: -0.12 + 0.1 * flinch };
  }
  return { h: o, d, lock, light, bolts, shake: knocked ? Math.exp(-k * 7) * (k < 0.4 ? 1 : 0) : 0, knockAge: k };
}
// the smile for the end (the episodes give him only an «o» mouth): drawn over his face, the mic back on top
function smile(A2, s) {
  const H2 = A2.H, hs = s * 1.25, arc = [];
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; arc.push([-38 + 25 * Math.cos(a), 13 + 31 * Math.sin(a)]); }
  const m = polyPath(H2.pts([[-63, 14], [-13, 11], ...arc]));
  fill(m, HUN.mouth);
  inside(m, () => { fill(polyPath(H2.pts([[-66, 6], [-10, 4], [-10, 22], [-66, 24]])), '#ffffff'); const tg = H2.p([-36, 44]); ell(tg[0], tg[1], 15 * hs, 10 * hs, HUN.tongue, H2.a(0)); });
  fill(smoothPath(H2.pts([[-74, 10], [-60, 0], [-40, 6], [-22, 2], [-12, 12], [-30, 14], [-50, 10], [-66, 18]])), HUN.beardSh);
  const nz = H2.p([-64, -2]); ell(nz[0], nz[1], 20 * hs, 17 * hs, HUN.nose, H2.a(0));
  if (A2.mic) ell(A2.mic[0], A2.mic[1], 10 * hs, 8 * hs, HUN.mic, H2.a(0));
}
// a chunky thumbs up that reads small (the episodes' 'thumb' hand reads as a raised finger)
function thumbsUp(W2, s, k, tilt = -0.12) {
  const c = Math.cos(tilt), sn = Math.sin(tilt), P = ([x, y]) => [W2[0] + (x * c - y * sn) * s, W2[1] + (x * sn + y * c) * s];
  const fist = smoothPath([[-30, -30], [26, -34], [40, -18], [40, 26], [24, 38], [-28, 36], [-38, 20], [-38, -18]].map(P));
  fill(fist, HUN.skin);
  inside(fist, () => { const d = P([-30, 22]); ell(d[0], d[1], 30 * s, 22 * s, HUN.skinSh, tilt); for (const y of [-12, 4, 20]) limb([P([0, y]), P([38, y + 1])], 5 * s, HUN.skinSh, false); });
  if (k > 0.3) { limb([P([-22, -18]), P([-24, -18 - 60 * clamp((k - 0.3) / 0.4)])], 30 * s, HUN.skin, false); const n = P([-24, -24 - 60 * clamp((k - 0.3) / 0.4)]); ell(n[0], n[1], 9 * s, 7 * s, '#f8d4b6', tilt); }
}
function hunterDraw(o) {
  o = { ...o };
  if (o.smile) o.faceProp = A2 => smile(A2, o.s);
  if (o.thumb != null) { const k = o.thumb; o.propNear = (hf, arm) => thumbsUp([arm.wrist[0] + 14 * o.s, arm.wrist[1] - 26 * o.s], o.s * 1.05, k); }
  return drawHunter(o);
}
// the stewardess on the door camera: head and shoulders, the tray, knocking with her free hand
function stewCam(t, knockAge, withTray) {
  return M => {
    const k = M.h / 250; g.save(); g.translate(M.x + M.w * 0.42, M.y + M.h * 0.5 + 536 * k); g.scale(k, k);
    const hit = knockAge < 0.5 ? Math.exp(-knockAge * 8) : 0;
    const a = zombie({ s: 1, face: 1, hip: [0, -250], feet: { near: [-10, 0], far: [20, 0] }, lean: 0.06, headTilt: 0.1 + 0.08 * Math.sin(t * 1.7), jaw: withTray ? 0.25 : 0.55 + 0.3 * hit, pop: 0.6,
      look: [0.9, 0.1], lid: 0.2, drool: withTray ? 0 : 0.5,
      arms: { near: { aU: Math.PI + 0.6 - 0.9 * hit, aF: Math.PI - 0.2 - 0.6 * hit, aH: Math.PI - 0.6 }, far: withTray ? { aU: Math.PI + 0.9, aF: Math.PI + 0.1, aH: Math.PI } : { aU: Math.PI + 0.3, aF: Math.PI, aH: Math.PI - 0.5 } } }, 'stew');
    if (withTray && a.farHand) tray([a.farHand[0] + 30, a.farHand[1] - 12], 1.6, t);
    g.restore();
  };
}
function cabFrame(t, cam) {
  const a = cabActors(t), end = t >= T.end;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = Cb.CAB.wallSh; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-2000, -2600, 4000, 1600, Cb.CAB.wallSh); rect(-2000, 0, 4000, 1800, Cb.CAB.floor);
  Cb.draw(t, { lock: a.lock, lockLight: a.light, bolts: a.bolts, doorShake: a.shake, view: end ? 'ground' : 'air', cam: stewCam(t, a.knockAge, end) });
  view(cam, 1);
  drawDog(a.d);
  Cb.seatBack();
  Cb.yoke(t, end ? 0 : 0.05 * Math.sin(t * 0.7));
  hunterDraw(a.h);
  Cb.seatFront();
  if (a.shake > 0.05) knockWords(t, a.knockAge, end ? KNOCK1 : KNOCK0, cam);
  // warm light from the windshield, cool from the screens
  g.setTransform(1, 0, 0, 1, 0, 0);
  const wp = toScreen(cam, [700, -600]), gr = g.createRadialGradient(wp[0], wp[1], 50, wp[0], wp[1], 900 * scaleOf(cam));
  gr.addColorStop(0, rgba(end ? '#fff1c8' : '#ffb27a', 0.22)); gr.addColorStop(1, rgba('#ffb27a', 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// «ТУК!» over the door at every knock
function knockWords(t, age, list, cam) {
  if (age > 0.3) return;
  const n = list.findIndex(x => Math.abs(t - age - x) < 1e-6), p = toScreen(cam, [(Cb.DOOR.x0 + Cb.DOOR.x1) / 2 + (n % 2 ? 150 : 60), -440 - 40 * (n % 3)]);
  const k = clamp(spring(age, 2.8, 8)), a = 1 - clamp((age - 0.18) / 0.12);
  g.setTransform(1, 0, 0, 1, 0, 0);
  Hd.label('ТУК!', p[0], p[1] - 50 * age, 92 * (0.8 + 0.3 * k), '#ffd23f', { rot: n % 2 ? 0.15 : -0.12, a, strokeW: 10 });
}

// —— the cemetery and the plane high above ——
function cemFrame(t, cam) {
  Sk.sky(t, cam, { horizon: -150, sun: [700, -420], sunR: 130 });
  Sk.clouds(t, cam, [[0.35, -900, 1.1, Sk.SKY.cloudFar, Sk.SKY.cloudSh, 5]], 30);
  Sk.hills(t, cam, 0.45, -150, Sk.SKY.hillFar, 200, 2);
  Sk.trees(t, cam, 0.6, -120, Sk.SKY.forestFar, 240, 110, 4);
  // the plane
  view(cam, 1);
  Sk.clouds(t, cam, [[0.85, PL0.y + 700, 1.3, Sk.SKY.cloudFar, Sk.SKY.cloudSh, 7]], 60);
  view(cam, 1);
  Sk.drawPlane(t, { x: plX0(t), y: PL0.y, s: PL0.s, gear: 0, t, spin: t * 30, ang: -0.02 });
  Sk.clouds(t, cam, [[1.0, PL0.y + 450, 1.0, null, null, 9]], 120);
  // the ground, the graves and the dead climbing out
  const rise = Sk.GRAVES.map((_, i) => seg(T.rise + i * 0.14, T.rise + i * 0.14 + 0.6, t, ease.out));
  Sk.cemetery(t, cam, rise.map(r => (r > 0 ? 1 : 0)));
  view(cam, 1);
  // the near ground: darker grass, a tilted cross and a stone close to us, a low mist
  for (const [x, y, w, c] of [[-700, 520, 900, '#41662d'], [500, 600, 1100, '#3a5c28']]) fill(smoothPath([[x - w, y + 600], [x - w, y], [x - w * 0.4, y - 60], [x + w * 0.3, y - 40], [x + w, y + 10], [x + w, y + 600]]), c);
  g.save(); g.translate(-460, 560); g.rotate(-0.18); rect(-22, -330, 44, 340, '#2b2a3f'); rect(-110, -260, 220, 40, '#2b2a3f'); g.restore();
  fill(rrPath(380, 380, 220, 300, 100), '#2b2a3f');
  Sk.GRAVES.forEach((x, i) => {
    const k = rise[i]; if (k <= 0) return;
    g.save(); g.beginPath(); g.rect(x - 400, -2000, 800, 2000 + 262); g.clip();
    const ph = (t - T.rise) * 1.2 + i * 0.3;
    const dz = lerp(560, 0, k);
    zombie({ s: 0.85, face: i % 2 ? -1 : 1, hip: [x + 10 * Math.sin(ph * 3), 262 - 215 + dz], feet: { near: [x - 24, 262 + dz], far: [x + 24, 262 + dz] },
      lean: 0.1, jaw: 0.5 + 0.3 * Math.sin(t * 5 + i), pop: 0.4, look: [0, -0.8], arms: reachUp(t, i), hairUp: 0.6 }, ['purple', 'teal', 'grey', 'mustard'][i]);
    g.restore();
  });
}

// —— the airfield: the low pass and the landing ——
function airfield(t, cam, o = {}) {
  Sk.sky(t, cam, { horizon: -200, sun: o.sun ?? [-900, -380], sunR: 120 });
  Sk.clouds(t, cam, [[0.3, -1400, 1.2, Sk.SKY.cloudFar, Sk.SKY.cloudSh, 3]], 20);
  Sk.hills(t, cam, 0.35, -260, Sk.SKY.hillFar, 220, 6);
  Sk.trees(t, cam, 0.55, -170, Sk.SKY.forestFar, 300, 120, 8);
  Sk.trees(t, cam, 0.8, -70, Sk.SKY.forest, 380, 140, 9);
  Sk.runway(t, cam);
}
const RWZ = [[-1500, 200, 'grey'], [-900, 230, 'teal'], [-400, 170, 'purple'], [150, 240, 'red'], [620, 180, 'mustard'], [1150, 230, 'grey'], [1700, 170, 'purple'], [2300, 220, 'teal']];
function lowFrame(t, cam) {
  airfield(t, cam);
  view(cam, 1);
  // the dead on the runway, shambling about; they look up at the plane as it roars over
  const px = lowX(t);
  RWZ.forEach(([x0, y, look], i) => {
    const x = x0 + 40 * Math.sin(t * 0.6 + i), seen = clamp(1 - Math.abs(px - x) / 2600);
    zombie({ ...shamble(x, y, 0.8, i % 2 ? -1 : 1, t * 0.9 + i * 0.37), look: [0.2, -0.9 * seen], jaw: 0.3 + 0.5 * seen, arms: seen > 0.4 ? reachUp(t, i) : undefined, pop: 0.4 * seen }, look);
  });
  view(cam, 1);
  Sk.drawPlane(t, { x: px, y: lowY(t), s: 1, gear: 1, flaps: 1, t, spin: t * 40, ang: lowAng(t) });
  if (t > T.ga) climbArrow(t, cam, toScreen(cam, [px + 900, lowY(t) - 500]));
}
function climbArrow(t, cam, p) {
  const k = clamp(sp(t, T.ga + 0.1, 2.4, 7));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(p[0], p[1]); g.rotate(0.6); g.scale(k, k); Hd.icon('up', 90, OK); g.restore();
}
function landFrame(t, cam) {
  airfield(t, cam, { sun: [-500, -300] });
  view(cam, 1);
  // a few of the dead far off at the forest edge, on the field
  for (let i = 0; i < 4; i++) zombie({ ...shamble(800 + i * 700 - 60 * (t - T.land), -60, 0.2, -1, t * 0.8 + i * 0.4) }, ['grey', 'teal', 'purple', 'red'][i]);
  const x = landX(t), y = landY(t);
  const pl = Sk.drawPlane(t, { x, y, s: 1, gear: 1, flaps: 1, t, spin: t * (t < T.td + 1 ? 40 : 10), ang: landAng(t) });
  view(cam, 1);
  Sk.tyreSmoke(t, T.td, [[x - 20, 0], [x + 30, 0]], 1);
}

// —— the parked plane, the dead under the door: they reach and cannot get it; then they wander off ——
const PARKZ = [[DOORW[0] - 250, 'purple'], [DOORW[0] - 90, 'stew'], [DOORW[0] + 60, 'teal'], [DOORW[0] + 210, 'red'], [DOORW[0] - 420, 'grey'], [DOORW[0] + 380, 'mustard']];
function parkFrame(t, cam) {
  const morning = seg(T.wait, T.wait + 0.8, t);
  airfield(t, cam, { sun: [-300, lerp(-260, -700, morning)] });
  if (morning > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = rgba('#a8d8ff', 0.35 * morning); g.fillRect(0, 0, W, H); }
  view(cam, 1);
  const pl = Sk.drawPlane(t, { x: 0, y: 0, s: 1, gear: 1, t, spin: 0, lights: 0.6 });
  // the two of them in the cockpit window, peeking out
  peek(t, pl.cockpit);
  view(cam, 1);
  PARKZ.forEach(([x0, look], i) => {
    const leave = seg(T.wait + 0.2 + i * 0.12, T.wait + 2.6 + i * 0.12, t, u => u), dir = i % 2 ? 1 : -1;
    const x = x0 + dir * 1400 * leave;
    const o = leave > 0.01 ? { ...shamble(x, 120 + 30 * (i % 3), 0.3, dir, t * 1.1 + i * 0.3) } : { ...shamble(x0, 120 + 30 * (i % 3), 0.3, i % 2 ? -1 : 1, 0.25 + 0.05 * Math.sin(t * 2 + i)) };
    zombie({ ...o, look: leave > 0.1 ? [-0.5, 0] : [0, -1], jaw: 0.4 + 0.3 * Math.sin(t * 4 + i), arms: leave > 0.1 ? undefined : reachUp(t, i), pop: 0.3 }, look);
  });
  if (t < T.wait + 0.3) heightRuler(t, cam);
}
function peek(t, c) {
  // Пурга's ears and the ushanka, small, in the windscreen
  g.save(); inside(polyPath([[c[0] - 70, c[1] - 30], [c[0] + 55, c[1] - 30], [c[0] + 80, c[1] + 30], [c[0] - 70, c[1] + 30]]), () => {
    ell(c[0] - 20, c[1] + 22, 22, 18, HUN.hat); ell(c[0] - 20, c[1] + 30, 26, 10, HUN.fur);
    poly([[c[0] + 28, c[1] + 32], [c[0] + 34, c[1] + 4], [c[0] + 42, c[1] + 32]], '#8f877c'); poly([[c[0] + 44, c[1] + 32], [c[0] + 52, c[1] + 6], [c[0] + 58, c[1] + 32]], '#8f877c');
  }); g.restore();
}
// the door sill's height: a ruler from the ground to the sill, «> 2 м»
function heightRuler(t, cam) {
  const a = seg(A.L6w1 - 0.1, A.L6w1 + 0.2, t) * (1 - seg(T.wait, T.wait + 0.25, t));
  if (a <= 0.01) return;
  const top = toScreen(cam, [DOORW[0] + 200, Sk.PLANE.sill]), bot = toScreen(cam, [DOORW[0] + 200, 0]);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  const grow = seg(A.L6w1, A.L6w5, t, ease.out), yTop = lerp(bot[1], top[1], grow);
  rect(top[0] - 5, yTop, 10, bot[1] - yTop, '#ffffff');
  rect(top[0] - 30, yTop - 5, 60, 10, '#ffffff'); rect(top[0] - 30, bot[1] - 5, 60, 10, '#ffffff');
  limb([[top[0] - 120, yTop], [top[0] + 30, yTop]], 4, rgba('#ffffff', 0.8), false);
  Hd.label('> 2 м', top[0] + 40, lerp(bot[1], yTop, 0.5) + 20, 64, '#ffffff', { align: 'left', fam: FONTS.black, a: seg(A.L6w4, A.L6w5, t) });
  g.restore();
}

// —— the blueprints ——
const P = Sc.palette('night');
function bpdFrame(t, cam) {
  Sc.backdrop(P, cam); view(cam, 1);
  const n = t < T.code + 0.2 ? 0 : Math.min(4, Math.floor((t - T.code - 0.2) / 0.22) + 1);
  Bp.door(t, P, { bolts: seg(T.sw + 0.1, T.sw + 0.3, t, ease.out), sw: lerp(0.5, 1, seg(T.sw, T.sw + 0.15, t)), keys: n, deny: seg(T.deny, T.deny + 0.1, t) });
}
const mapPlane = t => {
  const u = clamp((t - T.map) / (T.bend - T.map)), p0 = [-300, 1500], p1 = [-120, 950];
  let x = lerp(p0[0], p1[0], u), y = lerp(p0[1], p1[1], u), ang = -Math.PI / 2 + 0.2;
  if (t > T.bend) { const v = seg(T.bend + 0.2, T.low, t, u2 => u2); x = lerp(p1[0], p1[0] + 900, v); y = lerp(p1[1], p1[1] - 300, v); ang = lerp(-Math.PI / 2 + 0.2, -0.3, seg(T.bend, T.bend + 0.6, t)); }
  return [x, y, ang];
};
function mapFrame(t, cam) {
  Sc.backdrop(P, cam); view(cam, 1);
  Bp.map(t, P, { plane: mapPlane(t), route: seg(T.map + 0.2, T.map + 1.0, t), people: seg(T.people, T.people + 0.6, t, u => u), dead: seg(T.dead, T.dead + 1.4, t, u => u), bend: seg(T.bend + 0.2, T.bend + 1.4, t) });
}
function bppFrame(t, cam) {
  Sc.backdrop(P, cam); view(cam, 1);
  Bp.plane(t, P, { door: seg(T.bpp + 0.25, T.bpp + 0.55, t), slide: seg(T.slide, T.slide + 0.6, t), climb: seg(T.climb, T.park - 0.1, t, u => u) });
}
// the wipe: the last world on the left of a glowing scan line, the blueprint on its right
function wipe(t, t0, cam, before, after) {
  before(t, cam);
  const u = seg(t0, t0 + WIPE, t, ease.inOut), sx = lerp(W + 40, -40, u);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.beginPath(); g.rect(sx, 0, W - sx + 10, H); g.clip();
  after(t, cam);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  rect(sx - 3, 0, 6, H, '#bfe4ff'); rect(sx - 18, 0, 36, H, 'rgba(59,142,234,0.25)');
}

// —— frame ——
let inited = false;
export function init() { Hd.initHud(); inited = true; }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'cem') cemFrame(t, cam);
  else if (sc === 'cab' || sc === 'end') cabFrame(t, cam);
  else if (sc === 'bpd') { if (t < T.bpd + WIPE) wipe(t, T.bpd, cam, (tt) => cabFrame(tt, camAt(T.bpd - 1e-3)), bpdFrame); else bpdFrame(t, cam); }
  else if (sc === 'map') mapFrame(t, cam);
  else if (sc === 'low') lowFrame(t, cam);
  else if (sc === 'land') landFrame(t, cam);
  else if (sc === 'bpp') { if (t < T.bpp + WIPE) wipe(t, T.bpp, cam, (tt) => landFrame(tt, camAt(T.bpp - 1e-3)), bppFrame); else bppFrame(t, cam); }
  else if (sc === 'park') parkFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'bpd' || sc === 'map' || sc === 'bpp' ? 0.6 : 1);
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  // L0
  Hd.timeStamp(t, T.cover + 0.15, T.up + 0.6, 'ДЕНЬ 1 — 19:40');
  if (sc === 'cem') Hd.plaque(t, T.up + 0.5, T.cab, 540, 620, { icon: 'plane', title: 'ТЫ ПИЛОТ', sub: 'высота 10 км', color: GOLD, to: S2([plX0(t) + 300, PL0.y - 200]) });
  if (sc === 'cab') {
    Hd.plaque(t, T.flip + 0.1, T.mon, 540, 420, { icon: 'lock', title: 'ЗАПРИ КАБИНУ', sub: 'сразу', color: GOLD, to: S2(Cb.LOCKSW) });
    Hd.ribbon(t, T.mon + 0.12, T.bpd + 0.1, 'КТО БЫ НИ СТУЧАЛ', { y: 420, size: 80 });
  }
  // L1: the door
  if (sc === 'bpd') {
    Hd.plaque(t, A.L1w1, T.sw - 0.2, 540, 360, { icon: 'door', title: 'БРОНИРОВАННАЯ', sub: 'не выбить', color: GOLD });
    Hd.plaque(t, T.sw + 0.2, T.code + 0.3, 540, 360, { icon: 'lock', title: 'ЗАКР', sub: 'засовы в раме', color: OK });
    Hd.plaque(t, T.deny + 0.05, T.map, 540, 360, { icon: 'x', title: 'КОД НЕ ОТКРОЕТ', sub: '5–20 минут', color: DANGER });
  }
  // L2–L3: the map
  Hd.stepHeader(t, 1, 'НЕ В БОЛЬШОЙ АЭРОПОРТ', A.L2 + 0.02, A.L2e - 0.05);
  if (sc === 'map') {
    Hd.plaque(t, T.dead + 0.6, T.bend, 540, 560, { icon: 'x', title: 'ТОЛПЫ МЕРТВЕЦОВ', sub: 'где были люди', color: DANGER, to: S2([Bp.PORT.x, Bp.PORT.y]) });
    if (t > T.dead + 0.8 && t < T.bend + 0.3) { const p = S2([Bp.PORT.x, Bp.PORT.y]); Hd.redX(p[0], p[1], 70, sp(t, T.dead + 0.8, 2.4, 7) * (1 - seg(T.bend, T.bend + 0.3, t))); }
    Hd.plaque(t, A.L3w2, T.low, 540, 360, { icon: 'airfield', title: 'АЭРОДРОМ В ГЛУШИ', sub: 'подальше от городов', color: OK, to: S2([Bp.FIELD.x, Bp.FIELD.y]) });
    if (t > A.L3w4) { const p = S2([Bp.FIELD.x + 200, Bp.FIELD.y - 160]); Hd.tick(p[0], p[1], sp(t, A.L3w4, 2.6, 8), 60); }
  }
  // L4: the low pass
  Hd.stepHeader(t, 2, 'ПРОВЕРЬ ПОЛОСУ', A.L4 + 0.02, A.L4e - 0.05);
  if (sc === 'low') {
    Hd.plaque(t, A.L4w6 - 0.05, T.ga, 540, 1560, { icon: 'x', title: 'НА ПОЛОСЕ ТОЛПА', sub: 'садиться нельзя', color: DANGER });
    Hd.plaque(t, T.ga + 0.05, T.land, 540, 1560, { icon: 'up', title: 'ВТОРОЙ КРУГ', sub: 'газ и вверх', color: GOLD });
  }
  // L5: the landing and the slide
  Hd.stepHeader(t, 3, 'НЕ ОТКРЫВАЙ ДВЕРИ', A.L5 + 0.02, A.L5e - 0.05);
  if (sc === 'land') {
    Hd.timeStamp(t, T.land + 0.05, T.td + 0.4, 'ЗАХОД №2 — ПОЛОСА ПУСТА', { y: 520 });
  }
  if (sc === 'bpp') Hd.plaque(t, T.slide + 0.1, T.park, 540, 560, { icon: 'slide', title: 'ТРАП', sub: 'раскроется сам', color: DANGER, to: S2([900, -200]) });
  // L6: the sill and the wait
  if (sc === 'park') {
    Hd.plaque(t, A.L6w6 - 0.05, T.wait, 540, 560, { icon: 'ruler', title: 'ИМ НЕ ДОСТАТЬ', sub: 'порог выше 2 м', color: OK });
    Hd.timeStamp(t, T.wait + 0.05, T.end, 'ДЕНЬ 2 — 06:10', { y: 520 });
  }
  // L7: subscribe, then the question
  Hd.endCard(t, A.L7 - 0.05, seg(T.ask - 0.15, T.ask + 0.05, t), 300);
  Hd.plaque(t, T.ask, DUR + 1, 540, 380, { icon: 'comment', title: 'А ТЫ БЫ ОТКРЫЛ?', sub: 'пиши в комментариях', color: GOLD, size: 52 });
}

// —— the poster in the first frames: the knock, him looking back, the stewardess on the screen, the words over them ——
function coverFrame(t) {
  const cam = { x: -150, y: -330, z: 1.3, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = Cb.CAB.wallSh; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(-2000, -2600, 4000, 1600, Cb.CAB.wallSh); rect(-2000, 0, 4000, 1800, Cb.CAB.floor);
  Cb.draw(0.5, { lock: 0.5, doorShake: 0.6, cam: stewCam(0.5, 0.05, false) });
  drawDog({ x: Cb.JUMP.x, y: Cb.JUMP.y, s: DS, face: 1, sit: 1, headset: true, t: 0, blink: 0, look: 0.1, ears: 1, tilt: -0.1 });
  Cb.seatBack(); Cb.yoke(0, 0);
  const o = pilot(0, { look: [1, -0.2], brow: 0.9, pop: 0.9, mouth: 0.55, headTilt: -0.12, blink: 0 });
  const sh = shoulder(o); o.hands = { far: { p: YOKEH(0), shape: 'grip' }, near: { p: [sh[0] + 90, sh[1] - 30], shape: 'open' } };
  hunterDraw(o); Cb.seatFront();
  for (const [x, y, r] of [[-470, -440, -0.15], [-400, -575, 0.12]]) { const p = toScreen(cam, [x, y]); g.setTransform(1, 0, 0, 1, 0, 0); Hd.label('ТУК!', p[0], p[1], 96, '#ffd23f', { rot: r, strokeW: 10 }); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 190); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('МЁРТВЫЕ ВОССТАЛИ,', 0, 160, 80, '#ffffff', { align: 'right', strokeW: 9 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('А ТЫ ПИЛОТ!', 0, 320, 136, '#ff3b30', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'КТО-ТО СТУЧИТ В КАБИНУ', pw = measure(pl, 50, FONTS.cond) + 60;
  rect(-pw + 8, 390 + 8, pw, 86, INK); rect(-pw, 390, pw, 86, '#ffd43b'); text(pl, -pw / 2, 450, 50, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), sc = scene(tt), out = [toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400])];
    if (sc === 'cem') out.push(toScreen(cam, [plX0(tt), PL0.y]));
    if (sc === 'low') out.push(toScreen(cam, [lowX(tt), lowY(tt)]), toScreen(cam, [lowX(tt) + 1000, lowY(tt)]));
    if (sc === 'land') out.push(toScreen(cam, [landX(tt), landY(tt)]));
    if (sc === 'cab' || sc === 'end') { const a = cabActors(tt); out.push(toScreen(cam, a.h.hands.near.p)); }
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
  add(0.3, 'wind', -20, 0, { dur: T.cab - 0.3 });
  add(0.3, 'crickets', -22, 0.2, { dur: T.up - 0.3 });
  for (let i = 0; i < 4; i++) add(T.rise + i * 0.14, 'dirt', -10, -0.5 + 0.33 * i);
  add(T.rise + 0.2, 'groan', -12, 0.2);
  add(T.up, 'whoosh_up', -12, 0);
  add(T.up + 0.3, 'jet_far', -16, 0.2, { dur: T.cab - T.up });
  add(T.cab, 'cockpit', -20, 0, { dur: T.bpd - T.cab + 0.3 });
  for (const k of KNOCK0) add(k, 'knock', -6, -0.4);
  add(T.flip, 'switch', -8, 0.3);
  add(T.flip + 0.12, 'bolt', -8, -0.3);
  add(T.flip + 0.15, 'blip', -10, 0.2);
  add(T.mon + 0.02, 'static', -14, 0.2, { dur: 0.6 });
  add(T.mon + 0.12, 'ribbon', -8, 0);
  add(T.mon + 0.3, 'groan', -14, 0.3);
  add(T.bpd, 'scan', -10, 0, { dur: WIPE });
  add(A.L1w1, 'blip', -10, -0.2);
  add(T.sw, 'switch', -6, 0);
  add(T.sw + 0.1, 'bolt', -6, 0.2);
  add(T.sw + 0.2, 'blip', -10, 0.2);
  for (let i = 0; i < 4; i++) add(T.code + 0.2 + i * 0.22, 'beep', -14, -0.3);
  add(T.deny, 'deny', -8, -0.2);
  add(T.map, 'whoosh', -12, 0);
  add(T.people, 'swell', -16, 0, { dur: T.dead - T.people + 0.5 });
  add(T.dead, 'dead_swarm', -14, 0.1, { dur: T.bend - T.dead });
  add(T.dead + 0.8, 'stamp', -6, 0.1);
  add(T.bend + 0.2, 'route', -12, 0.2, { dur: 1.2 });
  add(A.L3w4, 'ding', -10, 0.2);
  add(T.low, 'amb_field', -20, 0, { dur: T.bpp - T.low + 0.3 });
  add(T.low + 0.1, 'jet_pass', -10, 0, { dur: T.land - T.low, peak: T.ga - 0.3 - T.low });
  add(A.L4w6 - 0.05, 'stamp', -8, -0.2);
  add(T.ga, 'spool', -8, 0.2);
  add(T.land, 'jet_land', -14, -0.2, { dur: T.td - T.land + 0.5 });
  add(T.td, 'touchdown', -6, 0);
  add(T.td + 0.05, 'rollout', -12, 0, { dur: 2.6 });
  add(T.bpp, 'scan', -10, 0, { dur: WIPE });
  add(T.bpp + 0.25, 'door_open', -10, 0.2);
  add(T.slide, 'slide', -8, 0.2);
  add(T.climb, 'groan', -12, 0.2);
  add(T.climb + 0.3, 'steps', -14, 0.2, { dur: T.park - T.climb - 0.3 });
  add(T.park, 'amb_field', -20, 0, { dur: T.end - T.park });
  add(T.park + 0.1, 'groan_crowd', -16, 0, { dur: T.wait - T.park + 0.6 });
  add(A.L6w1, 'blip', -10, 0.3);
  add(A.L6w6 - 0.05, 'ding', -10, 0.2);
  add(T.wait, 'birds', -20, 0.2, { dur: T.end - T.wait });
  add(T.wait + 0.05, 'blip', -10, -0.3);
  add(T.end, 'cockpit', -20, 0, { dur: DUR - T.end });
  for (const t0 of [A.L2, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  for (const k of KNOCK1) add(k, 'knock', -8, -0.4);
  add(T.ask, 'blip', -8, 0);
    return c.sort((a, b) => a.t - b.t);
}
