Сгенерируй 8 фотореалистичных картинок для вертикального ролика «ДНК червей Чернобыля» (YouTube Shorts) и сохрани их в папку shorts/chernobyl-worms/img: файлы 01.jpg … 08.jpg (см. «Качество»).

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

К каждому запросу ниже добавь в начало: "Photorealistic cinematic science documentary still, vertical 9:16, Chernobyl exclusion zone, natural light, no text, no letters, no logos."

01.jpg — Extreme macro of a tiny translucent nematode worm on a dark background, glowing softly, scientific and eerie
02.jpg — A gloved hand holding an old Geiger counter over the forest floor in the Chernobyl zone, no readable digits
03.jpg — Gloved hand scooping soil and rotting leaves into a small sample tube in a forest, close-up
04.jpg — Macro of rotting fruit and leaf litter on moist soil where tiny worms live, detailed
05.jpg — Laboratory microscope with a petri dish under it, cool light, gloved hands
06.jpg — Microscope view of many small transparent nematode worms moving on agar
07.jpg — Abstract glowing blue DNA double helix in darkness, scientific visualization, no text
08.jpg — Sunlit forest floor in the Chernobyl zone with moss and fallen leaves, calm

Кадр 01 — обложка: он должен цеплять сразу. Когда закончишь, проверь, что в папке shorts/chernobyl-worms/img ровно 8 файлов 2160×3840, сделай коммит и запушь в ветку claude/real-stories.
