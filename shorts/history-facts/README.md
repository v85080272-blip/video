# Исторические факты: ролики 1080×1920 в облаке без видеокарты

Формат как у референсов vla: история примерно за минуту, кинематографичные кадры, голос рассказчика,
крупные субтитры по словам и обложка, которая совпадает с первым кадром ролика.

Первая серия: «Что взорвалось над Сибирью?» (Тунгусский взрыв, 30 июня 1908), 62 с, 22 плана.
Готовые файлы: `/mnt/project-files/videos/tunguska-1908.mp4`, обложки `tunguska-1908-cover.jpg`
и запасная `tunguska-1908-cover-b.jpg` («Взрыв без воронки»). Подпись: `tunguska/caption_tunguska.txt`.

## Из чего собирается серия

| Шаг | Чем | Где |
|---|---|---|
| Факты и сценарий | WebSearch, проверка каждой строки | `tunguska/script_v2.json`, `tunguska/factcheck.md`, `tunguska/format.md` |
| Кадры | SDXL RealVisXL V5.0 Lightning (openrail++, коммерция разрешена) в stable-diffusion.cpp на процессоре; VAE декодирует ONNX Runtime | `gen/` |
| Глубина для 3D-параллакса | Depth Anything V2 Small (ONNX, Apache-2.0) | `render/depth.py` |
| Камера, частицы, свет, субтитры, карточки, обложка | свой рендер на numpy + Pillow | `render/engine.py`, `render/film.py` |
| Голос | VoxCPM2 (Apache-2.0) через llama.cpp-omni, клон `voice/narrator.wav`, по 3–6 дублей на фразу, проверка Whisper | `voice/` (инструменты из ветки `claude/neural-voices-s8ob8u`, папка `shorts/voxcpm2/`) |
| Тайминг субтитров | слова Whisper из `voice/lines_manifest.json` (`script_words`), запасной вариант — по слогам | `render/captions.py` |
| Звуки и подложка | синтез с нуля на numpy, без чужих сэмплов и музыки | `sfx/make_sfx.py` |
| Сведение | ducking под голос (подложка −12 дБ, удары −10 дБ), −14 LUFS, −1 dBTP | `render/mix.py` |

## Подводные камни (облако, 4 ядра, 14,3 ГБ на все процессы)

- **q8_0 для SDXL сломан**: конвертация `sd-cli -M convert --type q8_0` даёт чистый шум. Берём `RealVisXL_V5.0_Lightning_fp16.safetensors` как есть, с `--mmap`.
- **VAE в ggml медленный и жрёт память** (768×1344 без тайлинга вырос до 9 ГБ и был убит OOM вместе с голосом). Поэтому sd.cpp пропатчен (`gen/sdcpp-dump-latent.patch`): при `SD_DUMP_LATENT=путь` он пишет латент и выходит, а декодирует `gen/vae_decode.py` через ONNX Runtime (VAE из `stabilityai/stable-diffusion-xl-base-1.0/vae_decoder/model.onnx`), в 5 раз быстрее.
- **Не запускать два тяжёлых процесса по 4 потока**: ggml крутит потоки в ожидании, и при пересечении всё замедляется в разы. Голос и картинки делят ядра по 2 потока (`gen/threads.txt`).
- Скорость: кадр 640×1120, 5 шагов, 2 потока рядом с синтезом голоса — около 5,5–6 минут; один на 4 потока — около 2,5 минут.
- **Что Lightning за 5 шагов не умеет**: «поваленный лес с высоты» выходит мутной кашей (3 попытки). Работают вид с земли на поваленные стволы (`s08c`) и подсказка «forest blowdown like the Mount St. Helens blast zone» (`s08d`). Если на дальнем плане нужен взрыв, деревня рядом с ним превращается в эпицентр: лучше без деревни, «on the distant horizon».
- Фиолетовая кайма на хвое лечится в грейде: `demagenta` в `engine.grade`.
- **Проверка разборчивости**: Whisper по всему ролику иногда пропускает целые фразы даже на чистом голосе; при сомнении режем на куски по 8–10 с и сравниваем с дорожкой одного голоса (`mix.build()` отдаёт шины отдельно).
- PyPI и npm закрыты в окружении «Голоса», поэтому всё на том, что уже стоит: numpy, Pillow, onnxruntime, ffmpeg, шрифты Inter.

## Как сделать новую серию

1. Сценарий: 12–14 коротких фраз, ~130 слов, первая фраза с годом и цифрой, в конце открытый вопрос (не «пиши 1/2/3» — Инстаграм режет такое как накрутку).
2. `gen/shots.json`: по кадру на фразу, промпт на английском; `python3 gen/gen.py gen/shots.json` (повторный запуск пропускает готовые).
3. Голос: `voice/server.txt` (кастинг, дубли, выбор, экспорт в `voice/lines/L*.wav` и `manifest.json`).
4. В `render/film.py` поменять `DISPLAY` (текст субтитров, `65{шестьдесят пять}` = как произносится) и раскладку кадров в `build_timeline()`: склейки ставятся на слова (`word_t`, `word_before`), длинные фразы режутся на два плана одного кадра.
5. `WORKERS=4 bash render/assemble.sh out.mp4` (кадры, сведение, склейка; около 5 минут на 62 с), затем сжатие для телефона:
   `ffmpeg -i out.mp4 -c:v libx264 -preset slow -crf 20 -maxrate 8M -bufsize 16M -pix_fmt yuv420p -c:a copy -movflags +faststart final.mp4`.
6. Обложки: `python3 render/cover.py cover.jpg A` и `... cover-b.jpg B`.
