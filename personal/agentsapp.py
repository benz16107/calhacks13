# The GurtOS app on GurtOS Personal (dev.box.Box): the agent tools as a native GTK 4 and libadwaita app, like Files or
# Settings, not the Server screen in a window. A sidebar with Agents, Activity, Time Machine and the installed apps;
# a task's own page with its steps, what it can reach, its cost and Keep or Undo. It talks to the box through
# boxapi.py and follows the action log live (GET /api/log/stream). The decisions live in tasklogic.py.
import json
import os
import threading
import time
import urllib.request

from gi.repository import Adw, GLib, Gtk, Pango

import tasklogic as tl
from apptiles import tile
from boxapi import BOX, api, background, quote, tilde
from setupwin import PERSONAL_APPS

ME = GLib.get_user_name()


# ---------- small builders ----------

def label(text, *classes, wrap=True, xalign=0, **kw):
    return Gtk.Label(label=text, xalign=xalign, wrap=wrap, wrap_mode=Pango.WrapMode.WORD_CHAR, css_classes=list(classes), **kw)


def icon_button(icon, name, handler, *classes):
    b = Gtk.Button(icon_name=icon, tooltip_text=name, valign=Gtk.Align.CENTER, css_classes=list(classes) or ['flat'])
    b.update_property([Gtk.AccessibleProperty.LABEL], [name])
    b.connect('clicked', lambda _b: handler())
    return b


def button(text, handler, *classes):
    b = Gtk.Button(label=text, valign=Gtk.Align.CENTER, css_classes=list(classes))
    b.connect('clicked', lambda _b: handler())
    return b


def row(title, subtitle='', icon=None, activate=None, suffix=None):
    r = Adw.ActionRow(title=GLib.markup_escape_text(title or ''), subtitle=GLib.markup_escape_text(subtitle or ''), subtitle_lines=2)
    if icon:
        r.add_prefix(Gtk.Image(icon_name=icon, accessible_role=Gtk.AccessibleRole.PRESENTATION))
    if suffix:
        r.add_suffix(suffix)
    if activate:
        r.set_activatable(True)
        r.connect('activated', lambda _r: activate())
        r.add_suffix(Gtk.Image(icon_name='go-next-symbolic', accessible_role=Gtk.AccessibleRole.PRESENTATION))
    return r


def group(title='', description=''):
    return Adw.PreferencesGroup(title=GLib.markup_escape_text(title), description=GLib.markup_escape_text(description))


class Scroller(Gtk.ScrolledWindow):
    """A page body that can be rebuilt live without jumping back to the top."""

    def __init__(self):
        super().__init__(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True)

    def fill(self, *widgets):
        keep = self.get_vadjustment().get_value()
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=24, margin_top=24, margin_bottom=24, margin_start=12, margin_end=12)
        for w in widgets:
            box.append(w)
        self.set_child(Adw.Clamp(maximum_size=860, tightening_threshold=600, child=box))
        GLib.idle_add(lambda: self.get_vadjustment().set_value(keep) and False)


def page(title, subtitle, body, *end):
    """A content page: a header bar (with the given buttons at its end) over the body."""
    view = Adw.ToolbarView(content=body)
    title_widget = Adw.WindowTitle(title=title, subtitle=subtitle or '')
    header = Adw.HeaderBar(title_widget=title_widget)
    for w in end:
        header.pack_end(w)
    view.add_top_bar(header)
    p = Adw.NavigationPage(title=title, child=view)
    p.title_widget = title_widget
    return p


# ---------- the window ----------

class AgentsWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title='GurtOS', default_width=1120, default_height=760, width_request=360, height_request=420)
        self.tasks, self.pending, self.settings, self.apps, self.system, self.events = [], [], {}, [], {}, []
        self.timer = 0
        self.current = None  # the root page's id: agents, activity, timemachine or app:<name>
        self.refreshers = {}

        # Sidebar
        self.nav_list = Gtk.ListBox(css_classes=['navigation-sidebar'])
        self.nav_list.connect('row-activated', lambda _l, r: self.show_root(r.pid))
        self.nav_list.set_header_func(lambda r, _b: r.set_header(label('Apps', 'heading', 'dim-label', margin_start=12, margin_top=12, margin_bottom=6)) if getattr(r, 'first_app', False) else r.set_header(None))
        side_header = Adw.HeaderBar(title_widget=Adw.WindowTitle(title='GurtOS'))
        plus = icon_button('list-add-symbolic', 'New task', self.new_task)
        self.new_buttons = [plus]
        side_header.pack_start(plus)
        side = Adw.ToolbarView(content=Gtk.ScrolledWindow(child=self.nav_list, hscrollbar_policy=Gtk.PolicyType.NEVER))
        side.add_top_bar(side_header)
        self.nav = Adw.NavigationView()
        self.split = Adw.NavigationSplitView(sidebar=Adw.NavigationPage(title='GurtOS', child=side),
                                             content=Adw.NavigationPage(title='Agents', child=self.nav), min_sidebar_width=220, max_sidebar_width=260)
        bar = Gtk.Box(spacing=8, css_classes=['gurt-offline-bar'])
        bar.append(Gtk.Image(icon_name='network-offline-symbolic', accessible_role=Gtk.AccessibleRole.PRESENTATION))
        bar.append(label("GurtOS isn't answering. Your files are unchanged. Retrying…", wrap=False))
        self.banner = Gtk.Revealer(child=bar, reveal_child=False)
        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        outer.append(self.banner)
        self.split.set_vexpand(True)
        outer.append(self.split)
        self.toasts = Adw.ToastOverlay(child=outer)
        self.set_content(self.toasts)
        self.offline = False
        bp = Adw.Breakpoint.new(Adw.BreakpointCondition.parse('max-width: 640sp'))
        bp.add_setter(self.split, 'collapsed', True)
        self.add_breakpoint(bp)
        self.fill_sidebar()

        for key, action in (('<Ctrl>n', self.new_task), ('<Ctrl>f', lambda: self.show_root('activity'))):
            self.add_shortcut(Gtk.Shortcut(trigger=Gtk.ShortcutTrigger.parse_string(key), action=Gtk.CallbackAction.new(lambda *_a, f=action: f() or True)))

        self.stop = threading.Event()
        self.connect('close-request', lambda _w: self.stop.set() or False)
        self.refresh(first=True)

    # ----- data -----

    def refresh(self, first=False):
        def done(state, err):
            if err:
                self.set_offline(True)
                if first:
                    self.nav.replace([page('Agents', '', Adw.StatusPage(icon_name='network-offline-symbolic', title="GurtOS isn't answering",
                                                                       description='Your files are unchanged. GurtOS keeps trying.'))])
                    GLib.timeout_add_seconds(3, lambda: self.refresh(first=True) and False)
                return
            self.set_offline(False)
            self.tasks, self.pending, self.settings, self.apps, self.system = state[:5]
            self.apps = [a for a in self.apps if a.get('track') in PERSONAL_APPS]  # the same apps Setup offers; no developer samples
            if first:
                self.events = state[5]
                self.fill_sidebar()
                threading.Thread(target=self.follow, daemon=True).start()
                GLib.timeout_add_seconds(5, self.heartbeat)
                if self.current is None:
                    self.show_root('agents')
            self.update_badges()
            for fn in list(self.refreshers.values()):
                fn()
        background(lambda: (api('GET', '/api/tasks'), api('GET', '/api/approvals?state=pending'), api('GET', '/api/settings'),
                            api('GET', '/api/apps'), api('GET', '/api/system')) + ((api('GET', '/api/log?after=0'),) if first else ()), done)

    def heartbeat(self):
        """The live log goes quiet when GurtOS stops, so look every few seconds to notice, and to notice it is back."""
        if self.stop.is_set():
            return False
        self.refresh()
        return True

    def set_offline(self, off):
        if off == self.offline:
            return
        self.offline = off
        self.banner.set_reveal_child(off)
        self.update_badges()
        self.new_button_sensitive(not off)
        for fn in list(self.refreshers.values()):
            fn()

    def new_button_sensitive(self, on):
        for b in getattr(self, 'new_buttons', []):
            b.set_sensitive(on)

    def follow(self):
        """The live action log. Each event only means "something changed": one refresh per burst."""
        while not self.stop.is_set():
            after = self.events[-1]['seq'] if self.events else 0
            try:
                with urllib.request.urlopen(f'{BOX}/api/log/stream?after={after}', timeout=60) as r:
                    for raw in r:
                        if self.stop.is_set():
                            return
                        line = raw.decode().strip()
                        if line.startswith('data:'):
                            e = json.loads(line[5:])
                            GLib.idle_add(self.arrived, e)
            except Exception:  # noqa: BLE001 (the box restarted or the stream timed out: pick up where it left)
                time.sleep(2)

    def arrived(self, e):
        if not self.events or e.get('seq', 0) > self.events[-1]['seq']:
            self.events.append(e)
        if not self.timer:
            self.timer = GLib.timeout_add(300, self.burst_over)
        return False

    def burst_over(self):
        self.timer = 0
        self.refresh()
        return False

    def titles(self):
        return {t['id']: t['title'] for t in self.tasks}

    def toast(self, text):
        self.toasts.add_toast(Adw.Toast(title=GLib.markup_escape_text(text), timeout=4))

    # ----- sidebar -----

    def fill_sidebar(self):
        while (r := self.nav_list.get_first_child()) is not None:
            self.nav_list.remove(r)
        self.badge = Gtk.Label(css_classes=['gurt-count'], visible=False, valign=Gtk.Align.CENTER)
        items = [('agents', 'Agents', 'applications-science-symbolic'), ('activity', 'Activity', 'view-list-symbolic'),
                 ('timemachine', 'Time Machine', 'document-open-recent-symbolic')]
        items += [(f"app:{a['name']}", a['title'], a) for a in self.apps]
        if self.system.get('edition') == 'business':
            items.append(('business', 'Company (opens in your browser)', 'system-users-symbolic'))
        for n, (pid, title, icon) in enumerate(items):
            line = Gtk.Box(spacing=12, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
            if isinstance(icon, dict):  # an app: its own tile, as in Setup and Settings
                line.append(tile(icon.get('track') or icon['name'], icon['title'], 20))
            else:
                line.append(Gtk.Image(icon_name=icon, accessible_role=Gtk.AccessibleRole.PRESENTATION))
            line.append(label(title, wrap=False, hexpand=True, ellipsize=Pango.EllipsizeMode.END))
            if pid == 'agents':
                line.append(self.badge)
            r = Gtk.ListBoxRow(child=line)
            r.update_property([Gtk.AccessibleProperty.LABEL], [title])
            r.pid, r.first_app = pid, (n == 3 and pid.startswith('app:'))
            self.nav_list.append(r)
            if pid == self.current:
                self.nav_list.select_row(r)
        self.update_badges()

    def update_badges(self):
        n = len(self.pending)  # requests only, the same count as the top bar
        self.badge.set_label(str(n))
        self.badge.set_visible(n > 0 and not self.offline)  # no stale count while GurtOS is down

    # ----- navigation -----

    def show_root(self, pid):
        if pid == 'business':
            return Gtk.UriLauncher(uri=f'{BOX}/').launch(self, None, None)
        self.current = pid
        self.refreshers.clear()
        builders = {'agents': self.agents_page, 'activity': self.activity_page, 'timemachine': self.timemachine_page}
        p = builders[pid]() if pid in builders else self.app_page(pid[4:])
        self.nav.replace([p])
        self.split.set_show_content(True)
        r = self.nav_list.get_first_child()
        while r:
            if getattr(r, 'pid', None) == pid and self.nav_list.get_selected_row() is not r:
                self.nav_list.select_row(r)
            r = r.get_next_sibling()

    def go(self, route):
        """A route from the dock, the top bar, a notification, search or Files: '', tasks, task/<id>, activity, timemachine,
        new, or an app's own path such as /t/find/?q=…"""
        route = route or ''
        if route.startswith('/t/'):
            track = route[3:].split('/', 1)[0]
            name = next((a['name'] for a in self.apps if a.get('track') == track), track)
            self.current = f'app:{name}'
            self.refreshers.clear()
            self.nav.replace([self.app_page(name, route)])
        elif route.startswith('task/'):
            if self.current != 'agents':
                self.show_root('agents')
            self.open_task(route[5:])
        elif route in ('activity', 'timemachine'):
            self.show_root(route)
        else:
            self.show_root('agents')
            if route == 'new':
                self.new_task()
        self.present()

    def new_task(self, folders=()):
        from askwin import AskWindow
        AskWindow(self.get_application(), list(folders), parent=self)

    # ----- answering -----

    def answer(self, a, approved):
        def done(_out, err):
            self.toast(f'GurtOS did not take your answer: {err}' if err else ('Approved.' if approved else 'Denied.'))
            self.refresh()
        background(lambda: api('POST', f"/api/approvals/{quote(a['id'])}", {'approved': approved, 'by': f'desktop:{ME}'}), done)

    def approval_row(self, a, task):
        r = Adw.ActionRow(title=GLib.markup_escape_text((task or {}).get('title', 'A task')), subtitle=GLib.markup_escape_text(a.get('question', '')), subtitle_lines=3)
        r.add_prefix(Gtk.Image(icon_name='dialog-question-symbolic', css_classes=['warning'], accessible_role=Gtk.AccessibleRole.PRESENTATION))
        if a.get('costCents'):
            r.add_suffix(label(tl.dollars(a['costCents']), 'warning', 'heading', wrap=False, valign=Gtk.Align.CENTER))
        r.add_suffix(button('Deny', lambda: self.answer(a, False)))
        approve = button(f"Approve {tl.dollars(a['costCents'])}" if a.get('costCents') else 'Approve', lambda: self.answer(a, True), 'suggested-action')
        r.add_suffix(approve)
        return r

    # ----- Agents -----

    def agents_page(self):
        body = Scroller()
        pause = Gtk.ToggleButton(icon_name='media-playback-pause-symbolic', tooltip_text='Pause all agents', valign=Gtk.Align.CENTER)
        pause.update_property([Gtk.AccessibleProperty.LABEL], ['Pause all agents'])
        guard = [False]

        def paused(b):
            if not guard[0]:
                background(lambda: api('PATCH', '/api/settings', {'paused': b.get_active()}),
                           lambda _o, err: self.toast(f'Not saved: {err}' if err else ('Every agent is paused.' if b.get_active() else 'Agents carry on.')) or self.refresh())
        pause.connect('toggled', paused)
        new = Gtk.Button(label='New task', css_classes=['suggested-action'], valign=Gtk.Align.CENTER, tooltip_text='New task (Ctrl+N)')
        new.connect('clicked', lambda _b: self.new_task())
        self.new_buttons.append(new)
        p = page('Agents', '', body, new, pause)

        def build():
            guard[0] = True
            pause.set_active(bool(self.settings.get('paused')))
            pause.set_visible('paused' in self.settings)
            pause.set_sensitive(not self.offline)
            new.set_sensitive(not self.offline)
            pause.set_tooltip_text('Resume all agents' if self.settings.get('paused') else 'Pause all agents')
            guard[0] = False
            if self.offline:  # never a stale list, and never "No agents yet", while GurtOS is down
                p.title_widget.set_subtitle('Offline')
                return body.fill(Adw.StatusPage(icon_name='network-offline-symbolic', title="GurtOS isn't answering",
                                                description='Your files are unchanged. GurtOS keeps trying and this page fills in by itself.'))
            s = tl.sections(self.tasks, self.pending)
            p.title_widget.set_subtitle(('Paused · ' if self.settings.get('paused') else '') + tl.headline(s))
            if not self.tasks:
                st = Adw.StatusPage(icon_name='applications-science-symbolic', title='No agents yet',
                                    description='Ask an agent to do something. It works on a copy of your folders, and nothing changes until you choose Keep.')
                st.set_child(button('New task', self.new_task, 'pill', 'suggested-action'))
                return body.fill(st)
            out = []
            if s['needs']:
                g = group('Needs you', 'Approve or deny. Other agents keep working while one waits.')
                for a, t in s['needs']:
                    g.add(self.approval_row(a, t))
                out.append(g)
            g = group('Running')
            for t in s['running']:
                cost = tl.dollars(t.get('costCents')) + (f" of {tl.dollars(t['budgetCents'])}" if t.get('budgetCents') else '')
                r = row(t['title'], t.get('step') or tl.STATE_WORDS.get(t['state'], t['state']), activate=lambda t=t: self.open_task(t['id']),
                        suffix=label(cost, 'dim-label', 'numeric', wrap=False, valign=Gtk.Align.CENTER))
                sp = Gtk.Spinner(spinning=t['state'] == 'running', valign=Gtk.Align.CENTER)
                sp.update_property([Gtk.AccessibleProperty.LABEL], ['Working'])
                r.add_prefix(sp)
                g.add(r)
            if not s['running']:
                g.add(row('Nothing running', 'Start one with New task, or right-click a folder in Files.', 'media-playback-pause-symbolic'))
            out.append(g)
            if s['review']:
                g = group('Ready to review', 'Finished. Nothing reaches your folder until you keep it.')
                for t in s['review']:
                    r = row(t['title'], ', '.join(tilde(f) for f in (t.get('folders') or [t.get('folder')]) if f) or t.get('workspace', ''),
                            'folder-symbolic', activate=lambda t=t: self.open_task(t['id']))
                    g.add(r)
                out.append(g)
            if s['done']:
                g = group('Done')
                for t in s['done']:
                    words = {'done': 'Kept' if t.get('review') == 'kept' else 'Finished', 'failed': 'Could not finish', 'undone': 'Undone'}[t['state']]
                    icon = {'done': 'object-select-symbolic', 'failed': 'dialog-error-symbolic', 'undone': 'edit-undo-symbolic'}[t['state']]
                    g.add(row(t['title'], f"{words} {tl.clock(t.get('updatedAt'))} · {tl.dollars(t.get('costCents'))}", icon, activate=lambda t=t: self.open_task(t['id'])))
                out.append(g)
            body.fill(*out)
        self.refreshers['agents'] = build
        build()
        return p

    # ----- one task -----

    def open_task(self, task_id):
        body = Scroller()
        state = {}
        undo = icon_button('edit-undo-symbolic', 'Undo task', lambda: self.confirm_undo(state['detail']['task']))
        p = page('Task', '', body, undo)

        def build():
            def done(result, err):
                if err:
                    return body.fill(Adw.StatusPage(icon_name='dialog-error-symbolic', title='Could not load this task', description=GLib.markup_escape_text(str(err))))
                detail, diff = result
                state['detail'] = detail
                undo.set_visible(detail['task']['state'] != 'undone' and detail['task'].get('review') != 'undone')
                body.fill(*self.task_widgets(detail, diff, p))
            background(lambda: (api('GET', f'/api/tasks/{quote(task_id)}'), api('GET', f'/api/tasks/{quote(task_id)}/diff')), done)
        self.refreshers[f'task:{task_id}'] = build
        p.connect('hidden', lambda _p: self.refreshers.pop(f'task:{task_id}', None))
        build()
        self.nav.push(p)

    def task_widgets(self, detail, diff, p):
        t = detail['task']
        p.title_widget.set_title(t['title'])
        p.set_title(t['title'])
        kept = t.get('review') == 'kept'
        p.title_widget.set_subtitle(f"{'Kept' if kept else tl.STATE_WORDS.get(t['state'], t['state'])} · {tl.clock(t.get('updatedAt'))}")
        out = []

        # Cost against budget
        g = group()
        spent, budget = t.get('costCents') or 0, t.get('budgetCents') or 0
        r = row('Spent', f"{tl.dollars(spent)} of a {tl.dollars(budget)} budget. Above it, the agent asks you first." if budget else
                f'{tl.dollars(spent)}. No budget: any spend asks you first.', 'gurtos-money-symbolic')
        bar = Gtk.LevelBar(min_value=0, max_value=1, value=min(1, spent / budget) if budget else 0, valign=Gtk.Align.CENTER, width_request=140)
        bar.update_property([Gtk.AccessibleProperty.LABEL], ['Share of the budget spent'])
        r.add_suffix(bar)
        g.add(r)
        if t['state'] == 'failed':
            g.add(row('It could not finish', tl.failure_text(t.get('error')), 'dialog-error-symbolic'))
        out.append(g)

        # Waiting for an OK
        waiting = [a for a in detail.get('approvals', []) if a.get('state') == 'pending']
        if waiting:
            g = group('Needs you')
            for a in waiting:
                g.add(self.approval_row(a, t))
            out.append(g)

        # Changes, with Keep or Undo
        out += self.changes_widgets(t, diff)

        # What it can reach
        reach = tl.reach(detail)
        g = group('What it can reach', 'Set when the task started. Everything else is out of reach.')
        if reach['folders']:
            for f in reach['folders']:
                g.add(row(os.path.basename(f) or f, f'May change, on a copy · {tilde(f)}', 'folder-symbolic'))
        else:
            g.add(row('A space of its own', 'None of your folders', 'folder-symbolic'))
        g.add(row('Internet', ', '.join(reach['hosts']) if reach['hosts'] else 'Off', 'network-wireless-symbolic'))
        if reach['tools']:
            g.add(row('Apps', ', '.join(reach['tools']), 'application-x-addon-symbolic'))
        g.add(row('Runs as its own user, with no sudo', 'It never sees your passwords or the keys GurtOS keeps.', 'system-users-symbolic'))
        out.append(g)

        # Plan and steps, live
        g = group('Steps', 'The plan and every step, as the agent took them.')
        steps = [e for e in detail.get('events', []) if e.get('type') not in ('task.created',)]
        for e in steps[-60:]:
            icon, line = tl.event_text(e, ME)
            r = Adw.ActionRow(title=GLib.markup_escape_text(line or ' '), title_lines=3)
            r.add_prefix(Gtk.Image(icon_name=icon, accessible_role=Gtk.AccessibleRole.PRESENTATION))
            r.add_suffix(label(tl.clock(e.get('at')), 'dim-label', 'numeric', wrap=False, valign=Gtk.Align.CENTER))
            g.add(r)
        if not steps:
            g.add(row('No steps yet', 'They appear here as the agent works.'))
        if t['state'] in ('running', 'queued'):
            sp = Gtk.Spinner(spinning=True)
            sp.update_property([Gtk.AccessibleProperty.LABEL], ['Working'])
            g.set_header_suffix(sp)
        out.append(g)
        tech = group()
        ex = Adw.ExpanderRow(title='Technical details', subtitle='For troubleshooting')
        for k, v in (('Task id', t['id']), ('Linux user', reach['user']), ('Workspace', reach['workspace']), ('Started from', t.get('source')),
                     ('Error', t.get('error'))):
            if v:
                r = Adw.ActionRow(title=k, subtitle=GLib.markup_escape_text(str(v)), subtitle_selectable=True, css_classes=['property'])
                ex.add_row(r)
        tech.add(ex)
        out.append(tech)
        return out

    def changes_widgets(self, t, diff):
        changes = diff.get('changes', [])
        review, folders = t.get('review'), t.get('folders') or ([t['folder']] if t.get('folder') else [])
        if t['state'] == 'undone' or review == 'undone':
            g = group('Changes')
            g.add(row('Undone', 'Its changes are gone. Your folders are as they were.', 'edit-undo-symbolic'))
            return [g]
        if not changes and not folders:
            return []
        where = ', '.join(tilde(f) for f in folders) or 'its workspace'
        if review == 'kept':
            desc = f'These changes are in {where} now.'
        elif review == 'conflict':
            desc = 'You changed some of these files too, so nothing was applied. Your edits are safe.'
        else:
            desc = f'In a copy until you keep them. Nothing outside {where} changed.'
        g = group('Changes', desc)
        if review == 'kept':
            g.set_header_suffix(button('Undo task…', lambda: self.confirm_undo(t)))
        elif t['state'] == 'done' and tl.needs_review(t):
            box = Gtk.Box(spacing=6)
            box.append(button('Undo task…', lambda: self.confirm_undo(t)))  # quieter than Keep: Keep is the usual answer
            box.append(button('Keep changes', lambda: self.keep(t['id']), 'suggested-action'))
            g.set_header_suffix(box)
        for kind, verb, icon in (('modified', 'Changed', 'document-edit-symbolic'), ('added', 'Added', 'list-add-symbolic'), ('deleted', 'Deleted', 'user-trash-symbolic')):
            paths = [c['path'] for c in changes if c['change'] == kind]
            if not paths:
                continue
            r = Adw.ExpanderRow(title=f"{verb} {len(paths)} file{'s' if len(paths) != 1 else ''}", subtitle=GLib.markup_escape_text(', '.join(paths[:3]) + ('…' if len(paths) > 3 else '')))
            r.add_prefix(Gtk.Image(icon_name=icon, accessible_role=Gtk.AccessibleRole.PRESENTATION))
            for path in paths:
                r.add_row(Adw.ActionRow(title=GLib.markup_escape_text(path), css_classes=['monospace']))
            g.add(r)
        if not changes:
            g.add(row('No files changed' if t['state'] == 'done' else 'No changes yet', '', 'document-edit-symbolic'))
        added = [c['path'] for c in changes if c['change'] == 'added']
        if len(added) == 1 and diff.get('diff'):  # one new file: show what it says, not a diff
            lines = tl.added_text(diff['diff'], added[0])
            if lines:
                prev = label('\n'.join(lines[:12]) + ('\n…' if len(lines) > 12 else ''), 'monospace', margin_top=8, margin_bottom=8, margin_start=12, margin_end=12, selectable=True)
                r = Adw.ExpanderRow(title=f'What {os.path.basename(added[0])} says', expanded=True)
                r.add_row(prev)
                g.add(r)
        out = [g]
        if diff.get('diff'):
            text = Gtk.TextView(editable=False, cursor_visible=False, monospace=True, wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=10, bottom_margin=10, left_margin=12, right_margin=12)
            text.update_property([Gtk.AccessibleProperty.LABEL], ['The changes, line by line'])
            dark = Adw.StyleManager.get_default().get_dark()
            buf = text.get_buffer()
            for name, light, dk in (('add', '#2E6B3A', '#7CC48A'), ('del', '#A3322A', '#F08A7D'), ('hunk', '#2A5C99', '#8DB8EE')):
                buf.create_tag(name, foreground=dk if dark else light)
            for line in diff['diff'].splitlines()[:2000]:
                tag = 'hunk' if line.startswith('@@') else 'add' if line[:1] == '+' and not line.startswith('+++') else 'del' if line[:1] == '-' and not line.startswith('---') else None
                (buf.insert_with_tags_by_name(buf.get_end_iter(), line + '\n', tag) if tag else buf.insert(buf.get_end_iter(), line + '\n'))
            d = Adw.ExpanderRow(title='Show changes line by line')
            d.add_prefix(Gtk.Image(icon_name='view-list-symbolic', accessible_role=Gtk.AccessibleRole.PRESENTATION))
            frame = Gtk.ScrolledWindow(child=text, min_content_height=200, max_content_height=480, propagate_natural_height=True)
            d.add_row(frame)
            g.add(d)
        return out

    def confirm_undo(self, t):
        if t.get('review') == 'kept':
            self.confirm('Undo this task?', 'Its changes come out of your folder: files it changed go back to how they were, and files it added '
                         'are removed. Every other task keeps its changes.', 'Undo task', t['id'], 'unkeep')
        else:
            self.confirm('Undo this task?', 'Every change this task made goes away. Your folders stay as they are, and other tasks keep theirs.',
                         'Undo task', t['id'], 'undo')

    def keep(self, task_id):
        def done(out, err):
            if err:
                self.toast(f'Keep did not work: {err}')
            elif out.get('conflicts'):
                d = Adw.MessageDialog(transient_for=self, heading='You changed these files too',
                                      body='GurtOS kept nothing, so none of your edits are lost:\n\n' + '\n'.join(out['conflicts'][:8]))
                d.add_response('close', 'Close')
                d.present()
            else:
                n = len(out.get('kept', []))
                self.toast(f"Kept {n} change{'s' if n != 1 else ''}.")
            self.refresh()
        background(lambda: api('POST', f'/api/tasks/{quote(task_id)}/keep', {}), done)

    def confirm(self, heading, body, verb, task_id, path, then=None):
        d = Adw.MessageDialog(transient_for=self, heading=heading, body=body)
        d.add_response('cancel', 'Cancel')
        d.add_response('go', verb)
        d.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
        d.set_default_response('cancel')

        def answered(_d, response):
            if response != 'go':
                return
            self.take_out([(task_id, path)], then)
        d.connect('response', answered)
        d.present()

    def take_out(self, steps, then=None):
        """Undo or put back one task or several, newest first; stops at the first that cannot go (you edited its files)."""
        def work():
            done = []
            for task_id, path in steps:
                out = api('POST', f'/api/tasks/{quote(task_id)}/{path}', {})
                if isinstance(out, dict) and out.get('conflicts'):
                    return done, (task_id, out['conflicts'])
                done.append(task_id)
            return done, None

        def finished(result, err):
            if err:
                self.toast(f'That did not work: {err}')
            else:
                done, stuck = result
                if stuck:
                    d = Adw.MessageDialog(transient_for=self, heading='You edited these files since',
                                          body=f"GurtOS undid {len(done)} task{'s' if len(done) != 1 else ''} and stopped at {self.titles().get(stuck[0], 'one')}, "
                                               'so your edits are safe:\n\n' + '\n'.join(stuck[1][:8]))
                    d.add_response('close', 'Close')
                    d.present()
                else:
                    self.toast(f"Undid {len(done)} tasks. Every other task kept its changes." if len(done) != 1 else 'Undone. Every other task kept its changes.')
            self.refresh()
            if then:
                then()
        background(work, finished)

    # ----- Activity -----

    def activity_page(self):
        search = Gtk.SearchEntry(placeholder_text='Search the log', hexpand=True)
        search.update_property([Gtk.AccessibleProperty.LABEL], ['Search the log'])
        tasks_dd = Gtk.DropDown.new_from_strings(['All tasks'])
        apps_dd = Gtk.DropDown.new_from_strings(['All apps'])
        tasks_dd.update_property([Gtk.AccessibleProperty.LABEL], ['Show one task'])
        apps_dd.update_property([Gtk.AccessibleProperty.LABEL], ['Show one app'])
        bar = Gtk.Box(spacing=8, margin_top=12, margin_start=12, margin_end=12)
        for w in (search, tasks_dd, apps_dd):
            bar.append(w)
        body = Scroller()
        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        outer.append(Adw.Clamp(maximum_size=860, child=bar))
        outer.append(body)
        p = page('Activity', 'Everything every agent did', outer)
        choices = {'tasks': [None], 'apps': [None]}

        def fill_filters():
            ids = [t['id'] for t in sorted(self.tasks, key=lambda t: t.get('updatedAt', ''), reverse=True)][:60]
            apps = sorted({a for a in (tl.app_of(e) for e in self.events) if a})
            if ids != choices['tasks'][1:]:
                keep = choices['tasks'][tasks_dd.get_selected()] if tasks_dd.get_selected() < len(choices['tasks']) else None
                choices['tasks'] = [None] + ids
                tasks_dd.set_model(Gtk.StringList.new(['All tasks'] + [self.titles()[i][:40] for i in ids]))
                tasks_dd.set_selected(choices['tasks'].index(keep) if keep in choices['tasks'] else 0)
            if apps != choices['apps'][1:]:
                keep = choices['apps'][apps_dd.get_selected()] if apps_dd.get_selected() < len(choices['apps']) else None
                choices['apps'] = [None] + apps
                apps_dd.set_model(Gtk.StringList.new(['All apps'] + apps))
                apps_dd.set_selected(choices['apps'].index(keep) if keep in choices['apps'] else 0)

        def build(*_):
            if self.offline:
                return body.fill(Adw.StatusPage(icon_name='network-offline-symbolic', title="GurtOS isn't answering", description='The action log comes back when GurtOS does.'))
            fill_filters()
            titles = self.titles()
            task = choices['tasks'][tasks_dd.get_selected()] if tasks_dd.get_selected() < len(choices['tasks']) else None
            app = choices['apps'][apps_dd.get_selected()] if apps_dd.get_selected() < len(choices['apps']) else None
            shown = [e for e in reversed(self.events) if tl.matches(e, titles, search.get_text(), task, app)][:200]
            if not shown:
                return body.fill(Adw.StatusPage(icon_name='edit-find-symbolic', title='Nothing matches', description='Try other words, or show all tasks and apps.'))
            g = group(f"{len(shown)} latest" if len(shown) == 200 else f"{len(shown)} event{'s' if len(shown) != 1 else ''}")
            for e in shown:
                icon, line = tl.event_text(e, ME)
                who = titles.get(e.get('task')) or tl.app_title(e, self.apps) or 'GurtOS'
                r = row(line, f"{who} · {tl.clock(e.get('at'))}", icon, activate=(lambda e=e: self.open_task(e['task'])) if e.get('task') in titles else None)
                g.add(r)
            body.fill(g)
        search.connect('search-changed', build)
        tasks_dd.connect('notify::selected', build)
        apps_dd.connect('notify::selected', build)
        self.refreshers['activity'] = build
        build()
        GLib.idle_add(lambda: search.grab_focus() and False)
        return p

    # ----- Time Machine -----

    def timemachine_page(self):
        body = Scroller()
        p = page('Time Machine', 'Undo one task, or every task since a time', body)
        span = Adw.ComboRow(title='Undo every task since', model=Gtk.StringList.new([s for s, _d in tl.SPANS]), selected=1)
        go = button('Undo…', lambda: go_back(), 'destructive-action')
        span.add_suffix(go)

        def go_back():
            plan = tl.go_back_plan(self.tasks, tl.since(tl.SPANS[span.get_selected()][1]))
            if not plan:
                return self.toast('No task finished in that time.')
            d = Adw.MessageDialog(transient_for=self, heading=f"Undo every task since {tl.SPANS[span.get_selected()][0]}?",
                                  body='These tasks are undone, newest first. Everything before stays.\n\n' + '\n'.join(f"• {t['title']}" for t in plan[:12]))
            d.add_response('cancel', 'Cancel')
            d.add_response('go', f"Undo {len(plan)} task{'s' if len(plan) != 1 else ''}")
            d.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
            d.connect('response', lambda _d, r: r == 'go' and self.take_out([(t['id'], tl.can_take_out(t)) for t in plan]))
            d.present()

        def build(*_):
            if self.offline:
                return body.fill(Adw.StatusPage(icon_name='network-offline-symbolic', title="GurtOS isn't answering", description='Your files are unchanged.'))
            plan = tl.go_back_plan(self.tasks, tl.since(tl.SPANS[span.get_selected()][1]))
            span.set_subtitle(f"{len(plan)} task{'s' if len(plan) != 1 else ''} would be undone" if plan else 'No task finished in that time')
            go.set_sensitive(bool(plan))
            g1 = group('Undo by time', 'Every task that finished in that time is undone, newest first. Everything before stays.')
            if span.get_parent():
                span.get_parent().remove(span)
            g1.add(span)
            g2 = group('Undo one task', "Each task's changes are kept apart. Undoing one leaves every other task as it is.")
            done = sorted((t for t in self.tasks if tl.can_take_out(t)), key=lambda t: t.get('updatedAt', ''), reverse=True)
            for t in done[:60]:
                how = tl.can_take_out(t)
                where = ', '.join(tilde(f) for f in (t.get('folders') or [t.get('folder')]) if f) or 'a space of its own'
                r = row(t['title'], f"{'Kept in' if how == 'unkeep' else 'Waiting in a copy of' if t.get('folder') or t.get('folders') else 'In'} {where} · {tl.clock(t.get('updatedAt'))}",
                        'document-save-symbolic' if how == 'unkeep' else 'document-open-recent-symbolic')
                r.add_suffix(button('Undo…', lambda t=t: self.confirm_undo(t)))
                r.set_activatable(False)
                g2.add(r)
            if not done:
                g2.add(row('Nothing to undo', 'Finished tasks appear here.', 'document-open-recent-symbolic'))
            body.fill(g1, g2)
        span.connect('notify::selected', build)
        self.refreshers['timemachine'] = build
        build()
        return p

    # ----- an app's own panel -----

    def app_page(self, name, route=None):
        a = next((x for x in self.apps if x['name'] == name), {'name': name, 'title': name.capitalize(), 'track': name, 'href': '/'})
        url = BOX + (route or f"/t/{a['track']}{a.get('href', '/')}")
        import gi
        gi.require_version('WebKit', '6.0')
        from gi.repository import WebKit
        web = WebKit.WebView(vexpand=True)
        web.update_property([Gtk.AccessibleProperty.LABEL], [a['title']])

        def policy(_w, decision, kind):
            if kind not in (WebKit.PolicyDecisionType.NAVIGATION_ACTION, WebKit.PolicyDecisionType.NEW_WINDOW_ACTION):
                return False
            uri = decision.get_navigation_action().get_request().get_uri()
            mine = uri.startswith(f"{BOX}/t/") or uri.startswith('about:')
            if mine and kind == WebKit.PolicyDecisionType.NAVIGATION_ACTION:
                return False
            decision.ignore()  # the Server screen and other sites never open in here; they go to the browser
            Gtk.UriLauncher(uri=uri).launch(self, None, None)
            return True
        web.connect('decide-policy', policy)
        web.load_uri(url)
        reload = icon_button('view-refresh-symbolic', 'Reload', lambda: web.reload())
        outside = icon_button('web-browser-symbolic', 'Open in your browser', lambda: Gtk.UriLauncher(uri=web.get_uri() or url).launch(self, None, None))
        return page(a['title'], 'App', web, outside, reload)
