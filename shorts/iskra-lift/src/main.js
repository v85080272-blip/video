// «Незнакомец в лифте» — Искра, 2D, by the new formula (STATS.md, 18–19.11): the first line is the question-title, the
// stranger's line, three short steps, a secret at the end, «Пиши!»; no series mark anywhere. The answer to «Сирена»'s
// question (1 get in / 2 wait for the next one → 2). A stranger holds the lift: «Заходи, мне на девятый!». Why not: you
// can't run out of a lift → «Езжайте, я подожду» and wait for the next one → he doesn't go? Out to the street, call home →
// if already riding with a stranger: face him, by the buttons → scared? the nearest floor and the dispatcher's button,
// get out → the secret: shout and knock on the walls, the whole stairwell hears. The end: at night a knock, «Откройте,
// полиция!» — 1 open / 2 call 102 (the only choice, at the end). Facts: voice/script.json.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, TAU, hash } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath, limb, poly, smoothPath } from './flat.js';
import * as Hd from './hud.js';
import { street } from './gas.js';
import { lift } from './siren.js';
import { cabin, section, callPhone, flatDoor, PANEL, btnAt, BELL, CABIN_Y } from './lift.js';
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
const HOT = { НЕЛЬЗЯ: DANGER, ЛИФТ: GOLD, НЕЗНАКОМЕЦ: DANGER, ЗАХОДИ: DANGER, УБЕЖИШЬ: DANGER, ЧУЖИМ: DANGER, ПОДОЖДУ: OK,
  СЛЕДУЮЩИЙ: OK, УЛИЦУ: OK, СВОИМ: OK, ЛИЦОМ: OK, КНОПОК: OK, ЭТАЖ: OK, ДИСПЕТЧЕРА: OK, ВЫХОЖУ: OK, СЕКРЕТ: GOLD, КРИЧИ: GOLD,
  СТУЧИ: GOLD, СЛЫШНО: OK, ПОЛИЦИЯ: GOLD, ПИШИ: GOLD };

// —— the timeline: a shot per step ——
const SHOTS = [['door', 0], ['trap', A.L1 - 0.1], ['refuse', A.L2 - 0.1], ['stays', A.L3 - 0.1], ['street', A.L3w4 - 0.1], ['ride', A.L4 - 0.1],
  ['panel', A.L5 - 0.1], ['section', A.L6 - 0.1], ['night', A.L7 - 0.1]];
const shotAt = t => { let s = SHOTS[0][0]; for (const [n, t0] of SHOTS) if (t >= t0) s = n; return s; };
const shotStart = n => SHOTS.find(s => s[0] === n)[1];
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
const T = { come: A.L0w9, trap: A.L1w3, noRide: A.L1w8, say: A.L2w2, wait: A.L2w7, stays: A.L3w2, out: A.L3w4, call: A.L3w8,
  face: A.L4w8, btns: A.L4w11, scared: A.L5w0, near: A.L5w2, bell: A.L5w5, exit: A.L5w9, shout: A.L6w5, knockW: A.L6w7,
  hear: A.L6w13, knock: A.L7w4, police: A.L7w5, q: A.L7w7 - 0.1 };
// the score (tools/music.py) reads: gas (the hook), flare (the stab on «не убежишь»), out (the relief), vanIn (a light pulse), siren (the knock), q, end
export const MARKS = { A, ...T, gas: 0.3, flare: T.trap, out: A.L6, vanIn: T.hear, siren: T.knock, end: A.L7 };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const PUNCH = [0.12, T.come, T.trap, A.L2w1, T.out, T.face, T.near, T.shout, T.knock];
function zoomAt(t) { let z = 0; for (const p of PUNCH) if (t >= p - 0.02 && t < p + 0.7) z = Math.max(z, Math.exp(-(t - p) / 0.22) * clamp((t - p + 0.02) / 0.06)); return 1 + 0.05 * z; }
const zoomTo = (cx, cy, z, fn) => { g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore(); };
// a point of the scene src brought to dst on screen at zoom z (k 0…1 how far)
const focus = (src, dst, z, k, fn) => { g.save(); g.translate(lerp(src[0], dst[0], k), lerp(src[1], dst[1], k)); g.scale(lerp(1, z, k), lerp(1, z, k)); g.translate(-src[0], -src[1]); fn(); g.restore(); };

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
const pop = (s, x, y, size, color, t, t0, period = 0.35) => {           // a word bursting on every beat from t0
  if (t < t0) return; const ph = ((t - t0) % period) / period;
  g.save(); g.globalAlpha = 1 - ph; text(s, x, y - ph * 40, size * (1 + 0.15 * (1 - ph)), color, { fam: FONTS.block }); g.restore();
};
// —— the shots ——
function door(t) {                                     // the landing: the lift open, the stranger holds the door and calls
  const push = seg(0, A.L1, t, x => x);
  zoomTo(540, 860, 1 + 0.08 * push, () => lift(t, { open: 1, eyes: seg(T.come - 0.3, T.come, t), disp: '1' }));
  bubble(830, 640, 'ЗАХОДИ!', 'МНЕ НА 9-Й!', clamp(sp(t, T.come - 0.08, 2.6, 8)) * (1 - seg(A.L1 - 0.35, A.L1 - 0.12, t)), DANGER, -1);
}
function trap(t) {                                     // the doors close on the cabin: you can't run out of it
  zoomTo(540, 860, lerp(1.08, 1.22, seg(A.L1, A.L1e, t)), () => lift(t, { open: lerp(1, 0.5, seg(A.L1w1, T.trap + 0.3, t)), eyes: 1, disp: '1' }));
  const x = seg(T.noRide - 0.05, T.noRide + 0.25, t);
  if (x > 0.01) Hd.redX(540, 820, 210, x);
}
function refuse(t) {                                   // he holds them open again; she says «Езжайте, я подожду»
  lift(t, { open: lerp(0.5, 1, seg(A.L2 - 0.1, A.L2 + 0.4, t)), eyes: 1, disp: '1' });
  bubble(760, 930, 'ЕЗЖАЙТЕ,', 'Я ПОДОЖДУ!', clamp(sp(t, T.say - 0.08, 2.6, 8)) * (1 - seg(T.wait - 0.3, T.wait - 0.05, t)), OK, -1);
}
function stays(t) { zoomTo(540, 600, 1.25, () => lift(t, { open: 1, eyes: 1, disp: '1' })); }
function street_(t) {                                  // out of the entrance into the street; she calls home
  zoomTo(540, 1000, 1.15, () => street(t, { door: 1 - seg(T.out + 0.3, T.out + 1.0, t) }));
  callPhone(800, 560, clamp(sp(t, T.call - 0.1, 2.6, 8)) * (1 - seg(A.L4 - 0.35, A.L4 - 0.12, t)), t, 'МАМА');
}
function ride(t) {                                     // inside the cabin with a stranger: face him, by the buttons
  const f = t < T.face ? 2 : 3;
  cabin(t, { open: 0, floor: f, up: true, eyes: 0.8 });
  const ring = seg(T.btns - 0.1, T.btns + 0.3, t);
  if (ring > 0.01) { g.save(); g.globalAlpha = ring; g.lineWidth = 10; g.strokeStyle = OK; const pz = 1 + 0.04 * Math.sin(t * 8);
    g.translate(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2); g.scale(pz, pz); g.stroke(rrPath(-PANEL.w / 2 - 22, -PANEL.h / 2 - 22, PANEL.w + 44, PANEL.h + 44, 24)); g.restore(); }
}
function panel(t) {                                    // the panel close: the nearest floor, the dispatcher; the doors open
  const out = seg(T.exit - 0.15, T.exit + 0.45, t), k = (1 - out) * seg(A.L5 - 0.1, A.L5 + 0.3, t);
  const lit = t >= T.near ? 4 : null;
  focus([PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2], [600, 560], 1.75, k,
    () => cabin(t, { open: seg(T.exit - 0.05, T.exit + 0.7, t), floor: t >= T.exit - 0.1 ? 4 : 3, up: t < T.exit - 0.1, lit, bell: t >= T.bell ? 1 : 0,
                     near: seg(T.scared - 0.1, T.scared + 0.6, t), eyes: 1 }));
  if (t >= T.near && t < T.near + 0.5) { const q = clamp((t - T.near) / 0.5); const [bx, by] = btnAt(4); const z = lerp(1, 1.75, k);
    const sx = lerp(PANEL.x + PANEL.w / 2, 600, k) + (bx - PANEL.x - PANEL.w / 2) * z, sy = lerp(PANEL.y + PANEL.h / 2, 560, k) + (by - PANEL.y - PANEL.h / 2) * z;
    g.save(); g.globalAlpha = 1 - q; g.lineWidth = 8; g.strokeStyle = '#ffd23f'; g.beginPath(); g.arc(sx, sy, 40 * z * (1 + q), 0, TAU); g.stroke(); g.restore(); }
}
function section_(t) {                                 // the stairwell in section: shouts and knocks heard on every floor
  section(t, { rings: seg(T.shout - 0.1, T.shout + 0.3, t), shake: t >= T.knockW && t < A.L6w11 ? 6 : 0, peek: seg(T.hear - 0.2, T.hear + 0.8, t) });
  if (t >= T.shout && t < A.L7 - 0.3) pop('ПОМОГИТЕ!', 540, CABIN_Y - 170, 70, '#ffd23f', t, T.shout, 0.7);
  if (t >= T.knockW && t < A.L7 - 0.3) pop('ТУК! ТУК!', 540, CABIN_Y + 190, 60, '#ffffff', t, T.knockW, 0.35);
}
function night(t) {                                    // at night a knock on the flat's door: «Откройте, полиция!»
  zoomTo(410, 800, 1.05 + 0.05 * seg(A.L7, T.q, t), () => flatDoor(t, { knock: t >= T.knock ? 1 : 0, k0: T.knock }));
  if (t >= T.knock && t < T.q) pop('ТУК!', 410, 300, 80, '#ffffff', t, T.knock, 0.35);
  bubble(600, 560, 'ОТКРОЙТЕ,', 'ПОЛИЦИЯ!', clamp(sp(t, T.police - 0.08, 2.6, 8)) * (1 - seg(T.q - 0.1, T.q + 0.2, t)), '#1f5fbf', -1);
}
const SHOT = { door, trap, refuse, stays, street: street_, ride, panel, section: section_, night };

// —— Искра and Факт in front ——
const speakingAt = t => SCRIPT.lines.some(l => t >= A[l.id] - 0.02 && t <= A[l.id + 'e'] + 0.05);
function poseOf(t) {
  if (t >= A.L1 && t < A.L2 - 0.1) return 'myth';                 // «из лифта не убежишь»
  if (t >= T.say && t < T.wait) return 'hi';                       // «езжайте, я подожду»
  if (t >= A.L4 && t < A.L5 - 0.1) return 'left';                 // facing him
  if (t >= A.L6 && t < A.L7 - 0.1) return 'truth';                // the secret
  if (t >= A.L7w7) return 'right';
  return 'explain';
}
function catOf(t) {
  if (t < 0.6) return 'front';
  if (t < A.L1) return t >= T.come ? 'wow' : 'doubt';
  if (t < A.L2) return 'doubt';
  if (t >= A.L5 && t < A.L5w9) return 'wow';
  if (t >= A.L6 && t < A.L7) return 'sure';
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
  headline('ЧУЖОЙ ЗОВЁТ В ЛИФТ?', 220, hk, '#ffd23f', 66);
  headline('НЕ ЗАХОДИ!', 390, hk * clamp(sp(t, 0.05, 2.6, 8)), '#e53935', 92);
  P(T.trap - 0.1, A.L2 - 0.3, 260, { icon: 'x', title: 'ИЗ ЛИФТА НЕ УБЕЖИШЬ', color: DANGER, size: 44 });
  Hd.stepHeader(t, 1, 'НЕ ЗАХОДИ', A.L2 - 0.05, A.L3 - 0.3, 200);
  P(T.wait, A.L3 - 0.3, 1040, { icon: 'clock', title: 'ЖДИ СЛЕДУЮЩИЙ', color: OK, size: 46 });
  P(T.stays - 0.05, T.out - 0.15, 1040, { icon: 'x', title: 'НЕ УЕЗЖАЕТ?', color: GOLD, size: 46 });
  Hd.stepHeader(t, 2, 'ВЫЙДИ НА УЛИЦУ', A.L3 - 0.05, A.L4 - 0.3, 200);
  P(T.call, A.L4 - 0.3, 1040, { icon: 'phone', title: 'ЗВОНИ СВОИМ', color: OK, size: 46 });
  Hd.stepHeader(t, 3, 'ЛИЦОМ К НЕМУ', A.L4 - 0.05, A.L5 - 0.3, 200);
  P(T.face, A.L5 - 0.3, 1040, { icon: 'x', title: 'НЕ СТОЙ СПИНОЙ', color: DANGER, size: 46 });
  P(T.near, T.bell - 0.1, 1040, { icon: 'check', title: 'БЛИЖАЙШИЙ ЭТАЖ', color: OK, size: 46 });
  P(T.bell, A.L6 - 0.3, 1040, { icon: 'check', title: 'КНОПКА ДИСПЕТЧЕРА', color: OK, size: 46 });
  P(A.L6, A.L7 - 0.3, 230, { icon: 'check', title: 'СЕКРЕТ', color: GOLD, size: 50 });
  P(T.hear, A.L7 - 0.3, 1040, { icon: 'check', title: 'В ПОДЪЕЗДЕ СЛЫШНО ВСЁ', color: OK, size: 42 });
  // the end: the only choice — at the end
  headline('ЧТО ДЕЛАТЬ?', 220, clamp(sp(t, T.q, 2.4, 8)), '#ffd23f', 92);
  button('1', 'ОТКРЫТЬ', 270, 1040, clamp(sp(t, A.L7w7 - 0.06, 2.6, 8)));
  button('2', 'ЗВОНИТЬ 102', 760, 1040, clamp(sp(t, A.L7w10 - 0.06, 2.6, 8)));
}

// —— the cover: the first 3 frames ——
export const COVER = 0.05;
function cover() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  zoomTo(540, 860, 1.05, () => lift(0.6, { open: 1, eyes: 1, disp: '1' }));
  const grd = g.createLinearGradient(0, 0, 0, 640); grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, W, 640);
  const box = (s, y, size, fillC, ink, rot) => { g.save(); g.translate(540, y); g.rotate(rot); const sw = measure(s, size) + 70;
    rrect(-sw / 2 + 12, -size * 0.78 + 12, sw, size * 1.56, 26, INK); rrect(-sw / 2, -size * 0.78, sw, size * 1.56, 26, fillC); text(s, 0, size * 0.36, size, ink, { shadow: false }); g.restore(); };
  box('ЧУЖОЙ ЗОВЁТ В ЛИФТ?', 220, 66, '#ffd23f', INK, -0.04);
  box('НЕ ЗАХОДИ!', 390, 92, '#e53935', '#ffffff', 0.03);
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
  add(0.05, 'amb_flat', -22, 0, { dur: A.L7 - 0.2 });
  add(0.05, 'heartbeat', -18, 0, { dur: A.L2 });
  add(T.come, 'pop_word', -12, 0.3);
  add(A.L1w1, 'whoosh_down', -14, 0); add(T.trap + 0.2, 'hatch_knock', -12, 0);
  add(T.noRide, 'stamp', -12, 0);
  add(A.L2 - 0.1, 'whoosh_down', -16, 0);
  add(T.out, 'whoosh', -14, 0); add(T.out + 0.4, 'hatch_knock', -16, 0.2);
  add(T.call, 'beep', -16, 0, { dur: 0.6, f: 440 }); add(T.call + 1.0, 'beep', -16, 0, { dur: 0.6, f: 440 });
  add(A.L4 - 0.1, 'whoosh_down', -16, 0);
  add(T.near + 0.05, 'pop_word', -10, 0.3);
  add(T.bell + 0.1, 'ding', -10, 0.3); add(T.bell + 0.5, 'beep', -16, 0.3, { dur: 0.25, f: 990 });
  add(T.exit - 0.1, 'ding', -12, 0); add(T.exit, 'whoosh', -14, 0);
  add(T.shout, 'whoosh', -14, 0);
  for (let i = 0; i < 6; i++) add(T.knockW + i * 0.35, 'hatch_knock', -12, 0);
  add(T.hear, 'ding', -14, 0);
  for (let i = 0; i < 4; i++) add(T.knock + i * 0.35, 'hatch_knock', -8, -0.1);
  add(T.q - 0.2, 'heartbeat', -14, 0, { dur: DUR - T.q + 0.2 });
  for (const t0 of [A.L2 - 0.05, A.L3 - 0.05, A.L4 - 0.05, A.L6]) add(t0, 'pop_word', -10, 0);
  add(A.L7w7, 'pop_word', -10, 0); add(A.L7w10, 'pop_word', -10, 0);
  return c.sort((a, b) => a.t - b.t);
}
