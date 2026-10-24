#!/usr/bin/env bash
# Sign and publish a release folder: SHA256SUMS, its signature, the mirror, and the GitHub release.
#   release/publish.sh <version> <folder with the ISOs>
# Env: RELEASE_KEY  the release signing key (ssh ed25519 private key file)
#      S3CFG        s3cmd config for the mirror (Vultr Object Storage, bucket gurtos)
# GitHub caps release files at 2 GiB: a larger file goes to the mirror only, and this says so.
set -euo pipefail
version=$1 dir=$2
: "${RELEASE_KEY:?the release signing key}" "${S3CFG:?an s3cmd config for the mirror}"
cd "$(dirname "$0")/.."
cp release/allowed_signers "$dir/"
(
  cd "$dir"
  ls gurtos-*.iso >/dev/null
  sha256sum gurtos-*.iso > SHA256SUMS
  rm -f SHA256SUMS.sig
  ssh-keygen -Y sign -q -f "$RELEASE_KEY" -n gurtos-release SHA256SUMS
  ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
)
files=("$dir"/gurtos-*.iso "$dir"/SHA256SUMS "$dir"/SHA256SUMS.sig "$dir"/allowed_signers)

s3cmd -c "$S3CFG" put --acl-public --no-progress "${files[@]}" "s3://gurtos/$version/"

github=()
for f in "${files[@]}"; do
  if (( $(stat -c %s "$f") >= 2147483648 )); then echo "publish: $(basename "$f") is 2 GiB or more: mirror only"; else github+=("$f"); fi
done
notes=release/notes/$version.md
if gh release view "$version" >/dev/null 2>&1; then
  gh release upload "$version" --clobber "${github[@]}"
else
  gh release create "$version" --prerelease --title "GurtOS $version" --notes-file "$notes" "${github[@]}"
fi

# Check both copies as a stranger would.
base=https://sjc1.vultrobjects.com/gurtos/$version
for f in "${files[@]}"; do
  n=$(basename "$f")
  [[ $(curl -fsSI "$base/$n" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}') == $(stat -c %s "$f") ]] ||
    { echo "publish: mirror copy of $n is wrong" >&2; exit 1; }
done
echo "publish: $version on $base/ and the GitHub release"
