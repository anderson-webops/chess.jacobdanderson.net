#!/usr/bin/env bash
# Bootstrap from a separately reviewed, root-owned checkout. Never from a build tree.
set -euo pipefail
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
unset NODE_OPTIONS NODE_PATH PYTHONPATH PYTHONHOME
umask 077
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo 'Run the reviewed administrative installer as root.' >&2; exit 1
fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source_root="$(cd -- "$script_dir/../.." && pwd -P)"
node_bin_dir="${NODE_BIN_DIR:-/opt/node-24.18.1/bin}"
/usr/bin/python3 -I "$script_dir/trusted-paths.py" --tree "$script_dir" \
  "$source_root/scripts/runtime-artifact.py" "$source_root/deploy/runtime-artifact.json" \
  "$source_root/package.json" "$node_bin_dir/node"
if [[ "$("$node_bin_dir/node" --version)" != v24.18.1 ]]; then
  echo 'NODE_BIN_DIR must select Node24.18.1 without replacing the host-wide runtime.' >&2; exit 1
fi
version="$("$node_bin_dir/node" -p 'require(process.argv[1]).version' "$source_root/package.json")"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
helper_parent=/usr/local/libexec/chess-release
if [[ -e "$helper_parent" || -L "$helper_parent" ]]; then
  /usr/bin/python3 -I "$script_dir/trusted-paths.py" "$helper_parent"
fi
helper_root="$helper_parent/$version"
if [[ -e "$helper_root" || -L "$helper_root" ]]; then
  echo "Reviewed helper version already exists: $helper_root. Do not overwrite it." >&2; exit 1
fi
unit=/etc/systemd/system/chess-jacobdanderson-net-api.service
if [[ ! -e "$unit" && "$node_bin_dir" != /opt/node-24.18.1/bin ]]; then
  echo 'Review the unit ExecStart for this alternate runtime before installing the service.' >&2; exit 1
fi
base=/srv/chess.jacobdanderson.net
# Existing installations require an explicit ownership/topology migration review.
for directory in "$base" "$base/releases"; do
  if [[ -e "$directory" || -L "$directory" ]]; then
    /usr/bin/python3 -I "$script_dir/trusted-paths.py" "$directory"
  fi
done
if ! getent group chess-site >/dev/null; then groupadd --system chess-site; fi
if ! id chess-site >/dev/null 2>&1; then
  useradd --system --gid chess-site --home-dir "$base" --shell /usr/sbin/nologin chess-site
fi
install -d -o root -g chess-site -m 0750 "$base" "$base/releases"
for directory in "$base/builds" "$base/shared" "$base/shared/npm-cache"; do
  if [[ ! -e "$directory" ]]; then install -d -o chess-site -g chess-site -m 0700 "$directory"; fi
done
mkdir -p -- "$helper_parent"
/usr/bin/python3 -I "$script_dir/trusted-paths.py" "$helper_parent"
install -d -o root -g root -m 0755 "$helper_root" "$helper_root/scripts" "$helper_root/deploy" "$helper_root/deploy/systemd"
install -o root -g root -m 0755 "$script_dir/promote-release.sh" "$script_dir/trusted-paths.py" "$helper_root/deploy/systemd/"
install -o root -g root -m 0755 "$source_root/scripts/runtime-artifact.py" "$helper_root/scripts/"
install -o root -g root -m 0644 "$source_root/deploy/runtime-artifact.json" "$helper_root/deploy/"
if [[ ! -e "$unit" ]]; then
  install -o root -g root -m 0644 "$script_dir/chess-jacobdanderson-net-api.service" "$unit"
  systemctl daemon-reload
  systemctl enable chess-jacobdanderson-net-api.service
fi
echo "Installed protected helpers at $helper_root. Existing units and services were not changed or restarted."
