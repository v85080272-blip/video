import { TOWER } from './Constants.js';

// Pure, deterministic tower simulation. No Phaser in here, so the same seed and
// the same drop times always give the same tower (the video capture relies on it).
//
// World axes: x and z are horizontal, y is up. A block is centred at (x, z)
// with size (w, d); floor n sits at height n * SLAB.

export class Tower {
  constructor(baseHue = 200) {
    this.baseHue = baseHue;
    this.time = 0;
    this.blocks = [{ x: 0, z: 0, w: 1, d: 1, floor: 0, hue: baseHue }];
    this.debris = [];
    this.events = [];
    this.combo = 0;
    this.failed = false;
    this.failTime = 0;
    this.spawn();
  }

  get top() {
    return this.blocks[this.blocks.length - 1];
  }

  get floor() {
    return this.top.floor;
  }

  hueFor(floor) {
    return (this.baseHue + floor * 7) % 360;
  }

  spawn() {
    const top = this.top;
    const floor = top.floor + 1;
    const axis = floor % 2 === 1 ? 'x' : 'z';
    const speed = Math.min(TOWER.SPEED + floor * TOWER.SPEED_GAIN, TOWER.SPEED_MAX);
    this.moving = {
      x: top.x, z: top.z, w: top.w, d: top.d, floor, axis, speed,
      offset: -TOWER.RANGE, dir: 1, hue: this.hueFor(floor), age: 0,
    };
    this.moving[axis] = top[axis] - TOWER.RANGE;
  }

  // Offset of the sliding block from the tower top along its axis.
  get offset() {
    return this.moving ? this.moving.offset : 0;
  }

  step(dt) {
    this.time += dt;
    const m = this.moving;
    if (m) {
      m.age += dt;
      m.offset += m.dir * m.speed * dt;
      if (m.offset > TOWER.RANGE) { m.offset = 2 * TOWER.RANGE - m.offset; m.dir = -1; }
      if (m.offset < -TOWER.RANGE) { m.offset = -2 * TOWER.RANGE - m.offset; m.dir = 1; }
      m[m.axis] = this.top[m.axis] + m.offset;
    }
    for (const p of this.debris) {
      p.vy -= TOWER.GRAVITY * dt;
      p.y += p.vy * dt;
      p.spin += p.spinV * dt;
      p.age += dt;
    }
    this.debris = this.debris.filter(p => p.age < 3.5);
  }

  drop() {
    const m = this.moving;
    if (!m || this.failed) return null;
    const top = this.top;
    const axis = m.axis;
    const sizeKey = axis === 'x' ? 'w' : 'd';
    const size = top[sizeKey];
    let delta = m[axis] - top[axis];
    this.moving = null;

    if (Math.abs(delta) >= size) {
      this.failed = true;
      this.failTime = this.time;
      this.combo = 0;
      this.addDebris({ ...m }, Math.sign(delta) || 1, axis);
      return this.emit('fail', m.floor);
    }

    const block = { x: m.x, z: m.z, w: m.w, d: m.d, floor: m.floor, hue: m.hue };
    let type;
    if (Math.abs(delta) <= TOWER.PERFECT) {
      block[axis] = top[axis];
      this.combo += 1;
      type = 'perfect';
      if (this.combo >= TOWER.GROW_AFTER) {
        // Long perfect streaks slowly win back width, like the classic stack games.
        block.w = Math.min(1, block.w + TOWER.GROW_STEP);
        block.d = Math.min(1, block.d + TOWER.GROW_STEP);
      }
    } else {
      this.combo = 0;
      type = 'cut';
      const overlap = size - Math.abs(delta);
      const sign = Math.sign(delta);
      block[sizeKey] = overlap;
      block[axis] = top[axis] + delta / 2;
      const piece = { ...m };
      piece[sizeKey] = Math.abs(delta);
      piece[axis] = top[axis] + sign * (size / 2 + Math.abs(delta) / 2);
      this.addDebris(piece, sign, axis);
    }
    this.blocks.push(block);
    const ev = this.emit(type, block.floor, { size: Math.min(block.w, block.d) });
    this.spawn();
    return ev;
  }

  addDebris(b, sign, axis) {
    this.debris.push({
      x: b.x, z: b.z, w: b.w, d: b.d, hue: b.hue,
      y: b.floor * TOWER.SLAB, vy: 0.6, age: 0,
      spin: 0, spinV: sign * 1.4, axis,
      // Pieces cut off the far side sit behind the tower and must be drawn first.
      behind: sign < 0,
    });
  }

  emit(type, floor, extra = {}) {
    const ev = { type, floor, combo: this.combo, t: this.time, ...extra };
    this.events.push(ev);
    return ev;
  }
}
