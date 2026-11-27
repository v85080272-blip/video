// «Посёлок» №2 «К машине» (3D, Искра): Blender draws the picture (blender/posyolok.py, one run per shot); this file draws the
// 2D layer (OVERLAY=1) and gives the cues for the sound. The choice in the middle: the key fob (it beeps and flashes) or
// the key in the lock (silent); the question at the end: ram the barrier or go back to the house with the light.
// The first 3 frames are the cover (ДО МАШИНЫ 20 МЕТРОВ / НЕ ЖМИ НА БРЕЛОК!) over the first frame of the hook.
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
const HOT = { МАШИНА: WARM, ТИХО: GREEN, ОТКРЫТЬ: WARM, БРЕЛОК: RED, КЛЮЧОМ: GREEN, ЗАМКЕ: GREEN, РЕШАЙ: WARM, ГЕРОЙ: WARM,
  ПИЩИТ: RED, ФАРАМИ: RED, ЗВУК: RED, ВНУТРИ: GREEN, ЗАКРЫТ: RED, ЗДЕСЬ: RED, ТАРАНЮ: WARM, НАЗАД: WARM, НАПИШИ: WARM, СКАЖЕШЬ: WARM };

// —— the beats: one shot per line ——
// L1: Как(0) открыть(1) Один(2) —(3) нажать(4) на(5) брелок(6) Два(7) —(8) ключом(9) прямо(10) в(11) замке(12) Решай(13)
// L6: Один(0) —(1) тараню(2) шлагбаум(3) Два(4) —(5) назад(6) к(7) тому(8) дому(9) со(10) светом(11) Напиши(12) Сделаю(13) как(14) скажешь(15)
const T = { c1: A.L1 - 0.06, c2: A.L2 - 0.06, c3: A.L3 - 0.06, c4: A.L4 - 0.06, c5: A.L5 - 0.06, c6: A.L6 - 0.06, ans: A.L2 - 0.04 };
T.ign = A.L4w1 - 0.1;                                    // «Мотор ревёт»: the engine catches, the lights come on
T.hit = A.L5 + 0.15;                                     // the gasp: one of them at her window
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c3], ['D', T.c3, T.c4], ['E', T.c4, T.c5], ['F', T.c5, T.c6], ['G', T.c6, DUR]];
export const EV = { E: [(T.ign - T.c4) / (T.c5 - T.c4)], F: [Math.max(0.02, (T.hit - T.c5) / (T.c6 - T.c5))] };
export const STEP = { A: 3, B: 3, C: 2, D: 2, E: 2, F: 2, G: 3 };
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
  const fl = clamp(1 - (t - T.ign) / 0.2);              // the headlights come on: a short cold flash
  if (t >= T.ign && fl > 0) { g.globalAlpha = 0.3 * fl; rect(0, 0, W, H, '#e8f2ff'); g.globalAlpha = 1; }
  const sh_ = clamp(1 - (t - T.hit) / 0.25);              // the slam on the window: a jolt of white
  if (t >= T.hit && sh_ > 0) { g.globalAlpha = 0.45 * sh_; rect(0, 0, W, H, '#ffffff'); g.globalAlpha = 1; }
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
  title('ДО МАШИНЫ 20 МЕТРОВ', 250, 92);
  g.save(); g.translate(540, 420); g.rotate(-0.02);
  const s = 'НЕ ЖМИ НА БРЕЛОК!', w = measure(s, 112, FONTS.cond) + 70;
  rect(-w / 2, -82, w, 128, RED); text(s, 0, 30, 112, '#ffffff', { fam: FONTS.cond, shadow: false }); g.restore();
}
function button(n, s, x, y, k, state) {                    // state: 'q' asking, 'right', 'wrong'
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  const w = Math.max(430, measure(s, 42, FONTS.cond) + 180), h = 150, c = state === 'right' ? 'rgba(40,140,90,0.92)' : state === 'wrong' ? 'rgba(90,30,32,0.75)' : 'rgba(10,14,22,0.82)';
  fill(rrPath(-w / 2, -h / 2, w, h, 24), c);
  g.save(); g.lineWidth = 3; g.strokeStyle = state === 'q' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 23)); g.restore();
  text(n, -w / 2 + 62, 26, 74, state === 'wrong' ? '#c98a8a' : WARM, { fam: FONTS.cond, shadow: false });
  text(s, 37, 20, 42, state === 'wrong' ? '#c9b0b0' : '#ffffff', { fam: FONTS.cond, shadow: false });
  if (state === 'wrong') { g.lineWidth = 6; g.strokeStyle = 'rgba(229,72,77,0.9)'; g.beginPath(); g.moveTo(-w / 2 + 30, 0); g.lineTo(w / 2 - 30, 0); g.stroke(); }
  g.restore();
}

function choice(t) {
  if (t < T.c1 || t >= T.c2 + 0.9) return;
  const done = t >= T.ans, kb = t0 => clamp(sp(t, t0 - 0.06, 2.6, 8)) * (1 - seg(T.c2 + 0.5, T.c2 + 0.9, t));
  button('1', 'НАЖАТЬ НА БРЕЛОК', 540, 1080, kb(A.L1w2), done ? 'wrong' : 'q');
  button('2', 'КЛЮЧ В ЗАМКЕ', 540, 1250, kb(A.L1w7), done ? 'right' : 'q');
  if (t >= A.L1e && !done) {
    const v = clamp((t - A.L1e) / Math.max(0.6, T.ans - A.L1e));
    fill(rrPath(240, 1360, 600, 14, 7), 'rgba(255,255,255,0.22)'); fill(rrPath(240, 1360, 600 * (1 - v), 14, 7), WARM);
  }
}
function overlays(t) {
  const sh = shotAt(t);
  const kh = 1 - seg(T.c1 - 0.25, T.c1 + 0.05, t);
  if (kh > 0.01) {
    title('ДО МАШИНЫ 20 МЕТРОВ', 300, 92, kh);
    title('ТОЛЬКО ТИХО', 410, 58, kh * clamp(sp(t, A.L0w9 - 0.1, 2.6, 8)), WARM, 'rgba(0,0,0,0)');
  }
  Hd.timeStamp(t, 0.35, T.c2 - 0.1, 'КП «СОСНОВЫЙ» · 03:06', { color: WARM, dot: RED, y: 150 });
  choice(t);
  if (sh === 'C') {
    Hd.plaque(t, A.L2w4, T.c3 - 0.05, 540, 300, { icon: 'x', title: 'БРЕЛОК: ПИСК И ФАРЫ', color: RED, size: 44 });
    Hd.plaque(t, A.L2w9, T.c3 - 0.05, 540, 420, { icon: 'check', title: 'КЛЮЧ В ЗАМКЕ — ТИХО', color: GREEN, size: 44 });
  }
  if (sh === 'E') Hd.plaque(t, A.L4w6, T.c5 - 0.05, 540, 300, { icon: 'x', title: 'ШЛАГБАУМ ЗАКРЫТ', color: RED, size: 46 });
  if (t >= A.L6w0 - 0.1) {                                // the question to the viewers
    const k1 = clamp(sp(t, A.L6w0 - 0.05, 2.6, 8)), k2 = clamp(sp(t, A.L6w4 - 0.05, 2.6, 8));
    button('1', 'ТАРАНЮ ШЛАГБАУМ', 540, 360, k1, 'q'); button('2', 'НАЗАД, К ДОМУ', 540, 530, k2, 'q');
    if (t >= A.L6w12 - 0.1) Hd.label('ПИШИ 1 ИЛИ 2 В КОММЕНТАРИЯХ', 540, 680, 38, '#ffffff', { fam: FONTS.cond });
  }
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0, 'roof_wind', -24, 0, { dur: T.c4 }); add(0.02, 'stamp', -14, 0);
  add(0.8, 'zombie_far', -20, -0.4, { dur: 3.0 }); add(A.L0w5, 'keys', -18, 0.2);
  add(A.L1e, 'heartbeat', -10, 0, { dur: Math.max(0.6, T.ans - A.L1e) }); add(T.ans, 'ding', -12, 0);
  add(A.L1w2 - 0.06, 'pop_word', -12, -0.2); add(A.L1w7 - 0.06, 'pop_word', -12, 0.2);
  add(T.c2 + 0.1, 'steps_out', -18, 0, { dur: T.c3 - T.c2 - 0.2 });
  add(A.L3w0, 'door_unlock', -12, 0.2); add(A.L3w0 + 0.5, 'door_open', -14, 0.2); add(A.L3w5, 'door_creak', -18, 0);
  add(T.ign - 0.7, 'keys', -16, 0); add(T.ign - 0.55, 'engine', -8, 0, { dur: DUR - T.ign + 0.5 });
  add(T.ign + 0.6, 'zombie_growl', -16, -0.3); add(T.hit, 'wall_hit', -4, 0.3); add(T.hit + 0.05, 'zombie_growl', -8, 0.3);
  add(T.c6, 'zombie_far', -18, -0.3, { dur: 4.0 }); add(A.L6w12, 'blip', -14, 0);
  return c.sort((a, b) => a.t - b.t);
}
