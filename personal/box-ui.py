#!/usr/bin/python3
# GurtOS Personal on the owner's GNOME desktop: one GTK 4 and libadwaita application (dev.box.Box) with four windows.
#   box-ui.py app [route]        the portal in its own window, e.g. route 'task/<id>' or 'settings'
#   box-ui.py ask [folder ...]   "Ask an Agent": what to do, the folders it may change, a budget
#   box-ui.py review <task id>   a finished task's changes, with Keep and Undo
#   box-ui.py setup [--first-login]   GurtOS Setup; --first-login opens it only for the owner, after GNOME's own setup,
#                                     until setup is done ('welcome' is the old name for it)
# A second launch hands its arguments to the running app, so every window lives in one process.
import os
import sys
from datetime import datetime

import gi

gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Adw, Gdk, Gio, GLib, Gtk  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from boxapi import BOX, api, ask_spec, background, dollars, needs_review, tilde, where  # noqa: E402
from setupwin import SetupWindow  # noqa: E402

APP = 'dev.box.Box'
HERE = os.path.dirname(os.path.realpath(__file__))


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


# ---------- the GurtOS app: the portal in its own window ----------

class AppWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title='GurtOS', default_width=1180, default_height=740)
        gi.require_version('WebKit', '6.0')
        from gi.repository import WebKit
        self.web = WebKit.WebView()
        self.web.connect('load-failed', self.failed)
        self.web.connect('decide-policy', self.policy)
        self.retry = Adw.StatusPage(icon_name=f'{APP}-symbolic', title="GurtOS Isn't Answering",
                                    description=f'Its agent service runs on {BOX}. It may still be starting.')
        button = Gtk.Button(label='Try again', halign=Gtk.Align.CENTER, css_classes=['pill', 'suggested-action'])
        button.connect('clicked', lambda _b: self.go(self.route))
        self.retry.set_child(button)
        self.stack = Gtk.Stack()
        self.stack.add_named(self.web, 'web')
        self.stack.add_named(self.retry, 'retry')
        header, _view, _toasts = headed(self, 'GurtOS', self.stack)
        home = Gtk.Button(icon_name='go-home-symbolic', tooltip_text='Home')
        home.connect('clicked', lambda _b: self.go(''))
        header.pack_start(home)
        self.route = ''

    def go(self, route=''):
        self.route = route
        self.stack.set_visible_child_name('web')
        self.web.load_uri(f'{BOX}/' + (f'#{route}' if route else ''))
        self.present()

    def failed(self, _web, _event, _uri, error):
        from gi.repository import WebKit
        if error.matches(WebKit.NetworkError.quark(), WebKit.NetworkError.CANCELLED):
            return False  # a newer load replaced this one (go() while loading)
        self.stack.set_visible_child_name('retry')
        return True

    def policy(self, _web, decision, kind):
        # The portal's own pages stay in this window; any other site (a track's link, a receipt) opens in the browser.
        from gi.repository import WebKit
        if kind not in (WebKit.PolicyDecisionType.NAVIGATION_ACTION, WebKit.PolicyDecisionType.NEW_WINDOW_ACTION):
            return False
        uri = decision.get_navigation_action().get_request().get_uri()
        ours = uri.startswith(BOX + '/') or uri == BOX or uri.startswith('about:')
        if ours and kind == WebKit.PolicyDecisionType.NAVIGATION_ACTION:
            return False
        decision.ignore()
        if ours:
            self.web.load_uri(uri)  # a target=_blank link to the portal itself
        else:
            Gtk.UriLauncher(uri=uri).launch(self, None, None)
        return True


# ---------- Ask an Agent ----------

ASK_BUDGETS = [50, 100, 500, 2000]  # cents


class AskWindow(Adw.ApplicationWindow):
    """Ask an Agent from Files (frame docs/figma/os-v2/personal/ask-an-agent-dialog.png): the task, then one boxed list of
    what it may change, its internet, its budget and its worker. Start stays off until the task is written."""
    MAX_FOLDERS = 10  # the box takes at most 10 folders in one task

    def __init__(self, app, folders):
        super().__init__(application=app, title='Ask an Agent · GurtOS', default_width=620, default_height=600)
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
        self.internet = Adw.ActionRow(title='Internet')
        self.internet.add_prefix(Gtk.Image(icon_name='web-browser-symbolic'))
        self.internet_value = Gtk.Label(label='Off', css_classes=['gurt-secondary'])
        self.internet.add_suffix(self.internet_value)
        self.list.append(self.internet)
        self.budget = Adw.ComboRow(title='Budget', subtitle='It asks before spending more. Model use counts.',
                                   model=Gtk.StringList.new([dollars(c) for c in ASK_BUDGETS]))
        self.list.append(self.budget)
        worker = Adw.ActionRow(title='Worker')
        worker.add_prefix(Gtk.Image(icon_name='applications-science-symbolic'))
        worker.add_suffix(Gtk.Label(label='Droid with Claude', css_classes=['gurt-secondary']))
        self.list.append(worker)
        body.append(self.list)
        body.append(Gtk.Label(label='The agent works on a copy, as its own user with no sudo. You see the changes and choose Keep or Undo '
                                    'before anything reaches your folder.', xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))

        header, _view, self.toasts = headed(self, 'Ask an Agent', Gtk.ScrolledWindow(child=body, hscrollbar_policy=Gtk.PolicyType.NEVER))
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

    def defaults(self, s, err):
        """What a new task gets from Settings: its internet, and the budget closest to the default."""
        if err:
            return
        hosts = s.get('defaultHosts') or []
        on = s.get('networkDefault') == 'allowlist' and hosts
        self.internet_value.set_label(f"{len(hosts)} listed site{'s' if len(hosts) != 1 else ''}" if on else 'Off')
        self.internet.set_subtitle(GLib.markup_escape_text(', '.join(hosts[:3])) if on else 'Change it in GurtOS settings')
        want = s.get('defaultBudgetCents') or ASK_BUDGETS[0]
        self.budget.set_selected(min(range(len(ASK_BUDGETS)), key=lambda k: abs(ASK_BUDGETS[k] - want)))

    def add_folder(self, path):
        path = os.path.abspath(path)
        if not os.path.isdir(path) or path in self.folders or len(self.folders) >= self.MAX_FOLDERS:
            return
        self.folders.append(path)
        row = Adw.ActionRow(title='May change', subtitle=GLib.markup_escape_text(os.path.basename(path)))
        row.add_prefix(Gtk.Image(icon_name='folder-symbolic'))
        row.add_suffix(Gtk.Label(label=tilde(path), css_classes=['gurt-secondary'], ellipsize=1, max_width_chars=30))
        remove = Gtk.Button(icon_name='list-remove-symbolic', tooltip_text=f'Remove {os.path.basename(path)}', valign=Gtk.Align.CENTER, css_classes=['flat'])

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
        self.start.set_sensitive(bool(self.text()) and bool(self.folders))
        self.add_row.set_visible(len(self.folders) < self.MAX_FOLDERS)

    def submit(self, _button):
        spec = ask_spec(self.text(), self.folders, ASK_BUDGETS[self.budget.get_selected()] / 100)
        self.start.set_sensitive(False)

        def done(task, err):
            if err:
                self.toasts.add_toast(Adw.Toast(title=f'GurtOS did not start it: {err}', timeout=0))
                return self.validate()
            names = [os.path.basename(f) for f in self.folders]
            n = Gio.Notification.new(f"An agent is working on {', '.join(names[:2])}" + (f' and {len(names) - 2} more' if len(names) > 2 else ''))
            n.set_body(f"{task['title'].rstrip('.')}. GurtOS tells you when it needs you and when its changes are ready.")
            self.get_application().send_notification(f"started-{task['id']}", n)
            self.close()
        background(lambda: api('POST', '/api/tasks', spec), done)


# ---------- Keep or Undo ----------

def clock(iso):
    try:
        return datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone().strftime('%H:%M')
    except (ValueError, AttributeError):
        return ''


def minutes(a, b):
    try:
        secs = (datetime.fromisoformat(b.replace('Z', '+00:00')) - datetime.fromisoformat(a.replace('Z', '+00:00'))).total_seconds()
    except (ValueError, AttributeError):
        return ''
    return f'{max(1, round(secs / 60))} min' if secs >= 30 else f'{round(secs)} s'


class ReviewWindow(Adw.ApplicationWindow):
    """A finished task's changes (frame docs/figma/os-v2/personal/review-keep-or-undo.png): what changed on the left, a card
    on the right that asks Keep these changes?, with Keep changes and Undo."""

    def __init__(self, app, task_id):
        super().__init__(application=app, title='Review changes · GurtOS', default_width=1100, default_height=620)
        self.id = task_id
        self.body = Gtk.Box(spacing=24, margin_top=20, margin_bottom=20, margin_start=24, margin_end=24)
        self.header, _view, self.toasts = headed(self, 'Review changes', self.body)
        self.load()
        self.present()

    def load(self):
        background(lambda: (api('GET', f'/api/tasks/{self.id}'), api('GET', f'/api/tasks/{self.id}/diff')), self.show)

    def show(self, result, err):
        while child := self.body.get_first_child():
            self.body.remove(child)
        if err:
            self.body.append(Adw.StatusPage(icon_name='dialog-error-symbolic', title='Could not load the changes', description=str(err), hexpand=True, vexpand=True))
            return
        detail, diff = result
        t = detail['task']
        review = t.get('review')  # the core's: pending, kept, conflict or undone, for a task on your folders
        folder = where(t)
        finished = next((e['at'] for e in reversed(detail.get('events', [])) if e.get('type') == 'task.state' and e.get('state') == 'done'), t.get('updatedAt'))
        facts = ' · '.join(x for x in (f"Finished {clock(finished)}" if t['state'] == 'done' else None,
                                       minutes(t.get('createdAt'), finished) if t['state'] == 'done' else None,
                                       dollars(t.get('costCents'))) if x)
        self.header.set_title_widget(Adw.WindowTitle(title=t['title'], subtitle=facts))
        if t['state'] == 'undone' or review == 'undone':
            self.body.append(Adw.StatusPage(icon_name='edit-undo-symbolic', title='Undone', description=f'Its changes are gone. {folder} is as it was.', hexpand=True, vexpand=True))
            return

        # Left: what changed.
        left = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, hexpand=True)
        strip = Gtk.Box(spacing=10, css_classes=['gurt-success-strip'])
        strip.append(Gtk.Image(icon_name='object-select-symbolic'))
        kept = review == 'kept'
        strip.append(Gtk.Label(label=f'Nothing outside {folder} changed. ' + ('These changes are in your folder now.' if kept else 'These changes are in a copy until you keep them.'),
                               xalign=0, wrap=True, hexpand=True))
        left.append(strip)
        changes = diff.get('changes', [])
        left.append(Gtk.Label(label='What changed', xalign=0, css_classes=['heading'], margin_top=6))
        groups = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, css_classes=['boxed-list'])
        for kind, verb, icon in (('modified', 'Changed', 'document-edit-symbolic'), ('added', 'Added', 'list-add-symbolic'), ('deleted', 'Deleted', 'user-trash-symbolic')):
            paths = [c['path'] for c in changes if c['change'] == kind]
            if not paths:
                continue
            names = ', '.join(paths[:2]) + (f', and {len(paths) - 2} more' if len(paths) > 2 else '')
            row = Adw.ExpanderRow(title=f"{verb} {len(paths)} file{'s' if len(paths) != 1 else ''}", subtitle=GLib.markup_escape_text(names))
            row.add_prefix(Gtk.Image(icon_name=icon))
            row.add_suffix(Gtk.Label(label='New' if kind == 'added' else str(len(paths)), css_classes=[f'change-{kind}']))
            for path in paths:
                row.add_row(Adw.ActionRow(title=GLib.markup_escape_text(path), css_classes=['gurt-mono']))
            groups.append(row)
        if not changes:
            groups.append(Adw.ActionRow(title='No files changed'))
        left.append(groups)
        if diff.get('diff'):
            left.append(Gtk.Label(label='The changes, line by line', xalign=0, css_classes=['heading'], margin_top=6))
            text = Gtk.TextView(editable=False, cursor_visible=False, wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=10, bottom_margin=10,
                                left_margin=12, right_margin=12, css_classes=['gurt-mono'])
            text.update_property([Gtk.AccessibleProperty.LABEL], ['The changes, line by line'])
            buf = text.get_buffer()
            for name, color in (('add', '#2E6B3A'), ('del', '#A3322A'), ('hunk', '#2A5C99')):
                buf.create_tag(name, foreground=color)
            for line in diff['diff'].splitlines():
                tag = 'hunk' if line.startswith('@@') else 'add' if line[:1] == '+' and not line.startswith('+++') else 'del' if line[:1] == '-' and not line.startswith('---') else None
                if tag:
                    buf.insert_with_tags_by_name(buf.get_end_iter(), line + '\n', tag)
                else:
                    buf.insert(buf.get_end_iter(), line + '\n')
            left.append(Gtk.Frame(child=Gtk.ScrolledWindow(child=text, min_content_height=160, vexpand=True), css_classes=['gurt-diff']))
        self.body.append(Gtk.ScrolledWindow(child=left, hexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER))

        # Right: the decision.
        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=['card', 'gurt-side-card'], valign=Gtk.Align.START, width_request=340)
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin_top=18, margin_bottom=18, margin_start=18, margin_end=18)
        card.append(inner)
        status = {'queued': 'Waiting to start.', 'running': 'Still working. You can keep its changes when it is done.',
                  'waiting': 'Waiting for your OK.', 'failed': f"It failed: {t.get('error', '')}. Nothing was applied."}.get(t['state'])
        if kept:
            inner.append(Gtk.Label(label='Kept', xalign=0, css_classes=['gurt-title-3']))
            inner.append(Gtk.Label(label=f'Its changes are in {folder}. Put files back returns them to how they were.', xalign=0, wrap=True, css_classes=['gurt-secondary']))
            self.button(inner, 'Put files back', 'destructive-action', self.confirm_unkeep)
        elif review == 'conflict':
            inner.append(Gtk.Label(label='You changed some of these files too', xalign=0, wrap=True, css_classes=['gurt-title-3']))
            inner.append(Gtk.Label(label='Nothing was applied, so your edits are safe. Keep changes tries again; Undo throws the copy away.', xalign=0, wrap=True, css_classes=['gurt-secondary']))
            self.button(inner, 'Keep changes', 'suggested-action', self.do_keep)
            self.button(inner, 'Undo', 'destructive-action', self.confirm_undo)
        elif needs_review(t):
            inner.append(Gtk.Label(label='Keep these changes?', xalign=0, css_classes=['gurt-title-3']))
            inner.append(Gtk.Label(label='Keep writes them into your real folder. Undo throws the copy away. Either way, the log keeps every step.',
                                   xalign=0, wrap=True, css_classes=['gurt-secondary']))
            self.button(inner, 'Keep changes', 'suggested-action', self.do_keep, default=True)
            self.button(inner, 'Undo', 'destructive-action', self.confirm_undo)
        else:
            inner.append(Gtk.Label(label=status or 'Nothing to decide yet.', xalign=0, wrap=True, css_classes=['gurt-secondary']))
            if t['state'] in ('failed', 'running', 'waiting', 'queued'):
                self.button(inner, 'Undo', 'destructive-action', self.confirm_undo)
        inner.append(Gtk.Label(label=f"Agent: Droid with Claude, as user {t.get('user', '')}", xalign=0, wrap=True, css_classes=['gurt-caption', 'gurt-secondary']))
        self.body.append(card)

    def button(self, box, label, style, handler, default=False):
        b = Gtk.Button(label=label, css_classes=['pill', style])
        b.connect('clicked', handler)
        box.append(b)
        if default:
            self.set_default_widget(b)
        return b

    def do_keep(self, _button):
        self.body.set_sensitive(False)

        def done(out, err):
            self.body.set_sensitive(True)
            if err:
                self.toasts.add_toast(Adw.Toast(title=f'Keep did not work: {err}', timeout=0))
            elif out.get('conflicts'):
                files = '\n'.join(out['conflicts'][:8])
                d = Adw.MessageDialog(transient_for=self, heading='You changed these files too',
                                      body=f'GurtOS kept nothing, so none of your edits are lost:\n\n{files}\n\n'
                                           'Undo the agent and ask again, or copy your edits somewhere first.')
                d.add_response('close', 'Close')
                d.present()
            else:
                n = len(out.get('kept', []))
                self.toasts.add_toast(Adw.Toast(title=f"Kept {n} change{'s' if n != 1 else ''}."))
            self.load()
        background(lambda: api('POST', f'/api/tasks/{self.id}/keep', {}), done)

    def confirm(self, heading, body, verb, path):
        d = Adw.MessageDialog(transient_for=self, heading=heading, body=body)
        d.add_response('cancel', 'Cancel')
        d.add_response('go', verb)
        d.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
        d.set_default_response('cancel')

        def answered(_d, response):
            if response != 'go':
                return
            self.body.set_sensitive(False)

            def done(out, err):
                self.body.set_sensitive(True)
                if err:
                    self.toasts.add_toast(Adw.Toast(title=f'{verb} did not work: {err}', timeout=0))
                elif isinstance(out, dict) and out.get('conflicts'):
                    c = Adw.MessageDialog(transient_for=self, heading='You edited these files since',
                                          body='GurtOS changed nothing, so your edits are safe:\n\n' + '\n'.join(out['conflicts'][:8]))
                    c.add_response('close', 'Close')
                    c.present()
                self.load()
            background(lambda: api('POST', f'/api/tasks/{self.id}/{path}', {}), done)
        d.connect('response', answered)
        d.present()

    def confirm_undo(self, _button):
        self.confirm('Undo this task?', 'Every change this task made goes away. Your folder stays as it is, and other tasks keep theirs.', 'Undo task', 'undo')

    def confirm_unkeep(self, _button):
        self.confirm('Put your files back?', 'The files this task changed go back to how they were before Keep, and files it added are removed.',
                     'Put files back', 'unkeep')


# ---------- the application ----------

class Box(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP, flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self.app_window = None

    def do_startup(self):
        Adw.Application.do_startup(self)
        # The GurtOS system on libadwaita: light tokens always, the dark ones on top while GNOME is dark.
        display = Gdk.Display.get_default()
        light, self.dark_css = Gtk.CssProvider(), Gtk.CssProvider()
        light.load_from_path(os.path.join(HERE, 'gurtos.css'))
        self.dark_css.load_from_path(os.path.join(HERE, 'gurtos-dark.css'))
        Gtk.StyleContext.add_provider_for_display(display, light, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        style = self.get_style_manager()

        def follow(*_):
            if style.get_dark():
                Gtk.StyleContext.add_provider_for_display(display, self.dark_css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1)
            else:
                Gtk.StyleContext.remove_provider_for_display(display, self.dark_css)
        style.connect('notify::dark', follow)
        follow()

    def open_route(self, route=''):
        if not self.app_window:
            self.app_window = AppWindow(self)
            self.app_window.connect('destroy', lambda _w: setattr(self, 'app_window', None))
        self.app_window.go(route)

    def setup_first_login(self):
        """At login: GurtOS Setup for the owner, once GNOME's own setup is done, until the box says setup is done."""
        gnome_setup = os.path.exists('/usr/libexec/gnome-initial-setup')
        gnome_done = os.path.join(GLib.get_user_config_dir(), 'gnome-initial-setup-done')
        me = GLib.get_user_name()
        self.hold()
        tries = [0]

        def check():
            tries[0] += 1
            if gnome_setup and not os.path.exists(gnome_done):
                return True  # GNOME's own setup is still on screen

            def decide(state, err):
                owner, setup = state if not err else (None, None)
                if err or owner is None:
                    # The box learns its owner a moment after GNOME makes the account; keep asking for a minute.
                    if tries[0] < 30:
                        return GLib.timeout_add_seconds(2, check) and None
                elif owner.get('user') == me and not setup.get('done'):
                    SetupWindow(self)
                self.release()
            background(lambda: (api('GET', '/api/owner'), api('GET', '/api/setup')), decide)
            return False
        GLib.timeout_add_seconds(1, check)

    def do_command_line(self, command_line):
        args = command_line.get_arguments()[1:]
        cmd, rest = (args[0], args[1:]) if args else ('app', [])
        if cmd == 'ask':
            AskWindow(self, rest)
        elif cmd == 'review' and rest:
            ReviewWindow(self, rest[0])
        elif cmd in ('setup', 'welcome'):
            if '--first-login' in rest or cmd == 'welcome':
                self.setup_first_login()
            else:
                SetupWindow(self)
        else:
            self.open_route(rest[0] if rest else '')
        return 0


if __name__ == '__main__':
    GLib.set_prgname(APP)  # the window's class matches dev.box.Box.desktop, so the dock groups it under GurtOS
    sys.exit(Box().run(sys.argv))
