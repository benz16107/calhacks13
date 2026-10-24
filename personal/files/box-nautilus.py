# GurtOS in Files (Nautilus 46, nautilus-python):
#  - "Ask an Agent…" on folders: GurtOS's dialog with the folders you right-clicked (up to 10, all in one task), or the
#    folder you are in when you right-click its background.
#  - The "changed by an agent" emblem on a folder an agent worked on: its changes wait for your review, or you kept them.
#  - On such a folder: Keep agent changes, Undo agent changes… (the review window asks first), and Put files back….
import json
import subprocess
import time
import urllib.parse
import urllib.request

from gi.repository import GObject, Nautilus

UI = '/opt/box/personal/box-ui.py'
BOX = 'http://127.0.0.1:7700'
EMBLEM = 'emblem-gurtos-agent'
_cache = [0.0, []]  # (fetched at, tasks): Files asks per folder, so the task list is read at most every 3 seconds


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
        if file.is_directory() and file.get_uri_scheme() == 'file' and agent_tasks(file.get_location().get_path()):
            file.add_emblem(EMBLEM)
        return Nautilus.OperationResult.COMPLETE

    def get_file_items(self, files):
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
