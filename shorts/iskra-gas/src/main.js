// «Приключения Искры» №4 «Запах газа» — 2D. The owner, 18.11: «начинай делать ещё новые и анализируй, что нравится
// людям». The channel's analytics (STATS.md, 18.11): danger at home or in the city, bright 2D, 40–45 s, standalone.
// №3 ended on a gas smell in the stairwell (1 turn on the light / 2 touch nothing). Standalone: they walk into the
// stairwell and smell gas. Steps on their words: the light — neither on nor off, one spark and it flares → the
// neighbours' bell sparks too: knock → no lighter, no matches, the phone not yet → open the landing window → the cat
// into her arms, out → outside: call 112, wait for the gas men, do not go back. The end: in the evening a siren
// howls — 1 go out and look / 2 turn on the TV (the only choice, at the end — the rule of 17.11). The series mark at the
// top all along. The first 3 frames are the cover («ПАХНЕТ ГАЗОМ В ПОДЪЕЗДЕ? / НЕ ВКЛЮЧАЙ СВЕТ!»). Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU, hash } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb, poly, smoothPath } from './flat.js';
import * as Hd from './hud.js';
import { hall, flash, fist, street, van, siren, SWITCH, BELL } from './gas.js';
import { iskra, cat, sprite } from './iskra.js';
import { text, measure, FONTS, INK } from './type.js';
import { initTex } from './tex.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]) + 2; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1150; Hd.SUB.size = 74; Hd.SUB.lead = 86;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = '#ffb066';
const HOT = { ГАЗОМ: DANGER, ГАЗ: DANGER, ВЫЖИТЬ: GOLD, СВЕТ: DANGER, ИСКРА: DANGER, ВСПЫХНЕТ: DANGER, ЗВОНОК: DANGER, ИСКРИТ: DANGER,
  СТУЧУ: OK, КУЛАКОМ: OK, ЗАЖИГАЛКИ: DANGER, СПИЧЕК: DANGER, ТЕЛЕФОН: DANGER, ОКНА: OK, УХОДИТ: OK, РУКИ: OK, УЛИЦУ: OK,
  СТО: GOLD, ДВЕНАДЦАТЬ: GOLD, ГАЗОВИКОВ: OK, СИРЕНА: DANGER, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['smell', 0], ['light', A.L1 - 0.1], ['bell', A.L2 - 0.1], ['fire', A.L3 - 0.1], ['vent', A.L4 - 0.1], ['out', A.L5 - 0.1], ['call', A.L6 - 0.1], ['siren', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { gas: A.L0w8, spark: A.L1w8, flare: A.L1w11, knock: A.L2w10, win: A.L4w0, out: A.L5w5, call: A.L6w3, vanIn: A.L6w7, siren: A.L7w4, q: A.L7w6 - 0.1 };
export const MARKS = { A, ...T, end: A.L7, c1: shotStart('light'), c2: shotStart('bell'), c3: shotStart('fire'), c4: shotStart('vent'), c5: shotStart('out'), c6: shotStart('call'), c7: shotStart('siren') };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [T.gas, A.L1w1, T.flare, T.knock, T.win, T.out, T.siren];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }
const shakeAt = t => (t >= T.flare ? 10 * Math.exp(-(t - T.flare) / 0.15) : 0);
const gasAt = t => 0.55 + 0.45 * seg(T.gas - 0.3, T.gas + 0.5, t);     // in the picture from 0 s (the hook)
const zoomTo = (cx, cy, z, fn) => { g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore(); };

// —— the shots ——
function smell(t) {                                    // the stairwell; green wisps rise on «пахнет газом»
  const push = seg(0, A.L1, t, x => x);
  zoomTo(540, 900, 1 + 0.05 * push, () => hall(t, { gas: gasAt(t) }));
}
function light(t) {                                    // close on the switch: crossed out; «одна искра» — a spark and a flare
  const z = lerp(1.9, 2.1, seg(A.L1, A.L2, t, x => x));          // the switch centred at (540, 800)
  g.save(); g.translate(540, 800); g.scale(z, z); g.translate(-SWITCH[0], -SWITCH[1]); hall(t, { gas: 1 }); g.restore();
  const x = seg(A.L1w1 - 0.05, A.L1w1 + 0.25, t);
  if (x > 0.01) Hd.redX(540, 800, 260, x);
  flash(540, 800, seg(T.spark - 0.05, T.spark + 0.1, t) * (1 - seg(T.spark + 0.3, T.spark + 0.6, t)), 0.8);
  const f = seg(T.flare - 0.05, T.flare + 0.15, t) * (1 - seg(T.flare + 0.6, A.L2 - 0.2, t));
  if (f > 0.01) { g.save(); g.globalAlpha = f * 0.75; const gr = g.createRadialGradient(540, 800, 0, 540, 800, 900); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.4, '#ff9a3a'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
}
function bell(t) {                                     // the door and its bell — crossed out; a fist knocks on the door
  zoomTo(420, 860, 1.25, () => hall(t, { gas: 1 }));
  const x = seg(A.L2w3 - 0.05, A.L2w3 + 0.25, t);
  const bx = 420 + (BELL[0] - 420) * 1.25, by = 860 + (BELL[1] - 860) * 1.25;
  if (x > 0.01) Hd.redX(bx, by, 130, x);
  flash(bx, by, seg(A.L2w9 - 0.05, A.L2w9 + 0.1, t) * (1 - seg(A.L2w9 + 0.3, A.L2w9 + 0.5, t)), 0.5);
  const k = seg(T.knock - 0.15, T.knock, t);
  fist(200, 840, t - T.knock, k);
  if (k > 0.5) { const ph = ((t - T.knock) % 0.35) / 0.35; g.save(); g.globalAlpha = 1 - ph; text('ТУК!', 230, 720 - ph * 40, 80, INK, { fam: FONTS.block }); g.restore(); }
}
function iconCard(t, k) {                              // a lighter, a match, a phone — each crossed out
  g.save(); g.translate(540, 640); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  fill(rrPath(-450, -250, 900, 500, 30), '#f4efe2'); g.lineWidth = 5; g.strokeStyle = DANGER; g.stroke(rrPath(-447.5, -247.5, 895, 495, 28));
  g.restore();
  const items = [[A.L3w1, -290], [A.L3w3, 0], [A.L3w5, 290]];
  items.forEach(([t0, dx], i) => {
    const a = seg(t0 - 0.15, t0 + 0.1, t); if (a <= 0.01) return;
    g.save(); g.translate(540 + dx, 640); g.globalAlpha = a * clamp(k * 2);
    if (i === 0) { rrect(-45, -60, 90, 150, 16, '#3b7dd8'); rect(-40, -95, 80, 40, '#c9ced4'); ell(0, -120, 18, 28, '#ffb23a'); ell(0, -112, 9, 15, '#fff2b0'); }
    if (i === 1) { g.rotate(0.5); rect(-8, -110, 16, 200, '#e7c08a'); ell(0, -112, 16, 22, '#c63a2a'); }
    if (i === 2) { rrect(-60, -110, 120, 220, 20, '#1f2433'); rrect(-50, -95, 100, 180, 10, '#9fd3ff'); }
    g.restore();
    const x = seg(t0, t0 + 0.25, t); if (x > 0.01) Hd.redX(540 + dx, 640, 110, x);
  });
}
function fire(t) { hall(t, { gas: 1, dim: 0.5 }); iconCard(t, clamp(sp(t, A.L3 - 0.05, 2.6, 8))); }
function vent(t) {                                     // the landing window swings open; the gas goes out
  zoomTo(820, 520, 1.15, () => hall(t, { gas: 1 - 0.5 * seg(T.win + 0.6, A.L5, t), vent: seg(T.win - 0.1, T.win + 0.8, t) }));
}
function out(t) {                                      // outside: the entrance door opens, the panel block above
  street(t, { door: seg(T.out - 0.3, T.out + 0.3, t) * (1 - seg(T.out + 1.2, T.out + 1.6, t)) });
}
function phoneCard(x, y, k, t) {                        // the phone: «112», calling
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.06);
  rrect(-120, -210, 240, 420, 34, '#1f2433'); rrect(-104, -186, 208, 372, 20, '#0f1626');
  text('112', 0, -40, 92, '#ffffff', { fam: FONTS.cond, shadow: false });
  text('ВЫЗОВ…', 0, 20, 34, '#9fd3ff', { fam: FONTS.cond, shadow: false });
  const pulse = 1 + 0.08 * Math.sin(t * 8); ell(0, 110, 44 * pulse, 44 * pulse, '#2fbf5a'); text('✆', 0, 128, 52, '#ffffff', { shadow: false });
  g.restore();
}
function call(t) {                                     // outside: 112; the gas van drives up
  street(t, {});
  const vk = seg(T.vanIn, T.vanIn + 1.6, t, ease.out);
  if (vk > 0.001) van(lerp(1150, 380, vk), 1330, t);
  phoneCard(800, 520, clamp(sp(t, T.call - 0.1, 2.6, 8)) * (1 - seg(T.vanIn + 0.3, T.vanIn + 0.6, t)), t);
}
function siren_(t) {                                   // the evening street: a siren on its pole howls
  street(t, { dusk: 1 });
  siren(945, 1260, t, seg(T.siren - 0.1, T.siren + 0.2, t));
}
const SHOT = { smell, light, bell, fire, vent, out, call, siren: siren_ };

// —— Искра and Факт in front: her poses by the step, her mouth with her voice; he reacts ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L1 && t < A.L1w7) return 'myth';                     // «свет не включаю»
  if (t >= A.L3 && t < A.L4 - 0.1) return 'myth';                 // «ни зажигалки, ни спичек»
  if (t >= A.L4 && t < A.L5 - 0.1) return 'right';                 // «открываю окна»
  if (t >= T.vanIn && t < A.L7 - 0.1) return 'truth';              // «жду газовиков»
  if (t >= A.L7w6) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < T.gas) return 'front';
  if (t < A.L1) return 'wow';
  if (t < A.L5) return 'doubt';
  if (t >= T.vanIn && t < A.L7) return 'sure';
  if (t >= A.L7) return 'wow';
  return 'front';
}
let lastPose = null, poseSince = -9, lastCat = null, catSince = -9;
function hosts(t) {
  const p = poseOf(t), c = catOf(t);
  if (p !== lastPose) { lastPose = p; poseSince = t; }
  if (c !== lastCat) { lastCat = c; catSince = t; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // the cat goes into her arms on «Факта — на руки» and back down on «фух»
  const held = seg(A.L5w0 - 0.05, A.L5w3, t, ease.out) * (1 - seg(T.vanIn, T.vanIn + 0.3, t));
  const cx = lerp(800, 360, held), cy = lerp(1862, 1800, held), ch = lerp(330, 300, held);
  const tremble = (t >= T.flare && t < T.flare + 0.6) ? 4 * Math.sin(t * 40) : 0;
  const tall = 1;
  if (held < 0.5) { ell(cx, 1858, 150, 24, 'rgba(0,0,0,0.25)'); cat(t, c, cx, cy, ch, { hop: catSince > 0.2 ? catSince : null }); }
  iskra(t, p, 300 + tremble, 1945, 720 * tall, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  if (held >= 0.5) cat(t, c === 'wow' ? 'wow' : 'front', cx + tremble, cy, ch, {});
}

// —— the 2D layer ——
const SERIES = 'ПРИКЛЮЧЕНИЯ ИСКРЫ · СЕРИЯ 4';
function series(y = 110, k = 1) {                      // the series mark — off since 19.11 (newcomers swipe away «серия N»)
  k = 0;
  if (k <= 0.01) return;
  const w = measure(SERIES, 40, FONTS.cond) + 56;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  fill(rrPath(540 - w / 2, y - 32, w, 64, 32), 'rgba(10,14,22,0.78)');
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,176,102,0.85)'; g.stroke(rrPath(540 - w / 2 + 1.5, y - 30.5, w - 3, 61, 30));
  text(SERIES, 540, y + 14, 40, WARM, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function headline(s, y, k, color = '#ffd23f', size = 84) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.03); g.scale(k, k);
  const sw = measure(s, size) + 80; rrect(-sw / 2 + 10, -size * 0.78 + 10, sw, size * 1.56, 22, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 22, color); text(s, 0, size * 0.36, size, INK, { shadow: false }); g.restore();
}
function button(n, s, x, y, k) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  const w = Math.max(430, measure(s, 42, FONTS.cond) + 180), h = 140;
  fill(rrPath(-w / 2, -h / 2, w, h, 24), 'rgba(10,14,22,0.85)');
  g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 23)); g.restore();
  text(n, -w / 2 + 62, 26, 74, WARM, { fam: FONTS.cond, shadow: false });
  text(s, 37, 18, 42, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
function layer(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  series(110);
  // the hook (19.11): the question big from the first frame, the ban under it — then «КАК ВЫЖИТЬ?»
  const hk = 1 - seg(A.L0w10 - 0.25, A.L0w10, t);
  headline('ПАХНЕТ ГАЗОМ В ПОДЪЕЗДЕ?', 250, hk, '#ffd23f', 58);
  headline('НЕ ВКЛЮЧАЙ СВЕТ!', 400, hk * clamp(sp(t, 0.05, 2.6, 8)), '#e53935', 84);
  headline('КАК ВЫЖИТЬ?', 360, clamp(sp(t, A.L0w10 - 0.1, 2.4, 8)) * (1 - seg(A.L1 - 0.15, A.L1 + 0.05, t)));
  Hd.stepHeader(t, 1, 'НЕ ТРОГАЙ СВЕТ', A.L1 - 0.05, A.L2 - 0.3, 260);
  P(A.L1w7, A.L2 - 0.3, 400, { icon: 'x', title: 'ИСКРА = ВСПЫШКА', color: DANGER, size: 46 });
  Hd.stepHeader(t, 2, 'НЕ ЗВОНИ В ДВЕРЬ', A.L2 - 0.05, A.L3 - 0.3, 260);
  P(T.knock, A.L3 - 0.3, 400, { icon: 'check', title: 'СТУЧИ', color: OK, size: 50 });
  Hd.stepHeader(t, 3, 'БЕЗ ОГНЯ', A.L3 - 0.05, A.L4 - 0.3, 260);
  P(A.L3w5, A.L4 - 0.3, 1040, { icon: 'x', title: 'ТЕЛЕФОН — ПОТОМ', color: DANGER, size: 42 });
  Hd.stepHeader(t, 4, 'ОТКРОЙ ОКНА', A.L4 - 0.05, A.L5 - 0.3, 260);
  Hd.stepHeader(t, 5, 'ВЫХОДИ НА УЛИЦУ', A.L5 - 0.05, A.L6 - 0.3, 260);
  P(A.L5w0, A.L6 - 0.3, 400, { icon: 'check', title: 'КОТА — НА РУКИ', color: OK, size: 44 });
  P(A.L6w0, A.L7 - 0.3, 300, { icon: 'check', title: 'ЗВОНИ 112 С УЛИЦЫ', color: GOLD, size: 44 });
  P(A.L6w10, A.L7 - 0.3, 415, { icon: 'x', title: 'ВНУТРЬ НЕ ВОЗВРАЩАЙСЯ', color: DANGER, size: 40 });
  P(T.siren, T.q - 0.1, 330, { icon: 'x', title: 'ВОЕТ СИРЕНА', color: DANGER, size: 50 });
  // the end: the only choice — at the end (the rule of 17.11)
  headline('ЧТО ДЕЛАТЬ?', 300, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'ВЫЙТИ ПОСМОТРЕТЬ', 540, 500, clamp(sp(t, A.L7w6 - 0.06, 2.6, 8)));
  button('2', 'ВКЛЮЧИТЬ ТЕЛЕВИЗОР', 540, 670, clamp(sp(t, A.L7w10 - 0.06, 2.6, 8)));
  const kp = clamp(sp(t, A.L7w14 - 0.1, 2.4, 8));
  if (kp > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = kp; text('ПИШИ 1 ИЛИ 2', 540, 800, 52, '#ffffff', { fam: FONTS.cond }); text('В КОММЕНТАРИЯХ', 540, 860, 52, '#ffffff', { fam: FONTS.cond }); g.restore(); }
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  zoomTo(700, 900, 1.15, () => hall(0.8, { gas: 1 }));
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  series(110);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('ПАХНЕТ ГАЗОМ В ПОДЪЕЗДЕ?', 280, 58, '#ffd23f', INK, -0.04);
  box('НЕ ВКЛЮЧАЙ СВЕТ!', 450, 96, '#e53935', '#ffffff', 0.03);
  const sx = 700 + (SWITCH[0] - 700) * 1.15, sy = 900 + (SWITCH[1] - 900) * 1.15;
  g.save(); g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(sx, sy, 130, 150, 0, 0, TAU); g.stroke(); g.restore();
  sprite('h_wow', 290, 1925, 640);
  sprite('c_wow', 830, 1905, 420);
}

// which flat colours get which texture
const TEXMAP = {};
export function init() { Hd.initHud(); initTex(TEXMAP); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(); Hd.finish(t, 0.5); return; }
  const z = zoomAt(t), sh = shakeAt(t);
  if (sh > 0.3) g.translate(sh * Math.sin(t * 61), sh * 0.6 * Math.cos(t * 53));
  if (z > 1.0005) { g.translate(540, 900); g.scale(z, z); g.translate(-540, -900); }
  SHOT[shotAt(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  hosts(t);
  layer(t);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0);
  add(0.05, 'amb_flat', -20, 0, { dur: A.L5w5 });
  add(0.3, 'stair_steps', -18, 0, { dur: 1.6 });
  add(T.gas, 'drain', -22, 0, { dur: 2.0 }); add(T.gas, 'heartbeat', -16, 0, { dur: 2.4 });
  add(T.spark, 'spark', -12, 0); add(T.flare, 'fire_whoosh', -10, 0);
  add(A.L2w9, 'spark', -16, 0.2);
  for (let i = 0; i < 4; i++) add(T.knock + i * 0.35, 'hatch_knock', -10, -0.1);
  add(A.L3w1, 'pop_word', -12, -0.3); add(A.L3w3, 'pop_word', -12, 0); add(A.L3w5, 'pop_word', -12, 0.3);
  add(T.win, 'door_creak', -14, 0.3, { dur: 0.8 }); add(T.win + 0.5, 'roof_wind', -20, 0.3, { dur: 2.0 });
  add(A.L5w0, 'cloth', -12, -0.2); add(T.out - 0.3, 'door_open', -12, 0, { dur: 1.2 });
  add(T.out, 'city_day', -20, 0, { dur: A.L7 - T.out });
  add(T.call, 'beep', -16, 0.2, { dur: 0.4, f: 425 }); add(T.call + 0.9, 'beep', -16, 0.2, { dur: 0.4, f: 425 });
  add(T.vanIn, 'engine', -16, 0.4, { dur: 1.8 });
  add(A.L7 - 0.1, 'city', -22, 0, { dur: DUR - A.L7 });
  add(T.siren, 'whine', -10, 0.2, { dur: DUR - T.siren });
  for (const t0 of [A.L1 - 0.05, A.L2 - 0.05, A.L3 - 0.05, A.L4 - 0.05, A.L5 - 0.05]) add(t0, 'pop_word', -10, 0);
  add(A.L7w6, 'pop_word', -10, 0); add(A.L7w10, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
