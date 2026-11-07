# Home-server setup

Repo: https://github.com/konkentrate/Deadlook (private)
Image: ghcr.io/konkentrate/deadlook:main
Proxy upstream: **http://deadlook:3000**

## Prerequisites

- Linux, rootless Podman 5+, systemd user services; amd64/arm64.
- Run as the SAME normal user that runs the reverse proxy, not sudo podman.
- Existing proxy network with DNS enabled. Check: podman network ls.
  A Quadlet named proxy.network often creates a network named systemd-proxy.
- Wait for the GitHub Test and release workflow to publish its first image.
- SSH access to the private repo; a GitHub PAT (classic) with read:packages for
  podman login. Never put tokens in Git or chat.

## Install

On the server:

```sh
git clone git@github.com:konkentrate/Deadlook.git ~/Deadlook
cd ~/Deadlook
podman network ls
bash deploy/install-server.sh
sudo loginctl enable-linger "$USER"
```

The installer auto-detects proxy or systemd-proxy. To specify another existing
network (or disambiguate if both exist):

```sh
DEADLOOK_NETWORK=ACTUAL_NETWORK_NAME bash deploy/install-server.sh
```

Use the runtime network name from podman network ls, NOT the .network filename.
The script does not create or modify the proxy network or proxy container.

The installer preserves existing configuration, authenticates/pulls the image,
starts the service and asks before enabling the five-minute update timer.
No host port is published. Deadlook gets the network alias deadlook.
Configure your reverse proxy later with upstream http://deadlook:3000.
Both containers must be attached to that same network, under the same Podman user.
The proxy must not use its own localhost as the upstream.

## Verify before configuring the proxy

```sh
systemctl --user status deadlook.service
podman healthcheck run deadlook
podman exec deadlook node -e "fetch('http://deadlook:3000/api/health').then(r=>r.json()).then(console.log)"
podman port deadlook  # expected: no published ports
```

Edit ~/.config/deadlook/server.env for the default player or optional API key;
then systemctl --user restart deadlook.service. Keep HOST=0.0.0.0 in the container.

## Updates

Approved main push → checks → GHCR image → server update within ~5 minutes,
plus build/pull time. Short restart. Configuration and deadlook-data survive.

```sh
systemctl --user list-timers podman-auto-update.timer
journalctl --user -u deadlook.service -f
journalctl --user -u podman-auto-update.service -n 50
```

The app has no login yet: use reverse-proxy authentication or VPN access.
Rollback/pinning: AUTO-DEPLOY.md. Collaboration rules: ../AGENTS.md.
