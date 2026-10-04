// Bundles the whole lab into one self-contained HTML page (artifact.html),
// handy for sharing a single file or publishing it as a page.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
// `node scripts/build-artifact.mjs studio` bundles the Trend Studio page instead
const page = process.argv[2] === 'studio'
  ? { html: 'studio.html', entry: 'src/studio/main.js', out: 'studio-artifact.html' }
  : { html: 'index.html', entry: 'src/main.js', out: 'artifact.html' };
const html = await readFile(new URL(page.html, root), 'utf8');

const { outputFiles } = await build({
  entryPoints: [new URL(page.entry, root).pathname],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const pick = (re) => (html.match(re) || [])[0] || '';
const title = pick(/<title>[\s\S]*?<\/title>/);
const links = (html.match(/<link [^>]*>/g) || []).join('\n');
const style = pick(/<style>[\s\S]*?<\/style>/);
const body = html
  .match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script type="module"[^>]*><\/script>/, `<script>${js}</script>`);

const out = [title, links, style, body.trim()].join('\n');
await writeFile(new URL(page.out, root), out);
console.log(`${page.out}: ${(out.length / 1024).toFixed(0)} KB`);
