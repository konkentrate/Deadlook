# Development, review and isolated previews

Every change follows: **task branch → tests → shared preview → PR → owner
approval → merge**. A main push publishes production; never use main as a test
environment. Use AGENTS.md for the short rules and DESIGN.md for UI decisions.

## 1. Own checkout and branch

Start from current origin/main. Do not reuse another agent's checkout:

```sh
git fetch origin
git worktree add -b feature/short-description ../deadlook-short-description origin/main
cd ../deadlook-short-description
npm ci
```

Separate clones also work. Each worktree needs its own node_modules and cache.
Keep changes focused; don't discard unrelated work or force-push shared branches.
Use a new branch for follow-up work after a squash merge.

## 2. Interactive development

Requires Node 22.12+. In two terminals, from your own checkout:

```sh
npm run dev:server
npm run dev
```

Open http://localhost:5173. Vite proxies API requests to localhost:3001.
The backend uses data-dev/, separate from the production cache. No API key is
required; don't copy production .env or registry credentials into a development
checkout. If needed, copy .env.example to a new .env, never over an existing file.

There can be only one default 5173/3001 development pair per host. Vite silently
choosing a different frontend port does NOT isolate its backend. For simultaneous
branches, use the unique-port compiled previews below (or separate hosts).
Do not expose the Vite dev server to the public internet.

## 3. Required verification

```sh
npm test
npm run build
npx playwright install chromium   # once per machine
npm run test:ui
```

On the original workstation, Chromium can be reused:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ui.

The browser tests start a fixture server on port 4173; don't run multiple suites
on the same host/port or reuse another branch's running fixture server.
UI tests mock API responses; additionally check the preview against live data.
Verify both / and /builds.html, share links, fresh-browser/no-player state,
save/clear default, missing/error/stale data, keyboard access and 375px mobile.
Player preferences are local to a browser origin; use an incognito window when
testing the initial state. Record actual results, not merely commands you ran.

## 4. Host a preview for another developer

Use a development machine or dedicated rootless Podman preview account, ideally
NOT the production host/user. Only run reviewed/trusted PR code: containers are
not a complete sandbox for arbitrary untrusted changes.

Use a unique numeric PR/task identifier and an unused host port. Example for PR 2
(replace these values for your task). Build the exact committed branch code:

```sh
git status --short             # must be clean
git rev-parse HEAD            # record this SHA in the PR
podman build -f Containerfile -t localhost/deadlook:pr-2 .
podman run -d --name deadlook-pr-2 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop=all --security-opt=no-new-privileges \
  --publish 127.0.0.1:3102:3000 \
  --volume deadlook-pr-2-data:/app/data \
  localhost/deadlook:pr-2
podman healthcheck run deadlook-pr-2
curl --fail http://127.0.0.1:3102/api/health
```

This uses the container's default network, NOT the production proxy network.
It doesn't publish images, touch systemd units or enable auto-updates.
The unique named volume is only for preview API cache. NEVER mount deadlook-data,
production directories or the Podman socket, and never pass production secrets.
Do not bind-mount the production source. Preserve the preview while reviewers
test it, and stop it when it is no longer needed.

From the reviewer's workstation:

```sh
ssh -N -L 8082:127.0.0.1:3102 PREVIEW_USER@PREVIEW_HOST
```

Review http://localhost:8082 and http://localhost:8082/builds.html.
Choose another local tunnel port if 8082 is already occupied.
The PR should list the SSH endpoint/port and access prerequisites, but never
passwords, tokens or private keys. Grant access out-of-band through the owner.

A private VPN or a dedicated authenticated staging proxy is also acceptable;
ask before changing proxy configuration. Never expose a no-login preview publicly.
If hosting/access is unavailable, say so explicitly and provide local checkout
instructions instead of inventing a preview address.

To test an existing PR locally, in your own disposable checkout:

```sh
gh pr checkout 2
npm ci
npm test
npm run build
npm run test:ui
```

Then run development mode or build the isolated container as above.

## 5. PR, review and merge

```sh
git push -u origin feature/short-description
gh pr create --base main --title "Describe the change" --body-file /path/to/pr-body.md
```

Include:
- What changed and why; risks/compatibility/config changes.
- Tested commit SHA and test results.
- Actual preview URL or tunnel instructions, availability and limitations.
- Reviewer steps and expected results; desktop/mobile screenshots for UI changes.

PR CI tests/builds and checks the container, but does NOT publish preview images,
create a hosted environment or deploy. Hosting a preview is a separate step.
After a revision, rerun checks, rebuild/restart the preview from the new commit
and update the recorded SHA; warn reviewers while the preview is unavailable.

Wait for green GitHub checks, human review/testing and explicit owner approval
before merging. Do not bypass failed/pending checks or approve your own PR.
An approved main merge publishes GHCR images; the production server then picks
up the new image through its existing timer. Don't manually restart production
to test a branch. Report publication/rollout status accurately, not just merge status.

## 6. Clean up only your preview

After review/merge, remove only the resources for your task:

```sh
podman rm -f deadlook-pr-2
podman volume rm deadlook-pr-2-data  # intentionally deletes this preview cache
podman image rm localhost/deadlook:pr-2
```

Never run broad container/image/volume prune commands on the server.
Keep production backups, services and other agents' environments untouched.
