// The submarine as a blueprint: the outer hull and the sail from the same outline as the boat outside (so the boat can
// turn into its drawing in place), the pressure hull inside it, bulkheads, the deck, the battery and the cable to the
// air scrubber, the bow and stern ballast tanks with water in them, the high-pressure air bottles and the pipes to the
// tanks with the blow valve. Red specks of CO₂ fill the pressure hull as the air goes bad.
import { g, ell, limb, rect, fill, polyPath, inside, sample } from './flat.js';
import { lerp, clamp, hash, TAU, rgba, mix, bump } from './lib.js';
import { gline, grect } from './scheme.js';
import { label, icon } from './hud.js';
import { hullPts, sailPts, SUBG } from './sea.js';
import { FONTS } from './type.js';

const PH = (() => {                     // the pressure hull: a capsule inside the outer hull
  const pts = [], x0 = -700, x1 = 720, r = 112;
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI * i / 12; pts.push([x1 - r + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + Math.PI * i / 12; pts.push([x0 + r + Math.cos(a) * r, Math.sin(a) * r]); }
  return pts;
})();
export const YOU = [250, 20], SCRUB = [-150, -30];
const OUTER = sample(hullPts(), 6, true), SAIL = sample(sailPts(), 6, false);
const PIPE_B = [[400, 86], [700, 86], [760, 60], [780, -90]], PIPE_S = [[100, 86], [-650, 86], [-740, 50], [-770, -80]];
const CABLE = [[600, 70], [600, -88], [-150, -88], [-150, -70]];
function along(pts, u) {                   // a point at fraction u along a polyline
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let d = clamp(u) * tot, i = 0;
  while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
  const k = d / L[i]; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
}

// st: { x, y, s, power 0…1, spin (scrubber fan), co2 0…1, tanks 0…1 (water in the ballast), blow 0…1 (air flowing),
//       valve 0…1 (blow valve open), you (show the warm dot), out (0…1 water jets out of the floods) }
export function drawBP(t, P, st) {
  const s = st.s ?? 1;
  g.save(); g.translate(st.x, st.y); g.scale(s, s);
  const outer = polyPath(OUTER, true), ph = polyPath(PH, true);
  // ballast water in the tanks at the bow and the stern (between the hulls)
  const lv = clamp(st.tanks ?? 1);
  if (lv > 0.005) inside(outer, () => {
    const top = lerp(160, -160, lv);
    for (const [a, b] of [[728, 1010], [-1010, -708]]) {
      rect(a, top, b - a, 170 - top, rgba(P.water, 0.55));
      for (let x = a + 10; x < b; x += 40) ell(x + 10 * Math.sin(t * 3 + x), top, 16, 4, rgba(P.waterHi, 0.8));
    }
  });
  // CO₂: a red tint and drifting specks inside the pressure hull
  const co2 = clamp(st.co2 ?? 0);
  if (co2 > 0.01) inside(ph, () => {
    rect(-720, -130, 1460, 260, rgba(P.danger, 0.2 * co2));
    const n = Math.round(90 * co2);
    for (let i = 0; i < n; i++) {
      const x = lerp(-680, 700, hash(i * 3.17)) + 30 * Math.sin(t * 0.7 + i), y = lerp(-100, 100, hash(i * 7.31)) + 14 * Math.sin(t * 1.1 + i * 2);
      ell(x, y, 7, 7, rgba(P.danger, 0.5 + 0.4 * hash(i)));
    }
  });
  gline(OUTER, 5, P.line, P, true);
  gline(SAIL, 4, P.line, P);
  gline(PH, 4, P.hi, P, true);
  gline([[-690, 40], [712, 40]], 3, P.faint, P);
  for (const x of [420, 60, -300]) gline([[x, -110], [x, 110]], 3, P.line, P);
  gline([[728, -140], [728, 146]], 3, P.faint, P); gline([[-708, -116], [-708, 118]], 3, P.faint, P);
  for (const [x, y] of SUBG.vents) { gline([[x - 26, y + 16], [x - 26, y + 34]], 3, P.line, P); gline([[x + 26, y + 16], [x + 26, y + 34]], 3, P.line, P); }
  // the screw and the stern planes in outline
  gline([[-1018, -150], [-1018, 150]], 4, P.faint, P);
  gline([[-690, -120], [-760, -300], [-840, -300], [-870, -80]], 3, P.faint, P);
  gline([[-690, 120], [-760, 300], [-840, 300], [-870, 80]], 3, P.faint, P);
  // the battery and its cable to the scrubber
  const pw = clamp(st.power ?? 1);
  for (let i = 0; i < 6; i++) grect(440 + i * 42, 52, 34, 46, 2, mix(P.faint, P.warm, pw), P);
  gline(CABLE, 4, mix(P.faint, P.warm, pw), { ...P, glow: P.glow * (0.3 + pw) });
  if (pw > 0.02) for (let i = 0; i < 6; i++) { const p = along(CABLE, ((t * 0.8 + i / 6) % 1)); ell(p[0], p[1], 7, 7, rgba(P.warm, pw)); }
  // the scrubber: a box with a fan
  grect(SCRUB[0] - 80, SCRUB[1] - 50, 160, 100, 3, P.line, P);
  g.save(); g.translate(SCRUB[0], SCRUB[1]); g.rotate(st.spin ?? 0); icon('fan', 38, mix(P.faint, P.hi, 0.4 + 0.6 * pw)); g.restore();
  label('ОЧИСТКА', SCRUB[0], SCRUB[1] - 66, 26, P.text, { fam: FONTS.mono, shadow: false, stroke: false });
  // the air bottles and the pipes to the tanks
  for (const y of [70, 100]) gline([[110, y], [390, y]], 18, mix(P.faint, '#d6ecff', clamp(st.blow ?? 0) * 0.7), { ...P, glow: 0.12 });
  gline(PIPE_B, 4, P.line, P); gline(PIPE_S, 4, P.line, P);
  const bl = clamp(st.blow ?? 0);
  if (bl > 0.01) for (const pipe of [PIPE_B, PIPE_S]) for (let i = 0; i < 5; i++) {
    const u = (t * 1.6 + i / 5) % 1, p = along(pipe, u), q = along(pipe, Math.min(1, u + 0.02)), a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    g.save(); g.translate(p[0], p[1]); g.rotate(a); limb([[-16, -16], [4, 0], [-16, 16]], 8, rgba('#e6f6ff', bl), false); g.restore();
  }
  // the blow valve on the pipe: a bow tie that turns green when open
  const vc = mix(P.danger, P.ok, clamp(st.valve ?? 0)), vx = 450, vy = 86;
  fill(polyPath([[vx - 18, vy - 16], [vx + 18, vy + 16], [vx + 18, vy - 16], [vx - 18, vy + 16]], true), vc);
  limb([[vx, vy], [vx, vy - 30]], 4, vc, false); limb([[vx - 12, vy - 30], [vx + 12, vy - 30]], 5, vc, false);
  // water forced out of the floods: jets downwards, then bubbles
  const out = clamp(st.out ?? 0);
  if (out > 0.01) for (const [x, y] of SUBG.vents) for (let i = 0; i < 4; i++) {
    const u = (t * 2.2 + i / 4) % 1;
    if (lv > 0.05) limb([[x - 10 + 7 * i, y + 30 + u * 120], [x - 10 + 7 * i, y + 30 + u * 120 + 30]], 6, rgba(P.waterHi, out * (1 - u)), false);
    else ell(x - 20 + 14 * i + 6 * Math.sin(t * 5 + i), y + 20 - u * 60, 8, 8, rgba('#e6f6ff', out * bump(u)));
  }
  // you
  if (st.you !== false) {
    const bob = 4 * Math.abs(Math.sin(t * 3));
    ell(YOU[0], YOU[1] - bob, 26, 26, rgba(P.warm, 0.25)); ell(YOU[0], YOU[1] - bob, 13, 13, P.warm);
    label('ТЫ', YOU[0] + 24, YOU[1] - 26, 30, P.warm, { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  }
  g.restore();
}
