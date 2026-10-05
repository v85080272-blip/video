// Generates a video through fal's queue API and saves the MP4.
//
//   FAL_KEY=... node ai-video/fal-generate.mjs <model-id> <prompt.txt> [out.mp4] [--key value ...]
//
// Example:
//   node ai-video/fal-generate.mjs fal-ai/kling-video/v2.1/master/text-to-video \
//     ai-video/prompts/morozilka-teaser.txt out/morozilka.mp4 --duration 10
//
// The model id comes from the model's page on fal.ai/models; input fields differ
// per model, so extra --key value pairs are passed through as-is. aspect_ratio
// defaults to 9:16. Needs network access to queue.fal.run and *.fal.media.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [model, promptFile, outArg, ...rest] = process.argv.slice(2);
if (!model || !promptFile) {
  console.error('usage: node ai-video/fal-generate.mjs <model-id> <prompt.txt> [out.mp4] [--key value ...]');
  process.exit(1);
}
const key = process.env.FAL_KEY;
if (!key) {
  console.error('FAL_KEY is not set');
  process.exit(1);
}

const input = { prompt: readFileSync(promptFile, 'utf8').trim(), aspect_ratio: '9:16' };
for (let i = 0; i < rest.length; i += 2) {
  const name = rest[i].replace(/^--/, '');
  const raw = rest[i + 1];
  input[name] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
}
const out = outArg && !outArg.startsWith('--')
  ? outArg
  : path.join('out', `${path.basename(promptFile, '.txt')}-${Date.now()}.mp4`);

const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };

async function call(url, options = {}) {
  const res = await fetch(url, { headers, ...options });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}\n${text}`);
  return JSON.parse(text);
}

const job = await call(`https://queue.fal.run/${model}`, { method: 'POST', body: JSON.stringify(input) });
console.log(`queued ${job.request_id}`);

for (;;) {
  await new Promise(r => setTimeout(r, 5000));
  const st = await call(job.status_url);
  process.stdout.write(`\r${st.status}${st.queue_position != null ? ` (queue ${st.queue_position})` : ''}   `);
  if (st.status === 'COMPLETED') break;
  if (st.status === 'FAILED' || st.status === 'ERROR') throw new Error(JSON.stringify(st));
}

const result = await call(job.response_url);
const url = result.video?.url ?? result.videos?.[0]?.url;
if (!url) throw new Error(`no video in response: ${JSON.stringify(result).slice(0, 500)}`);
const video = await fetch(url);
mkdirSync(path.dirname(out) || '.', { recursive: true });
writeFileSync(out, Buffer.from(await video.arrayBuffer()));
console.log(`\nsaved ${out}`);
