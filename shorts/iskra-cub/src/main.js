// «Приключения Искры» №2 «Медвежонок» — 2D. The owner, 18.11: «давай ещё интересных видео сделаем для удержания
// аудитории». №1 ended on a cub in the bushes (1 run to the river / 2 quietly back); no votes, so we take 2, the right
// way. Standalone: a cub in the bushes is its own hook. On screen: the autumn forest; Искра and Факт in front (her
// sheets, waist up). Steps on their words: do not approach and do not film it (the mother defends it) → never stand
// between them → the cat into her arms, back the same path, quietly → the mother: huffs and slaps the ground = go away
// → she charges — do not run, stand; she stops: a bluff charge → back away facing her, talk calmly; she takes the cub,
// they leave. The end: a torn power line on the road — 1 step over / 2 go round, far (the only choice, at the end — the
// rule of 17.11; the answer is №3). The series mark at the top all along. The first 3 frames are the cover
// («МЕДВЕЖОНОК В КУСТАХ? / НЕ ПОДХОДИ!»). Facts: the US National Park Service bear-safety pages (voice/script.json).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU, hash } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb, poly } from './flat.js';
import * as Hd from './hud.js';
import { autumnForest, bear, bearSide, bushCub, dust, HOR } from './bear.js';
import { wireRoad, sparks } from './wire.js';
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
const HOT = { МЕДВЕЖОНОК: DANGER, МАМА: DANGER, ВЫЖИТЬ: GOLD, ПОДХОДИ: DANGER, СНИМАЙ: DANGER, ЗАЩИЩАЕТ: GOLD, ВСТАВАЙ: DANGER, ОПАСНОЕ: DANGER,
  РУКИ: OK, НАЗАД: OK, ТИХО: OK, ТРОПОЙ: OK, ПЫХТИТ: DANGER, БЬЁТ: DANGER, УХОДИ: GOLD, БЕЖИТ: DANGER, БЕГУ: DANGER, СТОЮ: OK, ЛОЖНАЯ: GOLD,
  АТАКА: GOLD, МЕДЛЕННО: OK, ЛИЦОМ: OK, СПОКОЙНО: OK, ФУХ: OK, ПРОВОД: DANGER, ОБОРВАННЫЙ: DANGER, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['meet', 0], ['near', A.L1 - 0.1], ['between', A.L2 - 0.1], ['back', A.L3 - 0.1], ['warn', A.L4 - 0.1], ['charge', A.L5 - 0.1], ['leave', A.L6 - 0.1], ['wire', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { cub: A.L0w9 - 0.1, mom: A.L0w11, out: A.L4w3 - 0.35, slam: A.L4w8, charge: A.L5 - 0.05, stop: A.L5w6, take: A.L6w8, fuh: A.L6w10, spark: A.L7w4, q: A.L7w6 - 0.1 };
export const MARKS = { A, ...T, up: A.L4, end: A.L7, c1: shotStart('near'), c2: shotStart('between'), c3: shotStart('back'), c4: shotStart('warn'), c5: shotStart('charge'), c6: shotStart('leave'), c7: shotStart('wire') };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w9, A.L1w2, T.out + 0.3, T.slam, A.L5, T.stop, T.spark];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }
const blinkAt = t => ((t + 0.7) % 3.7) < 0.12 ? 1 : 0;
// the shake: when she slaps the ground, all through the charge, and when she stops
function shakeAt(t) {
  let k = Math.exp(-Math.max(0, t - T.slam) / 0.12) * (t >= T.slam ? 1 : 0) * 14;
  if (t >= T.charge && t < T.stop) k = Math.max(k, 7 * seg(T.charge, T.charge + 0.4, t));
  if (t >= T.stop) k = Math.max(k, 16 * Math.exp(-(t - T.stop) / 0.15));
  return k;
}
const cubPeek = t => seg(T.cub, T.cub + 0.5, t, ease.out);
const cubShake = t => seg(A.L0w6, A.L0w7, t) * (1 - seg(A.L0w9, A.L0w9 + 0.2, t)) + 0.4 * seg(T.cub, T.cub + 0.1, t) * (1 - seg(T.cub + 0.5, T.cub + 0.8, t));
// the mother far among the trees: a ghost in the haze (k 0…1)
function ghostMom(x, y, h, t, k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k * 0.75; bear(x, y, h, t, { head: 1, blink: blinkAt(t) }); g.restore();
  g.save(); g.globalAlpha = k * 0.45; ell(x, y - h * 0.5, h * 0.95, h * 0.75, '#efe6d2'); g.restore();
}

// —— the shots ——
function meet(t) {                                     // the path; the bush shakes — a cub peeks out; «мама рядом»: a shape in the trees
  const push = seg(0, A.L1, t, x => x);
  g.save(); g.translate(540, 900); g.scale(1 + 0.05 * push, 1 + 0.05 * push); g.translate(-540, -900);
  autumnForest(t, { pan: 10 * push });
  ghostMom(250, HOR + 95, 120, t, seg(T.mom - 0.1, T.mom + 0.5, t));
  bushCub(700, 1010, 1.3, t, { shake: cubShake(t), peek: cubPeek(t) });
  g.restore();
  const q = seg(T.mom, T.mom + 0.3, t) * (1 - seg(A.L1 - 0.4, A.L1 - 0.15, t));
  if (q > 0.01) { g.save(); g.globalAlpha = q; text('?', 250, HOR - 70, 120, '#e53935', { fam: FONTS.block }); g.restore(); }
}
function phone(x, y, k) {                              // a phone with its camera up — crossed out on «не снимай»
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(0.12);
  rrect(-80, -140, 160, 280, 26, '#1f2433'); rrect(-68, -118, 136, 236, 14, '#9fd3ff');
  ell(0, -10, 34, 34, '#ffffff', 0, 0.9); ell(0, -10, 20, 20, '#1f2433'); rect(-26, -66, 52, 18, '#ffffff', 0.9);
  g.restore();
}
function near(t) {                                     // close on the cub; «не снимай»: a phone, crossed out
  autumnForest(t, { pan: 40 });
  bushCub(600, 1030, 2.0, t, { shake: 0.15, peek: 1 });
  const k = clamp(sp(t, A.L1w5 - 0.1, 2.6, 8)) * (1 - seg(A.L2 - 0.35, A.L2 - 0.12, t));
  if (k > 0.01) { phone(820, 560, k); const x = seg(A.L1w5, A.L1w5 + 0.25, t); if (x > 0.01) Hd.redX(820, 560, 150, x); }
}
function between(t) {                                  // the cub at the left, the mother somewhere at the right: the space between is red
  autumnForest(t, { pan: 0 });
  bushCub(230, 1000, 1.0, t, { peek: 1 });
  ghostMom(860, 990, 190, t, 1);
  const k = seg(A.L2w2 - 0.1, A.L2w3 + 0.2, t);
  if (k > 0.01) {
    g.save(); g.globalAlpha = 0.35 * k; poly([[330, 940], [760, 900], [780, 1010], [330, 1040]], '#e53935'); g.restore();
    g.save(); g.globalAlpha = k; Hd.dashed([330, 980], [lerp(330, 760, k), 960], '#e53935', 6, 1); g.restore();
    const x = seg(A.L2w4, A.L2w4 + 0.25, t);
    if (x > 0.01) { ell(545, 950, 70, 70, 'rgba(255,255,255,0.85)'); g.save(); g.translate(545, 950); g.scale(x, x); text('Я', 0, 26, 74, INK, { fam: FONTS.block, shadow: false }); g.restore(); Hd.redX(545, 950, 120, x); }
  }
}
function back(t) {                                     // back the same path: the camera retreats, the bush gets small; arrow down the path
  const r = seg(A.L3w4 - 0.1, A.L4 - 0.2, t);
  g.save(); g.translate(540, 900); g.scale(1.12 - 0.12 * r, 1.12 - 0.12 * r); g.translate(-540, -900);
  autumnForest(t, { pan: 0 });
  bushCub(540, lerp(960, 900, r), lerp(1.0, 0.65, r), t, { peek: 1 });
  g.restore();
  const k = seg(A.L3w7 - 0.1, A.L3w7 + 0.3, t);
  if (k > 0.01) {
    g.save(); g.globalAlpha = k;
    for (let i = 0; i < 5; i++) { const y = 900 + i * 55, s = 0.6 + i * 0.12, x = 540 + (i % 2 ? 24 : -24) * s; ell(x, y, 14 * s, 22 * s, '#6b4f30', 0, 0.8); }
    limb([[540, 880], [540, 1150]], 14, '#ffd23f'); poly([[490, 1140], [590, 1140], [540, 1200]], '#ffd23f');
    g.restore();
  }
}
function warn(t) {                                     // «а вот и мама»: she steps out, huffs, slaps the ground — dust
  autumnForest(t, { pan: 0 });
  bushCub(260, 1000, 0.95, t, { peek: 1 });
  const x = lerp(1250, 640, seg(T.out, T.out + 0.7, t, ease.out));
  const huff = seg(A.L4w4, A.L4w4 + 0.2, t) * (1 - seg(A.L4w6 - 0.1, A.L4w6, t));
  const paw = seg(A.L4w6 - 0.05, T.slam - 0.12, t, ease.out) * (1 - seg(T.slam - 0.08, T.slam, t, ease.in));
  bear(x, 1010, 300, t, { head: 1, blink: blinkAt(t), open: Math.max(huff * (0.5 + 0.5 * Math.sin(t * 18)), 0.6 * seg(T.slam, T.slam + 0.1, t) * (1 - seg(T.slam + 0.5, T.slam + 0.8, t))),
    puff: ((t - A.L4w4) % 0.6) / 0.6 * (t > A.L4w4 && t < A.L4w6 + 0.3 ? 1 : 0), paw });
  dust(x + 70, 1010, 70, (t - T.slam) / 0.9);
}
function charge(t) {                                   // she charges at us — and stops a few steps away (a bluff)
  autumnForest(t, { pan: 0, haze: 0 });
  const r = seg(T.charge, T.stop, t, x => x * x);
  const h = lerp(300, 600, r), y = lerp(1010, 1180, r);
  const run = t < T.stop ? Math.abs(Math.sin((t - T.charge) * 9)) * 22 * seg(T.charge, T.charge + 0.3, t) : 0;
  for (let i = 0; i < 4; i++) { const tt = t - i * 0.25; if (tt > T.charge && tt < T.stop + 0.6) dust(lerp(640, 560, r) + (i % 2 ? -1 : 1) * 60, y - 4, 60 + i * 10, ((t - T.charge) % 0.5) / 0.5); }
  bear(lerp(640, 560, r), y - run, h, t, { head: t < T.stop ? 0.55 : 1, blink: blinkAt(t), open: t < T.stop ? 0.5 : 0.8 * (1 - seg(T.stop + 0.6, T.stop + 1.2, t)), puff: t > T.stop ? ((t - T.stop) % 0.7) / 0.7 : 0 });
  dust(560, 1180, 150, (t - T.stop) / 1.1);
}
function leave(t) {                                    // backing away facing her; she turns, the cub comes out, they go
  const back = seg(A.L6, A.L6w7, t);
  g.save(); g.translate(540, 1000); g.scale(1.08 - 0.08 * back, 1.08 - 0.08 * back); g.translate(-540, -1000);
  autumnForest(t, { pan: 0 });
  const cubOut = seg(T.take, T.take + 0.6, t), go = seg(T.take + 0.3, T.take + 3.2, t, x => x);
  if (t < T.take) { bushCub(260, 1000, 0.95, t, { peek: 1 }); bear(lerp(560, 600, back), lerp(1180, 1060, back), lerp(600, 380, back), t, { head: 1, blink: blinkAt(t) }); }
  else {
    bushCub(260, 1000, 0.95, t, { peek: 1 - cubOut });
    bearSide(lerp(600, 1350, go) - 380 * (1 - seg(T.take, T.take + 0.4, t)), 1060 - 50 * go, 300 * (1 - 0.3 * go), t, { dir: 1 });
    if (cubOut > 0.05) bearSide(lerp(330, 1180, go), 1010 - 50 * go, 120 * (1 - 0.3 * go), t + 0.3, { dir: 1, phase: t * 7 });
  }
  g.restore();
}
function wire(t) {                                     // a forest road: a torn power line lies across it, sparking
  const push = seg(A.L7, A.L7w6, t, x => x);
  g.save(); g.translate(540, 1000); g.scale(1 + 0.05 * push, 1 + 0.05 * push); g.translate(-540, -1000);
  wireRoad(t, { pan: 0, spark: seg(T.spark - 0.05, T.spark + 0.1, t) * (0.6 + 0.4 * Math.sin(t * 5)) + 0.25 * seg(A.L7, A.L7 + 0.3, t) });
  g.restore();
}
const SHOT = { meet, near, between, back, warn, charge, leave, wire };

// —— Искра and Факт in front: her poses by the step, her mouth with her voice; he reacts ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L0w9 && t < A.L1 - 0.1) return 'right';               // there, in the bush
  if (t >= A.L1 && t < A.L1w7) return 'myth';                     // «не подходи»: arms crossed
  if (t >= A.L2 && t < A.L3 - 0.1) return 'myth';                  // «не вставай между ними»
  if (t >= A.L5w3 && t < A.L5w6) return 'myth';                    // «не бегу. стою»
  if (t >= T.fuh && t < A.L7) return 'truth';                      // «фух»
  if (t >= A.L7w6) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < A.L0w9) return 'front';
  if (t < A.L1) return 'wow';
  if (t < A.L3) return 'doubt';
  if (t >= A.L4 && t < T.fuh) return 'wow';
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
  // the cat goes into her arms on «Факта — на руки» and back down on «фух»
  const held = seg(A.L3w0 - 0.05, A.L3w3, t, ease.out) * (1 - seg(T.fuh, T.fuh + 0.3, t));
  const cx = lerp(800, 360, held), cy = lerp(1862, 1800, held), ch = lerp(330, 300, held);
  const tremble = (t >= T.charge && t < T.stop + 0.5) ? 3 * Math.sin(t * 40) : 0;
  const tall = 1 + 0.04 * seg(A.L5w4, A.L5w5, t) * (1 - seg(A.L6, A.L6 + 0.3, t));
  if (held < 0.5) { ell(cx, 1858, 150, 24, 'rgba(0,0,0,0.25)'); cat(t, c, cx, cy, ch, { hop: catSince > 0.2 ? catSince : null }); }
  iskra(t, p, 300 + tremble, 1945, 720 * tall, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  if (held >= 0.5) cat(t, c === 'wow' ? 'wow' : 'front', cx + tremble, cy, ch, {});
}

// —— the 2D layer ——
const SERIES = 'ПРИКЛЮЧЕНИЯ ИСКРЫ · СЕРИЯ 2';
function series(y = 110, k = 1) {                      // the series mark at the top
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
  headline('КАК ВЫЖИТЬ?', 360, clamp(sp(t, A.L0w13 - 0.1, 2.4, 8)) * (1 - seg(A.L1 - 0.15, A.L1 + 0.05, t)));
  P(A.L0w11, A.L0w13 - 0.15, 330, { icon: 'x', title: 'МАМА РЯДОМ', color: DANGER, size: 50 });
  Hd.stepHeader(t, 1, 'НЕ ПОДХОДИ', A.L1 - 0.05, A.L2 - 0.3, 260);
  P(A.L1w5, A.L2 - 0.3, 400, { icon: 'x', title: 'НЕ СНИМАЙ', color: DANGER, size: 44 });
  P(A.L1w7, A.L2 - 0.3, 515, { icon: 'check', title: 'МАМА ЗАЩИЩАЕТ МАЛЫША', color: GOLD, size: 40 });
  Hd.stepHeader(t, 2, 'НЕ МЕЖДУ НИМИ', A.L2 - 0.05, A.L3 - 0.3, 260);
  P(A.L2w7, A.L3 - 0.3, 400, { icon: 'x', title: 'САМОЕ ОПАСНОЕ МЕСТО', color: DANGER, size: 42 });
  Hd.stepHeader(t, 3, 'ТИХО НАЗАД', A.L3 - 0.05, A.L4 - 0.3, 260);
  P(A.L3w0, A.L4 - 0.3, 400, { icon: 'check', title: 'КОТА — НА РУКИ', color: OK, size: 44 });
  P(A.L3w7, A.L4 - 0.3, 515, { icon: 'check', title: 'ТОЙ ЖЕ ТРОПОЙ', color: OK, size: 44 });
  P(A.L4w4, A.L5 - 0.3, 300, { icon: 'x', title: 'ПЫХТИТ', color: DANGER, size: 46 });
  P(A.L4w6, A.L5 - 0.3, 415, { icon: 'x', title: 'БЬЁТ ПО ЗЕМЛЕ', color: DANGER, size: 46 });
  P(A.L4w11, A.L5 - 0.3, 530, { icon: 'check', title: '= УХОДИ', color: GOLD, size: 50 });
  Hd.stepHeader(t, 4, 'НЕ БЕГИ — СТОЙ', A.L5w3 - 0.05, A.L6 - 0.3, 260);
  P(A.L5w8, A.L6 - 0.3, 400, { icon: 'check', title: 'ЛОЖНАЯ АТАКА', sub: 'БЕГ = ПОГОНЯ', color: GOLD, size: 46 });
  Hd.stepHeader(t, 5, 'ОТХОДИ ЛИЦОМ К НЕЙ', A.L6 - 0.05, A.L7 - 0.3, 260);
  P(A.L6w5, A.L7 - 0.3, 400, { icon: 'check', title: 'ГОВОРИ СПОКОЙНО', color: OK, size: 44 });
  P(T.fuh, A.L7 - 0.3, 515, { icon: 'check', title: 'УШЛИ', color: OK, size: 50 });
  P(A.L7w4, T.q - 0.1, 330, { icon: 'x', title: 'ОБОРВАННЫЙ ПРОВОД', color: DANGER, size: 44 });
  // the end: the only choice — at the end (the rule of 17.11)
  headline('ЧТО ДЕЛАТЬ?', 300, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'ПЕРЕШАГНУТЬ', 540, 500, clamp(sp(t, A.L7w6 - 0.06, 2.6, 8)));
  button('2', 'ОБОЙТИ ПОДАЛЬШЕ', 540, 670, clamp(sp(t, A.L7w9 - 0.06, 2.6, 8)));
  const kp = clamp(sp(t, A.L7w13 - 0.1, 2.4, 8));
  if (kp > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = kp; text('ПИШИ 1 ИЛИ 2', 730, 800, 52, '#ffffff', { fam: FONTS.cond }); text('В КОММЕНТАРИЯХ', 730, 860, 52, '#ffffff', { fam: FONTS.cond }); g.restore(); }
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  autumnForest(0.3, { pan: 10 });
  bear(860, 980, 330, 0.3, { head: 1, open: 0.7 });                 // the mother, right behind the bush
  bushCub(560, 1080, 2.0, 0.3, { peek: 1 });
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  series(110);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('МЕДВЕЖОНОК В КУСТАХ?', 280, 64, '#ffd23f', INK, -0.04);
  box('НЕ ПОДХОДИ!', 450, 104, '#e53935', '#ffffff', 0.03);
  g.save(); g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(575, 870, 190, 170, 0, 0, TAU); g.stroke(); g.restore();
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
  add(0.05, 'forest_amb', -20, 0, { dur: DUR });
  add(A.L0w6, 'leaves', -14, 0.3, { dur: 1.0 }); add(T.cub, 'leaves', -12, 0.3, { dur: 0.5 }); add(T.cub + 0.1, 'sniff', -20, 0.3, { dur: 0.8, n: 3 });
  add(T.mom, 'heartbeat', -14, 0, { dur: 2.4 });
  add(A.L1w5, 'pop_word', -10, 0);
  add(A.L2w4, 'pop_word', -12, 0);
  add(A.L3w0, 'cloth', -12, -0.2); add(A.L3w4, 'leaves', -20, -0.2, { dur: 1.6 });
  add(T.out, 'leaves', -12, 0.4, { dur: 0.9 });
  add(A.L4w4, 'bear_huff', -8, 0.1, { dur: 0.9 }); add(A.L4w4 + 0.55, 'bear_huff', -10, 0.1, { dur: 0.7 });
  add(T.slam, 'thud', -6, 0.1); add(T.slam, 'wall_hit', -12, 0.1);
  add(T.charge, 'hooves', -8, 0, { dur: T.stop - T.charge, rate: 6.0 }); add(T.charge, 'bear_huff', -6, 0, { dur: 1.0 });
  add(T.charge + 0.2, 'heartbeat', -10, 0, { dur: 3.0, bpm: 130 });
  add(T.stop, 'scrape', -10, 0, { dur: 0.7 }); add(T.stop, 'thud', -8, 0); add(T.stop + 0.1, 'bear_huff', -8, 0, { dur: 1.0 });
  add(T.take, 'leaves', -16, 0.3, { dur: 2.4 });
  add(A.L7, 'spark', -18, -0.2); add(T.spark, 'spark', -8, -0.2); add(T.spark + 0.7, 'spark', -14, -0.2); add(A.L7w9, 'spark', -16, -0.2);
  for (const t0 of [A.L1 - 0.05, A.L2 - 0.05, A.L3 - 0.05, A.L5w3 - 0.05, A.L6 - 0.05]) add(t0, 'pop_word', -10, 0);
  add(A.L7w6, 'pop_word', -10, 0); add(A.L7w9, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
