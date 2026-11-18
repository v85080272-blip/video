// The detail maps for the flat shapes (img/tex/*.png, grey, from Poly Haven CC0 scans: see flat.js «textures over the
// flat colours»). initTex(map) makes the patterns and says which fill colours get which texture.
import fs from 'node:fs';
import { loadImage } from '@napi-rs/canvas';
import { TEX, texPattern } from './flat.js';

const DIR = new URL('../img/tex/', import.meta.url);
const NAMES = ['asphalt', 'concrete', 'rust', 'bark', 'fabric', 'floor', 'grass', 'planks', 'plaster', 'roof'];
const IM = {};
for (const n of NAMES) { try { IM[n] = await loadImage(fs.readFileSync(new URL(n + '.png', DIR))); } catch { /* no map, no texture */ } }
export function initTex(map) {
  TEX.on = !process.env.NOTEX;
  for (const [n, im] of Object.entries(IM)) texPattern(n, im);
  Object.assign(TEX.map, map);
}
