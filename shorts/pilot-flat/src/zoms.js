// The dead of this episode, all from the «Правило №6» zombie (zombie.js) in other clothes: passengers in coloured shirts,
// and the stewardess in her navy uniform with a red neck scarf, a bun and a little cap. A shamble cycle for walking, and
// helpers for the cemetery (climbing out of a grave) and for the door camera (her face and the tray).
import { lerp, clamp, ease, hash, TAU } from './lib.js';
import { g, ell, limb, fill, rect, rrect, smoothPath, polyPath, inside } from './flat.js';
import { drawZombie, ZOM } from './zombie.js';

const BASE = { ...ZOM };
export const LOOKS = {
  purple: {},
  teal: { shirt: '#2f8f8a', shirtSh: '#236c69', pants: '#3a4a6e', pantsSh: '#2c3856' },
  mustard: { shirt: '#c9a227', shirtSh: '#a07f1c', pants: '#5c4333', pantsSh: '#46332a' },
  red: { shirt: '#b8433b', shirtSh: '#8f322c', pants: '#2f3346', pantsSh: '#23263a' },
  grey: { shirt: '#7d8597', shirtSh: '#626a7b', pants: '#4a3a30', pantsSh: '#382c24', skin: '#9cc48a', skinSh: '#79a06a' },
  stew: { shirt: '#24305a', shirtSh: '#1a2344', pants: '#24305a', pantsSh: '#1a2344', shoe: '#9b1d2a' },
};
// the stewardess's head things: a bun of hair, a little cap, a red scarf at the neck (drawn in the head frame H)
function stewHead(H, s) {
  const b = H.p([42, -70]); ell(b[0], b[1], 30 * s, 26 * s, '#5a3a28');
  fill(smoothPath(H.pts([[-60, -50], [-40, -82], [0, -90], [40, -82], [62, -50], [30, -64], [-20, -66]])), '#6b4530');
  fill(polyPath(H.pts([[-30, -84], [24, -92], [30, -76], [-26, -70]])), '#24305a');
  limb(H.pts([[-28, -74], [28, -82]]), 5 * s, '#f5c518', false);
  fill(smoothPath(H.pts([[-6, 52], [34, 44], [48, 64], [18, 82], [-10, 72]])), '#d9433b');
}
export function zombie(o, look = 'purple') {
  Object.assign(ZOM, BASE, LOOKS[look] ?? {});
  const a = drawZombie({ ...o, headProp: look === 'stew' ? stewHead : o.headProp });
  Object.assign(ZOM, BASE);
  return a;
}
// a shambling walk at x along the ground y: the hip bobs, one foot drags; ph in cycles
export function shamble(x, y, s, face, ph, extra = {}) {
  const f = ph % 1, k = Math.floor(ph) % 2, st = 70 * s, lift = 18 * s * Math.max(0, Math.sin(f * Math.PI));
  const lead = [x + face * st * (f - 0.5), y - lift], back = [x - face * st * (f - 0.5) * 0.6, y];
  const feet = k ? { near: lead, far: back } : { near: back, far: lead };
  return { s, face, hip: [x, y - 250 * s - 8 * s * Math.sin(f * TAU)], feet, lean: 0.2 + 0.05 * Math.sin(f * TAU), ...extra };
}
// arms reaching up (at a door above them), with a slow claw
export const reachUp = (t, i = 0) => ({
  near: { aU: -Math.PI / 2 - 0.5 + 0.15 * Math.sin(t * 3 + i), aF: -Math.PI / 2 - 0.3 + 0.2 * Math.sin(t * 3.4 + i), aH: -Math.PI / 2 - 0.2 },
  far: { aU: -Math.PI / 2 - 0.2 + 0.15 * Math.sin(t * 2.7 + i + 1), aF: -Math.PI / 2 + 0.1 * Math.sin(t * 3 + i), aH: -Math.PI / 2 },
});
// a tray with a coffee cup and a steam curl, held out at p
export function tray(p, s, t) {
  rrect(p[0] - 60 * s, p[1] - 6 * s, 120 * s, 12 * s, 6 * s, '#c7d0dc');
  rrect(p[0] - 18 * s, p[1] - 44 * s, 36 * s, 38 * s, 8 * s, '#ffffff');
  limb([[p[0] + 18 * s, p[1] - 34 * s], [p[0] + 30 * s, p[1] - 26 * s], [p[0] + 18 * s, p[1] - 16 * s]], 5 * s, '#ffffff');
  for (let i = 0; i < 2; i++) { const u = (t * 0.8 + i * 0.5) % 1; limb([[p[0] - 6 * s + i * 10 * s, p[1] - 50 * s], [p[0] + 4 * s * Math.sin(u * 6) + i * 10 * s, p[1] - (50 + 40 * u) * s]], 4 * s, `rgba(255,255,255,${0.6 * (1 - u)})`); }
}
