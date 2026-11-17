// «Посёлок» №3 «Тараню шлагбаум» (3D, Искра): Blender draws the picture (blender/posyolok.py, one run per shot); this file
// draws the 2D layer (OVERLAY=1) and gives the cues for the sound. From 17.11 there is no choice in the middle: the clip
// runs without a stop, and the question is only at the end (stop for the one waving on the road — or drive past).
// The series mark «ПОСЁЛОК · СЕРИЯ 3» is on the cover and at the top all the way through (16.11).
// The first 3 frames are the cover (ШЛАГБАУМ ЗАКРЫТ? / НЕ БЕЙ В СТОЛБ!) over the first frame of the hook.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const SCREEN = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/screen.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.4, n]; t += n * 0.4; }
}
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1480; Hd.SUB.size = 68; Hd.SUB.lead = 82;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const RED = '#e5484d', GREEN = '#46c37b', WARM = '#ffb066', PALE = '#e8edf3';
const HOT = { ШЛАГБАУМ: RED, ЗАКРЫТ: RED, ТАРАНЮ: WARM, РЕМЕНЬ: GREEN, ЗАМОК: GREEN, СТОЛБ: RED, КОНЕЦ: GREEN, ЛЕГЧЕ: GREEN, РАЗГОНЯЮСЬ: GREEN,
  РАДИАТОР: RED, УДАР: RED, ТРАССЕ: GREEN, ПОВИС: RED, ТОРМОЖУ: GREEN, РОВНО: GREEN, МАШЕТ: WARM, ОСТАНОВИТЬСЯ: WARM, НАПИШИ: WARM, СКАЖЕШЬ: WARM };

// —— the beats ——
// L0: Они(0) уже(1) у(2) окон(3) а(4) шлагбаум(5) закрыт(6) Значит(7) —(8) тараню(9)
// L1: Ремень(0) —(1) щёлк(2) Двери(3) —(4) на(5) замок(6)
// L2: Бью(0) не(1) в(2) столб(3) а(4) в(5) самый(6) конец(7) палки(8) —(9) там(10) она(11) ломается(12) легче(13)
// L3: И(0) не(1) разгоняюсь(2) разобью(3) радиатор(4) —(5) машина(6) встанет(7) через(8) километр(9)
// L4: Удар(0) Её(1) снесло(2) мы(3) на(4) трассе(5)
// L5: Один(0) повис(1) на(2) двери(3) Не(4) торможу(5) резко(6) —(7) ровно(8) и(9) он(10) сорвался(11)
// L6: Дальний(0) свет(1) Лес(2) тишина(3) и(4) впереди(5) на(6) дороге(7) кто-то(8) машет(9)
// L7: Остановиться(0) Один(1) —(2) да(3) Два(4) —(5) мимо(6) Напиши(7) Сделаю(8) как(9) скажешь(10)
const T = { c1: A.L1 - 0.06, c2: A.L2 - 0.06, c3: A.L3 - 0.06, c4: A.L5 - 0.06, c5: A.L6 - 0.06 };
T.imp = A.L4w0 - 0.04;                                   // «Удар!»
T.fall = A.L5w11 - 0.1;                                  // «сорвался»
T.hb = A.L6w0;                                           // «Дальний свет»
T.q = A.L7;                                              // the question
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c3], ['D', T.c3, T.c4], ['E', T.c4, T.c5], ['F', T.c5, DUR]];
const frac = (n, t) => { const s = SHOTS.find(x => x[0] === n); return clamp((t - s[1]) / (s[2] - s[1]), 0.02, 0.98); };
export const EV = { A: [frac('A', A.L0w7)], B: [frac('B', A.L1w0), frac('B', A.L1w2), frac('B', A.L1w6)], D: [frac('D', T.imp)], E: [frac('E', T.fall)],
  F: [frac('F', T.hb), frac('F', A.L6w8)] };
export const STEP = { A: 2, B: 2, C: 2, D: 2, E: 2, F: 3 };
export const NF = Object.fromEntries(SHOTS.map(([n, a, b]) => [n, Math.round((b - a) * 30) + STEP[n]]));
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS, ev: EV, step: STEP, nf: NF };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const shotAt = t => { let s = 'A'; for (const [n, a] of SHOTS) if (t >= a) s = n; return s; };
export const COVER = 0.05;

export function init() { Hd.initHud(); }

export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = shotAt(t);
  if (process.env.OVERLAY !== '1') { g.fillStyle = '#3a4250'; g.fillRect(0, 0, W, H); text(sh, 540, 980, 300, '#566070', { fam: FONTS.block, shadow: false }); }
  if (t < COVER) { cover(); return; }
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.16) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.14)));
  if (dip > 0.002) { g.globalAlpha = dip * 0.9; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  const fi = clamp(1 - (t - T.imp) / 0.22);               // the impact: a jolt of white
  if (t >= T.imp && fi > 0) { g.globalAlpha = 0.5 * fi; rect(0, 0, W, H, '#ffffff'); g.globalAlpha = 1; }
  const fh = clamp(1 - (t - T.hb) / 0.25);                // the high beams: a cold flash
  if (t >= T.hb && fh > 0) { g.globalAlpha = 0.25 * fh; rect(0, 0, W, H, '#e8f2ff'); g.globalAlpha = 1; }
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
}

// —— type ——
function title(s, y, size, k = 1, color = '#ffffff', rule = RED) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const w = measure(s, size, FONTS.cond);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 28; text(s, 540, y, size, color, { fam: FONTS.cond, shadow: false }); g.restore();
  rect(540 - w / 2, y + 16, w * clamp(k * 1.2), 6, rule);
  g.restore();
}
function series(y = 120, k = 1) {                          // «ПОСЁЛОК · СЕРИЯ 3»: the series mark at the top
  if (k <= 0.01) return;
  const s = 'ПОСЁЛОК · СЕРИЯ 3', w = measure(s, 40, FONTS.cond) + 56;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  fill(rrPath(540 - w / 2, y - 32, w, 64, 32), 'rgba(10,14,22,0.78)');
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,176,102,0.85)'; g.stroke(rrPath(540 - w / 2 + 1.5, y - 30.5, w - 3, 61, 30));
  text(s, 540, y + 14, 40, WARM, { fam: FONTS.cond, shadow: false });
  g.restore();
}
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 760); grd.addColorStop(0, 'rgba(0,0,0,0.78)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 760);
  series(110);
  title('ШЛАГБАУМ ЗАКРЫТ?', 270, 96);
  g.save(); g.translate(540, 440); g.rotate(-0.02);
  const s = 'НЕ БЕЙ В СТОЛБ!', w = measure(s, 112, FONTS.cond) + 70;
  rect(-w / 2, -82, w, 128, RED); text(s, 0, 30, 112, '#ffffff', { fam: FONTS.cond, shadow: false }); g.restore();
}
function button(n, s, x, y, k) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  const w = Math.max(430, measure(s, 42, FONTS.cond) + 180), h = 150;
  fill(rrPath(-w / 2, -h / 2, w, h, 24), 'rgba(10,14,22,0.82)');
  g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 23)); g.restore();
  text(n, -w / 2 + 62, 26, 74, WARM, { fam: FONTS.cond, shadow: false });
  text(s, 37, 20, 42, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
// shot C: where to hit — a red cross on the post, a green arrow at the far end of the arm (positions from Blender)
function aimMarks(t) {
  if (!SCREEN || shotAt(t) !== 'C') return;
  const u = clamp((t - T.c2) / (T.c3 - T.c2)), P = k => [lerp(SCREEN[0][k][0], SCREEN[1][k][0], u) * W, lerp(SCREEN[0][k][1], SCREEN[1][k][1], u) * H];
  const kx = clamp(sp(t, A.L2w1 - 0.05, 2.6, 8)), ka = clamp(sp(t, A.L2w7 - 0.05, 2.6, 8));
  if (kx > 0.01) { const [x, y] = P('post'); Hd.redX(x, y, 70, kx); }
  if (ka > 0.01) {
    const [x, y] = P('end'), bob = 10 * Math.sin(t * 8);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = Math.min(1, ka); g.lineCap = 'round';
    g.lineWidth = 16; g.strokeStyle = GREEN; g.beginPath(); g.moveTo(x, y - 250 + bob); g.lineTo(x, y - 70 + bob); g.stroke();
    fill(rrPath(x - 4, y - 70 + bob, 8, 8, 4), GREEN);
    g.beginPath(); g.moveTo(x - 38, y - 100 + bob); g.lineTo(x, y - 52 + bob); g.lineTo(x + 38, y - 100 + bob); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.arc(x, y, 60, 0, Math.PI * 2); g.stroke(); g.restore();
  }
}
function overlays(t) {
  series(120, clamp(t / 0.3));
  const kh = 1 - seg(T.c1 - 0.25, T.c1 + 0.05, t);
  if (kh > 0.01) {
    title('ШЛАГБАУМ ЗАКРЫТ', 300, 92, kh);
    title('ЗНАЧИТ — ТАРАНЮ', 410, 64, kh * clamp(sp(t, A.L0w7 - 0.1, 2.6, 8)), WARM, 'rgba(0,0,0,0)');
  }
  Hd.timeStamp(t, 0.35, T.c2 - 0.1, 'КП «СОСНОВЫЙ» · 03:14', { color: WARM, dot: RED, y: 220 });
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  P(A.L1w0, T.c2 - 0.05, 330, { icon: 'check', title: 'РЕМЕНЬ', color: GREEN, size: 46 });
  P(A.L1w3, T.c2 - 0.05, 450, { icon: 'check', title: 'ДВЕРИ НА ЗАМОК', color: GREEN, size: 46 });
  P(A.L2w1, T.c3 - 0.05, 330, { icon: 'x', title: 'НЕ В СТОЛБ', color: RED, size: 46 });
  P(A.L2w7, T.c3 - 0.05, 450, { icon: 'check', title: 'В КОНЕЦ ПАЛКИ — ЛОМАЕТСЯ', color: GREEN, size: 40 });
  aimMarks(t);
  P(A.L3w1, T.imp - 0.1, 330, { icon: 'check', title: 'НЕ РАЗГОНЯЙСЯ', color: GREEN, size: 46 });
  P(A.L3w3, T.imp - 0.1, 450, { icon: 'x', title: 'ИНАЧЕ РАДИАТОР — И ВСТАНЕШЬ', color: RED, size: 38 });
  P(A.L5w4, T.c5 - 0.05, 330, { icon: 'check', title: 'НЕ ТОРМОЗИ РЕЗКО', color: GREEN, size: 46 });
  if (t >= A.L7w1 - 0.1) {                                // the question to the viewers — the only one, at the end
    const k1 = clamp(sp(t, A.L7w1 - 0.05, 2.6, 8)), k2 = clamp(sp(t, A.L7w4 - 0.05, 2.6, 8));
    button('1', 'ОСТАНОВИТЬСЯ', 540, 360, k1); button('2', 'МИМО', 540, 530, k2);
    if (t >= A.L7w7 - 0.1) Hd.label('ПИШИ 1 ИЛИ 2 В КОММЕНТАРИЯХ', 540, 680, 38, '#ffffff', { fam: FONTS.cond });
  }
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -14, 0); add(0, 'roof_wind', -26, 0, { dur: T.c4 });
  add(0.05, 'engine', -14, 0, { dur: DUR });
  add(0.3, 'zombie_growl', -16, 0.4); add(0.9, 'wall_hit', -16, 0.4); add(1.6, 'zombie_far', -20, -0.4, { dur: 3.0 });
  add(A.L1w2 - 0.05, 'click', -8, -0.2); add(A.L1w6 - 0.05, 'door_unlock', -10, 0.3);
  add(A.L2w1, 'pop_word', -12, 0.2); add(A.L2w7, 'pop_word', -12, -0.2);
  add(T.imp, 'wall_hit', -2, 0); add(T.imp + 0.02, 'thud', -6, 0); add(T.imp + 0.3, 'scrape', -12, 0.2);
  add(A.L5w0, 'zombie_growl', -12, 0.4); add(T.fall, 'thud', -10, 0.5);
  add(T.hb, 'click', -12, 0); add(A.L6w8, 'zombie_far', -24, 0, { dur: 2.0 });
  add(A.L7w7, 'blip', -14, 0);
  return c.sort((a, b) => a.t - b.t);
}
