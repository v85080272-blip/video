"""Тайны истории №13: «Бабушки Чернобыля» (самосёлы зоны отчуждения).

vla 27.10 asked to queue this one right after №12, whose last line asks why the old people crept back into the dead
zone. More than a thousand people, mostly old women, went back to their villages inside the zone, were turned out and
came back again, lived off their gardens, the forest and the well, and were finally left alone; «здесь мой дом». The
claim that many outlived the neighbours who left rests on a film and their own stories, so it is said as «говорят»
(sources in chernobyl1986_babushki/factcheck.md). The ending asks about the animals and the mutants: the hook into
№14. Voice «Историк» (h4_s52). Pictures: vla's PC (Juggernaut XL, chernobyl1986_babushki/shots_pc.json, two seeds
each); the ids below are picked by seed once the frames are in.
"""
import numpy as np

DISPLAY = {
    'L1': 'ИМ ЗАПРЕТИЛИ ВОЗВРАЩАТЬСЯ В ЗОНУ РАДИАЦИИ. ОНИ ВЕРНУЛИСЬ И ПРОЖИЛИ ТАМ ДЕСЯТКИ ЛЕТ.',
    'L2': 'ПОСЛЕ АВАРИИ ВОКРУГ СТАНЦИИ ВЫСЕЛИЛИ ДЕСЯТКИ ДЕРЕВЕНЬ.',
    'L3': 'НО БОЛЬШЕ ТЫСЯЧИ ЧЕЛОВЕК, В ОСНОВНОМ БАБУШКИ, ТАЙКОМ ВЕРНУЛИСЬ ДОМОЙ.',
    'L4': 'ИХ ПЫТАЛИСЬ ВЫСЕЛИТЬ, А ОНИ ВОЗВРАЩАЛИСЬ СНОВА.',
    'L5': 'САЖАЛИ ОГОРОДЫ, ЕЛИ СВОЮ КАРТОШКУ И ГРИБЫ, ПИЛИ ВОДУ ИЗ КОЛОДЦА.',
    'L6': 'В КОНЦЕ КОНЦОВ ИХ ОСТАВИЛИ В ПОКОЕ.',
    'L7': 'ПОЧЕМУ? ОНИ ГОВОРИЛИ: ЗДЕСЬ МОЙ ДОМ, А НА ЧУЖОМ МЕСТЕ И ЖИТЬ НЕЗАЧЕМ.',
    'L8': 'ГОВОРЯТ, МНОГИЕ ИЗ НИХ ПРОЖИЛИ ДОЛЬШЕ СОСЕДЕЙ, КОТОРЫЕ УЕХАЛИ.',
    'L9': 'А ЧТО СТАЛО С ЖИВОТНЫМИ В ЗОНЕ? ПРАВДА ЛИ ТАМ ВОДЯТСЯ МУТАНТЫ?',
    'L10': 'ПОДПИШИСЬ, ЧТОБЫ НЕ ПРОПУСКАТЬ ДРУГИЕ КРУТЫЕ ИСТОРИИ.',
}
HILITE = {'ЗАПРЕТИЛИ', 'РАДИАЦИИ.', 'ВЕРНУЛИСЬ', 'ДЕСЯТКИ', 'ЛЕТ.', 'ВЫСЕЛИЛИ', 'ДЕРЕВЕНЬ.', 'ТЫСЯЧИ', 'БАБУШКИ,',
          'ТАЙКОМ', 'СНОВА.', 'ОГОРОДЫ,', 'КАРТОШКУ', 'ГРИБЫ,', 'КОЛОДЦА.', 'ПОКОЕ.', 'ПОЧЕМУ?', 'ДОМ,',
          'НЕЗАЧЕМ.', 'ДОЛЬШЕ', 'УЕХАЛИ.', 'ЖИВОТНЫМИ', 'МУТАНТЫ?'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L1 the hook settles, after L6 the quiet, after L9 the question hangs before the plaque
GAPS = {'L1': 0.6, 'L2': 0.2, 'L3': 0.3, 'L4': 0.3, 'L5': 0.3, 'L6': 0.6, 'L7': 0.3, 'L8': 0.35, 'L9': 0.6,
        'L10': 0.0}
GAP_MAX = 0.3
LEAD_IN = 0.15
TAIL = 0.6                         # the plaque holds a moment after «истории», then a white flash loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №13', year='1986', lines=['ВЕРНУЛИСЬ', 'В ЗОНУ РАДИАЦИИ'],
             # the preview cover (thumb.py, chernobyl1986_babushki/thumbs.json) in the first frames, so YouTube's frame
             # picker can take it; the other variant sits next to it in covers/
             img='/mnt/project-files/history-facts/chernobyl1986_babushki/covers/vernulis.jpg')
COVER_B = ['БАБУШКИ', 'ЗОНЫ ОТЧУЖДЕНИЯ']
# the narrator says the plaque's words (L10, no bottom captions), so it comes up with «подпишись»
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №13', over_last=0.0, lines=['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ КРУТЫЕ ИСТОРИИ'])
# stills from vla's PC (shots_pc.json, Juggernaut XL), chosen by seed; where a shot comes twice, the second seed gives
# the second appearance a new picture
GATE = 'b01_gate_s4001'              # an old woman at the gate of her house
GATE2 = 'b01_gate_s4002'             # the same, for «здесь мой дом»
SIGN = 'b02_sign_s4011'              # the radiation sign at the forest's edge
VILLAGE = 'b03_village_s4021'        # the empty village, grass on the road
VILLAGE2 = 'b03_village_s4022'       # the village again, for «соседей, которые уехали»
WALK = 'b04_forest_walk_s4031'       # an old woman walking home through the pines
WALK2 = 'b04_forest_walk_s4032'      # the same, for «возвращались снова»
CHECK = 'b05_checkpoint_s4041'       # a militiaman at the barrier stopping her
GARDEN = 'b06_garden_s4051'          # digging potatoes by the house
GARDEN2 = 'b06_garden_s4052'         # the same yard, for the plaque
WELL = 'b07_well_s4061'              # the bucket coming up the well
MUSHROOMS = 'b08_mushrooms_s4071'    # old hands with a basket of mushrooms
KITCHEN = 'b09_kitchen_s4081'        # two old women at tea under the icons
KITCHEN2 = 'b09_kitchen_s4082'       # the same, for «в основном бабушки»
FACE = 'b10_portrait_s4091'          # a very old woman's face, smiling
FACE2 = 'b10_portrait_s4092'         # the same, for «прожили дольше»
WOLF = 'b11_wolf_s4101'              # a wolf in the empty village street
FROG = 'b12_frog_s4111'              # a dark, almost black tree frog
SFX_DIRS = ['/home/user/work/sfx/babushki', '/home/user/work/sfx/veshchi', '/home/user/work/sfx/chernobyl',
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
    p['banned'] = wt('L1', 'ЗАПРЕТИЛИ')
    p['they'] = wt('L1', 'ОНИ')
    p['decades'] = wt('L1', 'ДЕСЯТКИ')
    p['evicted'] = wt('L2', 'ВЫСЕЛИЛИ')
    p['thousand'] = wt('L3', 'ТЫСЯЧИ')
    p['grannies'] = wt('L3', 'БАБУШКИ')
    p['secretly'] = wt('L3', 'ТАЙКОМ')
    p['tried'] = wt('L4', 'ПЫТАЛИСЬ')
    p['again'] = wt('L4', 'А')
    p['gardens'] = wt('L5', 'ОГОРОДЫ')
    p['mushrooms'] = wt('L5', 'ГРИБЫ')
    p['water'] = wt('L5', 'ПИЛИ')
    p['peace'] = wt('L6', 'ПОКОЕ')
    p['why'] = wt('L7', 'ПОЧЕМУ')
    p['home'] = wt('L7', 'ЗДЕСЬ')
    p['longer'] = wt('L8', 'ДОЛЬШЕ')
    p['neighbours'] = wt('L8', 'СОСЕДЕЙ')
    p['animals'] = wt('L9', 'ЖИВОТНЫМИ')
    p['true'] = wt('L9', 'ПРАВДА')
    p['mutants'] = wt('L9', 'МУТАНТЫ')
    p['sub'] = lines['L10']['start']
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    zone = dict(exposure=-0.02, contrast=1.1, sat=0.6, warm=-0.05, demagenta=0.3)        # the zone, cold
    home = dict(exposure=0.03, contrast=1.05, sat=0.85, warm=0.4, demagenta=0.2)         # their yards, warm
    dusk = dict(exposure=-0.03, contrast=1.1, sat=0.7, warm=0.3, demagenta=0.3)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)

    # L1 hook: «им запретили возвращаться в зону радиации» on the sign; «они вернулись...» on her at the gate
    th = p['they'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(SIGN, 0.0, th, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.0), parx=(-6, 6)),
        fx=dict(dust=20, beat=[hook], punch=[(p['banned'], 0.06)], grade=zone))
    add(GATE, th, l2, into='flash', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=10, beat=[hook], punch=[(p['decades'], 0.06)], grade=home))
    # L2 dozens of villages emptied
    l3 = L('L3')['start'] - 0.08
    add(VILLAGE, l2, l3, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-8, 8)),
        fx=dict(dust=15, fog=0.15, punch=[(p['evicted'], 0.05)], grade=zone))
    # L3 more than a thousand, mostly grannies, crept back home through the forest
    l4 = L('L4')['start'] - 0.08
    sc = p['secretly'] - 0.06
    add(KITCHEN2, l3, sc, into='flash', cam=dict(zoom=(1.02, 1.1), panx=(-0.02, 0.02)),
        fx=dict(dust=12, punch=[(p['thousand'], 0.04), (p['grannies'], 0.05)], grade=home))
    add(WALK, sc, l4, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=20, fog=0.2, grade=home))
    # L4 turned out at the barrier, back again through the pines
    ag = p['again'] - 0.06
    add(CHECK, l4, ag, into='flash', cam=dict(zoom=(1.0, 1.08), panx=(0.02, -0.02)),
        fx=dict(dust=10, punch=[(p['tried'], 0.05)], grade=zone))
    l5 = L('L5')['start'] - 0.08
    add(WALK2, ag, l5, into='fade', cam=dict(zoom=(1.05, 1.12), dolly=(0.0, 0.05)),
        fx=dict(dust=20, fog=0.2, grade=home))
    # L5 the garden, the mushrooms, the well
    ms = p['mushrooms'] - 0.3
    wa = p['water'] - 0.06
    add(GARDEN, l5, ms, into='flash', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-6, 6)),
        fx=dict(dust=15, punch=[(p['gardens'], 0.05)], grade=home))
    add(MUSHROOMS, ms, wa, into='fade', cam=dict(zoom=(1.05, 1.12), dolly=(0.0, 0.04)),
        fx=dict(dust=10, grade=home))
    l6 = L('L6')['start'] - 0.08
    add(WELL, wa, l6, into='fade', cam=dict(zoom=(1.0, 1.08), pany=(0.0, 0.02)),
        fx=dict(dust=10, grade=home))
    # L6 left alone at last: tea in the kitchen
    l7 = L('L7')['start'] - 0.08
    add(KITCHEN, l6, l7, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.04)),
        fx=dict(dust=15, bloom=0.3, punch=[(p['peace'], 0.04)], grade=home))
    # L7 why: «здесь мой дом» on her face, then at the gate again
    hm = p['home'] - 0.06
    add(FACE, l7, hm, into='flash', cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.03)),
        fx=dict(dust=8, punch=[(p['why'], 0.05)], grade=home))
    l8 = L('L8')['start'] - 0.08
    add(GATE2, hm, l8, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02)),
        fx=dict(dust=10, grade=home))
    # L8 «говорят, многие прожили дольше»: the face again, closer; «соседей, которые уехали» on the empty village
    l9 = L('L9')['start'] - 0.08
    nb = p['neighbours'] - 0.06
    add(FACE2, l8, nb, into='fade', cam=dict(zoom=(1.05, 1.12), dolly=(0.0, 0.04)),
        fx=dict(dust=8, punch=[(p['longer'], 0.05)], grade=dict(home, warm=0.5)))
    add(VILLAGE2, nb, l9, into='fade', cam=dict(zoom=(1.02, 1.1), panx=(0.02, -0.02), parx=(-4, 4)),
        fx=dict(dust=15, fog=0.15, grade=zone))
    # L9 the animals: the wolf in the empty street, then «мутанты?» on the black frog
    tr = p['true'] - 0.06
    add(WOLF, l9, tr, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.05), parx=(-6, 6)),
        fx=dict(dust=15, punch=[(p['animals'], 0.05)], grade=dusk))
    sub = p['sub'] - 0.08
    add(FROG, tr, sub, into='whip', cam=dict(zoom=(1.05, 1.18), dolly=(0.0, 0.05)),
        fx=dict(dust=8, punch=[(p['mutants'], 0.1)], grade=dict(dusk, sat=0.9)))
    # L10 «подпишись...»: her warm yard takes the plaque, then a white flash loops to the cover
    add(GARDEN2, sub, total, into='fade', cam=dict(zoom=(1.02, 1.1), pany=(0.0, 0.02), parx=(-4, 4)),
        fx=dict(dust=12, flash=[(total - 0.3, 0.35, 2.0, white)], grade=home))

    cards = []
    tags = [
        dict(text='ЗОНА ОТЧУЖДЕНИЯ · 1986', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='ИХ ПРОЗВАЛИ САМОСЁЛАМИ', start=p['grannies'] + 0.1, end=l4 - 0.05),
    ]
    cover = dict(start=0.0, end=p['banned'] - 0.1)
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

    # --- hook: the Geiger counter at the sign, a hit on «запретили», warmth comes in on «они вернулись»
    h0, h1 = p['hook']
    loop('beds', 'geiger', h0, p['they'], -16.0, fin=0.0, fout=0.2)
    loop('beds', 'drone_bed_tension', h0, p['they'] + 0.3, -10.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -10.0)
    put_hit(m, 'impact_soft', p['banned'], -7.0)
    put_hit(m, 'drum_big', p['they'], -6.0)
    loop('beds', 'pad_hope', p['they'], L['L2']['start'], -10.0, fin=0.2, fout=0.3)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['banned'], p['they'], p['evicted'], p['thousand'], p['tried'], p['why'], p['animals'],
            p['mutants'], p['sub']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the empty villages: wind, the counter again, a drop on «выселили»
    loop('beds', 'ambience_wind_dead_forest', L['L2']['start'] - 0.1, L['L4']['start'], -14.0, fin=0.3, fout=0.3)
    loop('beds', 'geiger', L['L2']['start'], L['L3']['start'], -19.0, fin=0.2, fout=0.2)
    put_hit(m, 'sub_drop', p['evicted'], -9.0)
    # --- creeping back: steps through the forest, a drum on «тысячи», the barrier and back again
    put_hit(m, 'steps_forest', L['L3']['start'] - 0.05, -10.0)
    put_hit(m, 'drum_big', p['thousand'], -7.0)
    loop('beds', 'pulse_dark', L['L3']['start'], L['L5']['start'], -11.0, fin=0.3, fout=0.3)
    put_hit(m, 'impact_soft', p['tried'], -8.0)
    put_hit(m, 'steps_forest', p['again'], -12.0)
    # --- life at home: birds, the spade, the well, the warm piano to the end of L8
    loop('beds', 'ambience_morning_taiga', L['L5']['start'] - 0.2, L['L9']['start'], -14.0, fin=0.4, fout=0.4)
    loop('beds', 'piano_sad', L['L5']['start'] - 0.1, L['L9']['start'], -10.0, fin=0.4, fout=0.4)
    put_hit(m, 'dig', L['L5']['start'], -11.0)
    put_hit(m, 'well', p['water'] - 0.2, -13.0)
    put_hit(m, 'impact_soft', p['why'], -9.0)
    put_hit(m, 'heartbeat', p['longer'], -10.0)
    # --- the animals: the tension and the counter back, a wolf far off, a hit on «мутанты?»
    loop('beds', 'drone_bed_tension', L['L9']['start'] - 0.1, p['sub'], -9.0, fin=0.2, fout=0.2)
    loop('beds', 'geiger', L['L9']['start'], p['sub'] + 0.4, -17.0, fin=0.3, fout=0.4)
    put_hit(m, 'wolf_howl', L['L9']['start'] - 0.2, -14.0)
    put_hit(m, 'drum_big', p['mutants'], -5.0)
    put_hit(m, 'sub_drop', p['mutants'], -7.0)
    loop('beds', 'pad_hope', p['sub'] - 0.1, total, -11.0, fin=0.4, fout=0.03)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
