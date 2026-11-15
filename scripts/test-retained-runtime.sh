#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
output=$(realpath "${1:?Pass the current artifact qualification directory}")
case "$output/" in "$root/.ai-work/runs/"*) ;; *) echo 'Retained runtime evidence must remain in owning repository scratch.' >&2; exit 1;; esac
test "$(id -u)" -ne 0
test "$(uname -s)" = Linux
test "$(uname -m)" = aarch64
node=$(realpath "$(command -v node)")
test "$("$node" --version)" = v26.13.1
commit=0a891ec7628e930254b2820b160e20340f11c3b9
sha=083b2936783c7356c7437b272f4ef4e726a88acb2ce87ca16cf97f5595170303
archive_name=chess-jacobdanderson-net-v1.0.9-0a891ec7628e-linux-arm64.tar.gz
prior="$output/retained-v1.0.9"
mkdir -m 700 "$prior" "$prior/source" "$prior/runtime"
git -C "$root" archive "$commit" scripts/runtime-artifact.py deploy/runtime-artifact.json | tar -x -C "$prior/source"
printf '%s  %s\n' \
  719e002b0ef29c5b08cd8313922166321657eb27d6a4574e2e0baaba22482c6b "$prior/source/scripts/runtime-artifact.py" \
  fdb80eed6c95a701fda5adaed8a6eed1545b777d4a3e4d811a067f50a9264046 "$prior/source/deploy/runtime-artifact.json" | sha256sum --check
curl --fail --location --proto '=https' --proto-redir '=https' \
  --retry 2 --connect-timeout 15 --max-time 120 \
  "https://github.com/anderson-webops/chess.jacobdanderson.net/releases/download/v1.0.9/$archive_name" \
  --output "$prior/$archive_name"
python3 -B "$prior/source/scripts/runtime-artifact.py" unpack "$prior/runtime" \
  --archive "$prior/$archive_name" --sha256 "$sha" --commit "$commit"
loader_mounts=()
if test -d /usr/lib64; then
  loader_mounts=(--symlink usr/lib64 /lib64)
fi
timeout -k 5 90 bwrap --unshare-all --die-with-parent --new-session \
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib "${loader_mounts[@]}" \
  --ro-bind "$node" /runtime/node --proc /proc --dev /dev --tmpfs /tmp \
  --ro-bind "$prior/runtime" /app \
  --ro-bind "$root/scripts/artifact-acceptance/runtime.mjs" /harness/runtime.mjs \
  --ro-bind "$root/scripts/artifact-acceptance/nginx.mjs" /harness/nginx.mjs \
  --ro-bind "$root/deploy/nginx/chess.jacobdanderson.net.server.conf" /harness/nginx-site.conf \
  --ro-bind /etc/nginx/mime.types /harness/mime.types \
  --ro-bind "$root/scripts/direct-runtime-smoke.mjs" /harness/direct-runtime-smoke.mjs \
  --clearenv --setenv PATH /runtime:/usr/bin:/bin --setenv HOME /tmp \
  --chdir /app /runtime/node /harness/runtime.mjs retained-v1.0.9
python3 -B "$prior/source/scripts/runtime-artifact.py" verify "$prior/runtime" \
  --archive "$prior/$archive_name" --sha256 "$sha" --commit "$commit"
