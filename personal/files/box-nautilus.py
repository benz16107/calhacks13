# "Ask an Agent…" on folders in Files (Nautilus 46, nautilus-python). It opens GurtOS's dialog with the folders you
# right-clicked (up to 10, all in one task), or the folder you are in when you right-click its background.
import subprocess

from gi.repository import GObject, Nautilus

UI = '/opt/box/personal/box-ui.py'


def ask(paths):
    subprocess.Popen([UI, 'ask', *paths], start_new_session=True)


class AskAnAgent(GObject.GObject, Nautilus.MenuProvider):
    def get_file_items(self, files):
        paths = [f.get_location().get_path() for f in files if f.is_directory() and f.get_uri_scheme() == 'file']
        if not paths or len(paths) != len(files) or len(paths) > 10:  # folders only; the box takes up to 10 in one task
            return []
        item = Nautilus.MenuItem(name='Box::AskAnAgent', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ask(paths))
        return [item]

    def get_background_items(self, folder):
        if folder.get_uri_scheme() != 'file':
            return []
        item = Nautilus.MenuItem(name='Box::AskAnAgentHere', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ask([folder.get_location().get_path()]))
        return [item]
