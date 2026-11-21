// «Приключения Искры» №4: the stairwell with a gas smell, and the street outside. Flat shapes with the Poly Haven
// detail maps (flat.js texArea). The stairwell: whitewash above, green paint below, a padded flat door with its bell, the
// light switch, a window on the landing that swings open; gas — pale green wisps (gas 0…1), drifting to the open window
// (vent 0…1). The street: a nine-storey panel block with its entrance, a bench, the gas emergency van; the evening
// street with an air-raid siren on its pole (waves 0…1).
import { lerp, clamp, TAU, hash, ease } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, polyPath, rrPath, smoothPath, texArea } from './flat.js';
import { text, FONTS, INK } from './type.js';

const WIN = { x0: 640, x1: 1000, y0: 210, y1: 640 };
export const SWITCH = [815, 895], BELL = [640, 780], DOORC = [360, 880];

function wisps(t, gas, vent, x0 = 80, x1 = 1000, yb = 1420) {
  if (gas <= 0.01) return;
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const bx = lerp(x0, x1, i / 10) + 30 * Math.sin(i * 1.7), ph = ((t * 0.22 + hash(i)) % 1);
    g.globalAlpha = gas * 0.75 * Math.sin(ph * Math.PI); g.lineWidth = 16; g.strokeStyle = '#9be38a';
    g.beginPath();
    for (let j = 0; j <= 12; j++) {
      const yy = yb - ph * 760 - j * 30, u = clamp((yb - yy) / 1100);
      const tx = lerp(bx, (WIN.x0 + WIN.x1) / 2, vent * u * 0.9), ty = lerp(yy, lerp(yy, WIN.y0 + 200, 0.6), vent * u);
      const xx = tx + 24 * Math.sin(j * 0.8 + t * 2 + i);
      j ? g.lineTo(xx, ty) : g.moveTo(xx, ty);
    }
    g.stroke();
  }
  g.restore();
}
// the stairwell landing; o.gas 0…1, o.vent 0…1 (the window open, the gas going out), o.dim 0…1
export function hall(t, o = {}) {
  const gas = o.gas ?? 0, vent = clamp(o.vent ?? 0);
  rect(0, 0, 1080, 1920, '#dcd5c3');
  const up = polyPath([[0, 0], [1080, 0], [1080, 752], [0, 752]]); texArea(up, 'concrete', 0.9, 0.35);
  const low = polyPath([[0, 760], [1080, 760], [1080, 1500], [0, 1500]]); fill(low, '#4f7f5a'); texArea(low, 'concrete', 0.8, 0.45);
  rect(0, 752, 1080, 12, '#3a5f43');
  const fl = polyPath([[0, 1340], [1080, 1340], [1080, 1920], [0, 1920]]); fill(fl, '#8a7a66'); texArea(fl, 'concrete', 0.6, 0.5);
  for (let i = 0; i < 8; i++) rect(i * 140, 1340, 3, 580, 'rgba(0,0,0,0.12)');
  // the window on the landing: the sky outside, two sashes swinging open
  rect(WIN.x0 - 22, WIN.y0 - 22, WIN.x1 - WIN.x0 + 44, WIN.y1 - WIN.y0 + 60, '#f1ede2');
  const sky = g.createLinearGradient(0, WIN.y0, 0, WIN.y1); sky.addColorStop(0, '#8fc4ee'); sky.addColorStop(1, '#d9ecf7'); g.fillStyle = sky; g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  for (let i = 0; i < 4; i++) rect(WIN.x0 + 20 + i * 90, WIN.y1 - 120 - 60 * hash(i), 70, 140 + 60 * hash(i), '#b9c4cc');
  rect(WIN.x0 - 30, WIN.y1 + 20, WIN.x1 - WIN.x0 + 60, 26, '#e8e3d6');
  const half = (WIN.x1 - WIN.x0) / 2, open = ease.inOut(vent);
  for (const [hx, dir] of [[WIN.x0, 1], [WIN.x1, -1]]) {     // each sash hinges at its outer edge and turns towards us
    const w = half * (1 - 0.82 * open);
    const x0 = dir > 0 ? hx : hx - w;
    g.save(); g.globalAlpha = 1;
    fill(rrPath(x0, WIN.y0, w, WIN.y1 - WIN.y0, 4), 'rgba(210,232,245,0.35)');
    g.lineWidth = 12; g.strokeStyle = '#f7f4ec'; g.stroke(rrPath(x0 + 6, WIN.y0 + 6, w - 12, WIN.y1 - WIN.y0 - 12, 4));
    g.restore();
  }
  if (vent < 0.05) rect((WIN.x0 + WIN.x1) / 2 - 6, WIN.y0, 12, WIN.y1 - WIN.y0, '#f7f4ec');
  // the flat door, padded with brown leatherette and studs, with its number; the bell beside it
  const dp = rrPath(150, 420, 420, 920, 8); fill(dp, '#6b3f26'); texArea(dp, 'fabric', 0.5, 0.5);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) ell(220 + c * 140 + (r % 2) * 70, 500 + r * 140, 6, 6, '#c9a36a');
  rect(130, 400, 20, 950, '#4a2c1a'); rect(570, 400, 20, 950, '#4a2c1a'); rect(130, 400, 460, 20, '#4a2c1a');
  ell(520, 900, 14, 14, '#c9a36a'); rrect(320, 330, 90, 56, 8, '#2b2b2b'); text('47', 365, 372, 40, '#e8d9b0', { fam: FONTS.cond, shadow: false });
  rrect(BELL[0] - 34, BELL[1] - 50, 68, 100, 12, '#f2efe6'); ell(BELL[0], BELL[1], 18, 18, '#d24a3a'); ell(BELL[0] - 4, BELL[1] - 4, 6, 6, '#f08070');
  // the switch
  rrect(SWITCH[0] - 55, SWITCH[1] - 75, 110, 150, 14, '#f2efe6'); rrect(SWITCH[0] - 20, SWITCH[1] - 45, 40, 90, 8, '#dedad0'); rect(SWITCH[0] - 15, SWITCH[1] - 35, 30, 34, '#ffffff');
  wisps(t, gas, vent);
  if (o.dim) { g.save(); g.globalAlpha = o.dim; rect(0, 0, 1080, 1920, '#0b0f1a'); g.restore(); }
}
// a spark: a white-yellow star flash at (x, y), k 0…1
export function flash(x, y, k, s = 1) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = k;
  const gr = g.createRadialGradient(x, y, 0, x, y, 160 * s); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,200,80,0.6)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = gr; g.fillRect(x - 160 * s, y - 160 * s, 320 * s, 320 * s);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3; limb([[x + Math.cos(a) * 20 * s, y + Math.sin(a) * 20 * s], [x + Math.cos(a) * 90 * s, y + Math.sin(a) * 90 * s]], 6 * s, '#fff3b0'); }
  g.restore();
}
// a fist knocking at (x, y): the knock is at phase 0 of every 0.35 s while k > 0
export function fist(x, y, t, k) {
  if (k <= 0.01) return;
  const ph = (t % 0.35) / 0.35, push = Math.max(0, 1 - ph * 3) * 26;
  g.save(); g.globalAlpha = clamp(k * 2); g.translate(x - push, y);
  limb([[220, 60], [90, 20]], 70, '#f0c8a0');
  fill(rrPath(-10, -55, 120, 110, 40), '#f0c8a0');
  for (let i = 0; i < 4; i++) limb([[0, -38 + i * 26], [40, -38 + i * 26]], 4, '#c98f6e');
  rect(120, -10, 140, 140, '#e78a2f');                     // her orange sleeve
  g.restore();
}
// the evening/day street: a nine-storey panel block with its entrance; o.dusk 0…1; o.door 0…1 the entrance door open
export function street(t, o = {}) {
  const dusk = o.dusk ?? 0;
  const sky = g.createLinearGradient(0, 0, 0, 1100);
  sky.addColorStop(0, dusk ? '#2c3e6b' : '#86c0ec'); sky.addColorStop(1, dusk ? '#f0a070' : '#dff0fa'); g.fillStyle = sky; g.fillRect(0, 0, 1080, 1100);
  const bx = 60, bw = 960, top = 120, bot = 1180;
  const wall = polyPath([[bx, top], [bx + bw, top], [bx + bw, bot], [bx, bot]]); fill(wall, dusk ? '#9a9a96' : '#d8d4cb'); texArea(wall, 'concrete', 0.7, 0.55);
  for (let f = 0; f < 9; f++) for (let c = 0; c < 8; c++) {
    const wx = bx + 40 + c * 116, wy = top + 30 + f * 104;
    if (c === 3 || c === 4) { if (f < 8) { rect(wx + 10, wy + 10, 96, 60, '#c9d6de'); } continue; }   // the stair windows
    const lit = dusk && hash(f * 13 + c) > 0.45;
    rect(wx, wy, 80, 62, lit ? '#ffd98a' : (dusk ? '#3d4a63' : '#9fc0d6')); rect(wx + 38, wy, 4, 62, '#e8e4dc');
  }
  for (let f = 1; f < 9; f++) rect(bx, top + f * 104 + 8, bw, 4, 'rgba(0,0,0,0.12)');
  // the entrance: a canopy, the steel door, the intercom
  const ex = 540;
  rect(ex - 170, bot - 300, 340, 26, '#7a7a76');
  const dk = clamp(o.door ?? 0);
  rect(ex - 110, bot - 270, 220, 270, '#2a2d33');
  fill(rrPath(ex - 100, bot - 262, 200 * (1 - 0.75 * dk), 262, 4), '#5b6470');
  rect(ex + 120, bot - 160, 40, 60, '#cfd3d6'); for (let i = 0; i < 6; i++) ell(ex + 132 + (i % 2) * 16, bot - 146 + Math.floor(i / 2) * 16, 4, 4, '#555');
  // the ground: asphalt, a curb, a bench
  const gp = polyPath([[0, bot], [1080, bot], [1080, 1920], [0, 1920]]); fill(gp, dusk ? '#4d4f55' : '#7d7f84'); texArea(gp, 'asphalt', 0.7, 0.6);
  rect(0, bot, 1080, 18, '#b9b6ad');
  rect(820, bot + 40, 200, 18, '#8a5a34'); rect(830, bot + 58, 12, 40, '#333'); rect(1000, bot + 58, 12, 40, '#333');
  if (dusk) { g.save(); g.globalAlpha = 0.25 * dusk; rect(0, 0, 1080, 1920, '#1a1f3a'); g.restore(); }
}
// the gas emergency van (side view, driving left), its front at x
export function van(x, y, t, o = {}) {
  g.save(); g.translate(x, y);
  fill(rrPath(0, -230, 520, 200, 26), '#f4f2ec');
  fill(rrPath(-10, -150, 120, 120, 20), '#f4f2ec');
  rect(0, -120, 520, 34, '#f2b21b'); rect(0, -86, 520, 14, '#d6332a');
  rect(20, -210, 90, 70, '#9fc0d6');                        // the cab window
  text('АВАРИЙНАЯ ГАЗОВАЯ', 320, -170, 34, '#d6332a', { fam: FONTS.cond, shadow: false });
  text('СЛУЖБА · 04', 320, -132, 34, '#2b2b2b', { fam: FONTS.cond, shadow: false });
  for (const wx of [90, 420]) { ell(wx, -24, 46, 46, '#1d1d22'); ell(wx, -24, 20, 20, '#9a9a9a'); }
  const bl = (Math.floor(t * 4) % 2);                       // the beacon on the roof
  rect(200, -258, 90, 28, '#2b2b2b'); ell(225, -262, 22, 14, bl ? '#ff9a2a' : '#7a4a20'); ell(265, -262, 22, 14, bl ? '#7a4a20' : '#ff9a2a');
  g.restore();
}
// a siren on its pole: two horns; waves 0…1 the sound rings
export function siren(x, y, t, waves) {
  limb([[x, y], [x, y - 820]], 26, '#7c8188');
  rect(x - 120, y - 830, 240, 22, '#5d6168');
  for (const sx of [-1, 1]) {
    g.save(); g.translate(x + sx * 90, y - 860);
    poly([[-sx * 30, -24], [sx * 70, -64], [sx * 70, 64], [-sx * 30, 24]], '#c7ccd2'); ell(sx * 70, 0, 16, 64, '#8f959c');
    g.restore();
  }
  if (waves > 0.01) {
    g.save(); g.lineWidth = 8; g.strokeStyle = '#ffd23f';
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const ph = ((t * 1.4 + i / 3) % 1), r = 60 + ph * 260;
      g.globalAlpha = waves * (1 - ph); g.beginPath(); g.arc(x + sx * 160, y - 860, r, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6); g.stroke();
    }
    g.restore();
  }
}
