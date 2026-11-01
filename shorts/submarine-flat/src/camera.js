// The camera: centre (x, y) in world units, dolly zoom z, roll r and a screen-space shake (dx, dy). Layers further away
// (f < 1) or nearer (f > 1) than the main slope move at a fraction f of its speed and zoom as z^f, so a push-in grows
// the hunter while the volcano on the horizon barely changes. A lens zoom and a tilt/pan (tx, ty, in screen pixels)
// move every layer alike, the way turning the camera does: that is how it looks up at the cloud. REF is where all
// layers line up as drawn.
import { g, W, H } from './flat.js';

export const REF = [0, -700];
function params(cam, f) {
  const ox = cam.x * f + REF[0] * (1 - f), oy = cam.y * f + REF[1] * (1 - f), z = Math.pow(cam.z, f) * (cam.lens ?? 1);
  return [ox, oy, z, W / 2 + (cam.dx ?? 0) * f + (cam.tx ?? 0), H / 2 + (cam.dy ?? 0) * f + (cam.ty ?? 0)];
}
export function view(cam, f = 1) {
  const [ox, oy, z, cx, cy] = params(cam, f);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(cx, cy);
  if (cam.r) g.rotate(cam.r);
  g.scale(z, z);
  g.translate(-ox, -oy);
}
// world point of a layer → screen point
export function toScreen(cam, [x, y], f = 1) {
  const [ox, oy, z, cx, cy] = params(cam, f);
  let X = (x - ox) * z, Y = (y - oy) * z;
  if (cam.r) { const c = Math.cos(cam.r), s = Math.sin(cam.r); [X, Y] = [X * c - Y * s, X * s + Y * c]; }
  return [X + cx, Y + cy];
}
// how big one world unit of a layer is on screen
export const scaleOf = (cam, f = 1) => Math.pow(cam.z, f) * (cam.lens ?? 1);
// the part of a layer's world that is on screen: [x0, y0, x1, y1] (roll ignored)
export function extent(cam, f = 1) {
  const [ox, oy, z, cx, cy] = params(cam, f);
  return [ox - cx / z, oy - cy / z, ox + (W - cx) / z, oy + (H - cy) / z];
}
