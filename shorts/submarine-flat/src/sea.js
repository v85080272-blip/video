// Outside the boat: water that gets lighter towards the surface, light rays from above, marine snow in three depths,
// a school of fish, the bottom with stones and weed, the submarine itself (searchlight, navigation lights, a turning
// screw, the escape hatch), the rescue ship on the surface with its hydrophone, the sky above. Two worlds use it:
// the boat's world (the whole boat on screen, 50 m of water above it) and the swimmer's world (he is life size and the
// hull is a wall of steel under him). env = { surf, bed } says where the surface and the bottom are in that world.
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, frame } from './flat.js';
import { lerp, clamp, ease, hash, noise, TAU, rgba, mix, bump } from './lib.js';
import { view, toScreen, scaleOf, extent } from './camera.js';

export const BOATW = { surf: -3000, bed: -520 };
export const SWIMW = { surf: -4000, bed: 470 };
const DEEP = '#061a36', MID = '#0f4a80', SHALLOW = '#47b4df';
export function waterAt(env, y) {
  const d = clamp((y - env.surf) / (env.bed - env.surf));
  return d < 0.3 ? mix(SHALLOW, MID, d / 0.3) : mix(MID, DEEP, (d - 0.3) / 0.7);
}
const sy = (cam, y, f = 1) => toScreen(cam, [cam.x, y], f)[1];
export const waveY = (env, x, t) => env.surf + 12 * Math.sin(x * 0.011 + t * 2.1) + 7 * Math.sin(x * 0.027 - t * 1.4);

// —— the water and the sky over the whole screen ——
export function water(t, cam, env) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const [, y0, , y1] = extent(cam, 1), ys = sy(cam, env.surf);
  if (ys > 0) {                                     // the sky over the surface
    const gr = g.createLinearGradient(0, Math.min(0, ys - 1400), 0, ys);
    gr.addColorStop(0, '#5fb6ea'); gr.addColorStop(1, '#d4f0ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, Math.min(H, ys + 2));
  }
  if (ys < H) {
    const a = Math.max(y0, env.surf), top = Math.max(0, ys), gr = g.createLinearGradient(0, top, 0, H);
    for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, waterAt(env, lerp(a, y1, i / 6)));
    g.fillStyle = gr; g.fillRect(0, top, W, H - top);
  }
}
// the sun, clouds and the far sea, seen when the camera is near the surface
export function sky(t, cam, env) {
  if (sy(cam, env.surf) < 0) return;
  view(cam, 0.25);
  ell(380, env.surf - 1500, 150, 150, 'rgba(255,250,220,0.55)'); ell(380, env.surf - 1500, 100, 100, '#fffbe6');
  view(cam, 0.4);
  for (const [x, y, s] of [[-500, -1200, 1], [600, -900, 0.8], [1500, -1350, 1.2], [-1600, -800, 0.9]]) {
    const cx = x + t * 14 * s, cy = env.surf + y;
    for (const [dx, dy, r] of [[0, 0, 90], [80, -30, 70], [-80, -10, 70], [150, 10, 55], [-150, 15, 50]]) ell(cx + dx * s, cy + dy * s, r * s, r * 0.8 * s, '#ffffff', 0, 0.9);
  }
  view(cam, 0.7);
  rect(-6000, env.surf - 60, 12000, 70, '#3a99cc');
  rect(-6000, env.surf - 64, 12000, 6, '#c9ecfa');
}
// the surface line: from below a bright rippled mirror, at the waterline the near waves
export function surface(t, cam, env) {
  const ys = sy(cam, env.surf);
  if (ys < -60 || ys > H + 60) return;
  view(cam, 1);
  const [x0, , x1] = extent(cam, 1), pts = [];
  for (let x = x0 - 40; x <= x1 + 40; x += 24) pts.push([x, waveY(env, x, t)]);
  const z = scaleOf(cam);
  // under the surface: caustic ripples fading downwards
  for (let i = 1; i <= 4; i++) {
    const p = pts.map(([x, y]) => [x, y + i * 40 / z * 2 + 8 * Math.sin(x * 0.02 + t * 3 + i)]);
    limb(p, 5 / z, rgba('#bff0ff', 0.28 / i), false);
  }
  fill(polyPath([...pts, [x1 + 40, env.surf + 30], [x0 - 40, env.surf + 30]]), rgba('#9fe2f6', 0.55));
  limb(pts, 8 / z, rgba('#e9fbff', 0.9), false);
}
// what is under the surface seen through the water in front of it (for bodies that are half in): a veil below the waves
export function veil(t, cam, env, a = 0.35) {
  view(cam, 1);
  const [x0, , x1, y1] = extent(cam, 1), pts = [];
  for (let x = x0 - 40; x <= x1 + 40; x += 24) pts.push([x, waveY(env, x, t) + 4]);
  fill(polyPath([...pts, [x1 + 40, y1 + 100], [x0 - 40, y1 + 100]]), rgba('#2a8fc8', a));
  limb(pts, 6 / scaleOf(cam), rgba('#ffffff', 0.85), false);
}

// —— light rays from the surface, swaying ——
export function rays(t, cam, env, k = 1) {
  view(cam, 0.75);
  g.save();
  for (let i = -7; i <= 7; i++) {
    const x = i * 380 + 90 * Math.sin(t * 0.35 + i * 1.7), sw = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 2.3), a = (0.05 + 0.07 * sw) * k;
    const top = env.surf, bot = env.surf + 2800, wt = 70 + 40 * hash(i * 3.1), wb = 220 + 120 * hash(i * 7.7), dx = 700;
    const gr = g.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, rgba('#d8f4ff', a)); gr.addColorStop(1, rgba('#d8f4ff', 0));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - wt, top); g.lineTo(x + wt, top); g.lineTo(x + dx + wb, bot); g.lineTo(x + dx - wb, bot); g.closePath(); g.fill();
  }
  g.restore();
}

// —— marine snow: specks drifting down slowly, in a far, a middle and a near layer ——
export function snow(t, cam, env, o = {}) {
  const layers = o.layers ?? [[0.55, 3, 3, 0.35], [1, 3, 5, 0.45], [1.35, 1, 9, 0.28]];
  for (const [f, n, r, a] of layers) {
    view(cam, f);
    const [x0, y0, x1, y1] = extent(cam, f), cell = 260 * (o.cell ?? 1);
    for (let cx = Math.floor(x0 / cell) - 1; cx <= Math.floor(x1 / cell) + 1; cx++) for (let cy = Math.floor(y0 / cell) - 1; cy <= Math.floor(y1 / cell) + 1; cy++) {
      for (let k = 0; k < n; k++) {
        const h1 = hash(cx * 13.1 + cy * 71.7 + k * 3.3 + f * 9), h2 = hash(cx * 5.7 - cy * 19.3 + k * 9.1 + f * 4);
        const ph = (t * 0.07 * (0.5 + h1) + h2) % 1, x = (cx + h1) * cell + 16 * Math.sin(t * 0.6 + h2 * 9), y = (cy + ph) * cell;
        if (y < env.surf + 30) continue;
        ell(x, y, r * (o.size ?? 1), r * (o.size ?? 1), rgba('#d3e9ff', a * bump(ph) * (0.5 + 0.5 * h2)));
      }
    }
  }
}

// —— a school of small fish, all turning together ——
export function school(t, cam, f, x0, y0, n, o = {}) {
  view(cam, f);
  const dir = o.dir ?? -1, s = o.s ?? 1, c = o.color ?? 'rgba(10,30,60,0.55)', vx = 60 * dir;
  for (let i = 0; i < n; i++) {
    const h1 = hash(i * 4.7 + x0), h2 = hash(i * 8.3 + y0);
    const x = x0 + (h1 - 0.5) * 520 * s + vx * t + 30 * Math.sin(t * 0.9 + i), y = y0 + (h2 - 0.5) * 260 * s + 26 * Math.sin(t * 1.3 + i * 0.7);
    const w = (22 + 10 * h2) * s, wig = Math.sin(t * 9 + i * 1.3);
    g.save(); g.translate(x, y); g.scale(-dir, 1);
    fill(smoothPath([[-w, 0], [-w * 0.3, -w * 0.38], [w * 0.5, -w * 0.25], [w * 0.8, 0], [w * 0.5, w * 0.25], [-w * 0.3, w * 0.38]]), c);
    poly([[w * 0.7, 0], [w * 1.3, (-0.45 + 0.15 * wig) * w], [w * 1.3, (0.45 + 0.15 * wig) * w]], c);
    g.restore();
  }
}

// —— the bottom: sand, stones, weed swaying ——
const SAND = '#33445e', SAND_HI = '#455a78', STONE = '#25314a', STONE_HI = '#33415e', WEED = '#1e5a5a';
const bedY = (env, x) => env.bed + 34 * noise(x * 0.003, 4) + 12 * noise(x * 0.017, 5);
export function seabed(t, cam, env) {
  view(cam, 1);
  const [x0, , x1, y1] = extent(cam, 1), pts = [];
  if (env.bed > y1 + 80) return;
  for (let x = x0 - 80; x <= x1 + 80; x += 40) pts.push([x, bedY(env, x)]);
  // weed behind the ridge
  for (let x = Math.floor(x0 / 170) * 170; x < x1 + 170; x += 170) {
    const h = hash(x * 0.37);
    if (h < 0.45) continue;
    const by = bedY(env, x) + 10, L = 120 + 160 * h;
    for (let j = 0; j < 3; j++) {
      const sw = 26 * Math.sin(t * 1.1 + x * 0.01 + j), xx = x + (j - 1) * 18;
      limb([[xx, by], [xx + sw * 0.4, by - L * 0.4], [xx + sw, by - L * 0.8], [xx + sw * 1.2, by - L]], 14 - j * 3, WEED);
    }
  }
  fill(polyPath([...pts, [x1 + 80, y1 + 200], [x0 - 80, y1 + 200]]), SAND);
  limb(pts, 16, SAND_HI, false);
  for (let x = Math.floor(x0 / 230) * 230; x < x1 + 230; x += 230) {
    const h = hash(x * 0.71 + 3);
    if (h < 0.5) continue;
    const r = 30 + 60 * (h - 0.5) * 2, by = bedY(env, x) + r * 0.3;
    ell(x, by, r * 1.4, r, STONE); ell(x - r * 0.3, by - r * 0.35, r * 0.7, r * 0.35, STONE_HI);
  }
}
// a cloud of stirred-up silt at (x, y): k 0…1 grows it, a fades it
export function silt(t, x, y, k, a = 1) {
  if (k <= 0.01 || a <= 0.01) return;
  for (let i = 0; i < 14; i++) {
    const h1 = hash(i * 3.9 + x * 0.01), h2 = hash(i * 7.1 + y * 0.01), r = (60 + 90 * h1) * k;
    ell(x + (h1 - 0.5) * 900 * k, y - h2 * 160 * k, r * 1.4, r, rgba('#56688a', 0.45 * a * (1 - 0.4 * h2)));
  }
}
export function bubble(x, y, r, a = 1) {
  if (a <= 0.01) return;
  g.save(); g.globalAlpha *= a;
  g.lineWidth = Math.max(1.5, r * 0.22); g.strokeStyle = 'rgba(220,245,255,0.85)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  ell(x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.22, 'rgba(255,255,255,0.9)');
  g.restore();
}

// —— the submarine. Local units: bow to +x, centre at 0, hull 2000 long and 300 high. ——
export const SUBG = { L: 1000, R: 150, sail: [150, 470], sailTop: -420, hatch: [-130, -150], lamp: [962, -52], vents: [[860, 128], [-820, 112]] };
const HULL = [[1000, 0], [990, -62], [955, -110], [890, -140], [800, -150], [500, -150], [100, -150], [-300, -150], [-560, -146], [-760, -118], [-900, -74], [-985, -34],
  [-1000, 0], [-985, 34], [-900, 74], [-760, 118], [-560, 146], [-300, 150], [100, 150], [500, 150], [800, 150], [890, 140], [955, 110], [990, 62]];
export const hullPts = () => HULL;
const SAIL = [[140, -150], [158, -340], [190, -400], [250, -420], [450, -420], [474, -396], [486, -150]];
export const sailPts = () => SAIL;
const SC = { steel: '#5a6b84', steelHi: '#8195b0', steelSh: '#3f4c62', belly: '#7a3a35', bellySh: '#5e2b29', dark: '#1b2230', bronze: '#d6a640', bronzeSh: '#a87d2a' };
// st: { x, y, ang, s, lights 0…1, spin (screw angle), hatch 0…1 (lid open), flicker, noHatch }. Returns the lamp (world) and its beam angle.
export function drawSub(t, st) {
  const F = frame(st.x, st.y, st.ang ?? 0, st.s ?? 1), P = a => F.pts(a), s = F.s;
  // the lower rudder and the far stern plane, behind the hull
  fill(polyPath(P([[-690, 120], [-760, 300], [-840, 300], [-870, 80]])), SC.steelSh);
  // the screw: five bronze blades turning round the shaft
  const spin = st.spin ?? 0, hub = F.p([-1018, 0]);
  const blade = (i, front) => {
    const ph = spin + i * TAU / 5, c = Math.cos(ph), sn = Math.sin(ph);
    if ((sn > 0) !== front) return;
    const tip = F.p([-1018 + 22 * sn, 170 * c]), mid = F.p([-1018 + 14 * sn, 90 * c]);
    limb([hub, mid, tip], (16 + 30 * Math.abs(sn)) * s, front ? SC.bronze : SC.bronzeSh);
  };
  for (let i = 0; i < 5; i++) blade(i, false);
  // the hull
  const hull = smoothPath(P(HULL));
  fill(hull, SC.steel);
  inside(hull, () => {
    fill(polyPath(P([[-1100, 56], [1100, 56], [1100, 300], [-1100, 300]])), SC.belly);
    fill(polyPath(P([[-1100, 118], [1100, 118], [1100, 300], [-1100, 300]])), SC.bellySh);
    fill(polyPath(P([[-1100, -300], [1100, -300], [1100, -112], [-1100, -112]])), SC.steelHi);
    fill(polyPath(P([[-1100, 20], [1100, 20], [1100, 56], [-1100, 56]])), SC.steelSh);
    for (let x = -520; x <= 760; x += 70) { const p = F.p([x, 84]); ell(p[0], p[1], 16 * s, 7 * s, SC.dark, F.ang); }   // flood holes
    for (let x = -700; x <= 900; x += 200) limb(P([[x, -150], [x, 20]]), 3 * s, 'rgba(27,34,48,0.35)', false);      // plate seams
  });
  // the stern: upper rudder and the near stern plane
  fill(polyPath(P([[-690, -120], [-760, -300], [-840, -300], [-870, -80]])), SC.steel);
  fill(polyPath(P([[-690, -150], [-760, -300], [-790, -300], [-720, -140]])), SC.steelHi);
  fill(polyPath(P([[-700, -12], [-900, -20], [-930, 0], [-900, 20], [-700, 12]])), SC.steelSh);
  ell(hub[0], hub[1], 28 * s, 44 * s, SC.bronzeSh, F.ang);
  for (let i = 0; i < 5; i++) blade(i, true);
  const cone = F.p([-1040, 0]); ell(cone[0], cone[1], 18 * s, 22 * s, SC.bronze, F.ang);
  // the sail with its planes and masts
  const sail = smoothPath(P(SAIL));
  fill(sail, SC.steel);
  inside(sail, () => { fill(polyPath(P([[100, -460], [520, -460], [520, -384], [100, -384]])), SC.steelHi); fill(polyPath(P([[420, -460], [520, -460], [520, -100], [420, -100]])), SC.steelSh); });
  fill(polyPath(P([[240, -332], [90, -326], [74, -314], [240, -310]])), SC.steelSh);
  limb(P([[300, -420], [300, -560]]), 18 * s, SC.steelSh, false); limb(P([[300, -560], [324, -560]]), 22 * s, SC.steelSh, false);
  limb(P([[392, -420], [392, -520]]), 8 * s, SC.steelSh, false);
  // the escape hatch on the deck behind the sail
  if (!st.noHatch) {
    fill(polyPath(P([[-185, -148], [-172, -172], [-88, -172], [-75, -148]])), SC.steelSh);
    const hg = F.p([-88, -172]), open = clamp(st.hatch ?? 0), a = F.ang - open * 1.9;
    g.save(); g.translate(hg[0], hg[1]); g.rotate(a); rrect(-92 * s, -14 * s, 92 * s, 16 * s, 5 * s, SC.steelHi); g.restore();
    if (open > 0.05) { const m = F.p([-130, -172]); ell(m[0], m[1], 40 * s, 7 * s * open, SC.dark, F.ang); }
  }
  // lights: the searchlight on the bow, green and red on the sail, the masthead blinking
  const L = clamp(st.lights ?? 0) * (st.flicker ?? 1), lamp = F.p(SUBG.lamp);
  ell(lamp[0], lamp[1], 22 * s, 30 * s, SC.dark, F.ang);
  ell(lamp[0] + 4 * s, lamp[1], 15 * s, 22 * s, mix('#3a4152', '#fff4cc', L), F.ang);
  const gr = F.p([466, -300]), rd = F.p([300, -572]);
  ell(gr[0], gr[1], 9 * s, 9 * s, mix('#2a3a34', '#5dff9a', L));
  const blink = ((t * 1.1) % 1) < 0.5 ? 1 : 0.15;
  ell(rd[0], rd[1], 8 * s, 8 * s, mix('#3a2a2a', '#ff5a4d', L * blink));
  if (L > 0.02) {
    for (const [p, c, r] of [[gr, '#5dff9a', 34], [rd, '#ff5a4d', 30 * blink]]) ell(p[0], p[1], r * s, r * s, rgba(c, 0.25 * L));
  }
  return { lamp, beamAng: F.ang, F };
}
// the searchlight beam: a soft cone in front of the bow, specks lit inside it
export function beam(t, lamp, ang, s, k) {
  if (k <= 0.01) return;
  const len = 1500 * s, sp = 0.2, gr = g.createRadialGradient(lamp[0], lamp[1], 0, lamp[0], lamp[1], len);
  gr.addColorStop(0, rgba('#fff2c4', 0.45 * k)); gr.addColorStop(0.5, rgba('#fff2c4', 0.16 * k)); gr.addColorStop(1, rgba('#fff2c4', 0));
  g.fillStyle = gr; g.beginPath(); g.moveTo(lamp[0], lamp[1] - 18 * s);
  g.lineTo(lamp[0] + Math.cos(ang - sp) * len, lamp[1] + Math.sin(ang - sp) * len); g.lineTo(lamp[0] + Math.cos(ang + sp) * len, lamp[1] + Math.sin(ang + sp) * len);
  g.lineTo(lamp[0], lamp[1] + 18 * s); g.closePath(); g.fill();
  ell(lamp[0], lamp[1], 70 * s, 70 * s, rgba('#fff6d8', 0.35 * k));
}

// —— the rescue ship on the surface: orange hull, white superstructure, an A-frame at the stern with the hydrophone ——
// (x: its middle, env.surf: the waterline). Returns where the hydrophone hangs.
export function drawShip(t, x, env, s = 1, depth = 520) {
  const bob = 8 * Math.sin(t * 1.2), roll = 0.015 * Math.sin(t * 0.9), F = frame(x, env.surf + bob * s, roll, s), P = a => F.pts(a);
  // under the water: the red bottom
  fill(smoothPath(P([[-640, 0], [600, 0], [640, -20], [560, 90], [-560, 110], [-640, 60]])), '#6e2a22');
  fill(polyPath(P([[-650, -170], [560, -170], [690, -240], [640, 0], [-640, 0]])), '#e8562f');
  fill(polyPath(P([[-650, -170], [560, -170], [690, -240], [684, -214], [560, -146], [-650, -146]])), '#ffffff');
  fill(polyPath(P([[-640, -40], [640, -40], [640, 0], [-640, 0]])), '#b8401f');
  fill(polyPath(P([[-260, -170], [260, -170], [230, -330], [-200, -330]])), '#f4f4f0');
  fill(polyPath(P([[-90, -330], [220, -330], [190, -430], [-60, -430]])), '#f4f4f0');
  fill(polyPath(P([[-40, -400], [180, -400], [176, -376], [-36, -376]])), '#24324a');
  for (let i = 0; i < 6; i++) { const p = F.p([-200 + i * 70, -260]); ell(p[0], p[1], 14 * s, 14 * s, '#24324a'); }
  limb(P([[60, -430], [60, -600]]), 10 * s, '#d8d8d8', false); limb(P([[10, -560], [110, -560]]), 8 * s, '#d8d8d8', false);
  { const p = F.p([60, -610]); ell(p[0], p[1], 12 * s, 12 * s, '#ff5a4d'); }
  // the A-frame at the stern and the cable down
  limb(P([[-600, -170], [-700, -420], [-560, -420]]), 14 * s, '#f2b632', false);
  const top = F.p([-690, -420]), hp = [top[0] + 10 * Math.sin(t * 0.7), env.surf + depth * s];
  g.lineWidth = 4 * s; g.strokeStyle = '#222a38'; g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(top[0] - 30 * s, (top[1] + hp[1]) / 2, hp[0], hp[1]); g.stroke();
  rrect(hp[0] - 20 * s, hp[1], 40 * s, 90 * s, 14 * s, '#f2b632'); rect(hp[0] - 20 * s, hp[1] + 30 * s, 40 * s, 12 * s, '#222a38');
  return [hp[0], hp[1] + 45 * s];
}
// the swimmer's world: the escape hatch in the deck, life size, its lid swung open
export function hatchDeck(t, cam, x, y, open) {
  view(cam, 1);
  fill(polyPath([[x - 2400, y], [x + 2400, y], [x + 2400, y + 1600], [x - 2400, y + 1600]]), SC.steel);
  fill(polyPath([[x - 2400, y], [x + 2400, y], [x + 2400, y + 60], [x - 2400, y + 60]]), SC.steelHi);
  for (let i = -6; i <= 6; i++) limb([[x + i * 360, y + 60], [x + i * 360, y + 1600]], 6, 'rgba(27,34,48,0.35)', false);
  fill(polyPath([[x - 190, y + 4], [x - 160, y - 46], [x + 160, y - 46], [x + 190, y + 4]]), SC.steelSh);
  ell(x, y - 46, 150, 26, SC.dark);
  const a = -clamp(open) * 1.95, hg = [x + 150, y - 50];
  g.save(); g.translate(hg[0], hg[1]); g.rotate(a); rrect(-310, -20, 310, 34, 10, SC.steelHi); rect(-260, -30, 200, 12, SC.steelSh);
  g.lineWidth = 8; g.strokeStyle = '#c23b2f'; g.beginPath(); g.arc(-155, -34, 30, Math.PI, 0); g.stroke(); g.restore();
}
