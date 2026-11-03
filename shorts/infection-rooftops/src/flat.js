// Flat drawing on one shared 2D context: solid fills only (no outlines, no gradients), smooth shapes through control points,
// outlines that can grow fur spikes, round-capped limbs and tapered tubes.
// MONO.on paints every shape in one colour: that is how a character becomes its own shadow on the wall.
import { Path2D } from '@napi-rs/canvas';
import { TAU, lerp } from './lib.js';

export const W = 1080, H = 1920;
export let g = null;
export const setCtx = c => { g = c; };
export { Path2D };
export const MONO = { on: false, color: '#000000' };
export const col = c => (MONO.on ? MONO.color : c);

// —— points and curves ——
// uniform Catmull-Rom point: the same curve smoothPath draws with Béziers
function cr(a, b, c, d, t) {
  const t2 = t * t, t3 = t2 * t;
  return b.map((p1, j) => {
    const p0 = a[j], p2 = c[j], p3 = d[j];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
  });
}
export function sample(pts, per = 8, closed = true) {
  const n = pts.length, out = [], P = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = 0; j < per; j++) out.push(cr(P(i - 1), P(i), P(i + 1), P(i + 2), j / per));
  if (!closed) out.push(pts[n - 1]);
  return out;
}
// even spacing along the polyline (extra components after x, y are interpolated too), so spikes come out the same size
export function resample(pts, step, closed = true) {
  const src = closed ? [...pts, pts[0]] : pts, out = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= l) { const u = d / l; out.push(a.map((v, j) => v + (b[j] - v) * u)); d += step; }
    carry = l - (d - step);
  }
  if (closed && out.length > 1) {
    const a = out[out.length - 1], b = out[0];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < step * 0.5) out.pop();
  }
  return out;
}
export const lerpPts = (a, b, t) => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
export function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
// push a closed outline outward in sharp spikes; amp(p, i) is the spike height at point p (index i)
export function spiky(pts, amp, period = 4, phase = 0, sharp = 2.2) {
  const n = pts.length, s = area(pts) > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const u = (((i + phase) % period) + period) % period / period;
    const h = amp(p, i) * Math.pow(1 - Math.abs(2 * u - 1), sharp);
    return [p[0] + s * (ty / l) * h, p[1] - s * (tx / l) * h];
  });
}
// outline of a tube around a centre line with width w(u), u from 0 (root) to 1 (tip), round tip
export function tube(center, w, capTip = true) {
  const n = center.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, h = w(i / (n - 1)) / 2;
    L.push([center[i][0] - ty / l * h, center[i][1] + tx / l * h]);
    R.push([center[i][0] + ty / l * h, center[i][1] - tx / l * h]);
  }
  const out = [...L];
  if (capTip) {
    const [cx, cy] = center[n - 1], [ax, ay] = center[n - 2], h = w(1) / 2;
    const base = Math.atan2(cy - ay, cx - ax);
    for (let k = 1; k < 8; k++) { const t = base + Math.PI / 2 - Math.PI * k / 8; out.push([cx + Math.cos(t) * h, cy + Math.sin(t) * h]); }
  }
  return out.concat(R.reverse());
}

// —— paths and fills ——
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
export function polyPath(pts, closed = true, p = new Path2D()) {
  p.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) p.lineTo(...pts[i]); if (closed) p.closePath(); return p;
}
export function ellPath(cx, cy, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, TAU); return p; }
export function rrPath(x, y, w, h, r) {
  const p = new Path2D(); r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p;
}
export function fill(path, color, a = 1) {
  if (a <= 0) return;
  if (a < 1) { g.save(); g.globalAlpha *= a; }
  g.fillStyle = col(color); g.fill(path);
  if (a < 1) g.restore();
}
export const blob = (pts, color, a) => fill(smoothPath(pts), color, a);
export const poly = (pts, color, a) => fill(polyPath(pts), color, a);
export const ell = (cx, cy, rx, ry, color, rot = 0, a = 1) => fill(ellPath(cx, cy, rx, ry, rot), color, a);
export const rect = (x, y, w, h, color, a) => fill(rrPath(x, y, w, h, 0), color, a);
export const rrect = (x, y, w, h, r, color, a) => fill(rrPath(x, y, w, h, r), color, a);
// a round-capped stroke through points: arms, legs, wires
export function limb(pts, w, color, smoothIt = true) {
  const p = smoothIt && pts.length > 2 ? smoothPath(pts, false) : polyPath(pts, false);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = col(color); g.stroke(p);
}
// fill a shape and draw more shapes clipped inside it (stripes, belly patches, one shade tone)
export function inside(path, fn) { g.save(); g.clip(path); fn(); g.restore(); }

// two-bone IK in a plane: joint between a and b with segment lengths l1, l2; bend = +1 / -1 picks the side
export function ik(a, b, l1, l2, bend = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3);
  const base = Math.atan2(dy, dx), cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = base - bend * Math.acos(Math.max(-1, Math.min(1, cosA)));
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}
// a local coordinate frame: origin, rotation, uniform scale, mirror (fx = -1 faces left) and squash (sx, sy).
// p() maps local points to world points; sub() makes a child frame at a local point, rotated by a local angle.
export function frame(ox, oy, ang = 0, s = 1, fx = 1, sx = 1, sy = 1) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const p = ([x, y]) => { const X = x * fx * sx * s, Y = y * sy * s; return [ox + X * c - Y * sn, oy + X * sn + Y * c]; };
  return {
    p, pts: a => a.map(p), ox, oy, ang, s, fx, sx, sy,
    a: la => ang + fx * la,                     // a local angle as a world angle
    sub: (x, y, la = 0, s2 = 1) => { const [nx, ny] = p([x, y]); return frame(nx, ny, ang + fx * la, s * s2, fx, sx, sy); },
  };
}
export const rot = ([x, y], a, [cx, cy] = [0, 0]) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};
