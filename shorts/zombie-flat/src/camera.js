// The camera: centre (x, y) in world units, zoom z, roll r and a screen-space shake (dx, dy). Layers further away
// or nearer than the stairwell move at a fraction f of its speed; REF is where all layers line up as drawn.
import { g, W, H } from './flat.js';

export const REF = [1450, 1560];
export function view(cam, f = 1) {
  const ox = cam.x * f + REF[0] * (1 - f), oy = cam.y * f + REF[1] * (1 - f);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2 + (cam.dx ?? 0), H / 2 + (cam.dy ?? 0));
  if (cam.r) g.rotate(cam.r);
  g.scale(cam.z, cam.z);
  g.translate(-ox, -oy);
}
// world point → screen point for a layer
export function toScreen(cam, [x, y], f = 1) {
  const ox = cam.x * f + REF[0] * (1 - f), oy = cam.y * f + REF[1] * (1 - f);
  let X = (x - ox) * cam.z, Y = (y - oy) * cam.z;
  if (cam.r) { const c = Math.cos(cam.r), s = Math.sin(cam.r); [X, Y] = [X * c - Y * s, X * s + Y * c]; }
  return [X + W / 2 + (cam.dx ?? 0), Y + H / 2 + (cam.dy ?? 0)];
}
