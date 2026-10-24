# GurtOS Settings: a native libadwaita app (dev.box.Settings) on the box's settings APIs, in the layout of
# docs/figma/os-v2/settings/: a sidebar of pages, boxed lists, one control per row. It reuses GurtOS Setup's page
# builders (models, folders, permissions, apps, phone) so the two never disagree; a change here applies at once.
import subprocess

import setupwin
from gi.repository import Adw, GLib, Gtk

from boxapi import api, background
from setupwin import SetupWindow, boxed, page, row

PAGES = [  # (id, title, icon, group break before it)
    ('general', 'General', 'computer-symbolic', False),
    ('models', 'Agents & Models', 'applications-science-symbolic', False),
    ('safety', 'Permissions', 'security-medium-symbolic', True),
    ('folders', 'Folders', 'folder-symbolic', False),
    ('keys', 'Accounts & Keys', 'dialog-password-symbolic', False),
    ('apps', 'Apps', 'view-app-grid-symbolic', False),
    ('devices', 'Devices', 'phone-symbolic', False),
    ('updates', 'Updates', 'software-update-available-symbolic', True),
    ('privacy', 'Privacy & Logs', 'preferences-system-privacy-symbolic', False),
    ('about', 'About', 'help-about-symbolic', True),
]
RETENTION = [30, 90, 365, 3650]


class SettingsWindow(SetupWindow):
    """Reuses SetupWindow's step builders; its own window, sidebar and pages."""

    def __init__(self, app, start='general'):
        Adw.ApplicationWindow.__init__(self, application=app, title='GurtOS Settings', default_width=1000, default_height=700)
        setupwin.SHOW_TITLES = False  # the header bar names the page; Setup's big titles are for setup
        self.settings, self.vault, self.apps, self.boxes, self.taken, self.model = {}, [], [], [], {'folders': True}, None
        self.system, self.devices = {}, []
        self.folder_draft = None
        self.summary = Gtk.Label(visible=False)  # Setup's footer line; Settings speaks through toasts instead
        self.at = start

        self.sidebar = Gtk.ListBox(css_classes=['navigation-sidebar'])
        for pid, title, icon, gap in PAGES:
            line = Gtk.Box(spacing=12, margin_top=8, margin_bottom=8, margin_start=6)
            line.append(Gtk.Image(icon_name=icon))
            line.append(Gtk.Label(label=title, xalign=0))
            r = Gtk.ListBoxRow(child=line)
            r.pid, r.gap = pid, gap
            self.sidebar.append(r)
        self.sidebar.set_header_func(lambda r, _before: r.set_header(Gtk.Separator(margin_top=6, margin_bottom=6, margin_start=12, margin_end=12) if r.gap else None))
        self.ready = False  # the sidebar selects its first row on show; ignore that until the box's data is in
        self.sidebar.connect('row-selected', lambda _l, r: self.ready and r and self.go(r.pid))
        side = Adw.ToolbarView(content=Gtk.ScrolledWindow(child=self.sidebar, hscrollbar_policy=Gtk.PolicyType.NEVER))
        side.add_top_bar(Adw.HeaderBar(title_widget=Adw.WindowTitle(title='Settings'), show_end_title_buttons=False))

        self.title = Adw.WindowTitle()
        header = Adw.HeaderBar(title_widget=self.title)
        self.stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vexpand=True)
        view = Adw.ToolbarView(content=self.stack)
        view.add_top_bar(header)
        self.toasts = Adw.ToastOverlay(child=view)
        self.set_content(Adw.NavigationSplitView(sidebar=Adw.NavigationPage(title='Settings', child=side),
                                                 content=Adw.NavigationPage(title='GurtOS Settings', child=self.toasts),
                                                 min_sidebar_width=240, max_sidebar_width=280))
        self.builders = {'general': self.general, 'models': self.models, 'safety': self.safety, 'folders': self.folders,
                         'keys': self.keys, 'apps': self.app_list, 'devices': self.devices_page, 'updates': self.updates,
                         'privacy': self.privacy, 'about': self.about}
        self.present()
        self.reload()

    def reload(self, then=None):
        def done(state, err):
            if err:
                return self.stack.add_named(Adw.StatusPage(icon_name='dialog-error-symbolic', title="GurtOS isn't answering", description=str(err)), 'error')
            setup, self.settings, self.vault, self.apps, self.boxes, self.system, self.devices = state
            self.model = setup.get('model') or ({'ready': setup['modelKey']} if 'modelKey' in setup else None)
            self.ready = True
            self.go(then or self.at)
        background(lambda: (api('GET', '/api/setup'), api('GET', '/api/settings'), api('GET', '/api/vault'), api('GET', '/api/apps?all=1'),
                            api('GET', '/api/boxes'), api('GET', '/api/system'), api('GET', '/api/devices')), done)

    def go(self, pid):
        if isinstance(pid, int):  # Setup's builders call go(self.at) to show a change
            pid = self.at
        self.at = pid
        old = self.stack.get_child_by_name(pid)
        if old:
            self.stack.remove(old)
        self.stack.add_named(self.builders[pid](), pid)
        self.stack.set_visible_child_name(pid)
        self.title.set_title(next(t for p, t, _i, _g in PAGES if p == pid))
        for r in self._rows():
            if getattr(r, 'pid', None) == pid and self.sidebar.get_selected_row() is not r:
                self.sidebar.select_row(r)

    def _rows(self):
        r = self.sidebar.get_first_child()
        while r:
            yield r
            r = r.get_next_sibling()

    def folder_summary(self):  # a folder change in Settings applies at once (Setup saves it on Next)
        if self.folder_draft is not None and self.chosen_folders() != list(self.settings.get('agentFolders') or []):
            self.patch({'agentFolders': self.chosen_folders()})
            self.toast('Folders saved.')

    # ---------- pages Setup does not have ----------

    def general(self):
        scroller, box = page('General', '')
        s = self.system
        lst = boxed()
        for title, value, icon in (('Name', s.get('boxName') or s.get('hostname', ''), 'computer-symbolic'),
                                   ('Edition', s.get('editionName', 'GurtOS Personal'), None),
                                   ('Time zone', s.get('timezone', ''), 'preferences-system-time-symbolic')):
            r = row(title, None, icon)
            r.add_suffix(Gtk.Label(label=value, css_classes=['gurt-secondary']))
            lst.append(r)
        box.append(Gtk.Label(label='This computer', xalign=0, css_classes=['heading']))
        box.append(lst)
        net = boxed()
        for i in (s.get('network') or {}).get('interfaces', []):
            r = row(i.get('name', ''), i.get('address', ''), 'network-wired-symbolic')
            r.add_suffix(Gtk.Label(label='Connected', css_classes=['success']))
            net.append(r)
        box.append(Gtk.Label(label='Network', xalign=0, css_classes=['heading'], margin_top=12))
        box.append(net)
        again = row('Run setup again', 'Opens GurtOS Setup', 'emblem-system-symbolic')
        b = Gtk.Button(label='Run setup', valign=Gtk.Align.CENTER)
        b.connect('clicked', lambda _b: subprocess.Popen(['/opt/box/personal/box-ui.py', 'setup'], start_new_session=True))
        again.add_suffix(b)
        sl = boxed()
        sl.append(again)
        box.append(Gtk.Label(label='Setup', xalign=0, css_classes=['heading'], margin_top=12))
        box.append(sl)
        return scroller

    def keys(self):
        scroller, box = page('Accounts & Keys', 'Keys are write-only. You can set or replace a key. No screen, phone or log ever shows one, '
                                                'and agents never see them.')
        needed = {}
        for a in self.apps:
            for k in (a.get('access') or {}).get('secrets', []):
                needed.setdefault(k['name'], setupwin.app_title(a))
        names = sorted({v['name'] for v in self.vault} | set(needed) | {'ANTHROPIC_API_KEY', 'FACTORY_API_KEY'})
        lst = boxed()
        for name in names:
            meta = next((v for v in self.vault if v['name'] == name), None)
            who = 'Droid with Claude' if name in ('ANTHROPIC_API_KEY', 'FACTORY_API_KEY') else needed.get(name, 'Added by hand')
            state = ('set ' + meta['setAt'][:16].replace('T', ' ')) if meta and meta.get('setAt') else ('put there by hand' if meta else 'not set')
            r = Adw.ActionRow(title=name, subtitle=f'{who} · {state}', title_lines=1, css_classes=['gurt-mono-title'])
            b = Gtk.Button(label='Replace' if meta else 'Set key', valign=Gtk.Align.CENTER)
            b.connect('clicked', lambda _b, n=name: self.key_sheet(n))
            r.add_suffix(b)
            lst.append(r)
        add = Adw.ActionRow(title='Add a key…', activatable=True, css_classes=['gurt-add-row'])
        add.add_prefix(Gtk.Image(icon_name='list-add-symbolic'))
        add.connect('activated', lambda _r: self.key_sheet(None))
        lst.append(add)
        box.append(Gtk.Label(label='Keys in the vault', xalign=0, css_classes=['heading']))
        box.append(lst)
        return scroller

    def key_sheet(self, name):
        d = Adw.MessageDialog(transient_for=self, heading=f'Replace {name}' if name and self.has_key(name) else (f'Set {name}' if name else 'Add a key'),
                              body='Write-only: you can replace a key, never read it. Agents never see it.')
        fields = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        name_entry = Gtk.Entry(placeholder_text='NAME_LIKE_THIS', css_classes=['gurt-mono'])
        if not name:
            fields.append(name_entry)
        value = Gtk.PasswordEntry(show_peek_icon=False, placeholder_text='The key')
        fields.append(value)
        d.set_extra_child(fields)
        d.add_response('cancel', 'Cancel')
        d.add_response('save', 'Save key')
        d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)

        def answered(_d, response):
            n = name or name_entry.get_text().strip().upper()
            if response == 'save' and n and value.get_text().strip():
                self.save_key(n, value.get_text().strip(), lambda: self.reload('keys'))
        d.connect('response', answered)
        d.present()

    def devices_page(self):
        scroller, box = page('Devices', 'Phones you paired can answer approvals and follow tasks.')
        lst = boxed()
        for dev in self.devices:
            r = row(dev.get('name', 'Phone'), 'Owner' if dev.get('owner') else 'Can approve and undo', 'phone-symbolic')
            b = Gtk.Button(label='Remove', valign=Gtk.Align.CENTER, css_classes=['destructive-action'])
            b.connect('clicked', lambda _b, dev=dev: background(lambda: api('DELETE', f"/api/devices/{dev['id']}"), lambda _o, e: self.reload('devices')))
            r.add_suffix(b)
            lst.append(r)
        if not self.devices:
            lst.append(row('No phones yet', None, 'phone-symbolic'))
        box.append(lst)
        pair_scroller = self.phone()  # Setup's pairing step: a QR when the box has an address a phone can reach
        inner = pair_scroller.get_child().get_child().get_child()
        while (child := inner.get_first_child()) is not None:
            inner.remove(child)
            box.append(child)
        return scroller

    def updates(self):
        scroller, box = page('Updates', 'GurtOS updates as a whole system and rolls itself back if a new version is not healthy.')
        s = self.settings
        lst = boxed()
        auto = Adw.SwitchRow(title='Update automatically', subtitle='Installs at night; running tasks resume after the restart', active=bool(s.get('autoUpdate', True)))
        auto.connect('notify::active', lambda r, _p: self.patch({'autoUpdate': r.get_active()}))
        channel = Adw.ComboRow(title='Channel', model=Gtk.StringList.new(['Stable', 'Beta']), selected=1 if s.get('updateChannel') == 'beta' else 0)
        channel.connect('notify::selected', lambda r, _p: self.patch({'updateChannel': 'beta' if r.get_selected() else 'stable'}))
        lst.append(auto)
        lst.append(channel)
        box.append(lst)
        return scroller

    def privacy(self):
        scroller, box = page('Privacy & Logs', 'The action log records everything every agent did. It never holds a key.')
        days = self.settings.get('logRetentionDays', 365)
        keep = Adw.ComboRow(title='Keep the action log for', model=Gtk.StringList.new(['30 days', '90 days', '1 year', '10 years']),
                            selected=min(range(len(RETENTION)), key=lambda i: abs(RETENTION[i] - days)))
        keep.connect('notify::selected', lambda r, _p: self.patch({'logRetentionDays': RETENTION[r.get_selected()]}))
        lst = boxed()
        lst.append(keep)
        box.append(lst)
        return scroller

    def about(self):
        scroller, box = page('About', '')
        s = self.system
        lst = boxed()
        for title, value in (('GurtOS', f"{s.get('editionName', 'GurtOS Personal')} {s.get('version', '')}".strip()),
                             ('Build', s.get('build', '')), ('Based on', 'Ubuntu 24.04 LTS'), ('Owner', (s.get('owner') or ''))):
            r = row(title)
            r.add_suffix(Gtk.Label(label=value, selectable=True, css_classes=['gurt-secondary']))
            lst.append(r)
        box.append(lst)
        credits = boxed()
        for title, sub in (('Ubuntu', 'The base system, by Canonical and the Ubuntu community'),
                           ('GNOME', 'The desktop, apps and symbolic icons, by the GNOME Project'),
                           ('Atkinson Hyperlegible Next and Mono', 'Typeface by the Braille Institute, SIL Open Font License')):
            credits.append(row(title, sub))
        box.append(Gtk.Label(label='Credits', xalign=0, css_classes=['heading'], margin_top=12))
        box.append(credits)
        box.append(Gtk.Label(label='GurtOS is open source under the Apache License 2.0.', xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        return scroller
