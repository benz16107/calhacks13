# "Ask an Agent…" on a folder in Files (Nautilus 46, nautilus-python). It opens GurtOS's dialog with the folder
# you right-clicked, or the folder you are in when you right-click its background. One folder per task, as the box
# takes one.
import subprocess

from gi.repository import GObject, Nautilus

UI = '/opt/box/personal/box-ui.py'


def ask(paths):
    subprocess.Popen([UI, 'ask', *paths], start_new_session=True)


class AskAnAgent(GObject.GObject, Nautilus.MenuProvider):
    def get_file_items(self, files):
        if len(files) != 1 or not files[0].is_directory() or files[0].get_uri_scheme() != 'file':
            return []
        paths = [files[0].get_location().get_path()]
        item = Nautilus.MenuItem(name='Box::AskAnAgent', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ask(paths))
        return [item]

    def get_background_items(self, folder):
        if folder.get_uri_scheme() != 'file':
            return []
        item = Nautilus.MenuItem(name='Box::AskAnAgentHere', label='Ask an Agent…', tip='Let an agent work on a copy of this folder')
        item.connect('activate', lambda _i: ask([folder.get_location().get_path()]))
        return [item]
