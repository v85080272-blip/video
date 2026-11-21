// The explainers: the tower as a blueprint in thin glowing lines (the workflow's main device, «схемы»). A cut through
// all 22 floors: the stairwell with its zigzag flights, the riser that carries water up from the pump in the basement,
// a tap on every floor, the power cable from the city grid to the pump. People are red dots running down the stairs;
// the water in the riser falls from the top floor down when the pump stops. At night it is blue lines on near-black,
// on day 3 the same drawing on paper. Screen-space parts: the chain «СЕТЬ → НАСОС → ВОДА» and the water gauge.
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside, col } from './flat.js';
import { lerp, clamp, ease, spring, bump, hash, noise, TAU, rgba, mix } from './lib.js';
import { label, icon, NIGHT } from './hud.js';
import { FONTS } from './type.js';

export const FH = 110, FLOORS = 22;
export const BLD = { x0: -460, x1: 460, stair: [-440, -240], riser: -160, tap: -96, base: 170 };
export const floorY = f => -(f - 1) * FH;            // the floor slab of floor f (1 = ground)
export const HOME = 20;
export const PUMP = [-160, 92];
export const GRID = [-1500, 40];
const PAL = {
  night: { bg0: NIGHT.bg0, bg1: NIGHT.bg1, grid: rgba(NIGHT.line, 0.08), line: NIGHT.line, hi: NIGHT.lineHi, faint: '#2a5b96', water: '#2f86e6', waterHi: '#7cc4ff', danger: NIGHT.danger, ok: NIGHT.ok, warm: NIGHT.warm, text: '#9cc6f2', glow: 0.22 },
  paper: { bg0: '#f6f2e7', bg1: '#ece6d6', grid: 'rgba(59,142,234,0.12)', line: '#2c5d9e', hi: '#1d4a86', faint: '#93abcb', water: '#3b8eea', waterHi: '#2c6fc0', danger: '#d6342f', ok: '#2f9e5a', warm: '#e08a1c', text: '#2c5d9e', glow: 0 },
};
export const palette = k => PAL[k];

// a glowing stroke: a wide faint pass under a thin bright one (no blur filters: they flicker)
function gline(pts, w, c, P, closed = false) {
  const p = polyPath(pts, closed);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (P.glow > 0) { g.lineWidth = w * 4; g.strokeStyle = rgba(c, P.glow * 0.5); g.stroke(p); g.lineWidth = w * 2.2; g.strokeStyle = rgba(c, P.glow); g.stroke(p); }
  g.lineWidth = w; g.strokeStyle = col(c); g.stroke(p);
}
export { gline };
function grect(x, y, w, h, lw, c, P) { gline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lw, c, P, true); }

// the background over the whole screen: gradient and a grid that moves with the camera (cam = view params)
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

// the zigzag of the stairs: a point at u (0 = top landing of floor FLOORS, 1 = ground floor exit)
const STAIR = (() => {
  const pts = [], [x0, x1] = BLD.stair;
  for (let f = FLOORS; f >= 1; f--) { const y = floorY(f) - 4; pts.push([x1 - 20, y], [x0 + 20, y + FH / 2]); }
  pts.push([x1 - 20, floorY(1) + 0], [BLD.x0 - 160, floorY(1) + 0]);
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
})();
export function stairAt(d) {                    // a point at distance d along the stairs from the top
  const { pts, len } = STAIR; d = clamp(d, 0, STAIR.total);
  let i = 1; while (i < len.length - 1 && len[i] < d) i++;
  const u = (d - len[i - 1]) / (len[i] - len[i - 1] || 1);
  return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
}
export const stairD = f => STAIR.len[(FLOORS - f) * 2];   // where floor f's landing is on the stairs

// the tower. st: { level (floor the water reaches, FLOORS + 1 = full), flow (0…1: arrows up the riser), spin (pump angle),
//   power (0…1: the cable glows), dots ([x, y, colour] people), home (0…1: floor 20 lit warm), dry (0…1 the red marks),
//   labels (floor numbers 0…1), mark (t of the red X on the grid), only ([f0, f1] floors to draw, for close-ups) }
export function tower(t, P, st) {
  const { x0, x1, stair, riser, tap } = BLD;
  const top = floorY(FLOORS + 1);
  // outer walls, roof, basement
  gline([[x0, BLD.base], [x0, top], [x1, top], [x1, BLD.base]], 5, P.line, P);
  gline([[x0 - 40, BLD.base], [x1 + 40, BLD.base]], 5, P.line, P);
  gline([[x0 - 400, 0], [x0, 0]], 3, P.faint, P); gline([[x1, 0], [x1 + 400, 0]], 3, P.faint, P);
  gline([[x0 + 60, top], [x0 + 60, top - 70], [x0 + 260, top - 70], [x0 + 260, top]], 3, P.faint, P);   // the machine room on the roof
  gline([[stair[1], BLD.base], [stair[1], top]], 3, P.faint, P);
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorY(f + 1);
    gline([[x0, y], [x1, y]], 3, P.line, P);
    // the flat: its door and its window
    gline([[stair[1] + 30, y + FH], [stair[1] + 30, y + FH - 70]], 2, P.faint, P);
    grect(x1 - 90, y + 26, 54, 44, 2, P.faint, P);
  }
  if ((st.home ?? 0) > 0.01) {                     // floor 20 in warm light
    const y = floorY(HOME + 1);
    g.save(); g.globalAlpha *= st.home;
    fill(rrPath(stair[1] + 4, y + 4, x1 - stair[1] - 8, FH - 8, 4), rgba(P.warm, 0.14));
    grect(stair[1] + 4, y + 4, x1 - stair[1] - 8, FH - 8, 4, P.warm, P);
    g.restore();
  }
  // the stairs
  const S = STAIR.pts;
  for (let i = 0; i < S.length - 2; i += 2) gline([S[i], S[i + 1], S[i + 2]], 3, P.faint, P);
  // the riser and the taps
  const lvY = floorY(clamp(st.level ?? FLOORS + 1, 0, FLOORS + 1)) - 10;
  gline([[riser - 16, PUMP[1] - 40], [riser - 16, top + 20]], 3, P.line, P);
  gline([[riser + 16, PUMP[1] - 40], [riser + 16, top + 20]], 3, P.line, P);
  if (lvY < PUMP[1] - 40) {
    rect(riser - 12, lvY, 24, PUMP[1] - 40 - lvY, rgba(P.water, 0.75));
    rect(riser - 12, lvY - 4, 24, 6, P.waterHi);
    const flow = st.flow ?? 0;
    if (flow > 0.01) for (let y = PUMP[1] - 60 - ((t * 260) % 90); y > lvY + 20; y -= 90) {         // chevrons going up
      limb([[riser - 8, y + 8], [riser, y], [riser + 8, y + 8]], 4, rgba('#d6ecff', flow), false);
    }
  }
  for (let f = 1; f <= FLOORS; f++) {
    const y = floorY(f) - 52, wet = floorY(f) - 20 > lvY;
    gline([[riser + 16, y], [tap, y], [tap, y + 18]], 3, wet ? P.water : P.faint, P);
    if (wet) ell(tap, y + 34 + 6 * ((t * 3 + f * 0.37) % 1), 6, 9, P.waterHi);
    else if ((st.dry ?? 0) > 0.01) {
      const k = clamp(st.dry * 3 - (FLOORS - f) * 0.12);
      if (k > 0) { g.save(); g.globalAlpha *= clamp(k); g.translate(tap + 2, y + 34); icon('x', 14, P.danger); g.restore(); }
    }
  }
  // floor numbers on the right
  if ((st.labels ?? 0) > 0.01) for (let f = 1; f <= FLOORS; f++) {
    const a = clamp(st.labels * 4 - (f - 1) / FLOORS * 3);
    if (a <= 0) continue;
    label(String(f).padStart(2, '0'), x1 + 30, floorY(f) - FH / 2 + 16, 44, f === HOME ? P.warm : P.text, { fam: FONTS.mono, align: 'left', a, shadow: false, stroke: false });
  }
  // the pump room: the pump, the city main coming in, the power cable
  grect(x0 + 20, 20, 520, BLD.base - 40, 2, P.faint, P);
  gline([[x0 - 400, 132], [riser - 60, 132], [riser - 60, PUMP[1] + 20]], 4, P.water, P);
  const pw = clamp(st.power ?? 1);
  gline([[GRID[0], GRID[1]], [x0 + 60, GRID[1]], [x0 + 60, PUMP[1] - 30], [riser - 52, PUMP[1] - 30]], 4, mix(P.faint, P.warm, pw), { ...P, glow: P.glow * (0.3 + pw) });
  if (pw > 0.02) for (let x = GRID[0] + ((t * 900) % 120); x < x0 + 50; x += 120) ell(x, GRID[1], 7, 7, rgba(P.warm, pw));
  g.lineWidth = 4; g.strokeStyle = col(P.line); g.beginPath(); g.arc(PUMP[0], PUMP[1], 46, 0, TAU); g.stroke();
  g.lineWidth = 12; g.strokeStyle = rgba(P.line, P.glow); g.stroke();
  for (let i = 0; i < 5; i++) { const a = (st.spin ?? 0) + i * TAU / 5; limb([[PUMP[0], PUMP[1]], [PUMP[0] + Math.cos(a) * 38, PUMP[1] + Math.sin(a) * 38]], 5, P.hi, false); }
  ell(PUMP[0], PUMP[1], 8, 8, P.hi);
  // the grid: a pylon far left
  const gx = GRID[0], gy = GRID[1];
  gline([[gx - 50, 160], [gx, gy - 160], [gx + 50, 160]], 3, P.line, P);
  gline([[gx - 70, gy - 110], [gx + 70, gy - 110]], 3, P.line, P);
  gline([[gx - 34, gy + 10], [gx + 34, gy + 10]], 3, P.line, P);
  if (st.mark != null && t > st.mark) { const k = clamp(spring(t - st.mark, 2.6, 8)); g.save(); g.translate(gx, gy - 40); g.scale(k, k); icon('x', 70, P.danger); g.restore(); }
  // people on the stairs
  for (const [x, y, c, r] of st.dots ?? []) { ell(x, y, (r ?? 11) * 2, (r ?? 11) * 2, rgba(c, 0.25)); ell(x, y, r ?? 11, r ?? 11, c); }
}

// red dots running down: who starts on which floor and when (seeded), where they are at t
export function crowd(t, t0, n = 46) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = 2 + Math.floor(hash(i * 3.7) * (FLOORS - 1)), start = t0 + hash(i * 5.3) * 1.6, v = 520 + 260 * hash(i * 9.1);
    if (f === HOME) continue;
    const d = stairD(f) + Math.max(0, t - start) * v;
    if (d > STAIR.total + 200) continue;
    const p = stairAt(d);
    out.push([p[0] + 10 * (hash(i * 2.9) - 0.5), p[1] - 10 - 8 * Math.abs(Math.sin((t - start) * 14 + i)), NIGHT.danger, 10]);
  }
  return out;
}

// —— screen space: the chain «СЕТЬ → НАСОС → ВОДА»; link i goes dark at offs[i] ——
export function chain(t, t0, t1, offs, y = 520) {
  if (t < t0 || t > t1 + 0.3) return;
  const a = clamp((t - t0) / 0.15) * (1 - clamp((t - t1) / 0.2));
  const nodes = [['bolt', 'СЕТЬ'], ['pump', 'НАСОС'], ['drop', 'ВОДА']], xs = [210, 540, 870];
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a;
  nodes.forEach(([ic, name], i) => {
    const kin = clamp(spring(t - t0 - i * 0.09, 2.6, 9)), dead = offs[i] != null && t > offs[i] ? clamp((t - offs[i]) / 0.18) : 0;
    const c = mix(i === 0 ? NIGHT.warm : i === 1 ? NIGHT.line : '#5bb4ff', '#3a4357', dead), x = xs[i];
    if (i < 2) {                                    // the arrow to the next node
      const d2 = offs[i] != null && t > offs[i] ? 1 : 0, c2 = d2 ? '#3a4357' : NIGHT.lineHi;
      g.save(); g.setLineDash([14, 12]); g.lineDashOffset = -t * 60 * (1 - d2); g.lineWidth = 6; g.strokeStyle = c2; g.beginPath(); g.moveTo(x + 92, y); g.lineTo(xs[i + 1] - 108, y); g.stroke(); g.restore();
      poly([[xs[i + 1] - 92, y], [xs[i + 1] - 116, y - 16], [xs[i + 1] - 116, y + 16]], c2);
    }
    g.save(); g.translate(x, y); g.scale(lerp(0.94, 1, kin), lerp(0.94, 1, kin)); g.globalAlpha *= clamp(kin * 2);
    ell(0, 0, 84, 84, 'rgba(11,15,26,0.92)');
    g.lineWidth = 5; g.strokeStyle = col(c); g.shadowColor = c; g.shadowBlur = dead > 0.5 ? 0 : 18; g.beginPath(); g.arc(0, 0, 80, 0, TAU); g.stroke(); g.shadowBlur = 0;
    g.save(); g.translate(0, -8); if (ic === 'pump') g.rotate(dead > 0.5 ? 0.3 : t * 4); icon(ic, 40, c); g.restore();
    label(name, 0, 140, 40, dead > 0.5 ? '#6b7489' : '#ffffff', { fam: FONTS.mono, shadow: false });
    if (dead > 0.3) { g.globalAlpha *= clamp((dead - 0.3) / 0.4); icon('x', 30, NIGHT.danger); }
    g.restore();
  });
  g.restore();
}

// —— screen space: a tall water gauge for one floor; level 0…1, it reddens below a third ——
export function gauge(t, t0, t1, x, y, level, title) {
  if (t < t0 || t > t1 + 0.3) return;
  const a = clamp((t - t0) / 0.15) * (1 - clamp((t - t1) / 0.2)), k = lerp(0.94, 1, clamp(spring(t - t0, 2.6, 9)));
  const w = 120, h = 420, lv = clamp(level), c = lv < 0.33 ? NIGHT.danger : lv < 0.6 ? NIGHT.gold : '#3b9cff';
  g.setTransform(1, 0, 0, 1, 0, 0); g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(k, k);
  fill(rrPath(-w / 2 - 18, -h / 2 - 90, w + 36, h + 130, 22), 'rgba(11,15,26,0.9)');
  g.save(); g.lineWidth = 3; g.strokeStyle = col(c); g.shadowColor = c; g.shadowBlur = 14; g.stroke(rrPath(-w / 2 - 16, -h / 2 - 88, w + 32, h + 126, 21)); g.restore();
  label(title, 0, -h / 2 - 40, 34, '#ffffff', { fam: FONTS.mono, shadow: false, stroke: false });
  rrect(-w / 2, -h / 2, w, h, 16, '#1a2236');
  const fh = h * lv;
  if (fh > 2) {
    inside(rrPath(-w / 2, -h / 2, w, h, 16), () => {
      rect(-w / 2, h / 2 - fh, w, fh, c);
      for (let i = 0; i < 3; i++) ell(-w / 2 + ((t * 80 + i * 50) % (w + 40)) - 20, h / 2 - fh, 26, 7, rgba('#ffffff', 0.35));
    });
  }
  for (let i = 1; i < 5; i++) rect(w / 2 - 26, -h / 2 + i * h / 5, 26, 3, rgba('#ffffff', 0.4));
  g.restore();
}
