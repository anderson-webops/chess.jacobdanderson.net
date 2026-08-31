#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
	echo "Run install-service.sh with root privileges." >&2
	exit 1
fi
if [[ ! -x /usr/bin/node || "$(/usr/bin/node --version)" != "v24.18.1" ]]; then
	echo "/usr/bin/node must be Node 24.18.1." >&2
	exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if ! getent group chess-site >/dev/null; then
	groupadd --system chess-site
fi
if ! id chess-site >/dev/null 2>&1; then
	useradd --system --gid chess-site --home-dir /srv/chess.jacobdanderson.net --shell /usr/sbin/nologin chess-site
fi

install -d -o chess-site -g chess-site -m 0750 /srv/chess.jacobdanderson.net
install -d -o chess-site -g chess-site -m 0750 /srv/chess.jacobdanderson.net/releases
install -d -o chess-site -g chess-site -m 0750 /srv/chess.jacobdanderson.net/shared
install -d -o chess-site -g chess-site -m 0700 /srv/chess.jacobdanderson.net/shared/npm-cache
install -o root -g root -m 0644 "$script_dir/chess-jacobdanderson-net-api.service" /etc/systemd/system/chess-jacobdanderson-net-api.service

systemctl daemon-reload
systemctl enable chess-jacobdanderson-net-api.service

echo "Installed the Docker-free chess API service without starting it. Install the Nginx server snippet and promote a prepared release."
