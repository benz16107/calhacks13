#!/usr/bin/env bash
# Prepare a test box (Ubuntu 24.04, ARM64 or x86) for the box service. Safe to run again. Needs root.
set -euo pipefail
NODE_MAJOR=24

have_node() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; }

if ! have_node; then
  arch=$(uname -m); case $arch in aarch64) arch=arm64;; x86_64) arch=x64;; esac
  base=https://nodejs.org/dist/latest-v$NODE_MAJOR.x
  file=$(curl -fsSL "$base/SHASUMS256.txt" | grep -o "node-v[0-9.]*-linux-$arch.tar.xz" | head -1)
  tmp=$(mktemp -d)
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && curl -fsSL "$base/SHASUMS256.txt" | grep " $file\$" | sha256sum -c -)
  tar -xJf "$tmp/$file" -C /usr/local --strip-components=1 --exclude CHANGELOG.md --exclude README.md --exclude LICENSE
  rm -rf "$tmp"
fi
node -v
