import Phaser from 'phaser';
import { GameConfig } from './core/GameConfig.js';
import { eventBus, Events } from './core/EventBus.js';
import { gameState } from './core/GameState.js';
import { TOWER } from './core/Constants.js';

const game = new Phaser.Game(GameConfig);

// Expose for Playwright testing
window.__GAME__ = game;
window.__GAME_STATE__ = gameState;
window.__EVENT_BUS__ = eventBus;
window.__EVENTS__ = Events;

// --- AI-readable game state snapshot ---
// Returns a concise JSON string for automated agents to understand the game
// without interpreting pixels. Extend this as you add entities and mechanics.
window.render_game_to_text = () => {
  if (!game || !gameState) return JSON.stringify({ error: 'not_ready' });

  const activeScenes = game.scene.getScenes(true).map(s => s.scene.key);
  const payload = {
    // Coordinate system: origin top-left, x increases rightward, y increases downward
    coords: 'origin:top-left x:right y:down',
    mode: gameState.gameOver ? 'game_over' : gameState.started ? 'playing' : 'menu',
    scene: activeScenes[0] || null,
    scenes: activeScenes,
    score: gameState.score,
    bestScore: gameState.bestScore,
  };

  const scene = game.scene.getScene('GameScene');
  if (scene?.tower) {
    const t = scene.tower;
    payload.floor = t.floor;
    payload.combo = t.combo;
    payload.failed = t.failed;
    payload.top = t.top;
    payload.moving = t.moving && { axis: t.moving.axis, offset: +t.moving.offset.toFixed(3) };
  }

  return JSON.stringify(payload);
};

// --- Deterministic time-stepping hook ---
// Lets automated test scripts advance the game by a precise duration.
// The game loop runs normally via RAF; this just waits for real time to elapse.
// For frame-precise control in @playwright/test, prefer page.clock.install() + runFor().
window.advanceTime = (ms) => {
  return new Promise((resolve) => {
    const start = performance.now();
    function step() {
      if (performance.now() - start >= ms) return resolve();
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
};

// --- Frame-by-frame capture (used by scripts/capture.mjs with ?capture) ---
// Advances the simulation by exact steps and redraws, so every video frame is
// deterministic no matter how slowly the headless browser renders.
window.__capture = {
  advance(seconds) {
    const scene = game.scene.getScene('GameScene');
    const steps = Math.round(seconds / TOWER.STEP);
    for (let i = 0; i < steps; i++) scene.tick(TOWER.STEP);
    scene.draw();
  },
  status() {
    const t = game.scene.getScene('GameScene')?.tower;
    return t ? { ready: true, time: t.time, failed: t.failed, failTime: t.failTime, floor: t.floor } : { ready: false };
  },
  sounds() {
    const scene = game.scene.getScene('GameScene');
    return [...scene.tower.events, ...scene.fx];
  },
};
