// «Тонкий лёд» — «Реальные истории» №5, a standalone 2D short (≤45 s) on every rule of the Studio export (10.11): a
// bright first frame with the danger in big letters (ЛЁД ТРЕЩИТ? НЕ БЕГИ — ЛОЖИСЬ!), you in a real danger here and now,
// a STOP with two buttons in the middle, the real case at the end as the answer to the opening question, a loop.
// The ice cracks under the hunter: don't run — lie down and crawl back (lying, the weight spreads). STOP: you have fallen
// through — 1 out at the nearest edge or 2 back where you came from (a map from above, two buttons, a countdown, the music
// drops out). 2: that ice held you. Arms on the ice, kick, slide out on the belly, don't stand — roll away. 1-10-1: the
// first minute just breathe, then about ten minutes while the hands still work. Norway 1999: a skier eighty minutes in
// ice water, her body at 13.7 °C, saved. Beats are anchored to the narrator's words (build/words.json; before the voice,
// a rough timing from voice/script.json).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter } from './hunter.js';
import { drawDog } from './dog.js';
import { person } from './story.js';
import { SHORE, ICE, THICK, lake, crack, iceSection, waterOver, iceMap, mountains, skier, thermometer, heartLine } from './ice.js';
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
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ТРЕСК: DANGER, БЕГИ: DANGER, ЛОЖИСЬ: OK, НАЗАД: OK, ДЕРЖИТ: OK, СТОП: GOLD, ПРОВАЛИЛСЯ: DANGER, БЛИЖЕ: DANGER, ПРИШЁЛ: OK,
  ДВА: OK, ВЫДЕРЖАЛ: OK, РУКИ: GOLD, НОГАМИ: GOLD, ЖИВОТЕ: GOLD, ВСТАВАЙ: DANGER, ОТКАТИСЬ: OK, МИНУТУ: GOLD, ДЫШИ: OK, ДЕСЯТЬ: GOLD,
  ВОСЕМЬДЕСЯТ: DANGER, ЧЕТЫРНАДЦАТИ: DANGER, СПАСЛИ: OK, ПОДПИСЫВАЙСЯ: GOLD };

// L1: Не(0) беги(1) Ложись(2) и(3) отползай(4) назад(5)
// L3: Стоп(0) А(1) если(2) ты(3) уже(4) провалился(5) Один(6) —(7) лезть(8) где(9) ближе(10) Два(11) —(12) туда(13) откуда(14) пришёл(15)
// L5: Руки(0) на(1) лёд(2) работай(3) ногами(4) и(5) выползай(6) на(7) животе(8)   L6: Не(0) вставай(1) —(2) откатись(3) подальше(4)
// L7: Первую(0) минуту(1) просто(2) дыши(3) Потом(4) у(5) тебя(6) минут(7) десять(8) пока(9) слушаются(10) руки(11)
// L8: В(0) Норвегии(1) лыжница(2) провалилась(3) под(4) лёд(5) и(6) восемьдесят(7) минут(8) была(9) в(10) ледяной(11) воде(12)
// L9: Тело(0) остыло(1) почти(2) до(3) четырнадцати(4) градусов(5) —(6) но(7) её(8) спасли(9)
const T = {
  lie: A.L1w2 - 0.1,          // «Ложись»
  c3: A.L3 - 0.06,            // STOP: the map
  ans: A.L4 - 0.04,           // «Два!»
  c4: A.L4w1 - 0.06,          // the ice cut open
  c6: A.L7 - 0.06,            // 1-10-1
  c7: A.L8 - 0.06,            // 1999
  fall: A.L8w3,               // «провалилась»
  under: A.L8w6 - 0.1,        // «и восемьдесят минут…»
  temp: A.L9 - 0.06,          // the thermometer
  saved: A.L9w7 - 0.05,       // «но её спасли»
  c8: A.L10 - 0.06,           // the end
};
export const CUTS = [T.c3, T.c4, T.c6, T.c7, T.under, T.temp, T.c8];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c3 ? 'lake' : t < T.c4 ? 'stop' : t < T.c6 ? 'out' : t < T.c7 ? 'rule' : t < T.c8 ? 'story' : 'end');
const PUNCH = [A.L0w8, A.L1w2, A.L3w0, A.L4w0, A.L6w1, A.L7w3, A.L8w7, A.L9w4, A.L9w9];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.07 * z; }

const hunterStand = (t, x, y, s, o = {}) => drawHunter({ hip: [x, y], feet: { near: [x - 30 * s, y + 262 * s], far: [x + 34 * s, y + 262 * s] }, s, face: o.face ?? -1,
  look: o.look ?? [0, 0], brow: o.brow ?? 0, pop: o.pop ?? 0, mouth: o.mouth ?? 0.15, blink: ((t + 0.7) % 3.4) < 0.12 ? 1 : 0, scarf: 'neck', hands: o.hands });

// —— the lake: standing on the ice as it cracks; at «Ложись» he drops flat and crawls back (left) ——
function lakeScene(t) {
  const lie = seg(T.lie, T.lie + 0.45, t, ease.out), crawl = seg(T.lie + 0.4, T.c3, t, x => x);
  const feet = [560, 1590];
  lake(t, { cracks: [{ x: feet[0], y: feet[1] + 6, k: 0.6 + 0.4 * seg(A.L0w7, A.L0e + 0.3, t, ease.out), seed: 3, s: 1.7 }] });
  // the weight: one big arrow while he stands, small spread arrows once he lies
  const s = 0.82, hx = feet[0] - 160 * crawl, hy = feet[1] - 262 * s;
  if (lie < 1) hunterStand(t, hx, hy + 120 * lie, s, { face: 1, look: [0.2, 0.9], brow: 0.9, pop: t > A.L0w8 ? 1 : 0, mouth: 0.5 });
  if (lie > 0) {
    const x = hx + 150, y = feet[1] - 40, ph = t * 5;
    g.save(); g.globalAlpha = Math.min(1, lie * 3); g.translate(x, y); g.rotate(-1.5 * lie); g.translate(-x, -y);
    const hp = [x, y - 10];
    drawHunter({ hip: hp, feet: { near: [hp[0] - 30 * s + 14 * Math.sin(ph), hp[1] + 262 * s], far: [hp[0] + 34 * s - 14 * Math.sin(ph), hp[1] + 262 * s] }, s, face: -1,
      look: [0, -0.6], brow: 0.6, mouth: 0.3, blink: 0, scarf: 'neck',
      hands: { near: { p: [hp[0] - 50 + 30 * Math.sin(ph), hp[1] - 470 * s], shape: 'open' }, far: { p: [hp[0] + 40 - 30 * Math.sin(ph), hp[1] - 490 * s], shape: 'open' } } });
    g.restore();
  }
  drawDog({ x: 900 - 120 * crawl, y: 1700, s: 0.55, face: -1, t, sit: lie > 0.5 ? 0 : 1, walk: crawl > 0 && crawl < 1 ? 0.6 : 0, ph: t * 1.5, look: 0.3, ears: lie > 0 ? 0.6 : 0, mouth: 0.6 });
  // weight arrows
  if (t > A.L2 - 0.1 && t < T.c3) {
    const k = clamp((t - A.L2 + 0.1) / 0.3);
    for (let i = 0; i < 5; i++) { const x = lerp(200, 620, i / 4) - 160 * crawl, y0 = 1520, y1 = 1600; g.globalAlpha = k; limb([[x, y0], [x, y1]], 8, '#2f8f4e', false); poly([[x, y1 + 18], [x - 14, y1], [x + 14, y1]], '#2f8f4e'); g.globalAlpha = 1; }
  }
}
function stopScene(t) {
  lake(T.c3, { cracks: [{ x: 300, y: 1600, k: 1, seed: 3, s: 1.6 }] });
  g.fillStyle = 'rgba(11,15,26,0.55)'; g.fillRect(0, 0, W, H);
  iceMap(t, clamp(sp(t, T.c3 + 0.05, 2.6, 8)), { arrows: seg(A.L3w6 - 0.1, A.L3w10 + 0.2, t), arrows2: seg(A.L3w11 - 0.1, A.L3w15 + 0.2, t), answer: t >= T.ans ? 1 : 0 });
}
// —— the ice cut open: in the hole (chest-deep), arms on the edge, kick to level, slide out on the belly, roll away ——
const HX0 = 600, HX1 = 820;
function inHole(t, o = {}) {
  const s = 0.78, kick = o.kick ?? 0, tilt = o.tilt ?? 0, slide = o.slide ?? 0, roll = o.roll ?? 0;
  const hip = [lerp(720, 520, slide) - 260 * roll, lerp(ICE + 175, ICE - 30, Math.max(tilt * 0.6, slide))];
  const wob = roll > 0 && roll < 1 ? 0.22 * Math.sin(roll * TAU * 3) : 0;
  g.save(); g.translate(hip[0], hip[1] - 160 * s - 20 * Math.abs(wob)); g.rotate(-1.45 * tilt + wob); g.translate(-hip[0], -(hip[1] - 160 * s));
  const ph = t * 9;
  drawHunter({ hip, feet: { near: [hip[0] + 20 * s + 30 * kick * Math.sin(ph), hip[1] + 262 * s], far: [hip[0] + 40 * s - 30 * kick * Math.sin(ph), hip[1] + 250 * s] }, s, face: -1,
    look: o.look ?? [-0.3, 0], brow: 0.8, pop: o.pop ?? 0.4, mouth: o.mouth ?? 0.5, blink: 0, scarf: 'neck',
    hands: o.arms ? { near: { p: [hip[0] - 190 * s, hip[1] - 330 * s], shape: 'open' }, far: { p: [hip[0] - 150 * s, hip[1] - 360 * s], shape: 'open' } } : { near: { p: [hip[0] - 120 * s, hip[1] - 300 * s], shape: 'open' }, far: { p: [hip[0] + 120 * s, hip[1] - 300 * s], shape: 'open' } } });
  g.restore();
  return hip;
}
function outScene(t) {
  iceSection(t, HX0, HX1);
  const arms = t > A.L5w0 - 0.1, tilt = seg(A.L5w3, A.L5w6, t), slide = seg(A.L5w6, A.L5e + 0.2, t), roll = seg(A.L6w3 - 0.1, A.L6e + 0.4, t, x => x);
  inHole(t, { arms, kick: t > A.L5w3 - 0.1 && slide < 1 ? 1 : 0, tilt, slide, roll, mouth: 0.4 });
  if (slide < 0.85) waterOver(t, HX0, HX1, 0.82 * (1 - slide));
  if (t > A.L5w3 && slide < 0.9) for (let i = 0; i < 6; i++) { const u = ((t * 2.5 + i / 6) % 1); ell(lerp(HX0 + 40, HX1 - 20, hash(i)), ICE + 10 - 50 * u, 10 * (1 - u) + 2, 8 * (1 - u) + 2, 'rgba(255,255,255,0.85)'); }
  drawDog({ x: 220, y: ICE + 4, s: 0.45, face: 1, t, sit: 0, look: 0.2, mouth: 0.9, ears: 0.4 });
}
function ruleScene(t) {
  iceSection(t, HX0, HX1);
  inHole(t, { arms: true, mouth: 0.25 + 0.25 * Math.sin(t * 3), look: [-0.2, 0.3] });
  waterOver(t, HX0, HX1);
  for (let i = 0; i < 4; i++) { const u = ((t * 0.8 + i / 4) % 1); ell(560 - 120 * u, 930 - 90 * u, 26 + 50 * u, 20 + 30 * u, `rgba(255,255,255,${0.6 * (1 - u)})`); }     // breath in the cold
}
function storyScene(t) {
  if (t < T.under) {
    const u = seg(T.c7, T.fall, t, x => x), fall = seg(T.fall, T.fall + 0.35, t);
    mountains(t, { broken: fall });
    if (fall < 0.6) skier(lerp(180, 520, u), lerp(1150, 1540, u) + 60 * fall, 0.32, t, { rot: 0.32 });
    if (fall > 0) for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i - 4.5) * 0.25, d = 140 * fall; ell(540 + Math.cos(a) * d, 1540 + Math.sin(a) * d * 1.4, 14 * (1 - fall) + 4, 10 * (1 - fall) + 3, '#ffffff'); }
  } else if (t < T.temp) {
    // the friends at the hole, holding on; the water clock runs to 80 minutes
    mountains(t, { broken: 1 });
    limb([[520, 1560], [440, 1460]], 8, '#2a2a34', false); limb([[560, 1560], [640, 1450]], 8, '#2a2a34', false);
    person({ x: 330, y: 1640, s: 0.34, seed: 2, view: 'side', face: 1, shirt: '#3a6aa8', hat: '#ffd23f', arm: [300, -320] });
    person({ x: 760, y: 1650, s: 0.34, seed: 4, view: 'side', face: -1, shirt: '#2f8f4e', hat: '#d9433b', arm: [300, -300] });
  } else {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#dfeef6'); gr.addColorStop(1, '#bcd8e8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const v = lerp(36.6, 13.7, seg(T.temp + 0.1, A.L9w5 + 0.2, t, ease.out));
    thermometer(330, 1010, clamp(sp(t, T.temp, 2.6, 8)), v);
    Hd.label((v.toFixed(1) + ' °C').replace('.', ','), 330, 1290, 64, v < 20 ? '#1d6fb8' : DANGER, { fam: FONTS.mono });
    heartLine(560, 900, 420, t, T.saved, t > T.saved);
    if (t > T.saved) { const k = clamp(sp(t, T.saved, 3, 7)); g.save(); g.translate(770, 1120); g.rotate(-0.1); g.scale(k, k); rrect(-190 + 8, -70 + 8, 380, 140, 22, INK); rrect(-190, -70, 380, 140, 22, '#2f8f4e'); text('ЖИВА', 0, 30, 90, '#ffffff', { shadow: false }); g.restore(); }
  }
}
function endScene(t) {
  const k = seg(DUR - 0.8, DUR, t);
  lake(t, { cracks: [{ x: 560, y: 1596, k: 0.6 * k, seed: 3, s: 1.7 }] });
  hunterStand(t, 560, 1590 - 262 * 0.82, 0.82, { face: 1, look: [0.2, 0.3], brow: 0.2, mouth: 0.35, hands: { near: { p: [660, 1180], shape: 'thumb', ang: -Math.PI / 2 } } });
  drawDog({ x: 880, y: 1700, s: 0.55, face: -1, t, sit: 1, mouth: 0.7, tongue: 0.9, wag: 1, wagPh: t * 3 });
}

// —— the 2D layer ——
function headline(t) {
  // the hook from the very first frame: the danger and the DON'T, no pop-in
  if (t > T.lie + 0.3) return;
  const a = 1 - seg(T.lie - 0.1, T.lie + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = 'ЛЁД ТРЕЩИТ?', sw = measure(s, 100) + 90; rrect(-sw / 2 + 10, -74 + 10, sw, 148, 24, INK); rrect(-sw / 2, -74, sw, 148, 24, '#ffd23f'); text(s, 0, 36, 100, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, T.lie - 0.1, 'НЕ БЕГИ — ЛОЖИСЬ!', { y: 500, size: 84 });
}
function chip(t, t0, t1, s1, s2, y) {
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.3, t1, t));
  if (k <= 0.01) return;
  const w = Math.max(measure(s1, 40, FONTS.cond), measure(s2, 30, FONTS.mono)) + 70;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.02); g.scale(k, k);
  rrect(-w / 2 + 6, -62 + 8, w, 124, 22, INK); rrect(-w / 2, -62, w, 124, 22, '#fff3d6');
  text(s1, 0, -4, 40, INK, { fam: FONTS.cond, shadow: false }); text(s2, 0, 40, 30, '#c0392b', { fam: FONTS.mono, shadow: false });
  g.restore();
}
function progress(t) {
  const a = clamp((t - T.lie) / 0.3) * (1 - seg(T.c7 - 0.3, T.c7, t));
  if (a <= 0.01 || scene(t) === 'stop') return;
  const marks = [['ТРЕСК', 0], ['В ВОДЕ', T.c3], ['ВЫБРАЛСЯ', A.L5], ['1 · 10', T.c6]], x0 = 70, w = 940, y = 200, sw = w / marks.length;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  fill(rrPath(x0, y - 22, w, 44, 22), 'rgba(11,15,26,0.72)');
  marks.forEach(([s, t0], i) => {
    const nx = i + 1 < marks.length ? marks[i + 1][1] : T.c7, done = t >= nx, on = t >= t0 && !done, x = x0 + i * sw;
    if (done || on) fill(rrPath(x + 6, y - 16, (sw - 12) * (done ? 1 : clamp((t - t0) / (nx - t0))), 32, 16), done ? 'rgba(47,143,78,0.55)' : 'rgba(255,210,63,0.35)');
    text((done ? '✓ ' : '') + s, x + sw / 2, y + 9, 26, done ? '#c8f5d4' : on ? '#ffe9a0' : '#8b97ad', { fam: FONTS.mono, shadow: false });
  });
  g.restore();
}
function choice(t) {
  if (t < T.c3 || t >= T.c4 + 0.3) return;
  const done = t >= T.ans;
  [['1', 'ГДЕ БЛИЖЕ', -1, A.L3w6], ['2', 'ОТКУДА ПРИШЁЛ', 1, A.L3w11]].forEach(([n, s, side, t0]) => {
    const k = clamp(sp(t, t0 - 0.08, 2.6, 8)) * (1 - seg(T.c4, T.c4 + 0.3, t)); if (k <= 0.01) return;
    const right = side > 0, c = done ? (right ? '#2f8f4e' : '#8a2a2a') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 240, 1260); g.scale(k * (done && right ? 1 + 0.1 * bump(clamp((t - T.ans) / 0.3)) : 1), k);
    rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
    text(n, 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
    text(s, 0, 62, 40, tc, { fam: FONTS.cond, shadow: false });
    if (done) Hd.label(right ? '✓' : '✗', 180, -66, 60, '#ffffff', { shadow: false, stroke: false });
    g.restore();
  });
  if (t >= A.L3e && !done) {
    const u = clamp((t - A.L3e) / Math.max(0.6, T.ans - A.L3e));
    g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1400, 700, 26, 13), 'rgba(255,255,255,0.18)'); fill(rrPath(190, 1400, 700 * (1 - u), 26, 13), GOLD);
    Hd.label('ДУМАЙ', 540, 1480, 44, '#ffffff', { fam: FONTS.mono });
  }
  if (t < A.L3w1) {
    const k = clamp(sp(t, A.L3w0 - 0.05, 3, 7));
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 760); g.rotate(-0.12); g.scale(lerp(1.8, 1, Math.min(1, k)), lerp(1.8, 1, Math.min(1, k))); g.globalAlpha = Math.min(1, k * 3) * (1 - seg(A.L3w1 - 0.15, A.L3w1 + 0.1, t));
    rrect(-250 + 10, -100 + 10, 500, 200, 26, INK); rrect(-250, -100, 500, 200, 26, '#d62828'); text('СТОП', 0, 50, 140, '#fff3d6', { shadow: false }); g.restore();
  }
}
function counter(x, y, title, val, c, w = 300) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.save();
  const h = 110; rrect(x - w / 2, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)'); g.lineWidth = 3; g.strokeStyle = c; g.stroke(rrPath(x - w / 2 + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17));
  Hd.label(title, x, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(String(val), x, y + 38, 56, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function timerCard(t, t0, x, y, big, small, c) {
  const k = clamp(sp(t, t0, 2.6, 8)); if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.rotate(-0.02); g.scale(k, k);
  rrect(-200 + 6, -120 + 8, 400, 240, 26, INK); rrect(-200, -120, 400, 240, 26, '#fff3d6');
  text(big, 0, 10, 92, c, { fam: FONTS.block, shadow: false }); text(small, 0, 80, 34, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function plaques(t) {
  const sc = scene(t), P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  if (sc === 'lake' && t > T.lie) {
    P(A.L1w0, T.c3 - 0.05, 340, { icon: 'x', title: 'НЕ БЕГИ', color: DANGER, size: 50 });
    P(A.L1w2, T.c3 - 0.05, 460, { icon: 'check', title: 'ЛЯГ И ОТПОЛЗИ НАЗАД', color: OK, size: 44 });
    P(A.L2w0, T.c3 - 0.05, 580, { icon: 'check', title: 'ЛЁЖА ВЕС РАСХОДИТСЯ', color: OK, size: 42 });
    chip(t, A.L1e + 0.1, T.c3 - 0.05, 'КАК ОНА ВЫЖИЛА 80 МИНУТ В ЛЕДЯНОЙ ВОДЕ?', 'ОТВЕТ — В КОНЦЕ', 760);
  }
  if (sc === 'out') {
    P(A.L4w1, A.L5 - 0.05, 340, { icon: 'check', title: 'ТАМ ЛЁД УЖЕ ВЫДЕРЖАЛ', color: OK, size: 44 });
    P(A.L5w0, T.c6 - 0.05, 340, { icon: 'check', title: 'РУКИ НА ЛЁД', color: OK, size: 46 });
    P(A.L5w3, T.c6 - 0.05, 460, { icon: 'check', title: 'РАБОТАЙ НОГАМИ', color: OK, size: 46 });
    P(A.L6w0, T.c6 - 0.05, 580, { icon: 'x', title: 'НЕ ВСТАВАЙ — КАТИСЬ', color: DANGER, size: 44 });
  }
  if (sc === 'rule') {
    timerCard(t, A.L7w0 - 0.05, 300, 470, '1', 'МИНУТА — ДЫШИ', OK);
    timerCard(t, A.L7w7 - 0.05, 780, 470, '10', 'МИНУТ — ВЫБИРАЙСЯ', GOLD);
  }
  if (sc === 'story') {
    Hd.timeStamp(t, T.c7 + 0.1, T.c8 - 0.05, '1999 · НОРВЕГИЯ', { color: WARM, y: 200 });
    if (t > T.under && t < T.temp) counter(540, 420, 'В ЛЕДЯНОЙ ВОДЕ', Math.round(80 * seg(T.under, T.temp - 0.2, t, x => x)) + ' МИН', DANGER, 360);
  }
  if (sc === 'end') P(A.L10w0, DUR + 1, 560, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, КТО ХОДИТ ПО ЛЬДУ', color: GOLD, size: 38 });
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ lake: lakeScene, stop: stopScene, out: outScene, rule: ruleScene, story: storyScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); progress(t); plaques(t); choice(t);
  Hd.endCard(t, A.L10w7 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.5);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'ice_wind', -18, 0, { dur: T.c3 + 0.3 }); add(0.02, 'ice_crack', -8, 0);
  add(A.L0w8 - 0.05, 'ice_crack', -6, 0.1); add(A.L0w8 + 0.35, 'ice_crack', -12, -0.2);
  add(A.L1w0 - 0.05, 'bark', -12, 0.4); add(T.lie, 'thud', -12, 0); add(T.lie + 0.4, 'crawl', -14, 0, { dur: T.c3 - T.lie - 0.4 });
  add(A.L3w0 - 0.05, 'stamp', -6, 0); add(A.L3w6 - 0.08, 'pop_word', -10, -0.3); add(A.L3w11 - 0.08, 'pop_word', -10, 0.3);
  add(A.L3e, 'ticks_up', -14, 0, { dur: Math.max(0.6, T.ans - A.L3e) });
  add(T.ans, 'stamp', -6, 0); add(T.ans + 0.05, 'ding', -8, 0);
  add(T.c4, 'ice_water', -14, 0, { dur: A.L6 - T.c4 }); add(A.L5w3, 'splash', -12, 0); add(A.L5w6, 'crawl', -12, 0, { dur: 0.9 });
  add(A.L6w3 - 0.1, 'crawl', -12, -0.2, { dur: 0.9 }); add(A.L6w1, 'bark', -14, -0.4);
  add(T.c6, 'ice_water', -18, 0, { dur: T.c7 - T.c6 }); add(A.L7w0, 'breath', -12, 0); add(A.L7w0 - 0.05, 'pop_word', -10, -0.2); add(A.L7w7 - 0.05, 'pop_word', -10, 0.2);
  add(T.c7, 'ice_wind', -18, 0, { dur: T.under - T.c7 }); add(T.c7 + 0.1, 'paper', -14, 0); add(T.fall, 'ice_crack', -6, 0); add(T.fall + 0.1, 'splash', -6, 0);
  add(T.under, 'ice_water', -16, 0, { dur: T.temp - T.under }); add(T.under, 'ticks_up', -18, 0, { dur: T.temp - T.under - 0.2 });
  add(T.temp, 'heartbeat', -16, 0, { dur: T.saved - T.temp + 0.2 }); add(T.saved, 'beep', -10, 0); add(T.saved + 0.05, 'ding', -10, 0);
  add(T.c8, 'ice_wind', -20, 0, { dur: DUR - T.c8 }); add(A.L10w7 - 0.1, 'pop_word', -8, 0); add(DUR - 0.5, 'ice_crack', -14, 0);
  return c.sort((a, b) => a.t - b.t);
}
