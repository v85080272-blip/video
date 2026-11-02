// «Первые 5 минут» («Заражение», серия 1): the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The same hunter (in the striped vest he sleeps in) and Пурга, in the flat on the 20th floor from «Блэкаут» (apt.js),
// with a hall on the right: the front door and a wardrobe. New here: the view from the window as a card (the street
// twenty floors down, people running, the infected after them, a car alarm that turns them), the countdown of the first
// five minutes, the wardrobe pushed against the door, the light going off, the shadows passing under the door.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import * as Ap from './apt.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 4.37, 13], L1: [4.77, 7.82, 9], L2: [8.27, 11.93, 11], L3: [12.33, 16.77, 14], L4: [17.17, 20.96, 11], L5: [21.41, 25.86, 14], L6: [26.31, 29.49, 9], L7: [29.84, 34.71, 14] };
export const DUR = VOICE?.dur ?? 35.06;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { КРИКОВ: DANGER, ЗАРАЖЁННЫЕ: DANGER, ШУМ: DANGER, ВСЁ: GOLD, ВЫХОДИ: DANGER, ШКАФОМ: GOLD, СВЕТ: GOLD, СЛЫШНО: GOLD,
  ВОДУ: GOLD, ТЕЧЁТ: GOLD, УСПЕЛ: OK, РАНЬШЕ: WARM, УХОДИТЬ: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  wake: A.L0w3 - 0.06,               // «…от криков»: he sits up
  street: A.L0w4 - 0.1,              // «За окном бегут люди…»: the card with the street
  c1: A.L1 - 0.06,                   // «Они бегут на любой шум»
  alarm: A.L1w3 - 0.1,               // «любой шум»: a car alarm, they turn to it
  clock: A.L1w5 - 0.06,              // «Первые минуты решают всё»: the countdown starts
  c2: A.L2 - 0.06,                   // step 1: the door
  key: A.L2w4,                       // «Закрой дверь на ключ»
  push: A.L2w8 - 0.1,                // «подопри её шкафом»
  c3: A.L3 - 0.06,                   // step 2: the light and the phone
  off: A.L3w2 - 0.08,                // «свет»
  mute: A.L3w4 - 0.08,               // «звук на телефоне»
  c4: A.L4 - 0.06,                   // step 3: water
  bottles: A.L4w6 - 0.1,             // «и бутылки»
  c5: A.L5 - 0.06,                   // «Ты всё успел…»
  dog: A.L5w4 - 0.1,                 // «А Пурга тихо легла у порога»
  c6: A.L6 - 0.06,                   // «Что дальше…»
  c7: A.L7 - 0.06,                   // «А напиши «возьми с собой»…»
};
export const CUTS = [T.cover, T.c2, T.c3, T.c4, T.bottles, T.c5, T.c6];
export const SNAPS = [T.push];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : 'flat');

// the flat (apt.js: bathroom x −1260…−440, kitchen −400…900) and the hall added on the right: the front door, the wardrobe
const HALL = { x0: 900, x1: 1600 };
const DOOR = { x0: 1300, x1: 1470, top: -560 };
const WARD = { x0: 990, w: 200, h: 560 };
const BED = { x0: 450, x1: 860 };
const SWITCH = [372, -380];

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
// the ground at about y 1170 on screen, so the subtitles sit below the action: cam.y = −210 / z
shot(T.cover, [[T.cover, 640, -150, 1.4], [T.street, 620, -160, 1.32], [T.c2 - 0.1, 600, -170, 1.24]]);
shot(T.c2, [[T.c2, 1220, -170, 1.24], [T.push, 1230, -165, 1.27], [T.c3, 1250, -160, 1.3]]);
shot(T.c3, [[T.c3, 300, -175, 1.2], [T.mute, 280, -170, 1.24], [T.c4, 270, -168, 1.25]]);
shot(T.c4, [[T.c4, -900, -175, 1.2], [T.bottles, -880, -172, 1.22]]);
shot(T.bottles, [[T.bottles, 200, -170, 1.24], [T.c5, 220, -168, 1.25]]);
shot(T.c5, [[T.c5, 1120, -170, 1.24], [T.dog, 1180, -160, 1.32], [T.c6, 1200, -156, 1.35]]);
shot(T.c6, [[T.c6, 620, -170, 1.24], [DUR, 630, -168, 1.26]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.wake, 8], [T.alarm, 5], [T.push + 0.5, 10]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function sitFloor(o, x, y = 0) { const k = (o.s ?? S) / S, f = o.face === 1 ? 1 : -1; o.hip = [x, y - 30 * k]; o.feet = { near: [x + 118 * k * f, y], far: [x + 140 * k * f, y] }; o.lean = -0.08; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);

// the countdown of the first five minutes: 05:00 at «Первые минуты», 00:00 at «Ты всё успел»
const remaining = t => 300 * (1 - seg(T.clock, T.c5, t, u => u));

export function actorsAt(t) {
  if (scene(t) !== 'flat') return {};
  // S1 · asleep on the mattress under the window; the screams; he sits up and looks out
  if (t < T.c2) {
    if (t < T.wake + 0.1) {
      const o = stand(base(t, { face: 1, look: [0.5, 0], lid: 1, blink: 1 }), 560);
      o.lying = true;
      return { h: o, d: { x: 760, y: 0, s: DS, face: -1, sit: 1, t, blink: 1, ears: 0.3 }, lamp: 0, blanket: true };
    }
    const up = seg(T.wake + 0.1, T.wake + 0.4, t);
    const o = sitFloor(base(t, { face: 1, look: [0.5, -0.4], brow: lerp(0, 0.9, up), lid: lerp(0.6, 0.1, up), pop: 0.9 * up * (1 - seg(T.wake + 1.4, T.wake + 2.2, t)) }), 520);
    if (t > T.street - 0.2) { o.look = [0.6, -0.9]; o.headTilt = -0.2; o.brow = 1; o.mouth = 0.3; }
    return { h: o, d: { x: 760, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), ears: up > 0.5 ? 1 : 0.3, look: 0.6 }, lamp: 0, blanket: true, card: true };
  }
  // S2 · step 1: the key; the wardrobe pushed across the door
  if (t < T.c3) {
    const k = seg(T.push, T.push + 0.9, t);
    const o = stand(base(t, { look: [0.6, 0], brow: 0.8 }), k > 0 ? WARD.x0 - 40 + 300 * k : DOOR.x0 - 60);
    const sh = shoulder(o);
    if (t < T.push) o.hands = { near: { p: [DOOR.x0 + 30, -300], shape: 'grip' } };
    else { o.lean = 0.35; o.hands = { near: { p: [sh[0] + 90, sh[1] + 30], shape: 'open' }, far: { p: [sh[0] + 96, sh[1] + 60], shape: 'open' } }; }
    return { h: o, ward: k, keyTurn: seg(T.key, T.key + 0.3, t), d: { x: 1080, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 1 }, lamp: 1, dogBack: true };
  }
  // S3 · step 2: the switch; the phone on silent
  if (t < T.c4) {
    const o = stand(base(t, { face: 1, look: [0.6, -0.1], brow: 0.6 }), 300);
    const sh = shoulder(o);
    o.hands = t < T.mute - 0.2 ? { near: { p: [SWITCH[0] - 6, SWITCH[1] + 6], shape: 'point' } } : { near: { p: [sh[0] + 60, sh[1] + 60], shape: 'grip' } };
    if (t >= T.mute - 0.2) o.prop = { kind: 'phone', p: [sh[0] + 64, sh[1] + 36] };
    return { h: o, ward: 1, lamp: t < T.off ? 1 : 0, dark: seg(T.off, T.off + 0.25, t), d: { x: 560, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), ears: 1 } };
  }
  // S4 · step 3: the bath tap, the tub filling; then the bottles at the kitchen tap
  if (t < T.c5) {
    if (t < T.bottles) {
      const o = stand(base(t, { face: -1, look: [0.6, 0.3], brow: 0.4 }), Ap.BTAP.x + 150);
      o.hands = { near: { p: [Ap.BTAP.x + 30, Ap.BTAP.y + 4], shape: 'grip' } };
      return { h: o, ward: 1, lamp: 0, dark: 1, tub: { level: lerp(0.05, 0.55, seg(T.c4 + 0.2, T.bottles, t, u => u)), run: 1 } };
    }
    const o = stand(base(t, { face: 1, look: [0.6, 0.3], brow: 0.4 }), Ap.KTAP.x - 110);
    o.hands = { near: { p: [Ap.KTAP.x + 4, -326], shape: 'grip' } };
    const u = seg(T.bottles + 0.2, T.c5 - 0.1, t, v => v);
    return { h: o, ward: 1, lamp: 0, dark: 1, tub: { level: 0.85, run: 0 }, run: 1, fills: [1, 1, clamp(u * 3), clamp(u * 3 - 1), clamp(u * 3 - 2)] };
  }
  // S5 · done; Пурга lies down at the threshold, ears up; shadows pass under the door
  if (t < T.c6) {
    const o = sitFloor(base(t, { face: 1, look: [0.7, 0], brow: 0.5 }), 940);
    const lie = seg(T.dog, T.dog + 0.6, t);
    const d = { x: lerp(1160, 1250, lie), y: 0, s: DS, face: 1, sit: lie < 0.5 ? 1 : 0, lie, t, blink: dblink(t), ears: 1, look: -0.2, mouth: 0 };
    return { h: o, d, ward: 1, lamp: 0, dark: 1, tub: { level: 0.85 }, fills: [1, 1, 1, 1, 1], shadows: t > T.dog + 0.6 };
  }
  // S6 · «Что дальше?»: back at the window; the card with the street again and the two choices
  const o = stand(base(t, { face: 1, look: [0.6, -0.6], brow: 0.7, headTilt: -0.12 }), 560);
  return { h: o, d: { x: 760, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), ears: 1, look: 0.6 }, ward: 1, lamp: 0, dark: 1, tub: { level: 0.85 }, fills: [1, 1, 1, 1, 1], card: true, choice: true };
}

function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.35); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#5a7fa8'); g.restore(); };
  if (o.lying) {                                      // flat on his back on the mattress, head to the left
    const [hx, hy] = o.hip;
    g.save(); g.translate(hx, hy + LEG - 62); g.rotate(-Math.PI / 2); g.translate(-hx, -hy);
    drawHunter(o); g.restore();
    return;
  }
  drawHunter(o);
}

// —— the set: the flat from «Блэкаут» plus the hall with the front door and the wardrobe, the mattress under the window ——
function hall(t, a) {
  const { x0, x1 } = HALL;
  rect(x0 - 4, Ap.ROOM.ceil, x1 - x0 + 4, -Ap.ROOM.ceil, '#e2d3b4');
  for (let y = Ap.ROOM.ceil + 40; y < 0; y += 90) for (let x = x0 + 40; x < x1; x += 90) ell(x, y, 4, 4, '#d1bf99');
  rect(x0 - 4, Ap.ROOM.ceil, x1 - x0 + 4, 24, '#f1ebdd'); rect(x0 - 4, -30, x1 - x0 + 4, 30, '#d3c19e');
  rect(x1, Ap.ROOM.ceil - Ap.ROOM.slab, 60, -Ap.ROOM.ceil + Ap.ROOM.slab + 110, '#3c3f52');
  rect(x0 - 4, Ap.ROOM.ceil - Ap.ROOM.slab, x1 - x0 + 64, Ap.ROOM.slab, '#3c3f52');
  rect(x0 - 4, 0, x1 - x0 + 64, Ap.ROOM.slab + 40, '#3c3f52'); rect(x0 - 4, 0, x1 - x0 + 64, 10, '#2c2e3e');
  rect(x0 - 14, Ap.ROOM.ceil, 28, -Ap.ROOM.ceil, '#d3c19e');          // the corner between kitchen and hall
  // the front door: steel, the peephole, two locks, the light from the landing in the gap under it
  const { x0: d0, x1: d1, top } = DOOR;
  rect(d0 - 18, top - 18, d1 - d0 + 36, -top + 18, '#4a4038');
  rrect(d0, top, d1 - d0, -top - 6, 4, '#6b5240');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) fill(polyPath([[d0 + 42 + c * 86, top + 60 + r * 130], [d0 + 72 + c * 86, top + 100 + r * 130], [d0 + 42 + c * 86, top + 140 + r * 130], [d0 + 12 + c * 86, top + 100 + r * 130]]), '#5a4434');
  ell((d0 + d1) / 2, top + 130, 10, 10, '#2a2d38');
  const kt = a.keyTurn ?? 0;
  for (const y of [-330, -240]) { rrect(d0 + 18, y - 18, 30, 36, 6, '#c9d0d6'); g.save(); g.translate(d0 + 33, y); g.rotate(kt * Math.PI / 2); rect(-3, -10, 6, 20, '#5a6370'); g.restore(); }
  rrect(d0 + 10, -296, 56, 14, 7, '#c9d0d6');
  // the wardrobe: it slides right across the door (k 0…1)
  const k = a.ward ?? 0, wx = WARD.x0 + 300 * ease.out(clamp(k));
  rect(wx, -WARD.h, WARD.w, WARD.h - 26, '#9d6c43'); rect(wx + WARD.w - 18, -WARD.h, 18, WARD.h - 26, '#7a5434');
  rect(wx + WARD.w / 2 - 2, -WARD.h + 20, 4, WARD.h - 60, '#7a5434');
  for (const dx of [-24, 16]) rrect(wx + WARD.w / 2 + dx, -WARD.h / 2 - 30, 8, 60, 4, '#d9c8a5');
  rect(wx - 4, -WARD.h - 14, WARD.w + 8, 16, '#7a5434');
  // the light from the landing in the gap under the door, seen between the wardrobe's legs; shadows of feet pass in it
  rect(d0, -14, d1 - d0, 14, rgba('#ffe7a8', 0.95)); ell((d0 + d1) / 2, -4, (d1 - d0) * 0.7, 26, 'rgba(255,231,168,0.18)');
  if (a.shadows) for (let i = 0; i < 2; i++) { const u = ((t * 0.45 + i * 0.5) % 1); rect(lerp(d0 - 40, d1, u), -14, 40, 14, '#2a2520'); }
  rect(wx, -WARD.h, WARD.w, WARD.h - 26, 'rgba(0,0,0,0)');
  for (const lx of [wx + 6, wx + WARD.w - 26]) rect(lx, -26, 20, 26, '#5e3f25');
  if (k > 0.02 && k < 0.98) for (let i = 0; i < 3; i++) limb([[wx - 30 - i * 26, -40 - i * 40], [wx - 70 - i * 26, -40 - i * 40]], 5, 'rgba(60,40,30,0.4)', false);
}
function mattress(t, a) {
  const { x0, x1 } = BED;
  rrect(x0, -70, x1 - x0, 70, 18, '#e9e4d8'); rect(x0 + 10, -24, x1 - x0 - 20, 24, '#d8d2c2');
  rrect(x0 + 10, -110, 130, 48, 18, '#f6f2e7');
}
function blanket(t, a) {
  const { x0, x1 } = BED;
  fill(smoothPath([[x0 + 120, -90], [x1 - 10, -96], [x1, -30], [x0 + 110, -24]]), '#3c7ad6');
  for (let i = 0; i < 5; i++) rect(x0 + 150 + i * 120, -94, 22, 66, 'rgba(255,255,255,0.15)');
}

// —— the card: the street twenty floors down. People run right, the infected after them; a car alarm turns them ——
const STREET = { x: 70, y: 420, w: 940, h: 600 };
const PEOPLE = Array.from({ length: 5 }, (_, i) => ({ y: 0.55 + 0.33 * hash(i * 3.3), v: 230 + 80 * hash(i * 1.7), x0: hash(i * 9.1) * 1300, c: ['#3b6fd9', '#d9433b', '#efe3c2', '#5fa05a', '#d98a3b', '#c94f8a', '#f2f2f2'][i] }));
const INF = Array.from({ length: 7 }, (_, i) => ({ y: 0.5 + 0.4 * hash(i * 5.1 + 2), v: 200 + 70 * hash(i * 2.9), x0: hash(i * 4.7 + 1) * 1300 - 260 }));
function mini(x, y, s, t, ph, c, inf = false, face = 1) {
  const k = Math.sin(t * 14 + ph);
  g.save(); g.translate(x, y); g.scale(face * s, s);
  limb([[0, -40], [10 * k, 0]], 9, inf ? '#5c4333' : '#3a3f52', false); limb([[0, -40], [-10 * k, 0]], 9, inf ? '#5c4333' : '#2a2f3d', false);
  rrect(-13, -86, 26, 50, 10, inf ? '#5b4b8a' : c);
  if (inf) { limb([[4, -78], [30, -76]], 8, '#8fbf7a', false); limb([[2, -70], [28, -66]], 8, '#6c9a5e', false); }
  else { limb([[0, -78], [-14 * k, -56]], 7, '#f1c9a5', false); limb([[0, -78], [14 * k, -56]], 7, '#f1c9a5', false); }
  ell(0, -100, 13, 14, inf ? '#8fbf7a' : '#f1c9a5');
  if (!inf) ell(0, -110, 13, 7, '#3a2a1e');
  g.restore();
}
function streetCard(t, a) {
  const k = clamp(sp(t, T.street, 2.4, 8)) * (1 - seg(T.c2 - 0.35, T.c2 - 0.05, t)) + (a.choice ? clamp(sp(t, T.c6, 2.4, 8)) * (1 - seg(T.c7 - 0.1, T.c7 + 0.2, t)) : 0);
  if (k <= 0.01) return;
  const { x, y, w, h } = STREET;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save();
  g.translate(x + w / 2, y + h / 2); g.scale(lerp(0.9, 1, clamp(k)), lerp(0.9, 1, clamp(k))); g.translate(-(x + w / 2), -(y + h / 2)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(x - 12, y - 12, w + 24, h + 24, 34, '#f2efe6'); g.restore();
  inside(rrPath(x, y, w, h, 26), () => {
    rect(x, y, w, h, '#7e8a8f');                                         // the road seen from above at a slant
    rect(x, y, w, h * 0.22, '#b9b1a2'); rect(x, y + h * 0.22, w, 10, '#8f877c');
    rect(x, y + h * 0.93, w, h * 0.07, '#b9b1a2');
    for (let i = 0; i < 8; i++) rect(x + ((i * 150 - t * 20) % (w + 150)) - 40, y + h * 0.6, 80, 10, '#e9e4d8');
    for (let i = 0; i < 6; i++) { const tx = x + 40 + i * 170; ell(tx, y + h * 0.1, 46, 40, '#5fa05a'); ell(tx - 14, y + h * 0.08, 28, 22, '#79b86d'); }
    // the car whose alarm goes off: its lights blink
    const cx = x + 700, cy = y + h * 0.36;
    rrect(cx - 90, cy - 40, 180, 80, 20, '#d9433b'); rrect(cx - 50, cy - 30, 100, 60, 14, '#9fd0ff');
    const al = t > T.alarm && t < T.c2 + 1 && Math.floor(t * 6) % 2 === 0;
    for (const dx of [-88, 88]) for (const dy of [-30, 30]) ell(cx + dx, cy + dy, 12, 10, al ? '#ffd23f' : '#f2e6b0');
    if (al) { ell(cx, cy, 150, 110, 'rgba(255,210,63,0.18)'); }
    // people running right; the infected after them, turning to the car when the alarm sounds
    const tt = t - T.street;
    for (const p of PEOPLE) { const px = x - 60 + ((p.x0 + tt * p.v) % (w + 160)); mini(px, y + h * p.y, 1.25, t, p.x0, p.c, false, 1); }
    for (const z of INF) {
      let zx = x - 120 + ((z.x0 + tt * z.v * 0.85) % (w + 240)), zy = y + h * z.y, face = 1;
      const turn = seg(T.alarm, T.alarm + 0.8, t);
      if (turn > 0 && !a.choice) { zx = lerp(zx, cx + (z.x0 % 120) - 60, turn * 0.6); zy = lerp(zy, cy + 60, turn * 0.6); face = zx < cx ? 1 : -1; }
      mini(zx, zy, 1.25, t * 0.8, z.x0, '', true, face);
    }
  });
  g.lineWidth = 4; g.strokeStyle = '#17162f'; g.stroke(rrPath(x, y, w, h, 26));
  rrect(x + 24, y + 22, measure('ВИД ИЗ ОКНА · 20 ЭТАЖ', 32, FONTS.mono) + 40, 52, 12, 'rgba(11,15,26,0.85)');
  Hd.label('ВИД ИЗ ОКНА · 20 ЭТАЖ', x + 44, y + 59, 32, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  g.restore();
}

// —— frame ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
export function frame(t) {
  if (scene(t) === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  set(t, a);
  if (a.d && a.dogBack) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (a.d && !a.dogBack) { const d = lieDog(a.d); if (d.clip) inside(rrPath(d.x - 400, -800, 800, 800, 0), () => drawDog(d)); else drawDog(d); }
  if (a.blanket) blanket(t, a);
  // the light: lamp on, then off — the flat in the cold morning light from the window only
  const dark = a.dark ?? 0;
  if (dark > 0.01) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
    dk.fillStyle = `rgba(12,18,36,${0.5 * dark})`; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
    const [wx, wy] = toScreen(cam, [(Ap.WIN.x0 + Ap.WIN.x1) / 2, (Ap.WIN.y0 + Ap.WIN.y1) / 2]), rr = 700 * scaleOf(cam);
    const gr = dk.createRadialGradient(wx, wy, 0, wx, wy, rr); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    dk.fillStyle = gr; dk.beginPath(); dk.arc(wx, wy, rr, 0, TAU); dk.fill();
    g.drawImage(DK, 0, 0);
  }
  overlays(t, cam, a);
  streetCard(t, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.8);
}
// the dog lying down: the sitting rig lowered (dog.js has no lying pose)
function lieDog(d) { if (!d.lie) return d; return { ...d, sit: lerp(1, 0, d.lie), y: (d.y ?? 0) + 62 * d.lie, clip: true }; }
function set(t, a) {
  Ap.drawShell(t, { power: true, lampOn: (a.lamp ?? 0) > 0.5 });
  Ap.drawWindow(t, { day: 1 });
  Ap.drawTub(t, a.tub ?? { level: 0.05 });
  Ap.drawToilet(t, {});
  Ap.drawFridge(t);
  Ap.drawCounter(t, { fills: a.fills ?? [0, 0, 0, 0, 0], run: a.run ?? 0 });
  // the light switch
  rrect(SWITCH[0] - 18, SWITCH[1] - 26, 36, 52, 6, '#f6f3ec'); rrect(SWITCH[0] - 8, SWITCH[1] - 16 + ((a.lamp ?? 1) > 0.5 ? 0 : 14), 16, 18, 4, '#c9c2b0');
  mattress(t, a);
  hall(t, a);
  // the light cone of the ceiling lamp while it is on
  if ((a.lamp ?? 0) > 0.5) fill(polyPath([[Ap.LAMP[0] - 40, Ap.ROOM.ceil + 120], [Ap.LAMP[0] + 40, Ap.ROOM.ceil + 120], [Ap.LAMP[0] + 260, 0], [Ap.LAMP[0] - 260, 0]]), 'rgba(255,241,192,0.12)');
}

// —— everything over the picture ——
function timer(t) {
  if (t < T.clock || t > T.c6 + 0.4) return;
  const k = clamp(sp(t, T.clock, 2.6, 8)) * (1 - seg(T.c6, T.c6 + 0.4, t)), r = remaining(t), done = t >= T.c5;
  if (k <= 0.01) return;
  const mm = Math.floor(r / 60), ss = Math.floor(r % 60), str = done ? 'УСПЕЛ' : `0${mm}:${ss < 10 ? '0' : ''}${ss}`;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 1020, y = 150, w = 300, h = 110;
  rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)');
  g.save(); g.lineWidth = 3; g.strokeStyle = done ? OK : DANGER; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17)); g.restore();
  Hd.label('ПЕРВЫЕ 5 МИНУТ', x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(str, x - w / 2, y + 36, 54, done ? OK : (r < 60 && Math.floor(t * 3) % 2 ? '#ff8a80' : '#ffffff'), { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, '07:12 — УТРО');
  timer(t);
  if (t >= T.c1 && t < T.c2) Hd.plaque(t, T.alarm + 0.1, T.c2 - 0.4, 540, 1100, { icon: 'x', title: 'ИДУТ НА ШУМ', sub: 'сигнализация, крик, музыка', color: DANGER });
  Hd.ribbon(t, T.clock, T.c2 - 0.1, 'ПЕРВЫЕ МИНУТЫ', { y: 330, size: 92, rot: -0.08 });
  // step 1
  Hd.stepHeader(t, 1, 'НЕ ВЫХОДИ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, T.push + 0.5, T.c3 - 0.02, 540, 520, { icon: 'check', title: 'КЛЮЧ И ШКАФ', sub: 'дверь не выбить', color: OK });
  // step 2
  Hd.stepHeader(t, 2, 'НИ СВЕТА, НИ ЗВУКА', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, T.mute + 0.1, T.c4 - 0.02, 540, 520, { icon: 'phone', title: 'БЕЗ ЗВУКА', sub: 'и без вибрации', color: GOLD });
  // step 3
  Hd.stepHeader(t, 3, 'ВОДА, ПОКА ТЕЧЁТ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) Hd.plaque(t, A.L4w2 + 0.1, T.c5 - 0.02, 540, 520, { icon: 'drop', title: '≈ 4 ЛИТРА В ДЕНЬ', sub: 'на человека', color: GOLD });
  // the twist
  if (t >= T.dog && t < T.c6) Hd.plaque(t, T.dog + 0.5, T.c6 - 0.02, 540, 520, { icon: 'check', title: 'ПУРГА НА ПОСТУ', sub: 'собака слышит раньше', color: WARM });
  // the end
  if (t >= T.c6) {
    const opts = [['1', 'ОСТАТЬСЯ'], ['2', 'УХОДИТЬ']];
    opts.forEach(([n, s], i) => {
      const t0 = A.L6w2 + i * 0.5, k = clamp(sp(t, t0, 2.6, 8));
      if (k <= 0.01) return;
      const x = 300 + i * 480, y = 1070, w = measure(s, 50, FONTS.cond) + 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(n, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c7) Hd.plaque(t, A.L7w1 - 0.1, DUR + 1, 540, 620, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 2 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L7w12 - 0.1, 0, 300 + (t >= T.c7 ? 0 : 0));
}

// —— the poster: him at the window, the street card with the infected, the title ——
function coverFrame(t) {
  const cam = { x: 600, y: -170, z: 1.24, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const a = { lamp: 0, ward: 0 };
  set(1.0, a);
  const o = stand(base(1, { face: 1, look: [0.7, -0.8], brow: 1, pop: 1, mouth: 0.4, blink: 0, headTilt: -0.15 }), 560);
  drawHunter(o);
  drawDog({ x: 760, y: 0, s: DS, face: -1, sit: 1, t: 0, ears: 1, look: 0.6 });
  streetCard(T.alarm - 0.3, { choice: true });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 130); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.save(); g.translate(540, 1240);
  g.save(); g.shadowColor = 'rgba(122,214,90,0.8)'; g.shadowBlur = 40; Hd.label('ЗАРАЖЕНИЕ', 0, 0, 150, '#8fdc6a', { shadow: false, strokeW: 12 }); g.restore();
  const pl = 'ПЕРВЫЕ 5 МИНУТ · СЕРИЯ 1', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw / 2 + 8, 50 + 8, pw, 84, INK); rect(-pw / 2, 50, pw, 84, '#ffd43b'); text(pl, 0, 108, 48, '#111111', { fam: FONTS.cond, shadow: false });
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
  add(0.3, 'amb_flat', -26, 0, { dur: DUR - 0.3 });
  add(0.3, 'screams', -10, 0.5, { dur: T.c2 - 0.3 });
  add(T.wake, 'stamp', -10, 0);
  add(T.street, 'whoosh_in', -12, 0.3);
  add(T.street + 0.3, 'groans', -14, 0.5, { dur: T.c2 - T.street });
  add(T.alarm, 'car_alarm', -10, 0.6, { dur: T.c2 - T.alarm + 0.5 });
  add(T.clock, 'ribbon', -8, 0); add(T.clock, 'stamp', -8, 0);
  add(T.key, 'click', -6, 0.2); add(T.key + 0.15, 'click', -8, 0.2);
  add(T.push, 'scrape', -6, 0.2, { dur: 0.9 });
  add(T.push + 0.9, 'thud', -6, 0.2);
  add(T.push + 0.5, 'blip', -12, 0);
  add(T.off, 'toggle', -6, 0.1);
  add(T.mute, 'blip', -10, 0);
  add(T.c4 + 0.1, 'tap_squeak', -12, -0.5);
  add(T.c4 + 0.2, 'tap_run', -10, -0.5, { dur: T.bottles - T.c4 - 0.2 });
  add(T.bottles + 0.15, 'tap_run', -12, 0.1, { dur: T.c5 - T.bottles - 0.2 });
  for (let i = 0; i < 3; i++) add(T.bottles + 0.3 + i * (T.c5 - T.bottles - 0.4) / 3, 'fill_plink', -14, 0.1);
  add(T.c5, 'ding', -10, 0);
  add(T.dog + 0.6, 'groans', -22, 0.4, { dur: T.c6 - T.dog - 0.6 });
  add(T.dog + 0.8, 'steps_out', -18, 0.4, { dur: T.c6 - T.dog - 0.8 });
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(T.c6 + 0.1, 'whoosh_in', -12, 0);
  for (let i = 0; i < 2; i++) add(A.L6w2 + i * 0.5, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L7w1 - 0.1, 'blip', -8, 0);
  add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
