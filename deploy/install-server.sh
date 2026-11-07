#!/usr/bin/env bash
# Run from a trusted checkout on the home server, as its unprivileged service user.
set -euo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE=ghcr.io/konkentrate/deadlook:main
AUTH="$HOME/.config/containers/auth.json"
UNITS="$HOME/.config/containers/systemd"
ENVFILE="$HOME/.config/deadlook/server.env"

if [[ "$EUID" -eq 0 ]]; then echo "Run as your normal service user, not root/sudo." >&2; exit 1; fi
for command in podman systemctl; do command -v "$command" >/dev/null || { echo "Missing: $command" >&2; exit 1; }; done
VERSION="$(podman version --format '{{.Client.Version}}')"
[[ "${VERSION%%.*}" -ge 5 ]] || { echo "Podman 5+ is required." >&2; exit 1; }
case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) echo "Image supports amd64/arm64 only." >&2; exit 1;; esac
systemctl --user show-environment >/dev/null || { echo "No systemd user session. Log in via SSH as the service user." >&2; exit 1; }

# Resolve the existing network name; proxy.network commonly creates systemd-proxy.
NETWORK="${DEADLOOK_NETWORK:-}"
if [[ -z "$NETWORK" ]]; then
  for candidate in proxy systemd-proxy; do
    if podman network exists "$candidate"; then NETWORK="$candidate"; break; fi
  done
fi
[[ "$NETWORK" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || {
  echo "Proxy network not found. Run podman network ls as the proxy's user." >&2
  echo "Then: DEADLOOK_NETWORK=ACTUAL_NAME bash deploy/install-server.sh" >&2
  exit 1
}
podman network exists "$NETWORK" || { echo "Network $NETWORK does not exist under this Podman user." >&2; exit 1; }
echo "Using existing proxy network: $NETWORK (alias: deadlook; no published host ports)"
mkdir -p "$UNITS" "$HOME/.config/containers" "$HOME/.config/deadlook"
if [[ ! -f "$ENVFILE" ]]; then install -m 600 "$ROOT/deploy/server.env.example" "$ENVFILE"; fi
if [[ ! -f "$AUTH" ]]; then printf '{"auths":{}}\n' > "$AUTH"; fi
chmod 600 "$AUTH" "$ENVFILE"

echo "Private registry login: username konkentrate, password = a PAT (classic) with read:packages."
if ! podman login --get-login --authfile "$AUTH" ghcr.io >/dev/null 2>&1; then
  podman login --authfile "$AUTH" ghcr.io
fi
# Fail before replacing a working service if the first GitHub release is not ready.
podman pull --authfile "$AUTH" "$IMAGE"

if [[ -f "$UNITS/deadlook.container" ]]; then
  cp -p "$UNITS/deadlook.container" "$UNITS/deadlook.container.backup-$(date +%Y%m%d%H%M%S)"
fi
sed "s/^Network=proxy$/Network=$NETWORK/" "$ROOT/deploy/deadlook-auto.container" > "$UNITS/deadlook.container"
chmod 644 "$UNITS/deadlook.container"
systemctl --user daemon-reload
systemctl --user restart deadlook.service
podman healthcheck run deadlook

echo "The next step sets a five-minute timer for ALL this user's auto-update-enabled containers."
read -r -p "Enable the update timer? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  mkdir -p "$HOME/.config/systemd/user/podman-auto-update.timer.d"
  install -m 644 "$ROOT/deploy/podman-auto-update.timer.d/override.conf" "$HOME/.config/systemd/user/podman-auto-update.timer.d/override.conf"
  systemctl --user daemon-reload
  systemctl --user enable --now podman-auto-update.timer
  systemctl --user list-timers podman-auto-update.timer
else
  echo "Deadlook is running, but scheduled auto-update has not been enabled by this script."
fi
echo "Ensure boot persistence: sudo loginctl enable-linger $(id -un)"
echo "Config: $ENVFILE"
echo "Proxy upstream: http://deadlook:3000 (on network $NETWORK)"
echo "No host port is published. Configure your reverse proxy when ready."
echo "Logs: journalctl --user -u deadlook.service -f"
