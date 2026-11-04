// «Уходим» («Заражение», серия 2): the whole short as pure functions of time t (seconds), so any frame or motion-blur
// sub-frame can be drawn in any order. Scene beats are anchored to the narrator's words (build/words.json from
// tools/voice.py, or tools/fake_words.mjs until the voice exists): another take moves the picture with it.
// The hunter and Пурга leave the flat on the 20th floor (the hall from episode 1, the landing from «Квартира под
// защитой»). New here: the peephole card on the dark landing, the backpack checklist, the change of clothes in a puff, the
// stairwell in section with the floor counter, the neighbour's door creaking open on the 15th floor and баба Валя with
// her frying pan, the choice «вниз или на крышу».
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, fill, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { view, toScreen, scaleOf } from './camera.js';
import * as Hd from './hud.js';
import * as Ap from './apt.js';
import * as Ld from './landing.js';
import { drawHunter, framesOf } from './hunter.js';
import { drawDog } from './dog.js';
import { text, measure, FONTS, INK } from './type.js';

// —— the narration: line starts, ends and word starts (A.L2w5 = word 5 of line L2; dashes count as words) ——
const VOICE = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/words.json', import.meta.url))); } catch { return null; } })();
const LN = id => VOICE?.lines.find(l => l.id === id);
const FB = { L0: [0.12, 3.74, 9], L1: [4.09, 5.79, 6], L2: [6.24, 9.89, 7], L3: [10.29, 13.55, 7], L4: [13.95, 17.59, 11], L5: [18.04, 22.85, 12], L6: [23.3, 27.58, 14], L7: [27.93, 32.8, 14] };
export const DUR = VOICE?.dur ?? 33.15;
const A = {};
for (const id of Object.keys(FB)) {
  const ws = LN(id)?.words, n = ws ? ws.length : FB[id][2];
  A[id] = LN(id)?.at ?? FB[id][0]; A[id + 'e'] = LN(id)?.end ?? FB[id][1];
  for (let i = 0; i < Math.max(n, FB[id][2]); i++) A[id + 'w' + i] = ws ? ws[Math.min(i, n - 1)].s : lerp(FB[id][0], FB[id][1], i / FB[id][2]);
}
const SUBS = VOICE ? VOICE.lines.flatMap(l => Hd.phrases(l.words, 6, 24, Array.isArray(l.sub) ? l.sub : null)) : [];
const DANGER = Hd.NIGHT.danger, GOLD = Hd.NIGHT.gold, OK = Hd.NIGHT.ok, WARM = Hd.NIGHT.warm;
const HOT = { УХОДИМ: GOLD, ЭТАЖЕЙ: DANGER, СТОНЕТ: DANGER, РЮКЗАК: GOLD, ПЛОТНО: GOLD, ЛЕСТНИЦЕ: GOLD, ЛОВУШКЕ: DANGER,
  СКРИПНУЛА: DANGER, ВАЛЯ: WARM, СКОВОРОДКОЙ: WARM, ТРОЕ: OK, КРЫШУ: GOLD, СОБОЙ: GOLD, ПОДПИСЫВАЙСЯ: GOLD };

// —— the shots ——
const T = {
  cover: 0.3,
  ward: A.L0w1 - 0.1,                // «уходим»: the wardrobe pulled back
  floors: A.L0w7 - 0.06,             // «двадцать этажей»
  c1: A.L1 - 0.06,                   // «А в подъезде кто-то уже стонет»: the peephole
  c2: A.L2 - 0.06,                   // step 1: the backpack
  c3: A.L3 - 0.06,                   // step 2: dressed
  puff: A.L3w1 - 0.08,
  c4: A.L4 - 0.06,                   // step 3: the landing, not the lift
  lift: A.L4w4 - 0.06,               // «Лифт может застрять»
  stairs: A.L4w8 - 0.06,             // «…и ты в ловушке»: down the stairs
  c5: A.L5w3 - 0.15,                 // «скрипнула дверь»: the 15th floor
  granny: A.L5w5 - 0.06,             // «Но это соседка, баба Валя»
  pan: A.L5w10 - 0.06,               // «Со сковородкой»
  c6: A.L6 - 0.06,                   // «Теперь вас трое»
  choice: A.L6w3 - 0.06,             // «Вниз через подъезд или наверх, на крышу?»
  c7: A.L7 - 0.06,
};
export const CUTS = [T.cover, T.c2, T.c4, T.stairs, T.c5, T.c6];
export const SNAPS = [T.puff];
export const MARKS = { ...T, A };
const seg = (a, b, t, e = ease.inOut) => e(clamp((t - a) / (b - a)));
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const S = 0.6, LEG = 137, DS = 0.7;
const scene = t => (t < T.cover ? 'cover' : t < T.c4 ? 'hall' : t < T.stairs ? 'land20' : t < T.c5 ? 'stairs' : 'land15');

const HALL = { x0: 900, x1: 1600 };
const DOOR = { x0: 1300, x1: 1470, top: -560 };
const WARD = { x0: 990, w: 200, h: 560 };
// the stairwell: per floor a landing 300 long, then a flight 600 long dropping 400
const FL = { land: 300, run: 600, drop: 400 };
const stairY = x => { const j = Math.floor(x / (FL.land + FL.run)), l = x - j * (FL.land + FL.run); return j * FL.drop + (l < FL.land ? 0 : (l - FL.land) * FL.drop / FL.run); };
const floorAt = x => 20 - Math.floor((x + 60) / (FL.land + FL.run));

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
// the ground at about y 1170 on screen, so the subtitles sit below the action: cam.y = −210 / z
shot(T.cover, [[T.cover, 1180, -170, 1.24], [T.c1, 1220, -165, 1.27], [T.c2, 1240, -162, 1.3]]);
shot(T.c2, [[T.c2, 1150, -170, 1.24], [T.c3, 1160, -168, 1.25], [T.c4, 1170, -165, 1.27]]);
shot(T.c4, [[T.c4, -260, -175, 1.2], [T.lift, -340, -168, 1.25], [T.stairs, -360, -165, 1.27]]);
shot(T.c5, [[T.c5, 240, -175, 1.2], [T.granny, 260, -170, 1.24], [T.c6, 250, -168, 1.25]]);
shot(T.c6, [[T.c6, 200, -180, 1.17], [DUR, 210, -178, 1.18]]);
// the stairs: the camera rides with him
const walkX = t => lerp(0, 5 * (FL.land + FL.run) - 200, seg(T.stairs, T.c5, t, u => u));
export function camAt(t) {
  if (scene(t) === 'stairs') {
    const x = walkX(t), y = stairY(x);
    let dx = 0, dy = 0;
    return { x: x + 120, y: y - 180, z: 1.15, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
  }
  let sh = SHOTS[0];
  for (const s of SHOTS) if (t >= s.t0) sh = s;
  const [x, y, z] = hermite(sh.keys, t);
  let dx = 0, dy = 0;
  for (const [t0, a] of [[T.c1 + 0.3, 6], [T.puff, 8], [T.c5, 5], [T.pan, 7]]) if (t >= t0 && t < t0 + 0.6) { const e = Math.exp(-(t - t0) * 7); dx += a * e * noise(t * 40, 1); dy += a * e * noise(t * 37, 2); }
  return { x, y, z, lens: 1, tx: 0, ty: 0, dx, dy, r: 0 };
}

// —— the people ——
const blinkAt = t => { const u = (t + 0.4) % 3.3; return u < 0.14 ? bump(u / 0.14) : 0; };
const dblink = t => { const u = (t + 1.7) % 2.9; return u < 0.12 ? bump(u / 0.12) : 0; };
const dressed = t => t >= T.puff + 0.12;
const base = (t, extra = {}) => {
  const d = dressed(t);
  return { s: S, face: 1, lean: 0.04, headTilt: 0.04, brow: 0, pop: 0, lid: 0.25, blink: blinkAt(t), look: [0.5, 0], mouth: 0,
    jacket: d, boots: d, pack: d, hat: d, ...extra };
};
function stand(o, x, y = 0) { const k = (o.s ?? S) / S; o.hip = [x, y - LEG * k]; o.feet = { near: [x - 12 * k, y], far: [x + 16 * k, y] }; return o; }
const shoulder = o => framesOf(o).T.p([-14, -192]);
const headOf = o => framesOf(o).H.p([0, -60]);
const packed = t => [A.L2w3, A.L2w4, A.L2w5, A.L2w6].map(w => clamp((t - w + 0.05) / 0.25));

export function actorsAt(t) {
  const sc = scene(t);
  if (sc === 'cover') return {};
  // S1 · the hall: «уходим» — he pulls the wardrobe back from the door; at the peephole
  if (t < T.c2) {
    const pull = seg(T.ward, T.ward + 0.8, t);
    let o;
    if (t < T.c1) {
      o = stand(base(t, { face: -1, look: [0.6, 0], brow: 0.6 }), lerp(1300, 1010, pull));
      const sh = shoulder(o);
      o.lean = pull > 0 && pull < 1 ? -0.25 : 0.04;
      o.hands = { near: { p: [sh[0] - 60, sh[1] + 70], shape: 'grip' }, far: { p: [sh[0] - 50, sh[1] + 90], shape: 'grip' } };
    } else {
      o = stand(base(t, { face: 1, look: [0.9, -0.1], brow: 0.9, pop: 0.6 * bump(seg(T.c1 + 0.3, T.c1 + 1.5, t)) }), DOOR.x0 - 60);
      o.lean = 0.2;
      o.hands = { near: { p: [DOOR.x0 + 10, -380], shape: 'open' } };
    }
    const d = { x: 1120, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: t > T.c1 ? 1 : 0.5, mouth: t > T.c1 + 0.4 ? 0.25 : 0, look: 0.2 };
    return { h: o, d, ward: 1 - pull, peep: t >= T.c1 };
  }
  // S2 · step 1: the backpack on the floor, the four things into it; zipped
  if (t < T.c3) {
    const o = stand(base(t, { face: -1, look: [0.6, 0.6], brow: 0.3 }), 1250);
    o.lean = 0.35; const sh = shoulder(o), p = packed(t), n = p.filter(v => v > 0.5).length;
    o.hands = { near: { p: [sh[0] - 60 - 10 * Math.sin(t * 8), sh[1] + 120], shape: 'grip' } };
    return { h: o, d: { x: 980, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 1, look: 0.2 }, ward: 0, bag: { x: 1110, fill: n / 4, zip: seg(A.L2e - 0.1, A.L2e + 0.5, t) } };
  }
  // S3 · step 2: a puff — boots, jacket, the hat, the pack on his back
  if (t < T.c4) {
    const o = stand(base(t, { face: -1, look: [0.6, 0], brow: 0.5 }), 1200);
    if (dressed(t)) { const k = clamp(sp(t, T.puff + 0.1, 2.4, 7)); o.headTilt = -0.05; const sh = shoulder(o); o.hands = { far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
    return { h: o, d: { x: 980, y: 0, s: DS, face: 1, sit: 1, t, blink: dblink(t), ears: 1, look: 0.3 }, ward: 0, bag: dressed(t) ? null : { x: 1110, fill: 1, zip: 1 }, puff: t - T.puff };
  }
  // S4 · step 3: the landing on the 20th floor; the lift is a trap — the stairs
  if (sc === 'land20') {
    const o = stand(base(t, { face: -1, look: [0.7, -0.1], brow: 0.6 }), -280);
    if (t > T.lift) { const sh = shoulder(o), k = clamp(sp(t, T.lift, 2.4, 7)); o.hands = { near: { p: [sh[0] - 80 * k, sh[1] + 40 - 30 * k], shape: 'point' } }; }
    return { h: o, d: { x: -60, y: 0, s: DS, face: -1, sit: 1, t, blink: dblink(t), ears: 1, look: 0.2 }, liftX: t > T.lift };
  }
  // S5 · down the stairs, floor after floor
  if (sc === 'stairs') {
    const x = walkX(t), y = stairY(x), ph = x / 70;
    const o = base(t, { face: 1, look: [0.7, 0.4], brow: 0.5, lean: 0.12 });
    o.hip = [x, y - LEG + 6 * Math.abs(Math.sin(ph))];
    const fa = x + 26 * Math.sin(ph), fb = x - 26 * Math.sin(ph);
    o.feet = { near: [fa, stairY(fa) - 10 * Math.max(0, Math.cos(ph))], far: [fb, stairY(fb) - 10 * Math.max(0, -Math.cos(ph))] };
    const dx = x - 170;
    return { h: o, d: { x: dx, y: stairY(dx), s: DS, face: 1, walk: 1, ph: x / 150, t, blink: dblink(t), mouth: 0.4, tongue: 0.4 } };
  }
  // S6 · the 15th floor: the neighbour's door creaks open — it's баба Валя, with a frying pan; S7–S8 · the three of you
  const open = seg(T.c5 + 0.1, T.granny, t, u => u * u);
  const out = seg(T.granny, T.granny + 0.6, t);
  const o = stand(base(t, { face: 1, look: [0.8, 0], brow: t < T.granny ? 1 : 0.2, pop: t < T.granny ? 0.8 * bump(seg(T.c5, T.granny, t)) : 0, mouth: t > T.granny + 0.4 && t < T.pan ? 0.3 : 0.1 }), 20);
  if (t > T.c6) { const sh = shoulder(o), k = clamp(sp(t, T.c6, 2.4, 7)); o.hands = { far: { p: [sh[0] + 70 * k, sh[1] - 40 * k + 40], shape: 'thumb', ang: -Math.PI / 2 } }; }
  const gr = out > 0 ? { x: lerp(Ld.NDOOR.x0 + 130, 360, out), y: 0, s: 0.62, face: -1, t, smile: 0.8, look: -1, reach: t > T.pan ? [90, -560 - 20 * bump(seg(T.pan, T.pan + 0.4, t))] : [70, -240], pan: t > T.pan - 0.2 } : null;
  const growl = t < T.granny + 0.3;
  const d = { x: 190, y: 0, s: DS, face: 1, sit: growl ? 0 : 1, t, blink: dblink(t), ears: 1, mouth: growl ? 0.35 : 0.6, tongue: growl ? 0 : 0.7, wag: growl ? 0 : 1, wagPh: t * 3, brow: growl ? -0.7 : null };
  return { h: o, d, gr, nOpen: t < T.granny ? 0.02 + 0.5 * open : 1, growl };
}

function hunterDraw(t, o) {
  o = { ...o };
  const p = o.prop;
  if (p?.kind === 'phone') o.propNear = () => { g.save(); g.translate(p.p[0], p.p[1]); g.rotate(0.35); rrect(-16, -30, 32, 60, 7, '#24232f'); rrect(-12, -25, 24, 48, 4, '#5a7fa8'); g.restore(); };
  if (o.lying) {                                      // flat on his back on the mattress, head to the left
    const [hx, hy] = o.hip;
    g.save(); g.translate(hx, hy + LEG - 62); g.rotate(-Math.PI / 2); g.translate(-hx, -hy);
    drawHunter(o); g.restore();
    return;
  }
  drawHunter(o);
}


function hall(t, a) {
  const { x0, x1 } = HALL;
  rect(x0 - 4, Ap.ROOM.ceil, x1 - x0 + 4, -Ap.ROOM.ceil, '#e2d3b4');
  for (let y = Ap.ROOM.ceil + 40; y < 0; y += 90) for (let x = x0 + 40; x < x1; x += 90) ell(x, y, 4, 4, '#d1bf99');
  rect(x0 - 4, Ap.ROOM.ceil, x1 - x0 + 4, 24, '#f1ebdd'); rect(x0 - 4, -30, x1 - x0 + 4, 30, '#d3c19e');
  rect(x1, Ap.ROOM.ceil - Ap.ROOM.slab, 60, -Ap.ROOM.ceil + Ap.ROOM.slab + 110, '#3c3f52');
  rect(x0 - 4, Ap.ROOM.ceil - Ap.ROOM.slab, x1 - x0 + 64, Ap.ROOM.slab, '#3c3f52');
  rect(x0 - 4, 0, x1 - x0 + 64, Ap.ROOM.slab + 40, '#3c3f52'); rect(x0 - 4, 0, x1 - x0 + 64, 10, '#2c2e3e');
  rect(x0 - 14, Ap.ROOM.ceil, 28, -Ap.ROOM.ceil, '#d3c19e');          // the corner between kitchen and hall
  // the front door: steel, the peephole, two locks, the light from the landing in the gap under it
  const { x0: d0, x1: d1, top } = DOOR;
  rect(d0 - 18, top - 18, d1 - d0 + 36, -top + 18, '#4a4038');
  rrect(d0, top, d1 - d0, -top - 6, 4, '#6b5240');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) fill(polyPath([[d0 + 42 + c * 86, top + 60 + r * 130], [d0 + 72 + c * 86, top + 100 + r * 130], [d0 + 42 + c * 86, top + 140 + r * 130], [d0 + 12 + c * 86, top + 100 + r * 130]]), '#5a4434');
  ell((d0 + d1) / 2, top + 130, 10, 10, '#2a2d38');
  const kt = a.keyTurn ?? 0;
  for (const y of [-330, -240]) { rrect(d0 + 18, y - 18, 30, 36, 6, '#c9d0d6'); g.save(); g.translate(d0 + 33, y); g.rotate(kt * Math.PI / 2); rect(-3, -10, 6, 20, '#5a6370'); g.restore(); }
  rrect(d0 + 10, -296, 56, 14, 7, '#c9d0d6');
  // the wardrobe: it slides right across the door (k 0…1)
  const k = a.ward ?? 0, wx = WARD.x0 + 300 * ease.out(clamp(k));
  rect(wx, -WARD.h, WARD.w, WARD.h - 26, '#9d6c43'); rect(wx + WARD.w - 18, -WARD.h, 18, WARD.h - 26, '#7a5434');
  rect(wx + WARD.w / 2 - 2, -WARD.h + 20, 4, WARD.h - 60, '#7a5434');
  for (const dx of [-24, 16]) rrect(wx + WARD.w / 2 + dx, -WARD.h / 2 - 30, 8, 60, 4, '#d9c8a5');
  rect(wx - 4, -WARD.h - 14, WARD.w + 8, 16, '#7a5434');
  // the light from the landing in the gap under the door, seen between the wardrobe's legs; shadows of feet pass in it
  rect(d0, -14, d1 - d0, 14, rgba('#ffe7a8', 0.95)); ell((d0 + d1) / 2, -4, (d1 - d0) * 0.7, 26, 'rgba(255,231,168,0.18)');
  if (a.shadows) for (let i = 0; i < 2; i++) { const u = ((t * 0.45 + i * 0.5) % 1); rect(lerp(d0 - 40, d1, u), -14, 40, 14, '#2a2520'); }
  rect(wx, -WARD.h, WARD.w, WARD.h - 26, 'rgba(0,0,0,0)');
  for (const lx of [wx + 6, wx + WARD.w - 26]) rect(lx, -26, 20, 26, '#5e3f25');
  if (k > 0.02 && k < 0.98) for (let i = 0; i < 3; i++) limb([[wx - 30 - i * 26, -40 - i * 40], [wx - 70 - i * 26, -40 - i * 40]], 5, 'rgba(60,40,30,0.4)', false);
}

function lieDog(d) { if (!d.lie) return d; return { ...d, sit: lerp(1, 0, d.lie), y: (d.y ?? 0) + 62 * d.lie, clip: true }; }

// —— the stairwell in section: concrete flights and landings, the dado line, the floor numbers, the railing ——
function stairwell(t, cam) {
  const half = W / 2 / cam.z + 200, x0 = cam.x - half, x1 = cam.x + half;
  rect(x0, cam.y - 1200, x1 - x0, 2600, '#d9d4c4');
  // the green paint below a line parallel to the stairs
  const pts = []; for (let x = x0; x <= x1 + 40; x += 40) pts.push([x, stairY(Math.max(0, x)) - 330]);
  fill(polyPath([...pts, [x1 + 40, cam.y + 1400], [x0, cam.y + 1400]]), '#7d9a8c');
  limb(pts, 10, '#5d7a6c', false);
  for (let j = 0; j < 7; j++) {
    const lx = j * (FL.land + FL.run), ly = j * FL.drop, f = 20 - j;
    if (lx + FL.land + FL.run < x0 - 200 || lx > x1 + 200) continue;
    // the floor number stencilled on the wall, a lamp
    Hd.label(String(f), lx + 150, ly - 380, 150, '#3c3f52', { fam: FONTS.block, shadow: false, stroke: false });
    ell(lx + 150, ly - 640, 40, 12, '#fff2c4'); ell(lx + 150, ly - 560, 260, 120, 'rgba(255,240,190,0.10)');
    // the landing slab and the flight down to the next one: steps, the stringer under them
    rect(lx - 20, ly, FL.land + 40, 50, '#9a9486'); rect(lx - 20, ly, FL.land + 40, 8, '#7d776b');
    const n = 12, sx = FL.run / n, sy = FL.drop / n, st = [];
    for (let i = 0; i < n; i++) { const xa = lx + FL.land + i * sx, ya = ly + i * sy; st.push([xa, ya], [xa + sx, ya]); st.push([xa + sx, ya + sy]); }
    fill(polyPath([...st, [lx + FL.land + FL.run, ly + FL.drop + 50], [lx + FL.land, ly + 50]]), '#a8a294');
    limb([[lx + FL.land, ly + 50], [lx + FL.land + FL.run, ly + FL.drop + 50]], 14, '#7d776b', false);
    // the railing: a handrail parallel to the flight, balusters
    const rl = [[lx, ly - 230], [lx + FL.land, ly - 230], [lx + FL.land + FL.run, ly + FL.drop - 230]];
    for (let x = lx + 20; x < lx + FL.land + FL.run; x += 60) limb([[x, stairY(x) - 230 + (x > lx + FL.land ? 0 : 0)], [x, stairY(x)]], 5, '#4a4f5c', false);
    limb(rl, 12, '#8a5a32', false);
  }
}
// the cartoon puff of a quick change of clothes
function puffCloud(p, u) {
  if (u < 0 || u > 0.7) return;
  const k = clamp(u / 0.7);
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9, r = 60 + 140 * k; ell(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.8, 70 * (1 - k * 0.6), 60 * (1 - k * 0.6), '#f4f1ea', 0, 1 - k); }
  ell(p[0], p[1], 160 * (1 - k), 200 * (1 - k), '#f4f1ea', 0, 1 - k);
}
// the backpack on the floor: it bulges as things go in; zipped shut
function bagAt(b) {
  const x = b.x, h = 120 + 60 * b.fill, w = 130 + 30 * b.fill;
  fill(smoothPath([[x - w / 2, 0], [x - w / 2 - 6, -h * 0.6], [x - w / 2 + 16, -h], [x + w / 2 - 16, -h], [x + w / 2 + 6, -h * 0.6], [x + w / 2, 0]]), '#3e6b45');
  rrect(x - w / 2 + 20, -h * 0.5, w - 40, h * 0.35, 12, '#2f5636');
  limb([[x - w / 2 + 20, -h + 8], [lerp(x - w / 2 + 20, x + w / 2 - 20, b.zip), -h + 8]], 6, '#c9d0d6', false);
  if (b.zip < 1) ell(x, -h + 4, w / 2 - 16, 12, '#1e2a20');
}
function panAt(p) { g.save(); g.translate(p[0], p[1]); g.rotate(-0.5); ell(0, -50, 46, 46, '#2a2a30'); ell(0, -50, 34, 34, '#3c3c44'); rrect(-8, -8, 16, 80, 6, '#5a3a24'); g.restore(); }

// —— frame ——
let DK = null, dk = null;
export function init() { DK = createCanvas(W, H); dk = DK.getContext('2d'); Hd.initHud(); }
export function frame(t) {
  if (scene(t) === 'cover') { coverFrame(t); Hd.finish(t); return; }
  const cam = camAt(t), sc = scene(t);
  const a = actorsAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  let dark = 0.35;
  if (sc === 'hall') { Ap.drawShell(t, { power: true, lampOn: false }); Ap.drawWindow(t, { day: 1 }); Ap.drawFridge(t); Ap.drawCounter(t, { fills: [1, 1, 1, 1, 1] }); hall(t, a); if (a.bag) bagAt(a.bag); }
  else if (sc === 'land20') { Ld.drawLanding(t, { dark: true }); Ld.drawDoor(t, { open: 0 }); dark = 0.4; }
  else if (sc === 'stairs') { stairwell(t, cam); dark = 0.45; }
  else { Ld.drawLanding(t, { dark: true, nOpen: a.nOpen, nNum: '61' }); door15(); dark = 0.4; }
  if (a.d && sc !== 'stairs') drawDog(a.d);
  if (a.h) hunterDraw(t, a.h);
  if (a.d && sc === 'stairs') drawDog(a.d);
  if (a.gr) { Ld.drawGranny(a.gr); if (a.gr.pan) { const r = a.gr.reach; panAt([a.gr.x + a.gr.s * a.gr.face * r[0], a.gr.s * r[1]]); } }
  if (sc === 'land20' && a.liftX) { const p = toScreen(cam, [(Ld.LIFT.x0 + Ld.LIFT.x1) / 2, -300]); Hd.redX(p[0], p[1], 110, sp(t, T.lift, 2.6, 8)); }
  // dim light everywhere, a little brighter round the lamp and the people
  g.setTransform(1, 0, 0, 1, 0, 0);
  dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, W, H);
  dk.fillStyle = `rgba(10,14,28,${dark})`; dk.fillRect(0, 0, W, H); dk.globalCompositeOperation = 'destination-out';
  const hole = (p, r, k) => { const [x, y] = toScreen(cam, p), rr = r * scaleOf(cam); const gr = dk.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); dk.fillStyle = gr; dk.beginPath(); dk.arc(x, y, rr, 0, TAU); dk.fill(); };
  if (a.h) hole([a.h.hip[0] + 40, a.h.hip[1] - 120], 520, 0.6);
  if (a.gr) hole([a.gr.x, -300], 360, 0.5);
  g.drawImage(DK, 0, 0);
  if (a.puff !== undefined && a.h) { view(cam, 1); puffCloud([a.h.hip[0], a.h.hip[1] - 120], a.puff); }
  overlays(t, cam, a);
  if (a.peep) peepCard(t);
  Hd.karaoke(t, SUBS, HOT);
  Hd.finish(t, 0.8);
}
function door15() {
  const D = Ld.DOOR;
  rect(D.x0 - 22, D.top - 22, D.x1 - D.x0 + 44, -D.top + 22, '#3e3a3a'); rrect(D.x0, D.top, D.x1 - D.x0, -D.top, 4, '#5e5248');
  rrect(-30, D.top + 48, 60, 44, 6, '#e9e4d6'); Hd.label('60', 0, D.top + 82, 30, '#2c2c34', { fam: FONTS.mono, shadow: false, stroke: false }); ell(104, -280, 12, 12, '#c9d0d6');
}

// —— the peephole: a round fish-eye view of the dark landing; the moan comes from below ——
function peepCard(t) {
  const k = clamp(sp(t, T.c1 + 0.15, 2.4, 8)) * (1 - seg(T.c2 - 0.3, T.c2 - 0.05, t));
  if (k <= 0.01) return;
  const cx = 540, cy = 700, r = 330 * lerp(0.9, 1, k);
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = clamp(k * 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 40; ell(cx, cy, r + 18, r + 18, '#1b1e29'); g.restore();
  inside(rrPath(cx - r, cy - r, 2 * r, 2 * r, r), () => {
    g.save(); g.translate(cx, cy + 120); g.scale(0.5, 0.5); g.translate(0, 0);
    Ld.drawLanding(t, { dark: true });
    g.restore();
    const gr = g.createRadialGradient(cx, cy, r * 0.3, cx, cy, r); gr.addColorStop(0, 'rgba(5,8,16,0.25)'); gr.addColorStop(1, 'rgba(5,8,16,0.95)');
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  });
  g.lineWidth = 10; g.strokeStyle = '#0b0d14'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
  // the arrow to the stairwell going down: the sound comes from there
  const u = (t * 1.4) % 1;
  for (let i = 0; i < 3; i++) { const yy = cy + 40 + i * 50 + 20 * u; limb([[cx + 150, yy], [cx + 190, yy + 30], [cx + 230, yy]], 10, rgba('#ff5a4f', 0.9 - i * 0.25), false); }
  g.restore();
  Hd.plaque(t, T.c1 + 0.35, T.c2 - 0.1, 540, 1110, { icon: 'x', title: 'СТОНЫ ИЗ ПОДЪЕЗДА', sub: 'где-то ниже', color: DANGER });
}

// —— everything over the picture ——
function floorBadge(t) {
  if (t < T.floors || t > T.c6 + 0.3) return;
  const sc = scene(t);
  const f = sc === 'stairs' ? floorAt(walkX(t)) : sc === 'land15' ? 15 : 20;
  const k = clamp(sp(t, T.floors, 2.6, 8)) * (1 - seg(T.c6, T.c6 + 0.3, t));
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = k;
  const x = 1020, y = 150, w = 250, h = 110;
  rrect(x - w, y - h / 2, w, h, 18, 'rgba(11,15,26,0.88)');
  g.save(); g.lineWidth = 3; g.strokeStyle = GOLD; g.stroke(rrPath(x - w + 1.5, y - h / 2 + 1.5, w - 3, h - 3, 17)); g.restore();
  Hd.label('ЭТАЖ', x - w / 2, y - 18, 26, '#c9d6ea', { fam: FONTS.mono, shadow: false, stroke: false });
  Hd.label(String(f), x - w / 2, y + 38, 58, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  g.restore();
}
function checklist(t) {
  if (t < T.c2 + 0.1 || t > T.c3 + 0.2) return;
  const k = clamp(sp(t, T.c2 + 0.1, 2.4, 8)) * (1 - seg(T.c3 - 0.1, T.c3 + 0.2, t)), p = packed(t);
  const rows = [['drop', 'ВОДА'], ['can', 'ЕДА'], ['medkit', 'АПТЕЧКА'], ['torch', 'ФОНАРИК']];
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = clamp(k * 2); g.translate(540, 620); g.rotate(-0.03); g.scale(lerp(0.94, 1, clamp(k)), lerp(0.94, 1, clamp(k)));
  const w = 700, rh = 92, hh = 70 + rows.length * rh;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rrect(-w / 2, -hh / 2, w, hh, 16, Hd.NIGHT.paper); g.restore();
  Hd.label('В РЮКЗАК', -w / 2 + 34, -hh / 2 + 52, 34, '#5a6a86', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  rows.forEach(([ic, s], i) => {
    const y = -hh / 2 + 60 + i * rh + rh / 2, v = p[i];
    g.save(); g.translate(-w / 2 + 60, y); Hd.icon(ic, 26, v > 0.5 ? '#2f8f4e' : '#2a3346'); g.restore();
    Hd.label(s, -w / 2 + 120, y + 14, 44, '#1d2433', { align: 'left', shadow: false, stroke: false, a: 0.4 + 0.6 * v });
    if (v > 0.01) { const z = lerp(1.6, 1, v) * Math.min(1, v * 4); g.save(); g.translate(w / 2 - 70, y); g.scale(z, z); ell(3, 4, 34, 34, INK); ell(0, 0, 34, 34, '#fff3d6'); limb([[-16, 1], [-4, 14], [18, -13]], 10, '#3e9a4a', false); g.restore(); }
  });
  g.restore();
}
function overlays(t, cam, a) {
  const S2 = p => toScreen(cam, p);
  Hd.timeStamp(t, T.cover + 0.15, T.c2 - 0.1, '07:40 — УТРО');
  floorBadge(t);
  if (t >= T.floors && t < T.c1) Hd.plaque(t, T.floors + 0.1, T.c1 - 0.02, 540, 330, { icon: 'stairs', title: '20 ЭТАЖЕЙ ВНИЗ', sub: 'а лифт — не вариант', color: GOLD });
  // step 1
  Hd.stepHeader(t, 1, 'РЮКЗАК', A.L2 + 0.02, A.L2e - 0.05);
  checklist(t);
  // step 2
  Hd.stepHeader(t, 2, 'ОДЕНЬСЯ ПЛОТНО', A.L3 + 0.02, A.L3e - 0.05);
  if (t >= T.c3 && t < T.c4 && a.h) {
    const o = a.h, fr = framesOf(o);
    Hd.plaque(t, A.L3w3 - 0.05, T.c4 - 0.02, 300, 1060, { title: 'БОТИНКИ', color: GOLD, size: 36, to: S2(o.feet.near) });
    Hd.plaque(t, A.L3w4 - 0.05, T.c4 - 0.02, 270, 700, { title: 'КУРТКА', color: GOLD, size: 36, to: S2(fr.T.p([0, -120])) });
    Hd.plaque(t, A.L3w6 - 0.05, T.c4 - 0.02, 810, 860, { title: 'ПЕРЧАТКИ', color: GOLD, size: 36, to: S2(shoulder(o).map((v, i) => v + [60, 150][i])) });
  }
  // step 3
  Hd.stepHeader(t, 3, 'ТОЛЬКО ЛЕСТНИЦА', A.L4 + 0.02, A.L4e - 0.05);
  if (t >= T.lift && t < T.stairs) Hd.plaque(t, T.lift + 0.3, T.stairs - 0.02, 540, 640, { icon: 'x', title: 'ЛИФТ — ЛОВУШКА', sub: 'может застрять', color: DANGER });
  // the twist
  if (t >= T.granny && t < T.c6) Hd.plaque(t, T.granny + 0.2, T.c6 - 0.02, 540, 330, { icon: 'check', title: 'БАБА ВАЛЯ', sub: 'со сковородкой', color: WARM });
  // the choice
  if (t >= T.choice) {
    [['1', 'ВНИЗ', '↓'], ['2', 'НА КРЫШУ', '↑']].forEach(([n, s, ar], i) => {
      const t0 = T.choice + i * 0.6, k = clamp(sp(t, t0, 2.6, 8)) * (1 - seg(T.c7 + 0.6, T.c7 + 1.0, t));
      if (k <= 0.01) return;
      const x = 300 + i * 480, y = 1070, w = measure(s, 50, FONTS.cond) + 130;
      g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.03 + 0.06 * i);
      rrect(-w / 2 + 6, -44 + 6, w, 88, 18, INK); rrect(-w / 2, -44, w, 88, 18, '#fff3d6');
      ell(-w / 2 + 50, 0, 30, 30, '#ffd23f'); text(n, -w / 2 + 50, 18, 46, INK, { fam: FONTS.block, shadow: false });
      text(s, 30, 18, 50, INK, { fam: FONTS.cond, shadow: false });
      g.restore();
    });
  }
  if (t >= T.c7) Hd.plaque(t, A.L7w1 - 0.1, DUR + 1, 540, 620, { icon: 'comment', title: '«ВОЗЬМИ С СОБОЙ»', sub: 'и в серии 3 ты с нами', color: GOLD, size: 52 });
  Hd.endCard(t, A.L7w12 - 0.1, 0, 300);
}

// —— the poster: the three on the landing, the neighbour's door ajar, the title ——
function coverFrame(t) {
  const cam = { x: 230, y: -175, z: 1.2, lens: 1, tx: 0, ty: 0, dx: 0, dy: 0, r: 0 };
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H);
  view(cam, 1);
  Ld.drawLanding(1, { dark: true, nOpen: 0.45, nNum: '61' }); door15();
  drawDog({ x: 190, y: 0, s: DS, face: 1, sit: 0, t: 0, ears: 1, mouth: 0.35, brow: -0.7 });
  const o = stand(base(T.c3 + 1, { face: 1, look: [0.9, 0], brow: 1, pop: 1, mouth: 0.3, blink: 0 }), 20);
  drawHunter(o);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(10,14,28,0.35)'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(1020, 200); g.rotate(-0.035);
  const tag = 'КАК ВЫЖИТЬ', tw = measure(tag, 52, FONTS.cond) + 56;
  rect(-tw + 6, -40 + 7, tw, 76, INK); rect(-tw, -40, tw, 76, '#ff4d4d'); text(tag, -tw / 2, 18, 52, '#fff3d6', { fam: FONTS.cond, shadow: false });
  g.restore();
  g.save(); g.translate(540, 1240);
  g.save(); g.shadowColor = 'rgba(122,214,90,0.8)'; g.shadowBlur = 40; Hd.label('УХОДИМ', 0, 0, 170, '#8fdc6a', { shadow: false, strokeW: 12 }); g.restore();
  const pl = 'ЗАРАЖЕНИЕ · СЕРИЯ 2', pw = measure(pl, 48, FONTS.cond) + 60;
  rect(-pw / 2 + 8, 50 + 8, pw, 84, INK); rect(-pw / 2, 50, pw, 84, '#ffd43b'); text(pl, 0, 108, 48, '#111111', { fam: FONTS.cond, shadow: false });
  g.restore();
}

// how far things move on screen around t (for the number of motion-blur sub-frames)
export function motion(t, h = 1 / 240) {
  if (t < T.cover) return 0;
  let t0 = t - h, t1 = t + h;
  for (const c of [...CUTS, ...SNAPS]) { if (t >= c && t0 < c) { t0 = c; t1 = c + 2 * h; } else if (t < c && t1 >= c) { t1 = c - 1e-6; t0 = t1 - 2 * h; } }
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
  add(0.3, 'amb_flat', -26, 0, { dur: T.c4 - 0.3 });
  add(T.ward, 'scrape', -6, 0.2, { dur: 0.8 });
  add(T.floors, 'blip', -10, 0.3);
  add(T.c1 + 0.2, 'zombie_far', -4, 0.4, { dur: 1.8 });
  add(T.c1 + 0.2, 'heartbeat', -10, 0, { dur: T.c2 - T.c1 + 0.4, bpm: 104 });
  for (let i = 0; i < 4; i++) add([A.L2w3, A.L2w4, A.L2w5, A.L2w6][i] + 0.05, 'pop_word', -10, 0.1 * i);
  add(A.L2e - 0.1, 'zipper', -6, 0.2);
  add(T.puff, 'whoosh_in', -8, 0); add(T.puff + 0.1, 'stamp', -10, 0);
  add(T.c4, 'door_open', -8, 0.3, { dur: 1.2 });
  add(T.c4 + 0.3, 'zombie_crowd', -16, -0.3, { dur: T.c5 - T.c4 });
  add(T.lift, 'stamp', -6, -0.4);
  add(T.stairs, 'stair_steps', -6, 0, { dur: T.c5 - T.stairs + 0.2, rate: 4.2 });
  add(T.stairs, 'breath', -14, 0, { dur: T.c5 - T.stairs });
  add(T.c5, 'door_creak', -2, 0.5, { dur: T.granny - T.c5 + 0.2 });
  add(T.c5 + 0.1, 'heartbeat', -8, 0, { dur: T.granny - T.c5 + 0.3, bpm: 120 });
  add(T.c5 + 0.3, 'dog_growl', -10, -0.2, { dur: T.granny - T.c5 });
  add(T.granny + 0.2, 'ding', -12, 0.5);
  add(T.pan, 'pan_clang', -4, 0.5);
  add(T.c6 + 0.4, 'zombie_crowd', -18, 0, { dur: DUR - T.c6 - 0.4 });
  for (const t0 of [A.L2, A.L3, A.L4]) add(t0 + 0.04, 'pop_word', -8, 0);
  for (let i = 0; i < 2; i++) add(T.choice + i * 0.6, 'pop_word', -8, -0.3 + i * 0.6);
  add(A.L7w1 - 0.1, 'blip', -8, 0);
  add(A.L7w12, 'pop_word', -6, 0);
  return c.sort((a, b) => a.t - b.t);
}
