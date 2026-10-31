// «Заранее» (блэкаут, ч.8, финал сезона): the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// It goes on from part 7: the power is back, but the lamp flickers once, and the season ends with the kit to keep at home.
// New here: the search in the dark for a torch that isn't there, the shelf where the kit lives, the crate filling item by
// item with a checklist beside it, the water sum, the dead cash machine, and the dog bringing her own bowl and leash.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, mix, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { view, toScreen } from './camera.js';
import * as Ap from './apt.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
// without build/words.json: [start, end, words] of each line (tools/fake_words.mjs on voice/script.json), words spread evenly
const FB = { L0: [0.12, 5.67, 14], L1: [6.08, 11.58, 17], L2: [11.98, 15.24, 12], L3: [15.7, 21.4, 15], L4: [21.8, 27.0, 10], L5: [27.39, 33.37, 13], L6: [33.81, 38.7, 15], L7: [39.15, 43.24, 13] };
export const DUR = VOICE?.dur ?? 43.59;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm, ICE = '#8fd3ff';
const HOT = { ПОВТОРИТЬСЯ: DANGER, ЗАРАНЕЕ: GOLD, ТЕМНОТЕ: DANGER, ФОНАРИК: GOLD, ТРИ: GOLD, ОДНОМ: GOLD, ВОДА: ICE,
  ЧЕТЫРЁХ: GOLD, ЛИТРОВ: GOLD, РАДИО: GOLD, ПАУЭРБАНК: GOLD, АПТЕЧКА: GOLD, ЛЕКАРСТВА: GOLD, НАЛИЧНЫХ: GOLD,
  БАНКОМАТЫ: DANGER, МИСКУ: WARM, ПОВОДОК: WARM, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,                        // the poster
  flick: A.L0w8 - 0.06,              // «может повториться»: the lamp flickers once
  c1: A.L1 - 0.06,                   // «Многие думают…»: the dark, the search
  dark: A.L1w7 - 0.06,               // «А потом в темноте»
  c2: A.L2 - 0.06,                   // «Собери запас…»: the shelf, the crate
  c3: A.L3 - 0.06,                   // step 1: water and food
  c4: A.L4 - 0.06,                   // step 2: light, radio, power
  c5: A.L5 - 0.06,                   // step 3: first aid, papers, cash
  atm: A.L5w8 - 0.06,                // «без света банкоматы не работают»
  c6: A.L6 - 0.06,                   // the dog brings her bowl and leash
  dog: A.L6w5 - 0.06,
  c7: A.L7 - 0.06,                   // «Подписывайся…»
};
// what goes into the crate, and when: [label, word time, kind]
const ITEMS = [
  ['вода', A.L3w1 - 0.06, 'water'], ['еда', A.L3w10 - 0.06, 'tin'],
  ['фонарик', A.L4w1 - 0.06, 'torch'], ['радио', A.L4w2 - 0.06, 'radio'], ['батарейки', A.L4w6 - 0.06, 'batt'], ['пауэрбанк', A.L4w9 - 0.06, 'bank'],
  ['аптечка', A.L5w1 - 0.06, 'aid'], ['лекарства', A.L5w2 - 0.06, 'pills'], ['документы', A.L5w4 - 0.06, 'docs'], ['наличные', A.L5w7 - 0.06, 'cash'],
];
export const CUTS = [T.cover, T.c1, T.c2, T.c6, T.c7];
export const SNAPS = [T.dark];
export const MARKS = { ...T, A, ITEMS: ITEMS.map(i => i[1]) };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : 'flat');
const isDark = t => t >= T.dark && t < T.c2;

// —— the camera: per shot, Hermite keys [t, x, y, z] ——
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
const CRATE = [-40, 0];                                       // the crate on the floor, its mouth at y = -170
shot(T.cover, [[T.cover, 120, -330, 1.2], [T.flick, 120, -340, 1.26], [T.c1, 130, -340, 1.3]]);
shot(T.c1, [[T.c1, -40, -300, 1.4], [T.c2, -60, -300, 1.48]]);
shot(T.c2, [[T.c2, -60, -200, 1.25], [T.c3, -60, -160, 1.4], [T.c6, -40, -150, 1.46]]);
shot(T.c6, [[T.c6, -120, -170, 1.35], [T.c7, -110, -175, 1.42]]);
shot(T.c7, [[T.c7, -40, -280, 1.25], [DUR, -30, -285, 1.3]]);
export function camAt(t) {
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.flick, 5], [T.dark, 7]]) if (t >= t0 && t < t0 + 0.5) { const e = Math.exp(-(t - t0) * 8); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the hunter and the dog ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0, jacket: false, boots: false, pack: false, hat: false, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);

export function actorsAt(t) {
  // —— the hook and the dark: at the counter, then groping in the dark, the phone's light ——
  if (t < T.c2) {
    const o = stand(base(t, { look: [0.6, -0.4], brow: 0.3 }), 120);
    if (t > T.flick && t < T.c1) { o.look = [0.1, -0.9]; o.brow = 0.8; o.pop = 0.4 * (1 - seg(T.flick + 0.6, T.flick + 1.1, t)); }
    if (t >= T.c1) {
      o.face = -1; o.look = [-0.7, 0.5]; o.brow = 0.6; o.lean = 0.16;
      const sh = shoulder(o), sw = Math.sin(t * 5);
      o.hands = { near: { p: [sh[0] - 70 + 30 * sw, sh[1] + 40], shape: 'open' }, far: { p: [sh[0] - 30, sh[1] + 70], shape: 'grip' } };
      if (t > T.dark) o.prop = { kind: 'phone', p: [sh[0] - 30, sh[1] + 50] };
    }
    const d = { x: 360, y: 0, s: DS, face: -1, sit: 1, look: 0.3, t, blink: dblink(t), ears: t > T.flick ? 1 : 0.5 };
    return { h: o, d };
  }
  // —— packing the crate: he drops each thing in; the dog watches ——
  if (t < T.c6) {
    const o = stand(base(t, { look: [-0.5, 0.6], brow: 0.2, face: -1, lean: 0.12 }), 160);
    const sh = shoulder(o), drop = Math.max(0, ...ITEMS.map(([, t0]) => bump(seg(t0 - 0.2, t0 + 0.3, t, u => u))));
    o.hands = { near: { p: [lerp(sh[0] - 40, CRATE[0] + 80, drop), lerp(sh[1] + 90, -200, drop)], shape: drop > 0.4 ? 'grip' : 'open' } };
    const d = { x: 380, y: 0, s: DS, face: -1, sit: 1, look: 0.2, t, blink: dblink(t), tilt: 0.1 * Math.sin(t * 0.8) };
    return { h: o, d };
  }
  // —— the dog walks in with her bowl and leash; he laughs; the end ——
  const o = stand(base(t, { look: [-0.6, 0.4], brow: 0.5, face: -1 }), 160);
  if (t > T.dog) { o.mouth = 0.5; o.brow = 0.7; o.lid = 0.1; }
  if (t > T.c7) { o.face = 1; o.look = [0.8, 0]; o.mouth = 0.35; const sh = shoulder(o), k = clamp(sp(t, A.L7 + 0.05, 2.4, 7)); o.hands = { near: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
  const w = seg(T.c6 + 0.1, T.dog + 0.2, t);
  const d = { x: lerp(-620, -240, w), y: 0, s: DS, face: 1, sit: w >= 1 ? 1 : 0, walk: w > 0 && w < 1 ? 1 : 0, ph: t * 1.6, look: 0.1, t, blink: dblink(t), wag: 1, wagPh: t * 3.4, carry: t < T.c7 };
  return { h: o, d };
}
function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.3); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#9fd8ff'); g.restore(); };
  return drawHunter(o);
}

// —— the props ——
const STOVE = { x0: 470, x1: 770, top: -226 };
function stove() {
  const { x0, x1, top } = STOVE;
  rrect(x0, top, x1 - x0, -top, 10, '#eef0f2'); rect(x0, top, x1 - x0, 18, '#c9d0d6');
  rrect(x0 + 30, top + 70, x1 - x0 - 60, -top - 100, 10, '#3a3f4a'); rrect(x0 + 50, top + 90, x1 - x0 - 100, -top - 150, 8, '#252a33');
  for (let i = 0; i < 4; i++) { const k = [x0 + 60 + i * 56, top + 40]; ell(k[0], k[1], 13, 13, '#2c3140'); }
  for (const bx of [x0 + 80, x0 + 220]) { ell(bx, top - 4, 46, 8, '#2c3140'); ell(bx, top - 8, 22, 5, '#555c6a'); }
}
function radiator() { for (let i = 0; i < 5; i++) rrect(350 + i * 22, -230, 18, 190, 8, '#f2ede4'); rect(350, -210, 112, 10, '#c9c4b8'); rect(350, -70, 112, 10, '#c9c4b8'); }
// the open crate on the floor with its stencilled label
function crate() {
  const [x, y] = CRATE;
  rect(x - 130, y - 170, 260, 170, '#a8794a'); rect(x - 130, y - 170, 260, 18, '#8a5f36');
  for (let i = 0; i < 3; i++) rect(x - 130, y - 130 + i * 44, 260, 6, '#8a5f36');
  rrect(x - 90, y - 110, 180, 56, 6, '#f6f2e7'); text('НА 3 ДНЯ', x, y - 70, 36, '#17162f', { fam: FONTS.cond, shadow: false });
}
// one thing, drawn at (0, 0) at scale s
function thing(kind, s = 1) {
  g.save(); g.scale(s, s);
  if (kind === 'water') { for (let i = -1; i <= 1; i++) { rrect(i * 34 - 14, -70, 28, 70, 8, 'rgba(160,215,255,0.9)'); rect(i * 34 - 8, -84, 16, 16, '#3c7ad6'); } }
  else if (kind === 'tin') { for (let i = -1; i <= 1; i += 2) { rrect(i * 26 - 22, -56, 44, 56, 6, '#b9c2cc'); rect(i * 26 - 22, -42, 44, 24, '#d9433b'); } }
  else if (kind === 'torch') { limb([[-50, 0], [30, 0]], 30, '#2b3346', false); ell(44, 0, 12, 20, '#ffe7a8'); }
  else if (kind === 'radio') { rrect(-56, -60, 112, 60, 10, '#c0533a'); rrect(-48, -52, 54, 44, 6, '#3a2a24'); limb([[30, -60], [60, -120]], 4, '#9aa3b2', false); }
  else if (kind === 'batt') { for (let i = 0; i < 4; i++) { rrect(-46 + i * 24, -60, 18, 60, 4, '#2c3140'); rect(-46 + i * 24, -60, 18, 16, '#ffd23f'); } }
  else if (kind === 'bank') { rrect(-40, -70, 80, 70, 10, '#3a3f4a'); for (let i = 0; i < 4; i++) ell(-24 + i * 16, -16, 5, 5, '#3ddc84'); }
  else if (kind === 'aid') { rrect(-56, -60, 112, 60, 10, '#ffffff'); rect(-8, -52, 16, 44, '#e53935'); rect(-22, -38, 44, 16, '#e53935'); }
  else if (kind === 'pills') { rrect(-26, -64, 52, 64, 8, '#f2a33a'); rect(-26, -50, 52, 20, '#ffffff'); }
  else if (kind === 'docs') { rrect(-56, -70, 112, 70, 6, '#3c7ad6'); rect(-44, -58, 60, 8, '#ffffff'); rect(-44, -42, 40, 8, '#ffffff'); }
  else { rrect(-56, -40, 112, 40, 4, '#7fb069'); ell(0, -20, 14, 14, '#5d8a4a'); }
  g.restore();
}

// —— frame ——
export function init() { Hd.initHud(); }
export function frame(t) {
  if (scene(t) === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t);
  flatFrame(t, cam);
  overlays(t, cam);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 1);
}

function flatFrame(t, cam) {
  const { h, d } = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  const flick = t > T.flick && t < T.flick + 0.6 ? (noise(t * 30, 4) > 0.2 ? 1 : 0) : 1;
  Ap.drawShell(t, { power: true, lampOn: flick > 0 && !isDark(t) });
  Ap.drawWindow(t, { day: 1 });
  Ap.drawTub(t, { level: 0.8, run: 0 });
  Ap.drawToilet(t, {});
  Ap.drawFridge(t);
  Ap.drawCounter(t, { fills: isDark(t) ? [0, 0, 0, 0, 1] : [1, 1, 1, 0.6, 0.3] });
  stove(); radiator();
  if (t >= T.c2) crate();
  // the things flying from the counter into the crate
  for (const [, t0, kind] of ITEMS) {
    const u = seg(t0 - 0.05, t0 + 0.4, t, ease.out);
    if (u <= 0 || u >= 1) continue;
    g.save(); g.translate(lerp(200, CRATE[0], u), lerp(-340, -170, u) - 160 * bump(u)); g.rotate(0.6 * (1 - u)); thing(kind, lerp(1, 0.8, u)); g.restore();
  }
  // in the crate: the tops of what has gone in
  if (t >= T.c2) ITEMS.forEach(([, t0, kind], i) => { if (t < t0 + 0.4) return; g.save(); g.beginPath(); g.rect(CRATE[0] - 126, -300, 252, 132); g.clip(); g.translate(CRATE[0] - 100 + (i % 5) * 50, -150 - 10 * (i % 2)); thing(kind, 0.7); g.restore(); });
  let dl = null;
  if (d) {
    dl = drawDog(d);
    if (d.carry && dl?.nose) {                                 // the bowl in her teeth and the leash trailing
      const [nx, ny] = dl.nose;
      fill(polyPath([[nx - 30, ny + 10], [nx + 30, ny + 10], [nx + 22, ny + 40], [nx - 22, ny + 40]]), '#d9433b');
      limb([[nx - 10, ny + 20], [nx - 80, ny + 120], [nx - 160, -6]], 6, '#3c7ad6');
    }
  }
  if (h) hunterDraw(t, h);
  // the dark: the lamp off, only the phone's glow
  if (isDark(t)) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,7,17,0.82)'; g.fillRect(0, 0, W, H);
    if (h?.prop?.kind === 'phone') { const [px, py] = toScreen(cam, h.prop.p); const gr = g.createRadialGradient(px, py, 0, px, py, 320); gr.addColorStop(0, 'rgba(159,216,255,0.45)'); gr.addColorStop(1, 'rgba(159,216,255,0)'); g.fillStyle = gr; g.fillRect(px - 320, py - 320, 640, 640); }
  }
  if (flick === 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(4,7,17,0.6)'; g.fillRect(0, 0, W, H); }
}

// —— everything over the picture ——
function overlays(t, cam) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c1 - 0.1, 'ДЕНЬ 6 — 12:00');
  if (t < T.c1) Hd.plaque(t, A.L0w10 - 0.08, T.c1 - 0.02, 540, 560, { icon: 'calendar', title: 'ГОТОВЬСЯ ЗАРАНЕЕ', sub: 'а не в темноте', color: GOLD });
  if (t >= T.c1 && t < T.c2) {
    { const p = S2([-120, -420]); Hd.redX(p[0], p[1], 70, sp(t, A.L1w12 - 0.05, 2.6, 8)); }
    Hd.plaque(t, A.L1w14 - 0.08, T.c2 - 0.02, 540, 560, { icon: 'bottle', title: 'ПОСЛЕДНЯЯ БУТЫЛКА', sub: 'и где фонарик?', color: DANGER });
  }
  Hd.ribbon(t, T.dark, A.L1w12 - 0.15, 'ПОТОМ БУДЕТ ПОЗДНО', { y: 760, size: 88 });
  if (t >= T.c2 && t < T.c3) Hd.plaque(t, A.L2w4 - 0.08, T.c3 - 0.02, 540, 560, { icon: 'house', title: '3 ДНЯ · ОДНО МЕСТО', sub: 'все знают, где запас', color: GOLD, to: S2([CRATE[0], -170]) });
  // the three steps: headers, the checklist on the right, the water sum, the cash machine
  Hd.stepHeader(t, 1, 'ВОДА И ЕДА', A.L3 + 0.02, A.L3e - 0.05);
  Hd.stepHeader(t, 2, 'СВЕТ И СВЯЗЬ', A.L4 + 0.02, A.L4e - 0.05);
  Hd.stepHeader(t, 3, 'АПТЕЧКА И ДЕНЬГИ', A.L5 + 0.02, A.L5e - 0.05);
  if (t >= T.c3 && t < T.c6) checklist(t, 850, 720);
  if (t >= T.c3 && t < T.c4) Hd.plaque(t, A.L3w4 - 0.08, T.c4 - 0.02, 360, 1560, { icon: 'drop', title: '4 Л × 3 ДНЯ = 12 Л', sub: 'на человека', color: ICE });
  if (t >= T.c5 && t < T.c6) Hd.plaque(t, T.atm, T.c6 - 0.02, 360, 1560, { icon: 'x', title: 'БАНКОМАТ НЕ РАБОТАЕТ', sub: 'без света', color: DANGER });
  if (t >= T.c6 && t < T.c7) Hd.plaque(t, A.L6w11 - 0.1, T.c7 - 0.02, 540, 560, { icon: 'check', title: 'ЗАПАС ДЛЯ ПУРГИ', sub: 'корм, вода, поводок', color: WARM });
  Hd.endCard(t, A.L7 - 0.05, 0, 300);
  if (t >= T.c7) Hd.plaque(t, A.L7w5 - 0.1, DUR + 1, 540, 720, { icon: 'comment', title: 'ЧТО У ТЕБЯ УЖЕ ЕСТЬ?', sub: 'пиши в комментариях', color: GOLD, size: 46 });
}
// the checklist of the kit, a row ticked as each thing goes into the crate
function checklist(t, x, y) {
  const k = clamp(sp(t, T.c3 + 0.1, 2.4, 8)) * (1 - seg(T.c6 - 0.25, T.c6 - 0.02, t));
  if (k <= 0.01) return;
  const w = 330, h = 60 + ITEMS.length * 50;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8; rrect(-w / 2, -h / 2, w, h, 16, '#f6f2e7'); g.restore();
  ITEMS.forEach(([r, t0], i) => {
    const yy = -h / 2 + 54 + i * 50, on = clamp((t - t0 - 0.35) / 0.15);
    rrect(-w / 2 + 20, yy - 28, 30, 30, 6, '#d9d2c2');
    if (on > 0) limb([[-w / 2 + 25, yy - 14], [-w / 2 + 34, yy - 5], [-w / 2 + 50, yy - 28]], 6, rgba('#2f8f4e', on), false);
    Hd.label(r, -w / 2 + 66, yy, 32, '#17162f', { fam: FONTS.cond, align: 'left', shadow: false, stroke: false });
  });
  g.restore();
}

// —— the poster: him with the packed crate, the dog with her bowl ——
function coverFrame(t) {
  const cam = { x: 60, y: -300, z: 1.55, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#090c16'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ap.drawShell(t, { power: true, lampOn: true }); Ap.drawWindow(t, { day: 1 }); Ap.drawFridge(t); Ap.drawCounter(t, {}); stove(); radiator();
  crate(); ITEMS.forEach(([, , kind], i) => { g.save(); g.beginPath(); g.rect(CRATE[0] - 126, -300, 252, 132); g.clip(); g.translate(CRATE[0] - 100 + (i % 5) * 50, -150 - 10 * (i % 2)); thing(kind, 0.7); g.restore(); });
  const o = stand(base(t, { s: 0.9, face: -1, pop: 0.3, brow: 0.6, mouth: 0.5, look: [-0.6, 0.3], blink: 0 }), 230, 100);
  const sh = shoulder(o); o.hands = { near: { p: [sh[0] - 80, sh[1] + 60], shape: 'thumb', ang: -Math.PI / 2 } };
  const dl = drawDog({ x: -330, y: 40, s: 1.0, face: 1, sit: 1, look: 0.2, t: 0, ears: 1, wag: 1 });
  if (dl?.nose) { const [nx, ny] = dl.nose; fill(polyPath([[nx - 34, ny + 10], [nx + 34, ny + 10], [nx + 26, ny + 44], [nx - 26, ny + 44]]), '#d9433b'); }
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.save(); g.translate(1020, 230); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  Hd.label('ЗАРАНЕЕ', 0, 210, 140, '#ffffff', { align: 'right', strokeW: 12 });
  g.save(); g.shadowColor = 'rgba(255,200,80,0.9)'; g.shadowBlur = 40; Hd.label('ЗАПАС НА 3 ДНЯ', 0, 330, 84, '#ffd23f', { align: 'right', shadow: false, strokeW: 10 }); g.restore();
  g.rotate(0.06);
  const pl = 'ЧАСТЬ 8 · ФИНАЛ СЕЗОНА', pw = measure(pl, 52, FONTS.cond) + 60;
  rect(-pw + 8, 410 + 8, pw, 88, INK); rect(-pw, 410, pw, 88, '#ffd43b'); text(pl, -pw / 2, 472, 52, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
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
  add(0.3, 'city_day', -24, 0, { dur: T.dark - 0.3 });
  add(T.flick, 'spark', -10, 0.2);
  add(A.L0w10 - 0.08, 'blip', -10, 0);
  add(T.dark, 'power_down', -10, 0);
  add(T.dark, 'ribbon', -8, 0);
  add(A.L1w12 - 0.05, 'stamp', -8, -0.2);
  add(A.L1w14 - 0.08, 'blip', -10, 0);
  add(T.c2, 'whoosh', -12, 0);
  add(T.c2, 'amb_flat', -22, 0, { dur: T.c6 - T.c2 });
  add(A.L2w4 - 0.08, 'ding', -10, 0);
  ITEMS.forEach(([, t0], i) => { add(t0, 'whoosh_in', -16, 0.3); add(t0 + 0.4, 'pop_word', -12, -0.1 + 0.02 * i); });
  add(A.L3w4 - 0.08, 'fill_plink', -12, 0);
  add(T.atm, 'stamp', -8, 0);
  add(T.c6, 'whoosh', -12, 0);
  add(T.dog, 'whine', -16, -0.3, { dur: 0.6 });
  add(A.L6w11 - 0.1, 'ding', -10, 0);
  for (const t0 of [A.L3, A.L4, A.L5]) add(t0 + 0.04, 'pop_word', -8, 0);
  add(A.L7 + 0.1, 'pop_word', -6, 0);
  add(A.L7, 'whoosh_in', -12, 0);
  add(A.L7w5 - 0.1, 'blip', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
