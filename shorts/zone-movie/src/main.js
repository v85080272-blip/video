// «Зона: 5 походов» — the long 16:9 cut of the five 3D episodes (1920×1080, 30 fps). This draws everything around them:
// the centre column (x 656…1264) is where tools/assemble.sh lays the episodes and the intro montage; on the left the map
// of the Zone with the route and «ты здесь», on the right the card of the episode (its number, title, who goes, its
// rules ticking as they are said, the count of all the rules); the transitions («зрители выбрали…», the poster of the
// next episode, the route moving on the map); the outro (all 23 rules on one screen, the ones read out light up).
// LAYER=top draws only what goes over the montage in the intro (the hook and the subtitles), transparent.
// The timing comes from build/timeline.json (tools/timeline.py), the voice from build/words.json.
import fs from 'node:fs';
import { loadImage } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

const TL = JSON.parse(fs.readFileSync(new URL('../build/timeline.json', import.meta.url)));
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const TOP = process.env.LAYER === 'top';
const INTRO = TL.segs.find(s => s.kind === 'intro'), OUTRO = TL.segs.find(s => s.kind === 'outro');
export const DUR = TOP ? INTRO.t1 : TL.dur;
const EPS = TL.segs.filter(s => s.kind === 'ep'), TRS = TL.segs.filter(s => s.kind === 'trans');
const POSTER = {};
for (const e of EPS) { try { POSTER[e.k] = await loadImage(fs.readFileSync(new URL(`../build/poster_${e.k}.jpg`, import.meta.url))); } catch { POSTER[e.k] = null; } }
const A = {};
if (VOICE) for (const l of VOICE.lines) { A[l.id] = l.at; A[l.id + 'e'] = l.end; l.words.forEach((w, i) => { A[l.id + 'w' + i] = w.s; }); }
else for (const [id, t0] of Object.entries(TL.lines)) { A[id] = t0; A[id + 'e'] = t0 + 3; for (let i = 0; i < 30; i++) A[id + 'w' + i] = t0 + i * 0.36; }
Hd.SUB.y = 960; Hd.SUB.size = 50; Hd.SUB.lead = 60; Hd.SUB.maxW = 560; Hd.SUB.cx = 960;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 22, Array.isArray(l.sub) ? l.sub : null)) : [];
const GOLD = '#ffd23f', DANGER = '#e53935', OK = '#3ddc84', PAPER = '#fff3d6', BG = '#0d1220', PANEL = '#151c2e', LINE = '#2a3550';
const HOT = { УБИТЬ: DANGER, ОПАСНО: DANGER, ПРАВИЛА: GOLD, РЫЖИЙ: GOLD, ДУГА: GOLD, ПРИПЯТЬ: GOLD, ПОЖАР: DANGER, ВЕРНУЛИСЬ: OK, ПОДПИСЫВАЙСЯ: GOLD };
export const CUTS = [], SNAPS = [];
export const MARKS = { A, segs: TL.segs.map(s => ({ kind: s.kind, k: s.k ?? null, t0: s.t0, t1: s.t1 })) };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const segAt = t => TL.segs.find(s => t >= s.t0 && t < s.t1) ?? TL.segs[TL.segs.length - 1];
const CX = 656, CW = 608, RX = 1264;

// —— the map (left panel, local coordinates 0…656 × 0…1080) ——
const PTS = [['КПП «ДИТЯТКИ»', 392, 800], ['ЧАЭС', 368, 470], ['РЫЖИЙ ЛЕС', 262, 492], ['«ДУГА»', 182, 628], ['ПРИПЯТЬ', 300, 392], ['ПОЖАР', 132, 452]];
const RIVER = [[452, 120], [440, 250], [430, 360], [446, 470], [478, 560], [520, 650], [552, 760], [590, 880]];
function routeP(t) {                                   // 0 = the entry, k = episode k's place; between, the walk
  if (t < INTRO.t1) return seg(INTRO.t1 - 1.8, INTRO.t1 - 0.2, t);
  for (const s of TRS) if (t >= s.t0 && t < s.t1) return (s.k - 1) + seg(s.t0 + 0.2, s.t0 + 2.4, t);
  let p = 1; for (const e of EPS) if (t >= e.t0) p = e.k; return p;
}
function pointAt(p) { const i = Math.min(4, Math.floor(p)), u = p - i, a = PTS[i], b = PTS[i + 1]; return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
function map(t) {
  g.save(); g.translate(0, 0);
  rrect(24, 24, 608, 1032, 26, PANEL);
  text('КАРТА ЗОНЫ', 328, 92, 40, PAPER, { fam: FONTS.cond, shadow: false });
  g.save(); g.beginPath(); g.rect(24, 120, 608, 800); g.clip();
  ell(368, 470, 262, 262, '#1b2a22');                                         // the 30-km zone
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; if (i % 2) continue; limb([[368 + 262 * Math.cos(a), 470 + 262 * Math.sin(a)], [368 + 262 * Math.cos(a + TAU / 80), 470 + 262 * Math.sin(a + TAU / 80)]], 5, '#e5393588', false); }
  for (let i = 0; i < 26; i++) { const x = 120 + (i * 97) % 440, y = 220 + (i * 53) % 520; ell(x, y, 26, 18, '#24402e', 0, 0.6); }   // forest patches
  ell(250, 492, 60, 34, '#8a4a22', -0.2, 0.75);                                 // the Red Forest
  limb(RIVER, 22, '#2d6fa8'); limb(RIVER, 12, '#4a90d0');
  ell(420, 520, 22, 52, '#2d6fa8', -0.3);                                       // the cooling pond
  limb([[392, 800], [380, 650], [368, 480]], 8, '#3a4256');                     // roads
  limb([[368, 480], [300, 400]], 7, '#3a4256'); limb([[368, 480], [182, 628]], 6, '#3a4256');
  text('р. Припять', 500, 300, 22, '#7fb3e0', { fam: FONTS.mono, shadow: false, rot: 1.35 });
  text('ЧЕРНОБЫЛЬ', 500, 640, 20, '#8b97ad', { fam: FONTS.mono, shadow: false });
  text('30 км', 368, 232, 22, '#e57373', { fam: FONTS.mono, shadow: false });
  // the route walked so far
  const p = routeP(t), pts = [[PTS[0][1], PTS[0][2]]];
  for (let q = 0.05; q <= p + 1e-6; q += 0.05) pts.push(pointAt(Math.min(q, p)));
  if (pts.length > 1) { limb(pts, 9, '#00000088', false); limb(pts, 6, GOLD, false); }
  // the places: lit when reached (the intro lights them one by one)
  PTS.forEach(([name, x, y], i) => {
    const lit = i === 0 || p >= i - 0.02 || (t < INTRO.t1 && i > 0 && t >= 0.4 + (i - 1) * 1.9);
    const big = i === 1;
    if (big) { fill(smoothPath([[x - 26, y + 8], [x - 22, y - 16], [x, y - 26], [x + 22, y - 16], [x + 26, y + 8]]), '#c9d0da'); }
    ell(x, y, 13, 13, INK); ell(x, y, 10, 10, lit ? (i ? GOLD : '#8b97ad') : '#3a4256');
    if (i) text(String(i), x, y + 7, 18, INK, { fam: FONTS.block, shadow: false });
    text(name, x + (x < 200 ? 0 : 0), y - 22, 22, lit ? PAPER : '#5f6b85', { fam: FONTS.cond, shadow: false });
  });
  // you are here
  const [mx, my] = pointAt(p), pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ell(mx, my, 26 + 10 * pulse, 26 + 10 * pulse, DANGER, 0, 0.25); ell(mx, my, 15, 15, '#ffffff'); ell(mx, my, 10, 10, DANGER);
  g.restore();
  const cur = Math.round(p), name = cur ? PTS[cur][0] : 'ВХОД В ЗОНУ';
  rrect(60, 950, 536, 70, 18, '#0b1020'); text('ТЫ ЗДЕСЬ:', 120, 996, 26, '#8b97ad', { fam: FONTS.mono, shadow: false, align: 'left' });
  text(name, 300, 998, 34, GOLD, { fam: FONTS.cond, shadow: false, align: 'left' });
  g.restore();
}

// —— the episode card (right panel, local 0…656) ——
function rulesShown(t) { let n = 0; for (const e of EPS) for (const [rt] of e.rules) if (t >= e.t0 + rt) n++; return n; }
function card(t, e, a = 1) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha = a;
  text(`ПОХОД ${e.k} ИЗ 5`, 48, 150, 30, GOLD, { fam: FONTS.mono, shadow: false, align: 'left' });
  const size = measure(e.title, 64) > 560 ? 52 : 64;
  text(e.title, 48, 230, size, PAPER, { align: 'left' });
  text('с нами: ' + e.with_, 48, 285, 28, '#a9b4c9', { fam: FONTS.cond, shadow: false, align: 'left' });
  text('ПРАВИЛА ПОХОДА', 48, 360, 26, '#8b97ad', { fam: FONTS.mono, shadow: false, align: 'left' });
  e.rules.forEach(([rt, r], i) => {
    const t0 = e.t0 + rt, on = t >= t0, k = on ? clamp(sp(t, t0, 2.6, 8)) : 0, y = 400 + i * 74;
    rrect(40, y, 576, 62, 14, on ? '#1f2a44' : '#121828');
    rrect(56, y + 13, 36, 36, 9, on ? OK : '#2a3550');
    if (on) text('✓', 74, y + 43, 32 * Math.min(1, k * 1.3), INK, { fam: FONTS.block, shadow: false });
    const fs_ = measure(r, 30, FONTS.cond) > 470 ? 26 : 30;
    text(r, 108, y + 42, fs_, on ? PAPER : '#4a5672', { fam: FONTS.cond, shadow: false, align: 'left', a: on ? lerp(0.4, 1, Math.min(1, k)) : 1 });
  });
  g.restore();
}
function counter(t) {
  const n = rulesShown(t), y = 960;
  rrect(40, y - 50, 576, 100, 18, '#0b1020');
  text('ПРАВИЛ ЗОНЫ', 64, y - 6, 28, '#8b97ad', { fam: FONTS.mono, shadow: false, align: 'left' });
  text(`${n} / 23`, 590, y + 4, 44, GOLD, { fam: FONTS.block, shadow: false, align: 'right' });
  fill(rrPath(64, y + 20, 520, 12, 6), '#2a3550'); fill(rrPath(64, y + 20, 520 * n / 23, 12, 6), GOLD);
}
function right(t, s) {
  g.save(); g.translate(RX, 0);
  rrect(24, 24, 608, 1032, 26, PANEL);
  text('ЗОНА · 5 ПОХОДОВ', 48, 84, 28, '#e57373', { fam: FONTS.mono, shadow: false, align: 'left' });
  if (s.kind === 'intro') {
    const k = clamp(sp(t, 0.0, 2.4, 8));
    text('ЗОНА', 328, 330, 170 * lerp(1.15, 1, Math.min(1, k)), GOLD, {});
    text('5 ПОХОДОВ В ЧЕРНОБЫЛЬ', 328, 420, 44, PAPER, { fam: FONTS.cond, shadow: false });
    ['К реактору', 'Рыжий лес', 'Радар «Дуга»', 'Мёртвый город', 'Лес горит'].forEach((n, i) => {
      const t0 = 0.4 + i * 1.9, a = t >= t0 ? clamp((t - t0) / 0.25) : 0.25;
      text(`${i + 1}. ${n}`, 120, 520 + i * 62, 34, a >= 1 ? PAPER : '#5f6b85', { fam: FONTS.cond, shadow: false, align: 'left' });
    });
    text('в финале — все 23 правила', 328, 870, 30, OK, { fam: FONTS.cond, shadow: false });
  } else if (s.kind === 'ep') card(t, s, 1);
  else if (s.kind === 'trans') {
    const prev = EPS.find(e => e.k === s.k - 1), next = EPS.find(e => e.k === s.k), u = seg(s.t0 + 0.2, s.t0 + 0.9, t);
    card(t, prev, 1 - u); card(t, next, u);
  }
  if (s.kind !== 'intro') counter(t);
  g.restore();
}

// —— the centre column ——
function frameCol() { rect(CX - 6, 0, 6, H, '#000000'); rect(CX + CW, 0, 6, H, '#000000'); }
function trans(t, s) {
  const img = POSTER[s.k], e = EPS.find(x => x.k === s.k);
  if (img) g.drawImage(img, CX, 0, CW, H); else rect(CX, 0, CW, H, '#222a3d');
  // the next episode either fades in from black (1–4: the transition ends in black) or opens on a bright frame (5: revealed)
  const reveal = e.black ? 0 : seg(s.t1 - 0.7, s.t1 - 0.05, t), dark = e.black ? lerp(0.62, 1, seg(s.t1 - 0.6, s.t1 - 0.05, t)) : 0.62 * (1 - reveal);
  g.save(); g.globalAlpha = dark; rect(CX, 0, CW, H, '#000000'); g.restore();
  const k = clamp(sp(t, s.t0 + 0.1, 2.4, 8)) * (1 - seg(s.t1 - 0.7, s.t1 - 0.15, t));
  if (k > 0.01) {
    g.save(); g.translate(960, 420); g.scale(k, k);
    rrect(-270 + 8, -150 + 10, 540, 300, 26, INK); rrect(-270, -150, 540, 300, 26, PAPER);
    text(e.chosen || 'ДАЛЬШЕ', 0, -82, 30, '#c0392b', { fam: FONTS.mono, shadow: false });
    text(`ПОХОД ${e.k}`, 0, -22, 34, INK, { fam: FONTS.cond, shadow: false });
    const sz = measure(e.title, 64) > 480 ? 50 : 64;
    text(e.title, 0, 60, sz, INK, { shadow: false });
    g.restore();
  }
}
// the hook over the montage (top layer)
function hook(t) {
  const k = clamp(sp(t, -0.2, 2.4, 8)), out = seg(INTRO.t1 - 0.6, INTRO.t1 - 0.1, t);
  if (out >= 1) return;
  g.save(); g.globalAlpha = 1 - out; g.translate(960, 150); g.rotate(-0.03); g.scale(k, k);
  const s1 = 'ЧТО ТЕБЯ УБЬЁТ', s2 = 'В ЗОНЕ?';
  rrect(-280 + 8, -86 + 10, 560, 200, 24, INK); rrect(-280, -86, 560, 200, 24, GOLD);
  text(s1, 0, -6, 58, INK, { shadow: false }); text(s2, 0, 78, 70, DANGER, { shadow: false });
  g.restore();
}

// —— the outro: all the rules on one screen ——
const READ = { O2: [[1, 0, 0], [1, 1, 6], [4, 1, 10]], O3: [[2, 0, 0], [2, 1, 4], [3, 1, 8]], O4: [[4, 0, 0], [5, 0, 4], [5, 2, 9]] };
function lit(t) {                                       // which rules the voice is reading: {`${ep}:${i}`: since}
  const L = {};
  for (const [id, list] of Object.entries(READ)) for (const [ep, i, w] of list) { const t0 = A[id + 'w' + w]; if (t0 != null && t >= t0 - 0.1) L[`${ep}:${i}`] = t0; }
  return L;
}
function outro(t, s) {
  rect(0, 0, W, H, BG);
  const k0 = clamp(sp(t, s.t0 + 0.1, 2.4, 8));
  g.save(); g.translate(960, 96); g.scale(k0, k0); text('23 ПРАВИЛА ЗОНЫ', 0, 22, 72, GOLD, {}); g.restore();
  text('сохрани, чтобы не забыть', 960, 160, 30, '#a9b4c9', { fam: FONTS.cond, shadow: false });
  const L = lit(t);
  let n = 0;
  EPS.forEach((e, c) => {
    const x = 40 + c * 372, colK = clamp(sp(t, s.t0 + 0.3 + c * 0.25, 2.6, 8));
    g.save(); g.globalAlpha = Math.min(1, colK * 2);
    rrect(x, 200, 356, 66, 16, '#1f2a44'); text(`${e.k} · ${e.title}`, x + 178, 245, measure(`${e.k} · ${e.title}`, 30, FONTS.cond) > 320 ? 24 : 30, PAPER, { fam: FONTS.cond, shadow: false });
    e.rules.forEach(([, r], i) => {
      const y = 286 + i * 104, key = `${e.k}:${i}`, on = L[key] != null, pk = on ? bump(clamp((t - L[key]) / 0.5)) : 0;
      g.save(); g.translate(x + 178, y + 46); g.scale(1 + 0.06 * pk, 1 + 0.06 * pk);
      rrect(-178, -46, 356, 92, 16, on ? '#3b3212' : PANEL);
      if (on) { g.save(); g.globalAlpha *= 0.9; fill(rrPath(-178, -46, 356, 92, 16), 'rgba(255,210,63,0.18)'); g.restore(); limb([[-178, -46], [178, -46], [178, 46], [-178, 46], [-178, -46]], 4, GOLD, false); }
      ell(-146, 0, 16, 16, on ? GOLD : OK); text('✓', -146, 9, 22, INK, { fam: FONTS.block, shadow: false });
      wrap(r, -118, 0, 300, 25, on ? '#ffffff' : '#d5dbea');
      g.restore();
      n++;
    });
    g.restore();
  });
  // subscribe at the end
  const ks = clamp(sp(t, (A.O5 ?? s.t1 - 3) - 0.1, 2.6, 7));
  if (ks > 0.01) { g.save(); g.translate(960, 900); g.scale(ks, ks); rrect(-250 + 6, -50 + 8, 500, 100, 50, INK); rrect(-250, -50, 500, 100, 50, DANGER); text('ПОДПИСЫВАЙСЯ', 0, 17, 50, '#ffffff', { shadow: false }); g.restore(); }
}
function wrap(str, x, y, maxW, size, color) {           // up to two lines, left aligned, centred on y
  const words = str.split(' '), lines = [''];
  for (const w of words) { const tryL = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (measure(tryL, size, FONTS.cond) > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tryL; }
  lines.forEach((l, i) => text(l, x, y + size * 0.36 + (i - (lines.length - 1) / 2) * size * 1.15, size, color, { fam: FONTS.cond, shadow: false, align: 'left' }));
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (TOP) { g.clearRect(0, 0, W, H); hook(t); subs(t); return; }
  const s = segAt(t);
  if (s.kind === 'outro') { outro(t, s); subs(t); Hd.finish(t, 0.4); return; }
  rect(0, 0, W, H, BG);
  map(t); right(t, s);
  if (s.kind === 'trans') trans(t, s); else rect(CX, 0, CW, H, '#000000');
  frameCol();
  if (s.kind === 'trans') subs(t);
  Hd.finish(t, 0.3);
}
function subs(t) { g.setTransform(1, 0, 0, 1, 0, 0); Hd.karaoke(t, SUBS, HOT); }
export function motion() { return 0; }
export function cues() { return []; }
