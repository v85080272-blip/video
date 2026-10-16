#!/usr/bin/env python3
# Claude Code hook: a clip goes to the gallery or to the user only after qa/check_clip.py has checked it.
# PreToolUse (send_message, reply): any recent .mp4 of /mnt/project-files/videos/ named in the message must have
# a fresh report without unaccepted errors, else the call is stopped with what to run. "[qa:skip <reason>]" in the
# message lets it through and is logged. PostToolUse (Bash) with --remind: a command that names a clip it has just
# written gets a nudge if that clip has no report yet.
import json, os, re, sys, time

VIDEOS = '/mnt/project-files/videos'
REPORTS = '/mnt/project-files/qa/reports'
QA = '/mnt/project-files/qa' if os.path.isdir('/mnt/project-files/qa') else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECENT = 48 * 3600           # older clips are history: talking about them needs no check


def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)


def clips_in(text):
    out = []
    for m in re.finditer(r'[\w./\-]*?([\w\-.]+\.mp4)\b', text):
        p = m.group(0)
        cand = p if p.startswith('/') else os.path.join(VIDEOS, m.group(1))
        if os.path.dirname(os.path.abspath(cand)) == VIDEOS and os.path.isfile(cand) and cand not in out:
            out.append(cand)
    return out


def state(clip):
    """None if fine, else a short reason."""
    stem = os.path.splitext(os.path.basename(clip))[0]
    jp = os.path.join(REPORTS, stem + '.json')
    if not os.path.exists(jp):
        return 'not checked'
    try:
        R = json.load(open(jp, encoding='utf-8'))
    except ValueError:
        return 'report unreadable'
    st = os.stat(clip)
    f = R.get('file') or {}
    if f.get('size') != st.st_size or abs(f.get('mtime', 0) - st.st_mtime) > 1:
        return 'changed after the check'
    if R.get('status') == 'fail' and not R.get('accepted'):
        errs = [x['msg'] for x in R.get('findings', []) if x.get('level') == 'ошибка'][:5]
        return 'errors: ' + ' | '.join(errs)
    return None


def main():
    remind = '--remind' in sys.argv
    try:
        ev = json.load(sys.stdin)
    except ValueError:
        return 0
    if not os.path.isdir(VIDEOS):
        return 0
    if remind:
        cmd = ' '.join(strings(ev.get('tool_input', {})))
        if '.mp4' not in cmd and 'videos' not in cmd:
            return 0
        now = time.time()
        # only clips this command names (it wrote or copied them), changed in the last 10 minutes
        fresh = [os.path.join(VIDEOS, f) for f in os.listdir(VIDEOS) if f.endswith('.mp4') and f in cmd
                 and now - os.path.getmtime(os.path.join(VIDEOS, f)) < 600]
        todo = [c for c in fresh if state(c) in ('not checked', 'changed after the check')]
        if todo:
            msg = ('New clip(s) without a QA report: ' + ', '.join(os.path.basename(c) for c in todo) +
                   f'. Before sending them to the gallery or the user run: python3 {QA}/check_clip.py <clip> --text <script> '
                   f'(see {QA}/README.md).')
            print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': msg}}))
        return 0
    texts = list(strings(ev.get('tool_input', {})))
    whole = '\n'.join(texts)
    clips = [c for c in clips_in(whole) if time.time() - os.path.getmtime(c) < RECENT]
    if not clips:
        return 0
    skip = re.search(r'\[qa:skip ([^\]]*)\]', whole)
    if skip:
        try:
            os.makedirs(REPORTS, exist_ok=True)
            with open(os.path.join(REPORTS, 'skips.log'), 'a', encoding='utf-8') as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M', time.gmtime())} UTC {ev.get('session_id', '')} "
                        f"{' '.join(os.path.basename(c) for c in clips)}: {skip.group(1)}\n")
        except OSError:
            pass
        return 0
    bad = [(c, state(c)) for c in clips]
    bad = [(c, s) for c, s in bad if s]
    if not bad:
        return 0
    lines = [f'- {os.path.basename(c)}: {s}' for c, s in bad]
    print('Stopped by the project QA hook: these clips are not cleared yet.\n' + '\n'.join(lines) + '\n'
          f'Run python3 {QA}/check_clip.py /mnt/project-files/videos/<clip>.mp4 --text <script> [--engine qwen3] '
          f'[--music] and fix what it reports (stress: re-take the line with qa/pick_take.py or reword it; mix: '
          f're-render). If an error is a false alarm you have ruled out, record it: python3 {QA}/check_clip.py <clip> '
          f'--accept "<why>". To send anyway, put [qa:skip <reason>] in the message. Details: {QA}/README.md',
          file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main())
