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
