"""Тайны истории №4: «Тринадцать под землёй» (пещера Тхамлуанг, Таиланд, 23 июня – 10 июля 2018).

The rescue kit from sfx/make_sfx_rescue.py (70 bpm, Am - F - C - G, 4-bar loops): a dark pulse under the hook and the
search, a felt piano while the story is told, big drums for the rescue, a string pad when they are found and at the
end. The cave sounds (drops, flood water, monsoon rain, underwater rumble, a diver's breath, the pump dying) carry the
rest; engine.Particles draws the rain and the bubbles.
"""
import numpy as np

DISPLAY = {
    'L1': 'В 2018{две тысячи восемнадцатом} ГОДУ 12{двенадцать} МАЛЬЧИШЕК И ИХ ТРЕНЕР ЗАСТРЯЛИ ГЛУБОКО В ПЕЩЕРЕ.',
    'L2': 'ЧТОБЫ ИХ ВЫТАЩИТЬ, ДЕТЕЙ ПРИШЛОСЬ УСЫПИТЬ.',
    'L3': 'ДЕТСКАЯ ФУТБОЛЬНАЯ КОМАНДА ИЗ ТАИЛАНДА ЗАШЛА В ПЕЩЕРУ ПОСЛЕ ТРЕНИРОВКИ. НЕНАДОЛГО.',
    'L4': 'НО ХЛЫНУЛ ЛИВЕНЬ, И ВОДА ОТРЕЗАЛА ВЫХОД.',
    'L5': 'ОНИ УХОДИЛИ ВСЁ ГЛУБЖЕ, ПОКА НЕ НАШЛИ СУХОЙ УСТУП В 4{четырёх} КИЛОМЕТРАХ ОТ ВХОДА.',
    'L6': 'ЕДЫ НЕ БЫЛО. ТРЕНЕР, БЫВШИЙ МОНАХ, УЧИЛ РЕБЯТ МЕДИТИРОВАТЬ, ЧТОБЫ ТРАТИТЬ МЕНЬШЕ СИЛ.',
    'L7': 'НАВЕРХУ ИХ ИСКАЛИ ТЫСЯЧИ ЛЮДЕЙ. 9{Девять} ДНЕЙ НИ ЗВУКА.',
    'L8': 'НА 10-Й{десятый} ДЕНЬ ИЗ ВОДЫ ВЫНЫРНУЛИ ДВОЕ БРИТАНСКИХ ДАЙВЕРОВ. — СКОЛЬКО ВАС? — 13{Тринадцать}. ВСЕ ЖИВЫ.',
    'L9': 'НО ВЫХОД БЫЛ ТОЛЬКО ПОД ВОДОЙ. А БОЛЬШИНСТВО МАЛЬЧИКОВ НЕ УМЕЛИ ПЛАВАТЬ.',
    'L10': 'ВОЗДУХА СТАНОВИЛОСЬ ВСЁ МЕНЬШЕ. ОДИН СПАСАТЕЛЬ ПОГИБ, КОГДА НОСИЛ ТУДА БАЛЛОНЫ.',
    'L11': 'И ТОГДА РЕШИЛИСЬ НА БЕЗУМНЫЙ ПЛАН. КАЖДОГО МАЛЬЧИКА УСЫПИЛИ, НАДЕЛИ МАСКУ И ПРОТАЩИЛИ ПО ЗАТОПЛЕННЫМ '
           'ТОННЕЛЯМ.',
    'L12': '3{Три} ДНЯ, ПО 4{четыре} МАЛЬЧИКА. В ПОСЛЕДНИЙ ДЕНЬ ВЫВЕЛИ И ТРЕНЕРА.',
    'L13': 'А ЧЕРЕЗ НЕСКОЛЬКО ЧАСОВ СЛОМАЛСЯ ГЛАВНЫЙ НАСОС, И ВОДА ХЛЫНУЛА ОБРАТНО.',
    'L14': 'ВСЕ 13{тринадцать} ВЫЖИЛИ. КАК ДУМАЕШЬ, ЧТО ИХ СПАСЛО: СПОКОЙСТВИЕ ТРЕНЕРА ИЛИ СМЕЛОСТЬ ДАЙВЕРОВ?',
}
HILITE = {'2018', '12', 'УСЫПИТЬ.', 'НЕНАДОЛГО.', 'ЛИВЕНЬ,', 'ВЫХОД.', '4', 'МОНАХ,', '9', '13.', 'ЖИВЫ.', 'ВОДОЙ.',
          'ПЛАВАТЬ.', 'ПОГИБ,', 'БЕЗУМНЫЙ', 'УСЫПИЛИ,', 'ТРЕНЕРА.', 'НАСОС,', 'ОБРАТНО.', '13', 'ВЫЖИЛИ.',
          'СПОКОЙСТВИЕ', 'СМЕЛОСТЬ'}

# gap (s) after each line before the next one starts (with a continuous read: voice5/tools/gaps_used.py keeps the
# narrator's own pauses and these long dramatic ones)
GAPS = {'L1': 0.30, 'L2': 0.65, 'L3': 0.40, 'L4': 0.45, 'L5': 0.30, 'L6': 0.40, 'L7': 0.70, 'L8': 0.55,
        'L9': 0.35, 'L10': 0.70, 'L11': 0.30, 'L12': 0.45, 'L13': 0.60, 'L14': 0.0}
LEAD_IN = 0.25
TAIL = 2.0
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №4', year='2018', lines=['ДЕТЕЙ УСЫПИЛИ,', 'ЧТОБЫ СПАСТИ?'])
COVER_B = ['13 ЧЕЛОВЕК', 'ПОД ЗЕМЛЁЙ']
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
    p['hook'] = (0.0, lines['L2']['end'] + 0.05)                     # dark pulse + drops under the hook
    p['sleep'] = wt('L2', 'УСЫПИТЬ')
    p['rain'] = wt('L4', 'ЛИВЕНЬ')
    p['silence'] = wt('L7', '9') - 0.08                              # «девять дней ни звука»: everything stops
    p['found'] = wt('L8', '13')
    p['died'] = wt('L10', 'ПОГИБ')
    p['rescue'] = (lines['L11']['start'] - 0.1, lines['L13']['start'] - 0.05)   # drums from «и тогда решились»
    p['pump'] = wt('L13', 'СЛОМАЛСЯ')
    p['flood'] = wt('L13', 'ХЛЫНУЛА')
    p['outro'] = (lines['L14']['start'] - 0.1, None)
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    lamp = dict(exposure=0.0, contrast=1.1, sat=0.95, warm=0.45, demagenta=0.5)          # flashlights in the cave
    cave = dict(exposure=-0.04, contrast=1.1, sat=0.85, teal=0.5, demagenta=0.5)
    jungle = dict(exposure=0.02, contrast=1.05, sat=1.05, warm=0.2, demagenta=0.4)
    storm = dict(exposure=-0.08, contrast=1.12, sat=0.8, teal=0.6, demagenta=0.5)
    camp = dict(exposure=0.0, contrast=1.08, sat=0.95, warm=0.3, teal=0.3, demagenta=0.5)
    under = dict(exposure=-0.04, contrast=1.08, sat=0.9, teal=0.8, demagenta=0.5)
    ward = dict(exposure=0.04, contrast=1.04, sat=1.0, warm=0.25, demagenta=0.4)
    beam = lambda x, y, k=1.0: dict(x=x, y=y, r=0.9, col=(0.32 * k, 0.29 * k, 0.2 * k), flicker=0.12, rate=2.0)
    bolt = (0.75, 0.85, 1.0)                                       # lightning: a blue-white flash
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    rescue = _beat(p['rescue'], p['rescue'][1], zoom=0.03, sway=0.4)

    # L1 hook: the boys on the ledge in the dark (the cover stays on until «двенадцать»), then the cave around them
    zs = wt('L1', 'ЗАСТРЯЛИ') - 0.06
    l2 = L('L2')['start'] - 0.08
    add('c01_boys_ledge_s201', 0.0, zs, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-10, 10)),
        fx=dict(dust=25, beat=[hook], grade=lamp))
    add('c08_ledge_wide', zs, l2, into='zoom', cam=dict(zoom=(1.18, 1.0), dolly=(0.06, 0.0), parx=(12, -12)),
        fx=dict(dust=20, beat=[hook], grade=cave))
    # L2 «детей пришлось усыпить»: the boy in the mask on the stretcher, a hit, then dark
    us = p['sleep']
    l3 = L('L3')['start'] - 0.1
    add('c03_mask_stretcher', l2, l3, into='flash', cam=dict(zoom=(1.08, 1.24), dolly=(0.0, 0.08)),
        fx=dict(dust=15, punch=[(us, 0.08)], shake=[(us, 0.6, 12)], light=beam(0.5, 0.35, 0.8),
                blackout=(L('L2')['end'] + 0.15, l3), grade=cave))
    # L3 the football team rides to the cave after training; «ненадолго»
    zsh = wt('L3', 'ЗАШЛА') - 0.06
    nn = wt('L3', 'НЕНАДОЛГО') - 0.06
    l4 = L('L4')['start'] - 0.08
    add('c04_team_bikes', l3, zsh, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(dust=10, grade=jungle))
    add('c05_cave_entrance', zsh, nn, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1), parx=(-10, 10)),
        fx=dict(fog=0.15, dust=15, grade=dict(jungle, exposure=-0.02, sat=0.95)))
    add('c05_cave_entrance', nn, l4, cam=dict(zoom=(1.3, 1.45), dolly=(0.0, 0.06)),
        fx=dict(fog=0.1, grade=dict(jungle, exposure=-0.1, sat=0.85)))
    # L4 the monsoon breaks; the water cuts off the way out
    vd = wt('L4', 'ВОДА') - 0.06
    vy = wt('L4', 'ВЫХОД')
    rn = p['rain']
    l5 = L('L5')['start'] - 0.08
    add('c06_monsoon', l4, vd, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-12, 12)),
        fx=dict(rain=260, fog=0.15, flash=[(rn, 0.35, 0.7, bolt), (rn + 0.5, 0.25, 0.35, bolt)], shake=[(rn, 0.5, 8)],
                grade=storm))
    add('c07_flood_passage', vd, l5, cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.1), parx=(-10, 10)),
        fx=dict(punch=[(vy, 0.07)], shake=[(vd + 0.06, 1.2, 6), (vy, 0.5, 10)], light=beam(0.45, 0.4, 0.7), grade=cave))
    # L5 deeper and deeper, a dry ledge 4 km in
    sx = wt('L5', 'СУХОЙ') - 0.06
    l6 = L('L6')['start'] - 0.08
    add('c05_cave_entrance', l5, sx, into='fade', cam=dict(zoom=(1.4, 1.55), panx=(0.05, 0.06), pany=(0.11, 0.12),
                                                       dolly=(0.0, 0.08)),
        fx=dict(fog=0.1, dust=15, grade=dict(cave, exposure=-0.02)))       # in on the boys with flashlights
    add('c08_ledge_wide', sx, l6, cam=dict(zoom=(1.08, 1.2), pany=(0.04, 0.06), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=20, grade=cave))
    # L6 no food; the coach, a former monk, teaches them to meditate
    tr = wt('L6', 'ТРЕНЕР') - 0.06
    l7 = L('L7')['start'] - 0.08
    add('c01_boys_ledge_s201', l6, tr, into='fade', cam=dict(zoom=(1.45, 1.55), panx=(0.06, 0.07), pany=(0.07, 0.08),
                                                             parx=(-8, 8)),
        fx=dict(dust=20, grade=lamp))
    uc = wt('L6', 'УЧИЛ') - 0.06
    add('c09_coach_meditate', tr, uc, cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.06)),
        fx=dict(dust=30, grade=lamp))
    add('c09_coach_meditate', uc, l7, cam=dict(zoom=(1.5, 1.62), pany=(-0.12, -0.12), dolly=(0.0, 0.04)),
        fx=dict(dust=20, grade=lamp))
    # L7 thousands search above; «девять дней ни звука»: the dark ledge, silence
    nine = p['silence']
    l8 = L('L8')['start'] - 0.1
    add('c10_rescue_camp', l7, nine, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(rain=160, bloom=0.5, grade=camp))
    add('c08_ledge_wide', nine, l8, cam=dict(zoom=(1.45, 1.55), panx=(-0.05, -0.05), pany=(0.12, 0.12), dolly=(0.0, 0.04)),
        fx=dict(dust=10, blackout=(L('L7')['end'] + 0.25, l8), grade=dict(cave, exposure=-0.14, sat=0.7)))
    # L8 day ten: two British divers come up out of the water. «Сколько вас?» — «Тринадцать». All alive.
    sk = wt('L8', 'СКОЛЬКО') - 0.06
    fd = p['found']
    l9 = L('L9')['start'] - 0.08
    vn = wt('L8', 'ВЫНЫРНУЛИ') - 0.06
    add('c12_found_s212', l8, vn, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(bubbles=30, grade=cave))
    add('c02_diver_tunnel_s102', vn, sk, cam=dict(zoom=(1.2, 1.3), pany=(0.08, 0.06), dolly=(0.0, 0.06)),
        fx=dict(bubbles=40, grade=cave))
    add('c12_found_s112', sk, fd - 0.06, cam=dict(zoom=(1.3, 1.4), panx=(0.05, 0.05), pany=(0.1, 0.1)),
        fx=dict(dust=20, grade=lamp))
    add('c13_boys_light', fd - 0.06, l9, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08)),
        fx=dict(dust=30, bloom=0.6, light=beam(0.5, 0.4, 1.2), punch=[(fd, 0.05)], grade=lamp))
    # L9 the only way out is under water, and most of the boys can't swim
    a9 = wt('L9', 'А') - 0.06
    l10 = L('L10')['start'] - 0.08
    add('c14b_flooded_tunnel', l9, a9, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1)),
        fx=dict(bubbles=50, grade=under))      # a diver going down a narrow flooded crack
    add('c01_boys_ledge_s201', a9, l10, cam=dict(zoom=(1.5, 1.6), panx=(0.17, 0.18), pany=(-0.07, -0.06), parx=(-6, 6)),
        fx=dict(dust=15, grade=dict(lamp, exposure=-0.04, sat=0.85)))
    # L10 the air runs out; a rescuer dies carrying the tanks in
    od = wt('L10', 'ОДИН') - 0.06
    l11 = L('L11')['start'] - 0.1
    add('c15_air_tanks', l10, od, into='fade', cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(dust=20, light=beam(0.5, 0.4, 0.7), grade=cave))
    add('c16_lone_diver', od, l11, cam=dict(zoom=(1.0, 1.16), dolly=(0.0, 0.1)),
        fx=dict(bubbles=25, blackout=(L('L10')['end'] + 0.3, l11), grade=dict(under, exposure=-0.06, sat=0.75)))
    # L11 the insane plan: every boy put to sleep, a mask, pulled through the flooded tunnels (drums)
    kd = wt('L11', 'КАЖДОГО') - 0.06
    nd = wt('L11', 'НАДЕЛИ') - 0.06
    pr = wt('L11', 'ПРОТАЩИЛИ') - 0.06
    l12 = L('L12')['start'] - 0.08
    add('c11_divers_prepare', l11, kd, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(bloom=0.4, beat=[rescue], punch=[(wt('L11', 'БЕЗУМНЫЙ'), 0.05)], grade=camp))
    add('c18b_mask_sleep', kd, nd, into='zoom', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06)),
        fx=dict(beat=[rescue], light=beam(0.5, 0.4, 0.8), grade=cave))
    add('c03_mask_stretcher', nd, pr, cam=dict(zoom=(1.3, 1.4), pany=(-0.02, -0.03), parx=(-6, 6)),
        fx=dict(beat=[rescue], grade=cave))
    add('c14_underwater_narrow_s114', pr, l12, into='zoom', cam=dict(zoom=(1.25, 1.4), pany=(-0.1, -0.08), dolly=(0.0, 0.08)),
        fx=dict(bubbles=40, beat=[rescue], grade=under))     # the diver along the guide rope across the flooded hall
    # L12 three days, four boys a day; on the last day the coach as well
    vl = wt('L12', 'В') - 0.06
    l13 = L('L13')['start'] - 0.08
    add('c19_stretcher_carry_s219', l12, vl, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(dust=20, beat=[rescue], grade=cave))
    add('c25_exit_light', vl, l13, into='zoom', cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.1)),
        fx=dict(dust=40, bloom=0.8, beat=[rescue], grade=dict(lamp, exposure=0.03)))
    # L13 hours later the main pump fails and the water rushes back
    i13 = wt('L13', 'И') - 0.06
    pm = p['pump']
    fl = p['flood']
    l14 = L('L14')['start'] - 0.08
    add('c21_ambulances', l13, pm - 0.06, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(rain=180, bloom=0.6, grade=camp))
    add('c22_pumps', pm - 0.06, i13, cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(punch=[(pm, 0.06)], shake=[(pm, 0.6, 10)], grade=camp))
    add('c07_flood_passage', i13, l14, into='flash', cam=dict(zoom=(1.2, 1.36), dolly=(0.0, 0.1), roll=(0.0, -1.5)),
        fx=dict(punch=[(fl, 0.08)], shake=[(fl, 1.4, 14)], blackout=(L('L13')['end'] + 0.2, l14), grade=cave))
    # L14 all thirteen survived; the question, cut between the coach and the divers
    kk = wt('L14', 'КАК') - 0.06
    sp = wt('L14', 'СПОКОЙСТВИЕ') - 0.06
    il = wt('L14', 'ИЛИ') - 0.06
    add('c24_hospital', l14, kk, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-10, 10)),
        fx=dict(dust=15, bloom=0.4, grade=ward))
    add('c25_exit_light', kk, sp, cam=dict(zoom=(1.2, 1.3), dolly=(0.0, 0.06)),
        fx=dict(dust=30, bloom=0.7, grade=dict(lamp, exposure=0.03)))
    add('c09_coach_meditate', sp, il, cam=dict(zoom=(1.28, 1.36), pany=(-0.03, -0.03), parx=(-6, 6)),
        fx=dict(dust=20, light=beam(0.5, 0.35, 0.8), grade=lamp))
    add('c02_diver_tunnel_s102', il, total, cam=dict(zoom=(1.18, 1.04), dolly=(0.06, 0.0)),
        fx=dict(dust=25, bubbles=20, grade=dict(cave, exposure=0.02)))

    cards = [
        dict(text='4 КМ', sub='ОТ ВХОДА', start=wt('L5', '4'), end=l6 - 0.05, y=760),
        dict(text='9', sub='ДНЕЙ ТИШИНЫ', start=nine + 0.1, end=L('L7')['end'] + 0.25, y=520, count=True, count_dur=0.8),
        dict(text='13', sub='ЧЕЛОВЕК', start=fd, end=l9 - 0.05, y=300),          # above the boys' faces
        dict(text='13', sub='ВЫЖИЛИ', start=wt('L14', '13'), end=kk - 0.05, y=330, count=True, count_dur=0.7),
    ]
    tags = [
        dict(text='ДИКИЕ КАБАНЫ · 23 ИЮНЯ', start=l3 + 0.3, end=zsh - 0.1),
        dict(text='ПЕЩЕРА ТХАМЛУАНГ', start=zsh + 0.1, end=nn - 0.05),
        dict(text='ЭККАПОЛ ЧАНТАВОНГ', start=tr + 0.15, end=l7 - 0.1),
        dict(text='ОКОЛО 10 000 ЧЕЛОВЕК', start=l7 + 0.3, end=nine - 0.05),
        dict(text='СТЭНТОН И ВОЛАНТЕН', start=l8 + 0.4, end=sk - 0.05),
        dict(text='САМЫЙ УЗКИЙ ЛАЗ · 38 СМ', start=l9 + 0.3, end=a9 - 0.05),
        dict(text='КИСЛОРОД УПАЛ ДО 15%', start=l10 + 0.3, end=od - 0.05),
        dict(text='САМАН КУНАН · 6 ИЮЛЯ', start=od + 0.2, end=L('L10')['end'] + 0.3),
        dict(text='8, 9 И 10 ИЮЛЯ', start=l12 + 0.2, end=vl - 0.05),
        dict(text='18 ДНЕЙ ПОД ЗЕМЛЁЙ', start=kk + 0.1, end=sp - 0.05),
    ]
    cover = dict(start=0.0, end=wt('L1', '12') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


def _tape_stop(x, ts, dur):
    """Slow the bus down to a halt from ts over dur (like a stopping turntable); silence after it."""
    i0, n = int(ts * SR), int(dur * SR)
    if i0 >= len(x):
        return x
    u = np.arange(n) / n
    pos = i0 + np.cumsum((1 - u) ** 1.7)
    seg = np.stack([np.interp(pos, np.arange(len(x)), x[:, ch]) for ch in range(x.shape[1])], axis=1)
    seg *= (1 - u ** 3)[:, None]
    y = x.copy()
    e = min(len(x), i0 + n)
    y[i0:e] = seg[:e - i0]
    y[e:] = 0.0
    return y


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    p = plan(L, tl['words'])
    total = tl['total']
    m.story = np.zeros_like(m.beds)        # the rescue drums (they stop like a tape when the pump dies)

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: deep in the cave, the dark pulse
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -5.0, fin=0.0, fout=0.08)
    loop('beds', 'cave_drips', h0, h1 + 0.6, -4.0, fin=0.0, fout=0.5)
    loop('beds', 'drone_bed_tension', h0, h1, -10.0, fin=0.3, fout=0.1)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'impact_soft', wt('L1', 'ЗАСТРЯЛИ'), -8.0)
    put_hit(m, 'drum_big', p['sleep'], -2.0)
    put_hit(m, 'sub_drop', p['sleep'], -5.0)
    put_hit(m, 'heartbeat', L['L2']['end'] + 0.2, -7.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [p['sleep'], p['rain'], p['found'], p['silence'], p['pump'], p['flood'], L['L11']['start']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -15.0)
    # --- the team rides to the cave; the piano tells the story
    l3, l4 = L['L3']['start'], L['L4']['start']
    zsh = wt('L3', 'ЗАШЛА')
    loop('beds', 'ambience_morning_taiga', l3 - 0.3, zsh + 0.4, -9.0, fin=0.5, fout=0.6)
    loop('beds', 'piano_sad', l3 - 0.2, p['rain'] + 0.2, -7.0, fin=0.6, fout=0.4)
    loop('beds', 'cave_drips', zsh, p['rain'], -8.0, fin=0.6, fout=0.3)
    put_hit(m, 'tick', wt('L3', 'НЕНАДОЛГО'), -12.0)
    # --- the monsoon and the flood
    rn = p['rain']
    put_hit(m, 'thunder', rn, -2.0)
    loop('beds', 'rain_heavy', wt('L4', 'ХЛЫНУЛ') - 0.2, L['L5']['start'] + 0.6, -4.0, fin=0.2, fout=0.8)
    loop('beds', 'water_rush', wt('L4', 'ВОДА') - 0.1, L['L5']['start'] + 1.0, -4.0, fin=0.2, fout=1.0)
    loop('beds', 'drone_bed_tension', l4, L['L5']['start'] + 0.5, -10.0, fin=0.3, fout=0.6)
    put_hit(m, 'impact_soft', wt('L4', 'ВЫХОД'), -5.0)
    # --- deeper and deeper; a ledge; the coach and the meditation
    l5, l7 = L['L5']['start'], L['L7']['start']
    loop('beds', 'cave_drips', l5, p['silence'] + 0.1, -6.0, fin=0.8, fout=0.1)
    loop('beds', 'piano_sad', l5 + 0.3, l7 + 0.3, -8.0, fin=1.0, fout=0.6)
    loop('beds', 'drone_bed', l5, l7, -12.0, fin=0.8, fout=0.6)
    # --- the search above: rain, radios, the pulse; then nine days of silence
    nine = p['silence']
    loop('beds', 'rain_heavy', l7 - 0.2, nine, -9.0, fin=0.4, fout=0.06)
    loop('beds', 'pulse_dark', l7, nine, -9.0, fin=0.4, fout=0.04)
    put_hit(m, 'radio_static', l7 + 0.25, -10.0)
    put_hit(m, 'radio_static', wt('L7', 'ТЫСЯЧИ'), -14.0)
    loop('beds', 'cave_drips', nine, L['L8']['start'] + 0.4, -8.0, fin=0.05, fout=0.4)
    put_hit(m, 'heartbeat', nine + 0.3, -6.0)
    # --- found: a diver surfaces, «тринадцать», the strings
    l8 = L['L8']['start']
    loop('beds', 'underwater', l8 - 0.1, wt('L8', 'ДВОЕ'), -8.0, fin=0.3, fout=0.4)
    put_hit(m, 'diver_breath', wt('L8', 'ВЫНЫРНУЛИ'), -4.0)
    loop('beds', 'cave_drips', l8, L['L9']['start'], -10.0, fin=0.3, fout=0.4)
    put_hit(m, 'riser_2s', p['found'], -12.0)
    put_hit(m, 'impact_soft', p['found'], -6.0)
    loop('beds', 'pad_hope', wt('L8', 'СКОЛЬКО') - 0.3, L['L9']['start'] + 0.4, -6.0, fin=0.8, fout=0.6)
    # --- the way out is under water; the air runs out; a rescuer dies
    l9, l10, l11 = L['L9']['start'], L['L10']['start'], L['L11']['start']
    loop('beds', 'underwater', l9 - 0.05, wt('L9', 'А') + 0.2, -5.0, fin=0.2, fout=0.4)
    loop('beds', 'drone_bed_tension', l9, l11 - 0.3, -9.0, fin=0.5, fout=0.5)
    loop('beds', 'cave_drips', wt('L9', 'А'), l11 - 0.2, -9.0, fin=0.4, fout=0.5)
    put_hit(m, 'diver_breath', l10 + 0.1, -10.0)
    od = wt('L10', 'ОДИН')
    loop('beds', 'piano_sad', od - 0.1, l11 - 0.1, -10.0, fin=0.8, fout=0.5)
    put_hit(m, 'sub_drop', p['died'], -6.0)
    put_hit(m, 'heartbeat', L['L10']['end'] + 0.25, -8.0)
    # --- the rescue: drums and the pulse; the tunnels; the coach comes out last
    r0, r1 = p['rescue']
    put_hit(m, 'riser_2s', r0 + 0.1, -10.0)
    loop('story', 'drums_build', r0, r1 + 1.0, -3.0, fin=0.05, fout=0.02)
    loop('story', 'pulse_dark', r0, r1 + 1.0, -8.0, fin=0.3, fout=0.02)
    loop('story', 'pad_hope', wt('L12', 'В') - 0.3, r1 + 1.0, -8.0, fin=0.8, fout=0.02)
    m.story = _tape_stop(m.story, r1 + 0.05, 0.8)
    put_hit(m, 'drum_big', wt('L11', 'БЕЗУМНЫЙ'), -4.0)
    put_hit(m, 'diver_breath', wt('L11', 'ПРОТАЩИЛИ'), -6.0)
    loop('beds', 'underwater', wt('L11', 'ПРОТАЩИЛИ') - 0.1, L['L12']['start'] + 0.3, -8.0, fin=0.2, fout=0.4)
    loop('beds', 'rain_heavy', wt('L12', '4') - 0.3, wt('L12', 'В'), -12.0, fin=0.3, fout=0.4)
    put_hit(m, 'impact_soft', wt('L12', 'ТРЕНЕРА'), -6.0)
    # --- the pump dies, the water comes back
    l13 = L['L13']['start']
    loop('beds', 'rain_heavy', l13 - 0.1, p['flood'], -12.0, fin=0.3, fout=0.3)
    loop('beds', 'drone_bed_tension', l13, p['flood'], -10.0, fin=0.2, fout=0.1)
    put_hit(m, 'pump_fail', p['pump'] + 0.5, -2.0)               # the motor winds down under «сломался главный насос»
    loop('beds', 'water_rush', p['flood'] - 0.1, L['L14']['start'] + 0.3, -2.0, fin=0.1, fout=0.5)
    put_hit(m, 'boom_big', p['flood'], -6.0)
    put_hit(m, 'sub_drop', p['flood'], -6.0)
    # --- all thirteen survived; the question over the strings and the piano
    o0 = p['outro'][0]
    loop('beds', 'pad_hope', o0, total, -6.0, fin=0.6, fout=1.6)
    loop('beds', 'piano_sad', o0 + 0.2, total, -8.0, fin=0.8, fout=1.6)
    put_hit(m, 'sting_end', L['L14']['end'] + 0.1, -6.0)
    m.beds += m.story
