// «Радиоактивные кабаны Германии» (series «Жизнь в Чернобыле»): eight photorealistic Codex frames (img/01–08), the
// ElevenLabs narrator, karaoke subtitles, plaques, «ИИ-реконструкция». Bavarian boars are still radioactive while deer
// are not → the cesium's fingerprint is older than Chernobyl: 1960s weapons tests, up to two thirds in some samples →
// boars dig deer truffles, which take up cesium decades late. Built from izhma-landing by scratchpad/gen/series.py.
// Facts: voice/script.json.
import fs from 'node:fs';
import { loadImage } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';
import * as B from './bait.js';

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
  for (let i = 0; i < Math.max(n, FB[id][2]) + 20; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1500; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words.map(w => ({ ...w, w: w.w.replace(/\+/g, '') })), 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ГЕРМАНИИ: GOLD, РАДИОАКТИВНЫХ: DANGER, КАБАНОВ: GOLD, НЕЛЬЗЯ: DANGER, ЦЕЗИЯ: DANGER, НОРМЫ: DANGER, ЧЕРНОБЫЛЯ: GOLD,
  ОЛЕНЕЙ: OK, МЕНЬШЕ: OK, НЕТ: DANGER, СТАРШЕ: GOLD, ЯДЕРНЫЕ: DANGER, ИСПЫТАНИЯ: DANGER, ШЕСТИДЕСЯТЫХ: GOLD, ТРЕТЕЙ: GOLD,
  ТРЮФЕЛИ: GOLD, ПОДЗЕМНЫХ: GOLD, ДЕСЯТКИ: GOLD, РАДИОАКТИВНЫ: DANGER, ИСТОРИЮ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the images: img/NN.png or .jpg, loaded once (top-level await: render.mjs imports this module before it draws)
const IMG = {};
for (let i = 1; i <= 8; i++) {
  const k = String(i).padStart(2, '0');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const u = new URL(`../img/${k}.${ext}`, import.meta.url);
    if (fs.existsSync(u)) { IMG[k] = await loadImage(fs.readFileSync(u)); break; }
  }
}
const LABEL = { '01': 'кабан в лесу', '02': 'кабан роет', '03': 'тучи 1986', '04': 'испытание 1960-х', '05': 'трюфели', '06': 'лаборатория', '07': 'лесник', '08': 'кабаниха с поросятами' };

// L4: Это(0) ядерные(1) испытания(2) шестидесятых(3) В(4) некоторых(5) пробах(6) —(7) до(8) двух(9) третей(10) всего(11) цезия(12)
// L7: Поэтому(0) кабаны(1) радиоактивны(2) до(3) сих(4) пор(5) Знал(6) эту(7) историю(8) Пиши(9) И(10) подписывайся(11)
const T = { cover: 0.05, sub: A.L7w11 };
// the shots: [image, from, to, zoom from → to, drift (px over the shot, x, y)]
const SHOTS = [
  ['01', 0, A.L1 - 0.06, 1.05, 1.2, [0, 20]],
  ['07', A.L1 - 0.06, A.L2 - 0.06, 1.16, 1.05, [20, 0]],
  ['03', A.L2 - 0.06, A.L3 - 0.06, 1.04, 1.15, [-20, 0]],
  ['06', A.L3 - 0.06, A.L4 - 0.06, 1.05, 1.16, [0, -20]],
  ['04', A.L4 - 0.06, A.L5 - 0.06, 1.15, 1.04, [0, 20]],
  ['02', A.L5 - 0.06, A.L6 - 0.06, 1.04, 1.16, [20, 0]],
  ['05', A.L6 - 0.06, A.L7 - 0.06, 1.05, 1.18, [0, -20]],
  ['08', A.L7 - 0.06, DUR + 0.1, 1.04, 1.16, [0, 20]],
];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, c3: A.L3 - 0.06, ans: A.L4w0 - 0.05, hit0: A.L0w7, pulse: A.L1w0, stop: A.L3w7, stopE: A.L3e, go: A.L4w0, climax: A.L5w0, win: A.L5w2, calm: A.L7 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w7, A.L2w15, A.L3w7, A.L4w1, A.L5w2, A.L7w0];
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
  const a = 1 - seg(A.L1 - 0.3, A.L1 + 0.1, t), k = clamp(sp(t, 0.02, 2.6, 8));
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03); g.scale(k, k);
  const s = 'РАДИОАКТИВНЫЕ КАБАНЫ', sw = measure(s, 68) + 80; rrect(-sw / 2 + 10, -60 + 10, sw, 120, 22, INK); rrect(-sw / 2, -60, sw, 120, 22, '#ffd23f'); text(s, 0, 28, 68, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, A.L1 - 0.1, 'ОТКУДА В НИХ ЦЕЗИЙ?', { y: 510, size: 70 });
}
function stampBig(t, t0, t1, str, color) {
  if (t < t0 || t > t1) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.25, t1, t)); g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.rotate(-0.06); g.scale(k, k);
  const w = measure(str, 70) + 90; rrect(-w / 2 + 10, -90 + 10, w, 180, 26, INK); rrect(-w / 2, -90, w, 180, 26, color); text(str, 0, 28, 70, '#ffffff', { shadow: false }); g.restore();
}
function plaques(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  Hd.timeStamp(t, A.L1, A.L4 - 0.1, 'БАВАРИЯ · ГЕРМАНИЯ', { color: WARM, y: 200 });
  P(A.L1w7, A.L2 - 0.05, 320, { icon: 'x', title: 'ЦЕЗИЙ ВЫШЕ НОРМЫ', color: DANGER, size: 48 });
  P(A.L2w8, A.L3 - 0.05, 320, { icon: 'check', title: 'У ОЛЕНЕЙ — МЕНЬШЕ', color: OK, size: 46 });
  P(A.L2w15, A.L3 - 0.05, 440, { icon: 'x', title: 'У КАБАНОВ — НЕТ', color: DANGER, size: 46 });
  stampBig(t, A.L3w7 - 0.05, A.L4 - 0.05, 'СТАРШЕ ЧЕРНОБЫЛЯ', '#d62828');
  P(A.L4w0, A.L5 - 0.05, 320, { icon: 'bolt', title: 'ЯДЕРНЫЕ ИСПЫТАНИЯ 1960-Х', color: DANGER, size: 42 });
  P(A.L4w8, A.L5 - 0.05, 440, { icon: 'check', title: 'ДО 68% ЦЕЗИЯ', color: GOLD, size: 48 });
  P(A.L5w2, A.L6 - 0.05, 320, { icon: 'check', title: 'ОЛЕНЬИ ТРЮФЕЛИ', sub: 'подземные грибы', color: GOLD, size: 48 });
  P(A.L6w12, A.L7 - 0.05, 320, { icon: 'clock', title: 'ЧЕРЕЗ ДЕСЯТКИ ЛЕТ', color: GOLD, size: 46 });
  P(A.L7w6, DUR + 1, 330, { icon: 'comment', title: 'ЗНАЛ ЭТУ ИСТОРИЮ? ПИШИ', color: GOLD, size: 40 });
}
// the «bait» cover on the first frames (also the thumbnail)
function coverFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (IMG['01']) cover(IMG['01'], 1.12, 0, 0); else placeholder('01', 1);
  const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 900);
  B.vignette(0.4);
  B.plate('ГЕРМАНИЯ', 540, 150, 42, '#ff2d2d');
  B.outlined('РАДИОАКТИВНЫЕ', 540, 370, 170, '#ffffff', { maxW: 1000 });
  B.outlined('КАБАНЫ?!', 540, 550, 150, '#ffd23f', { maxW: 1000 });
  B.plate('ЧЕРНОБЫЛЬ НИ ПРИ ЧЁМ?', 540, 1450, 60, '#ffd23f', INK, -0.03);
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
  if (t < T.cover) { coverFrame(); Hd.finish(t, 0.2); return; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 960); g.scale(z, z); g.translate(-540, -960); }
  shot(t);
  grade(t);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip * 0.8; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); plaques(t);
  Hd.label('ИИ-РЕКОНСТРУКЦИЯ', 175, 1880, 24, 'rgba(255,255,255,0.6)', { fam: FONTS.mono });
  Hd.endCard(t, T.sub - 0.1, 0, 560);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.2);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'roof_wind', -18, 0, { dur: A.L2 }); add(0.2, 'snort', -10, 0.2); add(A.L0w7, 'whoosh_in', -12, 0);
  add(A.L1 - 0.06, 'whoosh', -14, 0); add(A.L1w7, 'alert', -16, 0);
  add(A.L2 - 0.06, 'rain', -18, 0, { dur: A.L3 - A.L2 }); add(A.L2w15, 'stamp', -10, 0);
  add(A.L3 - 0.06, 'beep', -14, 0); add(A.L3w7, 'stamp', -6, 0);
  add(A.L4 - 0.06, 'rumble', -8, 0, { dur: 2.0 }); add(A.L4 + 0.2, 'thunder', -12, 0);
  add(A.L5 - 0.06, 'snort', -10, -0.2); add(A.L5w4, 'scrape', -8, 0); add(A.L5w2, 'ding', -10, 0);
  add(A.L6 - 0.06, 'whoosh_in', -14, 0); add(A.L6, 'drip', -20, 0, { dur: A.L7 - A.L6 });
  add(A.L7 - 0.06, 'whoosh', -14, 0); add(A.L7, 'morning', -18, 0, { dur: DUR - A.L7 }); add(A.L7 + 0.3, 'tweet', -20, 0.3, { dur: 2.0 });
  add(T.sub - 0.1, 'pop_word', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
