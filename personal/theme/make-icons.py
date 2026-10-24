#!/usr/bin/python3
# Build the GurtOS icon theme from the installed Papirus (GPL-3.0): every folder icon recoloured from Papirus blue to
# GurtOS slate (docs/figma/personal-os/assets/icons/folder-gurtos.svg), the dock's Show Apps icon without the Ubuntu
# logo, then everything else inherited from Papirus and Adwaita. Run as root by theme/install.sh.
#   make-icons.py <theme source dir> <output dir>
import os
import re
import shutil
import sys

PAPIRUS = '/usr/share/icons/Papirus'
COLOURS = {'#5294e2': '#4f6a8f', '#4877b1': '#3e5675'}  # Papirus blue (face, back) -> GurtOS slate

src, out = sys.argv[1], sys.argv[2]
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(src, out)
dirs = []
if os.path.isdir(PAPIRUS):
    for size in sorted(os.listdir(PAPIRUS)):
        places = os.path.join(PAPIRUS, size, 'places')
        if not os.path.isdir(places):
            continue
        made = 0
        for name in os.listdir(places):
            path = os.path.join(places, name)
            target = os.path.basename(os.path.realpath(path))
            if not target.startswith('folder-blue') or not name.endswith('.svg'):
                continue
            with open(os.path.realpath(path)) as f:
                svg = f.read()
            for a, b in COLOURS.items():
                svg = re.sub(a, b, svg, flags=re.I)
            os.makedirs(os.path.join(out, size, 'places'), exist_ok=True)
            with open(os.path.join(out, size, 'places', name), 'w') as f:
                f.write(svg)
            made += 1
        if made:
            scale = 2 if size.endswith('@2x') else 1
            px = int(size.split('x')[0])
            dirs.append((f'{size}/places', px, scale))

index = open(os.path.join(out, 'index.theme')).read()
extra = ''.join(f'\n[{d}]\nSize={px}\nScale={scale}\nContext=Places\nType=Fixed\n' for d, px, scale in dirs)
listed = ','.join(['scalable/actions', 'scalable/places'] + [d for d, _px, _s in dirs])
index = re.sub(r'^Directories=.*$', f'Directories={listed}', index, flags=re.M) + extra
with open(os.path.join(out, 'index.theme'), 'w') as f:
    f.write(index)
print(f'GurtOS icons: {sum(1 for _ in dirs)} folder sizes recoloured from Papirus' if dirs else 'GurtOS icons: Papirus not installed, folders stay as they are')
