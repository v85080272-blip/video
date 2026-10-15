"""Тайны истории №5: «Ночь на высоте 8600» (Линкольн Холл, северный гребень Эвереста, 25–26 мая 2006).

The rescue kit from sfx/make_sfx_rescue.py (70 bpm, Am - F - C - G): a dark pulse under the hook and the night, a felt
piano for the story, a string pad at dawn, drums when the climbers give up the summit to save him. High wind, breathing
in a mask, crampons on snow, a radio and a phone ringing far away in Australia; engine.Particles draws the blizzard.
"""
import numpy as np

DISPLAY = {
    'L1': 'В 2006{две тысячи шестом} ГОДУ НА ЭВЕРЕСТЕ АЛЬПИНИСТА ОСТАВИЛИ УМИРАТЬ НА ВЫСОТЕ 8600{восемь тысяч шестьсот} '
          'МЕТРОВ.',
    'L2': 'А УТРОМ ОН ПОЗДОРОВАЛСЯ С ТЕМИ, КТО ЕГО НАШЁЛ.',
    'L3': '50-ЛЕТНИЙ{Пятидесятилетний} АВСТРАЛИЕЦ ПОДНЯЛСЯ НА ВЕРШИНУ. НО НА СПУСКЕ ОТ НЕХВАТКИ КИСЛОРОДА У НЕГО НАЧАЛ '
          'ОТЕКАТЬ МОЗГ.',
    'L4': 'ПРОВОДНИКИ МНОГО ЧАСОВ ТАЩИЛИ ЕГО ВНИЗ. К НОЧИ ОН ПЕРЕСТАЛ ПОДАВАТЬ ПРИЗНАКИ ЖИЗНИ.',
    'L5': 'РУКОВОДИТЕЛЬ ЭКСПЕДИЦИИ ПРИКАЗАЛ ПРОВОДНИКАМ СПАСАТЬСЯ САМИМ. А ЖЕНЕ В АВСТРАЛИЮ СООБЩИЛИ, ЧТО ОН ПОГИБ.',
    'L6': 'НОЧЬ ОН ПРОВЁЛ ОДИН: БЕЗ ПАЛАТКИ, БЕЗ СПАЛЬНОГО МЕШКА, БЕЗ КИСЛОРОДА.',
    'L7': 'УТРОМ К ВЕРШИНЕ ПОДНИМАЛАСЬ ДРУГАЯ ГРУППА. ДО ЦЕЛИ ИМ ОСТАВАЛОСЬ 2{два} ЧАСА.',
    'L8': 'НА КРАЮ ОБРЫВА СИДЕЛ ЧЕЛОВЕК. БЕЗ ШАПКИ, БЕЗ ПЕРЧАТОК, В РАССТЁГНУТОЙ КУРТКЕ.',
    'L9': 'ОН ПОСМОТРЕЛ НА НИХ И СКАЗАЛ: — ВЫ, НАВЕРНОЕ, УДИВЛЕНЫ ВИДЕТЬ МЕНЯ ЗДЕСЬ.',
    'L10': 'ОНИ ОТКАЗАЛИСЬ ОТ ВЕРШИНЫ. ОТДАЛИ ЕМУ СВОЙ КИСЛОРОД И ВОДУ И ЖДАЛИ, ПОКА СНИЗУ ПОДНИМУТСЯ '
           '12{двенадцать} ПРОВОДНИКОВ.',
    'L11': 'ОН ВЫЖИЛ И ПОТЕРЯЛ ТОЛЬКО КОНЧИКИ ПАЛЬЦЕВ.',
    'L12': 'А 10{десятью} ДНЯМИ РАНЬШЕ НА ЭТОМ ЖЕ МАРШРУТЕ МИМО ЗАМЕРЗАЮЩЕГО АНГЛИЧАНИНА ПРОШЛИ ДЕСЯТКИ ЛЮДЕЙ.',
    'L13': 'КАК ДУМАЕШЬ, ТЫ БЫ ПОВЕРНУЛ НАЗАД ЗА 2{два} ЧАСА ДО ВЕРШИНЫ?',
}
HILITE = {'2006', 'УМИРАТЬ', '8600', 'ПОЗДОРОВАЛСЯ', 'ВЕРШИНУ.', 'МОЗГ.', 'ЖИЗНИ.', 'САМИМ.', 'ПОГИБ.', 'ОДИН:',
          'КИСЛОРОДА.', '2', 'ОБРЫВА', 'ЗДЕСЬ.', 'ОТКАЗАЛИСЬ', '12', 'ВЫЖИЛ', 'ДЕСЯТКИ', 'НАЗАД'}

# gap (s) after each line before the next one starts (with a continuous read: voice5/tools/gaps_used.py keeps the
# narrator's own pauses and these long dramatic ones)
GAPS = {'L1': 0.35, 'L2': 0.65, 'L3': 0.35, 'L4': 0.60, 'L5': 0.55, 'L6': 0.70, 'L7': 0.40, 'L8': 0.40,
        'L9': 0.70, 'L10': 0.45, 'L11': 0.60, 'L12': 0.50, 'L13': 0.0}
LEAD_IN = 0.25
TAIL = 2.0
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №5', year='2006', lines=['ОСТАВИЛИ', 'УМИРАТЬ', 'НА ЭВЕРЕСТЕ'])
COVER_B = ['НОЧЬ НА 8600', 'БЕЗ КИСЛОРОДА']
SFX_DIRS = ['/home/user/work/sfx/rescue', '/home/user/work/sfx/olga', '/home/user/work/sfx/dance', '/home/user/work/sfx']
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
    p['hook'] = (0.0, lines['L1']['end'] + 0.1)                      # pulse + wind under the hook
    p['die'] = wt('L1', 'УМИРАТЬ')
    p['hello'] = wt('L2', 'ПОЗДОРОВАЛСЯ')
    p['dead'] = wt('L5', 'ПОГИБ')
    p['without'] = [wt('L6', 'БЕЗ', nth=k) for k in range(3)]
    p['dawn'] = lines['L7']['start'] - 0.2
    p['refuse'] = (wt('L10', 'ОТКАЗАЛИСЬ') - 0.1, lines['L11']['end'] + 0.4)   # drums: they give up the summit
    p['outro'] = (lines['L13']['start'] - 0.1, None)
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    dusk = dict(exposure=-0.02, contrast=1.08, sat=0.9, warm=0.2, teal=0.4, demagenta=0.5)
    night = dict(exposure=-0.06, contrast=1.1, sat=0.8, teal=0.7, demagenta=0.5)
    dawn = dict(exposure=0.02, contrast=1.06, sat=1.0, warm=0.5, demagenta=0.5)
    day = dict(exposure=0.02, contrast=1.05, sat=1.0, teal=0.2, demagenta=0.4)
    tent = dict(exposure=-0.02, contrast=1.08, sat=0.95, warm=0.55, demagenta=0.5)
    home = dict(exposure=-0.04, contrast=1.06, sat=0.85, warm=0.3, demagenta=0.5)
    lamp = lambda x, y, k=1.0: dict(x=x, y=y, r=0.8, col=(0.3 * k, 0.28 * k, 0.22 * k), flicker=0.1, rate=2.0)
    sun = lambda x, y, k=1.0: dict(x=x, y=y, r=1.2, col=(0.4 * k, 0.26 * k, 0.1 * k), flicker=0.03, rate=0.5)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    refuse = _beat(p['refuse'], p['refuse'][1], zoom=0.025, sway=0.35)

    # L1 hook: a lone climber on the ridge at dusk (the cover stays on until «на Эвересте»), left to die at 8600 m
    ost = wt('L1', 'ОСТАВИЛИ') - 0.06
    l2 = L('L2')['start'] - 0.08
    add('e01_lone_ridge_s101', 0.0, ost, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-12, 12)),
        fx=dict(blizzard=160, beat=[hook], grade=dusk))
    h86 = wt('L1', '8600') - 0.06
    add('e09_night_alone', ost, h86, into='zoom', cam=dict(zoom=(1.05, 1.16), dolly=(0.0, 0.08)),
        fx=dict(blizzard=200, punch=[(p['die'], 0.06)], beat=[hook], grade=night))
    add('e01_lone_ridge_s201', h86, l2, cam=dict(zoom=(1.12, 1.0), dolly=(0.06, 0.0), parx=(10, -10)),
        fx=dict(blizzard=160, beat=[hook], grade=dusk))
    # L2 «а утром он поздоровался с теми, кто его нашёл»: the man at the edge at sunrise, then dark
    hl = p['hello']
    l3 = L('L3')['start'] - 0.1
    add('e12_man_edge_s112', l2, l3, into='flash', cam=dict(zoom=(1.04, 1.16), dolly=(0.0, 0.08)),
        fx=dict(snow=40, bloom=0.6, light=sun(0.7, 0.3), punch=[(hl, 0.06)], blackout=(L('L2')['end'] + 0.15, l3),
                grade=dawn))
    # L3 the fifty-year-old Australian reaches the summit; on the way down his brain starts to swell
    no = wt('L3', 'НО') - 0.06
    l4 = L('L4')['start'] - 0.08
    add('e02_summit', l3, no, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(snow=30, bloom=0.4, grade=day))
    un = wt('L3', 'У') - 0.06
    add('e03b_collapse_orange', no, un, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(blizzard=140, grade=dusk))
    add('e03b_collapse_orange', un, l4, cam=dict(zoom=(1.35, 1.5), pany=(-0.04, -0.05), roll=(0.0, 1.5)),
        fx=dict(blizzard=120, punch=[(wt('L3', 'МОЗГ'), 0.06)], grade=dusk))
    # L4 the guides drag him down for hours; by night no sign of life
    kn = wt('L4', 'К') - 0.06
    l5 = L('L5')['start'] - 0.1
    add('e05_sherpas_night_s105', l4, kn, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(blizzard=180, light=lamp(0.5, 0.4, 0.7), grade=night))
    add('e05_sherpas_night_s205', kn, l5, cam=dict(zoom=(1.2, 1.32), dolly=(0.0, 0.06)),
        fx=dict(blizzard=120, blackout=(L('L4')['end'] + 0.2, l5), grade=dict(night, exposure=-0.12, sat=0.7)))
    # L5 the leader orders the guides down; his wife in Australia is told he is dead
    zh = wt('L5', 'А') - 0.06
    l6 = L('L6')['start'] - 0.1
    pv = wt('L5', 'ПРОВОДНИКАМ') - 0.06
    add('e07b_leader_radio', l5, pv, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=20, grade=tent))
    add('e06_radio', pv, zh, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06)),
        fx=dict(snow=20, grade=dict(night, exposure=0.0, sat=0.9)))
    add('e08b_wife_phone', zh, l6, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08)),
        fx=dict(dust=10, punch=[(p['dead'], 0.05)], blackout=(L('L5')['end'] + 0.2, l6), grade=home))
    # L6 the night alone: no tent, no sleeping bag, no oxygen (a hit on every «без»)
    b1, b2, b3 = p['without']
    l7 = L('L7')['start'] - 0.1
    add('e10_everest_night', l6, b1 - 0.06, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.05), parx=(-10, 10)),
        fx=dict(blizzard=120, bloom=0.3, grade=night))
    add('e09_night_alone', b1 - 0.06, b2 - 0.06, cam=dict(zoom=(1.1, 1.16), dolly=(0.0, 0.04)),
        fx=dict(blizzard=240, punch=[(b1, 0.05)], grade=night))
    add('e09_night_alone', b2 - 0.06, b3 - 0.06, cam=dict(zoom=(1.3, 1.36), pany=(0.03, 0.03), dolly=(0.0, 0.04)),
        fx=dict(blizzard=240, punch=[(b2, 0.05)], grade=night))
    add('e09_night_alone', b3 - 0.06, l7, cam=dict(zoom=(1.55, 1.62), pany=(0.06, 0.06), dolly=(0.0, 0.04)),
        fx=dict(blizzard=260, punch=[(b3, 0.06)], shake=[(b3, 0.5, 8)], blackout=(L('L6')['end'] + 0.25, l7),
                grade=night))
    # L7 morning: another team climbs to the summit, two hours from the top
    dc = wt('L7', 'ДО') - 0.06
    l8 = L('L8')['start'] - 0.08
    add('e11_dawn_team', l7, dc, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(snow=40, bloom=0.5, grade=dawn))
    add('e16_summit_near', dc, l8, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08)),
        fx=dict(snow=30, bloom=0.5, light=sun(0.6, 0.2, 0.8), grade=dawn))
    # L8 a man sits at the edge of the cliff: no hat, no gloves, his suit open (a cut on each item)
    bz = wt('L8', 'БЕЗ') - 0.06
    bz1 = wt('L8', 'БЕЗ', nth=1) - 0.06
    vr = wt('L8', 'РАССТЁГНУТОЙ') - 0.3
    l9 = L('L9')['start'] - 0.08
    add('e12_man_edge_s212', l8, bz, into='zoom', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(snow=30, bloom=0.6, light=sun(0.75, 0.3), punch=[(wt('L8', 'ЧЕЛОВЕК'), 0.05)], grade=dawn))
    add('e13b_face_bare', bz, bz1, cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.05)),
        fx=dict(snow=20, bloom=0.4, grade=dawn))
    add('e14_bare_hands', bz1, vr, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.05)),
        fx=dict(snow=20, bloom=0.4, grade=dawn))
    add('e12c_unzipped', vr, l9, cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(snow=20, bloom=0.5, light=sun(0.75, 0.3, 0.7), grade=dawn))
    # L9 «I imagine you are surprised to see me here»
    vy = wt('L9', 'ВЫ') - 0.06
    l10 = L('L10')['start'] - 0.1
    add('e13b_face_bare', l9, vy, into='fade', cam=dict(zoom=(1.1, 1.18), pany=(-0.02, -0.03)),
        fx=dict(snow=15, bloom=0.4, grade=dawn))
    add('e13b_face_bare', vy, l10, cam=dict(zoom=(1.3, 1.42), pany=(-0.05, -0.06), dolly=(0.0, 0.04)),
        fx=dict(snow=10, bloom=0.5, punch=[(wt('L9', 'ЗДЕСЬ'), 0.04)], grade=dawn))
    # L10 they give up the summit, give him their oxygen and water, and wait for twelve guides (drums)
    ot = wt('L10', 'ОТДАЛИ') - 0.06
    zd = wt('L10', 'ЖДАЛИ') - 0.3                     # on «и ждали»
    l11 = L('L11')['start'] - 0.08
    add('e22_turn_back', l10, ot, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(snow=30, bloom=0.5, beat=[refuse], grade=dawn))
    add('e15_oxygen_help', ot, zd, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08)),
        fx=dict(snow=30, bloom=0.4, beat=[refuse], grade=dawn))
    pd = wt('L10', 'ПОДНИМУТСЯ') - 0.06
    add('e15_oxygen_help', zd, pd, cam=dict(zoom=(1.35, 1.45), pany=(-0.03, -0.04), parx=(-6, 6)),
        fx=dict(snow=30, bloom=0.4, beat=[refuse], grade=dawn))
    add('e17_sherpas_up', pd, l11, into='zoom', cam=dict(zoom=(1.0, 1.12), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(blizzard=100, beat=[refuse], grade=day))
    # L11 he lived, and lost only his fingertips
    l12 = L('L12')['start'] - 0.1
    add('e19b_bandaged', l11, l12, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08)),
        fx=dict(dust=20, bloom=0.4, beat=[refuse], light=lamp(0.5, 0.5, 0.8), grade=tent))
    # L12 ten days earlier, on the same route, dozens walked past a freezing Englishman
    pr = wt('L12', 'ПРОШЛИ') - 0.06
    l13 = L('L13')['start'] - 0.08
    mm = wt('L12', 'МИМО') - 0.06
    add('e21_line_passing', l12, mm, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.03, 0.03), parx=(-14, 14)),
        fx=dict(blizzard=160, grade=dict(day, exposure=-0.04, sat=0.85)))
    add('e20b_huddled', mm, pr, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(blizzard=150, grade=night))
    add('e21_line_passing', pr, l13, cam=dict(zoom=(1.35, 1.45), pany=(0.06, 0.07), parx=(-8, 8)),
        fx=dict(blizzard=160, grade=dict(day, exposure=-0.06, sat=0.8)))
    # L13 would you turn back two hours from the top?
    za = wt('L13', 'ЗА') - 0.06
    add('e22_turn_back', l13, za, into='fade', cam=dict(zoom=(1.25, 1.35), pany=(0.0, -0.01), parx=(-8, 8)),
        fx=dict(snow=30, bloom=0.5, grade=dawn))
    add('e16_summit_near', za, total, cam=dict(zoom=(1.12, 1.24), dolly=(0.0, 0.06)),
        fx=dict(snow=40, bloom=0.6, light=sun(0.6, 0.2, 0.8), grade=dawn))

    cards = [
        dict(text='8600', sub='МЕТРОВ', start=wt('L1', '8600'), end=l2 - 0.05, y=760, count=True, count_dur=0.8),
        dict(text='2 ЧАСА', sub='ДО ВЕРШИНЫ', start=wt('L7', '2'), end=l8 - 0.05, y=760),
        dict(text='12', sub='ПРОВОДНИКОВ', start=wt('L10', '12'), end=l11 - 0.05, y=760, count=True),
    ]
    tags = [
        dict(text='ЛИНКОЛЬН ХОЛЛ · 25 МАЯ', start=l3 + 0.3, end=no - 0.1),
        dict(text='АЛЕКСАНДР АБРАМОВ', start=l5 + 0.3, end=zh - 0.1),
        dict(text='ДЭН МАЗУР · 26 МАЯ', start=l7 + 0.3, end=dc - 0.1),
        dict(text='ДЭВИД ШАРП · 15 МАЯ', start=l12 + 0.3, end=pr - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'НА') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


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

    # --- hook: the ridge, the wind, the dark pulse; «оставили умирать»
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -5.0, fin=0.0, fout=0.1)
    loop('beds', 'wind_high', h0, L['L2']['end'] + 0.4, -3.0, fin=0.0, fout=0.6)
    loop('beds', 'drone_bed_tension', h0, h1, -10.0, fin=0.3, fout=0.1)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'drum_big', p['die'], -3.0)
    put_hit(m, 'sub_drop', p['die'], -6.0)
    # «а утром он поздоровался»: a rise and a soft hit, then the heartbeat
    put_hit(m, 'riser_2s', p['hello'], -11.0)
    put_hit(m, 'impact_soft', p['hello'], -5.0)
    put_hit(m, 'heartbeat', L['L2']['end'] + 0.2, -7.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [p['die'], p['hello'], p['dead'], p['refuse'][0]] + p['without']
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -15.0)
    # --- the summit and the way down: the piano tells it, the wind never stops
    l3, l4, l5 = L['L3']['start'], L['L4']['start'], L['L5']['start']
    loop('beds', 'piano_sad', l3 - 0.2, l5 - 0.3, -7.0, fin=0.6, fout=0.6)
    loop('beds', 'wind_high', l3 - 0.2, l5, -8.0, fin=0.4, fout=0.6)
    put_hit(m, 'breath_mask', l3 + 0.2, -10.0)
    loop('beds', 'drone_bed_tension', wt('L3', 'НО'), l5, -10.0, fin=0.4, fout=0.5)
    put_hit(m, 'steps_snow', l4 + 0.2, -9.0)
    put_hit(m, 'heartbeat', wt('L4', 'ПЕРЕСТАЛ'), -6.0)
    # --- the leader on the radio; the phone rings in Australia
    loop('beds', 'pulse_dark', l5, L['L6']['start'] - 0.3, -10.0, fin=0.4, fout=0.4)
    put_hit(m, 'radio_static', l5 + 0.15, -7.0)
    put_hit(m, 'radio_static', wt('L5', 'СПАСАТЬСЯ'), -13.0)
    put_hit(m, 'phone_ring', wt('L5', 'А') + 0.1, -9.0)
    put_hit(m, 'sub_drop', p['dead'], -6.0)
    # --- the night alone: the wind and three hits on «без»
    l6, l7 = L['L6']['start'], L['L7']['start']
    loop('beds', 'wind_high', l6 - 0.2, l7 + 0.3, -2.0, fin=0.5, fout=0.8)
    loop('beds', 'drone_bed', l6, l7, -10.0, fin=0.6, fout=0.6)
    for k, b in enumerate(p['without']):
        put_hit(m, 'drum_big', b, -7.0 + 2.0 * k)
    put_hit(m, 'heartbeat', L['L6']['end'] + 0.3, -7.0)
    # --- dawn: another team climbs, the strings come in
    dw = p['dawn']
    loop('beds', 'pad_hope', dw, L['L9']['start'] + 0.2, -8.0, fin=1.2, fout=0.8)
    loop('beds', 'wind_high', dw, L['L10']['start'], -10.0, fin=0.6, fout=0.6)
    put_hit(m, 'steps_snow', l7 + 0.3, -8.0)
    put_hit(m, 'breath_mask', wt('L7', 'ДРУГАЯ'), -9.0)
    put_hit(m, 'impact_soft', wt('L8', 'ЧЕЛОВЕК'), -8.0)
    # --- «вы, наверное, удивлены видеть меня здесь»: almost nothing under it
    put_hit(m, 'impact_soft', wt('L9', 'ЗДЕСЬ'), -10.0)
    # --- they give up the summit: drums, the pulse and the strings until he is safe
    r0, r1 = p['refuse']
    loop('beds', 'drums_build', r0, r1, -4.0, fin=0.05, fout=0.8)
    loop('beds', 'pad_hope', r0, r1 + 0.6, -6.0, fin=0.5, fout=1.0)
    loop('beds', 'pulse_dark', r0, wt('L10', 'ЖДАЛИ'), -10.0, fin=0.3, fout=0.4)
    put_hit(m, 'drum_big', r0 + 0.1, -3.0)
    put_hit(m, 'steps_snow', wt('L10', 'ЖДАЛИ') + 0.4, -9.0)
    # --- ten days earlier: the man nobody stopped for
    l12 = L['L12']['start']
    loop('beds', 'wind_high', l12 - 0.2, L['L13']['start'], -6.0, fin=0.5, fout=0.6)
    loop('beds', 'piano_sad', l12, L['L13']['start'] + 0.2, -9.0, fin=0.8, fout=0.6)
    loop('beds', 'drone_bed_tension', l12, L['L13']['start'], -10.0, fin=0.5, fout=0.5)
    put_hit(m, 'steps_snow', wt('L12', 'ПРОШЛИ'), -9.0)
    # --- the question
    o0 = p['outro'][0]
    loop('beds', 'pad_hope', o0, total, -6.0, fin=0.6, fout=1.6)
    loop('beds', 'piano_sad', o0 + 0.2, total, -8.0, fin=0.8, fout=1.6)
    loop('beds', 'wind_high', o0, total, -12.0, fin=0.5, fout=1.6)
    put_hit(m, 'sting_end', L['L13']['end'] + 0.1, -6.0)
