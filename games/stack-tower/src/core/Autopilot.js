import { AUTOPILOT, TOWER } from './Constants.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plays the tower for the video: mostly clean drops, a few nervous cuts, and a
// planned miss on `finalFloor` so the clip always ends on the answer.
export class Autopilot {
  constructor(tower, { seed = 1, finalFloor = 26 } = {}) {
    this.tower = tower;
    this.rand = mulberry32(seed);
    this.finalFloor = finalFloor;
    this.planFor = -1;
    this.target = 0;
    this.wait = 0;
    this.prevOffset = null;
  }

  plan() {
    const t = this.tower;
    const m = t.moving;
    const top = t.top;
    const size = m.axis === 'x' ? top.w : top.d;
    const r = this.rand();
    const left = this.finalFloor - m.floor;
    let err;
    if (left <= 0) {
      // The miss: clearly off the edge, but close enough to read as "almost".
      err = size * (1.08 + 0.25 * r);
    } else if (left <= 2) {
      // Tension right before the end: deep cuts that leave a thin tower.
      err = Math.min(size * (0.3 + 0.2 * r), Math.max(0, size - 0.2));
    } else if (size < AUTOPILOT.MIN_SIZE || r < AUTOPILOT.PERFECT_CHANCE) {
      err = 0;
    } else {
      err = 0.05 + 0.1 * this.rand();
    }
    const sign = this.rand() < 0.5 ? -1 : 1;
    this.target = Math.max(-TOWER.RANGE + 0.02, Math.min(TOWER.RANGE - 0.02, sign * err));
    this.wait = (m.floor === 1 ? AUTOPILOT.START_DELAY : AUTOPILOT.MIN_GAP) + 0.25 * this.rand();
    this.planFor = m.floor;
    this.prevOffset = null;
  }

  // Call after every simulation step.
  update() {
    const t = this.tower;
    const m = t.moving;
    if (!m || t.failed) return null;
    if (this.planFor !== m.floor) this.plan();
    const prev = this.prevOffset;
    this.prevOffset = m.offset;
    if (m.age < this.wait || prev === null) return null;
    const crossed = (prev - this.target) * (m.offset - this.target) <= 0;
    if (!crossed) return null;
    // Land exactly on the planned offset so the result does not depend on frame timing.
    m.offset = this.target;
    m[m.axis] = t.top[m.axis] + this.target;
    return t.drop();
  }
}
