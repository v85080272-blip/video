// «69 дней под землёй» — «Реальные истории», 2: 33 шахтёра в Чили, 2010. The whole short as pure functions of time t,
// drawn straight in screen space; every beat anchored to the narrator's words (build/words.json; before the voice, a rough
// timing from voice/script.json). The hook is the first frame: 33 lamps coming on in the dark, then the camera pulls out
// of the refuge through 700 m of rock to the desert on top. Then: the collapse in the tunnel (05.08.2010), the refuge,
// the food (two spoons of tuna and a sip of milk every 48 hours), 17 days of not knowing (the camp on top, the dark below),
// the boreholes — one breaks through; the note on the bit; the «palomas» down the narrow hole; the wide shaft and the
// capsule; the foreman last, all 33 alive. The lesson, and the choice of the next story.
import fs from 'node:fs';
import { lerp, clamp, ease, spring, bump, hash, TAU } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';
import * as Hd from './hud.js';
import { drawMiner, drawMinerSit, crowd, mountain, REF, SURF, tunnel, rockfall, drillBit, paloma, capsule, flagCL, camp, tuna, spoon, milk, biscuit } from './story.js';
import { text, measure, FONTS, INK } from './type.js';

const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const SCRIPT = JSON.parse(fs.readFileSync(new URL('../voice/script.json', import.meta.url)));
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = {};
{
  let t = 0.12;
  for (const l of SCRIPT.lines) { const n = l.text.split(/\s+/).length; t += l.after ?? 0; FB[l.id] = [t, t + n * 0.36, n]; t += n * 0.36; }
}
export const DUR = VOICE?.dur ?? FB.L12[1] + 0.4;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
Hd.SUB.y = 1450; Hd.SUB.size = 80; Hd.SUB.lead = 94;
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { СЕМЬСОТ: DANGER, ЗЕМЛЁЙ: DANGER, ВЫЖИЛИ: OK, ОБРУШИЛАСЬ: DANGER, ВЫХОД: DANGER, ЛОВУШКЕ: DANGER, УБЕЖИЩЕ: GOLD,
  ПОРОВНУ: GOLD, ТУНЦА: GOLD, МОЛОКА: GOLD, СУТОК: DANGER, СЕМНАДЦАТЬ: GOLD, ЖИВЫ: OK, ЗАПИСКУ: GOLD, ПОРЯДКЕ: OK,
  ПИСЬМА: WARM, КАПСУЛЕ: GOLD, БРИГАДИР: GOLD, НАДОЛГО: GOLD, ВМЕСТЕ: OK, ПУСТЫНЕ: GOLD, ОКЕАНЕ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

const T = {
  lit: A.L0w0, pull: A.L0w3 - 0.12, days: A.L0w7 - 0.1, survived: A.L0w12 - 0.05,
  c1: A.L1 - 0.06, crash: A.L1w7 - 0.05, block: A.L1w10 - 0.06,
  c2: A.L2 - 0.06,
  c3: A.L3 - 0.06, boss: A.L3w5 - 0.05, table: A.L3w9 - 0.08, h48: A.L3w15 - 0.05,
  c4: A.L4 - 0.06,
  c5: A.L5 - 0.06, hit: A.L5w7 - 0.06,
  c6: A.L6 - 0.06, note: A.L6w5 - 0.05,
  c7: A.L7 - 0.06,
  c8: A.L8 - 0.06, wide: A.L8w2 - 0.05, lift: A.L8w5 - 0.05,
  c9: A.L9 - 0.06, all: A.L9w3 - 0.05,
  c10: A.L10 - 0.06, c11: A.L11 - 0.06, c12: A.L12 - 0.06,
};
export const CUTS = [T.c1, T.block, T.c2, T.c3, T.table, T.c4, T.c5, T.hit, T.c6, T.c7, T.c8, T.c9, T.c10, T.c11];
export const SNAPS = [];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scene = t => (t < T.c1 ? 'hook' : t < T.c2 ? 'collapse' : t < T.c3 ? 'refuge' : t < T.c4 ? 'ration' : t < T.c5 ? 'wait' : t < T.c6 ? 'drill'
  : t < T.c7 ? 'note' : t < T.c8 ? 'supplies' : t < T.c9 ? 'rescue' : t < T.c10 ? 'top' : t < T.c11 ? 'lesson' : 'next');

function grad(stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function rockBg(t, scroll = 0, dark = 0.0) {
  grad([[0, '#3e3026'], [1, '#2a2019']]);
  for (let i = 0; i < 70; i++) {
    const y = ((i * 97 + scroll) % 2200 + 2200) % 2200 - 140, x = 1080 * hash(i * 1.7);
    fill(polyPath([[x - 60, y], [x - 10, y - 40], [x + 70, y - 20], [x + 50, y + 40], [x - 40, y + 50]]), i % 3 ? 'rgba(90,70,54,0.5)' : 'rgba(30,22,16,0.4)');
  }
  if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, W, H); }
}
function glowAt(x, y, r, a = 0.5, c = '255,226,150') { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
// the refuge from inside: a low rock room, benches, the white cabinet; the 33 in rows
function refugeRoom(t, o = {}) {
  rockBg(t, 0, 0.35);
  fill(smoothPath([[-40, 470], [300, 420], [780, 430], [1120, 480], [1120, 1920], [-40, 1920]]), '#4a3a2c');
  rect(0, 1380, W, 540, '#3a2e24');
  if (o.cabinet) { rrect(70, 760, 260, 420, 10, '#d9dde2'); rect(76, 770, 248, 6, '#aab0b8'); if (o.cabinet > 0) { rect(80, 790, 240, 380, '#2a2f38'); for (let i = 0; i < 3; i++) rect(90, 880 + i * 110, 220, 8, '#8a9098');
    for (let i = 0; i < 4; i++) { rrect(100 + i * 50, 840, 36, 40, 6, '#2f6fd6'); } rrect(110, 930, 60, 70, 6, '#f4f4f0'); rrect(190, 960, 70, 40, 6, '#d9a75a'); } }
  const lamps = crowd(o.x0 ?? 120, o.y0 ?? 980, o.w ?? 840, o.h ?? 420, 33, t, { s: o.s ?? 0.2, rows: 4, cheer: o.cheer ?? 0, lit: o.lit ?? 1 });
  return lamps;
}

// —— the scenes ——
function hook(t) {
  // in the refuge, dark: the lamps come on one by one; then the pull out through the rock to the desert on top
  const lit = 0.2 + 0.8 * seg(T.lit, A.L0w2 + 0.35, t, x => x), u = seg(T.pull, T.pull + 1.7, t, ease.inOut);
  const z = Math.exp(lerp(Math.log(16), Math.log(1.0), u));
  const cx = lerp(REF[0], 540, u), cy = lerp(REF[1] - 6, 980, u);
  g.fillStyle = '#0b0907'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 960); g.scale(z, z); g.translate(-cx, -cy);
  mountain(t, { lit: 1, night: false });
  // inside the refuge box (world 92×40): the room and the 33, drawn small in world px
  g.save(); g.beginPath(); g.rect(REF[0] - 46, REF[1] - 22, 92, 40); g.clip();
  g.fillStyle = '#2a2019'; g.fillRect(REF[0] - 46, REF[1] - 22, 92, 40);
  const lamps = crowd(REF[0] - 44, REF[1] - 9, 88, 22, 33, t, { s: 0.0145, rows: 4, lit, beam: 1 });
  g.fillStyle = `rgba(4,3,2,${0.82 * (1 - lit)})`; g.fillRect(REF[0] - 46, REF[1] - 22, 92, 40);
  for (const [x, y, on] of lamps) if (on) { glowAt(x, y, 3.2, 0.8); ell(x, y, 0.45, 0.45, '#fff6d0'); }
  g.restore();
  if (u > 0.6) { const pr = 30 + 18 * ((t * 1.4) % 1); g.save(); g.globalAlpha = seg(0.6, 0.9, u) * (1 - ((t * 1.4) % 1)); g.lineWidth = 5; g.strokeStyle = '#ffd23f'; g.beginPath(); g.arc(REF[0], REF[1], pr + 30, 0, TAU); g.stroke(); g.restore(); }
  if (u > 0.55) {                                  // the depth ruler: surface to refuge
    const a = seg(0.55, 0.9, u);
    g.save(); g.globalAlpha = a; limb([[1000, SURF - 120], [1000, REF[1]]], 6, '#ffffff', false);
    for (let i = 0; i <= 7; i++) limb([[985, lerp(SURF - 120, REF[1], i / 7)], [1015, lerp(SURF - 120, REF[1], i / 7)]], 4, '#ffffff', false);
    limb([[REF[0] + 50, REF[1]], [990, REF[1]]], 3, 'rgba(255,255,255,0.6)', false); g.restore();
  }
  g.restore();
  g.fillStyle = `rgba(0,0,0,${0.55 * (1 - u)})`; g.fillRect(0, 0, W, H * 0.12);
}
function collapse(t) {
  if (t < T.block) {
    const sh = t > T.crash ? 22 * Math.exp(-(t - T.crash) * 2.2) : 0;
    g.save(); g.translate(sh * Math.sin(t * 71), sh * Math.cos(t * 53));
    tunnel(t, { vy: 800 });
    const u = seg(T.c1, T.crash + 0.2, t, x => x);
    for (const [dx, sd, ph] of [[-170, 3, 0], [170, 7, 0.4]]) drawMiner({ x: 540 + dx, y: 1500 - 40 * u, s: 0.75, seed: sd, t, face: dx < 0 ? 1 : -1, walk: t < T.crash ? 1 : 0, ph: t * 0.9 + ph,
      look: t > T.crash ? 0 : dx < 0 ? 0.6 : -0.6, lookY: t > T.crash ? -1 : 0, open: t > T.crash ? 0.8 : 0, beam: 0.4, aim: -0.3 });
    rockfall(t, (t - T.crash) / 1.4);
    g.restore();
    return;
  }
  // the way out, gone: a wall of fallen rock, two beams on it
  tunnel(t, { vy: 760 });
  fill(smoothPath([[120, 1500], [140, 700], [330, 420], [560, 360], [780, 420], [960, 700], [980, 1500]]), '#5e4836');
  for (let i = 0; i < 26; i++) { const x = 200 + 680 * hash(i * 1.9), y = 520 + 900 * hash(i * 3.7), r = 40 + 70 * hash(i);
    fill(polyPath([[x - r, y], [x - r * 0.3, y - r * 0.8], [x + r, y - r * 0.4], [x + r * 0.8, y + r * 0.6], [x - r * 0.5, y + r * 0.7]]), i % 2 ? '#6e5442' : '#4e3c2e'); }
  glowAt(430, 900, 260, 0.35); glowAt(660, 980, 240, 0.3);
  g.save(); g.globalAlpha = 0.35; for (let i = 0; i < 12; i++) ell(1080 * hash(i * 2.2) + 60 * Math.sin(t * 0.7 + i), 300 + 1400 * hash(i * 5.1), 220, 120, 'rgba(170,140,110,0.5)'); g.restore();
  for (const [x, sd] of [[300, 3], [780, 7]]) drawMiner({ x, y: 1780, s: 0.7, seed: sd, t, face: x < 540 ? 1 : -1, look: x < 540 ? 0.7 : -0.7, lookY: -0.6, beam: 0.35, aim: -0.5 });
}
function refuge(t) { refugeRoom(t, { cabinet: 0, x0: 40, w: 1000, y0: 900, h: 560, s: 0.27 }); }
function ration(t) {
  if (t < T.table) {
    refugeRoom(t, { cabinet: 1, x0: 380, w: 660, y0: 900, h: 320, s: 0.17 });
    drawMiner({ x: 300, y: 1560, s: 1.0, seed: 1, t, hat: '#f4f4f0', suit: '#2f4a7a', look: 0.5, smile: 0.1, arm: t > T.boss ? [190, -560] : null, beam: 0.25, aim: 0.1 });
    return;
  }
  // the table: what one man gets, once in two days
  grad([[0, '#2a2019'], [1, '#1a140f']]);
  rrect(-40, 1000, 1160, 900, 20, '#6a5040'); for (let i = 0; i < 8; i++) rect(-40, 1010 + i * 110, 1160, 4, 'rgba(0,0,0,0.2)');
  glowAt(540, 900, 700, 0.35);
  const k = (t0) => clamp(sp(t, t0, 2.6, 8));
  const kt = k(A.L3w11 - 0.1); if (kt > 0.01) tuna(300, 1200 - 60 * (1 - kt), 1.05 * kt);
  for (let i = 0; i < 2; i++) { const ks = k(A.L3w10 - 0.1 + i * 0.18); if (ks > 0.01) spoon(560 + i * 130, 1240, 0.95 * ks, -0.25 + 0.5 * i); }
  const km = k(A.L3w13 - 0.1); if (km > 0.01) milk(860, 1220, 0.95 * km, 0.22);
  const kb = k(A.L3w14); if (kb > 0.01) biscuit(470, 1500, 0.9 * kb);
}
function wait(t) {
  // top: the camp, in daylight, everyone waiting; bottom: the dark refuge
  g.save(); g.beginPath(); g.rect(0, 0, W, 900); g.clip();
  camp(t, 760, { tents: 6, flags: 3, rigX: 860 });
  for (let i = 0; i < 6; i++) drawMiner({ x: 120 + i * 120, y: 900, s: 0.32, seed: i + 40, t, suit: ['#3a6ab8', '#c94a3b', '#5a6a7a', '#7a5a8a'][i % 4], hat: ['#3a2a1c', '#6b4423', '#2c241c'][i % 3], lamp: false, dirt: false, look: 0.3, lookY: 0.6 });
  g.restore();
  g.save(); g.beginPath(); g.rect(0, 910, W, H - 910); g.clip();
  g.translate(0, 230); refugeRoom(t, { lit: 0.35, s: 0.17, y0: 1050, h: 330 }); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
  g.restore();
  rect(0, 896, W, 18, '#0b0907');
}
function drill(t) {
  if (t < T.hit) {
    // the mountain in section, the boreholes from the camp: three miss, the fourth goes straight in
    g.fillStyle = '#0b0907'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(540, 960); g.scale(1.0, 1.0); g.translate(-540, -980);
    mountain(t, { lit: 0.5 });
    const holes = [[480, 360, -0.16], [820, 300, 0.14], [600, 420, 0.1], [REF[0], 0, 0]];
    const u = seg(T.c5 + 0.1, T.hit, t, x => x);
    holes.forEach(([x, miss, bend], i) => {
      const v = clamp(u * 4 - i * 0.95); if (v <= 0) return;
      const yEnd = lerp(SURF - 60, REF[1] - 22 - miss, v), xEnd = x + bend * (yEnd - SURF) * (i === 3 ? 0 : 0.35);
      limb([[x, SURF - 60], [lerp(x, xEnd, 0.5) + bend * 60, (SURF + yEnd) / 2], [xEnd, yEnd]], 7, i === 3 ? '#ffd23f' : 'rgba(255,255,255,0.75)', true);
      if (i < 3 && v >= 1) { Hd.redX(xEnd, yEnd, 40, 1, 0); }
    });
    g.restore();
    return;
  }
  // inside: the bit punches through the roof; they cheer
  const d = seg(T.hit, T.hit + 0.45, t, ease.out);
  refugeRoom(t, { cheer: seg(T.hit + 0.25, T.hit + 0.8, t), s: 0.26, x0: 40, w: 1000, y0: 1000, h: 520 });
  drillBit(540, lerp(380, 820, d), 0.62, {});
  for (let i = 0; i < 14; i++) { const v = (t - T.hit) * 1.4 - hash(i) * 0.5; if (v > 0 && v < 1.2) ell(540 + 260 * (hash(i * 3.3) - 0.5) * v * 2, 480 + v * v * 1500, 14 + 16 * hash(i), 10 + 10 * hash(i), '#6e5442'); }
  if (t < T.hit + 0.1) { g.fillStyle = `rgba(255,240,200,${0.6 * (1 - (t - T.hit) / 0.1)})`; g.fillRect(0, 0, W, H); }
}
function note(t) {
  // the bit going back up through the rock, the note taped to it
  const sc = (t - T.c6) * 700;
  rockBg(t, sc, 0.2);
  fill(polyPath([[400, 0], [680, 0], [680, H], [400, H]]), 'rgba(0,0,0,0.35)');
  drillBit(540, 1620 - 40 * Math.sin(t * 2), 1.05, { paint: '#c0262d', note: [{ s: 'ESTAMOS BIEN', size: 42 }, { s: 'EN EL REFUGIO', size: 42 }, { s: 'LOS 33', size: 54 }] });
}
function supplies(t) {
  // the narrow hole in section: the «palomas» slide down one after another
  rockBg(t, 0, 0.1);
  rect(470, 0, 140, H, '#15100c'); limb([[470, 0], [470, H]], 6, '#5e4836', false); limb([[610, 0], [610, H]], 6, '#5e4836', false);
  for (let i = 0; i < 3; i++) { const y = ((t - T.c7) * 900 + i * 820) % 2460 - 500; paloma(540, y, 0.85); }
  glowAt(540, 1880, 300, 0.45);
}
function rescue(t) {
  // the mountain in section again: the wide shaft goes down; the capsule goes up and down; the count of those raised
  g.fillStyle = '#0b0907'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 960); g.scale(1.0, 1.0); g.translate(-540, -980);
  mountain(t, { lit: 0.8, night: true, block: 1 });
  const v = seg(T.wide, T.lift - 0.1, t, x => x), x = REF[0] + 60, yEnd = lerp(SURF - 60, REF[1], v);
  if (v > 0) { limb([[x, SURF - 60], [x, yEnd]], 30, '#0e0b08', false); limb([[x - 15, SURF - 60], [x - 15, yEnd]], 3, '#8a7a6a', false); limb([[x + 15, SURF - 60], [x + 15, yEnd]], 3, '#8a7a6a', false); }
  if (v >= 1) limb([[REF[0] + 40, REF[1]], [x, REF[1]]], 14, '#0e0b08', false);
  if (t > T.lift) {
    const trip = 1.1, ph = ((t - T.lift) % trip) / trip, y = ph < 0.5 ? lerp(REF[1] - 20, SURF - 70, ease.inOut(ph * 2)) : lerp(SURF - 70, REF[1] - 20, ease.inOut(ph * 2 - 1));
    limb([[x, SURF - 140], [x, y - 40]], 2, '#c9cfd8', false);
    capsule(x, y, 0.07, { cable: false });
  }
  limb([[x - 60, SURF - 160], [x, SURF - 230], [x + 60, SURF - 160]], 6, '#c9cfd8', false); limb([[x, SURF - 230], [x, SURF - 60]], 6, '#c9cfd8', false); ell(x, SURF - 230, 18, 18, '#c9cfd8');
  g.restore();
}
function top(t) {
  // night on the surface: the floodlights, the winch wheel; the capsule comes out of the ground, the foreman steps out
  camp(t, 1250, { night: true, rig: false, tents: 0, flags: 0 });
  for (const lx of [80, 1000]) { limb([[lx, 1250], [lx, 520]], 10, '#5a6068', false); rrect(lx - 50, 490, 100, 50, 8, '#e9e4d6'); glowAt(lx, 520, 520, 0.28, '255,250,230'); }
  limb([[400, 1250], [540, 520], [680, 1250]], 14, '#c9cfd8', false); ell(540, 520, 60, 60, 'rgba(0,0,0,0)'); g.lineWidth = 10; g.strokeStyle = '#c9cfd8'; g.beginPath(); g.arc(540, 520, 60, 0, TAU); g.stroke();
  rrect(400, 1236, 280, 40, 10, '#5a6068');
  const up = seg(T.c9, T.c9 + 1.0, t, ease.out), out = seg(T.c9 + 1.0, T.c9 + 1.7, t);
  limb([[540, 520], [540, lerp(1500, 1000, up) - 470 * 0.62]], 4, '#3a3d44', false);
  g.save(); g.beginPath(); g.rect(0, 0, W, 1250); g.clip(); capsule(540, lerp(1500, 1000, up), 0.62, { cable: false }); g.restore();
  for (const [x, sd, f] of [[170, 11, 1], [330, 12, 1], [770, 13, -1], [930, 14, -1]]) drawMiner({ x, y: 1640, s: 0.62, seed: sd, t, face: f, shades: true, cheer: seg(T.all, T.all + 0.4, t), smile: 0.9, open: t > T.all ? 0.5 : 0, lamp: false });
  if (out > 0) drawMiner({ x: lerp(540, 610, out), y: lerp(1450, 1720, out), s: 0.78, seed: 1, t, hat: '#f4f4f0', suit: '#2f4a7a', shades: true, smile: 0.8, arm: [120, -640], lamp: false });
  for (let i = 0; i < 2; i++) flagCL(i ? 1010 : 70, 1900, 0.75, t + i);
}
function lesson(t) {
  grad([[0, '#1d1712'], [1, '#2a2019']]);
  g.save(); g.globalAlpha = 0.25; rockBg(t, t * 20); g.restore();
  const k = clamp(sp(t, T.c10 + 0.05, 2.4, 8));
  g.save(); g.translate(540, 820); g.scale(lerp(0.9, 1, k), lerp(0.9, 1, k)); g.globalAlpha = clamp(k * 2);
  rrect(-440, -300, 880, 600, 24, Hd.NIGHT.paper);
  Hd.label('ЗАПОМНИ', 0, -210, 54, '#5a6a86', { fam: FONTS.mono, shadow: false, stroke: false });
  const steps = [['ЕДА', 'can', A.L10w6], ['НАДОЛГО', 'calendar', A.L10w8], ['ВМЕСТЕ', 'check', A.L10w10]];
  steps.forEach(([s, ic, t0], i) => {
    const v = clamp((t - t0 + 0.05) / 0.25); if (v <= 0) return;
    g.save(); g.globalAlpha *= v; const x = -290 + i * 290;
    ell(x, -40, 80, 80, ['#ef8a2a', '#2f6fd6', '#2f8f4e'][i]); g.save(); g.translate(x, -40); Hd.icon(ic, 46, '#ffffff'); g.restore();
    Hd.label(s, x, 92, 36, '#1d2433', { fam: FONTS.mono, shadow: false, stroke: false });
    if (i < 2) Hd.label('→', x + 145, -20, 56, '#1d2433', { shadow: false, stroke: false });
    g.restore();
  });
  const v = clamp((t - A.L10w11) / 0.3); if (v > 0) { g.save(); g.globalAlpha *= v; Hd.label('ТАК ВЫЖИЛИ ВСЕ 33', 0, 210, 50, OK, { fam: FONTS.block, shadow: false, stroke: false }); g.restore(); }
  g.restore();
}
function next(t) {
  grad([[0, '#141826'], [0.5, '#3a2c22'], [1, '#14263a']]);
  g.save(); g.globalAlpha = 0.35;
  fill(smoothPath([[-100, 980], [200, 900], [500, 960], [800, 880], [1200, 960], [1200, 1100], [-100, 1100]]), '#c9a066');
  for (let i = 0; i < 10; i++) limb([[-50 + i * 130 + 30 * Math.sin(t + i), 1300 + 40 * (i % 3)], [40 + i * 130 + 30 * Math.sin(t + i), 1300 + 40 * (i % 3)]], 6, '#8ab4d9', false);
  g.restore();
}

// —— the 2D layer over every scene ——
function counter(x, y, title, val, c, w = 250) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.save();
  const h = 110; rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)'); g.lineWidth = 3; g.strokeStyle = c; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17));
  Hd.label(title, x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(String(val), x - w / 2, y + 38, 56, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function overlays(t) {
  const sc = scene(t);
  if (sc === 'hook') {
    const u = seg(T.pull, T.pull + 1.7, t, ease.inOut);
    if (t > T.pull) counter(380, 170, 'ГЛУБИНА', `${Math.round(700 * u / 10) * 10} м`, DANGER, 320);
    if (t > T.days) counter(1020, 330, 'ДНЕЙ', Math.round(69 * seg(T.days, T.days + 1.0, t, x => x)), GOLD);
    const tag = 'РЕАЛЬНАЯ ИСТОРИЯ', tw = measure(tag, 44, FONTS.cond) + 50;
    g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(1020, 170); g.rotate(-0.03); rect(-tw + 6, -36 + 6, tw, 70, INK); rect(-tw, -36, tw, 70, '#ff4d4d'); text(tag, -tw / 2, 16, 44, '#fff3d6', { fam: FONTS.cond, shadow: false }); g.restore();
    if (t < T.pull) Hd.plaque(t, A.L0w1, T.pull - 0.05, 540, 330, { icon: 'torch', title: '33 ЧЕЛОВЕКА', sub: 'в темноте, под землёй', color: GOLD, size: 44 });
    const ks = sp(t, T.survived, 2.2, 8);
    if (ks > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, 560); g.rotate(-0.06); const z = lerp(1.8, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
      const s = 'ВСЕ ВЫЖИЛИ', sw = measure(s, 100) + 80; rrect(-sw / 2 + 10, -76 + 10, sw, 152, 20, INK); rrect(-sw / 2, -76, sw, 152, 20, '#2f8f4e'); text(s, 0, 34, 100, '#fff3d6', { shadow: false }); g.restore(); }
  }
  Hd.timeStamp(t, T.c1 + 0.15, T.c2 - 0.05, '05.08.2010 · ЧИЛИ, ПУСТЫНЯ АТАКАМА', { color: WARM, size: 34 });
  if (sc === 'collapse' && t > T.block) Hd.plaque(t, T.block + 0.2, T.c2 - 0.05, 540, 330, { icon: 'x', title: 'ВЫХОД ЗАВАЛЕН', sub: 'над ними 700 м скалы', color: DANGER, size: 46 });
  if (sc === 'refuge') Hd.plaque(t, A.L2w6, T.c3 - 0.05, 540, 330, { icon: 'house', title: 'УБЕЖИЩЕ', sub: 'комната на глубине 700 м', color: GOLD, size: 46 });
  if (sc === 'ration' && t < T.table) {
    Hd.plaque(t, A.L3w0 + 0.1, T.table - 0.05, 540, 330, { icon: 'can', title: 'ЕДЫ — НА ПАРУ ДНЕЙ', sub: 'а их тридцать три', color: DANGER, size: 42 });
    Hd.plaque(t, T.boss + 0.1, T.table - 0.05, 540, 480, { icon: 'check', title: 'БРИГАДИР', sub: 'всё — поровну', color: OK, size: 40 });
  }
  if (sc === 'ration' && t >= T.table) Hd.plaque(t, T.h48, T.c4 - 0.05, 540, 400, { icon: 'clock', title: 'РАЗ В 48 ЧАСОВ', sub: 'на одного человека', color: GOLD, size: 46 });
  if (sc === 'ration' || sc === 'wait' || sc === 'drill' || sc === 'note' || sc === 'supplies' || sc === 'rescue') {
    const d = sc === 'ration' ? 2 : sc === 'wait' ? 1 + Math.floor(16 * clamp((t - T.c4) / (T.c5 - T.c4 - 0.3))) : sc === 'drill' || sc === 'note' ? 17
      : sc === 'supplies' ? 18 + Math.floor(46 * clamp((t - T.c7) / (T.c8 - T.c7))) : 65 + Math.floor(4 * clamp((t - T.c8) / (T.c9 - T.c8 - 0.2)));
    counter(1020, sc === 'wait' ? 960 : 150, 'ДЕНЬ', d, sc === 'wait' ? DANGER : GOLD);
  }
  if (sc === 'wait') Hd.plaque(t, A.L4w3, T.c5 - 0.05, 540, 330, { icon: 'comment', title: 'ЖИВЫ ЛИ ОНИ?', sub: 'наверху ждут семьи', color: WARM, size: 46 });
  if (sc === 'drill' && t > T.hit) Hd.plaque(t, T.hit + 0.35, T.c6 - 0.05, 540, 330, { icon: 'check', title: 'БУР ПРОБИЛСЯ!', sub: '22.08.2010 · день 17', color: OK, size: 48 });
  if (sc === 'drill' && t < T.hit) Hd.plaque(t, T.c5 + 0.3, T.hit - 0.05, 540, 1640, { icon: 'x', title: 'МИМО, МИМО, МИМО…', sub: 'скважина толщиной с кулак', color: WARM, size: 40 });
  if (sc === 'note') Hd.plaque(t, T.note, T.c7 - 0.05, 540, 330, { icon: 'comment', title: 'ЗАПИСКА НА БУРЕ', sub: 'по-испански, красным', color: OK, size: 44 });
  if (sc === 'supplies') {
    Hd.plaque(t, T.c7 + 0.3, T.c8 - 0.05, 540, 330, { icon: 'bottle', title: '«ГОЛУБКИ»', sub: 'так звали эти трубы', color: GOLD, size: 46 });
    [['ЕДА', 'can', A.L7w6], ['ВОДА', 'drop', A.L7w7], ['ПИСЬМА ИЗ ДОМА', 'comment', A.L7w9]].forEach(([s, ic, t0], i) =>
      Hd.plaque(t, t0, T.c8 - 0.05, i % 2 ? 760 : 300, 900 + i * 150, { icon: ic, title: s, color: [OK, '#4a90c9', WARM][i], size: 38 }));
  }
  if (sc === 'rescue' && t > T.lift) {
    counter(1020, 330, 'ПОДНЯТО', `${Math.min(33, 1 + Math.floor((t - T.lift) / 1.1 * 3))}/33`, OK, 280);
    Hd.plaque(t, A.L8w11, T.c9 - 0.05, 540, 1640, { icon: 'check', title: 'КАПСУЛА «ФЕНИКС»', sub: 'шириной 54 см', color: GOLD, size: 40 });
  }
  if (sc === 'top') {
    Hd.timeStamp(t, T.c9 + 0.1, T.c10 - 0.05, '13.10.2010 · ДЕНЬ 69', { color: OK, dot: OK });
    if (t > T.all) counter(1020, 330, 'ПОДНЯТО', '33/33', OK, 280);
    Hd.plaque(t, T.all, T.c10 - 0.05, 540, 470, { icon: 'check', title: 'ВСЕ ЖИВЫ', sub: 'бригадир — последним', color: OK, size: 52 });
  }
  if (t >= T.c11) {
    [['1', '9 ДНЕЙ В ПУСТЫНЕ', A.L11w2], ['2', '76 ДНЕЙ НА ПЛОТУ', A.L11w7]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c12, T.c12 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, y = 640 + i * 140;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(540, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  Hd.endCard(t, A.L12w1 - 0.1, 0, 300);
}

export function init() { Hd.initHud(); }
export function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  ({ hook, collapse, refuge, ration, wait, drill, note, supplies, rescue, top, lesson, next })[scene(t)](t);
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
  add(0.0, 'drip', -14, 0, { dur: T.pull }); add(0.0, 'rumble', -20, 0, { dur: T.c1, near: 0.1 });
  for (let i = 0; i < 6; i++) add(T.lit + i * (A.L0w2 + 0.3 - T.lit) / 6, 'click', -16, -0.5 + i * 0.2);
  add(T.pull, 'whoosh', -8, 0); add(T.days, 'ticks_up', -12, 0.2); add(T.survived, 'stamp', -8, 0);
  add(T.c1, 'steps_out', -12, 0, { dur: T.crash - T.c1 }); add(T.c1, 'roof_wind', -18, 0, { dur: T.c2 - T.c1 });
  add(T.crash - 0.2, 'rumble', -4, 0, { dur: 3.0, near: 0.8 }); add(T.crash, 'wall_hit', -4, 0); add(T.crash + 0.25, 'thud', -6, 0.3);
  add(T.block, 'thud', -8, -0.2);
  add(T.c2, 'crowd_murmur', -18, 0, { dur: T.c3 - T.c2 }); add(T.c2, 'drip', -16, 0.3, { dur: T.c4 - T.c2 });
  add(T.c3 + 0.2, 'door_open', -14, -0.4); add(T.boss, 'pop_word', -12, 0);
  add(T.table, 'paper', -14, 0); add(A.L3w10, 'pan_clang', -16, 0.1); add(A.L3w11, 'pop_word', -12, -0.2); add(A.L3w13, 'pop_word', -12, 0.3); add(T.h48, 'ding', -10, 0);
  add(T.c4, 'roof_wind', -16, 0, { dur: T.c5 - T.c4 }); add(T.c4, 'heartbeat', -14, 0, { dur: T.c5 - T.c4, bpm: 64 }); add(T.c4 + 0.3, 'ticks_up', -16, 0.3);
  add(T.c5, 'drill', -12, 0.2, { dur: T.hit - T.c5 + 0.3 });
  add(T.hit, 'wall_hit', -4, 0); add(T.hit + 0.3, 'crowd_roar', -8, 0, { dur: T.c6 - T.hit });
  add(T.c6, 'drill', -18, 0, { dur: T.c7 - T.c6 }); add(T.note, 'paper', -10, 0);
  add(T.c7, 'gate_chain', -14, 0, { dur: 1.2 }); for (const t0 of [A.L7w6, A.L7w7, A.L7w9]) add(t0 + 0.02, 'pop_word', -10, 0);
  add(T.c8, 'drill', -14, 0, { dur: T.lift - T.c8 }); add(T.lift, 'gate_chain', -12, 0, { dur: T.c9 - T.lift - 0.2 });
  add(T.c9, 'gate_chain', -12, 0, { dur: 1.0 }); add(T.c9 + 0.9, 'crowd_roar', -6, 0, { dur: T.c10 - T.c9 - 0.6 }); add(T.all, 'ding', -8, 0);
  add(T.c10, 'paper', -12, 0); for (const t0 of [A.L10w6, A.L10w8, A.L10w10]) add(t0 + 0.02, 'pop_word', -12, 0);
  for (let i = 0; i < 2; i++) add((i ? A.L11w7 : A.L11w2) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L12w1, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
