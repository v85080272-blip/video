# Морозилка, серия 1 «Горошек»

Мультик кодом в стиле Sci-Fi Sitcom Toon из [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (MIT): дрожащий контур, плоский цвет, бормотание вместо голоса, субтитры. 1080×1920, 24 к/с, 24 с.

Сборка (из корня клона lemo-opuscar после `setup.sh deps`; папку скопировать в `films/morozilka`, `NotoColorEmoji.ttf` положить в `fonts/`):

```bash
PLAYWRIGHT_CHROME=/path/to/chrome node core/render/video.mjs films/morozilka --fps 24 --size 1080x1920 --out films/morozilka/out/video.mp4
.venv/bin/python films/morozilka/mix.py
ffmpeg -i films/morozilka/out/video.mp4 -i films/morozilka/out/mix.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1.5 -c:a aac -shortest morozilka-ep1.mp4
```

Тайминги реплик и событий — в `story.json`, его читают и картинка, и звук. `toon.js` — движок контура из демо scifi-toon (MIT, lemomo-ai), подогнан под вертикаль.
