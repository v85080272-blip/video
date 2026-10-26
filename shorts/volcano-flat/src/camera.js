// The camera: centre (x, y) in world units, zoom z, roll r and a screen-space shake (dx, dy). Layers further away
// (f < 1) or nearer (f > 1) than the main slope move at a fraction f of its speed and zoom as z^f, so a push-in grows
// the hunter while the volcano on the horizon barely changes. REF is where all layers line up as drawn.
import { g, W, H } from './flat.js';

export const REF = [0, -700];
export function view(cam, f = 1) {
  const ox = cam.x * f + REF[0] * (1 - f), oy = cam.y * f + REF[1] * (1 - f), z = Math.pow(cam.z, f);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(W / 2 + (cam.dx ?? 0) * f, H / 2 + (cam.dy ?? 0) * f);
  if (cam.r) g.rotate(cam.r);
  g.scale(z, z);
  g.translate(-ox, -oy);
}
// world point of a layer → screen point
export function toScreen(cam, [x, y], f = 1) {
  const ox = cam.x * f + REF[0] * (1 - f), oy = cam.y * f + REF[1] * (1 - f), z = Math.pow(cam.z, f);
  let X = (x - ox) * z, Y = (y - oy) * z;
  if (cam.r) { const c = Math.cos(cam.r), s = Math.sin(cam.r); [X, Y] = [X * c - Y * s, X * s + Y * c]; }
  return [X + W / 2 + (cam.dx ?? 0) * f, Y + H / 2 + (cam.dy ?? 0) * f];
}
