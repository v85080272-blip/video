// Баба Валя from the fifth floor: polka-dot headscarf, big glasses, purple cardigan, a plate of pirozhki with a candle.
// Her right hand (screen left) is bandaged, with a red stain. Origin at the plate's centre; ~900 units tall above it.
import { g, solid, hose, smoothPath, ellPath, rrPath, stroke, line, glow, px, LIGHT } from './draw.js';
import { TAU, clamp, lerp, rgba, shade, noise } from './lib.js';

export const VALYA = { skin: '#f1c7a5', scarf: '#c8323c', cardigan: '#6a4c93', dress: '#3f6f8a', bandage: '#efeee6', blood: '#a3122a' };

export function drawGranny(p) {
  const t = p.t ?? 0, talk = p.talk ?? 0, stain = p.stain ?? 0.6, tilt = p.tilt ?? 0, blink = p.blink ?? 0, creepy = p.creepy ?? 0, drip = p.drip ?? 0;
  g.save(); g.translate(p.x, p.y); g.scale(p.s ?? 1, p.s ?? 1);
  const breath = Math.sin(t * 2.1) * 4;
  // body: cardigan over a dress
  const body = smoothPath([[-250, -260 + breath], [-120, -330 + breath], [120, -330 + breath], [250, -260 + breath], [300, 120], [-300, 120]]);
  solid(body, VALYA.cardigan, [-300, -330, 600, 450]);
  g.save(); g.clip(body);
  const dress = smoothPath([[-70, -330], [70, -330], [110, 140], [-110, 140]]);
  g.fillStyle = VALYA.dress; g.fill(dress);
  for (let i = 0; i < 18; i++) { const fx = -90 + (i % 4) * 60 + (i % 2) * 20, fy = -300 + Math.floor(i / 4) * 80; g.fillStyle = 'rgba(255,230,140,.7)'; g.beginPath(); g.arc(fx, fy, 7, 0, TAU); g.fill(); }
  stroke(dress, 4.5);
  // cardigan buttons and knit texture
  for (const by of [-250, -170, -90, -10]) solid(ellPath(-84, by, 10, 10), '#e8d7b0', [-94, by - 10, 20, 20], { lw: 3.5, rimA: 0 });
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = px(3);
  for (let x = -300; x < 300; x += 22) { g.beginPath(); g.moveTo(x, -340); g.lineTo(x + 10, 140); g.stroke(); }
  g.restore();
  // brooch
  solid(ellPath(110, -230, 18, 22), '#2fa38a', [92, -252, 36, 44], { lw: 4, hiA: 0.6 });
  // head
  g.save(); g.translate(0, -360 + breath); g.rotate(tilt);
  head(t, talk, blink, creepy);
  g.restore();
  // arms holding the plate
  hose([[-230, -220 + breath], [-250, -60], [-150, -6]], 64, VALYA.cardigan);
  hose([[230, -220 + breath], [250, -60], [150, -6]], 64, VALYA.cardigan);
  // plate
  solid(ellPath(0, 0, 230, 52), '#f4f1ea', [-230, -52, 460, 104], { hiA: 0.4, rimA: 0.3 });
  g.strokeStyle = '#3a7bd5'; g.lineWidth = px(4); g.beginPath(); g.ellipse(0, 0, 200, 40, 0, 0, TAU); g.stroke();
  // pirozhki
  const pz = [[-130, -26], [-60, -40], [20, -36], [100, -24], [-90, -2], [-10, -8], [70, 2]];
  for (const [x, y] of pz) {
    const pp = smoothPath([[x - 50, y], [x - 30, y - 30], [x + 30, y - 32], [x + 52, y - 2], [x + 30, y + 16], [x - 30, y + 16]]);
    solid(pp, '#d98a3a', [x - 50, y - 32, 102, 48], { lw: 4.5, hiA: 0.35, rimA: 0.35 });
    g.save(); g.clip(pp); g.strokeStyle = 'rgba(120,60,20,.5)'; g.lineWidth = px(3); g.beginPath(); g.moveTo(x - 30, y - 18); g.quadraticCurveTo(x, y - 30, x + 34, y - 16); g.stroke(); g.restore();
  }
  // candle in the middle
  solid(rrPath(-18, -170, 36, 130, 6), '#f7f0dc', [-18, -170, 36, 130], { lw: 4.5, hiA: 0.3 });
  line([[0, -170], [0, -186]], 3.5);
  const fl = 1 + noise(t * 9, 3) * 0.15;
  g.save(); g.translate(0, -190); g.scale(1, fl);
  const flame = smoothPath([[0, -46], [16, -12], [12, 8], [0, 14], [-12, 8], [-16, -12]]);
  g.fillStyle = '#ffd66b'; g.fill(flame); g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(0, 0, 6, 10, 0, 0, TAU); g.fill();
  g.restore();
  // hands on the plate rim; the right hand (screen left) is bandaged
  for (const sd of [-1, 1]) {
    const hx = sd * 160, hy = -4;
    solid(ellPath(hx, hy, 46, 34), VALYA.skin, [hx - 46, hy - 34, 92, 68], { lw: 5 });
    if (sd < 0) bandage(hx, hy, stain, t, drip);
  }
  g.restore();
  return { candle: [p.x, p.y - 200 * (p.s ?? 1)] };
}

export function bandage(hx, hy, stain, t, drip = 0) {
  const b = smoothPath([[hx - 52, hy - 36], [hx + 40, hy - 40], [hx + 54, hy + 10], [hx + 34, hy + 38], [hx - 46, hy + 36], [hx - 60, hy]]);
  solid(b, VALYA.bandage, [hx - 60, hy - 40, 114, 78], { lw: 5, hiA: 0.3 });
  g.save(); g.clip(b);
  g.strokeStyle = 'rgba(120,110,90,.35)'; g.lineWidth = px(3);
  for (let i = -3; i < 4; i++) { g.beginPath(); g.moveTo(hx - 70, hy + i * 14 - 20); g.lineTo(hx + 70, hy + i * 14 + 10); g.stroke(); }
  if (stain > 0) {
    const r = 10 + stain * 30;
    const gr = g.createRadialGradient(hx + 6, hy - 4, 0, hx + 6, hy - 4, r);
    gr.addColorStop(0, rgba(VALYA.blood, 0.95)); gr.addColorStop(0.7, rgba(VALYA.blood, 0.75)); gr.addColorStop(1, rgba(VALYA.blood, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(hx + 6, hy - 4, r, 0, TAU); g.fill();
  }
  g.restore();
  // a drop gathers under the bandage and falls onto the pirozhki
  if (drip > 0) {
    const grow = clamp(drip / 0.5), fall = clamp((drip - 0.5) / 0.5);
    const dy = hy + 34 + fall * fall * 70, r = 5 + grow * 6;
    g.fillStyle = VALYA.blood;
    g.beginPath(); g.moveTo(hx + 10, dy - r * 2.2); g.quadraticCurveTo(hx + 10 + r * 1.1, dy - r * 0.2, hx + 10, dy + r); g.quadraticCurveTo(hx + 10 - r * 1.1, dy - r * 0.2, hx + 10, dy - r * 2.2); g.fill();
    if (fall < 0.15) { g.lineWidth = 4; g.strokeStyle = VALYA.blood; g.beginPath(); g.moveTo(hx + 10, hy + 26); g.lineTo(hx + 10, dy - r * 2); g.stroke(); }
  }
}

function head(t, talk, blink, creepy = 0) {
  // headscarf back
  const back = smoothPath([[-190, 40], [-200, -120], [-120, -250], [0, -285], [120, -250], [200, -120], [190, 40], [120, 120], [-120, 120]]);
  solid(back, VALYA.scarf, [-200, -285, 400, 405]);
  dots(back, -200, -285, 400, 405);
  // face
  const face = smoothPath([[-130, -40], [-118, -150], [0, -190], [118, -150], [130, -40], [100, 60], [40, 104], [-40, 104], [-100, 60]]);
  solid(face, VALYA.skin, [-130, -190, 260, 294], { rimA: 0.5 });
  // grey fringe under the scarf
  g.save(); g.clip(face);
  const fr = smoothPath([[-140, -200], [140, -200], [130, -120], [70, -140], [20, -116], [-40, -142], [-100, -118], [-140, -130]]);
  solid(fr, '#c9c7c4', [-140, -200, 280, 84], { lw: 4.5, hiA: 0.2 });
  g.restore();
  // scarf front band around the face
  const band = new (back.constructor)();
  band.addPath(smoothPath([[-150, 70], [-160, -100], [-110, -200], [0, -225], [110, -200], [160, -100], [150, 70], [126, 64], [136, -96], [96, -180], [0, -200], [-96, -180], [-136, -96], [-126, 64]]));
  solid(band, shade(VALYA.scarf, 0.08), [-160, -225, 320, 295], { lw: 5 });
  dots(band, -160, -225, 320, 295);
  // knot under the chin
  const knot = smoothPath([[-40, 96], [40, 96], [70, 170], [10, 140], [-10, 140], [-70, 170]]);
  solid(knot, VALYA.scarf, [-70, 96, 140, 74], { lw: 5 });
  // cheeks
  for (const sd of [-1, 1]) { g.save(); g.globalAlpha = 0.45; g.fillStyle = '#f08a86'; g.beginPath(); g.ellipse(sd * 72, 20, 30, 18, 0, 0, TAU); g.fill(); g.restore(); }
  // wrinkles
  for (const sd of [-1, 1]) {
    line([[sd * 112, -60], [sd * 126, -50]], 3.5, 'rgba(120,70,50,.6)'); line([[sd * 112, -44], [sd * 126, -40]], 3.5, 'rgba(120,70,50,.6)');
    line([[sd * 44, 30], [sd * 54, 62]], 3.5, 'rgba(120,70,50,.5)', true);
  }
  // eyes behind big glasses (magnified)
  const open = clamp(1 - blink);
  for (const sd of [-1, 1]) {
    const ex = sd * 56, ey = -50;
    if (open > 0.1) {
      solid(ellPath(ex, ey, 30, 30 * open), '#ffffff', [ex - 30, ey - 30, 60, 60], { lw: 4.5, rimA: 0, hiA: 0 });
      // creepy: pupils shrink to pinpoints and stare straight ahead
      const pr = 15 * open * (1 - 0.68 * creepy);
      g.fillStyle = '#3b2a22'; g.beginPath(); g.arc(ex + 4 * (1 - creepy), ey + 4 * (1 - creepy), pr, 0, TAU); g.fill();
      if (creepy < 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 10, ey - 4, 5, 0, TAU); g.fill(); }
    } else line([[ex - 26, ey], [ex, ey + 8], [ex + 26, ey]], 5, LIGHT.ink, true);
    line([[ex - 30, ey - 46], [ex + 26, ey - 52]], 6, '#9a9894');
  }
  // glasses
  for (const sd of [-1, 1]) {
    const gp = ellPath(sd * 56, -50, 50, 46);
    g.save(); g.globalAlpha = 0.12; g.fillStyle = '#cfe8ff'; g.fill(gp); g.restore();
    stroke(gp, 8, '#5a3a2a');
  }
  line([[-8, -54], [8, -54]], 7, '#5a3a2a');
  // nose
  solid(ellPath(0, 6, 20, 16), shade(VALYA.skin, -0.06), [-20, -10, 40, 32], { lw: 4.5, rimA: 0 });
  // mouth: kind smile that opens with speech
  const mo = clamp(talk);
  if (mo > 0.08) {
    const m = smoothPath([[-34, 52], [0, 46], [34, 52], [22, 52 + 26 * mo], [0, 58 + 30 * mo], [-22, 52 + 26 * mo]]);
    g.fillStyle = '#5a1a24'; g.fill(m); stroke(m, 5);
  } else line([[-34 - 18 * creepy, 50 - 10 * creepy], [0, 62 + 4 * creepy], [34 + 18 * creepy, 50 - 10 * creepy]], 6, LIGHT.ink, true);
}

function dots(path, x, y, w, h) {
  g.save(); g.clip(path); g.fillStyle = 'rgba(255,255,255,.85)';
  for (let r = 0; r * 44 < h; r++) for (let c = 0; c * 44 < w; c++) { g.beginPath(); g.arc(x + c * 44 + (r % 2) * 22, y + r * 44, 6, 0, TAU); g.fill(); }
  g.restore();
}
