// The blueprint language (the workflow's «схемы»): thin glowing lines on near-black, a grid that moves with the camera,
// and two screen-space explainers: a chain of nodes that go dark one after another («ТОК → ОЧИСТКА → ВОЗДУХ») and a tall
// gauge. The submarine drawn in these lines is in subbp.js.
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, rrPath, inside, col } from './flat.js';
import { lerp, clamp, spring, TAU, rgba, mix } from './lib.js';
import { label, icon, NIGHT } from './hud.js';
import { FONTS } from './type.js';

const PAL = {
  night: { bg0: NIGHT.bg0, bg1: NIGHT.bg1, grid: rgba(NIGHT.line, 0.08), line: NIGHT.line, hi: NIGHT.lineHi, faint: '#2a5b96', water: '#2f86e6', waterHi: '#7cc4ff', danger: NIGHT.danger, ok: NIGHT.ok, warm: NIGHT.warm, text: '#9cc6f2', glow: 0.22 },
};
export const palette = k => PAL[k];

// a glowing stroke: a wide faint pass under a thin bright one (no blur filters: they flicker)
export function gline(pts, w, c, P, closed = false) {
  const p = polyPath(pts, closed);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (P.glow > 0) { g.lineWidth = w * 4; g.strokeStyle = rgba(c, P.glow * 0.5); g.stroke(p); g.lineWidth = w * 2.2; g.strokeStyle = rgba(c, P.glow); g.stroke(p); }
  g.lineWidth = w; g.strokeStyle = col(c); g.stroke(p);
}
export function grect(x, y, w, h, lw, c, P) { gline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lw, c, P, true); }

// the background over the whole screen: gradient and a grid that moves with the camera
export function backdrop(P, cam) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg0); gr.addColorStop(1, P.bg1);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const z = cam.z * (cam.lens ?? 1), step = 60 * z;
  if (step < 12) return;
  const ox = ((W / 2 - cam.x * z) % step + step) % step, oy = ((H / 2 - cam.y * z) % step + step) % step;
  g.fillStyle = P.grid;
  for (let x = ox; x < W; x += step) g.fillRect(Math.round(x), 0, 1.5, H);
  for (let y = oy; y < H; y += step) g.fillRect(0, Math.round(y), W, 1.5);
}

// —— screen space: a chain of nodes [icon, name, colour]; link i goes dark at offs[i] ——
export function chain(t, t0, t1, nodes, offs, y = 520) {
  if (t < t0 || t > t1 + 0.3) return;
  const a = clamp((t - t0) / 0.15) * (1 - clamp((t - t1) / 0.2)), xs = [200, 540, 880];
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  nodes.forEach(([ic, name, c0], i) => {
    const kin = clamp(spring(t - t0 - i * 0.09, 2.6, 9)), dead = offs[i] != null && t > offs[i] ? clamp((t - offs[i]) / 0.18) : 0;
    const c = mix(c0, '#3a4357', dead), x = xs[i];
    if (i < nodes.length - 1) {                     // the arrow to the next node
      const d2 = offs[i] != null && t > offs[i] ? 1 : 0, c2 = d2 ? '#3a4357' : NIGHT.lineHi;
      g.save(); g.setLineDash([14, 12]); g.lineDashOffset = -t * 60 * (1 - d2); g.lineWidth = 6; g.strokeStyle = c2; g.beginPath(); g.moveTo(x + 92, y); g.lineTo(xs[i + 1] - 108, y); g.stroke(); g.restore();
      poly([[xs[i + 1] - 92, y], [xs[i + 1] - 116, y - 16], [xs[i + 1] - 116, y + 16]], c2);
    }
    g.save(); g.translate(x, y); g.scale(lerp(0.94, 1, kin), lerp(0.94, 1, kin)); g.globalAlpha *= clamp(kin * 2);
    ell(0, 0, 84, 84, 'rgba(11,15,26,0.92)');
    g.lineWidth = 5; g.strokeStyle = col(c); g.shadowColor = c; g.shadowBlur = dead > 0.5 ? 0 : 18; g.beginPath(); g.arc(0, 0, 80, 0, TAU); g.stroke(); g.shadowBlur = 0;
    g.save(); g.translate(0, -8); if (ic === 'fan') g.rotate(dead > 0.5 ? 0.3 : t * 5); icon(ic, 40, c); g.restore();
    label(name, 0, 140, 40, dead > 0.5 ? '#6b7489' : '#ffffff', { fam: FONTS.mono, shadow: false });
    if (dead > 0.3) { g.globalAlpha *= clamp((dead - 0.3) / 0.4); icon('x', 30, NIGHT.danger); }
    g.restore();
  });
  g.restore();
}

// —— screen space: a tall gauge; level 0…1. bad = 'low' reddens it when it empties (water), 'high' when it fills (CO₂) ——
export function gauge(t, t0, t1, x, y, level, title, o = {}) {
  if (t < t0 || t > t1 + 0.3) return;
  const a = clamp((t - t0) / 0.15) * (1 - clamp((t - t1) / 0.2)), k = lerp(0.94, 1, clamp(spring(t - t0, 2.6, 9)));
  const w = o.w ?? 120, h = o.h ?? 420, lv = clamp(level), bad = o.bad === 'high' ? lv : 1 - lv;
  const c = bad > 0.66 ? NIGHT.danger : bad > 0.4 ? NIGHT.gold : (o.okColor ?? '#3b9cff');
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(k, k);
  fill(rrPath(-w / 2 - 18, -h / 2 - 90, w + 36, h + 130, 22), 'rgba(11,15,26,0.9)');
  g.save(); g.lineWidth = 3; g.strokeStyle = col(c); g.shadowColor = c; g.shadowBlur = 14; g.stroke(rrPath(-w / 2 - 16, -h / 2 - 88, w + 32, h + 126, 21)); g.restore();
  label(title, 0, -h / 2 - 40, 38, '#ffffff', { fam: FONTS.black, shadow: false, stroke: false });
  rrect(-w / 2, -h / 2, w, h, 16, '#1a2236');
  const fh = h * lv;
  if (fh > 2) {
    inside(rrPath(-w / 2, -h / 2, w, h, 16), () => {
      rect(-w / 2, h / 2 - fh, w, fh, c);
      if (o.dots) for (let i = 0; i < 9; i++) { const u = (t * 0.5 + i / 9) % 1, yy = h / 2 - fh * u; ell(-w / 2 + 20 + ((i * 37) % (w - 40)), yy, 6, 6, rgba('#ffffff', 0.35 * (1 - u))); }
      else for (let i = 0; i < 3; i++) ell(-w / 2 + ((t * 80 + i * 50) % (w + 40)) - 20, h / 2 - fh, 26, 7, rgba('#ffffff', 0.35));
    });
  }
  for (let i = 1; i < 5; i++) rect(w / 2 - 26, -h / 2 + i * h / 5, 26, 3, rgba('#ffffff', 0.4));
  g.restore();
}
