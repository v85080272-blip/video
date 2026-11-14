// The places of «Выживи за 30 секунд», №1 «Тягун» in flat shapes, straight in screen space: the beach seen from above
// (deep water at the top, the surf zone with its breaking lines, the rip channel where the waves do not break and the
// water runs out to sea, the sand at the bottom with towels and a lifeguard tower), a swimmer seen from above, the sea from
// the side (the swimmer floating on his back or waving), the shore from the water with people and the lifeguard.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath } from './flat.js';

export const SAND = 1460;              // where the sand starts, from above
export const RIP = [430, 650];         // the rip channel, from above
function grad(stops, y0 = 0, y1 = 1920, x0 = 0, x1 = 1080) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }

// the beach from above; o.flow 0…1: how strongly the rip arrows run
export function topBeach(t, o = {}) {
  grad([[0, '#1d6f9a'], [0.55, '#2f9ac4'], [1, '#62c4e0']], 0, SAND);
  // the breaking lines of the surf, not in the rip channel
  for (let k = 0; k < 7; k++) {
    const y = SAND - 80 - ((k * 110 + t * 70) % 770), a = clamp((y - 600) / 300);
    for (const [x0, x1] of [[-40, RIP[0] - 10], [RIP[1] + 10, 1120]]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const x = lerp(x0, x1, i / 10); pts.push([x, y + 12 * Math.sin(x * 0.012 + k)]); }
      g.save(); g.globalAlpha = 0.85 * a; limb(pts, 10, '#ffffff', true); g.restore();
    }
  }
  // the rip: darker, smoother water running out to sea
  fill(smoothPath([[RIP[0] - 20, SAND], [RIP[0] + 10, 900], [RIP[0] - 40, 560], [RIP[1] + 40, 560], [RIP[1] - 10, 900], [RIP[1] + 20, SAND]]), 'rgba(16,70,110,0.55)');
  const fl = o.flow ?? 1;
  for (let i = 0; i < 6; i++) { const u = ((t * 0.5 + i / 6) % 1), y = lerp(SAND - 40, 600, u), x = (RIP[0] + RIP[1]) / 2 + 30 * Math.sin(i * 2.1);
    g.save(); g.globalAlpha = fl * Math.sin(Math.PI * u); limb([[x, y + 50], [x, y - 20]], 8, 'rgba(255,255,255,0.7)', false); poly([[x, y - 40], [x - 16, y - 14], [x + 16, y - 14]], 'rgba(255,255,255,0.7)'); g.restore(); }
  // the sand, towels, an umbrella from above, the lifeguard tower
  grad([[0, '#f2dca6'], [1, '#e2c584']], SAND, 1920);
  limb([[-20, SAND + 4], [1100, SAND + 4]], 10, 'rgba(255,255,255,0.8)', false);
  for (const [x, y, c] of [[160, 1640, '#ff6f59'], [300, 1760, '#3aa6cf'], [820, 1680, '#ffd23f'], [960, 1800, '#7bc67b']]) { rrect(x - 50, y - 26, 100, 52, 8, c); }
  ell(860, 1590, 70, 70, '#d9433b'); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; limb([[860, 1590], [860 + 70 * Math.cos(a), 1590 + 70 * Math.sin(a)]], 4, '#fff3d6', false); }
  rect(60, 1500, 90, 70, '#ffffff'); rect(60, 1500, 90, 18, '#d9433b');
}
// a swimmer seen from above: the head with its hat, two arms stroking; (x, y), s, ang (heading), t
export function swimmerTop(x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.ang ?? 0); g.scale(s, s);
  ell(0, 0, 70, 46, 'rgba(255,255,255,0.35)');
  const st = Math.sin(t * (o.panic ? 14 : 7));
  limb([[-26, 0], [-60, -30 * st - 10], [-70, -60 * st]], 18, '#f2c19b', true); limb([[26, 0], [60, 30 * st - 10], [70, 60 * st]], 18, '#f2c19b', true);
  ell(0, 0, 30, 30, '#f2c19b'); ell(0, -4, 32, 24, '#7a5a3a'); ell(0, 10, 14, 8, '#6a3a2a');
  g.restore();
}
// the sea from the side: sky, the water line at y, waves
export function sideSea(t, y = 1100, o = {}) {
  grad([[0, '#8fd0f0'], [1, '#dff2fa']], 0, y);
  if (o.shore) {     // the shore far off: sand, people, the lifeguard tower
    rect(0, y - 70, 1080, 70, '#f2dca6');
    rect(780, y - 300, 20, 230, '#e8e2d4'); rect(840, y - 300, 20, 230, '#e8e2d4'); rect(760, y - 330, 120, 50, '#d9433b'); poly([[750, y - 330], [820, y - 380], [890, y - 330]], '#ffffff');
  }
  grad([[0, '#2f9ac4'], [1, '#1d6f9a']], y, 1920);
  for (let i = 0; i < 9; i++) { const x = (i * 140 + t * 40) % 1220 - 70; limb([[x, y + 4 * Math.sin(t * 2 + i)], [x + 90, y + 4 * Math.sin(t * 2 + i + 1)]], 8, 'rgba(255,255,255,0.8)', false); }
  for (let i = 0; i < 8; i++) { const x = (i * 170 + t * 25) % 1240 - 80, yy = y + 120 + 90 * (i % 4); limb([[x, yy], [x + 80, yy + 4]], 5, 'rgba(255,255,255,0.25)', false); }
}
// a person standing on the far shore, small, seen from the front; o.wave: an arm up
export function smallPerson(x, y, s, c, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  limb([[-10, 0], [-10, -60]], 12, '#f2c19b', false); limb([[10, 0], [10, -60]], 12, '#f2c19b', false);
  rrect(-22, -130, 44, 76, 12, c); ell(0, -150, 18, 18, '#f2c19b');
  if (o.wave) limb([[18, -120], [40, -170 - 10 * Math.sin(t * 9)]], 9, '#f2c19b', false); else limb([[18, -120], [26, -70]], 9, '#f2c19b', false);
  limb([[-18, -120], [-26, -70]], 9, '#f2c19b', false);
  if (o.buoy) { rrect(28, -110, 26, 70, 12, '#ff6b1c'); }
  g.restore();
}
