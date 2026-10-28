// The three blueprints of this episode, in the glowing-line language of scheme.js:
//  door(): the armoured cockpit door face on, its plates hatched, three bolts that shoot into the frame, the lock switch
//          ОТКР · НОРМ · ЗАКР drawn big under it and the crew keypad on the cabin side that answers ОТКАЗ;
//  map():  the land from above: a big city with its airport, people as dots that turn into the dead, the plane on its
//          route, then the forest and a small airfield the route bends to;
//  plane(): the parked airliner as a ghost, the front door opening and the slide unrolling, the dead walking up it.
import { lerp, clamp, ease, spring, hash, noise, TAU, rgba, mix } from './lib.js';
import { g, W, H, ell, limb, rect, rrect, poly, fill, smoothPath, polyPath, rrPath, inside, MONO } from './flat.js';
import { gline, grect } from './scheme.js';
import { label, icon, NIGHT } from './hud.js';
import { FONTS } from './type.js';
import { drawPlane, PLANE } from './sky.js';
import { zombie, shamble } from './zoms.js';

const hatch = (x, y, w, h, step, c, P) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); for (let k = -h; k < w; k += step) gline([[x + k, y + h], [x + k + h, y]], 2, c, P); g.restore(); };

// —— the door ——  st: { bolts 0…1, sw 0…1 (0.5 НОРМ → 1 ЗАКР), keys n typed, deny 0…1 }
export const DOORBP = { x: -300, y: -1180, w: 600, h: 1100, sw: [0, 240], pad: [-640, -820] };
export function door(t, P, st) {
  const { x, y, w, h } = DOORBP;
  // the frame and the door leaf
  grect(x - 50, y - 50, w + 100, h + 50, 4, P.faint, P);
  grect(x, y, w, h, 6, P.line, P);
  // the plates, hatched: the armour
  for (const [py, ph] of [[y + 60, 300], [y + 420, 300], [y + 780, 260]]) { grect(x + 40, py, w - 80, ph, 3, P.hi, P); hatch(x + 40, py, w - 80, ph, 46, rgba(P.line, 0.55), P); }
  label('БРОНЯ', x + w / 2, y + 230, 64, P.text, { fam: FONTS.mono, shadow: false, stroke: false, a: 0.9 });
  // the hinges on the left, the handle on the right
  for (const hy of [y + 120, y + h - 160]) grect(x - 30, hy, 40, 90, 3, P.hi, P);
  gline([[x + w - 90, y + 560], [x + w - 30, y + 560]], 10, P.hi, P);
  // three bolts: inside the leaf, shooting out into the frame
  const b = clamp(st.bolts ?? 0);
  for (const by of [y + 130, y + 560, y + h - 120]) {
    const bx = x + w - 120 + 110 * ease.out(b);
    grect(bx, by - 18, 120, 36, 4, b > 0.5 ? P.ok : P.warm, P);
    if (b > 0.95) ell(bx + 130, by, 10, 10, P.ok);
  }
  // the lock switch, big, under the door
  const [sx, sy] = DOORBP.sw;
  grect(sx - 220, sy - 110, 440, 220, 4, P.line, P);
  gline([[sx - 150, sy + 20], [sx + 150, sy + 20]], 4, P.faint, P);
  const pos = clamp(st.sw ?? 0.5), kx = sx + lerp(-150, 150, pos);
  for (const [k, name] of [[0, 'ОТКР'], [0.5, 'НОРМ'], [1, 'ЗАКР']]) {
    const lx = sx + lerp(-150, 150, k), on = Math.abs(pos - k) < 0.12;
    label(name, lx, sy + 84, 40, on ? (k === 1 ? P.ok : '#ffffff') : P.text, { fam: FONTS.mono, shadow: false, stroke: false, a: on ? 1 : 0.6 });
    gline([[lx, sy + 8], [lx, sy + 30]], 3, P.faint, P);
  }
  gline([[sx, sy + 20], [kx, sy - 60]], 12, '#ffffff', P);
  ell(kx, sy - 64, 18, 18, '#ffffff');
  // the crew keypad, outside on the cabin side: keys light up as the code goes in, then ОТКАЗ
  const [px, py] = DOORBP.pad, n = st.keys ?? 0, deny = clamp(st.deny ?? 0);
  grect(px - 130, py - 200, 260, 400, 4, deny > 0.5 ? P.danger : P.line, P);
  rect(px - 100, py - 170, 200, 70, 'rgba(11,15,26,0.9)');
  const shown = deny > 0.5 ? 'ОТКАЗ' : '*'.repeat(Math.min(4, n));
  label(shown, px, py - 118, 44, deny > 0.5 ? P.danger : P.hi, { fam: FONTS.mono, shadow: false, stroke: false });
  const order = [1, 7, 4, 9];
  for (let i = 0; i < 9; i++) {
    const kx2 = px - 70 + (i % 3) * 70, ky = py - 50 + Math.floor(i / 3) * 70, lit = order.slice(0, n).includes(i + 1) && order[Math.min(n, 4) - 1] === i + 1;
    grect(kx2 - 26, ky - 26, 52, 52, 3, lit ? '#ffffff' : P.faint, P);
    label(String(i + 1), kx2, ky + 12, 32, lit ? '#ffffff' : P.text, { fam: FONTS.mono, shadow: false, stroke: false, a: 0.8 });
  }
  label('КОД ЭКИПАЖА', px, py + 260, 36, P.text, { fam: FONTS.mono, shadow: false, stroke: false });
  if (deny > 0) { g.save(); g.globalAlpha = deny; gline([[px - 140, py - 210], [px + 140, py + 210]], 10, P.danger, P); gline([[px + 140, py - 210], [px - 140, py + 210]], 10, P.danger, P); g.restore(); }
  // the wire from the keypad to the door: dashed, cut when the lock is on
  g.save(); g.setLineDash([18, 14]); g.lineDashOffset = -t * 60; gline([[px + 130, py], [x - 50, py]], 3, deny > 0.5 ? P.danger : P.faint, P); g.restore();
}

// —— the map ——  st: { plane [x, y, ang], route k 0…1 (to the city), bend 0…1 (to the airfield), people 0…1, dead 0…1, x 0…1 }
export const CITY = { x: 0, y: 0, r: 780 }, PORT = { x: 260, y: -160 }, FIELD = { x: 1550, y: -1750 };
export function map(t, P, st) {
  // rivers and roads
  gline([[-2600, 600], [-1200, 300], [-300, 520], [400, 300], [1600, 700], [2800, 400]], 10, rgba('#2f86e6', 0.8), P);
  for (const r of [[[-2600, -200], [-700, -100], [0, 0], [900, -300], [2600, -900]], [[0, 0], [300, -900], [900, -1500], [1550, -1750], [2200, -2400]], [[0, 0], [-500, 900], [-900, 2000]]]) gline(r, 5, P.faint, P);
  // the city: a circle of blocks
  g.save(); g.beginPath(); g.arc(CITY.x, CITY.y, CITY.r, 0, TAU); g.clip();
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) { const bx = i * 100, by = j * 100; if (Math.hypot(bx, by) > CITY.r) continue; grect(bx + 12, by + 12, 76, 76, 2, rgba(P.line, 0.5), P); }
  g.restore();
  gline(Array.from({ length: 65 }, (_, i) => [CITY.x + Math.cos(i / 64 * TAU) * CITY.r, CITY.y + Math.sin(i / 64 * TAU) * CITY.r]), 4, P.line, P);
  label('ГОРОД', CITY.x - 300, CITY.y + CITY.r + 80, 54, P.text, { fam: FONTS.mono, shadow: false, stroke: false });
  // the big airport: two crossing runways and a terminal
  g.save(); g.translate(PORT.x, PORT.y); g.rotate(-0.4);
  rect(-420, -40, 840, 80, 'rgba(11,15,26,0.95)'); grect(-420, -40, 840, 80, 4, P.hi, P);
  g.rotate(1.1); rect(-340, -36, 680, 72, 'rgba(11,15,26,0.95)'); grect(-340, -36, 680, 72, 4, P.hi, P);
  g.restore();
  grect(PORT.x - 140, PORT.y + 150, 280, 90, 4, P.hi, P);
  // the people, then the dead: dots that drift, and on «мертвецов» crowd onto the airport
  const pe = clamp(st.people ?? 0), de = clamp(st.dead ?? 0);
  if (pe > 0) for (let i = 0; i < 160; i++) {
    const a = hash(i * 1.7) * TAU, r = CITY.r * Math.sqrt(hash(i * 3.1)), x0 = CITY.x + Math.cos(a) * r, y0 = CITY.y + Math.sin(a) * r;
    const ap = clamp((pe - hash(i * 5.3) * 0.6) / 0.4); if (ap <= 0) continue;
    const go = clamp((de - 0.3 - 0.4 * hash(i * 2.9)) / 0.3), tx = PORT.x + (hash(i * 7.1) - 0.5) * 700, ty = PORT.y + (hash(i * 8.3) - 0.5) * 380;
    const x = lerp(x0, tx, ease.inOut(go)) + 10 * Math.sin(t * 2 + i), y = lerp(y0, ty, ease.inOut(go)) + 10 * Math.cos(t * 1.7 + i);
    const dead = clamp((de - hash(i * 4.4) * 0.3) / 0.15), c = mix('#7cc4ff', '#ff3b30', dead);
    ell(x, y, 14 * ap, 14 * ap, rgba(c, 0.3)); ell(x, y, 8 * ap, 8 * ap, c);
  }
  // the forest and the small airfield
  for (let i = 0; i < 60; i++) { const x = FIELD.x - 900 + 1800 * hash(i * 2.2), y = FIELD.y - 700 + 1400 * hash(i * 3.9); if (Math.hypot(x - FIELD.x, y - FIELD.y) < 330) continue; poly([[x - 30, y + 26], [x, y - 34], [x + 30, y + 26]], rgba(P.ok, 0.55)); }
  g.save(); g.translate(FIELD.x, FIELD.y); g.rotate(-0.25); rect(-260, -30, 520, 60, 'rgba(11,15,26,0.95)'); grect(-260, -30, 520, 60, 4, P.ok, P); g.restore();
  label('АЭРОДРОМ', FIELD.x, FIELD.y + 150, 44, P.ok, { fam: FONTS.mono, shadow: false, stroke: false, a: clamp(st.bend ?? 0) });
  // the route: from the plane to the airport (dashed), then bending off to the airfield
  const pl = st.plane, k = clamp(st.route ?? 0), bd = clamp(st.bend ?? 0);
  const routeA = [pl, [PORT.x - 200, PORT.y + 900], [PORT.x, PORT.y]], routeB = [pl, [pl[0] + 900, pl[1] - 300], [FIELD.x - 300, FIELD.y + 700], [FIELD.x, FIELD.y]];
  const part = (pts, u) => { const out = [pts[0]]; const n = pts.length - 1, f = u * n; for (let i = 1; i <= n; i++) { if (i <= f) out.push(pts[i]); else { const a = pts[i - 1], b = pts[i], v = f - (i - 1); if (v > 0) out.push([lerp(a[0], b[0], v), lerp(a[1], b[1], v)]); break; } } return out; };
  g.save(); g.setLineDash([30, 22]); g.lineDashOffset = -t * 120;
  if (k > 0) gline(part(routeA, k), 7, bd > 0 ? mix('#ffffff', P.danger, clamp(bd * 3)) : '#ffffff', P);
  if (bd > 0) gline(part(routeB, ease.inOut(bd)), 8, P.ok, P);
  g.restore();
  // the plane on the map
  g.save(); g.translate(pl[0], pl[1]); g.rotate(pl[2] ?? -Math.PI / 2); ell(0, 0, 90, 90, rgba('#ffffff', 0.12)); icon('plane', 70, '#ffffff'); g.restore();
}

// —— the parked plane as a ghost, the slide unrolling, the dead walking up it ——  st: { door, slide, climb 0…1, x 0…1 (the red cross) }
export function plane(t, P, st) {
  gline([[-3000, 0], [3000, 0]], 4, P.faint, P);
  for (let x = -3000; x < 3000; x += 120) gline([[x, 0], [x - 60, 50]], 2, P.faint, P);
  MONO.on = true; MONO.color = 'rgba(59,142,234,0.16)';
  const pl = drawPlane(t, { x: 0, y: 0, s: 1, gear: 1, t, door: st.door ?? 0, slide: st.slide ?? 0, lights: 0 });
  MONO.on = false;
  // the outline of the body, the door and the slide
  const F = pl.F, D = PLANE.door1;
  gline(F.pts([[-1880, -590], [1500, -590], [1840, -300], [1700, -190], [-900, -190], [-1600, -320], [-1880, -590]]), 4, P.line, P, true);
  gline(F.pts([[D[0] - 46, -530], [D[0] + 46, -530], [D[0] + 46, -340], [D[0] - 46, -340]]), 5, st.door > 0.5 ? P.danger : P.hi, P, true);
  if ((st.slide ?? 0) > 0.01) gline([pl.slideTop, pl.slideFoot], 10, P.danger, P);
  // three of the dead on the slide, climbing it like stairs
  const c = clamp(st.climb ?? 0);
  if (c > 0 && pl.slideFoot) {
    MONO.on = true; MONO.color = rgba(P.danger, 0.85);
    for (let i = 0; i < 3; i++) {
      const u = clamp(c * 1.3 - i * 0.22), base = [lerp(pl.slideFoot[0] + 140, pl.slideTop[0] + 40, u), lerp(pl.slideFoot[1], pl.slideTop[1], u)];
      zombie(shamble(base[0], base[1], 0.27, -1, t * 1.6 + i * 0.4), 'purple');
    }
    MONO.on = false;
  }
  return pl;
}
