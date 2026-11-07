# Deadlook design system

This is the UI contract for humans and coding agents. Read this before changing
screens, shared components, tokens, navigation or UI dependencies.

## 1. Direction: a Deadlock field console

**Quiet, useful, game-native.** Charcoal surfaces, warm cream text, Deadlock green
for actions and selection. Dense enough to analyze, spacious enough to scan.
The eye-and-ring symbol and serif wordmark carry the game's occult character;
the rest of the interface is a legible analytics tool, not a decorative game HUD.

We use **Tabler Core 1.7.x** for the actual component system, not just as inspiration:
https://tabler.io/admin-template
https://docs.tabler.io/ui/

Use its cards, grid, buttons, forms, alerts, badges, tables and utilities.
Do not rebuild these primitives in custom CSS or introduce Tailwind/Bootstrap
as another dependency. Tabler includes Bootstrap-derived styles already.

## 2. Ownership and files

| Concern | Source of truth |
| --- | --- |
| Game/brand palette | public/theme.css |
| Tabler token bindings + game-only styles | src/style.css |
| Brand mark / favicon | public/deadlook-eye.svg |
| App shell and navigation | src/App.svelte |
| Match-history screen | src/pages/History.svelte |
| Build Finder screen | src/pages/BuildFinder.svelte |
| Match Analysis screen | src/pages/Analysis.svelte |
| Shared UI patterns | src/components/ |
| Preferences / formatting | src/lib/ |
| Browser regression tests | tests/ui/dashboard.spec.ts |

All three pages are Svelte. There is **no legacy vanilla Build Finder**.
index.html, builds.html and analysis.html mount the same Svelte shell.
Keep all three URLs working on full refresh, plus Build Finder #hero=ID&p=ID
and analysis ?p=ID&hero=ID&match=ID links. Normal menu links suffice; no router.

The browser gets bundled, self-hosted Tabler CSS and Svelte icons through npm.
No CDN dependency, font CDN or paid Tabler license is required for this core UI.
Do not edit vendored node_modules styles.

## 3. Tokens, color and meaning

The palette derives from the game's named asset colors:
https://api.deadlock-api.com/v1/assets/colors

| Token | Use |
| --- | --- |
| --dl-bg / #1a1a1a | Page canvas |
| --dl-panel / #242420 | Cards and navigation |
| --dl-panel-raised / #2e2c27 | Supporting surfaces |
| --dl-line / #45433c | Quiet borders |
| --dl-cream / #ffefd7 | Primary text and brand |
| --dl-muted / #b3ac9e | Metadata and secondary labels |
| --dl-green / #69e799 | Primary actions, selection, wins |
| --dl-green-light | Links and highlighted values |
| --dl-red | Losses, destructive/error feedback |
| --dl-gold | Caution, degraded data |
| --dl-weapon / --dl-vitality / --dl-spirit | Item categories only |

Surface neutrals and accessible supporting colors are ours, not claimed to be
official Valve palette entries. The logo is an original inspired mark.

Map these into --tblr-* custom properties once in src/style.css. New features
should use text-primary, text-secondary, btn-primary, bg-success-lt, etc.
Do not scatter new hex values into components.

Green buttons use dark text, not cream/white text. Keep text contrast usable.
Never indicate a result or selected state by color alone:
- Results include Win/Loss/Not scored text.
- Navigation includes aria-current.
- Hero controls include aria-pressed and a visible outline.
- Sold items include a Sold timestamp, not just dimmed icons.

## 4. Typography, icons and spacing

- Body: system sans-serif, controlled by --tblr-font-sans-serif.
- Georgia/serif: brand wordmark only. No webfont dependency.
- Page title: page-title, one h1 per page.
- Section title: card-title on h2. Subsections use h3.
- Labels: form-label. Supporting copy: text-secondary small.
- Numeric data: font-monospace when it helps compare IDs, KDA or timings.
- Icons: @tabler/icons-svelte, normally 16–20 px; avoid emoji as UI icons.
- Use Tabler spacing: gap-2/gap-3, g-3, mb-4, card-body/card-header.
- Prefer the framework's defaults; avoid arbitrary offsets and absolute positioning.

## 5. Layout and shared patterns

Every page follows:

1. Shared navbar (logo + Match history + Build Finder).
2. PageHeader: eyebrow, title, one sentence of description, primary actions.
3. page-body > container-xl.
4. Filters/lookup and content composed with row, col-*, row-cards, card.
5. Shared footer with data-source and unofficial-project disclosure.

History: lookup → player identity → four summary cards → filtered match table.
Build Finder: global filters → hero picker → player-list / build-detail columns.
Analysis: player/filters → economy → comparisons → interval tempo → route → review prompts.
See ANALYSIS.md for formulas, position decoding and limits on coaching claims.
Below lg, Build Finder stacks. Lists scroll inside their cards rather than
turning the whole page into an unbounded leaderboard.

### Existing reusable components

- PageHeader: title/description and optional actions snippet.
- PlayerLookup: labeled search, loading/error/results, onselect(Profile).
- MatchResult: consistent outcome mapping and textual status badge.
- Modal: native dialog with Tabler card framing.
- ItemGrid: item visuals, category borders, tier and timing.
- AbilityStrip: ordered ability points and upgrade labels.
- EconomyChart: SVG net-worth curves with text/line-style legends and checkpoint table.
- RouteMap: sampled world-space path; breaks at deaths, recording gaps and large jumps.

Reuse these before creating another version. Keep data fetching in screens or
small lib modules, not inside presentational ItemGrid/MatchResult.

### Standard patterns

Primary action:

```svelte
<button class="btn btn-primary" disabled={loading} onclick={refresh}>
  <IconRefresh size={18}/> Sync history
</button>
```

Section:

```svelte
<section class="card" aria-labelledby="section-title">
  <div class="card-header">
    <h2 class="card-title" id="section-title">Section title</h2>
  </div>
  <div class="card-body">...</div>
</section>
```

Filters: visible form-label + form-select/form-control, inside row g-3 with
responsive col-* wrappers. Never use a placeholder as the only label.

Data table: table-responsive > table.table.table-vcenter.card-table, semantic
thead/th/tbody, compact metadata beneath the main value. Horizontal scrolling
is allowed inside a table on small screens, not on the document itself.

## 6. Interaction: Svelte owns it

Use Svelte 5 state/derived values and callbacks. We load Tabler CSS, **not its
Bootstrap JavaScript runtime**. Don't import bootstrap.js or attach data-bs-toggle
handlers alongside Svelte state: that creates competing DOM ownership.

Use native dialog.showModal() for the match inspector. It provides focus trapping,
Escape dismissal and focus restoration, while card classes provide its look.
Use the shared Modal instead of handmade overlays.

Avoid {@html}, innerHTML, manually attached document handlers and imperative
DOM updates for API data. Use Svelte event handlers and keyed rendering where
identity matters. Icons in icon-only buttons need an accessible button label.

## 7. Data presentation is part of the design

Never make incomplete data look authoritative.

- API-derived ranking != all Deadlock players or Statlocker's hero rating.
- Rank-point ordering is reported ranked progress, not hero-specific skill.
- A history entry does not guarantee metadata, items or replay availability.
- Show fetched timestamps, stale-cache warnings and unavailable-data states.
- No-data is not zero performance. Use an em dash or explanatory empty state.
- Seasons use API intervals: start inclusive, end exclusive.
- The history season filter includes all modes within the season dates.
- History win rate uses only scored wins/losses.
- History KDA is the mean per-match ratio.
- Build Finder KDA is the aggregate ratio. Keep labels distinct.
- Typical-item percentages are coverage-dependent estimates.
- Match purchase timelines show actual available events, not inferred builds.
- Keep all retained-history exports clearly separate from filtered views.

## 8. State checklist for every feature

Design all of these before declaring a feature finished:

- Initial / nothing selected.
- Loading, without flashing misleading zero stats.
- Successful data.
- Empty filtered result.
- Error with a readable explanation and retry path.
- Cached/stale data, visibly disclosed.
- Missing optional assets/metadata, with a fallback.
- Rapidly changing selections: stale requests must not overwrite the new view.

Use Tabler spinner-border, empty and alert components. Don't invent an error
color or loader for each page. Keep disabled actions readable.

## 9. Accessibility and responsive checks

- Full keyboard access; focus ring must remain visible.
- Button for actions, link for navigation.
- Visible input labels; label and control IDs must match.
- Text for statuses, aria-current / aria-pressed for selection.
- Preserve native dialog keyboard behavior.
- Respect prefers-reduced-motion.
- Test at 375/390 px and desktop width. No page-level horizontal overflow.
- Keep the menu usable without a JavaScript-powered mobile collapse.
- Hero/item/ability images are not the only way to identify their meaning.
- Do not remove useful text only to make a screenshot cleaner.

## 10. Change procedure / definition of done

1. Read this guide and inspect the existing component.
2. Pick a Tabler pattern before adding CSS.
3. If custom styling is necessary, it belongs to brand binding or a domain
   primitive (hero tiles, item tiles, ability strip, game strip). Use dl-* names.
4. Update shared components rather than patching one page inconsistently.
5. Add/update fixture-based UI regression tests when behavior changes.
6. Run npm test && npm run build && npm run test:ui.
7. Review desktop/mobile screenshots and the browser console.
8. Confirm live data behavior if API integration changed.
9. Document any new shared pattern here.

Local browser setup: npx playwright install chromium.
On this workstation, the existing browser can be used with:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:ui

UI tests mock API responses, so CI does not depend on Steam credentials,
personal match history or upstream availability.

Avoid scope creep: do not add a theme switcher, router, charting library,
authentication UI or unrelated feature just to complete a visual change.
