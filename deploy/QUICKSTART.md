# Home-server setup

Repo: https://github.com/konkentrate/Deadlook (private)
Image: ghcr.io/konkentrate/deadlook:main

## Prerequisites

- Linux home server, rootless Podman 5+, systemd user services.
- amd64 or arm64 CPU. Git and curl installed.
- Run everything as ONE normal service user, not with sudo podman.
- First GitHub **Test and release** workflow must finish successfully.
- Private repo clone access via your SSH key (or gh auth login on the server).
- GitHub PAT (classic) with read:packages and access to this private package.
  Enter it into podman login when prompted; do not paste it into chat or Git.

## Install

SSH into your server, then:

```sh
git clone git@github.com:konkentrate/Deadlook.git ~/Deadlook
cd ~/Deadlook
bash deploy/install-server.sh
sudo loginctl enable-linger "$USER"
```

The installer preserves existing server.env/registry credentials, pulls the image
before replacing a service, starts Deadlook, and asks before enabling the
five-minute Podman update timer. It backs up an existing Deadlook Quadlet.
If it reports denied/not found, verify the GitHub workflow and package access.

Edit ~/.config/deadlook/server.env for the default player or optional API key,
then systemctl --user restart deadlook.service.
Do not set HOST=127.0.0.1 inside the container.

## Open it first, without configuring a domain

From YOUR workstation:

```sh
ssh -L 8080:127.0.0.1:3000 USER@SERVER
```

Open http://localhost:8080.

The container listens only on the server's loopback port 3000. Put an existing
HTTPS reverse proxy in front of it later, with authentication or VPN access.
The app has no login yet; don't expose unrestricted API access publicly.

If your proxy is a host-level Caddy instance:

```caddyfile
deadlook.YOUR_DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
```

A containerized proxy needs a shared network/reachable host upstream instead.

## Updates and checks

Merge an approved PR to main → tests/browser checks → image published →
server updates in roughly five minutes, plus build/pull time. Short restart.

```sh
systemctl --user list-timers podman-auto-update.timer
journalctl --user -u deadlook.service -f
journalctl --user -u podman-auto-update.service -n 50
```

Local server.env and the named deadlook-data volume survive updates.
Automatic failed-start rollback uses the HTTP healthcheck; it cannot detect
every application bug. See AUTO-DEPLOY.md for pinning, rollback and backups.

## Collaboration

Invite your friend as a repository collaborator. Each agent uses a feature
branch/worktree and submits a PR. Protect main where your GitHub plan allows.
Read AGENTS.md and docs/DESIGN.md. Do not develop directly in production.
