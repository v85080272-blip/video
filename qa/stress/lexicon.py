# Words worth a second listen before and after synthesis.
# TRAPS: the school orthoepic minimum (ЕГЭ, task 4) and a few more words people and voices often get wrong;
# '+' stands before the stressed vowel. KNOWN: words a voice engine of this project has already got wrong
# (qa/known_errors.json, threads add to it), so a script with them can be reworded before synthesis.
# PLACES: names and places from the project's scripts that the Silero dictionary stresses wrong; they override it
# like TRAPS do. DOUBLETS: words with two accepted stresses (orthoepic dictionaries mark the second «допустимо»): a
# voice that picks either one is not wrong.
import json, os

TRAPS = '''
аэроп+орты б+анты б+ороду бухг+алтеров вероиспов+едание водопров+од газопров+од гражд+анство деф+ис дешев+изна
диспанс+ер договорённость докум+ент жалюз+и зн+ачимость +иксы катал+ог кварт+ал килом+етр к+онусов кор+ысть кр+аны
крем+ень кремн+я л+екторов локт+ей лыжн+я м+естностей нам+ерение нар+ост н+едруг нед+уг некрол+ог нен+авистник
нефтепров+од новост+ей н+огтя +отрочество парт+ер портф+ель прид+аное приз+ыв свёкла сир+оты соз+ыв сосредот+очение
ср+едства ст+атуя стол+яр там+ожня т+орты т+уфля цем+ент ц+ентнер цеп+очка ш+арфы шофёр эксп+ерт
верн+а крас+ивее к+ухонный ловк+а моза+ичный опт+овый прозорл+ивый сл+ивовый
балов+ать балов+аться брал+а брал+ась ворвал+ась восприн+ять воссоздал+а вруч+ит гнал+а добрал+а дождал+ась
дозвон+ится доз+ировать ждал+а жил+ось зак+упорить зан+ять з+анял занял+а з+аперла звал+а звон+ит звон+ишь звон+ят
звон+им включ+ит включ+ишь включ+ат кровоточ+ить лил+а лгал+а н+ачал нач+ать начал+а н+ачали обн+ять обогнал+а
ободр+ить окруж+ит опломбиров+ать определ+ит отбыл+а отдал+а отк+упорить отозвал+а плодонос+ить пон+ять понял+а
посл+ала пр+инял принял+а рвал+а сверл+ит снял+а соврал+а создал+а сорвал+а сор+ит убрал+а уск+орить ч+ерпать щем+ит
щёлкать облегч+ить углуб+ить
бал+ованный включённый довезённый з+агнутый з+анятый занят+а з+апертый заселённый корм+ящий кровоточ+ащий
наж+ивший нал+ивший нан+явшийся нач+авший н+ачатый низведённый облегчённый ободрённый обострённый отключённый
повторённый поделённый пон+явший пр+инятый приручённый прож+ивший снят+а с+огнутый углублённый
зак+упорив нач+ав отд+ав подн+яв пон+яв приб+ыв
в+овремя д+оверху дон+ельзя д+онизу д+осуха з+авидно з+агодя з+асветло з+атемно +исстари над+олго ненад+олго
обесп+ечение ход+атайство мусоропров+од д+еньгами
'''.split()
PLACES = '''
страсб+ург ванав+ара
'''.split()
DOUBLETS = '''
жив+ы/ж+ивы взорв+алось/взорвал+ось твор+ог/тв+орог одновр+еменно/одноврем+енно мышл+ение/м+ышление
ржав+еть/рж+аветь заржав+еть/зарж+аветь б+аржа/барж+а миз+ерный/м+изерный м+аркетинг/марк+етинг ин+аче/+иначе
кулин+ария/кулинар+ия комб+айнер/комбайн+ер нап+ились/напил+ись нап+илось/напил+ось нап+ился/напилс+я
род+ились/родил+ись
'''.split()
_VOW = 'аеёиоуыэюя'


def _parse(w):
    """'звон+ит' -> ('звонит', 1); 'свёкла' -> ('свекла', 0) with ё as the stress."""
    plain = w.replace('+', '')
    if '+' in w:
        i = w.index('+')
    else:
        i = w.index('ё')
    return plain.replace('ё', 'е'), sum(c in _VOW for c in plain[:i])


TRAP = {}
for _w in TRAPS + PLACES:
    _k, _s = _parse(_w)
    TRAP[_k] = _s
DOUBLE = {}
for _w in DOUBLETS:
    for _v in _w.split('/'):
        _k, _s = _parse(_v)
        DOUBLE.setdefault(_k, set()).add(_s)
KNOWN_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'known_errors.json')


def known_errors(path=KNOWN_PATH):
    """{engine: {word: note}}; engine 'any' applies to every voice."""
    try:
        return json.load(open(path, encoding='utf-8'))['engines']
    except (OSError, ValueError, KeyError):
        return {}
