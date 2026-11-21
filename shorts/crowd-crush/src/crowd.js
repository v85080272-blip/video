// «Давка в толпе, ты внутри»: an evening street by a stadium, a dense crowd in three rows drifting right (simple people:
// a head, a coat, arms), the arrows of the crowd squeezing in, the top-down map card (the crowd moving, the dot of you
// working to the edge), a scarf and a bag on a long strap. World units: the street at y = 0.
import { lerp, clamp, ease, hash, noise, TAU } from './lib.js';
import { g, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath } from './flat.js';
import { text, FONTS, INK } from './type.js';

const COATS = ['#3b4a63', '#5b3a3a', '#2f4f3f', '#4a4a52', '#6b5a3a', '#3a3f6b', '#5d6570', '#7a3f2f'];
const HAIR = ['#2b1d14', '#5b3a22', '#1f1f1f', '#8a6a3a', '#3a2a1a'];
export function street(t) {
  const sky = g.createLinearGradient(0, -2200, 0, -300); sky.addColorStop(0, '#26315e'); sky.addColorStop(1, '#b0788a'); g.fillStyle = sky; g.fillRect(-3000, -3000, 6000, 2800);
  // the stadium behind: its curved wall with arches and a lit rim, two floodlights
  fill(smoothPath([[-1700, -260], [-1500, -880], [0, -1020], [1500, -880], [1700, -260]]), '#4a4f66');
  limb([[-1500, -870], [0, -1010], [1500, -870]], 14, '#ffd98a');
  for (let i = -5; i <= 5; i++) { const x = i * 220; fill(rrPath(x - 60, -720 + 18 * Math.abs(i), 120, 300, 60), '#363a4e'); }
  for (const x of [-560, 560]) {
    limb([[x, -300], [x, -1480]], 16, '#2b2f38'); rect(x - 100, -1580, 200, 90, '#2b2f38');
    g.save(); g.globalAlpha = 0.22; ell(x, -1420, 420, 260, '#fff6c8'); g.restore();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ell(x - 60 + i * 60, -1560 + j * 46, 20, 18, '#fff6c8');
  }
  rect(-3000, -300, 6000, 300, '#2f3340');
  rect(-3000, 0, 6000, 900, '#50535c');
}
// one person seen from the side-front: feet at (x, y), scale s; c colour index; arms up 0…1 (pressed to the chest)
export function person(x, y, s, i, t, sway = 0) {
  g.save(); g.translate(x + sway, y); g.scale(s, s);
  const coat = COATS[i % COATS.length], hair = HAIR[(i * 7) % HAIR.length];
  rect(-34, -120, 26, 120, '#22242c'); rect(8, -120, 26, 120, '#22242c');
  fill(rrPath(-60, -330, 120, 230, 40), coat);
  limb([[-56, -300], [-72, -180]], 26, coat); limb([[56, -300], [72, -180]], 26, coat);
  ell(0, -380, 48, 54, '#e8c09a'); fill(smoothPath([[-50, -390], [-40, -440], [40, -440], [50, -390], [0, -410]]), hair);
  const lx = 6 * Math.sin(i * 2.1 + t * 0.7);                                   // the eyes look about
  ell(-16 + lx, -380, 6, 7, '#2b1d14'); ell(16 + lx, -380, 6, 7, '#2b1d14'); limb([[-10 + lx, -352], [10 + lx, -352]], 4, '#a86a50');
  if (i % 3 === 0) { fill(smoothPath([[-52, -410], [-46, -446], [46, -446], [52, -410]]), COATS[(i + 3) % COATS.length]); }
  g.restore();
}
// a row of people from x0 to x1 at y, scale s, drifting right with t (speed), each with its own sway; skip: a gap at x
export function row(t, y, s, x0, x1, seed, speed = 40, gap = null) {
  const step = 130 * s, off = (t * speed) % step;
  for (let x = x0 - step + off, i = 0; x < x1 + step; x += step, i++) {
    const k = Math.floor((x - off) / step) + seed * 31;
    if (gap && Math.abs(x - gap[0]) < gap[1]) continue;
    person(x + 30 * (hash(k) - 0.5), y + 10 * hash(k * 3), s * (0.92 + 0.16 * hash(k * 7)), Math.abs(k), t, 8 * Math.sin(t * 2.4 + k));
  }
}
// arrows of the crowd pressing in on a point from both sides, k 0…1
export function squeeze(t, x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const ph = (t * 2 + i / 3) % 1, yy = y - 80 + i * 80, xx = x + side * (260 - 60 * ph);
    limb([[xx + side * 110, yy], [xx, yy]], 16, '#e53935', false); poly([[xx - side * 30, yy], [xx + side * 6, yy - 26], [xx + side * 6, yy + 26]], '#e53935');
  }
  g.restore();
}
// the top-down map card (screen space): the crowd as dots streaming right, «you» working from the centre to the edge
// (p 0…1), a crossed-out arrow back against the stream (no 0…1)
export function mapCard(t, cx, cy, k, p, no = 0) {
  if (k <= 0.01) return;
  g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate(-0.02);
  const w = 760, h = 520;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(-w / 2, -h / 2, w, h, 22, '#0f1626'); g.restore();
  rect(-w / 2 + 20, -h / 2 + 40, w - 40, 30, '#3b3f52'); rect(-w / 2 + 20, h / 2 - 70, w - 40, 30, '#3b3f52');
  text('СТЕНА', 0, -h / 2 + 64, 24, '#9aa3ad', { fam: FONTS.cond, shadow: false });
  for (let i = 0; i < 90; i++) {
    const yy = lerp(-h / 2 + 90, h / 2 - 90, hash(i * 1.3)), dens = 1 - Math.abs(yy) / (h / 2 - 90);
    if (hash(i * 5.1) > 0.35 + 0.6 * dens) continue;
    const xx = ((hash(i * 2.7) * (w - 80) + t * 60) % (w - 80)) - (w - 80) / 2;
    ell(xx, yy, 9, 9, '#9fb3c4');
  }
  for (let i = 0; i < 3; i++) { const ph = (t + i / 3) % 1; limb([[-260 + 520 * ph, 0], [-220 + 520 * ph, 0]], 6, 'rgba(255,255,255,0.4)', false); }
  // you: from the centre diagonally with the stream to the edge (bottom)
  const yx = lerp(-120, 160, p), yy = lerp(0, h / 2 - 110, ease.inOut(p));
  g.save(); g.setLineDash([12, 10]); limb([[-120, 0], [yx, yy]], 5, '#ffd23f', false); g.restore();
  ell(yx, yy, 18, 18, '#ffd23f'); text('ТЫ', yx, yy - 30, 28, '#ffd23f', { fam: FONTS.block, shadow: false });
  if (no > 0.01) { g.save(); g.globalAlpha = no; limb([[-150, -40], [-320, -40]], 10, '#e53935', false); poly([[-340, -40], [-300, -62], [-300, -18]], '#e53935'); limb([[-260, -80], [-200, 0]], 10, '#e53935', false); limb([[-260, 0], [-200, -80]], 10, '#e53935', false); g.restore(); }
  g.restore();
}
