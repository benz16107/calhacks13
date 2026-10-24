# GurtOS Settings: a native libadwaita app (dev.box.Settings) on the box's settings APIs, in the layout of Figma's
# "GurtOS Personal OS" screen 9: a view switcher in the header bar (Agents, Permissions, Apps, Keys, Phone), boxed
# lists, one control per row, About in the window menu. It reuses GurtOS Setup's page builders (models, folders,
# permissions, apps, phone) so the two never disagree; a change here applies at once.
import re
import subprocess
import urllib.parse

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


NAME = re.compile(r'^[a-z0-9-]{3,30}$')  # a box's name under box.gurtos.com; the relay may refuse more (reserved names)


def remote_state():
    """GET /api/remote, or None when this box has no remote access API or this user is not the owner: the section hides."""
    try:
        return api('GET', '/api/remote')
    except Exception:  # noqa: BLE001
        return None


def when_saved(iso):
    """'Saved today at 1:44 PM', in this computer's time zone."""
    from datetime import datetime
    try:
        t = datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone()
    except (ValueError, AttributeError):
        return 'Saved'
    now = datetime.now().astimezone()
    day = 'today' if t.date() == now.date() else 'yesterday' if (now.date() - t.date()).days == 1 else t.strftime('%b %-d')
    return f"Saved {day} at {t.strftime('%-I:%M %p')}"


def button_for(label, fn):
    b = Gtk.Button(label=label, valign=Gtk.Align.CENTER)
    b.connect('clicked', lambda _b: fn())
    return b


def update_state():
    """GET /api/update, or None on a box without it: the System update row hides."""
    try:
        out = api('GET', '/api/update')
    except Exception:  # noqa: BLE001
        return None
    return out if isinstance(out, dict) and out.get('state') not in (None, 'unknown') else None


def update_words(u):
    """(title, subtitle) for box-update's state, in plain words."""
    v = u.get('version') or u.get('build') or ''
    name = f'GurtOS {v}'.strip()
    if u.get('state') == 'ready':
        return 'An update is ready', 'It is applied the next time you restart this computer.'
    if u.get('state') == 'trial':
        return f'{name} is starting for the first time', 'GurtOS keeps it once it runs well, and goes back by itself if it does not.'
    if u.get('state') == 'rolledBack':
        return 'The last update did not start properly', f'GurtOS went back to {name}. Nothing of yours changed.'
    if u.get('available'):
        a = u['available']
        return f"GurtOS {a.get('version') or a.get('build')} is available", 'GurtOS installs it as a whole and can go back if it does not start.'
    return f'{name} is up to date', (when_saved(u['checkedAt']).replace('Saved', 'Checked') if u.get('checkedAt') else '')


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
        self.system, self.devices, self.remote, self.update = {}, [], None, None
        self.remote_poll = self.name_check = 0
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
                return holder.append(Adw.StatusPage(icon_name='dialog-error-symbolic', title="GurtOS isn't answering", description=GLib.markup_escape_text(str(err)), vexpand=True))
            setup, self.settings, self.vault, self.apps, self.boxes, self.system, self.devices, self.remote, self.update = state
            self.model = setup.get('model') or ({'ready': setup['modelKey']} if 'modelKey' in setup else None)
            self.ready = True
            self.go(then or self.at)
        background(lambda: (api('GET', '/api/setup'), api('GET', '/api/settings'), api('GET', '/api/vault'), api('GET', '/api/apps?all=1'),
                            api('GET', '/api/boxes'), api('GET', '/api/system'), api('GET', '/api/devices'), remote_state(), update_state()), done)

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
        if self.update:
            title, sub = update_words(self.update)
            r = Adw.ActionRow(title=GLib.markup_escape_text(title), subtitle=GLib.markup_escape_text(sub))
            r.add_prefix(Gtk.Image(icon_name='software-update-available-symbolic' if self.update.get('state') == 'ready' or self.update.get('available')
                                   else 'emblem-ok-symbolic', accessible_role=Gtk.AccessibleRole.PRESENTATION))
            if self.update.get('state') == 'ready':
                r.add_suffix(button_for('Restart…', lambda: subprocess.Popen(['gnome-session-quit', '--reboot'], start_new_session=True)))
            elif 'checkedAt' in self.update:  # the box can look for updates
                r.add_suffix(button_for('Check now', self.check_update))
            lst.append(r)
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

    def check_update(self):
        def done(out, err):
            if err:
                return self.toast(f'GurtOS could not check: {err}')
            self.update = out
            self.toast(update_words(out)[0] + '.')
            self.go('agents')
        background(lambda: api('POST', '/api/update/check', {}), done)

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
        scroller, box = page('Keys', setupwin.KEYS_LINE)
        saved = {v['name']: v for v in self.vault}
        groups = [('Claude', [k for k, _l, _h in setupwin.MODEL_KEYS])]
        for a in sorted((a for a in self.apps if a.get('enabled') and a['id'] in setupwin.PERSONAL_APPS), key=setupwin.app_title):
            names = [k['name'] for k in (a.get('access') or {}).get('secrets', []) if k['name'] not in groups[0][1]]
            if names:
                groups.append((setupwin.app_title(a), names))
        for title, names in groups:
            lst = section(box, title)
            for name in names:
                meta = saved.get(name)
                state = when_saved(meta.get('setAt')) if meta and meta.get('setAt') else ('Saved' if meta else 'Not set')
                r = Adw.ActionRow(title=setupwin.key_title(name), subtitle=GLib.markup_escape_text(f'{state} · {name}'))
                b = Gtk.Button(label='Replace' if meta else 'Add', valign=Gtk.Align.CENTER)
                b.update_property([Gtk.AccessibleProperty.LABEL], [f"{'Replace' if meta else 'Add'} {setupwin.key_title(name)}"])
                b.connect('clicked', lambda _b, n=name: self.key_sheet(n))
                r.add_suffix(b)
                lst.append(r)
        lst = section(box, 'Other')
        add = Adw.ActionRow(title='Add a key…', activatable=True, css_classes=['gurt-add-row'])
        add.add_prefix(Gtk.Image(icon_name='list-add-symbolic'))
        add.connect('activated', lambda _r: self.key_sheet(None))
        lst.append(add)
        return scroller

    def key_sheet(self, name):
        human = setupwin.key_title(name) if name else None
        d = Adw.MessageDialog(transient_for=self, heading=f'Replace {human}' if name and self.has_key(name) else (f'Add {human}' if name else 'Add a key'),
                              body=setupwin.KEYS_LINE)
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
        if self.remote is not None:
            self.remote_section(box)
        pair_scroller = self.phone()  # Setup's pairing step: a QR when the box has an address a phone can reach
        inner = pair_scroller.get_child().get_child().get_child()
        while (child := inner.get_first_child()) is not None:
            inner.remove(child)
            box.append(child)
        return scroller

    # ---------- Reach this computer from anywhere (GET/POST/DELETE /api/remote) ----------

    def remote_section(self, box):
        r = self.remote
        relay = r.get('relay', 'box.gurtos.com')
        lst = section(box, 'Reach this computer from anywhere',
                      'Your computer gets its own secure address. The relay only passes encrypted traffic along and cannot read it. '
                      'Every phone still needs a pairing code.')
        if r.get('enabled') or r.get('state') in ('starting', 'connected', 'error'):
            words = {'starting': 'Starting. Getting a certificate, which takes up to a minute.', 'connected': 'On. Phones you pair can reach it from anywhere.',
                     'error': f"Not connected: {r.get('error') or 'the relay did not answer'}", 'off': 'Off'}
            addr = row(r.get('url') or f"https://{r.get('name')}.{relay}", words.get(r.get('state'), r.get('state', '')), 'network-server-symbolic')
            addr.set_title_selectable(True)
            if r.get('state') == 'starting':
                addr.add_suffix(Gtk.Spinner(spinning=True, valign=Gtk.Align.CENTER))
                self.follow_remote()
            off = Gtk.Button(label='Turn off', valign=Gtk.Align.CENTER, css_classes=['destructive-action'])
            off.connect('clicked', lambda _b: self.remote_off())
            addr.add_suffix(off)
            lst.append(addr)
            return
        entry = Adw.EntryRow(title='Name for this computer')
        entry.add_suffix(Gtk.Label(label=f'.{relay}', css_classes=['gurt-secondary']))
        on = Gtk.Button(label='Turn on', valign=Gtk.Align.CENTER, sensitive=False, css_classes=['suggested-action'])
        entry.add_suffix(on)
        status = row('Choose a name', 'Lowercase letters, digits and hyphens, 3 to 30 characters', 'dialog-information-symbolic')
        lst.append(entry)
        lst.append(status)

        def show(title, sub, ok):
            status.set_title(GLib.markup_escape_text(title))
            status.set_subtitle(GLib.markup_escape_text(sub))
            on.set_sensitive(ok)

        def checked(name, out, err):
            if name != entry.get_text().strip():
                return  # the owner kept typing; a newer check is on its way
            if err:
                return show(f'{name}.{relay}', f"Could not check the name: {err}", False)
            if out.get('available'):
                show(f'https://{name}.{relay}', 'Available', True)
            else:
                show(f'{name}.{relay} is taken', out.get('reason') or 'Try another name', False)

        def changed(_e):
            name = entry.get_text().strip()
            if self.name_check:
                GLib.source_remove(self.name_check)
                self.name_check = 0
            if not NAME.match(name):
                return show('Choose a name', 'Lowercase letters, digits and hyphens, 3 to 30 characters', False)
            show(f'{name}.{relay}', 'Checking…', False)

            def check():
                self.name_check = 0
                background(lambda: api('GET', '/api/remote/name/' + urllib.parse.quote(name, safe='')), lambda out, err: checked(name, out, err))
                return False
            self.name_check = GLib.timeout_add(400, check)  # once typing pauses, not on every key

        def turn_on(*_):
            name = entry.get_text().strip()
            if not on.get_sensitive():
                return
            on.set_sensitive(False)

            def done(out, err):
                if err:
                    return show(f'{name}.{relay}', f'Could not turn it on: {err}', True)
                self.remote = out
                self.go('phone')
            background(lambda: api('POST', '/api/remote', {'name': name}), done)
        entry.connect('changed', changed)
        entry.connect('entry-activated', turn_on)
        on.connect('clicked', turn_on)

    def follow_remote(self):
        """While the address is starting, read its state every 2 seconds until it connects or fails."""
        if self.remote_poll:
            return

        def tick():
            def done(out, _err):
                self.remote_poll = 0
                if out is None:
                    return
                changed = out.get('state') != (self.remote or {}).get('state')
                self.remote = out
                if changed and self.at == 'phone':
                    self.go('phone')
                elif out.get('state') == 'starting':
                    self.follow_remote()
            background(remote_state, done)
            return False
        self.remote_poll = GLib.timeout_add_seconds(2, tick)

    def remote_off(self):
        url = (self.remote or {}).get('url') or 'this address'
        d = Adw.MessageDialog(transient_for=self, heading='Turn off remote access?',
                              body=f'Phones can no longer reach this computer from outside your network, and {url} is given up. '
                                   'Someone else could take the name.')
        d.add_response('cancel', 'Cancel')
        d.add_response('off', 'Turn off')
        d.set_response_appearance('off', Adw.ResponseAppearance.DESTRUCTIVE)

        def answered(_d, response):
            if response != 'off':
                return

            def done(out, err):
                if err:
                    return self.toast(f'Could not turn it off: {err}')
                self.remote = out
                self.go('phone')
                self.toast('Remote access is off.')
            background(lambda: api('DELETE', '/api/remote'), done)
        d.connect('response', answered)
        d.present()

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
