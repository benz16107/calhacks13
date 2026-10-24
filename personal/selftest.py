#!/usr/bin/python3
# The desktop layer's headless check, run by personal/demo.ts on a test VM with no desktop. It runs the layer's
# own code (boxapi.py) against a running box at BOX_URL: the calls the notification service, the top bar and the
# Ask an Agent dialog make, and the service's choices about which notifications to post and close.
# Prints one JSON line per check: {"ok": true, "what": "..."}.
import atexit
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
from boxapi import BOX, api, ask_spec, quote  # noqa: E402

LOGIC = os.path.join(HERE, 'shell', 'gurtos@gurtos.dev', 'logic.js')
NODE = shutil.which('node') or '/usr/local/bin/node'


def js(fn, *args):
    """Call the Shell extension's own logic.js (the code GNOME Shell runs) through Node."""
    src = f"import({json.dumps('file://' + LOGIC)}).then(m => process.stdout.write(JSON.stringify(m[{json.dumps(fn)}](...JSON.parse(process.argv[1])))))"
    out = subprocess.run([NODE, '--input-type=module', '-e', src, json.dumps(args)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def plan(shown, tasks, pending):
    p = js('plan', list(shown), tasks, list(pending))
    return p['close'], p['post']


def top_bar(tasks, pending):
    c = js('counts', tasks, list(pending))
    return ' · '.join([f"{c['running']} running"] * bool(c['running']) + [f"{c['needsYou']} need{'s' if c['needsYou'] == 1 else ''} you"] * bool(c['needsYou']))


def quiet_now(settings, now):
    return js('quietAt', settings, now.strftime('%H:%M'))

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


# The checks change settings as Setup would; put the box's own settings back however the run ends.
BEFORE = api('GET', '/api/settings')
atexit.register(lambda: api('PATCH', '/api/settings', {k: BEFORE[k] for k in ('agentFolders', 'approvalThresholdCents', 'quietHours')}))
# The box only takes folders in the owner's home or in agentFolders, so the checks use folders under one temporary
# folder that they name as the folder agents may use, the way Setup's Folders step would.
ROOT = tempfile.mkdtemp(prefix='personal-demo-')
atexit.register(lambda: shutil.rmtree(ROOT, ignore_errors=True))
api('PATCH', '/api/settings', {'agentFolders': [ROOT]})


for f in ('box-ui.py', 'setupwin.py', 'settingswin.py', 'search-provider.py', 'boxapi.py', 'files/box-nautilus.py'):
    with open(os.path.join(HERE, f)) as src:
        compile(src.read(), f, 'exec')  # a syntax check that writes no .pyc
check(True, 'the GurtOS app, Setup, Settings, the search provider and the Files extension compile under the system Python')
ext = os.path.join(HERE, 'shell', 'gurtos@gurtos.dev', 'extension.js')
subprocess.run([NODE, '--check', ext], check=True, capture_output=True)
check(js('headerCaps', 'buy a GPU hour needs your OK') == 'Buy a GPU Hour Needs Your OK' and js('noModelKey', 'the vault has no FACTORY_API_KEY'),
      'the Shell extension parses, and its notification wording and missing-key check work (the same logic.js GNOME Shell runs)')

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
folder = tempfile.mkdtemp(prefix='notes-', dir=ROOT)
notes = os.path.join(folder, 'notes.md')
with open(notes, 'w') as f:
    f.write('# Notes\n')
os.chmod(notes, 0o640)
os.chmod(folder, 0o750)
if os.getuid() == 0:
    for p in (folder, notes):
        os.chown(p, OWNER, OWNER)
spec = ask_spec('Tidy the notes\nKeep the headings.', [folder], 1.5)
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

# GurtOS Setup: the calls its steps make, and what they change on the box.
setup = api('GET', '/api/setup')
api('POST', '/api/setup/step', {'id': 'folders'})
check('folders' in api('GET', '/api/setup')['steps'] and isinstance(setup.get('done'), bool), 'Setup records a step the owner took (POST /api/setup/step)')

a, b = (tempfile.mkdtemp(prefix=f'setup-{n}-', dir=ROOT) for n in 'ab')
outside = tempfile.mkdtemp(prefix='personal-outside-')
if os.getuid() == 0:  # the box only gives agents a person's folders
    for d in (a, b, outside):
        os.chown(d, OWNER, OWNER)
try:
    api('PATCH', '/api/settings', {'agentFolders': [a, b]})  # the Folders step
    two = api('POST', '/api/tasks', {**ask_spec('Compare the two', [a, b], 0), 'worker': 'fake', 'prompt': 'write both.txt yes'})
    refused = None
    try:
        api('POST', '/api/tasks', {**ask_spec('Not allowed', [outside], 0), 'worker': 'fake', 'prompt': 'write x.txt no'})
    except Exception as e:  # noqa: BLE001
        refused = str(e)
    check(two.get('folders') == [a, b] and refused,
          f'after Setup names the folders agents may use, Ask an agent on two of them is one task, and a folder outside is refused ({refused})')
    wait(lambda: api('GET', f"/api/tasks/{two['id']}")['task']['state'] in ('done', 'failed'))
    api('POST', f"/api/tasks/{two['id']}/undo", {})

    api('PATCH', '/api/settings', {'approvalThresholdCents': 500, 'quietHours': {'enabled': True, 'from': '22:00', 'to': '07:00'}})  # Permissions
    now = api('GET', '/api/settings')
    late, noon = datetime(2026, 10, 24, 23, 30), datetime(2026, 10, 24, 12, 0)
    check(now['approvalThresholdCents'] == 500 and quiet_now(now, late) and not quiet_now(now, noon),
          'Permissions saves the spend limit and quiet hours; at 23:30 approvals arrive without a banner, at 12:00 with one')
finally:
    for d in (a, b, outside):
        shutil.rmtree(d, ignore_errors=True)

secret = 'setup-test-' + os.urandom(6).hex()
api('PUT', '/api/vault/GURTOS_SETUP_TEST', {'value': secret})  # a key typed into AI models or Apps
names = api('GET', '/api/vault')
seen = json.dumps([names, api('GET', '/api/apps?all=1'), api('GET', '/api/settings'), api('GET', '/api/setup')])
check(any(k['name'] == 'GURTOS_SETUP_TEST' and k['setAt'] for k in names) and secret not in seen,
      'a key saved in Setup is listed by name and time, and no route the desktop reads shows its value')

apps = api('GET', '/api/apps?all=1')
check(apps and all('access' in x and 'enabled' in x for x in apps),
      f'the Apps step lists all {len(apps)} apps with what each reaches and the keys it needs')
