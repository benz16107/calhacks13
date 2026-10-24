#!/usr/bin/python3
# GurtOS Personal in the owner's GNOME session (the box service, seen from the desktop), as a systemd user service:
#  - each approval becomes a desktop notification with Approve and Deny, answered through the box's API
#  - a top-bar indicator (AppIndicator) shows running tasks and how many need you
#  - a task that finished on one of your folders asks you to review its changes (Keep or Undo)
# It follows the box's action log live (GET /api/log/stream). Events are only a "something changed" signal: it
# then reads tasks and pending approvals from the API, so a missed or replayed event never leaves it out of date.
import getpass
import os
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone

import gi

gi.require_version('Gtk', '3.0')
gi.require_version('AyatanaAppIndicator3', '0.1')
from gi.repository import AyatanaAppIndicator3 as AppIndicator, Gio, GLib, Gtk  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from boxapi import BOX, api, dollars, header_caps, plan, quiet_now, quote, reviews, running, top_bar, ui, where  # noqa: E402

APP = 'dev.box.Box'
USER = getpass.getuser()
BY = f'desktop:{USER}'
NOTIFY = ('org.freedesktop.Notifications', '/org/freedesktop/Notifications', 'org.freedesktop.Notifications')


class Desktop:
    def __init__(self):
        self.bus = Gio.bus_get_sync(Gio.BusType.SESSION)
        self.bus.signal_subscribe(NOTIFY[0], NOTIFY[2], 'ActionInvoked', NOTIFY[1], None, Gio.DBusSignalFlags.NONE, self.on_action)
        self.bus.signal_subscribe(NOTIFY[0], NOTIFY[2], 'NotificationClosed', NOTIFY[1], None, Gio.DBusSignalFlags.NONE, self.on_closed)
        self.tasks, self.approvals = [], {}
        self.shown = {}  # notification id -> ('approval' | 'review', id)
        self.notified = {}  # 'approval:<id>' or 'review:<id>' -> notification id, so each is posted once
        self.online = None
        self.pending = False
        self.generation = 0  # refreshes run off the main loop; only the newest one is applied
        self.quiet = False
        self.started = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')  # the core's updatedAt format, to the second
        self.told_failed = set()
        self.indicator = AppIndicator.Indicator.new(APP, f'{APP}-symbolic', AppIndicator.IndicatorCategory.APPLICATION_STATUS)
        self.indicator.set_title('GurtOS')
        self.indicator.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        self.render()
        threading.Thread(target=self.follow, daemon=True).start()

    # ---------- following the box ----------

    def follow(self):
        """Follow the log live, reconnecting from the last seq it saw. The first connection replays it all, as one refresh."""
        after = None
        while True:
            try:
                if after is None:
                    owner = api('GET', '/api/owner')
                    if owner and owner.get('user') != USER:
                        GLib.idle_add(Gtk.main_quit)  # approvals belong to the owner; other accounts get no indicator
                        return
                    after = 0
                with urllib.request.urlopen(f'{BOX}/api/log/stream?after={after}', timeout=60) as r:  # beats every 25 s
                    GLib.idle_add(self.changed)
                    for raw in r:
                        line = raw.decode('utf-8', 'replace')
                        if line.startswith('id: '):
                            after = int(line[4:])
                        elif line.startswith('data: '):
                            GLib.idle_add(self.changed)
            except Exception:  # noqa: BLE001 (the box restarting, or not up yet)
                GLib.idle_add(self.set_online, False)
            time.sleep(2)

    def changed(self):
        # A burst (a busy task) becomes one refresh.
        if not self.pending:
            self.pending = True
            GLib.timeout_add(250, self.refresh)
        return False

    def set_online(self, online):
        if online != self.online:
            self.online = online
            self.render()
        return False

    def refresh(self):
        self.pending = False
        self.generation += 1
        generation = self.generation

        def fetch():
            try:
                tasks = api('GET', '/api/tasks')
                pending = {a['id']: a for a in api('GET', '/api/approvals?state=pending')}
                settings = api('GET', '/api/settings')
            except Exception:  # noqa: BLE001
                return GLib.idle_add(self.set_online, False)
            GLib.idle_add(lambda: generation == self.generation and self.apply(tasks, pending, settings))
        threading.Thread(target=fetch, daemon=True).start()
        return False

    def apply(self, tasks, pending, settings):
        self.tasks = tasks
        self.quiet = quiet_now(settings, datetime.now())
        self.online = True
        close, post = plan(self.notified, self.tasks, pending.values())
        for key in close:
            self.close(self.notified.pop(key))
        tasks = {t['id']: t for t in self.tasks}
        for key in post:
            kind, ident = key.split(':', 1)
            if kind == 'approval':
                self.notify_approval(pending[ident], tasks.get(pending[ident]['task'], {}).get('title', 'A task'))
            else:
                self.notify_review(tasks[ident])
        for t in self.tasks:  # a task that failed since this login, once
            if t['state'] == 'failed' and t['updatedAt'] >= self.started and t['id'] not in self.told_failed:
                self.told_failed.add(t['id'])
                self.notify(f"failed:{t['id']}", header_caps(f"{t['title'].rstrip('.')} could not finish"), t.get('error') or 'It stopped with an error.',
                            ['default', 'Open in GurtOS'], 1, track=False)
        self.approvals = pending
        self.render()
        return False

    # ---------- notifications ----------

    def notify(self, key, summary, body, actions, urgency, track=True):
        hints = {'urgency': GLib.Variant('y', urgency), 'desktop-entry': GLib.Variant('s', APP)}
        args = GLib.Variant('(susssasa{sv}i)', ('GurtOS', 0, APP, summary, GLib.markup_escape_text(body), actions, hints, 0))
        try:
            nid = self.bus.call_sync(NOTIFY[0], NOTIFY[1], NOTIFY[2], 'Notify', args, GLib.VariantType('(u)'), Gio.DBusCallFlags.NONE, 5000, None).unpack()[0]
        except GLib.Error as e:
            print(f'could not post a notification: {e.message}', file=sys.stderr)
            return
        if key:  # None: a one-off message with no actions
            self.shown[nid] = tuple(key.split(':', 1))
        if key and track:  # withdrawn by plan() once it no longer applies
            self.notified[key] = nid

    def notify_approval(self, a, title):
        # The box's own question already names the amount, who gets paid and the budget.
        approve = f"Approve {dollars(a['costCents'])}" if a.get('costCents') else 'Approve'
        # Critical: the task has stopped until you answer, so the banner stays until you do. In quiet hours, low: it waits
        # in the notification list with no banner and no sound.
        question = a['question'].strip()
        question += '' if question[-1:] in '.?!' else '.'
        self.notify(f"approval:{a['id']}", header_caps(f"{title.rstrip('.')} needs your OK"), f'{question} Your other agents keep working.',
                    ['deny', 'Deny', 'approve', approve, 'default', 'Open in GurtOS'], 0 if self.quiet else 2)

    def notify_review(self, t):
        self.notify(f"review:{t['id']}", header_caps(f"{t['title'].rstrip('.')} is done"), f"Nothing in {where(t)} has changed yet. Review its changes, then keep or undo them.",
                    ['review', 'Review changes', 'default', 'Review changes'], 1)

    def close(self, nid):
        self.shown.pop(nid, None)
        self.bus.call(NOTIFY[0], NOTIFY[1], NOTIFY[2], 'CloseNotification', GLib.Variant('(u)', (nid,)), None, Gio.DBusCallFlags.NONE, -1, None, None)

    def on_action(self, _bus, _sender, _path, _iface, _signal, params):
        nid, action = params.unpack()
        kind, ident = self.shown.get(nid, (None, None))
        if kind == 'approval' and action in ('approve', 'deny'):
            self.answer(ident, action == 'approve')
        elif kind == 'approval':
            ui('app', f"task/{self.approvals.get(ident, {}).get('task') or ident.split('.')[0]}")
        elif kind == 'review':
            ui('review', ident)
        elif kind == 'failed':
            ui('app', f'task/{ident}')

    def on_closed(self, _bus, _sender, _path, _iface, _signal, params):
        self.shown.pop(params.unpack()[0], None)

    def answer(self, approval_id, approved):
        def post():
            try:
                api('POST', f'/api/approvals/{quote(approval_id)}', {'approved': approved, 'by': BY})
            except Exception as e:  # noqa: BLE001
                GLib.idle_add(self.not_answered, approval_id, str(e))
            GLib.idle_add(self.changed)
        threading.Thread(target=post, daemon=True).start()

    def not_answered(self, approval_id, error):
        self.notified.pop(f'approval:{approval_id}', None)  # GNOME closed the banner on click; the next refresh posts it again
        self.notify(None, 'GurtOS did not take your answer', error, [], 1)
        return False

    # ---------- the top-bar indicator ----------

    def render(self):
        going = running(self.tasks)
        done = reviews(self.tasks)
        titles = {t['id']: t['title'] for t in self.tasks}
        need = len(self.approvals) + len(done)
        self.indicator.set_label(top_bar(self.tasks, self.approvals) if self.online is not False else 'offline', '00 running · 00 need you')

        menu = Gtk.Menu()

        def item(text, on=None, parent=menu):
            mi = Gtk.MenuItem(label=text if len(text) <= 56 else text[:55].rstrip() + '…')
            mi.set_sensitive(on is not None)
            if on:
                mi.connect('activate', lambda _mi: on())
            parent.append(mi)
            return mi

        if self.online is False:
            item("GurtOS isn't answering. Retrying…")
            menu.append(Gtk.SeparatorMenuItem())
        if self.approvals:
            item(f'Needs your OK, {len(self.approvals)}')
            for a in self.approvals.values():
                sub_menu = Gtk.Menu()
                item(f"Approve {dollars(a['costCents'])}" if a.get('costCents') else 'Approve', lambda a=a: self.answer(a['id'], True), parent=sub_menu)
                item('Deny', lambda a=a: self.answer(a['id'], False), parent=sub_menu)
                item('Open in GurtOS', lambda a=a: ui('app', f"task/{a['task']}"), parent=sub_menu)
                what = f"Spend {dollars(a['costCents'])}" if a.get('costCents') else a['question']
                item(f"{titles.get(a['task'], 'A task')} · {what}", lambda: None).set_submenu(sub_menu)
            menu.append(Gtk.SeparatorMenuItem())
        if done:
            item(f'Ready to review, {len(done)}')
            for t in done:
                names = [os.path.basename(f) for f in (t.get('folders') or [t.get('folder', '')])]
                item(f"{t['title']} · {', '.join(names)}", lambda t=t: ui('review', t['id']))
            menu.append(Gtk.SeparatorMenuItem())
        if going:
            item(f'Running, {len(going)}')
            for t in going:
                item(f"{t['title']} · {t.get('step') or t['state']}", lambda t=t: ui('app', f"task/{t['id']}"))
            menu.append(Gtk.SeparatorMenuItem())
        elif not need and self.online is not False:
            item('No agents are working')
            menu.append(Gtk.SeparatorMenuItem())
        item('Ask an Agent…', lambda: ui('ask'))
        item('Open GurtOS', lambda: ui('app'))
        item('GurtOS settings', lambda: ui('app', 'settings'))
        menu.show_all()
        self.indicator.set_menu(menu)


if __name__ == '__main__':
    Desktop()
    Gtk.main()
