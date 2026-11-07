# Deadlook — agent rules

- Read README.md and docs/DEVELOPMENT.md; for UI changes also docs/DESIGN.md.
- Keep it small: Svelte 5 + TypeScript + Vite + Tabler; Node 22/Express;
  file cache. Discuss major dependencies, database services or routing changes first.
- Screens: src/pages/; shared UI: src/components/; helpers: src/lib/.
  Reuse components and Tabler primitives; Svelte owns interaction, not Bootstrap JS.
- Preserve /, /builds.html and share links. Player defaults are browser-local;
  never bundle a personal account or add a server-wide fallback. Keep Clear default.
- Theme: public/theme.css; logo: public/deadlook-eye.svg. Use tokens, not new palettes.
- Backend uses fixed, validated API routes; keep keys server-side, cache raw fields,
  disclose missing/stale data. Never imply complete match coverage.
- Test season boundaries, result scoring, request races and new behavior.

## Required change → preview → PR workflow

1. Fetch origin; start a task branch from origin/main in your OWN clone/worktree.
   Never switch branches or overwrite changes in another agent's checkout.
2. Run npm ci. Develop with npm run dev:server + npm run dev (localhost:5173).
   Development uses data-dev/, never production storage. One dev pair per host;
   use isolated container previews for simultaneous branches (docs/DEVELOPMENT.md).
3. Run npm test && npm run build && npm run test:ui; install Chromium if needed.
   Check empty/error states, keyboard access, desktop and 375px mobile.
4. Before requesting review, host the exact tested commit as an isolated preview
   using the guide: unique container/image/cache/port, no production secrets,
   mounts, network, auto-update labels or main image tags. Share via SSH/VPN.
   If you cannot host it, say so and provide reproduction steps; don't imply a URL exists.
5. Push ONLY the task branch; open a PR with summary, commit SHA, tests/results,
   preview URL/access instructions, testing checklist and UI screenshots if relevant.
6. Wait for passing GitHub checks, human testing and explicit owner merge approval.
   After changes, rebuild/retest the preview and update its SHA. Never self-approve.
7. Merge only with approval and passing checks; clean up only your preview afterward.
   **Merging/pushing main releases production.** Ordinary tasks must not deploy,
   change proxy/server secrets or run Steam ingestion. PR checks do not publish.

## Safety / production

- Never commit .env*, caches, personal exports, tokens or Steam sessions
  (only documented *.example configuration templates may be committed).
- Production: rootless Podman on the proxy's existing network, alias deadlook,
  upstream http://deadlook:3000; no host port. See deploy/QUICKSTART.md and AUTO-DEPLOY.md.
