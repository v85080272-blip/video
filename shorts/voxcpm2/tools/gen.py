# Client for the local llama-tts-server (VoxCPM2 on CPU).
import base64, json, os, time, urllib.request

URL = os.environ.get('VOX_URL', 'http://127.0.0.1:8099')


def ready():
    try:
        with urllib.request.urlopen(URL + '/health', timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def tts(text, out, seed=42, ref=None, prompt_text=None, cfg=2.0, ts=10, temp=1.0):
    """Synthesize text to out (16-bit WAV, 48 kHz). Returns seconds spent."""
    body = dict(model='voxcpm', input=text, seed=int(seed), cfg_value=float(cfg),
                inference_timesteps=int(ts), temperature=float(temp))
    if ref:
        body['reference_audio'] = base64.b64encode(open(ref, 'rb').read()).decode()
        if prompt_text:
            body['prompt_text'] = prompt_text
    req = urllib.request.Request(URL + '/v1/audio/speech', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    t = time.time()
    with urllib.request.urlopen(req, timeout=1800) as r:
        data = r.read()
    open(out, 'wb').write(data)
    return time.time() - t
