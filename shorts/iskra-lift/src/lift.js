// «Незнакомец в лифте»: the stranger (a dark coat, a cap pulled low, no hood), the cabin from inside with its call panel,
// the stairwell in section with the lift shaft and the neighbours' doors, a phone calling home, the flat's door at night.
import { lerp, clamp, TAU, hash, ease } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, polyPath, rrPath, smoothPath, texArea } from './flat.js';
import { text, FONTS, INK } from './type.js';

// the stranger standing, his feet at (cx, y1), scale s; o.eyes 0…1, o.arm the door-holding arm, o.lean −1…1
export function stranger(cx, y1, s, t, o = {}) {
  g.save(); g.translate(cx, y1); g.scale(s, s);
  const sway = 4 * Math.sin(t * 1.5), lean = (o.lean ?? 0) * 30;
  rect(-90, -60, 70, 60, '#1c1e24'); rect(20, -60, 70, 60, '#1c1e24');
  fill(smoothPath([[-150, -40], [-130 + lean, -520], [-70 + lean, -620], [70 + lean, -620], [130 + lean, -520], [150, -40]]), '#2b2f38');
  limb([[0 + lean, -600], [0, -60]], 6, '#20232a');
  poly([[-80 + lean, -620], [-40 + lean, -690], [lean, -640], [40 + lean, -690], [80 + lean, -620]], '#23262e');
  const hx = lean + sway;
  ell(hx, -720, 54, 64, '#8a6a52'); ell(hx, -700, 50, 40, '#6e523e');
  fill(smoothPath([[-62 + hx, -750], [-50 + hx, -800], [50 + hx, -800], [62 + hx, -750]]), '#1f2228');
  rect(-80 + hx, -756, 160, 16, '#1f2228');
  if (o.eyes) { ell(hx - 18, -722, 6, 4, '#ffffff', 0, o.eyes); ell(hx + 18, -722, 6, 4, '#ffffff', 0, o.eyes); }
  if (o.arm) limb(o.arm, 34, '#2b2f38');
  else { limb([[-120 + lean, -540], [-140, -330]], 34, '#2b2f38'); limb([[120 + lean, -540], [140, -330]], 34, '#2b2f38'); }
  g.restore();
}

// the cabin from inside, looking at its doors: steel walls, a ceiling light, the call panel right of the doors;
// o.open 0…1 the doors, o.floor the display, o.up ▲, o.lit the lit floor button (1…9), o.bell 0…1, o.shake px,
// o.near 0…1 the stranger stepping closer
export const PANEL = { x: 900, y: 560, w: 130, h: 520 };
const BTN = n => [PANEL.x + 34 + ((n - 1) % 2) * 62, PANEL.y + 120 + Math.floor((9 - n) / 2) * 64];  // 9 at the top
export const btnAt = BTN;
export const BELL = [PANEL.x + 65, PANEL.y + 460];
export function cabin(t, o = {}) {
  const sh = o.shake ?? 0, sx = sh * Math.sin(t * 61), sy = sh * 0.6 * Math.cos(t * 47);
  g.save(); g.translate(sx, sy);
  // the landing seen through the doors
  rect(0, 0, 1080, 1920, '#dcd5c3');
  const low = polyPath([[0, 760], [1080, 760], [1080, 1500], [0, 1500]]); fill(low, '#4f7f5a'); texArea(low, 'concrete', 0.8, 0.45);
  rect(0, 752, 1080, 12, '#3a5f43');
  text(String(o.landing ?? 4), 620, 640, 120, '#3a5f43', { fam: FONTS.block, shadow: false });
  // the walls of the cabin: brushed steel, the side walls in perspective, the ceiling with its light
  for (const [ax, ay, aw, ah] of [[0, 0, 330, 1920], [800, 0, 280, 1920], [330, 0, 470, 300], [330, 1400, 470, 520]]) {
    const wp = polyPath([[ax, ay], [ax + aw, ay], [ax + aw, ay + ah], [ax, ay + ah]]); fill(wp, '#a9aeb4'); texArea(wp, 'rust', 0.7, 0.12);
    for (let i = 0; i < 18; i++) if (i * 110 > ay && i * 110 < ay + ah) rect(ax, i * 110, aw, 2, 'rgba(255,255,255,0.18)');
  }
  rect(1080, -400, 900, 2700, '#8d9298'); for (let i = 0; i < 20; i++) rect(1080, i * 110 - 200, 900, 2, 'rgba(255,255,255,0.12)');
  fill(polyPath([[0, 0], [110, 120], [110, 1460], [0, 1640]]), '#8d9298');
  fill(polyPath([[1080, 0], [1060, 20], [1060, 1520], [1080, 1640]]), '#8d9298');
  fill(polyPath([[0, 0], [1080, 0], [1060, 20], [110, 120]]), '#d8dbe0');
  rrect(380, 40, 360, 46, 20, '#fff8dc'); g.save(); g.globalAlpha = 0.25; ell(560, 70, 420, 120, '#fff6c8'); g.restore();
  rect(0, 1460, 1980, 460, '#5b5249'); texArea(polyPath([[0, 1460], [1980, 1460], [1980, 1920], [0, 1920]]), 'concrete', 0.6, 0.5);
  // the doors
  const x0 = 330, x1 = 800, y0 = 300, y1 = 1400, half = (x1 - x0) / 2, gap = half * ease.inOut(clamp(o.open ?? 0));
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  for (const [dx, dir] of [[x0, -1], [x0 + half, 1]]) {
    const xx = dx + dir * gap; const dp = rrPath(xx, y0, half, y1 - y0, 2); fill(dp, '#b9bec4'); texArea(dp, 'rust', 0.7, 0.18);
    rect(xx + (dir < 0 ? half - 6 : 0), y0, 6, y1 - y0, '#8d9298');
  }
  g.restore();
  rect(x0 - 14, y0 - 14, 14, y1 - y0 + 14, '#6f747a'); rect(x1, y0 - 14, 14, y1 - y0 + 14, '#6f747a'); rect(x0 - 14, y0 - 14, x1 - x0 + 28, 14, '#6f747a');
  // the call panel: the display, the floor buttons, the dispatcher's bell
  fill(rrPath(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 14), '#c9ced4');
  rrect(PANEL.x + 14, PANEL.y + 16, PANEL.w - 28, 70, 8, '#1d1f24');
  text((o.up ? '▲' : '') + String(o.floor ?? 1), PANEL.x + PANEL.w / 2, PANEL.y + 68, 46, '#ff5a3a', { fam: FONTS.mono, shadow: false });
  for (let n = 1; n <= 9; n++) {
    const [bx, by] = BTN(n), lit = o.lit === n;
    ell(bx, by, 24, 24, lit ? '#ffcf4a' : '#e9ecef'); g.save(); g.lineWidth = 3; g.strokeStyle = '#8d9298'; g.beginPath(); g.arc(bx, by, 24, 0, TAU); g.stroke(); g.restore();
    text(String(n), bx, by + 11, 30, lit ? INK : '#3a3f46', { fam: FONTS.cond, shadow: false });
  }
  const bk = clamp(o.bell ?? 0);
  ell(BELL[0], BELL[1], 30, 30, bk > 0.5 ? '#ffcf4a' : '#f2c230'); bell(BELL[0], BELL[1], 16, INK);
  if (bk > 0.01) { g.save(); g.lineWidth = 5; g.strokeStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; g.globalAlpha = bk * (1 - ph); g.beginPath(); g.arc(BELL[0], BELL[1], 40 + ph * 70, 0, TAU); g.stroke(); } g.restore(); }
  // the stranger in the left corner
  stranger(lerp(250, 300, ease.inOut(clamp(o.near ?? 0))), 1560, lerp(1.05, 1.15, clamp(o.near ?? 0)), t, { eyes: o.eyes ?? 0.6 });
  g.restore();
}
function bell(x, y, r, c) {                               // a small bell glyph
  fill(smoothPath([[x - r, y + r * 0.6], [x - r * 0.75, y - r * 0.2], [x - r * 0.4, y - r * 0.85], [x + r * 0.4, y - r * 0.85], [x + r * 0.75, y - r * 0.2], [x + r, y + r * 0.6]]), c);
  rect(x - r * 1.1, y + r * 0.5, r * 2.2, r * 0.3, c); ell(x, y + r * 1.05, r * 0.28, r * 0.28, c);
}

// the stairwell in section: floors 2…7, the lift shaft in the middle with the cabin at floor 4, the landings with their
// doors; o.rings 0…1 the shouts and knocks spreading, o.peek 0…1 the neighbours opening their doors, o.shake px
export const SHAFT = { x0: 450, x1: 630 };
const FLOOR_H = 200, TOP = 80, FLOORS = 6;               // floor 7 at the top … floor 2 at the bottom
const floorY = f => TOP + (7 - f) * FLOOR_H;             // the top of floor f
export function section(t, o = {}) {
  rect(0, 0, 1080, 1920, '#2a3448');
  const sky = g.createLinearGradient(0, 0, 0, 1300); sky.addColorStop(0, '#3a4d74'); sky.addColorStop(1, '#8aa6c8'); g.fillStyle = sky; g.fillRect(0, 0, 1080, 1300);
  const bx0 = 40, bx1 = 1040;
  for (let f = 7; f >= 2; f--) {
    const y = floorY(f);
    fill(polyPath([[bx0, y], [bx1, y], [bx1, y + FLOOR_H], [bx0, y + FLOOR_H]]), f % 2 ? '#dcd5c3' : '#d6cfbc');
    rect(bx0, y + FLOOR_H * 0.55, bx1 - bx0, FLOOR_H * 0.45, '#4f7f5a');
    rect(bx0, y + FLOOR_H - 18, bx1 - bx0, 18, '#7d7468');
    text(String(f), bx0 + 46, y + 70, 54, '#3a5f43', { fam: FONTS.block, shadow: false });
    // two flat doors on each landing, the neighbours peek out
    for (const [dx, side] of [[150, -1], [850, 1]]) {
      const dk = clamp((o.peek ?? 0) * 1.4 - Math.abs(f - 4) * 0.12);
      rect(dx - 50, y + 36, 100, FLOOR_H - 54, '#2a1c14');
      if (dk > 0.01) { g.save(); g.globalAlpha = dk; rect(dx - 46, y + 40, 92, FLOOR_H - 58, '#ffd98a'); g.restore(); }
      const w = 92 * (1 - 0.7 * ease.out(dk));
      fill(rrPath(side < 0 ? dx - 46 : dx + 46 - w, y + 40, w, FLOOR_H - 58, 4), '#6b3f26');
      if (dk > 0.3) {
        const hx = side < 0 ? dx + 30 : dx - 30, hy = y + 80, a = clamp((dk - 0.3) / 0.4);
        g.save(); g.globalAlpha = a; ell(hx, hy, 22, 25, hash(f * 7 + dx) > 0.5 ? '#f0c8a0' : '#d9a982');
        fill(smoothPath([[hx - 24, hy - 6], [hx - 18, hy - 26], [hx + 18, hy - 26], [hx + 24, hy - 6], [hx, hy - 14]]), ['#4a3020', '#8a8a8a', '#c98a3a'][(f + dx) % 3]);
        limb([[hx, hy + 24], [hx, hy + 70]], 26, ['#3b6ea8', '#a33b3b', '#5a8a4a'][(f * 3 + dx) % 3]);
        g.restore();
      }
    }
  }
  // the shaft and the cabin at floor 4
  rect(SHAFT.x0, TOP, SHAFT.x1 - SHAFT.x0, FLOORS * FLOOR_H, '#3b3f48');
  limb([[540, TOP], [540, floorY(4) + 10]], 4, '#9aa0a8');
  const sh = o.shake ?? 0, sx = sh * Math.sin(t * 61);
  const cy = floorY(4) + 10;
  rrect(SHAFT.x0 + 14 + sx, cy, SHAFT.x1 - SHAFT.x0 - 28, FLOOR_H - 28, 6, '#c9b68a');
  rect(SHAFT.x0 + 22 + sx, cy + 8, SHAFT.x1 - SHAFT.x0 - 44, 16, '#fff3d0');
  // the sound: rings from the cabin across the whole stairwell
  const rk = clamp(o.rings ?? 0);
  if (rk > 0.01) {
    g.save(); g.lineWidth = 8; g.strokeStyle = '#ffd23f';
    for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i / 4) % 1; g.globalAlpha = rk * (1 - ph) * 0.9; g.beginPath(); g.arc(540, cy + 90, 80 + ph * 620, 0, TAU); g.stroke(); }
    g.restore();
  }
  for (let f = 1; f <= 7; f++) rect(bx0, floorY(f) + FLOOR_H - 4, bx1 - bx0, 4, 'rgba(0,0,0,0.25)');
  g.save(); g.lineWidth = 10; g.strokeStyle = '#2a2d33'; g.strokeRect(bx0, TOP, bx1 - bx0, FLOORS * FLOOR_H); g.restore();
}
export const CABIN_Y = floorY(4) + 100;

// a phone calling; k 0…1 shown
export function callPhone(x, y, k, t, who = 'МАМА') {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.06);
  rrect(-120, -210, 240, 420, 34, '#1f2433'); rrect(-104, -186, 208, 372, 20, '#0f1626');
  ell(0, -90, 50, 50, '#e78a2f'); text(who[0], 0, -70, 56, '#ffffff', { fam: FONTS.block, shadow: false });
  text(who, 0, 10, 48, '#ffffff', { fam: FONTS.cond, shadow: false });
  text('ВЫЗОВ…', 0, 56, 30, '#9fd3ff', { fam: FONTS.cond, shadow: false });
  const pulse = 1 + 0.08 * Math.sin(t * 8); ell(0, 128, 40 * pulse, 40 * pulse, '#2fbf5a'); text('✆', 0, 146, 48, '#ffffff', { shadow: false });
  g.restore();
}

// the flat's own door at night, from inside: dark wallpaper, a coat rack, the steel door with its peephole and locks,
// the light of the landing under it; o.knock 0…1 the door shaking on each knock (every 0.35 s from o.k0)
export function flatDoor(t, o = {}) {
  const wp = polyPath([[0, 0], [1080, 0], [1080, 1340], [0, 1340]]); fill(wp, '#3d4558'); texArea(wp, 'fabric', 0.6, 0.35);
  for (let i = 0; i < 12; i++) rect(i * 96 + 20, 0, 4, 1340, 'rgba(255,255,255,0.05)');
  const fl = polyPath([[0, 1340], [1080, 1340], [1080, 1920], [0, 1920]]); fill(fl, '#4a3a2c'); texArea(fl, 'planks', 0.6, 0.6);
  // the coat rack with a coat and her orange jacket
  rect(760, 320, 260, 20, '#5a4030'); for (const x of [800, 900, 980]) limb([[x, 330], [x, 380]], 8, '#c9a36a');
  fill(smoothPath([[790, 370], [740, 520], [760, 900], [880, 900], [860, 520]]), '#e78a2f');
  fill(smoothPath([[960, 370], [900, 520], [920, 860], [1040, 860], [1020, 520]]), '#556070');
  // the door
  const ph = o.k0 != null && t >= o.k0 ? ((t - o.k0) % 0.35) / 0.35 : 1, jolt = (o.knock ?? 0) * Math.max(0, 1 - ph * 4) * 6;
  g.save(); g.translate(jolt * Math.sin(t * 90), 0);
  rect(150, 300, 520, 1060, '#2a2d33');
  const dp = rrPath(170, 320, 480, 1030, 6); fill(dp, '#7a5a44'); texArea(dp, 'planks', 0.5, 0.3);
  g.save(); g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke(rrPath(220, 380, 380, 420, 8)); g.stroke(rrPath(220, 850, 380, 440, 8)); g.restore();
  ell(410, 560, 16, 16, '#1d1f24'); ell(410, 560, 9, 9, '#c9a36a');
  rrect(560, 820, 40, 90, 10, '#c9a36a'); rrect(560, 960, 40, 40, 8, '#c9a36a'); limb([[580, 860], [640, 860]], 12, '#c9a36a');
  g.restore();
  // the landing's light under the door
  const lg = g.createLinearGradient(0, 1340, 0, 1480); lg.addColorStop(0, 'rgba(255,220,150,0.6)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = lg;
  g.beginPath(); g.moveTo(170, 1350); g.lineTo(650, 1350); g.lineTo(760, 1480); g.lineTo(60, 1480); g.closePath(); g.fill();
  g.save(); g.globalAlpha = 0.35; rect(0, 0, 1080, 1920, '#0b0f1a'); g.restore();
}
