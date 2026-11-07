# Deadlook — agent rules

- Read README.md; for UI changes also read docs/DESIGN.md.
- Keep it small: Svelte 5 + TypeScript + Vite + Tabler; Node 22/Express;
  file cache. Discuss major dependencies, database services or routing changes first.
- Screens: src/pages/; shared UI: src/components/; helpers: src/lib/.
  Reuse components and Tabler primitives; Svelte owns interaction, not Bootstrap JS.
- Preserve /, /builds.html, share links and saved default-player preferences.
- Theme: public/theme.css; logo: public/deadlook-eye.svg. Use tokens, not new palettes.
- Backend uses fixed, validated API routes; keep keys server-side, cache raw fields,
  disclose missing/stale data. Never imply complete match coverage.
- Test season boundaries, result scoring, request races and new behavior.
- Before a PR: npm test && npm run build && npm run test:ui.
  Browser setup: npx playwright install chromium (or PLAYWRIGHT_CHROMIUM_EXECUTABLE).
  Check keyboard access, empty/error states, desktop and 375px mobile.
- One branch/worktree per agent/task; small reviewed PRs. Do not share a working tree.
- **Merging/pushing main automatically releases production.** Get owner approval;
  don't deploy, change server secrets or run Steam ingestion during ordinary tasks.
- Never commit .env*, caches, personal exports, tokens or Steam sessions
  (only documented *.example configuration templates may be committed).
- Deployment: deploy/QUICKSTART.md; details/rollback: deploy/AUTO-DEPLOY.md.
