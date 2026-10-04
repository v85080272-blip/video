// --- Display ---

// Device pixel ratio (capped at 2 for mobile GPU performance)
export const DPR = Math.min(window.devicePixelRatio || 1, 2);

// Force portrait mode — set to true for vertical games (dodgers, runners, collectors).
// On desktop, Scale.FIT + CENTER_BOTH will pillarbox with black bars automatically.
// Set to false (default) for games that should adapt to device orientation.
const FORCE_PORTRAIT = true;
const _isPortrait = FORCE_PORTRAIT || window.innerHeight > window.innerWidth;

// Design dimensions (logical game units at 1x scale)
const _designW = _isPortrait ? 540 : 960;
const _designH = _isPortrait ? 960 : 540;
const _designAspect = _designW / _designH;

// Canvas dimensions = device pixel area, maintaining design aspect ratio.
// This ensures the canvas has enough resolution for the user's actual display
// so FIT mode never CSS-upscales (which causes blurriness on retina).
const _deviceW = window.innerWidth * DPR;
const _deviceH = window.innerHeight * DPR;

let _canvasW, _canvasH;
if (_deviceW / _deviceH > _designAspect) {
  // Viewport wider than design → width-limited by FIT → match device width
  _canvasW = _deviceW;
  _canvasH = Math.round(_deviceW / _designAspect);
} else {
  // Viewport taller than design → width-limited by FIT → match device width
  _canvasW = Math.round(_deviceH * _designAspect);
  _canvasH = _deviceH;
}

// PX = canvas pixels per design pixel. Scales all absolute values (sizes, speeds, etc.)
// from design space to canvas space. Gameplay proportions stay identical across all displays.
export const PX = _canvasW / _designW;

export const GAME = {
  WIDTH: _canvasW,
  HEIGHT: _canvasH,
  IS_PORTRAIT: _isPortrait,
  GRAVITY: 800 * PX,
};

// --- Safe Zone (Play.fun SDK insets) ---
// The Play.fun SDK sets CSS custom properties on the game iframe's document:
//   --ogp-safe-top-inset    (space below Play.fun header bubbles, ~68px on mobile)
//   --ogp-safe-bottom-inset (space above Safari bottom controls, ~148px on mobile)
// Both default to 0px when not running inside the Play.fun dashboard.
// All UI text, buttons, and interactive elements must stay within the safe area.
// Game canvas / backgrounds should fill the full viewport (bleed behind chrome).
function _readSafeInsets() {
  const s = getComputedStyle(document.documentElement);
  const top = parseInt(s.getPropertyValue('--ogp-safe-top-inset')) || 0;
  const bottom = parseInt(s.getPropertyValue('--ogp-safe-bottom-inset')) || 0;
  // CSS vars are in CSS pixels — multiply by DPR to convert to canvas pixels
  return { top: top * DPR, bottom: bottom * DPR };
}
const _insets = _readSafeInsets();

export const SAFE_ZONE = {
  TOP: Math.max(GAME.HEIGHT * 0.08, _insets.top),
  BOTTOM: _insets.bottom,
  LEFT: 0,
  RIGHT: 0,
};

// --- Tower (world units: a fresh block is 1 x 1, one floor is SLAB tall) ---

export const TOWER = {
  SLAB: 0.24,              // floor height in world units
  BASE_FLOORS: 7,          // pedestal height under floor 0
  RANGE: 1.45,             // how far the sliding block travels from the tower axis
  SPEED: 1.9,              // world units per second at floor 0
  SPEED_GAIN: 0.035,       // speed added per floor
  SPEED_MAX: 3.6,
  PERFECT: 0.035,          // offset under this snaps into place
  GROW_AFTER: 4,           // perfect streak length that starts growing the block back
  GROW_STEP: 0.06,
  SCALE: 112 * PX,         // pixels per world unit
  ANCHOR_Y: 0.6,           // top of the tower sits at this share of screen height
  GRAVITY: 9,              // debris fall acceleration, world units / s^2
  STEP: 1 / 120,           // fixed simulation step
};

export const AUTOPILOT = {
  START_DELAY: 0.9,        // seconds before the first drop
  MIN_GAP: 0.32,           // min seconds a block slides before the bot may drop it
  PERFECT_CHANCE: 0.6,
  MIN_SIZE: 0.42,          // below this the bot plays safe and goes for perfects
};

export const COLORS = {
  BG_TOP: 0x0f0c29,
  BG_BOTTOM: 0x302b63,
  UI_TEXT: '#ffffff',
  UI_SHADOW: '#000000',
  ACCENT: '#ffd84d',
};

// --- UI sizing (proportional to game dimensions) ---

export const UI = {
  FONT: '"Arial Black", "Helvetica Neue", Arial, "Liberation Sans", "DejaVu Sans", sans-serif',
  TITLE_RATIO: 0.08,          // title font size as % of GAME.HEIGHT
  HEADING_RATIO: 0.05,        // heading font size
  BODY_RATIO: 0.035,          // body/button font size
  SMALL_RATIO: 0.025,         // hint/caption font size
  BTN_W_RATIO: 0.45,          // button width as % of GAME.WIDTH
  BTN_H_RATIO: 0.075,         // button height as % of GAME.HEIGHT
  BTN_RADIUS: 12 * PX,        // button corner radius
  MIN_TOUCH: 44 * PX,         // minimum touch target
};

// --- Transitions ---

export const TRANSITION = {
  FADE_DURATION: 350,
};
