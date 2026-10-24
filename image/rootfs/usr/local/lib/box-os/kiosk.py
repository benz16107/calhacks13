# The box's screen: one full-screen web view with no browser controls. cage runs it on the display.
import sys

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

url = sys.argv[1]
view = WebKit2.WebView()


def retry(_view, _event, _uri, _error):
    # The page's server may still be starting. Try again shortly instead of showing an error page.
    GLib.timeout_add_seconds(2, lambda: view.load_uri(url) and False)
    return True


view.connect("load-failed", retry)
view.load_uri(url)
window = Gtk.Window()
window.add(view)
window.connect("destroy", Gtk.main_quit)
window.fullscreen()
window.show_all()
Gtk.main()
