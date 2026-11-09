// «Мёртвый город» («Зона», серия 4, в 3D): Blender draws the picture (blender/pripyat.py, one run per shot); this file draws
// the 2D layer on a transparent canvas (OVERLAY=1): the dips at the cuts, the dosimeter, the nick cards, the plaques, the
// 1986 stamp, the choice, the subtitles; and it gives the cues for the sound. Beats are anchored to the narrator's words
// (build/words.json from tools/voice.py; before the voice exists, a rough timing from voice/script.json).
// Viewers voted for the dead city; Коля, Настя and Мэри wrote «возьми с собой», and Богдан comes again. Pripyat: a city of
// fifty thousand, empty forty years. Emptied in three hours, «for three days». One: don't go into the houses — floors and
// stairs give way; a balcony slab comes down. Two: take nothing — Мэри puts the gas mask down. Three: not into the hospital
// basement — the firemen's clothes are still there. Out before dark; the frame at the exit: all clean. Next: a night in the
// Zone or the forest fire?
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, rect, rrect, fill, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration ——
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
Hd.SUB.y = 1450; Hd.SUB.size = 78; Hd.SUB.lead = 92;            // over 3D: low, clear of the people
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { ПЯТЬДЕСЯТ: GOLD, СОРОК: GOLD, ВНУТРЬ: DANGER, ПРИПЯТЬ: GOLD, КОЛЯ: GOLD, НАСТЯ: GOLD, МЭРИ: GOLD, СОБОЙ: GOLD, БОГДАН: GOLD,
  ЧАСА: DANGER, ДНЯ: GOLD, ВЕРНУЛСЯ: DANGER, ДОМА: DANGER, ЗАХОДИ: DANGER, ПРОВАЛИВАЮТСЯ: DANGER, ГРОХОТ: DANGER, ПЛИТА: DANGER,
  БЕРИ: DANGER, ПРОТИВОГАЗ: GOLD, ПЫЛЬ: DANGER, ПОДВАЛ: DANGER, ПОЖАРНЫХ: WARM, РАДИОАКТИВНЫХ: DANGER, ТЕМНЕЕТ: WARM,
  ЗАКАТА: WARM, НЕЛЬЗЯ: DANGER, ЧИСТО: OK, БРОСИЛА: OK, НОЧЬ: GOLD, ПОЖАР: DANGER, ПОДПИСЫВАЙСЯ: GOLD };

// —— the beats: one shot per line (the last shot holds the choice and the end) ——
const T = {
  c1: A.L1 - 0.06, c2: A.L2 - 0.06, c3: A.L3 - 0.06, c4: A.L4 - 0.25, c5: A.L5 - 0.06, c6: A.L6 - 0.06, c7: A.L7 - 0.06,
  c8: A.L8 - 0.06, c9: A.L9 - 0.06, c10: A.L10 - 0.06,
  crash: A.L4w3 - 0.05,                 // «грохот»
};
export const SHOTS = [['A', 0, T.c1], ['B', T.c1, T.c2], ['C', T.c2, T.c3], ['D', T.c3, T.c4], ['E', T.c4, T.c5], ['F', T.c5, T.c6],
  ['G', T.c6, T.c7], ['H', T.c7, T.c8], ['I', T.c8, T.c9], ['J', T.c9, T.c10], ['K', T.c10, DUR]];
const shotOf = n => SHOTS.find(s => s[0] === n);
const frac = (n, t) => { const [, a, b] = shotOf(n); return clamp((t - a) / (b - a), 0.02, 0.95); };
// what happens inside a shot, as fractions of it (blender/pripyat.py reads them as EV): the waves at the names, the hand on
// Коля's shoulder, the slab, the gas mask picked up and put down, Богдан's hand on Настя, Мэри's thumbs up
export const EV = {
  B: [frac('B', A.L1w4), frac('B', A.L1w5), frac('B', A.L1w7), frac('B', A.L1w15)],
  D: [frac('D', A.L3w3)],
  E: [frac('E', T.crash - 0.25)],
  F: [frac('F', A.L5 + 0.1), frac('F', A.L5w5)],
  G: [frac('G', A.L6w4)],
  J: [frac('J', A.L9w6)],
};
export const STEP = { A: 3, B: 2, C: 3, D: 2, E: 2, F: 2, G: 2, H: 3, I: 3, J: 2, K: 3 };
export const NF = Object.fromEntries(SHOTS.map(([n, a, b]) => [n, Math.round((b - a) * 30) + STEP[n]]));
export const CUTS = SHOTS.slice(1).map(s => s[1]);
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS, ev: EV, step: STEP, nf: NF };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const shotAt = t => { let s = 'A'; for (const [n, a] of SHOTS) if (t >= a) s = n; return s; };

export function init() { Hd.initHud(); }

// —— the frame (OVERLAY): transparent but for what is drawn here ——
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = shotAt(t);
  if (process.env.OVERLAY !== '1') { g.fillStyle = '#2a2d36'; g.fillRect(0, 0, W, H); text(sh, 540, 980, 300, '#3a3e4a', { fam: FONTS.block, shadow: false }); }
  let dip = 1 - ease.out(clamp(t / 0.45));
  for (const c of CUTS) if (t >= c && t < c + 0.2) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  if (sh === 'E' && t > T.crash - 0.05 && t < T.crash + 0.5) { const u = (t - T.crash + 0.05) / 0.55; g.globalAlpha = 0.25 * (1 - u); rect(0, 0, W, H, '#d8d0c0'); g.globalAlpha = 1; }
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
}

// —— the dosimeter in the corner (µSv/h): low in the streets, up in the school room, wild in the basement ——
function dosimeter(t) {
  const sh = shotAt(t);
  const a = clamp((t - 0.3) / 0.4) * (1 - seg(T.c10 + 0.2, T.c10 + 0.6, t)) * (sh === 'C' ? 0 : 1);
  if (a <= 0.01) return;
  const base = { A: 0.3, B: 0.3, D: 0.42, E: 0.42, F: 1.4, G: 3.1, I: 0.36, J: 0.18 }[sh] ?? 0.3;
  const hot = sh === 'H', v = hot ? 40 + 59 * seg(T.c7, T.c8 - 0.4, t) + 3 * Math.sin(t * 31) : base * (1 + 0.05 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
  const x = 1080 - 60 - 250, y = 118, w = 250, h = 112, blink = hot && (t * 4) % 1 < 0.5;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  g.save(); g.shadowColor = hot ? 'rgba(255,60,40,0.8)' : 'rgba(0,0,0,0.5)'; g.shadowBlur = hot ? 30 : 18; g.shadowOffsetY = 6; fill(rrPath(x, y, w, h, 18), '#f2b705'); g.restore();
  fill(rrPath(x + 12, y + 12, w - 24, h - 40, 10), hot ? (blink ? '#ff6b5a' : '#e8b0a8') : '#9fd39b');
  text(v.toFixed(2).replace('.', ','), x + w - 26, y + 62, 52, '#14231a', { fam: FONTS.mono, align: 'right', shadow: false });
  text('мкЗв/ч', x + 22, y + h - 10, 24, INK, { fam: FONTS.mono, align: 'left', shadow: false });
  ell(x + w - 30, y + h - 18, 8, 8, hot ? '#d62828' : '#2f7d32');
  g.restore();
}
// the four nicks: a card pops in as each is named (mono: «б» must not read as «6»)
const NICKS = [['@KolyaKostenko', 'написал «возьми меня с собой»', 'L1w4'], ['@НастяКарпенко-э9с', 'написала «возьми с собой»', 'L1w5'],
  ['@MaryMama2308', 'написала «возьми с собой»', 'L1w7'], ['@БогданУзун-6б6', 'снова с нами', 'L1w15']];
function nickCards(t) {
  if (shotAt(t) !== 'B') return;
  NICKS.forEach(([s1, s2, w_], i) => {
    const k = clamp(sp(t, A[w_] - 0.05, 2.6, 8)) * (1 - seg(T.c2 - 0.3, T.c2 - 0.02, t));
    if (k <= 0.01) return;
    const w = Math.max(measure(s1, 40, FONTS.mono), measure(s2, 28, FONTS.mono)) + 140, y = 330 + i * 150;
    g.save(); g.translate(540, y); g.rotate(i % 2 ? 0.02 : -0.02); g.scale(k, k);
    rrect(-w / 2 + 6, -62 + 8, w, 124, 22, INK); rrect(-w / 2, -62, w, 124, 22, '#fff3d6');
    g.save(); g.translate(-w / 2 + 58, -4); Hd.icon('comment', 26, '#3b8eea'); g.restore();
    text(s1, 34, -2, 40, INK, { fam: FONTS.mono, shadow: false });
    text(s2, 34, 40, 28, '#5a5f6e', { fam: FONTS.mono, shadow: false });
    g.restore();
  });
}
// 1986: a film stamp in the corner and the facts as plaques
function film(t) {
  if (shotAt(t) !== 'C') return;
  Hd.timeStamp(t, T.c2 + 0.1, T.c3 - 0.1, '27.04.1986 · ЭВАКУАЦИЯ', { color: WARM, dot: DANGER });
}
function overlays(t) {
  const sh = shotAt(t);
  Hd.timeStamp(t, 0.3, T.c2 - 0.1, 'ПРИПЯТЬ · 11:20', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c3 + 0.15, T.c8 - 0.1, 'ПРИПЯТЬ · 14:05', { color: WARM, dot: DANGER });
  Hd.timeStamp(t, T.c8 + 0.15, DUR, 'ЗАКАТ · 18:40', { color: WARM, dot: OK });
  dosimeter(t); nickCards(t); film(t);
  if (sh === 'A') Hd.plaque(t, A.L0w6, T.c1 - 0.05, 540, 420, { icon: 'house', title: 'ГОРОД-ПРИЗРАК', sub: '50 000 жителей · пусто 40 лет', color: GOLD, size: 44 });
  if (sh === 'C') {
    Hd.plaque(t, A.L2w2, T.c3 - 0.05, 540, 420, { icon: 'clock', title: 'ЗА 3 ЧАСА', sub: 'около 1200 автобусов', color: WARM, size: 46 });
    Hd.plaque(t, A.L2w6, T.c3 - 0.05, 540, 560, { icon: 'comment', title: '«НА ТРИ ДНЯ»', sub: 'никто не вернулся', color: DANGER, size: 42 });
  }
  Hd.stepHeader(t, 1, 'НЕ ЗАХОДИ В ДОМА', A.L3 + 0.02, T.c4 - 0.05);
  if (sh === 'D') Hd.plaque(t, A.L3w5, T.c4 - 0.05, 540, 470, { icon: 'x', title: '40 ЛЕТ БЕЗ РЕМОНТА', sub: 'пол и лестницы проваливаются', color: DANGER, size: 40 });
  if (sh === 'E') Hd.plaque(t, T.crash + 0.25, T.c5 - 0.05, 540, 420, { icon: 'x', title: 'ВОТ ПОЧЕМУ', sub: 'бетон падает сам', color: DANGER, size: 46 });
  Hd.stepHeader(t, 2, 'НИЧЕГО НЕ БЕРИ', A.L5 + 0.02, T.c6 - 0.05);
  if (sh === 'F') Hd.plaque(t, A.L5w7, T.c6 - 0.05, 540, 470, { icon: 'x', title: 'РАДИОАКТИВНАЯ ПЫЛЬ', sub: 'на старых вещах', color: DANGER, size: 40 });
  Hd.stepHeader(t, 3, 'НЕ В ПОДВАЛ', A.L6 + 0.02, T.c7 - 0.05);
  if (sh === 'G') Hd.plaque(t, A.L6w6, T.c7 - 0.05, 540, 470, { icon: 'medkit', title: 'БОЛЬНИЦА МСЧ-126', sub: 'сюда привезли пожарных в 1986-м', color: WARM, size: 38 });
  if (sh === 'H') Hd.plaque(t, T.c7 + 0.2, T.c8 - 0.05, 540, 420, { icon: 'flame', title: 'ОДЕЖДА ПОЖАРНЫХ', sub: 'лежит здесь с 1986 года', color: DANGER, size: 44 });
  if (sh === 'I') Hd.plaque(t, A.L8w2, T.c9 - 0.05, 540, 420, { icon: 'clock', title: 'ДО ЗАКАТА', sub: 'ночевать в Зоне нельзя', color: WARM, size: 46 });
  if (sh === 'J') {
    Hd.plaque(t, A.L9w3, T.c10 - 0.05, 540, 420, { icon: 'check', title: 'ЧИСТО', sub: 'рамка пропустила всех', color: OK, size: 52 });
  }
  if (t >= T.c10) {
    [['1', 'НОЧЬ В ЗОНЕ', A.L10w2], ['2', 'ЛЕСНОЙ ПОЖАР', A.L10w6]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(A.L11 - 0.06, A.L11 + 0.24, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= A.L11) Hd.plaque(t, A.L11w1 - 0.1, DUR + 1, 540, 730, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 5 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L11w12 - 0.1, 0, 300);
}

export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.2, 'roof_wind', -16, 0, { dur: T.c2 - 0.2 });
  add(0.6, 'tweet', -22, 0.3, { dur: 1.2 }); add(T.c1 + 0.3, 'tweet', -22, -0.3, { dur: 1.2 });
  add(T.c1 + 0.2, 'steps_out', -16, 0, { dur: T.c2 - T.c1 - 0.3 });
  for (const w_ of ['L1w4', 'L1w5', 'L1w7', 'L1w15']) add(A[w_] + 0.02, 'pop_word', -10, 0);
  add(T.c2, 'crowd_murmur', -20, 0, { dur: T.c3 - T.c2 }); add(T.c2 + 0.2, 'heli_far', -22, -0.4, { dur: T.c3 - T.c2 - 0.3 });
  add(T.c3, 'roof_wind', -18, 0, { dur: T.c8 - T.c3 }); add(T.c3 + 0.1, 'steps_out', -12, 0.2, { dur: T.c4 - T.c3 - 0.2 });
  add(T.crash, 'wall_hit', -2, 0.2); add(T.crash + 0.15, 'thud', -6, 0.1);
  add(T.c5 + 0.1, 'cloth', -14, 0.1); add(A.L5w5, 'thud', -16, 0.2);
  add(T.c6, 'door_creak', -16, 0.3, { dur: 0.9 }); add(T.c6 + 0.3, 'dog_growl', -16, -0.3, { dur: 0.9 });
  add(T.c7, 'breath', -12, 0, { dur: T.c8 - T.c7 }); add(T.c7, 'heartbeat', -14, 0, { dur: T.c8 - T.c7, bpm: 96 });
  add(T.c7 + 0.2, 'beep', -16, 0.4); add(T.c7 + 0.6, 'beep', -14, 0.4); add(T.c7 + 0.9, 'beep', -12, 0.4);
  add(T.c8, 'roof_wind', -18, 0, { dur: DUR - T.c8 }); add(T.c8 + 0.1, 'steps_out', -11, 0, { dur: T.c9 - T.c8 - 0.2 });
  add(T.c9 + 0.3, 'blip', -12, 0); add(T.c9 + 0.9, 'blip', -12, 0); add(A.L9w3, 'ding', -10, 0);
  add(T.c10 + 0.3, 'tweet', -20, 0.4, { dur: 1.2 });
  for (let i = 0; i < 2; i++) add((i ? A.L10w6 : A.L10w2) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L11w1 - 0.1, 'blip', -8, 0);
  add(A.L11w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
