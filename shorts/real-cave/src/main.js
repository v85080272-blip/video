// «Дети в затопленной пещере» — «Реальные истории», 3: Таиланд, 2018. Made to be watched to the end (shorts/RETENTION.md in
// the zone worktree): ~45 s; the hook asks a question answered only at the end («спасти их можно только во сне» → they
// were put to sleep and carried out under water); a stop in the middle («Что бы сделал ты: плыть или ждать?», two buttons
// and a countdown); a punch-in zoom on the key words; a progress strip; Пурга hidden three times (the easter egg, asked
// about at the start and at the end). Scenes: the boys on the ledge as the water rises; the cave mouth with their bikes,
// then the rain; the cave in section, the water chasing them 4 km in; the drip from the rock; STOP; the flooded passages;
// the divers come up; a sleeping boy carried along the line; the ambulances, 13/13; the rule; the choice.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawBoy, drawCoach, caveWalls, ledge, water, diver, carried, bubbles, mountainMouth, bike, rain, ambulance } from './story.js';
import { drawDog } from './dog.js';
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
Hd.SUB.y = 1450; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ТРИНАДЦАТЬ: GOLD, ЗАСТРЯЛИ: DANGER, ПРИБЫВАЕТ: DANGER, СНЕ: GOLD, ЛИВЕНЬ: DANGER, ЗАТАПЛИВАЕТ: DANGER, ЧЕТЫРЕ: GOLD,
  НЕЧЕГО: DANGER, ЧИСТУЮ: OK, СТОП: DANGER, ПОПЛЫЛ: DANGER, ЖДАЛ: OK, ЖДАТЬ: OK, УМЕЮТ: DANGER, ДЕСЯТЫЙ: GOLD, ВОДОЛАЗА: OK,
  УСНУЛИ: GOLD, МАСКИ: GOLD, СПАСЕНЫ: OK, ВСЛЕПУЮ: DANGER, СУХОМ: OK, СИЛЫ: GOLD, ЦУНАМИ: DANGER, ВУЛКАНА: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

const T = {
  lit: A.L0w0, sleep: A.L0w12 - 0.1,
  c1: A.L1 - 0.06, rain: A.L1w11 - 0.06,
  c2: A.L2 - 0.06, km: A.L2w7 - 0.05,
  c3: A.L3 - 0.06, drink: A.L3w2 - 0.05,
  c4: A.L4 - 0.06, opts: A.L4w5 - 0.05,
  c5: A.L5 - 0.06, under: A.L5w1 - 0.06,
  c6: A.L6 - 0.06, up: A.L6w5 - 0.1,
  c7: A.L7 - 0.06, zz: A.L7w5 - 0.05, how: A.L7w9 - 0.05,
  c8: A.L8 - 0.06, c9: A.L9 - 0.06, c10: A.L10 - 0.06, c11: A.L11 - 0.06,
};
export const CUTS = [T.c1, T.rain, T.c2, T.c3, T.c4, T.under, T.c6, T.c7, T.c8, T.c9, T.c10];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.rain ? 'mouth' : t < T.c2 ? 'rainy' : t < T.c3 ? 'flood' : t < T.c4 ? 'drip' : t < T.under ? 'stop'
  : t < T.c6 ? 'under' : t < T.c7 ? 'divers' : t < T.c8 ? 'carry' : t < T.c9 ? 'saved' : t < T.c10 ? 'lesson' : 'next');
// the punch-ins: a quick zoom on the words that matter
const PUNCH = [A.L0w2, A.L0w12, A.L1w12, A.L2w7, A.L4w0, A.L5w0, A.L6w5, A.L7w5, A.L8w0];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.07 * z; }
// the easter egg: Пурга hides three times (at the bikes, behind a rock on the ledge, by the ambulance)
const EGGS = [['mouth', 220, 1580, 0.32, 1], ['divers', 980, 1135, 0.3, -1], ['saved', 900, 1570, 0.34, -1]];

// —— the scenes ——
const TEAM = Array.from({ length: 13 }, (_, i) => i);
function teamOnLedge(t, y, o = {}) {
  TEAM.forEach(i => {
    const row = i % 2, x = 110 + i * 68 + 20 * row, yy = y + 26 * row;
    const P = { x, y: yy, s: o.s ?? 0.28, seed: i, t, face: i % 3 ? 1 : -1, sit: 1, lamp: o.lamp && i % 4 === 0, look: o.look ?? (hash(i) - 0.5), lookY: o.lookY ?? 0, mud: true, open: o.open ? 0.5 : 0 };
    i === 6 ? drawCoach(P) : drawBoy(P);
  });
}
function hook(t) {
  caveWalls(t, { roof: 470 });
  ledge(1020);
  teamOnLedge(t, 1060, { lamp: true, lookY: 0.6 });
  const wl = lerp(1700, 1240, seg(0, T.c1, t, x => x));
  water(t, wl);
  for (const [x, y] of [[180, 640], [520, 700], [860, 620]]) { const gr = g.createRadialGradient(x, y, 0, x, y, 420); gr.addColorStop(0, 'rgba(255,230,160,0.12)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = gr; g.fillRect(x - 420, y - 420, 840, 840); }
}
function mouth(t, wet = 0) {
  mountainMouth(t, { rain: wet });
  for (const [x, r] of [[300, -0.2], [380, 0.15], [760, -0.1], [820, 0.3], [250, 0.4]]) bike(x, 1540, 0.6, r);
  if (!wet) {
    const u = seg(T.c1, T.rain, t, x => x);
    TEAM.forEach(i => { const p = clamp(u * 1.6 - i * 0.05); if (p >= 1) return;
      const x = lerp(540 + (i - 6) * 70, 550 + (i - 6) * 8, p), y = lerp(1760, 1300, p), s = lerp(0.36, 0.14, p);
      (i === 6 ? drawCoach : drawBoy)({ x, y, s, seed: i, t, face: i < 6 ? 1 : -1, walk: 1, ph: t * 1.1 + i * 0.3 }); });
  } else {
    rain(t, 1);
    g.fillStyle = 'rgba(20,30,40,0.25)'; g.fillRect(0, 0, W, H);
    const k = seg(T.rain, T.c2, t);   // the water starts to pour into the mouth
    fill(smoothPath([[420, 1500], [440, 1500 - 60 * k], [660, 1500 - 70 * k], [690, 1500]]), 'rgba(110,90,60,0.85)');
  }
}
function flood(t) {
  // the cave in section: a long winding tunnel; the water comes in from the mouth (left); the group goes deeper (right)
  g.fillStyle = '#2f5a36'; g.fillRect(0, 0, W, 520); g.fillStyle = '#3a2e24'; g.fillRect(0, 520, W, H - 520);
  for (let i = 0; i < 50; i++) ell(1080 * hash(i * 1.3), 560 + 1300 * hash(i * 2.9), 40 + 40 * hash(i), 20, 'rgba(0,0,0,0.18)');
  const path = [[40, 640], [260, 820], [520, 760], [760, 980], [560, 1180], [300, 1260], [480, 1440], [820, 1400], [980, 1560]];
  limb(path, 90, '#120e0b', true);
  const u = seg(T.c2, T.c3, t, x => x);
  const pts = []; const n = Math.round(u * (path.length - 1) * 10) + 1;
  for (let i = 0; i < n; i++) { const k = i / 10, a = path[Math.floor(k)], b = path[Math.min(path.length - 1, Math.floor(k) + 1)], f = k - Math.floor(k); pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]); }
  if (pts.length > 1) limb(pts, 70, 'rgba(110,90,60,0.95)', true);
  const gk = clamp(u + 0.12) * (path.length - 1), ga = path[Math.floor(gk)], gb = path[Math.min(path.length - 1, Math.floor(gk) + 1)], gf = gk - Math.floor(gk);
  const gx = lerp(ga[0], gb[0], gf), gy = lerp(ga[1], gb[1], gf);
  for (let i = 0; i < 13; i++) ell(gx + 14 * Math.cos(i * 2.4), gy + 10 * Math.sin(i * 1.7), 6, 6, i === 6 ? '#24406e' : '#d7263d');
  fill(smoothPath([[0, 520], [200, 460], [420, 380], [600, 330], [820, 420], [1080, 520]]), '#2f5a36');
  rrect(10, 600, 70, 80, 20, '#0b0908');
}
function drip(t) {
  caveWalls(t, { roof: 300 });
  fill(smoothPath([[-40, 1500], [200, 1380], [600, 1400], [900, 1360], [1120, 1460], [1120, 1920], [-40, 1920]]), '#4a3a28');
  fill(smoothPath([[650, 1600], [900, 1570], [1040, 1640], [980, 1720], [700, 1720]]), 'rgba(110,90,60,0.9)');      // the murky puddle
  drawBoy({ x: 470, y: 1640, s: 1.15, seed: 3, t, cup: t > T.drink, lookY: -0.8, look: 0.2, mud: true, lamp: true });
  for (let i = 0; i < 5; i++) { const u = ((t * 1.3 + i / 5) % 1); ell(470, lerp(330, 990, u), 6, 10, 'rgba(180,220,255,0.85)'); }
  fill(polyPath([[440, 300], [500, 300], [470, 360]]), '#3a3029');
}
function stop(t) {
  drip(T.c4 - 0.01);                                 // the picture freezes on the drip
  g.fillStyle = 'rgba(8,10,16,0.62)'; g.fillRect(0, 0, W, H);
}
function under(t) {
  // the flooded passage in section: narrow, dark, a guide line, kilometre marks going on and on
  g.fillStyle = '#0a0d10'; g.fillRect(0, 0, W, H);
  const sc = (t - T.under) * 260;
  const top = x => 700 + 120 * Math.sin((x + sc) * 0.006) + 60 * Math.sin((x + sc) * 0.017), bot = x => 1200 + 110 * Math.sin((x + sc) * 0.005 + 1) + 50 * Math.sin((x + sc) * 0.021);
  const P = []; for (let x = -20; x <= 1100; x += 40) P.push([x, top(x)]); for (let x = 1100; x >= -20; x -= 40) P.push([x, bot(x)]);
  fill(polyPath(P), 'rgba(60,52,34,0.95)');
  limb(Array.from({ length: 29 }, (_, i) => [-20 + i * 40, (top(-20 + i * 40) + bot(-20 + i * 40)) / 2 + 40]), 3, '#ffd23f', false);
  for (let k = 0; k < 4; k++) { const x = ((k * 380 - sc) % 1520 + 1520) % 1520 - 200; Hd.label(`${k + 1} км`, x, top(x) + 70, 34, 'rgba(255,255,255,0.55)', { fam: FONTS.mono, shadow: false, stroke: false }); }
  bubbles(t, 300, 1100, 6); bubbles(t + 0.4, 760, 1080, 6);
}
function divers(t) {
  caveWalls(t, { roof: 470 });
  ledge(980);
  fill(smoothPath([[880, 1140], [940, 1020], [1040, 1000], [1120, 1080], [1120, 1160]]), '#3a2e22');           // a rock on the ledge (Пурга behind it)
  teamOnLedge(t, 1020, { look: 0.4, lookY: 0.4, open: t > T.up + 0.3 });
  water(t, 1260, { clear: false });
  const u = seg(T.up - 0.3, T.up + 0.6, t, ease.out);
  diver(380, lerp(1500, 1300, u), 0.42, { rot: -1.2 * (1 - u) - 0.2, t, beam: 0.8 });
  diver(700, lerp(1560, 1320, u), 0.42, { rot: -1.2 * (1 - u) - 0.25, t: t + 0.4, beam: 0.8, face: -1 });
  if (u > 0) bubbles(t, 540, 1300, 10, 120);
}
function carry(t) {
  g.fillStyle = '#081016'; g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(560, 900, 0, 560, 900, 700); gr.addColorStop(0, 'rgba(60,100,120,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  fill(smoothPath([[-40, 520], [300, 600], [700, 540], [1120, 620], [1120, -40], [-40, -40]]), '#1a1612');
  fill(smoothPath([[-40, 1420], [300, 1340], [700, 1400], [1120, 1320], [1120, 1960], [-40, 1960]]), '#1a1612');
  limb([[-20, 980], [1100, 900]], 4, '#ffd23f', false);
  const x = lerp(-160, 1180, seg(T.c7, T.c8 + 0.3, t, x => x));
  carried(x - 60, 1000, 0.95, t);
  diver(x + 220, 960, 0.7, { t, beam: 0.6 });
  bubbles(t, x + 300, 920, 8, 30);
}
function saved(t) {
  mountainMouth(t, { rain: 0.4 });
  g.fillStyle = 'rgba(10,15,30,0.35)'; g.fillRect(0, 0, W, H);
  ambulance(260, 1620, 0.9, t); ambulance(780, 1660, 0.8, t + 0.3);
  for (let i = 0; i < 8; i++) drawBoy({ x: 120 + i * 120, y: 1840, s: 0.32, seed: 20 + i, t, shirt: ['#3a6ab8', '#2f8f4e', '#e9e4d6', '#ef8a2a'][i % 4], open: 0.5, smile: 0.9, arm: [40, -560], farArm: [-40, -560] });
}
function lesson(t) {
  caveWalls(t, { roof: 300 }); g.fillStyle = 'rgba(10,8,6,0.55)'; g.fillRect(0, 0, W, H);
  const k = clamp(sp(t, T.c9 + 0.05, 2.4, 8));
  g.save(); g.translate(540, 820); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  rrect(-440, -300, 880, 600, 24, Hd.NIGHT.paper);
  Hd.label('ЗАПОМНИ', 0, -210, 54, '#5a6a86', { fam: FONTS.mono, shadow: false, stroke: false });
  const steps = [['НЕ ПЛЫВИ', 'x', A.L9w5, '#d62828'], ['ЖДИ НА СУХОМ', 'check', A.L9w8, '#2f8f4e'], ['БЕРЕГИ СИЛЫ', 'battery', A.L9w13, '#ef8a2a']];
  steps.forEach(([s, ic, t0, c], i) => {
    const v = clamp((t - t0 + 0.05) / 0.25); if (v <= 0) return;
    g.save(); g.globalAlpha *= v; const x = -290 + i * 290;
    ell(x, -40, 80, 80, c); g.save(); g.translate(x, -40); Hd.icon(ic, 46, '#ffffff'); g.restore();
    Hd.label(s, x, 92, 32, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
    g.restore();
  });
  g.restore();
}
function next(t) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#141826'); gr.addColorStop(0.55, '#3a1f1a'); gr.addColorStop(1, '#14263a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.4; fill(polyPath([[200, 1100], [540, 640], [880, 1100]]), '#2a1c18'); ell(540, 640, 40, 30, '#ff6b2a');
  for (let i = 0; i < 10; i++) limb([[-50 + i * 130 + 30 * Math.sin(t + i), 1300 + 40 * (i % 3)], [40 + i * 130 + 30 * Math.sin(t + i), 1300 + 40 * (i % 3)]], 6, '#8ab4d9', false); g.restore();
}

// —— the 2D layer: what keeps them watching ——
function counter(x, y, title, val, c, w = 250) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.save();
  const h = 110; rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)'); g.lineWidth = 3; g.strokeStyle = c; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17));
  Hd.label(title, x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(String(val), x - w / 2, y + 38, 56, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function progress(t) {
  const a = clamp((t - T.c1 + 0.2) / 0.3) * (1 - seg(T.c9 - 0.3, T.c9, t));
  if (a <= 0.01 || (t >= T.c4 && t < T.under)) return;
  const marks = [['ВХОД', T.c1], ['ПОТОП', T.c2], ['10 ДНЕЙ', T.c3], ['СПАСЕНИЕ', T.c6]], x0 = 70, w = 940, y = 262, sw = w / marks.length;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  fill(rrPath(x0, y - 22, w, 44, 22), 'rgba(11,15,26,0.72)');
  marks.forEach(([s, t0], i) => {
    const nx = i + 1 < marks.length ? marks[i + 1][1] : T.c9, done = t >= nx, on = t >= t0 && !done, x = x0 + i * sw;
    if (done || on) fill(rrPath(x + 6, y - 16, (sw - 12) * (done ? 1 : clamp((t - t0) / (nx - t0))), 32, 16), done ? 'rgba(47,143,78,0.55)' : 'rgba(255,210,63,0.35)');
    text((done ? '✓ ' : '') + s, x + sw / 2, y + 9, 26, done ? '#c8f5d4' : on ? '#ffe9a0' : '#8b97ad', { fam: FONTS.mono, shadow: false });
  });
  g.restore();
}
function eggNote(t, t0, t1, s1, s2, y) {
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.3, t1, t));
  if (k <= 0.01) return;
  const w = Math.max(measure(s1, 40, FONTS.cond), measure(s2, 28, FONTS.mono)) + 180;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.02); g.scale(k, k);
  rrect(-w / 2 + 6, -60 + 8, w, 120, 22, INK); rrect(-w / 2, -60, w, 120, 22, '#fff3d6');
  drawDog({ x: -w / 2 + 70, y: 40, s: 0.26, face: 1, t, sit: 1 });
  text(s1, 55, -2, 40, INK, { fam: FONTS.cond, shadow: false });
  text(s2, 55, 38, 28, '#5a5f6e', { fam: FONTS.mono, shadow: false });
  g.restore();
}
function choice(t) {
  if (t < T.c4 || t >= T.under + 0.8) return;
  // STOP: two buttons and a countdown; then «Ждать!» lights up green, «плыть» red
  const k1 = clamp(sp(t, T.opts, 2.6, 8)), done = t >= A.L5w0 - 0.05;
  [['ПЛЫТЬ', -1], ['ЖДАТЬ', 1]].forEach(([s, side], i) => {
    const k = k1 * (1 - seg(T.under + 0.4, T.under + 0.8, t)); if (k <= 0.01) return;
    const c = done ? (side > 0 ? '#2f8f4e' : '#8a2a2a') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 230, 860); g.scale(k * (done && side > 0 ? 1 + 0.08 * bump(clamp((t - A.L5w0) / 0.3)) : 1), k);
    rrect(-200 + 6, -90 + 8, 400, 180, 30, INK); rrect(-200, -90, 400, 180, 30, c);
    text(s, 0, 30, 76, tc, { fam: FONTS.block, shadow: false });
    if (done) Hd.label(side > 0 ? '✓' : '✗', 160, -60, 60, '#ffffff', { shadow: false, stroke: false });
    g.restore();
  });
  if (t >= T.opts && !done) {        // the countdown under the buttons
    const u = clamp((t - T.opts) / Math.max(0.6, A.L5w0 - T.opts));
    g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1000, 700, 26, 13), 'rgba(255,255,255,0.18)'); fill(rrPath(190, 1000, 700 * (1 - u), 26, 13), GOLD);
    Hd.label('ДУМАЙ', 540, 1080, 40, '#ffffff', { fam: FONTS.mono });
  }
}
function overlays(t) {
  const sc = scene(t);
  if (sc === 'hook') {
    const tag = 'РЕАЛЬНАЯ ИСТОРИЯ', tw = measure(tag, 44, FONTS.cond) + 50;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(1020, 170); g.rotate(-0.03); rect(-tw + 6, -36 + 6, tw, 70, INK); rect(-tw, -36, tw, 70, '#ff4d4d'); text(tag, -tw / 2, 16, 44, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
    counter(380, 170, 'ВОДА', `+${Math.round(40 * seg(0, T.c1, t, x => x))} см`, DANGER, 300);
    Hd.ribbon(t, T.sleep, T.c1 - 0.05, 'ВО СНЕ?!', { y: 700, size: 96 });
  }
  progress(t);
  Hd.timeStamp(t, T.c1 + 0.15, T.c2 - 0.05, '23.06.2018 · ТАИЛАНД', { color: WARM });
  if (sc === 'flood') Hd.plaque(t, T.km, T.c3 - 0.05, 540, 330, { icon: 'x', title: '4 КМ ПОД ГОРОЙ', sub: 'выход под водой', color: DANGER, size: 46 });
  if (sc === 'drip') {
    Hd.plaque(t, T.drink + 0.2, T.c4 - 0.05, 540, 330, { icon: 'drop', title: 'ТОЛЬКО С ПОТОЛКА', sub: 'чистая вода капает со скалы', color: OK, size: 42 });
    Hd.plaque(t, T.drink + 0.6, T.c4 - 0.05, 540, 480, { icon: 'x', title: 'НЕ ИЗ ЛУЖИ', sub: 'мутная вода — болезни', color: DANGER, size: 40 });
  }
  if (sc === 'stop') { const ks = sp(t, T.c4, 2.2, 8); if (ks > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.06); const z = lerp(1.8, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
    const s = 'СТОП', sw = measure(s, 120) + 90; rrect(-sw / 2 + 10, -84 + 10, sw, 168, 20, INK); rrect(-sw / 2, -84, sw, 168, 20, '#d62828'); text(s, 0, 40, 120, '#fff3d6', { shadow: false }); g.restore(); } }
  choice(t);
  if (sc === 'under') Hd.plaque(t, A.L5w3, T.c6 - 0.05, 540, 400, { icon: 'x', title: 'КИЛОМЕТРЫ ПОД ВОДОЙ', sub: 'в темноте, а плавать не умеют', color: DANGER, size: 40 });
  if (sc === 'divers') { counter(1020, 150, 'ДЕНЬ', 10, GOLD); Hd.plaque(t, T.up + 0.2, T.c7 - 0.05, 540, 400, { icon: 'check', title: 'НАШЛИ!', sub: '02.07.2018 · день 10', color: OK, size: 52 }); }
  if (sc === 'carry') {
    if (t > T.zz) { g.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 3; i++) { const u = ((t - T.zz) * 0.8 + i / 3) % 1; Hd.label('z', 300 + 60 * i + 30 * u, 760 - 160 * u - 30 * i, 40 + 20 * i, `rgba(255,255,255,${1 - u})`, { fam: FONTS.block, shadow: false }); } }
    Hd.ribbon(t, T.how, T.c8 - 0.05, 'ВОТ КАК: ВО СНЕ', { y: 560, size: 80 });
  }
  if (sc === 'saved') {
    counter(1020, 330, 'СПАСЕНЫ', `${Math.min(13, Math.round(13 * seg(T.c8, T.c8 + 1.0, t, x => x)))}/13`, OK, 280);
    const ks = sp(t, A.L8w2, 2.2, 8); if (ks > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 600); g.rotate(-0.06); const z = lerp(1.8, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
      const s = 'ВСЕ СПАСЕНЫ', sw = measure(s, 96) + 80; rrect(-sw / 2 + 10, -74 + 10, sw, 148, 20, INK); rrect(-sw / 2, -74, sw, 148, 20, '#2f8f4e'); text(s, 0, 32, 96, '#fff3d6', { shadow: false }); g.restore(); }
  }
  // Пурга, hidden
  for (const [sc_, x, y, s, f] of EGGS) if (sc === sc_) { g.setTransform(1, 0, 0, 1, 0, 0); drawDog({ x, y, s, face: f, t, sit: 1 }); }
  eggNote(t, A.L0w5, T.c1 - 0.05, 'ПАСХАЛКА: ПУРГА 3 РАЗА', 'спрятана в серии — найди', 1700);
  if (t >= T.c10) {
    [['1', 'ЦУНАМИ НА ПЛЯЖЕ', A.L10w1], ['2', 'ИЗВЕРЖЕНИЕ ВУЛКАНА', A.L10w5]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c11, T.c11 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 640 + i * 140;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  eggNote(t, T.c11 - 0.1, DUR + 1, 'НАШЁЛ ПУРГУ 3 РАЗА?', 'пиши секунды в комментариях', 920);
  Hd.endCard(t, T.c11, 0, 300);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 900); g.scale(z, z); g.translate(-540, -900); }
  ({ hook, mouth: tt => mouth(tt, 0), rainy: tt => mouth(tt, 1), flood, drip, stop, under, divers, carry, saved, lesson, next })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.0, 'drip', -12, 0, { dur: T.c1 }); add(0.0, 'tap_run', -18, 0, { dur: T.c1 });
  add(T.sleep, 'stamp', -8, 0);
  add(T.c1, 'tweet', -16, 0.3, { dur: 1.2 }); add(T.c1 + 0.2, 'steps_out', -12, 0, { dur: T.rain - T.c1 - 0.2 });
  add(T.rain, 'rain', -6, 0, { dur: T.c3 - T.rain }); add(T.rain + 0.1, 'thunder', -10, -0.3, { dur: 3.0, near: 0.4 });
  add(T.c2, 'tap_run', -12, 0, { dur: T.c3 - T.c2 }); add(T.km, 'whoosh_in', -10, 0);
  add(T.c3, 'drip', -8, 0.1, { dur: T.c4 - T.c3 });
  add(T.c4, 'stamp', -6, 0); add(T.opts, 'ticks_up', -16, 0, { dur: Math.max(0.6, A.L5w0 - T.opts) }); add(T.opts, 'heartbeat', -16, 0, { dur: A.L5w0 - T.opts, bpm: 110 });
  add(A.L5w0, 'ding', -8, 0.2);
  add(T.under, 'fill_plink', -14, 0, { dur: T.c6 - T.under });
  add(T.up, 'pour', -10, 0); add(T.up + 0.2, 'breath', -12, 0.2, { dur: 1.5 });
  add(T.c7, 'fill_plink', -14, 0, { dur: T.c8 - T.c7 }); add(T.how, 'stamp', -8, 0);
  add(T.c8, 'crowd_roar', -8, 0, { dur: T.c9 - T.c8 }); add(A.L8w2, 'stamp', -6, 0);
  add(T.c9, 'paper', -12, 0); for (const t0 of [A.L9w5, A.L9w8, A.L9w13]) add(t0 + 0.02, 'pop_word', -12, 0);
  for (let i = 0; i < 2; i++) add((i ? A.L10w5 : A.L10w1) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(T.c11, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
