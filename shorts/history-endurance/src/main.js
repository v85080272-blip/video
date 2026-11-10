// «Корабль раздавило льдом» — a picture story: ten realistic images (generated in Codex by the channel's owner, saved as
// img/01.png … img/10.png, png or jpg) with a slow camera over each (zoom and drift), the narrator, karaoke subtitles,
// a few plaques and a map, ≈42 s. On the rules of the Studio export (10.11): the hook from 0 s on a bright frame (the ship
// crushed in white ice, «ЛЁД РАЗДАВИЛ КОРАБЛЬ», «КАК ВЫЖИЛИ ВСЕ 28?»), a STOP with two buttons and a countdown in the
// middle, the answer at the end, the last frame (the ship on the sea floor) leading back to the first (the ship in the
// ice). Until an image is there, its shot is a labelled placeholder, so the timing can be checked before the pictures.
import fs from 'node:fs';
import { loadImage } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, rrPath } from './flat.js';
import * as Hd from './hud.js';
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
const HOT = { РАЗДАВИЛО: DANGER, АНТАРКТИДЫ: GOLD, ЛЬДИНЕ: GOLD, ОСТРОВА: GOLD, СТОП: GOLD, ЖДАТЬ: GOLD, ПЛЫТЬ: GOLD, БУРНОМУ: DANGER,
  ПЯТЕРЫХ: GOLD, КИЛОМЕТРОВ: GOLD, ШТОРМА: DANGER, ЛЕДЯНЫЕ: DANGER, ЧЕТВЁРТОЙ: GOLD, ВСЕХ: OK, ВЫЖИЛИ: OK, ВОСЕМЬ: OK, ДНЕ: GOLD,
  ПОДПИСЫВАЙСЯ: GOLD };

// the images: img/NN.png or .jpg, loaded once (top-level await: render.mjs imports this module before it draws)
const IMG = {};
for (let i = 1; i <= 10; i++) {
  const k = String(i).padStart(2, '0');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const u = new URL(`../img/${k}.${ext}`, import.meta.url);
    if (fs.existsSync(u)) { IMG[k] = await loadImage(fs.readFileSync(u)); break; }
  }
}
const LABEL = { '01': 'корабль во льду', '02': 'лагерь на льдине', '03': 'шлюпки во льдах', '04': 'пустой остров', '05': 'шлюпка и волны',
  '06': 'шторм ночью', '07': 'через горы', '08': 'китобойная станция', '09': 'спасение', '10': 'корабль на дне' };

// L3: Стоп(0) Что(1) бы(2) сделал(3) ты(4) ждать(5) на(6) острове(7) или(8) плыть(9) за(10) помощью(11) по(12) самому(13) бурному(14) морю(15)
// L4: Никто(0) не(1) знает(2) где(3) они(4) Командир(5) берёт(6) пятерых(7) и(8) плывёт(9) тысячу(10) триста(11) километров(12)
// L5: Шестнадцать(0) дней(1) шторма(2) потом(3) пешком(4) через(5) ледяные(6) горы(7) —(8) к(9) китобоям(10)
// L7: Выжили(0) все(1) двадцать(2) восемь(3) А(4) корабль(5) нашли(6) на(7) дне(8) только(9) через(10) сто(11) семь(12) лет(13)
const T = { c3: A.L3 - 0.06, ans: A.L4w5 - 0.05, c4: A.L4 - 0.06 };
// the shots: [image, from, to, zoom from → to, drift (px over the shot, x, y)]
const SHOTS = [
  ['01', 0, A.L1 - 0.06, 1.08, 1.18, [-30, 10]],
  ['02', A.L1 - 0.06, A.L2 - 0.06, 1.15, 1.05, [40, 0]],
  ['03', A.L2 - 0.06, A.L2w2 - 0.06, 1.05, 1.14, [0, -20]],
  ['04', A.L2w2 - 0.06, A.L3 - 0.06, 1.12, 1.04, [-40, 0]],
  ['05', A.L3 - 0.06, A.L4 - 0.06, 1.04, 1.16, [0, 20]],
  ['06', A.L4 - 0.06, A.L5w3 - 0.06, 1.16, 1.06, [30, -10]],
  ['07', A.L5w3 - 0.06, A.L5w9 - 0.06, 1.05, 1.15, [-30, 0]],
  ['08', A.L5w9 - 0.06, A.L6 - 0.06, 1.14, 1.06, [20, 10]],
  ['09', A.L6 - 0.06, A.L7w4 - 0.06, 1.06, 1.16, [0, -20]],
  ['10', A.L7w4 - 0.06, DUR + 0.1, 1.04, 1.2, [0, 30]],
];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w2, A.L3w0, A.L4w5, A.L7w0, A.L7w11];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.06 * z; }

// one image filling the frame (cover), zoomed and drifting
function cover(img, z, dx, dy) {
  const s = Math.max(W / img.width, H / img.height) * z, w = img.width * s, h = img.height * s;
  g.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}
function placeholder(k, z) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#6f8fa8'); gr.addColorStop(1, '#2a3a4a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 960); g.scale(z, z); text('КАДР ' + k, 0, -20, 90, '#ffffff', { shadow: false }); text(LABEL[k], 0, 60, 46, '#dfe8f0', { fam: FONTS.cond, shadow: false }); g.restore();
}
function shot(t) {
  const i = SHOTS.findIndex(s => t >= s[1] && t < s[2]); const [k, t0, t1, z0, z1, [dx, dy]] = SHOTS[i < 0 ? SHOTS.length - 1 : i];
  const u = clamp((t - t0) / (t1 - t0)), z = lerp(z0, z1, ease.inOut(u));
  if (IMG[k]) cover(IMG[k], z, dx * (u - 0.5) * 2, dy * (u - 0.5) * 2); else placeholder(k, z);
}

// —— the 2D layer ——
function headline(t) {
  if (t > A.L1 + 0.2) return;
  const a = 1 - seg(A.L1 - 0.3, A.L1 + 0.1, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = 'ЛЁД РАЗДАВИЛ КОРАБЛЬ', sw = measure(s, 78) + 80; rrect(-sw / 2 + 10, -64 + 10, sw, 128, 22, INK); rrect(-sw / 2, -64, sw, 128, 22, '#ffd23f'); text(s, 0, 30, 78, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, A.L1 - 0.1, 'КАК ВЫЖИЛИ ВСЕ 28?', { y: 520, size: 76 });
}
function choice(t) {
  if (t < T.c3 || t >= A.L4w9) return;
  const done = t >= T.ans;
  [['1', 'ЖДАТЬ НА ОСТРОВЕ', -1, A.L3w5], ['2', 'ПЛЫТЬ ЗА ПОМОЩЬЮ', 1, A.L3w9]].forEach(([n, s, side, t0]) => {
    const k = clamp(sp(t, t0 - 0.08, 2.6, 8)) * (1 - seg(A.L4w9 - 0.4, A.L4w9, t)); if (k <= 0.01) return;
    const pick = side > 0, c = done ? (pick ? '#2f8f4e' : 'rgba(80,80,90,0.85)') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 240, 1180); g.scale(k * (done && pick ? 1 + 0.1 * bump(clamp((t - T.ans) / 0.3)) : 1), k);
    rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
    text(n, 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
    text(s, 0, 62, 36, tc, { fam: FONTS.cond, shadow: false });
    if (done && pick) Hd.label('ТАК ОН И СДЕЛАЛ', 0, -130, 34, '#ffffff', { fam: FONTS.mono });
    g.restore();
  });
  if (t >= A.L3e && t < A.L4 - 0.05) {
    const u = clamp((t - A.L3e) / Math.max(0.6, A.L4 - A.L3e));
    g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1320, 700, 26, 13), 'rgba(255,255,255,0.25)'); fill(rrPath(190, 1320, 700 * (1 - u), 26, 13), GOLD);
    Hd.label('ДУМАЙ', 540, 1400, 44, '#ffffff', { fam: FONTS.mono });
  }
  if (t < A.L3w1) {
    const k = clamp(sp(t, A.L3w0 - 0.05, 3, 7));
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 700); g.rotate(-0.12); g.scale(lerp(1.8, 1, Math.min(1, k)), lerp(1.8, 1, Math.min(1, k))); g.globalAlpha = Math.min(1, k * 3) * (1 - seg(A.L3w1 - 0.15, A.L3w1 + 0.1, t));
    rrect(-250 + 10, -100 + 10, 500, 200, 26, INK); rrect(-250, -100, 500, 200, 26, '#d62828'); text('СТОП', 0, 50, 140, '#fff3d6', { shadow: false }); g.restore();
  }
}
// the route of the boat: the island, the dotted line, the boat moving to the whaling island, 1300 km
function routeMap(t, t0, t1) {
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.3, t1, t)); if (k <= 0.01) return;
  const u = seg(t0 + 0.2, t1 - 0.4, t, x => x);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 520); g.scale(k, k);
  rrect(-400 + 8, -170 + 10, 800, 340, 26, 'rgba(0,0,0,0.5)'); rrect(-400, -170, 800, 340, 26, 'rgba(18,40,64,0.92)');
  ell(-280, 60, 60, 34, '#e8eef4'); ell(300, -50, 80, 30, '#e8eef4');
  g.save(); g.setLineDash([18, 14]); limb([[-240, 40], [-60, -10], [120, -40], [240, -50]], 6, 'rgba(255,255,255,0.6)', false); g.restore();
  const bx = lerp(-240, 240, u), by = lerp(40, -50, u) - 8 * Math.sin(t * 6); poly([[bx - 26, by], [bx + 26, by], [bx + 16, by + 14], [bx - 16, by + 14]], '#c98a2a'); limb([[bx, by], [bx, by - 40]], 4, '#e8e2d4', false); poly([[bx + 2, by - 38], [bx + 24, by - 10], [bx + 2, by - 10]], '#f4efe6');
  g.fillStyle = '#ffffff'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.fillText('ОСТРОВ ЭЛЕФАНТ', -280, 125); g.fillText('ЮЖНАЯ ГЕОРГИЯ', 300, 10);
  text('1300 КМ', 0, -100, 56, '#ffd23f', { fam: FONTS.mono, shadow: false });
  g.restore();
}
function plaques(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  Hd.timeStamp(t, A.L1, A.L3 - 0.1, '1915 · АНТАРКТИДА', { color: WARM, y: 200 });
  routeMap(t, A.L4w9 - 0.1, A.L5w3);
  P(A.L5w0, A.L5w9 - 0.05, 320, { icon: 'cloud', title: '16 ДНЕЙ ШТОРМА', color: DANGER, size: 46 });
  P(A.L6w0, A.L7 - 0.05, 320, { icon: 'check', title: 'С ЧЕТВЁРТОЙ ПОПЫТКИ', color: OK, size: 46 });
  if (t > A.L7 && t < A.L7w4) {
    const k = clamp(sp(t, A.L7, 2.6, 8)); g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.rotate(-0.06); g.scale(k, k);
    rrect(-300 + 10, -90 + 10, 600, 180, 26, INK); rrect(-300, -90, 600, 180, 26, '#2f8f4e'); text('ВЫЖИЛИ 28 ИЗ 28', 0, 30, 76, '#ffffff', { shadow: false }); g.restore();
  }
  P(A.L7w5, DUR + 1, 320, { icon: 'drop', title: 'НАЙДЕН В 2022 · ГЛУБИНА 3008 М', color: GOLD, size: 38 });
  P(A.L8w0, DUR + 1, 440, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, КТО ЛЮБИТ ТАКИЕ ИСТОРИИ', color: GOLD, size: 34 });
}
function grade(t) {
  // a cool cinematic grade and a soft vignette over every picture, so they sit together
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(20,40,70,0.10)'; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(540, 960, 500, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const sb = g.createLinearGradient(0, 1300, 0, 1920); sb.addColorStop(0, 'rgba(0,0,0,0)'); sb.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = sb; g.fillRect(0, 1300, W, 620);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 960); g.scale(z, z); g.translate(-540, -960); }
  shot(t);
  grade(t);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip * 0.8; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); plaques(t); choice(t);
  Hd.endCard(t, A.L8w6 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.2);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'ice_wind', -16, 0, { dur: A.L2w2 }); add(0.02, 'ice_crack', -8, 0); add(0.5, 'ice_crack', -14, 0.3);
  add(A.L2w2 - 0.1, 'ice_water', -16, 0, { dur: A.L3 - A.L2w2 + 0.2 });
  add(A.L3w0 - 0.05, 'stamp', -6, 0); add(A.L3w5 - 0.08, 'pop_word', -10, -0.3); add(A.L3w9 - 0.08, 'pop_word', -10, 0.3);
  add(A.L3e, 'ticks_up', -14, 0, { dur: Math.max(0.6, A.L4 - A.L3e - 0.05) });
  add(A.L4, 'wave_roar', -14, 0, { dur: A.L5w3 - A.L4 + 0.5 }); add(T.ans, 'ding', -8, 0);
  add(A.L5w3, 'ice_wind', -14, 0, { dur: A.L5w9 - A.L5w3 }); add(A.L5w9, 'gulls', -18, 0.3, { dur: 2.0 });
  add(A.L6, 'ice_crack', -10, 0); add(A.L7, 'ding', -10, 0); add(A.L7w4, 'ice_water', -18, 0, { dur: DUR - A.L7w4 });
  add(A.L8w6 - 0.1, 'pop_word', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
