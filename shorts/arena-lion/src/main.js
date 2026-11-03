// «Лев» (Арена, битва 2 — его выбрали зрители): the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json
// from tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The arena, the crowd and the hunter as in battle 1 (arena-bull); new here: the lion (lion.js) stalking, stopped by
// the cape held up high and the shout, the hunter backing away step by step, the limp, the thorn pulled out (the Roman
// legend of Androcles), the lion lying at his feet; the bar «Лев видит добычу» going down step by step.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, smoothPath, polyPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { drawLion } from './lion.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 5.04, 11], L1: [5.39, 7.92, 6], L2: [8.37, 11.94, 9], L3: [12.34, 16.0, 11], L4: [16.4, 20.14, 9], L5: [20.59, 26.04, 15], L6: [26.34, 28.36, 8], L7: [28.81, 34.67, 13] };
export const DUR = VOICE?.dur ?? 35.02;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ЛЕВ: WARM, ВЫ: GOLD, ОРУЖИЯ: DANGER, ГОЛОВОЙ: GOLD, БЕГИ: DANGER, ДОБЫЧЕЙ: DANGER, БОЛЬШИМ: GOLD, КРИЧИ: GOLD,
  МЕДЛЕННО: GOLD, СПИНУ: DANGER, ЗАНОЗА: WARM, ЛЕГЕНДЕ: GOLD, НОГ: OK, РЕВЁТ: WARM, СЛЕДУЮЩИМ: GOLD, ПОДПИСЫВАЙСЯ: GOLD, БИТВУ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  gate: A.L0w3 - 0.06,               // «Ворота поднимаются»
  out: A.L0w6 - 0.1,                 // «и выходит лев»
  voted: A.L0w8 - 0.06,              // «Его выбрали вы»
  c1: A.L1 - 0.06,                   // «Оружия опять нет»
  idea: A.L1w5 - 0.08,               // «головой»
  c2: A.L2 - 0.06,                   // step 1: don't run
  prey: A.L2w3 - 0.06,               // «Того, кто бежит…»
  c3: A.L3 - 0.06,                   // step 2: big and loud
  raise: A.L3w5 - 0.1,               // «Подними плащ над головой»
  shout: A.L3w10 - 0.06,             // «и кричи»
  c4: A.L4 - 0.06,                   // step 3: back away slowly
  c5: A.L5 - 0.06,                   // «Лев остановился и захромал»
  thorn: A.L5w5 - 0.06,              // «в лапе заноза»
  pull: A.L5w8 - 0.05,               // «Ты вытащил её»
  legend: A.L5w11 - 0.06,            // «как в древней римской легенде»
  c6: A.L6 - 0.06,                   // «И лев лёг у твоих ног»
  cheer: A.L6w6 - 0.06,              // «Толпа ревёт!»
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c2, T.c3, T.c4, T.c5, T.c7];
export const SNAPS = [T.pull];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7, LS = 0.92;
const scene = t => (t < T.cover ? 'cover' : 'arena');
const AR = { wall: -400, gate: -620, gateW: 320, gateH: 330, end: 1400, box: 640 };

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
shot(T.cover, [[T.cover, 0, -540, 0.78], [T.gate, -100, -400, 0.95], [T.out + 0.8, -220, -175, 1.2], [T.c1, -210, -172, 1.22]]);
shot(T.c1, [[T.c1, -200, -169, 1.24], [T.c2, -190, -164, 1.28]]);
shot(T.c2, [[T.c2, -150, -172, 1.22], [T.c3, -100, -164, 1.28]]);
shot(T.c3, [[T.c3, -60, -175, 1.2], [T.shout, -40, -170, 1.24], [T.c4, -30, -168, 1.25]]);
shot(T.c4, [[T.c4, 0, -175, 1.2], [T.c5, 40, -178, 1.18]]);
shot(T.c5, [[T.c5, 0, -168, 1.25], [T.pull, 20, -160, 1.32], [T.c6, 20, -160, 1.32]]);
shot(T.c6, [[T.c6, 30, -168, 1.25], [T.cheer, 0, -175, 1.2], [T.cheer + 1.2, 120, -330, 0.9], [T.c7, 120, -320, 0.92]]);
shot(T.c7, [[T.c7, -140, -239, 0.88], [DUR, -135, -233, 0.9]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.out + 0.6, 8], [T.shout, 10], [T.pull, 6], [T.cheer, 8]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const headOf = o => framesOf(o).H.p([0, -60]);

// how sure the lion is that you are prey: 100 % → 80 (you did not run) → 40 (big and loud) → 15 (backing away)
function prey(t) {
  return 1 - 0.2 * seg(T.prey, T.c3 - 0.1, t) - 0.4 * seg(T.shout, T.shout + 0.6, t) - 0.25 * seg(T.c4 + 0.2, T.c5 - 0.1, t);
}

// —— who is where, and in what pose, at time t ——
export function actorsAt(t) {
  if (scene(t) !== 'arena') return {};
  // S1 · the gate goes up, the lion walks out and roars; «его выбрали вы»
  if (t < T.c1) {
    const gate = seg(T.gate, T.gate + 1.0, t);
    const w = seg(T.out, T.out + 1.4, t, ease.out);
    const l = { x: lerp(AR.gate, -360, w), y: 0, s: lerp(0.7, LS, w), face: 1, t, gait: w > 0 && w < 1 ? 0.45 : 0, phase: t * 6, inGate: w < 0.5, roar: bump(seg(T.out + 1.3, T.out + 2.3, t)) };
    const o = stand(base(t, { look: [0.7, 0], brow: 0.8, pop: 0.7 * bump(seg(T.out + 1.2, T.out + 2.2, t)) }), 150);
    return { h: o, l, gate, cape: { lie: [260, 0] }, excite: t > T.out + 1.3 };
  }
  // S2 · no weapons again; «головой»: a finger up, a light bulb
  if (t < T.c2) {
    const o = stand(base(t, { look: [0.7, 0], brow: 0.6 }), 150);
    if (t > T.idea - 0.25) { const H0 = headOf(o), k = clamp(sp(t, T.idea - 0.25, 2.6, 8)); o.hands = { near: { p: [lerp(H0[0] + 60, H0[0] + 34, k), lerp(H0[1] + 160, H0[1] - 24, k)], shape: 'point', ang: -1.2 } }; o.brow = -0.3; o.mouth = 0.2; }
    else { const sh = shoulder(o), k = clamp(sp(t, T.c1, 2.4, 7)); o.hands = { near: { p: [sh[0] - 70 * k, sh[1] + 70], shape: 'open', ang: -0.6 }, far: { p: [sh[0] + 40 * k, sh[1] + 66], shape: 'open', ang: -2.4 } }; }
    return { h: o, l: { x: -360, y: 0, s: LS, face: 1, t }, gate: 1, cape: { lie: [260, 0] }, bulb: seg(T.idea, T.idea + 0.25, t) };
  }
  // S3 · step 1: he freezes; the lion crouches and stalks closer
  if (t < T.c3) {
    const o = stand(base(t, { look: [0.7, 0.1], brow: 1, pop: 0.5, mouth: 0 }), 150);
    o.lean = 0.0;
    const k = seg(T.c2 + 0.2, T.c3, t, u => u);
    const l = { x: lerp(-360, -230, k), y: 0, s: LS, face: 1, t, crouch: seg(T.c2, T.c2 + 0.5, t), gait: 0.25, phase: t * 3 };
    return { h: o, l, gate: 1, cape: { lie: [260, 0] }, tense: true };
  }
  // S4 · step 2: the cape up over his head, the shout; the lion stops and leans back
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.7, 0], brow: 1, mouth: t > T.shout ? 0.9 : 0.1 }), 150);
    const sh = shoulder(o), up = seg(T.raise, T.raise + 0.35, t);
    const pick = seg(T.c3 + 0.1, T.raise, t);
    let cape;
    if (up > 0) {
      const l0 = [lerp(sh[0] - 40, sh[0] - 110, up), lerp(sh[1] + 60, sh[1] - 170, up)], r0 = [lerp(sh[0] + 30, sh[0] + 90, up), lerp(sh[1] + 60, sh[1] - 165, up)];
      o.hands = { near: { p: l0, shape: 'grip' }, far: { p: r0, shape: 'grip' } };
      cape = { over: [l0, r0] };
    } else { o.hands = { near: { p: [lerp(240, sh[0] - 40, pick), lerp(-10, sh[1] + 60, pick)], shape: 'grip' } }; cape = pick > 0.4 ? { hand: [sh[0] - 40, sh[1] + 60], hang: true, flap: 0.2 } : { lie: [260, 0] }; if (pick < 0.5) o.lean = 0.3 * bump(pick * 2); }
    const st = seg(T.shout, T.shout + 0.4, t);
    const l = { x: -230, y: 0, s: LS, face: 1, t, crouch: 1 - st, back: st, lid: 0 };
    return { h: o, l, gate: 1, cape, shout: t > T.shout ? t - T.shout : -1, tense: true };
  }
  // S5 · step 3: backing away slowly, facing the lion; he stays where he is
  if (t < T.c5) {
    const k = seg(T.c4 + 0.1, T.c5 - 0.1, t, u => u);
    const x = lerp(150, 330, k), step = Math.sin(k * Math.PI * 6);
    const o = stand(base(t, { look: [0.7, 0], brow: 0.8 }), x);
    o.feet = { near: [x - 12 - 20 * Math.max(0, step), -8 * Math.max(0, step)], far: [x + 16 + 20 * Math.max(0, -step), -8 * Math.max(0, -step)] };
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] - 60, sh[1] + 50], shape: 'grip' } };
    return { h: o, l: { x: -230, y: 0, s: LS, face: 1, t, back: 0.3, crouch: 0 }, gate: 1, cape: { hand: [sh[0] - 60, sh[1] + 50], hang: true, flap: 0.3 }, tense: true };
  }
  // S6 · the limp; the thorn; he pulls it out
  if (t < T.c6) {
    const walk = seg(T.thorn, T.pull - 0.2, t);
    const o = stand(base(t, { look: [0.6, 0.4], brow: 0.3 }), lerp(330, 200, walk));
    const l = { x: -170, y: 0, s: LS, face: 1, t, limp: seg(T.c5 + 0.1, T.c5 + 0.5, t), thorn: t < T.pull, lid: 0.25, brow: 0 };
    if (t > T.pull - 0.4) { o.lean = 0.3; o.hands = { near: { p: [lerp(80, 110, seg(T.pull, T.pull + 0.2, t)), -150 - 30 * seg(T.pull, T.pull + 0.2, t)], shape: 'grip' } }; }
    return { h: o, l, gate: 1, pop: t > T.pull ? t - T.pull : -1 };
  }
  // S7 · he lies down at your feet; the crowd roars; Пурга runs out
  if (t < T.c7) {
    const lie = seg(T.c6, T.c6 + 0.7, t);
    const l = { x: -150, y: 0, s: LS, face: 1, t, lie, lid: 0.3, brow: 0 };
    const o = stand(base(t, { look: [0.5, 0.3], brow: 0.1, mouth: t > T.cheer ? 0.35 : 0.1 }), 240);
    const sh = shoulder(o);
    if (t > T.c6 + 0.5) { o.lean = 0.3; o.hands = { near: { p: [100, -150 + 8 * Math.sin(t * 9)], shape: 'open', ang: -1.6 } }; }
    if (t > T.cheer + 0.6) { const k = clamp(sp(t, T.cheer + 0.6, 2.4, 7)); o.lean = 0.04; o.hands = { near: { p: [sh[0] - 30, sh[1] - 140 * k + 40], shape: 'fist' }, far: { p: [sh[0] + 40, sh[1] - 140 * k + 40], shape: 'fist' } }; }
    const run = seg(T.cheer + 0.2, T.cheer + 1.6, t);
    const d = run < 1 ? { x: lerp(AR.gate, 400, run), y: 0, s: DS, face: 1, walk: 1, ph: t * 3.2, t, blink: dblink(t), mouth: 0.6, tongue: 0.7 }
      : { x: 410, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 };
    return { h: o, l, d: t > T.cheer + 0.2 ? d : null, gate: 1, cheer: t > T.cheer, flowers: t - T.cheer };
  }
  // S8 · «Кого одолеть следующим?»: the gate shut, a shadow and a question mark behind the bars
  const o = stand(base(t, { look: [0.6, 0], brow: 0.3, mouth: 0.35 }), 140);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o, l: { x: -120, y: 0, s: LS * 0.95, face: 1, t, lie: 1, lid: 0.45, brow: 0 }, d: { x: 350, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 }, gate: 1 - seg(T.c7, T.c7 + 0.6, t), next: true };
}

// —— drawing the hunter: lying on the sand (rotated), the cape and the sword in his hand ——
function hunterDraw(t, o) {
  if (o.lying) {                                      // flat on his back: the standing pose turned, head to the left
    const [hx, hy] = o.hip;
    g.save(); g.translate(hx, hy + LEG - 42); g.rotate(-Math.PI / 2); g.translate(-hx, -hy);
    drawHunter(o); g.restore();
    return;
  }
  drawHunter(o);
}
function capeAt(t, c) {
  if (!c) return;
  if (c.over) {                                       // held up over his head in both hands: he looks twice as big
    const [l, r] = c.over, wv = k => Math.sin(t * 8 + k * 2) * 10;
    const top = Math.min(l[1], r[1]) - 10;
    const p = smoothPath([[l[0] - 10, l[1] - 6], [(l[0] + r[0]) / 2, top - 14 + wv(0)], [r[0] + 10, r[1] - 6], [r[0] + 26 + wv(1), r[1] + 120], [(l[0] + r[0]) / 2 + wv(2), r[1] + 150], [l[0] - 26 + wv(3), l[1] + 120]]);
    fill(p, '#d32f2f');
    inside(p, () => { for (let i = 0; i < 4; i++) limb([[l[0] + 30 + i * (r[0] - l[0] - 60) / 3, top], [l[0] + 24 + i * (r[0] - l[0] - 60) / 3 + wv(i), r[1] + 150]], 12, '#b71c1c', false); });
    return;
  }
  if (c.lie) {                                        // lying folded on the sand
    const [x, y] = c.lie;
    fill(smoothPath([[x - 70, y - 4], [x + 60, y - 10], [x + 80, y + 6], [x - 60, y + 12]]), '#c62828');
    fill(smoothPath([[x - 40, y - 8], [x + 40, y - 12], [x + 50, y - 2], [x - 30, y + 2]]), '#e53935');
    return;
  }
  const [hx, hy] = c.hand, sd = c.side ?? -1, f = c.flap ?? 0.3;
  const wv = k => Math.sin(t * 9 + k * 2.4) * 14 * f;
  if (c.hang) {                                       // held by a corner, hanging down like a towel
    const p = smoothPath([[hx - 10, hy - 6], [hx + 14, hy - 4], [hx + 34 + wv(1), hy + 80], [hx + 30 + wv(2), hy + 160], [hx - 20 + wv(3), hy + 168], [hx - 26 + wv(0), hy + 80]]);
    fill(p, '#d32f2f'); inside(p, () => limb([[hx, hy], [hx + 6 + wv(2), hy + 170]], 12, '#b71c1c', false));
    return;
  }
  // held out on its stick: a red cloth hanging from a horizontal stick, the bottom edge waving
  const L = 170, D = 150, x1 = hx + sd * L;
  const pts = [[hx + sd * 6, hy], [x1, hy - 2], [x1 + sd * 10 + wv(1), hy + D * 0.55], [x1 + wv(2), hy + D + wv(3) * 0.5],
    [hx + sd * L * 0.6 + wv(3), hy + D + 10], [hx + sd * L * 0.25 + wv(4), hy + D - 4], [hx + sd * 10 + wv(4) * 0.5, hy + D * 0.6]];
  const p = smoothPath(pts);
  fill(p, '#d32f2f');
  inside(p, () => { for (let i = 0; i < 3; i++) limb([[hx + sd * (40 + i * 50), hy], [hx + sd * (34 + i * 50) + wv(i), hy + D + 10]], 12, '#b71c1c', false); });
  limb([[hx - sd * 6, hy - 2], [x1 + sd * 8, hy - 4]], 9, '#8d6e63', false);   // the stick along the top
}
function swordAt(s) {
  if (!s) return;
  g.save(); g.translate(s.p[0], s.p[1]); g.rotate(s.ang);
  rrect(-9, -150, 18, 140, 6, '#c8935a'); fill(polyPath([[-9, -150], [0, -172], [9, -150]]), '#c8935a');
  rect(-3, -146, 6, 130, '#a87445');
  rrect(-34, -12, 68, 16, 6, '#8a5a32'); rrect(-8, 2, 16, 46, 5, '#6e4426'); ell(0, 52, 11, 11, '#8a5a32');
  g.restore();
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
  const inGate = a.l && a.l.inGate;
  if (inGate) inside(a.archPath, () => drawLion(a.l));
  gateBars(t, a);
  let lr = null;
  if (a.l && !inGate) lr = drawLion(a.l);
  if (a.cape?.over) capeAt(t, a.cape);
  if (a.h) { hunterDraw(t, a.h); if (a.cape && !a.cape.over) capeAt(t, a.cape); }
  else if (a.cape) capeAt(t, a.cape);
  if (a.d) drawDog(a.d);
  if (a.shout >= 0 && a.h) shoutArcs(headOf(a.h), a.shout);
  if (a.pop >= 0 && lr?.paw) thornPop(lr.paw, a.pop, t);
  if (lr && a.l.limp > 0.5 && a.l.thorn) { const p = lr.paw; ell(p[0] + 30, p[1] + 10, 60, 60, 'rgba(255,210,63,0.18)'); }
  if (a.bulb > 0 && a.h) { const H0 = headOf(a.h); bulb(H0[0], H0[1] - 170, a.bulb, t); }
  if (lr && a.l.lie > 0.9 && t > T.c6 + 0.6) hearts(lr.head, t - T.c6 - 0.6);
  flowers(t, a.cheer ? a.flowers : -1, cam);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.7);
}
// the shout: three arcs spreading from his mouth towards the lion
function shoutArcs(p, u) {
  for (let i = 0; i < 3; i++) {
    const k = ((u * 1.6 + i / 3) % 1), r = 40 + 160 * k;
    g.save(); g.globalAlpha = (1 - k) * 0.9; g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#ffffff';
    g.beginPath(); g.arc(p[0] - 40, p[1] + 20, r, Math.PI - 0.55, Math.PI + 0.55); g.stroke(); g.restore();
  }
}
// the thorn flies out of the paw with a little burst
function thornPop(p, u, t) {
  if (u > 1.2) return;
  const x = p[0] + 40 + 160 * u, y = p[1] - 220 * u + 260 * u * u;
  g.save(); g.translate(x, y); g.rotate(u * 9); limb([[-14, 0], [14, 0]], 7, '#4b3a2a', false); g.restore();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r = 20 + 70 * clamp(u * 3); limb([[p[0] + 30 + Math.cos(a) * r * 0.6, p[1] + Math.sin(a) * r * 0.6], [p[0] + 30 + Math.cos(a) * r, p[1] + Math.sin(a) * r]], 6, rgba('#ffd23f', 1 - clamp(u * 3)), false); }
}
function hearts(p, u) {
  for (let i = 0; i < 3; i++) {
    const k = ((u * 0.6 + i / 3) % 1), x = p[0] + 20 + 30 * Math.sin(u * 3 + i), y = p[1] - 80 - 160 * k, s = 14 * (1 - 0.3 * k);
    g.save(); g.globalAlpha = 1 - k; g.translate(x, y);
    ell(-s * 0.55, 0, s * 0.62, s * 0.62, '#ff5c8a'); ell(s * 0.55, 0, s * 0.62, s * 0.62, '#ff5c8a'); fill(polyPath([[-s * 1.12, s * 0.2], [s * 1.12, s * 0.2], [0, s * 1.5]]), '#ff5c8a');
    g.restore();
  }
}

// —— everything over the picture ——
function bar(t) {
  if (t < T.c2 + 0.2 || t > T.c5 + 1.0) return;
  const k = clamp(sp(t, T.c2 + 0.2, 2.4, 8)) * (1 - seg(T.c5 + 0.6, T.c5 + 1.0, t)), v = prey(t);
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 140, y = 500, w = 800, h = 44;
  rrect(x - 10, y - 64, w + 20, h + 84, 18, 'rgba(11,15,26,0.85)');
  Hd.label('ЛЕВ ВИДИТ ДОБЫЧУ', x + 6, y - 18, 34, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label(Math.round(v * 100) + '%', x + w - 4, y - 18, 34, v < 0.3 ? OK : '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  rrect(x, y, w, h, 12, '#2a2f3d');
  rrect(x, y, Math.max(24, w * v), h, 12, v > 0.6 ? DANGER : v > 0.3 ? WARM : OK);
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, 'РИМ — БИТВА 2', { color: GOLD });
  if (t >= T.voted && t < T.c1) Hd.plaque(t, T.voted + 0.05, T.c1 - 0.05, 540, 330, { icon: 'comment', title: 'ЛЬВА ВЫБРАЛИ ВЫ', sub: 'по вашим комментариям', color: GOLD });
  if (t >= T.c1 && t < T.idea) Hd.plaque(t, A.L1w0 + 0.05, T.idea - 0.1, 540, 330, { icon: 'x', title: 'ОРУЖИЯ НЕТ', sub: 'только плащ на песке', color: DANGER, to: S2([260, -10]) });
  Hd.ribbon(t, T.idea, T.c2 - 0.1, 'ГОЛОВОЙ!', { y: 330, size: 110, rot: -0.08 });
  // step 1
  Hd.stepHeader(t, 1, 'НЕ БЕГИ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, T.prey + 0.05, T.c3 - 0.02, 540, 640, { icon: 'x', title: 'БЕГУЩИЙ — ДОБЫЧА', sub: 'лев бросится следом', color: DANGER });
  // step 2
  Hd.stepHeader(t, 2, 'БОЛЬШОЙ И ГРОМКИЙ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, T.shout + 0.2, T.c4 - 0.02, 540, 640, { icon: 'check', title: 'ТЫ НЕ ДОБЫЧА', sub: 'лев остановился', color: OK });
  // step 3
  Hd.stepHeader(t, 3, 'МЕДЛЕННО НАЗАД', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) Hd.plaque(t, A.L4w6 - 0.1, T.c5 - 0.02, 540, 640, { icon: 'x', title: 'СПИНОЙ НЕ ПОВОРАЧИВАЙСЯ', sub: 'лицом к нему, шаг за шагом', color: WARM, size: 40 });
  bar(t);
  // the twist
  if (t >= T.thorn && t < T.legend) Hd.plaque(t, T.thorn + 0.05, T.legend - 0.1, 540, 330, { icon: 'x', title: 'ЗАНОЗА', sub: 'вот почему он злился', color: WARM, to: a.l ? null : null });
  if (t >= T.legend && t < T.c7) Hd.plaque(t, T.legend, T.c7 - 0.02, 540, 330, { icon: 'check', title: 'ЛЕГЕНДА ОБ АНДРОКЛЕ', sub: 'лев пощадил того, кто вынул занозу', color: GOLD, size: 40 });
  // the end
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) {
    Hd.plaque(t, A.L7w3 - 0.1, DUR + 1, 540, 650, { icon: 'comment', title: 'КОГО СЛЕДУЮЩИМ?', sub: 'пиши в комментариях', color: GOLD, size: 48 });
    ['МЕДВЕДЬ?', 'НОСОРОГ?', 'КРОКОДИЛ?'].forEach((s, i) => {
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

// —— the poster: the lion roaring, the hunter with the cape up over his head, the title ——
function coverFrame(t) {
  const cam = { x: -40, y: -330, z: 1.3, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const a = { gate: 1, cheer: true };
  arena(2.0, a, cam);
  gateBars(2.0, a);
  drawLion({ x: -250, y: 0, s: LS, face: 1, t: 1, roar: 1, crouch: 0.4 });
  const o = stand(base(1, { look: [0.8, 0], brow: 1, pop: 0.3, mouth: 0.9, blink: 0 }), 200);
  const sh = shoulder(o), l0 = [sh[0] - 110, sh[1] - 170], r0 = [sh[0] + 90, sh[1] - 165];
  o.hands = { near: { p: l0, shape: 'grip' }, far: { p: r0, shape: 'grip' } };
  capeAt(1, { over: [l0, r0] }); drawHunter(o);
  shoutArcs(headOf(o), 0.4);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(11,15,26,0.25)'; g.fillRect(0, 0, W, 520);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.save(); g.shadowColor = 'rgba(255,170,40,0.8)'; g.shadowBlur = 40; Hd.label('ЛЕВ', 0, 230, 200, '#ffb02e', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'АРЕНА · БИТВА 2', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw + 8, 290 + 8, pw, 84, INK); rect(-pw, 290, pw, 84, '#ffd43b'); text(pl, -pw / 2, 348, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, l, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (l) out.push(toScreen(cam, [l.x, (l.y ?? 0) - 180 * LS]));
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
  add(T.out + 1.3, 'lion_roar', -4, -0.4, { dur: 1.4 });
  add(T.out + 1.5, 'crowd_roar', -10, 0, { dur: 1.6 });
  add(T.voted, 'pop_word', -8, 0); add(T.voted, 'blip', -10, 0);
  add(A.L1w0, 'stamp', -10, 0);
  add(T.idea, 'ding', -10, 0); add(T.idea, 'ribbon', -8, 0);
  add(T.c2 + 0.3, 'lion_growl', -10, -0.4, { dur: T.c3 - T.c2 - 0.3 });
  add(T.prey, 'stamp', -12, 0);
  add(T.raise, 'cloth', -8, 0.2);
  add(T.shout, 'shout', -4, 0.2);
  add(T.shout + 0.25, 'crowd_roar', -10, 0, { dur: 1.4 });
  add(T.c4 + 0.3, 'steps_sand', -14, 0.2, { dur: T.c5 - T.c4 - 0.4 });
  add(T.c5 + 0.2, 'lion_whimper', -10, -0.3);
  add(T.pull, 'pop_word', -4, -0.2); add(T.pull + 0.05, 'ding', -10, -0.2);
  add(T.legend, 'blip', -12, 0);
  add(T.c6 + 0.3, 'thud', -12, -0.2);
  add(T.cheer, 'crowd_roar', -4, 0, { dur: T.c7 - T.cheer + 1.0 });
  add(T.cheer + 0.3, 'bark', -10, -0.3);
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  for (let i = 0; i < 3; i++) add(A.L7w1 + i * 0.25, 'pop_word', -10, -0.4 + i * 0.4);
  add(A.L7w3 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
