#!/usr/bin/python3
# Drive a GNOME session from a test script, on Wayland too, where xdotool cannot. personal/vm.sh runs it.
#   wl.py shot out.png            the whole screen. Run as the session's user, with its D-Bus address.
#   wl.py click X Y [right]       move the pointer there and click. Run as root.
#   wl.py type 'some text'        type it (US layout). Run as root.
#   wl.py key Return | Tab | Escape | ctrl+a | shift+F10 ...   Run as root.
# Input is a virtual tablet and keyboard made through /dev/uinput, the same kind of device as a VM's USB tablet,
# so it works in any session, including GDM's first-boot setup, where GNOME refuses remote-desktop input.
# A test tool, not wired into anything.
import fcntl
import glob
import os
import struct
import sys
import time


def shot(out):
    from gi.repository import Gio, GLib
    bus = Gio.bus_get_sync(Gio.BusType.SESSION)

    def call(name, path, iface, method, args, reply=None):
        return bus.call_sync(name, path, iface, method, args, GLib.VariantType(reply) if reply else None, Gio.DBusCallFlags.NONE, 10000, None)
    # The Shell only takes screenshots for a few known apps. Owning gnome-screenshot's name is how it gets through.
    call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'RequestName', GLib.Variant('(su)', ('org.gnome.Screenshot', 4)))
    ok, path = call('org.gnome.Shell.Screenshot', '/org/gnome/Shell/Screenshot', 'org.gnome.Shell.Screenshot', 'Screenshot',
                    GLib.Variant('(bbs)', (False, False, out)), '(bs)').unpack()
    if not ok:
        sys.exit(f'screenshot failed: {path}')


# linux/input-event-codes.h
EV_SYN, EV_KEY, EV_ABS = 0, 1, 3
BTN_LEFT, BTN_RIGHT = 0x110, 0x111
ABS_MAX = 32767
KEYS = {'Escape': 1, 'BackSpace': 14, 'Tab': 15, 'Return': 28, 'ctrl': 29, 'shift': 42, 'alt': 56, 'space': 57, 'F10': 68,
        'Home': 102, 'Up': 103, 'Left': 105, 'Right': 106, 'End': 107, 'Down': 108, 'Delete': 111, 'super': 125, 'Menu': 127}
ROWS = {2: '1234567890-=', 16: 'qwertyuiop[]', 30: "asdfghjkl;'`", 43: '\\zxcvbnm,./'}
SHIFTED = {2: '!@#$%^&*()_+', 16: 'QWERTYUIOP{}', 30: 'ASDFGHJKL:"~', 43: '|ZXCVBNM<>?'}
CHARS = {' ': (57, False), '\n': (28, False), '\t': (15, False)}
for start, row in ROWS.items():
    CHARS.update({c: (start + i, False) for i, c in enumerate(row)})
for start, row in SHIFTED.items():
    CHARS.update({c: (start + i, True) for i, c in enumerate(row)})


def screen():
    """The connected monitor's size, from the kernel (wl.py runs as root, outside the session)."""
    for status in glob.glob('/sys/class/drm/card*-*/status'):
        if open(status).read().strip() == 'connected':
            mode = open(os.path.join(os.path.dirname(status), 'modes')).readline().strip()
            w, h = mode.split('x')
            return int(w), int(h)
    return 1280, 800


class Device:
    def __enter__(self):
        self.fd = os.open('/dev/uinput', os.O_WRONLY | os.O_NONBLOCK)
        for ev in (EV_SYN, EV_KEY, EV_ABS):
            fcntl.ioctl(self.fd, 0x40045564, ev)  # UI_SET_EVBIT
        for key in list(range(1, 128)) + [BTN_LEFT, BTN_RIGHT]:
            fcntl.ioctl(self.fd, 0x40045565, key)  # UI_SET_KEYBIT
        for axis in (0, 1):  # ABS_X, ABS_Y
            fcntl.ioctl(self.fd, 0x40045567, axis)  # UI_SET_ABSBIT
            fcntl.ioctl(self.fd, 0x401c5504, struct.pack('HxxiiiiII', axis, 0, 0, ABS_MAX, 0, 0, 0)[:28])  # UI_ABS_SETUP
        fcntl.ioctl(self.fd, 0x405c5503, struct.pack('HHHH80sI', 0x03, 0x1234, 0x5678, 1, b'gurtos test input', 0))  # UI_DEV_SETUP
        fcntl.ioctl(self.fd, 0x5501)  # UI_DEV_CREATE
        time.sleep(1.0)  # let the compositor find the new device
        return self

    def __exit__(self, *_):
        time.sleep(0.3)
        fcntl.ioctl(self.fd, 0x5502)  # UI_DEV_DESTROY
        os.close(self.fd)

    def emit(self, kind, code, value):
        os.write(self.fd, struct.pack('llHHi', 0, 0, kind, code, value))

    def sync(self):
        self.emit(EV_SYN, 0, 0)

    def press(self, code, down):
        self.emit(EV_KEY, code, 1 if down else 0)
        self.sync()
        time.sleep(0.02)

    def move(self, x, y):
        w, h = screen()
        self.emit(EV_ABS, 0, round(x * ABS_MAX / (w - 1)))
        self.emit(EV_ABS, 1, round(y * ABS_MAX / (h - 1)))
        self.sync()


def main(cmd, *args):
    if cmd == 'shot':
        return shot(args[0])
    with Device() as d:
        if cmd == 'click':
            d.move(float(args[0]), float(args[1]))
            time.sleep(0.2)
            button = BTN_RIGHT if args[2:] == ('right',) else BTN_LEFT
            d.press(button, True)
            d.press(button, False)
        elif cmd == 'type':
            for ch in args[0]:
                code, shift = CHARS[ch]
                if shift:
                    d.press(KEYS['shift'], True)
                d.press(code, True)
                d.press(code, False)
                if shift:
                    d.press(KEYS['shift'], False)
        elif cmd == 'key':
            codes = [KEYS.get(k) or CHARS[k][0] for k in args[0].split('+')]
            for c in codes:
                d.press(c, True)
            for c in reversed(codes):
                d.press(c, False)


if __name__ == '__main__':
    main(*sys.argv[1:])
