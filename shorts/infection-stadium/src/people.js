// The new people of «Заражение» in the same flat shapes as баба Валя: Красотка (a purple puffer, a white hood with bunny
// ears, the torch), Соломия (a yellow raincoat, a long braid, blue rubber boots, the radio) and the soldier at the stadium
// gate (a helmet, an olive jacket with spots, a torch for the bite check). Local units like drawGranny: origin on the floor
// between the feet, y up is negative, about 640 px tall at s = 1; face 1 looks right, -1 left.
// o: x, y, s, face, t (time, for breathing and blinking), walk (0…1) + ph (step phase), look (-1…1 the eyes), smile (0…1),
//    arm: [x, y] the near hand (local), or null to hang; extra per person below.
import { lerp, clamp, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, inside, col } from './flat.js';

const SKIN = '#f2c9a8', CHEEK = '#f0a8a0', INKC = '#2c2c34';

function legs(o, c, shoe, w = 30) {
  const ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0);
  for (const [i, sx] of [[0, -26], [1, 26]]) {
    const sw = wk * 34 * Math.sin(ph + i * Math.PI), lift = wk * 14 * Math.max(0, Math.sin(ph + i * Math.PI));
    limb([[sx * 0.6, -250], [sx + sw * 0.5, -130 - lift * 0.4], [sx + sw, -20 - lift]], w, c);
    ell(sx + sw + 12, -12 - lift, 30, 14, shoe);
  }
}
function eyes(o, y, dx = 26) {
  const blink = ((o.t ?? 0) + (o.seed ?? 0)) % 3.1 < 0.12;
  for (const ex of [-dx, dx]) {
    if (blink) limb([[ex - 9, y], [ex + 9, y]], 4, INKC, false);
    else { ell(ex, y, 9, 11, '#ffffff'); ell(ex + 4 * (o.look ?? 0), y + 1, 5, 6, INKC); }
  }
}
function mouth(o, y) { const sm = o.smile ?? 0.4; limb([[-14, y], [0, y + 4 + 8 * sm], [14, y]], 4, '#8a3a3a', false); }
function arm(o, from, c, hand = SKIN, w = 26) {
  const ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0);
  const to = o.arm ?? [from[0] + 20 + 26 * wk * Math.sin(ph), from[1] + 190];
  limb([from, [lerp(from[0], to[0], 0.5) + 16, lerp(from[1], to[1], 0.5) + 8], to], w, c);
  ell(to[0], to[1], 15, 15, hand);
  return to;
}
const begin = o => {
  const s = o.s ?? 0.6, face = o.face ?? 1, wk = clamp(o.walk ?? 0), bob = wk * 8 * Math.abs(Math.sin((o.ph ?? 0) * TAU));
  g.save(); g.translate(o.x, (o.y ?? 0) - bob * s); g.scale(s * face, s);
};

// Красотка: jeans, white sneakers, a purple puffer in rings, a white hood with long bunny ears (they bounce as she walks)
export function drawKrasotka(o) {
  begin(o);
  legs(o, '#2f4a7a', '#f4f4f6', 30);
  arm({ ...o, arm: null, ph: (o.ph ?? 0) + 0.5 }, [-56, -440], '#6a3d9a');                       // the far arm
  const body = [[-74, -250], [-82, -380], [-60, -470], [60, -470], [82, -380], [74, -250]];
  fill(smoothPath(body), '#7d4fb3');
  inside(smoothPath(body), () => { for (let i = 0; i < 4; i++) rect(-90, -440 + i * 52, 180, 8, '#6a3d9a'); });
  // the hood: white, round, the face in its opening; two long ears with pink insides
  const bob = 6 * Math.sin((o.t ?? 0) * 6 + (o.ph ?? 0) * TAU);
  for (const [ex, a] of [[-34, -0.18], [34, 0.22]]) {
    g.save(); g.translate(ex, -600); g.rotate(a + 0.04 * bob / 6);
    ell(0, -70, 24, 78, '#f4f2f8'); ell(0, -66, 12, 58, '#f2a3bd'); g.restore();
  }
  ell(0, -540, 92, 96, '#f4f2f8');
  ell(0, -530, 66, 70, SKIN); ell(-30, -505, 13, 8, CHEEK); ell(30, -505, 13, 8, CHEEK);
  fill(smoothPath([[-60, -560], [-40, -600], [0, -612], [40, -600], [60, -560], [30, -580], [-30, -580]]), '#5a3a2a');   // a fringe
  eyes(o, -535, 24); mouth(o, -500);
  const hand = arm(o, [56, -440], '#7d4fb3');
  if (o.torch !== false) { g.save(); g.translate(hand[0], hand[1]); g.rotate(o.torchAng ?? 0.4); rrect(-10, -12, 56, 24, 7, '#2a2d38'); rect(42, -14, 9, 28, o.torchOn ? '#fff6d0' : '#6a7080'); g.restore(); }
  g.restore();
}

// Соломия: blue rubber boots, a yellow raincoat to the knee with big buttons, a long brown braid, the radio in her hand
export function drawSolomia(o) {
  begin(o);
  legs(o, '#3a3f55', '#2f6fd6', 28);
  arm({ ...o, arm: null, ph: (o.ph ?? 0) + 0.5 }, [-58, -440], '#e0b20e');
  const coat = [[-100, -150], [-80, -400], [-56, -470], [56, -470], [80, -400], [100, -150]];
  fill(smoothPath(coat), '#f5c518');
  inside(smoothPath(coat), () => { for (let i = 0; i < 4; i++) ell(0, -420 + i * 70, 9, 9, '#b8860b'); rect(-110, -300, 220, 10, '#e0b20e'); });
  // the braid down her back (behind the head, swinging a little)
  const sw = 10 * Math.sin((o.t ?? 0) * 3 + (o.ph ?? 0) * TAU);
  for (let i = 0; i < 6; i++) ell(-48 - 6 * i + sw * i / 6, -500 + i * 40, 22 - i * 1.5, 26, i % 2 ? '#6b3a1a' : '#7a4520');
  ell(0, -530, 70, 76, SKIN); ell(-30, -500, 13, 8, CHEEK); ell(30, -500, 13, 8, CHEEK);
  fill(smoothPath([[-74, -520], [-70, -580], [-30, -612], [30, -612], [70, -580], [74, -520], [50, -570], [0, -585], [-50, -570]]), '#7a4520');
  eyes(o, -530, 24); mouth(o, -496);
  const hand = arm(o, [58, -440], '#f5c518');
  if (o.radio !== false) { g.save(); g.translate(hand[0], hand[1] - 30); rrect(-16, -40, 32, 70, 6, '#1d2028'); rect(8, -82, 5, 44, '#1d2028'); rect(-10, -30, 20, 18, o.radioOn ? '#7dff9a' : '#3a5a44'); g.restore(); }
  g.restore();
}

// the soldier: boots, dark trousers, an olive jacket with spots, a helmet with a rim and a strap, a torch in the near hand
export function drawSoldier(o) {
  begin(o);
  legs(o, '#3a3d33', '#1d1c1a', 34);
  arm({ ...o, arm: o.farArm ?? null, ph: (o.ph ?? 0) + 0.5 }, [-64, -440], '#4e5a38', '#d9b48f', 28);
  const body = [[-80, -250], [-86, -400], [-64, -478], [64, -478], [86, -400], [80, -250]];
  fill(smoothPath(body), '#5c6b40');
  inside(smoothPath(body), () => { for (let i = 0; i < 14; i++) ell(-70 + 140 * ((i * 0.37) % 1), -470 + 220 * ((i * 0.61) % 1), 16, 10, i % 2 ? '#46522f' : '#7a7a52'); rect(-90, -275, 180, 22, '#3a3d33'); });
  ell(0, -540, 64, 70, '#d9b48f');
  eyes(o, -540, 22); limb([[-14, -500], [14, -500]], 5, '#6a3a2a', false);
  ell(0, -588, 84, 52, '#4e5a38'); rect(-90, -588, 180, 16, '#3f4a2d'); limb([[-56, -578], [-50, -500]], 4, '#2f3a22', false);
  const hand = arm(o, [64, -440], '#5c6b40', '#d9b48f', 28);
  if (o.torch) { g.save(); g.translate(hand[0], hand[1]); g.rotate(o.torchAng ?? 0.3); rrect(-10, -12, 56, 24, 7, '#2a2d38'); rect(42, -14, 9, 28, '#fff6d0'); g.restore(); }
  g.restore();
  return hand;
}
