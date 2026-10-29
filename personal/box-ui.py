#!/usr/bin/python3
# GurtOS Personal on the owner's GNOME desktop: one GTK 4 and libadwaita application (dev.box.Box) with four windows.
#   box-ui.py app [route]        the GurtOS app, native (agentsapp.py): route '', tasks, task/<id>, new, activity, timemachine,
#                                or an app's own path such as /t/find/?q=…
#   box-ui.py settings [page]    GurtOS Settings, its own app (dev.box.Settings)
#   box-ui.py ask [folder ...]   New task ("Ask an Agent" in Files): what to do, the folders it may change, a budget
#   box-ui.py review <task id>   a task's page in the GurtOS app, with its changes and Keep or Undo
#   box-ui.py setup [--first-login]   GurtOS Setup; --first-login opens it only for the owner, after GNOME's own setup,
#                                     until setup is done ('welcome' is the old name for it)
# A second launch hands its arguments to the running app, so every window lives in one process.
import os
import sys

import gi

gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Adw, Gdk, Gio, GLib, Gtk  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import tasklogic  # noqa: E402
from agentsapp import AgentsWindow  # noqa: E402
from askwin import AskWindow  # noqa: E402
from boxapi import api, background  # noqa: E402
from setupwin import SetupWindow  # noqa: E402
from settingswin import SettingsWindow  # noqa: E402

APP = 'dev.box.Box'
HERE = os.path.dirname(os.path.realpath(__file__))


# ---------- the application ----------

class Box(Adw.Application):
    def __init__(self, app_id=APP):
        super().__init__(application_id=app_id, flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self.app_window = None

    def do_startup(self):
        Adw.Application.do_startup(self)
        source = Gio.SettingsSchemaSource.get_default()
        if source and source.lookup('org.gnome.desktop.interface', True):  # times read like the top bar's clock
            tasklogic.TWELVE = Gio.Settings(schema_id='org.gnome.desktop.interface').get_string('clock-format') == '12h'
        # The GurtOS system on libadwaita: light tokens always, the dark ones on top while GNOME is dark.
        display = Gdk.Display.get_default()
        # gurtos.css styles GurtOS's own widgets; Figma's libadwaita files (theme/colors) set the named colours.
        light, self.dark_css = Gtk.CssProvider(), Gtk.CssProvider()
        colors = os.path.join(HERE, 'theme', 'colors')
        light.load_from_data((open(os.path.join(HERE, 'gurtos.css')).read() + open(os.path.join(colors, 'libadwaita-light.css')).read()).encode(), -1)
        self.dark_css.load_from_data((open(os.path.join(HERE, 'gurtos-dark.css')).read() + open(os.path.join(colors, 'libadwaita-dark.css')).read()).encode(), -1)
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
            self.app_window = AgentsWindow(self)
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
            if gnome_setup and not os.path.exists(gnome_done):
                return True  # GNOME's own setup is still on screen; that wait is not one of the tries below
            tries[0] += 1

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
            self.open_route(f'task/{rest[0]}')
        elif cmd == 'settings':
            SettingsWindow(self, rest[0] if rest else 'general')
        elif cmd in ('setup', 'welcome'):
            if '--first-login' in rest or cmd == 'welcome':
                self.setup_first_login()
            else:
                SetupWindow(self)
        else:
            self.open_route(rest[0] if rest else '')
        return 0


if __name__ == '__main__':
    # GurtOS Settings is its own app (dev.box.Settings), so the dock shows it apart from the GurtOS app.
    app_id = 'dev.box.Settings' if sys.argv[1:2] == ['settings'] else APP
    GLib.set_prgname(app_id)  # the window's class matches its .desktop file, so the dock groups it right
    sys.exit(Box(app_id).run(sys.argv))
