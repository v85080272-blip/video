// Breaking things. fracture() cuts a convex shape into shards around the
// point of impact (spokes plus rings, like a hit window); the shards then fly,
// spin, fall and settle, either on a floor or inside a round arena.

const TAU = Math.PI * 2;

export function circlePoly(cx, cy, r, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Sutherland–Hodgman: keep the part of poly inside the convex polygon edge by edge
function clip(poly, convex) {
  let out = poly;
  // orientation of the clipping polygon, so "inside" works either way round
  let area2 = 0;
  for (let i = 0; i < convex.length; i++) {
    const [x1, y1] = convex[i];
    const [x2, y2] = convex[(i + 1) % convex.length];
    area2 += x1 * y2 - x2 * y1;
  }
  const sgn = area2 >= 0 ? 1 : -1;
  for (let i = 0; i < convex.length && out.length; i++) {
    const [ax, ay] = convex[i];
    const [bx, by] = convex[(i + 1) % convex.length];
    const side = (p) => sgn * ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax));
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) next.push(p);
      if (sp >= 0 !== sq >= 0) {
        const k = sp / (sp - sq);
        next.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    out = next;
  }
  return out;
}

function centroid(poly) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const c = x1 * y2 - x2 * y1;
    a += c;
    cx += (x1 + x2) * c;
    cy += (y1 + y2) * c;
  }
  a /= 2;
  if (Math.abs(a) < 1e-6) return null;
  return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
}

// Cuts shape (convex, absolute coords) around (ix, iy). spokes and rings set
// how fine the break is; r() is the seeded random. Returns shards at rest.
export function fracture(shape, ix, iy, r, spokes = 10, rings = 3) {
  let far = 0;
  for (const [x, y] of shape) far = Math.max(far, Math.hypot(x - ix, y - iy));
  far *= 1.05;
  const angles = [];
  const a0 = r() * TAU;
  for (let i = 0; i < spokes; i++) angles.push(a0 + ((i + 0.25 + r() * 0.5) / spokes) * TAU);
  // ring radii grow geometrically, so pieces are small at the hit and big far away
  const radii = [0];
  for (let j = 1; j <= rings; j++) radii.push(far * Math.pow(j / rings, 1.6));
  const jit = angles.map(() => radii.map((R, j) => (j === 0 || j === rings ? R : R * (0.8 + r() * 0.4))));
  const shards = [];
  for (let i = 0; i < spokes; i++) {
    const a1 = angles[i];
    const a2 = i + 1 < spokes ? angles[i + 1] : angles[0] + TAU;
    const i2 = (i + 1) % spokes;
    for (let j = 0; j < rings; j++) {
      const cell = [];
      const am = (a1 + a2) / 2;
      const rin = [jit[i][j], (jit[i][j] + jit[i2][j]) / 2, jit[i2][j]];
      const rout = [jit[i][j + 1], (jit[i][j + 1] + jit[i2][j + 1]) / 2, jit[i2][j + 1]];
      const at = [a1, am, a2];
      if (j === 0) cell.push([ix, iy]);
      else for (let k = 0; k < 3; k++) cell.push([ix + Math.cos(at[k]) * rin[k], iy + Math.sin(at[k]) * rin[k]]);
      for (let k = 2; k >= 0; k--) cell.push([ix + Math.cos(at[k]) * rout[k], iy + Math.sin(at[k]) * rout[k]]);
      const piece = clip(cell, shape);
      if (piece.length < 3) continue;
      const c = centroid(piece);
      if (!c || c.area < 30) continue;
      let rad = 0;
      const pts = piece.map(([x, y]) => {
        rad = Math.max(rad, Math.hypot(x - c.x, y - c.y));
        return [x - c.x, y - c.y];
      });
      shards.push({ pts, src: piece, ox: c.x, oy: c.y, x: c.x, y: c.y, vx: 0, vy: 0, a: 0, w: 0, area: c.area, rad, rest: false, ring: j });
    }
  }
  return shards;
}

// Pushes every shard away from (ix, iy): close pieces fly fastest.
export function blast(shards, ix, iy, power, carryX, carryY, r) {
  for (const s of shards) {
    const dx = s.x - ix;
    const dy = s.y - iy;
    const d = Math.hypot(dx, dy) || 1;
    const k = power / (1 + d / 120);
    s.vx = carryX + (dx / d) * k * (0.6 + r() * 0.8) + (r() - 0.5) * power * 0.15;
    s.vy = carryY + (dy / d) * k * (0.6 + r() * 0.8) + (r() - 0.5) * power * 0.15;
    s.w = (r() - 0.5) * (8 + power / 60);
  }
}

function lowest(s) {
  const c = Math.cos(s.a);
  const sn = Math.sin(s.a);
  let best = -Infinity;
  let bx = 0;
  for (const [px, py] of s.pts) {
    const y = px * sn + py * c;
    if (y > best) {
      best = y;
      bx = px * c - py * sn;
    }
  }
  return [bx, best];
}

// One physics step for loose shards. floor: y of the ground, or null;
// arena: { x, y, r } to keep them inside a circle, or null.
export function stepShards(shards, dt, g, floor, arena) {
  for (const s of shards) {
    if (s.rest) continue;
    s.vy += g * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.a += s.w * dt;
    if (floor !== null) {
      const [bx, by] = lowest(s);
      const pen = s.y + by - floor;
      if (pen > 0) {
        s.y -= pen;
        if (s.vy > 0) s.vy = -s.vy * 0.25;
        s.vx *= 0.82;
        // the touching corner drags the spin toward rolling
        s.w = s.w * 0.6 + (s.vx / Math.max(20, Math.abs(bx) + s.rad)) * 0.2;
        if (Math.abs(s.vy) < 40 && Math.abs(s.vx) < 15) {
          s.vy = 0;
          s.vx = 0;
          s.w = 0;
          s.rest = true;
        }
      }
    }
    if (arena) {
      const c = Math.cos(s.a);
      const sn = Math.sin(s.a);
      let worst = 0;
      let nx = 0;
      let ny = 0;
      for (const [px, py] of s.pts) {
        const x = s.x + px * c - py * sn - arena.x;
        const y = s.y + px * sn + py * c - arena.y;
        const d = Math.hypot(x, y);
        if (d - arena.r > worst) {
          worst = d - arena.r;
          nx = x / d;
          ny = y / d;
        }
      }
      if (worst > 0) {
        s.x -= nx * worst;
        s.y -= ny * worst;
        const vn = s.vx * nx + s.vy * ny;
        if (vn > 0) {
          s.vx -= 1.3 * vn * nx;
          s.vy -= 1.3 * vn * ny;
        }
        s.vx *= 0.9;
        s.vy *= 0.9;
        s.w *= 0.75;
      }
    }
  }
}

// Draws each shard by painting the original object clipped to the piece,
// moved to where the piece is now. paint(ctx) draws in the object's own,
// unbroken coordinates; edge is an optional stroke for the cut lines.
export function drawShards(ctx, shards, paint, edge) {
  for (const s of shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.translate(-s.ox, -s.oy);
    const outline = () => {
      ctx.beginPath();
      s.src.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    outline();
    ctx.save();
    ctx.clip();
    paint(ctx, s);
    ctx.restore();
    if (edge) {
      // paint() drew its own paths, so trace the piece again for its edge
      outline();
      ctx.lineWidth = edge.width;
      ctx.strokeStyle = edge.color;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
}
