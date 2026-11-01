// «Звонок в дверь» («Квартира под защитой», ч.2): the whole short as pure functions of time t (seconds), so any frame
// or motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The landing and the neighbour from part 1 (landing.js); new here: our hall seen from inside (the door's inner face,
// the chain, the peephole), the view through the peephole as a fish-eye circle, the «gas man» in uniform with his ID,
// his partner by the lift, the gas bill with the service's number, the phone dialling 112.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Ld from './landing.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.36, 12], L1: [4.75, 11.8, 17], L2: [12.21, 14.93, 8], L3: [15.38, 19.62, 11], L4: [20.02, 25.02, 16], L5: [25.42, 31.43, 16], L6: [31.88, 37.09, 17], L7: [37.55, 41.44, 10] };
export const DUR = VOICE?.dur ?? 41.79;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ГЛАЗОК: GOLD, ФОРМЕ: DANGER, ТРЕБУЕТ: DANGER, КРАЖИ: DANGER, ДРУГОЙ: DANGER, ДЕНЬГИ: DANGER, ПОДОЖДЁТ: OK,
  СРАЗУ: DANGER, ЦЕПОЧКУ: GOLD, САМ: GOLD, КВИТАНЦИИ: GOLD, ГОСТЬ: DANGER, СОМНЕВАЕШЬСЯ: GOLD, ДВЕНАДЦАТЬ: GOLD,
  ИСЧЕЗ: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster: the fish-eye
  ring: 0.45,                        // the bell
  peep: A.L0w3 - 0.06,               // «В глазок видно…»: the fish-eye
  c1: A.L1 - 0.06,                   // «Он требует открыть сразу…»: the landing, his ID; the partner by the lift
  two: A.L1w11 - 0.06,                // «пока один отвлекает, другой ищет деньги»
  c2: A.L2 - 0.06,                   // «настоящий мастер подождёт»
  c3: A.L3 - 0.06,                   // step 1: the chain
  c4: A.L4 - 0.06,                   // step 2: the bill and the phone
  c5: A.L5 - 0.06,                   // step 3: not opening; 112
  dial: A.L5w13 - 0.06,
  c6: A.L6 - 0.06,                   // the landing empty; the dog growls at the door
  growl: A.L6w10 - 0.06,
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.peep, T.c1, T.c2, T.c3, T.c4, T.c6, T.growl, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.peep ? 'hall' : t < T.c1 ? 'peep' : t < T.c3 ? 'landing' : t < T.c4 ? 'hall' : t < T.c6 ? 'hall' : t < T.growl ? 'peep' : 'hall');

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
shot(T.cover, [[T.cover, -80, -300, 1.2], [T.peep, -60, -310, 1.3]]);
shot(T.peep, [[T.peep, 0, -330, 1.0], [T.c1, 0, -330, 1.05]]);
shot(T.c1, [[T.c1, 60, -320, 1.25], [T.two - 0.2, 80, -320, 1.3], [T.two + 0.5, -420, -320, 1.1], [T.c2, -380, -320, 1.12], [T.c3, 40, -320, 1.25]]);
shot(T.c3, [[T.c3, -60, -320, 1.45], [T.c4, -50, -320, 1.5]]);
shot(T.c4, [[T.c4, -60, -310, 1.3], [T.c6, -60, -310, 1.34]]);
shot(T.c6, [[T.c6, 0, -330, 1.0], [T.growl, 0, -330, 1.05]]);
shot(T.growl, [[T.growl, -100, -150, 1.8], [T.c7, -110, -150, 1.9]]);
shot(T.c7, [[T.c7, -60, -300, 1.25], [DUR, -50, -305, 1.3]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.ring, 5], [A.L5w3 - 0.05, 6]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// at home: the striped vest, no hat
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
// the «gas man»: a dark figure in uniform with a cap; o.id holds his card up; the partner is another dark figure
function stranger(t, x, face, o = {}) {
  MONO.on = true; MONO.color = o.color ?? '#2d3a5a';
  const f = stand({ s: o.s ?? 0.62, face, lean: o.lean ?? 0.06, look: [0.6 * face, 0], hat: true, jacket: true, boots: true, pack: false, blink: 0 }, x);
  const sh = framesOf(f).T.p([-14, -192]);
  if (o.id) f.hands = { near: { p: [sh[0] + 110 * face, sh[1] - 40 + 6 * Math.sin(t * 6)], shape: 'grip' } };
  drawHunter(f);
  MONO.on = false;
  if (o.id) { const p = f.hands.near.p; rrect(p[0] - 36, p[1] - 70, 72, 50, 6, '#f6f2e7'); rect(p[0] - 28, p[1] - 62, 20, 26, '#9aa6b8'); rect(p[0] - 2, p[1] - 58, 30, 5, '#5d6570'); rect(p[0] - 2, p[1] - 46, 22, 5, '#5d6570'); }
  if (o.folder) rrect(sh[0] - 30, sh[1] + 60, 70, 90, 6, '#3c7ad6');
}

// the hall inside the flat: the door's inner face with the chain, a coat rack; t-dependent: chain on, door ajar on it
const HALL = { door: { x0: -140, x1: 140, top: -580 } };
function hallScene(t, o = {}) {
  const D = HALL.door;
  rect(-1100, -760, 2200, 760, '#e9dcc0');
  for (let y = -720; y < 0; y += 80) for (let x = -1080 + ((y / 80) % 2) * 40; x < 1100; x += 80) ell(x, y, 5, 5, '#d8c6a0');
  rect(-1100, -30, 2200, 30, '#dccba8'); rect(-1100, 0, 2200, 140, '#a9876a');
  // the coat rack with his jacket and hat
  rect(-640, -560, 260, 16, '#9d6c43'); for (let i = 0; i < 4; i++) ell(-610 + i * 70, -540, 10, 10, '#7a5434');
  fill(smoothPath([[-600, -540], [-520, -540], [-500, -300], [-620, -300]]), '#d9762b'); ell(-440, -560, 50, 34, '#a8794a');
  // the door from inside: light leatherette, the chain, the locks' thumb-turns, the peephole
  rect(D.x0 - 22, D.top - 22, D.x1 - D.x0 + 44, -D.top + 22, '#3e3a3a');
  const gap = o.gap ?? 0;
  if (gap > 0.5) { rect(D.x1 - gap, D.top, gap, -D.top, '#d9d0bc'); }
  rrect(D.x0, D.top, D.x1 - D.x0 - gap, -D.top, 6, '#c9b08a');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) rrect(D.x0 + 26 + j * 120, D.top + 30 + i * 136, 100, 116, 10, '#bea47e');
  ell(0, -430, 12, 12, '#2c2c34'); ell(0, -430, 7, 7, o.peepLit ? '#ffe7a8' : '#4a5064');
  for (const [lx, ly] of Ld.LOCKS) { rrect(lx - gap - 14, ly - 18, 28, 36, 8, '#c9d0d6'); rect(lx - gap - 2, ly - 14, 4, 28, '#3a3f4a'); }
  // the chain: its track on the frame, the links to the door
  rect(D.x1 + 4, -470, 14, 60, '#9aa3ad');
  const on = o.chain ?? 0;
  if (on > 0.01) { const end = [lerp(D.x1 + 10, D.x1 - 40 - gap, on), -440]; const from = [D.x1 - 40 - gap, -440]; for (let i = 0; i <= 6; i++) { const u = i / 6, sag = gap > 0.5 ? 0 : 14 * bump(u); ell(lerp(from[0], end[0] + 50 * (1 - on), u), lerp(from[1], end[1], u) + sag, 7, 5, '#c9d0d6'); } }
  else limb([[D.x1 - 40, -440], [D.x1 - 30, -380], [D.x1 - 20, -330]], 5, '#c9d0d6');
}

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'landing') {
    const lean = t < T.c2 ? 0.12 + 0.04 * Math.sin(t * 5) : 0.04;
    return { gas: { x: 220, face: -1, id: true, lean, folder: true }, partner: t > T.two ? { x: -560, face: 1 } : null };
  }
  if (sc !== 'hall') return {};
  // —— the hook: from the kitchen side to the door, then to the peephole ——
  if (t < T.peep) {
    const o = stand(base(t, { look: [0.6, -0.2], brow: 0.5 }), lerp(-420, -200, seg(T.ring, T.peep, t)));
    return { h: o, d: { x: -560, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1 }, hall: { chain: 0 } };
  }
  // —— step 1: the chain on, the door open a crack on it; he talks through the gap ——
  if (t < T.c4) {
    const on = seg(A.L3w8 - 0.3, A.L3w9 + 0.1, t), gap = seg(A.L3w9, A.L3w10 + 0.3, t) * 80;
    const o = stand(base(t, { look: [0.8, -0.1], brow: 0.5, lean: 0.1 }), -170);
    const sh = shoulder(o);
    o.hands = { near: { p: t < A.L3w6 ? [0, -430] : [lerp(sh[0] + 60, 120, on), lerp(sh[1] + 60, -440, on)], shape: 'grip' } };
    if (t < A.L3w6) { o.look = [1, -0.5]; o.headTilt = -0.1; }
    if (gap > 10) o.mouth = 0.3 + 0.2 * Math.abs(Math.sin(t * 12));
    return { h: o, d: { x: -560, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 0.7 }, hall: { chain: Math.max(on, 0.01 > on ? 0 : on), gap }, peek: gap > 10 };
  }
  // —— steps 2–3: on the phone, the bill in his hand; the door shut, the chain on ——
  if (t < T.c6) {
    const o = stand(base(t, { look: [0.6, 0.5], brow: 0.4, headTilt: 0.14 }), -260);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 30, sh[1] - 60], shape: 'grip' }, far: { p: [sh[0] + 90, sh[1] + 50], shape: 'grip' } };
    o.prop = { kind: 'phone', p: [sh[0] + 28, sh[1] - 90] };
    if (t > T.c5) { o.look = [0.9, -0.1]; o.mouth = 0.3 + 0.2 * Math.abs(Math.sin(t * 12)) * (t < A.L5w9 + 0.4 ? 1 : 0); }
    return { h: o, d: { x: -560, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t), ears: 1 }, hall: { chain: 1 }, bill: t < T.c5 };
  }
  // —— the dog growling at the shut door; then the end ——
  const o = stand(base(t, { look: [0.6, 0], brow: 0.4, mouth: 0.2 }), -360);
  if (t > T.c7) { const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; o.mouth = 0.35; o.brow = 0.6; o.look = [0.8, 0]; }
  const d = { x: -120, y: 0, s: DS, face: 1, sit: 0, look: 0.15, t, blink: dblink(t), ears: 0, mouth: 0.35 + 0.1 * Math.abs(Math.sin(t * 20)), tongue: 0, brow: -0.8, wag: 0 };
  return { h: o, d, hall: { chain: 1 } };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.2); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.restore(); };
  return drawHunter(o);
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  if (sc === 'peep') peepFrame(t);
  else if (sc === 'landing') landingFrame(t, cam);
  else hallFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function hallFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  hallScene(t, a.hall ?? {});
  if (a.peek) { const gp = a.hall.gap; g.save(); g.beginPath(); g.rect(HALL.door.x1 - gp, HALL.door.top, gp, -HALL.door.top); g.clip(); stranger(t, HALL.door.x1 + 30, -1, { s: 0.6, color: '#2d3a5a' }); g.restore(); }
  if (a.d) drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
}
function landingFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(t, { liftLit: !!a.partner }); Ld.drawDoor(t, { peepLit: true }); Ld.drawMat(t, {});
  if (a.partner) stranger(t, a.partner.x, a.partner.face, { color: '#3a3240', s: 0.6 });
  if (a.gas) stranger(t, a.gas.x, a.gas.face, { id: a.gas.id, lean: a.gas.lean, folder: a.gas.folder });
}
// the view through the peephole: the landing in a fish-eye circle, dark round it; the gas man (or nobody, later)
function peepFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  const cx = 540, cy = 860, r = 470;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  const cam = { x: 120, y: -330, z: 0.95, lens: 1, tx: 0, ty: cy - 960, dx: 0, dy: 0, r: 0 };
  view(cam, 1);
  Ld.drawLanding(t, {});
  if (t < T.c1) {
    stranger(t, 140, -1, { s: 0.75, id: t > A.L0w9, lean: 0.1, folder: true });
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.restore();
  g.lineWidth = 18; g.strokeStyle = '#1c1e26'; g.beginPath(); g.arc(cx, cy, r + 6, 0, TAU); g.stroke();
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  const sc = scene(t);
  Hd.timeStamp(t, T.cover + 0.15, T.c3 - 0.1, 'СУББОТА — 11:40');
  if (t >= T.peep && t < T.c1) speech(t, A.L0w9 - 0.1, T.c1 - 0.05, 700, 330, '«Проверка газа, откройте!»');
  if (sc === 'landing' && t < T.c2) Hd.plaque(t, T.two + 0.5, T.c2 - 0.05, 540, 330, { icon: 'x', title: 'ОДИН ОТВЛЕКАЕТ', sub: 'другой ищет деньги', color: DANGER });
  if (sc === 'landing' && t >= T.c2) Hd.plaque(t, T.c2 + 0.1, T.c3 - 0.05, 540, 330, { icon: 'clock', title: 'НАСТОЯЩИЙ ПОДОЖДЁТ', sub: 'пока ты проверяешь', color: OK });
  Hd.ribbon(t, A.L1w1 - 0.05, A.L1w7 - 0.1, 'ТОРОПЯТ — ЗНАЧИТ, СТОП', { y: 1560, size: 76 });
  // step 1
  Hd.stepHeader(t, 1, 'НЕ ОТКРЫВАЙ СРАЗУ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, A.L3w8 - 0.08, T.c4 - 0.02, 540, 560, { icon: 'check', title: 'ГЛАЗОК И ЦЕПОЧКА', sub: 'говори через щель', color: OK });
  // step 2: the bill
  Hd.stepHeader(t, 2, 'ЗВОНИ САМ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) billCard(t, 680, 760);
  // step 3
  Hd.stepHeader(t, 3, 'ДРУГОЙ ДЕНЬ · 112', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c5 && t < T.c6) { speech(t, A.L5w5 - 0.1, T.dial - 0.1, 700, 560, '«Приходите в другой день»'); if (t > T.dial) dialCard(t, 700, 760); }
  // the twist
  if (sc === 'peep' && t >= T.c6) Hd.plaque(t, A.L6w6 - 0.1, T.growl - 0.05, 540, 1560, { icon: 'x', title: '«ГАЗОВЩИК» ИСЧЕЗ', sub: 'настоящий бы подождал', color: DANGER });
  if (t >= T.growl && t < T.c7) Hd.plaque(t, A.L6w14 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ПУРГА НА ПОСТУ', sub: 'рычит на дверь', color: WARM });
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ОТКРЫВАЕШЬ НЕЗНАКОМЦАМ?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
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
// step 2: the gas bill with the service's number circled; the stranger's card number crossed out
function billCard(t, cx, cy) {
  const k = clamp(sp(t, T.c4 + 0.1, 2.4, 8)) * (1 - seg(T.c5 - 0.25, T.c5 - 0.02, t));
  if (k <= 0.01) return;
  const w = 520, h = 600;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.rotate(0.03); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rect(-w / 2, -h / 2, w, h, '#f6f2e7'); g.restore();
  Hd.label('КВИТАНЦИЯ', -w / 2 + 30, -h / 2 + 64, 40, '#17162f', { align: 'left', shadow: false, stroke: false });
  Hd.label('за газ · октябрь', -w / 2 + 30, -h / 2 + 106, 26, '#5d6570', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  for (let i = 0; i < 5; i++) rect(-w / 2 + 30, -h / 2 + 150 + i * 46, w - 60 - 80 * (i % 2), 10, 'rgba(23,22,47,0.18)');
  Hd.label('Аварийная служба:', -w / 2 + 30, h / 2 - 150, 30, '#17162f', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label('104', -w / 2 + 30, h / 2 - 80, 64, '#2f8f4e', { align: 'left', shadow: false, stroke: false });
  const ring = seg(A.L4w6 - 0.1, A.L4w8, t);
  if (ring > 0) { g.lineWidth = 6; g.strokeStyle = '#2f8f4e'; g.beginPath(); g.ellipse(-w / 2 + 90, h / 2 - 100, 90, 56, 0, -Math.PI / 2, -Math.PI / 2 + TAU * ring); g.stroke(); }
  g.restore();
  // the stranger's card beside it, its number crossed out
  const kc = clamp(sp(t, A.L4w9 - 0.1, 2.4, 8));
  if (kc > 0.01) {
    g.save(); g.translate(220, cy + 120); g.rotate(-0.08); g.scale(kc, kc);
    rrect(-150, -90, 300, 180, 12, '#e9eef5'); rect(-130, -70, 70, 90, '#9aa6b8');
    Hd.label('ГАЗ-СЕРВИС', -40, -40, 26, '#17162f', { align: 'left', shadow: false, stroke: false });
    Hd.label('8-9XX-XXX', -40, 10, 26, '#5d6570', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
    g.restore();
    Hd.redX(220, cy + 120, 70, sp(t, A.L4w12, 2.6, 8));
  }
}
// step 3: the phone dialling 112
function dialCard(t, cx, cy) {
  const k = clamp(sp(t, T.dial, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const w = 360, h = 560;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(cx, cy); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 40; g.shadowOffsetY = 14; rrect(-w / 2, -h / 2, w, h, 46, '#1b1e29'); g.restore();
  rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 34, '#16233a');
  const n = Math.min(3, Math.floor((t - T.dial) / 0.18) + 1);
  Hd.label('112'.slice(0, n), 0, -120, 96, '#ffffff', { shadow: false, stroke: false });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ell(-90 + c * 90, -10 + r * 80, 30, 30, 'rgba(255,255,255,0.12)');
  ell(0, 220, 40, 40, '#2f8f4e');
  g.restore();
}

// —— the poster: the fish-eye with the «gas man» holding up his card; the words on the right ——
function coverFrame(t) {
  peepFrame(1.5);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ОТКРЫВАТЬ', 0, 200, 110, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('ИЛИ НЕТ?', 0, 330, 110, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'КВАРТИРА ПОД ЗАЩИТОЙ · 2', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw + 8, 400 + 8, pw, 84, INK); rect(-pw, 400, pw, 84, '#ffd43b'); text(pl, -pw / 2, 458, 48, '#111111', { fam: FONTS.cond, shadow: false });
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
  add(0.3, 'amb_flat', -22, 0, { dur: T.c3 - 0.3 });
  add(T.ring, 'ding', -6, 0.3); add(T.ring + 0.35, 'ding', -8, 0.3);
  add(T.peep, 'whoosh_in', -14, 0);
  add(A.L0w9 - 0.1, 'blip', -10, 0);
  add(T.c1, 'whoosh', -12, 0);
  add(A.L1w1 - 0.05, 'ribbon', -8, 0);
  add(T.two + 0.5, 'stamp', -8, -0.3);
  add(T.c2, 'ding', -12, 0);
  add(T.c3, 'whoosh', -12, 0);
  add(A.L3w8, 'click', -8, 0.2); add(A.L3w9 + 0.1, 'tap_squeak', -12, 0.2);
  add(T.c4, 'paper', -10, 0, { dur: 0.4 });
  add(A.L4w6, 'blip', -10, 0);
  add(A.L4w12, 'stamp', -8, -0.2);
  add(T.c5, 'whoosh', -12, 0);
  for (let i = 0; i < 3; i++) add(T.dial + i * 0.18, 'click', -10, 0.1);
  add(T.c6, 'whoosh_in', -14, 0);
  add(A.L6w6, 'blip', -10, 0);
  add(T.growl, 'whine', -10, -0.2, { dur: 1.2 });
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
