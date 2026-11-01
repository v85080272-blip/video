// The courtyard at night: a nine-storey panel block, fires and smoke on the horizon, sirens, zombies shambling below.
// World units = screen pixels at zoom 1 (the whole set fits 1080×1920).
import { g, solid, smoothPath, ellPath, rrPath, polyPath, stroke, line, glow, softShadow, vgrad, px, LIGHT } from '../draw.js';
import { TAU, clamp, lerp, rgba, mix, shade, hash, hash2, noise, noise2, fbm } from '../lib.js';
import { drawZombie } from '../zombie.js';

export const BLD = { x0: 70, x1: 1010, roof: 470, ground: 1440, floors: 9, cols: 8 };
export const floorH = (BLD.ground - BLD.roof - 30) / BLD.floors;
// our window: 9th floor, column 2 (0-based)
export function winRect(floor, col) {
  const cw = (BLD.x1 - BLD.x0) / BLD.cols;
  const y = BLD.ground - 30 - floor * floorH;          // top of that floor
  return [BLD.x0 + col * cw + cw * 0.18, y + floorH * 0.2, cw * 0.64, floorH * 0.56];
}
export const OUR = { floor: 9, col: 2 };

export function sky(t, fire = 1) {
  vgrad(-600, -800, 2280, 2400, [[0, '#070a1c'], [0.38, '#141537'], [0.52, '#2c1a3f'], [0.6, '#6b2534'], [0.66, '#b5432a'], [0.7, '#1b1424']]);
  // stars
  g.save();
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 3.1) * 1300 - 110, y = hash(i * 7.7) * 650 - 200, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    g.fillStyle = `rgba(220,225,255,${0.25 + 0.4 * tw * hash(i)})`; g.fillRect(x, y, 2.5, 2.5);
  }
  g.restore();
  // fire glow on the horizon
  glow(240, 1080, 520 * fire, '#ff6a1f', 0.45 * fire);
  glow(860, 1060, 420 * fire, '#ff4a1a', 0.38 * fire * (0.85 + 0.15 * Math.sin(t * 7.3)));
}

export function smoke(t, x, y, k = 1, seed = 0) {
  // a rising plume of soft dark blobs, lit orange from below
  for (let i = 0; i < 16; i++) {
    const life = ((t * 0.07 * k + i / 16) % 1);
    const by = y - life * 900, bx = x + life * 260 + noise(life * 3 + i, seed) * 70;
    const r = 70 + life * 240;
    const a = 0.55 * Math.sin(Math.PI * Math.min(1, life * 1.4)) * (1 - life * 0.4);
    const col = mix('#8a4a3e', '#3a3350', clamp(life * 1.4));
    g.save(); g.globalAlpha = a;
    const gr = g.createRadialGradient(bx, by, r * 0.2, bx, by, r);
    gr.addColorStop(0, col); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(bx - r, by - r, r * 2, r * 2); g.restore();
  }
}

function distantCity(t) {
  // two rows of distant blocks
  for (const [row, base, col, h0] of [[0, 1120, '#1a1530', 260], [1, 1180, '#141026', 180]]) {
    for (let i = 0; i < 9; i++) {
      const x = -100 + i * 150 + hash(i + row * 9) * 60, w = 110 + hash(i * 3 + row) * 70, h = h0 * (0.6 + hash(i * 5 + row) * 0.7);
      g.fillStyle = col; g.fillRect(x, base - h, w, h + 60);
      for (let r = 0; r < h / 26 - 1; r++) for (let c = 0; c < w / 22 - 1; c++) {
        const hv = hash2(i * 31 + c + row * 7, r);
        if (hv > 0.82) {
          const on = hash2(i + c, r + Math.floor(t * 0.5 + hv * 9)) > 0.15;
          g.fillStyle = on ? (hv > 0.95 ? 'rgba(140,180,255,.7)' : 'rgba(255,200,110,.75)') : 'rgba(0,0,0,0)';
          g.fillRect(x + 8 + c * 22, base - h + 10 + r * 26, 9, 12);
        }
      }
    }
  }
}

export function building(t, o = {}) {
  const { x0, x1, roof, ground, cols } = BLD;
  const W = x1 - x0, cw = W / cols;
  // roof structures (lift machine room, antennas) — the way out later
  solid(rrPath(x0 + W * 0.58, roof - 70, 170, 80, 6), '#3a3d58', [x0 + W * 0.58, roof - 70, 170, 80], { lw: 5, rimA: 0.2 });
  solid(rrPath(x0 + W * 0.18, roof - 52, 120, 60, 6), '#3a3d58', [x0 + W * 0.18, roof - 52, 120, 60], { lw: 5, rimA: 0.2 });
  for (const ax of [x0 + 120, x0 + W * 0.75, x0 + W * 0.9]) line([[ax, roof - 10], [ax, roof - 120]], 5, '#2a2c40');
  line([[x0 + W * 0.75 - 30, roof - 100], [x0 + W * 0.75 + 30, roof - 100]], 5, '#2a2c40');
  // facade
  const fac = rrPath(x0, roof, W, ground - roof + 20, 4);
  solid(fac, '#5b6283', [x0, roof, W, ground - roof], { shadowA: 0.25, hiA: 0.08, rimA: 0.15 });
  g.save(); g.clip(fac);
  // panel seams
  g.strokeStyle = 'rgba(20,20,40,.35)'; g.lineWidth = px(2.5);
  for (let f = 0; f <= BLD.floors; f++) { const y = ground - 30 - f * floorH; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  for (let c = 0; c <= cols; c++) { const x = x0 + c * cw; g.beginPath(); g.moveTo(x, roof); g.lineTo(x, ground); g.stroke(); }
  // police light wash (red/blue alternating from the left)
  const ph = Math.sin(t * TAU * 1.6);
  const pc = ph > 0 ? '#ff2a3a' : '#2f6bff';
  const pa = Math.abs(ph) * 0.35 * (o.police ?? 1);
  const gr = g.createLinearGradient(x0, 0, x0 + W * 0.7, 0);
  gr.addColorStop(0, rgba(pc, pa)); gr.addColorStop(1, rgba(pc, 0));
  g.fillStyle = gr; g.fillRect(x0, roof, W, ground - roof);
  // fire glow from below
  const gf = g.createLinearGradient(0, ground, 0, roof);
  gf.addColorStop(0, 'rgba(255,110,40,.28)'); gf.addColorStop(0.5, 'rgba(255,110,40,0)');
  g.fillStyle = gf; g.fillRect(x0, roof, W, ground - roof);
  g.restore();
  // windows and balconies
  for (let f = 1; f <= BLD.floors; f++) for (let c = 0; c < cols; c++) {
    const [wx, wy, ww, wh] = winRect(f, c);
    const hv = hash2(f * 13 + 1, c * 7 + 3);
    const ours = f === OUR.floor && c === OUR.col;
    let lit = ours ? 1 : hv > 0.72 ? 1 : 0;
    if ((o.power ?? 1) < 0.5) lit = 0;                                                        // the power dips
    if (!ours && hv > 0.72 && hash2(f, c + Math.floor(t * 0.7 + hv * 5)) < 0.12) lit = 0;    // lights going off
    const tv = !ours && hv > 0.93;
    const balcony = (c % 3 === 1);
    g.fillStyle = '#0c0f22'; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    if (lit) {
      const col = tv ? mix('#6fa2ff', '#b9d4ff', 0.5 + 0.5 * Math.sin(t * 17 + hv * 9)) : ours ? '#ffd27a' : '#ffbf63';
      g.fillStyle = col; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(wx, wy, ww, wh * 0.35);
      glow(wx + ww / 2, wy + wh / 2, ww * (ours ? 1.4 : 0.9), col, ours ? 0.45 : 0.22);
      if (ours && o.silhouette !== false) ourSilhouette(wx, wy, ww, wh, t);
    } else {
      const gr2 = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      gr2.addColorStop(0, '#1d2547'); gr2.addColorStop(1, '#0d1024');
      g.fillStyle = gr2; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,120,80,.10)'; g.fillRect(wx, wy + wh * 0.6, ww, wh * 0.4);   // fire reflection
    }
    // frame cross
    g.strokeStyle = '#2b2f45'; g.lineWidth = px(4);
    g.beginPath(); g.moveTo(wx + ww * 0.5, wy); g.lineTo(wx + ww * 0.5, wy + wh); g.moveTo(wx, wy + wh * 0.32); g.lineTo(wx + ww, wy + wh * 0.32); g.stroke();
    g.strokeStyle = LIGHT.ink; g.lineWidth = px(4); g.strokeRect(wx - 4, wy - 4, ww + 8, wh + 8);
    if (balcony && f < 9) {
      const by = wy + wh + 4, bx = wx - 14, bw = ww + 28;
      solid(rrPath(bx, by - 26, bw, 34, 3), hv > 0.5 ? '#6d7496' : '#7a6f86', [bx, by - 26, bw, 34], { lw: 4, rimA: 0.1, hiA: 0.05 });
    }
  }
  // entrances (two подъезды) with canopies and a lamp over each
  for (const ex of [x0 + W * 0.25, x0 + W * 0.75]) {
    solid(rrPath(ex - 60, ground - 150, 120, 150, 4), '#2a2238', [ex - 60, ground - 150, 120, 150], { lw: 5 });
    solid(rrPath(ex - 90, ground - 176, 180, 26, 4), '#4a4f6c', [ex - 90, ground - 176, 180, 26], { lw: 5 });
    const flick = ((o.power ?? 1) < 0.5 ? 0.05 : 1) * (ex < x0 + W * 0.5 ? (Math.sin(t * 31) > 0.6 ? 0.2 : 1) : 1);
    glow(ex, ground - 160, 160, '#ffd38a', 0.5 * flick);
    g.fillStyle = `rgba(255,220,150,${0.9 * flick})`; g.fillRect(ex - 14, ground - 172, 28, 10);
    g.fillStyle = '#7c4b3b'; g.fillRect(ex - 44, ground - 128, 88, 128);    // the steel door with the intercom
    g.fillStyle = '#1d1424'; g.fillRect(ex + 28, ground - 80, 10, 16);
  }
  // our window marker
  return winRect(OUR.floor, OUR.col);
}

function ourSilhouette(wx, wy, ww, wh, t) {
  g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  g.fillStyle = '#3a2016';
  // hero: big round head + shoulders
  const hx = wx + ww * 0.42, hy = wy + wh * 0.5;
  g.beginPath(); g.arc(hx, hy, ww * 0.17, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(hx, wy + wh, ww * 0.3, wh * 0.33, 0, Math.PI, TAU); g.fill();
  // cat on the sill
  const cx = wx + ww * 0.78, cy = wy + wh - 6;
  g.beginPath(); g.ellipse(cx, cy - 10, 13, 13, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(cx - 11, cy - 18); g.lineTo(cx - 8, cy - 32); g.lineTo(cx - 2, cy - 22); g.lineTo(cx + 4, cy - 22); g.lineTo(cx + 9, cy - 32); g.lineTo(cx + 12, cy - 18); g.fill();
  g.beginPath(); g.ellipse(cx, cy + 6, 16, 14, 0, 0, TAU); g.fill();
  g.restore();
}

export function courtyard(t, o = {}) {
  const gy = BLD.ground;
  vgrad(-400, gy - 10, 1880, 1000, [[0, '#2a2236'], [0.3, '#1a1626'], [1, '#0b0a12']]);
  // asphalt path and kerb
  g.fillStyle = '#231e2e'; g.fillRect(-400, gy + 40, 1880, 120);
  line([[-400, gy + 40], [1480, gy + 40]], 4, '#3c3550');
  // trees (bare, silhouettes)
  for (const [tx, s] of [[20, 1.15], [1060, 1.0]]) tree(tx, gy + 120, s, t);
  // playground: slide + swing
  g.save(); g.translate(250, gy + 230); g.scale(0.55, 0.55); playground(0, 0, t); g.restore();
  // cars
  g.save(); g.translate(780, gy + 210); g.scale(0.62, 0.62); car(0, 0, '#b7362f', t, true); g.restore();
  g.save(); g.translate(180, gy + 430); g.scale(0.8, 0.8); car(0, 0, '#3e5f9a', t, false); g.restore();
  // zombies shambling
  const Z = o.zombies ?? [[430, 0.1, 0.0, 1], [640, 0.05, 0.3, -1], [880, 0.2, 0.6, -1], [90, 0.3, 0.2, 1], [560, 0.55, 0.8, 1], [960, 0.7, 0.45, -1], [300, 0.85, 0.1, -1]];
  Z.sort((a, b) => a[1] - b[1]).forEach(([zx, d, ph, dir], i) => {
    const y = gy + 90 + d * 400, sc = 0.15 + d * 0.16;
    const x = zx + dir * ((t * 14 + ph * 40) % 90);
    drawZombie({ x, y, s: sc, face: dir, t: t + ph * 3, seed: i });
  });
  // runner with a pack of toilet paper
  const rt = ((t * 0.22 + 0.15) % 1);
  g.save(); g.translate(lerp(-120, 1200, rt), gy + 330); g.scale(0.62, 0.62); runner(0, 0, t); g.restore();
  // police car lights spill on the ground from the left
  const ph = Math.sin(t * TAU * 1.6);
  glow(-60, gy + 300, 700, ph > 0 ? '#ff2a3a' : '#2f6bff', 0.35 * Math.abs(ph));
}

function tree(x, y, s, t) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const sway = Math.sin(t * 0.8) * 0.02;
  g.rotate(sway);
  g.strokeStyle = '#0d0b14'; g.lineCap = 'round';
  const br = (x0, y0, a, len, w, d) => {
    if (d > 5 || len < 8) return;
    const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    br(x1, y1, a - 0.45 + hash(d * 9 + len) * 0.2, len * 0.72, w * 0.66, d + 1);
    br(x1, y1, a + 0.4 - hash(d * 5 + len) * 0.2, len * 0.7, w * 0.66, d + 1);
  };
  br(0, 0, 0, 230, 34, 0);
  g.restore();
}

function playground(x, y, t) {
  g.save(); g.translate(x, y);
  // slide
  line([[-80, 0], [-80, -170]], 8, '#c74a3a'); line([[-30, 0], [-30, -170]], 8, '#c74a3a');
  line([[-80, -170], [-30, -170]], 8, '#c74a3a');
  line([[-30, -170], [120, -10]], 16, '#e3b23c');
  line([[-80, -170], [-80, -230], [-30, -230], [-30, -170]], 6, '#c74a3a');
  // swing frame
  line([[200, 0], [240, -200], [380, -200], [420, 0]], 8, '#4a6fa5');
  const a = Math.sin(t * 1.3) * 0.25;
  g.save(); g.translate(310, -200); g.rotate(a);
  line([[-30, 0], [-30, 130]], 3.5, '#9aa0b8'); line([[30, 0], [30, 130]], 3.5, '#9aa0b8');
  solid(rrPath(-40, 128, 80, 14, 4), '#d06a3a', [-40, 128, 80, 14], { lw: 4 });
  g.restore();
  g.restore();
}

function car(x, y, col, t, hazard) {
  g.save(); g.translate(x, y);
  softShadow(0, 6, 190, 22, 0.5);
  const body = smoothPath([[-180, -10], [-170, -60], [-90, -72], [-50, -120], [70, -120], [120, -72], [180, -60], [186, -10], [160, 4], [-160, 4]]);
  solid(body, col, [-180, -120, 366, 124], { rimA: 0.3 });
  const win = smoothPath([[-40, -110], [62, -110], [100, -74], [-80, -74]]);
  solid(win, '#1a2440', [-80, -110, 180, 36], { lw: 4, hiA: 0.3, rimA: 0 });
  for (const wx of [-110, 110]) { solid(ellPath(wx, 0, 36, 36), '#15121c', [wx - 36, -36, 72, 72], { lw: 5, rimA: 0.15 }); g.fillStyle = '#6b6f80'; g.beginPath(); g.arc(wx, 0, 14, 0, TAU); g.fill(); }
  if (hazard) {
    const on = Math.sin(t * TAU * 1.2) > 0;
    for (const hx of [-176, 182]) {
      g.fillStyle = on ? '#ffb02e' : '#5a3a10'; g.beginPath(); g.arc(hx, -42, 9, 0, TAU); g.fill();
      if (on) glow(hx, -42, 120, '#ffa020', 0.6);
    }
  }
  g.restore();
}

function runner(x, y, t) {
  // a frightened neighbour running with toilet paper: tiny, simple
  g.save(); g.translate(x, y); g.scale(0.5, 0.5);
  const w = t * 9;
  softShadow(0, 4, 70, 12, 0.4);
  line([[0, -110], [Math.sin(w) * 40, -50], [Math.sin(w) * 50, 0]], 16, '#2b3048');
  line([[0, -110], [-Math.sin(w) * 40, -50], [-Math.sin(w) * 50, 0]], 16, '#2b3048');
  solid(rrPath(-34, -230, 68, 130, 26), '#5f7d4e', [-34, -230, 68, 130], { lw: 5 });
  solid(ellPath(0, -270, 40, 42), '#e7b896', [-40, -312, 80, 84], { lw: 5 });
  // arms up holding a 12-pack of toilet paper
  line([[-26, -210], [-50, -300]], 14, '#5f7d4e'); line([[26, -210], [50, -300]], 14, '#5f7d4e');
  solid(rrPath(-70, -380, 140, 80, 10), '#f4f1ea', [-70, -380, 140, 80], { lw: 5 });
  for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(80,80,110,.4)'; g.lineWidth = px(3); g.beginPath(); g.arc(-52 + i * 35, -340, 14, 0, TAU); g.stroke(); }
  g.restore();
}

export function exterior(t, o = {}) {
  sky(t, o.fire ?? 1);
  smoke(t, -60, 1150, 1, 1); smoke(t + 3, 980, 1120, 0.8, 2); smoke(t + 7, 560, 1180, 0.6, 3);
  distantCity(t);
  helicopter(t);
  const r = building(t, o);
  courtyard(t, o);
  return r;
}

function helicopter(t) {
  const hx = 900 - ((t * 25) % 1400) * 0.4, hy = 150 + Math.sin(t * 0.7) * 20;
  // searchlight beam sweeping
  const a = 0.2 + Math.sin(t * 0.9) * 0.35;
  g.save(); g.globalCompositeOperation = 'lighter';
  const L = 1300, x2 = hx + Math.sin(a) * L, y2 = hy + Math.cos(a) * L;
  const gr = g.createLinearGradient(hx, hy, x2, y2);
  gr.addColorStop(0, 'rgba(230,240,255,.32)'); gr.addColorStop(1, 'rgba(230,240,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy);
  g.lineTo(x2 - Math.cos(a) * 150, y2 + Math.sin(a) * 150); g.lineTo(x2 + Math.cos(a) * 150, y2 - Math.sin(a) * 150); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#0c0b16';
  g.beginPath(); g.ellipse(hx, hy, 34, 15, 0, 0, TAU); g.fill();
  g.fillRect(hx + 20, hy - 4, 50, 6);
  g.fillRect(hx - 60, hy - 22, 120, 4 * (Math.sin(t * 60) > 0 ? 1 : 0.3));
  if (Math.sin(t * TAU * 1.5) > 0.6) glow(hx + 68, hy - 2, 30, '#ff3030', 0.9);
}
