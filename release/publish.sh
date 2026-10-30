#!/usr/bin/env bash
# Sign and publish a release folder: SHA256SUMS, its signature, and the GitHub release.
#   release/publish.sh <version> <folder>   the folder holds the ISOs, the update images (.sqfs, .sha256, .sig)
#                                          and the software bills of materials (*.json.gz) from the builds
#   DRAFT=1 release/publish.sh ...          a draft GitHub release only, which nobody else sees.
#                                          Run it again without DRAFT to publish the draft.
# Env: RELEASE_KEY  the release signing key (ssh ed25519 private key file)
#      TARGET       the full commit the ISOs were built from; the release's tag is made there when it is published
# GitHub caps release files at 2 GiB: a larger file stops the run before anything is uploaded.
set -euo pipefail
version=$1 dir=$2
draft=${DRAFT:-}
: "${RELEASE_KEY:?the release signing key}"
cd "$(dirname "$0")/.."
cp release/allowed_signers "$dir/"
(
  cd "$dir"
  ls gurtos-*.iso gurtos-*.sqfs >/dev/null # v0.1.0-preview boxes update only from a signed .sqfs (box-update)
  sha256sum gurtos-*.iso gurtos-*.sqfs > SHA256SUMS
  rm -f SHA256SUMS.sig
  ssh-keygen -Y sign -q -f "$RELEASE_KEY" -n gurtos-release SHA256SUMS
  ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
)
shopt -s nullglob
files=("$dir"/gurtos-*.iso "$dir"/gurtos-*.sqfs "$dir"/gurtos-*.sqfs.sha256 "$dir"/gurtos-*.sqfs.sig "$dir"/gurtos-*.json.gz
  "$dir"/SHA256SUMS "$dir"/SHA256SUMS.sig "$dir"/allowed_signers)
shopt -u nullglob

for f in "${files[@]}"; do
  (( $(stat -c %s "$f") < 2147483648 )) || { echo "publish: $(basename "$f") is 2 GiB or more, over GitHub's limit" >&2; exit 1; }
done
notes=release/notes/$version.md
if gh release view "$version" >/dev/null 2>&1; then
  # Upload only what the release lacks or holds with other content (the draft run already sent the big files).
  have=$(gh release view "$version" --json assets -q '.assets[] | "\(.name) \(.digest)"')
  todo=()
  for f in "${files[@]}"; do grep -qxF "$(basename "$f") sha256:$(sha256sum < "$f" | cut -d' ' -f1)" <<< "$have" || todo+=("$f"); done
  if (( ${#todo[@]} )); then gh release upload "$version" --clobber "${todo[@]}"; fi
  gh release edit "$version" ${TARGET:+--target "$TARGET"} --notes-file "$notes"
else
  gh release create "$version" --prerelease ${draft:+--draft} ${TARGET:+--target "$TARGET"} --title "GurtOS $version" --notes-file "$notes" "${files[@]}"
fi
if [[ -n $draft ]]; then echo "publish: draft $version on GitHub, not public; run again without DRAFT to publish"; exit 0; fi
[[ $(gh release view "$version" --json isDraft -q .isDraft) == false ]] || gh release edit "$version" --draft=false

# Check the public copy as a stranger would.
base=https://github.com/benz16107/gurtos/releases/download/$version
curl -fsSL "$base/SHA256SUMS" | cmp -s - "$dir/SHA256SUMS" || { echo "publish: the public SHA256SUMS differs" >&2; exit 1; }
echo "publish: $version at https://github.com/benz16107/gurtos/releases/tag/$version"
