# GurtOS Setup for Personal: the owner's first login, after GNOME's own setup. Seven steps, one decision each; the
# step list on the left shows progress (docs/figma/system.md, "Setup"; frames in docs/figma/os-v2/personal/setup-*).
# Every answer goes to the box: settings with PATCH /api/settings, keys with the write-only PUT /api/vault/<NAME>, apps
# with /api/apps/<id>/enable|disable, each step with POST /api/setup/step, then POST /api/setup/finish.
import os
import shutil
import subprocess
import urllib.error
import urllib.request

from gi.repository import Adw, Gdk, Gio, GLib, Gtk

from apptiles import tile
from boxapi import api, background, dollars, tilde

STEPS = [  # (id for /api/setup/step, label in the step list and the header)
    ('welcome', 'Welcome'), ('models', 'AI models'), ('folders', 'Folders'), ('safety', 'Permissions'),
    ('apps', 'Apps'), ('phone', 'Pair a phone'), ('done', 'Done'),
]
SKIPPABLE = {'apps', 'phone'}
THRESHOLDS = [100, 500, 2000, 10000]  # cents: always ask before a single spend over this
BUDGETS = [0, 50, 100, 500, 2000]  # cents: the budget of a task that names none
SAFE = {'approvalThresholdCents': 500, 'defaultBudgetCents': 100}  # Personal's defaults: ask over $5, budget $1
MODEL_KEYS = [  # key name, label, where to get it. One is enough.
    ('ANTHROPIC_API_KEY', 'Anthropic API key', 'From console.anthropic.com, API keys'),
    ('FACTORY_API_KEY', 'Factory API key, instead', 'From app.factory.ai, Settings, API keys'),
]
KEYS_LINE = "GurtOS keeps keys where agents can't read them. You can replace a key but never see it."
# Apps that suit one person on their own computer. The rest (a company's finance desk, team tools, the box's own
# plumbing, developer samples) stay out of Personal's lists.
PERSONAL_APPS = ('find', 'shopper', 'wallet', 'factory', 'fetch', 'mana', 'apify')


def check_key(name, value):
    """One cheap call before a key is saved: 'ok', 'rejected' (the provider said no) or 'unchecked' (no network)."""
    if name != 'ANTHROPIC_API_KEY':
        return 'unchecked'  # shortcut: only Anthropic's key is checked; Factory has no free check call to make
    req = urllib.request.Request('https://api.anthropic.com/v1/models?limit=1', headers={'x-api-key': value, 'anthropic-version': '2023-06-01'})
    try:
        with urllib.request.urlopen(req, timeout=8):
            return 'ok'
    except urllib.error.HTTPError as e:
        return 'rejected' if e.code in (401, 403) else 'unchecked'
    except Exception:  # noqa: BLE001 (offline, DNS, a proxy: the key is saved and the first task tells)
        return 'unchecked'


def key_title(name):
    """A key's human name: ANTHROPIC_API_KEY is "Anthropic API key", CRS_PASSWORD is "CRS password"."""
    named = {'WALLET_SOLANA_KEY': 'Solana wallet key', 'ASI_ONE_API_KEY': 'ASI:One API key', 'AGENTVERSE_API_KEY': 'Agentverse API key',
             'STRIPE_SECRET_KEY': 'Stripe test key', 'SHOPPER_CARD': 'Test card', 'MOSS_PROJECT_ID': 'Moss project', 'MOSS_PROJECT_KEY': 'Moss key'}
    if name in named:
        return named[name]
    keep = {'API', 'CRS', 'URL', 'ID', 'ASI', 'USDC', 'IMAP', 'POP3', 'SMTP'}
    words = [w if w in keep else w.lower() for w in name.split('_')]
    return (' '.join(words)[:1].upper() + ' '.join(words)[1:]).replace('github', 'GitHub').replace('Github', 'GitHub') if words else name
FOLDER_CHOICES = ['May change', 'Not allowed']  # "May read" waits for the core to tell reading from changing


SHOW_TITLES = True  # GurtOS Settings, which reuses these pages, names them in its header bar instead


def page(title, intro):
    """A setup page: a big title and one line, then the step's content, clamped like a preferences page."""
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18, margin_top=36, margin_bottom=36, margin_start=40, margin_end=40)
    if SHOW_TITLES:
        box.append(Gtk.Label(label=title, xalign=0, wrap=True, css_classes=['gurt-title-1']))
    if intro:
        box.append(Gtk.Label(label=intro, xalign=0, wrap=True, css_classes=['gurt-secondary'], margin_bottom=6))
    return Gtk.ScrolledWindow(child=Adw.Clamp(maximum_size=800, child=box), hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True), box


def boxed():
    return Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, css_classes=['boxed-list'])


def row(title, subtitle=None, icon=None):
    r = Adw.ActionRow(title=GLib.markup_escape_text(title), subtitle=GLib.markup_escape_text(subtitle or ''))
    if icon:
        r.add_prefix(Gtk.Image(icon_name=icon))
    return r


def chip(text, icon=None, attention=False):
    b = Gtk.Box(spacing=5, css_classes=['gurt-chip'] + (['gurt-chip-attention'] if attention else []))
    if icon:
        b.append(Gtk.Image(icon_name=icon, pixel_size=12))
    b.append(Gtk.Label(label=text, ellipsize=3, max_width_chars=28))
    return b


def home_folders():
    """The owner's usual folders, as GNOME names them, for the Folders step."""
    found = []
    for d in (GLib.UserDirectory.DIRECTORY_DOCUMENTS, GLib.UserDirectory.DIRECTORY_PICTURES, GLib.UserDirectory.DIRECTORY_DOWNLOAD,
              GLib.UserDirectory.DIRECTORY_DESKTOP):
        p = GLib.get_user_special_dir(d)
        if p and os.path.isdir(p) and p != os.path.expanduser('~') and p not in found:
            found.append(p)
    projects = os.path.expanduser('~/Projects')
    if os.path.isdir(projects):
        found.insert(1, projects)
    return found


class SetupWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title='GurtOS Setup', default_width=1100, default_height=760)
        self.at = 0
        self.settings, self.vault, self.apps, self.boxes, self.taken, self.model = {}, [], [], [], {}, None
        self.folder_draft = None  # {path: 'May change' | 'Not allowed'} until Next saves it

        # The step list.
        steps = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, margin_top=24, margin_bottom=18, margin_start=18, margin_end=18)
        steps.append(Gtk.Label(label='<b>Gurt</b>OS Setup', use_markup=True, xalign=0, css_classes=['gurt-wordmark']))
        who = GLib.get_real_name() if GLib.get_real_name() not in ('', 'Unknown') else GLib.get_user_name()
        steps.append(Gtk.Label(label=f"GurtOS Personal on {who}'s computer", xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary'],
                               margin_bottom=18))
        self.list = Gtk.ListBox(css_classes=['gurt-steps'], selection_mode=Gtk.SelectionMode.NONE)
        self.list.connect('row-activated', lambda _l, r: r.get_index() < self.at and self.go(r.get_index()))
        self.rows = []
        for i, (_id, label) in enumerate(STEPS):
            num = Gtk.Label(label=str(i + 1), css_classes=['gurt-step-num'], valign=Gtk.Align.CENTER)
            line = Gtk.Box(spacing=12)
            line.append(num)
            line.append(Gtk.Label(label=label, xalign=0, css_classes=['gurt-step-label']))
            r = Gtk.ListBoxRow(child=line)
            r.update_property([Gtk.AccessibleProperty.LABEL], [f'Step {i + 1} of {len(STEPS)}: {label}'])
            self.list.append(r)
            self.rows.append((r, num))
        steps.append(self.list)
        steps.append(Gtk.Box(vexpand=True))
        steps.append(Gtk.Label(label='Change any of this later in GurtOS settings.', xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        sidebar = Adw.NavigationPage(title='GurtOS Setup', child=Adw.ToolbarView(content=steps))

        # The current step: header bar, page, footer.
        header = Adw.HeaderBar(show_back_button=False)
        self.counter = Gtk.Label(css_classes=['gurt-caption', 'gurt-secondary'])
        header.pack_start(self.counter)
        self.title = Adw.WindowTitle()
        header.set_title_widget(self.title)
        self.stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, transition_duration=300, vexpand=True)
        footer = Gtk.Box(spacing=12, css_classes=['gurt-footer'])
        self.back = Gtk.Button(label='Back')
        self.back.connect('clicked', lambda _b: self.go(self.at - 1))
        self.summary = Gtk.Label(xalign=0, hexpand=True, wrap=True, css_classes=['gurt-secondary'])
        self.skip = Gtk.Button(label='Skip', css_classes=['flat'])
        self.skip.connect('clicked', lambda _b: self.go(self.at + 1))
        self.next = Gtk.Button(label='Next', css_classes=['suggested-action'])
        self.next.connect('clicked', self.on_next)
        for w in (self.back, self.summary, self.skip, self.next):
            footer.append(w)
        self.toasts = Adw.ToastOverlay(child=self.stack)  # over the page, never over the footer's words
        view = Adw.ToolbarView(content=self.toasts)
        view.add_top_bar(header)
        view.add_bottom_bar(footer)
        self.set_content(Adw.NavigationSplitView(sidebar=sidebar, content=Adw.NavigationPage(title='Setup', child=view),
                                                 min_sidebar_width=260, max_sidebar_width=300))
        self.set_default_widget(self.next)
        self.builders = [self.welcome, self.models, self.folders, self.safety, self.app_list, self.phone, self.done]
        self.present()
        background(lambda: (api('GET', '/api/setup'), api('GET', '/api/settings'), api('GET', '/api/vault'), api('GET', '/api/apps?all=1'),
                            api('GET', '/api/boxes')), self.loaded)

    # ---------- state and moving between steps ----------

    def loaded(self, state, err):
        if err:
            self.stack.add_named(Adw.StatusPage(icon_name='dialog-error-symbolic', title="GurtOS isn't answering",
                                                description=f'{err}. Setup opens again at your next login.'), 'error')
            self.next.set_sensitive(False)
            return
        setup, self.settings, self.vault, self.apps, self.boxes = state
        self.model = setup.get('model') or ({'ready': setup['modelKey']} if 'modelKey' in setup else None)
        self.taken = setup.get('steps', {})
        first_open = next((i for i, (sid, _l) in enumerate(STEPS) if sid not in self.taken and sid != 'done'), len(STEPS) - 1)
        self.go(0 if setup.get('done') else first_open)

    def has_key(self, name):
        return any(v['name'] == name for v in self.vault)

    def go(self, i):
        i = max(0, min(i, len(STEPS) - 1))
        self.at = i
        sid, label = STEPS[i]
        old = self.stack.get_child_by_name(sid)
        if old:
            self.stack.remove(old)
        self.stack.add_named(self.builders[i](), sid)  # rebuilt each time, so it shows what the box has now
        self.stack.set_visible_child_name(sid)
        self.counter.set_label(f'Step {i + 1} of {len(STEPS)}')
        self.title.set_title(label)
        for n, (r, num) in enumerate(self.rows):
            for c in ('gurt-step-done', 'gurt-step-current', 'gurt-step-upcoming'):
                r.remove_css_class(c)
            state = 'current' if n == i else 'done' if n < i or STEPS[n][0] in self.taken else 'upcoming'
            r.add_css_class(f'gurt-step-{state}')
            num.set_label('✓' if state == 'done' else str(n + 1))
        self.back.set_sensitive(i > 0)
        self.skip.set_visible(sid in SKIPPABLE)
        self.next.set_label('Start using GurtOS' if sid == 'done' else 'Next')
        self.next.set_sensitive(True)
        if sid == 'models':
            self.models_footer()

    def on_next(self, _button):
        sid = STEPS[self.at][0]
        if sid == 'models' and self.typed_key():
            name, entry = self.typed_key()
            return self.check_and_save(name, entry, then=lambda: self.on_next(None))
        self.next.set_sensitive(False)
        folders = self.chosen_folders() if sid == 'folders' else None

        def work():
            if folders is not None:
                self.settings = api('PATCH', '/api/settings', {'agentFolders': folders})
            if sid == 'done':
                return api('POST', '/api/setup/finish', {})
            return api('POST', '/api/setup/step', {'id': sid})

        def done(_out, err):
            self.next.set_sensitive(True)
            if err:
                return self.toast(f'GurtOS did not save that: {err}')
            self.taken[sid] = True
            if sid == 'done':
                self.get_application().open_route('')
                return self.close()
            self.go(self.at + 1)
        background(work, done)

    def toast(self, text):
        self.toasts.add_toast(Adw.Toast(title=GLib.markup_escape_text(text), timeout=5))

    def patch(self, change, said=None):
        """A switch or a choice applies at once; the footer says what the box kept."""
        def done(settings, err):
            if err:
                return self.toast(f'Not saved: {err}')
            self.settings = settings
            if said:
                self.summary.set_label(said)
        background(lambda: api('PATCH', '/api/settings', change), done)

    def save_key(self, name, value, done_cb=None, said=None):
        def done(_out, err):
            if err:
                return self.toast(f'{key_title(name)} not saved: {err}')
            self.vault = [v for v in self.vault if v['name'] != name] + [{'name': name}]
            for app in self.apps:  # the apps that needed it now have it
                for k in (app.get('access') or {}).get('secrets', []):
                    if k['name'] == name:
                        k['set'] = True
            self.toast(said or f'{key_title(name)} saved.')
            if done_cb:
                done_cb()
        background(lambda: api('PUT', f'/api/vault/{name}', {'value': value}), done)

    # ---------- the steps ----------

    def welcome(self):
        scroller, box = page('Welcome to GurtOS Personal', 'Agents can work beside you on this computer while you use it. Here is what keeps that safe.')
        lst = boxed()
        for icon, title, sub in (
            ('avatar-default-symbolic', 'Each agent is its own user', 'With no sudo and none of your passwords'),
            ('folder-symbolic', 'They work on copies of folders you pick', 'Nothing reaches your real folder until you keep it'),
            ('document-open-recent-symbolic', 'You can undo any of it', "Each task's changes stay apart from yours, even after you keep them"),
        ):
            lst.append(row(title, sub, icon))
        box.append(lst)
        other = boxed()  # an agent on another computer can do the rest of setup over HTTPS, with a one-time code
        r = row('Set up from another computer', 'Let an agent you already use, like Claude Code, finish this setup for you.', 'computer-symbolic')
        b = Gtk.Button(label='Get a code…', valign=Gtk.Align.CENTER)
        b.connect('clicked', lambda _b: RemoteSetup(self))
        r.add_suffix(b)
        other.append(r)
        box.append(other)
        if not Gio.NetworkMonitor.get_default().get_network_available():  # offline: Claude and apps need the internet
            net = boxed()
            r = row("This computer isn't online", 'Connect to Wi-Fi first. Agents use Claude over the internet.', 'network-wireless-offline-symbolic')
            b = Gtk.Button(label='Choose Wi-Fi…', valign=Gtk.Align.CENTER, css_classes=['suggested-action'])
            b.connect('clicked', lambda _b: subprocess.Popen(['gnome-control-center', 'wifi'], start_new_session=True))
            r.add_suffix(b)
            net.append(r)
            box.append(net)
        self.summary.set_label('About 5 minutes.')
        return scroller

    def model_ready(self):
        # A key saved here counts at once; otherwise the box says (GET /api/setup -> model.ready).
        if any(self.has_key(k) for k, _l, _h in MODEL_KEYS):
            return True
        return bool(isinstance(self.model, dict) and self.model.get('ready'))

    def typed_key(self):
        """The model key typed but not saved yet, as (name, entry row)."""
        return next(((n, e) for n, e in getattr(self, 'key_entries', {}).items() if e.get_text().strip()), None)

    def models_footer(self):
        if SHOW_TITLES and STEPS[self.at][0] == 'models':  # Setup only: Settings has no Next
            empty = not self.typed_key() and not self.model_ready()
            self.next.set_label('Skip for now' if empty else 'Next')
        self.summary.set_label('Key saved. Agents can start.' if self.model_ready() else 'You need a key before an agent can start.')

    def check_and_save(self, name, entry, then=None):
        """Check the key with one cheap call, then save it, or say the provider refused it and keep it out."""
        value = entry.get_text().strip()
        nxt = getattr(self, 'next', None) or Gtk.Button()  # Settings has no Next button
        nxt.set_sensitive(False)
        entry.set_sensitive(False)
        label = 'Anthropic' if name == 'ANTHROPIC_API_KEY' else 'Factory'

        def checked(result, _err):
            nxt.set_sensitive(True)
            entry.set_sensitive(True)
            if result == 'rejected':
                entry.add_css_class('error')
                self.summary.set_label(f"{label} didn't accept this key. Check it and try again.")
                return self.toast(f"{label} didn't accept this key. Check it and try again.")
            entry.remove_css_class('error')
            entry.set_text('')  # write-only: the value leaves the screen as GurtOS stores it

            def saved():
                entry.set_title(f'{dict((k, l) for k, l, _h in MODEL_KEYS)[name]} · saved')
                self.models_footer()
                if then:
                    then()
            self.save_key(name, value, saved, said=f'{label} key saved.' if result == 'ok' else
                          f"{label} key saved. GurtOS couldn't reach {label} to check it, so the first task will.")
        background(lambda: check_key(name, value), checked)

    def models(self):
        scroller, box = page('Connect Claude', "Agents use Claude. Paste an Anthropic API key from console.anthropic.com. " + KEYS_LINE)
        lst = boxed()
        self.key_entries = {}
        for name, label, _hint in MODEL_KEYS:
            entry = Adw.PasswordEntryRow(title=f'{label} · saved' if self.has_key(name) else label, show_apply_button=True)
            entry.connect('apply', lambda e, name=name: self.check_and_save(name, e))
            entry.connect('notify::text', lambda e, _p: (e.remove_css_class('error'), self.models_footer()))  # a cleared field drops the old error (I-6)
            self.key_entries[name] = entry
            lst.append(entry)
        box.append(lst)
        box.append(Gtk.Label(label='One key is enough. Press Enter or the tick to save it.', xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        self.models_footer()
        return scroller

    def chosen_folders(self):
        return [p for p, choice in (self.folder_draft or {}).items() if choice == 'May change']

    def folders(self):
        scroller, box = page('Which folders may agents use?',
                             'Agents can only work in these, and always on a copy. Add more later from any folder in Files: right-click it, then New Agent Task.')
        if self.folder_draft is None:
            allowed = list(self.settings.get('agentFolders') or [])
            first_time = 'folders' not in self.taken and not allowed
            docs = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS)
            self.folder_draft = {p: 'May change' if p in allowed or (first_time and p == docs) else 'Not allowed' for p in home_folders()}
            self.folder_draft.update({p: 'May change' for p in allowed})
        lst = boxed()
        for path, choice in self.folder_draft.items():
            r = Adw.ComboRow(title=GLib.markup_escape_text(os.path.basename(path)), subtitle=GLib.markup_escape_text(tilde(path)),
                             model=Gtk.StringList.new(FOLDER_CHOICES), selected=FOLDER_CHOICES.index(choice))
            r.add_prefix(Gtk.Image(icon_name='folder-symbolic'))
            r.connect('notify::selected', lambda c, _p, p=path: (self.folder_draft.__setitem__(p, FOLDER_CHOICES[c.get_selected()]), self.folder_summary()))
            lst.append(r)
        add = Adw.ActionRow(title='Add a folder…', activatable=True, css_classes=['gurt-add-row'])
        add.add_prefix(Gtk.Image(icon_name='list-add-symbolic'))

        def pick(*_):
            def chosen(d, result):
                try:
                    f = d.select_folder_finish(result)
                except GLib.Error:
                    return
                if f and f.get_path():
                    self.folder_draft[f.get_path()] = 'May change'
                    self.go(self.at)
            Gtk.FileDialog(title='Choose a folder agents may use', modal=True,
                           initial_folder=Gio.File.new_for_path(os.path.expanduser('~'))).select_folder(self, None, chosen)
        add.connect('activated', pick)
        lst.append(add)
        box.append(lst)
        self.folder_summary()
        return scroller

    def folder_summary(self):
        n = len(self.chosen_folders())
        self.summary.set_label('Folders not listed here stay out of reach.' if n else
                               'None chosen: a new task may use any folder in your home that you pick.')

    def safety(self):
        scroller, box = page('What agents may spend', 'And which websites they reach. An agent asks you before it goes past these.')
        if SHOW_TITLES and 'safety' not in self.taken and self.settings.get('approvalThresholdCents', 10000) == 10000 and not self.settings.get('defaultBudgetCents'):
            self.settings.update(SAFE)  # Personal starts careful: ask over $5, budget $1
            self.patch(dict(SAFE))
        s = self.settings
        lst = boxed()
        internet = Adw.ComboRow(title='Internet for new tasks', subtitle='Other sites are blocked and the attempt is logged',
                                model=Gtk.StringList.new(['Off', 'Only listed sites']))
        internet.add_prefix(Gtk.Image(icon_name='web-browser-symbolic'))
        internet.set_selected(1 if s.get('networkDefault') == 'allowlist' else 0)
        hosts = Adw.EntryRow(title='Listed sites, separated by commas', text=', '.join(s.get('defaultHosts') or []), show_apply_button=True)
        hosts.set_visible(internet.get_selected() == 1)
        internet.connect('notify::selected', lambda r, _p: (hosts.set_visible(r.get_selected() == 1),
                                                            self.patch({'networkDefault': 'allowlist' if r.get_selected() else 'none'},
                                                                       'New tasks reach only the sites you list.' if r.get_selected() else 'New tasks have no internet.')))
        hosts.connect('apply', lambda e: self.patch({'defaultHosts': [h.strip() for h in e.get_text().split(',') if h.strip()]}, 'Listed sites saved.'))
        threshold = Adw.ComboRow(title='Always ask before a single spend over', model=Gtk.StringList.new([dollars(c) for c in THRESHOLDS]))
        current = s.get('approvalThresholdCents', 10000)
        threshold.set_selected(min(range(len(THRESHOLDS)), key=lambda k: abs(THRESHOLDS[k] - current)))
        threshold.connect('notify::selected', lambda r, _p: self.patch({'approvalThresholdCents': THRESHOLDS[r.get_selected()]}, 'A spend over the limit always asks.'))
        budget = Adw.ComboRow(title='Budget for a task that names none', model=Gtk.StringList.new(['No budget'] + [dollars(c) for c in BUDGETS[1:]]))
        b = s.get('defaultBudgetCents', 0)
        budget.set_selected(min(range(len(BUDGETS)), key=lambda k: abs(BUDGETS[k] - b)))
        budget.connect('notify::selected', lambda r, _p: self.patch({'defaultBudgetCents': BUDGETS[r.get_selected()]}, 'Default budget saved.'))
        q = s.get('quietHours') or {}
        quiet = Adw.SwitchRow(title=f"Quiet hours, {q.get('from', '22:00')} to {q.get('to', '07:00')}", subtitle='Requests wait without a sound',
                              active=bool(q.get('enabled')))
        quiet.add_prefix(Gtk.Image(icon_name='weather-clear-night-symbolic'))
        quiet.connect('notify::active', lambda r, _p: self.patch({'quietHours': {'enabled': r.get_active()}},
                                                                 'Quiet hours on.' if r.get_active() else 'Quiet hours off.'))
        for r in (internet, hosts, threshold, budget, quiet):
            lst.append(r)
        box.append(lst)
        self.summary.set_label('A spend over the limit always asks.')
        return scroller

    def app_list(self):
        scroller, box = page('Choose apps', 'Find is on. Turn on others when you want them; each says what it needs first.')
        if SHOW_TITLES and 'apps' not in self.taken and not getattr(self, 'apps_reset', False):  # Setup only, never Settings
            self.apps_reset = True  # first time here: everything off but Find, so nothing runs that the owner didn't pick
            for a in self.apps:
                want = a['id'] == 'find'
                if a.get('enabled') != want and a['id'] not in ('spacetime', 'anthropic'):
                    a['enabled'] = want
                    background(lambda a=a, want=want: api('POST', f"/api/apps/{a['id']}/{'enable' if want else 'disable'}", {}), lambda _o, _e: None)
        lst = boxed()
        lst.connect('row-activated', lambda _l, r: getattr(r, 'on_activate', lambda: None)())
        mine = [a for a in self.apps if a['id'] in PERSONAL_APPS]
        for a in sorted(mine, key=lambda a: (a['id'] != 'find', app_title(a))):
            lst.append(self.app_row(a))
        box.append(lst)
        self.count_apps()
        return scroller

    def app_row(self, a):
        access = a.get('access') or {}
        missing = [k['name'] for k in access.get('secrets', []) if not k.get('set') and not k.get('optional')]
        line = Gtk.Box(spacing=16, margin_top=14, margin_bottom=14, margin_start=16, margin_end=16)
        line.append(tile(a['id'], app_title(a), 40))
        text = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3, hexpand=True)
        text.append(Gtk.Label(label=app_title(a), xalign=0, css_classes=['heading']))
        blurb = f"Could not load: {a.get('error', '')}"[:120] if a.get('status') == 'error' else app_blurb(a)
        if blurb:
            text.append(Gtk.Label(label=blurb, xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        chips = Gtk.Box(spacing=6, margin_top=6, halign=Gtk.Align.START)
        shown = []
        if missing:
            shown.append(chip('Needs a key', 'dialog-password-symbolic', attention=bool(a.get('enabled'))))
        if access.get('hosts'):
            shown.append(chip('Uses the internet', 'web-browser-symbolic'))
        for c in shown:
            chips.append(c)
        text.append(chips)
        line.append(text)
        switch = Gtk.Switch(active=bool(a.get('enabled')), valign=Gtk.Align.CENTER)
        switch.update_property([Gtk.AccessibleProperty.LABEL], [f'{app_title(a)} on or off'])
        switch.connect('notify::active', lambda s, _p: self.toggle_app(a, s))
        line.append(switch)
        r = Gtk.ListBoxRow(child=line, activatable=bool(missing))
        if missing:  # an amber key chip: the row opens a sheet to add the keys it still needs
            r.set_tooltip_text(f'Add {", ".join(missing)}')
            r.on_activate = lambda: self.add_keys(a, missing)
        return r

    def add_keys(self, app, names):
        d = Adw.MessageDialog(transient_for=self, heading=f'Keys for {app_title(app)}', body=KEYS_LINE)
        fields = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        entries = {}
        for n in names:
            fields.append(Gtk.Label(label=key_title(n), xalign=0, css_classes=['heading']))
            entries[n] = Gtk.PasswordEntry(show_peek_icon=False)
            fields.append(entries[n])
        d.set_extra_child(fields)
        d.add_response('cancel', 'Cancel')
        d.add_response('save', 'Save keys')
        d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)

        def answered(_d, response):
            if response == 'save':
                for n, e in entries.items():
                    if e.get_text().strip():
                        self.save_key(n, e.get_text().strip(), lambda: self.go(self.at))
        d.connect('response', answered)
        d.present()

    def toggle_app(self, app, switch):
        on = switch.get_active()
        if on == bool(app.get('enabled')):
            return

        def done(out, err):
            if err:
                switch.set_active(not on)
                return self.toast(f"{app_title(app)} did not turn {'on' if on else 'off'}: {err}")
            app.update(out)
            self.count_apps()

        def turn():
            background(lambda: api('POST', f"/api/apps/{app['id']}/{'enable' if on else 'disable'}", {}), done)
        if not on:
            return turn()

        def asked(views, err):  # an app turned on for the first time asks for its permissions, like a phone app
            view = next((v for v in views or [] if v.get('app') == app['id']), None)
            if err or not view or view.get('answered') or not view.get('items'):
                return turn()
            self.ask_permissions(app, view, switch, turn)
        background(lambda: api('GET', '/api/permissions'), asked)

    def ask_permissions(self, app, view, switch, then):
        d = Adw.MessageDialog(transient_for=self, heading=f'{app_title(app)} wants to:',
                              body="Turn off anything you don't want it to do. You can change this later in GurtOS Settings, Permissions.")
        lst = boxed()
        rows = {}
        for item in by_kind(view['items']):
            rows[item['id']] = permission_row(item)
            lst.append(rows[item['id']])
        d.set_extra_child(lst)
        d.add_response('cancel', "Don't turn on")
        d.add_response('on', 'Turn on')
        d.set_response_appearance('on', Adw.ResponseAppearance.SUGGESTED)
        d.set_default_response('on')

        def answered(_d, response):
            if response != 'on':
                return switch.set_active(False)
            deny = [i for i, r in rows.items() if not r.get_active()]

            def saved(_out, err):
                if err:
                    switch.set_active(False)
                    return self.toast(f'{app_title(app)} stayed off: its permissions were not saved. {err}')
                then()
            background(lambda: api('PUT', f"/api/permissions/{app['id']}", {'deny': deny}), saved)
        d.connect('response', answered)
        d.present()

    def count_apps(self):
        on = [a for a in self.apps if a.get('enabled') and a['id'] in PERSONAL_APPS]
        needs = any(not k.get('set') and not k.get('optional') for a in on for k in (a.get('access') or {}).get('secrets', []))
        self.summary.set_label(f"{len(on)} app{'s' if len(on) != 1 else ''} on." + (' Click an app that needs a key to add it.' if needs else ''))

    def phone(self):
        scroller, box = page('Pair a phone (optional)', 'Approvals and running agents can come to your phone when you are away from this computer.')
        self.summary.set_label('You can pair a phone later in GurtOS settings.')
        # The code's link always opens app.gurtos.com. During setup it can reach this computer through the relay from any network;
        # afterwards that needs Reach this computer from anywhere (Settings, Phone), or the same Wi-Fi.
        card = Gtk.Box(spacing=24, css_classes=['card'], margin_top=6)
        steps = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, margin_top=18, margin_bottom=18, margin_start=18, margin_end=18, valign=Gtk.Align.START)
        for n, line in enumerate(("Point your phone's camera at the code.", 'Check that the phone shows the same code.',
                                  'Name it. It can approve and undo, and never holds a key.'), 1):
            steps.append(Gtk.Label(label=f'{n}. {line}', xalign=0, wrap=True))
        card.append(steps)
        box.append(card)

        def show(code, err):
            if err:
                return steps.append(Gtk.Label(label=f'No pairing code: {err}', xalign=0, wrap=True))
            qr = qr_image(code['url']) if code.get('url', '').startswith('http') else None
            if qr:
                card.prepend(qr)
            steps.append(Gtk.Label(label=code['code'], xalign=0, selectable=True, css_classes=['gurt-mono', 'gurt-title-2']))
            remote = getattr(self, 'remote', None) or {}  # Settings reads GET /api/remote; Setup has none
            anywhere = SHOW_TITLES or remote.get('state') == 'connected'  # during setup the phone can turn remote access on itself
            steps.append(Gtk.Label(label="Your phone doesn't need to be on the same Wi-Fi." if anywhere else
                                   'Your phone needs to be on the same Wi-Fi as this computer, unless you turn on Reach this computer from anywhere above.',
                                   xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        background(lambda: api('POST', '/api/pair/start', {'owner': True}), show)
        return scroller

    def done(self):
        scroller, box = page('You are set', 'Here is where GurtOS lives on this computer.')
        cards = Gtk.Box(spacing=12, homogeneous=True)
        for app, title, sub in (
            ('folder', 'New task', 'Open GurtOS, or right-click a folder in Files, and say what to do.'),
            ('tasks', 'The top bar', 'It shows what needs you and what runs.'),
            ('credit-desk', 'Keep or Undo', 'Every finished task waits for your review.'),
            ('time-machine', 'Time Machine', "Undo any task, even after Keep. Your own changes stay."),
        ):
            inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=16, margin_bottom=16, margin_start=16, margin_end=16)
            inner.append(tile(app, title, 36))
            inner.append(Gtk.Label(label=title, xalign=0, css_classes=['heading'], margin_top=6))
            inner.append(Gtk.Label(label=sub, xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
            card = Gtk.Box(css_classes=['card'])
            card.append(inner)
            cards.append(card)
        box.append(cards)
        if getattr(self, 'remote_done', None):  # set up from another computer: say what the agent set
            done = section_list(box, 'Set up from your other computer')
            on = [app_title(a) for a in self.apps if a.get('enabled') and a['id'] in PERSONAL_APPS]
            for title, value, icon in (('Model key', 'Saved' if self.model_ready() else 'Not set yet', 'dialog-password-symbolic'),
                                       ('Apps on', ', '.join(on) or 'None', 'view-app-grid-symbolic'),
                                       ('Phone', 'Paired' if self.remote_done['devices'] else 'Not paired', 'phone-symbolic')):
                r = row(title, None, icon)
                r.add_suffix(Gtk.Label(label=value, css_classes=['gurt-secondary'], ellipsize=3, max_width_chars=40))
                done.append(r)
        self.summary.set_label('' if self.model_ready() else 'Add an Anthropic API key in GurtOS Settings before your first task.')
        return scroller


DAILY = [None, 100, 500, 1000, 2500, 5000]  # money an app may spend a day, in cents; None is no daily limit


def permission_row(item):
    """One app permission as a switch: a key by its human name, the rest in the box's own words."""
    if item.get('kind') == 'key':
        title, sub = key_title(item['id'].split(':', 1)[1]), 'A key it uses through GurtOS. The app never sees it.'
    elif item.get('kind') == 'money':  # the box's own text names the daily limit, which the row under it sets
        title, sub = 'Spend money', 'Each task within its budget'
    else:
        title, sub = item.get('text', item['id']), ('Seen in its tasks' if item.get('seen') else None)
    r = Adw.SwitchRow(title=GLib.markup_escape_text(title), active=bool(item.get('allowed', True)))
    if sub:
        r.set_subtitle(GLib.markup_escape_text(sub))
    return r


def by_kind(items):
    """Money, strangers, commands and sites first; an app's keys, often many, after them."""
    return sorted(items, key=lambda i: i.get('kind') == 'key')


def permission_summary(view):
    off = sum(1 for i in view.get('items', []) if not i.get('allowed', True))
    line = f'{off} turned off' if off else 'Everything allowed'
    if view.get('perDayCents') is not None:
        line += f", up to {dollars(view['perDayCents'])} a day"
    return line


def app_title(a):
    # shortcut: tracks without a window have no title, so the box sends the folder name ("credit-desk"); this reads it
    # as words. Drop once every track names itself.
    t = a.get('title') or a['id']
    return t if t != a['id'] else t.replace('-', ' ').capitalize()


def app_blurb(a):
    # The box falls back to a README's first paragraph, which can be badges or a hackathon note; show nothing then.
    d = (a.get('description') or '').strip()
    if not d or d.startswith(('!', 'Track:', '[')):
        return ''
    return d if len(d) <= 180 else d[:179].rsplit(' ', 1)[0] + '…'


def section_list(box, title):
    box.append(Gtk.Label(label=title, xalign=0, css_classes=['heading'], margin_top=12))
    lst = boxed()
    box.append(lst)
    return lst


class RemoteSetup(Adw.Window):
    """Set up from another computer, in the portal's words (portal/src/setup.tsx, AgentSetup): a one-time code, the
    sentence to give the agent, who is connected, New code and Stop. POST /api/setup/code makes the code; GET
    /api/setup's channel follows who connects and where it answers; POST /api/setup/stop ends it."""

    def __init__(self, parent):
        super().__init__(transient_for=parent, modal=True, title='Set up from another computer', default_width=620, default_height=540)
        self.parent_win = parent
        self.made, self.live, self.timer, self.error = None, None, 0, ''
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin_top=18, margin_bottom=18, margin_start=24, margin_end=24)
        view = Adw.ToolbarView(content=Gtk.ScrolledWindow(child=self.body, hscrollbar_policy=Gtk.PolicyType.NEVER))
        header = Adw.HeaderBar()
        fresh = Gtk.Button(label='New code')  # a code works once, and a failed try uses it up too
        fresh.connect('clicked', lambda _b: self.fresh())
        header.pack_start(fresh)
        self.stop = Gtk.Button(label='Stop')
        self.stop.connect('clicked', lambda _b: self.end())
        header.pack_end(self.stop)
        view.add_top_bar(header)
        self.toasts = Adw.ToastOverlay(child=view)
        self.set_content(self.toasts)
        self.connect('close-request', lambda _w: (self.timer and GLib.source_remove(self.timer), False)[1])
        self.present()
        self.fresh()
        self.timer = GLib.timeout_add_seconds(3, self.follow)

    def fresh(self):
        def done(out, err):
            self.error = str(err) if err else ''
            if not err:
                self.made = out
            self.render()
        background(lambda: api('POST', '/api/setup/code', {}), done)

    def render(self):
        while (c := self.body.get_first_child()) is not None:
            self.body.remove(c)
        self.body.append(Gtk.Label(label='An AI agent on another computer, like Claude Code, can do every step for you. This screen follows along.',
                                   xalign=0, wrap=True, css_classes=['gurt-secondary']))
        ch = dict(self.made or {})
        if self.live:  # the code is ours; who is connected and where it answers are live
            ch.update({k: self.live.get(k) for k in ('urls', 'remote', 'devices')})
        urls, devices = ch.get('urls') or [], ch.get('devices') or []
        url = ch.get('remote') or (urls[0] if urls else None)
        if ch.get('code'):
            expired = bool(ch.get('expiresAt')) and when_passed(ch['expiresAt'])
            self.body.append(Gtk.Label(label=ch['code'], xalign=0, selectable=True, css_classes=['gurt-mono', 'gurt-title-1']))  # exactly as issued
            self.body.append(Gtk.Label(label='This code ran out.' if expired else f"Works once, until {clock_text(ch.get('expiresAt'))}.",
                                       xalign=0, css_classes=['gurt-caption', 'gurt-secondary']))
            if url and not expired:
                self.body.append(Gtk.Label(label='Tell your agent:', xalign=0, css_classes=['heading'], margin_top=6))
                sentence = f"Set up the new GurtOS computer at {url} with code {ch['code']}, by following AGENT-SETUP.md"
                self.body.append(Gtk.Label(label=sentence, xalign=0, wrap=True, selectable=True, css_classes=['card', 'gurt-say']))
                copy = Gtk.Button(label='Copy', halign=Gtk.Align.START)
                copy.connect('clicked', lambda _b: (self.get_clipboard().set(sentence), self.toasts.add_toast(Adw.Toast(title='Copied.'))))
                self.body.append(copy)
                others = urls if ch.get('remote') else urls[1:]
                if others:
                    self.body.append(Gtk.Label(label=f"Also at {', '.join(others)}", xalign=0, wrap=True, selectable=True,
                                               css_classes=['gurt-caption', 'gurt-secondary']))
            self.body.append(Gtk.Label(label=f"Connected: {', '.join(d.get('name') or 'an agent' for d in devices)}" if devices else 'No agent connected yet.',
                                       xalign=0, wrap=True, margin_top=6))
        if self.error:
            self.body.append(Gtk.Label(label=self.error, xalign=0, wrap=True, css_classes=['error']))
        self.stop.set_css_classes(['destructive-action'] if devices else [])

    def follow(self):
        def done(setup, err):
            if err:
                return
            ch = setup.get('channel') or {}
            if not ch.get('open') and self.made and setup.get('done'):
                self.timer = 0
                win = self.parent_win

                def reloaded(state, err):  # show what the agent set, on Done, and let the owner press Start using GurtOS
                    if err:
                        return
                    win.loaded(state[:5], None)
                    win.remote_done = {'devices': state[5]}
                    win.go(len(STEPS) - 1)
                    win.toast('Your other computer finished setup.')
                    self.close()  # its code is used up; Done shows what was set
                background(lambda: (api('GET', '/api/setup'), api('GET', '/api/settings'), api('GET', '/api/vault'), api('GET', '/api/apps?all=1'),
                                    api('GET', '/api/boxes'), api('GET', '/api/devices')), reloaded)
                return
            self.live = ch if ch.get('open') else None
            self.render()
            self.timer = GLib.timeout_add_seconds(3, self.follow)
        self.timer = 0
        background(lambda: api('GET', '/api/setup'), done)
        return False

    def end(self):
        def done(_out, err):
            if err:
                self.error = str(err)
                return self.render()
            if self.timer:
                GLib.source_remove(self.timer)
                self.timer = 0
            self.close()
        background(lambda: api('POST', '/api/setup/stop', {}), done)


def clock_text(iso):
    from datetime import datetime
    try:
        return datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone().strftime('%-I:%M %p')
    except (ValueError, AttributeError):
        return 'it runs out'


def when_passed(iso):
    from datetime import datetime, timezone
    try:
        return datetime.fromisoformat(iso.replace('Z', '+00:00')) < datetime.now(timezone.utc)
    except (ValueError, AttributeError):
        return False


def qr_image(text):
    """A QR code as a picture, drawn by qrencode when it is installed (it is on GurtOS images)."""
    if not shutil.which('qrencode'):
        return None
    png = subprocess.run(['qrencode', '-o', '-', '-s', '6', '-m', '2', text], capture_output=True).stdout
    if not png:
        return None
    pic = Gtk.Picture.new_for_paintable(Gdk.Texture.new_from_bytes(GLib.Bytes.new(png)))
    pic.set_size_request(180, 180)
    pic.add_css_class('gurt-qr')
    return pic
