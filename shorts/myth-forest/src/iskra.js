// Искра and her cat Факт, the hosts (the user's character sheets, 11.11): sprites cut from the sheets (img/), drawn
// with a breathing bob, a pop when the pose changes, and lip sync — the mouth painted closed (img/<pose>_closed.png) and
// the open mouth (img/<pose>_mouth.png) drawn over it, squashed by how loud the voice is (build/mouth.json, tools/mouth.py).
import fs from 'node:fs';
import { loadImage } from '@napi-rs/canvas';
import { clamp, ease, spring } from './lib.js';
import { g } from './flat.js';

const IMG = new URL('../img/', import.meta.url);
const load = async f => { try { return await loadImage(fs.readFileSync(new URL(f, IMG))); } catch { return null; } };
const MOUTHS = JSON.parse(fs.readFileSync(new URL('mouths.json', IMG)));
const POSES = ['hi', 'explain', 'left', 'right', 'truth', 'myth'];
const P = {};
for (const p of POSES) {
  const k = 'i_' + p, m = MOUTHS[k];
  P[p] = { img: await load(k + '.png'), closed: m ? await load(k + '_closed.png') : null, mouth: m ? await load(k + '_mouth.png') : null, m };
}
const CATS = ['front', 'profile', 'back', 'sure', 'doubt', 'wow'];
const C = {};
for (const c of CATS) C[c] = await load('c_' + c + '.png');
const EXTRA = {};
for (const f of ['b_idea', 'b_wink', 'b_think', 'b_laugh', 'h_wow', 'h_smile', 'h_wink', 'd_truth', 'd_myth', 'd_q']) EXTRA[f] = await load(f + '.png');
// any other sprite from the sheets (busts, heads, the detector screens), bottom centre at (x, y), height h
export function sprite(name, x, y, h, o = {}) {
  const img = EXTRA[name] ?? C[name.replace('c_', '')];
  if (!img) return;
  const w = img.width * h / img.height;
  g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); g.scale(o.flip ? -1 : 1, 1); g.drawImage(img, -w / 2, -h, w, h); g.restore();
}
const MOUTH = (() => { try { return JSON.parse(fs.readFileSync(new URL('../build/mouth.json', import.meta.url))); } catch { return null; } })();

// how open the mouth is at t (0 shut … 1 wide), from the voice's loudness
export function openAt(t) {
  if (!MOUTH) return 0;
  const i = Math.floor(t * MOUTH.fps);
  return i >= 0 && i < MOUTH.v.length ? MOUTH.v[i] : 0;
}
// Искра: pose name, the bottom centre of the sprite at (x, y), height h in px; since: when this pose began (a pop)
export function iskra(t, pose, x, y, h, o = {}) {
  const s = P[pose] ?? P.explain, img = s.img;
  if (!img) return;
  const k = h / img.height, w = img.width * k, since = o.since ?? -9;
  const pop = t - since < 0.5 ? 1 + 0.06 * Math.exp(-(t - since) / 0.08) * Math.cos((t - since) * 30) : 1;
  const bob = 5 * Math.sin(t * 2.2), sway = 0.012 * Math.sin(t * 1.3);
  g.save(); g.translate(x, y + bob); g.rotate(sway); g.scale(pop * (o.flip ? -1 : 1), pop);
  // speaking: the mouth shuts between syllables and opens with the voice; silent: her own smile from the sheet
  const op = openAt(t);
  if (o.speaking && s.closed) {
    g.drawImage(s.closed, -w / 2, -h, w, h);
    if (op > 0.1) { const [x0, y0, x1, y1] = s.m.box, mh = (y1 - y0) * (0.4 + 0.6 * op); g.drawImage(s.mouth, -w / 2 + x0 * k, -h + y0 * k, (x1 - x0) * k, mh * k); }
  } else g.drawImage(img, -w / 2, -h, w, h);
  g.restore();
}
// the cat: pose, bottom centre (x, y), height h; hop: a little jump at that time
export function cat(t, pose, x, y, h, o = {}) {
  const img = C[pose] ?? C.front;
  if (!img) return;
  const k = h / img.height, w = img.width * k;
  const hop = o.hop != null && t > o.hop && t < o.hop + 0.5 ? Math.sin((t - o.hop) / 0.5 * Math.PI) * 50 : 0;
  const breath = 1 + 0.015 * Math.sin(t * 3);
  g.save(); g.translate(x, y - hop); g.scale((o.flip ? -1 : 1) * breath, 1 / breath);
  g.drawImage(img, -w / 2, -h, w, h);
  g.restore();
}
