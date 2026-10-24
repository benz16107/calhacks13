# GurtOS Settings: a native libadwaita app (dev.box.Settings) on the box's settings APIs, in the layout of Figma's
# "GurtOS Personal OS" screen 9: a view switcher in the header bar (Agents, Permissions, Apps, Keys, Phone), boxed
# lists, one control per row, About in the window menu. It reuses GurtOS Setup's page builders (models, folders,
# permissions, apps, phone) so the two never disagree; a change here applies at once.
import subprocess

import setupwin
from gi.repository import Adw, Gio, GLib, Gtk

from boxapi import api, background
from setupwin import SetupWindow, boxed, page, row

PAGES = [  # (id, title, icon)
    ('agents', 'Agents', 'applications-science-symbolic'),
    ('permissions', 'Permissions', 'security-medium-symbolic'),
    ('apps', 'Apps', 'view-app-grid-symbolic'),
    ('keys', 'Keys', 'dialog-password-symbolic'),
    ('phone', 'Phone', 'phone-symbolic'),
]
OLD = {'general': 'agents', 'models': 'agents', 'updates': 'agents', 'privacy': 'agents', 'about': 'agents',
       'safety': 'permissions', 'folders': 'permissions', 'devices': 'phone'}  # the earlier sidebar's page names
RETENTION = [30, 90, 365, 3650]
HOURS = [('22:00', '07:00'), ('23:00', '07:00'), ('21:00', '06:00'), ('00:00', '08:00'), ('20:00', '08:00')]


def take(scroller, into):
    """Move a Setup page's content (under its title) into another page's box."""
    inner = scroller.get_child().get_child().get_child()
    while (child := inner.get_first_child()) is not None:
        inner.remove(child)
        into.append(child)


def section(box, title, intro=None):
    """A heading, an optional line under it, and a boxed list for the section's rows."""
    head = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6)
    head.append(Gtk.Label(label=title, xalign=0, css_classes=['heading']))
    if intro:
        head.append(Gtk.Label(label=intro, xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
    box.append(head)
    lst = boxed()
    box.append(lst)
    return lst


class SettingsWindow(SetupWindow):
    """Reuses SetupWindow's step builders; its own window, view switcher and pages."""

    def __init__(self, app, start='agents'):
        Adw.ApplicationWindow.__init__(self, application=app, title='GurtOS Settings', default_width=860, default_height=760)
        setupwin.SHOW_TITLES = False  # the view switcher names the page; Setup's big titles are for setup
        self.settings, self.vault, self.apps, self.boxes, self.taken, self.model = {}, [], [], [], {'folders': True}, None
        self.system, self.devices = {}, []
        self.folder_draft = None
        self.summary = Gtk.Label(visible=False)  # Setup's footer line; Settings speaks through toasts instead
        self.at = OLD.get(start, start)

        self.stack = Adw.ViewStack(vexpand=True)
        self.holders = {}
        for pid, title, icon in PAGES:  # each page keeps its place in the switcher; its content is rebuilt inside
            self.holders[pid] = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.stack.add_titled_with_icon(self.holders[pid], pid, title, icon)
        self.ready = False  # the stack shows its first page on start; ignore that until the box's data is in
        self.stack.connect('notify::visible-child-name', lambda st, _p: self.ready and self.go(st.get_visible_child_name()))
        header = Adw.HeaderBar(title_widget=Adw.ViewSwitcher(stack=self.stack, policy=Adw.ViewSwitcherPolicy.WIDE))
        menu = Gio.Menu()
        menu.append('Run GurtOS Setup again', 'win.setup')
        menu.append('About GurtOS', 'win.about')
        header.pack_end(Gtk.MenuButton(icon_name='open-menu-symbolic', menu_model=menu, tooltip_text='Main menu'))
        for name, fn in (('setup', lambda *_: subprocess.Popen(['/opt/box/personal/box-ui.py', 'setup'], start_new_session=True)),
                         ('about', lambda *_: self.about())):
            act = Gio.SimpleAction.new(name, None)
            act.connect('activate', fn)
            self.add_action(act)
        view = Adw.ToolbarView(content=self.stack)
        view.add_top_bar(header)
        bottom = Adw.ViewSwitcherBar(stack=self.stack)  # the switcher moves to the bottom when the window is narrow
        view.add_bottom_bar(bottom)
        self.toasts = Adw.ToastOverlay(child=view)
        self.set_content(self.toasts)
        self.builders = {'agents': self.agents_page, 'permissions': self.permissions, 'apps': self.app_list,
                         'keys': self.keys, 'phone': self.devices_page}
        self.present()
        self.reload()
        if start == 'about':
            GLib.idle_add(self.about)

    def reload(self, then=None):
        def done(state, err):
            if err:
                holder = self.holders[self.at]
                while (c := holder.get_first_child()) is not None:
                    holder.remove(c)
                return holder.append(Adw.StatusPage(icon_name='dialog-error-symbolic', title="GurtOS isn't answering", description=str(err), vexpand=True))
            setup, self.settings, self.vault, self.apps, self.boxes, self.system, self.devices = state
            self.model = setup.get('model') or ({'ready': setup['modelKey']} if 'modelKey' in setup else None)
            self.ready = True
            self.go(then or self.at)
        background(lambda: (api('GET', '/api/setup'), api('GET', '/api/settings'), api('GET', '/api/vault'), api('GET', '/api/apps?all=1'),
                            api('GET', '/api/boxes'), api('GET', '/api/system'), api('GET', '/api/devices')), done)

    def go(self, pid):
        if isinstance(pid, int):  # Setup's builders call go(self.at) to show a change
            pid = self.at
        pid = OLD.get(pid, pid)
        if pid not in self.builders:
            pid = 'agents'
        self.at = pid
        holder = self.holders[pid]
        while (c := holder.get_first_child()) is not None:
            holder.remove(c)
        holder.append(self.builders[pid]())
        if self.stack.get_visible_child_name() != pid:
            self.stack.set_visible_child_name(pid)

    def folder_summary(self):  # a folder change in Settings applies at once (Setup saves it on Next)
        if self.folder_draft is not None and self.chosen_folders() != list(self.settings.get('agentFolders') or []):
            self.patch({'agentFolders': self.chosen_folders()})
            self.toast('Folders saved.')

    # ---------- the pages ----------

    def agents_page(self):
        """The model key, then updates and the action log."""
        scroller, box = page('Agents', '')
        take(self.models(), box)
        st = self.settings
        lst = section(box, 'Updates', 'GurtOS updates as a whole system and rolls itself back if a new version is not healthy.')
        auto = Adw.SwitchRow(title='Update automatically', subtitle='Installs at night; running tasks resume after the restart', active=bool(st.get('autoUpdate', True)))
        auto.connect('notify::active', lambda r, _p: self.patch({'autoUpdate': r.get_active()}))
        channel = Adw.ComboRow(title='Channel', model=Gtk.StringList.new(['Stable', 'Beta']), selected=1 if st.get('updateChannel') == 'beta' else 0)
        channel.connect('notify::selected', lambda r, _p: self.patch({'updateChannel': 'beta' if r.get_selected() else 'stable'}))
        lst.append(auto)
        lst.append(channel)
        lst = section(box, 'Action log', 'It records everything every agent did. It never holds a key.')
        days = st.get('logRetentionDays', 365)
        keep = Adw.ComboRow(title='Keep the action log for', model=Gtk.StringList.new(['30 days', '90 days', '1 year', '10 years']),
                            selected=min(range(len(RETENTION)), key=lambda i: abs(RETENTION[i] - days)))
        keep.connect('notify::selected', lambda r, _p: self.patch({'logRetentionDays': RETENTION[r.get_selected()]}))
        lst.append(keep)
        return scroller

    def permissions(self):
        """Folders, internet, spending and quiet hours, from Setup's folder and safety steps."""
        scroller, box = page('Permissions', '')
        folders = section(box, 'Folders agents may use', 'Agents work on a copy. Nothing reaches your folder until you keep it.')
        self.move_rows(self.first_list(self.folders()), folders)
        rows = self.first_list(self.safety())
        internet, hosts, threshold, budget, quiet = list(self.listed(rows))
        for r in (internet, hosts, threshold, budget, quiet):
            rows.remove(r)
        for title, group in (('Internet', (internet, hosts)), ('Spending', (threshold, budget))):
            lst = section(box, title)
            for r in group:
                lst.append(r)
        lst = section(box, 'Quiet hours')
        q = self.settings.get('quietHours') or {}
        quiet.set_title('Quiet hours')
        quiet.set_subtitle('Requests wait without a sound. Nothing over the limit is spent.')
        hours = Adw.ComboRow(title='Hours', model=Gtk.StringList.new([f'{f} to {t}' for f, t in HOURS]))
        now = (q.get('from', '22:00'), q.get('to', '07:00'))
        if now not in HOURS:
            HOURS.insert(0, now)
            hours.set_model(Gtk.StringList.new([f'{f} to {t}' for f, t in HOURS]))
        hours.set_selected(HOURS.index(now))
        hours.connect('notify::selected', lambda r, _p: self.patch({'quietHours': {**(self.settings.get('quietHours') or {}),
                                                                                   'from': HOURS[r.get_selected()][0], 'to': HOURS[r.get_selected()][1]}},
                                                                   'Quiet hours saved.'))
        lst.append(quiet)
        lst.append(hours)
        return scroller

    def first_list(self, scroller):
        """The boxed list in a Setup page."""
        return next(c for c in self.listed(scroller.get_child().get_child().get_child()) if isinstance(c, Gtk.ListBox))

    @staticmethod
    def listed(lst):
        r = lst.get_first_child()
        while r:
            nxt = r.get_next_sibling()
            yield r
            r = nxt

    def move_rows(self, src, dst):
        for r in list(self.listed(src)):
            src.remove(r)
            dst.append(r)

    def keys(self):
        scroller, box = page('Keys', 'Keys are write-only. You can set or replace a key. No screen, phone or log ever shows one, '
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
        scroller, box = page('Phone', 'Phones you paired can answer approvals and follow tasks.')
        lst = boxed()
        for dev in self.devices:
            r = row(dev.get('name', 'Phone'), 'Owner' if dev.get('owner') else 'Can approve and undo', 'phone-symbolic')
            b = Gtk.Button(label='Remove', valign=Gtk.Align.CENTER, css_classes=['destructive-action'])
            b.connect('clicked', lambda _b, dev=dev: background(lambda: api('DELETE', f"/api/devices/{dev['id']}"), lambda _o, e: self.reload('phone')))
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

    def about(self):
        s = self.system
        w = Adw.AboutWindow(transient_for=self, application_name='GurtOS', application_icon='dev.box.Box',
                            version=f"{s.get('editionName', 'GurtOS Personal')} {s.get('version', '')}".strip(),
                            license_type=Gtk.License.APACHE_2_0,
                            comments='Based on Ubuntu 24.04 LTS.' + (f" Build {s['build']}." if s.get('build') else ''))
        w.add_credit_section('Built on', ['Ubuntu, by Canonical and the Ubuntu community', 'GNOME, by the GNOME Project'])
        w.add_legal_section('Papirus icon theme', 'By the Papirus Development Team. GurtOS recolours its folders.', Gtk.License.GPL_3_0, None)
        w.add_legal_section('Bibata cursor', 'By Abdulkaiz Khatri.', Gtk.License.GPL_3_0, None)
        w.add_legal_section('Atkinson Hyperlegible Next and Mono', 'By the Braille Institute.', Gtk.License.CUSTOM, 'SIL Open Font License 1.1')
        w.present()
        return False
