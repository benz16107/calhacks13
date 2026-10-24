#!/usr/bin/env bash
# Talk to your computer needs a small local speech model: faster-whisper "base.en" (about 140 MB, CPU only) in its own
# Python environment. install.sh runs this when it has a network; the image build runs it once. Safe to run again.
set -euo pipefail
venv=/opt/box/voice-venv
models=/opt/box/voice-models
[[ -x $venv/bin/python ]] || python3 -m venv "$venv"
"$venv/bin/pip" install -q faster-whisper
mkdir -p "$models"
"$venv/bin/python" - <<PY
from faster_whisper import WhisperModel
WhisperModel('base.en', device='cpu', compute_type='int8', download_root='$models')
PY
chmod -R a+rX "$venv" "$models"
echo "voice: speech model ready in $models"
