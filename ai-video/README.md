# ИИ-видео

Промпты для Seedance и Kling по шаблонам [awesome-seedance](https://github.com/LearnPrompt/awesome-seedance), плюс скрипт генерации через fal.

- `prompts/*.txt` — готовые промпты, 9:16, 15 с: «Морозилка» (3D-мультик), «Бабушкина банка» (комедия с поворотом), «Кассета 1996» (VHS-плёнка).
- `fal-generate.mjs` — ставит задачу в очередь fal, ждёт и сохраняет MP4.

```bash
FAL_KEY=... node ai-video/fal-generate.mjs <model-id> ai-video/prompts/vhs-1996.txt out/vhs.mp4 --duration 10
```

`<model-id>` берётся со страницы модели на fal.ai/models. Входные поля у моделей разные, поэтому лишние `--ключ значение` передаются как есть. Скрипт ещё не проверен на настоящем ключе.

В облачных тредах нужно окружение с доступом к `queue.fal.run`, `fal.run`, `fal.media`, `v3.fal.media` и переменной `FAL_KEY`.
