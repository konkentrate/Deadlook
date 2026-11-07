# GitHub → GHCR → rootless Podman

Push/merge to main → checks → multi-architecture image publication →
server checks GHCR every ~5 minutes → pull changed image → restart Deadlook.

No inbound SSH access from GitHub, no server credentials in GitHub Actions,
and no development source directories mounted into production.

## 1. GitHub repository (one time)

Repository: https://github.com/konkentrate/Deadlook (private). Use main as the production branch.
For the shortest setup path, see QUICKSTART.md and run bash deploy/install-server.sh.
The included .github/workflows/check.yml runs checks on PRs and main.
Only successful main pushes publish images:

- ghcr.io/konkentrate/deadlook:main — moving production channel.
- ghcr.io/konkentrate/deadlook:sha-FULL_COMMIT_SHA — release-specific rollback reference.
  Treat these as immutable by convention; registry tags are technically mutable.

The image path is the LOWERCASE GitHub owner/repository, not necessarily deadlook.
Images target linux/amd64 and linux/arm64. The actual server architecture still
needs verification. Cross-builds can take several minutes.

Publishing uses GitHub's automatically supplied GITHUB_TOKEN with packages:write.
No manually created publishing token is necessary. An organization may restrict
package publication or Actions permissions; check its settings if publication fails.
Wait for the first successful publish before starting the server service.

Protect main:
- require pull requests and passing test-and-build;
- require review by the other person if desired;
- agents push feature branches, not main.

PRs never publish images. The workflow checks/tests the app, not every aspect of
its runtime behavior; a green build cannot guarantee a bug-free release.

## 2. Server configuration (one time)

Use Podman 5+ with Quadlet and a working systemd user manager.
From a checkout, as the unprivileged account that will run Deadlook:

```sh
mkdir -p ~/.config/containers/systemd ~/.config/containers ~/.config/deadlook
# Only if server.env doesn't already exist:
cp -n deploy/server.env.example ~/.config/deadlook/server.env
chmod 600 ~/.config/deadlook/server.env
# Do not overwrite existing registry credentials:
test -f ~/.config/containers/auth.json || printf '{"auths":{}}\n' > ~/.config/containers/auth.json
chmod 600 ~/.config/containers/auth.json
cp deploy/deadlook-auto.container ~/.config/containers/systemd/deadlook.container
```

The Quadlet is configured for ghcr.io/konkentrate/deadlook:main and Network=proxy.
For manual installation, set Network= to the existing runtime network name from
podman network ls (often systemd-proxy for proxy.network). Use the same rootless
user as the proxy. The installer auto-detects these two common network names.

This file REPLACES the manual Quadlet. Do not leave a second .container file
running another service with the same container name/port.

### Private GHCR packages

For a private image, create a GitHub PAT (classic) with read:packages only,
from an account that has access to the package. Organizations may require SSO
authorization. Authenticate interactively; do NOT put the token into Git:

```sh
podman login --authfile ~/.config/containers/auth.json ghcr.io
```

Enter the GitHub username and read-only token when prompted.
Do this before pulling/starting the private image.

Both initial image pulls and auto-updates use that persistent auth file.
Do not use only Podman's default runtime auth file: it may disappear after reboot.

A public package avoids server-side registry credentials, but the app's source
and container contents then need to be suitable for public distribution.
Never bake .env or API keys into the image; our build excludes .env and data.

### Start and verify

```sh
systemctl --user daemon-reload
systemctl --user restart deadlook.service
podman healthcheck run deadlook
journalctl --user -u deadlook.service -n 50
```

No host port is published. Configure the containerized reverse proxy separately
with upstream http://deadlook:3000 on the shared network. The script does not alter
the proxy. The named deadlook-data volume and server.env survive replacements.

For boot-time startup, an administrator should enable user lingering:

```sh
sudo loginctl enable-linger YOUR_SERVER_USER
```

## 3. Enable the five-minute update check

```sh
mkdir -p ~/.config/systemd/user/podman-auto-update.timer.d
cp deploy/podman-auto-update.timer.d/override.conf ~/.config/systemd/user/podman-auto-update.timer.d/
systemctl --user daemon-reload
systemctl --user enable --now podman-auto-update.timer
systemctl --user list-timers podman-auto-update.timer
```

This customizes Podman's built-in timer for ALL containers opted into registry
auto-update under this user, not just Deadlook. Other containers without the
auto-update policy are unaffected.

Try a non-mutating check:

```sh
REGISTRY_AUTH_FILE="$HOME/.config/containers/auth.json" podman auto-update --dry-run
```

Trigger a real check now (can update/restart every opted-in container for this user):

```sh
systemctl --user start podman-auto-update.service
journalctl --user -u podman-auto-update.service -n 50
```

Expect publication time PLUS up to ~5 minutes for deployment, plus image pulling.
This is a short restart, not zero-downtime deployment. If publication fails, the
existing image stays running. Registry/network failures prevent updates rather
than intentionally stopping the current app.

Notify=healthy makes service startup wait for the image's HTTP healthcheck.
Podman auto-update defaults to rollback when the updated systemd service fails
to start. This improves failed-start detection; it does not detect every UI bug,
bad query, or later data corruption. Test this behavior on the actual server.

## 4. Pause, pin, and roll back

Emergency pause for all auto-updated containers under this user:

```sh
systemctl --user stop podman-auto-update.timer
```

For a Deadlook-only rollback:
1. In ~/.config/containers/systemd/deadlook.container, change Image= to the
   known-good ghcr.io/konkentrate/deadlook:sha-FULL_COMMIT_SHA.
2. Remove AutoUpdate=registry so that release remains pinned.
3. Reload/restart and verify:

```sh
systemctl --user daemon-reload
systemctl --user restart deadlook.service
podman healthcheck run deadlook
```

A container rollback does not roll back the data volume. Back up retained match
data before future releases that change its format.

To resume, restore Image=...:main and AutoUpdate=registry, reload/restart, then
start podman-auto-update.timer again if it was stopped.

## Activation status

The GitHub workflow publishes on successful main pushes. Server-side updates
remain inactive until you install the service and enable the timer. Confirm
server architecture, SSH destination and proxy during setup. See README.md for local development and non-automated deployment.
