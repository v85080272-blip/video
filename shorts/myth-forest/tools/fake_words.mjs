// Until the narrator is recorded: build/words.json from voice/script.json with every word placed by its syllables
// (0.145 s a syllable plus the pauses: this reproduces part 1's real line timings within 0.3 s), short pauses after commas and longer ones after full stops,
// lines placed by their `at` / `after` as tools/voice.py places the real takes. The picture and the subtitles then run
// on this estimate; the real voice replaces the file and everything moves with it.
// usage: node tools/fake_words.mjs [voice/script.json] [build/words.json]
import fs from 'node:fs';
import path from 'node:path';

const [src = 'voice/script.json', out = 'build/words.json'] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(src, 'utf8'));
const SYL = 0.145, COMMA = 0.14, STOP = 0.3;
const syl = w => (w.match(/[аеёиоуыэюя]/gi) || []).length;
let prevEnd = 0;
const lines = S.lines.map(l => {
  const at = l.at ?? prevEnd + (l.after ?? 0.4);
  let t = at;
  const words = l.text.split(/\s+/).filter(Boolean).map((w, i, all) => {
    if (w === '—' || w === '-') return { w, s: +t.toFixed(3), e: +t.toFixed(3) };
    const s = t, d = Math.max(1, syl(w)) * SYL;
    t += d;
    const e = t;
    if (i < all.length - 1) t += /[.!?:]$/.test(w) ? STOP : /[,;]$/.test(w) ? COMMA : 0.02;
    return { w, s: +s.toFixed(3), e: +e.toFixed(3) };
  });
  prevEnd = words[words.length - 1].e;
  return { id: l.id, text: l.text, at: +at.toFixed(3), end: +prevEnd.toFixed(3), sub: l.sub ?? false, words };
});
const dur = +(prevEnd + (S.tail ?? 0.35)).toFixed(2);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ dur, estimate: true, lines }, null, 1));
for (const l of lines) console.log(l.id, l.at.toFixed(2), '–', l.end.toFixed(2), `(${l.words.length} words)`);
console.log('dur', dur, '→', out);
