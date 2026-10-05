// Bundles the whole lab into one self-contained HTML page (artifact.html),
// handy for sharing a single file or publishing it as a page.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');

const { outputFiles } = await build({
  entryPoints: [new URL('src/main.js', root).pathname],
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
  // a function, so "$&" and friends in the minified code stay literal
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script>${js}</script>`);

const out = [title, links, style, body.trim()].join('\n');
await writeFile(new URL('artifact.html', root), out);
console.log(`artifact.html: ${(out.length / 1024).toFixed(0)} KB`);
