# Rough stress check for chosen words of a take: Whisper word times, then vowel nuclei per syllable (vt.syllables):
# a stressed Russian vowel is the longest and usually the loudest, so the syllable that wins on nucleus length
# (or on loudness while being nearly as long) should be the expected one. A hint for picking takes, not proof.
# usage: python3 stress_check.py <wav> word:vowels:stressed_index[,...]   e.g. ядовитый:4:2,грибок:2:1
import json, os, sys
sys.path[:0] = ['/home/user/work/voice/scripts']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
import aud, vt

wav, spec = sys.argv[1], sys.argv[2]
x, sr = aud.read_wav(wav)
tx, toks = vt.whisper(wav)
words = vt.refine_words(vt.words_from_tokens(toks), x, sr)
res = {}
for item in spec.split(','):
    w, nv, si = item.split(':')
    nv, si = int(nv), int(si)
    hit = next((ww for ww in words if aud.norm_text(ww['word']).startswith(aud.norm_text(w)[:max(3, len(w) - 2)])), None)
    if not hit:
        res[w] = dict(verdict='not heard')
        continue
    syl = vt.syllables(wav, hit['start'], hit['end'], nv)
    if not isinstance(syl, list):
        res[w] = dict(verdict='nuclei not found', **(syl or {}))
        continue
    nuc = [s['nucleus_ms'] for s in syl]
    db = [s['peak_db'] for s in syl]
    longest, loudest = nuc.index(max(nuc)), db.index(max(db))
    ok = longest == si or (loudest == si and nuc[si] >= 0.8 * max(nuc))
    res[w] = dict(verdict='ok' if ok else f'suspect: longest {longest}, loudest {loudest}, expected {si}',
                  nucleus_ms=nuc, peak_db=db, f0=[s['f0'] for s in syl])
print(json.dumps(dict(file=os.path.basename(wav), whisper=tx, words=res), ensure_ascii=False))
