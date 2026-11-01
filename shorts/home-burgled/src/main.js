// «Дверь приоткрыта» («Квартира под защитой», ч.3): the whole short as pure functions of time t (seconds), so any frame
// or motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The landing and the neighbour from part 1 (landing.js); new here: our door ajar with a scratched lock and a dark gap,
// the stairs down on the right, the fingerprints on the handle, the list of what's missing, the bank card blocked, the
// police at the door and the burglar's glove the dog finds under the stairs.
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
const FB = { L0: [0.12, 4.04, 11], L1: [4.44, 8.68, 12], L2: [9.07, 11.86, 10], L3: [12.3, 15.97, 11], L4: [16.38, 22.58, 18], L5: [22.98, 27.07, 10], L6: [27.52, 33.44, 16], L7: [33.88, 37.34, 10] };
export const DUR = VOICE?.dur ?? 37.69;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ПРИОТКРЫТА: DANGER, ПОЦАРАПАН: DANGER, НЕЛЬЗЯ: DANGER, ВНУТРИ: DANGER, ОТОЙДИ: GOLD, СОСЕДЯМ: GOLD, ДВЕНАДЦАТЬ: GOLD,
  ТРОГАЙ: DANGER, СЛЕДЫ: GOLD, СПИСОК: GOLD, ЗАБЛОКИРУЙ: GOLD, КАРТЫ: GOLD, ПЕРЧАТКУ: WARM, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  see: A.L0w5 - 0.06,                // «а дверь квартиры приоткрыта»: he stops
  scratch: A.L0w9 - 0.06,            // «и замок поцарапан»: the lock close-up
  c1: A.L1 - 0.06,                   // «Хочется зайти…»: his hand to the handle
  no: A.L1w6 - 0.05,                 // «Нельзя»
  c2: A.L2 - 0.06,                   // «И не кричи…»: he backs off quietly
  c3: A.L3 - 0.06,                   // step 1: at the neighbour's, 112
  c4: A.L4 - 0.06,                   // step 2: the handle, the prints
  c5: A.L5 - 0.06,                   // step 3: the list, the card
  c6: A.L6 - 0.06,                   // the police
  glove: A.L6w9 - 0.06,              // «а Пурга нашла его перчатку под лестницей»
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c1, T.c3, T.c4, T.c5, T.c6, T.glove, T.c7];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c5 ? 'landing' : t < T.c6 ? 'list' : 'landing');

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
shot(T.cover, [[T.cover, -240, -320, 1.05], [T.see, -150, -320, 1.15], [T.scratch, 80, -300, 2.2], [T.c1, 90, -300, 2.3]]);
shot(T.c1, [[T.c1, -80, -300, 1.4], [T.no + 0.3, -60, -310, 1.5], [T.c2, -100, -310, 1.4], [T.c3, -200, -300, 1.2]]);
shot(T.c3, [[T.c3, 360, -300, 1.2], [T.c4, 380, -300, 1.25]]);
shot(T.c4, [[T.c4, 80, -280, 2.4], [T.c5, 90, -280, 2.55]]);
shot(T.c6, [[T.c6, 160, -300, 1.05], [T.glove - 0.2, 180, -300, 1.1], [T.glove + 0.5, 780, -160, 1.8], [T.c7, 790, -160, 1.86]]);
shot(T.c7, [[T.c7, 200, -300, 1.05], [DUR, 210, -305, 1.1]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.see, 5], [T.no, 8]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// home from work: the jacket and the hat
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: true, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
function officer(x, face, o = {}) {
  MONO.on = true; MONO.color = o.color ?? '#23365e';
  const f = stand({ s: 0.62, face, lean: 0.04, look: [0.6 * face, 0], hat: true, jacket: true, boots: true, pack: false, blink: 0 }, x);
  drawHunter(f);
  MONO.on = false;
  const sh = framesOf(f).T.p([-14, -192]);
  rrect(sh[0] - 36, sh[1] - 168, 72, 22, 6, '#1b2a4a'); ell(sh[0], sh[1] - 160, 8, 8, '#ffd23f');           // the cap's peak and badge
  rect(sh[0] - 50, sh[1] + 20, 100, 14, '#ffd23f');                                                         // the reflective band
}
// the stairs down on the right of the landing, the space under them
function stairs() {
  fill(polyPath([[860, 0], [1100, -360], [1100, 0]]), '#5d6570');
  for (let i = 0; i < 6; i++) rect(860 + i * 40, -60 * (i + 1), 40, 8, '#7f8892');
  limb([[880, -120], [1100, -480]], 8, '#3a3f4a', false);
}

export function actorsAt(t) {
  const sc = scene(t);
  if (sc !== 'landing') return {};
  // —— the hook: walking from the lift, he stops dead ——
  if (t < T.c1) {
    const w = seg(T.cover, T.see, t);
    const o = stand(base(t, { look: [0.7, 0], brow: 0.2 }), lerp(-560, -300, w));
    if (t > T.see) { o.brow = 0.9; o.pop = clamp(sp(t, T.see, 2.4, 7)); o.mouth = 0.2; }
    const d = { x: lerp(-700, -440, w), y: 0, s: DS, face: 1, sit: w >= 1 ? 1 : 0, walk: w < 1 ? 1 : 0, ph: t * 1.6, look: 0.2, t, blink: dblink(t), ears: t > T.see ? 1 : 0.5 };
    return { h: o, d };
  }
  // —— the hand to the handle; «Нельзя»; then backing off on tiptoe ——
  if (t < T.c3) {
    const back = seg(T.c2 + 0.2, T.c3, t);
    const o = stand(base(t, { look: [0.7, -0.1], brow: 0.6, lean: 0.12 - 0.2 * back }), lerp(-180, -420, back));
    const sh = shoulder(o), reach = seg(T.c1, A.L1w3, t) * (1 - seg(T.no, T.no + 0.3, t));
    o.hands = { near: { p: [lerp(sh[0] + 40, Ld.HANDLE[0] - 40, reach), lerp(sh[1] + 100, Ld.HANDLE[1], reach)], shape: reach > 0.6 ? 'open' : 'fist' } };
    if (t > T.no) { o.pop = 0.6 * (1 - seg(T.no + 0.6, T.no + 1.2, t)); o.brow = 0.9; }
    if (t > T.c2) { o.face = -1; o.look = [0.9, 0]; o.mouth = 0; o.hands = { near: { p: [sh[0] - 20, sh[1] + 30], shape: 'point', ang: -1.4 } }; }
    const d = { x: lerp(-440, -620, back), y: 0, s: DS, face: t > T.c2 ? -1 : 1, sit: back > 0.02 && back < 0.98 ? 0 : 1, walk: back > 0.02 && back < 0.98 ? 1 : 0, ph: t * 1.4, look: 0.3, t, blink: dblink(t), ears: 0.2 };
    return { h: o, d, ghost: t > T.no && t < T.c3 };
  }
  // —— step 1: at the neighbour's door, on the phone to 112 ——
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.6, 0.4], brow: 0.5, headTilt: 0.14 }), 300);
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] + 30, sh[1] - 60], shape: 'grip' } };
    o.prop = { kind: 'phone', p: [sh[0] + 28, sh[1] - 90] };
    o.mouth = 0.3 + 0.2 * Math.abs(Math.sin(t * 12)) * (t > A.L3w8 ? 1 : 0);
    return { h: o, d: { x: 160, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t) }, granny: { x: 560, face: -1, reach: [90, -300], smile: 0.1, look: -0.6, t }, nOpen: true };
  }
  if (t < T.c5) return { closeup: true };
  // —— the police at the door; the dog under the stairs with the glove ——
  const o = stand(base(t, { look: [-0.5, 0], brow: 0.4, face: -1 }), 380);
  if (t > T.glove) { o.face = 1; o.look = [0.8, 0.3]; o.brow = 0.8; o.mouth = 0.4; }
  if (t > T.c7) { const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; o.mouth = 0.35; }
  const d = t > T.glove - 0.1 ? { x: 900, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t), wag: 1, wagPh: t * 3.4, mouth: 0.6, ears: 1 } : { x: 520, y: 0, s: DS, face: 1, sit: 1, look: 0.3, t, blink: dblink(t) };
  return { h: o, d, police: true, glove: t > T.glove - 0.1 };
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
  if (sc === 'list') listFrame(t);
  else landingFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}
function landingFrame(t, cam) {
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(t, { nOpen: a.nOpen });
  stairs();
  Ld.drawDoor(t, { ajar: t < T.c6 ? 1 : 0.6, scratch: true, dark: true });
  Ld.drawMat(t, {});
  if (a.ghost) { const k = 0.5 + 0.5 * Math.sin(t * 3); ell(Ld.DOOR.x1 - 14, -470, 5, 5, rgba('#ffffff', 0.5 * k)); ell(Ld.DOOR.x1 - 6, -470, 5, 5, rgba('#ffffff', 0.5 * k)); }
  if (a.closeup) prints(t);
  if (a.police) { officer(40, 1); officer(-180, 1, { color: '#2a3d68' }); }
  if (a.granny) Ld.drawGranny(a.granny);
  const dl = a.d ? drawDog(a.d) : null;
  if (a.glove && dl?.nose) {                                       // the burglar's glove in her teeth
    const [x, y] = [dl.nose[0] + 10, dl.nose[1] + 24];
    fill(smoothPath([[x - 40, y], [x - 30, y - 30], [x + 30, y - 34], [x + 40, y]]), '#2c2c34');
    for (let i = 0; i < 4; i++) rrect(x - 30 + i * 18, y - 4, 12, 30, 6, '#2c2c34');
  }
  if (a.h) hunterDraw(t, a.h);
}
// step 2: the handle and the lock close up, fingerprints glowing on them, a hand crossed out
function prints(t) {
  const k = seg(A.L4w7 - 0.1, A.L4w14, t);
  for (const [x, y, r] of [[Ld.HANDLE[0] - 30, Ld.HANDLE[1] - 10, 22], [Ld.LOCKS[0][0] - 14, Ld.LOCKS[0][1] + 8, 18], [Ld.HANDLE[0] - 4, Ld.HANDLE[1] + 18, 16]]) {
    for (let i = 0; i < 5; i++) { g.lineWidth = 2; g.strokeStyle = rgba('#7ff0ff', 0.8 * k); g.beginPath(); g.ellipse(x, y, r - i * 4, (r - i * 4) * 1.3, 0.3, 0, TAU); g.stroke(); }
  }
}

// —— step 3: the list of what's missing, the bank card blocked ——
function listFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a1f33'); gr.addColorStop(1, '#2a2240'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const w = 560, h = 640, cx = 340, cy = 820;
  g.save(); g.translate(cx, cy); g.rotate(-0.03);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rect(-w / 2, -h / 2, w, h, '#f6f2e7'); g.restore();
  for (let i = 0; i < 9; i++) rect(-w / 2 + 30, -h / 2 + 140 + i * 56, w - 60, 2, 'rgba(59,142,234,0.25)');
  Hd.label('ПРОПАЛО:', -w / 2 + 40, -h / 2 + 90, 48, '#17162f', { align: 'left', shadow: false, stroke: false });
  ['ноутбук', 'наличные', 'часы деда', 'ключи от машины'].forEach((r, i) => {
    const a = clamp((t - (A.L5w2 + i * 0.25)) / 0.15);
    Hd.label('— ' + r, -w / 2 + 50, -h / 2 + 196 + i * 56, 40, rgba('#17162f', a), { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  });
  g.restore();
  // the bank card: a toggle to «Заблокирована»
  const k = clamp(sp(t, A.L5w6 - 0.15, 2.4, 8)), on = seg(A.L5w7, A.L5w7 + 0.4, t);
  if (k > 0.01) {
    g.save(); g.translate(760, 1000); g.rotate(0.05); g.scale(k, k);
    rrect(-200, -126, 400, 252, 24, mix('#3c7ad6', '#5d6570', on)); rect(-200, -70, 400, 40, '#1b1e29');
    rrect(-160, 10, 80, 56, 8, '#ffd23f'); Hd.label('•••• 4417', 40, 60, 34, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
    if (on > 0.05) { g.globalAlpha = on; rrect(-170, -40, 340, 80, 16, '#e53935'); Hd.label('ЗАБЛОКИРОВАНА', 0, 14, 38, '#ffffff', { shadow: false, stroke: false }); }
    g.restore();
  }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c6 - 0.1, 'ВТОРНИК — 19:10');
  Hd.timeStamp(t, T.c6 + 0.05, T.c7 - 0.1, 'ВТОРНИК — 19:25');
  if (t >= T.scratch && t < T.c1) Hd.plaque(t, T.scratch + 0.1, T.c1 - 0.05, 540, 330, { icon: 'x', title: 'ЗАМОК ПОЦАРАПАН', sub: 'дверь приоткрыта', color: DANGER });
  if (t >= T.c1 && t < T.c2) { const p = S2([Ld.HANDLE[0] - 40, Ld.HANDLE[1]]); Hd.redX(p[0], p[1] - 40, 70, sp(t, T.no, 2.6, 8)); }
  Hd.ribbon(t, T.no, T.c2 - 0.1, 'ВОР МОЖЕТ БЫТЬ ВНУТРИ', { y: 330, size: 78 });
  if (t >= T.c2 && t < T.c3) { speechX(t, T.c2 + 0.05, A.L2w5, 540, 560, '«Кто там?!»'); Hd.plaque(t, A.L2w5 - 0.05, T.c3 - 0.05, 540, 330, { icon: 'check', title: 'ТИХО ОТОЙДИ', sub: 'от двери', color: OK }); }
  // step 1
  Hd.stepHeader(t, 1, 'УЙДИ И ЗВОНИ 112', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, A.L3w8 - 0.08, T.c4 - 0.02, 540, 560, { icon: 'phone', title: '112', sub: 'от соседей или с улицы', color: GOLD, size: 56 });
  // step 2
  Hd.stepHeader(t, 2, 'НИЧЕГО НЕ ТРОГАЙ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) Hd.plaque(t, A.L4w13 - 0.08, T.c5 - 0.02, 540, 1560, { icon: 'x', title: 'ЗДЕСЬ СЛЕДЫ', sub: 'ручка, замок, вещи', color: DANGER });
  // step 3
  Hd.stepHeader(t, 3, 'СПИСОК И КАРТЫ', A.L5 + 0.02, A.L5e - 0.05);
  // the twist
  if (t >= T.glove && t < T.c7) Hd.plaque(t, A.L6w13 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ПЕРЧАТКА ВОРА', sub: 'Пурга нашла под лестницей', color: WARM });
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ЗАШЁЛ БЫ ПРОВЕРИТЬ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// a shout in a bubble, crossed out
function speechX(t, t0, tx, x, y, str) {
  if (t < t0 || t > T.c3) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c3 - 0.3, T.c3, t));
  const size = 50, w = measure(str, size, FONTS.cond) + 60, h = 100;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-w / 2, -h / 2, w, h, 24, '#fff8e6'); text(str, 0, 16, size, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
  Hd.redX(x, y, 70, sp(t, tx, 2.6, 8));
}

// —— the poster: the door ajar, the dark gap, him stopped with the dog ——
function coverFrame(t) {
  const cam = { x: -120, y: -300, z: 1.4, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#20232e'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(t, {}); Ld.drawDoor(t, { ajar: 1, scratch: true, dark: true }); Ld.drawMat(t, {});
  const o = stand(base(t, { s: 0.9, face: 1, pop: 0.9, brow: 1, mouth: 0.3, look: [0.8, 0], blink: 0 }), -400, 100);
  drawDog({ x: -650, y: 60, s: 1.0, face: 1, sit: 1, look: 0.3, t: 0, ears: 1 });
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ДВЕРЬ', 0, 200, 130, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('ОТКРЫТА!', 0, 340, 120, '#ff3b30', { align: 'right', shadow: false, strokeW: 12 }); g.restore();
  g.rotate(0.06);
  const pl = 'КВАРТИРА ПОД ЗАЩИТОЙ · 3', pw = measure(pl, 48, FONTS.cond) + 60;
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
  add(0.3, 'amb_flat', -22, 0, { dur: T.c5 - 0.3 });
  add(0.35, 'ding', -14, -0.4);
  add(T.see, 'stamp', -8, 0);
  add(T.scratch + 0.1, 'blip', -10, 0);
  add(T.no, 'stamp', -5, 0); add(T.no, 'ribbon', -8, 0);
  add(A.L2w5 - 0.05, 'stamp', -10, 0);
  add(T.c3, 'whoosh', -12, 0);
  for (let i = 0; i < 3; i++) add(A.L3w8 + i * 0.18, 'click', -12, 0.1);
  add(T.c4, 'whoosh_in', -12, 0);
  add(A.L4w13 - 0.08, 'blip', -10, 0);
  add(T.c5, 'paper', -10, 0, { dur: 0.4 });
  add(A.L5w7, 'toggle', -10, 0.2);
  add(T.c6, 'whoosh', -12, 0);
  add(T.c6 + 0.2, 'crowd_steps', -22, 0, { dur: 1.2 });
  add(T.glove, 'whine', -14, 0.4, { dur: 0.6 });
  add(A.L6w13 - 0.1, 'ding', -10, 0.3);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
