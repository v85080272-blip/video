// The flat on the 20th floor, cut open from the front: the bathroom on the left (tub with a mixer tap, toilet with its
// cistern, a bucket), a doorway, the kitchen on the right (fridge, counter with sink and tap, pots and bottles, upper
// cabinets, the window over the dark city, a table with a candle, the dog's bowl). Units: floor at y = 0, ceiling at
// y = -720, the hunter at s = 0.6 is about 450 tall. The light (dark night, torch, day) is laid over it by main.js.
import { g, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside, col, MONO } from './flat.js';
import { lerp, clamp, ease, hash, noise, TAU, rgba, mix, bump } from './lib.js';

export const ROOM = { x0: -1260, x1: 900, ceil: -720, slab: 70 };
export const PART = { x0: -440, x1: -400, door: -560 };
export const TUB = { x0: -1220, x1: -760, rim: -176, in0: -1196, in1: -786, bot: -36 };
export const BTAP = { x: -820, y: -330, spout: [-846, -262] };
export const TOILET = { x: -570, bowl: [-570, -118], cist: [-660, -430, 130, 130] };
export const BUCKET = { x: -700, y: 0 };
export const FRIDGE = { x0: -370, x1: -130, top: -610, split: -210 };
export const COUNTER = { x0: -90, x1: 340, top: -300 };
export const KTAP = { x: 150, base: [150, -300], spout: [194, -382] };
export const POTS = [{ x: -50, w: 90, h: 70 }, { x: 46, w: 76, h: 58 }];
export const BOTTLES = [{ x: 236 }, { x: 278 }, { x: 320 }];
export const WIN = { x0: 430, x1: 730, y0: -590, y1: -260 };
export const TABLE = { x0: 470, x1: 830, top: -240 };
export const CANDLE = [600, -240];
export const BOWL = [380, 0];
export const LAMP = [250, -720];
const C = {
  tile: '#cfe3ea', grout: '#b7cfd9', tile2: '#bcd6e0', wall: '#e9dcc0', wallSh: '#dccba8', paperDot: '#d8c6a0', floor: '#a9876a', floorSh: '#94735a',
  bathFloor: '#9fb4bd', slab: '#3c3f52', slabEdge: '#2c2e3e', ceil: '#f1ebdd', white: '#f6f3ec', whiteSh: '#dcd7cc', chrome: '#a9b4c0', chromeHi: '#dbe2ea',
  water: '#7fc0e8', waterSh: '#5aa6d8', fridge: '#eef0f2', fridgeSh: '#cfd5da', wood: '#c08a5a', woodSh: '#9d6c43', cab: '#86a5a0', cabSh: '#6f8e89',
  steel: '#9aa6b8', steelSh: '#7a879a', bottle: 'rgba(200,232,255,0.55)', cap: '#3c7ad6', candle: '#f4e9d0', flame: '#ffd36b', flameIn: '#fff3c4',
  frame: '#f2efe6', frameSh: '#d4cfc2', curtain: '#d9604a', curtainSh: '#b84a38', bucket: '#4f86c6', bucketSh: '#3c6aa3', bowl: '#d9433b',
};

// —— the box of the flat: walls, floor, ceiling, the cut slabs, the doorway ——
export function drawShell(t, o = {}) {
  const { x0, x1, ceil, slab } = ROOM;
  rect(x0 - 60, ceil - slab, x1 - x0 + 120, slab, C.slab); rect(x0 - 60, ceil - 10, x1 - x0 + 120, 10, C.slabEdge);
  rect(x0 - 60, 0, x1 - x0 + 120, slab + 40, C.slab); rect(x0 - 60, 0, x1 - x0 + 120, 10, C.slabEdge);
  rect(x0 - 60, ceil - slab, 60, -ceil + slab + 110, C.slab); rect(x1, ceil - slab, 60, -ceil + slab + 110, C.slab);
  // bathroom tiles
  rect(x0, ceil, PART.x0 - x0, -ceil, C.tile);
  for (let y = ceil; y < 0; y += 60) rect(x0, y, PART.x0 - x0, 3, C.grout);
  for (let x = x0; x < PART.x0; x += 60) rect(x, ceil, 3, -ceil, C.grout);
  rect(x0, -260, PART.x0 - x0, 40, C.tile2);
  rect(x0, -8, PART.x0 - x0, 8, C.bathFloor);
  // kitchen wall: warm paper with a small pattern, a skirting
  rect(PART.x1, ceil, x1 - PART.x1, -ceil, C.wall);
  for (let y = ceil + 40; y < 0; y += 80) for (let x = PART.x1 + 30 + ((y / 80) % 2) * 40; x < x1; x += 80) ell(x, y, 5, 5, C.paperDot);
  rect(PART.x1, -30, x1 - PART.x1, 30, C.wallSh);
  // ceiling strip, partition with the doorway
  rect(x0, ceil, x1 - x0, 24, C.ceil);
  rect(PART.x0, ceil, PART.x1 - PART.x0, PART.door - ceil, C.wallSh);
  rect(PART.x0 - 14, PART.door - 14, PART.x1 - PART.x0 + 28, 18, C.frameSh);
  // the ceiling lamp (off), a socket with the router's dead lights
  limb([[LAMP[0], ceil], [LAMP[0], ceil + 70]], 4, '#555a6a', false);
  fill(polyPath([[LAMP[0] - 50, ceil + 110], [LAMP[0] - 22, ceil + 70], [LAMP[0] + 22, ceil + 70], [LAMP[0] + 50, ceil + 110]]), '#e06f4a');
  ell(LAMP[0], ceil + 112, 16, 9, o.lampOn ? '#fff1c0' : '#c9c2b0');
  rrect(-60, -460, 70, 30, 6, '#33384a'); for (let i = 0; i < 3; i++) ell(-44 + i * 18, -445, 4, 4, o.power ? '#3ddc84' : '#4a5064');
}

// —— the window: the frame, the sill, and what is outside (night: the dark city; day: morning) ——
export function drawWindow(t, o = {}) {
  const { x0, x1, y0, y1 } = WIN, day = o.day ?? 0;
  rect(x0 - 24, y0 - 24, x1 - x0 + 48, y1 - y0 + 48, C.frame);
  inside(rrPath(x0, y0, x1 - x0, y1 - y0, 2), () => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, day ? '#bcd0d6' : '#0b1222'); gr.addColorStop(1, day ? '#efe6cc' : '#1d2a48');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (!day) for (let i = 0; i < 14; i++) ell(x0 + hash(i * 3.1) * (x1 - x0), y0 + hash(i * 5.7) * 120, 1.8, 1.8, rgba('#e8eeff', 0.7));
    for (let i = 0; i < 6; i++) {                 // blocks across the street, a few phone screens in them
      const bx = x0 - 30 + i * 62, bh = 110 + 120 * hash(i * 2.7), c = day ? mix('#8ea0aa', '#ffffff', 0.15 * hash(i)) : '#141c30';
      rect(bx, y1 - bh, 56, bh, c);
      for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) {
        const wx = bx + 8 + k * 16, wy = y1 - bh + 12 + r * 22, s = i * 31 + r * 7 + k;
        rect(wx, wy, 9, 11, day ? '#6f8591' : hash(s) < 0.07 ? rgba('#9fd0ff', 0.6 + 0.3 * noise(t * 3 + s, 1)) : '#0e1424');
      }
    }
  });
  rect((x0 + x1) / 2 - 7, y0, 14, y1 - y0, C.frame); rect(x0, (y0 + y1) / 2 - 40, x1 - x0, 12, C.frame);
  rect(x0 - 40, y1 + 6, x1 - x0 + 80, 22, C.frameSh); rect(x0 - 40, y1 + 6, x1 - x0 + 80, 8, C.frame);
  // the curtain on the right, it can catch fire (o.fire 0…1: flames climb it)
  const cx = x1 + 24, sway = 6 * Math.sin(t * 1.3);
  fill(smoothPath([[cx - 70, y0 - 50], [cx + 30, y0 - 50], [cx + 34 + sway, y1 + 80], [cx - 36 + sway, y1 + 90], [cx - 70 + sway * 0.6, y1 - 60]]), C.curtain);
  for (let i = 0; i < 3; i++) limb([[cx - 48 + i * 24, y0 - 40], [cx - 44 + i * 24 + sway, y1 + 70]], 8, C.curtainSh, false);
  rect(x0 - 70, y0 - 64, x1 - x0 + 160, 12, '#8a6a4a');
  const fire = clamp(o.fire ?? 0);
  if (fire > 0.01) flames(cx - 20 + sway, y1 + 80, 70, 260 * fire, t, fire);
}
// a tongue of flames rising from (x, y), width w, height h
export function flames(x, y, w, h, t, a = 1) {
  for (let i = 0; i < 6; i++) {
    const u = i / 5, fx = x + (u - 0.5) * w, fh = h * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (0.85 + 0.15 * noise(t * 9 + i * 3, i));
    const sway = 14 * noise(t * 6 + i, 7);
    fill(smoothPath([[fx - w * 0.22, y], [fx + sway * 0.4, y - fh * 0.55], [fx + sway, y - fh], [fx + w * 0.22, y]]), mix('#ff6a2a', '#ffb53d', u * 0.6), a);
  }
  for (let i = 0; i < 4; i++) { const u = i / 3, fx = x + (u - 0.5) * w * 0.6, fh = h * 0.5 * (0.8 + 0.2 * noise(t * 11 + i, 3)); fill(smoothPath([[fx - w * 0.12, y], [fx + 6 * noise(t * 8 + i, 2), y - fh], [fx + w * 0.12, y]]), '#ffe28a', a); }
}

// —— the bath: tub, water level 0…1, the mixer tap; running: the stream 0…1 (1 = full flow, it sputters below ~0.3) ——
export function drawTub(t, o = {}) {
  const { x0, x1, rim, in0, in1, bot } = TUB, lv = clamp(o.level ?? 0), run = clamp(o.run ?? 0);
  // the tap on the wall and its stream
  limb([[BTAP.x + 60, BTAP.y], [BTAP.x, BTAP.y]], 20, C.chrome, false);
  rrect(BTAP.x - 18, BTAP.y - 40, 36, 60, 10, C.chrome); rrect(BTAP.x - 30, BTAP.y - 56, 60, 16, 6, C.chromeHi);
  limb([[BTAP.x, BTAP.y + 10], [BTAP.x - 26, BTAP.y + 20], [BTAP.spout[0], BTAP.spout[1]]], 18, C.chrome);
  const wy = lerp(bot - 6, rim + 26, lv);
  stream(BTAP.spout[0], BTAP.spout[1] + 6, wy, run, t, 22);
  // tub body (white) with the water inside seen over the rim as a band
  fill(smoothPath([[x0, rim], [x1, rim], [x1 - 6, -60], [x1 - 40, -12], [x0 + 40, -12], [x0 + 6, -60]]), C.white);
  inside(smoothPath([[x0, rim], [x1, rim], [x1 - 6, -60], [x1 - 40, -12], [x0 + 40, -12], [x0 + 6, -60]]), () => { rect(x0, -70, x1 - x0, 60, C.whiteSh); });
  for (const fx of [x0 + 50, x1 - 50]) { ell(fx, -8, 16, 10, '#c9a24a'); }
  rect(x0 - 10, rim - 14, x1 - x0 + 20, 22, C.white); rect(x0 - 10, rim + 4, x1 - x0 + 20, 6, C.whiteSh);
  // the water line just under the rim (a cut-away window on the tub's side shows the level)
  const win = rrPath(in0 + 30, rim + 30, in1 - in0 - 60, bot - rim - 50, 22);
  fill(win, '#e8e6e0');
  inside(win, () => {
    if (lv > 0.01) { rect(in0, wy, in1 - in0, bot - wy + 40, C.water); rect(in0, wy, in1 - in0, 8, '#a8d8f4'); for (let i = 0; i < 4; i++) ell(in0 + 60 + ((t * 70 + i * 110) % (in1 - in0 - 40)), wy + 3, 26, 5, rgba('#ffffff', 0.5)); }
  });
  g.lineWidth = 6; g.strokeStyle = col(C.whiteSh); g.stroke(win);
}
// a falling stream of water from (x, y0) down to y1; k 0…1 its flow (thin and broken when low)
export function stream(x, y0, y1, k, t, w = 20) {
  if (k <= 0.01 || y1 <= y0) return;
  if (k > 0.35) {
    limb([[x, y0], [x + 2 * noise(t * 20, 1), y1]], w * k, C.water, false);
    limb([[x - w * 0.15, y0 + 6], [x - w * 0.15, y1 - 6]], w * 0.25 * k, '#c8ecff', false);
    for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4, u = (t * 4 + i * 0.3) % 1; ell(x + Math.cos(a) * 24 * u * (i % 2 ? 1 : -1), y1 - 14 * Math.sin(Math.PI * u), 5, 5, C.water, 0, 1 - u); }
  } else {                                           // spluttering: drops and short bursts
    for (let i = 0; i < 5; i++) { const u = (t * 2.2 + i / 5) % 1, on = hash(Math.floor(t * 2.2 + i / 5) * 7 + i) < k * 2.5; if (on) ell(x, lerp(y0, y1, u), w * 0.22, w * 0.4, C.water); }
  }
}

// —— the toilet (side view) with its cistern; swirl 0…1 water spinning in the bowl after a flush ——
export function drawToilet(t, o = {}) {
  const [cx, cy, cw, ch] = TOILET.cist, x = TOILET.x;
  rrect(cx, cy, cw, ch, 12, C.white); rect(cx, cy + ch - 18, cw, 18, C.whiteSh); rrect(cx + cw - 30, cy + 20, 20, 12, 5, C.chrome);
  limb([[cx + 30, cy + ch], [cx + 30, -170]], 22, C.whiteSh, false);
  fill(smoothPath([[x - 110, -170], [x + 90, -170], [x + 84, -120], [x + 40, -78], [x + 26, -6], [x - 50, -6], [x - 60, -78], [x - 104, -120]]), C.white);
  inside(smoothPath([[x - 110, -170], [x + 90, -170], [x + 84, -120], [x + 40, -78], [x + 26, -6], [x - 50, -6], [x - 60, -78], [x - 104, -120]]), () => rect(x - 120, -110, 230, 120, C.whiteSh));
  rrect(x - 116, -186, 214, 20, 8, C.white);
  const sw = clamp(o.swirl ?? 0);
  if (sw > 0.01) { for (let i = 0; i < 3; i++) { const a = t * 12 + i * 2.1; ell(x - 10 + 40 * Math.cos(a) * sw, -178, 18 * sw, 6, C.water); } }
}

// —— the fridge: two white doors, the freezer below; open 0…1 swings the top door (a crack of cold light) ——
export function drawFridge(t, o = {}) {
  const { x0, x1, top, split } = FRIDGE;
  rrect(x0, top, x1 - x0, -top, 18, C.fridge);
  rect(x1 - 30, top + 10, 24, -top - 20, C.fridgeSh);
  rect(x0, split - 4, x1 - x0, 8, C.fridgeSh);
  rrect(x1 - 52, top + 120, 14, 150, 7, C.chrome); rrect(x1 - 52, split + 40, 14, 100, 7, C.chrome);
  // magnets and a drawing on the door
  rrect(x0 + 40, top + 90, 90, 110, 4, '#fff7e0'); limb([[x0 + 60, top + 170], [x0 + 85, top + 120], [x0 + 110, top + 170]], 6, '#3e9a4a', false); ell(x0 + 85, top + 110, 12, 12, '#ffb84d');
  ell(x0 + 85, top + 92, 8, 8, '#d9433b'); ell(x0 + 60, top + 260, 14, 14, '#3c7ad6'); ell(x0 + 104, top + 300, 12, 12, '#ffd23f');
  const op = clamp(o.open ?? 0);
  if (op > 0.01) { rect(x1 - 6, top + 14, 30 * op, split - top - 24, 'rgba(210,240,255,0.9)'); }
}

// —— the counter: cabinets, sink, the tap (run 0…1), the pots and bottles with their water (fills[i] 0…1) ——
export function drawCounter(t, o = {}) {
  const { x0, x1, top } = COUNTER, fills = o.fills ?? [];
  rect(x0, top - 340, x1 - x0, 160, C.cab); for (let i = 1; i < 3; i++) rect(x0 + i * (x1 - x0) / 3 - 2, top - 340, 4, 160, C.cabSh);
  rect(x0, top - 190, x1 - x0, 10, C.cabSh);
  rect(x0, top + 20, x1 - x0, -top - 50, C.cab);
  for (let i = 1; i < 3; i++) rect(x0 + i * (x1 - x0) / 3 - 2, top + 30, 4, -top - 70, C.cabSh);
  for (let i = 0; i < 3; i++) rrect(x0 + i * (x1 - x0) / 3 + 40, top + 60, 50, 12, 6, C.cabSh);
  rect(x0 - 16, top, x1 - x0 + 32, 26, C.wood); rect(x0 - 16, top + 18, x1 - x0 + 32, 8, C.woodSh);
  // the tap over the sink
  limb([KTAP.base, [KTAP.x, -400], [KTAP.x + 30, -420], KTAP.spout], 16, C.chrome);
  rrect(KTAP.x - 14, -330, 28, 34, 6, C.chrome); limb([[KTAP.x - 30, -340], [KTAP.x + 6, -340]], 10, C.chromeHi, false);
  stream(KTAP.spout[0], KTAP.spout[1] + 8, o.streamTo ?? top - 4, clamp(o.run ?? 0), t, 14);
  // pots (steel, the water shows as a blue band at the rim when full) and bottles (clear, the water rises inside)
  POTS.forEach((p, i) => {
    const y = top, f = clamp(fills[i] ?? 0);
    rrect(p.x - p.w / 2, y - p.h, p.w, p.h, 10, C.steel); rect(p.x - p.w / 2, y - p.h + 14, p.w, 8, C.steelSh);
    limb([[p.x - p.w / 2 - 14, y - p.h + 14], [p.x - p.w / 2, y - p.h + 14]], 10, C.steelSh, false); limb([[p.x + p.w / 2, y - p.h + 14], [p.x + p.w / 2 + 14, y - p.h + 14]], 10, C.steelSh, false);
    if (f > 0.02) ell(p.x, y - p.h + 2, p.w / 2 - 6, 8 * f, C.water);
  });
  BOTTLES.forEach((b, i) => {
    const y = top, f = clamp(fills[POTS.length + i] ?? 0), bw = 34, bh = 92;
    if (o.taken === i) return;
    bottle(b.x, y, f, 1);
  });
}
export function bottle(x, y, f, s = 1) {
  const bw = 34 * s, bh = 92 * s;
  inside(rrPath(x - bw / 2, y - bh, bw, bh, 9 * s), () => { rect(x - bw / 2, y - bh * f, bw, bh * f, C.water); });
  fill(rrPath(x - bw / 2, y - bh, bw, bh, 9 * s), C.bottle);
  rect(x - bw / 2 + 5 * s, y - bh + 10 * s, 5 * s, bh - 20 * s, 'rgba(255,255,255,0.6)');
  rect(x - 8 * s, y - bh - 14 * s, 16 * s, 16 * s, C.cap);
}

// —— the table by the window with a chair; the candle (lit 0…1) ——
export function drawTable(t, o = {}) {
  const { x0, x1, top } = TABLE;
  rect(x1 - 120, -380, 20, 380, C.woodSh); rect(x1 - 200, -200, 120, 18, C.woodSh); rect(x1 - 196, -200, 14, 200, C.woodSh);
  rect(x0, top, x1 - x0, 22, C.wood); rect(x0 + 20, top + 22, 18, -top - 22, C.woodSh); rect(x1 - 38, top + 22, 18, -top - 22, C.woodSh);
  rect(x0 + 20, top + 22, x1 - x0 - 40, 10, C.woodSh);
  if (o.candle !== false) candle(CANDLE[0], CANDLE[1], o.lit ?? 0, t, o.lean ?? 0);
}
export function candle(x, y, lit, t, lean = 0) {
  rrect(x - 30, y - 10, 60, 10, 4, '#b9b2a2');
  rect(x - 13, y - 90, 26, 80, C.candle); rect(x - 13, y - 90, 8, 80, '#fffaf0');
  limb([[x, y - 90], [x, y - 102]], 3, '#3a2f2a', false);
  if (lit > 0.01) {
    const fl = 1 + 0.12 * noise(t * 12, 4), sw = lean * 30 + 3 * noise(t * 9, 2);
    ell(x + sw * 0.5, y - 124, 34 * lit, 40 * lit, 'rgba(255,200,90,0.25)');
    fill(smoothPath([[x - 9 * lit, y - 102], [x + sw, y - 102 - 38 * lit * fl], [x + 9 * lit, y - 102], [x, y - 96]]), C.flame);
    fill(smoothPath([[x - 4 * lit, y - 102], [x + sw * 0.6, y - 102 - 18 * lit * fl], [x + 4 * lit, y - 102]]), C.flameIn);
  }
}

// —— props: the bucket (fill 0…1, tilt rad round its rim), the dog's bowl, the torch on the table ——
export function drawBucket(x, y, s, f = 0, tilt = 0) {           // (x, y) = the top of the handle, where the hand holds it
  g.save(); g.translate(x, y); g.rotate(tilt);
  fill(polyPath([[-60 * s, 62 * s], [60 * s, 62 * s], [46 * s, 182 * s], [-46 * s, 182 * s]]), C.bucket);
  rect(-60 * s, 62 * s, 120 * s, 12 * s, C.bucketSh);
  if (f > 0.02) ell(0, 64 * s, 54 * s, 8 * s, C.water);
  g.lineWidth = 5 * s; g.strokeStyle = col('#3a3f52'); g.beginPath(); g.arc(0, 62 * s, 62 * s, Math.PI, TAU); g.stroke();
  g.restore();
}
// the lip of the bucket a pour runs from (world), for the same x, y, s, tilt
export const bucketLip = (x, y, s, tilt) => [x + Math.cos(tilt) * 60 * s - Math.sin(tilt) * 62 * s, y + Math.sin(tilt) * 60 * s + Math.cos(tilt) * 62 * s];
export function drawBowl(t, f = 1) {
  const [x, y] = BOWL;
  fill(polyPath([[x - 50, y - 34], [x + 50, y - 34], [x + 40, y], [x - 40, y]]), C.bowl);
  if (f > 0.02) ell(x, y - 34, 44, 6 * f, C.water);
}
export const COLORS = C;
