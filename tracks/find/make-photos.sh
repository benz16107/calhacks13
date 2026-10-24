#!/usr/bin/env bash
# Renders the test photos in photos/ from SVG with ImageMagick. Made up, no real personal photos.
# The whiteboard uses the Caveat font (Google Fonts, OFL) if it is installed.
# Names are camera-style on purpose: /find has to match what is in the photo, not the file name.
set -euo pipefail
cd "$(dirname "$0")/photos"
shot() { # svg-file out.jpg: render with rsvg-convert, then add grain and a slight blur so it reads as a photo
  rsvg-convert "$1" | convert - -attenuate 0.35 +noise Gaussian -blur 0x0.6 -quality 82 "$2"; rm "$1"; }

cat > /tmp/wb.svg <<'S'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
<defs>
<filter id="hand"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>
<radialGradient id="glare" cx="0.72" cy="0.22" r="0.35"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1024" height="768" fill="#f3f4f1"/>
<g fill="none" stroke="#9aa3b5" stroke-width="10" opacity="0.18" filter="url(#hand)"><path d="M120 640 Q300 600 520 650"/><path d="M640 560 L900 540"/><path d="M700 130 Q820 90 930 150"/></g>
<g font-family="Caveat" font-weight="bold" fill="none" stroke-width="6" stroke-linecap="round" filter="url(#hand)">
<text x="80" y="110" font-size="76" fill="#1f4fbf" stroke="none">Sprint plan: box OS</text>
<path d="M80 130 Q300 145 560 122" stroke="#c0282d"/>
<rect x="90" y="200" width="210" height="115" rx="18" stroke="#1f4fbf"/>
<text x="125" y="275" font-size="58" fill="#1f4fbf" stroke="none">Portal</text>
<rect x="410" y="200" width="240" height="115" rx="18" stroke="#222"/>
<text x="438" y="275" font-size="58" fill="#222" stroke="none">Box core</text>
<rect x="740" y="200" width="200" height="115" rx="18" stroke="#1c8a3b"/>
<text x="780" y="275" font-size="58" fill="#1c8a3b" stroke="none">Vault</text>
<path d="M300 258 L405 258 M388 243 L406 258 L388 273" stroke="#222"/>
<path d="M650 258 L735 258 M718 243 L736 258 L718 273" stroke="#222"/>
<path d="M530 315 L530 415 M515 398 L530 416 L545 398" stroke="#222"/>
<rect x="390" y="420" width="290" height="105" rx="18" stroke="#c0282d"/>
<text x="412" y="490" font-size="54" fill="#c0282d" stroke="none">Tasks (undo!)</text>
<text x="90" y="610" font-size="46" fill="#222" stroke="none">1. undo  2. booby-trap  3. approvals  4. pull the plug</text>
</g>
<rect width="1024" height="768" fill="url(#glare)"/>
</svg>
S
rsvg-convert /tmp/wb.svg > /tmp/wb.png
cat > /tmp/wall.svg <<'S'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#b9b2a4"/><rect y="600" width="1024" height="168" fill="#8c8478"/></svg>
S
# The board, seen from a little to the left: aluminium frame, magnets, a marker tray with markers and an eraser.
rsvg-convert /tmp/wall.svg | convert - \( /tmp/wb.png -bordercolor '#c8ccd0' -border 16 -resize 1056x800! \
  -virtual-pixel transparent -distort Perspective '0,0 70,40  1056,0 990,90  1056,800 980,640  0,800 60,700' \) -composite \
  -fill '#2f6fd6' -draw 'circle 150,70 162,70' -fill '#d43c3c' -draw 'circle 900,115 912,115' \
  -fill '#c8ccd0' -draw 'polygon 50,700 985,640 990,662 55,726' \
  -fill '#1f4fbf' -draw 'roundrectangle 160,688 300,704 6,6' -fill '#c0282d' -draw 'roundrectangle 330,682 470,698 6,6' \
  -fill '#222222' -draw 'roundrectangle 500,676 640,692 6,6' -fill '#3a3f45' -draw 'roundrectangle 760,650 880,676 6,6' \
  -fill '#e8e8e0' -draw 'roundrectangle 760,640 880,652 4,4' /tmp/wb.svg.png
convert /tmp/wb.svg.png -attenuate 0.35 +noise Gaussian -blur 0x0.6 -quality 82 IMG_2041.jpg; rm /tmp/wb.svg /tmp/wb.png /tmp/wall.svg /tmp/wb.svg.png

cat > /tmp/rc.svg <<'S'
<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024">
<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="#6b4226"/><stop offset="0.5" stop-color="#8a5a36"/><stop offset="1" stop-color="#5c381f"/></linearGradient></defs>
<rect width="768" height="1024" fill="url(#w)"/>
<g stroke="#4a2c17" stroke-width="3" opacity="0.4"><path d="M0 120 Q384 150 768 110"/><path d="M0 420 Q384 380 768 440"/><path d="M0 760 Q384 800 768 740"/></g>
<g transform="rotate(-4 384 512)">
<rect x="214" y="70" width="350" height="880" fill="#000" opacity="0.25" transform="translate(8 10)"/>
<rect x="214" y="70" width="350" height="880" fill="#fbfaf6"/>
<g font-family="DejaVu Sans Mono" font-size="19" fill="#2b2b2b" xml:space="preserve">
<text x="300" y="130" font-size="26" font-weight="bold">CORNER MARKET</text>
<text x="262" y="160">2390 Shattuck Ave</text>
<text x="262" y="185">Berkeley CA</text>
<text x="240" y="235">10/22/2026   18:42</text>
<text x="240" y="285">OAT MILK 64OZ     4.99</text>
<text x="240" y="315">BANANAS 2.1LB     1.26</text>
<text x="240" y="345">COFFEE BEANS     13.49</text>
<text x="240" y="375">AA BATTERIES 8PK  9.99</text>
<text x="240" y="405">SOURDOUGH LOAF    6.50</text>
<text x="240" y="455">SUBTOTAL         36.23</text>
<text x="240" y="485">TAX               0.92</text>
<text x="240" y="525" font-size="24" font-weight="bold">TOTAL  $37.15</text>
<text x="240" y="575">VISA ****4242</text>
<text x="240" y="625">THANK YOU!</text>
<g fill="#2b2b2b"><rect x="250" y="680" width="4" height="70"/><rect x="260" y="680" width="2" height="70"/><rect x="268" y="680" width="6" height="70"/><rect x="280" y="680" width="2" height="70"/><rect x="288" y="680" width="4" height="70"/><rect x="300" y="680" width="8" height="70"/><rect x="314" y="680" width="2" height="70"/><rect x="322" y="680" width="4" height="70"/><rect x="334" y="680" width="2" height="70"/><rect x="342" y="680" width="6" height="70"/><rect x="356" y="680" width="4" height="70"/><rect x="366" y="680" width="2" height="70"/><rect x="374" y="680" width="8" height="70"/><rect x="390" y="680" width="2" height="70"/><rect x="398" y="680" width="4" height="70"/><rect x="410" y="680" width="6" height="70"/><rect x="422" y="680" width="2" height="70"/><rect x="430" y="680" width="4" height="70"/><rect x="442" y="680" width="8" height="70"/><rect x="456" y="680" width="2" height="70"/><rect x="464" y="680" width="4" height="70"/><rect x="476" y="680" width="6" height="70"/><rect x="490" y="680" width="2" height="70"/><rect x="498" y="680" width="4" height="70"/></g>
</g></g>
</svg>
S
shot /tmp/rc.svg IMG_2042.jpg

cat > /tmp/pr.svg <<'S'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
<defs><radialGradient id="bg" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8dade"/></radialGradient>
<linearGradient id="bx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2b705"/><stop offset="1" stop-color="#d99a00"/></linearGradient>
<linearGradient id="bt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2a2a"/><stop offset="0.5" stop-color="#5a5a5a"/><stop offset="1" stop-color="#1e1e1e"/></linearGradient></defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<ellipse cx="512" cy="880" rx="330" ry="40" fill="#000" opacity="0.18"/>
<rect x="232" y="180" width="560" height="690" rx="18" fill="url(#bx)"/>
<rect x="232" y="180" width="560" height="150" rx="18" fill="#1b1b1b"/>
<text x="512" y="278" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="72" fill="#f2b705">PowerCell</text>
<g transform="translate(300 380)">
<rect x="0" y="0" width="70" height="300" rx="10" fill="url(#bt)"/><rect x="22" y="-14" width="26" height="16" rx="3" fill="#bbb"/>
<rect x="90" y="0" width="70" height="300" rx="10" fill="url(#bt)"/><rect x="112" y="-14" width="26" height="16" rx="3" fill="#bbb"/>
<rect x="180" y="0" width="70" height="300" rx="10" fill="url(#bt)"/><rect x="202" y="-14" width="26" height="16" rx="3" fill="#bbb"/>
<rect x="270" y="0" width="70" height="300" rx="10" fill="url(#bt)"/><rect x="292" y="-14" width="26" height="16" rx="3" fill="#bbb"/>
<rect x="360" y="0" width="70" height="300" rx="10" fill="url(#bt)"/><rect x="382" y="-14" width="26" height="16" rx="3" fill="#bbb"/>
</g>
<text x="512" y="760" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="64" fill="#1b1b1b">AA ALKALINE</text>
<text x="512" y="830" text-anchor="middle" font-family="DejaVu Sans" font-size="44" fill="#1b1b1b">8 PACK · 1.5V</text>
</svg>
S
shot /tmp/pr.svg IMG_2043.jpg

cat > /tmp/ch.svg <<'S'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
<rect width="1024" height="768" fill="#7d6a58"/>
<g transform="rotate(3 512 384)">
<rect x="180" y="60" width="660" height="650" fill="#000" opacity="0.25" transform="translate(8 10)"/>
<rect x="180" y="60" width="660" height="650" fill="#fdfdfb"/>
<text x="230" y="130" font-family="DejaVu Serif" font-size="36" fill="#222">Monthly sign-ups, 2026</text>
<line x1="240" y1="620" x2="790" y2="620" stroke="#444" stroke-width="3"/><line x1="240" y1="180" x2="240" y2="620" stroke="#444" stroke-width="3"/>
<g fill="#3d7cc9"><rect x="270" y="480" width="60" height="140"/><rect x="360" y="430" width="60" height="190"/><rect x="450" y="380" width="60" height="240"/><rect x="540" y="300" width="60" height="320"/><rect x="630" y="260" width="60" height="360"/><rect x="720" y="210" width="60" height="410"/></g>
<g font-family="DejaVu Sans" font-size="22" fill="#333"><text x="280" y="655">May</text><text x="372" y="655">Jun</text><text x="465" y="655">Jul</text><text x="550" y="655">Aug</text><text x="640" y="655">Sep</text><text x="732" y="655">Oct</text></g>
</g>
</svg>
S
shot /tmp/ch.svg IMG_2044.jpg
ls -la
