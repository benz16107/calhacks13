#!/usr/bin/python3
# Talk to your computer (GurtOS Personal). The owner presses the shortcut or the mic item, says "what did my agents do
# today?", "find the whiteboard photo" or "approve the grocery order", and gets the answer as a notification and in a
# local voice. Nothing leaves the machine: speech becomes text with a small model on the CPU (stt.py), the answer
# comes from the box API and its /find search, and espeak-ng speaks it. It listens only between a press and the end
# of the sentence, the top bar shows a red mic the whole time, and the audio is deleted when the text is read.
# Approving anything that spends money is refused here: that stays with the passkey, the lock screen or the popover.
#   voice.py            listen, answer, speak          voice.py --text "find the receipt"    skip the mic and the model
#   GURTOS_VOICE_WAV=x.wav voice.py --timing   read a recording instead of the mic and print the timings as JSON
import array
import difflib
import json
import math
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
from boxapi import BOX, api, dollars, quote  # noqa: E402

RATE = 16000
CHUNK = RATE // 10  # 0.1 s of audio
GIVE_UP = 6.0  # seconds of silence before anything was said
MAX_SECONDS = 20.0
ENDS_AFTER = 1.0  # seconds of quiet that end the sentence
VENV_PYTHON = '/opt/box/voice-venv/bin/python'
STATE = os.path.join(os.environ.get('XDG_RUNTIME_DIR', tempfile.gettempdir()), 'gurtos-voice')  # read by the Shell extension
FILLER = set('the a an my our please can you could would to of for me i that this one it and'.split())
HELP = "Try: what did my agents do today, find the whiteboard photo, or approve the grocery order."


# ---------- what was said -> an answer (pure of audio, so selftest.py runs it) ----------

def words(text):
    return [w for w in re.findall(r"[a-z0-9$.']+", text.lower().replace('’', "'")) if w.strip('.')]


def close(a, b):
    """Whisper mishears: 'groceries' for 'grocery' still counts."""
    return a == b or (len(a) > 3 and len(b) > 3 and (a.startswith(b[:4]) or difflib.SequenceMatcher(None, a, b).ratio() > 0.8))


def local_day(iso):
    try:
        t = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None
    return (t if t.tzinfo else t.replace(tzinfo=timezone.utc)).astimezone().date()


def spends(a):
    """An approval that moves money: the core's own fields, or a dollar amount in the question."""
    return bool(a.get('costCents') or a.get('payee') or re.search(r'[$]\s?\d', a.get('question', '')))


def pick_approval(pending, tasks, target):
    """The one pending approval the owner means, or a reason there isn't one."""
    names = {t['id']: t['title'] for t in tasks}
    if not pending:
        return None, 'Nothing is waiting for your OK.'
    want = [w for w in target if w not in FILLER]
    if not want:
        return (pending[0], None) if len(pending) == 1 else (None, f'{len(pending)} things are waiting. Say which one: ' + '; '.join(names.get(a['task'], 'a task') for a in pending) + '.')
    scored = []
    for a in pending:
        have = words(f"{names.get(a['task'], '')} {a.get('question', '')} {a.get('payee', '')}")
        scored.append((sum(any(close(w, h) for h in have) for w in want), a))
    scored.sort(key=lambda s: -s[0])
    if scored[0][0] == 0:
        return None, "I don't see an approval like that. Waiting: " + '; '.join(names.get(a['task'], 'a task') for a in pending) + '.'
    if len(scored) > 1 and scored[1][0] == scored[0][0]:
        return None, 'That could be more than one. Waiting: ' + '; '.join(names.get(s[1]['task'], 'a task') for s in scored if s[0] == scored[0][0]) + '.'
    return scored[0][1], None


def summary():
    today = datetime.now().astimezone().date()
    tasks = [t for t in api('GET', '/api/tasks') if local_day(t.get('updatedAt')) == today]
    if not tasks:
        return 'Your agents have not done anything today.'
    by = {}
    for t in tasks:
        by[t['state']] = by.get(t['state'], 0) + 1
    names = {'done': 'finished', 'running': 'running', 'queued': 'queued', 'waiting': 'waiting for your OK', 'failed': 'failed', 'undone': 'undone'}
    parts = [f'{n} {names.get(s, s)}' for s, n in sorted(by.items(), key=lambda kv: -kv[1])]
    spent = sum(t.get('costCents') or 0 for t in tasks)
    latest = max(tasks, key=lambda t: t.get('updatedAt', ''))
    return (f"Today your agents handled {len(tasks)} task{'s' if len(tasks) != 1 else ''}: {', '.join(parts)}."
            + (f' They spent {dollars(spent)}.' if spent else '') + f" Latest: {latest['title'].rstrip('.')}.")


def find(query):
    words_ = [w for w in words(query) if w not in FILLER]
    if not words_:
        return 'What should I look for?'
    t = time.time()
    out = api('GET', '/t/find/search?' + urllib.parse.urlencode({'q': ' '.join(words_), 'k': 4}), timeout=4)
    hits = [r for r in out.get('results', []) if r.get('kind') != 'task'] or out.get('results', [])
    if not hits:
        return f"I found nothing for {' '.join(words_)}."
    top = hits[0]
    name = os.path.basename(top.get('path') or '') or 'a task'
    snippet = re.sub(r'\s+', ' ', top.get('text', '').split(': ', 1)[-1]).strip()
    if len(snippet) > 100:
        snippet = snippet[:100].rsplit(' ', 1)[0] + '…'
    more = f' and {len(hits) - 1} more' if len(hits) > 1 else ''
    return f"Found {name}{more}" + (f': {snippet}' if snippet else '') + f'. ({out.get("ms", round((time.time() - t) * 1000))} ms)'


def answer(text, user='owner'):
    """The reply for what was said. Approving a spend is refused; denying and approving anything else go through the
    box's one approval path, signed `voice:<user>`."""
    w = words(text)
    if not w:
        return "I didn't catch that. " + HELP
    first = next((x for x in w if x not in FILLER), '')
    verbs = {'approve': True, 'allow': True, 'accept': True, 'deny': False, 'decline': False, 'reject': False, 'refuse': False}
    verb = next((x for x in w if x in verbs), None)
    if verb:
        target = [x for x in w if x != verb]
        pending = api('GET', '/api/approvals?state=pending')
        a, why = pick_approval(pending, api('GET', '/api/tasks'), target)
        if not a:
            return why
        title = next((t['title'] for t in api('GET', '/api/tasks') if t['id'] == a['task']), 'that task').rstrip('.')
        if verbs[verb] and spends(a):
            return (f'{title} spends money' + (f" ({dollars(a['costCents'])})" if a.get('costCents') else '') +
                    ', so I cannot approve it by voice. Approve it with your passkey or from the top bar.')
        api('POST', f'/api/approvals/{quote(a["id"])}', {'approved': verbs[verb], 'by': f'voice:{user}'})
        return f"{'Approved' if verbs[verb] else 'Denied'}: {title}."
    if first in ('find', 'search', 'look', 'where', 'where\'s', 'show', 'open'):
        return find(' '.join(x for x in w if x not in ('find', 'search', 'look', 'for', 'where', "where's", 'is', 'show', 'open', 'me')))
    if any(x in w for x in ('waiting', 'needs', 'need')) and any(x in w for x in ('ok', 'okay', 'approval', 'approvals', 'me', 'you')) and 'today' not in w:
        pending = api('GET', '/api/approvals?state=pending')
        names = {t['id']: t['title'] for t in api('GET', '/api/tasks')}
        return ('Waiting for your OK: ' + '; '.join(names.get(a['task'], 'a task') for a in pending) + '.') if pending else 'Nothing is waiting for your OK.'
    if 'today' in w or ('what' in w and any(x in w for x in ('did', 'done', 'doing', 'happened', 'running'))) or 'summary' in w or 'status' in w:
        return summary()
    return "I didn't understand that. " + HELP


# ---------- the microphone, the model, the voice ----------

OWN = []  # set once this process has written the state file; a second press must not remove the first one's


def say_state(state):
    try:
        if state:
            OWN.append(1)
            with open(STATE, 'w') as f:
                f.write(f'{state} {os.getpid()}\n')
        elif OWN:
            os.unlink(STATE)
    except OSError:
        pass


def rms(buf):
    s = array.array('h', buf)
    return math.sqrt(sum(x * x for x in s) / len(s)) if s else 0.0


def record(path):
    """Listen from the default microphone until the sentence ends. Returns whether anything was said."""
    stop = []
    signal.signal(signal.SIGUSR1, lambda *_: stop.append(1))  # pressing the shortcut again ends it early
    rec = subprocess.Popen(['arecord', '-q', '-t', 'raw', '-f', 'S16_LE', '-r', str(RATE), '-c', '1'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    audio, floor, started, quiet, begin = bytearray(), [], False, 0.0, time.time()
    try:
        while not stop and time.time() - begin < MAX_SECONDS:
            chunk = rec.stdout.read(CHUNK * 2)
            if not chunk:
                break
            audio += chunk
            level = rms(chunk[:len(chunk) // 2 * 2])
            if len(floor) < 3:
                floor.append(level)
                continue
            loud = level > max(400, 2.5 * sorted(floor)[1])
            if loud:
                started, quiet = True, 0.0
            elif started:
                quiet += 0.1
                if quiet >= ENDS_AFTER:
                    break
            elif time.time() - begin > GIVE_UP:
                break
    finally:
        rec.terminate()
        rec.wait()
    if not started and not stop:
        return False
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(audio))
    return True


def start_model():
    if not os.path.exists(VENV_PYTHON):
        return None
    p = subprocess.Popen([VENV_PYTHON, os.path.join(HERE, 'stt.py')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, stderr=subprocess.DEVNULL)
    return p


def speak(text):
    if shutil.which('espeak-ng'):
        subprocess.run(['espeak-ng', '-s', '165', '-v', 'en-us', re.sub(r'\s*\(\d+ ms\)', '', text)], check=False)


def notify(heard, reply):
    if shutil.which('notify-send'):
        subprocess.run(['notify-send', '-a', 'GurtOS', '-i', 'dev.box.Box', '-h', 'string:desktop-entry:dev.box.Box',
                        f'You said: {heard}' if heard else 'GurtOS', reply], check=False)


def main(argv):
    quiet = '--quiet' in argv
    user = os.environ.get('USER', 'owner')
    timing = {}
    wav = os.environ.get('GURTOS_VOICE_WAV')
    if '--text' in argv:
        heard = argv[argv.index('--text') + 1]
    else:
        if os.path.exists(STATE):  # already listening: this press means "that's all"
            try:
                os.kill(int(open(STATE).read().split()[1]), signal.SIGUSR1)
            except (OSError, ValueError, IndexError):
                OWN.append(1)  # a stale file from a crash: clear it
            return 0
        model = start_model()
        if model is None:
            notify('', 'Talk to your computer needs its speech model. Run /opt/box/personal/voice-setup.sh once, with a network.')
            return 1
        tmp = tempfile.mkdtemp(prefix='gurtos-voice-', dir=os.environ.get('XDG_RUNTIME_DIR'))
        path = wav or os.path.join(tmp, 'speech.wav')
        try:
            say_state('listening')
            heard_audio = True if wav else record(path)
            if not heard_audio:
                say_state(None)
                model.kill()
                notify('', "I didn't hear anything.")
                return 0
            say_state('thinking')
            t0 = time.time()
            timing['wait_for_model_s'] = None
            ready = model.stdout.readline().strip()  # normally already loaded while the owner was talking
            timing['wait_for_model_s'] = round(time.time() - t0, 2)
            t1 = time.time()
            model.stdin.write(path + '\n')
            model.stdin.flush()
            out = json.loads(model.stdout.readline() or '{}') if ready == 'ready' else {}
            timing['stt_s'] = round(time.time() - t1, 2)
            heard = out.get('text', '')
        finally:
            model.kill()
            shutil.rmtree(tmp, ignore_errors=True)  # the audio never outlives the text
    t2 = time.time()
    try:
        reply = answer(heard, user)
    except Exception as e:  # noqa: BLE001 (spoken to the owner as is)
        reply = f"I couldn't reach GurtOS: {e}"
    timing['answer_s'] = round(time.time() - t2, 3)
    timing['speech_to_answer_s'] = round(timing.get('stt_s', 0) + timing['answer_s'], 2)
    say_state('speaking')
    notify(heard, reply)
    if '--timing' in argv:
        print(json.dumps({'heard': heard, 'reply': reply, **timing}))
    if not quiet:
        speak(reply)
    say_state(None)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    finally:
        say_state(None)
