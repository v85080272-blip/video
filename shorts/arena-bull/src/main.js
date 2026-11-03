// «Бык» (Арена, битва 1): the whole short as pure functions of time t (seconds), so any frame or motion-blur sub-frame
// can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from tools/voice.py, or
// tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The same hunter (in the striped vest and socks he went to bed in) and, at the end, Пурга. New here: the arena of Rome
// in section (the sand, the podium wall with the gate and its portcullis, the tiers of the crowd, the emperor's box, the
// awning), the curved end wall seen side-on, the bull (bull.js), the red cape, the bull's strength bar, the wooden sword.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, smoothPath, polyPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { drawBull, steam, stars } from './bull.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 4.8, 12], L1: [5.2, 8.33, 7], L2: [8.68, 11.07, 6], L3: [11.52, 16.85, 16], L4: [17.25, 22.39, 14], L5: [22.79, 25.65, 8], L6: [26.1, 31.41, 16], L7: [31.86, 37.72, 13] };
export const DUR = VOICE?.dur ?? 38.07;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { РИМЕ: GOLD, РЕВУТ: WARM, БЫК: DANGER, ОРУЖИЯ: DANGER, ГОЛОВОЙ: GOLD, ДВИЖЕНИЕ: GOLD, КРАСНЫЙ: DANGER, РАССТОЯНИЕ: GOLD,
  СТЕНУ: DANGER, ВЫДОХНЕТСЯ: OK, ПОЩАДИЛ: OK, СВОБОДЫ: GOLD, СЛЕДУЮЩИМ: GOLD, ПОДПИСЫВАЙСЯ: GOLD, БИТВУ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  wake: A.L0w4 - 0.06,               // «просыпаешься»
  reveal: A.L0w6 - 0.1,              // «на арене в Риме»: the camera pulls back
  roar: A.L0w9 - 0.06,               // «Ревут тысячи зрителей»
  c1: A.L1 - 0.06,                   // «Открываются ворота…»
  out: A.L1w3 - 0.1,                 // «выходит бык»
  arms: A.L1w5 - 0.06,               // «Оружия нет»
  c2: A.L2 - 0.06,                   // «Силой его не одолеть»
  idea: A.L2w5 - 0.08,               // «головой»
  c3: A.L3 - 0.06,                   // step 1: the cape
  wave: A.L3w10 - 0.06,              // «Маши плащом»
  c4: A.L4 - 0.06,                   // step 2: the wall
  jump: A.L4w7 - 0.04,               // «в последний миг»
  hit: A.L4w11 - 0.04,               // «врежется»
  c5: A.L5 - 0.06,                   // step 3: wear him out
  c6: A.L6 - 0.06,                   // «Бык лёг…»
  pat: A.L6w5 - 0.1,                 // «пощадил»
  cheer: A.L6w6 - 0.06,              // «Толпа ревёт»
  sword: A.L6w9 - 0.06,              // «а тебе дают деревянный меч»
  catch: A.L6w12,
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c1, T.c3, T.c4, T.c5, T.c6, T.c7];
export const SNAPS = [T.hit];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7, BS = 0.9;
const scene = t => (t < T.cover ? 'cover' : 'arena');

// the arena: the sand from the gate wall to the end wall; the podium wall behind, the tiers above
const AR = { wall: -400, gate: -620, gateW: 320, gateH: 330, end: 1400, box: 640 };
// the bull's run in step 1 (passes the cape) and step 2 (hits the wall)
const RUN1 = { t0: () => T.wave + 0.25, t1: () => Math.min(T.c4 - 0.15, T.wave + 1.45), x0: -420, x1: 900 };
const RUN2 = { t0: () => T.hit - 0.75, x0: 560, x1: AR.end - 250 * BS };

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
shot(T.cover, [[T.cover, 120, -60, 2.2], [T.reveal, 140, -70, 2.05], [T.reveal + 1.6, 60, -640, 0.72], [T.c1, 40, -660, 0.7]]);
shot(T.c1, [[T.c1, -260, -187, 1.12], [T.arms, -230, -178, 1.18], [T.c2, -220, -175, 1.2]]);
shot(T.c2, [[T.c2, -200, -169, 1.24], [T.c3, -190, -164, 1.28]]);
shot(T.c3, [[T.c3, -130, -172, 1.22], [T.wave, -110, -178, 1.18], [T.c4, 160, -194, 1.08]]);
shot(T.c4, [[T.c4, 1040, -169, 1.24], [T.jump, 1060, -164, 1.28], [T.hit + 0.4, 1100, -154, 1.36], [T.c5, 1100, -152, 1.38]]);
shot(T.c5, [[T.c5, 300, -221, 0.95], [T.c6, 310, -214, 0.98]]);
shot(T.c6, [[T.c6, 60, -168, 1.25], [T.cheer, 90, -175, 1.2], [T.cheer + 1.3, 200, -420, 0.85], [T.catch + 0.3, 190, -330, 0.92], [T.c7, 170, -300, 0.95]]);
shot(T.c7, [[T.c7, -230, -226, 0.93], [DUR, -225, -221, 0.95]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.wake, 6], [T.roar, 7], [T.out, 6], [T.hit, 26], [T.cheer, 8]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
// in what he went to bed in: the striped vest, socks, no hat, no pack
const base = (t, extra = {}) => ({ s: S, face: -1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function sitFloor(o, x, y = 0) { const k = (o.s ?? S) / S, f = o.face === 1 ? 1 : -1; o.hip = [x, y - 30 * k]; o.feet = { near: [x + 118 * k * f, y], far: [x + 140 * k * f, y] }; o.lean = -0.08; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const headOf = o => framesOf(o).H.p([0, -60]);

// the bull's strength, 1 → 0 over the three steps
function strength(t) {
  return 1 - 0.25 * seg(RUN1.t0() + 0.5, RUN1.t1(), t) - 0.35 * seg(T.hit, T.hit + 0.4, t) - 0.37 * seg(T.c5 + 0.2, T.c6 - 0.1, t, ease.out);
}

// —— who is where, and in what pose, at time t ——
export function actorsAt(t) {
  if (scene(t) !== 'arena') return {};
  // S1 · asleep on the sand, waking up, sitting up as the camera pulls back
  if (t < T.c1) {
    if (t < T.wake + 0.1) {
      const o = stand(base(t, { face: 1, look: [0.5, 0], lid: 1, blink: 1, brow: 0, mouth: 0.05 * Math.sin(t * 2) }), 140);
      o.lying = true;
      return { h: o, cape: { lie: [230, 0] }, gate: 0 };
    }
    const up = seg(T.wake + 0.1, T.wake + 0.4, t);
    const o = sitFloor(base(t, { face: 1, look: [0.6, -0.2], brow: lerp(0, 0.9, up), lid: lerp(0.6, 0.1, up), pop: 0.9 * up * (1 - seg(T.wake + 1.4, T.wake + 2.2, t)), blink: blinkAt(t), mouth: t > T.roar ? 0.4 : 0 }), 140);
    if (t > T.roar) { o.look = [0.2, -0.8]; o.headTilt = -0.15; }
    return { h: o, cape: { lie: [230, 0] }, gate: 0 };
  }
  // S2 · the gate goes up, the bull walks out and paws the sand; he gets up, shows empty hands
  if (t < T.c2) {
    const gate = seg(T.c1 + 0.05, T.c1 + 1.0, t);
    const w = seg(T.out, T.out + 1.3, t, ease.out);
    const b = { x: lerp(AR.gate, AR.gate + 230, w), y: 0, s: lerp(0.72, BS, w), face: 1, t, gait: w > 0 && w < 1 ? 0.45 : 0, phase: t * 7, paw: w >= 1 ? ((t - T.out - 1.3) * 0.9) % 1 : 0, inGate: w < 0.5 };
    const o = stand(base(t, { look: [0.7, 0], brow: 0.8, pop: 0.6 * bump(seg(T.out, T.out + 0.9, t)) }), 120);
    if (t > T.arms) { const sh = shoulder(o), k = clamp(sp(t, T.arms, 2.4, 7)); o.hands = { near: { p: [sh[0] - 70 * k, sh[1] + 70], shape: 'open', ang: -0.6 }, far: { p: [sh[0] + 40 * k, sh[1] + 66], shape: 'open', ang: -2.4 } }; o.headTilt = 0.12; }
    return { h: o, b, gate, cape: { lie: [230, 0] }, puff: t - T.out - 1.3 };
  }
  // S3 · face to face; «головой»: a finger to his temple, a light bulb
  if (t < T.c3) {
    const o = stand(base(t, { look: [0.7, 0], brow: 0.6 }), 120);
    if (t > T.idea - 0.25) { const H0 = headOf(o), k = clamp(sp(t, T.idea - 0.25, 2.6, 8)); o.hands = { near: { p: [lerp(H0[0] + 60, H0[0] + 34, k), lerp(H0[1] + 160, H0[1] - 24, k)], shape: 'point', ang: -1.2 } }; o.brow = -0.3; o.mouth = 0.2; }
    const b = { x: AR.gate + 230, y: 0, s: BS, face: 1, t, paw: ((t - T.c2) * 0.8) % 1 };
    return { h: o, b, gate: 1, cape: { lie: [230, 0] }, bulb: seg(T.idea, T.idea + 0.25, t), puff: (t - T.c2) % 1.6 };
  }
  // S4 · step 1: he picks up the cape and holds it out to the side; the bull charges the cape and runs past
  if (t < T.c4) {
    const o = stand(base(t, { look: [0.7, 0], brow: 0.7 }), 120);
    const sh = shoulder(o), pick = seg(T.c3 + 0.2, T.c3 + 0.8, t), out = seg(T.wave - 0.2, T.wave + 0.2, t);
    const hand = out > 0 ? [lerp(sh[0] - 60, sh[0] - 170, out), lerp(sh[1] + 40, sh[1] + 10, out)] : [lerp(220, sh[0] - 60, pick), lerp(-20, sh[1] + 40, pick)];
    if (pick < 0.5) o.lean = 0.04 + 0.5 * bump(pick * 1.0);
    o.hands = { near: { p: hand, shape: 'grip' } };
    const r = seg(RUN1.t0(), RUN1.t1(), t, u => u);
    const b = r > 0 ? { x: lerp(RUN1.x0, RUN1.x1, r), y: 60, s: BS, face: 1, t, gait: 1, phase: t * 14, head: r < 0.75 ? 1 : 0.4, front: true }
      : { x: RUN1.x0, y: 0, s: BS, face: 1, t, paw: ((t - T.c3) * 0.9) % 1, head: out };
    const flap = r > 0.25 && r < 0.6 ? 1 : 0.25;
    return { h: o, b, gate: 1, cape: out > 0.3 ? { hand, flap, side: -1 } : pick > 0.3 ? { hand, flap: 0.2, hang: true } : { lie: [230, 0] }, puff: r > 0 ? -1 : (t - T.c3) % 1.6 };
  }
  // S5 · step 2: his back to the end wall; at the last moment he jumps aside and the bull hits the wall
  if (t < T.c5) {
    const j = seg(T.jump, T.jump + 0.32, t), hop = bump(j) * 90;
    const o = stand(base(t, { look: [0.7, 0], brow: 0.8, pop: 0.7 * bump(seg(T.jump - 0.3, T.jump + 0.4, t)) }), lerp(AR.end - 120, AR.end - 440, j), lerp(0, 150, j) - hop);
    o.s = S * lerp(1, 1.1, j);
    if (j > 0 && j < 1) { o.lean = 0.3; o.feet = { near: [o.hip[0] - 30, o.hip[1] + 110], far: [o.hip[0] + 30, o.hip[1] + 100] }; }
    const sh = shoulder(o);
    o.hands = { near: { p: [sh[0] - 50, sh[1] + 60], shape: 'grip' } };
    const r = clamp((t - RUN2.t0()) / (T.hit - RUN2.t0()));
    const hit = t >= T.hit;
    const b = hit ? { x: RUN2.x1, y: 0, s: BS, face: 1, t, head: 0.6, squash: Math.exp(-(t - T.hit) * 6) * Math.cos((t - T.hit) * 30), dizzy: true, lid: 0.3 }
      : { x: lerp(RUN2.x0, RUN2.x1, r * r * 0.4 + r * 0.6), y: 0, s: BS, face: 1, t, gait: r > 0 ? 1 : 0, phase: t * 14, head: r > 0 ? 1 : 0.3, paw: r > 0 ? 0 : ((t - T.c4) * 0.9) % 1 };
    return { h: o, hFront: j > 0.5, b, gate: 1, cape: { hand: [sh[0] - 50, sh[1] + 60], flap: 0.2, side: -1, hang: true }, dizzy: hit, dust: hit ? t - T.hit : -1, puff: hit ? -1 : (t - T.c4) % 1.6 };
  }
  // S6 · step 3: pass after pass with the cape; the bull runs back and forth, slower each time, his tongue out
  if (t < T.c6) {
    const u = (t - T.c5) / (T.c6 - T.c5), tired = seg(0.1, 0.9, u, ease.out);
    const ph = (t - T.c5) * lerp(2.2, 1.0, tired);
    const side = Math.cos(ph * Math.PI) >= 0 ? -1 : 1;
    const o = stand(base(t, { face: side, look: [0.7, 0], brow: 0.5, mouth: 0.15 }), 300);
    const sh = shoulder(o), hand = [sh[0] + side * 160, sh[1] + 10];
    o.hands = { near: { p: hand, shape: 'grip' } };
    const bx = 300 - 620 * Math.cos(ph * Math.PI), dir = Math.sin(ph * Math.PI) >= 0 ? 1 : -1;
    const b = { x: bx, y: 60, s: BS, face: dir, t, gait: lerp(1, 0.45, tired), phase: t * lerp(14, 8, tired), head: lerp(1, 0.3, tired), tired, lid: 0.2, front: true };
    return { h: o, b, gate: 1, cape: { hand, flap: 0.6, side }, sweat: tired };
  }
  // S7 · he lies down; he pats his head; the crowd roars; the wooden sword flies down from the emperor's box; Пурга runs out
  if (t < T.c7) {
    const lie = seg(T.c6, T.c6 + 0.8, t);
    const b = { x: -60, y: 0, s: BS, face: 1, t, lie, tired: 1, lid: 0.5, head: 0.3 };
    const walk = seg(T.c6 + 0.3, T.pat, t);
    const o = stand(base(t, { look: [0.5, 0.2], brow: 0.2, mouth: t > T.cheer ? 0.3 : 0.1 }), lerp(320, 250, walk));
    const sh = shoulder(o);
    if (t > T.pat - 0.3 && t < T.sword) o.hands = { near: { p: [sh[0] - 130, sh[1] + 70 + 10 * Math.sin(t * 9)], shape: 'open', ang: -1.6 } };
    let sword = null;
    if (t >= T.sword) {
      const f = seg(T.sword, T.catch, t, u => u), from = [AR.box, -620], to = [sh[0] + 30, sh[1] - 120];
      if (t < T.catch) sword = { p: [lerp(from[0], to[0], f), lerp(from[1], to[1], f) - 260 * bump(f)], ang: f * TAU * 2.2 };
      else { const k = clamp(sp(t, T.catch, 2.4, 7)); const hp = [sh[0] + 20, lerp(sh[1] + 40, sh[1] - 150, k)]; o.hands = { near: { p: hp, shape: 'grip' } }; sword = { p: [hp[0], hp[1] - 4], ang: -0.15, held: true }; o.mouth = 0.5; o.brow = -0.2; }
    }
    const run = seg(T.cheer + 0.2, T.cheer + 1.6, t);
    const d = run < 1 ? { x: lerp(AR.gate, 520, run), y: 0, s: DS, face: 1, walk: 1, ph: t * 3.2, t, blink: dblink(t), mouth: 0.6, tongue: 0.7 }
      : { x: 530, y: 0, s: DS, face: -1, sit: 0, beg: bump(((t - T.cheer - 1.6) * 1.4) % 1) * 0.8, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 };
    return { h: o, b, d: t > T.cheer + 0.2 ? d : null, gate: 1, sword, emperor: seg(A.L6w8 - 0.3, A.L6w8, t), cheer: t > T.cheer, flowers: t - T.cheer };
  }
  // S8 · «Кого одолеть следующим?»: the gate shut again with a shadow and a question mark behind the bars
  const o = stand(base(t, { look: [0.6, 0], brow: 0.3, mouth: 0.35 }), -40);
  const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7));
  o.hands = { near: { p: [sh[0] - 50, sh[1] + 90], shape: 'grip' }, far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } };
  return { h: o, sword: { p: [sh[0] - 50, sh[1] + 86], ang: -0.35, held: true }, d: { x: 230, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), mouth: 0.6, tongue: 0.8, wag: 1, wagPh: t * 3 }, gate: 1 - seg(T.c7, T.c7 + 0.6, t), next: true };
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
      const exc = a.cheer || (t > T.roar && t < T.c1 + 0.8) ? 1 : 0.15 + 0.15 * (t > T.c4 && t < T.c6 ? 1 : 0);
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

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (scene(t) === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  arena(t, a, cam);
  // the bull still in the gate is drawn inside the arch, behind the bars
  const bullIn = a.b && a.b.inGate;
  if (bullIn) inside(a.archPath, () => drawBull(a.b));
  gateBars(t, a);
  let br = null;
  const drawB = () => { if (a.b && !bullIn) br = drawBull(a.b); };
  const drawH = () => { if (a.h) { hunterDraw(t, a.h); if (a.cape) capeAt(t, a.cape); swordAt(a.sword); } };
  if (a.hFront) { drawB(); drawH(); }
  else if (a.b?.front) { drawH(); drawB(); }
  else { drawB(); drawH(); }
  if (!a.h && a.cape) capeAt(t, a.cape);
  if (a.d) drawDog(a.d);
  if (br && a.puff !== undefined) steam(br.nose, a.b.face, BS, (a.puff % 1.6) / 0.9);
  if (br && a.dizzy) stars(br.head, BS, t, clamp((t - T.hit) * 4));
  if (a.dust >= 0) dust([AR.end - 20, -60], a.dust * 1.4);
  if (br && a.sweat > 0.2) for (let i = 0; i < 3; i++) { const u = ((t * 1.6 + i / 3) % 1); ell(br.head[0] - 40 + i * 30, br.head[1] - 60 + 60 * u, 7, 11, '#8fd3ff', 0, (1 - u) * a.sweat); }
  if (a.bulb > 0 && a.h) { const H0 = headOf(a.h); bulb(H0[0], H0[1] - 170, a.bulb, t); }
  flowers(t, a.cheer ? a.flowers : -1, cam);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.7);
}
function bulb(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  for (let i = 0; i < 8; i++) { const an = i * TAU / 8; limb([[Math.cos(an) * 70, Math.sin(an) * 70], [Math.cos(an) * 96, Math.sin(an) * 96]], 8, '#ffd23f', false); }
  ell(0, 0, 50, 54, '#ffe066'); rrect(-22, 44, 44, 30, 6, '#9aa3ad'); limb([[-20, 56], [20, 56]], 4, '#6b737d', false);
  g.restore();
}

// —— everything over the picture ——
function bar(t, cam) {
  if (t < T.c3 + 0.2 || t > T.c6 + 1.2) return;
  const k = clamp(sp(t, T.c3 + 0.2, 2.4, 8)) * (1 - seg(T.c6 + 0.8, T.c6 + 1.2, t)), v = strength(t);
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 140, y = 500, w = 800, h = 44;
  rrect(x - 10, y - 64, w + 20, h + 84, 18, 'rgba(11,15,26,0.85)');
  Hd.label('СИЛЫ БЫКА', x + 6, y - 18, 34, '#ffffff', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  Hd.label(Math.round(v * 100) + '%', x + w - 4, y - 18, 34, v < 0.3 ? OK : '#ffffff', { fam: FONTS.mono, align: 'right', shadow: false, stroke: false });
  rrect(x, y, w, h, 12, '#2a2f3d');
  rrect(x, y, Math.max(24, w * v), h, 12, v > 0.5 ? DANGER : v > 0.2 ? WARM : OK);
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.reveal + 0.2, T.c2 - 0.1, 'РИМ — 80 ГОД', { color: GOLD });
  if (t >= T.roar && t < T.c1) Hd.plaque(t, T.roar + 0.1, T.c1 - 0.05, 540, 330, { icon: 'comment', title: 'ТЫСЯЧИ ЗРИТЕЛЕЙ', sub: 'и все смотрят на тебя', color: WARM });
  if (t >= T.arms && t < T.c2) Hd.plaque(t, T.arms + 0.05, T.c2 - 0.05, 540, 330, { icon: 'x', title: 'ОРУЖИЯ НЕТ', sub: 'только плащ на песке', color: DANGER, to: S2([230, -10]) });
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, A.L2w0 + 0.05, T.idea - 0.15, 540, 330, { icon: 'x', title: 'СИЛОЙ НЕ ВЗЯТЬ', sub: 'он тяжелее тебя в разы', color: DANGER });
  Hd.ribbon(t, T.idea, T.c3 - 0.1, 'ГОЛОВОЙ!', { y: 330, size: 110, rot: -0.08 });
  // step 1
  Hd.stepHeader(t, 1, 'ПЛАЩ В СТОРОНУ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, A.L3w8 - 0.1, T.wave + 0.9, 540, 640, { icon: 'check', title: 'НЕ ЦВЕТ, А ДВИЖЕНИЕ', sub: 'красный он видит плохо', color: GOLD });
  // step 2
  Hd.stepHeader(t, 2, 'В ПОСЛЕДНИЙ МИГ', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.c4 && t < T.c5) Hd.plaque(t, A.L4w1 - 0.05, T.jump - 0.1, 540, 640, { icon: 'x', title: 'ПЛОХО ВИДИТ', sub: 'расстояние до стены', color: WARM });
  if (t >= T.hit && t < T.c5) Hd.plaque(t, T.hit + 0.15, T.c5 - 0.02, 540, 640, { icon: 'check', title: 'БУМ!', sub: 'бык в стене, ты цел', color: OK, size: 56 });
  // step 3
  Hd.stepHeader(t, 3, 'ИЗМОТАЙ', A.L5 + 0.02, A.L5e - 0.05);
  bar(t, cam);
  // the twist
  if (t >= A.L6w13 - 0.1 && t < T.c7) Hd.plaque(t, A.L6w13 - 0.1, T.c7 - 0.02, 540, 330, { icon: 'check', title: 'ДЕРЕВЯННЫЙ МЕЧ', sub: 'в Риме — знак свободы', color: GOLD });
  // the end
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) {
    Hd.plaque(t, A.L7w3 - 0.1, DUR + 1, 540, 650, { icon: 'comment', title: 'КОГО СЛЕДУЮЩИМ?', sub: 'пиши в комментариях', color: GOLD, size: 48 });
    const opts = ['ЛЕВ?', 'МЕДВЕДЬ?', 'НОСОРОГ?'];
    opts.forEach((s, i) => {
      const t0 = A.L7w1 + i * 0.25, k = clamp(sp(t, t0, 2.6, 8));
      if (k <= 0.01) return;
      const x = 200 + i * 340, y = 820, w = measure(s, 44, FONTS.cond) + 48;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.04 + 0.04 * i);
      rrect(-w / 2 + 6, -36 + 6, w, 72, 16, INK); rrect(-w / 2, -36, w, 72, 16, '#fff3d6');
      text(s, 0, 16, 44, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
}

// —— the poster: the bull charging the red cape, the crowd, the title ——
function coverFrame(t) {
  const cam = { x: 40, y: -360, z: 1.3, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#9fd6f2'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const a = { gate: 1, cheer: true };
  arena(2.0, a, cam);
  gateBars(2.0, a);
  const o = stand(base(1, { look: [0.8, 0], brow: 1, pop: 1, mouth: 0.4, blink: 0 }), 260);
  const sh = shoulder(o), hand = [sh[0] - 170, sh[1] + 10];
  o.hands = { near: { p: hand, shape: 'grip' } };
  hunterDraw(1, o); capeAt(1.0, { hand, flap: 1, side: -1 });
  const br = drawBull({ x: -170, y: 60, s: BS, face: 1, t: 1, gait: 1, phase: 1.2, head: 1 });
  steam(br.nose, 1, BS, 0.5);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(11,15,26,0.25)'; g.fillRect(0, 0, W, 520);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.save(); g.shadowColor = 'rgba(255,59,48,0.8)'; g.shadowBlur = 40; Hd.label('БЫК', 0, 230, 200, '#ff3b30', { align: 'right', shadow: false, strokeW: 14 }); g.restore();
  g.rotate(0.06);
  const pl = 'АРЕНА · БИТВА 1', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw + 8, 290 + 8, pw, 84, INK); rect(-pw, 290, pw, 84, '#ffd43b'); text(pl, -pw / 2, 348, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, b, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
    if (b) out.push(toScreen(cam, [b.x, (b.y ?? 0) - 200 * BS]));
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
  add(T.wake, 'stamp', -10, 0);
  add(T.reveal, 'whoosh_in', -12, 0);
  add(T.roar, 'crowd_roar', -8, 0, { dur: T.c1 - T.roar + 0.6 });
  add(T.c1 + 0.05, 'gate_chain', -8, -0.5, { dur: 1.0 });
  add(T.out, 'hooves', -12, -0.5, { dur: 1.3, rate: 3.0 });
  add(T.out + 1.4, 'snort', -8, -0.4);
  add(T.arms, 'stamp', -10, 0);
  add(A.L2w0, 'stamp', -12, 0);
  add(T.idea, 'ding', -10, 0); add(T.idea, 'ribbon', -8, 0);
  add(T.c3 + 0.4, 'cloth', -12, 0.2);
  add(T.wave, 'cloth', -10, 0.1);
  add(RUN1.t0(), 'hooves', -6, -0.4, { dur: RUN1.t1() - RUN1.t0(), rate: 7.0, pan1: 0.6 });
  add(RUN1.t0() + (RUN1.t1() - RUN1.t0()) * 0.45, 'whoosh', -6, 0.1);
  add(RUN1.t0() + 0.6, 'crowd_roar', -12, 0, { dur: 1.4 });
  add(A.L4w1 - 0.05, 'blip', -12, 0);
  add(RUN2.t0(), 'hooves', -6, -0.2, { dur: T.hit - RUN2.t0(), rate: 7.5, pan1: 0.5 });
  add(T.jump, 'whoosh', -8, 0.3);
  add(T.hit, 'wall_hit', -2, 0.5);
  add(T.hit + 0.15, 'crowd_roar', -6, 0, { dur: 1.8 });
  add(T.hit + 0.35, 'tweet', -14, 0.5, { dur: 1.2 });
  add(T.c5, 'hooves', -12, 0, { dur: T.c6 - T.c5, rate: 5.0, slow: 0.5 });
  for (let i = 0; i < 4; i++) add(T.c5 + 0.3 + i * (T.c6 - T.c5 - 0.4) / 4, 'cloth', -14, i % 2 ? 0.3 : -0.3);
  add(T.c6 + 0.4, 'thud', -8, 0);
  add(T.c6 + 0.6, 'snort', -14, -0.1);
  add(T.cheer, 'crowd_roar', -4, 0, { dur: T.c7 - T.cheer + 1.0 });
  add(T.sword, 'whoosh', -10, 0.3);
  add(T.catch, 'wood_clack', -8, 0.1);
  add(T.cheer + 0.3, 'bark', -10, -0.3);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L6w13 - 0.1, 'ding', -12, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  for (let i = 0; i < 3; i++) add(A.L7w1 + i * 0.25, 'pop_word', -10, -0.4 + i * 0.4);
  add(A.L7w3 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
