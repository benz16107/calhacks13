#!/usr/bin/env bash
# Spike 6: from inside the VM, describe a photo with the Mac's Ollama (Metal GPU). The photo never leaves the laptop.
# Run as the normal VM user. Needs curl, jq, base64. UA_CONTACT (optional) adds a contact to the User-Agent.
set -euo pipefail
OLLAMA=${OLLAMA:-http://host.lima.internal:11434}
MODEL=${MODEL:-gemma4}
IMG=${1:-$HOME/spike6/dog.jpg}
mkdir -p "$(dirname "$IMG")"
[ -f "$IMG" ] || curl -sSfL -A "calhacks-spike/0.1${UA_CONTACT:+ ($UA_CONTACT)}" -o "$IMG" \
  https://upload.wikimedia.org/wikipedia/commons/2/26/YellowLabradorLooking_new.jpg
echo "image: $(file -b "$IMG" | cut -c1-60), $(stat -c %s "$IMG") bytes"
curl -sS "$OLLAMA/api/version"; echo
ask() { local think=$1
  jq -n --arg m "$MODEL" --rawfile img <(base64 -w0 "$IMG") --argjson think "$think" \
    '{model:$m, stream:false, think:$think, keep_alive:"10m",
      prompt:"Describe this photo in two sentences for a search index. Then list 8 search keywords.",
      images:[$img]}' > /tmp/req.json
  local t0=$(date +%s.%N)
  curl -sS "$OLLAMA/api/generate" -d @/tmp/req.json > /tmp/res.json
  local t1=$(date +%s.%N)
  jq -r --arg wall "$(echo "$t1 - $t0" | bc)" '"wall \($wall | .[0:5])s | load \(.load_duration/1e9*100|floor/100)s | prompt \(.prompt_eval_count) tok in \(.prompt_eval_duration/1e9*100|floor/100)s | output \(.eval_count) tok at \(.eval_count/(.eval_duration/1e9)|floor) tok/s"' /tmp/res.json
  jq -r '.response' /tmp/res.json | head -12; echo; }
echo "== run 1 (cold: model loads), thinking off"; ask false
echo "== run 2 (warm), thinking off"; ask false
echo "== run 3 (warm), thinking on (the model default)"; ask true
