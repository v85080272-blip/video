# Клодик и котик у озера

3D-мультик (1080×1920, ~57 с): Клодик объясняет котику, какой уровень рассуждения (effort) брать в Claude Code под задачу.
Удочка = уровень, рыба = задача: low, medium, high, xhigh, max.

Сборка:
```
python3 tts.py      # голоса RHVoice (apt: rhvoice rhvoice-russian) → out/tts_*.wav, огибающие в story.json
python3 layout.py   # тайминги реплик и кадров по длине голосов
node render.mjs --shot 1.5,13,31 --dir out/stills       # пробные кадры
node render.mjs --from 0 --to 19 --out out/p1.mp4        # куски видео (можно параллельно)
python3 mix.py      # музыка, звуки, голоса → out/mix.wav
```
Модули: `scene.js` (озеро, мостик, персонажи), `props.js` (удочки, рыбы, всплески), `ui.js` (субтитры, панель /effort), `main.js` (таймлайн, камера, монтажный слой).
