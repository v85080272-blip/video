// «Носорог» (Арена, битва 3 — его выбрали зрители): the whole short as pure functions of time t (seconds), so any frame
// or motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The arena, the crowd and the hunter as in battles 1–2; new here: the rhino (rhino.js), a pennant on the podium wall
// that shows the wind, the wind blowing from him to you (your scent goes away from him), the bar «Носорог чует тебя»
// going down step by step, the freeze with a finger on the lips while his ears turn, the stone column, the charge, the
// horn against the stone, stars, «?», and the rhino walking back out through the gate.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, smoothPath, polyPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { drawRhino } from './rhino.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 4.6, 11], L1: [5.0, 7.9, 9], L2: [8.35, 12.6, 14], L3: [13.0, 15.9, 9], L4: [16.3, 19.9, 11], L5: [20.35, 25.4, 14], L6: [25.85, 28.0, 6], L7: [28.45, 34.3, 13] };
export const DUR = VOICE?.dur ?? 34.65;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { НОСОРОГ: WARM, ВЫ: GOLD, ТОННЫ: DANGER, ГОЛОВОЙ: GOLD, ВЕТЕР: GOLD, НЮХ: DANGER, ЗАМРИ: GOLD, МОЛЧИ: GOLD, СЛЫШИТ: DANGER,
  КОЛОННУ: GOLD, КАМЕНЬ: GOLD, ВРЕЗАЛСЯ: WARM, ПОТЕРЯЛ: OK, УШЁЛ: OK, РЕВЁТ: WARM, СЛЕДУЮЩИМ: GOLD, ПОДПИСЫВАЙСЯ: GOLD, БИТВУ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  gate: A.L0w3 - 0.06,               // «Ворота поднимаются»
  out: A.L0w6 - 0.1,                 // «и выходит носорог»
  voted: A.L0w8 - 0.06,              // «Его выбрали вы»
  c1: A.L1 - 0.06,                   // «Он весит больше тонны»
  idea: A.L1w8 - 0.08,               // «головой»
  c2: A.L2 - 0.06,                   // step 1: the wind from him to you
  wind: A.L2w3 - 0.06,               // «чтобы ветер дул…»
  nose: A.L2w10 - 0.06,              // «Нюх у носорога отличный»
  c3: A.L3 - 0.06,                   // step 2: freeze and keep quiet
  shh: A.L3w1 - 0.06,
  hears: A.L3w4 - 0.06,              // «Он слышит лучше, чем видит»
  c4: A.L4 - 0.06,                   // step 3: behind the column
  charge: A.L4w1 - 0.06,             // «если бросился»
  hide: A.L4w3 - 0.06,               // «встань за колонну»
  hit: A.L5w1 - 0.04,                // «врезался в колонну»
  snort: A.L5w4 - 0.04,              // «фыркнул»
  lost: A.L5w6 - 0.06,               // «и потерял тебя»
  c6: A.L6 - 0.06,                   // «Он развернулся и ушёл»
  cheer: A.L6w4 - 0.06,              // «Толпа ревёт!»
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c2, T.c3, T.c4, T.c6, T.c7];
export const SNAPS = [T.hit];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7, RS = 0.88;
const scene = t => (t < T.cover ? 'cover' : 'arena');
const AR = { wall: -400, gate: -620, gateW: 320, gateH: 330, end: 1400, box: 640 };
const COL = { x: 250, w: 120, h: 520 };            // the stone column in the sand
const HIDE = COL.x + 80;                           // where you stand behind it, peeking out
const PEN = { x: -120 };                            // the pennant on the podium wall
const windAt = t => 1;                              // the wind always blows from him (left) to you (right)

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
// the ground at about y 1170 on screen, so the subtitles sit below the action: cam.y = −210 / z
shot(T.cover, [[T.cover, 0, -540, 0.78], [T.gate, -100, -400, 0.95], [T.out + 0.8, -200, -175, 1.2], [T.c1, -190, -172, 1.22]]);
shot(T.c1, [[T.c1, -170, -169, 1.24], [T.c2, -160, -164, 1.28]]);
shot(T.c2, [[T.c2, -120, -172, 1.22], [T.nose, -110, -168, 1.25], [T.c3, -90, -166, 1.27]]);
shot(T.c3, [[T.c3, -80, -175, 1.2], [T.c4, -60, -170, 1.24]]);
shot(T.c4, [[T.c4, -40, -185, 1.12], [T.hide + 0.6, -10, -188, 1.12], [T.hit, 0, -186, 1.14], [T.lost, -20, -180, 1.18], [T.c6, -30, -178, 1.18]]);
shot(T.c6, [[T.c6, 20, -186, 1.12], [T.cheer, 0, -195, 1.08], [T.cheer + 1.2, 120, -330, 0.9], [T.c7, 120, -320, 0.92]]);
shot(T.c7, [[T.c7, -140, -239, 0.88], [DUR, -135, -233, 0.9]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.out + 0.6, 8], [T.charge + 0.5, 6], [T.hit, 22], [T.cheer, 8]]) if (t >= t0 && t < t0 + 0.7) { const e = Math.exp(-(t - t0) * 6); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const headOf = o => framesOf(o).H.p([0, -60]);
function run(o, x, ph) {                             // a quick run: feet and arms swinging
  o.hip = [x, -LEG + 6 * Math.abs(Math.sin(ph))]; o.lean = 0.25;
  o.feet = { near: [x + 34 * Math.sin(ph), -16 * Math.max(0, Math.cos(ph))], far: [x - 34 * Math.sin(ph), -16 * Math.max(0, -Math.cos(ph))] };
  return o;
}

// how well the rhino knows where you are: 100 % → 60 (downwind) → 25 (still and quiet) → 0 (behind the stone, lost)
function smell(t) {
  return 1 - 0.4 * seg(T.wind, T.c3 - 0.1, t) - 0.35 * seg(T.shh, T.c4 - 0.1, t) + 0.3 * seg(T.charge, T.charge + 0.4, t) - 0.55 * seg(T.lost, T.lost + 0.8, t);
}

// —— who is where, and in what pose, at time t ——
export function actorsAt(t) {
  if (scene(t) !== 'arena') return {};
  // S1 · the gate goes up, the rhino walks out, stamps and snorts; «его выбрали вы»
  if (t < T.c1) {
    const gate = seg(T.gate, T.gate + 1.0, t), w = seg(T.out, T.out + 1.6, t, ease.out);
    const r = { x: lerp(AR.gate, -360, w), y: 0, s: lerp(0.7, RS, w), face: 1, t, gait: w > 0 && w < 1 ? 0.4 : 0, phase: t * 5, inGate: w < 0.5, charge: 0.6 * bump(seg(T.out + 1.5, T.out + 2.4, t)) };
    const o = stand(base(t, { look: [0.7, 0], brow: 0.8, pop: 0.7 * bump(seg(T.out + 1.4, T.out + 2.4, t)) }), 150);
    return { h: o, r, gate, excite: t > T.out + 1.5, stomp: t > T.out + 1.5 ? t - T.out - 1.5 : -1 };
  }
  // S2 · more than a tonne; «головой»: a finger up, a light bulb
  if (t < T.c2) {
    const o = stand(base(t, { look: [0.7, 0], brow: 0.6 }), 150);
    if (t > T.idea - 0.25) { const H0 = headOf(o), k = clamp(sp(t, T.idea - 0.25, 2.6, 8)); o.hands = { near: { p: [lerp(H0[0] + 60, H0[0] + 34, k), lerp(H0[1] + 160, H0[1] - 24, k)], shape: 'point', ang: -1.2 } }; o.brow = -0.3; o.mouth = 0.2; }
    else { const sh = shoulder(o), k = clamp(sp(t, T.c1, 2.4, 7)); o.hands = { near: { p: [sh[0] - 70 * k, sh[1] + 70], shape: 'open', ang: -0.6 }, far: { p: [sh[0] + 40 * k, sh[1] + 66], shape: 'open', ang: -2.4 } }; }
    return { h: o, r: { x: -360, y: 0, s: RS, face: 1, t, ear: 0.3 * Math.sin(t * 2) }, gate: 1, bulb: seg(T.idea, T.idea + 0.25, t) };
  }
  // S3 · step 1: he looks up at the pennant — the wind blows from the rhino to him; his scent goes away; the rhino sniffs
  if (t < T.c3) {
    const o = stand(base(t, { look: t < T.wind + 0.8 ? [-0.2, -0.9] : [0.7, 0], brow: 0.6, headTilt: t < T.wind + 0.8 ? -0.2 : 0.04 }), 150);
    if (t > T.wind && t < T.wind + 0.9) { const sh = shoulder(o); o.hands = { near: { p: [sh[0] - 20, sh[1] - 120], shape: 'point', ang: -2.0 } }; }
    return { h: o, r: { x: -360, y: 0, s: RS, face: 1, t, sniff: seg(T.nose, T.nose + 0.4, t) * (0.7 + 0.3 * Math.sin(t * 5)), ear: 0.2 }, gate: 1, wind: true, scent: true, tense: true };
  }
  // S4 · step 2: frozen, a finger on the lips; his ears turn to and fro, he looks about
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.7, 0], brow: 1, pop: 0.4, mouth: 0, blink: 0 }), 150);
    o.lean = 0.0;
    if (t > T.shh) { const H0 = headOf(o), k = clamp(sp(t, T.shh, 2.6, 8)); o.hands = { near: { p: [lerp(H0[0] + 60, H0[0] - 6, k), lerp(H0[1] + 160, H0[1] + 40, k)], shape: 'point', ang: -1.6 } }; }
    const r = { x: -330, y: 0, s: RS, face: 1, t, ear: Math.sin(t * 3.4), look: Math.sin(t * 1.7), sniff: 0.3 * Math.max(0, Math.sin(t * 2.3)) };
    return { h: o, r, gate: 1, wind: true, shhT: t > T.shh ? t - T.shh : -1, what: t > T.hears ? t - T.hears : -1, tense: true };
  }
  // S5 · step 3: he lowers his horn and charges; you run behind the column; S6 · the horn hits the stone, a snort, lost
  if (t < T.c6) {
    const runK = seg(T.hide, T.hide + 0.7, t);
    let o;
    if (runK > 0 && runK < 1) o = run(base(t, { face: -1, look: [0.7, 0], brow: 1, pop: 0.6, mouth: 0.5 }), lerp(150, HIDE, runK), t * 14);
    else o = stand(base(t, { face: -1, look: [0.8, 0], brow: 1, pop: t > T.hit ? 0.8 * bump(seg(T.hit, T.hit + 0.8, t)) : 0.5 }), runK >= 1 ? HIDE : 150);
    if (runK >= 1) { const sh = shoulder(o); o.lean = 0.12; o.hands = { near: { p: [COL.x + COL.w / 2 - 6, sh[1] + 20], shape: 'open', ang: -1.6 } }; }
    const lower = seg(T.c4, T.charge, t), go = seg(T.charge + 0.5, T.hit, t, u => u * u);
    const impact = COL.x - COL.w / 2 - 300 * RS;
    const rx = t < T.hit ? lerp(-330, impact, go) : impact - 50 * seg(T.hit, T.hit + 0.3, t, ease.out);
    const after = t >= T.hit;
    const r = { x: rx, y: 0, s: RS, face: 1, t, gait: !after && go > 0.02 ? 1 : 0, phase: t * 12, charge: after ? 1 - seg(T.hit + 0.4, T.snort, t) : lower,
      daze: after ? 1 - seg(T.lost + 0.6, T.c6, t) : 0, sniff: t > T.lost ? 0.6 + 0.4 * Math.sin(t * 6) : 0, look: t > T.lost ? Math.sin(t * 2.2) : 0, ear: t > T.lost ? Math.sin(t * 3) : 0 };
    return { h: o, r, gate: 1, tense: !after, stomp: t > T.charge && t < T.charge + 0.6 ? t - T.charge : -1, crack: after ? t - T.hit : -1, stars: after ? t - T.hit : -1,
      snortT: t > T.snort ? t - T.snort : -1, what: t > T.lost ? t - T.lost : -1, kick: !after && go > 0.05 ? go : -1 };
  }
  // S7 · he turns and walks back out through the gate; the crowd roars; you come out from behind the stone; Пурга runs out
  if (t < T.c7) {
    const turn = seg(T.c6, T.c6 + 0.5, t), away = seg(T.c6 + 0.4, T.c7 - 0.2, t, u => u);
    const r = { x: lerp(COL.x - COL.w / 2 - 300 * RS - 50, AR.gate, away), y: 0, s: RS * lerp(1, 0.75, clamp(away * 1.4 - 0.4)), face: turn < 0.5 ? 1 : -1, t, gait: away > 0 && away < 1 ? 0.35 : 0, phase: t * 4, inGate: away > 0.85 };
    const out = seg(T.c6 + 0.2, T.c6 + 0.9, t);
    const o = stand(base(t, { face: -1, look: [0.6, 0], brow: 0.1, mouth: t > T.cheer ? 0.4 : 0.1 }), lerp(HIDE, 420, out));
    const sh = shoulder(o);
    if (t > T.cheer + 0.3) { const k = clamp(sp(t, T.cheer + 0.3, 2.4, 7)); o.hands = { near: { p: [sh[0] - 30, sh[1] - 140 * k + 40], shape: 'fist' }, far: { p: [sh[0] + 40, sh[1] - 140 * k + 40], shape: 'fist' } }; }
    const runD = seg(T.cheer + 0.2, T.cheer + 1.6, t);
    const d = runD < 1 ? { x: lerp(1300, 560, runD), y: 0, s: DS, face: -1, walk: 1, ph: t * 3.2, t, blink: dblink(t), mouth: 0.6, tongue: 0.7 }
      : { x: 560, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 };
    return { h: o, r, d: t > T.cheer + 0.2 ? d : null, gate: 1, cheer: t > T.cheer, flowers: t - T.cheer };
  }
  // S8 · «Кого одолеть следующим?»: the gate shut, a shadow and a question mark behind the bars
  const o = stand(base(t, { look: [0.6, 0], brow: 0.3, mouth: 0.35 }), 140);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o, d: { x: 350, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 }, gate: 1 - seg(T.c7, T.c7 + 0.6, t), next: true };
}

// —— the props: the stone column, the pennant on the wall, the wind, your scent, the stars, the snort ——
function column(t, a) {
  const { x, w, h } = COL;
  rect(x - w / 2 - 14, -26, w + 28, 26, '#bfae8c'); rect(x - w / 2 - 24, -40, w + 48, 16, '#d8cba9');
  fill(polyPath([[x - w / 2, -40], [x - w / 2 + 8, -h], [x + w / 2 - 8, -h], [x + w / 2, -40]]), '#e2d6b8');
  for (let i = 1; i < 5; i++) limb([[x - w / 2 + i * w / 5, -44], [x - w / 2 + 4 + i * (w - 8) / 5, -h + 4]], 5, '#cbbd9a', false);
  rect(x - w / 2 - 20, -h - 30, w + 40, 30, '#d8cba9'); rect(x - w / 2 - 10, -h - 46, w + 20, 18, '#e9dfc6');
  if (a.crack >= 0) {
    const k = clamp(a.crack * 8);
    for (const [dx, dy] of [[-40, -30], [30, -60], [-20, 50], [40, 30], [0, -90]]) limb([[x - w / 2 + 2, -210], [x - w / 2 + 2 + 26 * k, -210 + dy * k], [x - w / 2 + 2 + 44 * k, -210 + (dy + dx * 0.4) * k]], 5, '#8f7a57', false);
  }
}
function pennant(t) {
  const x = PEN.x, y0 = AR.wall - 24, top = y0 - 260;
  limb([[x, y0], [x, top]], 8, '#6d5a42', false); ell(x, top - 6, 9, 9, '#ffd23f');
  const wv = k => Math.sin(t * 9 + k * 1.8) * 10 * windAt(t);
  fill(smoothPath([[x + 2, top + 4], [x + 70, top + 14 + wv(1)], [x + 150, top + 30 + wv(2)], [x + 76, top + 50 + wv(3)], [x + 2, top + 70]]), '#d9433b');
}
function windLines(t, cam) {
  const half = W / 2 / cam.z + 300;
  for (let i = 0; i < 14; i++) {
    const h = hash(i * 4.7), y = -560 + h * 520, sp_ = 700 + 400 * hash(i * 2.3), x = cam.x - half + ((t * sp_ + h * 3000) % (half * 2 + 400)), len = 120 + 140 * hash(i * 6.1);
    const pts = []; for (let k = 0; k <= 6; k++) pts.push([x + k * len / 6, y + 10 * Math.sin(k * 0.9 + t * 4 + i)]);
    g.save(); g.globalAlpha = 0.45; limb(pts, 5, '#ffffff', true); g.restore();
  }
}
function scent(t, p) {                               // wisps from you drift to the right, away from his nose
  for (let i = 0; i < 6; i++) {
    const k = ((t * 0.5 + i / 6) % 1), x = p[0] + 40 + 380 * k, y = p[1] - 30 * Math.sin(k * 6 + i) - 60 * k;
    g.save(); g.globalAlpha = 0.7 * (1 - k); limb([[x, y], [x + 30, y - 18], [x + 60, y]], 6, '#b6e36b', true); g.restore();
  }
}
function stars(p, u) {
  if (u < 0 || u > 4) return;
  for (let i = 0; i < 5; i++) { const a = u * 4 + i * TAU / 5; g.save(); g.translate(p[0] + Math.cos(a) * 90, p[1] - 40 + Math.sin(a) * 26); g.rotate(a);
    fill(polyPath([...Array(10)].map((_, j) => [Math.cos(j * Math.PI / 5) * (j % 2 ? 9 : 22), Math.sin(j * Math.PI / 5) * (j % 2 ? 9 : 22)])), '#ffd23f'); g.restore(); }
}
function puffs(p, u, dir = 1) {
  if (u < 0 || u > 1) return;
  for (let i = 0; i < 4; i++) { const k = clamp(u * 1.4 - i * 0.08); ell(p[0] + dir * (30 + 120 * k), p[1] + 10 * i - 20 * k, 26 + 40 * k, 18 + 26 * k, '#f4f1ea', 0, (1 - k) * 0.8); }
}
function question(p, u, t) {
  if (u < 0) return;
  const k = clamp(sp(0, -u, 2.6, 8) * 0 + clamp(u * 4)), pulse = 1 + 0.06 * Math.sin(t * 6);
  g.save(); g.translate(p[0], p[1] - 150); g.scale(k * pulse, k * pulse); text('?', 0, 40, 130, '#ffd23f', { fam: FONTS.block }); g.restore();
}
function shhMark(p, u) {
  if (u < 0) return;
  const k = clamp(u * 4);
  g.save(); g.globalAlpha = k; text('тсс…', p[0] - 130, p[1] - 40, 58, '#ffffff', { fam: FONTS.cond }); g.restore();
}

// —— the arena ——
const CROWD = ['#d9433b', '#3b6fd9', '#efe3c2', '#5fa05a', '#d98a3b', '#8a5ad9', '#f2f2f2', '#c94f8a', '#3bb3b3'];
const SKIN = ['#f1c9a5', '#e0b08a', '#c68e64', '#9a6a46'];
function crowd(t, cam, a) {
  // tiers: the front row stands over the podium wall, five more rows above; only what the camera sees is drawn
  const half = W / 2 / cam.z + 80, xs0 = cam.x - half, xs1 = cam.x + half;
  for (let r = 5; r >= 0; r--) {
    const y0 = AR.wall - 60 - r * 150;
    rect(xs0 - 60, y0 - 150, xs1 - xs0 + 120, 150, r % 2 ? '#c2ab84' : '#cdb790');
    rect(xs0 - 60, y0 - 8, xs1 - xs0 + 120, 12, '#a8916b');
    const step = 52, i0 = Math.floor(xs0 / step), i1 = Math.ceil(xs1 / step);
    for (let i = i0; i <= i1; i++) {
      const x = i * step + (r % 2) * 26, hsh = hash(i * 12.9 + r * 78.2);
      if (r === 0 && Math.abs(x - AR.box) < 200) continue;          // the emperor's box
      const exc = a.cheer || a.excite ? 1 : 0.15 + 0.15 * (a.tense ? 1 : 0);
      const jump = exc * Math.max(0, Math.sin(t * (7 + 3 * hsh) + hsh * 20)) * 14;
      const by = y0 - 10 - jump, body = CROWD[Math.floor(hsh * CROWD.length)], skin = SKIN[Math.floor(hash(hsh * 91) * SKIN.length)];
      if (exc > 0.5 && hsh > 0.35) { const sw = Math.sin(t * 9 + hsh * 30) * 0.4; limb([[x - 16, by - 56], [x - 32 + sw * 20, by - 116]], 11, skin, false); limb([[x + 16, by - 56], [x + 32 - sw * 20, by - 116]], 11, skin, false); }
      rrect(x - 23, by - 64, 46, 64, 18, body);
      ell(x, by - 86, 20, 22, skin);
      ell(x, by - 102, 20, 11, hash(hsh * 7) > 0.5 ? '#3a2a1e' : '#1e1a17');
    }
  }
  // the emperor's box: columns, a purple canopy, the emperor raising his hand
  const bx = AR.box, by = AR.wall - 60;
  rect(bx - 190, by - 300, 380, 300, '#e9dcc0'); rect(bx - 170, by - 240, 340, 240, '#b8a27c');
  for (const cx of [-170, 150]) rect(bx + cx, by - 300, 20, 300, '#f4ecdb');
  fill(polyPath([[bx - 210, by - 300], [bx + 210, by - 300], [bx + 180, by - 360], [bx - 180, by - 360]]), '#6a2c91');
  for (let i = 0; i < 10; i++) ell(bx - 190 + i * 42, by - 296, 12, 12, '#ffd23f');
  const raise = a.emperor ?? 0;
  rrect(bx - 50, by - 170, 100, 170, 30, '#f4ecdb'); fill(polyPath([[bx - 50, by - 150], [bx + 50, by - 60], [bx + 50, by - 20], [bx - 50, by - 110]]), '#6a2c91');
  ell(bx, by - 200, 30, 33, '#f1c9a5'); ell(bx - 10, by - 205, 4, 4, INK); ell(bx + 12, by - 205, 4, 4, INK);
  for (let i = 0; i < 7; i++) ell(bx - 30 + i * 10, by - 230 + Math.abs(i - 3) * 4, 9, 6, '#4caf50', 0.3 * (i - 3));
  limb([[bx + 40, by - 130], [bx + 80, by - 130 - 80 * raise], [bx + 90, by - 150 - 120 * raise]], 18, '#f4ecdb', true);
  ell(bx + 90, by - 155 - 120 * raise, 12, 12, '#f1c9a5');
  rect(bx - 190, by - 20, 380, 26, '#a8916b');
}
function arena(t, a, cam) {
  // the sky and the awning over the top tiers
  const top = AR.wall - 60 - 6 * 150;
  const half = W / 2 / cam.z + 200;
  rect(cam.x - half, top - 1400, half * 2, 1400, '#9fd6f2');
  for (let i = Math.floor((cam.x - half) / 160); i <= Math.ceil((cam.x + half) / 160); i++) fill(polyPath([[i * 160, top - 1400], [i * 160 + 160, top - 1400], [i * 160 + 150, top - 320], [i * 160 + 10, top - 300]]), i % 2 ? '#f3e3c3' : '#d9573b');
  rect(cam.x - half, top - 320, half * 2, 320, '#bda57d');
  for (let i = Math.floor((cam.x - half) / 140); i <= Math.ceil((cam.x + half) / 140); i++) { rrect(i * 140 + 30, top - 280, 80, 240, 40, '#6d5a42'); }
  crowd(t, cam, a);
  // the parapet in front of the front row; the podium wall with its marble cap; the gate with the portcullis
  rect(cam.x - half, AR.wall - 74, half * 2, 54, '#b8a27c');
  rect(cam.x - half, AR.wall, half * 2, -AR.wall, '#cdbb98');
  for (let r = 0; r < 4; r++) for (let i = Math.floor((cam.x - half) / 120) - 1; i <= Math.ceil((cam.x + half) / 120); i++) rect(i * 120 + (r % 2) * 60, AR.wall + 8 + r * 100, 116, 4, '#b8a47f');
  rect(cam.x - half, AR.wall - 24, half * 2, 34, '#f1eadb'); rect(cam.x - half, AR.wall + 10, half * 2, 6, '#c9b995');
  for (let i = Math.floor((cam.x - half) / 90); i <= Math.ceil((cam.x + half) / 90); i++) limb([[i * 90, AR.wall - 24], [i * 90, AR.wall - 120]], 4, 'rgba(70,60,50,0.6)', false);
  limb([[cam.x - half, AR.wall - 118], [cam.x + half, AR.wall - 118]], 3, 'rgba(70,60,50,0.6)', false);
  const gx = AR.gate, gw = AR.gateW, gh = AR.gateH;
  const arch = smoothPath([[gx - gw / 2, 0], [gx - gw / 2, -gh + 120], [gx - gw / 2 + 30, -gh + 30], [gx, -gh], [gx + gw / 2 - 30, -gh + 30], [gx + gw / 2, -gh + 120], [gx + gw / 2, 0]]);
  fill(smoothPath([[gx - gw / 2 - 30, 0], [gx - gw / 2 - 30, -gh + 110], [gx, -gh - 40], [gx + gw / 2 + 30, -gh + 110], [gx + gw / 2 + 30, 0]]), '#b5a07a');
  fill(arch, '#1c1712');
  a.archPath = arch;
  if (a.next) {                                       // a shadow behind the bars and a question mark
    inside(arch, () => { fill(smoothPath([[gx - 90, 0], [gx - 110, -140], [gx - 60, -210], [gx + 40, -230], [gx + 110, -160], [gx + 100, 0]]), '#0d0a08'); });
    const pulse = 1 + 0.06 * Math.sin(t * 6);
    g.save(); g.translate(gx, -150); g.scale(pulse, pulse); text('?', 0, 50, 170, '#ffd23f', { fam: FONTS.block }); g.restore();
  }
  // the end wall: the oval curving round towards us, seen side-on
  const ew = AR.end;
  fill(polyPath([[ew, 0], [ew, AR.wall - 24], [ew + 900, AR.wall - 24 - 140], [ew + 900, 0]]), '#a8916b');
  for (let r = 0; r < 4; r++) limb([[ew, AR.wall + 20 + r * 95], [ew + 900, AR.wall - 120 + 20 + r * 95 + r * 30]], 4, '#8f7a57', false);
  fill(polyPath([[ew, 0], [ew, -170], [ew + 900, -250], [ew + 900, 0]]), '#7a5434');
  for (let i = 0; i < 12; i++) limb([[ew + i * 75, -170 - i * 6.7], [ew + i * 75, 0]], 4, '#5e3f25', false);
  limb([[ew, -170], [ew + 900, -250]], 8, '#5e3f25', false);
  fill(polyPath([[ew - 14, AR.wall - 40], [ew + 900, AR.wall - 200], [ew + 900, AR.wall - 160], [ew - 14, AR.wall - 4]]), '#f1eadb');
  rect(ew - 16, AR.wall - 40, 32, -AR.wall + 40, '#efe6d2'); rect(ew + 12, AR.wall - 40, 8, -AR.wall + 40, '#8f7a57');
  if (a.dust >= 0) {                                  // cracks where he hit
    const k = clamp(a.dust * 6);
    for (const [dx, dy] of [[-60, -40], [40, -70], [-30, 60], [60, 40], [0, -110]]) limb([[ew + 2, -200], [ew + 2 + 20 * k, -200 + dy * k], [ew + 2 + 34 * k, -200 + (dy + dx * 0.4) * k]], 5, '#6d5a42', false);
  }
  // the sand
  rect(cam.x - half, 0, half * 2, 1400, '#e3c58f');
  for (let i = 0; i < 70; i++) { const x = Math.floor(cam.x / 400) * 400 - 1600 + hash(i * 3.7) * 3200, y = 30 + hash(i * 9.1) * 700; ell(x, y, 30 + hash(i) * 50, 6, '#d6b57c'); }
  rect(cam.x - half, 0, half * 2, 14, '#c9a86f');
}
function gateBars(t, a) {
  const gx = AR.gate, gw = AR.gateW, gh = AR.gateH, up = a.gate ?? 0;
  inside(a.archPath, () => {
    const y0 = -gh * up * 1.05;
    for (let i = 0; i < 7; i++) rect(gx - gw / 2 + 20 + i * (gw - 40) / 6 - 6, y0 - gh, 12, gh, '#3d3a36');
    for (let j = 0; j < 4; j++) rect(gx - gw / 2, y0 - gh + 40 + j * 90, gw, 12, '#3d3a36');
  });
}
function dust(p, u, s = 1) {
  if (u < 0 || u > 1.4) return;
  for (let i = 0; i < 8; i++) { const k = clamp(u * 1.3 - i * 0.03), a = i * 0.8; ell(p[0] - 30 * s * k * Math.cos(a) - 80 * k, p[1] - 60 * k * Math.abs(Math.sin(a)), (30 + 60 * k) * s, (22 + 40 * k) * s, '#e8d3a8', 0, (1 - k) * 0.8); }
}
function flowers(t, u, cam) {
  if (u < 0) return;
  for (let i = 0; i < 26; i++) {
    const h = hash(i * 7.3), x = cam.x - 700 + h * 1400 + 40 * Math.sin(t * 2 + i), fall = (u * (300 + 200 * hash(i * 3.1)) + hash(i * 5.5) * 300);
    const y = -1100 + fall; if (y > 0) continue;
    g.save(); g.translate(x, y); g.rotate(t * 3 + i);
    for (let k = 0; k < 5; k++) ell(Math.cos(k * TAU / 5) * 10, Math.sin(k * TAU / 5) * 10, 9, 9, ['#ff5c8a', '#ffd23f', '#ff8a3b'][i % 3]);
    ell(0, 0, 6, 6, '#fff3d6'); g.restore();
  }
}

function bulb(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  for (let i = 0; i < 8; i++) { const an = i * TAU / 8; limb([[Math.cos(an) * 70, Math.sin(an) * 70], [Math.cos(an) * 96, Math.sin(an) * 96]], 8, '#ffd23f', false); }
  ell(0, 0, 50, 54, '#ffe066'); rrect(-22, 44, 44, 30, 6, '#9aa3ad'); limb([[-20, 56], [20, 56]], 4, '#6b737d', false);
  g.restore();
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (scene(t) === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  arena(t, a, cam);
  pennant(t);
  const inGate = a.r && a.r.inGate;
  if (inGate) inside(a.archPath, () => drawRhino(a.r));
  gateBars(t, a);
  // behind the column he is hidden from the rhino (and partly from us): column after the hunter once he is behind it
  const behind = a.h && a.h.hip[0] > COL.x + 20;
  if (behind) { drawHunter(a.h); column(t, a); } else column(t, a);
  let rr = null;
  if (a.r && !inGate) rr = drawRhino(a.r);
  if (a.kick >= 0 && a.r) dust([a.r.x - 120, -20], (t * 2) % 1.2, 1.2);
  if (a.stomp >= 0 && a.r) dust([a.r.x + 60, -10], a.stomp * 1.6, 0.9);
  if (a.h && !behind) drawHunter(a.h);
  if (a.d) drawDog(a.d);
  if (a.wind) windLines(t, cam);
  if (a.scent && a.h) scent(t, headOf(a.h));
  if (a.shhT >= 0 && a.h) shhMark(headOf(a.h), a.shhT);
  if (rr && a.stars >= 0) stars(rr.head, a.stars);
  if (rr && a.snortT >= 0) puffs(rr.nose, a.snortT * 1.4, 1);
  if (rr && a.what >= 0) question(rr.head, a.what, t);
  if (a.crack >= 0 && a.crack < 1.2) dust([COL.x - COL.w / 2, -200], a.crack, 1.0);
  if (a.bulb > 0 && a.h) { const H0 = headOf(a.h); bulb(H0[0], H0[1] - 170, a.bulb, t); }
  flowers(t, a.cheer ? a.flowers : -1, cam);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.7);
}

// —— everything over the picture ——
function bar(t) {
  if (t < T.c2 + 0.2 || t > T.c6 + 0.6) return;
  const k = clamp(sp(t, T.c2 + 0.2, 2.4, 8)) * (1 - seg(T.c6 + 0.2, T.c6 + 0.6, t)), v = clamp(smell(t));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 140, y = 500, w = 800, h = 44;
  rrect(x - 10, y - 64, w + 20, h + 84, 18, 'rgba(11,15,26,0.85)');
  Hd.label('НОСОРОГ ЧУЕТ ТЕБЯ', x + 6, y - 18, 34, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label(Math.round(v * 100) + '%', x + w - 4, y - 18, 34, v < 0.3 ? OK : '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  rrect(x, y, w, h, 12, '#2a2f3d');
  rrect(x, y, Math.max(24, w * v), h, 12, v > 0.6 ? DANGER : v > 0.3 ? WARM : OK);
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, 'РИМ — БИТВА 3', { color: GOLD });
  if (t >= T.voted && t < T.c1) Hd.plaque(t, T.voted + 0.05, T.c1 - 0.05, 540, 330, { icon: 'comment', title: 'НОСОРОГА ВЫБРАЛИ ВЫ', sub: 'по вашим комментариям', color: GOLD });
  if (t >= T.c1 && t < T.idea) Hd.plaque(t, A.L1w0 + 0.05, T.idea - 0.1, 540, 330, { icon: 'x', title: 'БОЛЬШЕ ТОННЫ', sub: 'и рог впереди', color: DANGER });
  Hd.ribbon(t, T.idea, T.c2 - 0.1, 'ГОЛОВОЙ!', { y: 330, size: 110, rot: -0.08 });
  // step 1
  Hd.stepHeader(t, 1, 'ВЕТЕР ОТ НЕГО', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, T.nose + 0.05, T.c3 - 0.02, 540, 660, { icon: 'x', title: 'НЮХ — ЕГО ГЛАВНОЕ', sub: 'запах уносит от него', color: WARM });
  // step 2
  Hd.stepHeader(t, 2, 'ЗАМРИ И МОЛЧИ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, T.hears + 0.05, T.c4 - 0.02, 540, 660, { icon: 'x', title: 'СЛЫШИТ ЛУЧШЕ, ЧЕМ ВИДИТ', sub: 'а ты молчишь', color: WARM, size: 40 });
  // step 3
  Hd.stepHeader(t, 3, 'ЗА КОЛОННУ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.hit) Hd.plaque(t, A.L4w6 - 0.1, T.hit - 0.02, 540, 660, { icon: 'check', title: 'КАМЕНЬ МЕЖДУ ВАМИ', sub: 'он бьёт туда, где ты был', color: OK });
  bar(t);
  // the twist
  if (t >= T.lost && t < T.c6) Hd.plaque(t, T.lost + 0.3, T.c6 - 0.02, 540, 330, { icon: 'check', title: 'ПОТЕРЯЛ ТЕБЯ', sub: 'ни запаха, ни звука', color: OK });
  // the end
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) {
    Hd.plaque(t, A.L7w3 - 0.1, DUR + 1, 540, 650, { icon: 'comment', title: 'КОГО СЛЕДУЮЩИМ?', sub: 'пиши в комментариях', color: GOLD, size: 48 });
    ['МЕДВЕДЬ?', 'КРОКОДИЛ?', 'СЛОН?'].forEach((s, i) => {
      const t0 = A.L7w1 + i * 0.25, k = clamp(sp(t, t0, 2.6, 8));
      if (k <= 0.01) return;
      const x = 200 + i * 340, y = 770, w = measure(s, 44, FONTS.cond) + 48;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.04 + 0.04 * i);
      rrect(-w / 2 + 6, -36 + 6, w, 72, 16, INK); rrect(-w / 2, -36, w, 72, 16, '#fff3d6');
      text(s, 0, 16, 44, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
}

// —— the poster: the rhino charging with dust, the hunter behind the column, the title ——
function coverFrame(t) {
  const cam = { x: 60, y: -330, z: 1.2, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const a = { gate: 1, cheer: true };
  arena(2.0, a, cam); pennant(1); gateBars(2.0, a);
  const o = stand(base(1, { face: -1, look: [0.8, 0], brow: 1, pop: 0.8, mouth: 0.4, blink: 0 }), HIDE);
  drawHunter(o); column(1, { crack: -1 });
  drawRhino({ x: -190, y: 0, s: RS, face: 1, t: 1, gait: 1, phase: 1.2, charge: 1 });
  dust([-310, -20], 0.6, 1.3);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(11,15,26,0.25)'; g.fillRect(0, 0, W, 520);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.save(); g.shadowColor = 'rgba(160,170,190,0.8)'; g.shadowBlur = 40; Hd.label('НОСОРОГ', 0, 230, 160, '#c9d0d6', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'АРЕНА · БИТВА 3', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw + 8, 290 + 8, pw, 84, INK); rect(-pw, 290, pw, 84, '#ffd43b'); text(pl, -pw / 2, 348, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, r, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (r) out.push(toScreen(cam, [r.x, (r.y ?? 0) - 170 * RS]));
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
  add(0.3, 'crowd_murmur', -24, 0, { dur: DUR - 0.3 });
  add(T.gate + 0.05, 'gate_chain', -8, -0.5, { dur: 1.0 });
  add(T.out, 'hooves', -12, -0.5, { dur: 1.5, rate: 3.0 });
  add(T.out + 1.5, 'rhino_stomp', -6, -0.4); add(T.out + 1.7, 'snort', -6, -0.4);
  add(T.out + 1.8, 'crowd_roar', -12, 0, { dur: 1.4 });
  add(T.voted, 'pop_word', -8, 0); add(T.voted, 'blip', -10, 0);
  add(A.L1w0, 'stamp', -10, 0);
  add(T.idea, 'ding', -10, 0); add(T.idea, 'ribbon', -8, 0);
  add(T.c2, 'wind_gust', -14, -0.5, { dur: T.c4 - T.c2 });
  add(T.nose, 'sniff', -6, -0.4, { dur: 1.2 });
  add(T.shh, 'shh', -8, 0.2);
  add(T.hears + 0.2, 'rhino_grunt', -12, -0.4);
  add(T.charge, 'rhino_stomp', -6, -0.4); add(T.charge + 0.2, 'snort', -4, -0.4);
  add(T.charge + 0.5, 'hooves', -4, -0.2, { dur: T.hit - T.charge - 0.5, rate: 8.0 });
  add(T.hide, 'steps_sand', -10, 0.3, { dur: 0.7 });
  add(T.hit, 'wall_hit', 0, 0.1);
  add(T.hit + 0.1, 'crowd_roar', -10, 0, { dur: 1.2 });
  add(T.snort, 'snort', -6, 0.0);
  add(T.lost, 'sniff', -8, 0.0, { dur: 1.4 });
  add(T.lost + 0.3, 'ding', -12, 0);
  add(T.c6 + 0.4, 'hooves', -14, -0.3, { dur: T.c7 - T.c6 - 0.6, rate: 2.6 });
  add(T.cheer, 'crowd_roar', -4, 0, { dur: T.c7 - T.cheer + 1.0 });
  add(T.cheer + 0.3, 'bark', -10, 0.3);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  for (let i = 0; i < 3; i++) add(A.L7w1 + i * 0.25, 'pop_word', -10, -0.4 + i * 0.4);
  add(A.L7w3 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
