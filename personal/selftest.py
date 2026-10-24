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
from boxapi import BOX, api, ask_spec, kept_tasks, plan, quote, top_bar  # noqa: E402

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
_close, post = plan({}, tasks, pending, set())
key = f"approval:{a['id']}" if a else None
check(key in post, f'a task that stops for an OK becomes a notification with Approve and Deny ({key})')
label = top_bar(tasks, pending, set())
check('needs you' in label or 'need you' in label, f'the top bar counts it: "{label}"')

# Approve, as the notification's button does: the task carries on, and the notification is closed.
api('POST', f"/api/approvals/{quote(a['id'])}", {'approved': True, 'by': 'desktop:demo'})
done = wait(lambda: api('GET', f"/api/tasks/{t['id']}")['task']['state'] == 'done')
tasks, pending = state()
close, _post = plan({key: 1}, tasks, pending, set())
by = next(x for x in api('GET', '/api/approvals') if x['id'] == a['id']).get('by')
check(done and key in close and by == 'desktop:demo', f'Approve lets the task finish, the log says who answered ({by}), and the notification closes')

# An answer from anywhere else (the phone, the portal) closes the desktop's notification too.
t2 = api('POST', '/api/tasks', {'title': 'Book a GPU hour', 'worker': 'fake', 'source': 'personal-demo', 'workspace': WS,
                                'prompt': 'ask Book a GPU hour?\nwrite gpu.txt booked'})
a2 = wait(lambda: next((x for x in api('GET', '/api/approvals?state=pending') if x['task'] == t2['id']), None))
api('POST', f"/api/approvals/{quote(a2['id'])}", {'approved': False, 'by': 'phone'})
wait(lambda: api('GET', f"/api/tasks/{t2['id']}")['task']['state'] in ('done', 'failed'))
close, _post = plan({f"approval:{a2['id']}": 2}, *state(), set())
check(f"approval:{a2['id']}" in close, 'denied on the phone: the desktop closes its notification')

# Ask an Agent on a folder: the task runs on a copy, the service asks for a review, and Keep writes the folder.
folder = tempfile.mkdtemp(prefix='personal-demo-')
with open(os.path.join(folder, 'notes.md'), 'w') as f:
    f.write('# Notes\n')
spec = ask_spec('Tidy the notes\nKeep the headings.', folder, 1.5)
check(spec['title'] == 'Tidy the notes' and spec['budgetCents'] == 150 and spec['folder'] == folder,
      "Ask an Agent turns the owner's words, the folder and a $1.50 budget into a task")
t3 = api('POST', '/api/tasks', {**spec, 'worker': 'fake', 'prompt': 'write tidy.txt tidied\nappend notes.md - one more line'})
wait(lambda: api('GET', f"/api/tasks/{t3['id']}")['task']['state'] == 'done')
tasks, pending = state()
_close, post = plan({}, tasks, pending, set())
untouched = not os.path.exists(os.path.join(folder, 'tidy.txt'))
check(f"review:{t3['id']}" in post and untouched, 'when it is done the folder is still untouched, and the service asks for a review')
out = api('POST', f"/api/tasks/{t3['id']}/keep", {})
kept = kept_tasks(api('GET', f"/api/tasks/{t3['id']}")['events'])
close, _post = plan({f"review:{t3['id']}": 3}, *state(), kept)
with open(os.path.join(folder, 'tidy.txt')) as f:
    applied = f.read().strip() == 'tidied'
check(applied and len(out.get('kept', [])) == 2 and f"review:{t3['id']}" in close,
      'Keep (the review window\'s button) writes both changes into the real folder, and the review notification closes')
shutil.rmtree(folder, ignore_errors=True)
