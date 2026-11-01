// The stairwell of a panel block as a flat side section: the 9th-floor landing with Батон's door on the left, a flight down
// to the right to the half-landing with the moon window, a second flight on down to the 8th floor.
// World units are pixels at zoom 1. Layers move at different speeds under the camera: the street through the window
// (FAR), the stairwell itself (1), a pipe in front (NEAR).
import { g, poly, rect, rrect, ell, fill, limb, polyPath, rrPath, ellPath, Path2D } from './flat.js';
import { hash, lerp } from './lib.js';

export const C = {
  night: '#17162f', wall: '#2b2d5c', panel: '#233a5e', line: '#3a3f78', step: '#3a3f78', tread: '#4b519a', slab: '#262a5a',
  rail: '#1b1a3d', sky: '#45449a', skyLow: '#3a3988', star: '#c9c6ff', moon: '#fff3d6', crater: '#efdfb4', city: '#211f4f',
  cityFar: '#2c2b66', lit: '#ffd27a', door: '#6b2d3f', stud: '#88405a', frame: '#1d1c3d', brass: '#d6a94a', lamp: '#ffd27a',
  box: '#33377a', crack: '#25274f', pipe: '#0f0e26', text: '#fff3d6', accent: '#ff4d4d', door8: '#2f5d50', stud8: '#3f7564',
};
export const FAR = 0.5, NEAR = 1.35;
export const FLOOR = 1400, EDGE = 780, SW = 100, SH = 66, RISERS = 8, DADO = 330, SLAB = 90;
export const HALF_Y = FLOOR + SH * RISERS, HALF_X0 = EDGE + SW * (RISERS - 1), HALF_X1 = 2240;
export const LOW_Y = HALF_Y + SH * RISERS, LOW_X0 = HALF_X1 + SW * (RISERS - 1);
export const DOOR = { x: 60, y: 660, w: 300, h: 740 };
export const DOOR8 = { x: 3240, y: LOW_Y - 740, w: 300, h: 740 };   // flat 32 on the 8th floor, open, where the zombie hides
export const LAMP8 = [3060, 1820];
export const WIN = { x: 1380, y: 1110, w: 360, h: 480 };
export const MOON = { x: 1612, y: 1398, r: 92 };          // in the far layer: behind the zombie's head while he sniffs at the window
export const PIPE_X = 790;                               // near layer: at the left edge of the reveal, sweeps across on the climb
export const LAMP = [985, 760];

// top of the floor under x: landing, treads of flight 1, half-landing, treads of flight 2, 8th floor
export function floorY(x) {
  if (x <= EDGE) return FLOOR;
  if (x < HALF_X0) return FLOOR + SH * Math.ceil((x - EDGE) / SW);
  if (x <= HALF_X1) return HALF_Y;
  if (x < LOW_X0) return HALF_Y + SH * Math.ceil((x - HALF_X1) / SW);
  return LOW_Y;
}
// where a foot goes: k = 0 the landing by the edge, 1..7 the treads of flight 1, 8 the half-landing by the last riser,
// 9..15 the treads of flight 2, 16 the 8th floor
export function tread(k) {
  if (k <= 0) return [EDGE - 60 + k * 90, FLOOR];
  if (k < RISERS) return [EDGE + SW * (k - 0.5), FLOOR + SH * k];
  if (k === RISERS) return [HALF_X0 + 70, HALF_Y];
  if (k < 2 * RISERS) return [HALF_X1 + SW * (k - RISERS - 0.5), HALF_Y + SH * (k - RISERS)];
  return [LOW_X0 + 70 + (k - 2 * RISERS) * 90, LOW_Y];
}
const NOSE = 0.66;                                       // slope of the line through the nosings, SH / SW
const dadoY = x => {
  if (x <= EDGE) return FLOOR - DADO;
  if (x <= HALF_X1) return Math.min(HALF_Y - DADO, FLOOR - DADO + NOSE * (x - EDGE));
  return Math.min(LOW_Y - DADO, HALF_Y - DADO + NOSE * (x - HALF_X1));
};

// the outline of everything people stand on, as one flat mass
function floorMass() {
  const top = [[-3000, FLOOR], [EDGE, FLOOR]];
  for (let k = 1; k < RISERS; k++) top.push([EDGE + SW * (k - 1), FLOOR + SH * k], [EDGE + SW * k, FLOOR + SH * k]);
  top.push([HALF_X0, HALF_Y], [HALF_X1, HALF_Y]);
  for (let k = 1; k < RISERS; k++) top.push([HALF_X1 + SW * (k - 1), HALF_Y + SH * k], [HALF_X1 + SW * k, HALF_Y + SH * k]);
  top.push([LOW_X0, LOW_Y], [6000, LOW_Y]);
  // undersides of the flights run parallel to the nosings, d below them, and meet the slabs of the landings
  const d = 160, meet = (x0, y0, y) => [x0 + (y - y0 - d) / NOSE, y];
  const bottom = [[6000, LOW_Y + SLAB], meet(HALF_X1, HALF_Y, LOW_Y + SLAB), meet(HALF_X1, HALF_Y, HALF_Y + SLAB),
    meet(EDGE, FLOOR, HALF_Y + SLAB), meet(EDGE, FLOOR, FLOOR + SLAB), [-3000, FLOOR + SLAB]];
  return [...top, ...bottom];
}
const MASS = floorMass();

// —— far layer: the night street seen through the window ——
export function drawFar() {
  rect(WIN.x - 600, WIN.y - 700, WIN.w + 1200, WIN.h + 1400, C.sky);
  rect(WIN.x - 600, WIN.y + 260, WIN.w + 1200, 900, C.skyLow);
  for (let i = 0; i < 40; i++) {
    const x = WIN.x - 500 + hash(i * 3.1) * (WIN.w + 1000), y = WIN.y - 600 + hash(i * 7.7) * 900, r = 2 + hash(i * 1.3) * 2.5;
    ell(x, y, r, r, C.star, 0, 0.5 + hash(i * 5.5) * 0.5);
  }
  ell(MOON.x, MOON.y, MOON.r * 1.45, MOON.r * 1.45, C.moon, 0, 0.08); ell(MOON.x, MOON.y, MOON.r, MOON.r, C.moon);
  ell(MOON.x + 30, MOON.y - 22, 20, 18, C.crater); ell(MOON.x - 28, MOON.y + 30, 13, 12, C.crater); ell(MOON.x + 8, MOON.y + 44, 8, 8, C.crater);
  // two rows of panel blocks: far and near rooftops, lit windows in a grid
  const rows = [[WIN.y + 560, C.cityFar, 0.55, 11], [WIN.y + 640, C.city, 1, 23]];
  for (const [base, color, litA, seed] of rows) {
    let x = WIN.x - 520;
    for (let b = 0; x < WIN.x + WIN.w + 520; b++) {
      const w = 150 + hash(seed + b * 2.3) * 170, h = 90 + hash(seed + b * 4.1) * 150, top = base - h;
      rect(x, top, w - 18, 2000, color);
      for (let wy = top + 26; wy < top + 700; wy += 38) for (let wx = x + 18; wx < x + w - 40; wx += 34) {
        if (hash(wx * 0.37 + wy * 1.91 + seed) > 0.72) rect(wx, wy, 14, 18, C.lit, litA);
      }
      x += w;
    }
  }
}

// —— stairwell layer ——
export function windowPath() { return rrPath(WIN.x, WIN.y, WIN.w, WIN.h, 6); }
export function wallClip() {          // the back wall where shadows may fall: everything but the window opening
  const p = new Path2D();
  p.rect(-3000, -2000, 9000, 6000);
  p.rect(WIN.x + WIN.w, WIN.y, -WIN.w, WIN.h);   // reversed winding cuts the hole (nonzero rule)
  return p;
}
export function drawWall() {
  rect(-3000, -2000, 9000, 6000, C.wall);
  // painted lower panel following the stairs, with a thin line on top
  const pts = [[-3000, 4000], [-3000, dadoY(-3000)]];
  for (let x = -3000; x <= 6000; x += 20) pts.push([x, dadoY(x)]);
  pts.push([6000, 4000]);
  poly(pts, C.panel);
  const line = []; for (let x = -3000; x <= 6000; x += 20) line.push([x, dadoY(x) - 4]);
  limb(line, 8, C.line, false);
  // cracks and scuffs
  for (const [x, y, s] of [[520, 560, 1], [1120, 900, -1], [1990, 1290, 1], [-160, 1000, -1]]) {
    limb([[x, y], [x + 26 * s, y + 34], [x + 12 * s, y + 70], [x + 40 * s, y + 104]], 5, C.crack, false);
  }
}
// the moon window: the far layer is drawn into its opening by the caller, this draws the frame and the sill on top
export function drawWindowFrame() {
  const { x, y, w, h } = WIN, f = 22;
  const p = new Path2D(); p.rect(x - f, y - f, w + 2 * f, h + 2 * f); p.rect(x + w, y, -w, h);
  fill(p, C.frame);
  rect(x + w * 0.5 - 9, y + h * 0.36, 18, h * 0.64, C.frame);      // the T-shaped mullion of a Soviet window
  rect(x, y + h * 0.36 - 9, w, 18, C.frame);
  rrect(x - f - 26, y + h + f - 6, w + 2 * f + 52, 24, 4, C.tread);   // sill
  poly([[x + 40, y + h], [x + 110, y + h], [x + 190, y], [x + 120, y]], '#ffffff', 0.06);   // a flat glint on the glass
}
export function drawDoor() {
  const { x, y, w, h } = DOOR;
  rect(x - 22, y - 22, w + 44, h + 22, C.frame);
  rect(x, y, w, h, C.door);
  // quilted leatherette: studs on a diamond grid
  for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) {
    const sx = x + 30 + c * 48 + (r % 2) * 24, sy = y + 40 + r * 58;
    if (sx < x + w - 20) ell(sx, sy, 5.5, 5.5, C.stud);
  }
  ell(x + w / 2, y + 230, 13, 13, C.frame); ell(x + w / 2, y + 230, 7, 7, '#5f6aa8');      // peephole
  rrect(x + w / 2 - 34, y + 120, 68, 40, 6, C.brass);                                     // flat number 36
  g.fillStyle = '#5a3a1a'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('36', x + w / 2, y + 141);
  rrect(x + w - 58, y + 380, 18, 70, 6, C.frame); rrect(x + w - 76, y + 382, 46, 16, 8, C.brass);   // handle
  rect(x - 10, FLOOR - 8, w + 20, 8, '#4a2f3a');                                          // doormat
}
// flat 32 on the 8th floor: a dark open doorway with the leaf seen edge-on at the right jamb, and a dead lamp
export function door8Path() { const { x, y, w, h } = DOOR8; return rrPath(x, y, w, h, 2); }
export function drawDoor8() {
  const { x, y, w, h } = DOOR8;
  rect(x - 22, y - 22, w + 44, h + 22, C.frame);
  rect(x, y, w, h, C.pipe);
  rect(x + 60, y + 150, 120, 170, '#2a2850');                     // a far window in the dark flat
  rect(x + 116, y + 150, 8, 170, C.pipe); rect(x + 60, y + 228, 120, 8, C.pipe);
  rect(x + w - 30, y, 30, h, C.door8);                            // the open leaf, edge on
  rect(x + w - 30, y, 8, h, C.stud8);
  rect(x - 10, LOW_Y - 8, w + 20, 8, '#2c3f3a');                  // doormat
  const [lx, ly] = LAMP8;                                         // the 8th-floor lamp is dead
  rrect(lx - 24, ly - 40, 48, 18, 4, C.frame); ell(lx, ly - 2, 22, 24, '#4d4a6e');
  limb([[lx - 22, ly - 22], [lx - 20, ly + 22], [lx + 20, ly + 22], [lx + 22, ly - 22]], 4, C.frame, false);
}
// the leaf swinging shut over whoever is in the doorway (u: 0 open … 1 shut), hinged at the right jamb
export function drawDoor8Leaf(u) {
  if (u <= 0) return;
  const { x, y, w, h } = DOOR8, lw = lerp(30, w, u);
  g.save(); g.translate(x + w, y); g.scale(lw / w, 1); g.translate(-(x + w), -y);
  rect(x, y, w, h, C.door8);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) {
    const sx = x + 30 + c * 48 + (r % 2) * 24, sy = y + 40 + r * 58;
    if (sx < x + w - 20) ell(sx, sy, 5.5, 5.5, C.stud8);
  }
  rrect(x + w / 2 - 34, y + 120, 68, 40, 6, C.brass);
  g.fillStyle = '#5a3a1a'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('32', x + w / 2, y + 141);
  rrect(x + 40, y + 380, 18, 70, 6, C.frame); rrect(x + 30, y + 382, 46, 16, 8, C.brass);
  g.restore();
  if (u < 1) rect(x + w - lw, y, 10, h, C.stud8);                 // the free edge while it swings
}
export function drawDetails(t, lamp = 1) {
  // the switchboard by the door: a grey-blue box with vents, two meter windows and a lock
  rrect(520, 830, 140, 190, 8, C.box);
  for (let i = 0; i < 4; i++) rect(540, 850 + i * 14, 100, 6, '#262a63');
  for (const x of [556, 624]) { rrect(x - 22, 930, 44, 30, 5, '#262a63'); rect(x - 14, 940, 28, 10, '#9fb3ff', 0.55); }
  ell(642, 990, 6, 6, C.frame);
  // a wall lamp over the stairs: a bulb in a cage with a flat warm halo
  const [lx, ly] = LAMP;
  ell(lx, ly, 96, 96, '#ffb45c', 0, 0.09 * lamp); ell(lx, ly, 52, 52, '#ffc76b', 0, 0.2 * lamp);
  rrect(lx - 24, ly - 40, 48, 18, 4, C.frame); ell(lx, ly - 2, 22, 24, lamp > 0.5 ? C.lamp : '#6b6680');
  limb([[lx - 22, ly - 22], [lx - 20, ly + 22], [lx + 20, ly + 22], [lx + 22, ly - 22]], 4, C.frame, false);
  // light switch
  rrect(410, 1090, 36, 52, 5, '#3f4492'); rect(424, 1102, 8, 16, C.frame);
}
export function drawRailing() {
  const hr = 300;
  const rail = (x0, y0, x1, y1) => limb([[x0, y0 - hr], [x1, y1 - hr]], 20, C.rail, false);
  rail(EDGE - 150, FLOOR - SH * 0.5 - 0, EDGE, FLOOR);
  rail(EDGE, FLOOR, HALF_X0, HALF_Y - SH);
  rail(HALF_X0, HALF_Y - SH, HALF_X0 + 120, HALF_Y - SH);
  rail(HALF_X1, HALF_Y, LOW_X0, LOW_Y - SH);
  for (let k = 1; k < RISERS; k++) {
    const [x, y] = tread(k), ry = FLOOR + NOSE * (x - EDGE) - hr;
    rect(x - 4, ry, 8, y - ry, C.rail);
    const [x2, y2] = tread(k + RISERS), ry2 = HALF_Y + NOSE * (x2 - HALF_X1) - hr;
    rect(x2 - 4, ry2, 8, y2 - ry2, C.rail);
  }
}
export function drawFloors() {
  poly(MASS, C.step);
  // lit tread tops and the dark undersides
  rect(-3000, FLOOR, 3000 + EDGE, 12, C.tread);
  for (let k = 1; k < RISERS; k++) rect(EDGE + SW * (k - 1), FLOOR + SH * k, SW, 10, C.tread);
  rect(HALF_X0, HALF_Y, HALF_X1 - HALF_X0, 12, C.tread);
  for (let k = 1; k < RISERS; k++) rect(HALF_X1 + SW * (k - 1), HALF_Y + SH * k, SW, 10, C.tread);
  rect(LOW_X0, LOW_Y, 6000, 12, C.tread);
  rect(-3000, FLOOR + SLAB - 22, 3000 + EDGE - 120, 22, C.slab);
}
// —— near layer ——
export function drawNear() {
  rect(PIPE_X - 18, -2000, 36, 7000, C.pipe);
  for (let y = 200; y < 3200; y += 520) rrect(PIPE_X - 28, y, 56, 22, 6, C.pipe);
}
