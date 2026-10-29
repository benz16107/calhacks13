#!/usr/bin/env bash
# Sign and publish a release folder: SHA256SUMS, its signature, the mirror, and the GitHub release.
#   release/publish.sh <version> <folder>   the folder holds the ISOs, the update images (.sqfs, .sha256, .sig)
#                                          and the software bills of materials (*.json.gz) from the builds
#   DRAFT=1 release/publish.sh ...          a draft GitHub release only, which nobody else sees: no mirror upload.
#                                          Run it again without DRAFT to upload the mirror and publish the draft.
# Env: RELEASE_KEY  the release signing key (ssh ed25519 private key file)
#      TARGET       the full commit the ISOs were built from; the release's tag is made there when it is published
#      S3CFG        s3cmd config for the mirror (Vultr Object Storage, bucket gurtos); not needed with DRAFT=1
# GitHub caps release files at 2 GiB: a larger file goes to the mirror only, and this says so.
set -euo pipefail
version=$1 dir=$2
draft=${DRAFT:-}
: "${RELEASE_KEY:?the release signing key}"
[[ -n $draft ]] || : "${S3CFG:?an s3cmd config for the mirror}"
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

[[ -n $draft ]] || s3cmd -c "$S3CFG" put --acl-public --no-progress "${files[@]}" "s3://gurtos/$version/"

github=()
for f in "${files[@]}"; do
  if (( $(stat -c %s "$f") >= 2147483648 )); then echo "publish: $(basename "$f") is 2 GiB or more: mirror only"; else github+=("$f"); fi
done
notes=release/notes/$version.md
if gh release view "$version" >/dev/null 2>&1; then
  # Upload only what the release lacks or holds at another size (the draft run already sent the big files).
  have=$(gh release view "$version" --json assets -q '.assets[] | "\(.name) \(.size)"')
  todo=()
  for f in "${github[@]}"; do grep -qxF "$(basename "$f") $(stat -c %s "$f")" <<< "$have" || todo+=("$f"); done
  if (( ${#todo[@]} )); then gh release upload "$version" --clobber "${todo[@]}"; fi
  gh release edit "$version" --notes-file "$notes"
else
  gh release create "$version" --prerelease ${draft:+--draft} ${TARGET:+--target "$TARGET"} --title "GurtOS $version" --notes-file "$notes" "${github[@]}"
fi
if [[ -n $draft ]]; then echo "publish: draft $version on GitHub, not public; run again without DRAFT to publish"; exit 0; fi
[[ $(gh release view "$version" --json isDraft -q .isDraft) == false ]] || gh release edit "$version" --draft=false

# Check both copies as a stranger would.
base=https://sjc1.vultrobjects.com/gurtos/$version
for f in "${files[@]}"; do
  n=$(basename "$f")
  [[ $(curl -fsSI "$base/$n" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}') == $(stat -c %s "$f") ]] ||
    { echo "publish: mirror copy of $n is wrong" >&2; exit 1; }
done
echo "publish: $version on $base/ and the GitHub release"
