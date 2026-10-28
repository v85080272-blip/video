"""Тайны истории №14: «Мутанты Чернобыля» (правда или миф).

vla 28.10 turned the PC on for the chain's last story, which №13's ending asks for: are there mutants in the zone?
No two-headed monsters, but forty years without people made it a wild forest (wolves, elk, wild horses); the giant
catfish is just never caught; barn swallows there carry more white spots and more mutations (Ellegren et al. 1997);
tree frogs turned almost black, because the dark pigment shields from radiation and the dark ones survived the
accident better (Burraco & Orizaola 2022), so they are animals that adapted, not monsters. The tease into the next
story: the frozen lava under the reactor, «the elephant's foot» (sources in chernobyl1986_mutanty/factcheck.md).
Voice «Историк» (h4_s52). Pictures: vla's PC (Juggernaut XL, chernobyl1986_mutanty/shots_pc.json, two seeds each);
the ids below are picked by seed once the frames are in.
"""
import numpy as np

DISPLAY = {
    'L1': 'ДВУХГОЛОВЫХ МОНСТРОВ В ЧЕРНОБЫЛЕ НЕТ. НО КОЕ-КТО ТАМ ПРАВДА ИЗМЕНИЛСЯ.',
    'L2': 'ЛЮДИ УШЛИ, И ЗА СОРОК ЛЕТ ЗОНА СТАЛА ДИКИМ ЛЕСОМ.',
    'L3': 'ТАМ ЖИВУТ ВОЛКИ, ОЛЕНИ, КАБАНЫ И ДАЖЕ ДИКИЕ ЛОШАДИ.',
    'L4': 'А ОГРОМНЫЙ СОМ У СТАНЦИИ НЕ МУТАНТ: ЕГО ПРОСТО НИКТО НЕ ЛОВИТ.',
    'L5': 'ЗАТО У ЛАСТОЧЕК ТАМ ЧАЩЕ БЫВАЮТ БЕЛЫЕ ПЯТНА НА ПЕРЬЯХ И БОЛЬШЕ МУТАЦИЙ.',
    'L6': 'А ДРЕВЕСНЫЕ ЛЯГУШКИ В ЗОНЕ СТАЛИ ПОЧТИ ЧЁРНЫМИ.',
    'L7': 'ТЁМНЫЙ ПИГМЕНТ ЗАЩИЩАЕТ ОТ РАДИАЦИИ, И ПОСЛЕ АВАРИИ ЧАЩЕ ВЫЖИВАЛИ ТЁМНЫЕ ЛЯГУШКИ.',
    'L8': 'ТАК ЧТО МУТАНТЫ ТАМ ЕСТЬ, НО ЭТО НЕ МОНСТРЫ, А ЖИВОТНЫЕ, КОТОРЫЕ ПРИСПОСОБИЛИСЬ.',
    'L9': 'А ПОД РЕАКТОРОМ ДО СИХ ПОР ЛЕЖИТ ЗАСТЫВШАЯ ЛАВА. ЕЁ ПРОЗВАЛИ СЛОНОВЬЕЙ НОГОЙ.',
    'L10': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'ДВУХГОЛОВЫХ', 'МОНСТРОВ', 'НЕТ.', 'ИЗМЕНИЛСЯ.', 'СОРОК', 'ДИКИМ', 'ЛЕСОМ.', 'ВОЛКИ,', 'ОЛЕНИ,', 'КАБАНЫ',
          'ЛОШАДИ.', 'СОМ', 'МУТАНТ:', 'ЛОВИТ.', 'ЛАСТОЧЕК', 'БЕЛЫЕ', 'ПЯТНА', 'МУТАЦИЙ.', 'ЛЯГУШКИ',
          'ЧЁРНЫМИ.', 'ПИГМЕНТ', 'ЗАЩИЩАЕТ', 'ВЫЖИВАЛИ', 'ТЁМНЫЕ', 'МУТАНТЫ', 'МОНСТРЫ,', 'ПРИСПОСОБИЛИСЬ.',
          'ЛАВА.', 'СЛОНОВЬЕЙ', 'НОГОЙ.'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L1 the hook settles, after L6 the black frogs land, after L9 the tease hangs before the plaque
GAPS = {'L1': 0.6, 'L2': 0.2, 'L3': 0.3, 'L4': 0.3, 'L5': 0.3, 'L6': 0.5, 'L7': 0.3, 'L8': 0.4, 'L9': 0.6,
        'L10': 0.0}
GAP_MAX = 0.3
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №14', year='1986', lines=['МУТАНТЫ', 'ЧЕРНОБЫЛЯ'],
             # the preview cover (thumb.py, chernobyl1986_mutanty/thumbs.json) in the first frames, so YouTube's frame
             # picker can take it; the other variant sits next to it in covers/
             img='/mnt/project-files/history-facts/chernobyl1986_mutanty/covers/mutanty.jpg')
COVER_B = ['ЛЯГУШКИ', 'СТАЛИ ЧЁРНЫМИ']
# the narrator says the plaque's words (L10, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №14', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json, Juggernaut XL), chosen by seed; where a shot comes twice, the second seed gives
# the second appearance a new picture. FROG3 is №13's frog (same prompt), copied into this episode's shots
WOLVES = 'm01_wolves_s5001'          # wolves coming out of the fog by an overgrown block, eyes glinting
WOLVES2 = 'm01_wolves_s5002'         # the same, for «волки»
CITY = 'm02_overgrown_city_s5011'    # the city swallowed by forest, from above
CITY2 = 'm02_overgrown_city_s5012'   # the same, for the plaque
ELK = 'm03_elk_s5021'                # an elk in an overgrown village street, for «олени»
BOARS = 'm04_boars_s5031'            # wild boars by the abandoned kindergarten
HORSES = 'm05_horses_s5041'          # Przewalski's horses grazing by an empty building
HORSES2 = 'm05_horses_s5042'         # the same, for «животные, которые приспособились»
CATFISH = 'm06_catfish_s5051'        # a huge catfish at the surface of the canal
CATFISH2 = 'm06_catfish_s5052'       # the same, for «его просто никто не ловит»
SWALLOW = 'm07_swallow_s5061'        # a barn swallow on a wire
SWALLOW2 = 'm07_swallow_s5062'       # the same, for «белые пятна»
FROG = 'm08_frog_black_s5071'        # the almost black tree frog
FROG2 = 'm08_frog_black_s5072'       # the same, for the hook's «кое-кто изменился»
FROG3 = 'b12_frog_s4112'             # №13's black frog, for «выживали тёмные лягушки»
GREEN = 'm09_frog_green_s5081'       # a bright green tree frog, as frogs are outside the zone
SCIENTIST = 'm10_scientist_s5091'    # a scientist in a white suit with a dark frog at night
SHELTER = 'm12_shelter_s5111'        # the steel arch over the reactor at dusk
LAVA = 'm11_elephant_foot_s5101'     # the frozen black lava in the basement, a flashlight beam
LAVA2 = 'm11_elephant_foot_s5102'    # the same, for «слоновьей ногой»
SFX_DIRS = ['/home/user/work/sfx/mutanty', '/home/user/work/sfx/babushki', '/home/user/work/sfx/chernobyl',
            '/home/user/work/sfx/rescue', '/home/user/work/sfx/olga', '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 70.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT                 # every music loop of the kit is 4 bars
SR = 48000


def _wt(words, lines, lid, prefix, nth=0):
    k = 0
    for w, a, b in words[lid]:
        if w.startswith(prefix):
            if k == nth:
                return a
            k += 1
    return lines[lid]['start']


def plan(lines, words):
    """Music sections and sync points shared by the picture (camera beats) and the mix."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)
    p['twohead'] = wt('L1', 'ДВУХГОЛОВЫХ')
    p['none'] = wt('L1', 'НЕТ')
    p['but'] = wt('L1', 'НО')
    p['changed'] = wt('L1', 'ИЗМЕНИЛСЯ')
    p['forty'] = wt('L2', 'СОРОК')
    p['forest'] = wt('L2', 'ДИКИМ')
    p['wolves'] = wt('L3', 'ВОЛКИ')
    p['elk'] = wt('L3', 'ОЛЕНИ')
    p['even'] = wt('L3', 'ДАЖЕ')
    p['catfish'] = wt('L4', 'СОМ')
    p['notmut'] = wt('L4', 'МУТАНТЫ')
    p['them'] = wt('L4', 'ЕГО')
    p['swallows'] = wt('L5', 'ЛАСТОЧЕК')
    p['spots'] = wt('L5', 'БЕЛЫЕ')
    p['mutations'] = wt('L5', 'МУТАЦИЙ')
    p['frogs'] = wt('L6', 'ЛЯГУШКИ')
    p['became'] = wt('L6', 'СТАЛИ')
    p['black'] = wt('L6', 'ЧЁРНЫМИ')
    p['pigment'] = wt('L7', 'ПИГМЕНТ')
    p['after'] = wt('L7', 'ПОСЛЕ')
    p['survived'] = wt('L7', 'ВЫЖИВАЛИ')
    p['mutants'] = wt('L8', 'МУТАНТЫ')
    p['animals'] = wt('L8', 'ЖИВОТНЫЕ')
    p['adapted'] = wt('L8', 'ПРИСПОСОБИЛИСЬ')
    p['lava'] = wt('L9', 'ЗАСТЫВШАЯ')
    p['named'] = wt('L9', 'ЕЁ')
    p['foot'] = wt('L9', 'СЛОНОВЬЕЙ')
    p['sub'] = lines['L10']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    zone = dict(exposure=-0.02, contrast=1.1, sat=0.65, warm=-0.05, demagenta=0.3)       # the zone, cold
    wild = dict(exposure=0.03, contrast=1.06, sat=0.9, warm=0.3, demagenta=0.2)          # the animals, alive
    night = dict(exposure=-0.03, contrast=1.12, sat=0.75, warm=-0.1, demagenta=0.3)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)

    # L1 hook: «двухголовых монстров нет» on the wolves in the fog; «но кое-кто правда изменился» on the black frog
    bt = p['but'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(WOLVES, 0.0, bt, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=20, fog=0.2, beat=[hook], punch=[(p['twohead'], 0.06), (p['none'], 0.05)], grade=zone))
    add(FROG2, bt, l2, into='flash', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.05)),
        fx=dict(dust=8, beat=[hook], punch=[(p['changed'], 0.06)], grade=night))
    # L2 people gone, forty years, a wild forest
    l3 = L('L3')['start'] - 0.08
    add(CITY, l2, l3, into='fade', cam=dict(zoom=(1.0, 1.1), pany=(0.02, -0.02), parx=(-8, 8)),
        fx=dict(dust=10, punch=[(p['forest'], 0.05)], grade=wild))
    # L3 wolves, deer, boars and even wild horses
    ek = p['elk'] - 0.06
    ev = p['even'] - 0.06
    l4 = L('L4')['start'] - 0.08
    add(WOLVES2, l3, ek, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04), parx=(-6, 6)),
        fx=dict(dust=12, fog=0.15, punch=[(p['wolves'], 0.04)], grade=zone))
    add(ELK, ek, ev, into='flash', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02)),
        fx=dict(dust=12, fog=0.15, grade=wild))
    add(HORSES, ev, l4, into='flash', cam=dict(zoom=(1.0, 1.1), panx=(0.03, -0.03), parx=(-8, 8)),
        fx=dict(dust=15, bloom=0.25, grade=wild))
    # L4 the giant catfish: not a mutant, just never caught
    th = p['them'] - 0.06
    l5 = L('L5')['start'] - 0.08
    add(CATFISH, l4, th, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05)),
        fx=dict(dust=8, punch=[(p['catfish'], 0.05)], grade=wild))
    add(CATFISH2, th, l5, into='fade', cam=dict(zoom=(1.05, 1.12), panx=(-0.02, 0.02)),
        fx=dict(dust=8, grade=wild))
    # L5 the swallows: white spots, more mutations
    sp = p['spots'] - 0.06
    l6 = L('L6')['start'] - 0.08
    add(SWALLOW, l5, sp, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=8, punch=[(p['swallows'], 0.04)], grade=wild))
    add(SWALLOW2, sp, l6, into='fade', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.05)),
        fx=dict(dust=8, punch=[(p['mutations'], 0.05)], grade=dict(wild, sat=0.8)))
    # L6 the tree frogs: a green one as they are elsewhere, then almost black on «стали почти чёрными»
    bc = p['became'] - 0.06
    l7 = L('L7')['start'] - 0.08
    add(GREEN, l6, bc, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=6, punch=[(p['frogs'], 0.04)], grade=wild))
    add(FROG, bc, l7, into='flash', cam=dict(zoom=(1.05, 1.18), dolly=(0.0, 0.05)),
        fx=dict(dust=6, punch=[(p['black'], 0.08)], grade=night))
    # L7 why: the scientist with a dark frog, then the dark ones that survived
    af = p['after'] - 0.06
    l8 = L('L8')['start'] - 0.08
    add(SCIENTIST, l7, af, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=10, punch=[(p['pigment'], 0.04)], grade=night))
    add(FROG3, af, l8, into='fade', cam=dict(zoom=(1.02, 1.12), panx=(0.02, -0.02)),
        fx=dict(dust=6, punch=[(p['survived'], 0.05)], grade=night))
    # L8 so mutants, yes, but not monsters: the boars, then the horses for «животные, которые приспособились»
    an = p['animals'] - 0.06
    l9 = L('L9')['start'] - 0.08
    add(BOARS, l8, an, into='flash', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-6, 6)),
        fx=dict(dust=12, punch=[(p['mutants'], 0.05)], grade=wild))
    add(HORSES2, an, l9, into='fade', cam=dict(zoom=(1.02, 1.1), dolly=(0.0, 0.04), parx=(-6, 6)),
        fx=dict(dust=15, bloom=0.3, punch=[(p['adapted'], 0.04)], grade=dict(wild, warm=0.45)))
    # L9 the tease: the arch over the reactor, the lava under it in the flashlight, «слоновьей ногой»
    lv = p['lava'] - 0.06
    nm = p['named'] - 0.06
    sub = p['sub'] - 0.08
    add(SHELTER, l9, lv, into='flash', cam=dict(zoom=(1.0, 1.08), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=12, grade=zone))
    add(LAVA, lv, nm, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05)),
        fx=dict(dust=25, grade=dict(night, warm=0.1)))
    add(LAVA2, nm, sub, into='fade', cam=dict(zoom=(1.05, 1.18), dolly=(0.0, 0.06)),
        fx=dict(dust=25, punch=[(p['foot'], 0.1)], grade=dict(night, warm=0.1)))
    # L10 «подпишись...»: the city in the forest takes the plaque, then a white flash loops to the cover
    add(CITY2, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02), parx=(-4, 4)),
        fx=dict(dust=10, flash=[(total - 0.3, 0.35, 2.0, white)], grade=wild))

    cards = [
        dict(text='40 ЛЕТ', start=p['forty'], end=l3 - 0.05, y=1430, count=True),
    ]
    tags = [
        dict(text='ЗОНА ОТЧУЖДЕНИЯ · 1986–2026', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='МУТАЦИЙ В 2–10 РАЗ БОЛЬШЕ', start=p['mutations'] + 0.1, end=l6 - 0.05),
        dict(text='ИССЛЕДОВАНИЕ 2022 ГОДА', start=L('L7')['start'] + 0.05, end=l8 - 0.05),
    ]
    cover = dict(start=0.0, end=p['twohead'] - 0.1)
    hook_text = dict(lines=['L1'], y=1330, size=84)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text, no_caps=['L10'])


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    p = plan(L, tl['words'])
    total = tl['total']

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: wolves and the counter in the fog, a hit on «нет», the frog's croak on «изменился»
    h0, h1 = p['hook']
    loop('beds', 'drone_bed_tension', h0, p['but'] + 0.3, -10.0, fin=0.0, fout=0.3)
    loop('beds', 'geiger', h0, p['but'], -17.0, fin=0.0, fout=0.2)
    put_hit(m, 'boom_hook', 0.02, -10.0)
    put_hit(m, 'wolf_howl', 0.05, -15.0)
    put_hit(m, 'impact_soft', p['none'], -7.0)
    put_hit(m, 'drum_big', p['but'], -7.0)
    put_hit(m, 'frog_call', p['changed'] - 0.1, -14.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['none'], p['but'], p['forest'], p['catfish'], p['black'], p['mutants'], p['lava'], p['foot'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the wild zone: morning forest and birds under L2-L5, the hopeful pad, a drum on «диким лесом»
    loop('beds', 'ambience_morning_taiga', L['L2']['start'] - 0.2, L['L6']['start'], -14.0, fin=0.4, fout=0.4)
    loop('beds', 'pad_hope', L['L2']['start'], L['L6']['start'], -11.0, fin=0.4, fout=0.4)
    put_hit(m, 'drum_big', p['forest'], -8.0)
    put_hit(m, 'wolf_howl', p['wolves'] - 0.3, -17.0)
    put_hit(m, 'hooves', p['even'] - 0.4, -13.0)
    put_hit(m, 'catfish_splash', p['catfish'] - 0.1, -11.0)
    put_hit(m, 'swallow_twitter', L['L5']['start'] - 0.1, -15.0)
    put_hit(m, 'impact_soft', p['mutations'], -9.0)
    # --- the frogs at night: the chorus, a croak close by, a drop on «чёрными», the pulse under the why
    loop('beds', 'frog_chorus', L['L6']['start'] - 0.2, L['L8']['start'], -15.0, fin=0.3, fout=0.4)
    loop('beds', 'pulse_dark', L['L6']['start'], L['L8']['start'], -11.0, fin=0.3, fout=0.3)
    put_hit(m, 'frog_call', p['frogs'], -13.0)
    put_hit(m, 'sub_drop', p['black'], -8.0)
    put_hit(m, 'drum_big', p['black'], -7.0)
    loop('beds', 'geiger', p['pigment'] - 0.2, p['after'] + 0.3, -18.0, fin=0.2, fout=0.3)
    # --- the answer: the warm pad and birds back, a drum on «мутанты», a lift on «приспособились»
    loop('beds', 'piano_sad', L['L8']['start'] - 0.1, L['L9']['start'], -10.0, fin=0.3, fout=0.4)
    loop('beds', 'ambience_morning_taiga', L['L8']['start'] - 0.1, L['L9']['start'], -16.0, fin=0.3, fout=0.4)
    put_hit(m, 'drum_big', p['mutants'], -7.0)
    put_hit(m, 'hooves', p['animals'] - 0.5, -16.0)
    # --- the tease: the basement hum and the counter, the flashlight clicks on, a hit on «слоновьей ногой»
    loop('beds', 'drone_bed_tension', L['L9']['start'] - 0.1, p['sub'], -9.0, fin=0.2, fout=0.2)
    loop('beds', 'basement_hum', p['lava'] - 0.2, p['sub'] + 0.2, -14.0, fin=0.2, fout=0.3)
    put_hit(m, 'geiger_rise', p['foot'], -16.0)
    put_hit(m, 'torch_click', p['lava'] - 0.15, -11.0)
    put_hit(m, 'drum_big', p['foot'], -5.0)
    put_hit(m, 'sub_drop', p['foot'], -7.0)
    loop('beds', 'pad_hope', p['sub'] - 0.1, total, -11.0, fin=0.4, fout=0.03)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
