// Close-ups and special shots: the phone, hands on the lock and the latch, the backpack from above,
// the building cutaway with the escape route, the stairwell seen through the peephole, the end card.
import { createCanvas } from '@napi-rs/canvas';
import { g, setCtx, solid, hose, smoothPath, ellPath, rrPath, polyPath, stroke, line, glow, softShadow, vgrad, px, LIGHT, W, H } from '../draw.js';
import { TAU, clamp, lerp, rgba, mix, shade, hash, hash2, noise, ease, spring, inv } from '../lib.js';
import { HERO, drawHand } from '../hero.js';
import { drawCat } from '../cat.js';
import { drawZombie, shadowFigure } from '../zombie.js';
import { drawGranny } from '../granny.js';

// —— a hand in a mustard sleeve coming from an edge; (x, y) is the hand, ang the forearm direction ——
export function sleeveHand(x, y, ang, kind = 'open', s = 1, len = 520) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const ex = -Math.cos(ang) * len, ey = -Math.sin(ang) * len;
  hose([[ex, ey], [ex * 0.45, ey * 0.45], [0, 0]], 110, HERO.hoodie);
  g.save(); g.translate(-Math.cos(ang) * 40, -Math.sin(ang) * 40); g.rotate(ang);
  solid(rrPath(-34, -62, 52, 124, 22), HERO.hoodieDark, [-34, -62, 52, 124], { lw: 6 });
  g.restore();
  g.save(); g.rotate(ang - Math.PI / 2); g.scale(2.4, 2.4);
  drawHand([0, 0], 0, 1, kind, false);
  g.restore();
  g.restore();
}

// —— phone ——
export function phone(t, o = {}) {
  const { x = 540, y = 1050, s = 1, rot = -0.06, mode = 'alert', k = 1 } = o;
  g.save(); g.translate(x, y); g.rotate(rot + (o.buzz ? Math.sin(t * 80) * 0.02 * o.buzz : 0)); g.scale(s, s);
  softShadow(30, 40, 360, 520, 0.35);
  const body = rrPath(-250, -480, 500, 960, 64);
  solid(body, '#1d1f2b', [-250, -480, 500, 960], { rimA: 0.5, hiA: 0.15 });
  const scr = rrPath(-226, -456, 452, 912, 46);
  g.save(); g.clip(scr);
  if (mode === 'alert') {
    vgrad(-226, -456, 452, 912, [[0, '#24123a'], [1, '#0d0a1c']]);
    // status bar
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 28px Oswald'; g.textAlign = 'left'; g.fillText('23:50', -190, -400);
    g.textAlign = 'right'; g.fillText('▮▮▮ 34%', 190, -400);
    // alert card slides in
    const a = spring(k, 2.6, 6);
    g.save(); g.translate(0, lerp(-500, 0, a));
    solid(rrPath(-200, -330, 400, 430, 30), '#f3eee6', [-200, -330, 400, 430], { lw: 0, rimA: 0, hiA: 0.1 });
    g.fillStyle = '#e23b3b'; g.beginPath(); g.moveTo(-200, -300); g.arcTo(-200, -330, -170, -330, 30); g.lineTo(170, -330); g.arcTo(200, -330, 200, -300, 30); g.lineTo(200, -230); g.lineTo(-200, -230); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = '700 27px Oswald'; g.textAlign = 'center'; g.fillText('ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ', 22, -266);
    g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(-178, -252); g.lineTo(-158, -290); g.lineTo(-138, -252); g.closePath(); g.fill();
    g.fillStyle = '#e23b3b'; g.fillRect(-160, -280, 4, 16); g.fillRect(-160, -261, 4, 4);
    g.fillStyle = '#1b1620'; g.font = '700 46px Oswald';
    g.fillText('ОТКЛЮЧЕНИЕ', 0, -160); g.fillText('ЭЛЕКТРИЧЕСТВА', 0, -104);
    g.fillStyle = '#e23b3b'; g.font = '700 50px Oswald'; g.fillText('ЧЕРЕЗ 10 МИНУТ', 0, -24);
    g.fillStyle = '#4a4552'; g.font = '600 30px Oswald'; g.fillText('Не выходите из дома', 0, 50);
    g.restore();
  } else if (mode === 'silent') {
    vgrad(-226, -456, 452, 912, [[0, '#1b2440'], [1, '#0c1022']]);
    const on = o.silent ?? 0;
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '700 54px Oswald'; g.textAlign = 'center';
    g.fillText(on > 0.5 ? 'БЕЗ ЗВУКА' : 'ЗВОНОК', 0, 230);
    // bell icon
    g.save(); g.translate(0, -60); g.scale(1 + 0.12 * Math.sin(on * Math.PI), 1 + 0.12 * Math.sin(on * Math.PI));
    const bell = smoothPath([[-90, 60], [-70, -20], [-50, -90], [0, -120], [50, -90], [70, -20], [90, 60]]);
    solid(bell, on > 0.5 ? '#8c93a8' : '#ffd26a', [-90, -120, 180, 180], { lw: 7 });
    solid(ellPath(0, 82, 26, 20), on > 0.5 ? '#8c93a8' : '#ffd26a', [-26, 62, 52, 40], { lw: 6 });
    if (on > 0.02) { line([[-110, -130], [-110 + 220 * clamp(on * 1.5), -130 + 230 * clamp(on * 1.5)]], 20, '#ff4a4a'); }
    g.restore();
    // toggle
    solid(rrPath(-90, 300, 180, 90, 45), on > 0.5 ? '#ff4a4a' : '#3b4562', [-90, 300, 180, 90], { lw: 5, rimA: 0 });
    solid(ellPath(lerp(-45, 45, ease.inOut(clamp(on))), 345, 38, 38), '#ffffff', [-38, 307, 76, 76], { lw: 4.5 });
  }
  g.restore();
  stroke(scr, 4, '#000');
  // notch
  g.fillStyle = '#0b0c12'; g.beginPath(); g.ellipse(0, -440, 50, 14, 0, 0, TAU); g.fill();
  g.restore();
}

// —— close-up: key in the lock (turns = 0..2) ——
export function lockCloseup(t, turns, o = {}) {
  vgrad(-300, -200, 1680, 2320, [[0, '#6b3f2a'], [1, '#4a2a1c']]);
  quilt(-300, -200, 1680, 2320, 260, 1.6);
  const cx = 540, cy = 960;
  solid(rrPath(cx - 150, cy - 290, 300, 580, 60), '#c9b37a', [cx - 150, cy - 290, 300, 580], { lw: 7, hiA: 0.45, rimA: 0.4 });
  for (const sy of [cy - 220, cy + 220]) { solid(ellPath(cx, sy, 22, 22), '#a8925a', [cx - 22, sy - 22, 44, 44], { lw: 5 }); line([[cx - 12, sy - 6], [cx + 12, sy + 6]], 4); }
  g.fillStyle = '#100a0c'; g.beginPath(); g.arc(cx, cy - 40, 44, 0, TAU); g.fill(); g.fillRect(cx - 22, cy - 40, 44, 110);
  // key: bow + blade, rotating around its axis (drawn as a foreshortened rotation)
  const a = turns * Math.PI;                    // half turn per "turn" click
  const sx = Math.cos(a);
  g.save(); g.translate(cx, cy - 30);
  g.scale(Math.max(0.14, Math.abs(sx)), 1);
  solid(rrPath(-30, -60, 60, 170, 12), '#d7dbe2', [-30, -60, 60, 170], { lw: 6, hiA: 0.5 });
  const bow = smoothPath([[-150, -120], [-120, -330], [0, -380], [120, -330], [150, -120], [60, -60], [-60, -60]]);
  solid(bow, '#e2c35a', [-150, -380, 300, 320], { lw: 7, hiA: 0.5, rimA: 0.4 });
  g.fillStyle = '#100a0c'; g.beginPath(); g.arc(0, -270, 34, 0, TAU); g.fill();
  g.restore();
  // fingers pinching the key bow from the right
  const hx = cx + 150 * Math.max(0.14, Math.abs(sx)) + 30, hy = cy - 200 + Math.sin(a) * 20;
  sleeveHand(hx, hy, Math.PI * 0.9, 'fist', 1.0, 700);
  vignetteLocal(0.55);
}

// —— close-up: the night latch sliding into the frame (k = 0..1) ——
export function latchCloseup(t, k) {
  vgrad(-300, -200, 1680, 2320, [[0, '#6b3f2a'], [1, '#4a2a1c']]);
  quilt(-300, -200, 820, 2320, 260, 1.6);
  // door frame on the right
  solid(rrPath(540, -200, 600, 2320, 0), '#d6cfbf', [540, -200, 600, 2320], { rimA: 0.15, hiA: 0.15 });
  line([[540, -200], [540, 2120]], 8);
  // strike plate on the frame
  solid(rrPath(600, 860, 170, 200, 16), '#9aa0ac', [600, 860, 170, 200], { lw: 6, hiA: 0.4 });
  g.fillStyle = '#16121a'; g.fillRect(630, 920, 110, 70);
  // latch body on the door
  solid(rrPath(80, 840, 420, 240, 24), '#9aa0ac', [80, 840, 420, 240], { lw: 7, hiA: 0.45, rimA: 0.3 });
  const bx = lerp(140, 360, ease.inOut(k));
  solid(rrPath(bx, 920, 320, 74, 26), '#c8ced8', [bx, 920, 320, 74], { lw: 6, hiA: 0.6 });
  // knob
  const kx = bx + 70;
  solid(ellPath(kx, 860, 50, 50), '#c8ced8', [kx - 50, 810, 100, 100], { lw: 6, hiA: 0.6 });
  sleeveHand(kx + 10, 800, Math.PI * 1.25, 'fist', 1.0, 700);
  vignetteLocal(0.55);
}

function quilt(x, y, w, h, step, s = 1) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = 'rgba(30,14,10,.45)'; g.lineWidth = px(6 * s);
  for (let k = -20; k < 20; k++) {
    g.beginPath(); g.moveTo(x + k * step, y); g.lineTo(x + k * step + h * 0.6, y + h); g.stroke();
    g.beginPath(); g.moveTo(x + k * step, y); g.lineTo(x + k * step - h * 0.6, y + h); g.stroke();
  }
  for (let r = 0; r < h / (step * 0.83); r++) for (let c = -2; c < w / step + 2; c++) {
    const bx = x + c * step + (r % 2) * step / 2, by = y + r * step * 0.83;
    solid(ellPath(bx, by, 14 * s, 14 * s), '#d6a64a', [bx - 14, by - 14, 28, 28], { lw: 3, rimA: 0, hiA: 0.5 });
  }
  g.restore();
}

export function vignetteLocal(a) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
}

// —— top-down backpack on a herringbone parquet ——
export const BAG = { x: 540, y: 1120 };
export function parquet(x, y, w, h) {
  g.fillStyle = '#7b5233'; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const L = 160, Wd = 40;
  for (let r = -2; r < h / Wd + 4; r++) for (let c = -2; c < w / (L * 0.7) + 2; c++) {
    const bx = x + c * L * 0.7, by = y + r * Wd * 1.4 + (c % 2) * 30;
    const hv = hash2(r, c);
    g.save(); g.translate(bx, by); g.rotate((c % 2 ? 1 : -1) * Math.PI / 4);
    g.fillStyle = mix('#8a5d3b', '#a87448', hv); g.fillRect(0, 0, L, Wd);
    g.strokeStyle = 'rgba(40,20,10,.5)'; g.lineWidth = px(3); g.strokeRect(0, 0, L, Wd);
    g.restore();
  }
  g.restore();
}
export function bagTop(t, o = {}) {
  const { x, y } = BAG;
  softShadow(x + 24, y + 40, 340, 330, 0.5);
  // lid flap thrown back (towards the top of the frame) with its zip
  const lid = smoothPath([[x - 220, y - 250], [x - 200, y - 470], [x, y - 500], [x + 200, y - 470], [x + 220, y - 250]]);
  solid(lid, HERO.bagDark, [x - 220, y - 500, 440, 250], { lw: 6 });
  line([[x - 170, y - 300], [x + 170, y - 300]], 7, '#f1d36b');
  // body
  const body = rrPath(x - 280, y - 270, 560, 560, 150);
  solid(body, HERO.bag, [x - 280, y - 270, 560, 560], { rimA: 0.3, hiA: 0.2 });
  // front pocket
  solid(rrPath(x - 170, y + 150, 340, 120, 50), shade(HERO.bag, -0.12), [x - 170, y + 150, 340, 120], { lw: 5 });
  line([[x - 120, y + 176], [x + 120, y + 176]], 5, '#f1d36b');
  // open mouth
  const mouth = rrPath(x - 220, y - 230, 440, 360, 110);
  const gr = g.createRadialGradient(x, y - 50, 40, x, y - 50, 260);
  gr.addColorStop(0, '#1a0a06'); gr.addColorStop(1, '#4a2014');
  g.fillStyle = gr; g.fill(mouth); stroke(mouth, 6);
  // grab loop
  hose([[x - 40, y - 268], [x, y - 300], [x + 40, y - 268]], 14, '#2a1a14', { rimA: 0 });
  return { mouth: [x, y - 50] };
}
// items: id → drawn at (x, y) with rotation
export function item(id, x, y, rot = 0, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  softShadow(10, 18, 110, 50, 0.35);
  if (id === 'torch') {
    solid(rrPath(-130, -34, 200, 68, 20), '#2d3240', [-130, -34, 200, 68], { hiA: 0.3 });
    solid(smoothPath([[70, -50], [140, -64], [140, 64], [70, 50]]), '#3c4254', [70, -64, 70, 128], { lw: 6 });
    solid(ellPath(140, 0, 16, 62), '#fff4c2', [124, -62, 32, 124], { lw: 5 });
    solid(rrPath(-60, -46, 40, 22, 6), '#e04a3a', [-60, -46, 40, 22], { lw: 4 });
  } else if (id === 'aid') {
    solid(rrPath(-120, -90, 240, 180, 24), '#f1f1ee', [-120, -90, 240, 180], { hiA: 0.3 });
    g.fillStyle = '#e03a3a'; g.fillRect(-24, -64, 48, 128); g.fillRect(-64, -24, 128, 48);
    solid(rrPath(-40, -110, 80, 30, 8), '#d6d6d0', [-40, -110, 80, 30], { lw: 5 });
  } else if (id === 'power') {
    solid(rrPath(-110, -60, 220, 120, 22), '#2f6fd6', [-110, -60, 220, 120], { hiA: 0.35 });
    for (let i = 0; i < 4; i++) { g.fillStyle = i < 3 ? '#7dff9a' : '#2b4a35'; g.fillRect(-60 + i * 34, -12, 24, 24); }
    hose([[110, 0], [170, 30], [150, 90]], 12, '#1d1d24', { rimA: 0 });
  } else if (id === 'can') {
    solid(rrPath(-70, -90, 140, 180, 18), '#b9bec8', [-70, -90, 140, 180], { hiA: 0.5 });
    g.fillStyle = '#c9342e'; g.fillRect(-70, -50, 140, 100);
    g.fillStyle = '#fff'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.fillText('ТУШЁНКА', 0, 12);
    stroke(rrPath(-70, -90, 140, 180, 18), 6);
  } else if (id === 'grechka') {
    solid(rrPath(-90, -120, 180, 240, 16), '#e9d07a', [-90, -120, 180, 240], { hiA: 0.3 });
    g.fillStyle = '#8a4b1e'; g.font = '700 40px Oswald'; g.textAlign = 'center'; g.fillText('ГРЕЧКА', 0, 0);
    g.fillStyle = '#5c8a3a'; g.fillRect(-90, 50, 180, 30);
    stroke(rrPath(-90, -120, 180, 240, 16), 6);
  } else if (id === 'water') {
    solid(rrPath(-60, -150, 120, 300, 40), 'rgba(140,200,255,.8)', [-60, -150, 120, 300], { hiA: 0.6 });
    solid(rrPath(-30, -190, 60, 46, 10), '#2f6fd6', [-30, -190, 60, 46], { lw: 5 });
  }
  g.restore();
}

// —— building cutaway with the escape route ——
export const CUT = { x0: 120, x1: 960, top: 420, bottom: 1660, floors: 9 };
export function cutaway(t, o = {}) {
  const { x0, x1, top, bottom, floors } = CUT;
  vgrad(-300, -200, 1680, 2320, [[0, '#0c1430'], [1, '#070a18']]);
  // blueprint grid
  g.save(); g.strokeStyle = 'rgba(90,140,255,.10)'; g.lineWidth = px(2);
  for (let x = -300; x < 1400; x += 60) { g.beginPath(); g.moveTo(x, -200); g.lineTo(x, 2120); g.stroke(); }
  for (let y = -200; y < 2120; y += 60) { g.beginPath(); g.moveTo(-300, y); g.lineTo(1400, y); g.stroke(); }
  g.restore();
  const fh = (bottom - top) / floors, mid = (x0 + x1) / 2;
  // ground
  g.fillStyle = '#1b1426'; g.fillRect(-300, bottom, 1680, 600);
  // two stairwells (left and right), lift shaft next to the left one
  const stairs = [x0 + 40, x1 - 200], shaftX = x0 + 210;
  // rooms
  for (let f = 0; f < floors; f++) {
    const fy = bottom - (f + 1) * fh;
    for (let r = 0; r < 4; r++) {
      const rx = x0 + 300 + r * 85;
      g.fillStyle = (f === 8 && r === 0) ? 'rgba(255,200,110,.45)' : 'rgba(80,110,200,.10)';
      g.fillRect(rx, fy + 8, 78, fh - 16);
    }
  }
  // floors and walls
  g.strokeStyle = '#7fa6ff'; g.lineWidth = px(5);
  g.strokeRect(x0, top, x1 - x0, bottom - top);
  for (let f = 1; f < floors; f++) { const y = bottom - f * fh; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  // stairs zigzag in each stairwell
  for (const sx of stairs) {
    g.strokeStyle = '#a9c2ff'; g.lineWidth = px(4);
    for (let f = 0; f < floors; f++) {
      const y0 = bottom - f * fh, y1 = y0 - fh;
      g.beginPath(); g.moveTo(sx, y0); g.lineTo(sx + 130, y0 - fh / 2); g.lineTo(sx, y1); g.stroke();
    }
    g.strokeStyle = '#7fa6ff'; g.lineWidth = px(4); g.strokeRect(sx - 20, top, 170, bottom - top);
  }
  // lift shaft + cabin stuck between floors 4 and 5 with a zombie inside
  g.strokeStyle = '#7fa6ff'; g.lineWidth = px(4); g.strokeRect(shaftX, top, 70, bottom - top);
  const cabY = bottom - 4.5 * fh - fh * 0.5;
  const trap = o.liftTrap ?? 0;
  solid(rrPath(shaftX + 4, cabY, 62, fh * 0.9, 6), trap > 0 ? mix('#3a4a7a', '#7a1f2a', trap) : '#3a4a7a', [shaftX, cabY, 62, fh], { lw: 4, rimA: 0 });
  if (trap > 0) {
    g.save(); g.beginPath(); g.rect(shaftX + 4, cabY, 62, fh * 0.9); g.clip();
    drawZombie({ x: shaftX + 34, y: cabY + fh * 0.88, s: 0.13, t, seed: 2, shadow: 0 });
    g.restore();
    glow(shaftX + 35, cabY + fh / 2, 140 * trap, '#ff2a3a', 0.5 * trap * (0.7 + 0.3 * Math.sin(t * 12)));
  }
  // roof with two hatches
  g.strokeStyle = '#7fa6ff'; g.lineWidth = px(5);
  for (const sx of stairs) { g.strokeRect(sx + 20, top - 70, 90, 70); }
  // zombies flooding the lower floors (danger level 0..1 → floors)
  const dz = o.danger ?? 0;
  if (dz > 0) {
    const lvl = dz * 3.2;
    const dy = bottom - lvl * fh;
    const gr = g.createLinearGradient(0, dy - 60, 0, bottom);
    gr.addColorStop(0, 'rgba(255,40,60,0)'); gr.addColorStop(0.25, 'rgba(255,40,60,.32)'); gr.addColorStop(1, 'rgba(255,40,60,.5)');
    g.fillStyle = gr; g.fillRect(x0, dy - 60, x1 - x0, bottom - dy + 60);
    for (let i = 0; i < 14; i++) {
      const f = Math.floor(i / 5), zx = x0 + 40 + (i * 157) % (x1 - x0 - 80), fy = bottom - f * fh;
      if (f + 0.3 < lvl) drawZombie({ x: zx + Math.sin(t * 1.3 + i) * 10, y: fy - 4, s: 0.13, face: i % 2 ? 1 : -1, t: t + i, seed: i, shadow: 0 });
    }
  }
  // our flat: 9th floor
  const home = [x0 + 300 + 39, bottom - 8.5 * fh];
  glow(home[0], home[1], 140, '#ffbe5c', 0.5 + 0.2 * Math.sin(t * 4));
  return { fh, stairs, shaftX, home, top, bottom };
}
// dashed glowing route along points, revealed up to k (0..1); returns the head position
export function route(pts, k, t, color = '#7dff9a') {
  let total = 0; const segs = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
  let left = total * clamp(k), head = pts[0];
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const path = [];
  path.push(pts[0]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const l = segs[i - 1], u = Math.min(1, left / l);
    head = [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
    path.push(head); left -= l;
  }
  for (const [lw, col, a] of [[26, color, 0.25], [12, color, 1]]) {
    g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = px(lw);
    if (lw < 20) { g.setLineDash([px(26), px(18)]); g.lineDashOffset = -t * 60; }
    g.beginPath(); g.moveTo(...path[0]); for (const q of path.slice(1)) g.lineTo(...q); g.stroke();
    g.setLineDash([]);
  }
  g.restore();
  glow(head[0], head[1], 70, color, 0.8);
  return head;
}

// —— the stairwell landing seen through the peephole ——
let fishSrc = null, fishMap = null, fishOut = null;
const FS = 1100;                                  // square source canvas
export function stairwell(t, o = {}) {
  // drawn into the current context in a FS×FS square
  const flick = o.flicker ?? 1;
  // walls: green paint below, whitewash above
  vgrad(-FS, -FS, 3 * FS, FS + 520, [[0, '#cfcab8'], [1, '#bdb8a4']]);
  g.fillStyle = '#3f6b4f'; g.fillRect(-FS, 520, 3 * FS, 2 * FS);
  g.fillStyle = '#2c4d39'; g.fillRect(-FS, 512, 3 * FS, 14);
  // neighbour's door on the left
  solid(rrPath(30, 230, 250, 640, 6), '#5b3a2a', [30, 230, 250, 640], { lw: 6 });
  g.fillStyle = '#d8c27e'; g.fillRect(230, 560, 34, 14);
  solid(ellPath(155, 340, 8, 8), '#c9b37a', [147, 332, 16, 16], { lw: 3 });
  // electric panel with graffiti
  solid(rrPath(820, 260, 220, 160, 6), '#6f7a72', [820, 260, 220, 160], { lw: 5 });
  g.save(); g.fillStyle = 'rgba(30,30,30,.55)'; g.font = '600 34px Oswald'; g.fillText('ВИТЯ + ЛЕНА', 818, 470); g.restore();
  // stairs going down on the right with a railing
  g.save();
  g.fillStyle = '#5d6460'; g.beginPath(); g.moveTo(760, 1100); g.lineTo(1100, 760); g.lineTo(1100, 1100); g.closePath(); g.fill();
  for (let i = 0; i < 7; i++) line([[800 + i * 48, 1060 - i * 48], [1100, 1060 - i * 48]], 3.5, 'rgba(0,0,0,.35)');
  line([[740, 820], [1100, 460]], 10, '#3a2a22'); for (let i = 0; i < 6; i++) line([[760 + i * 60, 800 - i * 60], [760 + i * 60, 1040 - i * 60]], 5, '#2a2a30');
  g.restore();
  // shadow figure down the stairs (only visible when the bulb flickers on)
  if (o.figure > 0) shadowFigure(820, 930, 0.65, o.figure);
  // floor
  g.fillStyle = '#4a4f4c'; g.fillRect(-FS, 960, FS + 760, FS);
  // the granny
  const gp = drawGranny({ x: 470, y: 900, s: 0.92, t, talk: o.talk ?? 0, stain: o.stain ?? 0.5, blink: o.blink ?? 0, tilt: o.tilt ?? 0, creepy: o.creepy ?? 0, drip: o.drip ?? 0 });
  // light: dim bulb + candle (the darker the bulb, the more the candle carries the scene)
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(40,30,60,${0.8 - 0.5 * flick})`; g.fillRect(-FS, -FS, 3 * FS, 3 * FS); g.restore();
  glow(gp.candle[0], gp.candle[1], 520, '#ffb85a', 0.5 + 0.1 * noise(t * 9, 4));
  glow(540, 0, 700, '#fff0c0', 0.25 * flick);
  // eyes in the dark on the stairs below
  if (o.eyes > 0) for (const ex of [-14.3, 14.3]) {
    glow(820 + ex, 731, 34, '#d6ff6a', 0.9 * o.eyes);
    g.fillStyle = `rgba(235,255,180,${o.eyes})`; g.beginPath(); g.arc(820 + ex, 731, 5, 0, TAU); g.fill();
  }
}

// fisheye warp of the stairwell into a circle on screen (peephole POV)
export function peephole(t, o = {}) {
  if (!fishSrc) {
    fishSrc = createCanvas(FS, FS);
    // precompute: output pixel → source pixel (equidistant fisheye over a rectilinear source)
    const R = 540, th = 1.15, n = (2 * R) * (2 * R);
    fishMap = new Int32Array(n);
    for (let y = 0; y < 2 * R; y++) for (let x = 0; x < 2 * R; x++) {
      const dx = (x - R) / R, dy = (y - R) / R, r = Math.hypot(dx, dy);
      let idx = -1;
      if (r <= 1) {
        const rs = r < 1e-6 ? 0 : Math.tan(r * th) / Math.tan(th);
        const sx = Math.round(FS / 2 + (r < 1e-6 ? 0 : dx / r * rs * FS / 2)), sy = Math.round(FS / 2 + (r < 1e-6 ? 0 : dy / r * rs * FS / 2));
        if (sx >= 0 && sy >= 0 && sx < FS && sy < FS) idx = sy * FS + sx;
      }
      fishMap[y * 2 * R + x] = idx;
    }
    fishOut = createCanvas(2 * R, 2 * R);
  }
  const main = g;
  const sc = fishSrc.getContext('2d');
  const f = o.focus ?? [FS / 2, FS / 2, 1];                      // look closer at a point of the landing
  setCtx(sc); sc.setTransform(f[2], 0, 0, f[2], FS / 2 - f[0] * f[2], FS / 2 - f[1] * f[2]);
  stairwell(t, o);
  setCtx(main);
  const src = new Uint32Array(sc.getImageData(0, 0, FS, FS).data.buffer);
  const octx = fishOut.getContext('2d');
  const img = octx.createImageData(1080, 1080);
  const out = new Uint32Array(img.data.buffer);
  for (let i = 0; i < out.length; i++) { const k = fishMap[i]; out[i] = k >= 0 ? src[k] : 0; }
  octx.putImageData(img, 0, 0);
  // compose on screen: black, warped circle, glass sheen, brass rim, vignette
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const cx = W / 2 + (o.dx ?? 0), cy = H / 2 + (o.dy ?? 0), sc2 = o.scale ?? 0.95;
  g.translate(cx, cy); g.scale(sc2, sc2);
  g.drawImage(fishOut, -540, -540);
  const gr = g.createRadialGradient(0, 0, 300, 0, 0, 545);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,.95)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 545, 0, TAU); g.fill();
  g.globalAlpha = 0.08; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-170, -220, 210, 120, -0.6, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.lineWidth = 26; g.strokeStyle = '#1a1410'; g.beginPath(); g.arc(0, 0, 552, 0, TAU); g.stroke();
  g.restore();
}

// —— the end card: darkness, light under the door ——
export function endCard(t, o = {}) {
  g.fillStyle = '#030305'; g.fillRect(-300, -200, 1680, 2320);
  const y = 1380;
  const flick = 0.85 + 0.15 * noise(t * 8, 2);
  const gr = g.createLinearGradient(0, y - 6, 0, y + 260);
  gr.addColorStop(0, `rgba(255,190,110,${0.55 * flick})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(330, y); g.lineTo(750, y); g.lineTo(900, y + 260); g.lineTo(180, y + 260); g.closePath(); g.fill();
  g.fillStyle = `rgba(255,205,140,${0.95 * flick})`; g.fillRect(330, y - 6, 420, 10);
  // two feet shadows breaking the light, shifting
  const sh = Math.sin(t * 1.3) * 30 + (o.step ?? 0);
  g.fillStyle = '#030305'; g.fillRect(400 + sh, y - 8, 70, 14); g.fillRect(560 + sh * 0.8, y - 8, 70, 14);
  glow(540, y, 380, '#ffb35c', 0.25 * flick);
}
