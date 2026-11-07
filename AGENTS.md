# Deadlook — agent rules

- Read README.md; for UI changes also read docs/DESIGN.md.
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
- Keep development simple: work and test locally, normally on main. Extra branches,
  worktrees, hosted previews and staging services are NOT required.
- Local setup: npm ci; run npm run dev:server and npm run dev in two terminals.
  Open localhost:5173 (API:3001); development cache is data-dev/, not production.
  Other developers can pull the commit and run the same commands locally.
- Before publishing: npm test && npm run build && npm run test:ui.
  Browser setup: npx playwright install chromium (or PLAYWRIGHT_CHROMIUM_EXECUTABLE).
  Check keyboard access, empty/error states, desktop and 375px mobile.
- When requested work is ready, commit and push main. GitHub checks/builds the image;
  the server automatically updates after publication. A push is a production release:
  don't push unfinished work. If unsure whether to release, ask the owner.
- PRs are optional when review is wanted; only then use a branch, include a brief
  summary/test results, and wait for checks/review before merging. No preview required.
- Fetch before publishing; don't overwrite others' changes or force-push main.
  Do not edit production source, proxy/server secrets or run Steam ingestion.
- Never commit .env*, caches, personal exports, tokens or Steam sessions
  (only documented *.example configuration templates may be committed).
- Production: rootless Podman on the proxy's existing network, alias deadlook,
  upstream http://deadlook:3000; no host port. See deploy/QUICKSTART.md and AUTO-DEPLOY.md.
