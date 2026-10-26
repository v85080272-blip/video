"""Тайны истории №1: «Что взорвалось над Сибирью?» (Tunguska, 30 June 1908)."""
import os

# {spoken} gives the words the narrator actually says for a shown token (for timing by syllables).
DISPLAY = {
    'L1': 'В 1908{тысяча девятьсот восьмом} ГОДУ НАД СИБИРЬЮ ВЗОРВАЛОСЬ НЕЧТО В СОТНИ РАЗ МОЩНЕЕ ХИРОСИМЫ.',
    'L2': 'И ДО СИХ ПОР НИКТО ТОЧНО НЕ ЗНАЕТ, ЧТО ЭТО БЫЛО.',
    'L3': 'УТРО 30{тридцатого} ИЮНЯ. ФАКТОРИЯ ВАНАВАРА. МЕСТНЫЙ ЖИТЕЛЬ СЕМЁНОВ СИДИТ НА КРЫЛЬЦЕ.',
    'L4': 'ВДРУГ НЕБО РАСКАЛЫВАЕТСЯ НАДВОЕ, И НАД ЛЕСОМ ВСТАЁТ ОГОНЬ.',
    'L5': 'ЖАР ТАКОЙ, БУДТО НА НЁМ ЗАГОРЕЛАСЬ РУБАШКА. УДАР СБРАСЫВАЕТ ЕГО С КРЫЛЬЦА.',
    'L6': 'А ДО ВЗРЫВА — 65{шестьдесят пять} КИЛОМЕТРОВ.',
    'L7': 'В ТАЙГЕ ПАДАЮТ МИЛЛИОНЫ ДЕРЕВЬЕВ. ПЛОЩАДЬ — ПОЧТИ КАК ВСЯ МОСКВА.',
    'L8': 'НЕСКОЛЬКО НОЧЕЙ НЕБО НАД ЕВРОПОЙ СВЕТИТСЯ ТАК, ЧТО В ПОЛНОЧЬ МОЖНО ЧИТАТЬ ГАЗЕТУ.',
    'L9': 'УЧЁНЫЕ ДОБИРАЮТСЯ ТУДА ТОЛЬКО ЧЕРЕЗ 19{девятнадцать} ЛЕТ. ЛЕОНИД КУЛИК ИЩЕТ ГИГАНТСКИЙ ЖЕЛЕЗНЫЙ МЕТЕОРИТ.',
    'L10': 'И НЕ НАХОДИТ НИЧЕГО. НИ КРАТЕРА. НИ ОСКОЛКОВ.',
    'L11': 'ТОЛЬКО ПОВАЛЕННЫЙ ЛЕС, А В ЦЕНТРЕ — МЁРТВЫЕ ДЕРЕВЬЯ БЕЗ ВЕТОК, КАК ТЕЛЕГРАФНЫЕ СТОЛБЫ.',
    'L12': 'СКОРЕЕ ВСЕГО, В ВОЗДУХЕ ВЗОРВАЛСЯ АСТЕРОИД ИЛИ КОМЕТА. НО СПОРЯТ ОБ ЭТОМ ДО СИХ ПОР.',
    'L13': 'А ТЫ КАК ДУМАЕШЬ, ЧТО ЭТО БЫЛО?',
}
HILITE = {'1908', '30', '65', '19', 'ХИРОСИМЫ.', 'МОСКВА.', 'НИЧЕГО.', 'КОМЕТА.', 'АСТЕРОИД', 'ОГОНЬ.', 'ГАЗЕТУ.',
          'СТОЛБЫ.', 'КИЛОМЕТРОВ.', 'ЛЕТ.'}

# gap (s) after each line before the next one starts
GAPS = {'L1': 0.30, 'L2': 0.45, 'L3': 0.30, 'L4': 0.15, 'L5': 0.75, 'L6': 0.45, 'L7': 0.35, 'L8': 0.45,
        'L9': 0.35, 'L10': 0.30, 'L11': 0.40, 'L12': 0.45, 'L13': 0.0}
LEAD_IN = 0.25
TAIL = 1.6
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №1', year='1908', lines=['ЧТО ВЗОРВАЛОСЬ', 'НАД СИБИРЬЮ?'])
COVER_B = ['ВЗРЫВ', 'БЕЗ ВОРОНКИ']
ENDCARD = None                     # published before the closing «Подпишись» card; kept as released
SFX_DIRS = ['/home/user/work/sfx']


def layout(c):
    """Shots (via c.add), number cards, place tags and the cover window."""
    L, add, word_t, word_before, total = c.L, c.add, c.word_t, c.word_before, c.total
    c1 = L('L2')['start'] - 0.12
    c1a = word_before('L1', 'СОТНИ') - 0.05          # "в сотни раз" -> closer on the fireball
    hiro = word_t('L1', 'ХИРОСИМЫ')
    s01_fx = dict(embers=70, heat=1.0, bloom=0.9, fire=1.0,
                  grade=dict(exposure=0.05, contrast=1.08, sat=1.05, warm=0.6, demagenta=0.6))
    add('s01_fireball', 0.0, c1a, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.08), pany=(0.0, -0.01), parx=(0, 14)),
        fx=dict(s01_fx, flash=[(0.12, 0.45, 0.7)], shake=[(0.12, 1.4, 16)]))
    add('s01_fireball', c1a, c1, into='zoom', cam=dict(zoom=(1.34, 1.46), pany=(0.03, 0.03), parx=(-10, 10)),
        fx=dict(s01_fx, punch=[(hiro, 0.07)], shake=[(hiro, 0.6, 10)]))
    c2 = L('L3')['start'] - 0.1
    add('s14_mystery', c1, c2, cam=dict(zoom=(1.08, 1.0), parx=(-26, 26), dolly=(0.06, 0.0)),
        fx=dict(fog=0.35, ash=40, grade=dict(exposure=-0.15, contrast=1.05, sat=0.85, teal=0.8)), into='zoom')
    c3 = word_t('L3', 'МЕСТНЫЙ') - 0.08
    add('s02_trading_post', c2, c3, cam=dict(zoom=(1.0, 1.07), panx=(-0.02, 0.02), parx=(-20, 20)),
        fx=dict(dust=40, fog=0.18, grade=dict(exposure=0.05, contrast=1.02, sat=0.95, warm=0.5)), into='fade')
    c4 = L('L4')['start'] - 0.06
    add('s03_semenov_porch', c3, c4, cam=dict(zoom=(1.04, 1.12), dolly=(0.0, 0.10), pany=(0.0, -0.01)),
        fx=dict(dust=30, grade=dict(exposure=0.0, contrast=1.04, sat=0.95, warm=0.55)))
    c5 = L('L5')['start'] - 0.06
    fire_t = word_t('L4', 'ОГОНЬ')
    add('s04_sky_splits', c4, c5, cam=dict(zoom=(1.0, 1.16), pany=(0.01, -0.02), dolly=(0.0, 0.08)),
        fx=dict(embers=50, flash=[(fire_t, 0.6, 1.1)], shake=[(fire_t, 1.3, 16)], heat=0.7, bloom=1.0, punch=[(fire_t, 0.08)], fire=1.0,
                grade=dict(exposure=0.0, contrast=1.1, sat=1.08, warm=0.8, demagenta=0.85)))
    hit_t = word_t('L5', 'УДАР')
    c5b = hit_t - 0.04
    add('s05_heat_face', c5, c5b, into='zoom',
        cam=dict(zoom=(1.06, 1.18), dolly=(0.0, 0.08), parx=(10, -10)),
        fx=dict(embers=60, heat=0.9, bloom=0.9,
                light=dict(x=0.15, y=0.25, r=1.2, col=(0.55, 0.22, 0.02), flicker=0.25),
                grade=dict(exposure=0.05, contrast=1.1, sat=1.05, warm=0.9)))
    # the blow: back on the porch, the frame is knocked sideways
    add('s03_semenov_porch', c5b, L('L5')['end'] + 0.35,
        cam=dict(zoom=(1.16, 1.32), roll=(-2.0, -9.0), pany=(0.0, 0.03)),
        fx=dict(embers=80, ash=60, flash=[(hit_t, 0.5, 1.6)], shake=[(hit_t, 1.2, 40)], smear=[(hit_t, 0.7, 70)], heat=0.8, bloom=1.0,
                punch=[(hit_t, 0.14)], light=dict(x=0.85, y=0.15, r=1.3, col=(0.7, 0.3, 0.05), flicker=0.35),
                blackout=(L('L5')['end'] + 0.05, L('L5')['end'] + 0.35),
                grade=dict(exposure=0.1, contrast=1.12, sat=1.0, warm=1.2)))
    c6 = L('L7')['start'] - 0.08
    add('s06b_distant_blast_s63', L('L5')['end'] + 0.35, c6,
        cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.01), parx=(-12, 12)),
        fx=dict(ring=dict(start=L('L6')['start'] + 0.2, x=0.5, y=0.322, r=300), bloom=0.8, dust=20,
                punch=[(word_t('L6', '65'), 0.06)],
                grade=dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.4)))
    c7 = word_t('L7', 'ПЛОЩАДЬ') - 0.08
    add('s07_shockwave_forest', c6, c7, into='zoom', cam=dict(zoom=(1.0, 1.14), panx=(0.02, -0.02), dolly=(0.0, 0.12)),
        fx=dict(ash=70, shake=[(c6, 2.0, 14)], smear=[(c6, 0.5, 40)], bloom=0.7, heat=0.5, punch=[(c6, 0.05)],
                grade=dict(exposure=0.0, contrast=1.08, sat=1.0, warm=0.6)))
    c8 = L('L8')['start'] - 0.08
    add('s08d_blowdown_s86', c7, c8, cam=dict(zoom=(1.14, 1.0), roll=(-1.5, 1.0), pary=(0, -14)),
        fx=dict(fog=0.15, ash=30, grade=dict(exposure=0.0, contrast=1.16, sat=0.9, warm=0.25, teal=0.3, demagenta=0.7)))
    c9 = L('L9')['start'] - 0.08
    c8b = word_before('L8', 'ПОЛНОЧЬ') - 0.05        # "в полночь можно читать газету" -> closer on the reader
    s09_fx = dict(dust=25, bloom=0.8, skyglow=dict(amt=1.2, h=0.6, far=0.45, col=(1.0, 0.85, 0.64)),
                  grade=dict(exposure=0.05, contrast=1.04, sat=0.95, warm=0.3, teal=0.4))
    add('s09_europe_night', c8, c8b, into='fade', cam=dict(zoom=(1.0, 1.08), pany=(0.015, -0.01), parx=(-18, 18)), fx=s09_fx)
    add('s09_europe_night', c8b, c9, cam=dict(zoom=(1.42, 1.5), panx=(0.1, 0.11), pany=(-0.02, -0.03), parx=(-8, 8)), fx=s09_fx)
    c10 = L('L10')['start'] - 0.08
    k_split = word_t('L9', 'ЛЕОНИД') - 0.08
    has_b = c.has_shot('s10b_kulik_closeup')
    old_look = dict(snow=110, fog=0.15, oldfilm=True, grade=dict(exposure=0.0, contrast=1.08, sat=0.35, warm=0.9))
    if has_b:
        add('s10_kulik_expedition', c9, k_split, cam=dict(zoom=(1.0, 1.08), panx=(0.015, -0.015), parx=(-22, 22)),
            fx=old_look, into='flash')
        add('s10b_kulik_closeup', k_split, c10, cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.08), parx=(12, -12)),
            fx=dict(old_look, snow=60))
    else:
        add('s10_kulik_expedition', c9, c10, cam=dict(zoom=(1.0, 1.1), panx=(0.015, -0.015), parx=(-22, 22)),
            fx=old_look, into='flash')
    c11 = L('L11')['start'] - 0.08
    c10b = word_before('L10', 'КРАТЕРА') - 0.05        # "ни кратера. ни осколков." -> closer on the lone explorer
    s11_fx = dict(fog=0.3, grade=dict(exposure=-0.05, contrast=1.04, sat=0.8, teal=0.6, demagenta=0.7))
    add('s11_empty_swamp', c10, c10b, cam=dict(zoom=(1.12, 1.04), dolly=(0.08, 0.0)),
        fx=dict(s11_fx, punch=[(word_t('L10', 'НИЧЕГО'), 0.05)]))
    add('s11_empty_swamp', c10b, c11, cam=dict(zoom=(1.42, 1.52), panx=(0.09, 0.1), pany=(0.0, 0.01), parx=(-10, 10)),
        fx=dict(s11_fx, punch=[(word_t('L10', 'ОСКОЛКОВ'), 0.04)]))
    c11b = word_before('L11', 'В') - 0.05              # "только поваленный лес, | а в центре ..."
    add('s08c_fallen_forest_s85', c11, c11b, into='zoom', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.1), parx=(-16, 16)),
        fx=dict(fog=0.25, ash=25, grade=dict(exposure=-0.06, contrast=1.08, sat=0.75, teal=0.6, demagenta=0.85)))
    c12 = L('L12')['start'] - 0.08
    add('s12_telegraph_forest', c11b, c12, cam=dict(zoom=(1.0, 1.1), parx=(-30, 30), dolly=(0.0, 0.06)),
        fx=dict(fog=0.45, ash=35, grade=dict(exposure=-0.1, contrast=1.06, sat=0.75, teal=0.8)))
    c12b = word_t('L12', 'НО') - 0.06                  # "но спорят об этом до сих пор" -> back to the mystery
    add('s13_comet', c12, c12b, into='fade', cam=dict(zoom=(1.0, 1.12), pany=(-0.01, 0.01), parx=(-14, 14)),
        fx=dict(bloom=1.0, dust=20, grade=dict(exposure=0.0, contrast=1.08, sat=1.0, teal=0.5, warm=0.3, demagenta=0.85)))
    c13 = L('L13')['start'] - 0.1
    add('s14_mystery', c12b, c13, into='zoom', cam=dict(zoom=(1.38, 1.48), panx=(-0.05, -0.04), pany=(0.11, 0.12), parx=(-12, 12)),
        fx=dict(fog=0.35, ash=30, grade=dict(exposure=-0.12, contrast=1.06, sat=0.85, teal=0.8)))
    add('s01_fireball_s12', c13, total, cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.10), parx=(10, -10)),
        fx=dict(embers=70, heat=1.0, bloom=0.9, fire=1.0, grade=dict(exposure=0.0, contrast=1.08, sat=1.05, warm=0.6)),
        into='flash')

    cards = [
        dict(text='65 КМ', sub='ДО ЭПИЦЕНТРА', start=word_t('L6', '65'), end=c6 - 0.05, y=900, count=True),
        dict(text='2000+ КМ²', sub='ПОВАЛЕННОГО ЛЕСА', start=word_t('L7', 'ПЛОЩАДЬ'), end=c8 - 0.05, y=700, count=True),
        dict(text='19 ЛЕТ', sub='СПУСТЯ', start=word_t('L9', '19'), end=(k_split - 0.05) if has_b else (c10 - 0.1), y=700, count=True),
    ]
    tags = [
        dict(text='ВАНАВАРА · 30 ИЮНЯ 1908', start=c2 + 0.15, end=c4 - 0.1),
        dict(text='ЕВРОПА · НОЧИ ПОСЛЕ ВЗРЫВА', start=c8 + 0.15, end=c8b - 0.1),
        dict(text='ЭКСПЕДИЦИЯ КУЛИКА · 1927', start=c9 + 0.3, end=word_t('L9', '19') - 0.05),
        dict(text='ЭПИЦЕНТР', start=c11b + 0.15, end=c12 - 0.1),
        dict(text='ВЕРСИЯ УЧЁНЫХ', start=c12 + 0.15, end=c12b - 0.1),
    ]
    cover = dict(start=0.0, end=word_t('L1', 'НЕЧТО') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


def mix_cues(m, tl, a):
    """Sound design on top of the narration. a: helpers (put_hit, sfx, wt)."""
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    cuts = [sh['start'] for sh in tl['shots'][1:]]
    fire_t = wt('L4', 'ОГОНЬ')
    hit_t = wt('L5', 'УДАР')
    # hook
    put_hit(m, 'boom_hook', 0.12, -1.0)   # lands with the first flash of the picture
    m.put('hits', sfx('rumble_long'), 0.2, -14.0, fade_out=2.0, length=4.0)
    # cuts
    for c in cuts:
        if abs(c - fire_t) < 0.4 or abs(c - hit_t) < 0.4:
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -11.0)
    # morning in Vanavara
    m.put('beds', sfx('ambience_morning_taiga'), L['L3']['start'] - 0.5, -2.0, fade_in=0.6, fade_out=0.5,
          length=(L['L4']['start'] + 0.4) - (L['L3']['start'] - 0.5))
    # sky splits
    put_hit(m, 'riser_2s', fire_t, -12.0)
    put_hit(m, 'boom_big', fire_t, -3.0)
    put_hit(m, 'boom_hook', fire_t, -7.0)
    m.put('beds', sfx('fire_crackle'), fire_t, -4.0, fade_in=0.4, fade_out=0.8,
          length=L['L6']['start'] - fire_t)
    # the blow
    put_hit(m, 'shockwave', hit_t, -8.0)
    put_hit(m, 'sub_drop', hit_t, -5.0)
    put_hit(m, 'impact_soft', hit_t, -6.0)
    # number cards
    for cd in tl['cards']:
        put_hit(m, 'impact_soft', cd['start'], -4.0)
    put_hit(m, 'heartbeat', L['L5']['end'] + 0.1, -6.0)
    # forest falls
    m.put('hits', sfx('rumble_long'), L['L7']['start'] - 0.3, -12.0, fade_out=1.5)
    put_hit(m, 'shockwave', L['L7']['start'] - 0.08, -10.0)
    # glowing nights, newspaper
    put_hit(m, 'paper_rustle', wt('L8', 'ГАЗЕТУ'), -6.0)
    # expedition
    put_hit(m, 'camera_shutter_flash', L['L9']['start'] - 0.08, -5.0)
    m.put('beds', sfx('drone_bed_tension'), L['L9']['start'], -4.0, fade_in=1.0, fade_out=1.0,
          length=L['L11']['end'] - L['L9']['start'])
    m.put('beds', sfx('ambience_wind_dead_forest'), L['L10']['start'] - 0.3, -1.0, fade_in=0.8, fade_out=1.0,
          length=L['L12']['start'] + 0.5 - (L['L10']['start'] - 0.3))
    # ending
    put_hit(m, 'whoosh_long', L['L13']['start'] - 0.1, -8.0)
    put_hit(m, 'sting_end', L['L13']['end'] + 0.08, -3.0)
    # whole-film drone
    m.put('beds', sfx('drone_bed'), 0.0, -5.0, fade_in=1.5, fade_out=1.5, length=tl['total'])
