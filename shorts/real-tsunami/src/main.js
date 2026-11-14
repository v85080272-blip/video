// «Цунами» — a standalone 2D short (≤45 s, the YouTube Studio report of 10.11): you are on a beach and the sea suddenly
// pulls back. Don't go and look — it is a tsunami, minutes left: run inland and up, leave your things. STOP: no hills
// near — 1 along the shore or 2 up into the concrete hotel (two buttons, a countdown, the music drops out). 2: the 4th
// floor and up; along the shore the wave catches you. The first wave floods the beach to the 3rd floor; it pulls back —
// don't go down, the next one is bigger. Then the real case (the hook question answered): 2004, Thailand, a girl of ten
// remembers her geography lesson and raises the alarm, about a hundred people leave the beach. The end loops into the
// start. The hook (situation + DON'T) is on screen from 0 s; a progress strip; punch-in zoom on the key words. Beats are
// anchored to the narrator's words (build/words.json; before the voice, a rough timing from voice/script.json).
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf, fish } from './hunter.js';
import { drawDog } from './dog.js';
import { HZ, WS, G, FH, persp, seaView, person, umbrella, towel, bag, sideBeach, hotel, flood, debris, mapCard, lessonBubble } from './story.js';
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
const HOT = { МОРЕ: GOLD, УХОДИТ: GOLD, ЦУНАМИ: DANGER, МИНУТЫ: DANGER, НАВЕРХ: OK, БРОСАЙ: GOLD, СТОП: GOLD, ВДОЛЬ: DANGER, ДВА: OK,
  БЕТОННЫЙ: OK, ЧЕТВЁРТЫЙ: OK, ВЫШЕ: OK, ДОГОНИТ: DANGER, СПУСКАЙСЯ: DANGER, СИЛЬНЕЕ: DANGER, ДЕВОЧКА: GOLD, ГЕОГРАФИИ: GOLD,
  ТРЕВОГУ: GOLD, СТА: OK, ПОДПИСЫВАЙСЯ: GOLD };

// L4: Стоп(0) Холмов(1) рядом(2) нет(3) Куда(4) бежишь(5) Один(6) —(7) вдоль(8) берега(9) Два(10) —(11) в(12) бетонный(13) отель(14) наверх(15)
// L5: Два(0) Бетонный(1) отель(2) четвёртый(3) этаж(4) и(5) выше(6) Вдоль(7) берега(8) волна(9) догонит(10)
// L6: И(0) не(1) спускайся(2) после(3) первой(4) волны(5) за(6) ней(7) придут(8) ещё(9) иногда(10) сильнее(11)
// L7: В(0) две(1) тысячи(2) четвёртом(3) десятилетняя(4) девочка(5) увидела(6) это(7) в(8) Таиланде(9) вспомнила(10) урок(11) географии(12) и(13) подняла(14) тревогу(15)
const T = {
  c1: A.L2 - 0.06,            // closer: the wave on the horizon
  c2: A.L3 - 0.06,            // run
  c3: A.L4 - 0.06,            // STOP: the map
  ans: A.L5 - 0.04,           // «Два!»
  c4: A.L5w1 - 0.06,          // the hotel
  c5: A.L7 - 0.06,            // 2004
  c6: A.L9 - 0.06,            // the end
};
T.bal = A.L5w5; T.w1 = A.L5w7 - 0.1; T.back = A.L6w0; T.down = A.L6w2 - 0.2; T.w2 = A.L6w6;
export const CUTS = [T.c2, T.c3, T.c4, T.c5, T.c6];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c2 ? 'sea' : t < T.c3 ? 'run' : t < T.c4 ? 'stop' : t < T.c5 ? 'hotel' : t < T.c6 ? 'story' : 'end');
const PUNCH = [A.L0w6, A.L2w3, A.L4w0, A.L5w0, A.L5w3, A.L6w2, A.L8w1];        // «уходит», «цунами», «Стоп», «Два», «четвёртый», «спускайся», «ста»
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.07 * z; }

// —— the hunter: standing, or running (feet cycling, arms pumping) ——
function hunter(t, x, y, s, o = {}) {
  const base = { hip: [x, y], feet: { near: [x - 30 * s, y + 262 * s], far: [x + 34 * s, y + 262 * s] }, s, face: o.face ?? -1, look: o.look ?? [0, 0],
    brow: o.brow ?? 0, pop: o.pop ?? 0, mouth: o.mouth ?? 0.15, blink: ((t + 0.7) % 3.4) < 0.12 ? 1 : 0, scarf: 'neck', ...o.extra };
  if (o.hands) base.hands = o.hands(base);
  return drawHunter(base);
}
function runner(t, x, groundY, s, face = 1, o = {}) {
  const ph = t * (o.rate ?? 2.6) * TAU, f = face;
  const hipY = groundY - 262 * s + 10 * s * Math.abs(Math.cos(ph)) - 14 * s;
  const foot = k => [x + f * 95 * s * Math.sin(ph + k * Math.PI), groundY - 46 * s * Math.max(0, Math.cos(ph + k * Math.PI))];
  const hand = k => [x + f * (20 + 70 * Math.sin(ph + k * Math.PI + Math.PI)) * s, hipY - 150 * s - 30 * s * Math.cos(ph + k * Math.PI)];
  drawHunter({ hip: [x, hipY], feet: { near: foot(0), far: foot(1) }, s, face: f, lean: 0.22, look: [0.5, 0], brow: 0.6, pop: 0.4, mouth: 0.45,
    blink: 0, scarf: 'neck', hands: { near: { p: hand(1), shape: 'fist' }, far: { p: hand(0), shape: 'fist' } } });
}

// —— the scenes ——
const WL = t => (t < T.c6 ? lerp(1030, 770, seg(-0.4, A.L1e, t, ease.out)) : lerp(WS, 1030, seg(DUR - 0.9, DUR, t)));
const TOUR = [[150, 1300, 0], [330, 1250, 1], [610, 1330, 2], [800, 1270, 3], [940, 1350, 4], [480, 1400, 5]];
function tourists(t, wl, back = 0) {
  // walking out onto the bare sea floor (seen from behind); with «back» they turn and walk off the beach towards us
  for (const [x, y0, sd] of TOUR) {
    const out = Math.max(wl + 40 + 46 * ((sd * 2) % 3), y0 - 46 * Math.max(0, t + 1.2) - 30 * sd);
    const v = back > 0 ? ease.inOut(clamp(back * 1.35 - sd * 0.07)) : 0;
    const y = lerp(out, 1480, v), sc = persp(y) * lerp(1, 1.25, v);
    person({ x: lerp(x, x < 540 ? -180 : 1260, ease.in(v)), y, s: sc, seed: sd, view: back > 0.05 ? 'front' : 'back', walk: 1, ph: t * 1.6 + sd * 0.3, hat: sd === 2 ? '#f2e2b0' : null });
  }
}
function fishes(t, wl) {
  for (let i = 0; i < 7; i++) {
    const y = lerp(1110, 1170, hash(i * 2.1)) - 18 * (i % 3), x = 80 + i * 140 + 30 * hash(i);
    if (y < wl + 20) continue;
    const k = persp(y) / 0.42, hop = Math.abs(Math.sin(t * 5 + i * 1.3));
    fish(x, y - 30 * k * hop, 0.95 * k, (i % 2 ? 0.3 : -0.3) + 0.4 * hop, t * 12 + i);
  }
}
function seaScene(t) {
  const close = t >= T.c1, wl = WL(t);
  const zc = close ? lerp(1, 1.32, seg(T.c1, T.c1 + 0.5, t, ease.out)) : 1;
  g.save(); if (zc > 1) { g.translate(540, 700); g.scale(zc, zc); g.translate(-540, -700); }
  seaView(t, { wl, wave: close ? 0.35 + 0.5 * seg(T.c1, T.c2, t) : 0.12 * seg(A.L1w4, A.L1e, t), froth: 0.5, dim: close ? 0.6 * seg(T.c1, T.c2, t) : 0 });
  fishes(t, wl); tourists(t, wl);
  g.restore();
  // the hunter and Пурга in front; at «Не ходи!» he turns to us
  const turn = close;
  hunter(t, 300, 1560, 0.8, { face: turn ? -1 : 1, look: turn ? [-0.2, 0.1] : [0.4, -0.5], brow: turn ? 0.9 : 0.3, pop: turn && t > A.L2w3 ? 1 : 0, mouth: turn ? 0.55 : 0.2,
    hands: o => (turn ? { near: { p: [430, 1330], shape: 'open' } } : null) });
  drawDog({ x: 760, y: 1790, s: 0.6, face: -1, t, sit: turn ? 0 : 1, look: 0.5, mouth: turn ? 0.9 : 0.4, ears: turn ? 0.3 : 0, wag: turn ? 0 : 1, wagPh: t * 3 });
}
function runScene(t) {
  const u = seg(T.c2, T.c3, t, x => x);
  sideBeach(t, { sea: 200, wave: 0.45 + 0.25 * u, gust: 0.4 });
  umbrella(250, 1600, 0.75, -0.25); towel(330, 1690, 0.9); bag(450, 1680, 0.8);
  if (t > A.L3w5 - 0.1) Hd.redX(370, 1620, 150, clamp((t - A.L3w5 + 0.1) / 0.25));
  drawDog({ x: lerp(560, 1000, u), y: 1720, s: 0.5, face: 1, t, walk: 1, ph: t * 3.2, ears: 1, mouth: 0.8, tongue: 0.6 });
  runner(t, lerp(470, 860, u), 1730, 0.72, 1);
}
function stopScene(t) {
  sideBeach(T.c3, { sea: 200, wave: 0.7, gust: 0.4 });
  g.fillStyle = 'rgba(11,15,26,0.55)'; g.fillRect(0, 0, W, H);
  mapCard(t, clamp(sp(t, T.c3 + 0.05, 2.6, 8)), { wave: seg(T.c3, T.ans, t), arrows: seg(A.L4w6 - 0.1, A.L4w9 + 0.2, t), arrows2: seg(A.L4w10 - 0.1, A.L4w15 + 0.2, t), answer: t >= T.ans ? 1 : 0 });
}
const climb = t => {                  // where the hunter is in the hotel: [x, floor y]
  const x0 = 500, x1 = 1020, u = seg(T.c4, T.bal, t, x => x);
  if (u < 0.15) return [lerp(470, x1 - 210, u / 0.15), G, 1];
  if (u < 0.85) { const v = (u - 0.15) / 0.7 * 3, k = Math.floor(v), r = v - k; return [lerp(x1 - 200, x1 - 80, r), G - (k + r) * FH, 1]; }
  return [lerp(x1 - 200, x0 + 40, (u - 0.85) / 0.15), G - 3 * FH, -1];
};
function hotelScene(t) {
  const w1 = seg(T.w1, T.w1 + 1.6, t), back = seg(T.back, T.back + 1.2, t), w2 = seg(T.w2, T.w2 + 1.6, t);
  const front = lerp(-100, 1200, Math.max(w1, w2 > 0 ? 1 : 0)), level = G + 40 - FH * (2.3 * w1 - 1.5 * back + 2.0 * w2);
  sideBeach(t, { sea: 160, wave: t < T.w1 ? 0.9 : 0, gust: 0.8 });
  const gone = clamp(w1 * 1.4);
  if (gone < 1) { umbrella(120 + 300 * gone, 1640 - 40 * gone, 0.6, -0.2 - 1.2 * gone, '#3aa6cf'); umbrella(330 + 200 * gone, 1620, 0.55, 0.1 + gone, '#ff6f59'); }
  hotel(t, { x0: 500, x1: 1020, floors: 5, safe: seg(A.L5w3 - 0.1, A.L5w4 + 0.2, t) });
  // the hunter on his way up, then at the balcony of the 4th floor; Пурга at his heels
  const [hx, fy, face] = climb(t), s = 0.3, moving = t < T.bal;
  const step = t > T.down && t < T.down + 1.0 ? 50 * bump(clamp((t - T.down) / 1.0)) : 0;
  if (moving) runner(t, hx, fy - 14, s, face, { rate: 3 });
  else hunter(t, hx + step, fy - 14 - 262 * s, s, { face: step > 5 ? 1 : -1, look: [-0.6, 0.3], brow: 0.7, pop: t > T.w1 ? 0.8 : 0, mouth: 0.4 });
  drawDog({ x: hx + (moving ? -40 * face : 70), y: fy - 14, s: 0.2, face: moving ? face : -1, t, walk: moving ? 1 : 0, ph: t * 3, sit: moving ? 0 : 1, mouth: 0.7 });
  flood(t, front, level, { surge: (w1 > 0 && w1 < 1 ? 1 - w1 : 0) + (w2 > 0 && w2 < 1 ? 1 - w2 : 0) });
  if (w1 > 0.3) debris(t, front, level, 0.8);
}
function storyScene(t) {
  const u = seg(T.c5, T.c6, t, x => x), alarm = t > A.L7w14 - 0.1, leave = seg(A.L7w14, A.L8e + 0.3, t);
  seaView(t, { wl: 790, wave: 0.12 * u, froth: 1, tint: 1 });
  fishes(t, 790); tourists(t + 3, 790, leave);
  // the girl in front, pointing at the sea; her mum beside her
  person({ x: 330, y: 1720, s: 0.56, seed: 3, view: 'side', face: 1, shirt: '#3aa6cf', walk: 0, hat: '#f2e2b0' });
  person({ x: 650, y: 1740, s: 0.44, view: 'side', face: -1, shirt: '#ffd23f', dress: true, pony: true, hair: '#c9a05a', skin: '#f0c6a0', kid: true,
    arm: alarm ? [-120 - 20 * Math.sin(t * 14), -640] : [-150, -520], mouth: alarm ? 0.9 + 0.3 * Math.sin(t * 9) : 0, walk: 0 });
  if (alarm) for (let i = 0; i < 3; i++) { const k = clamp((t - A.L7w14 - i * 0.08) / 0.2); Hd.label('!', 640 - i * 38, 1430 - i * 30, 90 * k, DANGER, { shadow: false }); }
  lessonBubble(520, 1000, clamp(sp(t, A.L7w10 - 0.1, 2.6, 8)) * (1 - seg(A.L7w14 + 0.2, A.L7w14 + 0.5, t)), t);
}
function endScene(t) {
  seaView(t, { wl: WL(t), froth: 0 });
  hunter(t, 300, 1560, 0.8, { face: -1, look: [-0.3, 0.1], brow: 0.3, mouth: 0.35, hands: o => ({ near: { p: [420, 1300], shape: 'thumb', ang: -Math.PI / 2 } }) });
  drawDog({ x: 760, y: 1790, s: 0.6, face: -1, t, sit: 1, mouth: 0.7, tongue: 0.9, wag: 1, wagPh: t * 3 });
}

// —— the 2D layer ——
function headline(t) {
  // the hook from the very first frame: the situation and the DON'T, no pop-in
  if (t > T.c1 + 0.3) return;
  const a = 1 - seg(T.c1 - 0.1, T.c1 + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(540, 300); g.rotate(-0.03);
  const s = 'МОРЕ УШЛО?', sw = measure(s, 100) + 90; rrect(-sw / 2 + 10, -74 + 10, sw, 148, 24, INK); rrect(-sw / 2, -74, sw, 148, 24, '#ffd23f'); text(s, 0, 36, 100, INK, { shadow: false });
  g.restore();
  Hd.ribbon(t, -1, T.c1 - 0.1, 'НЕ ИДИ СМОТРЕТЬ!', { y: 500, size: 84 });
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
  const a = clamp((t - T.c1) / 0.3) * (1 - seg(T.c5 - 0.3, T.c5, t));
  if (a <= 0.01 || scene(t) === 'stop') return;
  const marks = [['ОТЛИВ', 0], ['БЕГИ', T.c2], ['НАВЕРХ', T.c4], ['ВОЛНЫ', T.w1]], x0 = 70, w = 940, y = 200, sw = w / marks.length;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  fill(rrPath(x0, y - 22, w, 44, 22), 'rgba(11,15,26,0.72)');
  marks.forEach(([s, t0], i) => {
    const nx = i + 1 < marks.length ? marks[i + 1][1] : T.c5, done = t >= nx, on = t >= t0 && !done, x = x0 + i * sw;
    if (done || on) fill(rrPath(x + 6, y - 16, (sw - 12) * (done ? 1 : clamp((t - t0) / (nx - t0))), 32, 16), done ? 'rgba(47,143,78,0.55)' : 'rgba(255,210,63,0.35)');
    text((done ? '✓ ' : '') + s, x + sw / 2, y + 9, 26, done ? '#c8f5d4' : on ? '#ffe9a0' : '#8b97ad', { fam: FONTS.mono, shadow: false });
  });
  g.restore();
}
function choice(t) {
  if (t < T.c3 || t >= T.c4 + 0.3) return;
  const done = t >= T.ans;
  [['1', 'ВДОЛЬ БЕРЕГА', -1, A.L4w6], ['2', 'В ОТЕЛЬ, НАВЕРХ', 1, A.L4w10]].forEach(([n, s, side, t0]) => {
    const k = clamp(sp(t, t0 - 0.08, 2.6, 8)) * (1 - seg(T.c4, T.c4 + 0.3, t)); if (k <= 0.01) return;
    const right = side > 0, c = done ? (right ? '#2f8f4e' : '#8a2a2a') : '#fff3d6', tc = done ? '#ffffff' : INK;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540 + side * 240, 1250); g.scale(k * (done && right ? 1 + 0.1 * bump(clamp((t - T.ans) / 0.3)) : 1), k);
    rrect(-220 + 6, -100 + 8, 440, 200, 30, INK); rrect(-220, -100, 440, 200, 30, c);
    text(n, 0, -10, 80, done ? '#ffffff' : '#c0392b', { fam: FONTS.block, shadow: false });
    text(s, 0, 62, 40, tc, { fam: FONTS.cond, shadow: false });
    if (done) Hd.label(right ? '✓' : '✗', 180, -66, 60, '#ffffff', { shadow: false, stroke: false });
    g.restore();
  });
  if (t >= A.L4e && !done) {             // the countdown under the buttons
    const u = clamp((t - A.L4e) / Math.max(0.6, T.ans - A.L4e));
    g.setTransform(1, 0, 0, 1, 0, 0); fill(rrPath(190, 1390, 700, 26, 13), 'rgba(255,255,255,0.18)'); fill(rrPath(190, 1390, 700 * (1 - u), 26, 13), GOLD);
    Hd.label('ДУМАЙ', 540, 1470, 44, '#ffffff', { fam: FONTS.mono });
  }
  if (t < A.L4w4) {                        // «СТОП» stamped over the map
    const k = clamp(sp(t, A.L4w0 - 0.05, 3, 7));
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 760); g.rotate(-0.12); g.scale(lerp(1.8, 1, Math.min(1, k)), lerp(1.8, 1, Math.min(1, k))); g.globalAlpha = Math.min(1, k * 3) * (1 - seg(A.L4w4 - 0.3, A.L4w4, t));
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
function plaques(t) {
  const sc = scene(t), P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  if (sc === 'sea' && t >= T.c1) {
    P(A.L2w2, T.c2 - 0.05, 340, { icon: 'x', title: 'ЭТО ЦУНАМИ', color: DANGER, size: 50 });
    P(A.L2w4, T.c2 - 0.05, 470, { icon: 'clock', title: 'ДО ВОЛНЫ — МИНУТЫ', color: DANGER, size: 44 });
  }
  if (sc === 'run') {
    P(A.L3w0, T.c3 - 0.05, 560, { icon: 'stairs', title: 'ОТ МОРЯ И ВВЕРХ', color: OK, size: 46 });
    chip(t, T.c2 + 0.25, T.c3 - 0.05, 'КАК ДЕВОЧКА 10 ЛЕТ СПАСЛА 100 ЧЕЛОВЕК?', 'ОТВЕТ — В КОНЦЕ', 360);
  }
  if (sc === 'hotel') {
    P(A.L5w1, T.w1 - 0.05, 330, { icon: 'house', title: 'КРЕПКИЙ БЕТОН', color: OK, size: 46 });
    P(A.L5w3, T.w1 - 0.05, 450, { icon: 'check', title: '4-Й ЭТАЖ И ВЫШЕ', color: OK, size: 46 });
    P(A.L5w7, T.back - 0.05, 330, { icon: 'x', title: 'ВДОЛЬ БЕРЕГА — ДОГОНИТ', color: DANGER, size: 42 });
    P(A.L6w1, T.c5 - 0.05, 330, { icon: 'x', title: 'НЕ СПУСКАЙСЯ', color: DANGER, size: 48 });
    P(A.L6w6, T.c5 - 0.05, 450, { icon: 'clock', title: 'ВОЛН БУДЕТ НЕСКОЛЬКО', sub: 'жди отбоя', color: GOLD, size: 42 });
    if (t > T.w1 + 0.3) counter(200, 640, 'ВОЛНА', t > T.w2 + 0.2 ? '2' : '1', DANGER, 200);
  }
  if (sc === 'story') {
    Hd.timeStamp(t, T.c5 + 0.1, T.c6 - 0.05, '26.12.2004 · ТАИЛАНД', { color: WARM, y: 200 });
    if (t > A.L8w0 - 0.1) counter(540, 380, 'УШЛИ С ПЛЯЖА', '≈' + Math.round(100 * seg(A.L8w0, A.L8w2 + 0.3, t, x => x)), OK, 380);
  }
  if (sc === 'end') P(A.L9w2, DUR + 1, 560, { icon: 'comment', title: 'ПЕРЕШЛИ ТОМУ, С КЕМ ЕДЕШЬ НА МОРЕ', color: GOLD, size: 36 });
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 1000); g.scale(z, z); g.translate(-540, -1000); }
  ({ sea: seaScene, run: runScene, stop: stopScene, hotel: hotelScene, story: storyScene, end: endScene })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of [T.c1, ...CUTS]) if (t >= c && t < c + 0.14) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.12)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  headline(t); progress(t); plaques(t); choice(t);
  Hd.endCard(t, A.L9w0 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.5);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'surf', -16, 0, { dur: T.c2 + 0.3 }); add(0.3, 'gulls', -22, 0.3, { dur: 3.5 });
  add(0.02, 'stamp', -12, 0);
  add(A.L1w0, 'flop', -16, -0.3); add(A.L1w0 + 0.5, 'flop', -18, 0.3);
  add(T.c1, 'wave_roar', -14, 0, { dur: T.c2 - T.c1 + 1.0 }); add(A.L2w1 - 0.05, 'bark', -10, 0.3);
  add(T.c2, 'steps_run', -14, 0, { dur: T.c3 - T.c2 }); add(T.c2, 'wave_roar', -20, -0.5, { dur: T.c3 - T.c2 });
  add(A.L3w5 - 0.1, 'stamp', -14, 0);
  add(A.L4w0 - 0.05, 'stamp', -6, 0); add(A.L4w6 - 0.08, 'pop_word', -10, -0.3); add(A.L4w10 - 0.08, 'pop_word', -10, 0.3);
  add(A.L4e, 'ticks_up', -14, 0, { dur: Math.max(0.6, T.ans - A.L4e) });
  add(T.ans, 'stamp', -6, 0); add(T.ans + 0.05, 'ding', -8, 0);
  add(T.c4, 'stair_steps', -16, 0.2, { dur: T.bal - T.c4 });
  add(T.w1 - 0.8, 'wave_roar', -12, -0.4, { dur: 2.0 }); add(T.w1 + 0.3, 'wave_crash', -6, -0.2, { dur: 2.5 });
  add(T.down, 'stamp', -16, 0);
  add(T.w2 - 0.8, 'wave_roar', -10, -0.4, { dur: 2.0 }); add(T.w2 + 0.3, 'wave_crash', -4, -0.2, { dur: 2.5 });
  add(T.c5, 'surf', -20, 0, { dur: T.c6 - T.c5 }); add(T.c5 + 0.1, 'paper', -14, 0);
  add(A.L7w10 - 0.1, 'pop_word', -10, 0); add(A.L7w14 - 0.05, 'alert', -16, 0.3); add(A.L7w14 + 0.2, 'crowd_steps', -16, 0, { dur: A.L8e - A.L7w14 + 0.5 });
  add(A.L8w0, 'ticks_up', -18, 0, { dur: 1.0 }); add(A.L8w2 + 0.3, 'ding', -10, 0);
  add(T.c6, 'surf', -18, 0, { dur: DUR - T.c6 }); add(T.c6 + 0.2, 'gulls', -22, -0.3, { dur: 2.5 });
  add(A.L9w0 - 0.1, 'pop_word', -8, 0);
  return c.sort((a, b) => a.t - b.t);
}
