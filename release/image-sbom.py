#!/usr/bin/env python3
"""SBOM of one GurtOS image: its Ubuntu packages and everything else syft finds in the system.

    python3 -I release/image-sbom.py <mounted system folder> <out.cdx.json>

Run it as root on a machine with syft, with the image's system file (gurtos-<edition>-<arch>.sqfs) mounted:
    mount -o loop,ro gurtos-server-x86_64.sqfs /mnt && release/image-sbom.py /mnt out.cdx.json

Why not syft alone: it does not read this image's package database, so it would list the kernel modules and the
bundled npm and Go programs but none of the Ubuntu packages. This script adds those from /var/lib/dpkg/status, with
each package's licence taken from its /usr/share/doc/<package>/copyright. It drops the per-file entries and the
per-kernel-module entries, which only make the file huge: the kernel package carries the kernel's licences.
"""
import json
import os
import re
import subprocess
import sys

root = sys.argv[1].rstrip('/')
out = sys.argv[2]

raw = subprocess.run(
    ['syft', 'scan', f'dir:{root}', '-q', '-o', 'cyclonedx-json'],
    capture_output=True, text=True, check=True, env={**os.environ, 'SYFT_CHECK_FOR_APP_UPDATE': 'false'},
).stdout
bom = json.loads(raw)
kept = []
for c in bom['components']:
    props = {p['name']: p['value'] for p in c.get('properties', [])}
    if c['type'] == 'file' or props.get('syft:package:type') == 'linux-kernel-module':
        continue
    kept.append(c)


def licences(pkg):
    """The distinct License: names in a Debian copyright file (short names, not full texts)."""
    try:
        text = open(f'{root}/usr/share/doc/{pkg}/copyright', errors='replace').read()
    except OSError:
        return []
    names = []
    for m in re.finditer(r'^License:\s*(.+?)\s*$', text, re.M):
        for part in re.split(r'\s+(?:and|or)\s+|,\s*', m.group(1)):
            part = part.strip()
            if part and len(part) < 60 and part not in names:
                names.append(part)
    return names


distro = 'ubuntu-24.04'
debs = []
status = open(f'{root}/var/lib/dpkg/status', errors='replace').read().split('\n\n')
for block in status:
    f = dict(re.findall(r'^([A-Za-z-]+):\s*(.*)$', block, re.M))
    if 'Package' not in f or 'installed' not in f.get('Status', ''):
        continue
    name, ver, arch = f['Package'], f.get('Version', ''), f.get('Architecture', '')
    lic = licences(name)
    debs.append({
        'type': 'library',
        'bom-ref': f'pkg:deb/ubuntu/{name}@{ver}?arch={arch}',
        'name': name, 'version': ver,
        'purl': f'pkg:deb/ubuntu/{name}@{ver}?arch={arch}&distro={distro}',
        'licenses': [{'license': {'name': n}} for n in lic] or [{'license': {'name': 'NOASSERTION'}}],
        'properties': [{'name': 'gurtos:package:source', 'value': 'dpkg status'}],
    })

bom['components'] = debs + kept
bom.setdefault('metadata', {}).setdefault('properties', []).append({'name': 'gurtos:note', 'value': 'ubuntu packages from dpkg status; other components from syft; per-file and per-kernel-module entries omitted'})
json.dump(bom, open(out, 'w'), separators=(',', ':'))
print(f'{out}: {len(debs)} ubuntu packages, {len(kept)} other components')
