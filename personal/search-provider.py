#!/usr/bin/python3
# GurtOS in GNOME's Activities search (org.gnome.Shell.SearchProvider2), as two providers with their own headings:
# GurtOS (agent tasks by title) at /dev/box/Search/Tasks, and Find (what /find knows: files, photos and task history)
# at /dev/box/Search/Find. D-Bus starts it on the first search and it exits when idle. Results open in the GurtOS app.
import os
import sys
import urllib.parse

from gi.repository import Gio, GLib

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from boxapi import api, ui  # noqa: E402

BUS, TASKS, FIND = 'dev.box.Search', '/dev/box/Search/Tasks', '/dev/box/Search/Find'
IFACE = '''<node><interface name="org.gnome.Shell.SearchProvider2">
  <method name="GetInitialResultSet"><arg type="as" name="terms" direction="in"/><arg type="as" direction="out"/></method>
  <method name="GetSubsearchResultSet"><arg type="as" name="previous" direction="in"/><arg type="as" name="terms" direction="in"/><arg type="as" direction="out"/></method>
  <method name="GetResultMetas"><arg type="as" name="ids" direction="in"/><arg type="aa{sv}" direction="out"/></method>
  <method name="ActivateResult"><arg type="s" name="id" direction="in"/><arg type="as" name="terms" direction="in"/><arg type="u" name="timestamp" direction="in"/></method>
  <method name="LaunchSearch"><arg type="as" name="terms" direction="in"/><arg type="u" name="timestamp" direction="in"/></method>
</interface></node>'''
IDLE_EXIT_SECONDS = 60
STATE_WORDS = {'queued': 'Queued', 'running': 'Running', 'waiting': 'Needs your OK', 'done': 'Done', 'failed': 'Failed', 'undone': 'Undone'}

metas = {}  # result id -> (name, description, icon)


def words(terms):
    w = [t.lower() for t in terms if t.strip()]
    return w if w and sum(len(x) for x in w) >= 2 else []


def search_tasks(terms):
    """Tasks whose title has every term, newest first. Ids are task:<id>."""
    ws = words(terms)
    if not ws:
        return []
    ids = []
    try:
        for t in sorted(api('GET', '/api/tasks'), key=lambda t: t.get('updatedAt', ''), reverse=True):
            if all(w in t['title'].lower() for w in ws):
                key = f"task:{t['id']}"
                metas[key] = (t['title'], f"Agent task · {STATE_WORDS.get(t['state'], t['state'])}", 'dev.box.Box')
                ids.append(key)
    except Exception:  # noqa: BLE001 (the box is down: search shows nothing from GurtOS)
        return []
    return ids[:5]


def search_find(terms):
    """What /find knows about files and photos. Ids are file:<workspace>/<path>."""
    if not words(terms):
        return []
    try:
        found = api('GET', '/t/find/search?' + urllib.parse.urlencode({'q': ' '.join(terms), 'k': 12}), timeout=3).get('results', [])
    except Exception:  # noqa: BLE001 (/find is off or has no index yet)
        return []
    ids = []
    for r in found:
        if r.get('kind') == 'task':  # tasks show under GurtOS already
            continue
        key = f"file:{r.get('workspace', '')}/{r.get('path', '')}"
        snippet = r.get('text', '').split(': ', 1)[-1].strip().replace('\n', ' ')
        metas[key] = (os.path.basename(r.get('path', '')) or key, snippet[:90] or r.get('path', ''), 'image-x-generic' if r.get('kind') == 'photo' else 'text-x-generic')
        ids.append(key)
    return ids


def handle(_conn, _sender, path, _iface, method, params, invocation):
    reset_idle()
    args = params.unpack()
    search = search_tasks if path == TASKS else search_find
    if method == 'GetInitialResultSet':
        invocation.return_value(GLib.Variant('(as)', (search(args[0]),)))
    elif method == 'GetSubsearchResultSet':
        invocation.return_value(GLib.Variant('(as)', (search(args[1]),)))
    elif method == 'GetResultMetas':
        out = []
        for key in args[0]:
            name, desc, icon = metas.get(key, (key, '', 'dev.box.Box'))
            out.append({'id': GLib.Variant('s', key), 'name': GLib.Variant('s', name), 'description': GLib.Variant('s', desc),
                        'gicon': GLib.Variant('s', icon)})
        invocation.return_value(GLib.Variant('(aa{sv})', (out,)))
    elif method == 'ActivateResult':
        key, terms = args[0], args[1]
        if key.startswith('task:'):
            ui('app', f'task/{key[5:]}')
        else:
            ui('app', '/t/find/?' + urllib.parse.urlencode({'q': ' '.join(terms)}))
        invocation.return_value(None)
    elif method == 'LaunchSearch':
        ui('app', 'tasks' if path == TASKS else '/t/find/?' + urllib.parse.urlencode({'q': ' '.join(args[0])}))
        invocation.return_value(None)


loop = GLib.MainLoop()
idle = [0]


def reset_idle():
    if idle[0]:
        GLib.source_remove(idle[0])
    idle[0] = GLib.timeout_add_seconds(IDLE_EXIT_SECONDS, lambda: loop.quit() or False)


def on_bus(conn, _name):
    for path in (TASKS, FIND):
        conn.register_object(path, Gio.DBusNodeInfo.new_for_xml(IFACE).interfaces[0], handle, None, None)


Gio.bus_own_name(Gio.BusType.SESSION, BUS, Gio.BusNameOwnerFlags.NONE, on_bus, None, lambda *_: loop.quit())
reset_idle()
loop.run()
