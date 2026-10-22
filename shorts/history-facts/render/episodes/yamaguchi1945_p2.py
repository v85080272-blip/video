"""Тайны истории №9, часть 2: «Две бомбы» (Цутому Ямагути в Нагасаки, 9 августа 1945, и что было потом).

vla 22.10: «можем сделать 2 часть продолжение этой истории?». Part 1 ended on «комнату заливает тот же белый свет...»,
so part 2 picks up in the Nagasaki office. Hook first (vla 21.10): «ожоги от первой атомной бомбы спасли его жену и
сына от второй» as big live text, then the story: the flash he recognises, the floor, the windows bursting, his house
gone, his wife and son alive, a week of fever, the long life and Cameron's film. The last line answers the hook's
riddle (she had gone out for ointment for his burns and hid with the baby in a tunnel) and runs back into it: the
tunnel whites out into the cover (his wife with the baby in the ruins, «ожоги спасли семью»). Voice «Историк»
(h4_s52). Pictures: cloud stills (SDXL Lightning, yamaguchi1945/shots_part2.json, shots_part2_modern.json and the
second tries in shots_part2_extra.json) plus part 1's office and his face.
"""
import numpy as np

DISPLAY = {
    'L1': 'ОЖОГИ ОТ ПЕРВОЙ АТОМНОЙ БОМБЫ СПАСЛИ ЕГО ЖЕНУ И СЫНА ОТ ВТОРОЙ.',
    'L2': '9{девятое} АВГУСТА, НАГАСАКИ.',
    'L3': 'В БИНТАХ ПОСЛЕ ХИРОСИМЫ ОН СНОВА ВИДИТ ТОТ ЖЕ БЕЛЫЙ СВЕТ.',
    'L4': 'ОН УЗНАЁТ ЕГО И ПАДАЕТ НА ПОЛ.',
    'L5': 'ВЗРЫВНАЯ ВОЛНА ВЫБИВАЕТ СТЁКЛА И СРЫВАЕТ С НЕГО БИНТЫ.',
    'L6': 'ОН БЕЖИТ ДОМОЙ. ЕГО ДОМ РАЗРУШЕН.',
    'L7': 'НО ЖЕНА И МАЛЕНЬКИЙ СЫН ЖИВЫ.',
    'L8': 'ПОТОМ НЕДЕЛЮ ЖАР И РВОТА ОТ РАДИАЦИИ.',
    'L9': 'ОН ВЫЖИВЕТ. И ДЖЕЙМС КЭМЕРОН ЗАХОЧЕТ СНЯТЬ О НЁМ ФИЛЬМ.',
    'L10': 'НО ГДЕ БЫЛИ ЖЕНА И СЫН?',
    'L11': 'ОНА УШЛА ИСКАТЬ МАЗЬ ОТ ЕГО ОЖОГОВ И СПРЯТАЛАСЬ С МАЛЫШОМ В ТОННЕЛЕ...',
}
HILITE = {'ОЖОГИ', 'СПАСЛИ', 'ВТОРОЙ.', '9', 'НАГАСАКИ.', 'БЕЛЫЙ', 'ПОЛ.', 'БИНТЫ.', 'РАЗРУШЕН.', 'ЖИВЫ.',
          'РАДИАЦИИ.', 'КЭМЕРОН', 'ФИЛЬМ.', 'ГДЕ', 'МАЗЬ', 'ТОННЕЛЕ...'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); after L4 the blast arrives in a gap of its own, away from the words
GAPS = {'L1': 0.35, 'L2': 0.25, 'L3': 0.2, 'L4': 0.8, 'L5': 0.35, 'L6': 0.3, 'L7': 0.45, 'L8': 0.35, 'L9': 0.5,
        'L10': 0.25, 'L11': 0.0}
LEAD_IN = 0.15
TAIL = 0.6                         # the tunnel's white-out holds a moment after the last word, then loops to the cover
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №9', year='1945', lines=['ОЖОГИ', 'СПАСЛИ СЕМЬЮ'], part='ЧАСТЬ 2',
             # the preview cover (thumb.py, yamaguchi1945/thumbs_part2.json) in the first frames, so YouTube's frame
             # picker can take it (vla 21.10: catchy covers only for the newest video)
             img='/mnt/project-files/history-facts/yamaguchi1945-chast2/covers/ozhogi_spasli_semyu.jpg')
COVER_B = ['ОЖОГИ', 'СПАСЛИ СЕМЬЮ']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №9', over_last=3.7)      # on «в тоннеле», after she is seen hiding with the baby
# stills chosen by seed: part 2's (shots_part2*.json) and part 1's office and face
HERO = 'y01_hero_s101'
OFFICE = 'y10_office_s1003'
TUNNEL = 'p01_tunnel_s102'           # light from above reads as the flash; s101's baby has a red eye
NAGA = 'p02_nagasaki_s201'
WINDOW = 'p03_window_s302'           # s301 is a passport photo, no window
FLOOR = 'p04_floor_s402'             # s401 looks asleep at a desk
FLOOR2 = 'p04b_bandage_s411'         # on his back among flying papers (shots_part2_extra.json)
GLASS = 'p05b_glass_s511'            # glass in mid-air; s501 is a still window
RUN = 'p06_run_s601'
HOUSE = 'p07b_house_s712'            # the burned district in smoke; s711 has whole roofs
HOUSE2 = 'p07_house_s701'            # a lone house among debris, for «где были жена и сын?»
FAMILY = 'p08_family_s802'           # s801 has him holding a toddler, no wife
SHELTER = 'p09b_shelter_s911'        # s901 has a stray limb, s902 two men kneeling
OLD = 'p10_old_s1001'
FILM = 'p11_film_s1101'
MOTHER = 'p13_mother_walk_s1301'     # s1302 has no baby
SFX_DIRS = ['/home/user/work/sfx/yamaguchi', '/home/user/work/sfx/rescue', '/home/user/work/sfx/olga',
            '/home/user/work/sfx/dance', '/home/user/work/sfx']
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
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)                      # the dark pulse under the hook
    p['saved'] = wt('L1', 'СПАСЛИ')
    p['second'] = wt('L1', 'ВТОРОЙ')
    p['naga'] = wt('L2', 'НАГАСАКИ')
    p['calm'] = (lines['L2']['start'] - 0.15, wt('L3', 'БЕЛЫЙ'))     # the last calm minutes before 11:02
    p['again'] = wt('L3', 'СНОВА')
    p['white'] = wt('L3', 'БЕЛЫЙ')
    p['knows'] = wt('L4', 'УЗНАЁТ')
    p['floor'] = wt('L4', 'ПАДАЕТ')
    p['boom'] = lines['L4']['end'] + 0.1                             # the blast wave in the pause after «на пол»
    p['glass'] = wt('L5', 'ВЫБИВАЕТ')
    p['torn'] = wt('L5', 'СРЫВАЕТ')
    p['run'] = (lines['L6']['start'] - 0.1, lines['L7']['start'] - 0.1)
    p['ruin'] = wt('L6', 'РАЗРУШЕН')
    p['alive'] = wt('L7', 'ЖИВЫ')
    p['fever'] = (lines['L8']['start'] - 0.1, lines['L9']['start'] - 0.1)
    p['survive'] = wt('L9', 'ВЫЖИВЕТ')
    p['cameron'] = wt('L9', 'ДЖЕЙМС')
    p['film'] = wt('L9', 'ФИЛЬМ')
    p['where'] = wt('L10', 'ГДЕ')
    p['ointment'] = wt('L11', 'МАЗЬ')
    p['hid'] = wt('L11', 'СПРЯТАЛАСЬ')
    p['tunnel'] = wt('L11', 'ТОННЕЛЕ')
    p['cliff'] = (lines['L11']['start'] - 0.1, None)                 # the riddle's answer runs back into the hook
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    face = dict(exposure=-0.04, contrast=1.08, sat=0.8, warm=0.25, demagenta=0.3)        # his face, dim office light
    tunnel = dict(exposure=-0.02, contrast=1.12, sat=0.75, warm=0.3, demagenta=0.3)
    morning = dict(exposure=0.04, contrast=1.04, sat=0.9, warm=0.45, demagenta=0.3)     # the last calm morning
    office = dict(exposure=0.0, contrast=1.05, sat=0.8, warm=0.4, demagenta=0.3)
    blast = dict(exposure=0.06, contrast=1.12, sat=0.95, warm=1.0)
    ruins = dict(exposure=-0.08, contrast=1.12, sat=0.7, warm=0.6, demagenta=0.4)
    warm = dict(exposure=0.0, contrast=1.06, sat=0.85, warm=0.7, demagenta=0.3)         # the family alive
    dim = dict(exposure=-0.1, contrast=1.1, sat=0.6, warm=0.5, demagenta=0.4)           # the fever in the shelter
    now = dict(exposure=0.02, contrast=1.04, sat=0.85, warm=0.3, demagenta=0.2)         # the long life after
    hook = _beat(p['hook'], p['hook'][1], zoom=0.02, sway=0.3)
    white = (1.0, 0.97, 0.9)
    burn = dict(ash=60, embers=25, fire=0.4, light=dict(x=0.8, y=0.3, r=1.2, col=(0.5, 0.2, 0.03), flicker=0.3),
                grade=ruins)

    # L1 hook: «ожоги от первой атомной бомбы» on his bandaged face, «спасли его жену и сына» cuts to her in the
    # tunnel (another person, so a whip is fine), «от второй» flares the tunnel's mouth
    saved = p['saved'] - 0.06
    l2 = L('L2')['start'] - 0.08
    add(HERO, 0.0, saved, cam=dict(zoom=(1.12, 1.2), pany=(0.02, 0.03), parx=(-4, 4)),
        fx=dict(dust=20, beat=[hook], grade=face))
    add(TUNNEL, saved, l2, into='whip', cam=dict(zoom=(1.05, 1.15), panx=(0.04, 0.06), parx=(-6, 6)),
        fx=dict(dust=40, beat=[hook], bloom=0.6, punch=[(p['second'], 0.08)],
                flash=[(p['second'], 0.35, 0.9, white)], grade=tunnel))
    # L2 9 August, Nagasaki: the harbour and the shipyard from the hill, the last calm minutes
    l3 = L('L3')['start'] - 0.08
    add(NAGA, l2, l3, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(dust=12, punch=[(p['naga'], 0.05)], grade=morning))
    # L3 bandaged, in the office again (part 1's wide shot), then his face turning to the window as the white light
    # comes: a plain cut between the two shots of him (a whip doubled his face in part 1)
    again = p['again'] - 0.06
    add(OFFICE, l3, again, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=20, grade=office))
    knows = p['knows'] - 0.06
    add(WINDOW, again, knows, cam=dict(zoom=(1.08, 1.16), pany=(0.0, -0.01)),
        fx=dict(dust=25, bloom=0.9, flash=[(p['white'], 0.8, 1.4, white)], punch=[(p['white'], 0.08)],
                grade=dict(office, exposure=0.06)))
    # L4 «он узнаёт его»: closer on his eyes; «и падает на пол»: the camera drops with him, the blast in the pause
    floor = p['floor'] - 0.06
    add(WINDOW, knows, floor, cam=dict(zoom=(1.3, 1.4), pany=(-0.04, -0.05)),
        fx=dict(dust=25, bloom=1.0, punch=[(p['knows'], 0.05)], grade=dict(office, exposure=0.1)))
    l5 = L('L5')['start'] - 0.08
    bm = p['boom']
    add(FLOOR, floor, l5, cam=dict(zoom=(1.05, 1.12), parx=(-4, 4)),
        fx=dict(dust=40, drop=[(floor, 0.3, -90.0, 2.0)], bloom=0.8, shake=[(bm, 1.0, 30)], smear=[(bm, 0.4, 40)],
                flash=[(bm, 0.5, 0.5, white)], punch=[(bm, 0.1)], grade=dict(office, exposure=0.08)))
    # L5 the windows burst inward, then on the floor his bandages are torn off (the other still of him down there)
    torn = p['torn'] - 0.06
    add(GLASS, l5, torn, into='whip', cam=dict(zoom=(1.0, 1.12), roll=(0.0, -2.0)),
        fx=dict(dust=60, shake=[(p['glass'], 0.8, 24)], smear=[(p['glass'], 0.3, 50)], punch=[(p['glass'], 0.08)],
                bloom=0.7, grade=blast))
    l6 = L('L6')['start'] - 0.08
    add(FLOOR2, torn, l6, cam=dict(zoom=(1.1, 1.18), parx=(4, -4)),
        fx=dict(dust=60, ash=30, shake=[(torn, 0.5, 10)], punch=[(p['torn'], 0.05)], grade=dict(office, exposure=-0.04)))
    # L6 he runs home through the burning streets; «его дом разрушен»: the heap of beams that was his house
    ruin = wt('L6', 'ЕГО', nth=0) - 0.06
    add(RUN, l6, ruin, into='fade', cam=dict(zoom=(1.05, 1.15), dolly=(0.0, 0.08), parx=(-6, 6)),
        fx=dict(burn, beat=[_beat(p['run'], ruin, zoom=0.025)]))
    l7 = L('L7')['start'] - 0.08
    add(HOUSE, ruin, l7, into='whip', cam=dict(zoom=(1.0, 1.08), pany=(0.0, -0.02), parx=(-10, 10)),
        fx=dict(burn, fog=0.2, punch=[(p['ruin'], 0.06)]))
    # L7 his wife and their little son alive: the three of them in the ruins
    l8 = L('L8')['start'] - 0.08
    add(FAMILY, l7, l8, into='fade', cam=dict(zoom=(1.02, 1.1), dolly=(0.0, 0.05), parx=(-4, 4)),
        fx=dict(ash=25, punch=[(p['alive'], 0.05)], grade=warm))
    # L8 a week of fever in the shelter, the camera barely moving
    l9 = L('L9')['start'] - 0.08
    add(SHELTER, l8, l9, into='fade', cam=dict(zoom=(1.05, 1.14), pany=(0.0, 0.01)),
        fx=dict(dust=15, light=dict(x=0.2, y=0.6, r=0.9, col=(0.45, 0.25, 0.08), flicker=0.25), grade=dim))
    # L9 «он выживет»: him at ninety-three; «и Джеймс Кэмерон захочет снять о нём фильм»: the clapperboard
    jc = p['cameron'] - 0.06
    add(OLD, l9, jc, into='flash', cam=dict(zoom=(1.0, 1.08), pany=(0.03, 0.04), parx=(-4, 4)),
        fx=dict(dust=10, punch=[(p['survive'], 0.05)], grade=now))
    l10 = L('L10')['start'] - 0.08
    add(FILM, jc, l10, into='whip', cam=dict(zoom=(1.0, 1.12), panx=(0.02, -0.02), parx=(-10, 10)),
        fx=dict(dust=30, bloom=0.6, punch=[(p['film'], 0.06)], flash=[(jc + 0.06, 0.25, 0.4, white)], grade=now))
    # L10 «но где были жена и сын?»: a lone broken house, nobody there
    l11 = L('L11')['start'] - 0.08
    add(HOUSE2, l10, l11, into='fade', cam=dict(zoom=(1.08, 1.16), pany=(0.02, 0.03)),
        fx=dict(dust=20, ash=30, fog=0.3, punch=[(p['where'], 0.05)], grade=dict(ruins, sat=0.5)))
    # L11 she had gone out for ointment for his burns, the baby on her back; «и спряталась с малышом в тоннеле...»:
    # the tunnel again (a white flash into it: the bomb), the light swelling into the loop and the cover
    hid = p['hid'] - 0.06
    add(MOTHER, l11, hid, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-6, 6)),
        fx=dict(dust=15, punch=[(p['ointment'], 0.05)], grade=morning))
    add(TUNNEL, hid, total, into='flash', cam=dict(zoom=(1.1, 1.24), panx=(0.05, 0.07), dolly=(0.0, 0.08)),
        fx=dict(dust=50, bloom=0.6, shake=[(p['tunnel'], 0.6, 10)], punch=[(p['tunnel'], 0.06)],
                flash=[(p['tunnel'], 0.4, 0.45, white), (total - 0.3, 0.35, 2.0, white)], grade=tunnel))

    cards = [
        dict(text='93 ГОДА', start=p['survive'] + 0.1, end=jc - 0.05, y=950, count=True),   # on his chest, under the chin
    ]
    tags = [
        dict(text='НАГАСАКИ · 9 АВГУСТА, 11:02', start=L('L2')['start'] + 0.05, end=l3 - 0.05),
        dict(text='ЛУЧЕВАЯ БОЛЕЗНЬ', start=L('L8')['start'] + 0.1, end=l9 - 0.05),
        dict(text='РЕЖИССЁР «ТИТАНИКА»', start=jc + 0.15, end=l10 - 0.05),
    ]
    cover = dict(start=0.0, end=wt('L1', 'ОТ') - 0.2)
    hook_text = dict(lines=['L1'], y=1330, size=84)           # 12 words in 5 rows, under the mother and the baby
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text)


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

    # --- hook: the dark pulse and a heartbeat under his burns; «спасли» and «от второй» land on hits
    h0, h1 = p['hook']
    loop('beds', 'pulse_dark', h0, h1, -7.0, fin=0.0, fout=0.1)
    loop('beds', 'drone_bed_tension', h0, h1 + 0.3, -9.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'heartbeat', 0.3, -9.0)
    put_hit(m, 'impact_soft', p['saved'], -7.0)
    put_hit(m, 'drum_big', p['second'], -3.0)
    put_hit(m, 'sub_drop', p['second'], -5.0)
    # cuts get a soft whoosh, except where a hit already marks them
    loud = [p['saved'], p['second'], p['naga'], p['white'], p['floor'], p['boom'], p['glass'], p['torn'], p['ruin'],
            p['alive'], p['survive'], p['cameron'], p['where'], p['hid'], p['tunnel']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- 9 August, the last calm minutes: birds over the harbour, a hopeful pad, the office clock
    c0, c1 = p['calm']
    loop('beds', 'ambience_morning_taiga', c0, L['L3']['start'] + 0.3, -11.0, fin=0.3, fout=0.3)
    loop('beds', 'pad_hope', c0, c1, -10.0, fin=0.5, fout=0.05)
    loop('beds', 'tick', L['L3']['start'] - 0.2, c1, -12.0, fin=0.1, fout=0.02)
    put_hit(m, 'impact_soft', p['naga'], -8.0)
    # --- the same white light: a low drop, a riser while he recognises it and drops; the blast in the pause
    put_hit(m, 'sub_drop', p['white'], -7.0)
    put_hit(m, 'heartbeat', p['knows'] - 0.1, -8.0)
    loop('beds', 'drone_bed_tension', p['white'], p['boom'], -9.0, fin=0.1, fout=0.05)
    put_hit(m, 'whoosh_short', p['floor'] - 0.05, -10.0)
    put_hit(m, 'impact_soft', p['floor'] + 0.25, -7.0)
    put_hit(m, 'boom_big', p['boom'], -4.0)
    put_hit(m, 'shockwave', p['boom'] + 0.05, -6.0)
    put_hit(m, 'glass_shatter', p['glass'] - 0.05, -6.0)
    put_hit(m, 'whoosh_short', p['torn'] - 0.05, -11.0)
    loop('beds', 'rumble_long', p['boom'] + 0.2, L['L6']['start'] + 1.0, -8.0, fin=0.2, fout=0.8)
    # --- the run home through the fires; «разрушен»
    r0, r1 = p['run']
    loop('beds', 'fire_crackle', r0, r1, -8.0, fin=0.3, fout=0.4)
    loop('beds', 'ambience_wind_dead_forest', r0, r1, -10.0, fin=0.3, fout=0.4)
    put_hit(m, 'heartbeat', r0 + 0.1, -7.0)
    put_hit(m, 'drum_big', p['ruin'], -5.0)
    # --- his wife and son alive: the piano, softly
    loop('beds', 'piano_sad', L['L7']['start'] - 0.2, p['fever'][1] + 0.2, -9.0, fin=0.4, fout=0.4)
    put_hit(m, 'impact_soft', p['alive'], -8.0)
    # --- the fever: a low bed and a slow heart
    f0, f1 = p['fever']
    loop('beds', 'drone_bed', f0, f1, -12.0, fin=0.4, fout=0.3)
    put_hit(m, 'heartbeat', f0 + 0.2, -9.0)
    # --- he survives: the hopeful pad again; Cameron's film: a shutter and a punch
    loop('beds', 'pad_hope', L['L9']['start'] - 0.1, L['L10']['start'] - 0.1, -9.0, fin=0.3, fout=0.2)
    put_hit(m, 'impact_soft', p['survive'], -7.0)
    put_hit(m, 'camera_shutter_flash', p['cameron'], -8.0)
    put_hit(m, 'impact_soft', p['film'], -7.0)
    # --- the riddle: where were they? tension into the answer, a riser into the loop (the hook's boom answers it)
    c0 = L['L10']['start'] - 0.1
    loop('beds', 'drone_bed_tension', c0, total, -9.0, fin=0.3, fout=0.03)
    loop('beds', 'pulse_dark', c0, total, -9.0, fin=0.3, fout=0.03)
    put_hit(m, 'sub_drop', p['where'], -9.0)
    put_hit(m, 'heartbeat', L['L11']['start'] + 0.1, -8.0)
    put_hit(m, 'riser_4s', p['hid'] - 0.2, -10.0)
    put_hit(m, 'whoosh_long', p['tunnel'] - 0.1, -10.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
