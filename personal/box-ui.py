#!/usr/bin/python3
# GurtOS Personal on the owner's GNOME desktop: one GTK 4 and libadwaita application (dev.box.Box) with four windows.
#   box-ui.py app [route]        the portal in its own window, e.g. route 'task/<id>' or 'settings'
#   box-ui.py ask [folder]       "Ask an agent": what to do, the folder it may change, a budget
#   box-ui.py review <task id>   a finished task's changes, with Keep and Undo
#   box-ui.py welcome            the first-run welcome, once per user after GNOME's own setup
# A second launch hands its arguments to the running app, so every window lives in one process.
import os
import sys
import threading

import gi

gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Adw, Gdk, Gio, GLib, Gtk  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from boxapi import BOX, api, ask_spec, dollars, needs_review, tilde  # noqa: E402

APP = 'dev.box.Box'
CONFIG = os.path.join(GLib.get_user_config_dir(), 'box')
WELCOMED = os.path.join(CONFIG, 'welcome-done')
CSS = b"""
.change-added { color: @success_color; }
.change-deleted { color: @error_color; }
.change-modified { color: @warning_color; }
"""


def background(work, done):
    """Run work() off the main loop, then done(result, error) on it. Keeps windows responsive if the box is slow."""
    def run():
        try:
            out, err = work(), None
        except Exception as e:  # noqa: BLE001 (shown to the owner as is)
            out, err = None, e
        GLib.idle_add(lambda: done(out, err) and False)
    threading.Thread(target=run, daemon=True).start()


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
        button = Gtk.Button(label='Try Again', halign=Gtk.Align.CENTER, css_classes=['pill', 'suggested-action'])
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


# ---------- Ask an agent ----------

class AskWindow(Adw.ApplicationWindow):
    def __init__(self, app, folders):
        super().__init__(application=app, title='Ask an Agent · GurtOS', default_width=560, default_height=600)
        self.folder = None
        page = Adw.PreferencesPage()

        what = Adw.PreferencesGroup(title='What should it do?')
        self.prompt = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=10, bottom_margin=10, left_margin=12, right_margin=12,
                                   accepts_tab=False)
        self.prompt.update_property([Gtk.AccessibleProperty.LABEL], ['What should it do?'])
        self.prompt.get_buffer().connect('changed', lambda _b: self.validate())
        what.add(Gtk.Frame(child=Gtk.ScrolledWindow(child=self.prompt, min_content_height=110, hscrollbar_policy=Gtk.PolicyType.NEVER),
                           css_classes=['view']))
        page.add(what)

        access = Adw.PreferencesGroup(title='Access', description='It runs as its own user, without sudo, on a copy of this folder. '
                                                                  'Your folder changes only when you choose Keep.')
        self.where = Adw.ActionRow(title='May change', subtitle='Choose a folder')
        self.where.add_prefix(Gtk.Image(icon_name='folder-symbolic'))
        choose = Gtk.Button(label='Choose…', valign=Gtk.Align.CENTER)
        choose.connect('clicked', self.pick)
        self.where.add_suffix(choose)
        access.add(self.where)
        self.budget = Adw.SpinRow(title='Budget in US dollars', subtitle='It stops and asks before spending more. Model use counts.',
                                  digits=2, adjustment=Gtk.Adjustment(value=1, lower=0, upper=500, step_increment=0.5, page_increment=5))
        access.add(self.budget)
        worker = Adw.ActionRow(title='Worker')
        worker.add_suffix(Gtk.Label(label='Droid with Claude', css_classes=['dim-label']))
        access.add(worker)
        page.add(access)

        header, _view, self.toasts = headed(self, 'Ask an Agent', page, 'GurtOS')
        cancel = Gtk.Button(label='Cancel')
        cancel.connect('clicked', lambda _b: self.close())
        header.pack_start(cancel)
        self.start = Gtk.Button(label='Start', css_classes=['suggested-action'])
        self.start.connect('clicked', self.submit)
        header.pack_end(self.start)
        header.set_show_end_title_buttons(False)
        header.set_show_start_title_buttons(False)
        self.set_default_widget(self.start)
        if folders:
            self.set_folder(folders[0])
        self.validate()
        self.present()
        self.prompt.grab_focus()

    def set_folder(self, path):
        if os.path.isdir(path):
            self.folder = os.path.abspath(path)
            self.where.set_subtitle(GLib.markup_escape_text(tilde(self.folder)))
        self.validate()

    def pick(self, _button):
        def chosen(d, result):
            try:
                folder = d.select_folder_finish(result)
            except GLib.Error:
                return  # cancelled
            if folder and folder.get_path():
                self.set_folder(folder.get_path())
        Gtk.FileDialog(title='Choose a Folder', modal=True).select_folder(self, None, chosen)

    def text(self):
        b = self.prompt.get_buffer()
        return b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()

    def validate(self):
        self.start.set_sensitive(bool(self.text()) and bool(self.folder))

    def submit(self, _button):
        spec = ask_spec(self.text(), self.folder, self.budget.get_value())
        self.start.set_sensitive(False)

        def done(task, err):
            if err:
                self.toasts.add_toast(Adw.Toast(title=f'GurtOS did not start it: {err}', timeout=0))
                return self.validate()
            n = Gio.Notification.new(f'An agent is working on {os.path.basename(self.folder)}')
            n.set_body(f"{task['title'].rstrip('.')}. GurtOS tells you when it needs you and when its changes are ready.")
            self.get_application().send_notification(f"started-{task['id']}", n)
            self.close()
        background(lambda: api('POST', '/api/tasks', spec), done)


# ---------- Keep or Undo ----------

class ReviewWindow(Adw.ApplicationWindow):
    def __init__(self, app, task_id):
        super().__init__(application=app, title='Review Changes · GurtOS', default_width=900, default_height=720)
        self.id = task_id
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.header, view, self.toasts = headed(self, 'Review Changes', self.body)
        bar = Gtk.ActionBar()
        self.undo = Gtk.Button(label='Undo', css_classes=['destructive-action'], tooltip_text="Throw away the agent's changes")
        self.undo.connect('clicked', self.confirm_undo)
        self.keep = Gtk.Button(label='Keep', css_classes=['suggested-action'], tooltip_text='Apply the changes to your folder')
        self.keep.connect('clicked', self.do_keep)
        self.unkeep = Gtk.Button(label='Undo Keep', css_classes=['destructive-action'], tooltip_text='Put your files back as they were before Keep')
        self.unkeep.connect('clicked', self.confirm_unkeep)
        bar.pack_end(self.keep)
        bar.pack_end(self.undo)
        bar.pack_end(self.unkeep)
        view.add_bottom_bar(bar)
        self.set_default_widget(self.keep)
        self.load()
        self.present()

    def load(self):
        for b in (self.keep, self.undo, self.unkeep):
            b.set_sensitive(False)
        background(lambda: (api('GET', f'/api/tasks/{self.id}'), api('GET', f'/api/tasks/{self.id}/diff')), self.show)

    def clear(self):
        while child := self.body.get_first_child():
            self.body.remove(child)

    def show(self, result, err):
        self.clear()
        if err:
            self.body.append(Adw.StatusPage(icon_name='dialog-error-symbolic', title='Could Not Load the Changes', description=str(err), vexpand=True))
            return
        detail, diff = result
        t = detail['task']
        review = t.get('review')  # the core's: pending, kept, conflict or undone, for a task on one of your folders
        folder = tilde(t.get('folder') or t['workspace'])
        self.header.set_title_widget(Adw.WindowTitle(title=t['title'], subtitle=folder))
        self.keep.set_visible(needs_review(t))
        self.undo.set_visible(t['state'] != 'undone' and review not in ('kept', 'undone'))
        self.unkeep.set_visible(review == 'kept')
        if t['state'] == 'undone' or review == 'undone':
            return self.body.append(Adw.StatusPage(icon_name='edit-undo-symbolic', title='Undone', description=f'Its changes are gone. {folder} is as it was.', vexpand=True))
        if review == 'kept':
            self.unkeep.set_sensitive(True)
            return self.body.append(Adw.StatusPage(icon_name='emblem-ok-symbolic', title='Kept',
                                                   description=f'Its changes are in {folder}. Undo Keep puts the files back as they were.', vexpand=True))

        changes = diff.get('changes', [])
        counts = {k: sum(c['change'] == k for c in changes) for k in ('modified', 'added', 'deleted')}
        status = {'queued': 'Waiting to start.', 'running': 'Still working. Keep comes when it is done.', 'waiting': 'Waiting for your OK.',
                  'failed': f"It failed: {t.get('error', '')}. Its changes were not applied."}.get(t['state'])
        if review == 'pending':
            status = f'Done. Nothing in {folder} has changed yet. Keep applies these changes; Undo throws them away.'
        elif review == 'conflict':
            status = 'You changed some of the same files while it worked, so nothing was applied. Keep tries again; Undo throws its changes away.'
        facts = ' · '.join([f"{counts['modified']} changed", f"{counts['added']} added", f"{counts['deleted']} deleted",
                            f"cost {dollars(t.get('costCents'))} of {dollars(t.get('budgetCents'))}"])
        top = Adw.PreferencesGroup(title=GLib.markup_escape_text(facts), description=GLib.markup_escape_text(' '.join(x for x in (status, t.get('summary')) if x)),
                                   margin_top=18, margin_start=18, margin_end=18)
        for c in changes:
            row = Adw.ActionRow(title=GLib.markup_escape_text(c['path']))
            row.add_suffix(Gtk.Label(label=c['change'].capitalize(), css_classes=[f"change-{c['change']}", 'caption-heading']))
            top.add(row)
        text = Gtk.TextView(editable=False, cursor_visible=False, monospace=True, wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=12, bottom_margin=12, left_margin=12, right_margin=12)
        text.update_property([Gtk.AccessibleProperty.LABEL], ['The changes, line by line'])
        buf = text.get_buffer()
        for name, color in (('add', '#26a269'), ('del', '#c01c28'), ('hunk', '#1c71d8')):
            buf.create_tag(name, foreground=color)
        for line in (diff.get('diff') or 'No changes.').splitlines():
            tag = 'hunk' if line.startswith('@@') else 'add' if line[:1] == '+' and not line.startswith('+++') else 'del' if line[:1] == '-' and not line.startswith('---') else None
            if tag:
                buf.insert_with_tags_by_name(buf.get_end_iter(), line + '\n', tag)
            else:
                buf.insert(buf.get_end_iter(), line + '\n')
        self.body.append(Gtk.ScrolledWindow(child=top, max_content_height=240, propagate_natural_height=True, hscrollbar_policy=Gtk.PolicyType.NEVER))
        self.body.append(Gtk.Frame(child=Gtk.ScrolledWindow(child=text, vexpand=True), margin_top=12, margin_bottom=18, margin_start=18,
                                   margin_end=18, css_classes=['view'], vexpand=True))
        self.keep.set_sensitive(True)
        self.undo.set_sensitive(True)

    def do_keep(self, _button):
        self.keep.set_sensitive(False)
        self.undo.set_sensitive(False)

        def done(out, err):
            if err:
                self.toasts.add_toast(Adw.Toast(title=f'Keep did not work: {err}', timeout=0))
                return self.load()
            if out.get('conflicts'):
                files = '\n'.join(out['conflicts'][:8])
                d = Adw.MessageDialog(transient_for=self, heading='You Changed These Files Too',
                                      body=f'GurtOS kept nothing, so none of your edits are lost:\n\n{files}\n\n'
                                           'Undo the agent and ask again, or copy your edits somewhere first.')
                d.add_response('close', 'Close')
                d.present()
                return self.load()
            self.toasts.add_toast(Adw.Toast(title=f"Kept {len(out.get('kept', []))} change(s)."))
            self.load()
        background(lambda: api('POST', f'/api/tasks/{self.id}/keep', {}), done)

    def confirm_undo(self, _button):
        d = Adw.MessageDialog(transient_for=self, heading="Undo the Agent's Changes?",
                              body='Every change this task made goes away. Your folder stays as it is, and other tasks keep theirs.')
        d.add_response('cancel', 'Cancel')
        d.add_response('undo', 'Undo')
        d.set_response_appearance('undo', Adw.ResponseAppearance.DESTRUCTIVE)
        d.set_default_response('cancel')

        def answered(_d, response):
            if response != 'undo':
                return
            self.undo.set_sensitive(False)
            self.keep.set_sensitive(False)

            def done(_task, err):
                if err:
                    self.toasts.add_toast(Adw.Toast(title=f'Undo did not work: {err}', timeout=0))
                self.load()
            background(lambda: api('POST', f'/api/tasks/{self.id}/undo', {}), done)
        d.connect('response', answered)
        d.present()


    def confirm_unkeep(self, _button):
        d = Adw.MessageDialog(transient_for=self, heading='Put Your Files Back?',
                              body='The files this task changed go back to how they were before Keep, and files it added are removed.')
        d.add_response('cancel', 'Cancel')
        d.add_response('unkeep', 'Undo Keep')
        d.set_response_appearance('unkeep', Adw.ResponseAppearance.DESTRUCTIVE)
        d.set_default_response('cancel')

        def answered(_d, response):
            if response != 'unkeep':
                return
            self.unkeep.set_sensitive(False)

            def done(out, err):
                if err:
                    self.toasts.add_toast(Adw.Toast(title=f'Undo Keep did not work: {err}', timeout=0))
                elif out.get('conflicts'):
                    c = Adw.MessageDialog(transient_for=self, heading='You Edited These Files Since',
                                          body='GurtOS changed nothing, so your edits are safe:\n\n' + '\n'.join(out['conflicts'][:8]))
                    c.add_response('close', 'Close')
                    c.present()
                self.load()
            background(lambda: api('POST', f'/api/tasks/{self.id}/unkeep', {}), done)
        d.connect('response', answered)
        d.present()


# ---------- first run ----------

class WelcomeWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title='Welcome to GurtOS Personal', default_width=620, default_height=700)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=24, margin_top=12, margin_bottom=36, margin_start=36, margin_end=36)
        status = Adw.StatusPage(icon_name=APP, title='Agents Can Work Beside You',
                                description='GurtOS Personal lets AI agents do jobs on this computer while you use it. Here is what keeps that safe.')
        status.add_css_class('compact')
        box.append(status)
        points = Adw.PreferencesGroup()
        for icon, title, sub in (
            ('system-users-symbolic', 'Each agent is its own user', 'It has no sudo, and it works on a copy of the folder you pick, never your whole home folder.'),
            ('edit-undo-symbolic', 'You see every change, and can undo it', 'When a job is done you keep it or undo it. Right-click a folder in Files and choose Ask an Agent.'),
            ('channel-secure-symbolic', 'Keys stay locked away', 'An agent asks GurtOS to use a key or spend money. It never sees the key, and anything over its budget waits for your OK.'),
        ):
            row = Adw.ActionRow(title=title, subtitle=sub)
            row.add_prefix(Gtk.Image(icon_name=icon, pixel_size=24))
            points.add(row)
        box.append(points)
        buttons = Gtk.Box(spacing=12, halign=Gtk.Align.CENTER)
        pair = Gtk.Button(label='Pair a Phone…', css_classes=['pill'], tooltip_text='Approve from your phone too (optional)')
        pair.connect('clicked', lambda _b: (self.close(), app.open_route('settings')))
        pair.set_visible(False)  # shown once the box has an address a phone can reach

        def reachable(boxes, err):
            pair.set_visible(not err and any(b.get('self') and b.get('url') for b in boxes or []))
        background(lambda: api('GET', '/api/boxes'), reachable)
        start = Gtk.Button(label='Get Started', css_classes=['pill', 'suggested-action'])
        start.connect('clicked', lambda _b: self.close())
        buttons.append(pair)
        buttons.append(start)
        box.append(buttons)
        _header, _view, _toasts = headed(self, '', Gtk.ScrolledWindow(child=box, hscrollbar_policy=Gtk.PolicyType.NEVER))
        self.set_default_widget(start)
        self.connect('close-request', self.seen)
        escape = Gtk.ShortcutController()
        escape.add_shortcut(Gtk.Shortcut(trigger=Gtk.ShortcutTrigger.parse_string('Escape'), action=Gtk.CallbackAction.new(lambda *_: self.close() or True)))
        self.add_controller(escape)
        self.present()

    def seen(self, _window):
        # However it is closed, the welcome has been seen: don't show it at the next login.
        os.makedirs(CONFIG, exist_ok=True)
        open(WELCOMED, 'w').close()
        return False


# ---------- the application ----------

class Box(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP, flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self.app_window = None

    def do_startup(self):
        Adw.Application.do_startup(self)
        css = Gtk.CssProvider()
        css.load_from_data(CSS, -1)
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    def open_route(self, route=''):
        if not self.app_window:
            self.app_window = AppWindow(self)
            self.app_window.connect('destroy', lambda _w: setattr(self, 'app_window', None))
        self.app_window.go(route)

    def welcome_after_setup(self):
        # On a new account GNOME's own setup runs first. Wait until it is done, then say hello.
        setup = os.path.exists('/usr/libexec/gnome-initial-setup')
        done = os.path.join(GLib.get_user_config_dir(), 'gnome-initial-setup-done')
        if not setup or os.path.exists(done):
            return WelcomeWindow(self)
        self.hold()

        def check():
            if not os.path.exists(done):
                return True
            self.release()
            WelcomeWindow(self)
            return False
        GLib.timeout_add_seconds(2, check)

    def do_command_line(self, command_line):
        args = command_line.get_arguments()[1:]
        cmd, rest = (args[0], args[1:]) if args else ('app', [])
        if cmd == 'ask':
            AskWindow(self, rest)
        elif cmd == 'review' and rest:
            ReviewWindow(self, rest[0])
        elif cmd == 'welcome':
            if not os.path.exists(WELCOMED) or '--again' in rest:
                self.welcome_after_setup()
        else:
            self.open_route(rest[0] if rest else '')
        return 0


if __name__ == '__main__':
    GLib.set_prgname(APP)  # the window's class matches dev.box.Box.desktop, so the dock groups it under GurtOS
    sys.exit(Box().run(sys.argv))
