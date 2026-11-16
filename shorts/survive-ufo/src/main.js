// «Как выжить, если прилетели инопланетяне» — 2D, the plain «what to do» format (the owner, 16.11: not the quiz, «просто
// что делать, как выжить, если прилетели инопланетяне, в 2D»). A «what if»: the saucer is fiction, the steps are real US
// emergency rules. The narrator — Искра's voice (Elen); on screen a guy in a hoodie in a US suburb at night.
// Shots: the street with the saucer and helicopters → step 1, into the house and away from the windows → step 2, the phone
// and the power bank, the alert → the choice (the neighbour with a drone: 1 go / 2 stay) → 2: the closed road, a fine for
// the drone, the ambulance → step 3, water for three days → step 4, the evacuation route → a knock at the door (the
// question for the comments). The first 3 frames are the cover («ПРИЛЕТЕЛИ ИНОПЛАНЕТЯНЕ? НЕ ВЫХОДИ НА УЛИЦУ!»).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { night, saucer, heli, drone, house, ticket, phoneAlert, walker } from './ufo.js';
import { livingRoom, charging, roadBlock, waterTable, evacRoad, gauge, bubble, FLOOR } from './scenes.js';
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
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1150; Hd.SUB.size = 74; Hd.SUB.lead = 86;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok;
const HOT = { США: GOLD, ТАРЕЛКА: DANGER, ВЕРТОЛЁТЫ: DANGER, ВЫЖИТЬ: GOLD, ВЫХОДИ: DANGER, ОКОН: OK, ПОДАЛЬШЕ: OK, ЗАРЯДИ: OK, ПАУЭРБАНК: OK,
  ТРЕВОГА: OK, ТЕЛЕФОН: OK, ДРОН: DANGER, ЕДЕШЬ: DANGER, ОСТАЁШЬСЯ: OK, РЕШАЙ: GOLD, ДВА: OK, ШТРАФ: DANGER, СКОРОЙ: OK, ВОЕННЫМ: OK,
  ВОДЫ: OK, ЛИТРОВ: GOLD, ДНЯ: GOLD, ЭВАКУАЦИЮ: DANGER, МАРШРУТУ: OK, СТУЧАТ: DANGER, ОТКРОЕШЬ: GOLD, ПИШИ: GOLD };

// —— the timeline ——
const T = { g: A.L3e + 0.02, v: A.L4 - 0.04 };
const SHOTS = [['street', 0], ['room', A.L1w4 - 0.1], ['phone', A.L2 - 0.1], ['choice', A.L3 - 0.1], ['road', T.v], ['water', A.L5 - 0.1], ['evac', A.L6 - 0.1], ['knock', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { A, ...T, end: A.L7 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w7, A.L1w1, T.v, A.L4w7, A.L7w4];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }
const HOODIE = { coat: '#4a5a7a', coatD: '#38465f', indoor: true };
const NEIGH = { coat: '#c0392b', coatD: '#962d22', indoor: true, hair: '#c9a24a' };

// —— the shots ——
function street(t) {
  night(t);
  saucer(560, 420, 1.0, t, { beam: 0.5 + 0.2 * Math.sin(t * 1.3) });
  heli(lerp(1250, 760, clamp(t / 6)), 300, 0.6, t, { light: 0.7, lx: 600, ly: FLOOR });
  heli(lerp(-200, 220, clamp(t / 5)), 560, 0.45, t, { light: 0.5, lx: 300, ly: FLOOR });
  house(860, t, { lit: 1 });
  const go = seg(A.L1w1, A.L1w4, t);
  const look = 1 - go;
  walker(lerp(380, 760, go), FLOOR + 40, 1.0, t, { ...HOODIE, face: 1, walk: go > 0 && go < 1 ? 1 : 0 });
  if (look > 0.5 && t < A.L1) { g.save(); g.globalAlpha = 0.9; text('!', 420, FLOOR - 470, 90, '#ffd23f', { fam: FONTS.block }); g.restore(); }
}
function room(t) {
  livingRoom(t);
  const away = seg(A.L1w8 - 0.1, A.L1w11 + 0.2, t);
  walker(lerp(330, 660, away), FLOOR + 40, 1.0, t, { ...HOODIE, face: away > 0 && away < 1 ? 1 : -1, walk: away > 0 && away < 1 ? 1 : 0 });
  const x = seg(A.L1w9 - 0.1, A.L1w9 + 0.2, t) * (1 - seg(A.L2 - 0.4, A.L2 - 0.15, t));
  if (x > 0.01) Hd.redX(205, 430, 150, x);
  if (t > A.L1w11) Hd.tick(660, FLOOR - 560, clamp((t - A.L1w11) / 0.3), 90);
}
function phone(t) {
  livingRoom(t); g.save(); g.globalAlpha = 0.6; rect(-400, 0, 1880, 1920, '#0b0f1a'); g.restore();
  const c0 = shotStart('phone'), k = clamp(sp(t, c0, 2.4, 8));
  const charge = lerp(0.2, 1, seg(A.L2w1, A.L2w4 + 0.6, t));
  const alert = seg(A.L2w5 - 0.1, A.L2w5 + 0.15, t);
  if (alert < 1) { g.save(); g.globalAlpha = 1 - alert; charging(540, 760, k, t, charge); g.restore(); }
  if (alert > 0) phoneAlert(540, 720, alert * 1.15, t, seg(A.L2w5, A.L2w6, t) * (1 - seg(A.L3 - 0.5, A.L3 - 0.2, t)));
}
function choice(t) {
  livingRoom(t, { door: seg(shotStart('choice'), shotStart('choice') + 0.4, t) });
  walker(560, FLOOR + 40, 1.0, t, { ...HOODIE, face: 1, walk: 0 });
  const nIn = seg(shotStart('choice') + 0.1, A.L3w1, t);
  walker(lerp(1100, 930, nIn), FLOOR + 40, 1.0, t, { ...NEIGH, face: -1, walk: nIn > 0 && nIn < 1 ? 1 : 0 });
  drone(lerp(1060, 880, nIn), FLOOR - 330 + 10 * Math.sin(t * 4), 0.8, t);
  bubble(800, 330, 'ПОЕХАЛИ, СНИМЕМ!', clamp(sp(t, A.L3w2 - 0.05, 2.6, 8)) * (1 - seg(A.L3w8 - 0.2, A.L3w8, t)), 1);
}
function road(t) {
  const amb = seg(A.L4w9 - 0.1, A.L4w13 + 0.6, t, x => x);
  roadBlock(t, { amb });
  heli(760, 260, 0.6, t, { light: 0.6, lx: 380, ly: FLOOR - 120 });
  drone(300, 520, 1.0, t);
  if (t > A.L4w4) Hd.redX(300, 520, 140, clamp((t - A.L4w4) / 0.25));
  ticket(560, 640, clamp(sp(t, A.L4w6 - 0.05, 2.6, 8)) * (1 - seg(A.L4w9 - 0.3, A.L4w9, t)));
}
function water(t) {
  const n = 3 * seg(A.L5w4 - 0.1, A.L5w13 + 0.1, t, x => x);
  waterTable(t, n, seg(A.L5w11, A.L5w13, t));
}
function evac(t) {
  const go = seg(A.L6w3 - 0.1, A.L6w7 + 0.8, t);
  evacRoad(t, go * 0.55);
  gauge(200, 640, clamp(sp(t, A.L6w3 - 0.05, 2.6, 8)));
  const ring = seg(A.L6w5 - 0.1, A.L6w7, t);
  if (ring > 0.01) { g.save(); g.globalAlpha = ring; g.lineWidth = 9; g.strokeStyle = '#2f8f4e'; g.beginPath(); g.ellipse(770, FLOOR - 490, 180, 140, 0, 0, TAU); g.stroke(); g.restore(); }
}
function knock(t) {
  const kn = seg(A.L7w3 - 0.15, A.L7w4, t), shadow = seg(A.L7w4, A.L7w5 + 0.3, t);
  livingRoom(t, { knock: kn * (1 - seg(A.L7w6, A.L7w7, t)) + 0.6 * seg(DUR - 2.5, DUR - 2.4, t), shadow });
  walker(560, FLOOR + 40, 1.0, t, { ...HOODIE, face: 1, walk: 0 });
  if (t > A.L7w4) { g.save(); g.globalAlpha = clamp((t - A.L7w4) / 0.2); text('?!', 500, FLOOR - 480, 90, '#ffd23f', { fam: FONTS.block }); g.restore(); }
}
const SHOT = { street, room, phone, choice, road, water, evac, knock };


// —— the hosts: Искра narrates on the left (her voice, the anime mouth), the cat on the right ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t < A.L0w12) return 'hi';
  if (t >= A.L3w8 - 0.1 && t < T.v) return 'right';
  if (t >= T.v && t < T.v + 1.2) return 'truth';
  if (t >= A.L4w1 && t < A.L4w8) return 'myth';
  if (t >= A.L7w6) return 'hi';
  return 'explain';
}
function catOf(t) {
  if (t < A.L1) return 'wow';
  if (t >= T.g && t < T.v) return 'doubt';
  if (t >= T.v && t < A.L5) return 'sure';
  if (t >= A.L7w3) return 'wow';
  return 'front';
}
let lastPose = null, poseSince = -9, lastCat = null, catSince = -9;
function hosts(t) {
  const p = poseOf(t), c = catOf(t);
  if (p !== lastPose) { lastPose = p; poseSince = t; }
  if (c !== lastCat) { lastCat = c; catSince = t; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  ell(760, 1858, 150, 24, 'rgba(0,0,0,0.25)');
  cat(t, c, 760, 1862, 330, { hop: catSince > 0.2 ? catSince : null });
  iskra(t, p, 300, 1945, 720, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
}

// —— the 2D layer ——
function headline(s, y, k, color = '#ffd23f', size = 84) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.03); g.scale(k, k);
  const sw = measure(s, size) + 80; rrect(-sw / 2 + 10, -size * 0.78 + 10, sw, size * 1.56, 22, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 22, color); text(s, 0, size * 0.36, size, INK, { shadow: false }); g.restore();
}
function buttons(t, b1, b2, y, k1, k2, right = 0) {   // right: 0 none yet, 1 or 2 — the right one grows, the other fades
  [[b1, k1, 1], [b2, k2, 2]].forEach(([lbl, k, n], j) => {
    if (k <= 0.01) return;
    const r = right === n, wrong = right && !r, sc = k * (r ? 1 + 0.1 * bump(clamp((t - T.v) / 0.35)) : wrong ? 0.88 : 1);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = wrong ? 0.4 : 1; g.translate(540 + (j ? 240 : -240), y); g.scale(sc, sc);
    rrect(-210 + 6, -80 + 8, 420, 160, 30, INK); rrect(-210, -80, 420, 160, 30, r ? '#2f8f4e' : '#fff3d6');
    text(`${n}`, -150, 30, 84, r ? '#ffffff' : '#e85d3a', { fam: FONTS.block, shadow: false });
    text(lbl, 40, 22, 54, r ? '#ffffff' : INK, { fam: FONTS.cond, shadow: false }); g.restore();
  });
}
function layer(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  Hd.timeStamp(t, 0.25, A.L1 - 0.2, 'США · 02:47 · НЕБО ЗАКРЫТО');
  headline('КАК ВЫЖИТЬ?', 360, clamp(sp(t, A.L0w12 - 0.1, 2.4, 8)) * (1 - seg(A.L1 - 0.15, A.L1 + 0.05, t)));
  Hd.stepHeader(t, 1, 'НЕ ВЫХОДИ СМОТРЕТЬ', A.L1 - 0.05, A.L2 - 0.3);
  P(A.L1w8, A.L2 - 0.3, 470, { icon: 'check', title: 'ПОДАЛЬШЕ ОТ ОКОН', color: OK, size: 46 });
  Hd.stepHeader(t, 2, 'ЗАРЯДИ ТЕЛЕФОН', A.L2 - 0.05, A.L3 - 0.3);
  // the choice
  if (t >= A.L3w8 - 0.1 && t < A.L5 - 0.2) {
    const out = 1 - seg(A.L5 - 0.5, A.L5 - 0.2, t);
    buttons(t, 'ЕДУ', 'ОСТАЮСЬ', 990, clamp(sp(t, A.L3w8 - 0.06, 2.6, 8)) * out, clamp(sp(t, A.L3w11 - 0.06, 2.6, 8)) * out, t >= T.v ? 2 : 0);
    if (t >= T.g && t < T.v) {
      const u = clamp((t - T.g) / Math.max(0.5, T.v - T.g));
      g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1090, 700, 26, 13), 'rgba(255,255,255,0.3)'); fill(rrPath(190, 1090, 700 * (1 - u), 26, 13), GOLD);
    }
  }
  P(A.L4w1, A.L5 - 0.3, 330, { icon: 'x', title: 'ДРОН = ОГРОМНЫЙ ШТРАФ', color: DANGER, size: 44 });
  P(A.L4w8, A.L5 - 0.3, 450, { icon: 'check', title: 'ДОРОГИ — ДЛЯ ВОЕННЫХ И СКОРОЙ', color: OK, size: 36 });
  Hd.stepHeader(t, 3, 'НАБЕРИ ВОДЫ', A.L5 - 0.05, A.L6 - 0.3);
  P(A.L5w4, A.L6 - 0.3, 900, { icon: 'check', title: '≈ 4 Л НА ЧЕЛОВЕКА В ДЕНЬ × 3 ДНЯ', color: GOLD, size: 34 });
  Hd.stepHeader(t, 4, 'ПО ИХ МАРШРУТУ', A.L6 - 0.05, A.L7 - 0.3);
  // the end: the question
  headline('ОТКРОЕШЬ?', 360, clamp(sp(t, A.L7w5 - 0.1, 2.4, 8)), '#ffd23f', 96);
  if (t >= A.L7w7 - 0.1) buttons(t, 'ОТКРЫТЬ', 'НЕТ', 990, clamp(sp(t, A.L7w7 - 0.06, 2.6, 8)), clamp(sp(t, A.L7w10 - 0.06, 2.6, 8)), 0);
  Hd.endCard(t, A.L7e + 0.15, 0, 560);
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  night(0.3);
  saucer(560, 620, 1.3, 0.3, { beam: 0.9 });
  heli(880, 420, 0.6, 0.3, { light: 0.7, lx: 760, ly: 1000 });
  house(300, 0.3, { lit: 1, phone: 1 });
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('ПРИЛЕТЕЛИ ИНОПЛАНЕТЯНЕ?', 170, 60, '#ffd23f', INK, -0.04);
  box('НЕ ВЫХОДИ НА УЛИЦУ!', 330, 74, '#e53935', '#ffffff', 0.03);
  sprite('b_idea', 330, 1945, 980);
  sprite('c_wow', 840, 1905, 470);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(t); Hd.finish(t, 0.5); return; }
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
  add(0.05, 'ufo_hum', -18, 0, { dur: A.L1 + 0.3 }); add(0.5, 'heli_far', -22, 0.4, { dur: 3.0 });
  add(A.L1w1, 'steps_out', -18, 0.2, { dur: 1.2 }); add(A.L1w4 - 0.1, 'door_open', -16, 0.3);
  add(A.L2w1, 'click', -12, 0); add(A.L2w5, 'alert_tone', -14, 0, { dur: 1.2 });
  add(shotStart('choice'), 'door_open', -16, 0.4); add(A.L3w5, 'drone_buzz', -18, 0.3, { dur: 1.4 });
  add(T.g, 'ticks_up', -14, 0, { dur: Math.max(0.5, T.v - T.g) });
  add(T.v, 'stamp', -6, 0); add(T.v + 0.05, 'ding', -8, 0); add(T.v + 0.1, 'heli_far', -18, 0.2, { dur: 2.0 });
  add(A.L4w4, 'wall_hit', -16, -0.2); add(A.L4w9, 'whoosh', -14, 0.3);
  add(A.L5w4, 'pour', -16, 0, { dur: 1.2 }); add(A.L5w11, 'pop_word', -12, 0);
  add(A.L6w3, 'engine', -18, 0, { dur: 2.2 });
  add(A.L7w3 - 0.1, 'hatch_knock', -8, 0.3); add(A.L7w5, 'heartbeat', -14, 0, { dur: 1.6 });
  for (const t0 of [A.L1 - 0.05, A.L2 - 0.05, A.L5 - 0.05, A.L6 - 0.05]) add(t0, 'pop_word', -10, 0);
  add(A.L7e + 0.15, 'stamp', -12, 0);
  return c.sort((a, b) => a.t - b.t);
}
