import Phaser from 'phaser';
import { GAME, TOWER, COLORS, UI, SAFE_ZONE } from '../core/Constants.js';
import { eventBus, Events } from '../core/EventBus.js';
import { gameState } from '../core/GameState.js';
import { Tower } from '../core/Tower.js';
import { Autopilot, mulberry32 } from '../core/Autopilot.js';
import { unlockAudio, playEvent } from '../systems/Sound.js';

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

const params = new URLSearchParams(window.location.search);
export const MODE = {
  capture: params.has('capture'),
  demo: params.has('demo') || params.has('capture'),
  seed: parseInt(params.get('seed'), 10) || 7,
  floor: parseInt(params.get('floor'), 10) || 0,
};

function hsl(h, s, l) {
  return Phaser.Display.Color.HSLToColor(((h % 360) + 360) % 360 / 360, s, l).color;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.round = 0;
  }

  create() {
    gameState.reset();
    const seed = MODE.seed + this.round;
    const rand = mulberry32(seed * 7919);
    const finalFloor = MODE.floor || 19 + Math.floor(rand() * 7);
    this.tower = new Tower(Math.floor(rand() * 360));
    this.autopilot = MODE.demo ? new Autopilot(this.tower, { seed, finalFloor }) : null;
    this.fx = [];          // extra sound cues (end card), with sim time
    this.popups = [];
    this.acc = 0;
    this.camFocus = TOWER.SLAB;
    this.zoom = 1;
    this.endShown = false;
    this.endAt = 0;

    this.g = this.add.graphics();
    this.makeTexts();

    this.input.on('pointerdown', () => this.tap());
    this.input.keyboard.on('keydown-SPACE', () => this.tap());

    gameState.started = true;
    eventBus.emit(Events.GAME_START, { seed, finalFloor });
    this.draw();
  }

  makeTexts() {
    const H = GAME.HEIGHT;
    const style = (size, color = COLORS.UI_TEXT) => ({
      fontFamily: UI.FONT, fontSize: `${Math.round(size)}px`, fontStyle: '900', color,
      align: 'center', stroke: COLORS.UI_SHADOW, strokeThickness: Math.round(size * 0.14),
    });
    const top = SAFE_ZONE.TOP;
    const hook = MODE.demo ? 'НА КАКОМ ЭТАЖЕ\nУПАДЁТ БАШНЯ?' : 'ТАПНИ, ЧТОБЫ\nПОСТАВИТЬ БЛОК';
    this.hook = this.add.text(GAME.WIDTH / 2, top, hook, style(H * 0.042))
      .setOrigin(0.5, 0).setLineSpacing(H * 0.004);
    const sub = MODE.demo ? 'пиши ответ в комменты' : 'попади точно в край';
    this.sub = this.add.text(GAME.WIDTH / 2, top + H * 0.115, sub, style(H * 0.024, COLORS.ACCENT))
      .setOrigin(0.5, 0);
    this.counter = this.add.text(GAME.WIDTH / 2, top + H * 0.16, '0', style(H * 0.085))
      .setOrigin(0.5, 0);
    this.endTitle = this.add.text(GAME.WIDTH / 2, H * 0.16, '', style(H * 0.06, COLORS.ACCENT))
      .setOrigin(0.5, 0).setAlpha(0).setLineSpacing(H * 0.004);
    this.endSub = this.add.text(GAME.WIDTH / 2, H * 0.84, '', style(H * 0.03))
      .setOrigin(0.5, 0).setAlpha(0).setLineSpacing(H * 0.004);
    this.popupStyle = style(H * 0.034, COLORS.ACCENT);
  }

  tap() {
    unlockAudio();
    if (MODE.demo) return;
    if (this.tower.failed) {
      if (this.endShown) this.restartRound();
      return;
    }
    this.onEvent(this.tower.drop());
  }

  restartRound() {
    this.round += 1;
    this.scene.restart();
  }

  onEvent(ev) {
    if (!ev) return;
    playEvent(ev);
    if (ev.type === 'perfect') {
      const label = ev.combo >= 2 ? `ИДЕАЛЬНО ×${ev.combo}` : 'ИДЕАЛЬНО';
      this.addPopup(label);
    }
    if (ev.type === 'fail') {
      gameState.gameOver = true;
      eventBus.emit(Events.GAME_OVER, { score: this.tower.floor });
    } else {
      gameState.addScore(1);
      eventBus.emit(Events.SCORE_CHANGED, { score: gameState.score });
    }
  }

  addPopup(label) {
    const t = this.add.text(GAME.WIDTH / 2, GAME.HEIGHT * TOWER.ANCHOR_Y - GAME.HEIGHT * 0.16, label, this.popupStyle)
      .setOrigin(0.5);
    this.popups.push({ t, age: 0 });
  }

  // One fixed simulation step; shared by live play and frame-by-frame capture.
  tick(dt) {
    const tower = this.tower;
    tower.step(dt);
    if (this.autopilot) this.onEvent(this.autopilot.update());

    const k = 1 - Math.exp(-dt * 6);
    let focus = (tower.floor + 1) * TOWER.SLAB;
    let zoom = 1;
    if (tower.failed && tower.time - tower.failTime > 0.6) {
      // Pull back to show the whole tower next to the answer.
      const yT = (tower.floor + 1) * TOWER.SLAB;
      const yB = -TOWER.BASE_FLOORS * TOWER.SLAB;
      zoom = Math.min(1, (GAME.HEIGHT * 0.42) / ((yT - yB) * TOWER.SCALE));
      focus = yT - (GAME.HEIGHT * (TOWER.ANCHOR_Y - 0.33)) / (TOWER.SCALE * zoom);
    }
    this.camFocus += (focus - this.camFocus) * k;
    this.zoom += (zoom - this.zoom) * k;

    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter(p => {
      if (p.age < 0.8) return true;
      p.t.destroy();
      return false;
    });

    if (tower.failed && !this.endShown && tower.time - tower.failTime > 1.1) {
      this.endShown = true;
      this.endAt = tower.time;
      const reveal = { type: 'reveal', t: tower.time };
      this.fx.push(reveal);
      playEvent(reveal);
    }
    if (MODE.demo && !MODE.capture && this.endShown && tower.time - this.endAt > 3.2) {
      this.restartRound();
      return false;
    }
    return true;
  }

  update(_time, delta) {
    if (MODE.capture) return;
    this.acc += Math.min(delta / 1000, 0.1);
    while (this.acc >= TOWER.STEP) {
      this.acc -= TOWER.STEP;
      if (!this.tick(TOWER.STEP)) return;
    }
    this.draw();
  }

  // --- Rendering ---

  project(x, y, z) {
    const s = TOWER.SCALE * this.zoom;
    return {
      x: GAME.WIDTH / 2 + (x - z) * COS30 * s,
      y: GAME.HEIGHT * TOWER.ANCHOR_Y - (y - this.camFocus) * s + (x + z) * SIN30 * s,
    };
  }

  drawBox(b, yBottom, yTop, alpha = 1) {
    const g = this.g;
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const P = (x, y, z) => this.project(x, y, z);
    const poly = (pts, color) => {
      g.fillStyle(color, alpha);
      g.fillPoints(pts, true);
    };
    poly([P(x0, yTop, z1), P(x1, yTop, z1), P(x1, yBottom, z1), P(x0, yBottom, z1)], hsl(b.hue, 0.62, 0.5));
    poly([P(x1, yTop, z0), P(x1, yTop, z1), P(x1, yBottom, z1), P(x1, yBottom, z0)], hsl(b.hue, 0.62, 0.38));
    poly([P(x0, yTop, z0), P(x1, yTop, z0), P(x1, yTop, z1), P(x0, yTop, z1)], hsl(b.hue, 0.7, 0.66));
  }

  draw() {
    const g = this.g;
    const tower = this.tower;
    const S = TOWER.SLAB;
    g.clear();

    const hue = tower.hueFor(tower.floor);
    g.fillGradientStyle(hsl(hue + 30, 0.45, 0.28), hsl(hue + 30, 0.45, 0.28),
      hsl(hue - 20, 0.5, 0.12), hsl(hue - 20, 0.5, 0.12), 1);
    g.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

    const debrisBox = (p) => this.drawBox(p, p.y, p.y + S, Math.max(0, 1 - p.age / 2.5));
    for (const p of tower.debris) if (p.behind) debrisBox(p);
    for (const b of tower.blocks) {
      const bottom = b.floor === 0 ? -TOWER.BASE_FLOORS * S : b.floor * S;
      this.drawBox(b, bottom, (b.floor + 1) * S);
    }
    for (const p of tower.debris) if (!p.behind) debrisBox(p);
    const m = tower.moving;
    if (m) this.drawBox(m, m.floor * S, (m.floor + 1) * S);

    this.counter.setText(String(tower.floor));
    for (const p of this.popups) {
      p.t.setAlpha(Math.max(0, 1 - Math.max(0, p.age - 0.4) / 0.4));
      p.t.setY(GAME.HEIGHT * TOWER.ANCHOR_Y - GAME.HEIGHT * (0.16 + p.age * 0.05));
    }
    if (!MODE.demo && tower.floor > 0) this.sub.setAlpha(0);

    // The question fades out first, then the answer comes in on the same spot.
    const since = this.endShown ? tower.time - this.endAt : -1;
    const out = this.endShown ? Math.min(1, since / 0.2) : 0;
    const fade = this.endShown ? Math.max(0, Math.min(1, (since - 0.2) / 0.25)) : 0;
    this.hook.setAlpha(1 - out);
    this.sub.setAlpha(this.sub.alpha && 1 - out);
    this.counter.setAlpha(1 - out);
    if (this.endShown) {
      const fell = tower.floor + 1;
      this.endTitle.setText(MODE.demo ? `УПАЛА НА\n${fell} ЭТАЖЕ` : `ЭТАЖ ${tower.floor}`);
      this.endSub.setText(MODE.demo ? 'Угадал? Пиши + в комменты' : 'Тапни, чтобы ещё раз');
      this.endTitle.setAlpha(fade).setScale(0.8 + 0.2 * fade);
      this.endSub.setAlpha(fade);
    }
  }
}
