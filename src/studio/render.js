// Offline renderer entry: steps a format frame by frame at a fixed rate and
// logs every sound it makes, so scripts/render-studio.mjs can encode the
// clip with ffmpeg and synthesize a matching soundtrack.

import { W, H, DT } from './core.js';
import { survive } from './survive.js';
import { odd } from './odd.js';
import { pause } from './pause.js';

const FORMATS = { survive, odd, pause };
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
document.body.append(canvas);
const ctx = canvas.getContext('2d');
let sim;
let events;

window.studio = {
  defaults(id) {
    return Object.fromEntries(FORMATS[id].fields.map((f) => [f.id, f.value]));
  },
  search(id, params, from) {
    return FORMATS[id].search(params, from);
  },
  start(id, params, seed) {
    events = [];
    const snd = {
      blip: (freq, type = 'pop', vol = 0.5) => events.push([sim.t, freq, type, vol]),
      chord: (fs) => fs.forEach((f, i) => events.push([sim.t + i * 0.09, f, 'bell', 0.45])),
    };
    sim = FORMATS[id].create(params, seed, snd);
  },
  // advance to time t (seconds), draw, and return the frame as a JPEG data URL
  frame(t) {
    while (sim.t + DT / 2 < t && !sim.over) sim.step(DT);
    sim.draw(ctx);
    return { over: sim.over, data: canvas.toDataURL('image/jpeg', 0.93) };
  },
  events: () => events,
};
