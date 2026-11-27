Сгенерируй 8 фотореалистичных картинок для вертикального ролика «Грибок из реактора» (YouTube Shorts) и сохрани их в папку shorts/chernobyl-fungus/img: файлы 01.jpg … 08.jpg (см. «Качество»).

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

К каждому запросу ниже добавь в начало: "Photorealistic cinematic documentary still, vertical 9:16, Chernobyl exclusion zone, natural light, film grain, no text, no letters, no logos."

01.jpg — Extreme close-up of black fungus mold spreading across a cracked concrete wall inside a dark abandoned reactor building, a thin beam of light falling on it, ominous and mysterious
02.jpg — Destroyed abandoned industrial room inside the Chernobyl reactor building, collapsed debris, rusty pipes, dust in a beam of light, no people
03.jpg — A researcher in a white protective suit, respirator and gloves scraping black mold from a concrete wall into a small sample tube with a long tool, seen from the side, face fully covered, dim light
04.jpg — Microscope view of dark brown and black melanized fungal threads (hyphae), scientific microscopy image, high detail
05.jpg — Clean laboratory bench with several petri dishes holding black fungal colonies next to a heavy grey lead-shielded container, gloved hands, cool white light
06.jpg — Two petri dishes side by side on a dark bench: the left one with a large black fungal colony, the right one with a small one, clear comparison, soft light
07.jpg — Close-up of a human forearm and hand with freckles and tanned skin in warm sunlight, natural skin texture
08.jpg — Black fungus growing in a crack of an old concrete wall lit by a single thin beam of sunlight, quiet and mysterious

Кадр 01 — обложка: он должен цеплять сразу. Когда закончишь, проверь, что в папке shorts/chernobyl-fungus/img ровно 8 файлов 2160×3840, сделай коммит и запушь в ветку claude/real-stories.
