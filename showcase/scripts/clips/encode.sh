#!/usr/bin/env bash
# Raw recordings (record.mjs) to the site's MP4s and JPG posters.
#   encode.sh <raw dir> <clips dir>
set -euo pipefail
raw=$1; out=$2
enc() { # name input speed poster-second
  local name=$1 in=$2 speed=$3 at=$4
  ffmpeg -v error -y -i "$in" -vf "setpts=PTS/$speed,fps=25,format=yuv420p" -an -c:v libx264 -preset slow -crf 24 -movflags +faststart "$out/$name.mp4"
  ffmpeg -v error -y -ss "$at" -i "$out/$name.mp4" -frames:v 1 -q:v 3 "$out/$name.jpg"
  printf '%s %s KB %ss\n' "$name" $(( $(stat -c%s "$out/$name.mp4") / 1024 )) "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$name.mp4")"
}
enc moment-1-undo "$raw/moment-1-undo.webm" 1.3 19
enc moment-2-blocked "$raw/moment-2-blocked.webm" 1 17
enc moment-3-approval "$raw/moment-3-approval.mp4" 1 7.5
enc moment-4-power-cut "$raw/moment-4-power-cut.webm" 1 22
enc shopper "$raw/shopper.webm" 1 12
