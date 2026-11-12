// «Операция спасения», №1 «Девочка и щенок в тайге» — a new format (11.11, after «Дети в пещере» went down well): a real
// rescue where the viewer is the chief rescuer. Two decisions, each with two numbered buttons and a countdown («РЕШАЙ»),
// then what the rescuers really did («ВЕРНО: 2»). Yakutia, 2014: a little girl went into the taiga with a puppy and was
// missed only days later. 1 search from a helicopter or on foot in a chain — on foot (the grass is taller than a man);
// 2 the puppy came back alone on the 9th day — keep it in the village or set the tracker dogs on its trail — the trail;
// three days later she was found in the tall grass, alive. The end: the statue «the girl and the dog», «call 112 at once».
// On the rules of the Studio export (10.11): a bright first frame, ≈45 s; the first 3 frames are the cover.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawDog } from './dog.js';
import { GROUND, taiga, grass, child, helicopter, searcher, village, trail, berries, stream, statue } from './taiga.js';
import { text, measure, FONTS, INK } from './type.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1500; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok;
const HOT = { ОДНА: DANGER, ТАЙГЕ: GOLD, СПАСАТЕЛЬ: GOLD, ОДИН: GOLD, ДВА: GOLD, ПЕШКОМ: OK, ВИДНО: DANGER, ВЕРНУЛСЯ: GOLD, СЛЕДУ: OK,
  НАШЛИ: OK, ДВЕНАДЦАТЬ: GOLD, ЯГОДЫ: OK, ГРЕЛ: OK, ПАМЯТНИК: GOLD, СРАЗУ: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

// the decisions: [question line, answer line, the two options, the right one (0 or 1), the words where the options pop in]
// L1: Её(0) хватились(1) только(2) через(3) три(4) дня(5) Где(6) искать(7) Один(8) —(9) с(10) вертолёта(11) Два(12) —(13) пешком(14) цепью(15)
// L3: Девятый(0) день(1) щенок(2) вернулся(3) один(4) Один(5) —(6) оставить(7) его(8) в(9) деревне(10) Два(11) —(12) пустить(13) по(14) его(15) следу(16) собак(17)
const Q = [['L1', 'L2', ['С ВЕРТОЛЁТА', 'ПЕШКОМ, ЦЕПЬЮ'], 1, [8, 12]], ['L3', 'L4', ['ОСТАВИТЬ В ДЕРЕВНЕ', 'ПО СЛЕДУ ЩЕНКА'], 1, [5, 11]]];
const T = { c1: A.L1 - 0.06, c3: A.L3 - 0.06, cf: A.L4w8 - 0.1, c6: A.L6 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; });
export const CUTS = [T.c3, T.cf, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c3 ? 'search' : t < T.cf ? 'puppy' : t < T.c6 ? 'found' : 'end');
const qOf = t => (t < T.c3 ? 0 : 1);
const PUNCH = [A.L0w4, T.v0, T.v1, A.L2w4, A.L3w3, A.L4w9, A.L5w0, A.L6w11];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }

// —— the scenes ——
function hookScene(t) {
  taiga(t, { scroll: t * 30 });
  grass(t, GROUND + 120, 300, { n: 50, color: '#76ab43', color2: '#8fc152' });
  child(560, GROUND + 230, 1.05, t, { walk: true });
  drawDog({ x: 380, y: GROUND + 240, s: 0.34, face: 1, t, walk: 1, ph: t * 3, look: 0.2, ears: 0.6 });
  grass(t, 1920, 420, { n: 40, color: '#5f9636', color2: '#73aa45' });
}
function searchScene(t) {
  taiga(t, {});
  const heli = seg(A.L1w8 - 0.3, A.L1w11 + 0.8, t, x => x);
  if (t > A.L1w8 - 0.3) helicopter(lerp(-260, 1300, (heli * 0.6 + (t - A.L1w8) * 0.08) % 1.4), 330 + 10 * Math.sin(t * 3), 0.9, t);
  // the helicopter's view: a cone that shows only the tops of the grass
  if (t > T.v0 && t < A.L2w8) { g.save(); g.globalAlpha = 0.18 * seg(T.v0, T.v0 + 0.3, t); poly([[540, 380], [160, GROUND + 100], [920, GROUND + 100]], '#ffffff'); g.restore(); }
  grass(t, GROUND + 160, 560, { n: 60 });
  // the girl, hidden: only a red ribbon of her dress between the blades, and a «?»
  if (t > T.v0 && t < A.L2w8) { ell(560, GROUND - 120, 14, 10, '#f48fb1'); text('?', 600, GROUND - 200, 90, '#ffffff', { fam: FONTS.block }); }
  // the chain of searchers walking through
  const chain = seg(A.L1w12 - 0.2, A.L1w15, t);
  if (chain > 0) for (let i = 0; i < 6; i++) { const x = lerp(-160, 1240, (i + 0.5) / 6) + (t > T.v0 ? (t - T.v0) * 30 : 0); searcher(x, GROUND + 260 + 10 * (i % 2), 1.1 * chain, t, { ph: i }); }
  grass(t, 1920, 600, { n: 44, color: '#5f9636', color2: '#73aa45' });                     // waist-deep: taller than a man
}
function puppyScene(t) {
  taiga(t, {});
  village(t);
  // the puppy comes out of the taiga, alone, to the gate
  const come = seg(A.L3w2 - 0.2, A.L3w4 + 0.4, t), go = t > T.v1 ? seg(A.L4w1, T.cf, t, x => x) : 0;
  const path = Array.from({ length: 16 }, (_, i) => [lerp(980, 160, i / 15), GROUND + 260 + 30 * Math.sin(i)]);
  trail(path, t > T.v1 ? seg(T.v1, A.L4w2, t) : come * 0.6);
  if (go <= 0) drawDog({ x: lerp(1000, 520, come), y: GROUND + 260, s: 0.5, face: -1, t, walk: come > 0 && come < 1 ? 1 : 0, ph: t * 3, look: -0.2, ears: 0.5 });
  // the tracker dogs and a handler on the trail, back into the taiga
  if (go > 0) {
    for (let i = 0; i < 2; i++) drawDog({ x: lerp(500, 1300, go) - i * 160, y: GROUND + 270 + i * 20, s: 0.55, face: 1, t, walk: 1, ph: t * 4 + i, look: 0.3, ears: 0.9 });
    searcher(lerp(260, 1080, go), GROUND + 300, 1.2, t, {});
  }
  if (t > A.L4w5 - 0.1) { const k = clamp(sp(t, A.L4w5 - 0.1, 2.6, 8)); g.save(); g.translate(540, 300); g.scale(k, k); rrect(-170 + 6, -60 + 8, 340, 120, 24, INK); rrect(-170, -60, 340, 120, 24, GOLD); text('+3 ДНЯ', 0, 24, 70, INK, { shadow: false }); g.restore(); }
}
function foundScene(t) {
  const k = seg(T.cf, T.cf + 0.8, t);
  taiga(t, {});
  stream(t, GROUND + 40);
  berries(170, GROUND + 60, 1.0);
  grass(t, GROUND + 260, 380, { n: 30, x0: -60, x1: 300 }); grass(t, GROUND + 260, 380, { n: 30, x0: 780, x1: 1140 });
  // the grass parts: she sits there with the puppy curled at her side; a rescuer kneels
  child(560, GROUND + 330, 1.1, t, { sit: true, wave: t > A.L5w0 });
  drawDog({ x: 760, y: GROUND + 330, s: 0.32, face: -1, t, sit: 1, look: -0.4, mouth: 0.6, tongue: 1, wag: 1, wagPh: t * 4 });
  searcher(lerp(1150, 900, k), GROUND + 340, 1.2, t, { flip: true });
  if (t > A.L5w0 - 0.1) { const kk = clamp(sp(t, A.L5w0 - 0.1, 2.6, 8)); g.save(); g.translate(540, 300); g.scale(kk, kk); rrect(-230 + 6, -66 + 8, 460, 132, 26, INK); rrect(-230, -66, 460, 132, 26, '#2f8f4e'); text('12 ДНЕЙ', 0, 28, 84, '#ffffff', { shadow: false }); g.restore(); }
  grass(t, 1920, 320, { n: 34, color: '#5f9636', color2: '#73aa45' });
}
function endScene(t) {
  taiga(t, { dusk: 1 });
  // a plane over the airport and the statue
  const px = lerp(-200, 1300, ((t - T.c6) * 0.12) % 1);
  g.save(); g.translate(px, 260); ell(0, 0, 120, 22, '#eceff1'); poly([[-20, -6], [30, -6], [-50, -70]], '#cfd8dc'); poly([[-20, 6], [30, 6], [-50, 70]], '#cfd8dc'); g.restore();
  statue(540, GROUND + 60, 1.4, t);
}

// —— the 2D layer ——
function headline(t) {
  if (t > T.c1 + 0.3) return;
  const a = 1 - seg(T.c1 - 0.1, T.c1 + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = '3 ГОДА. ОДНА В ТАЙГЕ', sw = measure(s, 76) + 80; rrect(-sw / 2 + 10, -62 + 10, sw, 124, 22, INK); rrect(-sw / 2, -62, sw, 124, 22, '#ffd23f'); text(s, 0, 28, 76, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, T.c1 - 0.1, 'НАЙДЁШЬ ЕЁ?', { y: 490, size: 84 });
}
function tag(t) {
  const s = 'ОПЕРАЦИЯ СПАСЕНИЯ', tw = measure(s, 36, FONTS.cond) + 50;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(60 + tw, 150); g.rotate(-0.03); rect(-tw + 6, -30 + 6, tw, 60, INK); rect(-tw, -30, tw, 60, '#ff4d4d'); text(s, -tw / 2, 13, 36, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
}
function dots(t) {
  if (t < T.c1 - 0.1 || t > T.c6) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Q.forEach((q, i) => {
    const x = 860 + i * 100, y = 150, done = t > T['v' + i] + 0.1, cur = qOf(t) === i;
    ell(x, y, 38, 38, done ? '#2f8f4e' : cur ? '#ffd23f' : 'rgba(255,255,255,0.35)');
    text(done ? String(q[3] + 1) : String(i + 1), x, y + 16, 44, done || cur ? '#ffffff' : '#e8eef4', { fam: FONTS.block, shadow: false });
  });
}
function choice(t) {
  Q.forEach(([ql, al, opts, right, wi], i) => {
    const g0 = T['g' + i], v0 = T['v' + i];
    if (t < A[ql] || t > v0 + 1.4) return;
    const done = t >= v0, out = seg(v0 + 1.0, v0 + 1.4, t);
    opts.forEach((s, j) => {
      const k = clamp(sp(t, A[ql + 'w' + wi[j]] - 0.08, 2.6, 8)) * (1 - out); if (k <= 0.01) return;
      const ok = j === right, c = done ? (ok ? '#2f8f4e' : 'rgba(80,80,90,0.85)') : '#fff3d6', tc = done ? '#ffffff' : INK;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + (j ? 240 : -240), 760); g.scale(k * (done && ok ? 1 + 0.1 * bump(clamp((t - v0) / 0.3)) : 1), k);
      rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
      text(String(j + 1), 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
      text(s, 0, 62, measure(s, 36, FONTS.cond) > 400 ? 30 : 36, tc, { fam: FONTS.cond, shadow: false });
      if (done) Hd.label(ok ? '✓' : '✗', 180, -66, 60, '#ffffff', { shadow: false, stroke: false });
      g.restore();
    });
    if (t >= g0 && !done) {
      const u = clamp((t - g0) / Math.max(0.5, v0 - g0));
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 890, 700, 26, 13), 'rgba(255,255,255,0.25)'); fill(rrPath(190, 890, 700 * (1 - u), 26, 13), GOLD);
      Hd.label('РЕШАЙ', 540, 960, 44, '#ffffff', { fam: FONTS.mono });
    }
    if (done) {
      const ks = sp(t, v0, 2.2, 8); if (ks > 0.01 && out < 1) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 470); g.rotate(-0.07); const z = lerp(1.9, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3) * (1 - out);
        const s = 'ВЕРНО: ' + (right + 1), sw = measure(s, 110) + 100; rrect(-sw / 2 + 12, -80 + 12, sw, 160, 24, INK); rrect(-sw / 2, -80, sw, 160, 24, '#2f8f4e'); text(s, 0, 40, 110, '#fff3d6', { shadow: false }); g.restore();
      }
    }
  });
}
function plaques(t) {
  const sc = scene(t), P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  if (sc === 'search' && t > T.v0 + 1.2) { P(A.L2w1, T.c3 - 0.05, 320, { icon: 'x', title: 'ТРАВА ВЫШЕ РОСТА — СВЕРХУ НЕ ВИДНО', color: DANGER, size: 34 }); P(A.L2w8, T.c3 - 0.05, 440, { icon: 'check', title: 'БОЛЬШЕ 100 ЧЕЛОВЕК — ПЕШКОМ', color: OK, size: 38 }); }
  if (sc === 'puppy' && t > T.v1 + 1.2) P(A.L4w1, T.cf - 0.05, 440, { icon: 'check', title: 'СОБАКИ-ИЩЕЙКИ ПО СЛЕДУ ЩЕНКА', color: OK, size: 36 });
  if (sc === 'found') { P(A.L5w5, T.c6 - 0.05, 470, { icon: 'check', title: 'ЯГОДЫ И РЕЧНАЯ ВОДА', color: OK, size: 40 }); P(A.L5w11, T.c6 - 0.05, 590, { icon: 'check', title: 'ЩЕНОК ГРЕЛ ЕЁ НОЧАМИ', color: OK, size: 40 }); }
  if (sc === 'end') {
    P(A.L6w0, DUR + 1, 380, { icon: 'clock', title: 'ЯКУТИЯ, 2014 — ПРАВДИВАЯ ИСТОРИЯ', color: GOLD, size: 36 });
    P(A.L6w8, DUR + 1, 500, { icon: 'phone', title: 'РЕБЁНОК ПРОПАЛ — СРАЗУ 112', color: DANGER, size: 42 });
  }
}

// —— the cover: the first 3 frames (0.05 s) are a thumbnail of their own (the owner's note, 11.11) ——
export const COVER = 0.05;
function cover(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  taiga(t, {});
  helicopter(820, 640, 0.8, t);
  grass(t, GROUND + 200, 360, { n: 50 });
  child(540, GROUND + 330, 1.6, t, {});
  drawDog({ x: 300, y: GROUND + 330, s: 0.5, face: 1, t, sit: 1, look: 0.3, ears: 0.8 });
  g.save(); g.lineWidth = 16; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(470, GROUND - 20, 330, 330, 0, 0, TAU); g.stroke(); g.restore();
  grass(t, 1920, 340, { n: 34, color: '#5f9636', color2: '#73aa45' });
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('3 ГОДА. 12 ДНЕЙ В ТАЙГЕ', 210, 76, '#ffd23f', INK, -0.04);
  box('НАЙДЁШЬ ЕЁ?', 380, 120, '#e53935', '#ffffff', 0.03);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(t); Hd.finish(t, 0.5); return; }
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ hook: hookScene, search: searchScene, puppy: puppyScene, found: foundScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); tag(t); dots(t); plaques(t); choice(t);
  Hd.endCard(t, A.L6w15 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.5);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0); add(0, 'birds', -22, 0, { dur: T.c6 });
  add(A.L1w8, 'heli_far', -14, 0, { dur: T.c3 - A.L1w8 }); add(A.L1w12, 'crowd_steps', -18, 0, { dur: 2.5 });
  add(A.L3w2, 'bark', -16, 0.3); add(A.L4w1, 'bark', -14, 0.2); add(A.L4w1 + 0.4, 'bark', -16, 0.4);
  add(T.cf, 'whoosh', -12, 0); add(A.L5w11, 'tweet', -20, 0.3, { dur: 1.0 });
  Q.forEach(([ql, al, opts, right, wi], i) => {
    add(A[ql + 'w' + wi[0]] - 0.08, 'pop_word', -10, -0.3); add(A[ql + 'w' + wi[1]] - 0.08, 'pop_word', -10, 0.3);
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, 'ding', -8, 0);
  });
  add(T.c6, 'paper', -12, 0); add(A.L6w15 - 0.1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
