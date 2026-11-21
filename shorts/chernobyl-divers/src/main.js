// «Трое под реактором» — a picture story: ten photorealistic frames drawn in Codex on the owner's computer (img/01.png …
// img/10.png, 1080×1920) with a slow camera over each, the narrator, karaoke subtitles, plaques, ≈40 s. Chernobyl, May 1986:
// the pools under the wrecked Unit 4, the fear of a steam explosion, the valves in the flooded basement → STOP: would you go?
// → three plant workers volunteer, the lamp fails, the valves found by touch, the water pumped out → all three came out and
// lived many years; awarded in 2018. Built on «Корабль раздавило льдом» (history-endurance). Facts: voice/script.json.
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
  for (let i = 0; i < Math.max(n, FB[id][2]) + 20; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1500; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ЧЕРНОБЫЛЬ: GOLD, РЕАКТОРОМ: DANGER, РАСКАЛЁННОЕ: DANGER, ПАРОВОЙ: DANGER, ВЗРЫВ: DANGER, ЗАДВИЖКИ: GOLD,
  РАДИОАКТИВНОЙ: DANGER, СТОП: GOLD, ПОШЁЛ: GOLD, ТРОЕ: OK, АНАНЕНКО: GOLD, БЕСПАЛОВ: GOLD, БАРАНОВ: GOLD, ГАСНЕТ: DANGER,
  ОЩУПЬ: GOLD, ОТКРЫВАЮТ: OK, ВЗРЫВА: OK, ВЫШЛИ: OK, ПРОЖИЛИ: OK, НАГРАДИЛИ: GOLD, ПИШИ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// the images: img/NN.png or .jpg, loaded once (top-level await: render.mjs imports this module before it draws)
const IMG = {};
for (let i = 1; i <= 10; i++) {
  const k = String(i).padStart(2, '0');
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const u = new URL(`../img/${k}.${ext}`, import.meta.url);
    if (fs.existsSync(u)) { IMG[k] = await loadImage(fs.readFileSync(u)); break; }
  }
}
const LABEL = { '01': 'разрушенный блок', '02': 'раскалённая масса', '03': 'затопленный подвал', '04': 'трое у двери', '05': 'костюмы',
  '06': 'фонарь гаснет', '07': 'задвижка', '08': 'вода уходит', '09': 'выходят на свет', '10': 'арка сегодня' };

// L3: Стоп(0) Кто-то(1) должен(2) спуститься(3) туда(4) А(5) ты(6) бы(7) пошёл(8)
// L4: Вызвались(0) трое(1) сотрудников(2) станции(3) Алексей(4) Ананенко(5) Валерий(6) Беспалов(7) и(8) Борис(9) Баранов(10)
// L5: Защитные(0) костюмы(1) фонари(2) —(3) и(4) вниз(5) У(6) одного(7) гаснет(8) фонарь(9)
// L9: В(0) две(1) тысячи(2) восемнадцатом(3) их(4) наградили(5) Пиши(6) ты(7) бы(8) пошёл(9) И(10) подписывайся(11)
const T = { c3: A.L3 - 0.06, ans: A.L4w0 - 0.05, c4: A.L4 - 0.06, lamp: A.L5w8 };
// the shots: [image, from, to, zoom from → to, drift (px over the shot, x, y)]
const SHOTS = [
  ['01', 0, A.L1 - 0.06, 1.06, 1.18, [-30, 10]],
  ['02', A.L1 - 0.06, A.L2 - 0.06, 1.16, 1.05, [30, 0]],
  ['03', A.L2 - 0.06, A.L3 - 0.06, 1.04, 1.16, [0, -30]],
  ['04', A.L3 - 0.06, A.L4 - 0.06, 1.05, 1.14, [0, 10]],
  ['05', A.L4 - 0.06, A.L5 - 0.06, 1.14, 1.05, [-30, 0]],
  ['06', A.L5 - 0.06, A.L6 - 0.06, 1.05, 1.15, [20, 0]],
  ['07', A.L6 - 0.06, A.L7 - 0.06, 1.16, 1.06, [0, 20]],
  ['08', A.L7 - 0.06, A.L8 - 0.06, 1.05, 1.15, [-20, 0]],
  ['09', A.L8 - 0.06, A.L9 - 0.06, 1.06, 1.16, [0, -20]],
  ['10', A.L9 - 0.06, DUR + 0.1, 1.04, 1.18, [0, 20]],
];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [A.L0w0, A.L1w11, A.L3w0, A.L4w0, A.L5w8, A.L7w2, A.L8w0];
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
  const s = 'ТРОЕ ПОД РЕАКТОРОМ', sw = measure(s, 80) + 80; rrect(-sw / 2 + 10, -64 + 10, sw, 128, 22, INK); rrect(-sw / 2, -64, sw, 128, 22, '#ffd23f'); text(s, 0, 30, 80, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, A.L1 - 0.1, 'КТО ПОЙДЁТ ВНИЗ?', { y: 520, size: 76 });
}
function choice(t) {
  if (t < T.c3 || t >= A.L4w4) return;
  const done = t >= T.ans;
  [['1', 'ПОЙТИ', -1, A.L3w5], ['2', 'ОТКАЗАТЬСЯ', 1, A.L3w7]].forEach(([n, s, side, t0]) => {
    const k = clamp(sp(t, t0 - 0.08, 2.6, 8)) * (1 - seg(A.L4w4 - 0.4, A.L4w4, t)); if (k <= 0.01) return;
    const pick = side < 0, c = done ? (pick ? '#2f8f4e' : 'rgba(80,80,90,0.85)') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 240, 1180); g.scale(k * (done && pick ? 1 + 0.1 * bump(clamp((t - T.ans) / 0.3)) : 1), k);
    rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
    text(n, 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
    text(s, 0, 62, 40, tc, { fam: FONTS.cond, shadow: false });
    if (done && pick) Hd.label('ТРОЕ ВЫЗВАЛИСЬ', 0, -130, 34, '#ffffff', { fam: FONTS.mono });
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
function stampBig(t, t0, t1, str, color) {
  if (t < t0 || t > t1) return;
  const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(t1 - 0.25, t1, t)); g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 420); g.rotate(-0.06); g.scale(k, k);
  const w = measure(str, 70) + 90; rrect(-w / 2 + 10, -90 + 10, w, 180, 26, INK); rrect(-w / 2, -90, w, 180, 26, color); text(str, 0, 28, 70, '#ffffff', { shadow: false }); g.restore();
}
function plaques(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  Hd.timeStamp(t, A.L1, A.L3 - 0.1, 'МАЙ 1986 · ЧЕРНОБЫЛЬ', { color: WARM, y: 200 });
  P(A.L1w7, A.L2 - 0.05, 320, { icon: 'drop', title: 'ТОПЛИВО + ВОДА = ПАРОВОЙ ВЗРЫВ', color: DANGER, size: 40 });
  P(A.L2w4, A.L3 - 0.05, 320, { icon: 'x', title: 'ЗАДВИЖКИ — ПОД ВОДОЙ', color: DANGER, size: 46 });
  P(A.L4w4, A.L5 - 0.05, 320, { icon: 'check', title: 'АНАНЕНКО · БЕСПАЛОВ · БАРАНОВ', color: GOLD, size: 40 });
  P(T.lamp - 0.05, A.L6 - 0.05, 320, { icon: 'torch', title: 'ФОНАРЬ ПОГАС', color: DANGER, size: 48 });
  P(A.L6w2, A.L7 - 0.05, 320, { icon: 'check', title: 'НА ОЩУПЬ, ВДОЛЬ ТРУБЫ', color: GOLD, size: 46 });
  stampBig(t, A.L7w2 - 0.05, A.L8 - 0.05, 'ВЗРЫВА НЕ БУДЕТ', '#2f8f4e');
  stampBig(t, A.L8w0 - 0.05, A.L9 - 0.05, 'ВЫШЛИ ВСЕ ТРОЕ', '#2f8f4e');
  P(A.L9w0, DUR + 1, 320, { icon: 'check', title: 'НАГРАЖДЕНЫ В 2018', color: GOLD, size: 46 });
  P(A.L9w6, DUR + 1, 440, { icon: 'comment', title: 'А ТЫ БЫ ПОШЁЛ? ПИШИ', color: GOLD, size: 40 });
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
  Hd.endCard(t, A.L9w10 - 0.1, 0, 560);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.2);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'rumble', -16, 0, { dur: A.L1 }); add(0.1, 'heli_far', -18, 0.4, { dur: A.L1 - 0.2 });
  add(A.L1 - 0.06, 'fire', -14, 0, { dur: A.L2 - A.L1 }); add(A.L1w11, 'thud', -10, 0);
  add(A.L2 - 0.06, 'drip', -12, 0, { dur: A.L3 - A.L2 }); add(A.L2 - 0.06, 'ice_water', -20, 0, { dur: A.L3 - A.L2 });
  add(A.L3w0 - 0.05, 'stamp', -6, 0); add(A.L3w5 - 0.08, 'pop_word', -10, -0.3); add(A.L3w7 - 0.08, 'pop_word', -10, 0.3);
  add(A.L3e, 'ticks_up', -14, 0, { dur: Math.max(0.6, A.L4 - A.L3e - 0.05) });
  add(T.ans, 'ding', -8, 0); add(A.L4 + 0.2, 'zipper', -14, -0.2); add(A.L4w4, 'stair_steps', -16, 0, { dur: 1.5 });
  add(A.L5 - 0.06, 'splash', -12, 0); add(A.L5 - 0.06, 'drip', -14, 0, { dur: A.L7 - A.L5 }); add(T.lamp - 0.05, 'click', -6, 0); add(T.lamp, 'power_down', -12, 0);
  add(A.L6w2, 'heartbeat', -16, 0, { dur: A.L7 - A.L6w2 }); add(A.L6w7, 'squeak_dry', -8, 0); add(A.L6w8, 'scrape', -10, 0);
  add(A.L7 - 0.06, 'drain', -12, 0, { dur: 1.5 }); add(A.L7, 'pump', -16, 0.2, { dur: A.L8 - A.L7 }); add(A.L7w2, 'ding', -10, 0);
  add(A.L8 - 0.06, 'door_open', -12, 0); add(A.L8, 'morning', -16, 0, { dur: DUR - A.L8 }); add(A.L8w0, 'ding', -10, 0);
  add(A.L9, 'tweet', -18, 0.3, { dur: 2.0 });
  add(A.L9w10 - 0.1, 'pop_word', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
