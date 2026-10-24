# GurtOS app icons for GTK windows: one glyph with 3 px round strokes on a rounded tile in the app's own colour
# (docs/figma/system.md, "Icons"). The glyph paths are the portal's (portal/src/ui.tsx), so an app looks the same in
# the portal, on the box's screen and here. An app with no glyph shows its first letter.
from gi.repository import Gdk, GLib, Gtk

GLYPHS = {
    'find': ['M30 21C30 25.9706 25.9706 30 21 30C16.0294 30 12 25.9706 12 21C12 16.0294 16.0294 12 21 12C25.9706 12 30 16.0294 30 21Z', 'M28 28L36 36'],
    'shopper': ['M13 18H35L33 38H15L13 18Z',
                'M19 18V15C19 13.6739 19.5268 12.4021 20.4645 11.4645C21.4021 10.5268 22.6739 10 24 10C25.3261 10 26.5979 10.5268 27.5355 11.4645C28.4732 12.4021 29 13.6739 29 15V18'],
    'wallet': ['M13 15H35C36.6569 15 38 16.3431 38 18V32C38 33.6569 36.6569 35 35 35H13C11.3431 35 10 33.6569 10 32V18C10 16.3431 11.3431 15 13 15Z',
               'M10 21H38M30 29H33'],
    'credit-desk': ['M16 10H32C33.1046 10 34 10.8954 34 12V36C34 37.1046 33.1046 38 32 38H16C14.8954 38 14 37.1046 14 36V12C14 10.8954 14.8954 10 16 10Z',
                    'M19 18H29M19 24H29M19 30H25'],
    'tasks': ['M12 16H36M12 24H30M12 32H33'],
    'time-machine': ['M14.5 17.5C16.2206 15.302 18.6535 13.7726 21.3801 13.1751C24.1067 12.5775 26.9563 12.9491 29.4384 14.2259C31.9205 15.5027 33.8799 17.6049 34.9793 20.1706C36.0786 22.7363 36.2492 25.6049 35.4616 28.2828C34.674 30.9607 32.9775 33.2802 30.6641 34.8422C28.3507 36.4041 25.5652 37.1107 22.7871 36.8404C20.0089 36.5701 17.4119 35.3397 15.443 33.3611C13.4741 31.3825 12.2566 28.7795 12 26',
                     'M12 11V18H19', 'M24 19V25L28 28'],
    'folder': ['M10 15C10 13.8954 10.8954 13 12 13H20L23 16H36C37.1046 16 38 16.8954 38 18V34C38 35.1046 37.1046 36 36 36H12C10.8954 36 10 35.1046 10 34V15Z'],
    'jira': ['M14 12V30M24 12V24M34 12V30', 'M14 12H34'],
    'asi-one': ['M12 14H36C37.1 14 38 14.9 38 16V30C38 31.1 37.1 32 36 32H22L15 37V32H12C10.9 32 10 31.1 10 30V16C10 14.9 10.9 14 12 14Z',
                'M17 21H31M17 26H26'],
}
# Tile colours from the GurtOS app icons, muted so a row of them reads as one set.
COLORS = {'find': '#4D6791', 'shopper': '#B9503E', 'wallet': '#7A5A2A', 'credit-desk': '#215B5F', 'jira': '#2B4E87',
          'asi-one': '#3A3F47', 'tasks': '#3E6F9E', 'time-machine': '#9A4B35', 'folder': '#5D6670', 'apify': '#4F6B3A',
          'elastic': '#38627A', 'mana': '#6A4C7D'}


def svg(app, letter='?', size=48):
    paths = GLYPHS.get(app)
    color = COLORS.get(app, '#5E6670')
    if paths:
        inner = ''.join(f'<path d="{d}" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' for d in paths)
    else:
        inner = (f'<text x="24" y="31" text-anchor="middle" font-family="Atkinson Hyperlegible Next, sans-serif" font-size="20" '
                 f'font-weight="700" fill="#FFFFFF">{GLib.markup_escape_text(letter[:1].upper())}</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 48 48">'
            f'<rect x="0" y="0" width="48" height="48" rx="11" fill="#00000033"/>'
            f'<rect x="0" y="0" width="48" height="45" rx="11" fill="{color}"/>{inner}</svg>')


def tile(app, title='', size=40):
    """The app's icon as a widget, size px square."""
    texture = Gdk.Texture.new_from_bytes(GLib.Bytes.new(svg(app, title or app, size * 2).encode()))
    image = Gtk.Image.new_from_paintable(texture)
    image.set_pixel_size(size)
    image.set_valign(Gtk.Align.START)
    image.set_halign(Gtk.Align.START)
    return image
