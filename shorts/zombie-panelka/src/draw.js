// Drawing helpers on one shared 2D context: ink outlines that keep their screen width at any zoom,
// soft 2.5D shading (light side, shadow side, coloured rim), glows and smooth shapes.
import { Path2D } from '@napi-rs/canvas';
import { TAU, rgba, shade, clamp } from './lib.js';

export const W = 1080, H = 1920;
export const INK = '#17121f';
export let g = null;
export const setCtx = c => { g = c; };
export { Path2D };

// current uniform scale of the transform, so outlines can be given in screen pixels
export function zoom() { const m = g.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }
export const px = n => n / zoom();

// global light of the shot: direction the light comes FROM (screen space, normalised) and rim colour
export const LIGHT = { x: -0.6, y: -0.8, rim: '#9fc3ff', rimA: 0.55, shadowA: 0.32, hiA: 0.22, ink: INK };
export function setLight(o) { Object.assign(LIGHT, { x: -0.6, y: -0.8, rim: '#9fc3ff', rimA: 0.55, shadowA: 0.32, hiA: 0.22, ink: INK }, o); }

// —— paths ——
export function smoothPath(pts, closed = true, p = new Path2D()) {
  const n = pts.length;
  if (n < 3) { p.moveTo(...pts[0]); for (let i = 1; i < n; i++) p.lineTo(...pts[i]); if (closed) p.closePath(); return p; }
  const P = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  p.moveTo(...P(0));
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) p.closePath();
  return p;
}
export function ellPath(cx, cy, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, TAU); return p; }
export function rrPath(x, y, w, h, r) {
  const p = new Path2D(); r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p;
}
export function polyPath(pts, closed = true) { const p = new Path2D(); p.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) p.lineTo(...pts[i]); if (closed) p.closePath(); return p; }

// —— fills ——
// fill a shape with its base colour and a soft 3D look; bb = [x, y, w, h] in local units
export function solid(path, color, bb, o = {}) {
  const lw = o.lw ?? 6;
  g.fillStyle = color; g.fill(path);
  if (bb && o.shade !== false) shadeIn(path, color, bb, o);
  if (o.tex) { g.save(); g.clip(path); o.tex(); g.restore(); }
  if (lw > 0) { g.lineWidth = px(lw); g.strokeStyle = o.ink || LIGHT.ink; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path); }
}
// the shot's light direction expressed in the current local coordinates (handles mirror and rotation)
export function localLight() {
  const m = g.getTransform(), det = m.a * m.d - m.b * m.c || 1;
  let ux = (m.d * LIGHT.x - m.c * LIGHT.y) / det, uy = (-m.b * LIGHT.x + m.a * LIGHT.y) / det;
  const n = Math.hypot(ux, uy) || 1; return [ux / n, uy / n];
}
export function shadeIn(path, color, bb, o = {}) {
  const [x, y, w, h] = bb, cx = x + w / 2, cy = y + h / 2, R = Math.max(w, h) * 0.75;
  const [lx, ly] = localLight();
  g.save(); g.clip(path);
  // shadow side
  const sa = o.shadowA ?? LIGHT.shadowA;
  if (sa > 0) {
    const gr = g.createLinearGradient(cx + lx * R, cy + ly * R, cx - lx * R, cy - ly * R);
    gr.addColorStop(0, rgba(shade(color, -0.6), 0)); gr.addColorStop(0.55, rgba(shade(color, -0.6), 0));
    gr.addColorStop(1, rgba(shade(color, -0.65), sa));
    g.fillStyle = gr; g.fillRect(x - w, y - h, w * 3, h * 3);
  }
  // highlight on the lit side
  const ha = o.hiA ?? LIGHT.hiA;
  if (ha > 0) {
    const hx = cx + lx * w * 0.28, hy = cy + ly * h * 0.28;
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, Math.max(w, h) * 0.55);
    gr.addColorStop(0, `rgba(255,255,255,${ha})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - w, y - h, w * 3, h * 3);
  }
  // coloured rim on the edge facing the light
  const ra = o.rimA ?? LIGHT.rimA;
  if (ra > 0) {
    const off = o.rimW ?? Math.min(w, h) * 0.03 + px(2.5);
    g.translate(-lx * off, -ly * off);
    g.globalAlpha = ra; g.lineWidth = off * 1.3; g.strokeStyle = o.rim || LIGHT.rim; g.stroke(path);
  }
  g.restore();
}
export function stroke(path, lw = 6, color = LIGHT.ink) { g.lineWidth = px(lw); g.strokeStyle = color; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path); }
export function line(pts, lw = 6, color = LIGHT.ink, smoothIt = false) { stroke(smoothIt ? smoothPath(pts, false) : polyPath(pts, false), lw, color); }

// rubber-hose limb: a thick tube with ink outline through 2–3 joints
export function hose(pts, width, color, o = {}) {
  const p = smoothPath(pts, false);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = width + px(o.lw ?? 6) * 2; g.strokeStyle = o.ink || LIGHT.ink; g.stroke(p);
  g.lineWidth = width; g.strokeStyle = color; g.stroke(p);
  const [lx, ly] = localLight();
  if (o.shadeA !== 0) {               // shaded underside of the tube
    g.save(); g.globalAlpha = o.shadeA ?? 0.22; g.lineWidth = width * 0.45; g.strokeStyle = shade(color, -0.5);
    g.translate(-lx * width * 0.24, -ly * width * 0.24); g.stroke(p); g.restore();
  }
  if (o.rimA !== 0) {
    g.save(); g.globalAlpha = (o.rimA ?? LIGHT.rimA) * 0.6; g.lineWidth = width * 0.12; g.strokeStyle = o.rim || LIGHT.rim;
    g.translate(lx * width * 0.33, ly * width * 0.33); g.stroke(p); g.restore();
  }
}

// —— light ——
export function glow(x, y, r, color, a = 1, op = 'lighter') {
  if (a <= 0 || r <= 0) return;
  g.save(); g.globalCompositeOperation = op;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.35, rgba(color, a * 0.45)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
export function softShadow(x, y, rx, ry, a = 0.35) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}
export function vgrad(x, y, w, h, stops) {
  const gr = g.createLinearGradient(x, y, x, y + h);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
export function vignette(a = 0.6, r0 = 0.45, color = '0,0,0') {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(W / 2, H * 0.47, H * r0 * 0.5, W / 2, H * 0.47, H * 0.78);
  gr.addColorStop(0, `rgba(${color},0)`); gr.addColorStop(1, `rgba(${color},${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
}
export const clamp01 = clamp;
