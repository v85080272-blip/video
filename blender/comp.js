// Puts the Blender frames of all five rounds into one clip: the same hook,
// pills, stamp words and end card as the 2D toys, plus the crash sounds.
// Bundled with esbuild and driven frame by frame from comp.cjs.
import { W, H, ACCENT, DISPLAY } from '../src/engine.js';
import { playCrash, playTone, midiToFreq } from '../src/melody.js';

const HOOK = ['С какого веса', 'арбуз лопнет?'];
const TIER = {
  'Цел!': { color: '#3ddc6f', sound: ['thud', 0.45] },
  Треснул: { color: '#ffd23f', sound: ['thud', 1.0] },
  Раскололся: { color: '#ff8c3a', sound: ['smash', 1.0] },
  Вдребезги: { color: '#ff4d5e', sound: ['smash', 1.5] },
  'В пыль': { color: '#ff5fc8', sound: ['smash', 2.0] },
};
const BROKE = ['Раскололся', 'Вдребезги', 'В пыль'];
const FADE_OUT = 6;
const FADE_IN = 5;
const BANNER_AFTER = 1.5; // seconds after the last hit

let st;

function fit(ctx, text, weight, size, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${DISPLAY}`;
  while (ctx.measureText(text).width > maxW && s > 30) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${DISPLAY}`;
  }
}

// first video frame of a round at or after sim time t
function frameAt(meta, t) {
  const i = meta.frames.findIndex((f) => f.kind === 'sim' && f.ts >= t - 1e-6);
  return i < 0 ? null : i;
}

window.setup = (rounds) => {
  const canvas = document.getElementById('c');
  canvas.width = W;
  canvas.height = H;
  const list = [];
  const events = [];
  let off = 0;
  rounds.forEach((m, r) => {
    m.frames.forEach((_, f) => list.push({ r, f }));
    const at = (f) => (off + f) / m.fps;
    const T = TIER[m.word];
    events.push({ t: at(m.impact), kind: T.sound[0], vol: T.sound[1] });
    if (m.word === 'В пыль') events.push({ t: at(m.impact) + 0.02, kind: 'thud', vol: 1.4 });
    if (m.word === 'Цел!') events.push({ t: at(m.impact), tone: 84, vol: 0.5 });
    for (const b of m.bounces || []) {
      const f = frameAt(m, b);
      if (f === null || f <= m.impact + 2) continue;
      events.push(m.r < 0.02 ? { t: at(f), tone: 88, vol: 0.35 } : { t: at(f), kind: 'thud', vol: Math.min(1.2, 0.3 + m.kg / 20) });
    }
    off += m.frames.length;
  });
  const first = rounds.find((m) => BROKE.includes(m.word));
  st = { canvas, ctx: canvas.getContext('2d'), rounds, list, events, first, img: new Image() };
  return list.length;
};

function hook(ctx, m) {
  const fade = ctx.createLinearGradient(0, 0, 0, 520);
  fade.addColorStop(0, 'rgba(8,7,26,0.72)');
  fade.addColorStop(0.7, 'rgba(8,7,26,0.4)');
  fade.addColorStop(1, 'rgba(8,7,26,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, 520);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 18;
  HOOK.forEach((line, i) => {
    const text = line.toUpperCase();
    fit(ctx, text, 900, 88, W - 120);
    ctx.fillStyle = i === 1 ? ACCENT : '#ffffff';
    ctx.fillText(text, W / 2, 210 + i * 98);
  });
  ctx.shadowBlur = 0;
  const pills = [`Шарик: ${m.label}`, `Раунд ${m.round + 1} из ${st.rounds.length}`];
  ctx.font = `800 38px ${DISPLAY}`;
  const ws = pills.map((p) => ctx.measureText(p).width + 60);
  let x = (W - ws.reduce((a, b) => a + b, 0) - 16) / 2;
  const y = 350;
  pills.forEach((p, i) => {
    ctx.fillStyle = 'rgba(30,28,58,0.9)';
    ctx.beginPath();
    ctx.roundRect(x, y, ws[i], 70, 35);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(p, x + 30, y + 49);
    x += ws[i] + 16;
  });
}

function tag(ctx, m, fr, alpha) {
  const [bx, by, br] = fr.ball;
  const text = m.label;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${br < 40 ? 72 : 64}px ${DISPLAY}`;
  const w = ctx.measureText(text).width;
  let x = bx + br + 26;
  let align = 'left';
  if (x + w > W - 30) {
    x = bx - br - 26;
    align = 'right';
  }
  let y = by + 24;
  if (x - w < 30 || y < 540) {
    // a huge ball fills the top of the frame: put its weight under the pills
    x = Math.min(W - 60, Math.max(60, bx));
    y = Math.max(y, 560);
    align = 'center';
  }
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(8,7,26,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = ACCENT;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function stamp(ctx, word, since) {
  const k = Math.min(1, since / 0.18);
  const s = 0.6 + 0.4 * k + Math.sin(Math.min(1, since / 0.3) * Math.PI) * 0.15;
  ctx.save();
  ctx.translate(W / 2, 960);
  ctx.rotate(-0.06);
  ctx.scale(s, s);
  const text = word.toUpperCase();
  ctx.font = `900 120px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20;
  ctx.strokeStyle = 'rgba(8,7,26,0.88)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = TIER[word].color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function banner(ctx, alpha) {
  const lines = st.first ? ['Арбуз сдался', `на ${st.first.label}`] : ['Арбуз выдержал', 'даже тонну'];
  const color = st.first ? TIER[st.first.word].color : '#3ddc6f';
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  const y = 1180;
  ctx.fillStyle = 'rgba(8,7,26,0.84)';
  ctx.beginPath();
  ctx.roundRect(90, y - 120, W - 180, 250, 40);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    fit(ctx, text, 900, i === 0 ? 64 : 84, W - 260);
    ctx.fillStyle = i === 0 ? '#ffffff' : color;
    ctx.fillText(text, W / 2, y - 30 + i * 100);
  });
  ctx.restore();
}

// draws video frame g over the given Blender image (a data URL)
window.frame = async (g, src) => {
  const { ctx, list, rounds } = st;
  const { r, f } = list[g];
  const m = rounds[r];
  const fr = m.frames[f];
  st.img.src = src;
  await st.img.decode();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(st.img, 0, 0, W, H);
  hook(ctx, m);
  if (f < m.impact) tag(ctx, m, fr, Math.min(1, f / 6));
  const last = r === rounds.length - 1;
  const since = (f - m.impact) / m.fps;
  if (since >= 0 && !(last && since > BANNER_AFTER)) stamp(ctx, m.word, since);
  if (last && since > BANNER_AFTER) banner(ctx, (since - BANNER_AFTER) * 3);
  let dark = 0;
  if (!last && f >= m.frames.length - FADE_OUT) dark = (f - (m.frames.length - FADE_OUT) + 1) / FADE_OUT;
  if (r > 0 && f < FADE_IN) dark = Math.max(dark, 1 - f / FADE_IN);
  if (dark > 0) {
    ctx.fillStyle = `rgba(6,5,18,${(dark * 0.92).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  return st.canvas.toDataURL('image/jpeg', 0.94).split(',')[1];
};

window.renderAudio = async () => {
  const total = st.list.length / st.rounds[0].fps + 0.8;
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  const master = ctx.createGain();
  master.gain.value = 0.32;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  for (const e of st.events) {
    if (e.tone) playTone(ctx, master, midiToFreq(e.tone), e.vol, 'bell', e.t);
    else playCrash(ctx, master, e.kind, e.vol, e.t);
  }
  const buf = await ctx.startRendering();
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  w(36, 'data');
  out.setUint32(40, n * 4, true);
  let o = 44;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 2; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i]));
      peak = Math.max(peak, Math.abs(v));
      out.setInt16(o, v * 32767, true);
      o += 2;
    }
  }
  let bin = '';
  const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { wav: btoa(bin), events: st.events.length, peak };
};
