// «Застрял в лифте» (блэкаут, ч.3): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// Same hunter, dog, HUD and blueprint as parts 1–2 (../blackout-week); new here: the lift cab (doors, floor display,
// control panel with the call bell, vent slots), the shaft in section with the cab stuck between floors, the phone in
// power-saving mode, the lift mechanic at the opened doors and the chicken bag the dog has emptied.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, MONO } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Sc from './scheme.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 5.0, 15], L1: [5.41, 10.99, 14], L2: [11.39, 16.97, 14], L3: [17.42, 21.5, 11], L4: [21.9, 27.52, 15], L5: [27.93, 33.33, 14], L6: [33.77, 38.7, 17], L7: [39.15, 42.77, 11] };
export const DUR = VOICE?.dur ?? 43.12;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ДВАДЦАТЫЙ: GOLD, ГАСНЕТ: DANGER, ВСТАЛА: DANGER, РАЗДВИНУТЬ: DANGER, НЕЛЬЗЯ: DANGER, ШАХТА: DANGER, ВОЗДУХА: OK,
  ХВАТИТ: OK, ВЕНТИЛЯЦИИ: OK, ДИСПЕТЧЕРА: GOLD, ПОДЪЕЗДЕ: GOLD, ОТОЙДИ: GOLD, ОТКРЫТЬ: DANGER, ЛИФТЁР: GOLD, СПАСАТЕЛИ: GOLD,
  ЗАРЯД: GOLD, РОДНЫМ: GOLD, ДОЛГО: GOLD, ЦЕЛ: OK, КУРИЦУ: GOLD, ПОДПИСЫВАЙСЯ: GOLD, ПОЛЕЗ: DANGER };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the first frames
  floor: A.L0w4 - 0.05,              // «двадцатый»: the display ticks to 19
  out: A.L0w9 - 0.03,                // «гаснет»: the light goes out
  jolt: A.L0w12 - 0.04,              // «встала»: the cab jerks to a stop
  c1: A.L1 - 0.06,                   // «Первое желание…»: the shaft in section, the cab between the floors
  pry: A.L1w3 - 0.05,                // «раздвинуть двери»: the cab doors part
  no: A.L1w7 - 0.05,                 // «Нельзя»: the cross
  gap: A.L1w12 - 0.08,               // «открытая шахта»: the gap under the landing glows red
  c2: A.L2 - 0.06,                   // «Хорошая новость»: back in the dark cab, the air through the slots
  c3: A.L3 - 0.06,                   // step 1: the panel, the bell
  bell: A.L3w2 - 0.05,               // «кнопку»: the press
  disp: A.L3w5,                      // «и скажи»: the dispatcher answers
  c4: A.L4 - 0.06,                   // step 2: he sits down by the back wall, the dog lies next to him
  c5: A.L5 - 0.06,                   // step 3: the phone
  save: A.L5w1 - 0.05,               // «береги заряд»: power saving on
  chat: A.L5w4 - 0.08,               // «Напиши родным»: the message
  c6: A.L6 - 0.06,                   // an hour later: the doors open, the mechanic with a torch
  open: A.L6w2 - 0.05,               // «двери открыл»
  dog: A.L6w7 - 0.06,                // «а Пурга»: down to the dog, the empty bag
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6, T.dog, T.c7];
export const SNAPS = [T.out];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c1 ? 'cab' : t < T.c2 ? 'shaft' : 'cab');
const lightOn = t => (t < T.out ? 1 : 0);                       // the cab light: on until «гаснет», then off for good
const doorK = t => (t < T.c6 ? 0 : seg(T.open, T.open + 0.9, t));

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

// the cab (world units, its floor at y = 0): walls, doors in the middle of the far wall, the display above them, the panel
const CAB = { x0: -440, x1: 440, ceil: -820 };
const DOORS = { x0: -190, x1: 190, top: -640 };
const IND = [0, -722];
const PANEL = { x0: 262, x1: 382, y0: -560, y1: -230 };
const BELL = [322, -282];
const SPEAKER = [322, -520];
// the shaft in section (blueprint units): floors 18–21, the cab stuck between 19 and 20
const SH = { x0: -230, x1: 230, fh: 430 };
const shY = f => -(f - 19) * SH.fh;                            // the slab of floor f (floor 19 at y = 0)
const CABY = shY(19) - SH.fh * 0.55;                           // the cab floor: a little more than half a floor above 19

shot(T.cover, [[T.cover, 0, -470, 1.08], [T.floor, 0, -500, 1.16], [T.out, 0, -480, 1.2], [T.c1, -40, -420, 1.3]]);
shot(T.c1, [[T.c1, 100, CABY - 60, 1.15], [T.no, 110, CABY + 40, 1.2], [T.gap, 130, CABY + 220, 1.12], [T.c2, 130, CABY + 280, 1.1]]);
shot(T.c2, [[T.c2, 0, -430, 1.15], [A.L2w8, 0, -440, 1.2], [T.c3, 10, -440, 1.24]]);
shot(T.c3, [[T.c3, 230, -330, 1.75], [T.disp, 255, -340, 1.88], [T.c4, 265, -340, 1.92]]);
shot(T.c4, [[T.c4, -40, -300, 1.2], [A.L4w9, -60, -280, 1.3], [T.c5, -80, -270, 1.36]]);
shot(T.c5, [[T.c5, -140, -150, 1.45], [T.c6, -150, -145, 1.5]]);
shot(T.c6, [[T.c6, 0, -440, 1.12], [T.open + 1.0, 0, -450, 1.18], [T.dog, 0, -455, 1.2]]);
shot(T.dog, [[T.dog, -260, -60, 2.0], [A.L6e, -275, -60, 2.12], [T.c7, -280, -62, 2.16]]);
shot(T.c7, [[T.c7, 0, -430, 1.1], [DUR, 0, -440, 1.16]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.out, 6], [T.jolt, 22], [T.no, 8], [T.bell, 6], [T.open, 8]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * 1.4 * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog: who stands where in each shot and what they do ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// on his way home: the jacket and the boots on, no backpack
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
// sitting on the floor against the back wall, knees up, feet in front of him
function sitDown(o, x) { const k = (o.s ?? S) / S; o.hip = [x, -30 * k]; o.feet = { near: [x + 118 * k, 0], far: [x + 140 * k, 0] }; o.lean = -0.08; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const talk = (t, a, b) => (t > a && t < b ? 0.3 + 0.25 * Math.abs(Math.sin(t * 13)) : 0);
const BAG_FLOOR = [-170, 0];                                   // where the chicken bag sits once he puts it down

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'cab') return { h: null, d: null };
  // —— the ride home: standing with the shopping bag; the light goes out, the jolt ——
  if (t < T.c2) {
    const o = stand(base(t, { look: [0.1, -0.9], brow: 0.1 }), -220);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 34, sh[1] + 128], shape: 'grip' } };
    o.prop = { kind: 'bag', p: o.hands.near.p, full: 1 };
    if (t > T.out) { o.look = [0.4, -0.4]; o.brow = 0.6; o.pop = clamp(sp(t, T.out, 2.4, 7)) * (1 - seg(T.out + 0.7, T.out + 1.2, t)); }
    if (t > T.jolt) { const k = clamp(sp(t, T.jolt, 2.6, 6)); o.pop = Math.max(o.pop, k * (1 - seg(T.jolt + 0.5, T.jolt + 1.1, t))); o.brow = 0.9; o.mouth = 0.35 * k; o.lean = 0.04 - 0.1 * bump(seg(T.jolt, T.jolt + 0.4, t, u => u)); }
    const d = { x: -380, y: 0, s: DS, face: 1, sit: 1, torch: t > T.out + 0.4, look: t > T.out ? 0.35 : 0.3, t, blink: dblink(t), ears: t > T.out ? 1 : 0.4, wag: t < T.out ? 0.6 : 0, wagPh: t * 3 };
    if (t > T.jolt) d.y = -14 * bump(seg(T.jolt, T.jolt + 0.3, t, u => u));
    return { h: o, d };
  }
  // —— the air: he breathes out, calmer ——
  if (t < T.c3) {
    const o = stand(base(t, { look: [0.3, -0.8], brow: 0.3 }), -220);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 34, sh[1] + 128], shape: 'grip' } };
    o.prop = { kind: 'bag', p: o.hands.near.p, full: 1 };
    if (t > A.L2w2) { o.look = [0.5, 0.2]; o.brow = -0.2; o.mouth = 0.1; o.lid = 0.45; }
    const d = { x: -380, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.55 + 0.1 * Math.sin(t * 1.3), t, blink: dblink(t), ears: 0.8 };
    return { h: o, d };
  }
  // —— step 1, the panel: his finger on the bell, then he talks to the speaker ——
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.6, 0.1], brow: 0.3, lean: 0.08 }), 150);
    const sh = shoulder(o), push = seg(T.bell - 0.35, T.bell, t) * (1 - seg(T.bell + 0.25, T.bell + 0.6, t));
    o.hands = { near: { p: [lerp(sh[0] + 60, BELL[0] - 22, push), lerp(sh[1] + 70, BELL[1], push)], shape: 'point', ang: -0.1 }, far: { p: [sh[0] - 6, sh[1] + 120], shape: 'grip' } };
    o.prop = { kind: 'bagFar', p: o.hands.far.p, full: 1 };
    if (t > T.disp - 0.1) { o.look = [0.7, -0.6]; o.headTilt = -0.1; o.mouth = talk(t, A.L3w6, A.L3e + 0.2); o.brow = 0.5; }
    const d = { x: -10, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.6, t, blink: dblink(t), ears: t > T.disp ? 1 : 0.5 };
    return { h: o, d };
  }
  // —— steps 2 and 3: sitting by the back wall, the bag on the floor, the dog lying next to him ——
  if (t < T.c6) {
    const o = sitDown(base(t, { look: [0.6, 0.2], brow: 0.2 }), -330);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 90, sh[1] + 90], shape: 'fist' }, far: { p: [sh[0] + 70, sh[1] + 110], shape: 'fist' } };
    if (t > T.c5) {                                            // the phone in both hands
      o.hands = { near: { p: [sh[0] + 92, sh[1] + 40], shape: 'grip' }, far: { p: [sh[0] + 80, sh[1] + 54], shape: 'point' } };
      o.prop = { kind: 'phone', p: [sh[0] + 96, sh[1] + 16], ang: 0.35 };
      o.look = [0.7, 0.6]; o.headTilt = 0.18;
    }
    const d = { x: -110, y: 0, s: DS, face: 1, sit: 1, torch: true, look: 0.25 + 0.05 * Math.sin(t * 1.1), t, blink: dblink(t), ears: 0.3, tilt: 0.04 * Math.sin(t * 1.7) };
    return { h: o, d, bag: 'floor' };
  }
  // —— an hour later: the doors open; he stands up, safe; the dog by the torn bag ——
  const o = stand(base(t, { look: [0.6, 0], brow: 0.4 }), -250);
  if (t > T.open + 0.3) { const k = clamp(sp(t, T.open + 0.3, 2.4, 7)); o.mouth = 0.3 * k; o.brow = 0.6; o.lid = 0.15; }
  if (t > T.dog) { o.face = -1; o.look = [-0.6, 0.7]; o.brow = 0.9; o.pop = clamp(sp(t, A.L6w12 - 0.1, 2.4, 7)); o.mouth = 0.45; }
  if (t > T.c7) {                                              // «Подписывайся»: a thumbs up to us
    o.face = 1; o.pop = 0; o.look = [0.8, 0]; o.brow = 0.6; o.mouth = 0.35;
    const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
    o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  }
  const full = t > T.dog;
  const d = { x: -330, y: 0, s: DS, face: full ? -1 : 1, sit: 1, torch: false, look: full ? 0.1 : 0.4, mouth: full ? 0.7 : 0.4, tongue: full ? 0.9 : 0.5, wag: 1, wagPh: t * 3.2, t, blink: dblink(t), ears: 0.9 };
  return { h: o, d, bag: 'torn', bone: full };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(p.ang ?? 0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, t < T.chat ? '#7a8a6a' : '#9fd8ff'); g.restore(); };
  if (p?.kind === 'bagFar') o.propFar = () => shopBag(p.p[0], p.p[1], t, p.full, 0.8);
  if (p?.kind === 'bag') o.propNear = () => shopBag(p.p[0], p.p[1], t, p.full);
  return drawHunter(o);
}

// —— the cab ——
const CC = { wall: '#a9a294', wallSh: '#8f897c', panel: '#c9c3b5', steel: '#b9c0c8', steelSh: '#8d96a1', seam: '#5d6570', floor: '#3a3d46', floorHi: '#4a4e58', frame: '#6c727c', rail: '#d7dde3', shaft: '#07090f' };
function cabShell(t, cam) {
  const { x0, x1, ceil } = CAB;
  // the shaft around the cab: black, a cable and a rail glimpsed past the walls
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = CC.shaft; g.fillRect(0, 0, W, H);
  view(cam, 1);
  rect(x0 - 600, -1400, 160, 1700, '#0e121c'); rect(x1 + 440, -1400, 160, 1700, '#0e121c');
  // the far wall and the side panels
  rect(x0, ceil, x1 - x0, -ceil, CC.wall);
  for (let i = 0; i < 6; i++) { const x = x0 + i * (x1 - x0) / 6; rect(x, ceil + 60, 4, -ceil - 120, 'rgba(0,0,0,0.08)'); }
  rect(x0, -330, DOORS.x0 - 40 - x0, 18, CC.rail); rect(x0, -312, DOORS.x0 - 40 - x0, 6, 'rgba(0,0,0,0.15)');
  // the ceiling with its light panel and the vent slots
  rect(x0, ceil, x1 - x0, 60, '#7c776c');
  const lit = lightOn(t);
  rrect(-220, ceil + 14, 440, 30, 8, lit ? '#fff6dc' : '#4d4c48');
  if (lit) ell(0, ceil + 40, 520, 120, 'rgba(255,240,200,0.18)');
  for (let i = 0; i < 9; i++) { rrect(x0 + 40 + i * 30, ceil + 20, 16, 24, 4, '#24262c'); rrect(x1 - 300 + i * 30, ceil + 20, 16, 24, 4, '#24262c'); }
  // the kick plate along the floor with its slots
  rect(x0, -60, x1 - x0, 60, CC.wallSh);
  for (let i = 0; i < 26; i++) rrect(x0 + 24 + i * 32, -44, 16, 26, 4, '#24262c');
  // the doors: two steel leaves in a frame, parting from the middle
  rect(DOORS.x0 - 26, DOORS.top - 26, DOORS.x1 - DOORS.x0 + 52, -DOORS.top + 26, CC.frame);
  const k = doorK(t), half = (DOORS.x1 - DOORS.x0) / 2, gap = k * half * 0.96;
  if (k > 0.001) landing(t, k);
  for (const s of [-1, 1]) {
    const xa = s < 0 ? DOORS.x0 : gap, xb = s < 0 ? -gap : DOORS.x1;
    if (xb - xa < 1) continue;
    rect(xa, DOORS.top, xb - xa, -DOORS.top, CC.steel);
    rect(s < 0 ? xb - 8 : xa, DOORS.top, 8, -DOORS.top, CC.steelSh);
    for (let j = 0; j < 3; j++) rect(xa + 10, DOORS.top + 60 + j * 200, xb - xa - 20, 3, 'rgba(255,255,255,0.25)');
  }
  rect(DOORS.x0 - 26, -14, DOORS.x1 - DOORS.x0 + 52, 14, '#9aa1a9');      // the sill
  // the floor display above the doors: an arrow and the floor number; blank once the power is gone
  rrect(IND[0] - 90, IND[1] - 40, 180, 80, 10, '#15181f');
  if (lit) {
    const n = Math.round(lerp(16, 19, seg(A.L0, T.floor + 0.05, t, u => u)));
    Hd.label(String(n), IND[0] + 26, IND[1] + 22, 60, '#ff8a3d', { fam: FONTS.mono, shadow: false, stroke: false });
    poly([[IND[0] - 60, IND[1] + 16], [IND[0] - 40, IND[1] - 16], [IND[0] - 20, IND[1] + 16]], '#ff8a3d');
  }
  // the control panel: two columns of floor buttons, the call bell at the bottom, the speaker grille at the top
  rrect(PANEL.x0, PANEL.y0, PANEL.x1 - PANEL.x0, PANEL.y1 - PANEL.y0, 10, CC.panel);
  rrect(PANEL.x0 + 4, PANEL.y0 + 4, PANEL.x1 - PANEL.x0 - 8, PANEL.y1 - PANEL.y0 - 8, 8, 'rgba(0,0,0,0.05)');
  for (let i = 0; i < 4; i++) rrect(SPEAKER[0] - 34, SPEAKER[1] - 18 + i * 10, 68, 4, 2, '#5d6570');
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) { const x = PANEL.x0 + 32 + c * 56, y = PANEL.y0 + 84 + r * 30; ell(x, y, 11, 11, '#e9e5dc'); ell(x, y, 8, 8, '#cfc9bc'); }
  const press = t > T.c3 && t < T.c4 ? bump(seg(T.bell - 0.1, T.bell + 0.35, t, u => u)) : 0, glow = t > T.bell && t < T.c4;
  ell(BELL[0], BELL[1], 26, 26, '#3a3f4a'); ell(BELL[0], BELL[1] + 2 * press, 21, 21, glow ? '#ffd23f' : '#d9a520');
  bellGlyph(BELL[0], BELL[1] + 2 * press, glow ? '#5a3c00' : '#3a2a08');
  if (glow) ell(BELL[0], BELL[1], 48, 48, 'rgba(255,210,63,0.18)');
  // the floor
  rect(x0, 0, x1 - x0, 80, CC.floor); rect(x0, 0, x1 - x0, 6, CC.floorHi);
  // the side walls' edges in front: the cab is a box we look into
  rect(x0 - 40, ceil - 40, 40, -ceil + 120, '#3a3e48'); rect(x1, ceil - 40, 40, -ceil + 120, '#3a3e48');
  rect(x0 - 40, ceil - 40, x1 - x0 + 80, 40, '#3a3e48');
}
function bellGlyph(x, y, c) {
  fill(smoothPath([[x - 11, y + 7], [x - 9, y - 4], [x - 5, y - 11], [x + 5, y - 11], [x + 9, y - 4], [x + 11, y + 7]]), c);
  rect(x - 13, y + 6, 26, 4, c); ell(x, y + 13, 3, 3, c);
}
// the landing behind the opened doors: a lit hallway, the mechanic in it with a torch (a dark figure against the light)
function landing(t, k) {
  const half = (DOORS.x1 - DOORS.x0) / 2, gap = k * half * 0.96;
  g.save(); g.beginPath(); g.rect(-gap, DOORS.top, 2 * gap, -DOORS.top); g.clip();
  rect(-half, DOORS.top, 2 * half, -DOORS.top, '#f4dfae');
  rect(-half, -120, 2 * half, 120, '#d9c08a');
  rect(-half, DOORS.top + 40, 2 * half, 30, 'rgba(255,255,255,0.4)');
  MONO.on = true; MONO.color = '#2a2433';
  const o = stand({ s: 0.62, face: -1, lean: 0.03, look: [-0.7, 0.1], hat: true, jacket: true, boots: true, pack: false, blink: 0 }, 40, 0);
  const sh = framesOf(o).T.p([-14, -192]);
  o.hands = { near: { p: [sh[0] - 70, sh[1] + 40], shape: 'grip' } };
  drawHunter(o);
  MONO.on = false;
  limb([[sh[0] - 64, sh[1] + 36], [sh[0] - 110, sh[1] + 44]], 16, '#2a2433', false);      // his torch
  g.restore();
}
// the shopping bag with the chicken: (x, y) = the handles in his hand; full 1 or torn open on the floor
function shopBag(x, y, t, full = 1, s = 0.85) {
  g.save(); g.translate(x, y); g.scale(s, s); g.translate(-x, -y);
  const sw = 2 * Math.sin(t * 2.2);
  limb([[x - 16, y + 6], [x - 26, y + 40]], 5, '#e9edf2', false); limb([[x + 16, y + 6], [x + 26, y + 40]], 5, '#e9edf2', false);
  fill(smoothPath([[x - 40, y + 38], [x + 40, y + 38], [x + 52 + sw, y + 120], [x + 40 + sw, y + 170], [x - 40 + sw, y + 170], [x - 52 + sw, y + 120]]), 'rgba(236,240,245,0.92)');
  ell(x + 16 + sw, y + 56, 26, 16, '#e9b98a', 0.4); ell(x + 34 + sw, y + 48, 8, 8, '#fff3e6');            // the drumstick at the top
  fill(smoothPath([[x - 30 + sw, y + 120], [x + 30 + sw, y + 120], [x + 24 + sw, y + 150], [x - 24 + sw, y + 150]]), '#d9433b', 0.85);   // the shop's red stripe
  g.restore();
}
// on the floor: still tied up (steps 2–3), or torn open and empty with the bones round it (the twist)
function bagOnFloor(x, torn) {
  if (!torn) {
    fill(smoothPath([[x - 60, 0], [x - 66, -60], [x - 40, -110], [x + 40, -110], [x + 66, -60], [x + 60, 0]]), 'rgba(236,240,245,0.92)');
    ell(x, -112, 20, 10, '#e9edf2'); ell(x + 22, -86, 22, 14, '#e9b98a', 0.3);
    fill(smoothPath([[x - 52, -40], [x + 52, -40], [x + 50, -14], [x - 50, -14]]), '#d9433b', 0.85);
    return;
  }
  fill(smoothPath([[x - 90, 0], [x - 70, -36], [x - 30, -48], [x + 10, -30], [x + 60, -40], [x + 96, 0]]), 'rgba(236,240,245,0.92)');
  for (let i = 0; i < 4; i++) limb([[x - 70 + i * 40, -30 - 6 * (i % 2)], [x - 58 + i * 40, -10]], 4, 'rgba(180,186,196,0.9)', false);   // the rips
  fill(smoothPath([[x - 60, -10], [x + 60, -10], [x + 58, 0], [x - 58, 0]]), '#d9433b', 0.85);
  for (const [bx, a] of [[x + 120, 0.3], [x + 170, -0.5], [x - 130, 0.9]]) bone(bx, -10, a, 0.8);
}
function bone(x, y, a = 0, s = 1) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  limb([[-22, 0], [22, 0]], 10, '#f3ead8', false);
  for (const ex of [-24, 24]) { ell(ex, -6, 8, 8, '#f3ead8'); ell(ex, 6, 8, 8, '#f3ead8'); }
  g.restore();
}

// —— the night light: darkness over the cab with holes where the torch, the phone and the landing light it ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
function lighting(t, cam, lights, amount = 0.86) {
  if (amount <= 0.005) return;
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(4,7,17,${amount})`; dk.fillRect(0, 0, W, H);
  dk.globalCompositeOperation = 'destination-out';
  const z = scaleOf(cam);
  const shapes = [];
  for (const L of lights) {
    const [x, y] = toScreen(cam, L.p), r = L.r * z;
    if (!(r > 1)) continue;                       // a light that has shrunk to nothing (a gradient of radius ≤ 0 throws)
    if (L.cone) {
      const a = L.a, s = L.spread ?? 0.36, gr = dk.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${L.k})`); gr.addColorStop(0.65, `rgba(0,0,0,${L.k * 0.85})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = gr; dk.beginPath(); dk.moveTo(x, y); dk.arc(x, y, r, a - s, a + s); dk.closePath(); dk.fill();
      const g2 = dk.createRadialGradient(x, y, 0, x, y, 70 * z); g2.addColorStop(0, `rgba(0,0,0,${L.k})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = g2; dk.beginPath(); dk.arc(x, y, 70 * z, 0, TAU); dk.fill();
    } else if (L.box) {
      const [x1, y1] = toScreen(cam, L.box[1]);
      dk.fillStyle = `rgba(0,0,0,${L.k})`; dk.fillRect(x, y, x1 - x, y1 - y);
      const gr = dk.createRadialGradient((x + x1) / 2, y1, 0, (x + x1) / 2, y1, r);
      gr.addColorStop(0, `rgba(0,0,0,${L.k * 0.9})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = gr; dk.beginPath(); dk.arc((x + x1) / 2, y1, r, 0, TAU); dk.fill();
    } else {
      const gr = dk.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${L.k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, r, 0, TAU); dk.fill();
    }
    shapes.push({ x, y, r, L });
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(DK, 0, 0);
  for (const { x, y, r, L } of shapes) {
    if (!L.tint || L.box) continue;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(L.tint, 0.22 * L.k)); gr.addColorStop(1, rgba(L.tint, 0));
    g.fillStyle = gr; g.beginPath();
    if (L.cone) { g.moveTo(x, y); g.arc(x, y, r, L.a - (L.spread ?? 0.36), L.a + (L.spread ?? 0.36)); g.closePath(); } else g.arc(x, y, r, 0, TAU);
    g.fill();
  }
}

// —— frame ——
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'shaft') shaftFrame(t, cam);
  else cabFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, sc === 'shaft' ? 0.6 : 1);
}

function cabFrame(t, cam) {
  const { h, d, bag, bone: chewing } = actorsAt(t);
  cabShell(t, cam);
  view(cam, 1);
  if (bag === 'floor') bagOnFloor(BAG_FLOOR[0], false);
  if (bag === 'torn') bagOnFloor(-170, true);
  let dl = null;
  if (d) dl = drawDog(d);
  if (chewing && dl?.nose) bone(dl.nose[0] - 6, dl.nose[1] + 14, 0.2, 0.9);
  if (h) hunterDraw(t, h);
  // the darkness once the power is gone: the dog's torch, the phone, the open doors; a faint emergency glow
  const dark = t < T.out ? 0 : 0.82;
  if (dark > 0.005) {
    const lights = [{ p: [0, CAB.ceil + 30], r: 260, k: 0.25 }];
    if (dl?.lens && d.torch) lights.push({ p: dl.lens, a: dl.beamAng, r: 1100, k: 0.97, cone: true, spread: 0.46, tint: '#ffcf7a' });
    if (h?.prop?.kind === 'phone') { const p = h.prop.p; lights.push({ p: [p[0] + 10, p[1] - 10], r: 300, k: 0.8, tint: '#9fd8ff' }); }
    if (t >= T.c3 && t < T.c4 && t > T.bell) lights.push({ p: BELL, r: 160, k: 0.6, tint: '#ffd23f' });
    const k = doorK(t);
    if (k > 0.01) {
      const gap = k * (DOORS.x1 - DOORS.x0) / 2 * 0.96;
      lights.push({ box: [[-gap, DOORS.top], [gap, 0]], p: [-gap, DOORS.top], r: 900 * k, k: 0.98 });
    }
    if (t > T.c6) lights.push({ p: [-250, -300], r: 520 * k, k: 0.6 * k });
    if (h) lights.push({ p: [h.hip[0] + 40, h.hip[1] - 140], r: 430, k: 0.55, tint: '#ffcf7a' });   // the torch's spill on him
    lighting(t, cam, lights, dark);
  }
  if (t >= T.c2 && t < T.c3) { view(cam, 1); airFlow(t); }
}
// the air through the slots: soft arrows in at the floor, up through the cab, out at the ceiling
function airFlow(t) {
  const k = seg(A.L2w4 - 0.1, A.L2w4 + 0.4, t) * (1 - seg(T.c3 - 0.3, T.c3, t));
  if (k <= 0.01) return;
  for (let i = 0; i < 7; i++) {
    const x = -360 + i * 120, u = ((t * 0.45 + i * 0.37) % 1), y = lerp(-40, CAB.ceil + 40, u);
    const a = 0.7 * k * bump(u);
    g.save(); g.globalAlpha = a; g.translate(x + 20 * Math.sin(t * 1.4 + i), y);
    limb([[-18, 14], [0, -6], [18, 14]], 10, '#9fe2ff', false);
    limb([[-18, 44], [0, 24], [18, 44]], 8, 'rgba(159,226,255,0.6)', false);
    g.restore();
  }
}

// —— the shaft in section: floors 18–21, the cab stuck between 19 and 20, the gap under the landing ——
function shaftFrame(t, cam) {
  const P = Sc.palette('night');
  Sc.backdrop(P, cam);
  view(cam, 1);
  const { x0, x1, fh } = SH;
  // the shaft walls, the landings on the right with their doors, the floor numbers
  Sc.gline([[x0, shY(23)], [x0, shY(16)]], 5, P.line, P); Sc.gline([[x1, shY(23)], [x1, shY(16)]], 5, P.line, P);
  for (let f = 17; f <= 22; f++) {
    const y = shY(f);
    Sc.gline([[x1, y], [x1 + 520, y]], 6, P.line, P);
    Sc.gline([[x1, y - 300], [x1 + 30, y - 300], [x1 + 30, y]], 3, P.faint, P);          // the landing door
    Hd.label(String(f), x1 + 270, y - 40, 58, f === 20 ? P.warm : P.text, { fam: FONTS.mono, shadow: false, stroke: false });
    Sc.gline([[x0 - 300, y], [x0, y]], 3, P.faint, P);
  }
  // the cables up to the machine room
  Sc.gline([[-40, shY(23)], [-40, CABY - 520]], 3, P.faint, P); Sc.gline([[40, shY(23)], [40, CABY - 520]], 3, P.faint, P);
  // the open shaft under the cab: from the cab sill down, a red hatch where you'd fall
  const gk = seg(T.gap, T.gap + 0.4, t);
  if (gk > 0) {
    const gy0 = CABY, gy1 = shY(16);
    fill(polyPath([[x1 - 60, gy0], [x1, gy0], [x1, gy1], [x1 - 60, gy1]]), rgba(P.danger, 0.2 * gk));
    g.save(); g.beginPath(); g.rect(x0, gy0, x1 - x0, gy1 - gy0); g.clip();
    for (let i = 0; i < 30; i++) { const y = gy0 + i * 60 - 40; Sc.gline([[x0, y], [x1, y + 90]], 3, rgba(P.danger, 0.5 * gk), P); }
    g.restore();
    const ay = gy0 + 140 + 30 * Math.sin(t * 5);
    g.save(); g.globalAlpha = gk; limb([[x1 - 120, gy0 + 40], [x1 - 120, ay + 200]], 12, P.danger, false); poly([[x1 - 150, ay + 190], [x1 - 90, ay + 190], [x1 - 120, ay + 250]], P.danger); g.restore();
  }
  // the cab: a box between 19 and 20, the hunter and the dog inside as small figures
  const cw = x1 - x0 - 40, ch = 340, cx0 = x0 + 20;
  const pry = seg(T.pry, T.pry + 0.6, t) * (1 - seg(T.no, T.no + 0.4, t));
  fill(rrPath(cx0, CABY - ch, cw, ch, 6), rgba(P.line, 0.12));
  Sc.gline([[cx0, CABY - ch], [cx0 + cw, CABY - ch], [cx0 + cw, CABY], [cx0, CABY]], 6, P.hi, P, true);
  if (pry > 0.01) { const dy = 60 * pry; Sc.gline([[cx0 + cw, CABY - ch + 30], [cx0 + cw + 24 * pry, CABY - ch / 2 - dy]], 4, P.danger, P); }
  MONO.on = true; MONO.color = P.hi;
  const o = stand({ s: 0.36, face: 1, lean: 0.04 + 0.2 * pry, look: [0.7, 0], hat: true, jacket: true, boots: true, pack: false }, cx0 + cw - 120 + 50 * pry, CABY);
  if (pry > 0.01) { const sh = framesOf(o).T.p([-14, -192]); o.hands = { near: { p: [cx0 + cw - 6, sh[1] + 30], shape: 'grip' }, far: { p: [cx0 + cw - 14, sh[1] + 60], shape: 'grip' } }; }
  drawHunter(o);
  drawDog({ x: cx0 + 70, y: CABY, s: 0.42, face: 1, sit: 1, t });
  MONO.on = false;
  // the dimension: from the landing slab up to the cab sill
  Hd.label('ТЫ', cx0 + cw - 120, CABY - ch - 30, 40, P.warm, { fam: FONTS.mono, shadow: false, stroke: false });
  void fh;
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c1 - 0.1, 'ПОДЪЕЗД 3 — 18:40');
  Hd.timeStamp(t, T.c2 + 0.05, T.c6 - 0.1, 'ЛИФТ — 18:43');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ЧЕРЕЗ ЧАС — 19:41');
  // the hook: the floor display, then «между этажами»
  if (sc === 'cab' && t < T.c1) {
    Hd.plaque(t, T.jolt, T.c1 - 0.05, 540, 330, { icon: 'stairs', title: 'МЕЖДУ ЭТАЖАМИ', sub: '19 и 20', color: DANGER, to: S2([IND[0], IND[1] + 40]) });
  }
  // the shaft
  if (sc === 'shaft') {
    const cw = SH.x1 - SH.x0 - 40, cx0 = SH.x0 + 20;
    { const p = S2([cx0 + cw - 120, CABY - 120]); Hd.redX(p[0], p[1], 90, sp(t, T.no, 2.6, 8)); }
    Hd.plaque(t, T.gap, T.c2 - 0.05, 540, 1520, { icon: 'x', title: 'ОТКРЫТАЯ ШАХТА', sub: 'под порогом кабины', color: DANGER, to: S2([SH.x1 - 120, CABY + 300]) });
  }
  Hd.ribbon(t, T.no, T.gap - 0.15, 'ДВЕРИ НЕ ТРОГАЙ', { y: 760, size: 92 });
  // the air
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, A.L2w2 - 0.08, T.c3 - 0.05, 540, 330, { icon: 'check', title: 'ВОЗДУХА ХВАТИТ', sub: 'щели для вентиляции', color: OK, to: S2([CAB.x0 + 200, CAB.ceil + 32]) });
  // step 1
  Hd.stepHeader(t, 1, 'КНОПКА ВЫЗОВА', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) {
    const sp0 = S2(SPEAKER);
    speech(t, T.disp - 0.15, T.c4 - 0.05, sp0[0] - 40, sp0[1] - 150, 'Диспетчер слушает');
    Hd.plaque(t, A.L3w8 - 0.1, T.c4 - 0.02, 540, 1560, { icon: 'house', title: 'СКАЖИ ПОДЪЕЗД', sub: 'и номер дома', color: GOLD });
  }
  // step 2
  Hd.stepHeader(t, 2, 'НЕ ОТКРЫВАЙ ДВЕРИ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) {
    const p = S2([0, -360]); Hd.redX(p[0], p[1], 80, sp(t, A.L4w5 - 0.05, 2.6, 8));
    Hd.plaque(t, A.L4w9 - 0.08, T.c5 - 0.02, 540, 560, { icon: 'torch', title: 'ЖДИ ЛИФТЁРА', sub: 'или спасателей', color: OK });
  }
  // step 3
  Hd.stepHeader(t, 3, 'БЕРЕГИ ЗАРЯД', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 + 0.05 && t < T.c6) phoneCard(t, 540, 760);
  if (t >= T.c5 && t < T.c6) Hd.plaque(t, A.L5w11 - 0.08, T.c6 - 0.02, 540, 1150, { icon: 'clock', title: 'ЖДАТЬ МОГУТ ДОЛГО', sub: 'сиди спокойно', color: GOLD });
  // the twist
  if (t >= T.c6 && t < T.dog) { const p = S2([-250, -560]); Hd.tick(p[0], p[1], sp(t, A.L6w6 - 0.05, 2.6, 8), 56); }
  if (t >= T.dog && t < T.c7) Hd.plaque(t, A.L6w12 - 0.08, T.c7 - 0.02, 540, 560, { icon: 'x', title: 'КУРИЦЫ НЕТ', sub: 'Пурга довольна', color: GOLD, to: S2([-170, -40]) });
  // the end: subscribe, then «would you climb out?»
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'А ТЫ БЫ ПОЛЕЗ?', sub: 'пиши в комментариях', color: GOLD, size: 50 });
}
// a speech bubble from the speaker grille
function speech(t, t0, t1, x, y, str) {
  if (t < t0 || t > t1 + 0.2) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - clamp((t - t1) / 0.2));
  if (k <= 0.01) return;
  const size = 38, w = measure(str, size, FONTS.cond) + 60, h = 84;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20; g.shadowOffsetY = 6;
  rrect(-w / 2, -h / 2, w, h, 22, '#fff8e6'); poly([[w / 2 - 70, h / 2 - 2], [w / 2 - 30, h / 2 - 2], [w / 2 - 20, h / 2 + 34]], '#fff8e6'); g.restore();
  text(str, 0, 13, size, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// —— the phone close-up: the battery and power saving, then the message that goes through ——
function phoneCard(t, cx, cy) {
  const k = clamp(sp(t, T.c5 + 0.08, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const chat = seg(T.chat, T.chat + 0.25, t), w = 380, h = 600;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(-0.04); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  const saving = seg(T.save, T.save + 0.3, t);
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, mix('#16233a', '#141820', saving));
  rrect(-40, -h / 2 + 26, 80, 18, 9, '#0d0f16');
  // the battery in the corner: 41 %, yellow once power saving is on
  const bc = saving > 0.5 ? '#ffd23f' : '#ffffff';
  rrect(w / 2 - 110, -h / 2 + 50, 56, 26, 6, 'rgba(255,255,255,0.2)'); rect(w / 2 - 54, -h / 2 + 57, 5, 12, 'rgba(255,255,255,0.4)');
  rrect(w / 2 - 107, -h / 2 + 53, 23, 20, 4, bc);
  Hd.label('41%', w / 2 - 120, -h / 2 + 72, 24, bc, { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  if (chat < 1) {                                                // the settings: «Экономия заряда» switched on
    g.save(); g.globalAlpha *= 1 - chat;
    g.save(); g.translate(0, -90); Hd.icon('battery', 70, bc); g.restore();
    Hd.label('Экономия', -w / 2 + 50, 56, 30, '#ffffff', { align: 'left', shadow: false, stroke: false });
    Hd.label('заряда', -w / 2 + 50, 92, 30, '#ffffff', { align: 'left', shadow: false, stroke: false });
    const kx = saving;
    rrect(w / 2 - 130, 40, 84, 46, 23, mix('#4a5160', '#3ddc84', kx)); ell(w / 2 - 107 + 38 * kx, 63, 19, 19, '#ffffff');
    Hd.label('яркость ниже, фон выкл.', -w / 2 + 50, 150, 22, '#9aa8bc', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
    g.restore();
  }
  if (chat > 0) {                                                // the message: typed, sent, delivered ✓✓
    g.save(); g.globalAlpha *= chat;
    Hd.label('МАМА', 0, -h / 2 + 130, 40, '#ffffff', { shadow: false, stroke: false });
    rect(-w / 2 + 16, -h / 2 + 160, w - 32, 2, 'rgba(255,255,255,0.15)');
    const L1 = 'Застрял в лифте,', L2 = '3 подъезд. Всё ок', all = L1 + ' ' + L2;
    const n = Math.round(all.length * seg(T.chat + 0.15, A.L5w7, t, u => u)), sent = t > A.L5w8;
    if (sent) {
      const bw = 300, by = -30;
      rrect(w / 2 - 34 - bw, by - 56, bw, 112, 22, '#2f8f4e');
      Hd.label(L1, w / 2 - 34 - bw + 20, by - 12, 29, '#ffffff', { align: 'left', shadow: false, stroke: false });
      Hd.label(L2, w / 2 - 34 - bw + 20, by + 26, 29, '#ffffff', { align: 'left', shadow: false, stroke: false });
      const dv = t > A.L5w9 - 0.05;
      Hd.label(dv ? '✓✓' : '✓', w / 2 - 48, by + 46, 24, dv ? '#9fe8ff' : '#d6ecff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
    }
    rrect(-w / 2 + 34, h / 2 - 120, w - 68, 70, 35, 'rgba(255,255,255,0.1)');
    const typed = all.slice(0, n), tail = typed.length > 18 ? '…' + typed.slice(-17) : typed;
    Hd.label(sent ? '' : tail + ((t * 2) % 1 < 0.5 ? '|' : ''), -w / 2 + 56, h / 2 - 74, 26, '#ffffff', { align: 'left', shadow: false, stroke: false });
    g.restore();
  }
  g.restore();
  Hd.tick(cx + 150, cy - 220, sp(t, A.L5w9, 2.6, 8), 52);
}

// —— the poster in the first frames: him and the dog in the dark cab, the torch, the words on the right ——
function coverFrame(t) {
  const cam = { x: 120, y: -400, z: 1.5, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  const save = T.out; T.out = -1;                               // the cab already dark on the poster
  cabShell(t, cam);
  T.out = save;
  view(cam, 1);
  const o = stand(base(t, { s: 0.95, face: 1, pop: 0.8, brow: 0.9, mouth: 0.5, look: [0.7, -0.6], blink: 0, lean: -0.05 }), -150, 120);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 130, sh[1] - 120], shape: 'point', ang: -0.9 }, far: { p: [sh[0] - 6, sh[1] + 220], shape: 'grip' } };
  o.prop = { kind: 'bag', p: o.hands.far.p, full: 1 };
  const dl = drawDog({ x: 140, y: 60, s: 1.05, face: 1, sit: 1, torch: true, look: 0.55, t: 0, ears: 1 });
  hunterDraw(t, o);
  lighting(t, cam, [{ p: dl.lens, a: dl.beamAng - 0.2, r: 900, k: 0.97, cone: true, spread: 0.6, tint: '#ffcf7a' }, { p: [-120, -480], r: 520, k: 0.8, tint: '#ffcf7a' }], 0.84);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ЗАСТРЯЛ', 0, 210, 136, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('В ЛИФТЕ', 0, 360, 130, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 3 · НЕ ЛЕЗЬ!', pw = measure(pl, 56, FONTS.cond) + 60;
  rect(-pw + 8, 430 + 8, pw, 92, INK); rect(-pw, 430, pw, 92, '#ffd43b'); text(pl, -pw / 2, 494, 56, '#111111', { fam: FONTS.cond, shadow: false });
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
  return m * (0.5 / (2 * h * 60));
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.3, 'amb_flat', -20, 0, { dur: T.out - 0.3 });
  add(A.L0, 'ticks_up', -14, 0.1, { dur: T.floor - A.L0 + 0.2 });
  add(T.floor, 'blip', -10, 0);
  add(T.out - 0.05, 'power_down', -8, 0);
  add(T.out, 'hum_stop', -10, 0);
  add(T.jolt, 'stamp', -4, 0);
  add(T.jolt + 0.05, 'puff', -14, 0);
  add(T.out + 0.5, 'whine', -16, -0.3, { dur: 0.7 });
  add(T.c1, 'whoosh', -12, 0);
  add(T.pry, 'squeak_dry', -12, 0.3);
  add(T.no, 'stamp', -6, 0);
  add(T.no, 'ribbon', -8, 0);
  add(T.gap, 'whoosh_down', -12, 0.2);
  add(T.c2, 'amb_flat', -20, 0, { dur: T.c6 - T.c2 });
  add(A.L2w2 - 0.08, 'ding', -10, 0);
  add(T.bell - 0.02, 'click', -6, 0.2);
  add(T.bell + 0.05, 'ding', -12, 0.2);
  add(T.disp - 0.15, 'toggle', -12, 0.3);
  add(A.L3w8 - 0.1, 'blip', -10, 0);
  add(T.c4 + 0.2, 'paper', -12, -0.2, { dur: 0.4 });
  add(A.L4w5 - 0.05, 'stamp', -8, 0);
  add(A.L4w9 - 0.08, 'blip', -10, 0);
  add(T.c5 + 0.08, 'whoosh_in', -12, 0);
  add(T.save, 'toggle', -10, 0);
  add(T.chat, 'click', -12, 0);
  add(A.L5w8, 'blip', -8, 0.1);
  add(A.L5w9, 'ding', -10, 0.1);
  add(A.L5w11 - 0.08, 'blip', -10, 0);
  add(T.c6, 'whoosh', -12, 0);
  add(T.open - 0.1, 'squeak_dry', -10, 0);
  add(T.open + 0.1, 'city', -22, 0, { dur: A.L7 - T.open });
  add(A.L6w6 - 0.05, 'ding', -10, -0.2);
  add(T.dog, 'whoosh', -14, 0);
  add(A.L6w12 - 0.1, 'paper', -10, -0.2, { dur: 0.5 });
  add(A.L6w12, 'whine', -14, -0.2, { dur: 0.5 });
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
