// «На крышу» («Заражение», серия 3; подписчики выбрали крышу): the whole short as pure functions of time t (seconds), so
// any frame or motion-blur sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words
// (build/words.json from tools/voice.py, or tools/fake_words.mjs until the voice exists).
// Up the stairs to the 22nd floor; the hatch to the roof is padlocked — баба Валя has the keys (thirty years the head
// of the house committee). The survivor's note: in a fire you never go up to the roof (smoke rises, the doors there are
// locked) — but this is not a fire. On the roof: the hatch shut and held down (she stands on it); SOS laid out in letters
// three metres tall (seen from above); at night the torch: three short, three long, three short — and from the next
// roof a light blinks back. The choice: go to them over the roofs, or wait here.
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import * as Ld from './landing.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 3.2, 10], L1: [3.6, 6.7, 9], L2: [7.15, 11.6, 14], L3: [12.05, 13.8, 5], L4: [14.2, 18.3, 11], L5: [18.7, 22.7, 10],
  L6: [23.2, 25.2, 7], L7: [25.65, 29.6, 12], L8: [29.95, 34.3, 14] };
export const DUR = VOICE?.dur ?? 34.7;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { КРЫШУ: GOLD, ЗАКРЫТ: DANGER, КЛЮЧИ: WARM, ПОЖАР: DANGER, ВВЕРХ: DANGER, ЗАКРОЙ: GOLD, ПРИДАВИ: GOLD, SOS: GOLD, МЕТРА: GOLD,
  ФОНАРЁМ: GOLD, КОРОТКИХ: GOLD, ДЛИННЫХ: GOLD, ОТВЕТ: DANGER, ЗДЕСЬ: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  top: A.L0w5 - 0.08,                // «…и люк»: the top landing, the hatch in the ceiling
  locked: A.L0w7 - 0.05,             // «Закрыт на ключ»: he tugs the padlock
  keys: A.L1w3 - 0.08,               // «достала ключи»
  elder: A.L1w4 - 0.05,              // «Тридцать лет старшая по дому»
  unlock: A.L1e - 0.1,
  c3: A.L2 - 0.06,                   // the survivor's note: in a fire, never the roof
  noFire: A.L2w9 - 0.05,             // «Но у нас не пожар»
  c4: A.L3 - 0.06,                   // step 1 on the roof: the hatch shut and held down
  shut: A.L3w2 - 0.05,
  press: A.L3w4 - 0.05,
  c5: A.L4 - 0.06,                   // step 2: SOS from above
  sos: A.L4w2 - 0.05,
  metre: A.L4w5 - 0.05,
  heli: A.L4w8 - 0.1,
  c6: A.L5 - 0.06,                   // step 3: night, the torch
  m1: A.L5w4 - 0.04, m2: A.L5w6 - 0.04, m3: A.L5w8 - 0.04,
  reply: A.L6w4 - 0.05,              // «мигнули в ответ»
  c7: A.L7 - 0.06,                   // the choice; something knocks at the hatch from below
  knock: A.L7 + 0.15,
  c8: A.L8 - 0.06,
};
export const CUTS = [T.cover, T.top, T.c4, T.c5, T.c6, T.c7];
export const SNAPS = [T.unlock];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.top ? 'climb' : t < T.c4 ? 'top' : t < T.c5 ? 'roof' : t < T.c6 ? 'plan' : 'night');

// the stairwell in section, going up: floor f has its landing at x = (22 − f)·900, y = (22 − f)·400
const FL = { land: 300, run: 600, drop: 400 }, TOPF = 22;
const stairY = x => { const j = Math.floor(x / (FL.land + FL.run)), l = x - j * (FL.land + FL.run); return j * FL.drop + (l < FL.land ? 0 : (l - FL.land) * FL.drop / FL.run); };
const floorAt = x => TOPF - Math.floor((x + 60) / (FL.land + FL.run));
const climbX = t => lerp(3 * (FL.land + FL.run) + 150, 120, seg(T.cover, T.top, t, u => u));     // 19th → 22nd, at a run
// the top landing: the steel ladder up the wall to the hatch in the ceiling, the padlock on its hasp
const LAD = { x: 880, w: 110, top: Ld.LAND.ceil, hatch: [800, 990] };
// the morse code: three short, three long, three short; each group starts on its word (or right after the last one)
const MORSE = (() => {
  const out = []; let end = 0;
  for (const [t0, len] of [[T.m1, 0.13], [T.m2, 0.3], [T.m3, 0.13]]) {
    let s = Math.max(t0, end + 0.12);
    for (let i = 0; i < 3; i++) { out.push([s, s + len, len > 0.2]); s += len + 0.1; }
    end = s;
  }
  return out;
})();
const REPLY = [0, 1, 2].map(i => [T.reply + 0.15 + i * 0.3, T.reply + 0.15 + i * 0.3 + 0.16]);
const lit = (t, seq) => seq.some(([a, b]) => t >= a && t < b);

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
const SHOTS = [];
const shot = (t0, keys) => SHOTS.push({ t0, keys });
shot(T.top, [[T.top, 640, -185, 1.05], [T.unlock, 690, -190, 1.1], [T.c4, 700, -192, 1.12]]);       // the floor at about y 1150 on screen, the subtitles below it
shot(T.c4, [[T.c4, 40, -170, 1.12], [T.press, 60, -165, 1.18], [T.c5, 80, -160, 1.2]]);
shot(T.c6, [[T.c6, 520, -180, 1.08], [T.reply - 0.7, 600, -185, 1.12], [T.reply + 0.3, 1050, -250, 1.3], [T.c7, 1000, -240, 1.24]]);
shot(T.c7, [[T.c7, 380, -175, 1.14], [T.c8, 400, -178, 1.12], [DUR, 410, -178, 1.1]]);     // back to the hatch: it knocks
export function camAt(t) {
  if (scene(t) === 'climb') { const x = climbX(t), y = stairY(x); return { x: x - 120, y: y - 190, z: 1.15, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 }; }
  if (scene(t) === 'plan') return { x: 0, y: -700, z: 1, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.locked, 6], [T.unlock, 7], [T.shut + 0.35, 6], [T.knock, 12]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const base = (t, extra = {}) => ({ s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0,
  jacket: true, boots: true, pack: true, hat: true, ...extra });
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'cover') return {};
  // S1 · up the stairs at a run, the dog in front
  if (sc === 'climb') {
    const x = climbX(t), y = stairY(x), ph = x / 60;
    const o = base(t, { face: -1, look: [0.7, -0.4], brow: 0.5, lean: 0.2 });
    o.hip = [x, y - LEG + 8 * Math.abs(Math.sin(ph))];
    const fa = x + 28 * Math.sin(ph), fb = x - 28 * Math.sin(ph);
    o.feet = { near: [fa, stairY(fa) - 14 * Math.max(0, Math.cos(ph))], far: [fb, stairY(fb) - 14 * Math.max(0, -Math.cos(ph))] };
    const dx = x - 230;
    return { h: o, d: { x: dx, y: stairY(dx), s: DS, face: -1, walk: 1, ph: x / 130, t, blink: dblink(t), mouth: 0.4, tongue: 0.5 } };
  }
  // S2 · the top landing: he is up the ladder, the padlock rattles; she holds up the keys; it opens
  if (sc === 'top') {
    const rung = -220, o = stand(base(t, { face: 1, look: [0.3, -0.9], brow: t < T.unlock ? 0.8 : 0.2, headTilt: -0.15 }), LAD.x - 70, rung);
    const sh = shoulder(o), tug = t > T.locked && t < T.keys ? 14 * Math.sin((t - T.locked) * 30) * Math.exp(-(t - T.locked) * 3) : 0;
    o.hands = { near: { p: [LAD.x - 10 + tug, LAD.top + 70], shape: 'grip' }, far: { p: [LAD.x + 40, sh[1] + 30], shape: 'grip' } };
    const lift = seg(T.keys, T.keys + 0.4, t), give = seg(T.elder + 0.8, T.unlock - 0.15, t);
    const gr = { x: lerp(430, 600, give), y: 0, s: 0.62, face: 1, t, smile: t > T.elder ? 0.9 : 0.4, look: 0.6, reach: [lerp(70, 140, lift), lerp(-220, -620, lift)] };
    const d = { x: 250, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 1, mouth: 0.3, tongue: 0.3, look: -0.4 };
    return { h: o, gr, d, keys: lift > 0.05 ? toWorldKeys(gr) : null, lock: t < T.unlock ? 0 : clamp((t - T.unlock) / 0.6) };
  }
  // S3 · the roof by day: the lid swings shut, баба Валя steps onto it with her pan
  if (sc === 'roof') {
    const shut = seg(T.shut, T.shut + 0.4, t, u => u * u);
    const o = stand(base(t, { face: 1, look: [0.6, 0.3], brow: 0.3, lean: shut < 1 ? 0.25 : 0.04 }), -230);
    const sh = shoulder(o);
    if (shut < 1) o.hands = { near: { p: [lerp(sh[0] + 40, sh[0] + 110, shut), lerp(-330, -120, shut)], shape: 'grip' } };
    else if (t > T.press + 0.4) { const k = clamp(sp(t, T.press + 0.4, 2.4, 7)); o.hands = { far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
    const step = seg(T.press, T.press + 0.5, t);
    const gr = { x: lerp(330, 10, step), y: -16 * step - 18 * bump(clamp((t - T.press - 0.5) / 0.25)) * (step >= 1 ? 1 : 0), s: 0.62, face: -1, t, smile: 0.8, look: -0.5, reach: [90, -560], pan: true };
    return { h: o, gr, d: { x: 560, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), ears: 1, mouth: 0.5, tongue: 0.6, wag: 1, wagPh: t * 3 }, lid: 1 - shut };
  }
  if (sc === 'plan') return {};
  // S5 · night: he faces the next block from a few steps back from the parapet; the torch; the answer
  const back = t >= T.c7;
  const o = stand(base(t, { face: back ? -1 : 1, look: back ? [0.8, 0.4] : [0.9, -0.2], brow: t > T.reply ? 1 : 0.4, pop: t > T.knock ? 0.8 * bump(seg(T.knock, T.knock + 1.2, t)) : t > T.reply ? 0.7 * bump(seg(T.reply, T.reply + 1.2, t)) : 0 }), back ? 700 : 850);
  const sh = shoulder(o), raise = back ? 0.3 : seg(T.c6 + 0.2, T.c6 + 0.7, t);
  o.hands = { near: { p: [sh[0] + o.face * lerp(40, 120, raise), lerp(sh[1] + 120, sh[1] - 20, raise)], shape: 'grip' } };
  o.torch = { p: o.hands.near.p, ang: back ? Math.PI - 0.6 : lerp(0.9, -0.12, raise), on: lit(t, MORSE) || (t > T.c6 + 0.2 && t < T.m1 - 0.3) || t > T.knock + 0.3 ? 1 : 0 };
  const jolt = t > T.knock ? 30 * Math.exp(-(t - T.knock) * 6) * Math.abs(Math.sin((t - T.knock) * 25)) : 0;
  const gr = { x: 10, y: -16 - jolt, s: 0.62, face: 1, t, smile: t > T.knock ? 0.1 : 0.6, look: 1, reach: t > T.knock ? [110, -600] : [90, -560], pan: true };
  const d = { x: back ? 520 : 640, y: 0, s: DS, face: back ? -1 : 1, sit: t > T.reply ? 0 : 1, t, blink: dblink(t), ears: 1, mouth: t > T.reply ? 0.2 : 0.4, tongue: t > T.reply ? 0 : 0.4, look: 0.3 };
  return { h: o, gr, d, lid: 0 };
}
// the key ring in her raised hand, in world coordinates
function toWorldKeys(gr) { const s = gr.s; return [gr.x + gr.face * gr.reach[0] * s, gr.reach[1] * s]; }

// —— the sets ——
function climbStairs(t, cam) {
  const half = W / 2 / cam.z + 200, x0 = cam.x - half, x1 = cam.x + half;
  rect(x0, cam.y - 1200, x1 - x0, 2600, '#d9d4c4');
  const pts = []; for (let x = x0; x <= x1 + 40; x += 40) pts.push([x, stairY(Math.max(0, x)) - 330]);
  fill(polyPath([...pts, [x1 + 40, cam.y + 1400], [x0, cam.y + 1400]]), '#7d9a8c');
  limb(pts, 10, '#5d7a6c', false);
  for (let j = 0; j < 5; j++) {
    const lx = j * (FL.land + FL.run), ly = j * FL.drop, f = TOPF - j;
    if (lx + FL.land + FL.run < x0 - 200 || lx > x1 + 200) continue;
    Hd.label(String(f), lx + 150, ly - 380, 150, '#3c3f52', { fam: FONTS.block, shadow: false, stroke: false });
    ell(lx + 150, ly - 640, 40, 12, '#fff2c4'); ell(lx + 150, ly - 560, 260, 120, 'rgba(255,240,190,0.10)');
    rect(lx - 20, ly, FL.land + 40, 50, '#9a9486'); rect(lx - 20, ly, FL.land + 40, 8, '#7d776b');
    const n = 12, sx = FL.run / n, sy = FL.drop / n, st = [];
    for (let i = 0; i < n; i++) { const xa = lx + FL.land + i * sx, ya = ly + i * sy; st.push([xa, ya], [xa + sx, ya]); st.push([xa + sx, ya + sy]); }
    fill(polyPath([...st, [lx + FL.land + FL.run, ly + FL.drop + 50], [lx + FL.land, ly + 50]]), '#a8a294');
    limb([[lx + FL.land, ly + 50], [lx + FL.land + FL.run, ly + FL.drop + 50]], 14, '#7d776b', false);
    const rl = [[lx, ly - 230], [lx + FL.land, ly - 230], [lx + FL.land + FL.run, ly + FL.drop - 230]];
    for (let x = lx + 20; x < lx + FL.land + FL.run; x += 60) limb([[x, stairY(x) - 230], [x, stairY(x)]], 5, '#4a4f5c', false);
    limb(rl, 12, '#8a5a32', false);
  }
}
function ladderHatch(t, a) {
  const { x, w, top } = LAD;
  // the hatch in the ceiling: a steel lid on hinges, the hasp, the padlock (it pops open and falls)
  rect(LAD.hatch[0] - 14, top - 10, LAD.hatch[1] - LAD.hatch[0] + 28, 30, '#3c3f52');
  rect(LAD.hatch[0], top, LAD.hatch[1] - LAD.hatch[0], 22, '#6b7280'); rect(LAD.hatch[0], top + 18, LAD.hatch[1] - LAD.hatch[0], 6, '#4a505c');
  // the ladder: two rails, rungs every 100
  for (const rx of [x - w / 2, x + w / 2]) rect(rx - 7, top, 14, -top, '#5a6370');
  for (let y = -100; y > top + 40; y -= 100) rect(x - w / 2, y - 6, w, 12, '#7a8390');
  const k = a.lock ?? 0, lx = x - 10, ly = top + 52;
  rrect(lx - 8, top + 20, 16, 26, 4, '#8a909c');                                   // the hasp staple
  if (k < 1) {
    const fall = Math.max(0, k - 0.15) / 0.85, yy = ly + 520 * fall * fall, rot = 2.5 * fall;
    g.save(); g.translate(lx, yy); g.rotate(rot);
    g.lineWidth = 9; g.strokeStyle = '#c9d0d6'; g.beginPath(); g.arc(0, -10 - 14 * Math.min(1, k * 6), 20, Math.PI, 0); g.stroke();
    rrect(-30, -10, 60, 52, 10, '#d9a520'); rrect(-30, -10, 60, 12, 6, '#f2c94c'); ell(0, 16, 7, 9, '#5a4210');
    g.restore();
  }
}
function keyRing(p, t) {
  const [x, y] = p, sw = 0.4 * Math.sin(t * 12);
  g.save(); g.translate(x, y + 8); g.rotate(sw);
  g.lineWidth = 6; g.strokeStyle = '#c9d0d6'; g.beginPath(); g.arc(0, 18, 20, 0, TAU); g.stroke();
  [[-0.6, '#d9a520'], [-0.1, '#c9d0d6'], [0.4, '#b08d57'], [0.9, '#c9d0d6'], [1.4, '#d9a520']].forEach(([an, c], i) => {
    g.save(); g.translate(Math.cos(an + Math.PI / 2) * 20, 18 + Math.sin(an + Math.PI / 2) * 20); g.rotate(an + 0.2 * Math.sin(t * 15 + i));
    rect(-4, 0, 8, 46 + 6 * (i % 2), c); rect(-4, 30, 16, 6, c); rect(-4, 40, 12, 6, c); ell(0, -2, 10, 10, c); g.restore();
  });
  g.restore();
}
// the sky, the city and its smoke: dawn grey-blue by day (n 0), deep blue at night (n 1)
function sky(t, cam, n) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, n ? '#070b1c' : '#6d7f9c'); gr.addColorStop(0.55, n ? '#1a2142' : '#c2a98d'); gr.addColorStop(1, n ? '#2b2440' : '#e0b98c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (n) for (let i = 0; i < 70; i++) { const sx = hash(i * 3.1) * W, sy = hash(i * 7.7) * H * 0.5, tw = 0.5 + 0.5 * Math.sin(t * 2 + i); ell(sx, sy, 2.2, 2.2, `rgba(255,255,240,${0.3 + 0.5 * tw})`); }
}
function city(t, cam, n) {
  view(cam, 0.25);
  // far blocks with a few lit windows, smoke columns, a fire's glow on the horizon
  for (let i = 0; i < 16; i++) {
    const bx = -2600 + i * 360 + 80 * hash(i), bw = 220 + 120 * hash(i + 9), bh = 700 + 900 * hash(i + 3), by = 600;
    rect(bx, by - bh, bw, bh + 1400, n ? '#141a2e' : '#7b8394');
    for (let r = 0; r < bh / 70 - 1; r++) for (let c = 0; c < bw / 60 - 1; c++) {
      const h = hash(i * 131 + r * 17 + c * 7);
      if (h > (n ? 0.93 : 0.97)) rect(bx + 22 + c * 60, by - bh + 30 + r * 70, 26, 34, n ? '#ffcf7a' : '#e8d9b0');
    }
  }
  for (const [fx, k] of [[-1500, 1], [700, 0.7], [1900, 0.85]]) {
    const gl = g.createRadialGradient(fx, 600, 0, fx, 600, 700 * k); gl.addColorStop(0, `rgba(255,120,40,${n ? 0.5 : 0.25})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gl; g.fillRect(fx - 700, -200, 1400, 1400);
    for (let j = 0; j < 9; j++) { const u = ((t * 0.08 + j / 9) % 1), r = 90 + 260 * u; ell(fx + 120 * u + 30 * Math.sin(j * 2 + t * 0.5), 560 - 1700 * u, r, r * 0.8, n ? '#0d1122' : '#5c5f68', 0, 0.55 * (1 - u) * k); }
  }
}
// the next block: its roof lower than ours, a little further off; the answer blinks from it at night
function nextBlock(t, cam, n, a) {
  view(cam, 0.6);
  const x0 = 450, x1 = 2300, top = -400;
  rect(x0, top, x1 - x0, 2400, n ? '#20263c' : '#8d94a2'); rect(x0 - 20, top - 30, x1 - x0 + 40, 40, n ? '#2c3350' : '#9fa6b4');
  for (let r = 0; r < 10; r++) for (let c = 0; c < 12; c++) rect(x0 + 60 + c * 145, top + 90 + r * 210, 70, 110, n ? (hash(r * 13 + c) > 0.92 ? '#ffcf7a' : '#141a2c') : '#6f7686');
  rect(x0 + 520, top - 210, 22, 180, n ? '#2c3350' : '#7b8394'); limb([[x0 + 470, top - 210], [x0 + 592, top - 210]], 8, n ? '#2c3350' : '#7b8394', false);
  if (n) {
    const on = lit(t, REPLY) ? 1 : 0, p = [x0 + 317, top - 40];
    if (on) { const gl = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 260); gl.addColorStop(0, 'rgba(255,240,200,0.9)'); gl.addColorStop(0.15, 'rgba(255,230,170,0.35)'); gl.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gl; g.fillRect(p[0] - 260, p[1] - 260, 520, 520); }
    ell(p[0], p[1], 9, 9, on ? '#fffbe8' : '#3a3f55');
    a.replyAt = p;
  }
}
// our roof in section: bitumen, the parapet, vent stacks, the TV antenna, the hatch (lid 1 = up, 0 = shut)
function roof(t, n, a) {
  rect(-1700, 0, 2860, 900, n ? '#1a1c24' : '#4a4d55'); rect(-1700, 0, 2860, 14, n ? '#2a2d38' : '#62656e');
  rect(1150, -90, 60, 990, n ? '#232633' : '#5a5d66'); rect(1140, -100, 80, 16, n ? '#2d3140' : '#6e717a');
  for (const [vx, vh] of [[-1100, 260], [-640, 180]]) { rect(vx, -vh, 120, vh, n ? '#262a36' : '#6a6d76'); rect(vx - 14, -vh - 24, 148, 24, n ? '#30344a' : '#7a7d86'); }
  limb([[-860, 0], [-860, -760]], 10, n ? '#3a3f55' : '#5a5d66', false);
  for (const [y, w] of [[-700, 220], [-600, 160], [-520, 110]]) limb([[-860 - w / 2, y], [-860 + w / 2, y + 20]], 8, n ? '#3a3f55' : '#5a5d66', false);
  // the hatch frame flush with the roof, the lid swinging on its hinge at the left edge
  rect(-130, -14, 260, 20, n ? '#30344a' : '#6b7280');
  const up = a.lid ?? 0, ang = -Math.PI / 2 * up;
  g.save(); g.translate(-130, -14); g.rotate(ang); rect(0, -10, 260, 22, n ? '#3a4058' : '#8a909c'); rect(0, -10, 260, 6, n ? '#4a5170' : '#a3a9b4'); g.restore();
  if (up > 0.05) ell(0, -6, 120 * up, 8, '#0d0f14');
}
function panAt(p) { g.save(); g.translate(p[0], p[1]); g.rotate(-0.5); ell(0, -50, 46, 46, '#2a2a30'); ell(0, -50, 34, 34, '#3c3c44'); rrect(-8, -8, 16, 80, 6, '#5a3a24'); g.restore(); }
function drawGr(gr) { Ld.drawGranny(gr); if (gr.pan) { const r = gr.reach; panAt([gr.x + gr.s * gr.face * r[0], gr.y + gr.s * r[1]]); } }
function torchAt(o) {
  const tr = o.torch; if (!tr) return;
  const [x, y] = tr.p, c = Math.cos(tr.ang), s = Math.sin(tr.ang);
  if (tr.on) {
    const L = 1500, wd = 230, tip = [x + c * 40, y + s * 40];
    const gl = g.createLinearGradient(tip[0], tip[1], tip[0] + c * L, tip[1] + s * L); gl.addColorStop(0, 'rgba(255,244,205,0.55)'); gl.addColorStop(1, 'rgba(255,244,205,0)');
    g.fillStyle = gl; g.fill(polyPath([[tip[0] - s * 10, tip[1] + c * 10], [tip[0] + s * 10, tip[1] - c * 10], [tip[0] + c * L + s * wd, tip[1] + s * L - c * wd], [tip[0] + c * L - s * wd, tip[1] + s * L + c * wd]]));
  }
  g.save(); g.translate(x, y); g.rotate(tr.ang); rrect(-24, -11, 64, 22, 6, '#2a2d38'); rect(36, -14, 10, 28, tr.on ? '#fff6d0' : '#6a7080'); g.restore();
}

// —— the plan from above: the roof, the hatch, the three of them, SOS laid out in strips ——
function planFrame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const k = seg(T.c5, T.c5 + 0.5, t), z = lerp(1.08, 1, k);
  g.fillStyle = '#5b6170'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(540, 900); g.scale(z, z); g.rotate(-0.02);
  rrect(-470, -760, 940, 1500, 10, '#3b3e47'); g.lineWidth = 26; g.strokeStyle = '#4f535e'; g.stroke(rrPath(-470, -760, 940, 1500, 10));
  for (let i = 0; i < 40; i++) ell(-440 + 880 * hash(i * 1.7), -720 + 1430 * hash(i * 2.9), 30 + 30 * hash(i), 18, 'rgba(0,0,0,0.12)');
  rect(-60, 480, 120, 120, '#6b7280'); rect(-48, 492, 96, 96, '#8a909c');                // the hatch, with her on it
  ell(0, 540, 40, 40, '#7a4f8a'); ell(0, 536, 28, 28, '#d9433b');
  rect(300, 420, 110, 110, '#5a5d66'); rect(-420, 300, 90, 140, '#5a5d66');               // vents
  // the letters: strips appear one by one, like sheets dragged into place
  const strips = [
    [[-330, -330], [-180, -330]], [[-330, -330], [-330, -170]], [[-330, -170], [-180, -170]], [[-180, -170], [-180, -10]], [[-180, -10], [-330, -10]],
    [[-95, -330], [95, -330]], [[95, -330], [95, -10]], [[95, -10], [-95, -10]], [[-95, -10], [-95, -330]],
    [[330, -330], [180, -330]], [[180, -330], [180, -170]], [[180, -170], [330, -170]], [[330, -170], [330, -10]], [[330, -10], [180, -10]],
  ];
  const t0 = T.sos, t1 = T.metre + 0.2;
  strips.forEach(([p, q], i) => {
    const u = clamp((t - (t0 + (t1 - t0) * i / strips.length)) / 0.25);
    if (u <= 0) return;
    limb([p, [lerp(p[0], q[0], ease.out(u)), lerp(p[1], q[1], ease.out(u))]], 44, '#f4f1ea', false);
  });
  // the hunter and the dog, from above, near the strip being laid
  const i = Math.min(strips.length - 1, Math.floor(clamp((t - t0) / (t1 - t0)) * strips.length)), q = strips[i][1];
  const hx = lerp(-250, q[0] + 40, seg(t0, t0 + 0.3, t)), hy = lerp(200, q[1] + 60, seg(t0, t0 + 0.3, t));
  ell(hx, hy, 46, 46, '#e8862a'); ell(hx, hy, 30, 30, '#7a5a3a'); ell(hx + 70, hy + 40, 26, 20, '#f2f2f2'); ell(hx + 86, hy + 44, 10, 10, '#9aa0ac');
  // the size: a dimension line beside the first S
  if (t > T.metre) {
    const u = seg(T.metre, T.metre + 0.35, t);
    limb([[-390, -330], [-390, lerp(-330, -10, u)]], 6, GOLD, false); limb([[-410, -330], [-370, -330]], 6, GOLD, false);
    if (u >= 1) limb([[-410, -10], [-370, -10]], 6, GOLD, false);
    g.save(); g.globalAlpha = u; g.translate(-430, -170); g.rotate(-Math.PI / 2); text('3 м', 0, 0, 56, GOLD, { fam: FONTS.mono, shadow: false }); g.restore();
  }
  g.restore();
  // the helicopter's view: a silhouette crossing high up, a dashed sight line down to the letters
  if (t > T.heli) {
    const u = clamp((t - T.heli) / 2.2), hx = lerp(-150, 1250, u), hy = 230;
    g.save(); g.globalAlpha = Math.min(1, u * 6) * (1 - seg(T.c6 - 0.3, T.c6, t));
    ell(hx, hy, 70, 30, '#1d2231'); rect(hx + 50, hy - 8, 110, 14, '#1d2231'); rect(hx - 150, hy - 46, 300, 8, '#1d2231');
    Hd.dashed([hx, hy + 30], [540, 820], GOLD, 5, 1);
    g.restore();
  }
}

// —— frame ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
export function frame(t) {
  const sc = scene(t);
  if (sc === 'cover') { coverFrame(t); Hd.finish(t); return; }
  if (sc === 'plan') { planFrame(t); overlays(t, camAt(t), {}); Hd.karaoke(t, SUBS, HOT); Hd.finish(t, 0.6); return; }
  const cam = camAt(t), a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  let dark = 0.35;
  const n = sc === 'night' ? 1 : 0;
  if (sc === 'climb') { view(cam, 1); climbStairs(t, cam); dark = 0.4; }
  else if (sc === 'top') { view(cam, 1); Ld.drawLanding(t, { dark: true }); Ld.drawDoor(t, { open: 0 }); ladderHatch(t, a); dark = 0.42; }
  else { sky(t, cam, n); city(t, cam, n); nextBlock(t, cam, n, a); view(cam, 1); roof(t, n, a); dark = n ? 0.5 : 0.12; }
  view(cam, 1);
  if (a.d) drawDog(a.d);
  if (a.gr) drawGr(a.gr);
  if (a.h) drawHunter(a.h);
  if (a.keys) keyRing(a.keys, t);
  if (a.h?.torch) torchAt(a.h);
  // the dark, lighter round the lamp, the torch and the answer
  g.setTransform(1, 0, 0, 1, 0, 0);
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(8,12,26,${dark})`; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
  const hole = (p, r, k, f = 1) => { const [x, y] = toScreen(cam, p, f), rr = r * scaleOf(cam, f); const gr = dk.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, rr, 0, TAU); dk.fill(); };
  if (a.h) hole([a.h.hip[0] + 40, a.h.hip[1] - 120], 520, n ? 0.35 : 0.6);
  if (a.gr) hole([a.gr.x, a.gr.y - 300], 360, n ? 0.25 : 0.5);
  if (a.h?.torch?.on) hole(a.h.torch.p, 700, 0.7);
  if (a.replyAt && lit(t, REPLY)) hole(a.replyAt, 300, 0.8, 0.6);
  g.drawImage(DK, 0, 0);
  if (sc === 'top' && t >= T.c3) noteCard(t);
  overlays(t, cam, a);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.8);
}

// —— the survivor's note: in a fire, never the roof — but this is not a fire ——
function noteCard(t) {
  const k = clamp(sp(t, T.c3 + 0.05, 2.4, 8)) * (1 - seg(T.c4 - 0.3, T.c4 - 0.02, t));
  if (k <= 0.01) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = clamp(k * 2) * 0.55; g.fillStyle = '#05070e'; g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.globalAlpha = clamp(k * 2); g.translate(540, 660); g.rotate(-0.025); g.scale(lerp(0.94, 1, clamp(k)), lerp(0.94, 1, clamp(k)));
  const w = 760, hh = 560;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rrect(-w / 2, -hh / 2, w, hh, 16, Hd.NIGHT.paper); g.restore();
  for (let i = 0; i < 6; i++) limb([[-w / 2 + 30, -hh / 2 + 150 + i * 70], [w / 2 - 30, -hh / 2 + 150 + i * 70]], 2, 'rgba(90,110,150,0.25)', false);
  for (let i = 0; i < 4; i++) ell(-w / 2 + 26, -hh / 2 + 90 + i * 120, 12, 12, '#cfc8b6');
  Hd.label('ЗАПИСКА ВЫЖИВШЕГО', -w / 2 + 60, -hh / 2 + 62, 34, '#5a6a86', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  g.save(); g.translate(-w / 2 + 110, -hh / 2 + 160); Hd.icon('flame', 40, DANGER); g.restore();
  Hd.label('ПРИ ПОЖАРЕ', -w / 2 + 180, -hh / 2 + 176, 58, '#1d2433', { align: 'left', shadow: false, stroke: false });
  const rows = [[A.L2w3, 'НЕ НА КРЫШУ', DANGER], [A.L2w6, 'ДЫМ ИДЁТ ВВЕРХ', '#1d2433'], [A.L2w7 + 0.4, 'ДВЕРИ ТАМ НА ЗАМКЕ', '#1d2433']];
  rows.forEach(([t0, s, c], i) => {
    const v = clamp((t - t0 + 0.05) / 0.2);
    if (v <= 0) return;
    const y = -hh / 2 + 280 + i * 84;
    g.save(); g.globalAlpha *= v; Hd.label('—  ' + s, -w / 2 + 70, y, 46, c, { align: 'left', shadow: false, stroke: false }); g.restore();
  });
  g.restore();
  // «Но у нас не пожар»: a green stamp across it
  const ks = sp(t, T.noFire, 2.2, 8) * (1 - seg(T.c4 - 0.3, T.c4 - 0.02, t));
  if (ks > 0.01) { g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(560, 1010); g.rotate(-0.07); const z = lerp(1.7, 1, Math.min(1, ks)); g.scale(z, z); g.globalAlpha = Math.min(1, ks * 3);
    const s = 'У НАС НЕ ПОЖАР', sw = measure(s, 64) + 60; rrect(-sw / 2 + 8, -52 + 8, sw, 104, 14, INK); rrect(-sw / 2, -52, sw, 104, 14, '#2f8f4e'); text(s, 0, 22, 64, '#fff3d6', { shadow: false }); g.restore(); }
}

// —— everything over the picture ——
function floorBadge(t) {
  if (t < T.cover || t > T.c3) return;
  const f = scene(t) === 'climb' ? floorAt(climbX(t)) : TOPF;
  const k = clamp(sp(t, T.cover, 2.6, 8)) * (1 - seg(T.c3 - 0.2, T.c3, t));
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 1020, y = 150, w = 250, h = 110;
  rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)');
  g.save(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17)); g.restore();
  Hd.label('ЭТАЖ', x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(String(f), x - w / 2, y + 38, 58, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
// the code on screen: dots and dashes appear as the torch flashes; the answer, small, by the light it came from
function morseHud(t, cam, a) {
  if (t < T.m1 - 0.05 || t > T.c8) return;
  const out = seg(T.c7, T.c7 + 0.3, t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = 1 - out;
  const y = 470; let x = 540 - 9 * 60 / 2 - 40;
  MORSE.forEach(([s, e, long], i) => {
    if (t >= s) { const on = t < e, z = on ? 1.15 : 1; if (long) rrect(x - 30 * z, y - 12 * z, 60 * z, 24 * z, 12, on ? '#fff6d0' : GOLD); else ell(x, y, 13 * z, 13 * z, on ? '#fff6d0' : GOLD); }
    x += 60 + (i % 3 === 2 ? 40 : 0);
  });
  if (t > T.reply && a.replyAt) {
    const p = toScreen(cam, a.replyAt, 0.6);
    REPLY.forEach(([s], i) => { if (t >= s) ell(p[0] - 50 + i * 50, p[1] - 70, 10, 10, '#fff6d0'); });
  }
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c3 - 0.1, '08:10 — ПОДЪЕЗД');
  Hd.timeStamp(t, T.c4 + 0.15, T.c6 - 0.1, '08:25 — КРЫША');
  Hd.timeStamp(t, T.c6 + 0.15, T.c7 - 0.1, '21:40 — НОЧЬ');
  floorBadge(t);
  if (scene(t) === 'top') {
    if (t < T.keys) Hd.plaque(t, T.locked + 0.05, T.keys - 0.02, 540, 330, { icon: 'x', title: 'НА ЗАМКЕ', sub: 'люк на крышу', color: DANGER });
    else if (t < T.c3) Hd.plaque(t, T.elder, T.c3 - 0.02, 540, 330, { icon: 'check', title: 'СТАРШАЯ ПО ДОМУ', sub: '30 лет со связкой ключей', color: WARM });
  }
  // step 1
  Hd.stepHeader(t, 1, 'ЛЮК ЗАКРЫТЬ', A.L3 + 0.02, A.L3e - 0.05);
  if (scene(t) === 'roof' && a.gr) Hd.plaque(t, T.press + 0.5, T.c5 - 0.02, 540, 640, { icon: 'check', title: 'ПРИДАВЛЕНО', sub: 'бабой Валей', color: OK, to: S2([a.gr.x, -30]) });
  // step 2
  Hd.stepHeader(t, 2, 'SOS НА КРЫШЕ', A.L4 + 0.02, A.L4e - 0.05, 260);
  if (scene(t) === 'plan') Hd.plaque(t, T.heli + 0.2, T.c6 - 0.02, 540, 1650, { icon: 'check', title: 'ВИДНО СВЕРХУ', sub: 'буквы по 3 метра', color: GOLD });
  // step 3
  Hd.stepHeader(t, 3, 'ФОНАРЬ: SOS', A.L5 + 0.02, A.L5e - 0.05);
  morseHud(t, cam, a);
  if (t >= T.reply && t < T.c7) Hd.plaque(t, T.reply + 1.0, T.c7 - 0.02, 540, 330, { icon: 'torch', title: 'НАМ ОТВЕТИЛИ', sub: 'с соседней крыши', color: DANGER });
  // the choice
  if (t >= T.c7) {
    [['1', 'К НИМ ПО КРЫШАМ', A.L7], ['2', 'ЖДЁМ ЗДЕСЬ', A.L7w5]].forEach(([nn, s, t0], i) => {
      const k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c8, T.c8 + 0.3, t));
      if (k <= 0.01) return;
      const w = measure(s, 50, FONTS.cond) + 130, x = 540, y = 560 + i * 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(nn, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c7 && t < T.c8 + 0.8) Hd.plaque(t, T.knock + 0.1, T.c8 + 0.4, 540, 330, { icon: 'x', title: 'СНИЗУ СТУЧАТ', sub: 'в люк', color: DANGER });
  if (t >= T.c8) Hd.plaque(t, A.L8w1 - 0.1, DUR + 1, 540, 620, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 4 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L8w12 - 0.1, 0, 300);
}

// —— the poster: the three on the roof at dusk, the smoke over the city, the title ——
function coverFrame(t) {
  const cam = { x: 240, y: -250, z: 1.1, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 }, a = { lid: 0 };
  sky(0, cam, 0); city(0, cam, 0); nextBlock(0, cam, 0, a); view(cam, 1); roof(0, 0, a);
  drawGr({ x: 10, y: -16, s: 0.62, face: 1, t: 0, smile: 0.8, look: 1, reach: [90, -560], pan: true });
  drawDog({ x: 560, y: 0, s: DS, face: 1, sit: 1, t: 0, ears: 1, mouth: 0.4, tongue: 0.5 });
  const o = stand(base(0, { face: 1, look: [0.9, -0.2], brow: 0.6, blink: 0 }), 380);
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(10,14,28,0.25)'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.save(); g.translate(540, 560);
  g.save(); g.shadowColor = 'rgba(255,190,90,0.8)'; g.shadowBlur = 40; Hd.label('НА КРЫШУ', 0, 0, 150, '#ffd27a', { shadow: false, strokeW: 12 }); g.restore();
  const pl = 'ЗАРАЖЕНИЕ · СЕРИЯ 3', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw / 2 + 8, 50 + 8, pw, 84, INK); rect(-pw / 2, 50, pw, 84, '#ffd43b'); text(pl, 0, 108, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover || scene(t) === 'plan') return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
  if (scene(t0) !== scene(t1)) return 0;
  const pts = tt => {
    const cam = camAt(tt), { h: o, d } = actorsAt(tt), out = [];
    if (o) out.push(...[o.hip, [o.hip[0], o.hip[1] - 200 * S], o.hands?.near?.p].filter(Boolean).map(p => toScreen(cam, p)));
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
  add(T.cover, 'stair_steps', -6, 0, { dur: T.top - T.cover, rate: 5.0 });
  add(T.cover, 'breath', -14, 0, { dur: T.top - T.cover + 0.6 });
  add(T.cover + 0.2, 'zombie_crowd', -20, -0.3, { dur: T.c4 - T.cover });
  add(T.locked, 'padlock', -4, 0.3);
  add(T.keys, 'keys', -6, -0.2, { dur: T.unlock - T.keys + 0.2 });
  add(T.elder + 0.2, 'ding', -12, 0);
  add(T.unlock, 'door_unlock', -6, 0.3);
  add(T.unlock + 0.45, 'lock_drop', -8, 0.3);
  add(T.c3 + 0.05, 'paper', -10, 0);
  for (const t0 of [A.L2w3, A.L2w6, A.L2w7 + 0.4]) add(t0 + 0.03, 'pop_word', -12, 0);
  add(T.noFire, 'stamp', -6, 0);
  add(T.c4, 'roof_wind', -16, 0, { dur: T.c5 - T.c4 + 0.2 });
  add(T.c4, 'zombie_crowd', -24, 0.2, { dur: T.c5 - T.c4 });
  add(T.shut, 'door_creak', -8, -0.2, { dur: 0.5 }); add(T.shut + 0.38, 'thud', -4, -0.2);
  add(T.press + 0.5, 'thud', -10, 0); add(T.press + 0.55, 'pop_word', -10, 0);
  add(T.c5, 'roof_wind', -20, 0, { dur: T.c6 - T.c5 });
  add(T.sos, 'cloth', -12, -0.3); add(T.sos + 0.8, 'cloth', -14, 0.1); add(T.sos + 1.6, 'cloth', -14, 0.3);
  add(T.heli, 'heli_far', -14, -0.5, { dur: 2.3 });
  add(T.c6, 'roof_wind', -16, 0, { dur: DUR - T.c6 });
  add(T.c6 + 0.2, 'click', -8, 0.2);
  for (const [s, e] of MORSE) { add(s, 'click', -12, 0.2); add(s, 'beep', -16, 0.2, { dur: e - s }); }
  for (const [s, e] of REPLY) add(s, 'beep', -20, 0.6, { dur: e - s, f: 1180 });
  add(T.reply + 0.1, 'heartbeat', -10, 0, { dur: T.c8 - T.reply, bpm: 112 });
  add(T.knock, 'hatch_knock', -2, -0.1); add(T.knock + 0.1, 'zombie_growl', -10, -0.1, { dur: 1.0, f0: 66, far: 0.5 });
  add(T.knock + 1.1, 'hatch_knock', -8, -0.1);
  for (let i = 0; i < 2; i++) add((i ? A.L7w5 : A.L7) + 0.02, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L8w1 - 0.1, 'blip', -8, 0);
  add(A.L8w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
