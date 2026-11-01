// The outside world in flat shapes: a dusk sky with a low sun and layered clouds, the ground (a cemetery on a hill, the
// forest, the field and a small airfield's runway), and the airliner of «ПУРГА» airlines with its doors, gear and slide.
// World units: the ground is at y = 0, up is negative. The plane is drawn in its own units (100 = 1 m), nose to +x,
// origin on the ground under the main gear, so a parked plane stands at (x, 0) with s = 1.
import { lerp, clamp, ease, hash, noise, TAU, rgba, mix } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, frame, sample } from './flat.js';
import { view, toScreen, scaleOf, extent } from './camera.js';

export const SKY = {
  top: '#26285a', mid: '#8a3f7c', low: '#e0607a', hor: '#ffa45c', sun: '#ffe08a', sunHalo: '#ffc06e',
  cloud: '#f7c3cf', cloudSh: '#d98fae', cloudFar: '#c77a9e',
  hill: '#3a3f6e', hillFar: '#55528a', forest: '#24434a', forestFar: '#3b5868', grass: '#5d8a3e', grassSh: '#4a7232', dirt: '#6b4a3a', dirtSh: '#523628',
  stone: '#9aa3b5', stoneSh: '#78819a', asphalt: '#3a3d4a', asphaltSh: '#2e3140', mark: '#f4f1ea', smoke: '#e9e4ef',
};
export const PL = {
  body: '#f7f8fb', bodySh: '#d5dbe6', belly: '#c3cad8', stripe: '#f2782f', stripe2: '#ffd23f', tail: '#f2782f', tailSh: '#d0612a',
  glass: '#1f2b4d', glassHi: '#7fa6e0', win: '#2b3a5c', door: '#bfc7d6', engine: '#e3e8f0', engineSh: '#a7b1c4', intake: '#24232f',
  gear: '#4a5163', tire: '#1d1c26', wing: '#c9d1df', wingSh: '#98a3b8', nav: '#ff3b3b', navG: '#3ddc84', strobe: '#ffffff',
  slide: '#ffd23f', slideSh: '#e0a91f',
};

// —— the sky over the whole screen: a gradient that follows the camera's height a little, the sun and its halo ——
export function sky(t, cam, o = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const hz = toScreen(cam, [0, o.horizon ?? -200], 0.12)[1];
  const gr = g.createLinearGradient(0, hz - 2400, 0, hz);
  gr.addColorStop(0, SKY.top); gr.addColorStop(0.45, SKY.mid); gr.addColorStop(0.78, SKY.low); gr.addColorStop(1, SKY.hor);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const sp = toScreen(cam, o.sun ?? [600, -700], 0.12), r = (o.sunR ?? 150);
  const hg = g.createRadialGradient(sp[0], sp[1], r * 0.6, sp[0], sp[1], r * 3.2);
  hg.addColorStop(0, rgba(SKY.sunHalo, 0.55)); hg.addColorStop(1, rgba(SKY.sunHalo, 0));
  g.fillStyle = hg; g.beginPath(); g.arc(sp[0], sp[1], r * 3.2, 0, TAU); g.fill();
  ell(sp[0], sp[1], r, r, SKY.sun);
}

// one flat cloud: a row of round puffs over a flat base, a shade tone along the bottom
export function cloud(x, y, w, s, c = SKY.cloud, sh = SKY.cloudSh) {
  const n = Math.max(3, Math.round(w / 90)), pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, px = x - w / 2 + u * w, r = (50 + 60 * Math.sin(Math.PI * u) + 24 * hash(i * 3.1 + x)) * s;
    for (let k = 0; k <= 6; k++) { const a = Math.PI + (k / 6) * Math.PI; pts.push([px + Math.cos(a) * r * 0.9, y + Math.sin(a) * r]); }
  }
  const base = [[x + w / 2 + 40 * s, y], [x + w / 2 + 20 * s, y + 30 * s], [x - w / 2 - 20 * s, y + 30 * s], [x - w / 2 - 40 * s, y]];
  const p = smoothPath([...pts, ...base]);
  fill(p, c);
  inside(p, () => rect(x - w, y - 6 * s, w * 2, 80 * s, sh));
}
// cloud layers drifting at their own depth: [f, y, size, colour]; drift = how fast they slide past (world units/s)
export function clouds(t, cam, layers, drift = 0) {
  for (const [f, y, sz, c, sh, seed] of layers) {
    view(cam, f);
    const [x0, , x1] = extent(cam, f), step = 900 * sz;
    const off = (t * drift * f) % step;
    for (let i = Math.floor((x0 - step + off) / step); i <= Math.ceil((x1 + step + off) / step); i++) {
      const h = hash(i * 7.3 + (seed ?? 0)), x = i * step - off + h * step * 0.4;
      if (h < 0.25) continue;
      cloud(x, y + (hash(i * 3.7 + 1) - 0.5) * 160 * sz, (500 + 500 * h) * sz, sz, c ?? SKY.cloud, sh ?? SKY.cloudSh);
    }
  }
}

// —— the ground: far hills, the forest line, the field; band = how far the ground goes down on screen ——
export function hills(t, cam, f, y, c, amp = 120, seed = 0) {
  view(cam, f);
  const [x0, , x1, y1] = extent(cam, f), pts = [];
  for (let x = Math.floor(x0 / 80) * 80 - 80; x <= x1 + 80; x += 80) pts.push([x, y - amp * (0.5 + 0.5 * noise(x * 0.0012, seed)) - amp * 0.4 * noise(x * 0.004, seed + 3)]);
  pts.push([x1 + 80, Math.max(y1, y) + 400], [x0 - 80, Math.max(y1, y) + 400]);
  fill(polyPath(pts), c);
}
// a row of flat fir trees along y (their feet); every tree a stack of three triangles on a short trunk
export function trees(t, cam, f, y, c, h = 260, gap = 120, seed = 0, sway = 0) {
  view(cam, f);
  const [x0, , x1] = extent(cam, f);
  for (let i = Math.floor(x0 / gap) - 1; i <= Math.ceil(x1 / gap) + 1; i++) {
    const r = hash(i * 1.93 + seed), x = i * gap + (r - 0.5) * gap * 0.6, th = h * (0.7 + 0.5 * r), tw = th * 0.42;
    const sw = sway * Math.sin(t * 1.3 + i) * 0.04 * th;
    rect(x - th * 0.03, y - th * 0.18, th * 0.06, th * 0.2, mix(c, '#000000', 0.25));
    for (let k = 0; k < 3; k++) { const by = y - th * (0.12 + 0.27 * k), w = tw * (1 - 0.22 * k); poly([[x - w / 2, by], [x + sw * (k + 1) / 3, by - th * 0.42], [x + w / 2, by]], c); }
  }
}
// the field and the runway of the airfield: a long grey strip with a white centre line, thresholds and edge lights
export const RWY = { x0: -6000, x1: 6000, near: 260, far: -40 };
export function runway(t, cam, o = {}) {
  view(cam, 1);
  const [x0, , x1, y1] = extent(cam, 1);
  rect(x0 - 100, 0, x1 - x0 + 200, Math.max(1200, y1 + 100), SKY.grass);
  for (let i = Math.floor(x0 / 300) - 1; i < x1 / 300 + 1; i++) rect(i * 300 + 60 * hash(i), 330 + 40 * hash(i * 2.1), 120 + 80 * hash(i * 3.3), 14, SKY.grassSh);
  rect(Math.max(x0, RWY.x0), RWY.far, Math.min(x1, RWY.x1) - Math.max(x0, RWY.x0), RWY.near - RWY.far, SKY.asphalt);
  rect(Math.max(x0, RWY.x0), RWY.far, Math.min(x1, RWY.x1) - Math.max(x0, RWY.x0), 26, SKY.asphaltSh);
  for (let i = Math.floor(x0 / 400); i < x1 / 400 + 1; i++) if (i * 400 > RWY.x0 && i * 400 < RWY.x1 - 200) rect(i * 400, 104, 200, 14, SKY.mark);
  for (const x of [RWY.x0 + 200, RWY.x1 - 600]) for (let k = 0; k < 6; k++) rect(x + k * 60, 20 + k * 0, 34, RWY.near - RWY.far - 80, SKY.mark);
  for (let i = Math.floor(x0 / 600); i < x1 / 600 + 1; i++) { const x = i * 600; if (x < RWY.x0 || x > RWY.x1) continue; ell(x, RWY.near + 6, 10, 7, '#ffe7a8'); ell(x, RWY.far + 4, 7, 5, '#ffe7a8'); }
}

// —— the cemetery: a hill of crosses and headstones; graves(t) open where the dead climb out ——
export const GRAVES = [-520, -180, 170, 470];
export function cemetery(t, cam, rise) {
  view(cam, 1);
  const [x0, , x1, y1] = extent(cam, 1);
  rect(x0 - 100, 0, x1 - x0 + 200, Math.max(1600, y1 + 100), SKY.grass);
  // a low fence and stones behind, on the slope
  for (let i = Math.floor(x0 / 70) - 1; i < x1 / 70 + 1; i++) { const x = i * 70; rect(x - 5, -120, 10, 120, '#2b2a3f'); }
  rect(x0 - 100, -100, x1 - x0 + 200, 10, '#2b2a3f'); rect(x0 - 100, -50, x1 - x0 + 200, 10, '#2b2a3f');
  for (const [x, k] of [[-760, 0], [-330, 1], [10, 0], [330, 2], [640, 1], [880, 0]]) stone(x, -10, 0.8, k);
  // the graves in front: a mound of earth and a stone; the earth bursts open with rise[i]
  GRAVES.forEach((x, i) => {
    const k = clamp(rise?.[i] ?? 0);
    stone(x + 80, 230, 1.1, i % 3);
    const m = smoothPath([[x - 200, 300], [x - 160, 250], [x, 236 - 30 * k], [x + 160, 250], [x + 200, 300]]);
    fill(m, SKY.dirt); inside(m, () => rect(x - 220, 280, 440, 40, SKY.dirtSh));
    if (k > 0) for (let j = 0; j < 7; j++) { const a = -Math.PI * (0.15 + 0.7 * hash(i * 9 + j)), r = 60 + 140 * k * hash(j * 3.1 + i); ell(x + Math.cos(a) * r, 250 + Math.sin(a) * r * 0.7 + 60 * k * k, 16, 12, SKY.dirtSh); }
  });
}
function stone(x, y, s, kind) {
  if (kind === 0) { fill(rrPath(x - 60 * s, y - 170 * s, 120 * s, 170 * s, 60 * s), SKY.stoneSh); fill(rrPath(x - 52 * s, y - 166 * s, 104 * s, 166 * s, 52 * s), SKY.stone); limb([[x - 26 * s, y - 110 * s], [x + 26 * s, y - 110 * s]], 8 * s, SKY.stoneSh, false); limb([[x - 26 * s, y - 84 * s], [x + 20 * s, y - 84 * s]], 8 * s, SKY.stoneSh, false); }
  else if (kind === 1) { rect(x - 14 * s, y - 220 * s, 28 * s, 220 * s, SKY.stoneSh); rect(x - 70 * s, y - 170 * s, 140 * s, 28 * s, SKY.stoneSh); rect(x - 10 * s, y - 216 * s, 20 * s, 216 * s, SKY.stone); rect(x - 66 * s, y - 166 * s, 132 * s, 20 * s, SKY.stone); }
  else { fill(polyPath([[x - 70 * s, y], [x - 64 * s, y - 120 * s], [x, y - 150 * s], [x + 64 * s, y - 120 * s], [x + 70 * s, y]]), SKY.stoneSh); fill(polyPath([[x - 62 * s, y], [x - 56 * s, y - 114 * s], [x, y - 140 * s], [x + 56 * s, y - 114 * s], [x + 62 * s, y]]), SKY.stone); }
}

// —— the airliner ——
// st: x, y (ground point under the main gear), ang, s, gear (0 up … 1 down), door (0 shut … 1 open, the front door),
//     slide (0 … 1 inflated, from the front door to the ground), spin (fan angle), t, lights (0…1), flaps (0…1), shake
// returns world points: cockpit window centre, front door sill, the slide's foot, the nose, the tail top
const FUS = (() => {
  const top = -590, bot = -190, pts = [];
  // nose: from the top of the cockpit round to the chin
  pts.push([-1700, top + 10], [-600, top], [1350, top], [1560, top + 20], [1700, top + 80], [1800, top + 170], [1850, top + 260], [1846, bot - 60], [1800, bot - 20], [1650, bot], [1200, bot]);
  // belly and the tail upsweep
  pts.push([-900, bot], [-1300, bot - 30], [-1600, bot - 130], [-1880, top + 90], [-1900, top + 40]);
  return pts;
})();
export const PLANE = { sx: 0.62, len: 3800, door1: [1380, -340], sill: -340, top: -590, bot: -190, cockpit: [1720, -470], wingRoot: [150, -290] };
export function drawPlane(t, st) {
  const F = frame(st.x, st.y, st.ang ?? 0, st.s ?? 1, 1, PLANE.sx);              // a cartoon airliner: the body squashed to 62 % of its length
  const s = F.s, P = F.p, gear = clamp(st.gear ?? 1), out = {};
  // far wing and far engine (shade tones), behind the body
  fill(polyPath(F.pts([[260, -330], [-140, -330], [-700, -420], [-760, -430], [-560, -400], [-120, -360]])), PL.wingSh);
  // far horizontal stabiliser
  fill(polyPath(F.pts([[-1450, -560], [-1700, -600], [-1850, -640], [-1800, -620], [-1640, -585], [-1500, -570]])), PL.wingSh);
  // the gear: struts and wheels, folding up into the belly
  if (gear > 0.02) {
    const g1 = lerp(-200, 0, gear), g2 = lerp(-200, 0, gear);
    limb(F.pts([[20, -300], [10, g1 - 45]]), 26 * s, PL.gear, false);
    for (const dx of [-30, 40]) { const w = P([dx, g1 - 45]); ell(w[0], w[1], 46 * s, 46 * s, PL.tire); ell(w[0], w[1], 20 * s, 20 * s, PL.gear); }
    limb(F.pts([[1520, -230], [1520, g2 - 36]]), 18 * s, PL.gear, false);
    const n = P([1520, g2 - 36]); ell(n[0], n[1], 36 * s, 36 * s, PL.tire); ell(n[0], n[1], 15 * s, 15 * s, PL.gear);
  }
  // the body
  const body = smoothPath(F.pts(FUS));
  fill(body, PL.body);
  inside(body, () => {
    fill(polyPath(F.pts([[-2000, -300], [2000, -300], [2000, 0], [-2000, 0]])), PL.bodySh);
    fill(polyPath(F.pts([[-2000, -240], [2000, -240], [2000, 0], [-2000, 0]])), PL.belly);
    // the cheat line: orange under the windows, a thin yellow one under it, sweeping up to the tail
    fill(polyPath(F.pts([[-1900, -470], [-1200, -400], [1500, -400], [1850, -360], [1850, -330], [1500, -370], [-1200, -370], [-1900, -430]])), PL.stripe);
    fill(polyPath(F.pts([[-1900, -420], [-1200, -362], [1500, -362], [1850, -322], [1850, -312], [1500, -352], [-1200, -352], [-1900, -408]])), PL.stripe2);
  });
  // windows
  for (let x = -1300; x < 1250; x += 70) { if (Math.abs(x - 1380) < 80 || Math.abs(x + 1460) < 80 || Math.abs(x - 40) < 40) continue; const w = P([x, -450]); fill(rrPath(w[0] - 13 * s, w[1] - 20 * s, 26 * s, 36 * s, 12 * s), PL.win); }
  // cockpit windows
  const cw = F.pts([[1590, -505], [1700, -505], [1780, -440], [1770, -420], [1600, -420]]);
  fill(polyPath(cw), PL.glass);
  inside(polyPath(cw), () => { limb(F.pts([[1640, -500], [1600, -420]]), 10 * s, PL.glassHi, false); limb(F.pts([[1690, -500], [1660, -420]]), 6 * s, PL.glassHi, false); });
  limb(F.pts([[1700, -505], [1690, -420]]), 10 * s, PL.body, false);
  out.cockpit = P([1700, -460]);
  // the front door and the rear door
  const door = st.door ?? 0;
  for (const [x, front] of [[1380, true], [-1460, false]]) {
    const d = front ? door : 0;
    const r = F.pts([[x - 46, -530], [x + 46, -530], [x + 46, -340], [x - 46, -340]]);
    if (d > 0.01) {
      fill(polyPath(r), '#2a2f3e');
      const k = 1 - 0.85 * d, dd = F.pts([[x - 46, -530], [x - 46 + 92 * k, -530], [x - 46 + 92 * k, -340], [x - 46, -340]]);
      fill(polyPath(dd), PL.door);
    } else {
      g.lineWidth = 4 * s; g.strokeStyle = PL.door; g.stroke(rrPath(r[0][0], r[0][1], r[1][0] - r[0][0], r[2][1] - r[0][1], 14 * s));
      const h = P([x + 20, -440]); limb([h, [h[0] + 14 * s, h[1]]], 6 * s, PL.door, false);
    }
  }
  out.door = P([1380, -340]); out.doorTop = P([1380, -530]);
  // «ПУРГА» on the body
  g.save(); const ta = P([300, -505]); g.translate(ta[0], ta[1]); g.rotate(F.ang); g.font = `${Math.round(110 * s)}px Russo`; g.textAlign = 'center'; g.fillStyle = '#24305a'; g.fillText('ПУРГА', 0, 0); g.restore();
  // the tail fin with the paw
  const fin = F.pts([[-1100, -585], [-1520, -1060], [-1760, -1080], [-1880, -1060], [-1850, -600]]);
  fill(polyPath(fin), PL.tail);
  inside(polyPath(fin), () => { fill(polyPath(F.pts([[-1500, -1100], [-1900, -1100], [-1900, -560], [-1700, -560]])), PL.tailSh); });
  paw(P([-1580, -830]), 110 * s, F.ang, '#ffffff');
  // near stabiliser
  fill(polyPath(F.pts([[-1400, -520], [-1640, -540], [-1880, -470], [-1820, -470], [-1600, -500], [-1440, -505]])), PL.wing);
  // the near wing: swept back and down towards us, flaps out on the approach
  const fl = clamp(st.flaps ?? 0);
  fill(polyPath(F.pts([[320, -290], [-160, -300], [-820, -160 - 30 * fl], [-900, -140 - 30 * fl], [-640, -180], [-60, -250]])), PL.wingSh);
  fill(polyPath(F.pts([[340, -300], [-120, -310], [-780, -190], [-860, -170], [-600, -205], [-40, -265]])), PL.wing);
  if (fl > 0.02) fill(polyPath(F.pts([[-120, -306], [-780, -188], [-800, -150 - 30 * fl], [-140, -270 - 20 * fl]])), PL.wingSh);
  limb(F.pts([[-860, -170], [-900, -230]]), 14 * s, PL.tail, false);              // winglet
  // the engine under the wing
  limb(F.pts([[120, -270], [120, -220]]), 50 * s, PL.engineSh, false);
  const en = F.pts([[520, -300], [-160, -290], [-240, -200], [-160, -110], [520, -100], [560, -200]]);
  fill(smoothPath(en), PL.engine);
  inside(smoothPath(en), () => { fill(polyPath(F.pts([[700, -170], [-300, -170], [-300, -60], [700, -60]])), PL.engineSh); rect(0, 0, 0, 0, PL.engineSh); fill(polyPath(F.pts([[300, -300], [360, -300], [360, -100], [300, -100]])), PL.stripe); });
  const ia = P([548, -200]); ell(ia[0], ia[1], 30 * s, 92 * s, PL.intake, F.ang);
  const sp = st.spin ?? 0;
  for (let i = 0; i < 4; i++) { const a = sp + i * TAU / 4, b = P([552, -200 + Math.sin(a) * 76]); limb([ia, b], 5 * s, '#4a5163', false); }
  ell(ia[0], ia[1], 9 * s, 14 * s, '#c7d0dc', F.ang);
  // lights: red beacon on the belly and the roof, a white strobe on the wing tip, landing light on the gear
  const L = st.lights ?? 1, bl = Math.sin((st.t ?? t) * 7) > 0.55 ? 1 : 0.15, sb = ((st.t ?? t) % 1.1) < 0.06 ? 1 : 0;
  if (L > 0) {
    for (const p of [P([0, -592]), P([0, -188])]) { ell(p[0], p[1], 10 * s, 10 * s, rgba(PL.nav, 0.4 + 0.6 * bl)); if (bl > 0.5) ell(p[0], p[1], 40 * s, 40 * s, rgba(PL.nav, 0.25)); }
    const wt = P([-880, -160]); ell(wt[0], wt[1], 8 * s, 8 * s, PL.navG); if (sb) ell(wt[0], wt[1], 70 * s, 70 * s, rgba(PL.strobe, 0.7));
  }
  // the slide: a yellow ramp from the front door's sill to the ground
  const sl = clamp(st.slide ?? 0);
  if (sl > 0.01) {
    const foot = [1380 + 780 * ease.out(sl), lerp(-300, 0, ease.out(sl))], c1 = [1380 + 60, -330];
    const sp2 = F.pts([[c1[0] - 50, c1[1] + 10], [c1[0] + 40, c1[1] - 30], [foot[0] + 80, foot[1] - 110], [foot[0] + 120, foot[1] - 10], [foot[0] - 40, foot[1]]]);
    fill(polyPath(sp2), PL.slide);
    limb([P([c1[0] - 20, c1[1] - 10]), P([foot[0] + 30, foot[1] - 50])], 22 * s, PL.slideSh, false);
    out.slideFoot = P(foot); out.slideTop = P(c1);
  }
  out.nose = P([1850, -390]); out.tailTop = P([-1700, -1080]); out.F = F;
  return out;
}
// a paw print: a pad and four toes
export function paw(p, r, ang, c) {
  g.save(); g.translate(p[0], p[1]); g.rotate(ang);
  ell(0, r * 0.25, r * 0.55, r * 0.45, c);
  for (const [x, y, k] of [[-0.62, -0.32, 0.22], [-0.22, -0.66, 0.24], [0.22, -0.66, 0.24], [0.62, -0.32, 0.22]]) ell(x * r, y * r, k * r, k * r * 1.2, c);
  g.restore();
}
// smoke puffs off the tyres at the touchdown
export function tyreSmoke(t, t0, pts, s = 1) {
  const age = t - t0;
  if (age < 0 || age > 1.6) return;
  for (const p of pts) for (let i = 0; i < 9; i++) {
    const u = clamp(age / 1.6), a = hash(i * 3.3 + p[0]), r = (30 + 140 * u) * s * (0.6 + 0.6 * a);
    ell(p[0] - (60 + 500 * u) * s * (0.4 + a), p[1] - (20 + 120 * u * a) * s, r, r * 0.8, rgba(SKY.smoke, 0.75 * (1 - u)));
  }
}
// motion lines behind something fast: a few white streaks
export function speedLines(t, cam, n = 14, a = 0.5, dir = -1) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < n; i++) {
    const y = H * hash(i * 2.7), u = (t * 2.2 + hash(i * 5.1)) % 1, x = dir < 0 ? W * (1.2 - 1.6 * u) : W * (-0.2 + 1.6 * u), l = 160 + 200 * hash(i);
    rect(x, y, l, 4, rgba('#ffffff', a * Math.sin(Math.PI * u)));
  }
}
