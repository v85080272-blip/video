// «Правда или миф», №7 «Заблудился в лесу» — the first with the new hosts: Искра and her cat Факт (the user's character
// sheets of 11.11), an A/B test against №2–6 with the hunter; Искра speaks in a synthetic voice (Qwen3-TTS VoiceDesign).
// The three columns of №6 stay (the forest scenes, no people in them); the hosts stand in front of them at the bottom:
// Искра on the left (poses from her sheet, lip sync from the voice), the cat on the right with its detector («?» while
// the viewer guesses, «✓» or «✗» at the verdict). Tips: 1 find north by moss — myth (moss grows where it is damp and
// shady, on any side: you walk in circles); 2 berries that birds peck are fine for you — myth (birds eat berries poisonous
// to people); 3 lost — stop and stay where you are — truth (you are found sooner; call 112 and answer with your voice).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { forest, mossTree, berryBush, clearing } from './forest.js';
import { iskra, cat, sprite } from './iskra.js';
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
Hd.SUB.y = 1150; Hd.SUB.size = 74; Hd.SUB.lead = 86;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok;
const HOT = { ЛЕСУ: GOLD, УБИТЬ: DANGER, ПРАВДА: OK, МХУ: GOLD, МИФ: DANGER, КРУГАМИ: DANGER, ПТИЦЫ: GOLD, ЯДОВИТЫЕ: DANGER,
  ОСТАНОВИСЬ: OK, НАЙДУТ: OK, ДВЕНАДЦАТЬ: OK, ГОЛОС: OK, ИСКРА: GOLD, ФАКТ: GOLD, УГАДАЛ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the three: [setup line, verdict line, the true answer, the column's label]
const Q = [['L1', 'L2', false, 'МОХ — НА СЕВЕР'], ['L3', 'L4', false, 'ЯГОДЫ ПТИЦ'], ['L5', 'L6', true, 'СТОЯТЬ НА МЕСТЕ']];
const OPEN = 0.45, CLOSE = 0.3;
const T = { c1: A.L1 - OPEN, c3: A.L3 - OPEN, c5: A.L5 - OPEN, c7: A.L7 - 0.06 };
Q.forEach(([s, v], i) => { T['g' + i] = A[s + 'e'] + 0.02; T['v' + i] = A[v] - 0.04; T['x' + i] = A[v + 'e'] + 0.05; });   // guess, verdict, close
export const CUTS = [];
export const SNAPS = [];
export const MARKS = { ...T, A, truth: Q.map(q => q[2]) };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const focus = (i, t) => seg(A[Q[i][0]] - OPEN, A[Q[i][0]] - 0.05, t) * (1 - seg(T['x' + i], T['x' + i] + CLOSE, t));
const qOf = t => (t < T.c3 ? 0 : t < T.c5 ? 1 : 2);
const PUNCH = [A.L0w10, T.v0, T.v1, T.v2, A.L1w5, A.L3w3, A.L5w5];   // «убить», the verdicts, «мху», «клюют», «остановись»
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }

// —— the three scenes (no people: the hosts stand in front); st: 'idle' (the first frame), 'live' (its question), 'done' ——
function mossScene(t, st) {
  const live = st === 'live', after = st === 'done' || (live && t > T.v0);
  forest(t, { tint: '#d5ecc8' });
  const spread = st === 'done' ? 1 : live ? seg(A.L2w9 - 0.1, A.L2w10 + 0.3, t) : 0;
  const comp = live ? seg(A.L1w1 - 0.1, A.L1w1 + 0.3, t) : st === 'done' ? 1 : 0;
  const spin = after ? t * 3.2 : 0.3 * Math.sin(t * 2);
  mossTree(t, { spread, compass: comp, spin, loop: st === 'done' ? 1 : live ? seg(A.L2w12 - 0.1, A.L2w14 + 0.4, t) : 0 });
  if (live && t > T.v0 && t < T.v0 + 1.2) Hd.redX(540, 700, 260, clamp((t - T.v0 - 0.15) / 0.25));
}
function berryScene(t, st) {
  const live = st === 'live';
  forest(t, { tint: '#e3efc6' });
  berryBush(t, { poison: st === 'done' ? 1 : live ? seg(A.L4w5 - 0.1, A.L4w5 + 0.3, t) : 0 });
  if (live && t > T.v1 && t < T.v1 + 1.2) Hd.redX(540, 760, 260, clamp((t - T.v1 - 0.15) / 0.25));
}
function stayScene(t, st) {
  const live = st === 'live', done = st === 'done';
  forest(t, { tint: '#cde6d6' });
  clearing(t, { pin: 1, phone: done ? 1 : live ? clamp(sp(t, A.L6w5 - 0.05, 2.6, 8)) : 0, au: done ? 1 : live ? clamp(sp(t, A.L6w9 - 0.05, 2.6, 8)) : 0,
                search: done ? 1 : live ? seg(A.L6w1, T.x2, t, x => x) : 0 });
  if (live && t > T.v2 && t < T.v2 + 1.2) Hd.tick(540, 640, clamp((t - T.v2 - 0.1) / 0.3), 110);
}
const SCENES = [mossScene, berryScene, stayScene];
const stateOf = (i, t) => (t < A[Q[i][0]] - OPEN ? 'idle' : t < T['x' + i] + CLOSE ? 'live' : 'done');

// —— the columns ——
const CW = 352, X0 = [0, 364, 728], CX = X0.map(x => x + CW / 2);
function column(i, t, x0, w, off) {
  g.save(); g.beginPath(); g.rect(x0, 0, w, H); g.clip(); g.translate(off, 0);
  SCENES[i](t, stateOf(i, t));
  g.restore();
}
function columns(t) {
  const F = Q.map((q, i) => focus(i, t)), top = F.findIndex(f => f > 0);
  if (top >= 0 && F[top] >= 1) { column(top, t, 0, W, 0); return F; }
  rect(0, 0, W, H, INK);
  for (let j = 0; j < 3; j++) if (j !== top) column(j, t, X0[j], CW, CX[j] - 540);
  if (top >= 0) { const e = ease.inOut(F[top]); column(top, t, lerp(X0[top], 0, e), lerp(CW, W, e), lerp(CX[top] - 540, 0, e)); }
  return F;
}

// —— the 2D layer: the quiz ——
function tag(t) {
  const s = 'ПРАВДА ИЛИ МИФ', tw = measure(s, 40, FONTS.cond) + 50;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(60 + tw, 150); g.rotate(-0.03); rect(-tw + 6, -32 + 6, tw, 64, INK); rect(-tw, -32, tw, 64, '#ff4d4d'); text(s, -tw / 2, 14, 40, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
}
function dots(t, open) {                               // three dots at the top right while a column is open
  if (open < 0.5) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  Q.forEach(([, , truth], i) => {
    const x = 760 + i * 100, y = 150, done = t > T['v' + i] + 0.1, cur = qOf(t) === i;
    ell(x, y, 38, 38, done ? (truth ? '#2f8f4e' : '#d62828') : cur ? '#ffd23f' : 'rgba(255,255,255,0.25)');
    text(done ? (truth ? '✓' : '✗') : String(i + 1), x, y + 16, 44, done || cur ? '#ffffff' : '#c9d6ea', { fam: FONTS.block, shadow: false });
  });
}
function headline(s, y, k, color = '#ffd23f') {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.03); g.scale(k, k);
  const sw = measure(s, 84) + 80; rrect(-sw / 2 + 10, -66 + 10, sw, 132, 22, INK); rrect(-sw / 2, -66, sw, 132, 22, color); text(s, 0, 30, 84, INK, { shadow: false }); g.restore();
}
function badges(t, open) {                             // over each column: its number, or its stamp once answered; its label below
  const k = 1 - open; if (k <= 0.01) return;
  const bumpAt = [A.L0w3, A.L0w6, A.L0w11];
  Q.forEach(([, , truth, label], i) => {
    const x = CX[i], done = t > T['x' + i], b = 1 + 0.18 * (t >= bumpAt[i] - 0.1 && t < T.c1 ? Math.exp(-(t - bumpAt[i] + 0.1) / 0.15) : 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k; g.translate(x, 680);
    if (done) {
      const ks = clamp(sp(t, T['x' + i] + CLOSE * 0.6, 2.6, 8)), z = lerp(1.8, 1, Math.min(1, ks)); g.rotate(-0.12); g.scale(z, z); g.globalAlpha = k * Math.min(1, ks * 3);
      const s = truth ? 'ПРАВДА' : 'МИФ', sw = measure(s, 62) + 50;
      rrect(-sw / 2 + 8, -48 + 8, sw, 96, 18, INK); rrect(-sw / 2, -48, sw, 96, 18, truth ? '#2f8f4e' : '#d62828'); text(s, 0, 22, 62, '#fff3d6', { shadow: false });
    } else {
      g.scale(b, b); ell(4, 6, 62, 62, INK); ell(0, 0, 62, 62, '#fff3d6'); text(String(i + 1), 0, 30, 84, '#c0392b', { fam: FONTS.block, shadow: false });
    }
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
    const lw = measure(label, 32, FONTS.cond) + 30; rrect(x - lw / 2 + 5, 975 + 6, lw, 60, 14, INK); rrect(x - lw / 2, 975, lw, 60, 14, '#fff3d6');
    text(label, x, 1016, 32, INK, { fam: FONTS.cond, shadow: false }); g.restore();
  });
}
function guess(t) {
  // during the guess window: two buttons and a countdown; at the verdict the true one grows, the other fades
  Q.forEach(([s, v, truth], i) => {
    const g0 = T['g' + i], v0 = T['v' + i];
    if (t < g0 - 0.05 || t > v0 + 1.4) return;
    const k = clamp(sp(t, g0 - 0.05, 2.8, 8)) * (1 - seg(v0 + 1.0, v0 + 1.4, t)), done = t >= v0;
    [['ПРАВДА', '#2f8f4e', true], ['МИФ', '#d62828', false]].forEach(([lbl, c, val], j) => {
      const right = val === truth, sc = done ? (right ? 1 + 0.12 * bump(clamp((t - v0) / 0.35)) : 0.85) : 1, a = done && !right ? 0.35 : 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540 + (j ? 230 : -230), 1000); g.scale(k * sc, k * sc);
      rrect(-200 + 6, -90 + 8, 400, 180, 30, INK); rrect(-200, -90, 400, 180, 30, done && right ? c : '#fff3d6');
      text(lbl, 0, 28, 72, done && right ? '#ffffff' : c, { fam: FONTS.block, shadow: false }); g.restore();
    });
    if (!done && k > 0.01) {
      const u = clamp((t - g0) / Math.max(0.5, v0 - g0));
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1130, 700, 26, 13), 'rgba(255,255,255,0.3)'); fill(rrPath(190, 1130, 700 * (1 - u), 26, 13), GOLD);
      Hd.label('УГАДАЙ', 540, 1210, 44, '#ffffff', { fam: FONTS.mono });
    }
  });
}
function verdict(t) {
  Q.forEach(([, v, truth], i) => {
    const v0 = T['v' + i], ks = sp(t, v0, 2.2, 8), out = seg(v0 + 1.3, v0 + 1.6, t);
    if (ks <= 0.01 || out >= 1) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.07); const z = lerp(1.9, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3) * (1 - out);
    const s = truth ? 'ПРАВДА' : 'МИФ', sw = measure(s, 130) + 100;
    rrect(-sw / 2 + 12, -92 + 12, sw, 184, 24, INK); rrect(-sw / 2, -92, sw, 184, 24, truth ? '#2f8f4e' : '#d62828'); text(s, 0, 46, 130, '#fff3d6', { shadow: false });
    g.restore();
  });
}
function plaques(t, open) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  const k0 = 1 - seg(T.c1, T.c1 + 0.25, t);
  if (k0 > 0.01) { g.save(); g.globalAlpha = k0; headline('ПРАВДА ИЛИ МИФ?', 330, 1); g.restore(); }
  if (t < T.c1 + 0.2) Hd.ribbon(t, -1, T.c1 - 0.05, '2 ИЗ 3 МОГУТ УБИТЬ', { y: 510, size: 64, rot: -0.05 });
  P(A.L2w1, T.x0, 320, { icon: 'x', title: 'МОХ РАСТЁТ, ГДЕ СЫРО И ТЕНЬ', color: DANGER, size: 38 });
  P(A.L2w9, T.x0, 440, { icon: 'x', title: 'С ЛЮБОЙ СТОРОНЫ', color: DANGER, size: 44 });
  P(A.L4w1, T.x1, 320, { icon: 'x', title: 'ПТИЦЫ ЕДЯТ ЯДОВИТЫЕ ЯГОДЫ', color: DANGER, size: 38 });
  P(A.L4w8, T.x1, 440, { icon: 'check', title: 'НЕЗНАКОМЫЕ ЯГОДЫ НЕ ЕШЬ', color: OK, size: 40 });
  P(A.L6w1, T.x2, 320, { icon: 'check', title: 'СТОЙ — ТАК НАЙДУТ СКОРЕЕ', color: OK, size: 40 });
  P(A.L6w5, T.x2, 440, { icon: 'check', title: 'ЗВОНИ 112', color: OK, size: 44 });
  P(A.L6w9, T.x2, 560, { icon: 'check', title: 'ПОДАВАЙ ГОЛОС: «АУ!»', color: OK, size: 40 });
  if (t >= T.c7 - 0.3) {
    headline('СКОЛЬКО УГАДАЛ?', 330, clamp(sp(t, T.c7 - 0.2, 2.4, 8)) * (1 - seg(A.L7w12 - 0.4, A.L7w12 - 0.1, t)));
  }
}


// —— the hosts: Искра on the left, the cat on the right, in front of everything but the quiz ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t < 0.9) return 'hi';
  for (let i = 0; i < 3; i++) {
    const [s] = Q[i], truth = Q[i][2];
    if (t >= A[s] - OPEN && t < T['g' + i]) return 'right';
    if (t >= T['g' + i] && t < T['v' + i]) return 'explain';
    if (t >= T['v' + i] && t < T['x' + i] + CLOSE) return truth ? 'truth' : t < T['v' + i] + 1.1 ? 'myth' : 'explain';
  }
  if (t >= A.L7w5 - 0.1) return 'hi';
  return 'explain';
}
function catOf(t) {
  if (t >= A.L0w11 - 0.1 && t < T.c1) return 'doubt';
  for (let i = 0; i < 3; i++) {
    if (t >= T['g' + i] && t < T['v' + i]) return 'doubt';
    if (t >= T['v' + i] && t < T['x' + i] + CLOSE) return Q[i][2] ? 'sure' : 'wow';
  }
  if (t >= A.L7w10 - 0.1) return 'sure';
  return 'front';
}
let lastPose = null, poseSince = -9, lastCat = null, catSince = -9;
function hosts(t) {
  const p = poseOf(t), c = catOf(t);
  if (p !== lastPose) { lastPose = p; poseSince = t; }
  if (c !== lastCat) { lastCat = c; catSince = t; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = (x, y, rx) => ell(x, y, rx, rx * 0.16, 'rgba(0,0,0,0.25)');
  sh(740, 1858, 150);
  cat(t, c, 740, 1862, 330, { hop: catSince > 0.2 ? catSince : null });
  iskra(t, p, 300, 1945, 720, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  // the name tags: at the start and when she says who they are
  const tag2 = (s, x, y, t0, t1) => { const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.2, t1, t)); if (k < 0.01) return;
    g.save(); g.translate(x, y); g.scale(k, k); const w = measure(s, 34, FONTS.cond) + 34; rrect(-w / 2 + 4, -24 + 5, w, 52, 14, INK); rrect(-w / 2, -24, w, 52, 14, GOLD); text(s, 0, 13, 34, INK, { fam: FONTS.cond, shadow: false }); g.restore(); };
  tag2('ИСКРА', 545, 1330, 0.25, T.c1); tag2('КОТ ФАКТ', 740, 1490, 0.45, T.c1);
  tag2('ИСКРА', 545, 1330, A.L7w6 - 0.05, DUR + 1); tag2('КОТ ФАКТ', 740, 1490, A.L7w10 - 0.05, DUR + 1);
}

// —— the cover: the first 3 frames (0.05 s) are a thumbnail of their own — YouTube takes the first frame when no cover is
// chosen (the owner's note, 11.11); the same picture is saved as out/<id>-cover.jpg for Reels and the YouTube app ——
export const COVER = 0.05;
function cover(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  forest(t, { tint: '#d5ecc8' });
  g.save(); g.translate(540, 1000); g.scale(1.25, 1.25); g.translate(-540, -1000); mossTree(t, { compass: 1, spin: 0.4 }); g.restore();
  // a red ring round the moss, an arrow to it, a cross on it
  g.save(); g.lineWidth = 14; g.strokeStyle = '#e53935'; g.beginPath(); g.ellipse(452, 860, 125, 255, -0.04, 0, Math.PI * 2); g.stroke(); g.restore();
  limb([[860, 640], [640, 760]], 22, '#e53935', false); poly([[592, 790], [660, 714], [688, 800]], '#e53935');
  Hd.redX(452, 720, 190, 1);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('ЗАБЛУДИЛСЯ?', 210, 104, '#ffd23f', INK, -0.04);
  box('НЕ ИДИ ПО МХУ!', 400, 112, '#e53935', '#ffffff', 0.03);
  sprite('b_idea', 330, 1945, 980);
  sprite('c_wow', 840, 1905, 470);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(t); Hd.finish(t, 0.5); return; }
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  const F = columns(t), open = Math.max(...F);
  g.setTransform(1, 0, 0, 1, 0, 0);
  tag(t); dots(t, open); badges(t, open); hosts(t); plaques(t, open); guess(t); verdict(t);
  Hd.endCard(t, A.L7w12 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0); add(0, 'birds', -24, 0, { dur: DUR });
  for (const t0 of [A.L0w3, A.L0w6, A.L0w11]) add(t0 - 0.08, 'pop_word', -10, 0);
  Q.forEach(([s], i) => { add(A[s] - OPEN, 'whoosh', -14, -0.3 + 0.3 * i); add(T['x' + i], 'whoosh', -16, 0); });
  add(A.L1w1, 'click', -12, 0.3); add(A.L2w12, 'steps_out', -18, 0, { dur: 1.6 });
  add(A.L3w3, 'tweet', -14, 0.2, { dur: 1.2 }); add(A.L4w5, 'wall_hit', -16, 0);
  add(A.L6w5, 'beep', -14, -0.3); add(A.L6w9, 'pop_word', -10, 0.3);
  Q.forEach((q, i) => {
    add(T['g' + i], 'ticks_up', -14, 0, { dur: Math.max(0.5, T['v' + i] - T['g' + i]) });
    add(T['v' + i], 'stamp', -6, 0); add(T['v' + i] + 0.05, q[2] ? 'ding' : 'wall_hit', q[2] ? -8 : -14, 0);
    add(T['x' + i] + CLOSE * 0.6, 'stamp', -12, 0);
  });
  add(A.L7w6, 'blip', -10, 0); add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
