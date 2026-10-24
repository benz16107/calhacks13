#!/usr/bin/env bash
# GurtOS Personal's look and session, on Ubuntu's GNOME: the GurtOS session (its own Shell mode, which loads the
# GurtOS Shell extension so it is always on), dconf defaults, wallpaper, icons, GTK accents, logos, the GDM logo and
# a Plymouth theme. Run as root by personal/install.sh; works in a chroot. The Figma theme replaces the files here.
set -euo pipefail
t=$(cd "$(dirname "$0")" && pwd)
shell=$(cd "$t/../shell" && pwd)

# The session: Shell mode, gnome-session, the login choice for Wayland and Xorg, and its systemd target.
install -Dm644 "$t/session/gurtos.json" /usr/share/gnome-shell/modes/gurtos.json
install -Dm644 "$t/session/gurtos.session" /usr/share/gnome-session/sessions/gurtos.session
install -Dm644 "$t/session/gurtos-wayland.desktop" /usr/share/wayland-sessions/gurtos.desktop
install -Dm644 "$t/session/gurtos-xorg.desktop" /usr/share/xsessions/gurtos-xorg.desktop
install -Dm644 "$t/session/gurtos.session.conf" /usr/lib/systemd/user/gnome-session@gurtos.target.d/gurtos.session.conf
rm -rf /usr/share/gnome-shell/extensions/gurtos@gurtos.dev
cp -r "$shell/gurtos@gurtos.dev" /usr/share/gnome-shell/extensions/
chmod -R a+rX /usr/share/gnome-shell/extensions/gurtos@gurtos.dev
# Ubuntu's first-login tour and its Pro and updater nags are hidden in the GurtOS session (its XDG_CONFIG_DIRS).
install -Dm644 -t /etc/xdg/gurtos/autostart "$t"/autostart/*.desktop
command -v pro >/dev/null && pro config set apt_news=false >/dev/null 2>&1 || true

# Defaults for every account, and the login screen's.
install -Dm644 -t /etc/dconf/profile "$t/dconf/profile/user" "$t/dconf/profile/gdm"
install -Dm644 -t /etc/dconf/db/gurtos.d "$t"/dconf/db/gurtos.d/*
install -Dm644 -t /etc/dconf/db/gdm.d "$t"/dconf/db/gdm.d/*
dconf update

# Wallpaper, icons, GTK accents for new accounts, logos.
# Figma's wallpapers (Hills is the default), light and dark.
rm -f /usr/share/backgrounds/gurtos/gurtos-night.svg /usr/share/gnome-background-properties/gurtos.xml
install -Dm644 -t /usr/share/backgrounds/gurtos "$t"/backgrounds/*.svg
install -Dm644 "$t/backgrounds/gurtos-backgrounds.xml" /usr/share/gnome-background-properties/gurtos-backgrounds.xml
# Icons: Papirus with GurtOS slate folders (built from the installed Papirus), Adwaita for symbolic icons.
"$t/make-icons.py" "$t/icons/GurtOS" /usr/share/icons/GurtOS
gtk-update-icon-cache -q -f /usr/share/icons/GurtOS 2>/dev/null || true
# Colours: libadwaita's named colours as GurtOS tokens (Figma), for GurtOS's apps and, through /etc/skel, everyone's.
install -Dm644 -t /usr/share/gurtos/theme "$t"/colors/*.css "$t"/gtk/gtk4.css
install -Dm644 "$t/skel/.config/gtk-4.0/gtk.css" /etc/skel/.config/gtk-4.0/gtk.css
rm -f /etc/skel/.config/gtk-3.0/gtk.css
install -Dm644 "$t/gurtos-logo-gdm.png" /usr/share/gurtos/gurtos-logo-gdm.png
install -Dm644 -t /usr/share/gurtos "$t"/wordmark/*.svg
install -Dm644 "$t/../icons/dev.box.Box.svg" /usr/share/icons/hicolor/scalable/apps/gurtos-logo.svg # os-release LOGO=gurtos-logo

# Boot splash, when Plymouth is installed. The image rebuilds the initramfs.
install -Dm644 -t /usr/share/plymouth/themes/gurtos "$t"/plymouth/gurtos/*
if [[ -d /usr/share/plymouth/themes ]]; then
  update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth /usr/share/plymouth/themes/gurtos/gurtos.plymouth 200 >/dev/null
  update-alternatives --set default.plymouth /usr/share/plymouth/themes/gurtos/gurtos.plymouth >/dev/null
fi

# GDM starts the GurtOS session by default; the owner moves to it too.
if [[ -f /etc/gdm3/custom.conf ]] && ! grep -q '^DefaultSession=' /etc/gdm3/custom.conf; then
  sed -i 's/^\[daemon\]$/[daemon]\nDefaultSession=gurtos.desktop/' /etc/gdm3/custom.conf
fi
for f in /var/lib/AccountsService/users/*; do
  [[ -f $f ]] && grep -q '^Session=ubuntu' "$f" && sed -i 's/^Session=ubuntu.*/Session=gurtos/; s/^XSession=ubuntu.*/XSession=gurtos/' "$f"
done
true
