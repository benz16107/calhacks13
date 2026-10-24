#!/usr/bin/python3
# The desktop layer's headless check, run by personal/demo.ts on a test VM with no desktop. It runs the layer's
# own code (boxapi.py) against a running box at BOX_URL: the calls the notification service, the top bar and the
# Ask an Agent dialog make, and the service's choices about which notifications to post and close.
# Prints one JSON line per check: {"ok": true, "what": "..."}.
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
from boxapi import BOX, api, ask_spec, plan, quote, top_bar  # noqa: E402

WS = os.environ.get('PERSONAL_WORKSPACE', 'home')


def check(ok, what):
    print(json.dumps({'ok': bool(ok), 'what': what}), flush=True)


def wait(fn, secs=20):
    end = time.time() + secs
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(0.2)
    return None


def state():
    return api('GET', '/api/tasks'), api('GET', '/api/approvals?state=pending')


for f in ('box-desktop.py', 'box-ui.py', 'boxapi.py', 'files/box-nautilus.py'):
    with open(os.path.join(HERE, f)) as src:
        compile(src.read(), f, 'exec')  # a syntax check that writes no .pyc
check(True, 'the notification service, the GurtOS app and the Files extension compile under the system Python')

with urllib.request.urlopen(f'{BOX}/api/log/stream?after=0', timeout=5) as r:
    head = [r.readline().decode() for _ in range(2)]
check(head[0].startswith('id: ') and head[1].startswith('data: {'), 'the live log the service follows gives each event an id to resume from')

# A task stops for an OK: the service posts a notification and the top bar counts it.
t = api('POST', '/api/tasks', {'title': 'Deploy build 7', 'worker': 'fake', 'source': 'personal-demo', 'workspace': WS,
                               'prompt': 'ask Deploy build 7 to the home server?\nwrite deployed.txt yes'})
a = wait(lambda: next((x for x in api('GET', '/api/approvals?state=pending') if x['task'] == t['id']), None))
tasks, pending = state()
_close, post = plan({}, tasks, pending)
key = f"approval:{a['id']}" if a else None
check(key in post, f'a task that stops for an OK becomes a notification with Approve and Deny ({key})')
label = top_bar(tasks, pending)
check('needs you' in label or 'need you' in label, f'the top bar counts it: "{label}"')

# Approve, as the notification's button does: the task carries on, and the notification is closed.
api('POST', f"/api/approvals/{quote(a['id'])}", {'approved': True, 'by': 'desktop:demo'})
done = wait(lambda: api('GET', f"/api/tasks/{t['id']}")['task']['state'] == 'done')
tasks, pending = state()
close, _post = plan({key: 1}, tasks, pending)
by = next(x for x in api('GET', '/api/approvals') if x['id'] == a['id']).get('by')
check(done and key in close and by == 'desktop:demo', f'Approve lets the task finish, the log says who answered ({by}), and the notification closes')

# An answer from anywhere else (the phone, the portal) closes the desktop's notification too.
t2 = api('POST', '/api/tasks', {'title': 'Book a GPU hour', 'worker': 'fake', 'source': 'personal-demo', 'workspace': WS,
                                'prompt': 'ask Book a GPU hour?\nwrite gpu.txt booked'})
a2 = wait(lambda: next((x for x in api('GET', '/api/approvals?state=pending') if x['task'] == t2['id']), None))
api('POST', f"/api/approvals/{quote(a2['id'])}", {'approved': False, 'by': 'phone'})
wait(lambda: api('GET', f"/api/tasks/{t2['id']}")['task']['state'] in ('done', 'failed'))
close, _post = plan({f"approval:{a2['id']}": 2}, *state())
check(f"approval:{a2['id']}" in close, 'denied on the phone: the desktop closes its notification')

# Ask an Agent on a folder: the task runs on a copy, the service asks for a review, and Keep writes the folder.
# The folder belongs to a pretend owner (uid 4242), with a private file, to check Keep keeps who owns what.
OWNER = 4242
folder = tempfile.mkdtemp(prefix='personal-demo-')
notes = os.path.join(folder, 'notes.md')
with open(notes, 'w') as f:
    f.write('# Notes\n')
os.chmod(notes, 0o640)
os.chmod(folder, 0o750)
if os.getuid() == 0:
    for p in (folder, notes):
        os.chown(p, OWNER, OWNER)
spec = ask_spec('Tidy the notes\nKeep the headings.', folder, 1.5)
check(spec['title'] == 'Tidy the notes' and spec['budgetCents'] == 150 and spec['folder'] == folder,
      "Ask an Agent turns the owner's words, the folder and a $1.50 budget into a task")
t3 = api('POST', '/api/tasks', {**spec, 'worker': 'fake', 'prompt': 'write tidy.txt tidied\nappend notes.md - one more line'})
wait(lambda: api('GET', f"/api/tasks/{t3['id']}")['task']['state'] == 'done')
_close, post = plan({}, *state())
untouched = not os.path.exists(os.path.join(folder, 'tidy.txt'))
check(f"review:{t3['id']}" in post and untouched, 'when it is done the folder is still untouched, and the service asks for a review')

out = api('POST', f"/api/tasks/{t3['id']}/keep", {})  # the review window's Keep
close, _post = plan({f"review:{t3['id']}": 3}, *state())
tidy = os.path.join(folder, 'tidy.txt')
with open(tidy) as f:
    applied = f.read().strip() == 'tidied'
check(applied and len(out.get('kept', [])) == 2 and f"review:{t3['id']}" in close,
      'Keep writes both changes into the real folder, and the review notification closes')
if os.getuid() == 0:
    n, t = os.stat(notes), os.stat(tidy)
    check((n.st_uid, n.st_gid, n.st_mode & 0o777) == (OWNER, OWNER, 0o640) and (t.st_uid, t.st_gid, t.st_mode & 0o777) == (OWNER, OWNER, 0o644),
          f'kept files belong to the owner: the changed file keeps {n.st_uid}:{n.st_gid} {n.st_mode & 0o777:o}, '
          f'the new one is {t.st_uid}:{t.st_gid} {t.st_mode & 0o777:o}')

api('POST', f"/api/tasks/{t3['id']}/unkeep", {})  # the review window's Undo Keep
with open(notes) as f:
    back = f.read() == '# Notes\n'
check(back and not os.path.exists(tidy) and api('GET', f"/api/tasks/{t3['id']}")['task'].get('review') == 'undone',
      'Undo Keep puts the changed file back and removes the added one')
shutil.rmtree(folder, ignore_errors=True)
