// «Посёлок» (3D pilot for the 20–40 audience): Blender draws the picture (blender/posyolok.py, one run per shot); this file
// draws the 2D layer on a transparent canvas (OVERLAY=1) and gives the cues for the sound. Calmer, grown-up type: a white
// condensed title with a thin red rule, a typed time stamp, the map marks over the aerial shot (her house, the car, them,
// the two routes), the choice with two buttons and a countdown, the question to the viewers at the end, the subtitles.
// The first 3 frames are the cover (ЗАСТРЯЛА В ПОСЁЛКЕ? / НЕ ВКЛЮЧАЙ СВЕТ!) over the first frame of the hook.
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
const HOT = { ЗАСТРЯЛА: RED, ОНИ: RED, СВЕТ: WARM, ШЕСТЕРО: RED, ПОМОЖЕШЬ: WARM, ОДИН: PALE, ДВА: GREEN, ДВОРАМИ: GREEN, РЕШАЙ: WARM,
  УМНИЦА: WARM, ТЕНЬ: GREEN, ПУСТОМ: RED, ЗАГОРЕЛСЯ: RED, НАПИШИ: WARM, СКАЖЕШЬ: WARM };

// —— the beats ——
// L3: Как(0) мне(1) идти(2) Один(3) —(4) бегом(5) по(6) улице(7) Два(8) —(9) задними(10) дворами(11) Решай(12)
// L5: Последний(0) двор(1) Калитка(2) уже(3) рядом(4) В(5) пустом(6) доме(7) загорелся(8) свет(9)
const T = { c1: A.L1 - 0.06, c2: A.L2 - 0.06, c4: A.L4 - 0.06, c5: A.L5 - 0.06, c6: A.L6 - 0.06, ans: A.L4 - 0.04 };
T.gasp = A.L5w5 - 0.5;                                   // the gasp comes just before «В пустом доме»: the window lights up on it
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c4], ['E', T.c4, T.c5], ['F', T.c5, T.c6], ['G', T.c6, DUR]];
export const EV = { F: [(T.gasp - T.c5) / (T.c6 - T.c5)] };
export const STEP = { A: 3, B: 3, C: 5, E: 2, F: 2, G: 3 };
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
  const fl = clamp(1 - (t - T.gasp) / 0.18);             // the window lights up: a short warm flash
  if (t >= T.gasp && fl > 0) { g.globalAlpha = 0.35 * fl; rect(0, 0, W, H, '#ffd7a8'); g.globalAlpha = 1; }
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
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 760); grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 760);
  title('ЗАСТРЯЛА В ПОСЁЛКЕ?', 250, 104);
  g.save(); g.translate(540, 420); g.rotate(-0.02);
  const s = 'НЕ ВКЛЮЧАЙ СВЕТ!', w = measure(s, 112, FONTS.cond) + 70;
  rect(-w / 2, -82, w, 128, RED); text(s, 0, 30, 112, '#ffffff', { fam: FONTS.cond, shadow: false }); g.restore();
}
function button(n, s, x, y, k, state) {                    // state: 'q' asking, 'right', 'wrong'
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  const w = 430, h = 150, c = state === 'right' ? 'rgba(40,140,90,0.92)' : state === 'wrong' ? 'rgba(90,30,32,0.75)' : 'rgba(10,14,22,0.82)';
  fill(rrPath(-w / 2, -h / 2, w, h, 24), c);
  g.save(); g.lineWidth = 3; g.strokeStyle = state === 'q' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 23)); g.restore();
  text(n, -w / 2 + 62, 26, 74, state === 'wrong' ? '#c98a8a' : WARM, { fam: FONTS.cond, shadow: false });
  text(s, 40, 20, 42, state === 'wrong' ? '#c9b0b0' : '#ffffff', { fam: FONTS.cond, shadow: false });
  if (state === 'wrong') { g.lineWidth = 6; g.strokeStyle = 'rgba(229,72,77,0.9)'; g.beginPath(); g.moveTo(-w / 2 + 30, 0); g.lineTo(w / 2 - 30, 0); g.stroke(); }
  g.restore();
}

// —— the aerial shot: the map marks from build/screen.json (the camera's view at the shot's first and last frame) ——
function P(key, u, i = null) {
  if (!SCREEN) return null;
  const a = i === null ? SCREEN[0][key] : SCREEN[0][key][i], b = i === null ? SCREEN[1][key] : SCREEN[1][key][i];
  return [lerp(a[0], b[0], u) * W, lerp(a[1], b[1], u) * H];
}
function dashed(pts, color, k, w = 9) {
  if (k <= 0.01 || !pts.length || pts.some(p => !p)) return;
  g.save(); g.setLineDash([26, 16]); g.lineWidth = w; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * k; g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), f = Math.min(1, left / d);
    g.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); left -= d;
  }
  g.stroke(); g.restore();
}
function pin(p, s, color, k, below = false) {
  if (!p || k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(p[0], p[1]); g.scale(k, k);
  ell(0, 0, 13, 13, color); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.stroke();
  const w = measure(s, 34, FONTS.cond) + 34, y = below ? 46 : -46;
  fill(rrPath(-w / 2, y - 26, w, 52, 12), 'rgba(10,14,22,0.85)'); text(s, 0, y + 12, 34, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
function aerial(t) {
  if (shotAt(t) !== 'C') return;
  const u = clamp((t - T.c2) / (T.c4 - T.c2)), done = t >= T.ans;
  g.setTransform(1, 0, 0, 1, 0, 0);
  const n = SCREEN ? SCREEN[0].infected.length : 0;
  for (let i = 0; i < n; i++) {                           // them: red rings, one by one on «их шестеро»
    const k = clamp(sp(t, A.L2w8 - 0.1 + i * 0.07, 2.6, 8)), p = P('infected', u, i);
    if (!p || k <= 0.01) continue;
    g.save(); g.globalAlpha = Math.min(1, k); g.lineWidth = 5; g.strokeStyle = RED; g.beginPath(); g.arc(p[0], p[1] - 6, 22 * k + 4 * Math.sin(t * 6 + i), 0, Math.PI * 2); g.stroke(); g.restore();
  }
  pin(P('her', u), 'Я ЗДЕСЬ', WARM, clamp(sp(t, T.c2 + 0.15, 2.6, 8)), true);
  pin(P('car', u), 'МАШИНА · 200 М', PALE, clamp(sp(t, A.L2w1 - 0.05, 2.6, 8)));
  const street = SCREEN ? SCREEN[0].street_path.map((_, i) => P('street_path', u, i)) : [], yard = SCREEN ? SCREEN[0].yard_path.map((_, i) => P('yard_path', u, i)) : [];
  dashed(street, done ? 'rgba(229,72,77,0.45)' : RED, seg(A.L3w3, A.L3w7 + 0.3, t));
  dashed(yard, GREEN, seg(A.L3w8, A.L3w11 + 0.3, t), done ? 13 : 9);
  // the choice
  const kb = (t0) => clamp(sp(t, t0 - 0.06, 2.6, 8)) * (1 - seg(T.c4 - 0.1, T.c4 + 0.2, t));
  button('1', 'ПО УЛИЦЕ', 540, 1080, kb(A.L3w3), done ? 'wrong' : 'q');
  button('2', 'ДВОРАМИ', 540, 1250, kb(A.L3w8), done ? 'right' : 'q');
  if (t >= A.L3e && !done) {
    const v = clamp((t - A.L3e) / Math.max(0.6, T.ans - A.L3e));
    fill(rrPath(240, 1360, 600, 14, 7), 'rgba(255,255,255,0.22)'); fill(rrPath(240, 1360, 600 * (1 - v), 14, 7), WARM);
  }
}
function overlays(t) {
  const sh = shotAt(t);
  // the hook: the title from frame one, the time stamp typed in
  const kh = 1 - seg(T.c1 - 0.25, T.c1 + 0.05, t);
  if (kh > 0.01) {
    title('ЗАСТРЯЛА В ПОСЁЛКЕ', 300, 92, kh);
    title('ОНИ ИДУТ НА СВЕТ', 410, 58, kh * clamp(sp(t, A.L0w6 - 0.1, 2.6, 8)), WARM, 'rgba(0,0,0,0)');
  }
  Hd.timeStamp(t, 0.35, T.c2 - 0.1, 'КП «СОСНОВЫЙ» · 02:47', { color: WARM, dot: RED, y: 150 });
  if (sh === 'B') Hd.plaque(t, A.L1w0, T.c2 - 0.05, 540, 300, { icon: 'phone', title: 'СВЯЗИ НЕТ', color: RED, size: 44 });
  aerial(t);
  if (sh === 'E') Hd.timeStamp(t, T.c4 + 0.1, T.c5 - 0.1, 'ЗАДНИЕ ДВОРЫ · 02:58', { color: WARM, dot: GREEN, y: 150 });
  if (t >= A.L6w5 - 0.1) {                                // the question to the viewers
    const k1 = clamp(sp(t, A.L6w2 - 0.05, 2.6, 8)), k2 = clamp(sp(t, A.L6w5 - 0.05, 2.6, 8));
    button('1', 'В ТОТ ДОМ', 540, 360, k1, 'q'); button('2', 'К МАШИНЕ', 540, 530, k2, 'q');
    if (t >= A.L6w7 - 0.1) Hd.label('ПИШИ 1 ИЛИ 2 В КОММЕНТАРИЯХ', 540, 680, 38, '#ffffff', { fam: FONTS.cond });
  }
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'roof_wind', -24, 0, { dur: DUR }); add(0.02, 'stamp', -14, 0);
  add(0.6, 'zombie_growl', -16, -0.3); add(A.L0w5, 'zombie_far', -22, 0.4, { dur: 3.0 });
  add(T.c1 + 0.2, 'breath', -20, 0, { dur: T.c2 - T.c1 - 0.4 }); add(A.L1w7, 'click', -20, 0.2);
  add(T.c2, 'whoosh', -16, 0); add(A.L2w8, 'zombie_far', -20, -0.3, { dur: 2.5 });
  add(A.L3w3 - 0.06, 'pop_word', -12, -0.2); add(A.L3w8 - 0.06, 'pop_word', -12, 0.2);
  add(A.L3e, 'heartbeat', -10, 0, { dur: Math.max(0.6, T.ans - A.L3e) }); add(T.ans, 'ding', -12, 0);
  add(T.c4, 'steps_out', -18, 0, { dur: T.c5 - T.c4 - 0.2 }); add(T.c4 + 0.3, 'cloth', -18, 0);
  add(A.L5w2, 'door_creak', -14, 0.2); add(T.gasp, 'click', -10, 0.3); add(T.gasp + 0.02, 'stamp', -8, 0);
  add(T.c6 + 0.3, 'zombie_far', -24, -0.4, { dur: 3.0 }); add(A.L6w7, 'blip', -14, 0);
  return c.sort((a, b) => a.t - b.t);
}
