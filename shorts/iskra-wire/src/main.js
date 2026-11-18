// «Приключения Искры» №3 «Провод на земле» — 2D. The owner, 18.11: «давай ещё интересных видео сделаем для удержания
// аудитории». №2 ended on a torn power line across the road (1 step over / 2 go round, far). Standalone: the wire falls
// three steps from Искра and Факт — they are already inside the zone. Steps on their words: do not run — the current
// spreads through the ground, about 8 m around → a long step: the current goes through the legs (a card) → the goose
// step: heel to toe, feet on the ground (a card) → the cat into her arms, no hopping: fall — and you touch the ground with
// your hands → walk so till 8 m and a bit more (a map card) → out: call 112, keep people away. The end: home, a gas smell
// on the stairs — 1 turn on the light / 2 touch nothing (the only choice, at the end — the rule of 17.11). The series mark
// at the top all along. The first 3 frames are the cover («УПАЛ ПРОВОД РЯДОМ? / НЕ БЕГИ!»). Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU, hash } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb, poly, smoothPath } from './flat.js';
import * as Hd from './hud.js';
import { HOR } from './bear.js';
import { wireRoad, sparks, groundRings, walker, stairwell } from './wire.js';
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
const HOT = { ПРОВОД: DANGER, ОБОРВАННЫЙ: DANGER, ИСКРИТ: DANGER, ВЫЖИТЬ: GOLD, БЕГИ: DANGER, ТОК: DANGER, ВОСЕМЬ: GOLD, ШИРОКИЙ: DANGER,
  НОГИ: DANGER, ГУСИНЫЙ: OK, ПЯТКА: OK, НОСКУ: OK, ОТРЫВАЮ: OK, РУКИ: OK, ПРЫГАЮ: DANGER, РУКАМИ: DANGER, ЧУТЬ: GOLD, 'ЧУТЬ-ЧУТЬ': GOLD,
  ВЫШЛА: OK, СТО: GOLD, ДВЕНАДЦАТЬ: GOLD, ПРОВОДУ: DANGER, ГАЗА: DANGER, ЗАПАХ: DANGER, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['fall', 0], ['rings', A.L1 - 0.1], ['legs', A.L2 - 0.1], ['goose', A.L3 - 0.1], ['hold', A.L4 - 0.1], ['map', A.L5 - 0.1], ['call', A.L6 - 0.1], ['gas', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { snap: 0.35, land: 1.0, spark: A.L0w12, run: A.L1w2, legs: A.L2w4, goose: A.L3w2, out: A.L6w0, call: A.L6w1, stop: A.L6w6, gas: A.L7w5, q: A.L7w7 - 0.1 };
export const MARKS = { A, ...T, end: A.L7, c1: shotStart('rings'), c2: shotStart('legs'), c3: shotStart('goose'), c4: shotStart('hold'), c5: shotStart('map'), c6: shotStart('call'), c7: shotStart('gas') };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [T.land, A.L0w10, T.spark, T.run, T.legs, A.L4w6, T.out, T.gas];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }
const shakeAt = t => (t >= T.land ? 14 * Math.exp(-(t - T.land) / 0.15) : 0) + (t >= T.spark ? 8 * Math.exp(-(t - T.spark) / 0.12) : 0);
// the sparks: a steady crackle, bursts on «оборванный», «искрит»
const sparkAt = t => t < T.land ? 0 : 0.45 + 0.25 * Math.sin(t * 3.1) + 0.6 * Math.exp(-Math.max(0, t - T.land) / 0.3) + 0.6 * (t > T.spark ? Math.exp(-(t - T.spark) / 0.5) : 0);
const RC = [640, 1000];                                   // where the wire touches the road

// —— the shots ——
function road(t, o = {}) { return wireRoad(t, { fall: o.fall ?? 1, spark: sparkAt(t), sparkSize: o.size ?? 1 }); }
function fall(t) {                                     // the wire snaps and falls onto the road three steps from us
  const push = seg(0, A.L1, t, x => x);
  const zz = 1.22 + 0.06 * push;
  g.save(); g.translate(600, 1000); g.scale(zz, zz); g.translate(-600, -1000);
  road(t, { fall: seg(T.snap, T.land, t, x => x), size: 1.1 });
  g.restore();
  const d = seg(A.L0w7 - 0.1, A.L0w8 + 0.3, t) * (1 - seg(A.L1 - 0.4, A.L1 - 0.15, t));   // «в трёх шагах»: a dashed measure
  if (d > 0.01) {
    g.save(); g.globalAlpha = d; Hd.dashed([330, 1110], [560, 1010], '#ffffff', 5, d); g.restore();
    g.save(); g.globalAlpha = d; g.translate(410, 1020); g.rotate(-0.42); text('3 ШАГА', 0, 0, 52, '#ffd23f', { fam: FONTS.block }); g.restore();
  }
}
function rings(t) {                                    // the current spreads through the ground: rings, the 8 m one dashed
  road(t);
  groundRings(RC[0], RC[1], t, seg(A.L1w3 - 0.1, A.L1w6 + 0.3, t), 600);
  const k = seg(A.L1w10 - 0.1, A.L1w10 + 0.3, t);
  if (k > 0.01) { g.save(); g.globalAlpha = k; Hd.dashed([RC[0], RC[1]], [RC[0] + 600, RC[1]], '#ffffff', 5, k); text('8 М', RC[0] + 330, RC[1] - 30, 64, '#ffd23f', { fam: FONTS.block }); g.restore(); }
}
function dimScene(t, a = 0.55) { road(t); groundRings(RC[0], RC[1], t, 1, 600); g.save(); g.globalAlpha = a; rect(0, 0, W, H, '#0b0f1a'); g.restore(); }
function card(x, y, w, h, k, edge = '#ffffff') {
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.translate(-(x + w / 2), -(y + h / 2)); g.globalAlpha = clamp(k * 2);
  fill(rrPath(x + 10, y + 12, w, h, 30), 'rgba(0,0,0,0.4)'); fill(rrPath(x, y, w, h, 30), '#f4efe2');
  g.lineWidth = 5; g.strokeStyle = edge; g.stroke(rrPath(x + 2.5, y + 2.5, w - 5, h - 5, 28));
}
function legsSide(cx, gy, feet, k, t, current) {        // two legs from the side: feet apart by `feet` px; the current up one, down the other
  const hip = [cx, gy - 330];
  const f1 = [cx - feet / 2, gy - 8], f2 = [cx + feet / 2, gy - 8];
  limb([hip, [lerp(hip[0], f1[0], 0.5) - 6, gy - 170], f1], 46, '#34416a'); limb([hip, [lerp(hip[0], f2[0], 0.5) + 6, gy - 170], f2], 46, '#2a3550');
  for (const f of [f1, f2]) { fill(rrPath(f[0] - 40, gy - 30, 92, 34, 14), '#1d1d24'); }
  fill(rrPath(cx - 70, gy - 400, 140, 90, 30), '#3f6f9e');
  if (current > 0.01) {
    g.save(); g.lineWidth = 12; g.strokeStyle = '#ffd23f'; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([26, 18]); g.lineDashOffset = -t * 160; g.globalAlpha = current;
    g.beginPath(); g.moveTo(f1[0], f1[1]); g.lineTo(lerp(hip[0], f1[0], 0.5) - 6, gy - 170); g.lineTo(hip[0], hip[1] + 20); g.lineTo(lerp(hip[0], f2[0], 0.5) + 6, gy - 170); g.lineTo(f2[0], f2[1]); g.stroke();
    g.restore();
  }
}
function groundStrip(x0, x1, gy) {                     // the ground under the feet: hot (near the wire, left) → cool
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#ffcf3a'); gr.addColorStop(0.5, '#f08a3a'); gr.addColorStop(1, '#6b5a40');
  g.fillStyle = gr; g.fillRect(x0, gy, x1 - x0, 60);
}
function legs(t) {                                     // a card: a wide step — the current goes up one leg and down the other
  dimScene(t);
  const k = clamp(sp(t, A.L2 - 0.05, 2.6, 8));
  card(90, 360, 900, 640, k, DANGER);
  groundStrip(110, 970, 900);
  text('1000 В', 190, 990, 40, '#7a2a10', { fam: FONTS.cond, shadow: false }); text('0 В', 900, 990, 40, '#2b2b2b', { fam: FONTS.cond, shadow: false });
  const wide = seg(A.L2w1 - 0.1, A.L2w2 + 0.2, t);
  legsSide(540, 900, lerp(90, 420, wide), k, t, seg(T.legs - 0.05, T.legs + 0.25, t));
  const z = seg(T.legs, T.legs + 0.2, t);
  if (z > 0.01) { g.save(); g.globalAlpha = z; text('⚡', 540, 600, 120, '#ffd23f', { shadow: false }); g.restore(); }
  g.restore();
}
function sole(x, y, s, a, rot = 0, c = '#3a3f4f') {     // a shoe print from above, the toe up: the sole and the heel
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * 0.85, s * 0.85); g.globalAlpha *= a;
  fill(smoothPath([[-30, -74], [-6, -92], [22, -84], [32, -50], [26, -6], [-24, -6], [-32, -40]]), c);
  fill(smoothPath([[-22, 14], [22, 14], [24, 60], [0, 76], [-24, 60]]), c);
  for (let i = 0; i < 4; i++) rect(-22, -70 + i * 16, 44, 4, '#f4efe2', 0.5);
  g.restore();
}
function goose(t) {                                    // a card: the goose step — heel to toe, feet never leave the ground
  dimScene(t);
  const k = clamp(sp(t, A.L3 - 0.05, 2.6, 8));
  card(90, 360, 900, 640, k, OK);
  groundStrip(110, 970, 940);
  // the prints, heel to toe, appearing one by one from the bottom up (the way out is up)
  const n = 6, t0 = A.L3w4 - 0.2;
  for (let i = 0; i < n; i++) {
    const a = seg(t0 + i * 0.3, t0 + i * 0.3 + 0.2, t);
    if (a > 0.01) sole(560 + (i % 2 ? 30 : -30), 880 - i * 80, 0.95, a, (i % 2 ? 0.04 : -0.04), '#2f6f46');
  }
  const ar = seg(A.L3w7, A.L3w11, t);
  if (ar > 0.01) { g.save(); g.globalAlpha = ar; limb([[760, 880], [760, 470]], 12, OK); poly([[730, 480], [790, 480], [760, 430]], OK); g.restore(); }
  // and the wide one, crossed out, at the left
  const x = seg(A.L3w2, A.L3w3 + 0.2, t);
  if (x > 0.01) { g.save(); g.globalAlpha = x; sole(230, 860, 1, 1, -0.1); sole(270, 560, 1, 1, 0.1); g.restore(); Hd.redX(250, 710, 120, x); }
  g.restore();
}
function hold(t) {                                     // the cat into her arms; no hopping
  road(t); groundRings(RC[0], RC[1], t, 1, 600);
}
function map(t) {                                      // a card from above: the wire, the rings, the steps out past 8 m and a bit more
  dimScene(t, 0.65);
  const k = clamp(sp(t, A.L5 - 0.05, 2.6, 8));
  card(90, 330, 900, 760, k, GOLD);
  const cx = 470, cy = 700;
  for (let i = 6; i >= 1; i--) { g.save(); g.globalAlpha = 0.18 + 0.05 * (6 - i); g.fillStyle = i < 3 ? '#ffd23f' : i < 5 ? '#ff9a3c' : '#e5533d'; g.beginPath(); g.arc(cx, cy, 300 * i / 6, 0, TAU); g.fill(); g.restore(); }
  g.save(); g.lineWidth = 6; g.strokeStyle = DANGER; g.setLineDash([20, 14]); g.beginPath(); g.arc(cx, cy, 300, 0, TAU); g.stroke(); g.restore();
  limb([[cx - 220, cy - 60], [cx - 60, cy + 30], [cx, cy], [cx + 90, cy + 50]], 9, '#1d1a1a'); sparks(cx, cy, 0.8, t, 0.6);
  Hd.dashed([cx, cy], [cx, cy - 300], INK, 4, 1); text('8 М', cx + 50, cy - 160, 54, INK, { fam: FONTS.block, shadow: false });
  // the steps: from where we stood (inside) out, past the ring
  const p0 = [cx + 90, cy + 120], p1 = [cx + 420, cy + 300];
  const w = seg(A.L5w1, A.L5w9, t, x => x);
  const nPr = 14;
  for (let i = 0; i < nPr; i++) { const u = i / (nPr - 1); if (u > w) break; const px = lerp(p0[0], p1[0], u), py = lerp(p0[1], p1[1], u); ell(px + (i % 2 ? 7 : -7), py, 6, 10, '#2f8f4e', -0.5); }
  const pin = [lerp(p0[0], p1[0], w), lerp(p0[1], p1[1], w)];
  ell(pin[0], pin[1] - 40, 30, 30, OK); poly([[pin[0] - 18, pin[1] - 26], [pin[0] + 18, pin[1] - 26], [pin[0], pin[1]]], OK); ell(pin[0], pin[1] - 40, 12, 12, '#ffffff');
  const more = seg(A.L5w8 - 0.1, A.L5w9 + 0.2, t);
  if (more > 0.01) { g.save(); g.globalAlpha = more; text('+ ЕЩЁ', pin[0] - 10, pin[1] + 70, 46, '#2f8f4e', { fam: FONTS.block, shadow: false }); g.restore(); }
  g.restore();
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
function call(t) {                                     // out of the zone: calling 112; a man walks up — she stops him
  road(t); groundRings(RC[0], RC[1], t, 0.7, 600);
  const walk = seg(A.L6w3, T.stop + 0.3, t, x => x);
  const turned = t > A.L6w9;
  walker(lerp(1150, 900, walk) + (turned ? 60 * seg(A.L6w9, A.L6w9 + 1.5, t) : 0), 1010, 300, t, { dir: turned ? 1 : -1, walk: t < T.stop + 0.3 || turned ? 1 : 0 });
  phoneCard(800, 560, clamp(sp(t, T.call - 0.1, 2.6, 8)) * (1 - seg(A.L6w5, A.L6w6, t)), t);
  const b = clamp(sp(t, T.stop - 0.05, 2.6, 8)) * (1 - seg(A.L7 - 0.35, A.L7 - 0.12, t));
  if (b > 0.01) {
    g.save(); g.translate(560, 640); g.scale(b, b); g.rotate(-0.03);
    const s1 = 'СТОЙТЕ!', s2 = 'ТАМ ПРОВОД!', w = Math.max(measure(s1, 58, FONTS.cond), measure(s2, 58, FONTS.cond)) + 90;
    fill(rrPath(-w / 2 + 8, -86 + 8, w, 172, 40), INK); fill(rrPath(-w / 2, -86, w, 172, 40), '#ffffff');
    g.beginPath(); g.moveTo(-110, 78); g.lineTo(-215, 250); g.lineTo(-40, 84); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
    text(s1, 0, -14, 58, INK, { fam: FONTS.cond, shadow: false }); text(s2, 0, 56, 58, DANGER, { fam: FONTS.cond, shadow: false });
    g.restore();
  }
}
function gas(t) {                                      // home: the stairwell, a gas smell; the light switch
  stairwell(t, { gas: seg(T.gas - 0.2, T.gas + 0.6, t) });
  const k = seg(A.L7w9 - 0.05, A.L7w9 + 0.25, t);
  if (k > 0.01) { g.save(); g.globalAlpha = k; g.lineWidth = 8; g.strokeStyle = '#ffd23f'; g.beginPath(); g.ellipse(815, 895, 110, 130, 0, 0, TAU); g.stroke(); text('?', 950, 860, 110, '#ffd23f', { fam: FONTS.block }); g.restore(); }
}
const SHOT = { fall, rings, legs, goose, hold, map, call, gas };

// —— Искра and Факт in front: her poses by the step, her mouth with her voice; he reacts ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L1 && t < A.L1w3) return 'myth';                     // «не беги»
  if (t >= A.L4w4 && t < A.L5 - 0.1) return 'myth';                // «не прыгаю»
  if (t >= T.out && t < T.stop - 0.1) return 'truth';              // «вышла!»
  if (t >= T.stop - 0.1 && t < A.L7 - 0.1) return 'hi';            // «никого не пускаю»: a palm up
  if (t >= A.L7w7) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < A.L0w10) return 'front';
  if (t < A.L1) return 'wow';
  if (t < A.L4) return 'doubt';
  if (t >= T.out && t < A.L7) return 'sure';
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
  const held = seg(A.L4w0 - 0.05, A.L4w3, t, ease.out) * (1 - seg(T.out, T.out + 0.3, t));
  const cx = lerp(800, 360, held), cy = lerp(1862, 1800, held), ch = lerp(330, 300, held);
  const tremble = (t >= T.land && t < T.land + 0.6) ? 4 * Math.sin(t * 40) : 0;
  const tall = 1;
  if (held < 0.5) { ell(cx, 1858, 150, 24, 'rgba(0,0,0,0.25)'); cat(t, c, cx, cy, ch, { hop: catSince > 0.2 ? catSince : null }); }
  iskra(t, p, 300 + tremble, 1945, 720 * tall, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  if (held >= 0.5) cat(t, c === 'wow' ? 'wow' : 'front', cx + tremble, cy, ch, {});
}

// —— the 2D layer ——
const SERIES = 'ПРИКЛЮЧЕНИЯ ИСКРЫ · СЕРИЯ 3';
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
  P(A.L0w10, A.L0w13 - 0.15, 330, { icon: 'x', title: 'ОБОРВАННЫЙ ПРОВОД', color: DANGER, size: 46 });
  Hd.stepHeader(t, 1, 'НЕ БЕГИ', A.L1 - 0.05, A.L2 - 0.3, 260);
  P(A.L1w3, A.L2 - 0.3, 400, { icon: 'x', title: 'ТОК — ПО ЗЕМЛЕ', sub: 'НА 8 МЕТРОВ ВОКРУГ', color: DANGER, size: 44 });
  Hd.stepHeader(t, 2, 'НЕ ШАГАЙ ШИРОКО', A.L2 - 0.05, A.L3 - 0.3, 260);
  Hd.stepHeader(t, 3, 'ГУСИНЫЙ ШАГ', A.L3 - 0.05, A.L4 - 0.3, 260);
  P(A.L3w7, A.L4 - 0.3, 1040, { icon: 'check', title: 'НОГИ НЕ ОТРЫВАЙ', color: OK, size: 42 });
  Hd.stepHeader(t, 4, 'НЕ ПРЫГАЙ', A.L4w4 - 0.05, A.L5 - 0.3, 260);
  P(A.L4w0, A.L5 - 0.3, 400, { icon: 'check', title: 'КОТА — НА РУКИ', color: OK, size: 44 });
  P(A.L4w7, A.L5 - 0.3, 515, { icon: 'x', title: 'УПАДЁШЬ — РУКИ НА ЗЕМЛЕ', color: DANGER, size: 40 });
  Hd.stepHeader(t, 5, 'ДО 8 М И ДАЛЬШЕ', A.L5 - 0.05, A.L6 - 0.3, 260);
  P(T.out, A.L7 - 0.3, 300, { icon: 'check', title: 'ВЫШЛА', color: OK, size: 50 });
  P(T.call, A.L7 - 0.3, 415, { icon: 'check', title: 'ЗВОНИ 112', color: GOLD, size: 46 });
  P(A.L7w5, T.q - 0.1, 330, { icon: 'x', title: 'ЗАПАХ ГАЗА', color: DANGER, size: 50 });
  // the end: the only choice — at the end (the rule of 17.11)
  headline('ЧТО ДЕЛАТЬ?', 300, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'ВКЛЮЧИТЬ СВЕТ', 540, 500, clamp(sp(t, A.L7w7 - 0.06, 2.6, 8)));
  button('2', 'НИЧЕГО НЕ ТРОГАТЬ', 540, 670, clamp(sp(t, A.L7w11 - 0.06, 2.6, 8)));
  const kp = clamp(sp(t, A.L7w16 - 0.1, 2.4, 8));
  if (kp > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = kp; text('ПИШИ 1 ИЛИ 2', 540, 800, 52, '#ffffff', { fam: FONTS.cond }); text('В КОММЕНТАРИЯХ', 540, 860, 52, '#ffffff', { fam: FONTS.cond }); g.restore(); }
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(600, 1000); g.scale(1.3, 1.3); g.translate(-600, -1000);
  wireRoad(0.31, { spark: 1, sparkSize: 1.6 });
  groundRings(RC[0], RC[1], 0.3, 1, 600);
  g.restore();
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  series(110);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('УПАЛ ПРОВОД РЯДОМ?', 280, 66, '#ffd23f', INK, -0.04);
  box('НЕ БЕГИ!', 450, 110, '#e53935', '#ffffff', 0.03);
  g.save(); g.lineWidth = 12; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(652, 1000, 210, 160, 0, 0, TAU); g.stroke(); g.restore();
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
  add(0.05, 'forest_amb', -22, 0, { dur: A.L7 - 0.1 });
  add(T.snap - 0.05, 'whoosh_down', -10, 0.3); add(T.land, 'thud', -8, 0.1); add(T.land, 'spark', -4, 0.1);
  for (let x = T.land + 0.6; x < A.L7 - 0.3; x += 1.3 + 0.9 * hash(Math.round(x * 10))) add(x, 'spark', x < A.L2 ? -14 : -22, 0.15);
  add(A.L0w10, 'spark', -8, 0.1); add(T.spark, 'spark', -5, 0.1);
  add(A.L1w3, 'whine', -20, 0, { dur: 1.6 });
  add(T.legs, 'spark', -8, 0); add(T.legs, 'pop_word', -12, 0);
  for (let i = 0; i < 6; i++) add(A.L3w4 - 0.2 + i * 0.3, 'scrape', -22, (i % 2 ? 0.2 : -0.2), { dur: 0.25 });
  add(A.L4w0, 'cloth', -12, -0.2);
  for (let i = 0; i < 6; i++) add(A.L5w1 + i * 0.5, 'scrape', -22, (i % 2 ? 0.2 : -0.2), { dur: 0.3 });
  add(T.call, 'beep', -16, 0.2, { dur: 0.4, f: 425 }); add(T.call + 0.9, 'beep', -16, 0.2, { dur: 0.4, f: 425 });
  add(A.L6w3, 'steps_out', -18, 0.4, { dur: 2.0 });
  add(A.L7 - 0.1, 'amb_flat', -20, 0, { dur: DUR - A.L7 }); add(T.gas, 'drain', -22, 0, { dur: 1.6 });
  for (const t0 of [A.L1 - 0.05, A.L2 - 0.05, A.L3 - 0.05, A.L4w4 - 0.05, A.L5 - 0.05, T.out]) add(t0, 'pop_word', -10, 0);
  add(A.L7w7, 'pop_word', -10, 0); add(A.L7w11, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
