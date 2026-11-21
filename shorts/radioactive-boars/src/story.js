// The places and people of «Цунами» in flat shapes, straight in screen space (y down, px at s = 1): the beach seen from
// the sand towards the sea (the sea pulls back, the wet sea floor with fish and rocks, the white line of the wave on the
// horizon), the same beach from the side (the sea on the left, the sand, palms, a concrete hotel), the hotel cut open
// (six floors, the stairs, balconies to the sea), the flood water with its foam front, the map card of the STOP, the
// tourists (seen from behind, walking to the sea, or from the front, walking away), the ten-year-old girl who points at
// the sea, the lesson she remembered (a blackboard in a thought bubble), umbrellas, towels and a beach bag left behind.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath, inside } from './flat.js';

export const HZ = 640;             // the horizon, looking out to sea
export const WS = 1180;            // where the sea normally meets the sand, looking out to sea
export const G = 1500;             // the ground in the side views
export const FH = 190;             // one floor of the hotel
const SKINS = ['#e0b08a', '#c98f66', '#f0c6a0', '#b97a52', '#d9a77f'];
const HAIRS = ['#3a2a1e', '#1e1a18', '#c9a05a', '#6a3a1e', '#2a2420'];
const SHIRTS = ['#ff6f59', '#3aa6cf', '#ffd23f', '#f2f2f2', '#7bc67b', '#c06cd0', '#ff9f43'];
const SHORTS = ['#2a4a7a', '#1d1f2a', '#e0e0e0', '#3a6a4a', '#8a4a2a'];

function grad(stops, y0 = 0, y1 = 1920, x0 = 0, x1 = 1080) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
export const persp = y => lerp(0.42, 0.1, clamp((WS + 320 - y) / (WS + 320 - HZ)));       // the size of a person standing at y

// —— a palm: a leaning trunk and a crown of fronds; (x, y) = the foot of the trunk ——
export function palm(x, y, s, t, lean = 0.2, gust = 0) {
  const top = [x + 380 * s * Math.sin(lean) + 30 * s * gust, y - 620 * s];
  const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([lerp(x, top[0], u) + 60 * s * Math.sin(u * 2.5) * lean, lerp(y, top[1], u)]); }
  limb(pts, 34 * s, '#8a6a46', true);
  for (let i = 1; i < 8; i++) limb([[pts[i][0] - 18 * s, pts[i][1]], [pts[i][0] + 18 * s, pts[i][1] + 6 * s]], 4 * s, '#6e5236', false);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.55 + 0.08 * Math.sin(t * 1.3 + k) + 0.35 * gust;
    const L = 260 * s * (k % 2 ? 0.9 : 1.05);
    const tip = [top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L * 0.55 + 120 * s];
    const mid = [top[0] + Math.cos(a) * L * 0.55, top[1] + Math.sin(a) * L * 0.5 - 20 * s];
    limb([top, mid, tip], 30 * s, k % 2 ? '#2f7a3a' : '#3f9a4a', true);
  }
  ell(top[0], top[1] + 6 * s, 26 * s, 22 * s, '#6e4a2a');
}

// —— the beach seen from the sand towards the sea ——
// o.wl: the waterline (y; WS = normal, smaller = the sea has pulled back), o.wave: 0…1 the wall of water on the horizon,
// o.froth: 0…1 bubbles along the waterline, o.dim: the light going grey, o.tint: a warm sepia over it (the 2004 story)
export function seaView(t, o = {}) {
  const wl = o.wl ?? WS, wave = o.wave ?? 0;
  grad([[0, '#6fbfe8'], [1, '#d6f1fa']], 0, HZ);
  ell(830, 230, 74, 74, '#fff4c4'); ell(830, 230, 110, 110, 'rgba(255,244,196,0.25)');
  for (let i = 0; i < 4; i++) { const cx = (i * 330 + t * 8) % 1400 - 160, cy = 120 + 90 * (i % 2); ell(cx, cy, 120, 34, 'rgba(255,255,255,0.8)'); ell(cx + 60, cy - 18, 70, 30, 'rgba(255,255,255,0.8)'); }
  // the sea from the horizon down to the waterline
  grad([[0, '#1f6f9a'], [1, '#4fb0d4']], HZ, wl + 2);
  for (let i = 0; i < 9; i++) { const y = lerp(HZ + 14, wl - 10, (i + 0.5) / 9); if (y > wl - 8) continue; const x = (i * 197 + t * (20 + i * 4)) % 1240 - 80; limb([[x, y], [x + 60 + i * 6, y]], 3 + i * 0.4, 'rgba(255,255,255,0.45)', false); }
  // the wave: a dark wall rising over the horizon with a white crest
  if (wave > 0.001) {
    const h = 420 * wave * wave, crest = HZ - h;
    const top = []; for (let i = 0; i <= 24; i++) { const x = -40 + i * 48; top.push([x, crest + 10 * Math.sin(i * 0.9 + t * 3) * wave]); }
    poly([...top, [1120, HZ + 30], [-40, HZ + 30]], '#174d6e');
    grad([[0, 'rgba(23,77,110,0)'], [1, 'rgba(10,40,60,0.55)']], crest, HZ + 30);
    limb(top, 16 + 18 * wave, '#f4fbff', true);
    for (let i = 0; i < 18; i++) ell(-20 + i * 64 + 10 * Math.sin(t * 4 + i), crest - 4 + 6 * Math.sin(t * 5 + i * 2), 24 * wave + 6, 12 * wave + 4, '#ffffff');
  }
  // the bare sea floor between the waterline and the usual line: wet grey sand, puddles, rocks, weed
  if (wl < WS - 2) {
    grad([[0, '#7f8270'], [1, '#a8986e']], wl, WS + 4);
    for (let i = 0; i < 14; i++) { const y = lerp(wl + 20, WS - 10, hash(i * 3.7)); if (y < wl + 10) continue; const k = persp(y) / 0.42; ell(1080 * hash(i * 1.3), y, 90 * k, 16 * k, 'rgba(90,150,170,0.55)'); }
    for (let i = 0; i < 10; i++) { const y = lerp(wl + 30, WS - 20, hash(i * 5.1 + 2)); if (y < wl + 14) continue; const k = persp(y) / 0.42; const x = 1080 * hash(i * 2.9 + 1); ell(x, y, 46 * k, 26 * k, '#5d5a52'); ell(x - 12 * k, y - 8 * k, 20 * k, 10 * k, '#77746a'); }
    for (let i = 0; i < 8; i++) { const y = lerp(wl + 24, WS - 16, hash(i * 7.3 + 4)); if (y < wl + 10) continue; const k = persp(y) / 0.42, x = 1080 * hash(i * 4.1 + 3); for (let j = -1; j <= 1; j++) limb([[x + j * 12 * k, y], [x + j * 22 * k + 8 * Math.sin(t * 2 + i), y - 40 * k]], 6 * k, '#4a6a3a', false); }
  }
  // the edge of the water: foam, and bubbles when the sea boils
  for (let i = 0; i < 7; i++) { const yy = wl - 4 + 4 * Math.sin(t * 2 + i); limb([[i * 180 - 40, yy], [i * 180 + 110, yy + 4]], 8, 'rgba(255,255,255,0.8)', false); }
  if ((o.froth ?? 0) > 0) for (let i = 0; i < 40; i++) { const ph = (t * 1.6 + hash(i * 1.7)) % 1; ell(1080 * hash(i * 2.3), wl - 10 - 40 * hash(i * 3.1), (4 + 10 * ph) * o.froth, (4 + 10 * ph) * o.froth, `rgba(255,255,255,${0.9 * (1 - ph) * o.froth})`); }
  // the dry sand
  grad([[0, '#f0d9a0'], [1, '#d9bd7c']], WS, 1920);
  limb([[-20, WS + 2], [1100, WS + 2]], 6, 'rgba(160,130,80,0.5)', false);
  for (let i = 0; i < 30; i++) ell(1080 * hash(i * 1.9), WS + 40 + 700 * hash(i * 2.7), 6, 3, 'rgba(150,120,70,0.5)');
  palm(-40, 1560, 1.1, t, 0.25, o.gust ?? 0); palm(1110, 1480, 0.95, t + 2, -0.3, o.gust ?? 0);
  if (o.dim) { g.fillStyle = `rgba(40,50,70,${0.35 * o.dim})`; g.fillRect(0, 0, 1080, 1920); }
  if (o.tint) { g.fillStyle = `rgba(150,110,60,${0.42 * o.tint})`; g.fillRect(0, 0, 1080, 1920); }
}

// —— a person in a few flat shapes; (x, y) = between the feet ——
// o: s, view ('back' | 'front' | 'side'), face (side: 1 right / -1 left), walk (0…1) + ph (cycles), seed (colours),
//    kid (smaller head and body proportions of a child), arm (side: the near hand to [x, y] in local units), mouth
export function person(o) {
  const s = o.s ?? 0.3, sd = o.seed ?? 0, view = o.view ?? 'back', face = o.face ?? 1, wk = clamp(o.walk ?? 0), ph = (o.ph ?? 0) * TAU;
  const skin = o.skin ?? SKINS[sd % SKINS.length], hair = o.hair ?? HAIRS[(sd * 3) % HAIRS.length];
  const shirt = o.shirt ?? SHIRTS[(sd * 5 + 1) % SHIRTS.length], shorts = o.shorts ?? SHORTS[(sd * 2) % SHORTS.length];
  g.save(); g.translate(o.x, o.y - wk * 8 * s * Math.abs(Math.sin(ph))); g.scale(s * (view === 'side' ? face : 1), s);
  const legW = 34, hipY = -240, sh = -470;
  if (view === 'side') {
    for (const i of [0, 1]) { const sw = wk * 70 * Math.sin(ph + i * Math.PI), lift = wk * 30 * Math.max(0, Math.sin(ph + i * Math.PI + 1.2));
      limb([[0, hipY], [sw * 0.4 + 10, -130 - lift * 0.5], [sw, -14 - lift]], legW, i ? shade(skin) : skin); ell(sw + 14, -10 - lift, 28, 12, i ? '#3a3a40' : '#4a4a52'); }
    const far = [-30 - 50 * wk * Math.sin(ph), -280];
    limb([[0, sh + 20], [lerp(0, far[0], 0.5) - 6, -360], far], 26, shade(skin));
  } else {
    for (const i of [0, 1]) { const sx = i ? 30 : -30, lift = wk * 26 * Math.max(0, Math.sin(ph + i * Math.PI));
      limb([[sx * 0.7, hipY], [sx, -130 - lift * 0.4], [sx, -18 - lift]], legW, skin); ell(sx, -12 - lift, 24, 12, '#4a4a52'); }
  }
  if (o.dress) fill(smoothPath([[-70, -200], [-50, -330], [-56, -470], [56, -470], [50, -330], [70, -200]]), shirt);
  else {
    fill(smoothPath([[-62, -200], [-68, -260], [-58, -300], [58, -300], [68, -260], [62, -200]]), shorts);
    fill(smoothPath([[-64, -280], [-74, -380], [-60, -480], [60, -480], [74, -380], [64, -280]]), shirt);
  }
  if (view !== 'side') {
    const sw = wk * 30 * Math.sin(ph);
    limb([[-64, -460], [-80, -370], [-76 + sw, -290]], 26, skin); limb([[64, -460], [80, -370], [76 - sw, -290]], 26, skin);
  } else {
    const near = o.arm ?? [40 + 50 * wk * Math.sin(ph), -280];
    limb([[0, sh + 20], [lerp(0, near[0], 0.5) + 10, lerp(sh + 20, near[1], 0.5) + 10], near], 26, skin); ell(near[0], near[1], 14, 14, skin);
  }
  limb([[0, -480], [0, -520]], 30, skin, false);
  ell(0, -570, 56, 60, skin);
  if (view === 'back') fill(smoothPath([[-58, -560], [-60, -610], [-30, -634], [30, -634], [60, -610], [58, -560], [40, -530], [-40, -530]]), hair);
  else if (view === 'front') { fill(smoothPath([[-58, -570], [-60, -612], [-28, -636], [28, -636], [60, -612], [58, -570], [36, -598], [-36, -598]]), hair);
    ell(-20, -572, 6, 8, '#17162f'); ell(20, -572, 6, 8, '#17162f'); limb([[-12, -540], [0, -536], [12, -540]], 4, '#6a3a2a', false); }
  else { fill(smoothPath([[-56, -566], [-58, -612], [-20, -636], [30, -630], [52, -606], [10, -600], [-10, -580], [-30, -540]]), hair);
    ell(26, -574, 6, 8, '#17162f');
    if (o.mouth) ell(36, -536, 9, 8 * o.mouth, '#6a2a2a'); else limb([[22, -540], [36, -538]], 4, '#6a3a2a', false); }
  if (o.pony) { limb([[-50, -600], [-96, -590], [-110 + 10 * Math.sin(ph * 2), -530]], 26, hair); ell(-52, -600, 14, 12, o.bow ?? '#ff4d6d'); }
  if (o.hat) { ell(0, -616, 90, 18, o.hat); ell(0, -628, 52, 30, o.hat); }
  g.restore();
}
const shade = c => { const n = parseInt(c.slice(1), 16), k = 0.82; return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`; };

// —— things left on the sand ——
export function umbrella(x, y, s, ang = 0, c = '#ff6f59') {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  limb([[0, 0], [0, -300]], 10, '#e8e2d4', false);
  const cap = [[-170, -280], [-120, -340], [0, -372], [120, -340], [170, -280]];
  fill(smoothPath([...cap, [100, -290], [0, -300], [-100, -290]]), c);
  for (const sx of [-60, 60]) fill(smoothPath([[sx - 30, -292], [sx - 18, -350], [sx + 18, -352], [sx + 30, -292]]), '#fff3d6');
  g.restore();
}
export function towel(x, y, s, c = '#3aa6cf') { g.save(); g.translate(x, y); g.scale(s, s); fill(rrPath(-120, -24, 240, 48, 10), c); for (let i = 0; i < 4; i++) rect(-120 + 30 + i * 52, -24, 18, 48, 'rgba(255,255,255,0.7)'); g.restore(); }
export function bag(x, y, s, c = '#ffd23f') { g.save(); g.translate(x, y); g.scale(s, s); limb([[-36, -70], [0, -120], [36, -70]], 8, '#8a6a46', true); fill(smoothPath([[-60, 0], [-56, -78], [56, -78], [60, 0]]), c); rect(-56, -50, 112, 12, 'rgba(0,0,0,0.12)'); g.restore(); }

// —— the beach from the side: the sea on the left (its edge at o.sea), the sand, palms ——
export function sideBeach(t, o = {}) {
  const sea = o.sea ?? 260;
  grad([[0, '#6fbfe8'], [1, '#d6f1fa']], 0, 1100);
  ell(860, 260, 64, 64, '#fff4c4');
  for (let i = 0; i < 3; i++) { const cx = (i * 410 + t * 10) % 1400 - 160, cy = 150 + 120 * (i % 2); ell(cx, cy, 110, 30, 'rgba(255,255,255,0.8)'); ell(cx + 50, cy - 16, 60, 26, 'rgba(255,255,255,0.8)'); }
  // the far sea behind, a band low over the left half; the wave on it
  grad([[0, '#1f6f9a'], [1, '#3a96c0']], 1040, 1100, 0, 1080);
  if ((o.wave ?? 0) > 0.001) { const h = 200 * o.wave, xs = []; for (let i = 0; i <= 24; i++) xs.push([-40 + i * 48, 1040 - h * clamp(1.3 - i / 18) + 6 * Math.sin(t * 3 + i)]);
    poly([...xs, [1120, 1100], [-40, 1100]], '#174d6e'); limb(xs.filter(p => p[1] < 1036), 14, '#f4fbff', true); }
  for (let k = 0; k < 4; k++) palm(560 + k * 190 + 40 * hash(k), 1110, 0.42 + 0.05 * hash(k * 3), t + k, -0.15 + 0.3 * hash(k * 5), o.gust ?? 0);
  grad([[0, '#ead09a'], [1, '#e2c58a']], 1100, G);
  grad([[0, '#f0d9a0'], [1, '#d4b676']], G, 1920);
  // the near sea on the left
  if (sea > 0) {
    const pts = [[-20, 1100]]; for (let i = 0; i <= 10; i++) { const y = lerp(1100, 1920, i / 10); pts.push([sea * lerp(0.6, 1.1, i / 10) + 14 * Math.sin(t * 2 + i), y]); } pts.push([-20, 1920]);
    poly(pts, '#2f8fbf'); limb(pts.slice(1, -1), 12, 'rgba(255,255,255,0.8)', true);
  }
}

// —— the hotel cut open: six floors of grey concrete, slabs, the stairs at the back, balconies to the sea (left) ——
// o.x0, o.x1, o.floors; o.safe: 0…1 the floors from the 4th up glow green; o.lab: floor numbers on the left
export function hotel(t, o = {}) {
  const x0 = o.x0 ?? 520, x1 = o.x1 ?? 1000, n = o.floors ?? 6, top = G - n * FH;
  rect(x0 + 18, top - 30, x1 - x0, n * FH + 30, 'rgba(0,0,0,0.25)');
  rect(x0, top - 30, x1 - x0, n * FH + 30, '#cfc8ba');
  rect(x0 + 24, top, x1 - x0 - 48, n * FH, '#efe6d2');                          // the inside, cut open
  for (let k = 0; k < n; k++) {
    const fy = G - k * FH;                                                        // floor k + 1 stands on fy
    if ((o.safe ?? 0) > 0 && k >= 3) { g.fillStyle = `rgba(61,214,140,${0.22 * o.safe})`; g.fillRect(x0 + 24, fy - FH, x1 - x0 - 48, FH); }
    rect(x0, fy - 14, x1 - x0, 14, '#9d968a');                                    // the slab
    rect(x1 - 210, fy - FH + 30, 150, FH - 44, '#d8cdb4');                         // the stairwell
    limb([[x1 - 200, fy - 16], [x1 - 70, fy - FH + 2]], 12, '#8a8274', false);
    for (let j = 0; j < 8; j++) rect(x1 - 200 + j * 16, fy - 18 - j * 22, 24, 6, '#8a8274');
    rect(x0 + 60, fy - FH + 34, 120, 70, '#9fd3ea'); rect(x0 + 200, fy - FH + 34, 120, 70, '#9fd3ea');      // windows to the sea
    rect(x0 + 116, fy - FH + 34, 8, 70, '#cfc8ba'); rect(x0 + 256, fy - FH + 34, 8, 70, '#cfc8ba');
    if (k > 0) { rect(x0 - 60, fy - 14, 60, 12, '#9d968a'); for (let j = 0; j < 4; j++) rect(x0 - 56 + j * 18, fy - 60, 5, 46, '#7a7468'); limb([[x0 - 60, fy - 60], [x0, fy - 60]], 6, '#7a7468', false); }
    if (o.lab !== false) { ell(x0 + 40, fy - FH / 2, 24, 24, k >= 3 && (o.safe ?? 0) > 0.5 ? '#2f8f4e' : 'rgba(23,22,47,0.75)');
      g.fillStyle = '#ffffff'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.fillText(String(k + 1), x0 + 40, fy - FH / 2 + 11); }
  }
  rect(x0 - 10, top - 40, x1 - x0 + 20, 20, '#9d968a');
}

// —— the flood seen from the side: water from the left edge to the front x, its surface at level (y) ——
export function flood(t, front, level, o = {}) {
  if (front < -60) return;
  const pts = [[-40, 1960]];
  for (let i = 0; i <= 20; i++) { const x = lerp(-40, front, i / 20), u = i / 20; pts.push([x, level + 10 * Math.sin(t * 3 + i * 0.8) - (o.surge ?? 0) * 60 * Math.pow(u, 3)]); }
  const tipY = level - (o.surge ?? 0) * 70;
  pts.push([front + 40, tipY + 30], [front + 70, 1960]);
  poly(pts, o.color ?? '#2a6f92', 0.95);
  inside(polyPath(pts), () => { grad([[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(0,30,50,0.4)']], level - 80, 1920); for (let i = 0; i < 12; i++) { const x = (i * 140 + t * 90) % (front + 200) - 100; limb([[x, level + 40 + 30 * (i % 4)], [x + 70, level + 46 + 30 * (i % 4)]], 6, 'rgba(255,255,255,0.35)', false); } });
  limb(pts.slice(1, -2), 12, 'rgba(255,255,255,0.85)', true);
  for (let i = 0; i < 9; i++) ell(front + 10 - 30 * hash(i) + 10 * Math.sin(t * 6 + i), tipY + 20 + 120 * hash(i * 2.3), 26 + 14 * hash(i * 3), 20, '#ffffff', 0, 0.9);
}

// —— the STOP map, seen from above: the sea at the top with the wave coming, the beach strip, the hotel, where you are ——
// k: the pop-in scale; o.arrows: 0…1 how far the two routes are drawn; o.answer: 0…1 route 1 crossed out, route 2 green
export function mapCard(t, k, o = {}) {
  if (k <= 0.01) return;
  g.save(); g.translate(540, 760); g.scale(k, k); g.rotate(-0.02);
  const w = 860, h = 640;
  rrect(-w / 2 + 10, -h / 2 + 12, w, h, 32, 'rgba(0,0,0,0.5)');
  g.save(); g.clip(rrPath(-w / 2, -h / 2, w, h, 32));
  rect(-w / 2, -h / 2, w, h, '#b9d98f');                                   // land
  rect(-w / 2, -h / 2, w, 200, '#2f8fbf');                                 // the sea
  for (let i = 0; i < 8; i++) limb([[-w / 2 + 40 + i * 110 + 20 * Math.sin(t * 2 + i), -h / 2 + 60 + 40 * (i % 3)], [-w / 2 + 90 + i * 110 + 20 * Math.sin(t * 2 + i), -h / 2 + 60 + 40 * (i % 3)]], 5, 'rgba(255,255,255,0.5)', false);
  const wy = -h / 2 + 10 + 60 * (o.wave ?? 0);
  limb([[-w / 2, wy], [w / 2, wy + 10]], 22, '#f4fbff', false); limb([[-w / 2, wy + 18], [w / 2, wy + 28]], 12, '#174d6e', false);
  rect(-w / 2, -h / 2 + 200, w, 150, '#f0d9a0');                          // the beach
  for (let i = 0; i < 6; i++) { const x = -w / 2 + 70 + i * 150; ell(x, -h / 2 + 260, 26, 26, i % 2 ? '#ff6f59' : '#3aa6cf'); }
  rect(-w / 2, -h / 2 + 350, w, 40, '#9a9a96');                           // the road
  rrect(150, -h / 2 + 400, 240, 190, 14, '#7d7a74'); rrect(162, -h / 2 + 412, 216, 166, 10, '#cfc8ba');      // the hotel from above
  g.fillStyle = '#3a3a44'; g.font = '700 40px Oswald'; g.textAlign = 'center'; g.fillText('ОТЕЛЬ', 270, -h / 2 + 510);
  for (let i = 0; i < 5; i++) { const x = -w / 2 + 60 + i * 80; ell(x, h / 2 - 60, 34, 34, '#5a9a4a'); }
  g.restore();
  // you
  const me = [-160, -h / 2 + 290];
  ell(me[0], me[1], 30, 30, '#ff4d4d'); ell(me[0], me[1], 14, 14, '#ffffff');
  const a1 = clamp(o.arrows ?? 0), a2 = clamp((o.arrows2 ?? 0)), ans = clamp(o.answer ?? 0);
  const arrow = (pts, u, c, num) => {
    if (u <= 0.01) return;
    const n = pts.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), r = f - i, tip = [lerp(pts[i][0], pts[i + 1][0], r), lerp(pts[i][1], pts[i + 1][1], r)];
    const path = [...pts.slice(0, i + 1), tip];
    g.save(); g.setLineDash([26, 16]); limb(path, 14, c, false); g.restore();
    const p = pts[i + 1], q = pts[i], ang = Math.atan2(p[1] - q[1], p[0] - q[0]);
    g.save(); g.translate(tip[0], tip[1]); g.rotate(ang); poly([[18, 0], [-22, -22], [-22, 22]], c); g.restore();
    const lab = path[Math.max(0, path.length - 2)];
    ell(lab[0] + (num === '1' ? 0 : 40), lab[1] - 44, 34, 34, c); g.fillStyle = '#ffffff'; g.font = '700 46px Russo'; g.textAlign = 'center'; g.fillText(num, lab[0] + (num === '1' ? 0 : 40), lab[1] - 28);
  };
  arrow([me, [80, -h / 2 + 290], [360, -h / 2 + 290]], a1, ans > 0.5 ? '#d62828' : '#ffd23f', '1');
  arrow([me, [-160, -h / 2 + 470], [150, -h / 2 + 490]], a2, ans > 0.5 ? '#2f8f4e' : '#ffd23f', '2');
  g.restore();
}

// —— the lesson she remembered: a thought bubble with a blackboard (the sea goes out, then the wave comes) ——
export function lessonBubble(x, y, k, t) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  ell(150, 250, 18, 18, '#ffffff'); ell(110, 200, 26, 26, '#ffffff');
  fill(smoothPath([[-280, 60], [-300, -60], [-200, -170], [0, -190], [200, -170], [300, -60], [280, 60], [180, 150], [0, 170], [-180, 150]]), '#ffffff');
  rrect(-230, -130, 460, 250, 14, '#8a6a46'); rrect(-216, -116, 432, 222, 8, '#2f5a46');
  const c = 'rgba(255,255,255,0.9)';
  limb([[-190, 40], [-60, 40], [-20, 70], [190, 70]], 5, c, false);                     // the shore line
  limb([[-180, 10], [-90, 10]], 5, c, false); poly([[-196, 10], [-172, -2], [-172, 22]], c);       // the sea goes out ←
  const wv = [[30, 60], [60, -20], [110, -60], [160, -40], [130, -20], [110, 10], [190, 60]];
  limb(wv, 6, c, true);
  g.fillStyle = c; g.font = '700 34px Oswald'; g.textAlign = 'center'; g.fillText('ЦУНАМИ', 0, -66);
  g.restore();
}

// —— things afloat on the flood: an umbrella, a sun lounger, palm fronds, a ball; bobbing on the surface at level ——
export function debris(t, front, level, k = 1) {
  const items = [[120, 'umb'], [300, 'frond'], [430, 'chair'], [640, 'ball'], [820, 'frond'], [960, 'umb2']];
  for (const [x0, kind] of items) {
    const x = x0 + 60 * Math.sin(t * 0.7 + x0) + 40 * t % 1;
    if (x > front - 40) continue;
    const y = level + 6 * Math.sin(t * 2.2 + x0 * 0.01), a = 0.25 * Math.sin(t * 1.7 + x0);
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    if (kind === 'umb' || kind === 'umb2') { limb([[-80, -10], [80, 20]], 8, '#e8e2d4', false); fill(smoothPath([[60, -60], [110, -20], [100, 40], [70, 30], [64, -10]]), kind === 'umb' ? '#ff6f59' : '#3aa6cf'); }
    else if (kind === 'frond') { limb([[-90, 0], [0, -8], [90, 0]], 8, '#2f7a3a', true); for (let i = -4; i <= 4; i++) limb([[i * 20, -6], [i * 20 + 12, -40]], 6, '#3f9a4a', false); }
    else if (kind === 'chair') { rrect(-80, -18, 160, 24, 6, '#f2f2f2'); for (let i = 0; i < 5; i++) rect(-76 + i * 32, -14, 14, 16, '#3aa6cf'); }
    else { ell(0, -16, 26, 26, '#ffffff'); ell(-8, -22, 10, 10, '#ff4d4d'); ell(10, -8, 8, 8, '#3aa6cf'); }
    g.restore();
  }
}
