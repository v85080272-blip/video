// «Шаги ночью» («Квартира под защитой», ч.4): the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The same hunter and dog; new here: the bedroom in section with the hall beyond its wall (the bed, the bedside phone,
// the bedroom door with a bolt, the chair under its handle), the torch beam sweeping under the door, two dark figures
// in the hall, the phone dialling 112 with the address, the police lights through the window and the dog's bark.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.81, 13], L1: [5.21, 10.29, 19], L2: [10.69, 13.27, 9], L3: [13.72, 17.2, 9], L4: [17.61, 21.4, 10], L5: [21.8, 26.14, 11], L6: [26.59, 32.81, 17], L7: [33.27, 37.94, 13] };
export const DUR = VOICE?.dur ?? 38.29;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { НОЧИ: GOLD, ХОДИТ: DANGER, НАДО: DANGER, СКОЛЬКО: DANGER, РУКАХ: DANGER, ЦЕЛЫМ: OK, ЗАПРИСЬ: GOLD, ТЯЖЁЛЫМ: GOLD,
  ТИХО: GOLD, ДВЕНАДЦАТЬ: GOLD, АДРЕС: GOLD, ОСТАВАЙСЯ: GOLD, ВЫХОДИТЬ: GOLD, СБЕЖАЛ: OK, ЗАЛАЯЛА: WARM, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  wake: A.L0w4 - 0.06,               // «Ты просыпаешься»
  c1: A.L1 - 0.06,                   // «Первая мысль — выйти…»: the hall beyond the wall, two figures
  no: A.L1w6 - 0.05,                 // «Не надо»
  c2: A.L2 - 0.06,                   // «Твоя задача…»
  c3: A.L3 - 0.06,                   // step 1: the bolt, the chair
  bolt: A.L3w1 - 0.05,
  chair: A.L3w5 - 0.06,
  c4: A.L4 - 0.06,                   // step 2: 112, the address
  c5: A.L5 - 0.06,                   // step 3: waiting
  c6: A.L6 - 0.06,                   // the police; the bark
  bark: A.L6w10 - 0.06,
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c1, T.c3, T.c4, T.c6, T.c7];
export const SNAPS = [T.wake];
export const MARKS = { ...T, A };
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
// the room: the bed on the left, the bedroom door at x 380, the hall beyond the wall x 460…1200
const ROOM = { x0: -700, wall: 440, x1: 1300, ceil: -760 };
const DOORB = { x0: 220, x1: 420, top: -560 };
shot(T.cover, [[T.cover, -180, -300, 1.4], [T.wake, -200, -300, 1.5], [T.c1, -160, -300, 1.5]]);
shot(T.c1, [[T.c1, 360, -330, 0.95], [T.no, 380, -330, 1.0], [T.c2, 340, -330, 0.98], [T.c3, 260, -330, 1.0]]);
shot(T.c3, [[T.c3, 260, -300, 1.5], [T.c4, 270, -300, 1.55]]);
shot(T.c4, [[T.c4, 0, -240, 1.4], [T.c6, 10, -240, 1.45]]);
shot(T.c6, [[T.c6, 300, -330, 0.95], [T.bark, 320, -320, 1.0], [T.c7, 300, -320, 1.02]]);
shot(T.c7, [[T.c7, 0, -300, 1.1], [DUR, 10, -305, 1.15]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.wake, 7], [T.no, 8], [T.chair, 5], [T.bark, 9]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// night: the striped vest, no hat
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function sitOn(o, x, y) { const k = (o.s ?? S) / S; o.hip = [x, y]; o.feet = { near: [x + 70 * k, 0], far: [x + 92 * k, 0] }; o.lean = -0.02; return o; }
function sitFloor(o, x) { const k = (o.s ?? S) / S; o.hip = [x, -30 * k]; o.feet = { near: [x + 118 * k, 0], far: [x + 140 * k, 0] }; o.lean = -0.08; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
// the two figures in the hall: dark, one with a torch; they run off to the right after the bark
function figures(t) {
  const run = seg(T.bark + 0.2, T.bark + 1.2, t, u => u * u);
  if (run >= 1) return;
  MONO.on = true; MONO.color = '#141821';
  for (const [x0, face, i] of [[600, -1, 0], [790, -1, 1]]) {
    const x = x0 + 900 * run;
    const f = stand({ s: 0.62, face: run > 0.02 ? 1 : face, lean: 0.1 + 0.2 * run, look: [0.6, 0], hat: true, jacket: true, boots: true, pack: i === 1, blink: 0 }, x);
    drawHunter(f);
  }
  MONO.on = false;
}

export function actorsAt(t) {
  if (scene(t) !== 'room') return {};
  // —— asleep, then awake: sitting up in bed ——
  if (t < T.c3) {
    const up = seg(T.wake, T.wake + 0.4, t);
    const o = sitOn(base(t, { look: [0.8, 0], brow: lerp(0, 0.9, up), lid: lerp(1, 0.1, up), pop: 0.8 * up * (1 - seg(T.wake + 1.2, T.wake + 2, t)), blink: up < 0.3 ? 1 : blinkAt(t) }), -300, -200);
    o.lean = lerp(-0.6, 0.02, up);
    if (t > T.c1 && t < T.no + 0.1) { o.lean = 0.15; const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 90, sh[1] + 20], shape: 'open' } }; }
    const d = { x: -40, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: up < 0.5 ? 1 : dblink(t), ears: up > 0.5 ? 1 : 0.1 };
    return { h: o, d, blanket: true };
  }
  // —— step 1: the bolt, the chair under the handle ——
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.6, 0], brow: 0.7, lean: 0.12 }), 120);
    const sh = shoulder(o);
    o.hands = { near: { p: t < T.chair ? [DOORB.x0 + 40, -320] : [sh[0] + 80, sh[1] + 140], shape: 'grip' } };
    const d = { x: -200, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1 };
    return { h: o, d, bolt: seg(T.bolt, T.bolt + 0.3, t), chair: seg(T.chair - 0.2, T.chair + 0.4, t) };
  }
  // —— steps 2–3: on the floor behind the bed with the dog, the phone ——
  if (t < T.c6) {
    const o = sitFloor(base(t, { look: [0.7, 0.5], brow: 0.5, headTilt: 0.16 }), -120);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 92, sh[1] + 40], shape: 'grip' }, far: { p: [sh[0] + 80, sh[1] + 54], shape: 'point' } };
    o.prop = { kind: 'phone', p: [sh[0] + 96, sh[1] + 16] };
    if (t < T.c5) o.mouth = 0.15 + 0.1 * Math.abs(Math.sin(t * 10));
    const d = { x: 160, y: 0, s: DS, face: -1, sit: 1, look: 0.4, t, blink: dblink(t), ears: 1 };
    return { h: o, d, bolt: 1, chair: 1 };
  }
  // —— the bark; the figures run; the police lights; the end ——
  const o = sitFloor(base(t, { look: [0.8, 0], brow: 0.6 }), -120);
  if (t > T.c7) { const o2 = stand(base(t, { look: [0.8, 0], brow: 0.6, mouth: 0.35 }), -60); const sh = shoulder(o2), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o2.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; return { h: o2, d: { x: 140, y: 0, s: DS, face: -1, sit: 1, look: 0.4, mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3, t, blink: dblink(t) }, bolt: 1, chair: 1, police: true }; }
  const bark = t > T.bark && t < T.bark + 1.6;
  const d = { x: 140, y: 0, s: DS, face: 1, sit: bark ? 0 : 1, look: 0.4, mouth: bark ? 0.4 + 0.6 * Math.abs(Math.sin(t * 14)) : 0.2, tongue: 0, t, blink: dblink(t), ears: 1, brow: bark ? -0.7 : null };
  return { h: o, d, bolt: 1, chair: 1, police: t > A.L6w2 };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.35); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#5a7fa8'); g.restore(); };
  return drawHunter(o);
}

// —— the room in section ——
function room(t, a) {
  const { x0, wall, x1, ceil } = ROOM;
  rect(x0, ceil, wall - x0, -ceil, '#3c4a6a'); rect(wall + 40, ceil, x1 - wall - 40, -ceil, '#4a4f5c');      // bedroom / hall walls
  rect(x0, 0, x1 - x0, 140, '#5a4636'); rect(wall, ceil, 40, -ceil, '#2a2d38');                                // floor, the wall between
  // the window with the night city; police lights flashing in it later
  const W0 = { x0: -560, x1: -300, y0: -620, y1: -360 };
  rect(W0.x0 - 16, W0.y0 - 16, W0.x1 - W0.x0 + 32, W0.y1 - W0.y0 + 32, '#d9d6cf'); rect(W0.x0, W0.y0, W0.x1 - W0.x0, W0.y1 - W0.y0, '#0b1222');
  for (let i = 0; i < 12; i++) ell(W0.x0 + hash(i * 3.1) * 260, W0.y0 + 40 + hash(i * 5.7) * 200, 3, 3, '#ffd58a');
  if (a.police) { const ph = Math.floor(t * 4) % 2; rect(W0.x0, W0.y0, W0.x1 - W0.x0, W0.y1 - W0.y0, ph ? 'rgba(60,120,255,0.45)' : 'rgba(255,60,60,0.35)'); }
  // the bed: frame, mattress, pillow, the blanket (over him when he's in it)
  rect(-680, -200, 520, 140, '#7a5434'); rect(-690, -360, 30, 360, '#7a5434'); rrect(-670, -240, 500, 50, 12, '#e9e4d8'); rrect(-660, -290, 150, 60, 20, '#f6f2e7');
  // the bedside table and the lamp (off)
  rect(-140, -200, 110, 200, '#9d6c43'); ell(-85, -230, 30, 16, '#c9c2b0');
  // the bedroom door: wood, the bolt, the handle; the gap under it where the torch beam sweeps
  rect(DOORB.x0 - 16, DOORB.top - 16, DOORB.x1 - DOORB.x0 + 32, -DOORB.top + 16, '#2c2620');
  rrect(DOORB.x0, DOORB.top, DOORB.x1 - DOORB.x0, -DOORB.top - 8, 4, '#8a6a4a');
  rrect(DOORB.x0 + 20, DOORB.top + 30, DOORB.x1 - DOORB.x0 - 40, 200, 6, '#7a5c3e'); rrect(DOORB.x0 + 20, DOORB.top + 260, DOORB.x1 - DOORB.x0 - 40, 230, 6, '#7a5c3e');
  ell(DOORB.x0 + 34, -300, 12, 12, '#c9d0d6'); rect(DOORB.x0 + 14, -302, 40, 6, '#c9d0d6');
  const b = a.bolt ?? 0; rect(DOORB.x0 + 20, -360, 50, 16, '#9aa3ad'); rect(DOORB.x0 + 20 - 40 * b, -356, 30, 8, '#c9d0d6');
  const sweep = t > T.cover && t < T.bark + 1.2;
  if (sweep) { const u = 0.5 + 0.5 * Math.sin(t * 2.2); rect(DOORB.x0, -8, DOORB.x1 - DOORB.x0, 8, rgba('#ffe7a8', 0.4 + 0.5 * u)); }
  // the chair under the handle
  const c = a.chair ?? 0;
  if (c > 0.01) { g.save(); g.translate(lerp(-20, DOORB.x0 + 10, c), 0); g.rotate(-0.5 * c); limb([[0, 0], [0, -260]], 12, '#6e4b2e', false); limb([[90, 0], [90, -140]], 12, '#6e4b2e', false); rect(-6, -150, 106, 16, '#8a5f36'); limb([[0, -260], [-20, -400]], 12, '#6e4b2e', false); g.restore(); }
  // the hall beyond the wall: the two figures, the torch cone
  if (t < T.bark + 1.2) {
    figures(t);
    const run = seg(T.bark + 0.2, T.bark + 1.2, t);
    const tx = 600 + 900 * run, a0 = Math.PI + 0.3 * Math.sin(t * 1.3);
    fill(polyPath([[tx - 40, -260], [tx - 40 + Math.cos(a0 - 0.3) * 600, -260 + Math.sin(a0 - 0.3) * 600 + 300], [tx - 40 + Math.cos(a0 + 0.3) * 600, -260 + Math.sin(a0 + 0.3) * 600 + 300]]), 'rgba(255,231,168,0.18)');
  }
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
  room(t, a);
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (a.blanket) { fill(smoothPath([[-680, -300], [-200, -310], [-150, -200], [-680, -190]]), '#3c7ad6'); for (let i = 0; i < 6; i++) rect(-660 + i * 80, -300, 20, 100, 'rgba(255,255,255,0.15)'); }
  if (a.behind) { rect(-680, -200, 520, 140, '#7a5434'); rrect(-670, -240, 500, 50, 12, '#e9e4d8'); }
  // the night: a dark veil, lighter round the window and the phone
  g.setTransform(1, 0, 0, 1, 0, 0);
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = 'rgba(4,7,17,0.62)'; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
  const hole = (p, r, k) => { const [x, y] = toScreen(cam, p), rr = r * scaleOf(cam); const gr = dk.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, rr, 0, TAU); dk.fill(); };
  hole([-430, -490], 420, 0.6); hole([320, -40], 260, 0.5);
  if (a.h?.prop?.kind === 'phone') hole(a.h.prop.p, 300, 0.7);
  if (a.h) hole([a.h.hip[0] + 30, a.h.hip[1] - 150], 380, 0.45);
  g.drawImage(DK, 0, 0);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c6 - 0.1, '03:07 — НОЧЬ');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, '03:17 — НОЧЬ');
  if (t >= T.c1 && t < T.c2) {
    { const p = S2([DOORB.x0 + 100, -300]); Hd.redX(p[0], p[1], 80, sp(t, T.no, 2.6, 8)); }
    Hd.plaque(t, A.L1w11 - 0.08, T.c2 - 0.05, 540, 330, { icon: 'x', title: 'СКОЛЬКО ИХ?', sub: 'и что у них в руках', color: DANGER, to: S2([820, -400]) });
  }
  Hd.ribbon(t, T.no, A.L1w11 - 0.15, 'НЕ ВЫХОДИ', { y: 760, size: 100 });
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, A.L2w6 - 0.08, T.c3 - 0.05, 540, 330, { icon: 'check', title: 'ГЛАВНОЕ — ТЫ ЦЕЛ', sub: 'а не пойманный вор', color: OK });
  // step 1
  Hd.stepHeader(t, 1, 'ЗАПРИСЬ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, T.chair + 0.3, T.c4 - 0.02, 540, 560, { icon: 'check', title: 'ЗАДВИЖКА И СТУЛ', sub: 'под ручку двери', color: OK });
  // step 2
  Hd.stepHeader(t, 2, 'ТИХО: 112', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) dialCard(t, 720, 760);
  // step 3
  Hd.stepHeader(t, 3, 'ЖДИ ПОЛИЦИЮ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) Hd.plaque(t, A.L5w5 - 0.08, T.c6 - 0.02, 540, 560, { icon: 'clock', title: 'НЕ ВЫХОДИ', sub: 'пока полиция не скажет', color: GOLD });
  // the twist
  if (t >= T.bark && t < T.c7) Hd.plaque(t, T.bark + 0.3, T.c7 - 0.02, 540, 330, { icon: 'check', title: 'ГАВ!', sub: 'вор сбежал от Пурги', color: WARM, size: 56 });
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'СПАЛЬНЯ ЗАПИРАЕТСЯ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// step 2: the phone, 112 and the whispered address
function dialCard(t, cx, cy) {
  const k = clamp(sp(t, T.c4 + 0.1, 2.4, 8)) * (1 - seg(T.c5 - 0.25, T.c5 - 0.02, t));
  if (k <= 0.01) return;
  const w = 380, h = 580;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, '#101828');
  const n = Math.min(3, Math.floor(Math.max(0, t - A.L4w3 + 0.2) / 0.16) + (t > A.L4w3 - 0.2 ? 1 : 0));
  Hd.label('112'.slice(0, n), 0, -150, 92, '#ffffff', { shadow: false, stroke: false });
  if (t > A.L4w6) { ell(0, -40, 26, 26, '#2f8f4e'); Hd.label('вызов идёт', 0, 20, 30, '#9fe8b8', { fam: FONTS.mono, shadow: false, stroke: false }); }
  if (t > A.L4w8 - 0.1) { rrect(-150, 70, 300, 120, 18, 'rgba(255,255,255,0.1)'); Hd.label('ул. Лесная, 5,', 0, 120, 32, '#ffffff', { fam: FONTS.cond, shadow: false, stroke: false }); Hd.label('кв. 80', 0, 165, 32, '#ffffff', { fam: FONTS.cond, shadow: false, stroke: false }); }
  Hd.label('яркость — на минимум', 0, h / 2 - 60, 24, '#5a6a86', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}

// —— the poster: him sitting up in bed, the light under the door, the dog's ears up ——
function coverFrame(t) {
  const cam = { x: -120, y: -300, z: 1.45, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  room(1.0, { bolt: 0, chair: 0 });
  drawDog({ x: -20, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t: 0, ears: 1 });
  const o = sitOn(base(t, { look: [0.9, 0], brow: 1, pop: 1, mouth: 0.3, blink: 0 }), -300, -200);
  drawHunter(o);
  fill(smoothPath([[-680, -300], [-200, -310], [-150, -200], [-680, -190]]), '#3c7ad6');
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,7,17,0.45)'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ШАГИ', 0, 200, 140, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('НОЧЬЮ', 0, 350, 130, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'КВАРТИРА ПОД ЗАЩИТОЙ · 4', pw = measure(pl, 48, FONTS.cond) + 60;
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
  add(0.3, 'amb_flat', -24, 0, { dur: T.c6 - 0.3 });
  add(0.3, 'crowd_steps', -26, 0.5, { dur: T.wake - 0.3 + 1.5 });
  add(T.wake, 'stamp', -8, 0);
  add(T.c1, 'crowd_steps', -24, 0.6, { dur: T.c3 - T.c1 });
  add(T.no, 'stamp', -5, 0); add(T.no, 'ribbon', -8, 0);
  add(A.L1w11 - 0.08, 'blip', -10, 0.3);
  add(A.L2w6 - 0.08, 'ding', -12, 0);
  add(T.bolt + 0.1, 'click', -6, 0.3);
  add(T.chair + 0.2, 'stamp', -10, 0.3);
  for (let i = 0; i < 3; i++) add(A.L4w3 - 0.2 + i * 0.16, 'click', -14, 0);
  add(A.L4w8 - 0.1, 'paper', -16, 0, { dur: 0.3 });
  add(A.L5w5 - 0.08, 'blip', -12, 0);
  add(T.bark, 'whine', -4, 0.2, { dur: 1.4 });
  add(T.bark + 0.1, 'stamp', -8, 0.2);
  add(T.bark + 0.3, 'crowd_steps', -16, 0.8, { dur: 1.0 });
  add(A.L6w2, 'blip', -10, -0.4);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
