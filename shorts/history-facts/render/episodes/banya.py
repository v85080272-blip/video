"""Тайны истории №8: «Баня на Руси» (летопись об апостоле Андрее, Адам Олеарий в 1630-х, роды в бане).

The first episode on moving scenes: five 8-second Gemini videos that vla's Gemini Pro made on the PC (thread «Видео
через Gemini на компе», 20–21.10), cut to the narrator «Историк» (h4_s52, vla's pick for the series on 21.10).
vla's rule of 21.10: hook the viewer first, then tell the story, so L1–L2 are the hook and the promise, the story
starts at L3, and L9 runs back into L1 (the loop). Scenes: S1 a foreigner at the door of a steaming bathhouse,
S2 the wanderer by the river as men pour water over themselves, S3 the stove and the birch broom close up,
S4 the winter village with a German traveller, S5 the midwife with a newborn in the clean bathhouse.
"""
import os

SCN = os.environ.get('SCENES_DIR', '/home/user/work/banya/scenes')

DISPLAY = {
    'L1': 'ИНОСТРАНЦЫ ДУМАЛИ, ЧТО РУССКИЕ САМИ СЕБЯ МУЧАЮТ.',
    'L2': 'НО У ЭТОЙ ПЫТКИ БЫЛ СЕКРЕТ, И ОН БЕРЁГ ЗДОРОВЬЕ.',
    'L3': 'В ЛЕТОПИСИ АПОСТОЛ АНДРЕЙ УДИВЛЯЕТСЯ НОВГОРОДЦАМ:',
    'L4': 'ЖАРКО ТОПЯТ БАНИ, ХЛЕЩУТ СЕБЯ ПРУТЬЯМИ И ВЫЛЕЗАЮТ ЧУТЬ ЖИВЫЕ,',
    'L5': 'ПОТОМ ЛЬЮТ НА СЕБЯ ЛЕДЯНУЮ ВОДУ И ОЖИВАЮТ.',
    'L6': 'И ЭТО У НИХ НЕ ПЫТКА, А МЫТЬЁ.',
    'L7': 'ЧЕРЕЗ 500{пятьсот} ЛЕТ ГОСТЬ ИЗ ГЕРМАНИИ ВИДЕЛ ТО ЖЕ: РАСПАРЕННЫЕ ЛЮДИ ВАЛЯЮТСЯ В СУГРОБАХ.',
    'L8': 'В ЖАРКОЙ БАНЕ БЫЛО ЧИЩЕ ВСЕГО, ПОЭТОМУ ТАМ ДАЖЕ РОЖАЛИ.',
    'L9': 'А В ЕВРОПЕ БАНИ ЗАКРЫВАЛИ ИЗ СТРАХА ПЕРЕД ЗАРАЗОЙ. ВОТ ПОЧЕМУ ИНОСТРАНЦЫ…',
}
HILITE = {'МУЧАЮТ.', 'СЕКРЕТ,', 'ЗДОРОВЬЕ.', 'ЛЕТОПИСИ', 'ЧУТЬ', 'ЖИВЫЕ,', 'ЛЕДЯНУЮ', 'ОЖИВАЮТ.', 'МЫТЬЁ.', '500',
          'СУГРОБАХ.', 'ЧИЩЕ', 'РОЖАЛИ.', 'ЗАРАЗОЙ.'}

# the narrator's own pauses come from the take (GAPS_JSON); these are the fallbacks
GAPS = {'L1': 0.4, 'L2': 0.45, 'L3': 0.3, 'L4': 0.25, 'L5': 0.5, 'L6': 0.6, 'L7': 0.6, 'L8': 0.45, 'L9': 0.0}
LEAD_IN = 0.15
TAIL = 0.5                         # the clip ends half a second after the last word and loops back to the start
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №8', year='БАНЯ', lines=['ПЫТКА', 'ИЛИ ЛЕКАРСТВО?'])
COVER_B = ['ЗАЧЕМ РУССКИЕ', 'ХЛЕСТАЛИ СЕБЯ?']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №8', over_last=1.0)
_SFX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'sfx')
SFX_DIRS = [f'{SCN}/audio', f'{_SFX}/olga', _SFX, '/home/user/work/sfx/olga', '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 80.0                         # the olga kit (gusli, low choir) runs at 80 bpm in 12-second loops
BEAT = 60.0 / BPM


def _scene(name, t0=0.0):
    """A Gemini scene: its frames (extracted at the render's FPS) from t0 seconds in, running back if the shot is longer."""
    return dict(dir=f'{SCN}/{name}', t0=t0, pingpong=True)


def plan(lines, words):
    def wt(lid, prefix):
        for w, a, b in words[lid]:
            if w.startswith(prefix):
                return a
        return lines[lid]['start']
    return dict(torture=wt('L1', 'МУЧАЮТ'), secret=wt('L2', 'СЕКРЕТ'), health=wt('L2', 'ЗДОРОВЬЕ'),
                lash=wt('L4', 'ХЛЕЩУТ'), alive=wt('L4', 'ЖИВЫЕ'), ice=wt('L5', 'ЛЕДЯНУЮ'), revive=wt('L5', 'ОЖИВАЮТ'),
                wash=wt('L6', 'МЫТЬЁ'), years=wt('L7', '500'), snow=wt('L7', 'СУГРОБАХ'), born=wt('L8', 'РОЖАЛИ'),
                plague=wt('L9', 'ЗАРАЗОЙ'), back=wt('L9', 'ВОТ'))


def layout(c):
    L, add, total = c.L, c.add, c.total
    p = plan(c.lines, c.words)
    warm = dict(exposure=0.0, contrast=1.05, sat=1.0, warm=0.2, demagenta=0.2)
    cold = dict(exposure=0.02, contrast=1.05, sat=0.9, teal=0.35, demagenta=0.2)
    cut = lambda lid: L(lid)['start'] - 0.08

    # L1–L2 the hook: the foreigner at the bathhouse door, steam and fire; a punch on «мучают» and on «секрет»
    add('S1', 0.0, cut('L3'), video=_scene('S1'), cam=dict(zoom=(1.0, 1.1)),
        fx=dict(grade=warm, dust=12, punch=[(p['torture'], 0.06), (p['secret'], 0.05)], shake=[(p['secret'], 0.4, 8)]))
    # L3 the chronicle: the wanderer by the river among the log houses
    add('S2', cut('L3'), cut('L4'), into='whip', video=_scene('S2'), cam=dict(zoom=(1.0, 1.06)), fx=dict(grade=cold))
    # L4 hot stove, steam and the birch broom, close
    add('S3', cut('L4'), cut('L5'), into='flash', video=_scene('S3'), cam=dict(zoom=(1.0, 1.1)),
        fx=dict(grade=warm, embers=30, punch=[(p['lash'], 0.05), (p['alive'], 0.04)]))
    # L5 they pour the icy water over themselves and come back to life (the second half of S2)
    add('S2', cut('L5'), cut('L6'), into='whip', video=_scene('S2', 3.5), cam=dict(zoom=(1.04, 1.12)),
        fx=dict(grade=cold, punch=[(p['ice'], 0.04), (p['revive'], 0.06)]))
    # L6 «not torture, a wash»: back into the warm steam
    add('S3', cut('L6'), cut('L7'), into='fade', video=_scene('S3', 4.0), cam=dict(zoom=(1.08, 1.0)),
        fx=dict(grade=warm, embers=20, punch=[(p['wash'], 0.05)]))
    # L7 five hundred years later: the winter village, steaming people in the snow, the German with his notebook
    add('S4', cut('L7'), cut('L8'), into='whip', video=_scene('S4'), cam=dict(zoom=(1.0, 1.08)),
        fx=dict(grade=cold, snow=50, punch=[(p['years'], 0.05), (p['snow'], 0.04)]))
    # L8 the cleanest place: the midwife with a newborn in the warm bathhouse
    add('S5', cut('L8'), cut('L9'), into='fade', video=_scene('S5'), cam=dict(zoom=(1.0, 1.06)),
        fx=dict(grade=dict(warm, exposure=0.03), bloom=0.3, punch=[(p['born'], 0.04)]))
    # L9 Europe shut its baths... «вот почему иностранцы» — back to the foreigner at the door, into the first frame
    add('S1', cut('L9'), total, into='whip', video=_scene('S1', 1.0), cam=dict(zoom=(1.1, 1.0)),
        fx=dict(grade=warm, dust=12, punch=[(p['plague'], 0.05)]))

    cards = [dict(text='500', sub='ЛЕТ СПУСТЯ', start=p['years'], end=cut('L8') - 0.05, y=470, count=True)]
    tags = [
        dict(text='ПОВЕСТЬ ВРЕМЕННЫХ ЛЕТ', start=L('L3')['start'] + 0.1, end=cut('L4') - 0.1),
        dict(text='АДАМ ОЛЕАРИЙ · 1630-Е', start=p['years'] + 0.3, end=cut('L8') - 0.1),
    ]
    cover = dict(start=0.0, end=c.word_t('L1', 'ДУМАЛИ') - 0.1)
    hook_text = dict(lines=['L1', 'L2'], y=900, size=120)
    return dict(cards=cards, tags=tags, cover=cover, hook_text=hook_text)


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx = a.put_hit, a.sfx
    p = plan(L, tl['words'])
    total = tl['total']
    SR = 48000
    import numpy as np

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # each scene keeps its own sound from Gemini (fire, steam, water, snow), under the narrator
    for sh in tl['shots']:
        v = sh.get('video', {})
        loop('beds', sh['img'], sh['start'], sh['end'] + 0.05, -9.0, grid=sh['start'] - v.get('t0', 0.0),
             fin=0.04, fout=0.08)
    # the hook: a boom, the low choir, a drum on «секрет»
    put_hit(m, 'boom_hook', 0.02, -10.0)
    loop('beds', 'choir_low', 0.0, L['L3']['start'], -13.0, fin=0.0, fout=0.3)
    put_hit(m, 'drum_big', p['secret'], -6.0)
    put_hit(m, 'impact_soft', p['torture'], -9.0)
    # the story: gusli from the chronicle on, on the beat grid of the kit
    g0 = L['L3']['start'] - 0.2
    loop('beds', 'gusli_tune', g0, total, -12.0, grid=g0, fin=0.4, fout=0.03)
    loop('beds', 'fire_crackle', L['L4']['start'] - 0.1, L['L5']['start'], -14.0, fin=0.2, fout=0.2)
    put_hit(m, 'impact_soft', p['revive'], -8.0)
    put_hit(m, 'drum_big', p['years'], -7.0)
    put_hit(m, 'impact_soft', p['born'], -9.0)
    # cuts get a soft whoosh
    for sh in tl['shots'][1:]:
        put_hit(m, 'whoosh_short', sh['start'] - 0.02, -15.0)
    # the last line rises back into the hook
    loop('beds', 'choir_low', L['L9']['start'], total, -13.0, fin=0.4, fout=0.03)
    put_hit(m, 'riser_2s', total - 0.02, -11.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -11.0)
        put_hit(m, 'impact_soft', ec['start'], -9.0)
