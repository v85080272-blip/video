// «Давка в толпе, ты внутри» (2D «ты»-ролик, the channel's narrator): the whole short as pure functions of time t. The
// owner, 21.11: «выходные — самое лучшее потребление нашего контента». On the formula of «Облако хлора». After the match
// the crowd carries you and squeezes from all sides: not back against the stream → arms bent at the elbows, a little
// apart, so the chest is not squeezed → with the crowd, edging to the side → fell? up at once → the secret: tuck the
// scarf and the long-strap bag away, they can catch → «Пиши!». Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Hd from './hud.js';
import * as Sm from './smoke.js';
import * as Cr from './crowd.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{ let t = 0.12; for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.38, n]; t += n * 0.38; } }
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]) + 20; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ТОЛПА: DANGER, СДАВИЛА: DANGER, НАЗАД: DANGER, НЕЛЬЗЯ: DANGER, ПОТОКА: DANGER, РУКИ: OK, ЛОКТЯХ: OK,
  РАЗВЕДИ: OK, ГРУДЬ: OK, ВМЕСТЕ: OK, КРАЮ: OK, УПАЛ: DANGER, ВСТАВАЙ: OK, БЫСТРЕЕ: OK, СЕКРЕТ: GOLD, ШАРФ: GOLD, СУМКУ: GOLD,
  РЕМНЕ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.05,
  squeeze: A.L0w7,                   // «и сдавила»
  c1: A.L1 - 0.06,                   // «пробиваться назад… Нельзя»
  nope: A.L1w5,
  c2: A.L2 - 0.06,                   // step 1: the arms
  arms: A.L2w1,
  c3: A.L3 - 0.06,                   // step 2: with the crowd, to the edge (the map)
  c4: A.L4 - 0.06,                   // step 3: fell — up at once
  fall: A.L4w1,
  up: A.L4w2,
  c5: A.L5 - 0.06,                   // the secret: the scarf and the bag
  tuck: A.L5w3,
  c6: A.L6 - 0.06,
  sub: A.L6w8,
};
export const CUTS = [T.cover, T.c1, T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A, ring: 0.3, peep: T.squeeze, two: T.nope - 0.5, c2: T.c2 - 0.3, c3: T.c2, c4: T.c3, c5: T.c4, dial: T.arms, c6: T.c5, growl: T.tuck, c7: T.c6, end: T.c6 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const HX = 0;                                                                 // where you are in the middle row

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
shot(T.cover, [[T.cover, 0, -260, 1.3], [T.squeeze, 0, -280, 1.5], [T.c1, 0, -280, 1.55]]);
shot(T.c1, [[T.c1, -120, -230, 1.15], [T.c2, -120, -230, 1.2]]);
shot(T.c2, [[T.c2, 0, -260, 1.6], [T.c3, 0, -260, 1.65]]);
shot(T.c3, [[T.c3, 0, -200, 0.9], [T.c4, 0, -200, 0.92]]);
shot(T.c4, [[T.c4, 0, -150, 1.25], [T.c5, 0, -170, 1.25]]);
shot(T.c5, [[T.c5, 0, -280, 1.7], [T.c6, 0, -280, 1.75]]);
shot(T.c6, [[T.c6, 0, -220, 1.1], [DUR, 0, -220, 1.14]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.squeeze, 6], [T.nope, 6], [T.fall, 8]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: true, boots: true, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);


// you, in the middle row: squeezed, the arms, the fall and up, the scarf
function you(t) {
  const sway = 10 * Math.sin(t * 2.4);
  const o = stand(base(t, { look: [0.6, 0], brow: 0.5 }), HX + sway);
  const sh = shoulder(o);
  if (t < T.c1) { o.brow = t > T.squeeze ? 0.9 : 0.4; o.pop = t > T.squeeze ? 0.5 : 0; o.mouth = t > T.squeeze ? 0.4 : 0; }
  else if (t < T.c2) { const r = seg(A.L1w3 - 0.3, A.L1w3, t) * (1 - seg(T.nope, T.nope + 0.3, t)); o.face = r > 0.3 ? -1 : 1; o.look = [o.face * 0.7, 0]; if (t > T.nope) { o.brow = 1; o.face = 1; } }
  else if (t < T.c4 || t >= T.c5) {
    const k = t < T.c4 ? seg(T.arms - 0.2, T.arms + 0.4, t) : 1;            // arms bent at the elbows, a little apart, at the chest
    o.hands = { near: { p: [lerp(sh[0] + 30, sh[0] + 70, k), lerp(sh[1] + 90, sh[1] + 30, k)], shape: 'fist' }, far: { p: [lerp(sh[0] - 10, sh[0] - 50, k), lerp(sh[1] + 90, sh[1] + 34, k)], shape: 'fist' } };
    o.brow = 0.5;
  } else {                                                                     // fell — and up at once
    const down = seg(T.fall - 0.1, T.fall + 0.2, t) * (1 - seg(T.up, T.up + 0.6, t));
    o.hip = [o.hip[0], o.hip[1] + 110 * down]; o.feet = { near: [o.hip[0] - 50 * down - 12, 0], far: [o.hip[0] + 60 * down + 16, 0] }; o.lean = 0.5 * down;
    const s2 = shoulder(o); o.hands = { near: { p: [s2[0] + 60, lerp(s2[1] + 90, -20, down)], shape: 'open' } }; o.brow = 0.8;
  }
  return o;
}
function scarfAndBag(t, o) {                                                    // drawn over you until tucked away
  const k = t < T.c5 ? 1 : 1 - seg(T.tuck, T.tuck + 0.8, t);
  if (k <= 0.01) return;
  const F = framesOf(o), neck = F.T.p([-14, -200]), hip = F.T.p([10, -20]);
  g.save(); g.globalAlpha = k;
  limb([[neck[0] - 26, neck[1]], [neck[0] + 26, neck[1] + 4]], 22, '#c62828'); limb([[neck[0] + 10, neck[1] + 6], [neck[0] + 30 + 8 * Math.sin(t * 3), neck[1] + 110]], 18, '#c62828');
  limb([[neck[0] - 30, neck[1] + 10], [hip[0] + 60, hip[1] + 40]], 6, '#5b3a22', false); rrect(hip[0] + 40, hip[1] + 30, 70, 56, 10, '#7a4a2a');
  g.restore();
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (t < T.cover) { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1d2847'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const o = you(t), speed = 40;
  Cr.street(t);
  Cr.row(t, -60, 0.78, -1600, 1600, 1, speed);
  Cr.row(t, 0, 0.9, -1600, 1600, 2, speed, [HX, 120]);
  drawHunter(o); scarfAndBag(t, o);
  Cr.row(t, 90, 1.08, -1600, 1600, 3, speed, [HX, t >= T.c4 && t < T.c5 ? 240 : 140]);
  if (t < T.c2) Cr.squeeze(t, HX, -230, t < T.c1 ? seg(T.squeeze - 0.2, T.squeeze + 0.3, t) : 1 - seg(T.c2 - 0.3, T.c2, t));
  overlays(t, cam, o);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}

// —— everything over the picture ——
function overlays(t, cam, o) {
  const S2 = p => toScreen(cam, p);
  const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
  scr();
  if (t < A.L1 + 0.1) questionTitle(t);
  // «пробиваться назад… Нельзя»
  if (t >= T.c1 && t < T.c2) {
    const k = seg(A.L1w3 - 0.2, A.L1w3 + 0.2, t), p0 = S2([HX - 60, -260]), p1 = S2([HX - 500, -260]);
    if (k > 0.01) { g.save(); g.globalAlpha = k; g.lineWidth = 16; g.strokeStyle = '#ff5a4a'; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(lerp(p0[0], p1[0], k), p1[1]); g.stroke(); poly([[lerp(p0[0], p1[0], k) - 30, p1[1]], [lerp(p0[0], p1[0], k) + 10, p1[1] - 30], [lerp(p0[0], p1[0], k) + 10, p1[1] + 30]], '#ff5a4a'); g.restore(); }
    Hd.redX((p0[0] + p1[0]) / 2, p0[1], 90, sp(t, T.nope + 0.02, 2.6, 8) * (1 - seg(T.c2 - 0.25, T.c2, t)));
  }
  Hd.plaque(t, A.L1w6 - 0.05, T.c2 - 0.1, 540, 330, { icon: 'x', title: 'ПРОТИВ ПОТОКА НЕ ПРОЙТИ', color: DANGER, size: 44 });
  // step 1
  Hd.stepHeader(t, 1, 'РУКИ ПЕРЕД ГРУДЬЮ', A.L2 + 0.02, A.L2e - 0.05);
  Hd.plaque(t, A.L2w8 - 0.05, T.c3 - 0.1, 540, 470, { icon: 'check', title: 'ЛОКТИ ЧУТЬ В СТОРОНЫ', sub: 'чтобы не сдавило грудь', color: OK, size: 44 });
  // step 2: the map card
  Hd.stepHeader(t, 2, 'С ТОЛПОЙ — К КРАЮ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4) Cr.mapCard(t, 540, 720, clamp(sp(t, T.c3 + 0.05, 2.4, 8)) * (1 - seg(T.c4 - 0.25, T.c4 - 0.02, t)), seg(A.L3w6, A.L3e + 0.2, t, x => x), seg(A.L3w1 - 0.1, A.L3w1 + 0.2, t));
  // step 3
  Hd.stepHeader(t, 3, 'УПАЛ — СРАЗУ ВСТАВАЙ', A.L4 + 0.02, A.L4e - 0.05);
  // the secret
  Hd.plaque(t, A.L5 + 0.02, T.c6 - 0.1, 540, 200, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  Hd.plaque(t, T.tuck - 0.05, T.c6 - 0.1, 540, 330, { icon: 'x', title: 'ШАРФ И ДЛИННЫЙ РЕМЕНЬ — СПРЯЧЬ', color: DANGER, size: 40 });
  // the end
  Hd.plaque(t, A.L6 + 0.02, DUR + 1, 540, 700, { icon: 'comment', title: 'БЫЛ В ТАКОЙ ДАВКЕ?', sub: 'пиши в комментариях', color: GOLD, size: 44 });
  Hd.endCard(t, T.sub - 0.05, 0, 300);
}
// the hook: «ЧТО ДЕЛАТЬ,» from the first frame, then the question word by word
function questionTitle(t) {
  const k1 = sp(t, 0.02, 2.6, 7), k2 = sp(t, A.L0w2 - 0.05, 2.4, 7), k3 = sp(t, A.L0w6 - 0.05, 2.4, 7);
  const out = seg(A.L1 - 0.15, A.L1 + 0.1, t);
  if (k1 > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 540, 300); g.scale(k1 * (1 - out), k1 * (1 - out)); g.rotate(-0.03); text('ЧТО ДЕЛАТЬ,', 0, 0, 120, '#fff3d6'); g.restore(); }
  const plq = (y, str, k, size, c = '#ffd23f') => {
    if (k <= 0.01) return;
    const w = measure(str, size, FONTS.cond) + 70, h = size * 1.45;
    g.save(); g.setTransform(1, 0, 0, 1, 540, y); g.rotate(-0.03); g.scale(k * (1 - out), k * (1 - out));
    rect(-w / 2 + 10, -h / 2 + 12, w, h, INK); rect(-w / 2, -h / 2, w, h, c);
    text(str, 0, size * 0.36, size, INK, { fam: FONTS.cond, shadow: false });
    g.restore();
  };
  plq(440, 'ЕСЛИ ТОЛПА ПОНЕСЛА', k2, 80, '#ffd23f');
  plq(560, 'И СДАВИЛА СО ВСЕХ СТОРОН?', k3, 66, '#ff8a3d');
}
function speech(t, t0, t1, x, y, str) {
  if (t < t0 || t > t1 + 0.2) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - clamp((t - t1) / 0.2));
  if (k <= 0.01) return;
  const size = 40, w = measure(str, size, FONTS.cond) + 60, h = 90;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(clamp(x, w / 2 + 20, W - w / 2 - 20), y); g.scale(k, k); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 20; g.shadowOffsetY = 6; rrect(-w / 2, -h / 2, w, h, 24, '#fff8e6'); poly([[-w / 2 + 50, h / 2 - 2], [-w / 2 + 90, h / 2 - 2], [-w / 2 + 30, h / 2 + 34]], '#fff8e6'); g.restore();
  text(str, 0, 14, size, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function fitText(str, x, y, size, maxW, color, o = {}) { const w = measure(str, size, o.fam); text(str, x, y, size * Math.min(1, maxW / w), color, o); }
// —— the cover: you squeezed in the crowd; the question and the ban ——
function coverFrame(t) {
  const cam = { x: 0, y: -290, z: 1.6, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1d2847'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Cr.street(3); Cr.row(3, -60, 0.78, -1600, 1600, 1); Cr.row(3, 0, 0.9, -1600, 1600, 2, 40, [HX, 120]);
  const o = stand(base(3, { look: [0.6, -0.2], brow: 1, pop: 1, mouth: 0.6, jacket: true, boots: true }), HX); drawHunter(o);
  Cr.row(3, 90, 1.08, -1600, 1600, 3, 40, [HX, 140]); Cr.squeeze(3.2, HX, -230, 1);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  g.save(); g.translate(540, 200); g.rotate(-0.03); rect(-170 + 6, -34 + 7, 340, 68, INK); rect(-170, -34, 340, 68, '#ff4d4d'); g.restore();
  text('КАК ВЫЖИТЬ', 540, 218, 50, '#fff3d6', { fam: FONTS.cond, shadow: false, rot: -0.03 });
  fitText('ТОЛПА СДАВИЛА?', 540, 380, 130, 980, '#ffd23f', { rot: -0.03 });
  fitText('НЕ ИДИ ПРОТИВ!', 540, 530, 120, 960, '#ff5a4a', { rot: -0.03 });
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), o = null, d = null, out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
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
  add(0.05, 'crowd_steps', -14, 0, { dur: DUR - 0.2 }); add(0.05, 'city', -22, 0, { dur: DUR - 0.2 });
  add(T.squeeze, 'stamp', -10, 0);
  add(T.c1, 'whoosh', -12, 0); add(T.nope, 'stamp', -8, 0);
  add(T.c2, 'whoosh_in', -14, 0);
  add(T.c3, 'paper', -10, 0, { dur: 0.4 });
  add(T.c4, 'whoosh', -12, 0); add(T.fall + 0.1, 'puff', -8, 0); add(T.up, 'whoosh_in', -12, 0);
  add(T.c5, 'whoosh_in', -14, 0); add(T.tuck, 'paper', -14, 0.1, { dur: 0.3 });
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L5 + 0.04, 'pop_word', -6, 0);
  add(T.c6, 'blip', -8, 0);
  add(T.sub, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
