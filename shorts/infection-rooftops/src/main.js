// «По крышам» («Заражение», серия 4, в 3D): only the 2D layer over the Blender shots — the time stamps, the steps, the
// cards with the names of the two who joined us, the choice, the subtitles, the dips to black at the cuts. The picture
// is rendered by blender/rooftops.py (one run per shot) and put together by tools/bg.py; render.mjs draws this layer on
// a transparent canvas (OVERLAY=1 FPS=30) and ffmpeg lays it over. Every beat is anchored to the narrator's words.
// The shots: A (L0) the three on our roof, a torch blinks on the lower one · B (L1) walking, the torch at his feet ·
// C (L2) the glowing line two metres from the edge · D (L3) down the fire ladder, three points · E (L4) Красотка and
// Соломия · F (L5) the radio, the focus to the stadium · G (L6–L7) the five of them, the city, the choice.
import fs from 'node:fs';
import { lerp, clamp, ease, spring } from './lib.js';
import { g, W, H, rect, rrect, ell } from './flat.js';
import * as Hd from './hud.js';
import { text, measure, FONTS, INK } from './type.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 4.4, 12], L1: [4.85, 7.0, 6], L2: [8.3, 11.6, 11], L3: [12.0, 16.0, 12], L4: [16.5, 20.4, 11], L5: [20.85, 24.6, 10],
  L6: [25.05, 29.3, 13], L7: [29.75, 34.3, 14] };
export const DUR = VOICE?.dur ?? 34.7;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 78; Hd.SUB.lead = 92;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { НИМ: GOLD, ЭТАЖЕЙ: DANGER, ШАГОМ: GOLD, НОГИ: GOLD, МЕТРОВ: GOLD, ВЕТЕР: DANGER, ЛИЦОМ: GOLD, ОПОРЫ: GOLD,
  КРАСОТКА: '#c59bff', СОЛОМИЯ: '#ffd23f', РАЦИЕЙ: OK, СЕМЬ: GOLD, СТАДИОНА: GOLD, ПЯТЕРО: OK, ВЕРТОЛЁТ: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots: each line is a shot; the last one holds L6 and L7 ——
const T = {
  cA: 0, cB: A.L1 - 0.06, cC: A.L2 - 0.06, cD: A.L3 - 0.06, cE: A.L4 - 0.06, cF: A.L5 - 0.06, cG: A.L6 - 0.06,
  names: A.L4w4 - 0.06,              // «Красотка и Соломия»
  radio: A.L5w5 - 0.06,              // «эвакуация со стадиона»
  choice: A.L6w3 - 0.06,
  c8: A.L7 - 0.06,
};
export const SHOTS = [['A', T.cA, T.cB], ['B', T.cB, T.cC], ['C', T.cC, T.cD], ['D', T.cD, T.cE], ['E', T.cE, T.cF], ['F', T.cF, T.cG], ['G', T.cG, DUR]];
export const CUTS = [T.cB, T.cC, T.cD, T.cE, T.cF, T.cG];
export const SNAPS = [];
export const MARKS = { ...T, A, shots: SHOTS };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 1 - ease.out(clamp(t / 0.45));
  for (const c of CUTS) if (t >= c && t < c + 0.2) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  Hd.timeStamp(t, 0.35, T.cD - 0.2, '22:05 — НАША КРЫША', { y: 170 });
  Hd.timeStamp(t, T.cD + 0.2, T.cE - 0.2, '22:09 — ПОЖАРНАЯ ЛЕСТНИЦА', { y: 170 });
  Hd.timeStamp(t, T.cE + 0.2, DUR, '22:12 — СОСЕДНИЙ ПОДЪЕЗД', { y: 170 });
  if (t < T.cB) {
    Hd.plaque(t, A.L0w1, T.cB - 0.05, 540, 330, { icon: 'comment', title: 'ВЫ ВЫБРАЛИ: К НИМ', sub: 'по вашим комментариям', color: GOLD });
    Hd.plaque(t, A.L0w8 - 0.1, T.cB - 0.05, 540, 470, { icon: 'stairs', title: 'НА 5 ЭТАЖЕЙ НИЖЕ', sub: 'соседний подъезд', color: WARM, size: 38 });
  }
  Hd.stepHeader(t, 1, 'ТОЛЬКО ШАГОМ', A.L1 + 0.02, A.L1e - 0.05);
  if (t >= T.cB && t < T.cC) Hd.plaque(t, A.L1w4, T.cC - 0.05, 540, 470, { icon: 'torch', title: 'СВЕТИ ПОД НОГИ', sub: 'видишь, куда ступаешь', color: OK, size: 40 });
  Hd.stepHeader(t, 2, '2 МЕТРА ОТ КРАЯ', A.L2 + 0.02, A.L2e - 0.05);
  if (t >= T.cC && t < T.cD) Hd.plaque(t, A.L2w7 - 0.05, T.cD - 0.05, 540, 470, { icon: 'x', title: 'ВЕТЕР И ТЕМНОТА', sub: 'край не прощает', color: DANGER, size: 40 });
  Hd.stepHeader(t, 3, 'ТРИ ТОЧКИ ОПОРЫ', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.cD && t < T.cE) Hd.plaque(t, A.L3w8 - 0.05, T.cE - 0.05, 540, 470, { icon: 'check', title: '2 РУКИ + 1 НОГА', sub: 'или 2 ноги + 1 рука', color: OK, size: 40 });
  if (t >= T.cE && t < T.cF) {
    Hd.plaque(t, T.names, T.cF - 0.05, 300, 380, { icon: 'torch', title: 'КРАСОТКА', sub: '@красотка-ь2ж6д', color: '#c59bff', size: 40 });
    Hd.plaque(t, T.names + 0.35, T.cF - 0.05, 780, 520, { icon: 'phone', title: 'СОЛОМИЯ', sub: '@СоломіяАртемчук', color: '#ffd23f', size: 40 });
  }
  if (t >= T.cF && t < T.cG) Hd.plaque(t, T.radio, T.cG - 0.05, 540, 380, { icon: 'clock', title: 'ЭВАКУАЦИЯ В 7:00', sub: 'со стадиона', color: GOLD, size: 46 });
  if (t >= T.cG) {
    Hd.plaque(t, A.L6 + 0.1, T.choice - 0.1, 540, 380, { icon: 'check', title: 'НАС ПЯТЕРО', sub: 'с Красоткой и Соломией', color: OK });
    [['1', 'К СТАДИОНУ', A.L6w3], ['2', 'ЖДЁМ ВЕРТОЛЁТ', A.L6w5]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c8, T.c8 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c8) Hd.plaque(t, A.L7w1 - 0.1, DUR + 1, 540, 620, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 5 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L7w12 - 0.1, 0, 300);
  Hd.karaoke(t, SUBS, HOT);
}
export function motion() { return 0; }

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.0, 'roof_wind', -16, 0, { dur: DUR });
  add(0.2, 'zombie_crowd', -26, 0.2, { dur: DUR - 0.4 });
  const blinkT = T.cA + (T.cB - T.cA) * 0.35;
  for (let i = 0; i < 3; i++) add(blinkT + i * 0.4, 'beep', -20, 0.6, { dur: 0.2, f: 1180 });
  add(T.cB, 'steps_roof', -8, 0, { dur: T.cC - T.cB, rate: 1.6 });
  add(T.cB + 0.1, 'click', -10, 0.2);
  add(T.cC, 'steps_roof', -12, 0.1, { dur: T.cD - T.cC, rate: 1.8 });
  add(T.cC + 0.3, 'wind_gust', -10, 0.4, { dur: T.cD - T.cC });
  for (let i = 0; i < 10; i++) add(T.cD + 0.2 + i * (T.cE - T.cD - 0.4) / 10, 'ladder_rung', -10, 0.1);
  add(T.cE, 'steps_roof', -12, -0.2, { dur: 1.6, rate: 1.6 });
  add(T.names, 'ding', -12, -0.3); add(T.names + 0.35, 'ding', -12, 0.3);
  add(T.cF, 'radio_static', -8, 0.1, { dur: T.cG - T.cF });
  add(T.radio, 'blip', -8, 0);
  add(T.cG, 'heartbeat', -16, 0, { dur: T.c8 - T.cG, bpm: 90 });
  for (let i = 0; i < 2; i++) add((i ? A.L6w5 : A.L6w3) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L7w1 - 0.1, 'blip', -8, 0);
  add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
