// «Приключения Искры» №5 «Сирена» — 2D, by the new formula (STATS.md, 18–19.11): the first line is the question-title, a
// neighbour's line, three short steps, a secret at the end, «Пиши!»; no series mark anywhere (19.11: newcomers swipe
// away «серия N»). Evening, a siren howls; the neighbour calls to go and look. Why not: the siren is the «Внимание всем!»
// signal — a message follows → not to the street or the balcony, the TV and the radio on → the phone: an SMS comes too →
// listen to the end, act as told, keep the TV on → knock to the neighbour: «don't go out — news on!» → the secret: «Внимание,
// проверка» after the siren means a drill — still listen. The end: a stranger in the lift calls «Заходи!» — 1 get in /
// 2 wait for the next one (the only choice, at the end). Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU, hash } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb, poly, smoothPath } from './flat.js';
import * as Hd from './hud.js';
import { hall, fist } from './gas.js';
import { room, smsPhone, lift, WIN, TV } from './siren.js';
import { iskra, cat, sprite } from './iskra.js';
import { text, measure, FONTS, INK } from './type.js';
import { initTex } from './tex.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
const LAST = SCRIPT.lines[SCRIPT.lines.length - 1].id;
export const DUR = VOICE?.dur ?? FB[LAST][1] + 0.6;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]) + 2; i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1150; Hd.SUB.size = 74; Hd.SUB.lead = 86;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = '#ffb066';
const HOT = { СИРЕНА: DANGER, НЕЛЬЗЯ: DANGER, ГЛЯНЕМ: DANGER, ВНИМАНИЕ: GOLD, ВСЕМ: GOLD, УЛИЦУ: DANGER, БАЛКОН: DANGER, ТЕЛЕВИЗОР: OK,
  РАДИО: OK, ТЕЛЕФОН: OK, СООБЩЕНИЕ: OK, КОНЦА: OK, ВЫХОДИ: DANGER, НОВОСТИ: OK, СЕКРЕТ: GOLD, ПРОВЕРКА: GOLD, УЧЕНИЯ: GOLD,
  НЕЗНАКОМЕЦ: DANGER, ЗАХОДИ: DANGER, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['window', 0], ['signal', A.L1 - 0.1], ['tv', A.L2 - 0.1], ['sms', A.L3 - 0.1], ['listen', A.L4 - 0.1], ['knock', A.L5 - 0.1], ['secret', A.L6 - 0.1], ['lift', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { call: A.L0w10, alert: A.L1w4, tvOn: A.L2w8, radio: A.L2w11, sms: A.L3w2, keep: A.L4w7, knock: A.L5w0, check: A.L6w7, drill: A.L6w11, doors: A.L7w2, come: A.L7w6, q: A.L7w7 - 0.1 };
// the score (tools/music.py) reads: gas (the hook), flare (the alert stab), out (the relief), vanIn (a light pulse), siren (the stranger), q, end
export const MARKS = { A, ...T, gas: 0.3, flare: T.alert, out: A.L6, vanIn: T.drill, siren: A.L7w4, end: A.L7 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [0.12, T.call, T.alert, A.L2w1, T.sms, T.knock, T.check, T.come];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.05 * z; }
const zoomTo = (cx, cy, z, fn) => { g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore(); };
const wavesAt = t => (t < A.L2 ? 1 : 1 - seg(A.L2, A.L2 + 1.5, t));

function bubble(x, y, s1, s2, k, c2 = DANGER, tail = -1) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.03);
  const w = Math.max(measure(s1, 56, FONTS.cond), s2 ? measure(s2, 56, FONTS.cond) : 0) + 90, h = s2 ? 172 : 110;
  fill(rrPath(-w / 2 + 8, -h / 2 + 8, w, h, 40), INK); fill(rrPath(-w / 2, -h / 2, w, h, 40), '#ffffff');
  g.beginPath(); g.moveTo(tail * 60, h / 2 - 8); g.lineTo(tail * 150, h / 2 + 150); g.lineTo(tail * 10, h / 2 - 2); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
  if (s2) { text(s1, 0, -14, 56, INK, { fam: FONTS.cond, shadow: false }); text(s2, 0, 56, 56, c2, { fam: FONTS.cond, shadow: false }); }
  else text(s1, 0, 20, 56, c2, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// —— the shots ——
function window_(t) {                                  // the flat at dusk, the siren howls outside; the neighbour calls
  const push = seg(0, A.L1, t, x => x);
  zoomTo(790, 480, 1 + 0.06 * push, () => room(t, { tv: 0, waves: wavesAt(t) }));
  bubble(800, 900, 'ПОШЛИ,', 'ГЛЯНЕМ!', clamp(sp(t, T.call - 0.08, 2.6, 8)) * (1 - seg(A.L1 - 0.35, A.L1 - 0.12, t)), DANGER, 1);
}
function signal(t) { room(t, { tv: seg(T.alert - 0.2, T.alert, t), mode: 'alert', waves: wavesAt(t) }); }
function tv(t) {                                       // the TV on, the radio playing; the balcony door crossed out
  zoomTo(TV.x + 100, TV.y + 60, 1.25, () => room(t, { tv: 1, mode: seg(T.tvOn - 0.1, T.tvOn + 0.1, t) > 0.5 ? 'news' : 'alert', radio: seg(T.radio - 0.1, T.radio + 0.2, t), waves: wavesAt(t) }));
  const x = seg(A.L2w3 - 0.05, A.L2w3 + 0.25, t), x2 = seg(A.L2w7 - 0.05, A.L2w7 + 0.25, t);
  if (x > 0.01) Hd.redX(880, 360, 150, x * (1 - seg(T.tvOn, T.tvOn + 0.3, t)));
  if (x2 > 0.01) Hd.redX(880, 620, 150, x2 * (1 - seg(T.tvOn, T.tvOn + 0.3, t)));
}
function sms(t) { room(t, { tv: 1, mode: 'news', dim: 0.5 }); smsPhone(540, 700, clamp(sp(t, A.L3 - 0.05, 2.6, 8)), seg(T.sms - 0.1, T.sms + 0.5, t), t); }
function listen(t) { zoomTo(TV.x, TV.y, 1.35, () => room(t, { tv: 1, mode: 'news', radio: 0.6 })); }
function knock(t) {                                    // the neighbour's door: a fist knocks
  zoomTo(420, 860, 1.25, () => hall(t, { gas: 0 }));
  const k = seg(T.knock - 0.15, T.knock, t);
  fist(200, 840, t - T.knock, k);
  if (k > 0.5) { const ph = ((t - T.knock) % 0.35) / 0.35; g.save(); g.globalAlpha = 1 - ph; text('ТУК!', 230, 720 - ph * 40, 80, INK, { fam: FONTS.block }); g.restore(); }
  bubble(560, 520, 'НЕ ВЫХОДИ —', 'ВКЛЮЧИ НОВОСТИ!', clamp(sp(t, A.L5w2 - 0.08, 2.6, 8)) * (1 - seg(A.L6 - 0.35, A.L6 - 0.12, t)), OK);
}
function secret(t) { zoomTo(TV.x, TV.y, 1.35, () => room(t, { tv: 1, mode: t > T.check - 0.1 ? 'check' : 'news', radio: 0.4 })); }
function lift_(t) { lift(t, { open: seg(T.doors - 0.2, T.doors + 0.8, t), eyes: seg(T.come - 0.2, T.come + 0.2, t) }); bubble(700, 330, 'ЗАХОДИ!', null, clamp(sp(t, T.come - 0.08, 2.6, 8)) * (1 - seg(T.q - 0.1, T.q + 0.2, t)), DANGER, -1); }
const SHOT = { window: window_, signal, tv, sms, listen, knock, secret, lift: lift_ };

// —— Искра and Факт in front ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L2 && t < T.tvOn) return 'myth';                     // «не на улицу и не на балкон»
  if (t >= T.tvOn && t < A.L3 - 0.1) return 'left';               // the TV
  if (t >= T.drill && t < A.L7 - 0.1) return 'truth';             // «это учения»
  if (t >= A.L7w7) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < 0.6) return 'front';
  if (t < A.L1) return 'wow';
  if (t < A.L4) return 'doubt';
  if (t >= T.drill && t < A.L7) return 'sure';
  if (t >= A.L7) return 'wow';
  return 'front';
}
let lastPose = null, poseSince = -9, lastCat = null, catSince = -9;
function hosts(t) {
  const p = poseOf(t), c = catOf(t);
  if (p !== lastPose) { lastPose = p; poseSince = t; }
  if (c !== lastCat) { lastCat = c; catSince = t; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // the cat goes into her arms on «Факта — на руки» and back down on «фух»
  const held = 0;
  const cx = lerp(800, 360, held), cy = lerp(1862, 1800, held), ch = lerp(330, 300, held);
  const tremble = 0;
  const tall = 1;
  if (held < 0.5) { ell(cx, 1858, 150, 24, 'rgba(0,0,0,0.25)'); cat(t, c, cx, cy, ch, { hop: catSince > 0.2 ? catSince : null }); }
  iskra(t, p, 300 + tremble, 1945, 720 * tall, { since: poseSince > 0.2 ? poseSince : -9, speaking: speakingAt(t) && p !== 'myth' });
  if (held >= 0.5) cat(t, c === 'wow' ? 'wow' : 'front', cx + tremble, cy, ch, {});
}

// —— the 2D layer ——
function headline(s, y, k, color = '#ffd23f', size = 84) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.rotate(-0.03); g.scale(k, k);
  const sw = measure(s, size) + 80; rrect(-sw / 2 + 10, -size * 0.78 + 10, sw, size * 1.56, 22, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 22, color); text(s, 0, size * 0.36, size, INK, { shadow: false }); g.restore();
}
function button(n, s, x, y, k) {
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k);
  const w = Math.max(430, measure(s, 42, FONTS.cond) + 180), h = 140;
  fill(rrPath(-w / 2, -h / 2, w, h, 24), 'rgba(10,14,22,0.85)');
  g.save(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke(rrPath(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 23)); g.restore();
  text(n, -w / 2 + 62, 26, 74, WARM, { fam: FONTS.cond, shadow: false });
  text(s, 37, 18, 42, '#ffffff', { fam: FONTS.cond, shadow: false });
  g.restore();
}
function layer(t) {
  const P = (t0, t1, y, o) => Hd.plaque(t, t0, t1, 540, y, o);
  // the hook: the question big from the first frame, the ban under it
  const hk = 1 - seg(A.L1 - 0.3, A.L1 - 0.05, t);
  headline('ВОЕТ СИРЕНА?', 220, hk, '#ffd23f', 80);
  headline('НЕ ВЫХОДИ СМОТРЕТЬ!', 380, hk * clamp(sp(t, 0.05, 2.6, 8)), '#e53935', 68);
  P(T.alert, A.L2 - 0.3, 300, { icon: 'check', title: 'СИРЕНА = «ВНИМАНИЕ ВСЕМ!»', color: GOLD, size: 42 });
  Hd.stepHeader(t, 1, 'НЕ НА УЛИЦУ', A.L2 - 0.05, A.L3 - 0.3, 200);
  P(T.tvOn, A.L3 - 0.3, 1040, { icon: 'check', title: 'ТЕЛЕВИЗОР И РАДИО', color: OK, size: 44 });
  Hd.stepHeader(t, 2, 'СМОТРИ ТЕЛЕФОН', A.L3 - 0.05, A.L4 - 0.3, 200);
  Hd.stepHeader(t, 3, 'СЛУШАЙ ДО КОНЦА', A.L4 - 0.05, A.L5 - 0.3, 200);
  P(T.keep, A.L5 - 0.3, 1040, { icon: 'x', title: 'ТЕЛЕВИЗОР НЕ ВЫКЛЮЧАЙ', color: DANGER, size: 40 });
  P(A.L6, A.L7 - 0.3, 230, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 50 });
  P(T.drill, A.L7 - 0.3, 1040, { icon: 'check', title: '«ПРОВЕРКА» = УЧЕНИЯ', sub: 'НО ДОСЛУШАЙ', color: OK, size: 44 });
  // the end: the only choice — at the end
  headline('ЧТО ДЕЛАТЬ?', 220, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'ЗАЙТИ', 270, 1040, clamp(sp(t, A.L7w7 - 0.06, 2.6, 8)));
  button('2', 'ЖДАТЬ СЛЕДУЮЩИЙ', 760, 1040, clamp(sp(t, A.L7w10 - 0.06, 2.6, 8)));
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  zoomTo(790, 480, 1.05, () => room(0.6, { tv: 0, waves: 1 }));
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('ВОЕТ СИРЕНА?', 220, 80, '#ffd23f', INK, -0.04);
  box('НЕ ВЫХОДИ СМОТРЕТЬ!', 380, 68, '#e53935', '#ffffff', 0.03);
  sprite('h_wow', 290, 1925, 640);
  sprite('c_wow', 830, 1905, 420);
}

const TEXMAP = {};
export function init() { Hd.initHud(); initTex(TEXMAP); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t < COVER) { cover(); Hd.finish(t, 0.5); return; }
  const z = zoomAt(t);
  if (z > 1.0005) { g.translate(540, 900); g.scale(z, z); g.translate(-540, -900); }
  SHOT[shotAt(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  hosts(t);
  layer(t);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.02, 'stamp', -12, 0);
  add(0.05, 'whine', -12, 0.3, { dur: A.L2 + 1.2 });
  add(0.05, 'amb_flat', -22, 0, { dur: A.L7 - 0.2 });
  add(T.call, 'pop_word', -12, 0.3);
  add(T.alert, 'beep', -14, -0.2, { dur: 0.3, f: 880 }); add(T.alert + 0.4, 'beep', -14, -0.2, { dur: 0.3, f: 880 });
  add(T.tvOn - 0.05, 'pop_word', -12, -0.2); add(T.radio, 'beep', -20, -0.1, { dur: 0.2, f: 660 });
  add(T.sms, 'ding', -10, 0); add(T.sms + 0.15, 'beep', -16, 0, { dur: 0.15, f: 1320 });
  for (let i = 0; i < 4; i++) add(T.knock + i * 0.35, 'hatch_knock', -10, -0.1);
  add(T.check - 0.05, 'ding', -10, 0);
  add(T.doors - 0.4, 'ding', -12, 0); add(T.doors - 0.1, 'whoosh_down', -14, 0);
  add(T.come, 'heartbeat', -14, 0, { dur: DUR - T.come });
  for (const t0 of [A.L2 - 0.05, A.L3 - 0.05, A.L4 - 0.05, A.L6]) add(t0, 'pop_word', -10, 0);
  add(A.L7w7, 'pop_word', -10, 0); add(A.L7w10, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
