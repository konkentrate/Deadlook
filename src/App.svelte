<script lang="ts">
  import { IconHistory, IconStack2, IconChartLine, IconExternalLink, IconCircleFilled } from '@tabler/icons-svelte';
  import History from './pages/History.svelte';
  import BuildFinder from './pages/BuildFinder.svelte';
  import Analysis from './pages/Analysis.svelte';
  const builds = location.pathname === '/builds.html';
  const analysis = location.pathname === '/analysis.html';
</script>

<div class="page">
  <a class="visually-hidden-focusable skip-link" href="#main">Skip to content</a>
  <header class="navbar navbar-expand-md d-print-none">
    <div class="container-xl gap-3 flex-wrap">
      <a class="navbar-brand deadlook-brand m-0" href="/" aria-label="Deadlook home">
        <img src="/deadlook-eye.svg" width="44" height="44" alt=""/>
        <span>DEADLOOK</span>
      </a>
      <nav class="nav nav-pills main-nav" aria-label="Main menu">
        <a class:active={!builds&&!analysis} class="nav-link" href="/" aria-current={!builds&&!analysis ? 'page' : undefined}><IconHistory size={18}/> Match history</a>
        <a class:active={builds} class="nav-link" href="/builds.html" aria-current={builds ? 'page' : undefined}><IconStack2 size={18}/> Build Finder</a>
        <a class:active={analysis} class="nav-link" href="/analysis.html" aria-current={analysis ? 'page' : undefined}><IconChartLine size={18}/> Match Analysis</a>
      </nav>
      <div class="ms-auto d-none d-lg-flex align-items-center gap-2 text-secondary small"><IconCircleFilled size={7} class="text-primary"/> SELF-HOSTED INTELLIGENCE</div>
    </div>
  </header>
  <div class="page-wrapper">
    <main id="main" tabindex="-1">{#if builds}<BuildFinder/>{:else if analysis}<Analysis/>{:else}<History/>{/if}</main>
    <footer class="footer footer-transparent d-print-none mt-auto">
      <div class="container-xl d-flex flex-wrap justify-content-between gap-3">
        <div><span class="fw-semibold">DEADLOOK</span><span class="text-secondary"> · Keep an eye on your game.</span><div class="text-secondary small mt-1">Unofficial fan project. Available API data may not include every match.</div></div>
        <a href="https://deadlock-api.com" target="_blank" rel="noreferrer" class="text-secondary d-inline-flex align-items-center gap-1 small">Powered by Deadlock API <IconExternalLink size={14}/></a>
      </div>
    </footer>
  </div>
</div>
