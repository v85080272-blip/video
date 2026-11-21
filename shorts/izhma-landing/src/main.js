// «Полоса в тайге» — a picture story: ten photorealistic frames drawn in Codex on the owner's computer (img/01.png …
// img/10.png, 1080×1920) with a slow camera over each, the narrator, karaoke subtitles, plaques, ≈40 s. Komi, 7 Sept 2010:
// a Tu-154 loses all its electrics over the taiga, the instruments and fuel pumps die, half an hour of fuel → an abandoned
// strip, nearly half the length needed → they land without flaps, overrun into the birches and
// stop; all 81 alive → the secret: Sergey Sotnikov kept the closed strip clear for 12 years on his own. Built on «Трое под
// реактором» (chernobyl-divers). The cover (the first frames and the thumbnail) is the «bait»: src/bait.js. Facts:
// voice/script.json.
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
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { СЕНТЯБРЬ: GOLD, ТАЙГОЙ: GOLD, ЭЛЕКТРИЧЕСТВО: DANGER, ПОГАСЛИ: DANGER, НАСОСЫ: DANGER, ТРИДЦАТЬ: DANGER,
  ВОСЬМИДЕСЯТИ: GOLD, ОДНОГО: OK, ВСЛЕПУЮ: DANGER, ЛЕС: GOLD, НЕТ: DANGER, ВДРУГ: GOLD, ЗАБРОШЕННАЯ: GOLD, ВДВОЕ: DANGER, ИСТОРИЮ: GOLD,
  ЗАКРЫЛКОВ: DANGER, СКОРОСТИ: DANGER, БЕРЕЗНЯК: GOLD, ОСТАНАВЛИВАЕТСЯ: OK, ЖИВЫ: OK, ПОСТРАДАЛ: OK, СЕКРЕТ: GOLD,
  СОТНИКОВ: GOLD, ДВЕНАДЦАТЬ: GOLD, ЗАРОСЛА: GOLD, НАГРАДИЛИ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the images: img/NN.png or .jpg, loaded once (top-level await: render.mjs imports this module before it draws)
const IMG = {};
for (let i = 1; i <= 10; i++) {
  const k = String(i).padStart(2, '0');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const u = new URL(`../img/${k}.${ext}`, import.meta.url);
    if (fs.existsSync(u)) { IMG[k] = await loadImage(fs.readFileSync(u)); break; }
  }
}
const LABEL = { '01': 'самолёт над тайгой', '02': 'приборы погасли', '03': 'салон без света', '04': 'тайга внизу', '05': 'заброшенная полоса',
  '06': 'заход на посадку', '07': 'в березняке', '08': 'все живы', '09': 'Сотников и кусты', '10': 'полоса на закате' };

// L4: И(0) вдруг(1) впереди(2) —(3) заброшенная(4) полоса(5) Почти(6) вдвое(7) короче(8) нужной(9)
// L5: Садятся(0) —(1) без(2) закрылков(3) на(4) огромной(5) скорости(6)
// L8: А(0) секрет(1) такой(2) аэропорт(3) давно(4) закрыли(5) Но(6) Сергей(7) Сотников(8) двенадцать(9) лет(10) сам(11) следил(12) чтобы(13) полоса(14) не(15) заросла(16) …
// L9: Позже(0) его(1) наградили(2) Знал(3) эту(4) историю(5) Пиши(6) И(7) подписывайся(8)
const T = { cover: 0.05, sub: A.L9w8 };
// the shots: [image, from, to, zoom from → to, drift (px over the shot, x, y)]
const SHOTS = [
  ['01', 0, A.L1 - 0.06, 1.06, 1.18, [40, 0]],
  ['02', A.L1 - 0.06, A.L2 - 0.06, 1.16, 1.05, [0, 20]],
  ['03', A.L2 - 0.06, A.L3 - 0.06, 1.04, 1.16, [0, -30]],
  ['04', A.L3 - 0.06, A.L4 - 0.06, 1.05, 1.14, [-20, 10]],
  ['05', A.L4 - 0.06, A.L5 - 0.06, 1.04, 1.22, [-30, -40]],
  ['06', A.L5 - 0.06, A.L6 - 0.06, 1.05, 1.15, [30, 0]],
  ['07', A.L6 - 0.06, A.L7 - 0.06, 1.16, 1.06, [0, 20]],
  ['08', A.L7 - 0.06, A.L8 - 0.06, 1.05, 1.15, [-20, 0]],
  ['09', A.L8 - 0.06, A.L9 - 0.06, 1.06, 1.16, [0, -20]],
  ['10', A.L9 - 0.06, DUR + 0.1, 1.04, 1.18, [0, 20]],
];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, c3: A.L4 - 0.06, ans: A.L5w0 - 0.05, hit0: A.L0w9, pulse: A.L2w0, stop: A.L4w1, stopE: A.L4e, go: A.L5w0, climax: A.L6w9, win: A.L7w0, calm: A.L8 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w9, A.L1w0, A.L4w1, A.L5w0, A.L6w9, A.L7w0, A.L8w1];
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
  const s = 'ОТКАЗАЛО ВСЁ', sw = measure(s, 84) + 80; rrect(-sw / 2 + 10, -64 + 10, sw, 128, 22, INK); rrect(-sw / 2, -64, sw, 128, 22, '#ffd23f'); text(s, 0, 30, 84, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, A.L1 - 0.1, 'ГДЕ САДИТЬСЯ В ТАЙГЕ?', { y: 520, size: 72 });
}
function stampBig(t, t0, t1, str, color) {
  if (t < t0 || t > t1) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.25, t1, t)); g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.rotate(-0.06); g.scale(k, k);
  const w = measure(str, 70) + 90; rrect(-w / 2 + 10, -90 + 10, w, 180, 26, INK); rrect(-w / 2, -90, w, 180, 26, color); text(str, 0, 28, 70, '#ffffff', { shadow: false }); g.restore();
}
function plaques(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  Hd.timeStamp(t, A.L1, A.L4 - 0.1, '7 СЕНТЯБРЯ 2010 · КОМИ', { color: WARM, y: 200 });
  P(A.L1w5, A.L2 - 0.05, 320, { icon: 'clock', title: 'ТОПЛИВА — НА 30 МИНУТ', color: DANGER, size: 46 });
  P(A.L2w0, A.L3 - 0.05, 320, { icon: 'check', title: '81 ЧЕЛОВЕК НА БОРТУ', color: GOLD, size: 46 });
  P(A.L3w7, A.L4 - 0.05, 320, { icon: 'x', title: 'АЭРОПОРТА НЕТ', color: DANGER, size: 50 });
  P(A.L4w4, A.L5 - 0.05, 320, { icon: 'x', title: 'ПОЛОСА 1300 М — ВДВОЕ КОРОЧЕ', color: DANGER, size: 40 });
  P(A.L5w2, A.L6 - 0.05, 320, { icon: 'x', title: 'БЕЗ ЗАКРЫЛКОВ', color: DANGER, size: 50 });
  stampBig(t, A.L6w9 - 0.05, A.L7 - 0.05, 'ОСТАНОВИЛСЯ', '#2f8f4e');
  stampBig(t, A.L7w0 - 0.05, A.L8 - 0.05, 'ВСЕ 81 ЖИВЫ', '#2f8f4e');
  P(A.L8w1 - 0.05, A.L9 - 0.05, 200, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 54 });
  P(A.L8w7, A.L9 - 0.05, 330, { icon: 'check', title: 'СЕРГЕЙ СОТНИКОВ · 12 ЛЕТ', color: GOLD, size: 42 });
  P(A.L9w0, DUR + 1, 320, { icon: 'check', title: 'МЕДАЛЬ В 2012-М', color: GOLD, size: 46 });
  P(A.L9w3, DUR + 1, 440, { icon: 'comment', title: 'ЗНАЛ ЭТУ ИСТОРИЮ? ПИШИ', color: GOLD, size: 40 });
}
// the «bait» cover on the first frames: the plane over the taiga, «ГДЕ САДИТЬСЯ? / ВНИЗУ ТАЙГА!»
function coverFrame() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (IMG['01']) cover(IMG['01'], 1.12, 40, 0); else placeholder('01', 1);
  const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 900);
  B.vignette(0.4);
  B.plate('РЕАЛЬНАЯ ИСТОРИЯ', 540, 150, 42, '#ff2d2d');
  B.outlined('ГДЕ САДИТЬСЯ?', 540, 360, 150, '#ffffff', { maxW: 1000 });
  B.outlined('ВНИЗУ ТАЙГА!', 540, 530, 140, '#ffd23f', { maxW: 1000 });
  B.plate('ОТКАЗАЛО ВСЁ', 540, 1450, 64, '#ffd23f', INK, -0.03);
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
  Hd.endCard(t, T.sub - 0.1, 0, 560);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.2);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'roof_wind', -16, 0, { dur: A.L2 }); add(0.1, 'rumble', -18, 0, { dur: A.L1 });
  add(A.L0w9, 'power_down', -8, 0); add(A.L1 - 0.06, 'hum_stop', -10, 0); add(A.L1w0, 'click', -8, 0);
  add(A.L2 - 0.06, 'heartbeat', -16, 0, { dur: A.L4 - A.L2 }); add(A.L2 - 0.06, 'roof_wind', -20, 0, { dur: A.L4 - A.L2 });
  add(A.L4 - 0.06, 'whoosh_in', -12, 0); add(A.L4w1, 'stamp', -10, 0); add(A.L4w6, 'heartbeat', -14, 0, { dur: A.L5 - A.L4w6 });
  add(A.L5 - 0.06, 'whoosh_down', -10, 0); add(A.L5, 'rumble', -12, 0, { dur: A.L6 - A.L5 + 0.5 });
  add(A.L6 - 0.06, 'thud', -8, 0); add(A.L6w5, 'scrape', -8, 0); add(A.L6w7, 'wood_clack', -10, 0.2); add(A.L6w9, 'thud', -10, 0);
  add(A.L7 - 0.06, 'ding', -10, 0); add(A.L7, 'crowd_murmur', -20, 0, { dur: A.L8 - A.L7 });
  add(A.L8 - 0.06, 'whoosh_in', -14, 0); add(A.L8w16, 'cloth', -12, 0); add(A.L8, 'morning', -18, 0, { dur: DUR - A.L8 });
  add(A.L9, 'tweet', -18, 0.3, { dur: 2.0 });
  add(T.sub - 0.1, 'pop_word', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
