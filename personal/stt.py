#!/opt/box/voice-venv/bin/python
# Speech to text on this machine: faster-whisper (CPU, int8). voice.py starts this while the owner is still talking, so the
# model is loaded by the time the recording ends. Reads one wav path per line on stdin, prints one JSON line per path.
import json
import os
import sys
import time
import wave

import numpy as np
from faster_whisper import WhisperModel

MODELS = '/opt/box/voice-models'
HINT = 'GurtOS agents, approve, deny, find, photo, task, order.'  # nudges the spelling of the words the owner is likely to say


def samples(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        rate = w.getframerate()
    if rate != 16000:
        a = np.interp(np.arange(0, len(a), rate / 16000), np.arange(len(a)), a).astype(np.float32)
    return a


model = WhisperModel('base.en', device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 4, download_root=MODELS,
                     local_files_only=os.path.isdir(MODELS))
print('ready', flush=True)
for line in sys.stdin:
    t = time.time()
    segments, _ = model.transcribe(samples(line.strip()), beam_size=1, language='en', initial_prompt=HINT, condition_on_previous_text=False)
    print(json.dumps({'text': ' '.join(s.text.strip() for s in segments).strip(), 'seconds': round(time.time() - t, 2)}), flush=True)
