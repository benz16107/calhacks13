# GurtOS in Files (Nautilus 46, nautilus-python):
#  - "Ask an Agent…" on folders: GurtOS's dialog with the folders you right-clicked (up to 10, all in one task), or the
#    folder you are in when you right-click its background.
#  - Before Keep, nothing in the folder is marked: the changes live in the task's copy until you keep them.
#  - On a folder with changes waiting: Keep agent changes, and Undo agent changes… (the review window asks first).
#  - After Keep, the "changed by an agent" emblem on each file an agent added or changed, and Put files back… on the
#    folder and on those files (Figma "GurtOS Personal OS", screens 8a and 8b).
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

from gi.repository import GObject, Nautilus

UI = '/opt/box/personal/box-ui.py'
BOX = 'http://127.0.0.1:7700'
EMBLEM = 'emblem-gurtos-agent'
_cache = [0.0, []]  # (fetched at, tasks): Files asks per folder, so the task list is read at most every 3 seconds
_changed = {}  # kept task id -> the real paths it added or changed (a kept task's diff does not change)


def ui(*args):
    subprocess.Popen([UI, *args], start_new_session=True)


def tasks():
    if time.monotonic() - _cache[0] > 3:
        try:
            with urllib.request.urlopen(BOX + '/api/tasks', timeout=1) as r:
                _cache[1] = json.loads(r.read())
        except Exception:  # noqa: BLE001 (the box is down: no emblems, no menu items)
            _cache[1] = []
        _cache[0] = time.monotonic()
    return _cache[1]


def get(path):
    with urllib.request.urlopen(BOX + path, timeout=2) as r:
        return json.loads(r.read())


def changed_paths(task):
    """The real files a kept task added or modified, from its diff."""
    if task['id'] not in _changed:
        try:
            d = get(f"/api/tasks/{urllib.parse.quote(task['id'], safe='')}/diff")
        except Exception:  # noqa: BLE001 (try again on the next look)
            return set()
        roots, folder = d.get('roots'), task.get('folder')
        out = set()
        for c in d.get('changes', []):
            if c.get('change') == 'deleted':
                continue
            if roots:  # several folders: each path starts with its folder's label
                label, _, rest = c['path'].partition('/')
                if label in roots:
                    out.add(os.path.join(roots[label], rest))
            elif folder:
                out.add(os.path.join(folder, c['path']))
        _changed[task['id']] = out
    return _changed[task['id']]


def kept_by(path):
    """The kept task that changed this file, if any."""
    return next((t for t in tasks() if t.get('review') == 'kept' and path in changed_paths(t)), None)


def agent_tasks(path):
    """Tasks on this folder whose changes wait for review, or were kept, newest first."""
    out = [t for t in tasks() if path in (t.get('folders') or [t.get('folder')]) and t.get('review') in ('pending', 'conflict', 'kept')]
    return sorted(out, key=lambda t: t.get('updatedAt', ''), reverse=True)


def keep(task, file):
    req = urllib.request.Request(f"{BOX}/api/tasks/{urllib.parse.quote(task['id'], safe='')}/keep", data=b'{}', method='POST',
                                 headers={'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            if json.loads(r.read() or b'{}').get('conflicts'):
                ui('review', task['id'])  # you edited the same files: the review window explains
    except Exception:  # noqa: BLE001
        ui('review', task['id'])
    _cache[0] = 0
    file.invalidate_extension_info()


class GurtOSFiles(GObject.GObject, Nautilus.MenuProvider, Nautilus.InfoProvider):
    def update_file_info(self, file):
        if file.get_uri_scheme() == 'file' and kept_by(file.get_location().get_path()):
            file.add_emblem(EMBLEM)
        return Nautilus.OperationResult.COMPLETE

    def get_file_items(self, files):
        if len(files) == 1 and not files[0].is_directory() and files[0].get_uri_scheme() == 'file':
            t = kept_by(files[0].get_location().get_path())
            if not t:
                return []
            back = Nautilus.MenuItem(name='Box::PutBackFile', label='Put Files Back…', tip=f"Undo what \"{t['title']}\" changed")
            back.connect('activate', lambda _i: ui('review', t['id']))
            return [back]
        paths = [f.get_location().get_path() for f in files if f.is_directory() and f.get_uri_scheme() == 'file']
        if not paths or len(paths) != len(files) or len(paths) > 10:  # folders only; the box takes up to 10 in one task
            return []
        item = Nautilus.MenuItem(name='Box::AskAnAgent', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ui('ask', *paths))
        items = [item]
        if len(files) == 1:
            items += self.review_items(files[0])
        return items

    def review_items(self, file):
        items = []
        for n, t in enumerate(agent_tasks(file.get_location().get_path())[:3]):
            title = t['title'] if len(t['title']) <= 40 else t['title'][:39] + '…'
            if t.get('review') == 'kept':
                back = Nautilus.MenuItem(name=f'Box::PutBack{n}', label=f'Put Files Back: {title}…', tip='Undo the agent changes you kept')
                back.connect('activate', lambda _i, t=t: ui('review', t['id']))
                items.append(back)
                continue
            keep_item = Nautilus.MenuItem(name=f'Box::Keep{n}', label=f'Keep Agent Changes: {title}', tip='Write the agent changes into this folder')
            keep_item.connect('activate', lambda _i, t=t: keep(t, file))
            undo = Nautilus.MenuItem(name=f'Box::Undo{n}', label=f'Undo Agent Changes: {title}…', tip='Review them first, then throw them away')
            undo.connect('activate', lambda _i, t=t: ui('review', t['id']))
            items += [keep_item, undo]
        return items

    def get_background_items(self, folder):
        if folder.get_uri_scheme() != 'file':
            return []
        item = Nautilus.MenuItem(name='Box::AskAnAgentHere', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ui('ask', folder.get_location().get_path()))
        return [item, *self.review_items(folder)]
