Сгенерируй 8 фотореалистичных картинок для вертикального ролика «Радиоактивные кабаны Германии» (YouTube Shorts) и сохрани их в папку shorts/radioactive-boars/img: файлы 01.jpg … 08.jpg (см. «Качество»).

Требования ко всем картинкам:
- вертикально 9:16;
- фотореалистично, как кадр из документального фильма: естественный свет, лёгкое плёночное зерно;
- никакого текста, букв, цифр, номеров, табличек и логотипов на картинке (на приборах — без читаемых цифр);
- лица людей не показывать: защитные костюмы, респираторы, вид со спины или сбоку, только руки в перчатках;
- без крови, ран и мёртвых животных.

Качество (важно — кадры потом приближаются камерой, поэтому нужна чёткость):
- генерируй в максимальном разрешении и максимальном качестве, какие даёт Codex;
- затем увеличь каждый кадр ИИ-апскейлером Real-ESRGAN (realesrgan-ncnn-vulkan, модель realesrgan-x4plus; Windows-сборка лежит в релизах github.com/xinntao/Real-ESRGAN), а не простым растягиванием;
- приведи к ровно 2160×3840 (9:16, лишнее обрежь по краям) и сохрани как JPG с качеством 92: 01.jpg, 02.jpg … (PNG такого размера слишком тяжёлые для git);
- просмотри каждый кадр в увеличении: лишние пальцы, кривые лица, буквы и логотипы — перегенерируй.

К каждому запросу ниже добавь в начало: "Photorealistic cinematic nature documentary still, vertical 9:16, Bavaria Germany forest, natural light, film grain, no text, no letters, no logos."

01.jpg — A big wild boar standing in a dark misty pine forest at dusk, looking straight at the camera, tense and mysterious
02.jpg — A wild boar digging in the forest soil with its snout, earth flying, close-up, roots and small round underground mushrooms visible in the dug soil
03.jpg — Heavy dark rain clouds over a European pine forest, rain falling, spring 1986 mood, gloomy
04.jpg — Black-and-white archival look: a distant mushroom cloud of a 1960s atmospheric nuclear test over a flat desert, film grain, no people
05.jpg — Cross-section of forest soil with round brown deer truffles (underground fungi) among roots, macro close-up
06.jpg — Laboratory: gloved hands placing a small plastic container with a meat sample into a grey cylindrical radiation detector, no readable displays
07.jpg — A forester in a green jacket walking along a forest path with a hunting dog, seen from behind, autumn Bavarian forest
08.jpg — Calm forest clearing at sunrise: a wild boar mother walking with several striped piglets, peaceful

Кадр 01 — обложка: он должен цеплять сразу. Когда закончишь, проверь, что в папке shorts/radioactive-boars/img ровно 8 файлов 2160×3840, сделай коммит и запушь в ветку claude/real-stories.
