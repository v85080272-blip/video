# Shorts на HyperFrames

Генераторы роликов 1080×1920 без нейросетей: HTML + GSAP, рендер через [HyperFrames](https://github.com/heygen-com/hyperframes) (движок, на котором сделан brag).

- `tools/gen-quiz.mjs` — «Угадай мультфильм по эмодзи», 5 уровней с таймером.
- `tools/gen-months.mjs` — «Какой ты по месяцу рождения», 12 карточек, челлендж «останови видео».
- `tools/sfx.py` — звуковая дорожка (бит + тики, дзынь, фанфары) по списку событий.

## Сборка

```bash
npx hyperframes@0.8.127 init my-quiz --example blank --resolution portrait --non-interactive
# в my-quiz/assets: gsap.min.js (npm gsap@3.14.2), шрифты @fontsource/rubik и @fontsource/unbounded
# (cyrillic+latin, 700/900), NotoColorEmoji.ttf из /usr/share/fonts/truetype/noto
node shorts/tools/gen-quiz.mjs my-quiz
python3 shorts/tools/sfx.py my-quiz/events.json my-quiz/assets/sfx.wav 26.4
cd my-quiz && npx hyperframes@0.8.127 render -o out/quiz.mp4
```

GSAP и шрифты должны лежать локально: в облачном контейнере браузер рендера не ходит в CDN.
Чтобы сделать новый выпуск, поменяйте массив `L` (эмодзи и ответы) или `M` (месяцы и черты).
