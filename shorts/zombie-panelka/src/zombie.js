// A shambling cartoon zombie: green skin, torn clothes, arms out, head lolling. Origin at the feet, ~560 units tall.
import { g, solid, hose, smoothPath, ellPath, rrPath, line, softShadow, glow } from './draw.js';
import { TAU, hash, noise, shade } from './lib.js';

const SHIRTS = ['#6b5b7a', '#4f6a8a', '#8a5a4a', '#5c7050', '#7a6a50'];
const SKIN = ['#8fb55a', '#9cbf6a', '#7fa65a'];

export function drawZombie(p) {
  const s = p.s ?? 1, face = p.face ?? 1, t = p.t ?? 0, seed = p.seed ?? 0;
  const skin = SKIN[seed % SKIN.length], shirt = SHIRTS[seed % SHIRTS.length];
  if (p.shadow !== 0) softShadow(p.x, p.y + 4 * s, 120 * s, 20 * s, 0.4);
  g.save(); g.translate(p.x, p.y); g.scale(s * face, s);
  const w = t * 2.2 + seed;
  const sway = Math.sin(w) * 0.08, bob = Math.abs(Math.sin(w)) * 10;
  g.rotate(sway + 0.06);
  g.translate(0, -bob);
  // legs: one drags
  hose([[-26, -170], [-30 + Math.sin(w) * 20, -90], [-24 + Math.sin(w) * 34, 0]], 40, '#3c3a52');
  hose([[26, -170], [40, -90], [60 - Math.sin(w) * 10, 4]], 40, '#34324a');
  // torso
  const torso = smoothPath([[-70, -360], [70, -360], [86, -250], [70, -160], [-70, -160], [-86, -250]]);
  solid(torso, shirt, [-86, -360, 172, 200]);
  // torn hem
  g.save(); g.clip(torso); g.fillStyle = shade(shirt, -0.3);
  g.beginPath(); g.moveTo(-90, -180); for (let i = 0; i <= 8; i++) g.lineTo(-90 + i * 22.5, i % 2 ? -150 : -186); g.lineTo(90, -140); g.lineTo(-90, -140); g.fill();
  g.restore();
  // arms reaching forward
  const reach = Math.sin(w * 0.7) * 0.15;
  hose([[54, -340], [140, -320 + reach * 40], [214, -326 + reach * 60]], 32, skin);
  hose([[-50, -336], [70, -300 - reach * 30], [170, -296 - reach * 40]], 30, shade(skin, -0.15));
  // head, lolling
  g.save(); g.translate(10, -380); g.rotate(0.25 + Math.sin(w * 0.5) * 0.12);
  const head = smoothPath([[-66, -10], [-56, -96], [0, -122], [62, -98], [72, -10], [44, 40], [-40, 40]]);
  solid(head, skin, [-66, -122, 138, 162]);
  // hair tufts
  line([[-30, -112], [-40, -138]], 6); line([[0, -120], [6, -150]], 6); line([[28, -112], [40, -136]], 6);
  // eyes: one big, one small, glowing pale
  const ey = -46;
  solid(ellPath(-18, ey, 20, 22), '#f4ffd8', [-38, ey - 22, 40, 44], { lw: 5, rimA: 0 });
  solid(ellPath(30, ey + 4, 14, 15), '#f4ffd8', [16, ey - 11, 28, 30], { lw: 5, rimA: 0 });
  g.fillStyle = '#1b1416'; g.beginPath(); g.arc(-14, ey + 4, 6, 0, TAU); g.arc(33, ey + 6, 4.5, 0, TAU); g.fill();
  // mouth with teeth
  const m = smoothPath([[-30, 2], [30, -2], [26, 18], [-26, 20]]);
  solid(m, '#3a1a20', [-30, -2, 60, 22], { lw: 5, rimA: 0, hiA: 0 });
  for (const k of [-16, 0, 16]) { g.fillStyle = '#f2eccc'; g.fillRect(k - 4, 0, 8, 7); }
  // stitches / scar
  line([[40, -84], [56, -60]], 4); line([[42, -70], [56, -76]], 3);
  g.restore();
  g.restore();
}

// tiny glowing-eyed figure in the dark (for hints in the background)
export function shadowFigure(x, y, s, eyes = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(8,8,14,.92)';
  g.beginPath(); g.ellipse(0, -300, 60, 70, 0.2, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-80, -240); g.quadraticCurveTo(0, -280, 80, -240); g.lineTo(100, 0); g.lineTo(-100, 0); g.fill();
  if (eyes > 0) {
    for (const ex of [-22, 22]) { glow(ex, -306, 40, '#d6ff6a', 0.8 * eyes); g.fillStyle = `rgba(230,255,170,${eyes})`; g.beginPath(); g.arc(ex, -306, 7, 0, TAU); g.fill(); }
  }
  g.restore();
}
