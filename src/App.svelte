<script lang="ts">
  import { IconHistory, IconStack2, IconChartLine, IconExternalLink, IconCircleFilled, IconChevronDown, IconBulb } from '@tabler/icons-svelte';
  import History from './pages/History.svelte';
  import BuildFinder from './pages/BuildFinder.svelte';
  import BuildHelper from './pages/BuildHelper.svelte';
  import Analysis from './pages/Analysis.svelte';
  const builds = location.pathname === '/builds.html';
  const buildHelper = location.pathname === '/build-helper.html';
  const analysis = location.pathname === '/analysis.html';
  const inBuilds = builds || buildHelper;
</script>

<div class="page">
  <a class="visually-hidden-focusable skip-link" href="#main">Skip to content</a>
  <header class="navbar navbar-expand-md d-print-none">
    <div class="container-xl gap-3 flex-wrap">
      <a class="navbar-brand deadlook-brand m-0" href="/" aria-label="Deadlook home">
        <img class="dl-brand-eye" src="/deadlook-eye.svg" width="44" height="44" alt=""/>
        <img class="dl-brand-wordmark" src="/deadlook-wordmark.svg" width="176" height="24" alt="Deadlook"/>
      </a>
      <nav class="nav nav-pills main-nav" aria-label="Main menu">
        <a class:active={!inBuilds&&!analysis} class="nav-link" href="/" aria-current={!inBuilds&&!analysis ? 'page' : undefined}><IconHistory size={18}/> Match history</a>
        <details class="nav-build-menu" open={false}>
          <summary class:active={inBuilds} class="nav-link" aria-current={inBuilds ? 'page' : undefined}><IconStack2 size={18}/> Build <IconChevronDown size={15}/></summary>
          <div class="nav-build-submenu" aria-label="Build tools">
            <a class:active={builds} href="/builds.html" aria-current={builds ? 'page' : undefined}><IconStack2 size={17}/> Build Finder</a>
            <a class:active={buildHelper} href="/build-helper.html" aria-current={buildHelper ? 'page' : undefined}><IconBulb size={17}/> Build Helper</a>
          </div>
        </details>
        <a class:active={analysis} class="nav-link" href="/analysis.html" aria-current={analysis ? 'page' : undefined}><IconChartLine size={18}/> Match Analysis</a>
      </nav>
      <div class="ms-auto d-none d-lg-flex align-items-center gap-2 text-secondary small"><IconCircleFilled size={7} class="text-primary"/> SELF-HOSTED INTELLIGENCE</div>
    </div>
  </header>
  <div class="page-wrapper">
    <main id="main" tabindex="-1">{#if builds}<BuildFinder/>{:else if buildHelper}<BuildHelper/>{:else if analysis}<Analysis/>{:else}<History/>{/if}</main>
    <footer class="footer footer-transparent d-print-none mt-auto">
      <div class="container-xl d-flex flex-wrap justify-content-between gap-3">
        <div><img class="dl-footer-wordmark" src="/deadlook-wordmark.svg" width="104" height="14" alt="Deadlook"/><span class="text-secondary"> · Keep an eye on your game.</span><div class="text-secondary small mt-1">Unofficial fan project. Available API data may not include every match.</div></div>
        <a href="https://deadlock-api.com" target="_blank" rel="noreferrer" class="text-secondary d-inline-flex align-items-center gap-1 small">Powered by Deadlock API <IconExternalLink size={14}/></a>
      </div>
    </footer>
  </div>
</div>
