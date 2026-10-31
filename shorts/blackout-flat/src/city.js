// Outside: the city at dusk and our panel tower in front. Every window is lit or dark by a seeded hash; the blackout
// runs as a wave from the far end of the city to us, the tower going dark from the ground up, our window on the 20th
// floor last. After it only a few phone screens glow, and in our window the torch the dog holds. Layers: sky (f 0),
// far skyline (FAR), near blocks (MID), the tower and the street (1). Day 3 is the same city in morning light.
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside, col, MONO } from './flat.js';
import { lerp, clamp, ease, hash, noise, TAU, rgba, mix } from './lib.js';
import { view } from './camera.js';

export const F = { FAR: 0.32, MID: 0.62 };
export const TOWER = { x0: -340, x1: 340, fh: 96, floors: 22, cols: [-255, -153, -51, 51, 153, 255], ww: 62, wh: 54 };
export const WIN20 = { col: 3, floor: 20 };
export const winCenter = (col, floor) => [TOWER.cols[col], -(floor - 1) * TOWER.fh - TOWER.fh * 0.55];
const NIGHTC = { sky0: '#0a1020', sky1: '#1b2846', glow: '#4a3a52', far: '#18213a', mid: '#1f2a46', tower: '#2b3758', seam: '#25304d', frame: '#1b2338', dark: '#0f1626', street: '#141a2a', walk: '#1c2338' };
const DAYC = { sky0: '#adc0c2', sky1: '#dfdec6', glow: '#f3e7c8', far: '#9fb0b6', mid: '#8a9ca5', tower: '#c9c3b2', seam: '#b7b09e', frame: '#8b8676', dark: '#5f6b74', street: '#6d6f68', walk: '#8a8b82' };
const WARM = ['#ffb84d', '#ffc36b', '#ffd08a', '#f7a640'];

// is window i (any layer) lit at t: lit by default if its hash says so, off once the wave passes it (off = its time)
const litAt = (seed, off, t) => hash(seed) < 0.55 && t < off;

// the far and near skyline: rows of blocks with window grids; wave(x, layer) gives the time a window goes out
function blocks(layer, n, x0, x1, hMin, hMax, colr, wsz, t, wave, day) {
  let x = x0, i = 0;
  while (x < x1) {
    const bw = 160 + 220 * hash(layer * 31 + i * 1.7), bh = hMin + (hMax - hMin) * hash(layer * 17 + i * 2.3);
    const c = mix(colr, day ? '#ffffff' : '#000000', 0.06 * hash(i * 4.1));
    rect(x, -bh, bw - 18, bh + 10, c);
    if (!day) {
      const cols = Math.floor((bw - 40) / (wsz * 2.2)), rows = Math.floor((bh - 40) / (wsz * 2.6));
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const seed = layer * 1000 + i * 97 + r * 13 + k, wx = x + 20 + k * wsz * 2.2, wy = -bh + 30 + r * wsz * 2.6;
        if (litAt(seed, wave(wx, layer) + 0.25 * hash(seed + 0.5), t)) rect(wx, wy, wsz * 1.2, wsz * 1.4, WARM[seed % 4]);
        else if (t > wave(wx, layer) && hash(seed * 7.3) < 0.035) rect(wx, wy, wsz * 1.2, wsz * 1.4, rgba('#9fd0ff', 0.55 + 0.3 * noise(t * 2 + seed, 2)));
      }
    } else {
      const cols = Math.floor((bw - 40) / (wsz * 2.2)), rows = Math.floor((bh - 40) / (wsz * 2.6));
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) rect(x + 20 + k * wsz * 2.2, -bh + 30 + r * wsz * 2.6, wsz * 1.2, wsz * 1.4, mix(colr, '#4e5f6a', 0.5));
    }
    x += bw; i++;
  }
}

// o: { t0 (blackout start), day (0/1), cam, home (0…1 the torch in our window), inside (draw callback for our window close) }
export function drawCity(t, cam, o) {
  const day = o.day ?? 0, C = day ? DAYC : NIGHTC, t0 = o.t0 ?? 1e9;
  const out = clamp((t - t0) / 1.2);                          // how far the blackout has gone (for the sky glow)
  // sky
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, C.sky0); gr.addColorStop(0.75, C.sky1); gr.addColorStop(1, day ? C.glow : mix(C.glow, C.sky1, out));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  view(cam, 0.08);
  if (!day) {
    for (let i = 0; i < 90; i++) { const x = -1400 + hash(i * 3.3) * 2800, y = -2600 + hash(i * 7.7) * 1500, a = 0.25 + 0.6 * out * hash(i * 1.9); ell(x, y, 2.4, 2.4, rgba('#e8eeff', a * (0.7 + 0.3 * Math.sin(t * 3 + i)))); }
    ell(560, -2250, 70, 70, '#f1ead2'); ell(590, -2270, 62, 62, C.sky0, 0, 0.0);
  } else { ell(-420, -1700, 120, 120, '#fff6dc'); ell(-420, -1700, 200, 200, 'rgba(255,246,220,0.25)'); }
  // the wave: far left of the city first, our tower last
  const wave = (x, layer) => t0 + (layer === 0 ? 0 : layer === 1 ? 0.25 : 0.5) + clamp((x + 2600) / 5200) * 0.55;
  view(cam, F.FAR); blocks(0, 40, -3600, 3600, 300, 900, C.far, 7, t, wave, day);
  view(cam, F.MID); blocks(1, 30, -3000, 3000, 500, 1500, C.mid, 11, t, wave, day);
  // street level: ground, trees, lamps (go out with the wave), a car with its headlights still on
  view(cam, 1);
  rect(-4000, 0, 8000, 2400, C.street); rect(-4000, 0, 8000, 26, C.walk);
  for (const lx of [-1100, -620, 620, 1100]) {
    rect(lx - 6, -260, 12, 260, day ? '#5a5f63' : '#2a3148'); rect(lx - 6, -262, 70, 10, day ? '#5a5f63' : '#2a3148');
    const on = !day && t < wave(lx, 2) + 0.1;
    rrect(lx + 40, -258, 40, 16, 6, on ? '#ffe2a0' : day ? '#a8acaa' : '#3a4157');
    if (on) { g.save(); g.globalAlpha = 0.16; poly([[lx + 44, -244], [lx + 76, -244], [lx + 160, 0], [lx - 40, 0]], '#ffd890'); g.restore(); }
  }
  for (const [tx, s] of [[-900, 1], [-760, 0.8], [820, 0.9], [960, 1.1]]) { rect(tx - 8, -120 * s, 16, 120 * s, day ? '#5b4a3a' : '#141826'); ell(tx, -170 * s, 90 * s, 100 * s, day ? '#6f8a5a' : '#162033'); ell(tx + 40 * s, -130 * s, 60 * s, 60 * s, day ? '#5d7a4c' : '#121a2c'); }
  // the tower
  const T = TOWER, top = -T.floors * T.fh;
  rect(T.x0 - 20, top - 40, T.x1 - T.x0 + 40, 40, C.frame);
  rect(T.x0 + 60, top - 120, 180, 80, C.frame); rect(T.x1 - 120, top - 90, 60, 50, C.frame);
  rect(T.x0, top, T.x1 - T.x0, -top, C.tower);
  for (let f = 1; f < T.floors; f++) rect(T.x0, -f * T.fh - 3, T.x1 - T.x0, 6, C.seam);
  for (const x of [-204, -102, 0, 102, 204]) rect(x - 3, top, 6, -top, C.seam);
  rect(-50, -140, 100, 140, C.frame); rrect(-34, -120, 68, 120, 6, day ? '#5d6670' : '#0f1424');
  for (let f = 1; f <= T.floors; f++) for (let k = 0; k < 6; k++) {
    const [cx, cy] = winCenter(k, f), x = cx - T.ww / 2, y = cy - T.wh / 2, seed = 5000 + f * 7 + k;
    rect(x - 5, y - 5, T.ww + 10, T.wh + 10, C.frame);
    const ours = f === WIN20.floor && k === WIN20.col;
    const off = t0 + 0.75 + (f / T.floors) * 0.6 + 0.12 * hash(seed + 3) + (ours ? 0.25 : 0);
    let c = day ? '#7f95a3' : C.dark;
    if (!day && (litAt(seed, off, t) || (ours && t < off))) c = WARM[seed % 4];
    rect(x, y, T.ww, T.wh, c);
    if (!day && t > off && !ours && hash(seed * 3.1) < 0.06) ell(cx + 10 * hash(seed), cy + 8, 7, 7, rgba('#9fd0ff', 0.7 + 0.3 * noise(t * 3 + seed, 1)));
    if (day) { rect(x, y, T.ww, 8, '#9db0bc'); rect(x + T.ww / 2 - 2, y, 4, T.wh, C.frame); }
    else rect(x + T.ww / 2 - 2, y, 4, T.wh, rgba(C.frame, 0.6));
    if (ours && (o.home ?? 0) > 0 && t > off) o.inside?.(x, y, T.ww, T.wh, t);
  }
  // balconies stripes every second column pair
  for (let f = 2; f <= T.floors; f++) rect(T.x0 + 10, -(f - 1) * T.fh - 14, 120, 10, C.seam);
  // a car parked by the entrance with headlights on
  const cx = 520; rrect(cx - 110, -70, 220, 50, 16, day ? '#a33a2f' : '#2d3550'); rrect(cx - 70, -108, 130, 46, 14, day ? '#a33a2f' : '#2d3550');
  ell(cx - 60, -18, 22, 22, '#0d0f16'); ell(cx + 60, -18, 22, 22, '#0d0f16');
  if (!day) { ell(cx - 108, -52, 10, 8, '#fff2c0'); g.save(); g.globalAlpha = 0.14; poly([[cx - 110, -56], [cx - 600, -110], [cx - 600, 10], [cx - 110, -44]], '#fff2c0'); g.restore(); }
}
