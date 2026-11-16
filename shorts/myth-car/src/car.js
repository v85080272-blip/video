// The places of «Правда или миф», №11 «Застрял в метель» in flat shapes, straight in screen space; each subject sits near
// x = 540 so that a 352-px column shows it. A blizzard on a country road (a grey sky, far pines, snow posts, deep snow,
// snow blowing sideways, a white-out veil); a small blue car stuck in a drift, seen from the side, front to the right — its
// exhaust pipe low at the back (snowed up or dug out, with puffs of exhaust), a grey cloud of carbon monoxide that can
// creep into the cabin, an antenna with a bright red cloth, the light inside, a driver; a person digging with a small
// shovel; a rescuer in orange with a torch; a phone with «112»; a clock «10 МИН / ЧАС».
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath } from './flat.js';
import { text, FONTS, INK } from './type.js';
export { walker } from './ice.js';

export const FLOOR = 1000;
const SKIN = '#f2c19b', COAT = '#d84a3a', COAT_D = '#b03628', HAT = '#3f7fd8', JEANS = '#2c3550', BOOT = '#1f2230', SCARF = '#ffd23f';
const BODY = '#3f7fd8', BODY_D = '#2c5fab', GLASS = '#9fc4dd', TYRE = '#1f2230';
function grad(stops, y0, y1, x0 = -400, x1 = 1480) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }

// the blizzard: o.white 0…1 a white-out veil over everything, o.night 0…1 dusk
export function blizzard(t, o = {}) {
  grad([[0, '#8a9fb4'], [1, '#d3dee8']], 0, FLOOR - 100);
  for (let i = 0; i < 14; i++) {                                                    // far pines, faint in the snow
    const x = -200 + i * 110 + 30 * hash(i), h = 120 + 90 * hash(i + 5), y = FLOOR - 120;
    poly([[x - h * 0.32, y], [x, y - h], [x + h * 0.32, y]], 'rgba(70,95,120,0.45)');
  }
  for (let i = 0; i < 4; i++) { const x = -60 + i * 360; rect(x, FLOOR - 230, 16, 140, '#ffffff'); rect(x, FLOOR - 230, 16, 30, '#e53935'); rect(x, FLOOR - 170, 16, 18, '#e53935'); }
  grad([[0, '#f4f8fc'], [1, '#d6e4ef']], FLOOR - 110, 1920);
  fill(smoothPath([[-400, FLOOR - 100], [-100, FLOOR - 130], [250, FLOOR - 104], [620, FLOOR - 136], [1000, FLOOR - 108], [1480, FLOOR - 128], [1480, FLOOR - 60], [-400, FLOOR - 60]]), '#ffffff');
  if (o.night > 0) { g.save(); g.globalAlpha = 0.6 * clamp(o.night); rect(-400, 0, 1880, 1920, '#0d1a33'); g.restore(); }
  blowing(t);
  if (o.white > 0) { g.save(); g.globalAlpha = 0.85 * clamp(o.white); rect(-400, 0, 1880, 1920, '#eef3f8'); g.restore(); blowing(t + 3, 30); }
}
// snow blowing sideways, fast
export function blowing(t, n = 60) {
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sp = 520 + 300 * hash(i + 11), x = ((hash(i) * 1600 + t * sp) % 1600) - 260, y = (hash(i + 40) * 1150 + t * 140 * hash(i + 3)) % 1150;
    const L = 26 + 30 * hash(i + 7); g.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * hash(i + 2)})`; g.lineWidth = 4 + 4 * hash(i + 5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + L * 0.28); g.stroke();
  }
  g.restore();
}

// the car: (x, y) the middle of its bottom on the snow, s the scale (≈ 560·s long), front to the right.
// o.pipeSnow 0…1 the pipe snowed up; o.dug 0…1 a hole dug round it; o.smoke 0…1 exhaust puffs; o.gas 0…1 the grey CO
// cloud from the pipe into the cabin; o.antenna 0…1; o.cloth 0…1 the red cloth on it; o.light 0…1 the light inside;
// o.driver 0…1 someone at the wheel; o.shake 0…1 the engine running. Returns the places of the pipe and the antenna tip.
export function car(x, y, s, t, o = {}) {
  const sh = (o.shake ?? 0) * 1.6 * Math.sin(t * 60);
  g.save(); g.translate(x, y + sh); g.scale(s, s);
  for (const wx of [-170, 170]) { ell(wx, -48, 56, 56, TYRE); ell(wx, -48, 24, 24, '#8e9aab'); }
  rrect(-290, -180, 580, 120, 40, BODY); rect(-290, -110, 580, 10, BODY_D);
  fill(smoothPath([[-200, -176], [-150, -270], [110, -272], [190, -178]]), BODY);                     // the cabin
  const win = o.light > 0 ? `rgba(255,${Math.round(lerp(196, 222, o.light))},${Math.round(lerp(221, 120, o.light))},1)` : GLASS;
  fill(smoothPath([[-178, -186], [-138, -254], [-30, -256], [-30, -186]]), win);
  fill(smoothPath([[-14, -186], [-14, -256], [96, -256], [164, -186]]), win);
  if (o.light > 0) { g.save(); g.globalAlpha = 0.35 * clamp(o.light); ell(-10, -220, 260, 150, '#ffe08a'); g.restore(); }
  if (o.driver > 0) { g.save(); g.globalAlpha = clamp(o.driver); ell(60, -226, 26, 28, '#2a2f44'); rrect(36, -200, 54, 18, 8, '#2a2f44'); g.restore(); }
  ell(282, -150, 14, 18, '#fff3c4'); rect(-292, -160, 12, 26, '#e53935');                            // a headlight, a tail light
  // the snow on it: the roof, the bonnet; the drift round the wheels and the side
  fill(smoothPath([[-160, -270], [-100, -296], [20, -300], [100, -290], [120, -270]]), '#ffffff');
  fill(smoothPath([[190, -180], [240, -194], [290, -186], [292, -174]]), '#ffffff');
  // the exhaust pipe at the back, low; then the drift (with a hole dug round the pipe)
  const pipe = [-300, -58];
  rect(-312, -66, 40, 16, '#5c6370'); ell(-312, -58, 6, 8, '#2a2d33');
  const dug = clamp(o.dug ?? 0), ps = clamp(o.pipeSnow ?? 0);
  fill(smoothPath([[-380, 6], [-340, -90], [-250, -104], [-120, -96], [0, -88], [140, -100], [260, -94], [360, -70], [400, 6]]), '#ffffff');
  if (dug > 0.01) { g.save(); g.globalAlpha = dug; ell(-318, -56, 64 * dug + 6, 44 * dug + 4, '#c7dcec'); rect(-312, -66, 40, 16, '#5c6370'); ell(-312, -58, 6, 8, '#2a2d33'); g.restore(); }
  if (ps > 0.01) { g.save(); g.globalAlpha = ps; ell(-318, -58, 34, 26, '#ffffff'); ell(-322, -62, 20, 14, '#eaf2f9'); g.restore(); }
  const sm = clamp(o.smoke ?? 0);
  if (sm > 0.01) for (let i = 0; i < 6; i++) {
    const u = ((t * 0.9 + i / 6) % 1), r = 14 + 40 * u;
    g.save(); g.globalAlpha = sm * 0.6 * (1 - u); ell(-330 - 220 * u, -70 - 70 * u + 8 * Math.sin(t * 3 + i), r, r * 0.8, '#d7dde3'); g.restore();
  }
  const gas = clamp(o.gas ?? 0);
  if (gas > 0.01) {                                                                                   // the CO cloud: from the pipe, under and into the cabin
    g.save(); g.globalAlpha = 0.75 * gas;
    for (let i = 0; i < 9; i++) { const u = i / 8, px = lerp(-300, -40, u), py = lerp(-60, -225, Math.min(1, u * 1.3)); ell(px + 10 * Math.sin(t * 2 + i), py, 44 + 10 * Math.sin(t * 3 + i * 2), 32, '#7d8691'); }
    g.restore();
    if (gas > 0.5) { g.save(); g.globalAlpha = (gas - 0.5) * 2; text('CO', -110, -205, 54, '#ffffff', { fam: FONTS.block }); g.restore(); }
  }
  const ant = clamp(o.antenna ?? 0), tip = [-110, -270 - 140 * ant];
  if (ant > 0.01) {
    limb([[-110, -270], tip], 5, '#2a2d33', false); ell(tip[0], tip[1], 6, 6, '#2a2d33');
    const cl = clamp(o.cloth ?? 0);
    if (cl > 0.01) {                                                                                  // the red cloth flapping in the wind
      const pts = []; const L = 120 * cl, H_ = 54 * cl;
      for (let i = 0; i <= 8; i++) pts.push([tip[0] + L * i / 8, tip[1] + 8 + 14 * Math.sin(t * 9 - i * 0.9) * (i / 8)]);
      for (let i = 8; i >= 0; i--) pts.push([tip[0] + L * i / 8, tip[1] + 8 + H_ + 14 * Math.sin(t * 9 - i * 0.9) * (i / 8)]);
      poly(pts, '#e53935');
    }
  }
  g.restore();
  return { pipe: [x + pipe[0] * s, y + pipe[1] * s], tip: [x + tip[0] * s, y + tip[1] * s], cabin: [x - 20 * s, y - 220 * s] };
}

// a person crouched by the car, digging with a small shovel (dig 0…1 how fast), facing right
export function digger(x, y, s, t, dig = 1) {
  const a = dig * Math.sin(t * 9);
  g.save(); g.translate(x, y); g.scale(s, s);
  limb([[-10, -150], [-60, -80], [-10, -10]], 34, '#232b42', false); limb([[0, -150], [60, -96], [40, -10]], 34, JEANS, false);
  ell(-4, -6, 32, 14, BOOT); ell(50, -6, 32, 14, BOOT);
  g.save(); g.translate(-10, -150); g.rotate(0.7); rrect(-50, -170, 100, 180, 34, COAT); g.restore();
  const sh = [70, -260], hand = [sh[0] + 90 + 30 * a, sh[1] + 120 + 20 * a];
  limb([sh, [sh[0] + 60, sh[1] + 50], hand], 28, COAT_D, false);
  limb([hand, [hand[0] + 70 + 20 * a, hand[1] + 60]], 9, '#7a5232', false);                          // the handle and the blade
  poly([[hand[0] + 60 + 20 * a, hand[1] + 50], [hand[0] + 110 + 20 * a, hand[1] + 40], [hand[0] + 100 + 20 * a, hand[1] + 90]], '#9aa4b2');
  const hx = 110, hy = -330;
  ell(hx, hy, 50, 54, SKIN); fill(smoothPath([[hx - 54, hy - 8], [hx - 46, hy - 56], [hx, hy - 74], [hx + 46, hy - 56], [hx + 54, hy - 8], [hx, hy - 26]]), HAT);
  ell(hx, hy - 78, 20, 20, '#ffffff'); rrect(hx - 46, hy + 40, 92, 26, 12, SCARF);
  ell(hx + 22, hy - 2, 8, 10, '#ffffff'); ell(hx + 24, hy - 2, 5, 6, INK);
  g.restore();
}
// snow thrown up by the shovel
export function spray(x, y, t, k) {
  if (k <= 0.01) return;
  for (let i = 0; i < 8; i++) { const u = (t * 2.2 + i / 8) % 1; ell(x - 60 * u - 20 * hash(i), y - 120 * Math.sin(u * Math.PI) - 10, 9 * (1 - u) + 3, 9 * (1 - u) + 3, '#ffffff', 0, k); }
}
// a rescuer in orange with a torch, facing left; beam 0…1 the light cone towards (bx, by)
export function rescuer(x, y, s, t, beam = 0, bx = 0, by = 0) {
  if (beam > 0.01) {
    g.save(); g.globalAlpha = 0.45 * beam; const hx = x - 70 * s, hy = y - 250 * s;
    const gr = g.createLinearGradient(hx, hy, bx, by); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy); g.lineTo(bx - 40, by - 120); g.lineTo(bx + 40, by + 120); g.closePath(); g.fill(); g.restore();
  }
  const ph = t * 1.6 * TAU;
  g.save(); g.translate(x, y); g.scale(-s, s);
  [[Math.PI, '#c2410c'], [0, '#ea580c']].forEach(([k, c]) => { const a = 0.3 * Math.sin(ph + k); const f = [Math.sin(a) * 170, -170 + Math.cos(a) * 170]; limb([[0, -180], [f[0] * 0.5 + 8, (f[1] - 180) * 0.5], f], 34, c, false); ell(f[0] + 16, f[1] + 4, 32, 15, BOOT); });
  rrect(-52, -340, 104, 190, 34, '#f97316'); rect(-52, -270, 104, 14, '#e5e7eb'); rect(-52, -230, 104, 14, '#e5e7eb');
  limb([[28, -312], [100, -280], [150, -250]], 30, '#f97316', false); rect(140, -262, 46, 22, '#2a2d33'); ell(188, -251, 8, 12, '#fff3c4');
  ell(0, -400, 54, 60, SKIN); fill(smoothPath([[-58, -404], [-52, -456], [0, -472], [52, -456], [58, -404]]), '#f97316');
  ell(24, -402, 8, 10, '#ffffff'); ell(26, -402, 5, 6, INK);
  g.restore();
  // the flashing beacon on the helmet
  if (Math.sin(t * 12) > 0) { g.save(); g.globalAlpha = 0.8; ell(x, y - 476 * s, 16 * s, 16 * s, '#ffb020'); g.restore(); }
}
// a phone with «112» in a speech bubble
export function phone112(x, y, k) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-120 + 8, -70 + 8, 240, 140, 30, INK); rrect(-120, -70, 240, 140, 30, '#ffffff'); poly([[-60, 66], [-20, 66], [-70, 110]], '#ffffff');
  rrect(-96, -46, 50, 92, 12, '#2a2d33'); rect(-88, -36, 34, 62, '#9fe3b0');
  text('112', 40, 26, 74, '#2f8f4e', { fam: FONTS.block, shadow: false });
  g.restore();
}
// a clock face with «10 МИН / ЧАС»: the first ten minutes of the hour filled
export function clock10(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  ell(6, 8, 92, 92, INK); ell(0, 0, 92, 92, '#ffffff');
  g.fillStyle = '#2f8f4e'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 80, -Math.PI / 2, -Math.PI / 2 + TAU / 6); g.closePath(); g.fill();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; limb([[Math.sin(a) * 70, -Math.cos(a) * 70], [Math.sin(a) * 84, -Math.cos(a) * 84]], 6, INK, false); }
  const a = -Math.PI / 2 + (t * 0.8 % 1) * TAU / 6; limb([[0, 0], [Math.cos(a) * 66, Math.sin(a) * 66]], 9, INK, false);
  rrect(-130 + 6, 108 + 6, 260, 64, 16, INK); rrect(-130, 108, 260, 64, 16, '#ffd23f'); text('10 МИН / ЧАС', 0, 152, 36, INK, { fam: FONTS.cond, shadow: false });
  g.restore();
}
// «?» marks over someone lost in the snow
export function lostMarks(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.globalAlpha = Math.min(1, k * 2);
  for (let i = 0; i < 3; i++) text('?', x - 70 + i * 70, y - 20 * Math.sin(t * 4 + i * 2) - i * 16, 80 + 10 * i, '#e53935', { fam: FONTS.block });
  g.restore();
}
