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
    """Open a Box window (the app, Ask an agent, a review, the welcome) in the one running Box app."""
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


def ask_spec(prompt, folder, budget_dollars):
    """The task Files' "Ask an Agent" starts: the owner's words, the real folder it may change, and its budget."""
    first = prompt.strip().splitlines()[0]
    title = first if len(first) <= 60 else first[:59].rstrip() + '…'
    return {'title': title, 'prompt': prompt.strip(), 'folder': folder, 'budgetCents': round(budget_dollars * 100), 'source': 'files'}


def tilde(p):
    home = os.path.expanduser('~')
    return '~' + p[len(home):] if p == home or p.startswith(home + '/') else p
