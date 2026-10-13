# «Последний лист», серия 1

3D-мультик в мире, где всё из листьев: лист Лёва вцепился в веточку и кричит, что он последний лист на дереве; гусеница Гоша сомневается, камера отъезжает — дерево целиком в листьях. Гоша решает съесть «самого вкусного», ветер срывает Лёву, Гоше достаётся веточка: «Ладно. Тут ещё тысяча.» Финал: «Куда улетит Лёва? Пиши в комментах».

Сцена на three.js (≈9500 листьев в кроне, летящие листья, пыльца, лучи), рендер в headless Chromium через SwiftShader, 1080×1920, 30 к/с, 22,5 с. Голоса RHVoice (офлайн), рот двигается по громкости фразы. Звук — синтез в `mix.py`.

```bash
npm i                                   # three, playwright-core
apt-get install rhvoice rhvoice-russian # голоса
python3 tts.py                          # реплики → out/tts_*.wav, огибающие рта в story.json
node render.mjs --shot 1,7.8,13.7       # проверочные кадры в out/stills
node render.mjs --from 0 --to 11.25 --out out/p1.mp4 & node render.mjs --from 11.25 --to 22.5 --out out/p2.mp4
python3 mix.py
ffmpeg -f concat -safe 0 -i list.txt -i out/mix.wav -map 0:v -map 1:a -c:v copy -af loudnorm=I=-14:TP=-1.5 -c:a aac -b:a 192k listopad-seriya1.mp4
```

Тайминги реплик, событий и порывов ветра — в `story.json`, его читают и картинка, и звук. Путь к Chromium задаётся `CHROME=...`.
