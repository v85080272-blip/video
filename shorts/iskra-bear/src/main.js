// «Приключения Искры» №1 «Медведь» — 2D. A new series (the owner, 17.11: «давай сделаем какие-нибудь приключения с
// Искрой»): Искра herself is the heroine, with the cat Факт, and tells it in the first person (Elen's voice). The bear
// was asked for in the comments. On screen: the autumn forest, the bear on the path ahead; Искра and Факт in front (the
// sprites from her sheets, waist up), reacting. Steps, each on its word: do not run (50 km/h) → do not climb a tree →
// the cat in your arms, stand tall, hands up → talk calmly → do not drop the pack, back away slowly, sideways → he
// stood up: he is sniffing, not attacking → he left. The end: a cub in the bushes — the mother is near: 1 run to the
// river / 2 quietly back? (the only choice, at the end — the rule of 17.11). The series mark at the top all along.
// The first 3 frames are the cover («МЕДВЕДЬ В 20 МЕТРАХ? / НЕ БЕГИ!»).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb } from './flat.js';
import * as Hd from './hud.js';
import { autumnForest, bear, bearSide, bushCub, bigTree, HOR } from './bear.js';
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
const HOT = { МЕДВЕДЬ: DANGER, ВЫЖИТЬ: GOLD, БЕГИ: DANGER, ПЯТЬДЕСЯТ: GOLD, ДОГОНИТ: DANGER, ДЕРЕВО: DANGER, ЛАЗАЮТ: DANGER, РУКИ: OK, ВВЕРХ: OK,
  БОЛЬШАЯ: OK, СПОКОЙНО: OK, ЧЕЛОВЕК: OK, РЮКЗАК: OK, МЕДЛЕННО: OK, БОКОМ: OK, СПИНОЙ: DANGER, ЗАДНИЕ: GOLD, НЮХАЕТ: OK, УШЁЛ: OK,
  МЕДВЕЖОНОК: DANGER, МАМА: DANGER, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['meet', 0], ['run', A.L1 - 0.1], ['tree', A.L2 - 0.1], ['big', A.L3 - 0.1], ['talk', A.L4 - 0.1], ['back', A.L5 - 0.1], ['stand', A.L6 - 0.1], ['cub', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { up: A.L6w1 - 0.05, fuh: A.L6w11, gone: A.L6w12 - 0.1, cub: A.L7w5 - 0.1, q: A.L7w10 - 0.1 };
export const MARKS = { A, ...T, end: A.L7, c1: shotStart('run'), c2: shotStart('tree'), c3: shotStart('big'), c4: shotStart('talk'), c5: shotStart('back'), c6: shotStart('stand'), c7: shotStart('cub') };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w10, A.L1w1, A.L3w6, T.up, T.cub];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }
const blinkAt = t => ((t + 0.7) % 3.7) < 0.12 ? 1 : 0;

// —— the shots ——
function meet(t) {                                     // the path; he sniffs the ground — and lifts his head on «медведь»
  const push = seg(0, A.L1, t, x => x);
  g.save(); g.translate(540, 900); g.scale(1 + 0.05 * push, 1 + 0.05 * push); g.translate(-540, -900);
  autumnForest(t, { pan: 10 * push });
  const up = seg(A.L0w10 - 0.2, A.L0w10 + 0.3, t);
  bear(560, 990, 230, t, { head: lerp(0.15 + 0.1 * Math.sin(t * 3), 1, up), blink: blinkAt(t) });
  g.restore();
  const d = seg(A.L0w7 - 0.1, A.L0w8 + 0.3, t) * (1 - seg(A.L1 - 0.4, A.L1 - 0.15, t));     // «20 метров»: a dashed measure
  if (d > 0.01) {
    g.save(); g.globalAlpha = d; Hd.dashed([360, 1080], [520, 1000], '#ffffff', 5, d); g.restore();
    g.save(); g.globalAlpha = d; g.translate(390, 1010); g.rotate(-0.45); text('20 М', 0, 0, 56, '#ffd23f', { fam: FONTS.block }); g.restore();
  }
}
function run(t) {                                      // he stares; the speed card: you ≈ 20 km/h, the bear ≈ 50 km/h
  autumnForest(t, { pan: 10 });
  bear(560, 1000, 250, t, { head: 1, blink: blinkAt(t) });
  const k = clamp(sp(t, A.L1w4 - 0.05, 2.6, 8)) * (1 - seg(A.L2 - 0.35, A.L2 - 0.12, t));
  if (k > 0.01) speedCard(540, 640, k, seg(A.L1w5 - 0.1, A.L1w6 + 0.4, t));
}
function speedCard(x, y, k, fillK) {
  g.save(); g.translate(x, y); g.scale(k, k);
  fill(rrPath(-400, -150, 800, 300, 26), 'rgba(11,15,26,0.88)');
  g.lineWidth = 3; g.strokeStyle = DANGER; g.stroke(rrPath(-398.5, -148.5, 797, 297, 25));
  const row = (yy, lbl, kmh, c) => {
    text(lbl, -370, yy + 16, 44, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false });
    fill(rrPath(-120, yy - 22, 340, 44, 22), 'rgba(255,255,255,0.15)'); fill(rrPath(-120, yy - 22, 340 * kmh / 50 * fillK, 44, 22), c);
    text(`${Math.round(kmh * fillK)} КМ/Ч`, 370, yy + 16, 44, c, { fam: FONTS.cond, align: 'right', shadow: false });
  };
  row(-62, 'ТЫ', 20, '#9fd3ff'); row(62, 'МЕДВЕДЬ', 50, DANGER);
  g.restore();
}
function tree(t) {                                     // «не лезь на дерево»: a big trunk, a bear shape climbing it — crossed out
  autumnForest(t, { pan: -60 });
  bear(820, 990, 190, t, { head: 1, blink: blinkAt(t) });
  bigTree(330, 1110, 950, t, { climb: seg(A.L2w5 - 0.1, A.L3 - 0.2, t, x => x) });
  const x = seg(A.L2w2 - 0.1, A.L2w2 + 0.2, t);
  if (x > 0.01) Hd.redX(330, 560, 170, x);
}
function big(t) {                                      // the cat into her arms; she stands tall, a hand up
  autumnForest(t, { pan: 0 });
  bear(560, 995, 250, t, { head: 1, tilt: 0.06 * Math.sin(t * 1.3), blink: blinkAt(t) });
}
function talk(t) {                                     // closer: he tilts his head at «мишка»
  const z = seg(shotStart('talk'), A.L5, t, x => x);
  autumnForest(t, { pan: 0 });
  const tilt = seg(A.L4w4 - 0.1, A.L4w4 + 0.4, t) * 0.28 * (1 - seg(A.L4w6, A.L4w6 + 0.6, t) * 0.6);
  bear(570, 1040, lerp(370, 395, z), t, { head: 1, tilt, blink: blinkAt(t) });
}
function back(t) {                                     // backing away sideways: the camera moves with her, the forest slides
  const pan = 300 * seg(A.L5w3 - 0.1, A.L6 - 0.2, t);
  autumnForest(t, { pan });
  bear(560 - pan * 0.6, 995, 240, t, { head: 1, blink: blinkAt(t) });
}
function stand(t) {                                    // he rises onto his hind legs, sniffs the air; «фух» — down, and away
  autumnForest(t, { pan: 300 });
  const st = seg(T.up, T.up + 0.7, t, ease.out) * (1 - seg(T.fuh - 0.1, T.fuh + 0.35, t));
  if (t < T.gone) bear(380, 1000, 240, t, { stand: st, sniff: seg(A.L6w8, A.L6w9, t) * (1 - seg(T.fuh - 0.2, T.fuh, t)), blink: blinkAt(t) });
  else { const w = seg(T.gone, T.gone + 2.6, t, x => x); bearSide(lerp(380, 1300, w), 1000 - 30 * w, 220 * (1 - 0.25 * w), t); }
}
function cub(t) {                                      // Факт looks at the bushes: a cub peeks out — the mother is near
  autumnForest(t, { pan: 300 });
  bushCub(270, 1090, 1.5, t, { shake: seg(A.L7w2, A.L7w3, t) * (1 - seg(A.L7w5, A.L7w6, t)) + 0.4 * seg(T.cub, T.cub + 0.1, t) * (1 - seg(T.cub + 0.5, T.cub + 0.8, t)), peek: seg(T.cub, T.cub + 0.5, t, ease.out) });
}
const SHOT = { meet, run, tree, big, talk, back, stand, cub };

// —— Искра and Факт in front: her poses by the step, her mouth with her voice; he reacts ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L1 && t < A.L2 - 0.1) return 'myth';                 // «не беги»: arms crossed
  if (t >= A.L2 - 0.1 && t < A.L3 - 0.1) return 'left';
  if (t >= A.L3w4 && t < A.L4 - 0.1) return 'hi';                  // «руки вверх»
  if (t >= T.fuh && t < A.L7) return 'truth';                      // «фух… ушёл»
  if (t >= A.L7w10) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < A.L1) return 'wow';
  if (t >= A.L1 && t < A.L3) return 'doubt';
  if (t >= A.L3 && t < A.L5) return 'front';
  if (t >= A.L6 && t < T.fuh) return 'wow';
  if (t >= T.fuh && t < A.L7) return 'sure';
  if (t >= A.L7) return 'profile';
  return 'front';
}
let lastPose = null, poseSince = -9, lastCat = null, catSince = -9;
function hosts(t) {
  const p = poseOf(t), c = catOf(t);
  if (p !== lastPose) { lastPose = p; poseSince = t; }
  if (c !== lastCat) { lastCat = c; catSince = t; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // the cat goes into her arms on «Факта — на руки» and back down when they are safe
  const held = seg(A.L3w0 - 0.05, A.L3w3, t, ease.out) * (1 - seg(A.L6w11, A.L6w12, t));
  const cx = lerp(800, 360, held), cy = lerp(1862, 1800, held), ch = lerp(330, 300, held);
  const tall = 1 + 0.05 * seg(A.L3w4, A.L3w5, t) * (1 - seg(A.L6w11, A.L6w12, t));
  const side = 6 * Math.sin(t * 9) * seg(A.L5w3, A.L5w4, t) * (1 - seg(A.L6 - 0.4, A.L6 - 0.2, t));   // the sideways shuffle
  if (held < 0.5) { ell(cx, 1858, 150, 24, 'rgba(0,0,0,0.25)'); cat(t, c, cx, cy, ch, { hop: catSince > 0.2 ? catSince : null }); }
  iskra(t, p, 300 + side, 1945, 720 * tall, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  if (held >= 0.5) cat(t, 'front', cx + side, cy, ch, {});
}

// —— the 2D layer ——
function series(y = 110, k = 1) {                      // «ПРИКЛЮЧЕНИЯ ИСКРЫ · СЕРИЯ 1»: the series mark at the top
  if (k <= 0.01) return;
  const s = 'ПРИКЛЮЧЕНИЯ ИСКРЫ · СЕРИЯ 1', w = measure(s, 40, FONTS.cond) + 56;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  fill(rrPath(540 - w / 2, y - 32, w, 64, 32), 'rgba(10,14,22,0.78)');
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,176,102,0.85)'; g.stroke(rrPath(540 - w / 2 + 1.5, y - 30.5, w - 3, 61, 30));
  text(s, 540, y + 14, 40, WARM, { fam: FONTS.cond, shadow: false });
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
function sayBubble(t) {                                // «ЭЙ, МИШКА, Я ЧЕЛОВЕК!» from her
  const k = clamp(sp(t, A.L4w3 - 0.08, 2.6, 8)) * (1 - seg(A.L5 - 0.35, A.L5 - 0.12, t));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(430, 640); g.scale(k, k); g.rotate(-0.03);
  const s1 = 'ЭЙ, МИШКА,', s2 = 'Я ЧЕЛОВЕК!', w = Math.max(measure(s1, 58, FONTS.cond), measure(s2, 58, FONTS.cond)) + 90;
  fill(rrPath(-w / 2 + 8, -86 + 8, w, 172, 40), INK); fill(rrPath(-w / 2, -86, w, 172, 40), '#ffffff');
  g.beginPath(); g.moveTo(-110, 78); g.lineTo(-215, 250); g.lineTo(-40, 84); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
  text(s1, 0, -14, 58, INK, { fam: FONTS.cond, shadow: false }); text(s2, 0, 56, 58, '#2f8f4e', { fam: FONTS.cond, shadow: false });
  g.restore();
}
function layer(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  series(110);
  headline('КАК ВЫЖИТЬ?', 360, clamp(sp(t, A.L0w11 - 0.1, 2.4, 8)) * (1 - seg(A.L1 - 0.15, A.L1 + 0.05, t)));
  Hd.stepHeader(t, 1, 'НЕ БЕГИ', A.L1 - 0.05, A.L2 - 0.3, 260);
  Hd.stepHeader(t, 2, 'НЕ ЛЕЗЬ НА ДЕРЕВО', A.L2 - 0.05, A.L3 - 0.3, 260);
  P(A.L2w5, A.L3 - 0.3, 400, { icon: 'x', title: 'МЕДВЕДИ ЛАЗАЮТ', color: DANGER, size: 44 });
  Hd.stepHeader(t, 3, 'СТАНЬ БОЛЬШЕ', A.L3 - 0.05, A.L4 - 0.3, 260);
  P(A.L3w0, A.L4 - 0.3, 400, { icon: 'check', title: 'КОТА — НА РУКИ', color: OK, size: 44 });
  P(A.L3w6, A.L4 - 0.3, 520, { icon: 'check', title: 'РУКИ ВВЕРХ', color: OK, size: 44 });
  Hd.stepHeader(t, 4, 'ГОВОРИ СПОКОЙНО', A.L4 - 0.05, A.L5 - 0.3, 260);
  sayBubble(t);
  Hd.stepHeader(t, 5, 'ОТХОДИ БОКОМ', A.L5 - 0.05, A.L6 - 0.3, 260);
  P(A.L5w0, A.L6 - 0.3, 400, { icon: 'check', title: 'РЮКЗАК НЕ СНИМАЙ', color: OK, size: 42 });
  P(A.L5w3, A.L6 - 0.3, 515, { icon: 'check', title: 'МЕДЛЕННО, БОКОМ', color: OK, size: 42 });
  P(A.L5w7, A.L6 - 0.3, 630, { icon: 'x', title: 'СПИНОЙ НЕ ПОВОРАЧИВАЙСЯ', color: DANGER, size: 40 });
  P(A.L6w5, A.L6w11 - 0.1, 300, { icon: 'check', title: 'ВСТАЛ = НЮХАЕТ', sub: 'ЭТО НЕ НАПАДЕНИЕ', color: GOLD, size: 46 });
  P(A.L6w12, A.L7 - 0.3, 300, { icon: 'check', title: 'УШЁЛ', color: OK, size: 50 });
  P(A.L7w7, A.L7w10 - 0.1, 300, { icon: 'x', title: 'МЕДВЕЖОНОК = МАМА РЯДОМ', color: DANGER, size: 40 });
  // the end: the only choice — at the end (the rule of 17.11)
  headline('ЧТО ДЕЛАТЬ?', 300, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'БЕЖАТЬ К РЕКЕ', 540, 500, clamp(sp(t, A.L7w10 - 0.06, 2.6, 8)));
  button('2', 'ТИХО НАЗАД', 540, 670, clamp(sp(t, A.L7w15 - 0.06, 2.6, 8)));
  const kp = clamp(sp(t, A.L7w19 - 0.1, 2.4, 8));
  if (kp > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = kp; text('ПИШИ 1 ИЛИ 2', 730, 800, 52, '#ffffff', { fam: FONTS.cond }); text('В КОММЕНТАРИЯХ', 730, 860, 52, '#ffffff', { fam: FONTS.cond }); g.restore(); }
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  autumnForest(0.3, { pan: 10 });
  bear(600, 1060, 400, 0.3, { head: 1 });
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  series(110);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('МЕДВЕДЬ В 20 МЕТРАХ?', 280, 66, '#ffd23f', INK, -0.04);
  box('НЕ БЕГИ!', 450, 110, '#e53935', '#ffffff', 0.03);
  g.save(); g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(600, 900, 250, 230, 0, 0, TAU); g.stroke(); g.restore();
  sprite('h_wow', 290, 1925, 640);
  sprite('c_wow', 830, 1905, 420);
}

// which flat colours get which texture
const TEXMAP = {};
export function init() { Hd.initHud(); initTex(TEXMAP); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(); Hd.finish(t, 0.5); return; }
  const z = zoomAt(t);
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
  add(0.05, 'forest_amb', -20, 0, { dur: DUR });
  add(0.4, 'sniff', -16, 0.1, { dur: 1.4, n: 4 }); add(A.L0w10, 'bear_huff', -10, 0.1);
  add(A.L1w1, 'pop_word', -10, 0); add(A.L1w5, 'ticks_up', -14, 0, { dur: 0.9 });
  add(A.L2w2, 'wall_hit', -16, -0.2); add(A.L2w5, 'scrape', -18, -0.3, { dur: 0.9 });
  add(A.L3w0, 'cloth', -12, -0.2); add(A.L3w6, 'whoosh', -16, 0);
  add(A.L4w4 + 0.1, 'bear_huff', -16, 0.1, { dur: 0.7 });
  add(A.L5w3, 'leaves', -20, -0.3, { dur: 1.4 });
  add(T.up, 'bear_huff', -8, 0, { dur: 1.0 }); add(A.L6w8, 'sniff', -12, 0, { dur: 1.6, n: 5 });
  add(T.gone, 'leaves', -18, 0.4, { dur: 1.6 });
  add(A.L7w2, 'leaves', -12, -0.3, { dur: 1.2 }); add(T.cub, 'leaves', -10, -0.3, { dur: 0.6 }); add(T.cub + 0.15, 'heartbeat', -14, 0, { dur: 2.4 });
  for (const t0 of [A.L1 - 0.05, A.L2 - 0.05, A.L3 - 0.05, A.L4 - 0.05, A.L5 - 0.05]) add(t0, 'pop_word', -10, 0);
  add(A.L7w10, 'pop_word', -10, 0); add(A.L7w15, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
