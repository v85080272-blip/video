// The people and things of «Упала с неба» in flat shapes, drawn straight in screen space (y down, px at s = 1):
// Джулиана (17, short brown hair, a white minidress with a print, glasses until the fall, one sandal), the row of three
// airliner seats she fell in, the four-engine turboprop in the storm, her father (glasses, a beard, a khaki shirt), the
// lumberjacks, the jungle (big leaves, vines, trunks), the stream, the boat and the hut.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, inside } from './flat.js';

const SKIN = '#f2c9a8', CHEEK = '#f0a8a0', INKC = '#2c2c34', HAIR = '#6b4423';

function eyes(o, y, dx = 24) {
  const blink = o.shut || ((o.t ?? 0) + (o.seed ?? 0)) % 3.1 < 0.12;
  for (const ex of [-dx, dx]) {
    if (blink) limb([[ex - 9, y], [ex + 9, y]], 4, INKC, false);
    else { ell(ex, y, 9, 11, '#ffffff'); ell(ex + 4 * (o.look ?? 0), y + 1 + 3 * (o.lookY ?? 0), 5, 6, INKC); }
  }
  if (o.glasses) for (const ex of [-dx, dx]) { g.lineWidth = 5; g.strokeStyle = INKC; g.beginPath(); g.arc(ex, y, 19, 0, TAU); g.stroke(); }
}
function mouth(o, y) { const sm = o.smile ?? 0.3; if (o.open) ell(0, y + 4, 10, 8 * o.open, '#5a2a2a'); else limb([[-14, y], [0, y + 4 + 8 * sm], [14, y]], 4, '#8a3a3a', false); }

// Джулиана, standing / wading: origin at her feet (wading: the water line hides the legs), about 640 px tall at s = 1
export function drawGirl(o) {
  const s = o.s ?? 0.6, face = o.face ?? 1, ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0);
  g.save(); g.translate(o.x, (o.y ?? 0) - wk * 8 * s * Math.abs(Math.sin(ph))); g.rotate(o.rot ?? 0); g.scale(s * face, s);
  // legs: one sandal (on the near foot), the far foot bare
  for (const [i, sx] of [[0, -22], [1, 22]]) {
    const sw = wk * 30 * Math.sin(ph + i * Math.PI);
    limb([[sx * 0.6, -250], [sx + sw * 0.5, -130], [sx + sw, -20]], 26, SKIN);
    if (i === 1) { ell(sx + sw + 10, -10, 28, 11, '#b07a3a'); limb([[sx + sw - 6, -26], [sx + sw + 14, -12]], 5, '#8a5a2a', false); }
    else ell(sx + sw + 8, -10, 24, 10, SKIN);
  }
  // the far arm, the dress (white with a print, a little torn after the fall), the near arm with the sling or the reach
  const arm = (from, to, c) => { limb([from, [lerp(from[0], to[0], 0.5) + 14, lerp(from[1], to[1], 0.5) + 8], to], 22, c); ell(to[0], to[1], 13, 13, SKIN); };
  arm([-50, -440], o.farArm ?? [-62 - 20 * wk * Math.sin(ph), -260], SKIN);
  const dress = [[-86, -230], [-70, -390], [-48, -470], [48, -470], [70, -390], [86, -230], [50, -246], [20, -232], [-20, -246], [-50, -232]];
  fill(smoothPath(dress), o.dirty ? '#ddd6c2' : '#f4f1ea');
  inside(smoothPath(dress), () => { for (let i = 0; i < 14; i++) ell(-70 + 140 * hash(i * 1.7), -460 + 220 * hash(i * 2.3), 9, 9, i % 2 ? '#e2826a' : '#6a9ad0');
    if (o.dirty) for (let i = 0; i < 10; i++) ell(-70 + 140 * hash(i * 3.1), -440 + 200 * hash(i * 4.7), 14, 8, 'rgba(110,90,60,0.35)'); });
  // the head: short brown hair, the face, glasses only before the fall
  ell(0, -530, 64, 70, SKIN); ell(-28, -500, 12, 8, CHEEK); ell(28, -500, 12, 8, CHEEK);
  const lift = o.hairUp ?? 0;
  fill(smoothPath([[-70, -510], [-74, -570 - 20 * lift], [-40, -612 - 30 * lift], [20, -616 - 34 * lift], [66, -584 - 20 * lift], [72, -520], [52, -560], [0, -578], [-50, -556]]), HAIR);
  eyes(o, -532, 24); mouth(o, -494);
  arm([50, -440], o.arm ?? [62 + 20 * wk * Math.sin(ph), -260], SKIN);
  if (o.wound) { ell(o.arm ? o.arm[0] * 0.5 + 25 : 56, o.arm ? (o.arm[1] - 440) / 2 : -350, 20, 14, `rgba(200,60,50,${0.5 + 0.3 * o.wound})`); }
  if (o.candy) { g.save(); const p = o.arm ?? [62, -260]; g.translate(p[0], p[1] + 10); rrect(-18, -6, 36, 40, 6, '#e94f8a'); rect(-18, -6, 36, 8, '#f7c8db'); g.restore(); }
  g.restore();
}

// the row of three seats (blue, a white headrest cloth) with her strapped in the middle one; origin at the seat pan
export function drawSeatRow(o) {
  const s = o.s ?? 0.6;
  g.save(); g.translate(o.x, o.y); g.rotate(o.rot ?? 0); g.scale(s, s);
  for (const dx of [-200, 0, 200]) {
    rrect(dx - 90, -360, 180, 330, 30, '#2f4f8f'); rrect(dx - 70, -360, 140, 70, 16, '#f4f1ea');
    rrect(dx - 96, -40, 192, 70, 18, '#294580'); rect(dx - 10, 30, 20, 90, '#6a7080');
  }
  rect(-300, 110, 600, 20, '#6a7080');
  if (o.girl !== false) {
    const hu = o.hairUp ?? 0;
    // her, seated: the legs over the edge, the belt across her lap, the arms up (she is falling) or holding the belt
    for (const sx of [-26, 26]) { limb([[sx, 0], [sx + 8, 120 + 20 * hu]], 26, SKIN); ell(sx + 14, 130 + 20 * hu, 24, 10, sx > 0 ? '#b07a3a' : SKIN); }
    fill(smoothPath([[-80, 20], [-66, -150], [-44, -230], [44, -230], [66, -150], [80, 20]]), '#f4f1ea');
    for (let i = 0; i < 8; i++) ell(-60 + 120 * hash(i * 1.9), -210 + 200 * hash(i * 2.9), 8, 8, i % 2 ? '#e2826a' : '#6a9ad0');
    rect(-96, -10, 192, 16, '#3a3d44'); rrect(-18, -16, 36, 28, 4, '#c9cfd8');
    for (const [sx, a] of [[-60, -1], [60, 1]]) limb([[sx, -200], [sx + a * 50, -300 - 40 * hu], [sx + a * 70, -380 - 60 * hu]], 22, SKIN);
    g.save(); g.translate(0, -290);
    ell(0, 0, 60, 66, SKIN); fill(smoothPath([[-66, 10], [-70, -50 - 50 * hu], [-36, -100 - 80 * hu], [24, -104 - 90 * hu], [64, -60 - 50 * hu], [68, 10], [48, -30], [0, -46], [-46, -26]]), HAIR);
    eyes({ ...o, glasses: o.glasses }, -2, 22); mouth({ open: o.open ?? 0.6 }, 34);
    g.restore();
  }
  g.restore();
}

// the four-engine turboprop, side on, nose right; br 0…1 breaks the right wing off and tilts the rest
export function drawPlane(x, y, s, br = 0, t = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(0.08 * br);
  fill(smoothPath([[-420, -10], [-380, -40], [300, -44], [400, -20], [420, 0], [400, 18], [300, 30], [-380, 26]]), '#c9ced6');
  rect(-380, -8, 780, 10, '#c94a3b'); for (let i = 0; i < 14; i++) rrect(-300 + i * 44, -30, 22, 16, 6, '#3a4250');
  poly([[-380, -36], [-430, -150], [-370, -150], [-320, -40]], '#b9bec6');
  // the wing and its two engines; with br it drifts off down and away, spinning
  g.save(); g.translate(40 + 160 * br, 20 + 260 * br); g.rotate(1.6 * br);
  poly([[-60, 0], [120, 0], [60, 40], [-120, 40]], '#aeb3bb');
  for (const ex of [-40, 60]) { rrect(ex - 30, 18, 80, 30, 12, '#8a9098'); limb([[ex + 52, 33 - 40], [ex + 52, 33 + 40]], 6, `rgba(60,60,70,${0.4 + 0.3 * Math.sin(t * 40)})`, false); }
  g.restore();
  if (br > 0.05) for (let i = 0; i < 8; i++) { const a = i * 0.8 + t * 3; ell(80 + 140 * br * Math.cos(a), 30 + 140 * br * Math.sin(a), 10, 6, '#7a7f88'); }
  g.restore();
}

// her father, from a memory: khaki shirt, glasses, a beard; pointing (the near arm out)
export function drawFather(o) {
  const s = o.s ?? 0.6, face = o.face ?? 1;
  g.save(); g.translate(o.x, o.y); g.scale(s * face, s);
  for (const sx of [-26, 26]) { limb([[sx * 0.6, -260], [sx, -130], [sx, -20]], 34, '#5a4a3a'); ell(sx + 12, -10, 32, 13, '#2c241c'); }
  limb([[-60, -460], [-74, -350], [-66, -260]], 28, '#b9a77a'); ell(-66, -255, 15, 15, SKIN);
  fill(smoothPath([[-84, -250], [-90, -410], [-62, -490], [62, -490], [90, -410], [84, -250]]), '#c2b182');
  rect(-6, -480, 12, 220, '#a8976a');
  ell(0, -560, 66, 72, SKIN); ell(0, -510, 54, 40, '#7a6a5a'); fill(smoothPath([[-66, -560], [-60, -620], [0, -640], [60, -620], [66, -560], [40, -600], [-40, -600]]), '#8a7a6a');
  eyes({ ...o, glasses: true }, -566, 24);
  const p = o.point ?? [150, -470]; limb([[60, -460], [lerp(60, p[0], 0.5), lerp(-460, p[1], 0.5) - 10], p], 28, '#b9a77a'); ell(p[0], p[1], 15, 15, SKIN);
  g.restore();
}

// a lumberjack: a hard hat, a checked shirt, an axe on the shoulder
export function drawLumberjack(o) {
  const s = o.s ?? 0.6, face = o.face ?? 1, ph = (o.ph ?? 0) * TAU, wk = clamp(o.walk ?? 0);
  g.save(); g.translate(o.x, o.y - wk * 8 * s * Math.abs(Math.sin(ph))); g.scale(s * face, s);
  for (const [i, sx] of [[0, -26], [1, 26]]) { const sw = wk * 32 * Math.sin(ph + i * Math.PI); limb([[sx * 0.6, -260], [sx + sw * 0.5, -130], [sx + sw, -20]], 36, '#3a4a6a'); ell(sx + sw + 12, -10, 32, 13, '#2c241c'); }
  const shirt = [[-86, -250], [-92, -410], [-64, -490], [64, -490], [92, -410], [86, -250]];
  fill(smoothPath(shirt), o.c ?? '#b8342a');
  inside(smoothPath(shirt), () => { for (let i = -4; i < 5; i++) { rect(i * 40 - 6, -500, 12, 260, 'rgba(0,0,0,0.25)'); rect(-100, -480 + i * 40 + 160, 200, 10, 'rgba(0,0,0,0.25)'); } });
  ell(0, -560, 64, 70, '#d9a77f'); eyes(o, -560, 22); limb([[-14, -522], [14, -522]], 5, '#6a3a2a', false);
  ell(0, -606, 76, 42, o.hat ?? '#f2c94c'); rect(-90, -604, 180, 14, o.hat ?? '#d9a520');
  limb([[60, -460], [100, -380], [80, -300]], 26, o.c ?? '#b8342a'); ell(80, -296, 14, 14, '#d9a77f');
  g.save(); g.translate(80, -300); g.rotate(-0.9); rect(-6, -220, 12, 260, '#8a5a32'); poly([[-6, -220], [-60, -250], [-60, -170], [-6, -190]], '#9aa0aa'); g.restore();
  g.restore();
}

// the jungle: a dark-green wall of leaves with trunks and vines; layer k 0 (far, pale) … 1 (near, dark), scroll in px
export function jungle(t, k, scroll = 0, y0 = 0) {
  const W = 1080, cols = ['#5f8f6a', '#3f7552', '#2a5e3f', '#1c4a31'], c = cols[Math.min(3, Math.round(k * 3))];
  const sp = lerp(260, 420, k), off = ((scroll * lerp(0.3, 1, k)) % sp + sp) % sp;
  for (let x = -sp - off; x < W + sp; x += sp) {
    const i = Math.round((x + scroll * lerp(0.3, 1, k)) / sp), h = 900 + 400 * hash(i * 3.7 + k * 10);
    rect(x + sp * 0.4, y0 - h, lerp(24, 60, k), h + 900, mixC('#3a2a1c', c, 0.4));
    for (let j = 0; j < 5; j++) { const lx = x + sp * hash(i * 1.3 + j), ly = y0 - h + j * 160 + 60 * hash(i + j); ell(lx, ly, lerp(140, 230, k), lerp(70, 110, k), c, 0.3 * (hash(i * j + 1) - 0.5)); }
    if (k > 0.5) limb([[x + sp * 0.7, y0 - h], [x + sp * 0.75 + 20 * Math.sin(t + i), y0 - h * 0.4], [x + sp * 0.72, y0 - 120]], 7, '#2f5a32', true);
  }
}
function mixC(a, b, u) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], u)).toString(16).padStart(2, '0')).join('');
}
// a big near leaf (foreground framing)
export function bigLeaf(x, y, r, rot, c = '#1f5235') {
  g.save(); g.translate(x, y); g.rotate(rot); fill(smoothPath([[0, 0], [r * 0.45, -r * 0.25], [r, 0], [r * 0.45, r * 0.25]]), c); limb([[0, 0], [r * 0.95, 0]], 5, 'rgba(255,255,255,0.15)', false); g.restore();
}
// the boat (a dugout with an outboard and a fuel can) and the lean-to hut on the bank
export function boatHut(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  poly([[-120, -260], [160, -260], [210, -130], [-170, -130]], '#a88a52'); poly([[-150, -260], [20, -380], [190, -260]], '#8a6a3a');
  for (const px of [-140, 180]) rect(px - 8, -260, 16, 260, '#6a4a2a');
  g.save(); g.translate(330, 20 + 6 * Math.sin(t * 1.5));
  fill(smoothPath([[-200, 0], [-180, 40], [180, 40], [220, 0]], true), '#5a3a22'); rect(170, -40, 40, 60, '#3a3d44');
  rrect(-60, -50, 60, 60, 8, '#c94a3b'); rect(-44, -60, 24, 12, '#3a3d44');
  g.restore();
  g.restore();
}
