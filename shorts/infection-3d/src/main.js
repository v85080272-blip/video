// «Заражение», проба в 3D (10 с): only the 2D layer over the Blender shots — labels, karaoke subtitles, the dips to black.
// The picture itself is rendered by blender/stairwell.py and graded by tools/bg3d.py; render.mjs draws this layer on a
// transparent canvas (OVERLAY=1) and ffmpeg lays it over the 3D footage. Every beat is anchored to the narrator's words
// (build/words.json from tools/voice.py, or tools/fake_words.mjs until the voice exists).
// The shots (the Blender scenes start at frame 0 on each cut, 30 fps):
//   s1 — down the stairwell gap from the 15th floor, a light far below («Лифт в нашем доме стоит на первом этаже»);
//   s2 — the 1st floor: the lift stands open, backlit, someone inside; his head jerks («Двери открыты. И внутри кто-то есть»);
//   s3 — the three on the 15th landing, the torch beam down the gap; баба Валя crosses herself, Пурга looks down.
import fs from 'node:fs';
import { lerp, clamp, ease } from './lib.js';
import { g, W, H, rect } from './flat.js';
import * as Hd from './hud.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.3, 2.5, 8], L1: [3.05, 5.5, 6], L2: [6.1, 10.1, 9] };
const VDUR = VOICE?.dur ?? 10.66;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 78; Hd.SUB.lead = 92;           // below the people in the frame, above the Shorts caption
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const HOT = { ЛИФТ: Hd.NIGHT.gold, ПЕРВОМ: Hd.NIGHT.gold, 'КТО-ТО': Hd.NIGHT.danger, ПЕРЕКРЕСТИЛАСЬ: Hd.NIGHT.warm, ЛАЯЛА: Hd.NIGHT.warm, ВНИЗ: Hd.NIGHT.danger };

// —— the shots ——
const T = {
  c1: A.L1 - 0.06,                 // «Двери открыты»: the lift on the 1st floor
  twitch: A.L1 - 0.06 + 55 / 30,   // his head jerks (Blender frame 55 of s2)
  c2: A.L2 - 0.06,                 // «Баба Валя перекрестилась»: the three on the 15th
  cross: A.L2 - 0.06 + 12 / 30,    // her hand goes up (frame 12 of s3)
  peer: A.L2 - 0.06 + 82 / 30,     // Пурга lowers her head over the gap (frame 82)
  black: A.L2e + 0.2,              // cut to black; something answers from below
};
export const DUR = Math.max(VDUR, T.black + 1.3);     // the last growl plays over black
export const SHOTS = [['s1', 0, T.c1], ['s2', T.c1, T.c2], ['s3', T.c2, T.black]];
export const CUTS = [T.c1, T.c2, T.black];
export const SNAPS = [];
export const MARKS = { ...T, A };

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  // the dips: each shot comes up out of black in a few frames, the first one slower
  let dip = 1 - ease.out(clamp(t / 0.45));
  for (const c of [T.c1, T.c2]) if (t >= c && t < c + 0.2) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (t >= T.black) dip = 1;
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  // the service stamps, as in a survivor's log: the series, then where we are
  Hd.timeStamp(t, 0.35, T.c1 - 0.25, 'ЗАРАЖЕНИЕ · СЕРИЯ 3', { y: 170 });
  Hd.timeStamp(t, T.c1 + 0.25, T.c2 - 0.25, '1 ЭТАЖ · 07:52', { y: 170 });
  Hd.timeStamp(t, T.c2 + 0.25, T.black - 0.3, '15 ЭТАЖ · 07:53', { y: 170 });
  if (t < T.black) Hd.karaoke(t, SUBS, HOT);
}
export function motion() { return 0; }

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.0, 'stairwell_air', -18, 0, { dur: T.c1 + 0.3 });
  add(0.4, 'heartbeat', -14, 0, { dur: T.c1 - 0.2, bpm: 72 });
  add(1.5, 'zombie_far', -12, -0.2, { dur: 1.4 });
  add(T.c1, 'lift_hum', -10, -0.1, { dur: T.c2 - T.c1 + 0.15 });
  add(T.c1 + 0.05, 'heartbeat', -10, 0, { dur: T.c2 - T.c1, bpm: 96 });
  add(T.twitch - 0.05, 'zombie_growl', -8, -0.1, { dur: 1.1, f0: 62 });
  add(T.c2, 'stairwell_air', -16, 0, { dur: T.black - T.c2 });
  add(T.c2 + 0.1, 'heartbeat', -11, 0, { dur: T.black - T.c2 - 0.1, bpm: 110 });
  add(T.cross, 'cloth_soft', -14, -0.4);
  add(T.peer + 0.35, 'whine', -18, 0.3, { dur: 0.8 });
  add(T.black - 0.05, 'zombie_scare', -2, 0, { dur: 1.3, f0: 58, far: 0.45 });
  return c.sort((a, b) => a.t - b.t);
}
