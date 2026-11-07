# Deadlook

Repository: https://github.com/konkentrate/Deadlook ·
[Home-server quickstart](deploy/QUICKSTART.md) · [Design guide](docs/DESIGN.md)

A self-hosted Deadlock match-history dashboard and build explorer.
Unofficial fan project, not affiliated with Valve or Statlocker.

## Stack

- Svelte 5 + TypeScript + Vite for both match history and Build Finder.
- Tabler Core components/layout + Tabler Svelte icons, bundled locally.
- Shared Deadlook design system: [docs/DESIGN.md](docs/DESIGN.md).
- Node 22 + Express serves both pages and proxies specific Deadlock API endpoints.
- Atomic JSON disk cache; no database, Redis, Steam client, or ingestion daemon required.
- Rootless Podman-ready, non-root production container.

The app reads available community API data; it does not collect missing games from Steam.
Build Finder uses the live per-hero player scoreboard from Deadlock API, cached for
five minutes, with rank/win-rate/matches sorting and a minimum-game threshold.
The season, time window and match-type controls apply to both rankings and builds.
Rank points are reported ranked progress, not a proprietary hero skill rating.
History summaries, seasons, item analytics and detailed match builds also come from the API.
Detailed data may be missing or have different coverage than history.

## Branding

The custom eye-and-ring logo is inspired by the game's visual language, not an
official Valve mark. Shared colors live in public/theme.css:
base_text (#ffefd7), deadlock_green (#69e799), dark gray (#1a1a1a),
and supporting colors. Sources: game's assets via
https://api.deadlock-api.com/v1/assets/colors and the locally installed Steam logo.
No external fonts or image-generation service is needed.

## Local development

Requires Node 22.12+ and npm. From this directory:

```sh
npm ci
cp .env.example .env  # only if you do not already have .env
```

In terminal 1:

```sh
npm run dev:server
```

In terminal 2:

```sh
npm run dev
```

Open http://localhost:5173. Vite provides hot reload and proxies /api to port 3001.
The development backend uses data-dev/ and watches for server changes.
Keep development away from the production data volume.

Tests and production build:

```sh
npm test
npm run build
npx playwright install chromium  # once, for browser tests
npm run test:ui
npm start
```

Browser tests use API fixtures rather than real player data. On this workstation,
use PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ui to reuse the
installed browser. CI runs these checks before publishing.

The last command serves the compiled app at http://localhost:3000.
There is no bundled or server-wide player preset. Fresh browsers start with player
search. Use Make my default to remember a player in that browser; Clear default
removes the choice. Older Matchbook browser preferences remain readable.

## Deploy now: rootless Podman

On the server, install Podman with Quadlet support (prefer Podman 5+) and Git.
Use a dedicated unprivileged account. Clone the shared repository, then from its root:

```sh
# Node/npm are NOT needed on the server for container builds.
podman build -f Containerfile -t localhost/deadlook:production .
mkdir -p ~/.config/containers/systemd ~/.config/deadlook
cp deploy/deadlook.container ~/.config/containers/systemd/
cp deploy/server.env.example ~/.config/deadlook/server.env
chmod 600 ~/.config/deadlook/server.env
# Edit server.env only if you want to supply an optional API key.
systemctl --user daemon-reload
systemctl --user start deadlook.service
curl --fail http://127.0.0.1:3000/api/health
```

For boot-time startup without logging in, an administrator should enable lingering:

```sh
sudo loginctl enable-linger YOUR_SERVER_USER
```

Quadlet generates the service with WantedBy=default.target; do not try to enable
the generated service like a conventional installed unit.

Logs and health:

```sh
journalctl --user -u deadlook.service -f
podman healthcheck run deadlook
```

Only loopback port 3000 is published. Keep it that way when using a reverse proxy.
If 3000 is taken, change the LEFT-HAND port in deploy/deadlook.container and the
reverse proxy's upstream; keep the container's port 3000.

### Access from your workstation first

Before DNS/TLS is configured, use an SSH tunnel:

```sh
ssh -L 8080:127.0.0.1:3000 USER@SERVER
```

Then open http://localhost:8080.

### Domain and HTTPS

Use the server's existing Caddy/Nginx/Traefik. Example Caddy site:

```caddyfile
deadlook.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Replace the domain, point DNS at the server and configure HTTPS as appropriate.
If Caddy itself runs in a container, its loopback is NOT the host's loopback:
use a shared container network or a reachable host address instead.

There is no application authentication yet. For the initial friend-only deployment,
use a VPN (e.g. Tailscale) or reverse-proxy authentication. Don't expose an unrestricted
analytics proxy to the public internet, especially with an API key.

### Storage and backups

The named volume deadlook-data holds the API cache; code updates must not replace it.
Do not commit it to Git. It can accumulate raw player match data.
To take a consistent backup, briefly stop the service:

```sh
systemctl --user stop deadlook.service
podman volume export deadlook-data --output deadlook-data-backup.tar
systemctl --user start deadlook.service
```

Store backups outside the repository. Deleting the cache loses locally retained
history; upstream availability is not guaranteed.

## Two people / multiple agents: recommended workflow

1. Put the source in one private Git repository (GitHub, Forgejo or GitLab).
2. Each person clones it on their OWN machine; each agent works on a feature branch.
   For parallel agents on one machine, use separate git worktrees.
3. Use small pull requests, not direct edits on the production server.
4. Require review and passing checks on main.
5. The included GitHub workflow runs tests and builds; successful main pushes also
   publish production images to GHCR. PRs do not publish. Server auto-updates are
   opt-in: see [deploy/AUTO-DEPLOY.md](deploy/AUTO-DEPLOY.md).
6. Deploy only a reviewed main commit/tag. Keep the running server independent of
   development sessions. No production source bind mounts or Vite dev servers.

Example branch:

```sh
git switch main
git pull --ff-only
git switch -c feature/hero-summary
# work, then npm test && npm run build
git add <changed-source-files>
git commit -m "Add hero summary"
git push -u origin feature/hero-summary
```

### Simple manual release, with rollback

On the server, select a reviewed commit/tag in the deployment checkout:

```sh
git fetch origin --tags
git checkout --detach REVIEWED_COMMIT_OR_TAG
# Retain the currently running image before replacing the production tag:
podman tag localhost/deadlook:production localhost/deadlook:previous
podman build -f Containerfile -t localhost/deadlook:production .
systemctl --user restart deadlook.service
curl --fail http://127.0.0.1:3000/api/health
```

If the health check fails:

```sh
podman tag localhost/deadlook:previous localhost/deadlook:production
systemctl --user restart deadlook.service
```

The previous-image command is for subsequent releases, not the first deployment.
The current file-cache format has no database migrations. Revisit rollback/backups
before introducing schema migrations.

## Automatic GitHub deployment

The included workflow publishes main and commit-specific image tags to GHCR after
checks pass. An optional Podman timer pulls changed main images and restarts the
service about every five minutes. See [deploy/AUTO-DEPLOY.md](deploy/AUTO-DEPLOY.md)
for one-time setup, private registry authentication, health checks and rollback.
Automation is prepared but not active until GitHub and the server are configured.

## Current paths

The local project folder is still ~/Projects/deadlock-dashboard to avoid breaking
running commands. Package name and user-facing brand are Deadlook. A future clone
can simply be named deadlook.
