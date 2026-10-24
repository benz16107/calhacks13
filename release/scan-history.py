#!/usr/bin/env python3
"""Look for real secret values anywhere in git history: every blob reachable from every ref, and every commit
message. The values come from files you name (KEY=value lines, or any text: long tokens are taken from it), so
no secret is ever written into the repo or printed. Prints the key names that matched and the paths they were
found in. Exit 1 on any match.

    python3 -I release/scan-history.py <repo> <secret file>...

Release use: run it on linuxbox with ~/.config/calhacks13/env, every test VM's /etc/box/vault.env, the track
seeds and keys, right before the repository's visibility changes. See release/audit.md.
"""
import re
import subprocess
import sys

repo, files = sys.argv[1], sys.argv[2:]
values = {}  # value -> names
for path in files:
    text = open(path, errors='replace').read()
    for line in text.splitlines():
        m = re.match(r'\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$', line)
        if m:
            v = m.group(2).strip().strip('"\'')
            if len(v) >= 8:
                values.setdefault(v, set()).add(m.group(1))
    # Free text (seeds, PEM bodies, account notes): long tokens with letters and digits.
    for tok in re.split(r'[\s"\'`=,;|()<>\[\]{}:]+', text):
        if len(tok) >= 16 and re.search(r'\d', tok) and re.search(r'[A-Za-z]', tok) and not tok.startswith(('http', '/')):
            values.setdefault(tok, set()).add(f'token from {path.rsplit("/", 1)[-1]}')

git = lambda *a, **k: subprocess.run(['git', '-C', repo, *a], capture_output=True, **k)
paths = {}
for line in git('rev-list', '--all', '--objects', text=True).stdout.splitlines():
    sha, _, p = line.partition(' ')
    paths.setdefault(sha, p)
kinds = git('cat-file', '--batch-check', input='\n'.join(paths), text=True).stdout.splitlines()
blobs = [k.split()[0] for k in kinds if k.split()[1:2] == ['blob']]

cat = subprocess.Popen(['git', '-C', repo, 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
cat.stdin.write(('\n'.join(blobs) + '\n').encode())
cat.stdin.close()
hits = {}
needles = [(v.encode(), names) for v, names in values.items()]
for sha in blobs:
    size = int(cat.stdout.readline().split()[2])
    data = cat.stdout.read(size)
    cat.stdout.read(1)
    for v, names in needles:
        if v in data:
            hits.setdefault(tuple(sorted(names)), set()).add(paths.get(sha) or sha)
messages = git('log', '--all', '--format=%B').stdout
for v, names in needles:
    if v in messages:
        hits.setdefault(tuple(sorted(names)), set()).add('<a commit message>')

refs = git('for-each-ref', '--format=%(refname)', text=True).stdout.split()
print(f'{len(values)} values, {len(blobs)} blobs, {len(refs)} refs')
for names, where in sorted(hits.items()):
    print('MATCH', ', '.join(names), '->', ', '.join(sorted(where)[:8]))
sys.exit(1 if hits else 0)
