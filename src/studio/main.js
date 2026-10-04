// Trend Studio page: tabs, generated controls, the preview loop and recording.

import { W, H, DT, sound, SILENT } from './core.js';
import { survive } from './survive.js';
import { odd } from './odd.js';
import { pause } from './pause.js';

const FORMATS = [survive, odd, pause];
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const state = Object.fromEntries(
  FORMATS.map((f) => [f.id, { params: Object.fromEntries(f.fields.map((x) => [x.id, x.value])), seed: 1 + Math.floor(Math.random() * 9999) }]),
);
let fmt = FORMATS.find((f) => '#' + f.id === location.hash) || FORMATS[0];
let sim;
let hold = 0;
let recording = null;
let lastClip = null;
let lenTimer = 0;

let saver = null;
window.claude?.use?.('downloads').then((d) => (saver = d)).catch(() => {});

const cur = () => state[fmt.id];

// ---------- controls ----------

function renderTabs() {
  $('tabs').innerHTML = FORMATS.map(
    (f) => `<button type="button" class="tab" data-id="${f.id}" aria-current="${f === fmt}">${f.tab}</button>`,
  ).join('');
}

function fill(input) {
  const f = (input.value - input.min) / (input.max - input.min);
  input.style.setProperty('--p', (f * 100).toFixed(1) + '%');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtNum = (v) => String(v).replace('.', ',');

function renderFields() {
  const p = cur().params;
  $('fields').innerHTML = fmt.fields
    .filter((f) => !f.when || f.when(p))
    .map((f) => {
      const id = `f-${f.id}`;
      if (f.type === 'range') {
        return `<div class="field"><label for="${id}">${f.label}<output id="o-${f.id}">${fmtNum(p[f.id])}${f.unit}</output></label>
          <input type="range" id="${id}" data-k="${f.id}" min="${f.min}" max="${f.max}" step="${f.step}" value="${p[f.id]}"></div>`;
      }
      if (f.type === 'select') {
        return `<div class="field"><label for="${id}">${f.label}</label><select id="${id}" data-k="${f.id}">${f.options
          .map(([v, n]) => `<option value="${v}"${v === p[f.id] ? ' selected' : ''}>${n}</option>`)
          .join('')}</select></div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="field wide"><label for="${id}">${f.label}</label><textarea id="${id}" data-k="${f.id}">${esc(p[f.id])}</textarea></div>`;
      }
      return `<div class="field wide"><label for="${id}">${f.label}</label><input type="text" id="${id}" data-k="${f.id}" value="${esc(p[f.id])}"></div>`;
    })
    .join('');
  document.querySelectorAll('#fields input[type="range"]').forEach(fill);
}

function selectFormat(f) {
  if (recording) return;
  fmt = f;
  history.replaceState(null, '', '#' + f.id);
  renderTabs();
  $('title').textContent = f.tab;
  $('lede').textContent = f.blurb.split('. ')[0] + '.';
  $('why').innerHTML = `<b>Почему зайдёт.</b> ${esc(f.blurb)}`;
  $('find').hidden = !f.search;
  $('seed').value = cur().seed;
  renderFields();
  restart();
  updateLength();
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) selectFormat(FORMATS.find((f) => f.id === b.dataset.id));
});

window.addEventListener('hashchange', () => {
  const f = FORMATS.find((x) => '#' + x.id === location.hash);
  if (f && f !== fmt) selectFormat(f);
});

$('fields').addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const def = fmt.fields.find((f) => f.id === k);
  const p = cur().params;
  p[k] = def.type === 'range' ? Number(e.target.value) : e.target.value;
  if (def.type === 'range') {
    fill(e.target);
    $('o-' + k).textContent = fmtNum(p[k]) + def.unit;
  }
  // a select can change which fields show and refill the hook text
  if ((fmt.onChange && fmt.onChange(k, p)) || def.type === 'select') renderFields();
  restart();
  updateLength();
});

$('seed').addEventListener('change', () => {
  const v = parseInt($('seed').value, 10);
  if (v > 0) cur().seed = v;
  $('seed').value = cur().seed;
  restart();
  updateLength();
});

$('dice').addEventListener('click', () => {
  cur().seed = 1 + Math.floor(Math.random() * 99999);
  $('seed').value = cur().seed;
  restart();
  updateLength();
});

$('find').addEventListener('click', () => {
  const btn = $('find');
  btn.disabled = true;
  btn.textContent = 'Подбираю…';
  setTimeout(() => {
    const best = fmt.search(cur().params, 1 + Math.floor(Math.random() * 90000));
    cur().seed = best.seed;
    $('seed').value = best.seed;
    btn.disabled = false;
    btn.textContent = 'Подобрать сид';
    restart();
    updateLength();
  }, 30);
});

$('sound').addEventListener('click', () => {
  const on = sound.toggle();
  $('sound').setAttribute('aria-pressed', on);
  $('sound').textContent = on ? 'Звук вкл' : 'Звук выкл';
});

canvas.addEventListener('click', () => !recording && restart());

// clip length: known up front for most formats, simulated for the battle
function updateLength() {
  clearTimeout(lenTimer);
  lenTimer = setTimeout(() => {
    const s = fmt.create(cur().params, cur().seed, SILENT);
    let len = s.len;
    if (!len) {
      let guard = 0;
      while (!s.over && guard++ < 120 / DT) s.step(DT);
      len = s.t;
    }
    $('status').textContent = `Ролик ≈ ${len.toFixed(1).replace('.', ',')} с`;
  }, 120);
}

// ---------- recording ----------

function pickMime() {
  const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function startRecording() {
  const note = $('recnote');
  if (!canvas.captureStream || !window.MediaRecorder) {
    note.textContent = 'Этот браузер не умеет записывать видео. Открой страницу в Chrome на компьютере.';
    $('recout').hidden = false;
    return;
  }
  restart();
  const stream = canvas.captureStream(60);
  if (sound.on && sound.dest) stream.addTrack(sound.dest.stream.getAudioTracks()[0]);
  const mime = pickMime();
  let rec;
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16_000_000 } : undefined);
  } catch {
    note.textContent = 'Не получилось начать запись в этом браузере.';
    $('recout').hidden = false;
    return;
  }
  const base = `${fmt.id}-${cur().seed}`;
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    if (lastClip) URL.revokeObjectURL(lastClip.url);
    lastClip = { blob, url: URL.createObjectURL(blob), filename: `${base}.${ext}` };
    $('recvideo').src = lastClip.url;
    $('recdl').textContent = `Скачать ${ext.toUpperCase()}`;
    note.textContent = ext === 'webm'
      ? 'Браузер записал WebM. TikTok его принимает, для Instagram лучше перегнать в MP4.'
      : 'Готово: MP4 1080×1920, можно сразу загружать.';
    $('recout').hidden = false;
  };
  rec.start(250);
  recording = rec;
  $('rec').textContent = 'Остановить запись';
  $('rec').classList.add('live');
}

function stopRecording() {
  if (!recording) return;
  recording.stop();
  recording = null;
  $('rec').textContent = 'Записать ролик';
  $('rec').classList.remove('live');
}

$('rec').addEventListener('click', () => (recording ? stopRecording() : startRecording()));

$('recdl').addEventListener('click', async () => {
  if (!lastClip) return;
  if (saver) {
    try {
      await saver.save({ filename: lastClip.filename, data: lastClip.blob });
    } catch (e) {
      if (e && e.code !== 'declined') $('recnote').textContent = 'Не удалось сохранить файл здесь. Открой студию локально через npm run dev.';
    }
    return;
  }
  const a = document.createElement('a');
  a.href = lastClip.url;
  a.download = lastClip.filename;
  document.body.append(a);
  a.click();
  a.remove();
});

// ---------- loop ----------

function restart() {
  sim = fmt.create(cur().params, cur().seed, sound);
  hold = 0;
  acc = 0;
}

let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (sim.over) {
    if (recording) stopRecording();
    hold += dt;
    if (hold > 1.2) restart();
  } else {
    acc += dt;
    while (acc >= DT && !sim.over) {
      sim.step(DT);
      acc -= DT;
    }
  }
  sim.draw(ctx);
  requestAnimationFrame(frame);
}

// draw only once the display font is in, or the first frames use a fallback
const fontsReady = document.fonts ? Promise.race([document.fonts.load('900 80px Rubik'), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
fontsReady.then(() => {
  selectFormat(fmt);
  requestAnimationFrame(frame);
});
