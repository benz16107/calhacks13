# The box's HTTP API, as the owner sees it from their desktop session. Shared by box-desktop.py and box-ui.py.
import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request

BOX = os.environ.get('BOX_URL', 'http://127.0.0.1:7700')
HERE = os.path.dirname(os.path.realpath(__file__))
UI = os.path.join(HERE, 'box-ui.py')


class BoxError(Exception):
    def __init__(self, status, body):
        super().__init__(body.get('error') or f'the box answered {status}')
        self.status = status
        self.body = body


def api(method, path, body=None, timeout=5):
    """JSON in, JSON out. Raises BoxError with the box's own message on an error status."""
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BOX + path, data=data, method=method, headers={'content-type': 'application/json', 'accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        try:
            parsed = json.loads(e.read() or b'{}')
        except ValueError:
            parsed = {}
        raise BoxError(e.code, parsed if isinstance(parsed, dict) else {}) from None


def quote(ident):
    """An id as one URL path segment. Approval ids can hold spaces and question marks (Droid's questions)."""
    return urllib.parse.quote(ident, safe='')


def ui(*args):
    """Open a Box window (the app, Ask an Agent, a review, Setup) in the one running GurtOS app."""
    subprocess.Popen([UI, *args], start_new_session=True)


def dollars(cents):
    return f'${(cents or 0) / 100:,.2f}'


def needs_review(task):
    """A finished task on one of the owner's folders that waits for Keep or Undo. After a conflict (the owner
    edited the same files, so nothing was applied) it still waits for the owner."""
    return task.get('review') in ('pending', 'conflict')


def plan(notified, tasks, pending):
    """Which notifications to close and which to post, from the box's state now. Keys are 'approval:<id>' for an
    approval still pending and 'review:<task id>' for a finished task waiting for Keep or Undo. A key that is no
    longer wanted was answered elsewhere (the phone, the portal) or reviewed, so its notification goes away."""
    want = {f"approval:{a['id']}" for a in pending} | {f"review:{t['id']}" for t in reviews(tasks)}
    return [k for k in notified if k not in want], sorted(k for k in want if k not in notified)


def running(tasks):
    # A task waiting for an OK counts under "needs you", not here.
    return [t for t in tasks if t['state'] in ('queued', 'running')]


def reviews(tasks):
    return [t for t in tasks if needs_review(t)]


def top_bar(tasks, pending):
    """The indicator's label: how many tasks are going, and how many need the owner. Empty when nothing is."""
    running_now = len(running(tasks))
    need = len(pending) + len(reviews(tasks))
    parts = [f'{running_now} running'] * bool(running_now) + [f"{need} need{'s' if need == 1 else ''} you"] * bool(need)
    return ' · '.join(parts)


def ask_spec(prompt, folders, budget_dollars):
    """The task Files' "Ask an Agent" starts: the owner's words, the folders it may change, and its budget. One folder is
    sent as `folder`, several as `folders` (the box takes one or the other)."""
    first = prompt.strip().splitlines()[0]
    title = first if len(first) <= 60 else first[:59].rstrip() + '…'
    where = {'folder': folders[0]} if len(folders) == 1 else {'folders': list(folders)}
    return {'title': title, 'prompt': prompt.strip(), **where, 'budgetCents': round(budget_dollars * 100), 'source': 'files'}


def background(work, done):
    """Run work() off the GTK main loop, then done(result, error) on it, so windows stay responsive if the box is slow."""
    import threading

    from gi.repository import GLib

    def run():
        try:
            out, err = work(), None
        except Exception as e:  # noqa: BLE001 (shown to the owner as is)
            out, err = None, e
        GLib.idle_add(lambda: done(out, err) and False)
    threading.Thread(target=run, daemon=True).start()


def quiet_now(settings, now):
    """Whether quiet hours are on at `now` (a datetime in local time). The window may run past midnight."""
    q = (settings or {}).get('quietHours') or {}
    if not q.get('enabled'):
        return False
    t = now.strftime('%H:%M')
    start, end = q.get('from', '22:00'), q.get('to', '07:00')
    return start <= t < end if start <= end else t >= start or t < end


def tilde(p):
    home = os.path.expanduser('~')
    return '~' + p[len(home):] if p == home or p.startswith(home + '/') else p


def where(task):
    """The folders a task works on, as a person would say them: "~/thesis", "~/a and ~/b" or "3 folders"."""
    folders = task.get('folders') or ([task['folder']] if task.get('folder') else [])
    if not folders:
        return task.get('workspace', '')
    if len(folders) > 2:
        return f'{len(folders)} folders'
    return ' and '.join(tilde(f) for f in folders)


SMALL_WORDS = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'up', 'via'}


def header_caps(text):
    """GNOME's header capitalization, which its HIG asks of notification titles: "Buy a GPU Hour Needs Your OK"."""
    words = text.split(' ')
    out = []
    for i, w in enumerate(words):
        small = w.lower() in SMALL_WORDS and 0 < i < len(words) - 1
        literal = any(c in w for c in './_@:0123456789')  # file names, hosts, amounts stay as they are
        out.append(w if small or literal or not w[:1].islower() else w[:1].upper() + w[1:])
    return ' '.join(out)


def no_model_key(error):
    """Whether a task failed because the vault has no model key yet (a fresh install), so the fix is GurtOS Setup."""
    e = (error or '').lower()
    return 'vault has no' in e and any(k in e for k in ('factory_api_key', 'anthropic_api_key', 'model key'))
