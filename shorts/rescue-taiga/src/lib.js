// Math, easing, noise and colour helpers shared by every drawing module.
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));          // progress of x between a and b, clamped
export const smooth = t => t * t * (3 - 2 * t);
export const ease = {
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, k = 1.70158) => 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2),
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
};
// damped spring from 0 to 1 that overshoots: the "pop" of cartoon motion
export function spring(t, freq = 3.2, damp = 7) {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(TAU * freq * t);
}
// one bump 0 → 1 → 0 over [0, 1]
export const bump = t => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));
// eased segment: 0 before a, 1 after b
export const seg = (a, b, t, e = ease.inOut) => e(inv(a, b, t));

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function hash2(x, y) { return hash(x * 157.31 + y * 913.17); }
// smooth value noise in 1D, range -1..1
export function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 101.3), hash(i + 1 + seed * 101.3), u) * 2 - 1;
}
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(a + seed * 17.7, b - seed * 3.1);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), ux), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy) * 2 - 1;
}
export const fbm = (x, seed = 0) => noise(x, seed) * 0.6 + noise(x * 2.1, seed + 7) * 0.3 + noise(x * 4.3, seed + 13) * 0.1;

export function hex(c) {
  if (Array.isArray(c)) return c;
  const v = c.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export function rgba(c, a = 1) { const [r, g, b] = hex(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
export function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return '#' + [0, 1, 2].map(i => Math.round(lerp(a[i], b[i], t)).toString(16).padStart(2, '0')).join('');
}
export const shade = (c, k) => (k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k));

// piecewise keyframes: keys = [[t, value], ...] (values numbers or arrays), eased between keys
export function keys(k, t, e = ease.inOut) {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [t0, v0] = k[i - 1], [t1, v1] = k[i], u = e((t - t0) / (t1 - t0 || 1));
      return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return k[k.length - 1][1];
}
