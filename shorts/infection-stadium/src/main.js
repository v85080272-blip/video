// «К стадиону» («Заражение», серия 5, снова в 2D): the whole short as pure functions of time t (seconds), so any frame or
// motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py; before the voice exists, a rough timing from the word counts of voice/script.json).
// 6:40 at dawn: the five of them (the hunter, Пурга, баба Валя, Красотка, Соломия) at the door of the lower block, two
// blocks from the stadium, and the street is full of them. The evacuation is at seven; nobody may fall behind. Three rules:
// agree where to meet if you are separated (a map, the pharmacy as the meeting point); go in pairs, each looks after their
// own; documents with you, in a plastic bag. At the stadium gate the soldiers check for bites — and then: no dogs. The fact:
// after Hurricane Katrina thousands of pets were left behind, the buses would not take them; a year later the US passed a
// law to save them too. The choice: hide her in the rucksack, or look for another way in.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { drawZombie } from './zombie.js';
import { drawGranny } from './landing.js';
import { drawKrasotka, drawSolomia, drawSoldier } from './people.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
export const DUR = VOICE?.dur ?? FB.L10[1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1440; Hd.SUB.size = 80; Hd.SUB.lead = 94;           // under the floor line (y ≈ 1160), clear of the feet
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { СТАДИОНА: GOLD, ОНИ: DANGER, СЕМЬ: GOLD, ОТСТАТЬ: DANGER, ВСТРЕТИТЬСЯ: GOLD, ПАРАМИ: GOLD, СВОЕГО: GOLD, ДОКУМЕНТЫ: GOLD,
  УКУСЫ: DANGER, СОБАК: DANGER, ПУСКАЕМ: DANGER, КАТРИНА: WARM, БРОСИЛИ: DANGER, ЗАКОН: OK, ЖИВОТНЫХ: OK, РЮКЗАК: GOLD, ВХОД: GOLD,
  СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the beats ——
const T = {
  cover: 0.3,
  street: A.L0w6 - 0.05,             // «А на улице — они»: the camera goes round the corner to them
  five: A.L1 - 0.05,                 // «Эвакуация в семь. Нас пятеро»: back to all five along the wall
  c2: A.L2 - 0.06,                   // step 1: the map, the meeting point
  pin: A.L2w2 - 0.05,
  c3: A.L3 - 0.06,                   // step 2: in pairs down the street
  pairs: A.L3w3 - 0.08,
  c4: A.L4 - 0.06,                   // step 3: the documents in a bag
  docs: A.L4w1 - 0.05,
  c5: A.L5 - 0.06,                   // the stadium gate: the bite check
  check: A.L5w3 - 0.08,
  nodogs: A.L6w3 - 0.06,             // «собак не пускаем»
  c7: A.L7 - 0.06,                   // the fact card
  law: A.L8w4 - 0.05,
  c9: A.L9 - 0.06,                   // the choice
  c10: A.L10 - 0.06,
};
export const CUTS = [T.cover, T.c2, T.c3, T.c5, T.c9];
export const SNAPS = [T.c4];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7, PS = 0.6, FLOORY = 1160;
const scene = t => (t < T.cover ? 'cover' : t < T.c2 ? 'door' : t < T.c3 ? 'map' : t < T.c5 ? 'walk' : t < T.c7 ? 'gate' : t < T.c9 ? 'fact' : 'choice');

// —— the world: one street, side on; the block's corner at x = -150, the stadium gate at x ≈ 6000–6900 ——
const GATE = { x0: 6440, x1: 6680, sx: 6640 };         // the gap in the fence, where the soldier stands
const ZOMS = [[520, 0.55, 0.3], [1080, 0.6, -0.2], [1540, 0.5, 0.15], [1900, 0.58, -0.35]];      // x, size, drift (px/s)
const walkLead = t => 260 + 170 * Math.max(0, t - T.c3);     // the front of the group in the walk scene

// —— the camera ——
function hermite(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (keys[i + 1][0] < t) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h;
  const tan = j => {
    if (j === 0 || j === n - 1) return keys[j].slice(1).map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return a.slice(1).map((v, c) => (b[c + 1] - v) / (b[0] - a[0]));
  };
  const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
  return k0.slice(1).map((p0, c) => (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0[c] + (-2 * u3 + 3 * u2) * k1[c + 1] + (u3 - u2) * h * m1[c]);
}
const KEYS = {
  door: [[T.cover, -230, -330, 1.32], [T.street - 0.1, -200, -330, 1.3], [T.street + 0.6, 900, -320, 1.0], [T.five - 0.2, 980, -320, 0.98],
    [T.five + 0.5, -430, -300, 0.84], [T.c2, -420, -300, 0.86]],
  gate: [[T.c5, 6250, -330, 0.92], [T.check, 6330, -330, 1.0], [T.nodogs - 0.1, 6340, -330, 1.02], [T.nodogs + 0.4, 6400, -330, 1.1], [T.c7, 6400, -330, 1.1]],
  choice: [[T.c9, 6280, -330, 1.06], [T.c10, 6300, -330, 1.0], [DUR, 6300, -330, 0.98]],
};
export function camAt(t) {
  const sc = scene(t);
  let x, y, z;
  if (sc === 'walk') { const L = walkLead(t), close = seg(T.c4 - 0.05, T.c4 + 0.35, t); x = lerp(L - 260, L - 380, close); y = lerp(-330, -300, close); z = lerp(0.82, 1.2, close); }
  else if (sc === 'fact') [x, y, z] = KEYS.gate[KEYS.gate.length - 1].slice(1);
  else if (sc === 'map' || sc === 'cover') [x, y, z] = [0, -700, 1];
  else [x, y, z] = hermite(KEYS[sc], t);
  if (sc !== 'map' && sc !== 'cover') y = -(FLOORY - 960) / z + (y + 330) * 0.15;     // keys only nudge it
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.street + 0.5, 6], [T.nodogs, 8]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0,
  jacket: true, boots: true, pack: true, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
function walking(o, x, ph) { const fa = x + 30 * Math.sin(ph), fb = x - 30 * Math.sin(ph); o.hip = [x, -LEG + 7 * Math.abs(Math.sin(ph))]; o.feet = { near: [fa, -14 * Math.max(0, Math.cos(ph))], far: [fb, -14 * Math.max(0, -Math.cos(ph))] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
function zombieAt(x, s, t, i) {
  const ph = t * 1.6 + i * 1.3, fa = x + 26 * Math.sin(ph), fb = x - 26 * Math.sin(ph);
  return { hip: [x, -145 * s - 6 * Math.abs(Math.sin(ph))], feet: { near: [fa, -10 * Math.max(0, Math.cos(ph))], far: [fb, -10 * Math.max(0, -Math.cos(ph))] },
    s, face: i % 2 ? 1 : -1, lean: 0.22, jaw: 0.3 + 0.3 * Math.sin(t * 3 + i), headTilt: 0.1 * Math.sin(t + i), look: [0, 0] };
}

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'cover' || sc === 'map') return {};
  if (sc === 'door') {
    // the five pressed to the wall of the block, the hunter at the corner looking round it; them in the street
    const peek = t < T.five ? 1 : 0;
    const o = stand(base(t, { face: 1, look: [0.9, -0.1], brow: 0.7, lean: peek ? 0.18 : 0.04, pop: t > T.street + 0.3 && t < T.five ? 0.6 * bump(seg(T.street + 0.3, T.street + 1.2, t)) : 0 }), -240);
    const people = [
      { k: 'sol', o: { x: -820, y: 0, s: PS, face: 1, t, look: 0.6, smile: 0.2, seed: 1.1 } },
      { k: 'kra', o: { x: -690, y: 0, s: PS, face: 1, t, look: 0.6, smile: 0.3, seed: 2.3 } },
    ];
    const gr = { x: -560, y: 0, s: 0.6, face: 1, t, smile: 0.3, look: 1, reach: [70, -220] };
    const d = { x: -380, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: peek ? 0.6 : 0.2, mouth: 0.2, tongue: 0, look: 0.2 };
    const zs = ZOMS.map(([x, s, v], i) => zombieAt(x + v * 60 * (t - T.cover) * 0.4, s, t, i));
    return { h: o, gr, d, people, zs };
  }
  if (sc === 'walk') {
    // two pairs and the dog: the hunter and Красотка in front, баба Валя and Соломия behind, Пурга by the hunter
    const L = walkLead(t), ph = (L / 62);
    const o = walking(base(t, { face: 1, look: [0.8, 0], brow: 0.4, lean: 0.1 }), L, ph * 1.0);
    const people = [
      { k: 'kra', o: { x: L - 170, y: 0, s: PS, face: 1, t, walk: 1, ph: ph / TAU * 1.0 + 0.25, look: 0.5, smile: 0.3, seed: 2.3 } },
      { k: 'sol', o: { x: L - 560, y: 0, s: PS, face: 1, t, walk: 1, ph: ph / TAU + 0.6, look: 0.5, smile: 0.2, seed: 1.1 } },
    ];
    const show = seg(T.docs, T.docs + 0.4, t);
    const gr = { x: L - 420, y: -8 * Math.abs(Math.sin(ph * 1.1)), s: 0.6, face: 1, t, smile: show > 0 ? 0.9 : 0.4, look: 1, reach: [lerp(70, 120, show), lerp(-220, -470, show)], docs: show };
    const d = { x: L + 150, y: 0, s: DS, face: 1, walk: 1, ph: L / 120, t, blink: dblink(t), mouth: 0.5, tongue: 0.5 };
    const zs = ZOMS.map(([x, s, v], i) => zombieAt(L + 380 + i * 260 - 60 * (t - T.c3), s * 0.62, t, i));
    return { h: o, gr, d, people, zs, far: true };
  }
  // the gate, the fact card over it, the choice
  const o = stand(base(t, { face: 1, look: sc === 'choice' ? [0.6, 0.9] : [0.9, 0], brow: t > T.nodogs ? 0.9 : 0.4, headTilt: sc === 'choice' ? -0.12 : 0.04 }), 6150);
  if (sc === 'choice') { const sh = shoulder(o); o.hands = { near: { p: [sh[0] + 60, sh[1] + 150], shape: 'grip' } }; }
  const checking = t > T.check && t < T.nodogs;
  const people = [
    { k: 'kra', o: { x: 6300, y: 0, s: PS, face: 1, t, look: 0.8, smile: 0.2, seed: 2.3, arm: checking ? [150, -420] : null, torch: false } },
    { k: 'sol', o: { x: 5890, y: 0, s: PS, face: 1, t, look: 0.7, smile: 0.2, seed: 1.1 } },
    { k: 'sold', o: { x: GATE.sx, y: 0, s: 0.64, face: -1, t, look: t > T.nodogs ? -0.8 : 0.4, seed: 0.5, torch: true, torchAng: checking ? -0.25 : 0.1,
      arm: t > T.nodogs ? [150, -560] : checking ? [120, -330] : null } },
  ];
  const gr = { x: 6010, y: 0, s: 0.6, face: 1, t, smile: t > T.nodogs ? 0.0 : 0.4, look: 1, reach: [70, -220] };
  const beg = sc === 'choice' ? seg(T.c9 + 0.2, T.c9 + 0.7, t) : 0;
  const d = { x: 6250, y: 0, s: DS, face: 1, sit: 1, beg, t, blink: dblink(t), ears: t > T.nodogs ? 1 : 0.2, mouth: t > T.nodogs ? 0 : 0.3, tongue: t > T.nodogs ? 0 : 0.3,
    look: sc === 'choice' ? 0.6 : 0.2, tilt: sc === 'choice' ? 0.25 * Math.sin((t - T.c9) * 1.4) : 0 };
  return { h: o, gr, d, people, beam: checking };
}

// —— the sets ——
function sky(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#5d6f92'); gr.addColorStop(0.5, '#c79f86'); gr.addColorStop(1, '#f0c08a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function city(t, cam) {
  view(cam, 0.25);
  for (let i = 0; i < 40; i++) {
    const bx = -2600 + i * 360 + 80 * hash(i), bw = 220 + 120 * hash(i + 9), bh = 600 + 800 * hash(i + 3), by = 600;
    rect(bx, by - bh, bw, bh + 1400, '#7b8394');
    for (let r = 0; r < bh / 70 - 1; r++) for (let c = 0; c < bw / 60 - 1; c++) if (hash(i * 131 + r * 17 + c * 7) > 0.97) rect(bx + 22 + c * 60, by - bh + 30 + r * 70, 26, 34, '#e8d9b0');
  }
  // the stadium far off: a low curved bowl and four floodlight masts, lit
  const sx = 1700;
  fill(smoothPath([[sx - 520, 600], [sx - 470, 380], [sx - 200, 320], [sx + 200, 320], [sx + 470, 380], [sx + 520, 600]]), '#6a7080');
  for (const mx of [sx - 430, sx - 150, sx + 150, sx + 430]) {
    rect(mx - 8, 0, 16, 600, '#5a6070'); rect(mx - 60, -40, 120, 46, '#3d4250');
    const gl = g.createRadialGradient(mx, -18, 0, mx, -18, 220); gl.addColorStop(0, 'rgba(255,250,225,0.95)'); gl.addColorStop(0.2, 'rgba(255,245,210,0.35)'); gl.addColorStop(1, 'rgba(255,245,210,0)');
    g.fillStyle = gl; g.fillRect(mx - 220, -240, 440, 440);
  }
  for (const [fx, k] of [[-1200, 1], [600, 0.6], [3400, 0.8]]) {
    for (let j = 0; j < 8; j++) { const u = ((t * 0.08 + j / 8) % 1), r = 90 + 240 * u; ell(fx + 120 * u + 30 * Math.sin(j * 2 + t * 0.5), 560 - 1600 * u, r, r * 0.8, '#5c5f68', 0, 0.5 * (1 - u) * k); }
  }
}
function street(t, cam) {
  view(cam, 1);
  const half = W / 2 / cam.z + 400, x0 = cam.x - half, x1 = cam.x + half;
  rect(x0, 0, x1 - x0, 900, '#4a4d55'); rect(x0, 0, x1 - x0, 18, '#8a8c92');                        // the pavement and its kerb
  for (let x = Math.floor(x0 / 300) * 300; x < x1; x += 300) rect(x, 20, 4, 900, '#43464e');
  // the block's corner: the wall, the entrance door, a lamp over it
  if (x0 < -100) {
    rect(-2400, -1600, 2250, 1600, '#9c9483'); rect(-2400, -1600, 2250, 1600, 'rgba(0,0,0,0.06)');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) rect(-2300 + c * 360, -1500 + r * 380, 160, 220, '#4a4f60');
    rect(-1100, -420, 300, 420, '#5a3f2e'); rect(-1080, -400, 260, 400, '#6e4c36'); ell(-950, -470, 30, 12, '#fff2c4');
    rect(-170, -1600, 30, 1600, '#857d6c');
  }
  // a burnt car and litter along the street (the walk scene goes past them)
  for (const cx of [700, 2300, 3600, 4700]) {
    if (cx < x0 - 600 || cx > x1 + 600) continue;
    rrect(cx - 260, -150, 520, 110, 30, '#3d3a3a'); rrect(cx - 170, -240, 320, 110, 30, '#2f2c2c'); rect(cx - 140, -224, 120, 70, '#1b1c22'); rect(cx + 10, -224, 110, 70, '#1b1c22');
    ell(cx - 160, -40, 52, 52, '#1a1a1e'); ell(cx + 160, -40, 52, 52, '#1a1a1e'); ell(cx - 160, -40, 22, 22, '#55565c'); ell(cx + 160, -40, 22, 22, '#55565c');
  }
  // the pharmacy with its green cross (the meeting point on the map)
  if (x1 > 2900 && x0 < 3300) { rect(2900, -900, 420, 900, '#b9b2a2'); rect(2950, -420, 320, 420, '#3a4a5a'); rect(3060, -760, 100, 100, '#2f9d5a'); rect(3095, -740, 30, 60, '#ffffff'); rect(3080, -725, 60, 30, '#ffffff'); }
}
function gateSet(t, cam) {
  view(cam, 0.7);
  // the stadium itself behind the fence: a big curved wall, banners, the floodlights
  fill(smoothPath([[4600, 0], [4700, -1100], [6000, -1350], [7400, -1100], [7600, 0]]), '#8d93a0');
  for (let i = 0; i < 8; i++) rect(4900 + i * 300, -1000 + 40 * Math.sin(i), 120, 260, i % 2 ? '#c94a3b' : '#3b6fc9');
  for (const mx of [5000, 7100]) { rect(mx - 14, -2300, 28, 2300, '#5a6070'); rect(mx - 120, -2400, 240, 100, '#3d4250');
    const gl = g.createRadialGradient(mx, -2350, 0, mx, -2350, 500); gl.addColorStop(0, 'rgba(255,250,225,0.9)'); gl.addColorStop(1, 'rgba(255,245,210,0)'); g.fillStyle = gl; g.fillRect(mx - 500, -2850, 1000, 1000); }
  view(cam, 1);
  const half = W / 2 / cam.z + 400, x0 = cam.x - half, x1 = cam.x + half;
  rect(x0, 0, x1 - x0, 900, '#55585f'); rect(x0, 0, x1 - x0, 18, '#8a8c92');
  // the fence: posts and mesh, the gap of the gate, a sign on the mesh
  for (let x = 5600; x < 7400; x += 160) if (x < GATE.x0 || x > GATE.x1) { rect(x - 7, -620, 14, 620, '#5a5f68'); }
  for (const [a, b] of [[5600, GATE.x0], [GATE.x1, 7400]]) {
    g.save(); g.globalAlpha = 0.55; for (let x = a; x < b; x += 28) { limb([[x, -600], [x + 120, 0]], 2, '#9aa0aa', false); limb([[x + 120, -600], [x, 0]], 2, '#9aa0aa', false); } g.restore();
    rect(a, -620, b - a, 10, '#6a6f78');
  }
  // the evacuation sign over the gate, the tent with the red cross beside it
  rrect(GATE.x0 - 40, -880, GATE.x1 - GATE.x0 + 80, 110, 12, '#1f5fbf'); Hd.label('ЭВАКУАЦИЯ', (GATE.x0 + GATE.x1) / 2, -805, 60, '#ffffff', { shadow: false, stroke: false });
  poly([[6750, 0], [6800, -380], [7150, -380], [7200, 0]], '#d9d4c4'); rect(6930, -330, 90, 90, '#ffffff'); rect(6962, -320, 26, 70, '#d9433b'); rect(6940, -298, 70, 26, '#d9433b');
}
// the sign «без животных» on the fence: a paw in a red circle, struck through; it is hung on «собак не пускаем»
function noDogsSign(t) {
  const k = clamp(sp(t, T.nodogs + 0.1, 2.6, 8));
  if (k <= 0.01) return;
  g.save(); g.translate(6820, -380); g.scale(k, k); g.rotate(0.05);
  rrect(-120, -120, 240, 240, 20, '#ffffff'); g.lineWidth = 22; g.strokeStyle = '#d9433b'; g.beginPath(); g.arc(0, 0, 90, 0, TAU); g.stroke();
  ell(0, 22, 34, 28, '#2c2c34'); for (const [dx, dy] of [[-40, -22], [-14, -46], [14, -46], [40, -22]]) ell(dx, dy, 13, 16, '#2c2c34');
  limb([[-64, -64], [64, 64]], 20, '#d9433b', false);
  g.restore();
}
function drawPerson(p) {
  if (p.k === 'kra') drawKrasotka(p.o); else if (p.k === 'sol') drawSolomia(p.o); else if (p.k === 'sold') drawSoldier(p.o);
}
function docsBag(gr) {
  if (!gr.docs) return;
  const x = gr.x + gr.face * gr.reach[0] * gr.s, y = gr.y + gr.reach[1] * gr.s;
  g.save(); g.translate(x, y - 40); g.rotate(-0.12); g.globalAlpha = Math.min(1, gr.docs * 2);
  rrect(-62, -80, 124, 150, 12, 'rgba(220,235,255,0.55)'); rect(-62, -80, 124, 10, '#3b6fc9');
  rrect(-40, -54, 80, 108, 8, '#8a1f24'); ell(0, -10, 18, 18, '#d9b45a'); rect(-26, 26, 52, 6, '#d9b45a');
  g.restore();
}
// the torch beam from the soldier's hand to Красотка's raised arm (the bite check)
function checkBeam(t) {
  const p0 = [GATE.sx - 0.64 * 120 - 30, -0.64 * 330 - 8], p1 = [6300 + 0.6 * 150, -0.6 * 420];
  const gl = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); gl.addColorStop(0, 'rgba(255,244,205,0.75)'); gl.addColorStop(1, 'rgba(255,244,205,0.15)');
  g.fillStyle = gl; g.fill(polyPath([[p0[0], p0[1] - 8], [p0[0], p0[1] + 8], [p1[0], p1[1] + 60], [p1[0], p1[1] - 60]]));
  const k = 0.5 + 0.2 * Math.sin(t * 9); ell(p1[0], p1[1], 60, 52, `rgba(255,248,220,${k})`);
}

// —— frame ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
function world(t, cam, a) {
  const sc = scene(t);
  sky(t); city(t, cam);
  if (sc === 'door' || sc === 'walk') street(t, cam); else gateSet(t, cam);
  view(cam, 1);
  if (a.zs) { if (a.far) { g.save(); g.globalAlpha = 0.8; } for (const z of a.zs) drawZombie(a.far ? { ...z, hip: [z.hip[0], z.hip[1] - 160], feet: { near: [z.feet.near[0], z.feet.near[1] - 160], far: [z.feet.far[0], z.feet.far[1] - 160] } } : z); if (a.far) g.restore(); }
  if (sc === 'gate' || sc === 'fact' || sc === 'choice') noDogsSign(t);
  for (const p of a.people ?? []) if (p.k === 'sol') drawPerson(p);
  if (a.gr) { drawGranny(a.gr); docsBag(a.gr); }
  for (const p of a.people ?? []) if (p.k === 'kra') drawPerson(p);
  if (a.d) drawDog(a.d);
  if (a.h) drawHunter(a.h);
  for (const p of a.people ?? []) if (p.k === 'sold') drawPerson(p);
  if (a.beam) checkBeam(t);
}
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  if (sc === 'map') { mapFrame(t); overlays(t, camAt(t), {}); Hd.karaoke(t, SUBS, HOT); Hd.finish(t, 0.6); return; }
  const cam = camAt(t), a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  world(t, cam, a);
  // a cold dawn shade, lighter round the people
  g.setTransform(1, 0, 0, 1, 0, 0);
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = 'rgba(14,20,40,0.22)'; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
  const hole = (p, r, k) => { const [x, y] = toScreen(cam, p), rr = r * scaleOf(cam); const gr = dk.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, rr, 0, TAU); dk.fill(); };
  if (a.h) hole([a.h.hip[0] - 150, a.h.hip[1] - 120], 700, 0.7);
  g.drawImage(DK, 0, 0);
  if (sc === 'fact') factCard(t);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.7);
}

// —— step 1: the map from above: our block, the stadium, the route; the pin drops on the pharmacy ——
function mapFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const k = seg(T.c2, T.c2 + 0.5, t), z = lerp(1.08, 1, k);
  g.fillStyle = '#2b3140'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 900); g.scale(z, z); g.rotate(-0.02);
  rrect(-470, -760, 940, 1500, 16, Hd.NIGHT.paper);
  for (let i = -3; i <= 3; i++) { rect(-470, i * 220 - 18, 940, 36, '#d8d2c2'); rect(i * 150 - 18, -760, 36, 1500, '#d8d2c2'); }
  for (let i = 0; i < 18; i++) { const bx = -440 + (i % 6) * 150, by = -720 + Math.floor(i / 6) * 440 + 40; rrect(bx + 14, by + 14, 96, 140, 6, '#c9c2b0'); }
  // the stadium at the top, our block at the bottom, the route between them; dashes drawn as the line is read
  ell(150, -560, 200, 130, '#8fb39a'); ell(150, -560, 150, 90, '#a9cdb2'); Hd.label('СТАДИОН', 150, -548, 40, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
  rrect(-330, 500, 160, 160, 8, '#c94a3b'); Hd.label('МЫ', -250, 600, 40, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  const route = [[-250, 480], [-250, 220], [0, 220], [0, -220], [150, -220], [150, -420]];
  const u = seg(T.c2 + 0.2, T.c3 - 0.3, t, x => x);
  let left = u * 1360; const pts = [route[0]];
  for (let i = 1; i < route.length && left > 0; i++) { const [a, b] = [route[i - 1], route[i]], d = Math.hypot(b[0] - a[0], b[1] - a[1]), f = Math.min(1, left / d); pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]); left -= d; }
  g.save(); g.setLineDash([26, 18]); g.lineWidth = 14; g.strokeStyle = '#3b6fc9'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore();
  // the pharmacy: a green cross on the corner of the route, the pin falls on it
  rrect(-30, -40, 120, 120, 10, '#2f9d5a'); rect(18, -24, 24, 88, '#ffffff'); rect(-14, 8, 88, 24, '#ffffff');
  const pk = clamp(sp(t, T.pin, 2.6, 7)), py = lerp(-700, 0, Math.min(1, pk));
  if (t > T.pin) { g.save(); g.translate(30, -60 + py); fill(smoothPath([[0, 0], [-44, -70], [-40, -120], [0, -150], [40, -120], [44, -70]]), DANGER); ell(0, -105, 18, 18, '#ffffff'); g.restore();
    if (pk > 0.6) { g.save(); g.globalAlpha = clamp((pk - 0.6) * 3); g.lineWidth = 6; g.strokeStyle = DANGER; g.beginPath(); g.arc(30, 20, 90 + 30 * ((t - T.pin) % 1), 0, TAU); g.stroke(); g.restore(); } }
  g.restore();
}

// —— the fact: Katrina, the pets left behind, the law a year later ——
function factCard(t) {
  const k = clamp(sp(t, T.c7 + 0.05, 2.4, 8)) * (1 - seg(T.c9 - 0.3, T.c9 - 0.02, t));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = clamp(k * 2) * 0.6; g.fillStyle = '#05070e'; g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.globalAlpha = clamp(k * 2); g.translate(540, 700); g.rotate(-0.025); g.scale(lerp(0.94, 1, clamp(k)), lerp(0.94, 1, clamp(k)));
  const w = 920, hh = 600;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rrect(-w / 2, -hh / 2, w, hh, 16, Hd.NIGHT.paper); g.restore();
  for (let i = 0; i < 6; i++) limb([[-w / 2 + 30, -hh / 2 + 150 + i * 70], [w / 2 - 30, -hh / 2 + 150 + i * 70]], 2, 'rgba(90,110,150,0.25)', false);
  Hd.label('ФАКТ', -w / 2 + 60, -hh / 2 + 62, 34, '#5a6a86', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  g.save(); g.translate(-w / 2 + 110, -hh / 2 + 160); Hd.icon('cloud', 40, '#5a6a86'); g.restore();
  Hd.label('2005 · УРАГАН «КАТРИНА»', -w / 2 + 170, -hh / 2 + 174, 44, '#1d2433', { align: 'left', shadow: false, stroke: false });
  const rows = [[A.L7w3, 'ТЫСЯЧИ ПИТОМЦЕВ БРОСИЛИ', DANGER], [A.L7w8, 'В АВТОБУСЫ — БЕЗ ЖИВОТНЫХ', '#1d2433']];
  rows.forEach(([t0, s, c], i) => {
    const v = clamp((t - t0 + 0.05) / 0.2); if (v <= 0) return;
    g.save(); g.globalAlpha *= v; Hd.label('—  ' + s, -w / 2 + 60, -hh / 2 + 290 + i * 90, 38, c, { align: 'left', shadow: false, stroke: false }); g.restore();
  });
  g.restore();
  const ks = sp(t, T.law, 2.2, 8) * (1 - seg(T.c9 - 0.3, T.c9 - 0.02, t));
  if (ks > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(560, 1080); g.rotate(-0.06); const z = lerp(1.7, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
    const s = '2006 · ЗАКОН: СПАСАТЬ И ИХ', sw = measure(s, 56) + 60; rrect(-sw / 2 + 8, -48 + 8, sw, 96, 14, INK); rrect(-sw / 2, -48, sw, 96, 14, '#2f8f4e'); text(s, 0, 20, 56, '#fff3d6', { shadow: false }); g.restore(); }
}

// —— everything over the picture ——
function fiveBadge(t) {
  if (t < T.cover + 0.2 || t > T.c9) return;
  const k = clamp(sp(t, T.five, 2.6, 8)) * (1 - seg(T.c9 - 0.2, T.c9, t));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 1020, y = 150, w = 260, h = 110, danger = t > T.nodogs && t < T.c7;
  rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)');
  g.save(); g.lineWidth = 3; g.strokeStyle = danger ? DANGER : OK; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17)); g.restore();
  Hd.label('ВМЕСТЕ', x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(danger ? '4 / 5' : '5 / 5', x - w / 2, y + 38, 58, danger ? DANGER : '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, '06:40 — ПОДЪЕЗД');
  Hd.timeStamp(t, T.c3 + 0.15, T.c5 - 0.1, '06:48 — УЛИЦА');
  Hd.timeStamp(t, T.c5 + 0.15, DUR, '06:58 — СТАДИОН');
  fiveBadge(t);
  if (scene(t) === 'door' && t >= T.street + 0.2 && t < T.five) Hd.plaque(t, T.street + 0.4, T.five - 0.05, 540, 420, { icon: 'x', title: 'ИДУТ НА ШУМ', sub: 'ни звука', color: DANGER });
  if (scene(t) === 'door' && t >= T.five) Hd.plaque(t, A.L1w1, T.c2 - 0.05, 540, 420, { icon: 'clock', title: 'ЭВАКУАЦИЯ В 7:00', sub: 'со стадиона', color: GOLD });
  // step 1
  Hd.stepHeader(t, 1, 'МЕСТО ВСТРЕЧИ', A.L2 + 0.02, A.L2e - 0.05, 260);
  if (scene(t) === 'map') Hd.plaque(t, T.pin + 0.5, T.c3 - 0.02, 540, 1650, { icon: 'check', title: 'ПОТЕРЯЛИСЬ — К АПТЕКЕ', sub: 'одно место для всех', color: OK });
  // step 2
  Hd.stepHeader(t, 2, 'ДЕРЖИТЕСЬ ПАРАМИ', A.L3 + 0.02, A.L3e - 0.05);
  if (scene(t) === 'walk' && t < T.c4 && t > T.pairs) pairLinks(t, cam, a);
  // step 3
  Hd.stepHeader(t, 3, 'ДОКУМЕНТЫ С СОБОЙ', A.L4 + 0.02, A.L4e - 0.05);
  if (scene(t) === 'walk' && t >= T.c4) Hd.plaque(t, T.docs + 0.4, T.c5 - 0.02, 540, 470, { icon: 'check', title: 'В ПАКЕТЕ', sub: 'паспорт не промокнет', color: OK, size: 42 });
  // the gate
  if (scene(t) === 'gate' && t < T.nodogs) Hd.plaque(t, T.check + 0.1, T.nodogs - 0.02, 540, 330, { icon: 'torch', title: 'ПРОВЕРКА НА УКУСЫ', sub: 'руки, шея, ноги', color: WARM });
  if (scene(t) === 'gate' && t >= T.nodogs) Hd.plaque(t, T.nodogs + 0.15, T.c7 - 0.02, 540, 330, { icon: 'x', title: 'СОБАК НЕ ПУСКАЕМ', sub: 'приказ', color: DANGER, size: 50 });
  // the choice
  if (t >= T.c9) {
    [['1', 'ПРЯЧЕМ В РЮКЗАК', A.L9w2], ['2', 'ИЩЕМ ДРУГОЙ ВХОД', A.L9w6]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c10, T.c10 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 520 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c10) Hd.plaque(t, A.L10w1 - 0.1, DUR + 1, 540, 730, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 6 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L10w12 - 0.1, 0, 300);
}
// the pairs: a dashed bracket under each pair, «ПАРА 1», «ПАРА 2», and a heart between the hunter and Пурга
function pairLinks(t, cam, a) {
  const k = seg(T.pairs, T.pairs + 0.35, t, ease.out);
  const L = walkLead(t), y = 30;
  const br = (xa, xb, lbl, c, d) => {
    const p = toScreen(cam, [xa, y]), q = toScreen(cam, [xb, y]), u = clamp((k - d) * 1.6);
    if (u <= 0) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = u;
    Hd.dashed([p[0], p[1] + 20], [q[0], q[1] + 20], c, 6, u);
    limb([[p[0], p[1]], [p[0], p[1] + 20]], 6, c, false); limb([[q[0], q[1]], [q[0], q[1] + 20]], 6, c, false);
    Hd.label(lbl, (p[0] + q[0]) / 2, p[1] + 80, 36, c, { fam: FONTS.mono, shadow: false, stroke: false });
    g.restore();
  };
  br(L - 230, L + 30, 'ПАРА 1', GOLD, 0); br(L - 620, L - 380, 'ПАРА 2', OK, 0.25);
}

// —— the poster: the five on the street at dawn, the stadium lights far off, the title ——
function coverFrame(t) {
  const cam = { x: 600, y: -300, z: 0.95, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  sky(0); city(0, cam); street(0, cam); view(cam, 1);
  drawSolomia({ x: 300, y: 0, s: PS, face: 1, t: 0, walk: 1, ph: 0.6, look: 0.6, smile: 0.2 });
  drawGranny({ x: 430, y: 0, s: 0.6, face: 1, t: 0, smile: 0.5, look: 1, reach: [70, -220] });
  drawKrasotka({ x: 600, y: 0, s: PS, face: 1, t: 0, walk: 1, ph: 0.25, look: 0.5, smile: 0.4 });
  drawDog({ x: 920, y: 0, s: DS, face: 1, walk: 1, ph: 0.3, t: 0, mouth: 0.5, tongue: 0.5 });
  drawHunter(walking(base(0, { face: 1, look: [0.8, 0], brow: 0.5, lean: 0.1, blink: 0 }), 770, 0.8));
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(10,14,28,0.22)'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.save(); g.translate(540, 560);
  g.save(); g.shadowColor = 'rgba(255,190,90,0.8)'; g.shadowBlur = 40; Hd.label('К СТАДИОНУ', 0, 0, 140, '#ffd27a', { shadow: false, strokeW: 12 }); g.restore();
  const pl = 'ЗАРАЖЕНИЕ · СЕРИЯ 5', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw / 2 + 8, 50 + 8, pw, 84, INK); rect(-pw / 2, 50, pw, 84, '#ffd43b'); text(pl, 0, 108, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover || scene(t) === 'map') return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  if (scene(t0) !== scene(t1)) return 0;
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S]].map(p => toScreen(cam, p)));
    if (d) out.push(toScreen(cam, [d.x, d.y - 150 * DS]));
    out.push(toScreen(cam, [cam.x, cam.y - 400]), toScreen(cam, [cam.x + 300, cam.y + 400]));
    return out;
  };
  const a = pts(t0), b = pts(t1), on = ([x, y]) => x > -200 && x < W + 200 && y > -200 && y < H + 200;
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (on(a[i]) || on(b[i])) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return Math.min(m * (0.5 / (2 * h * 60)), 40);
}

// sound cues for the mix (seconds, name, level dB, pan −1…1); the mixer holds each under the narrator
export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(T.cover, 'zombie_crowd', -18, 0.3, { dur: T.c2 - T.cover });
  add(T.cover + 0.2, 'breath', -16, 0, { dur: T.street - T.cover });
  add(T.street + 0.3, 'zombie_growl', -8, 0.4, { dur: 1.2, f0: 70 }); add(T.street + 1.3, 'zombie_far', -14, 0.6);
  add(T.five + 0.1, 'heartbeat', -16, 0, { dur: T.c2 - T.five, bpm: 96 });
  add(T.c2, 'paper', -10, 0); add(T.pin, 'whoosh_down', -10, 0); add(T.pin + 0.32, 'stamp', -10, 0);
  add(T.c3, 'steps_out', -8, 0, { dur: T.c5 - T.c3 - 0.1 });
  add(T.c3, 'zombie_crowd', -24, 0.5, { dur: T.c5 - T.c3 });
  add(T.pairs + 0.05, 'pop_word', -10, -0.2); add(T.pairs + 0.3, 'pop_word', -10, 0.2);
  add(T.docs, 'zipper', -10, -0.1); add(T.docs + 0.4, 'paper', -12, -0.1);
  add(T.c5, 'crowd_murmur', -18, 0, { dur: T.c9 - T.c5 });
  add(T.c5 + 0.3, 'heli_far', -16, -0.5, { dur: 2.3 });
  add(T.check, 'click', -8, 0.3);
  add(T.nodogs, 'whine', -8, -0.1); add(T.nodogs + 0.1, 'stamp', -8, 0.3);
  add(T.nodogs + 0.2, 'heartbeat', -12, 0, { dur: T.c7 - T.nodogs, bpm: 110 });
  add(T.c7 + 0.05, 'paper', -10, 0);
  for (const t0 of [A.L7w3, A.L7w8]) add(t0 + 0.03, 'pop_word', -12, 0);
  add(T.law, 'stamp', -6, 0);
  add(T.c9 + 0.2, 'whine', -14, -0.1);
  for (let i = 0; i < 2; i++) add((i ? A.L9w6 : A.L9w2) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L10w1 - 0.1, 'blip', -8, 0);
  add(A.L10w13, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
