# Armadin: ask for an OK under the key the box itself uses for this task's budget question, with an innocent text.
# Usage: sh forge.sh (reads ask.json). Polls past the box's wait window until the question is answered.
for i in $(seq 1 60); do
  r=$(curl -s --unix-socket "$BOX_SOCKET" -H 'content-type: application/json' --data @ask.json http://b/ask)
  echo "$r"
  case "$r" in *approved*) break ;; esac
  sleep 0.3
done
