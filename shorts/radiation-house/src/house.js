// The izba as a cut-away, the front wall taken off: the room (log back wall with a window you see the lake through, the
// whitewashed Russian stove with its iron damper, a vent fan high on the wall, the door with a bolt, a table, the floor
// with a hatch) and, dug under the floor, the cellar (ladder, shelves of jars, bottled water, a crate, a lamp, the
// radio); around it the yard, the earth, the roof. Interior units: the floor's top is y = 0, the room spans x −900…900.
// What you see through the window is the world's FAR layer (sky, far shore, the plant), drawn first, so it moves with
// parallax; the back wall is a path with a hole.
import { g, poly, rect, rrect, ell, fill, limb, polyPath, smoothPath, rrPath, inside, Path2D } from './flat.js';
import { hash, lerp, clamp, mix, TAU, ease, shade, rgba } from './lib.js';
import { text, FONTS } from './type.js';
import { trefoil } from './world.js';

export const P = {
  log: '#9a6a40', logSh: '#7d5332', logHi: '#b47e4c', logEnd: '#c08a56', logRing: '#8a5a34',
  floor: '#7a5232', floorSh: '#5e3e25', floorHi: '#946642', earth: '#4a3526', earthSh: '#3b2a1f', earthHi: '#5c4330', stone: '#6b5d52',
  board: '#6b4a30', boardSh: '#563a25', shelf: '#8c5b38',
  white: '#efe6d6', whiteSh: '#d8ccb8', whiteDeep: '#bfb29c', iron: '#3a3a44', ironHi: '#5a5a66', fire: '#ff9a3c', fireHi: '#ffd27a',
  frame: '#f0e2c4', glass: '#cfe6f2', door: '#6e4527', doorSh: '#55341c', roof: '#5a3b2a', roofSh: '#46301f', grass: '#6f9150', grassSh: '#5a7a40',
  jarG: '#7fa84a', jarR: '#d9533b', jarY: '#e8b23a', lid: '#c9b27a', bottle: '#9fd0ea', bottleSh: '#6fb0d4', cap: '#2f6f9a',
  radio: '#4a3a33', radioHi: '#6b574c', dial: '#ffd27a', lamp: '#ffe9a8', crate: '#a8784a', crateSh: '#86592f', kit: '#f4f1ea', kitRed: '#e0453a',
  iodine: '#7a3f1c', iodineHi: '#a65a2a',
};
export const ROOM = { x0: -900, x1: 900, ceil: -720, slab: 60 };
export const WIN = { x: -330, y: -380, w: 300, h: 300 };
export const STOVE = { x: -730, w: 340, top: -600, mouth: [-800, -660, -330, -170] };     // mouth: x0, x1, y0, y1
export const FAN = { x: 130, y: -590, r: 58 };
export const DOOR = { x: 660, w: 200, top: -560 };
export const HATCH = { x0: -40, x1: 200 };
export const CEL = { x0: -440, x1: 540, y0: 60, y1: 640, floor: 610 };
export const LADDER = { top: [150, -6], bot: [30, 610], hw: 55 };
export const TABLE = { x: 410, y: -200, w: 200 };
export const SHELVES = [{ x0: 230, x1: 520, y: 250 }, { x0: 230, x1: 520, y: 400 }];
export const CRATE = { x: -300, w: 250, h: 130 };
export const STOOL = { x: -90, w: 96, h: 74 };
export const SWITCH = [FAN.x + 120, -330];

// —— outside: the yard's ground and the earth the cellar is dug into ——
export function drawGround(t) {
  rect(-4000, 0, 8000, 40, P.grass); rect(-4000, 24, 8000, 16, P.grassSh);
  rect(-4000, 40, 8000, 3000, P.earth);
  for (let i = 0; i < 70; i++) { const x = -3000 + i * 90 + 40 * hash(i), y = 120 + 900 * hash(i + 1); ell(x, y, 22 + 30 * hash(i + 2), 12 + 10 * hash(i + 3), i % 3 ? P.earthSh : P.earthHi, 0, 0.8); }
  for (let i = 0; i < 18; i++) { const x = -1600 + i * 190 + 60 * hash(i + 9), y = 180 + 600 * hash(i + 10); ell(x, y, 30, 22, P.stone, 0.3); }
}

// —— the room's back wall with the window hole, the roof and the side walls' log ends ——
export function drawRoomBack(t, o = {}) {
  const { x0, x1, ceil } = ROOM, { x: wx, y: wy, w: ww, h: wh } = WIN;
  // the roof over the cut-away
  poly([[x0 - 160, ceil + 10], [0, ceil - 520], [x1 + 160, ceil + 10]], P.roof);
  poly([[x0 - 160, ceil + 10], [0, ceil - 520], [0, ceil - 470], [x0 - 90, ceil + 10]], P.roofSh);
  rect(x0 - 40, ceil - 40, x1 - x0 + 80, 50, P.logSh);
  // the wall with a hole for the window (even-odd)
  const wall = new Path2D(); wall.rect(x0, ceil, x1 - x0, -ceil); wall.rect(wx - ww / 2, wy - wh / 2, ww, wh);
  g.save(); g.clip(wall, 'evenodd');
  rect(x0, ceil, x1 - x0, -ceil, P.log);
  for (let i = 0; i < 12; i++) { const y = ceil + i * 62; rect(x0, y + 46, x1 - x0, 16, P.logSh); rect(x0, y + 6, x1 - x0, 8, P.logHi); }
  // moss in the seams, a few knots
  for (let i = 0; i < 40; i++) { const x = x0 + 40 + hash(i + 5) * (x1 - x0 - 80), y = ceil + Math.floor(hash(i + 6) * 11) * 62 + 28; ell(x, y, 10 + 6 * hash(i + 7), 6, P.logSh, 0, 0.7); }
  g.restore();
  // side walls: the log ends of the cut
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const x = s < 0 ? x0 : x1, y = ceil + i * 62 + 31; ell(x, y, 30, 31, P.logEnd); ell(x, y, 18, 19, P.logRing); ell(x, y, 7, 7, P.logEnd); }
  // a ceiling beam
  rect(x0, ceil, x1 - x0, 40, P.logSh);
}

// —— the window: carved white frame, two glazed leaves (open 0 shut … 1 wide open), dust that hits the glass ——
export function drawWindow(t, o = {}) {
  const { x, y, w, h } = WIN, op = clamp(o.open ?? 0);
  // the frame and the carved top board (наличник)
  const fw = 26;
  rect(x - w / 2 - fw, y - h / 2 - fw, w + 2 * fw, fw, P.frame); rect(x - w / 2 - fw, y + h / 2, w + 2 * fw, fw, P.frame);
  rect(x - w / 2 - fw, y - h / 2, fw, h, P.frame); rect(x + w / 2, y - h / 2, fw, h, P.frame);
  poly([[x - w / 2 - 50, y - h / 2 - fw], [x, y - h / 2 - 90], [x + w / 2 + 50, y - h / 2 - fw]], P.frame);
  for (let i = 0; i < 5; i++) ell(x - 100 + i * 50, y - h / 2 - 34, 9, 9, P.whiteDeep);
  rect(x - w / 2 - 60, y + h / 2 + fw, w + 120, 22, P.frame);                       // the sill
  // the leaves, hinged at the sides; open, they swing into the room toward us (narrower)
  const leaf = (side) => {
    const hx = side < 0 ? x - w / 2 : x + w / 2, a = op * 1.35, lw = (w / 2) * Math.cos(a), dx = (w / 2) * Math.sin(a) * 0.25;
    if (lw < 2) return;
    const x0 = side < 0 ? hx : hx - lw;
    g.save(); g.translate(0, 0);
    const pts = side < 0 ? [[hx, y - h / 2], [hx + lw, y - h / 2 - dx], [hx + lw, y + h / 2 + dx], [hx, y + h / 2]]
      : [[hx, y - h / 2], [hx - lw, y - h / 2 - dx], [hx - lw, y + h / 2 + dx], [hx, y + h / 2]];
    fill(polyPath(pts), rgba(P.glass, 0.28 + 0.2 * op));
    limb([...pts, pts[0]], 16, P.frame, false);
    limb([[lerp(pts[0][0], pts[1][0], 0.5), lerp(pts[0][1], pts[1][1], 0.5)], [lerp(pts[3][0], pts[2][0], 0.5), lerp(pts[3][1], pts[2][1], 0.5)]], 10, P.frame, false);
    limb([[pts[0][0], y], [pts[1][0], y]], 10, P.frame, false);
    // a glint on the glass
    limb([[lerp(pts[0][0], pts[1][0], 0.2), y - h / 2 + 30], [lerp(pts[0][0], pts[1][0], 0.55), y - h / 2 + 80]], 8, rgba('#ffffff', 0.5), false);
    g.restore();
  };
  leaf(-1); leaf(1);
}
// specks of dust flying at the window from outside; shut (open < 0.1) they hit the glass and slide down
export function dustAtWindow(t, t0, shut, k = 1) {
  if (t < t0) return;
  const { x, y, w, h } = WIN;
  for (let i = 0; i < 18; i++) {
    const life = 1.3, u0 = ((t - t0) * 0.9 + hash(i + 40)) % 1, born = t - u0 * life;
    if (born < t0) continue;
    const sx = x + (hash(i + 41) - 0.5) * w * 0.9, sy = y + (hash(i + 42) - 0.5) * h * 0.8;
    const u = u0;
    let px, py, a;
    if (shut) { px = sx + 6 * Math.sin(u * 9 + i); py = sy + 60 * u * u; a = 1 - u; }
    else { px = sx - 260 * u; py = sy + 120 * u; a = 1 - u; }
    ell(px, py, 7 * k, 7 * k, '#ffd23f', 0, a);
    if (i % 5 === 0) trefoil(px, py, 6 * k, rgba('#17162f', a));
  }
}

// —— the Russian stove: whitewashed, a bench ledge, the arched mouth with embers; the iron damper slides in (shut 0…1) ——
export function drawStove(t, o = {}) {
  const { x, w, top } = STOVE, [mx0, mx1, my0, my1] = STOVE.mouth, sh = clamp(o.shut ?? 0);
  rect(x - w / 2, top, w, -top, P.white);
  rect(x - w / 2, top, 26, -top, P.whiteSh); rect(x + w / 2 - 30, top, 30, -top, P.whiteSh);
  rect(x - w / 2 - 20, top - 30, w + 40, 34, P.whiteSh);
  rect(x - 60, top - 260, 120, 230, P.white); rect(x - 60, top - 260, 20, 230, P.whiteSh); rect(x - 70, top - 270, 140, 24, P.whiteSh);   // the chimney
  rect(x - w / 2, -150, w, 22, P.whiteSh);                                                                                        // the shelf ledge
  // the arched mouth
  const mouth = new Path2D(); mouth.moveTo(mx0, my1); mouth.lineTo(mx0, my0 + 60); mouth.quadraticCurveTo(mx0, my0, (mx0 + mx1) / 2, my0); mouth.quadraticCurveTo(mx1, my0, mx1, my0 + 60); mouth.lineTo(mx1, my1); mouth.closePath();
  fill(mouth, '#2a1d18');
  inside(mouth, () => {
    for (let i = 0; i < 5; i++) ell(mx0 + 30 + i * 22, my1 - 10, 18, 12 + 6 * Math.sin(t * 6 + i), i % 2 ? P.fire : P.fireHi, 0, 0.9);
    ell((mx0 + mx1) / 2, my1, 70, 30, rgba(P.fire, 0.35 + 0.1 * Math.sin(t * 9)));
  });
  // the damper: an iron plate with a handle, leaning by the mouth, then put over it
  const { dx, dy, tilt } = damperAt(sh);
  g.save(); g.translate(dx, dy); g.rotate(tilt);
  const dw = mx1 - mx0 + 12, dh = my1 - my0 + 14;
  const plate = new Path2D(); plate.moveTo(0, dh); plate.lineTo(0, 60); plate.quadraticCurveTo(0, 0, dw / 2, 0); plate.quadraticCurveTo(dw, 0, dw, 60); plate.lineTo(dw, dh); plate.closePath();
  g.translate(6, 8); fill(plate, '#2a1d18', 0.5); g.translate(-6, -8);
  fill(plate, '#55555f'); g.save(); g.clip(plate); g.lineWidth = 16; g.strokeStyle = '#6e6e7a'; g.stroke(plate); g.restore();
  for (const [rx, ry] of [[22, 70], [dw - 22, 70], [22, dh - 22], [dw - 22, dh - 22]]) ell(rx, ry, 7, 7, '#8a8a96');
  limb([[dw / 2 - 26, dh * 0.45], [dw / 2 + 26, dh * 0.45]], 14, P.ironHi, false);
  limb([[dw / 2 - 26, dh * 0.45], [dw / 2 - 26, dh * 0.45 - 26], [dw / 2 + 26, dh * 0.45 - 26], [dw / 2 + 26, dh * 0.45]], 9, P.ironHi, false);
  g.restore();
  return { handle: [dx + (mx1 - mx0 + 12) / 2, dy + (my1 - my0 + 14) * 0.45 - 20] };
}

// where the damper plate is (its top-left corner and tilt) and where its handle is, for shut 0…1
export function damperAt(sh) {
  const [mx0, mx1, my0, my1] = STOVE.mouth, e = ease.inOut(clamp(sh));
  const dx = lerp(mx1 + 40, mx0 - 6, e), dy = lerp(-160, my0 - 10, e) - 60 * Math.sin(Math.PI * e), tilt = lerp(0.28, 0, e);
  const hx = (mx1 - mx0 + 12) / 2, hy = (my1 - my0 + 14) * 0.45 - 20;
  return { dx, dy, tilt, handle: [dx + hx * Math.cos(tilt) - hy * Math.sin(tilt), dy + hx * Math.sin(tilt) + hy * Math.cos(tilt)] };
}
// —— the vent in the wall: a round grille, blades that spin (speed 0…1); a pull switch on a cord ——
export function drawFan(t, o = {}) {
  const { x, y, r } = FAN, spin = o.spinAngle ?? 0;
  ell(x, y, r + 16, r + 16, P.whiteSh); ell(x, y, r, r, '#2a2a33');
  for (let i = 0; i < 4; i++) { const a = spin + i * TAU / 4; fill(smoothPath([[x, y], [x + Math.cos(a - 0.35) * r * 0.9, y + Math.sin(a - 0.35) * r * 0.9], [x + Math.cos(a + 0.2) * r * 0.85, y + Math.sin(a + 0.2) * r * 0.85]]), '#8a8a96'); }
  ell(x, y, 12, 12, '#5a5a66');
  for (let i = -3; i <= 3; i++) limb([[x + i * r / 4, y - Math.sqrt(Math.max(0, r * r - (i * r / 4) ** 2))], [x + i * r / 4, y + Math.sqrt(Math.max(0, r * r - (i * r / 4) ** 2))]], 4, rgba('#d8ccb8', 0.9), false);
  // the switch on the wall at hand height, a wire up to the fan
  const [sx, sy] = SWITCH;
  limb([[x + r * 0.7, y + r * 0.7], [sx, y + r + 30], [sx, sy - 40]], 5, '#2a2a33', false);
  rrect(sx - 24, sy - 36, 48, 72, 8, P.white); rrect(sx - 11, sy - 24, 22, 48, 5, '#8a8a96');
  const on = o.on ?? 1; rrect(sx - 9, on ? sy - 22 : sy, 18, 22, 4, on ? '#5fbf5a' : '#ff4d4d');
  return { sw: [sx, sy] };
}

// —— the door: frame, plank leaf (open 0…1 swings toward us), the bolt (shut 0…1 slides into the frame) ——
export function drawDoor(t, o = {}) {
  const { x, w, top } = DOOR, op = clamp(o.open ?? 0), bolt = clamp(o.bolt ?? 0);
  rect(x - w / 2 - 24, top - 24, w + 48, -top + 24, P.logSh);
  // the doorway: outside light when open
  rect(x - w / 2, top, w, -top, mix('#2a1d18', '#f2e4b6', op * 0.8));
  if (op > 0.02) { rect(x - w / 2, -60, w, 60, rgba(P.grass, op)); }
  const lw = w * Math.cos(op * 1.2);
  if (lw > 3) {
    rect(x - w / 2, top, lw, -top, P.door);
    for (let i = 1; i < 4; i++) rect(x - w / 2 + lw * i / 4 - 4, top, 8, -top, P.doorSh);
    rect(x - w / 2, top + 80, lw, 26, P.doorSh); rect(x - w / 2, -140, lw, 26, P.doorSh);
    ell(x - w / 2 + lw - 30, top * 0.48, 12, 12, '#d9b46a');
    // the bolt: a bar that slides from the leaf into the frame
    if (op < 0.05) { const bx = x + w / 2 - 70 + 70 * bolt; rect(x + w / 2 - 110, top * 0.6 - 14, 90, 28, P.iron); rect(bx - 40, top * 0.6 - 9, 100, 18, P.ironHi); ell(bx - 30, top * 0.6 - 20, 9, 9, P.ironHi); }
  }
  return { bolt: [x + w / 2 - 70 + 70 * bolt - 30, top * 0.6 - 20], handle: [x - w / 2 + lw - 30, top * 0.48] };
}

// —— a little table by the wall with a calendar above it ——
export function drawTable(t, o = {}) {
  const { x, y, w } = TABLE;
  rect(x - w / 2, y, w, 22, P.floorHi); rect(x - w / 2 + 16, y + 22, 18, -y - 22, P.floorSh); rect(x + w / 2 - 34, y + 22, 18, -y - 22, P.floorSh);
  rect(x - 70, y - 330, 140, 170, '#f4f1ea'); rect(x - 70, y - 330, 140, 40, '#e0453a');
  text('27', x, y - 190, 64, '#17162f', { fam: FONTS.cond, shadow: false });
}

// —— the floor slab with the hatch; open 0…1 lifts the lid on its left hinge ——
export function drawFloor(t, o = {}) {
  const { x0, x1, slab } = ROOM, op = clamp(o.hatch ?? 0);
  const f = new Path2D(); f.rect(x0 - 40, 0, x1 - x0 + 80, slab); f.rect(HATCH.x0, 0, HATCH.x1 - HATCH.x0, slab);
  g.save(); g.clip(f, 'evenodd');
  rect(x0 - 40, 0, x1 - x0 + 80, slab, P.floor); rect(x0 - 40, 0, x1 - x0 + 80, 10, P.floorHi); rect(x0 - 40, slab - 14, x1 - x0 + 80, 14, P.floorSh);
  for (let i = 0; i < 20; i++) rect(x0 - 40 + i * 95, 10, 5, slab - 24, P.floorSh);
  g.restore();
  // the lid: a plank square seen edge-on, turning up around (HATCH.x0, 0)
  const L = HATCH.x1 - HATCH.x0, a = -op * 1.65;
  g.save(); g.translate(HATCH.x0, 0); g.rotate(a);
  rect(0, -16, L, 22, P.floorHi); rect(0, 0, L, 6, P.floorSh); rrect(L - 60, -30, 30, 16, 6, P.iron);
  g.restore();
}

// —— the cellar under the floor: board walls, shelves of jars, bottled water, a crate, the lamp, the ladder ——
export function drawCellar(t, o = {}) {
  const { x0, x1, y0, y1 } = CEL;
  rect(x0, y0, x1 - x0, y1 - y0, P.board);
  for (let i = 0; i < 12; i++) rect(x0 + i * 82, y0, 6, y1 - y0, P.boardSh);
  rect(x0, y1 - 30, x1 - x0, 30, P.earthSh);
  // warm light from the lamp
  const lit = o.lamp ?? 1;
  ell(-120, 240, 420, 300, rgba(P.lamp, 0.16 * lit));
  limb([[-120, y0], [-120, 150]], 5, '#2a2a33', false); ell(-120, 168, 26, 30, mix('#8a8a96', P.lamp, lit)); rrect(-140, 140, 40, 18, 4, '#5a5a66');
  // shelves with jars
  for (const s of SHELVES) {
    rect(s.x0, s.y, s.x1 - s.x0, 16, P.shelf);
    const cols = [P.jarG, P.jarR, P.jarY, P.jarG, P.jarR];
    for (let i = 0; i < 5; i++) jar(s.x0 + 34 + i * 58, s.y, cols[(i + (s.y > 300 ? 2 : 0)) % 5], 0.9);
  }
  // the crate for a table, a stool to sit on
  rect(CRATE.x - CRATE.w / 2, CEL.floor - CRATE.h, CRATE.w, CRATE.h, P.crate);
  for (let i = 0; i < 3; i++) rect(CRATE.x - CRATE.w / 2, CEL.floor - CRATE.h + 12 + i * 40, CRATE.w, 10, P.crateSh);
  rect(STOOL.x - STOOL.w / 2, CEL.floor - STOOL.h, STOOL.w, 18, P.crate);
  for (const s of [-1, 1]) limb([[STOOL.x + s * 30, CEL.floor - STOOL.h + 16], [STOOL.x + s * 40, CEL.floor]], 12, P.crateSh, false);
  // bottled water on the floor
  if (!o.noBottles) for (let i = 0; i < 3; i++) waterBottle(330 + i * 70, y1 - 30, 1, i === 2 && o.bottleTaken);
}
export function drawLadder(t) {
  const { top, bot, hw } = LADDER;
  for (const s of [-1, 1]) limb([[top[0] + s * hw, top[1]], [bot[0] + s * hw, bot[1]]], 16, P.floorSh, false);
  for (const y of RUNGS) { const x = ladderX(y); limb([[x - hw, y], [x + hw, y]], 12, P.floorHi, false); }
}
export const ladderX = y => lerp(LADDER.top[0], LADDER.bot[0], (y - LADDER.top[1]) / (LADDER.bot[1] - LADDER.top[1]));
export const RUNGS = [70, 160, 250, 340, 430, 520];
export function jar(x, y, c, k = 1) {
  rrect(x - 22 * k, y - 70 * k, 44 * k, 70 * k, 10 * k, rgba('#dfeef0', 0.85));
  for (let i = 0; i < 3; i++) ell(x - 8 * k + i * 9 * k, y - 26 * k - (i % 2) * 18 * k, 10 * k, 16 * k, c);
  rrect(x - 20 * k, y - 80 * k, 40 * k, 14 * k, 4 * k, P.lid);
  limb([[x - 14 * k, y - 60 * k], [x - 14 * k, y - 20 * k]], 5 * k, rgba('#ffffff', 0.6), false);
}
export function waterBottle(x, y, k = 1, gone = false) {
  if (gone) return;
  rrect(x - 30 * k, y - 120 * k, 60 * k, 120 * k, 14 * k, rgba(P.bottle, 0.9));
  rect(x - 30 * k, y - 80 * k, 60 * k, 30 * k, P.bottleSh);
  rrect(x - 12 * k, y - 140 * k, 24 * k, 22 * k, 4 * k, P.cap);
  limb([[x - 16 * k, y - 110 * k], [x - 16 * k, y - 20 * k]], 6 * k, rgba('#ffffff', 0.55), false);
}
// —— props for the hands ——
export function phone(x, y, a = 0, k = 1, lit = 1) {
  g.save(); g.translate(x, y); g.rotate(a);
  rrect(-22 * k, -40 * k, 44 * k, 80 * k, 9 * k, '#24232f'); rrect(-17 * k, -33 * k, 34 * k, 62 * k, 5 * k, mix('#2a3a4a', '#8fd0ff', lit));
  ell(0, -5 * k, 8 * k, 8 * k, '#ff4d4d', 0, lit);                          // the record dot
  g.restore();
}
export function mug(x, y, k = 1, steam = 0, t = 0) {
  rrect(x - 26 * k, y - 50 * k, 52 * k, 54 * k, 10 * k, '#e0453a'); ell(x, y - 48 * k, 24 * k, 8 * k, '#7a3f1c');
  limb([[x + 24 * k, y - 38 * k], [x + 44 * k, y - 30 * k], [x + 40 * k, y - 10 * k], [x + 24 * k, y - 8 * k]], 9 * k, '#e0453a');
  for (let i = 0; i < 2; i++) { const u = (t * 0.7 + i * 0.5) % 1; ell(x - 6 * k + i * 12 * k + 8 * Math.sin(t * 3 + i), y - 70 * k - 60 * u * k, 9 * k, 14 * k, '#ffffff', 0, steam * 0.5 * (1 - u)); }
}
export function firstAidKit(x, y, k = 1, open = 0) {
  rrect(x - 70 * k, y - 80 * k, 140 * k, 80 * k, 10 * k, P.kit);
  rect(x - 12 * k, y - 66 * k, 24 * k, 52 * k, P.kitRed); rect(x - 26 * k, y - 52 * k, 52 * k, 24 * k, P.kitRed);
  if (open > 0.01) { g.save(); g.translate(x - 70 * k, y - 80 * k); g.rotate(-open * 1.9); rrect(0, -14 * k, 140 * k, 16 * k, 6 * k, P.kit); g.restore(); }
}
export function iodineBottle(x, y, a = 0, k = 1) {
  g.save(); g.translate(x, y); g.rotate(a);
  rrect(-16 * k, -50 * k, 32 * k, 56 * k, 8 * k, P.iodine); rrect(-10 * k, -66 * k, 20 * k, 18 * k, 4 * k, '#e8e2d4');
  rect(-14 * k, -36 * k, 28 * k, 22 * k, '#f4f1ea'); text('ЙОД', 0, -20 * k, 13 * k, '#7a3f1c', { fam: FONTS.cond, shadow: false });
  g.restore();
}
// the radio: a wooden box, a speaker grille, a dial that lights up (on 0…1), sound waves
export function radio(x, y, k = 1, on = 0, t = 0) {
  rrect(x - 90 * k, y - 110 * k, 180 * k, 110 * k, 14 * k, P.radio);
  rrect(x - 78 * k, y - 98 * k, 92 * k, 86 * k, 10 * k, P.radioHi);
  for (let i = 0; i < 5; i++) limb([[x - 70 * k, y - 86 * k + i * 16 * k], [x + 6 * k, y - 86 * k + i * 16 * k]], 5 * k, P.radio, false);
  rrect(x + 26 * k, y - 96 * k, 52 * k, 34 * k, 6 * k, mix('#3a3030', P.dial, on));
  ell(x + 52 * k, y - 36 * k, 16 * k, 16 * k, '#2a2a33'); limb([[x + 52 * k, y - 36 * k], [x + 52 * k + 12 * k * Math.cos(on * 2), y - 36 * k - 12 * k * Math.sin(on * 2)]], 4 * k, '#d8ccb8', false);
  limb([[x + 60 * k, y - 110 * k], [x + 120 * k, y - 200 * k]], 4 * k, '#8a8a96', false);
  if (on > 0.5) for (let i = 0; i < 3; i++) { const u = (t * 1.2 + i / 3) % 1; g.lineWidth = 6 * k; g.strokeStyle = rgba('#ffd27a', 0.8 * (1 - u)); g.beginPath(); g.arc(x - 30 * k, y - 56 * k, (50 + 70 * u) * k, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(x - 30 * k, y - 56 * k, (50 + 70 * u) * k, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); }
}
export function blanket(x, y, k = 1) {
  fill(smoothPath([[x - 110 * k, y], [x - 120 * k, y - 120 * k], [x - 60 * k, y - 190 * k], [x + 40 * k, y - 200 * k], [x + 110 * k, y - 140 * k], [x + 120 * k, y]]), '#c94c3b');
  for (let i = 0; i < 4; i++) limb([[x - 100 * k, y - 30 * k - i * 40 * k], [x + 110 * k, y - 30 * k - i * 40 * k]], 8 * k, rgba('#f4d8a8', 0.8), false);
}

// —— the explosion at the plant (FAR layer units): a flash, a fireball, then a dark plume the wind bends to the left;
// yellow specks of dust drift out of it toward the shore ——
export function drawBoom(t, t0, x, y, k = 1, o = {}) {
  if (t < t0) return;
  const u = t - t0, rise = o.rise ?? 1500, drift = o.drift ?? 1400;
  const fr = (60 + 220 * (1 - Math.exp(-u * 4))) * k, heat = Math.exp(-u * 1.6), grow = Math.min(1, u * 0.35);
  // the plume: one cloud of puffs up a column that bends with the wind and spreads into a cap; drawn in three passes
  // (shadows, bodies, lit tops) so the puffs merge into one shape; low down it glows from the fire for a while
  const n = 24;
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) {
    const v = i / (n - 1), h = grow * v;
    if (h <= 0.01) continue;
    const cy = y - fr * 0.5 - h * rise * k, cx = x - Math.pow(h, 1.6) * drift * k + 40 * Math.sin(u * 1.2 + i * 1.3) * k * v;
    let r = (70 + 120 * v + 30 * Math.sin(u * 2 + i * 1.7)) * k;
    if (v > 0.78) r *= 1 + (v - 0.78) * 3.5 * grow;
    const ox = (hash(i + 400) - 0.5) * r * 0.9, glow = Math.exp(-u * 0.5) * (1 - v) * 0.8;
    if (pass === 0) ell(cx + ox + 14 * k, cy + 16 * k, r, r * 0.78, '#2e2a35', 0, 0.95);
    else if (pass === 1) ell(cx + ox, cy, r, r * 0.78, mix('#4c4754', '#b85a36', glow), 0, 1);
    else ell(cx + ox - r * 0.22, cy - r * 0.24, r * 0.56, r * 0.42, mix('#6c6774', '#ffa65a', glow), 0, 0.9);
  }
  // the fireball: grows fast, cools from white to orange to smoke; the fire keeps burning at its foot
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + 0.3, d = fr * (0.45 + 0.2 * hash(i)), rr = fr * (0.45 + 0.2 * hash(i + 3));
    ell(x + Math.cos(a) * d * 0.9, y - fr * 0.4 + Math.sin(a) * d * 0.6 - u * 30 * k, rr, rr * 0.9, mix('#4a4450', mix('#ff7a2a', '#fff3c0', heat), Math.min(1, heat * 1.4)), 0, Math.min(1, 0.4 + heat * 2));
  }
  ell(x, y - fr * 0.4, fr * 0.6, fr * 0.55, mix('#5a5260', '#ffe08a', heat), 0, Math.min(1, 0.3 + heat * 2));
  ell(x, y - 10 * k, fr * 0.7, fr * 0.28, mix('#ff6a2a', '#ffd27a', 0.5 + 0.5 * Math.sin(t * 11)), 0, 0.85);
  // the shock ring and the flash, both fast
  if (u < 1.2) { g.lineWidth = 10 * k; g.strokeStyle = rgba('#ffffff', 0.7 * (1 - u / 1.2)); g.beginPath(); g.ellipse(x, y + 60 * k, 100 * k + 1600 * u * k, 20 * k + 160 * u * k, 0, 0, TAU); g.stroke(); }
}
// specks of radioactive dust drifting with the wind across a region (any layer, local units)
export function dust(t, t0, x0, x1, y0, y1, n = 40, k = 1, speed = 260) {
  if (t < t0) return;
  const fade = clamp((t - t0) / 0.8);
  for (let i = 0; i < n; i++) {
    const w = x1 - x0, ph = hash(i + 70);
    const x = x1 - ((ph * w + (t - t0) * speed * (0.7 + 0.6 * hash(i + 71))) % w), y = y0 + (y1 - y0) * hash(i + 72) + 30 * Math.sin(t * 1.3 + i);
    ell(x, y, 8 * k, 8 * k, '#ffd23f', 0, fade * 0.95);
    if (i % 4 === 0) trefoil(x, y, 7 * k, rgba('#17162f', fade));
  }
}
// streaks of wind blowing to the left
export function wind(t, x0, x1, y0, y1, n = 14, k = 1) {
  for (let i = 0; i < n; i++) {
    const w = x1 - x0, x = x1 - ((hash(i + 90) * w + t * 900 * k) % w), y = y0 + (y1 - y0) * hash(i + 91), len = (120 + 160 * hash(i + 92)) * k;
    limb([[x, y], [x + len * 0.5, y - 10 * k], [x + len, y]], 7 * k, rgba('#ffffff', 0.5));
  }
}

// where the door's handle and bolt knob are, without drawing (for the hand that grabs them)
export function drawDoorInfo(open, bolt) {
  const { x, w, top } = DOOR, lw = w * Math.cos(clamp(open) * 1.2), b = clamp(bolt);
  return { bolt: [x + w / 2 - 70 + 70 * b - 30, top * 0.6 - 20], handle: [x - w / 2 + lw - 30, top * 0.48] };
}

// —— far away (FAR layer, drawn around its anchor: the horizon under the plant is y = 0): the forest line, the
// fields, the nuclear plant (two cooling towers, the reactor block, a striped vent stack, power lines) and,
// from t0, the explosion at the reactor block ——
export const BOOM_LOCAL = [190, -120];
const FL = { field: '#9db86e', fieldSh: '#8aa75e', fieldHi: '#b4cb82', forest: '#3f5d4c', forest2: '#4f6e5a', tower: '#e3e6e8', towerSh: '#c3c9ce', rim: '#9aa3aa',
  block: '#c9d3da', blockSh: '#a9b6bf', blockHi: '#dde5ea', win: '#6f8796', steam: '#f6f7f8', stack: '#eef0f2', stripe: '#d8524a', wire: '#56606a' };
function coolingTower(x, s, t, boomed) {
  const b = 88 * s, w = 54 * s, tp = 62 * s, h = 250 * s;
  const p = new Path2D();
  p.moveTo(x - b, 0); p.quadraticCurveTo(x - w * 0.9, -h * 0.62, x - tp, -h); p.lineTo(x + tp, -h); p.quadraticCurveTo(x + w * 0.9, -h * 0.62, x + b, 0); p.closePath();
  fill(p, FL.tower);
  inside(p, () => { rect(x + w * 0.25, -h - 10, b, h + 20, FL.towerSh); rect(x - b, -h * 0.22, 2 * b, 12 * s, FL.towerSh, 0.6); });
  ell(x, -h, tp, 10 * s, FL.rim);
  // steam: before the explosion it rises in soft puffs
  if (!boomed) for (let i = 0; i < 5; i++) { const u = (t * 0.12 + i / 5) % 1; ell(x - 50 * s * u, -h - 30 * s - 260 * s * u, (50 + 60 * u) * s, (36 + 40 * u) * s, FL.steam, 0, 0.85 * (1 - u)); }
}
function pylon(x, y, h) {
  limb([[x - h * 0.16, y], [x, y - h], [x + h * 0.16, y]], 5, FL.wire, false);
  limb([[x - h * 0.2, y - h * 0.72], [x + h * 0.2, y - h * 0.72]], 5, FL.wire, false);
  limb([[x - h * 0.14, y - h * 0.9], [x + h * 0.14, y - h * 0.9]], 4, FL.wire, false);
}
export function drawFarland(t, t0, o = {}) {
  const boomed = t >= t0, burn = boomed ? clamp((t - t0) / 0.4) : 0;
  // the fields down to the yard, in bands
  rect(-4000, -4, 8000, 3000, FL.field);
  for (let i = 0; i < 9; i++) rect(-4000, 30 + i * i * 22, 8000, 10 + i * 5, i % 2 ? FL.fieldSh : FL.fieldHi, 0.7);
  // the forest line on the horizon, leaving the plant's ground clear
  for (let i = 0; i < 90; i++) {
    const x = -3000 + i * 68 + 30 * hash(i + 300);
    if (x > -380 && x < 420) continue;
    const h = 60 + 70 * hash(i + 301), c = i % 3 ? FL.forest : FL.forest2;
    poly([[x, -h], [x + 18, -h * 0.45], [x + 10, -h * 0.47], [x + 26, 2], [x - 26, 2], [x - 10, -h * 0.47], [x - 18, -h * 0.45]], c);
  }
  // power lines from the plant to the left
  const pyl = [[-560, 120], [-900, 110], [-1260, 100], [-1640, 92]];
  for (const [x, h] of pyl) pylon(x, 0, h);
  for (let k = 0; k < 2; k++) {
    let prev = [-330, -150 + k * 30];
    for (const [x, h] of pyl) { const q = [x + (k ? 18 : -18), -h * 0.72]; limb([prev, [(prev[0] + q[0]) / 2, (prev[1] + q[1]) / 2 + 14], q], 2.5, FL.wire); prev = q; }
  }
  // the plant: a low hall and a fence, two cooling towers, the reactor block, the vent stack
  rect(-360, -60, 760, 60, FL.blockSh);
  for (let i = 0; i < 32; i++) limb([[-360 + i * 24, 0], [-360 + i * 24, -26]], 3, FL.wire, false);
  coolingTower(-250, 1, t, boomed); coolingTower(-60, 0.86, t + 3, boomed);
  rect(90, -150, 200, 150, FL.block); rect(250, -150, 40, 150, FL.blockSh);
  rect(130, -230, 120, 82, FL.blockHi); rect(220, -230, 30, 82, FL.blockSh);
  for (let i = 0; i < 5; i++) rect(104 + i * 36, -110, 20, 30, FL.win);
  // after the blast the block is broken: a jagged black top and a glow
  if (boomed) {
    poly([[120, -150], [140, -235], [165, -190], [190, -250], [214, -200], [240, -238], [262, -150]], '#2a2530', burn);
    ell(190, -170, 70, 40, mix('#ff9a3c', '#ffd27a', 0.5 + 0.5 * Math.sin(t * 9)), 0, 0.8 * burn);
  }
  const sx = 330;
  poly([[sx - 18, 0], [sx - 11, -390], [sx + 11, -390], [sx + 18, 0]], FL.stack);
  for (let i = 0; i < 4; i++) { const y = -390 + i * 70; poly([[sx - 11 - i * 0.6, y], [sx - 12 - i * 0.6, y + 34], [sx + 12 + i * 0.6, y + 34], [sx + 11 + i * 0.6, y]], FL.stripe); }
  drawBoom(t, t0, BOOM_LOCAL[0], BOOM_LOCAL[1], o.k ?? 0.5, o);
}
// a low sun in the morning sky (FAR layer, local units)
export function farSun(x, y) { ell(x, y, 120, 120, rgba('#fff1c6', 0.35)); ell(x, y, 76, 76, '#fff3d0'); }

// —— the house from outside: the front wall in logs, two windows lit inside, the door, the chimney and roof ——
export function drawFacade(t, o = {}) {
  const { x0, x1, ceil } = ROOM;
  rect(-4000, 0, 8000, 3000, '#7d9c55');
  for (let i = 0; i < 60; i++) { const x = -3000 + i * 100 + 50 * hash(i + 500), y = 30 + 900 * hash(i + 501); poly([[x - 14, y], [x - 4, y - 34], [x, y], [x + 6, y - 40], [x + 14, y]], '#6b8a48'); }
  rect(STOVE.x - 60, ceil - 420, 120, 440, P.white); rect(STOVE.x - 60, ceil - 420, 24, 440, P.whiteSh); rect(STOVE.x - 72, ceil - 430, 144, 26, P.whiteSh);
  poly([[x0 - 160, ceil + 10], [0, ceil - 520], [x1 + 160, ceil + 10]], P.roof);
  poly([[x0 - 160, ceil + 10], [0, ceil - 520], [0, ceil - 470], [x0 - 90, ceil + 10]], P.roofSh);
  poly([[-130, ceil - 40], [0, ceil - 300], [130, ceil - 40]], P.frame); ell(0, ceil - 130, 40, 40, P.logSh);
  rect(x0, ceil, x1 - x0, -ceil, P.log);
  for (let i = 0; i < 12; i++) { const y = ceil + i * 62; rect(x0 - 30, y + 46, x1 - x0 + 60, 16, P.logSh); rect(x0, y + 6, x1 - x0, 8, P.logHi); }
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const x = s < 0 ? x0 - 10 : x1 + 10, y = ceil + i * 62 + 31; ell(x, y, 30, 31, P.logEnd); ell(x, y, 18, 19, P.logRing); }
  for (const wx of [-480, 40]) {
    const wy = -400, ww = 240, wh = 250;
    rect(wx - ww / 2 - 26, wy - wh / 2 - 26, ww + 52, wh + 52, P.frame);
    rect(wx - ww / 2, wy - wh / 2, ww, wh, mix('#2c2a33', '#ffd27a', o.light ?? 0.35));
    limb([[wx, wy - wh / 2], [wx, wy + wh / 2]], 12, P.frame, false); limb([[wx - ww / 2, wy], [wx + ww / 2, wy]], 12, P.frame, false);
    poly([[wx - ww / 2 - 50, wy - wh / 2 - 26], [wx, wy - wh / 2 - 100], [wx + ww / 2 + 50, wy - wh / 2 - 26]], P.frame);
    rect(wx - ww / 2 - 50, wy + wh / 2 + 26, ww + 100, 22, P.frame);
    // the open window on the left lets the wind in until he shuts it
    if (wx < 0 && (o.open ?? 0) > 0) rect(wx - ww / 2, wy - wh / 2, ww / 2, wh, '#171620', o.open);
  }
  const dx = 560, dw = 210, dt = -560;
  rect(dx - dw / 2 - 22, dt - 22, dw + 44, -dt + 22, P.logSh); rect(dx - dw / 2, dt, dw, -dt, P.door);
  for (let i = 1; i < 4; i++) rect(dx - dw / 2 + dw * i / 4 - 4, dt, 8, -dt, P.doorSh);
  ell(dx + dw / 2 - 30, dt * 0.48, 12, 12, '#d9b46a');
  rect(dx - dw / 2 - 60, -40, dw + 120, 40, P.floorHi); rect(dx - dw / 2 - 60, -40, dw + 120, 10, P.floorSh);
}
