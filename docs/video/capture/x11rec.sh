#!/usr/bin/env bash
# Record a command's windows at 1920x1080 and 60 fps: a private X display (Xvfb), ffmpeg x11grab, then the command.
#   docs/video/capture/x11rec.sh <out.mp4> <command...>
#   e.g. PLAYWRIGHT=... docs/video/capture/x11rec.sh a03.mp4 node docs/video/capture/rehearse.mjs a03
# The command gets DISPLAY, so a headed browser draws on the recorded screen. Recording stops when it exits.
set -euo pipefail
out=$1; shift
disp=:$((90 + RANDOM % 9))
Xvfb "$disp" -screen 0 1920x1080x24 -nolisten tcp &
xvfb=$!
trap 'kill $xvfb 2>/dev/null || true' EXIT
sleep 1
# The cursor is drawn by the page (record.mjs's big cursor), so x11grab leaves the X pointer out.
ffmpeg -loglevel error -y -f x11grab -framerate 60 -video_size 1920x1080 -draw_mouse 0 -i "$disp" \
  -c:v libx264 -preset veryfast -crf 14 -pix_fmt yuv420p "$out" &
ff=$!
status=0
# No Wayland: a browser would otherwise draw on the real desktop, not the recorded display.
env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 DISPLAY=$disp "$@" || status=$?
kill -INT $ff; wait $ff || true
exit $status
