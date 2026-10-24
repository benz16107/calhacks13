# The box's screen: one full-screen web view with no browser controls. cage runs it on the display.
# Until the page has painted, the window is the screen's own colour (#27313F) and the cursor is hidden, so the
# hand-over from the boot splash is not a white rectangle and a stray arrow.
import sys

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import Gdk, GLib, Gtk, WebKit2  # noqa: E402

url = sys.argv[1]
night = Gdk.RGBA(0x27 / 255, 0x31 / 255, 0x3F / 255, 1)

css = Gtk.CssProvider()
css.load_from_data(b"window { background-color: #27313f; }")
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

view = WebKit2.WebView()
view.set_background_color(night)


def retry(_view, _event, _uri, _error):
    # The page's server may still be starting. Try again shortly instead of showing an error page.
    GLib.timeout_add_seconds(2, lambda: view.load_uri(url) and False)
    return True


def show_cursor(_view, event):
    if event == WebKit2.LoadEvent.FINISHED and window.get_window():
        window.get_window().set_cursor(None)


view.connect("load-failed", retry)
view.connect("load-changed", show_cursor)
view.load_uri(url)
window = Gtk.Window()
window.add(view)
window.connect("destroy", Gtk.main_quit)
window.connect("realize", lambda w: w.get_window().set_cursor(Gdk.Cursor.new_for_display(w.get_display(), Gdk.CursorType.BLANK_CURSOR)))
# Open at the screen's size, not a small default one that then grows: that was a rectangle in the corner.
screen = Gdk.Screen.get_default()
window.set_default_size(screen.get_width(), screen.get_height())
window.fullscreen()
window.show_all()
Gtk.main()
