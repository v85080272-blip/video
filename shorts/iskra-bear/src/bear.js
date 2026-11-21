// «Приключения Искры» №1: the autumn forest and the bear, in flat shapes with the Poly Haven detail maps (flat.js TEX).
// The forest by day in late autumn (the episode is in November): a warm haze, far firs, birches in yellow, dark firs,
// a dirt path to the horizon, fallen leaves; layers move at their own speed (pan) so a sideways step reads.
// The bear: front view on all fours (head down sniffing → up looking), rising onto its hind legs (stand 0…1, the nose
// up, sniffing the air), and a side view walking away. The cub: a head peeking out of a bush.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, fill, poly, smoothPath, polyPath, ellPath, spiky, resample, sample, texArea } from './flat.js';

export const HOR = 760;                        // the horizon: where the path meets the far forest
const FUR = '#6e4527', FUR_D = '#4f301a', FUR_L = '#8a5a34', MUZ = '#c09468', NOSE = '#1b1310', EAR_IN = '#3a2214';

function grad(stops, y0, y1, x0 = -200, x1 = 1280) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
function fir(x, y, h, c, d) {
  const w = h * 0.4;
  rect(x - h * 0.025, y - h * 0.1, h * 0.05, h * 0.12, '#5a3d24');
  for (let i = 0; i < 5; i++) { const y0 = y - h * 0.08 - i * h * 0.18, ww = w * (1 - i * 0.17); poly([[x - ww / 2, y0], [x - ww * 0.1, y0 - h * 0.06], [x + ww / 2, y0], [x, y0 - h * 0.3]], i % 2 ? c : d); }
}
function birch(x, y, h, seed, leaf = ['#f2b33d', '#e8932f', '#f6cf5a']) {
  const w = h * 0.035;
  const tr = polyPath([[x - w, y], [x - w * 0.6, y - h], [x + w * 0.6, y - h], [x + w, y]]);
  fill(tr, '#ece6da'); texArea(tr, 'bark', 0.8, 0.35);
  for (let i = 0; i < 7; i++) { const yy = y - h * (0.1 + 0.12 * i) - 10 * hash(seed + i); rect(x - w * 0.9, yy, w * (0.8 + hash(seed + i * 3)), h * 0.012, '#2b2622'); }
  for (let i = 0; i < 9; i++) {
    const a = hash(seed * 7 + i) * TAU, r = h * 0.16 * Math.sqrt(hash(seed + i * 11));
    ell(x + Math.cos(a) * r * 1.3, y - h * 0.86 + Math.sin(a) * r, h * 0.11, h * 0.08, leaf[i % 3]);
  }
}
// the forest; pan: px the camera moved right (layers shift left at their own speed); haze 0…1
export function autumnForest(t, o = {}) {
  const pan = o.pan ?? 0;
  grad([[0, '#bcdcf0'], [0.55, '#e9e2cf'], [1, '#f2d9ac']], 0, HOR + 20);
  g.save(); g.translate(-pan * 0.15, 0);                                   // far firs in the haze
  for (let i = 0; i < 18; i++) fir(-260 + i * 95 + 30 * hash(i), HOR + 10, 230 + 70 * hash(i + 3), '#8ea3a0', '#7f9592');
  g.restore();
  g.save(); g.translate(-pan * 0.35, 0);                                   // the middle: birches in yellow, dark firs
  for (let i = 0; i < 9; i++) birch(-220 + i * 190 + 50 * hash(i + 40), HOR + 40, 420 + 80 * hash(i + 41), i + 5);
  for (let i = 0; i < 8; i++) fir(-140 + i * 210 + 60 * hash(i + 60), HOR + 50, 470 + 90 * hash(i + 61), '#2f5d43', '#264d38');
  g.restore();
  g.save(); g.globalAlpha = 0.16;                                          // light through the trees
  for (let i = 0; i < 5; i++) { const x = -260 + i * 330 + 30 * Math.sin(t * 0.35 + i) - pan * 0.3; poly([[x, 0], [x + 110, 0], [x + 400, HOR + 300], [x + 250, HOR + 300]], '#fff6d8'); }
  g.restore();
  // the ground: autumn grass, a dirt path to the horizon, fallen leaves
  const gp = polyPath([[-200, HOR], [1280, HOR], [1280, 1920], [-200, 1920]]);
  const gg = g.createLinearGradient(0, HOR, 0, 1500); gg.addColorStop(0, '#9c8a4a'); gg.addColorStop(1, '#7a6a33'); g.fillStyle = gg; g.fill(gp);
  texArea(gp, 'grass', 0.6, 0.6);
  const px = 540 - pan * 0.6;
  const edge = (sx, w0, w1) => Array.from({ length: 9 }, (_, i) => { const v = i / 8, y = HOR + v * v * 840; return [px + sx * lerp(w0, w1, v) + 14 * Math.sin(v * 3), y]; });
  const L = edge(-1, 16, 300), R = edge(1, 16, 300);
  const path = polyPath([...L, ...R.reverse()]);
  fill(path, '#9a7a52'); texArea(path, 'concrete', 0.9, 0.35);
  const L2 = edge(-1, 4, 110), R2 = edge(1, 4, 110);
  fill(polyPath([...L2, ...R2.reverse()]), '#ad8d63', 0.5);
  for (let i = 0; i < 70; i++) {                                           // leaves, bigger nearer
    const yy = HOR + 15 + Math.pow(hash(i + 300), 1.6) * 900, k = 0.4 + (yy - HOR) / 900 * 1.4;
    const xx = ((hash(i + 200) * 1600 - 260 - pan * (0.4 + (yy - HOR) / 900)) % 1500 + 1500) % 1500 - 210;
    ell(xx, yy, 9 * k, 5 * k, ['#e0892c', '#c9622a', '#f0b13c', '#a8481f'][i % 4], hash(i) * 3);
  }
  // near trunks framing the shot
  g.save(); g.translate(-pan * 1.0, 0);
  for (const [x, w] of [[-40, 120], [1130, 140]]) { const tr = polyPath([[x - w / 2, -20], [x + w / 2, -20], [x + w / 2 + 10, 1300], [x - w / 2 - 10, 1300]]); fill(tr, '#4a3524'); texArea(tr, 'bark', 0.6, 0.7); }
  g.restore();
  if (o.haze) { g.save(); g.globalAlpha = o.haze; rect(-200, 0, 1480, 1920, '#f4ead8'); g.restore(); }
}

// a shaggy outline: a smooth closed curve with short fur spikes
function shag(pts, amp = 3.2, step = 5) {
  const s = resample(sample(pts, 8), step);
  return polyPath(spiky(s, () => amp, 3, 0, 1.6));
}
function furFill(path, c, tex = 0.45) { fill(path, c); texArea(path, 'fabric', 0.35, tex); }
function head(u, o = {}) {                                // a bear head in local units, centre (0, 0), facing us
  const up = o.up ?? 0, tilt = o.tilt ?? 0, blink = o.blink ?? 0;
  g.save(); g.rotate(tilt);
  for (const sx of [-1, 1]) { ell(sx * 17, -17, 8.5, 8.5, FUR_D); ell(sx * 17, -16, 4.6, 4.6, EAR_IN); }
  furFill(shag([[-23, 4], [-24, -10], [-15, -21], [0, -24], [15, -21], [24, -10], [23, 4], [13, 16], [0, 19], [-13, 16]], 2.4, 4.5), FUR);
  const my = 7 - up * 6;                                   // the muzzle rises when the nose goes up
  fill(smoothPath([[-12, my - 6], [0, my - 9], [12, my - 6], [13, my + 4], [0, my + 10], [-13, my + 4]]), MUZ);
  ell(0, my - 4 - up * 2, 6.2, 4.2, NOSE); ell(-1.8, my - 5.4 - up * 2, 1.8, 1, '#5c4a40');
  limb([[0, my], [0, my + 4]], 1.2, '#4a3020'); limb([[-4, my + 6], [0, my + 4], [4, my + 6]], 1.1, '#4a3020');
  for (const sx of [-1, 1]) {
    if (blink > 0.5) limb([[sx * 6.5, -5], [sx * 10.5, -5]], 1.4, '#140c08');
    else { ell(sx * 8.5, -5 - up * 1.5, 2.6, 2.8, '#140c08'); ell(sx * 8.5 - 0.8, -6 - up * 1.5, 0.9, 0.9, '#ffffff'); }
    limb([[sx * 5, -10], [sx * 12, -11]], 1.6, FUR_D);
  }
  g.restore();
}
// the bear, front view; x, y: the ground between its feet; h: the height on all fours in px.
// o.head 0 (nose down to the ground, sniffing) … 1 (head up); o.stand 0…1 onto the hind legs; o.tilt (rad); o.sniff 0…1 lines
export function bear(x, y, h, t, o = {}) {
  const u = h / 100, st = clamp(o.stand ?? 0), hd = o.head ?? 1, breath = 1 + 0.012 * Math.sin(t * 2.4);
  g.save(); g.translate(x, y); g.scale(u, u * breath);
  ell(0, 2, 62 - 20 * st, 7, 'rgba(0,0,0,0.25)');
  // the hind legs when standing; the hump behind the head on all fours
  const hump = 1 - st;
  if (hump > 0.01) { g.save(); g.globalAlpha = hump; furFill(shag([[-56, -40], [-50, -78], [-20, -98], [20, -98], [50, -78], [56, -40], [30, -30], [-30, -30]], 3.4, 6), FUR_D, 0.4); g.restore(); }
  if (st > 0.01) {
    for (const sx of [-1, 1]) { const lp = shag([[sx * 8, -60 * st], [sx * 34, -55 * st], [sx * 34, -2], [sx * 10, -2]], 2.6, 5); furFill(lp, FUR_D); ell(sx * 22, -2, 15, 6, '#2e1c10'); }
  }
  // the body: a chest between the front legs (all fours) → a tall body with a lighter belly (standing)
  const by = lerp(-46, -112, st), bry = lerp(28, 62, st), brx = lerp(36, 38, st);
  furFill(shag([[-brx, by + bry * 0.4], [-brx * 0.9, by - bry * 0.6], [0, by - bry], [brx * 0.9, by - bry * 0.6], [brx, by + bry * 0.4], [brx * 0.5, by + bry], [-brx * 0.5, by + bry]], 3, 6), FUR);
  if (st > 0.2) fill(smoothPath([[-20, by - 20], [20, by - 20], [24, by + 30], [0, by + 46], [-24, by + 30]]), FUR_L, clamp((st - 0.2) / 0.4) * 0.7);
  // the front legs: columns to the ground (all fours) → arms hanging at the chest (standing)
  for (const sx of [-1, 1]) {
    const top = [sx * lerp(24, 30, st), lerp(-58, -150, st)], paw = [sx * lerp(26, 24, st), lerp(-6, -98, st)];
    limb([top, [lerp(top[0], paw[0], 0.5) + sx * 3, lerp(top[1], paw[1], 0.5)], paw], lerp(21, 17, st), FUR);
    ell(paw[0], paw[1] - 2, 13 - 2 * st, 8, FUR_D);
    for (let c = -1; c <= 1; c++) limb([[paw[0] + c * 5, paw[1] + 3], [paw[0] + c * 6, paw[1] + 7]], 1.8, '#e8dcc8');
  }
  // the head: low and forward when sniffing the ground, up on top when standing
  const hy = lerp(lerp(-30, -66, hd), -178, st), sc = lerp(1, 0.95, st);
  g.save(); g.translate(0, hy + Math.sin(t * 1.7) * 1.2); g.scale(sc, sc); head(u, { up: Math.max(st, o.up ?? 0), tilt: o.tilt ?? 0, blink: o.blink ?? 0 }); g.restore();
  // sniffing the air: little curved lines from the nose
  const sn = o.sniff ?? 0;
  if (sn > 0.01) {
    g.save(); g.globalAlpha = sn * 0.85; g.lineWidth = 2.2; g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const ph = ((t * 1.6 + i / 3) % 1), r = 8 + ph * 26; g.globalAlpha = sn * 0.85 * (1 - ph); g.beginPath(); g.arc(0, hy - 2, r, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke(); }
    g.restore();
  }
  g.restore();
}
// the bear walking away, side view facing right (dir -1: left); x, y the ground under its middle; h the height to the hump
export function bearSide(x, y, h, t, o = {}) {
  const u = h / 100, dir = o.dir ?? 1, ph = (o.phase ?? t * 4.5);
  g.save(); g.translate(x, y); g.scale(u * dir, u);
  ell(0, 2, 70, 7, 'rgba(0,0,0,0.22)');
  const leg = (hx, hy, off, c) => { const a = 0.38 * Math.sin(ph + off), kx = hx + Math.sin(a) * 44, lift = Math.max(0, Math.cos(ph + off)) * 6;
    limb([[hx, hy], [lerp(hx, kx, 0.5), hy + 22], [kx, -lift - 4]], 18, c); ell(kx + 4, -lift - 3, 12, 6, '#2e1c10'); };
  leg(-38, -50, Math.PI, FUR_D); leg(30, -54, 0, FUR_D);                       // the far pair
  furFill(shag([[-66, -48], [-62, -78], [-30, -92], [16, -100], [40, -88], [58, -68], [52, -42], [20, -34], [-30, -32], [-60, -36]], 3.2, 6), FUR);
  leg(-44, -46, 0, FUR); leg(36, -50, Math.PI, FUR);                           // the near pair
  g.save(); g.translate(66, -64); g.rotate(0.1 + 0.03 * Math.sin(ph * 2));      // the head
  ell(-4, -16, 7, 7, FUR_D);
  furFill(shag([[-16, 8], [-16, -10], [0, -16], [14, -10], [26, -4], [32, 4], [26, 10], [8, 14]], 2.2, 4.5), FUR);
  fill(smoothPath([[14, -6], [30, -2], [33, 5], [22, 9], [12, 6]]), MUZ); ell(32, 0, 3.6, 3, NOSE); ell(8, -6, 2.2, 2.2, '#140c08');
  g.restore();
  g.restore();
}
// a bush; shake 0…1 (the leaves tremble); the cub's head peeks out of it: peek 0…1
export function bushCub(x, y, s, t, o = {}) {
  const sh = o.shake ?? 0, pk = clamp(o.peek ?? 0);
  g.save(); g.translate(x, y); g.scale(s, s);
  const jig = i => sh * 4 * Math.sin(t * 38 + i);
  const LEAF = ['#c9622a', '#e0892c', '#8a8a34', '#a8481f', '#6b7a2e', '#d9a03a'];
  const dome = (a0, n, yMin) => { for (let i = 0; i < n; i++) {
    const a = hash(i * 3 + a0) * Math.PI, r = Math.sqrt(hash(i * 7 + a0)), x0 = Math.cos(a) * 125 * r, y0 = -Math.sin(a) * 120 * r - 6;
    if (y0 < yMin) continue; ell(x0 + jig(i), y0 + jig(i + 3), 30, 22, LEAF[i % 6], hash(i) * 2); } };
  const back = smoothPath([[-135, 0], [-140, -60], [-95, -118], [0, -138], [95, -118], [140, -60], [135, 0]]);
  fill(back, '#4f5a28'); texArea(back, 'grass', 0.8, 0.5);
  dome(1, 46, -999);
  if (pk > 0.01) { g.save(); g.translate(10, lerp(-30, -150, pk)); g.scale(1.6, 1.6); head(1, { tilt: 0.12 * Math.sin(t * 2), blink: (t % 3.1) < 0.12 ? 1 : 0 }); g.restore(); }
  dome(50, 40, -70);
  g.restore();
}
// a big trunk for «не лезь на дерево», with a bear silhouette climbing it (the point: bears climb)
export function bigTree(x, y, h, t, o = {}) {
  const w = h * 0.14;
  const tr = polyPath([[x - w / 2 - 12, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 + 12, y]]);
  fill(tr, '#5a4030'); texArea(tr, 'bark', 0.7, 0.75);
  for (let i = 0; i < 4; i++) { const by = y - h * (0.35 + 0.2 * i); limb([[x + (i % 2 ? 1 : -1) * w * 0.4, by], [x + (i % 2 ? 1 : -1) * w * 1.8, by - 70]], 18, '#4a3424'); }
  const cl = o.climb ?? 0;
  if (cl > 0.01) {                                  // the climber: a dark bear shape hugging the trunk, moving up
    const cy = y - h * lerp(0.08, 0.36, cl);
    g.save(); g.translate(x + w * 0.62, cy); g.globalAlpha = clamp(cl * 4); g.rotate(-Math.PI / 2);
    bearSide(0, 0, h * 0.2, t, { dir: 1, phase: t * 7 });
    g.restore();
  }
}
