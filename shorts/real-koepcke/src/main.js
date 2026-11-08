// «Упала с неба» — «Реальные истории», 1: Джулиана Кёпке. The whole short as pure functions of time t, drawn straight in
// screen space; every beat anchored to the narrator's words (build/words.json; before the voice, a rough timing from
// voice/script.json). The hook is the first frame: a girl strapped in a row of seats, falling through the clouds, 3 km.
// Then: the storm and the lightning (24.12.1971, Peru); the fall into the canopy; she wakes alone; what she has (a broken
// collarbone, no glasses, one sandal); her father's lesson (find a stream, go downstream — water leads to people); ten
// days in the water with a bag of sweets; the wound; the boat, the hut, the fuel on the wound; the lumberjacks. The
// lesson, and the choice of the next story.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawGirl, drawSeatRow, drawPlane, drawFather, drawLumberjack, jungle, bigLeaf, boatHut } from './story.js';
import { text, measure, FONTS, INK } from './type.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
export const DUR = VOICE?.dur ?? FB.L11[1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { СЕМНАДЦАТЬ: GOLD, КИЛОМЕТРОВ: DANGER, ВЫЖИЛА: OK, МОЛНИЯ: DANGER, ОДНА: DANGER, ДЖУНГЛЯХ: GOLD, СЛОМАНА: DANGER, ОТЦА: GOLD,
  ТЕЧЕНИЮ: GOLD, ЛЮДЯМ: OK, КОНФЕТ: GOLD, ДЕСЯТЬ: GOLD, ЧЕРВИ: DANGER, БЕНЗИН: WARM, ЛЕСОРУБЫ: OK, ВОДЕ: GOLD, РЕК: OK,
  ПУСТЫНЕ: GOLD, ЗЕМЛЁЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

const T = {
  survived: A.L0w12 - 0.05,
  c1: A.L1 - 0.06, bolt: A.L1w9 - 0.12,
  c2: A.L2 - 0.06, wake: A.L2w5 - 0.1,
  c3: A.L3 - 0.06,
  c4: A.L4 - 0.06, map: A.L4w6 - 0.08, people: A.L4w13 - 0.05,
  c5: A.L5 - 0.06, candy: A.L5w2 - 0.05,
  c6: A.L6 - 0.06,
  c7: A.L7 - 0.06, fuel: A.L7w10 - 0.08,
  c8: A.L8 - 0.06,
  c9: A.L9 - 0.06,
  c10: A.L10 - 0.06, c11: A.L11 - 0.06,
};
export const CUTS = [T.c1, T.c2, T.c3, T.c4, T.map, T.c5, T.c6, T.c7, T.c8, T.c9, T.c10];
export const SNAPS = [T.wake];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c2 ? 'storm' : t < T.c3 ? 'fall' : t < T.c4 ? 'inv' : t < T.c5 ? 'father' : t < T.c6 ? 'walk'
  : t < T.c7 ? 'wound' : t < T.c8 ? 'boat' : t < T.c9 ? 'rescue' : t < T.c10 ? 'lesson' : 'next');
const FLOOR = 1180;

// —— skies and grounds ——
function grad(stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function cloud(x, y, r, c, a = 1) { for (const [dx, dy, k] of [[-0.6, 0.1, 0.6], [0, -0.2, 0.8], [0.6, 0.1, 0.65], [0.1, 0.25, 0.7]]) ell(x + dx * r, y + dy * r, k * r, k * r * 0.8, c, 0, a); }
function canopy(y, k = 1) {
  rect(0, y, W, H - y + 10, '#1f4a30');
  for (let i = 0; i < 26; i++) ell((i * 97) % (W + 200) - 100, y + 30 * Math.sin(i * 1.7), 110 * k, 70 * k, i % 3 ? '#2d6a40' : '#3f7d4c');
}
function rays(t, a = 0.18) {
  g.save(); g.globalAlpha = a;
  for (let i = 0; i < 5; i++) { const x = 160 + i * 210 + 30 * Math.sin(t * 0.3 + i); g.fillStyle = 'rgba(255,240,190,0.5)'; g.fill(polyPath([[x, 0], [x + 70, 0], [x - 80, FLOOR], [x - 230, FLOOR]])); }
  g.restore();
}
function water(t, y, h = 420) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(110,140,90,0.92)'); gr.addColorStop(1, 'rgba(60,90,60,0.95)');
  g.fillStyle = gr; g.fillRect(0, y, W, h);
  for (let i = 0; i < 14; i++) { const yy = y + 20 + i * 28, sh = (t * 60 + i * 140) % (W + 300) - 150; limb([[sh, yy], [sh + 120, yy]], 4, 'rgba(230,240,210,0.35)', false); }
}

// —— the scenes ——
function hook(t) {
  // falling: clouds race up past her, the green of the forest grows below; she spins slowly in the row of seats
  grad([[0, '#4f86c6'], [0.6, '#a9c9e6'], [1, '#d6e6ef']]);
  const fall = t * 900;
  for (let i = 0; i < 12; i++) { const y = ((i * 260 - fall) % 2400 + 2400) % 2400 - 300; cloud(120 + (i * 331) % 900, y, 140 + 80 * hash(i), '#ffffff', 0.85); }
  const near = clamp(t / (T.c1 + 0.5));
  canopy(lerp(1900, 1520, near), lerp(0.6, 1.1, near));
  const z = 1 + 0.06 * Math.sin(t * 2);
  drawSeatRow({ x: 540 + 30 * Math.sin(t * 1.3), y: 980, s: 0.95 * z, rot: 0.35 * Math.sin(t * 0.9) - 0.1, hairUp: 1, glasses: false, open: 0.7, t });
  // a few loose things falling with her
  for (let i = 0; i < 6; i++) { const a = t * 2 + i; ell(540 + 380 * Math.cos(a * 0.7 + i), 900 + 520 * Math.sin(a * 0.5 + i * 1.3), 12, 8, '#e8e2cf'); }
}
function storm(t) {
  const flash = t > T.bolt && t < T.bolt + 0.35 ? 1 - (t - T.bolt) / 0.35 : 0;
  grad([[0, '#141826'], [0.6, '#2a3044'], [1, '#3a3f52']]);
  for (let i = 0; i < 8; i++) cloud(((i * 290 + t * 40) % 1500) - 200, 520 + 220 * hash(i), 220 + 90 * hash(i + 3), '#20263a', 0.95);
  const br = seg(T.bolt + 0.05, T.bolt + 1.6, t, ease.out);
  drawPlane(lerp(-200, 700, seg(T.c1, T.c2, t, x => x)), 860 + 120 * br, 1.0, br, t);
  for (let i = 0; i < 9; i++) cloud(((i * 330 - t * 70) % 1500 + 1500) % 1500 - 200, 1050 + 300 * hash(i + 7), 260, '#181c2c', 0.9);
  g.save(); g.globalAlpha = 0.35; for (let i = 0; i < 90; i++) { const x = (i * 97 + t * 900) % (W + 200) - 100, y = (i * 211 + t * 2200) % H; limb([[x, y], [x - 30, y + 90]], 2, '#aab4c8', false); } g.restore();
  if (flash > 0) {
    const pts = [[620, 0]]; let x = 620; for (let y = 120; y < 860; y += 110) { x += 60 * (hash(y) - 0.5) * 2; pts.push([x, y]); }
    g.save(); g.shadowColor = '#cfe0ff'; g.shadowBlur = 40; limb(pts, 12, '#f4f8ff', false); g.restore();
    g.fillStyle = `rgba(230,240,255,${0.7 * flash})`; g.fillRect(0, 0, W, H);
  }
}
function fall(t) {
  if (t < T.wake - 0.25) {
    // down through the canopy: big leaves rush up past her, the light goes green and dim
    const u = seg(T.c2, T.wake - 0.25, t, x => x);
    grad([[0, '#2c5a3a'], [1, '#0f2a1a']]);
    for (let i = 0; i < 14; i++) { const y = ((i * 210 - u * 3200) % 2600 + 2600) % 2600 - 300; bigLeaf((i * 173) % W - 60, y, 260 + 80 * hash(i), 0.6 * (hash(i + 2) - 0.5) + (i % 2 ? Math.PI : 0), i % 2 ? '#2f6a42' : '#1f5235'); }
    drawSeatRow({ x: 540, y: 960, s: 0.9, rot: 2.0 * u + 0.3 * Math.sin(t * 3), hairUp: 1, open: 0.8, t });
    g.fillStyle = `rgba(0,0,0,${seg(T.wake - 0.6, T.wake - 0.25, t)})`; g.fillRect(0, 0, W, H);
    return;
  }
  // she comes to on the forest floor, under the seats; light comes through the canopy
  const k = seg(T.wake - 0.25, T.wake + 0.6, t);
  grad([[0, '#2e5a3e'], [0.55, '#4a7a52'], [1, '#2a3a24']]);
  jungle(t, 0.2, 0, 900); jungle(t, 0.7, 0, 1050);
  rect(0, FLOOR, W, H - FLOOR, '#3d2f20'); for (let i = 0; i < 30; i++) ell((i * 71) % W, FLOOR + 20 + 40 * hash(i), 60, 12, '#4f3d28');
  rays(t, 0.22);
  drawSeatRow({ x: 760, y: FLOOR - 90, s: 0.6, rot: -0.5, girl: false });
  drawGirl({ x: 430, y: FLOOR - 40, s: 0.6, rot: -Math.PI / 2 + 0.25 * seg(T.wake + 0.8, T.c3, t), t, shut: t < T.wake + 0.4, look: 0.4, dirty: true });
  g.fillStyle = `rgba(0,0,0,${1 - k})`; g.fillRect(0, 0, W, H);
}
function forest(t, scroll = 0) {
  grad([[0, '#2e5a3e'], [0.55, '#4a7a52'], [1, '#2a3a24']]);
  jungle(t, 0.2, scroll, 900); jungle(t, 0.6, scroll, 1050);
}
function inv(t) {
  forest(t); rect(0, FLOOR, W, H - FLOOR, '#3d2f20'); rays(t, 0.2);
  drawGirl({ x: 540, y: FLOOR, s: 0.95, t, look: 0.2, lookY: 0.3, dirty: true, arm: [10, -400], smile: 0.0 });          // holding the shoulder
  bigLeaf(-60, 1500, 420, -0.4); bigLeaf(1140, 1420, 380, Math.PI + 0.3, '#2f6a42');
}
function father(t) {
  if (t < T.map) {
    // a memory: warmer, sepia; he points at a stream running away to the right
    grad([[0, '#8a7a5a'], [1, '#5a4a32']]);
    jungle(t, 0.3, 0, 1000);
    rect(0, FLOOR, W, H - FLOOR, '#5a4a32');
    g.save(); g.globalAlpha = 0.9; fill(smoothPath([[300, FLOOR + 40], [700, FLOOR + 10], [1100, FLOOR + 60], [1100, FLOOR + 180], [700, FLOOR + 140], [300, FLOOR + 160]]), '#7a9aa0'); g.restore();
    drawFather({ x: 330, y: FLOOR, s: 0.95, t, look: 1, point: [190, -470] });
    drawGirl({ x: 120, y: FLOOR + 30, s: 0.7, t, glasses: true, look: 1, smile: 0.5 });
    g.fillStyle = 'rgba(120,80,40,0.22)'; g.fillRect(0, 0, W, H);
    return;
  }
  // the lesson as a map: a stream joins a creek, the creek a river, and on the river — houses; the arrows run downstream
  g.fillStyle = '#21283a'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 880); g.rotate(-0.02);
  rrect(-470, -620, 940, 1240, 20, Hd.NIGHT.paper);
  for (let i = 0; i < 26; i++) ell(-440 + 880 * hash(i * 1.3), -590 + 1180 * hash(i * 2.1), 50, 50, 'rgba(60,120,70,0.25)');
  const u = seg(T.map, T.people + 0.4, t, x => x);
  const paths = [[[-380, -520], [-280, -300], [-160, -150]], [[-160, -150], [-20, 40], [120, 220]], [[120, 220], [260, 360], [380, 540]]];
  paths.forEach((p, i) => { const v = clamp(u * 3 - i); if (v <= 0) return; const q = p.map(([x, y], j) => [lerp(p[0][0], x, v), lerp(p[0][1], y, v)]); limb(q, 14 + 14 * i, '#4a90c9'); });
  if (u > 0.95) for (let i = 0; i < 4; i++) { const hx = 230 + i * 50, hy = 470 - 30 * i; poly([[hx - 26, hy], [hx, hy - 28], [hx + 26, hy]], '#c94a3b'); rect(hx - 20, hy, 40, 30, '#e8e2cf'); }
  for (let i = 0; i < 3; i++) { const p = paths[i][1], a = clamp(u * 3 - i - 0.5); if (a > 0) { g.save(); g.globalAlpha = a; Hd.label('↓', p[0] + 60, p[1], 56, GOLD, { shadow: false, stroke: false }); g.restore(); } }
  Hd.label('РУЧЕЙ', -300, -560, 40, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
  if (u > 0.4) Hd.label('РЕКА', 120, 160, 40, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
  if (u > 0.95) Hd.label('ЛЮДИ', 300, 560, 44, OK, { fam: FONTS.block, shadow: false, stroke: false });
  g.restore();
}
function walk(t) {
  const sc = (t - T.c5) * 160;
  forest(t, sc);
  rect(0, FLOOR - 40, W, 60, '#3d2f20');
  const ph = (t - T.c5) * 0.8;
  drawGirl({ x: 520, y: FLOOR + 160, s: 0.8, t, walk: 1, ph, look: 0.6, dirty: true, candy: t > T.candy, arm: t > T.candy ? [90, -330] : null });
  water(t, FLOOR + 30, H - FLOOR);
  for (let i = 0; i < 3; i++) bigLeaf(((i * 520 - sc * 1.4) % 1600 + 1600) % 1600 - 260, 1650 + 60 * i, 360, -0.3 + 0.2 * i);
}
function wound(t) {
  forest(t, (t - T.c5) * 160);
  water(t, FLOOR + 30, H - FLOOR);
  drawGirl({ x: 540, y: FLOOR + 300, s: 1.25, t, look: 0.6, lookY: 0.6, dirty: true, arm: [120, -330], wound: 0.5 + 0.5 * Math.sin(t * 5), smile: 0 });
  for (let i = 0; i < 7; i++) { const a = t * 6 + i * 0.9; ell(690 + 70 * Math.cos(a), 760 + 40 * Math.sin(a * 1.3), 5, 4, '#1a1a1e'); }
}
function boat(t) {
  forest(t); rect(0, FLOOR, W, 80, '#4a3a26'); water(t, FLOOR + 80, H - FLOOR - 80);
  boatHut(260, FLOOR + 40, 1.0, t);
  const pour = seg(T.fuel, T.fuel + 0.5, t);
  drawGirl({ x: 820, y: FLOOR + 40, s: 0.8, face: -1, t, look: 0.5, lookY: 0.6, dirty: true, arm: pour > 0 ? [lerp(60, 100, pour), -420] : null, farArm: pour > 0 ? [-120, -320] : null });
  if (pour > 0) {
    const cx = 820 - 0.8 * 100, cy = FLOOR + 40 - 0.8 * 420;
    g.save(); g.translate(cx, cy); g.rotate(-0.9 * pour); rrect(-34, -40, 68, 70, 8, '#c94a3b'); rect(-12, -52, 24, 14, '#3a3d44'); g.restore();
    for (let i = 0; i < 8; i++) { const v = ((t * 3 + i / 8) % 1); ell(cx - 40 - 10 * v, cy + 20 + 120 * v, 5, 8, 'rgba(240,200,90,0.8)'); }
  }
}
function rescue(t) {
  grad([[0, '#f2c98a'], [0.5, '#a9c48a'], [1, '#3a5a32']]);
  jungle(t, 0.2, 0, 900); jungle(t, 0.6, 0, 1050);
  rays(t, 0.35);
  rect(0, FLOOR, W, 80, '#5a4a30'); water(t, FLOOR + 80, H - FLOOR - 80);
  boatHut(180, FLOOR + 40, 0.9, t);
  drawGirl({ x: 380, y: FLOOR + 40, s: 0.75, face: 1, t, look: 1, dirty: true, smile: seg(T.c8 + 0.6, T.c8 + 1.2, t) * 0.8 });
  const u = seg(T.c8, T.c9 - 0.4, t);
  drawLumberjack({ x: lerp(1250, 760, u), y: FLOOR + 40, s: 0.78, face: -1, t, walk: u < 1 ? 1 : 0, ph: t * 1.2, look: -1 });
  drawLumberjack({ x: lerp(1450, 960, u), y: FLOOR + 40, s: 0.74, face: -1, t, walk: u < 1 ? 1 : 0, ph: t * 1.2 + 0.4, c: '#3a6ab8', hat: '#f5f5f0', look: -1 });
}
function lesson(t) {
  g.fillStyle = '#16241c'; g.fillRect(0, 0, W, H);
  jungle(t, 0.3, t * 20, 1400);
  g.fillStyle = 'rgba(10,20,14,0.55)'; g.fillRect(0, 0, W, H);
  const k = clamp(sp(t, T.c9 + 0.05, 2.4, 8));
  g.save(); g.translate(540, 820); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  rrect(-440, -300, 880, 600, 24, Hd.NIGHT.paper);
  Hd.label('ЗАПОМНИ', 0, -210, 54, '#5a6a86', { fam: FONTS.mono, shadow: false, stroke: false });
  const steps = [['ЛЕС', '#2d6a40'], ['РУЧЕЙ', '#4a90c9'], ['РЕКА', '#2f6fd6'], ['ЛЮДИ', '#c94a3b']];
  steps.forEach(([s, c], i) => {
    const v = clamp((t - (A.L9w1 + i * 0.35)) / 0.25); if (v <= 0) return;
    g.save(); g.globalAlpha *= v; const x = -330 + i * 220;
    ell(x, -40, 70, 70, c); Hd.label(s, x, 80, 34, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
    if (i < 3) Hd.label('→', x + 110, -20, 60, '#1d2433', { shadow: false, stroke: false });
    g.restore();
  });
  const v = clamp((t - A.L9w8) / 0.3); if (v > 0) { g.save(); g.globalAlpha *= v; Hd.label('ЛЮДИ ЖИВУТ У РЕК', 0, 200, 50, OK, { fam: FONTS.block, shadow: false, stroke: false }); g.restore(); }
  g.restore();
}
function next(t) {
  grad([[0, '#141826'], [1, '#2a2440']]);
  g.save(); g.globalAlpha = 0.25; jungle(t, 0.3, t * 30, 1600); g.restore();
}

// —— the 2D layer over every scene ——
function overlays(t) {
  const sc = scene(t);
  if (sc === 'hook') {
    // the altimeter: 3000 m and falling
    const alt = Math.max(0, Math.round(lerp(3000, 400, clamp(t / T.c1)) / 10) * 10);
    g.setTransform(1, 0, 0, 1, 0, 0); g.save();
    const x = 60, y = 110; rrect(x, y, 320, 120, 18, 'rgba(11,15,26,0.85)'); g.lineWidth = 3; g.strokeStyle = DANGER; g.stroke(rrPath(x + 1.5, y + 1.5, 317, 117, 17));
    Hd.label('ВЫСОТА', x + 30, y + 42, 28, '#c9d6ea', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
    Hd.label(`${alt} м`, x + 30, y + 100, 56, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
    g.restore();
    const tag = 'РЕАЛЬНАЯ ИСТОРИЯ', tw = measure(tag, 44, FONTS.cond) + 50;
    g.save(); g.translate(1020, 170); g.rotate(-0.03); rect(-tw + 6, -36 + 6, tw, 70, INK); rect(-tw, -36, tw, 70, '#ff4d4d'); text(tag, -tw / 2, 16, 44, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
    const ks = sp(t, T.survived, 2.2, 8);
    if (ks > 0.01) { g.save(); g.translate(540, 520); g.rotate(-0.06); const z = lerp(1.8, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
      const s = 'ВЫЖИЛА', sw = measure(s, 110) + 80; rrect(-sw / 2 + 10, -80 + 10, sw, 160, 20, INK); rrect(-sw / 2, -80, sw, 160, 20, '#2f8f4e'); text(s, 0, 36, 110, '#fff3d6', { shadow: false }); g.restore(); }
  }
  Hd.timeStamp(t, T.c1 + 0.15, T.c2 - 0.05, '24.12.1971 · ПЕРУ', { color: WARM });
  Hd.timeStamp(t, T.wake + 0.6, T.c4 - 0.05, 'ДЖУНГЛИ · ДЕНЬ 1', { color: OK, dot: OK });
  if (sc === 'storm') Hd.plaque(t, T.c1 + 0.6, T.c2 - 0.05, 540, 330, { icon: 'bolt', title: 'РЕЙС 508 · 92 НА БОРТУ', sub: 'в грозу, над джунглями', color: WARM, size: 40 });
  if (sc === 'fall' && t > T.wake + 0.5) Hd.plaque(t, T.wake + 0.6, T.c3 - 0.05, 540, 420, { icon: 'x', title: 'ОДНА', sub: 'пристёгнута к креслу', color: DANGER, size: 46 });
  if (sc === 'inv') [['КЛЮЧИЦА СЛОМАНА', A.L3w0, 'x'], ['ОЧКИ ПОТЕРЯНЫ', A.L3w2, 'x'], ['ОДНА САНДАЛИЯ', A.L3w4, 'x']].forEach(([s, t0, ic], i) =>
    Hd.plaque(t, t0, T.c4 - 0.05, 540, 330 + i * 120, { icon: ic, title: s, color: DANGER, size: 40 }));
  if (sc === 'father' && t < T.map) Hd.plaque(t, A.L4w3, T.map - 0.05, 540, 330, { icon: 'comment', title: 'УРОК ОТЦА', sub: 'он был биологом', color: GOLD, size: 44 });
  if (sc === 'father' && t >= T.map) Hd.plaque(t, T.map + 0.2, T.c5 - 0.05, 540, 1640, { icon: 'check', title: 'ИДИ ВНИЗ ПО ТЕЧЕНИЮ', sub: 'вода приведёт к людям', color: OK, size: 42 });
  if (sc === 'walk' || sc === 'wound' || sc === 'boat') {
    const d = sc === 'walk' ? 1 + Math.floor(8 * clamp((t - T.c5) / (T.c6 - T.c5))) : sc === 'wound' ? 9 : 10;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save();
    const x = 1020, y = 150, w = 250, h = 110; rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)'); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17));
    Hd.label('ДЕНЬ', x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
    Hd.label(String(d), x - w / 2, y + 38, 58, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
    g.restore();
  }
  if (sc === 'walk' && t > T.candy) Hd.plaque(t, T.candy + 0.2, T.c6 - 0.05, 540, 380, { icon: 'can', title: 'ЕДА: ПАКЕТИК КОНФЕТ', sub: 'на 10 дней', color: GOLD, size: 40 });
  if (sc === 'wound') Hd.plaque(t, T.c6 + 0.3, T.c7 - 0.05, 540, 380, { icon: 'medkit', title: 'РАНА ЗАГНОИЛАСЬ', sub: 'в тропиках — за считаные дни', color: DANGER, size: 40 });
  if (sc === 'boat' && t > T.fuel) Hd.plaque(t, T.fuel + 0.3, T.c8 - 0.05, 540, 380, { icon: 'drop', title: 'БЕНЗИН НА РАНУ', sub: 'так она выгнала червей', color: WARM, size: 40 });
  if (sc === 'rescue') {
    Hd.plaque(t, A.L8w5, T.c9 - 0.05, 540, 330, { icon: 'check', title: 'СПАСЕНА', sub: 'на 11-й день', color: OK, size: 52 });
    Hd.plaque(t, A.L8w5 + 0.5, T.c9 - 0.05, 540, 470, { icon: 'x', title: 'ИЗ 92 ВЫЖИЛА ОДНА', color: WARM, size: 38 });
  }
  if (t >= T.c10) {
    [['1', '9 ДНЕЙ В ПУСТЫНЕ', A.L10w2], ['2', '69 ДНЕЙ ПОД ЗЕМЛЁЙ', A.L10w6]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c11, T.c11 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 640 + i * 140;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  Hd.endCard(t, A.L11w1 - 0.1, 0, 300);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  ({ hook, storm, fall, inv, father, walk, wound, boat, rescue, lesson, next })[scene(t)](t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let dip = 0;
  for (const c of CUTS) if (t >= c && t < c + 0.18) dip = Math.max(dip, 1 - ease.out(clamp((t - c) / 0.16)));
  if (dip > 0.002) { g.globalAlpha = dip; rect(0, 0, W, H, '#000000'); g.globalAlpha = 1; }
  overlays(t);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.6);
}
export function motion() { return 0; }

export function cues() {
  const c = [];
  const add = (t, name, db = 0, pan = 0, extra = {}) => c.push({ t, name, db, pan, ...extra });
  add(0.0, 'whoosh', -6, 0); add(0.0, 'roof_wind', -8, 0, { dur: T.c1 });
  add(T.survived, 'stamp', -4, 0);
  add(T.c1, 'roof_wind', -14, 0, { dur: T.c2 - T.c1 }); add(T.c1, 'heli_far', -16, 0.3, { dur: T.c2 - T.c1 });
  add(T.bolt, 'thud', -2, 0); add(T.bolt + 0.02, 'spark', -6, 0.2); add(T.bolt + 0.3, 'wall_hit', -6, 0.3);
  add(T.c2, 'whoosh_down', -6, 0); add(T.c2 + 0.3, 'roof_wind', -10, 0, { dur: T.wake - T.c2 });
  add(T.wake - 0.3, 'thud', -6, 0); add(T.wake + 0.5, 'tweet', -16, -0.4, { dur: 1.2 }); add(T.wake + 0.5, 'breath', -14, 0, { dur: 2.0 });
  for (const t0 of [A.L3w0, A.L3w2, A.L3w4]) add(t0 + 0.02, 'pop_word', -10, 0);
  add(T.c4, 'paper', -10, 0); add(T.map, 'whoosh_in', -10, 0); add(T.people, 'ding', -10, 0);
  add(T.c5, 'tap_run', -16, 0.2, { dur: T.c7 - T.c5 }); add(T.c5, 'tweet', -18, 0.4, { dur: 1.2 });
  add(T.candy, 'paper', -12, -0.2);
  add(T.c6 + 0.3, 'heartbeat', -14, 0, { dur: T.c7 - T.c6, bpm: 92 });
  add(T.c7, 'tap_run', -18, 0.2, { dur: T.c8 - T.c7 }); add(T.fuel, 'pour', -8, -0.1);
  add(T.c8, 'morning', -12, 0, { dur: T.c9 - T.c8 }); add(T.c8 + 0.5, 'steps_out', -12, 0.5, { dur: 1.5 }); add(A.L8w5, 'ding', -10, 0);
  add(T.c9, 'paper', -12, 0); for (let i = 0; i < 4; i++) add(A.L9w1 + i * 0.35 + 0.02, 'pop_word', -12, -0.3 + i * 0.2);
  for (let i = 0; i < 2; i++) add((i ? A.L10w6 : A.L10w2) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L11w1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
