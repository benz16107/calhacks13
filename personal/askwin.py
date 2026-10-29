# New task: the owner's words, the folders it may change (GNOME's folder chooser, through the portal),
# its internet and its budget. Opened from the GurtOS app, the dock, the top bar and Files.
import os
import time

from gi.repository import Adw, Gio, GLib, Gtk

from boxapi import api, ask_spec, background, dollars, tilde, ui

DROID_STATE = '/run/box-os/droid'  # on a GurtOS image: state=ready|downloading|offline|retrying, message=<a sentence>, at=


def headed(window, title, content, subtitle=None):
    """A window body with GNOME's header bar, a toast overlay and the content, as libadwaita lays it out."""
    view = Adw.ToolbarView()
    header = Adw.HeaderBar()
    header.set_title_widget(Adw.WindowTitle(title=title, subtitle=subtitle or ''))
    view.add_top_bar(header)
    toasts = Adw.ToastOverlay(child=content)
    view.set_content(toasts)
    window.set_content(view)
    return header, view, toasts


def has_model_key(setup):
    model = setup.get('model') or {}
    return model.get('ready') if 'ready' in model else setup.get('modelKey')


def droid_waits():
    """Why agents can't start yet because Droid is still on its way, in the image's own words, or '' when it is here."""
    try:
        with open(DROID_STATE) as f:
            st = dict(line.rstrip('\n').split('=', 1) for line in f if '=' in line)
        if st.get('state') != 'ready':
            return st.get('message') or 'Agents can start in a minute. GurtOS is still getting ready.'
        return ''
    except OSError:  # an older image writes no state file; a desktop on plain Ubuntu has none either
        return 'Agents can start in a minute. GurtOS is still getting ready.' if os.path.exists('/etc/box-os') and not os.path.exists('/usr/local/bin/droid') else ''


# ---------- New task ----------

ASK_BUDGETS = [50, 100, 500, 2000]  # cents


class AskWindow(Adw.ApplicationWindow):
    """New task, also opened from Files (frame docs/figma/os-v2/personal/ask-an-agent-dialog.png): the task, then one boxed list of
    what it may change, its internet, its budget and its worker. Start stays off until the task is written."""
    MAX_FOLDERS = 10  # the box takes at most 10 folders in one task

    def __init__(self, app, folders, parent=None):
        super().__init__(application=app, title='New task · GurtOS', default_width=620, default_height=640,
                         transient_for=parent, modal=parent is not None)
        self.source = 'app' if parent is not None else 'files'
        self.folders = []
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin_top=18, margin_bottom=18, margin_start=24, margin_end=24)
        body.append(Gtk.Label(label='What should the agent do?', xalign=0, css_classes=['heading']))
        self.prompt = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=10, bottom_margin=10, left_margin=12, right_margin=12, accepts_tab=False)
        self.prompt.update_property([Gtk.AccessibleProperty.LABEL], ['What should the agent do?'])
        self.prompt.get_buffer().connect('changed', lambda _b: self.validate())
        body.append(Gtk.Frame(child=Gtk.ScrolledWindow(child=self.prompt, min_content_height=90, hscrollbar_policy=Gtk.PolicyType.NEVER), css_classes=['view']))

        self.list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, css_classes=['boxed-list'], margin_top=6)
        self.add_row = Adw.ActionRow(title='Add a folder…', activatable=True, css_classes=['gurt-add-row'])
        self.add_row.add_prefix(Gtk.Image(icon_name='list-add-symbolic'))
        self.add_row.connect('activated', self.pick)
        self.list.append(self.add_row)
        self.internet = Adw.SwitchRow(title='Internet', subtitle='Off: the agent reaches no website')
        self.internet.add_prefix(Gtk.Image(icon_name='web-browser-symbolic'))
        self.internet.connect('notify::active', lambda *_: self.internet_changed())
        self.list.append(self.internet)
        self.sites = Adw.EntryRow(title='Sites it may reach, separated by commas', visible=False)
        self.list.append(self.sites)
        self.budget = Adw.ComboRow(title='Budget', subtitle='It asks before spending more. Model use counts.',
                                   model=Gtk.StringList.new([dollars(c) for c in ASK_BUDGETS]), selected=1)
        self.list.append(self.budget)
        worker = Adw.ActionRow(title='Model')
        worker.add_prefix(Gtk.Image(icon_name='applications-science-symbolic'))
        worker.add_suffix(Gtk.Label(label='Claude', css_classes=['gurt-secondary']))
        self.list.append(worker)
        body.append(self.list)
        # Why Start is off, when it is: no model key yet, or Droid still arriving (I-2). Checked before Start, not after.
        self.blocked = None
        self.blocker = Adw.ActionRow()  # its list shows and hides; the row itself stays visible (I-2)
        self.blocker.add_prefix(Gtk.Image(icon_name='dialog-information-symbolic', accessible_role=Gtk.AccessibleRole.PRESENTATION))
        self.open_settings = Gtk.Button(label='Open Settings', valign=Gtk.Align.CENTER)
        self.open_settings.connect('clicked', lambda _b: ui('settings', 'agents'))
        self.blocker.add_suffix(self.open_settings)
        blk = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, css_classes=['boxed-list'])
        blk.append(self.blocker)
        blk.set_visible(False)
        self.blocker_box = blk
        body.prepend(blk)
        self.no_folder = Gtk.Label(label='No folder: the agent works in a space of its own and changes none of your files.',
                                   xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary'])
        body.append(self.no_folder)
        body.append(Gtk.Label(label='The agent works on a copy, as its own user with no sudo. You see the changes and choose Keep or Undo '
                                    'before anything reaches your folder.', xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))

        header, _view, self.toasts = headed(self, 'New task', Gtk.ScrolledWindow(child=body, hscrollbar_policy=Gtk.PolicyType.NEVER))
        cancel = Gtk.Button(label='Cancel')
        cancel.connect('clicked', lambda _b: self.close())
        header.pack_start(cancel)
        self.start = Gtk.Button(label='Start', css_classes=['suggested-action'])
        self.start.connect('clicked', self.submit)
        header.pack_end(self.start)
        header.set_show_end_title_buttons(False)
        header.set_show_start_title_buttons(False)
        self.set_default_widget(self.start)
        for f in folders:
            self.add_folder(f)
        self.validate()
        self.present()
        self.prompt.grab_focus()
        background(lambda: api('GET', '/api/settings'), self.defaults)
        background(lambda: api('GET', '/api/setup'), self.readiness)

    def readiness(self, setup, err):
        if err:  # GurtOS is down or still starting: say so before Start, and look again while the window is open
            self.blocked = ("GurtOS isn't answering. Start works again once it does.", False)
            GLib.timeout_add_seconds(5, lambda: self.get_visible() and background(lambda: api('GET', '/api/setup'), self.readiness) and False)
        elif not has_model_key(setup):
            self.blocked = ('Add a model key in GurtOS Settings first.', True)
        elif droid_waits():  # an image fetches Droid, the agent worker, after first boot
            self.blocked = (droid_waits(), False)
            GLib.timeout_add_seconds(10, lambda: self.get_visible() and background(lambda: api('GET', '/api/setup'), self.readiness) and False)
        else:
            self.blocked = None
        if not err and not getattr(self, 'got_defaults', False):  # back after being down: the budget and sites too
            background(lambda: api('GET', '/api/settings'), self.defaults)
        self.show_blocker()

    def show_blocker(self):
        self.blocker_box.set_visible(bool(self.blocked))
        if self.blocked:
            self.blocker.set_title(GLib.markup_escape_text(self.blocked[0]))
            self.open_settings.set_visible(self.blocked[1])
        self.validate()

    def defaults(self, s, err):
        """What a new task gets from Settings: its internet, and the budget closest to the default."""
        if err or getattr(self, 'got_defaults', False):
            return
        self.got_defaults = True
        hosts = s.get('defaultHosts') or []
        self.sites.set_text(', '.join(hosts))
        self.internet.set_active(bool(s.get('networkDefault') == 'allowlist' and hosts))
        want = s.get('defaultBudgetCents') or 100  # $1.00, the same as Setup's default
        self.budget.set_selected(min(range(len(ASK_BUDGETS)), key=lambda k: abs(ASK_BUDGETS[k] - want)))

    def internet_changed(self):
        on = self.internet.get_active()
        self.sites.set_visible(on)
        self.internet.set_subtitle('Only the sites listed below. Any other is blocked and logged.' if on else 'Off: the agent reaches no website')

    def hosts(self):
        return [h.strip() for h in self.sites.get_text().replace(' ', ',').split(',') if h.strip()] if self.internet.get_active() else []

    def add_folder(self, path):
        path = os.path.abspath(path)
        if not os.path.isdir(path) or path in self.folders or len(self.folders) >= self.MAX_FOLDERS:
            return
        self.folders.append(path)
        row = Adw.ActionRow(title=GLib.markup_escape_text(os.path.basename(path) or path),
                            subtitle=GLib.markup_escape_text(f'May change, on a copy · in {tilde(os.path.dirname(path))}'))
        row.add_prefix(Gtk.Image(icon_name='folder-symbolic'))
        remove = Gtk.Button(icon_name='list-remove-symbolic', tooltip_text=f'Remove {os.path.basename(path)}', valign=Gtk.Align.CENTER, css_classes=['flat'])
        remove.update_property([Gtk.AccessibleProperty.LABEL], [f'Remove {os.path.basename(path)}'])  # an icon alone has no name for Orca

        def drop(_b):
            self.folders.remove(path)
            self.list.remove(row)
            self.validate()
        remove.connect('clicked', drop)
        row.add_suffix(remove)
        self.list.insert(row, len(self.folders) - 1)  # folders first, then "Add a folder…"
        self.validate()

    def pick(self, *_):
        def chosen(d, result):
            try:
                folder = d.select_folder_finish(result)
            except GLib.Error:
                return  # cancelled
            if folder and folder.get_path():
                self.add_folder(folder.get_path())
        Gtk.FileDialog(title='Choose a folder', modal=True).select_folder(self, None, chosen)

    def text(self):
        b = self.prompt.get_buffer()
        return b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()

    def validate(self):
        self.start.set_sensitive(bool(self.text()) and not self.blocked)  # no folder: the agent works in a space of its own
        self.no_folder.set_visible(not self.folders)
        self.add_row.set_visible(len(self.folders) < self.MAX_FOLDERS)

    def submit(self, _button):
        spec = {**ask_spec(self.text(), self.folders, ASK_BUDGETS[self.budget.get_selected()] / 100), 'source': self.source, 'hosts': self.hosts()}
        self.start.set_sensitive(False)

        def done(task, err):
            if err:
                self.toasts.add_toast(Adw.Toast(title=GLib.markup_escape_text(f'GurtOS did not start it: {err}'), timeout=0))
                return self.validate()
            names = [os.path.basename(f) for f in self.folders] or ['a task']
            app = self.get_application()
            app.hold()  # opened from Files there may be no other window; stay up for the notice

            def started(t, _err):  # only once it is really under way; a task that failed at once gets its own notice (I-3)
                app.release()
                if not t or t.get('state') in ('failed', 'undone'):
                    return
                n = Gio.Notification.new(f"An agent is working on {', '.join(names[:2])}" + (f' and {len(names) - 2} more' if len(names) > 2 else ''))
                n.set_body(f"{task['title'].rstrip('.')}. GurtOS tells you when it needs you and when its changes are ready.")
                app.send_notification(f"started-{task['id']}", n)
            background(lambda: (time.sleep(2), api('GET', f"/api/tasks/{task['id']}")['task'])[1], started)
            self.close()
            parent = self.get_transient_for()
            if parent is not None and hasattr(parent, 'open_task'):
                parent.open_task(task['id'])
        background(lambda: api('POST', '/api/tasks', spec), done)
