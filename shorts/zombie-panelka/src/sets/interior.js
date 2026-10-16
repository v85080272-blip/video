// The flat on the ninth floor: living room with the window, hall with the steel door, kitchen, bathroom.
// Each set is drawn in screen-sized world units (1080×1920 at zoom 1); lighting is a parameter of the shot.
import { g, solid, smoothPath, ellPath, rrPath, polyPath, stroke, line, glow, softShadow, vgrad, px, LIGHT, hose, Path2D } from '../draw.js';
import { TAU, clamp, lerp, rgba, mix, shade, hash, hash2, noise } from '../lib.js';
import { sky, smoke } from './exterior.js';

// —— shared textures ——
export function wallpaper(x, y, w, h, base, motif, seed = 0) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // vertical stripes
  g.fillStyle = rgba(shade(base, -0.25), 0.25);
  for (let sx = x; sx < x + w; sx += 90) g.fillRect(sx, y, 30, h);
  // small diamond motifs
  g.fillStyle = rgba(motif, 0.35);
  for (let sy = y + 30, r = 0; sy < y + h; sy += 120, r++) for (let sx = x + 60 + (r % 2) * 45; sx < x + w; sx += 90) {
    g.beginPath(); g.moveTo(sx, sy - 16); g.lineTo(sx + 11, sy); g.lineTo(sx, sy + 16); g.lineTo(sx - 11, sy); g.closePath(); g.fill();
  }
  g.restore();
}
export function floorBoards(x, y, w, h, base) {
  vgrad(x, y, w, h, [[0, shade(base, -0.25)], [1, shade(base, 0.05)]]);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = rgba(shade(base, -0.5), 0.35); g.lineWidth = px(3);
  for (let i = 0; i < 14; i++) { const yy = y + Math.pow(i / 14, 1.6) * h; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  g.restore();
  // contact shadow along the wall
  vgrad(x, y, w, 60, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]);
}
function aoCorners(x0, x1, y0, y1) {
  const gl = g.createLinearGradient(x0, 0, x0 + 160, 0); gl.addColorStop(0, 'rgba(0,0,0,.35)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gl; g.fillRect(x0, y0, 160, y1 - y0);
  const gr = g.createLinearGradient(x1, 0, x1 - 160, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x1 - 160, y0, 160, y1 - y0);
}
// darken everything drawn so far: night ambience (multiply) then optional warm lamp pools
export function darken(color, a) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = rgba(color, a); g.fillRect(0, 0, 1080, 1920); g.restore();
}

// —— outside view used in windows ——
export function cityView(t, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(x + w / 2 - 540, y - 640);
  sky(t, 0.75);
  smoke(t, 300, 1150, 1.2, 4); smoke(t + 5, 820, 1100, 0.9, 5);
  // blocks across the yard
  for (let i = 0; i < 5; i++) {
    const bx = 120 + i * 200 + hash(i) * 40, bw = 170, bh = 420 + hash(i * 3) * 260, by = 1200 - bh;
    g.fillStyle = mix('#1b1a33', '#2a2340', hash(i * 7)); g.fillRect(bx, by, bw, bh + 400);
    for (let r = 0; r < bh / 40; r++) for (let c = 0; c < 5; c++) {
      const hv = hash2(i * 11 + c, r);
      if (hv > 0.7) {
        const off = hash2(i + c, r + Math.floor(t * 0.9 + hv * 7)) < 0.1;
        g.fillStyle = off ? '#141428' : hv > 0.93 ? '#8fb6ff' : '#ffbe68';
        g.fillRect(bx + 12 + c * 32, by + 14 + r * 40, 18, 22);
      }
    }
  }
  const ph = Math.sin(t * TAU * 1.6);
  glow(540, 1250, 700, ph > 0 ? '#ff2a3a' : '#2f6bff', 0.3 * Math.abs(ph));
  g.restore();
}

// —— living room ——
export function livingRoom(t, o = {}) {
  const lamp = o.lamp ?? 1, curt = o.curtains ?? 0;
  wallpaper(-300, -200, 1680, 1720, '#5e6a74', '#e9d9b0');
  // carpet on the wall, left
  carpet(-170, 300, 330, 760);
  floorBoards(-300, 1500, 1680, 520, '#6a4a34');
  aoCorners(-300, 1380, -200, 1520);
  // window
  const wx = 250, wy = 360, ww = 580, wh = 700;
  cityView(t, wx, wy, ww, wh);
  windowFrame(wx, wy, ww, wh);
  // sill, radiator
  solid(rrPath(wx - 50, wy + wh - 6, ww + 100, 40, 6), '#e8e3d6', [wx - 50, wy + wh - 6, ww + 100, 40], { lw: 5 });
  radiator(wx + 90, wy + wh + 90, ww - 180, 210);
  // aloe pot on the sill
  aloe(wx + ww - 70, wy + wh - 6);
  // curtains (0 open … 1 closed)
  curtains(wx, wy, ww, wh, curt, t);
  // floor lamp on the right
  floorLamp(960, 1500, lamp, t);
  // light: the lamp's warm pool
  if (lamp > 0) { glow(960, 640, 760, '#ffb35c', 0.32 * lamp); glow(960, 1500, 420, '#ffb35c', 0.18 * lamp); }
  return { wx, wy, ww, wh, sill: wy + wh - 6 };
}

function carpet(x, y, w, h) {
  const p = rrPath(x, y, w, h, 10);
  solid(p, '#8d2330', [x, y, w, h], { rimA: 0.15, hiA: 0.08 });
  g.save(); g.clip(p);
  g.strokeStyle = '#d9a441'; g.lineWidth = px(8); g.strokeRect(x + 22, y + 22, w - 44, h - 44);
  g.strokeStyle = '#2e4d7a'; g.lineWidth = px(6); g.strokeRect(x + 40, y + 40, w - 80, h - 80);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
    const cx = x + 80 + c * (w - 160) / 2, cy = y + 90 + r * (h - 180) / 5;
    g.fillStyle = (r + c) % 2 ? '#d9a441' : '#e9d3a5';
    g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 30, cy); g.lineTo(cx, cy + 34); g.lineTo(cx - 30, cy); g.closePath(); g.fill();
    g.fillStyle = '#2e4d7a'; g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
  }
  g.restore();
  // tassels
  for (let i = 0; i < 10; i++) line([[x + 20 + i * (w - 40) / 9, y + h], [x + 20 + i * (w - 40) / 9, y + h + 26]], 4, '#d9a441');
}

export function windowFrame(wx, wy, ww, wh) {
  const fr = '#e9e6dc', b = 26;
  const p = new Path2D();
  p.addPath(rrPath(wx - b, wy - b, ww + 2 * b, wh + 2 * b, 6));
  p.addPath(rrPath(wx, wy, ww, wh, 2));
  g.fillStyle = fr; g.fill(p, 'evenodd');
  g.lineWidth = px(6); g.strokeStyle = LIGHT.ink; g.lineJoin = 'round'; g.stroke(p);
  // mullions: vertical centre and a fortochka (small vent) top-left
  for (const r of [[wx + ww / 2 - 14, wy, 28, wh], [wx, wy + wh * 0.3 - 12, ww / 2, 24]]) solid(rrPath(...r, 3), fr, r, { lw: 5, rimA: 0, hiA: 0.1, shadowA: 0.15 });
  // glass sheen
  g.save(); g.globalAlpha = 0.12; g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(wx + 40, wy + wh); g.lineTo(wx + 180, wy); g.lineTo(wx + 240, wy); g.lineTo(wx + 100, wy + wh); g.fill();
  g.restore();
}

function radiator(x, y, w, h) {
  const n = 11, fw = w / n;
  for (let i = 0; i < n; i++) solid(rrPath(x + i * fw + 3, y, fw - 6, h, 14), '#d9d4c8', [x + i * fw, y, fw, h], { lw: 4.5, rimA: 0.1, hiA: 0.15 });
  line([[x - 10, y + 20], [x + w + 10, y + 20]], 8, '#bdb6a6'); line([[x - 10, y + h - 20], [x + w + 10, y + h - 20]], 8, '#bdb6a6');
}

function aloe(x, y) {
  for (const [a, l] of [[-0.6, 90], [-0.2, 120], [0.25, 110], [0.7, 80], [0, 70]]) {
    const p = smoothPath([[x - 8, y - 50], [x + Math.sin(a) * l * 0.5, y - 50 - Math.cos(a) * l * 0.6], [x + Math.sin(a) * l, y - 50 - Math.cos(a) * l], [x + 8, y - 50]]);
    solid(p, '#5c9a54', [x - 40, y - 170, 80, 120], { lw: 4.5, rimA: 0.2 });
  }
  solid(smoothPath([[x - 44, y - 64], [x + 44, y - 64], [x + 34, y], [x - 34, y]]), '#c56a3c', [x - 44, y - 64, 88, 64], { lw: 5 });
}

export function curtains(wx, wy, ww, wh, closed, t) {
  const col = '#7a2632', top = wy - 70, bot = wy + wh + 80;
  // rod
  line([[wx - 140, top], [wx + ww + 140, top]], 10, '#3a2a22');
  for (const side of [-1, 1]) {
    const openW = 150, cw = lerp(openW, ww / 2 + 130, closed);
    const x0 = side < 0 ? wx - 120 : wx + ww + 120 - cw;
    const sway = Math.sin(t * 3) * 6 * closed * (1 - closed) * 4;
    const pts = [[x0, top], [x0 + cw, top], [x0 + cw + side * sway, bot], [x0 + side * sway * 0.3, bot]];
    const path = polyPath(pts);
    solid(path, col, [x0, top, cw, bot - top], { rimA: 0.15, hiA: 0.1 });
    g.save(); g.clip(path);
    const folds = Math.max(3, Math.round(cw / 55));
    for (let i = 0; i < folds; i++) {
      const fx = x0 + (i + 0.5) * cw / folds;
      const gr = g.createLinearGradient(fx - 26, 0, fx + 26, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(255,255,255,.06)');
      g.fillStyle = gr; g.fillRect(fx - 26, top, 52, bot - top);
    }
    g.restore();
    stroke(path, 5.5);
  }
}

function floorLamp(x, y, on, t) {
  softShadow(x, y, 90, 16, 0.4);
  line([[x, y], [x, y - 900]], 10, '#2c2420');
  solid(ellPath(x, y - 6, 60, 14), '#2c2420', [x - 60, y - 20, 120, 28], { lw: 4.5 });
  const shadeP = smoothPath([[x - 70, y - 1080], [x + 70, y - 1080], [x + 130, y - 880], [x - 130, y - 880]]);
  const c = on > 0.5 ? '#ffd28a' : '#a8875a';
  solid(shadeP, c, [x - 130, y - 1080, 260, 200], { rimA: 0.1, hiA: on * 0.4 });
  if (on > 0) glow(x, y - 860, 260, '#ffcf7a', 0.55 * on);
}

// —— hall: the steel door ——
export const DOOR = { x: 330, y: 380, w: 420, h: 1120 };
export function hall(t, o = {}) {
  wallpaper(-300, -200, 1680, 1720, '#55705f', '#e8e0c0', 2);
  floorBoards(-300, 1500, 1680, 520, '#5b4a3e');
  aoCorners(-300, 1380, -200, 1520);
  door(t, o);
  // coat hooks with a jacket and an umbrella on the left
  line([[40, 520], [250, 520]], 12, '#4a3428');
  const jacket = smoothPath([[96, 536], [146, 528], [196, 590], [214, 760], [196, 900], [74, 900], [56, 760], [66, 600]]);
  solid(jacket, '#3d5a80', [56, 528, 158, 372], { rimA: 0.2 });
  line([[134, 560], [134, 900]], 4, 'rgba(0,0,0,.4)');
  solid(smoothPath([[100, 520], [170, 520], [160, 580], [110, 580]]), '#33507a', [100, 520, 70, 60], { lw: 4.5 });
  line([[230, 530], [236, 860]], 9, '#1d1d26'); solid(smoothPath([[206, 600], [262, 600], [250, 860], [218, 860]]), '#2f2f3d', [206, 600, 56, 260], { lw: 4.5 });
  // door mat
  if (o.mat !== false) solid(rrPath(DOOR.x - 20, 1520, DOOR.w + 40, 70, 10), '#7b3b2c', [DOOR.x - 20, 1520, DOOR.w + 40, 70], { lw: 5 });
  // light switch by the door frame
  if (o.switch !== false) lightSwitch(870, 900, 1, o.switchOn ?? 1);
}

export function door(t, o = {}) {
  const { x, y, w, h } = DOOR;
  // casing
  solid(rrPath(x - 40, y - 40, w + 80, h + 40, 6), '#d6cfbf', [x - 40, y - 40, w + 80, h + 40], { rimA: 0.1, hiA: 0.1 });
  const shake = o.doorShake ? Math.sin(t * 90) * o.doorShake * 3 : 0;
  g.save(); g.translate(shake, 0);
  const d = rrPath(x, y, w, h, 6);
  solid(d, '#6b3f2a', [x, y, w, h], { rimA: 0.2, hiA: 0.12 });
  // quilted dermantin: diamond grid with brass buttons
  g.save(); g.clip(d);
  g.strokeStyle = 'rgba(30,14,10,.45)'; g.lineWidth = px(4);
  for (let k = -12; k < 16; k++) {
    g.beginPath(); g.moveTo(x + k * 90, y); g.lineTo(x + k * 90 + h * 0.6, y + h); g.stroke();
    g.beginPath(); g.moveTo(x + k * 90, y); g.lineTo(x + k * 90 - h * 0.6, y + h); g.stroke();
  }
  for (let r = 0; r < 14; r++) for (let c = -1; c < 6; c++) {
    const bx = x + c * 90 + (r % 2) * 45, by = y + r * 75;
    g.fillStyle = '#d6a64a'; g.beginPath(); g.arc(bx, by, 6, 0, TAU); g.fill();
  }
  g.restore();
  // peephole
  solid(ellPath(x + w / 2, y + 310, 18, 18), '#c9b37a', [x + w / 2 - 18, y + 292, 36, 36], { lw: 4.5 });
  g.fillStyle = '#120c10'; g.beginPath(); g.arc(x + w / 2, y + 310, 8, 0, TAU); g.fill();
  if (o.peepGlow) glow(x + w / 2, y + 310, 40, '#ffc26b', o.peepGlow);
  // locks
  for (const ly of [y + 500, y + 700]) {
    solid(rrPath(x + w - 90, ly - 40, 44, 80, 10), '#c9b37a', [x + w - 90, ly - 40, 44, 80], { lw: 4.5 });
    g.fillStyle = '#120c10'; g.beginPath(); g.arc(x + w - 68, ly - 8, 7, 0, TAU); g.fill(); g.fillRect(x + w - 71, ly - 8, 6, 22);
  }
  // handle
  solid(rrPath(x + w - 110, y + 590, 90, 26, 12), '#d8c27e', [x + w - 110, y + 590, 90, 26], { lw: 5 });
  // night latch (slides right into the frame)
  const lx = x + w - 150, ly = y + 400, bolt = o.bolt ?? 0;
  solid(rrPath(lx - 40, ly - 22, 120, 44, 6), '#9aa0ac', [lx - 40, ly - 22, 120, 44], { lw: 4.5 });
  solid(rrPath(lx - 20 + bolt * 60, ly - 9, 110, 18, 6), '#c4cad4', [lx - 20, ly - 9, 110, 18], { lw: 4 });
  solid(ellPath(lx + 10 + bolt * 60, ly - 26, 12, 12), '#c4cad4', [lx - 2, ly - 38, 24, 24], { lw: 4 });
  g.restore();
}

export function lightSwitch(x, y, s = 1, on = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  softShadow(6, 10, 60, 70, 0.25);
  solid(rrPath(-48, -64, 96, 128, 14), '#f2efe6', [-48, -64, 96, 128], { lw: 5, hiA: 0.3 });
  const k = on ? -1 : 1;
  solid(rrPath(-22, -36, 44, 72, 8), '#e4e0d4', [-22, -36, 44, 72], { lw: 4.5, hiA: 0.2 });
  line([[-18, k * -18], [18, k * -18]], 4, 'rgba(0,0,0,.35)');
  g.restore();
}

// the low cabinet the hero pushes against the door
export function cabinet(x, y, s = 1, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  softShadow(0, 0, 230, 26, 0.5);
  const body = rrPath(-190, -520, 380, 520, 10);
  solid(body, '#8a5a36', [-190, -520, 380, 520], { rimA: 0.2, hiA: 0.12 });
  g.save(); g.clip(body); g.strokeStyle = 'rgba(60,30,10,.25)'; g.lineWidth = px(3);
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-190, -500 + i * 60 + Math.sin(i) * 8); g.bezierCurveTo(-60, -520 + i * 60, 60, -480 + i * 60, 190, -505 + i * 60); g.stroke(); }
  g.restore();
  solid(rrPath(-200, -540, 400, 40, 8), '#9c6a42', [-200, -540, 400, 40], { lw: 5 });
  for (const sd of [-1, 1]) {
    solid(rrPath(sd > 0 ? 8 : -172, -470, 164, 420, 8), '#94633d', [sd > 0 ? 8 : -172, -470, 164, 420], { lw: 4.5, hiA: 0.08 });
    solid(ellPath(sd * 26, -260, 11, 11), '#d8b25a', [sd * 26 - 11, -271, 22, 22], { lw: 4 });
  }
  g.restore();
}

// —— kitchen (dark) ——
export function kitchen(t, o = {}) {
  vgrad(-300, -200, 1680, 1720, [[0, '#4b5b6a'], [1, '#3a4652']]);
  // tiles band
  g.save(); g.fillStyle = '#dfe7ea'; g.fillRect(-300, 700, 1680, 560);
  g.strokeStyle = 'rgba(70,90,110,.45)'; g.lineWidth = px(3);
  for (let x = -300; x < 1380; x += 70) { g.beginPath(); g.moveTo(x, 700); g.lineTo(x, 1260); g.stroke(); }
  for (let y = 700; y < 1260; y += 70) { g.beginPath(); g.moveTo(-300, y); g.lineTo(1380, y); g.stroke(); }
  g.restore();
  floorBoards(-300, 1500, 1680, 520, '#4c5a64');
  // counter + stove on the left
  solid(rrPath(-120, 1180, 640, 330, 8), '#d8d2c4', [-120, 1180, 640, 330], { rimA: 0.15 });
  solid(rrPath(-140, 1150, 680, 40, 6), '#8a6a4a', [-140, 1150, 680, 40], { lw: 5 });
  for (const kx of [60, 330]) solid(rrPath(kx - 100, 1250, 200, 220, 8), '#cfc8b8', [kx - 100, 1250, 200, 220], { lw: 4.5, hiA: 0.1 });
  // window with closed blind, a sliver of light
  solid(rrPath(80, 180, 420, 470, 6), '#e9e6dc', [80, 180, 420, 470], { lw: 6 });
  g.fillStyle = '#c9c2b0'; g.fillRect(104, 204, 372, 422);
  for (let i = 0; i < 14; i++) line([[104, 214 + i * 30], [476, 214 + i * 30]], 2.5, 'rgba(60,60,70,.35)');
  // the tall old fridge on the right (ЗИЛ-style rounded top)
  fridge(800, 1500);
  return { fridgeTop: [800, 1500 - 860] };
}

function fridge(x, y) {
  softShadow(x, y, 220, 26, 0.5);
  const body = new Path2D();
  const x0 = x - 180, x1 = x + 180, top = y - 860, r = 70;
  body.moveTo(x0, y); body.lineTo(x0, top + r); body.quadraticCurveTo(x0, top, x0 + r, top); body.lineTo(x1 - r, top);
  body.quadraticCurveTo(x1, top, x1, top + r); body.lineTo(x1, y); body.closePath();
  solid(body, '#eae7df', [x0, top, 360, 860], { rimA: 0.2, hiA: 0.2 });
  line([[x0, y - 600], [x1, y - 600]], 5);
  solid(rrPath(x + 110, y - 760, 30, 140, 12), '#c9c4b8', [x + 110, y - 760, 30, 140], { lw: 4.5 });
  solid(rrPath(x - 60, y - 810, 120, 28, 6), '#b8b2a4', [x - 60, y - 810, 120, 28], { lw: 3.5, hiA: 0.3 });
  solid(rrPath(x0 + 20, y - 40, 320, 40, 6), '#cfcabd', [x0 + 20, y - 40, 320, 40], { lw: 4 });
}

export function pot(x, y, s = 1, rot = 0, col = '#c9cdd6', lid = true) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const b = smoothPath([[-80, -90], [80, -90], [86, -10], [70, 0], [-70, 0], [-86, -10]]);
  solid(b, col, [-86, -90, 172, 90], { hiA: 0.35, rimA: 0.3 });
  for (const sd of [-1, 1]) solid(rrPath(sd * 86 - (sd > 0 ? 0 : 30), -78, 30, 16, 8), '#3a3a44', [sd * 86 - 15, -78, 30, 16], { lw: 4 });
  if (lid) {
    solid(ellPath(0, -94, 86, 16), shade(col, -0.08), [-86, -110, 172, 32], { lw: 4.5, hiA: 0.3 });
    solid(ellPath(0, -112, 16, 9), '#3a3a44', [-16, -121, 32, 18], { lw: 4 });
  }
  g.restore();
}

// —— bathroom ——
export function bathroom(t, o = {}) {
  // tiles
  g.fillStyle = '#5f8fb0'; g.fillRect(-300, -200, 1680, 1720);
  g.save(); g.strokeStyle = 'rgba(20,40,70,.45)'; g.lineWidth = px(3);
  for (let x = -300; x < 1380; x += 80) { g.beginPath(); g.moveTo(x, -200); g.lineTo(x, 1520); g.stroke(); }
  for (let y = -200; y < 1520; y += 80) { g.beginPath(); g.moveTo(-300, y); g.lineTo(1380, y); g.stroke(); }
  for (let i = 0; i < 40; i++) { const x = -300 + (i * 7 % 21) * 80, y = -200 + (i * 11 % 21) * 80; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 4, y + 4, 72, 72); }
  g.restore();
  floorBoards(-300, 1500, 1680, 520, '#3d5566');
  aoCorners(-300, 1380, -200, 1520);
  // ceiling lamp light pool
  glow(540, 120, 900, '#dff1ff', 0.35);
  // bathtub, seen slightly from above: the rim band shows the inside, which turns to water as it fills
  const bx = 90, by = 1080, bw = 900, bh = 380;
  const tub = rrPath(bx + 10, by, bw - 20, bh, 70);
  const lvl = o.water ?? 0;
  solid(tub, '#f3f5f7', [bx, by, bw, bh], { rimA: 0.25, hiA: 0.35, shadowA: 0.2 });
  const rimTop = by - 74;
  solid(rrPath(bx - 20, rimTop, bw + 40, 92, 42), '#ffffff', [bx - 20, rimTop, bw + 40, 92], { lw: 6, hiA: 0.4 });
  const hole = rrPath(bx + 16, rimTop + 16, bw - 32, 56, 28);
  vgrad(bx + 16, rimTop + 16, bw - 32, 56, [[0, '#9aa6b4'], [1, '#dfe5ec']]);
  g.save(); g.clip(hole);
  vgrad(bx + 16, rimTop + 16, bw - 32, 56, [[0, '#9aa6b4'], [1, '#e4e9ef']]);
  if (lvl > 0.01) {
    g.globalAlpha = clamp(lvl * 1.4);
    vgrad(bx + 16, rimTop + 16, bw - 32, 56, [[0, '#3f9ad8'], [1, '#8fd0f6']]);
    g.globalAlpha = 0.55 * clamp(lvl * 2);
    g.strokeStyle = '#e8f8ff'; g.lineWidth = px(3);
    for (let i = 0; i < 3; i++) {
      const yy = rimTop + 30 + i * 12;
      g.beginPath();
      for (let x = bx + 30; x < bx + bw - 30; x += 24) g.lineTo(x, yy + Math.sin(x * 0.04 + t * 5 + i) * 2.5);
      g.stroke();
    }
  }
  g.restore();
  stroke(hole, 5);
  // feet
  for (const fx of [bx + 150, bx + bw - 150]) solid(ellPath(fx, by + bh + 30, 30, 30), '#e6e6e6', [fx - 30, by + bh, 60, 60], { lw: 5 });
  // tap and spout on the right wall
  const tx = bx + bw - 120, ty = by - 260;
  solid(rrPath(tx - 50, ty + 120, 100, 40, 12), '#c7ccd4', [tx - 50, ty + 120, 100, 40], { lw: 5, hiA: 0.5 });
  hose([[tx, ty + 130], [tx, ty], [tx - 120, ty], [tx - 150, ty + 50]], 26, '#c7ccd4', { rimA: 0.6 });
  for (const sd of [-1, 1]) solid(ellPath(tx + sd * 60, ty + 140, 22, 22), '#d8dde4', [tx + sd * 60 - 22, ty + 118, 44, 44], { lw: 4.5, hiA: 0.5 });
  return { tub: [bx, by, bw, bh], spout: [tx - 150, ty + 62], rim: rimTop + 8, surface: rimTop + 44 };
}

// a falling stream of water from (x,y) down to yEnd; flow 0..1 (thins and breaks up when the pressure dies)
export function waterStream(t, x, y, yEnd, flow) {
  if (flow <= 0.01) return;
  const w = 6 + flow * 20;
  g.save();
  if (flow > 0.25) {
    const gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(160,215,255,.5)'); gr.addColorStop(0.5, 'rgba(235,248,255,.95)'); gr.addColorStop(1, 'rgba(160,215,255,.5)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w * 0.6, y);
    for (let yy = y; yy <= yEnd; yy += 20) g.lineTo(x - w / 2 + Math.sin(yy * 0.08 + t * 30) * 2, yy);
    for (let yy = yEnd; yy >= y; yy -= 20) g.lineTo(x + w / 2 + Math.sin(yy * 0.07 + t * 27) * 2, yy);
    g.closePath(); g.fill();
    glow(x, yEnd, 60 + flow * 40, '#cfefff', 0.5 * flow);
  } else {
    // sputtering drops
    for (let i = 0; i < 5; i++) {
      const ph = (t * 2.5 + i / 5) % 1, yy = lerp(y, yEnd, ph * ph);
      g.fillStyle = 'rgba(210,240,255,.9)'; g.beginPath(); g.ellipse(x, yy, 5, 9, 0, 0, TAU); g.fill();
    }
  }
  g.restore();
}

export function bottle(x, y, s = 1, fill = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const b = smoothPath([[-30, 0], [-34, -110], [-14, -150], [-12, -180], [12, -180], [14, -150], [34, -110], [30, 0]]);
  g.fillStyle = 'rgba(190,225,255,.35)'; g.fill(b);
  g.save(); g.clip(b); g.fillStyle = 'rgba(80,170,240,.65)'; g.fillRect(-40, -150 * fill, 80, 150 * fill); g.restore();
  solid(rrPath(-14, -200, 28, 22, 4), '#3b7bd9', [-14, -200, 28, 22], { lw: 4 });
  g.save(); g.fillStyle = '#e9f4ff'; g.fillRect(-32, -96, 64, 30); g.restore();
  stroke(b, 5);
  g.restore();
}
