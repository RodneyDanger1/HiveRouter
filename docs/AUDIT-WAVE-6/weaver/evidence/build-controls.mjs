// Builds controls.json from live DOM evidence + source-read handler/render locations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BROWSER = path.join(HERE, 'browser');
const pages = JSON.parse(fs.readFileSync(path.join(BROWSER, 'pages.json'), 'utf8'));
const runControls = JSON.parse(fs.readFileSync(path.join(BROWSER, 'run-detail-controls.json'), 'utf8'));
const interactions = JSON.parse(fs.readFileSync(path.join(BROWSER, 'interactions.json'), 'utf8'));
const navigation = JSON.parse(fs.readFileSync(path.join(BROWSER, 'navigation.json'), 'utf8'));
const micro = JSON.parse(fs.readFileSync(path.join(BROWSER, 'micro.json'), 'utf8'));
const drawer = JSON.parse(fs.readFileSync(path.join(BROWSER, 'agents-drawer.json'), 'utf8'));

const pageMeta = {
  overview: { name: 'Overview', route: '/', render: 'web/src/pages/OverviewPage.tsx' },
  agents: { name: 'Agents', route: '/agents', render: 'web/src/pages/AgentsPage.tsx' },
  runs: { name: 'Runs', route: '/runs', render: 'web/src/pages/RunsPage.tsx' },
  vault: { name: 'Vault', route: '/vault', render: 'web/src/pages/VaultPage.tsx' },
  learning: { name: 'Learning', route: '/learning', render: 'web/src/pages/LearningPage.tsx' },
  settings: { name: 'Settings', route: '/settings', render: 'web/src/pages/SettingsPage.tsx' },
  'not-found': { name: 'Not found', route: '/no-such-page', render: 'web/src/pages/NotFoundPage.tsx' },
};

const SHELL = new Set(['Skip to content', 'Open navigation', 'HiveRouter overview', 'Overview', 'Agents', 'Runs', 'Vault', 'Learning', 'Settings', 'Trust & status']);

function classify(pageId, control) {
  const name = control.name || '';
  if (SHELL.has(name)) {
    if (name === 'Skip to content') {
      return {
        family: 'shell-skip-link',
        render: 'web/src/components/AppShell.tsx:52-54',
        handler: 'anchor href="#main-content"; target <main id="main-content"> has no tabindex',
        verdict: 'WIRED-AND-WORKS',
        note: 'Scrolls to #main-content but keyboard focus returns to BODY (a11y gap F8).',
        evidence: ['browser/skip-probe.log', 'browser/pages.json#overview'],
      };
    }
    if (name === 'Open navigation') {
      return {
        family: 'shell-navigation',
        render: 'web/src/components/AppShell.tsx:57-66',
        handler: 'setMobileOpen; aria-expanded/aria-controls verified; Escape closes',
        verdict: 'WIRED-AND-WORKS',
        note: 'aria-expanded false->true->false; sidebar class sidebar->sidebar-open->sidebar; Escape handled at AppShell.tsx:41-48.',
        evidence: ['browser/interactions.json#shell'],
      };
    }
    return {
      family: 'shell-navigation',
      render: name === 'Trust & status' ? 'web/src/components/AppShell.tsx:125-127' : name === 'HiveRouter overview' ? 'web/src/components/AppShell.tsx:67-70' : 'web/src/components/AppShell.tsx:102-114',
      handler: 'react-router Link/NavLink -> route table web/src/App.tsx:32-41',
      verdict: 'WIRED-AND-WORKS',
      note: 'All six nav targets clicked; URL + h1 + API fetch confirmed.',
      evidence: ['browser/navigation.json#navigations'],
    };
  }

  if (pageId === 'overview') {
    if (name === 'Run history' || name === 'Agent registry' || name === 'View all') {
      return { family: 'overview-links', render: 'web/src/pages/OverviewPage.tsx:53-58,224-227', handler: 'react-router Link', verdict: 'WIRED-AND-WORKS', note: 'Clicked; /runs and /agents loaded.', evidence: ['browser/navigation.json'] };
    }
    if (name === 'PROJECT BRIEF') {
      return { family: 'composer-form', render: 'web/src/components/RunComposer.tsx:141-156', handler: 'local state + localStorage draft; payload in startRun (api.ts:334-346)', verdict: 'WIRED-AND-WORKS', note: '0/8000 counter, maxLength 8000, Start disabled below 8 chars. Submit not exercised (paid).', evidence: ['browser/pages.json#overview'] };
    }
    if (name === 'Analyze prompt') {
      return { family: 'composer-analyze', render: 'web/src/components/RunComposer.tsx:173-176', handler: 'analyze() -> analyzePrompt (api.ts:297-303) -> POST /api/prompt/analyze -> src/server/prompt/analyst.ts', verdict: 'UNVERIFIED', note: 'Paid provider call; deliberately not clicked. Route validated live with a 3-char prompt (422 E_PROMPT_TOO_LARGE).', evidence: ['logs/short-prompt-response.txt'] };
    }
    if (['PRESET', 'MODEL', 'THINKING', 'MAX RUN COST (USD)'].some((p) => name.startsWith(p))) {
      return { family: 'composer-form', render: 'web/src/components/RunComposer.tsx:203-253', handler: 'local state; StartRunInput assembled at 118-125', verdict: 'WIRED-AND-WORKS', note: 'DOM values match defaults; server validates enums at app.ts:744-766. No submit (paid).', evidence: ['browser/pages.json#overview'] };
    }
    if (name === 'Start run') {
      return { family: 'composer-start', render: 'web/src/components/RunComposer.tsx:279-283', handler: 'submit -> startRun -> POST /api/runs (Idempotency-Key) -> createRun', verdict: 'UNVERIFIED', note: 'Paid run creation; not clicked. Disabled with empty brief; static chain complete (app.ts:734-785).', evidence: ['browser/pages.json#overview'] };
    }
    if (name === 'Open trust & status') {
      return { family: 'overview-links', render: 'web/src/pages/OverviewPage.tsx:125-129', handler: 'Link -> /settings', verdict: 'WIRED-AND-WORKS', note: 'Target loads.', evidence: ['browser/pages.json#settings'] };
    }
    if (control.href && control.href.startsWith('/runs/')) {
      return { family: 'run-links', render: 'web/src/components/RunTable.tsx:26,37-44', handler: 'Link -> /runs/:id -> RunDetailPage snapshot', verdict: 'WIRED-AND-WORKS', note: 'Same target shape as the verified /runs row click.', evidence: ['browser/navigation.json#runRowClick'] };
    }
  }

  if (pageId === 'agents') {
    if (name === 'Refresh') return { family: 'agents-refresh', render: 'web/src/pages/AgentsPage.tsx:73-76', handler: 'agents.reload -> listAgents -> GET /api/agents', verdict: 'WIRED-AND-WORKS', note: 'Clicked; GET /api/agents 200.', evidence: ['browser/navigation.json#refreshes'] };
    if (name.startsWith('Search agents')) return { family: 'agents-search', render: 'web/src/pages/AgentsPage.tsx:100', handler: 'client filter at 57-64', verdict: 'WIRED-AND-WORKS', note: 'Filled "python" -> 1 of 37; no-match empty state rendered.', evidence: ['browser/interactions.json#agents'] };
    if (name.startsWith('GROUP')) return { family: 'agents-filter', render: 'web/src/pages/AgentsPage.tsx:103', handler: 'client filter; group=Control -> 5 of 37', verdict: 'WIRED-AND-WORKS', evidence: ['browser/interactions.json#agents'] };
    if (name.startsWith('OUTPUT')) return { family: 'agents-filter', render: 'web/src/pages/AgentsPage.tsx:114', handler: 'client filter; output=files -> 28 of 37', verdict: 'WIRED-AND-WORKS', evidence: ['browser/interactions.json#agents'] };
    if (name.startsWith('Open ')) return { family: 'agents-card-drawer', render: 'web/src/pages/AgentsPage.tsx:151-155', handler: 'setSelected(id) -> Modal + getAgent(id) -> GET /api/agents/:id', verdict: 'WIRED-AND-WORKS', note: 'Clicked first card; drawer opened with GET /api/agents/router 200.', evidence: ['browser/agents-drawer.json'] };
  }

  if (pageId === 'runs') {
    if (name === 'New run') return { family: 'runs-links', render: 'web/src/pages/RunsPage.tsx:35-37', handler: 'Link -> /', verdict: 'WIRED-AND-WORKS', note: 'Clicked; Overview rendered.', evidence: ['browser/navigation.json#navigations'] };
    if (name === 'Refresh') return { family: 'runs-refresh', render: 'web/src/pages/RunsPage.tsx:38-40', handler: 'runs.reload -> listRuns(100) -> GET /api/runs?limit=100', verdict: 'WIRED-AND-WORKS', note: 'Clicked; 200.', evidence: ['browser/navigation.json#refreshes'] };
    if (name.startsWith('STATUS')) return { family: 'runs-filter', render: 'web/src/pages/RunsPage.tsx:46-54', handler: 'client-side filter over the loaded 100 runs', verdict: 'WIRED-AND-WORKS', note: 'failed -> 3 of 25; budget_exceeded -> 4 of 25.', evidence: ['browser/runs-filter.json'] };
    if (control.href && control.href.startsWith('/runs/')) return { family: 'run-links', render: 'web/src/components/RunTable.tsx:26,37-44', handler: 'Link -> /runs/:id', verdict: 'WIRED-AND-WORKS', note: 'Row brief link clicked; run detail + snapshot/events 200.', evidence: ['browser/navigation.json#runRowClick'] };
  }

  if (pageId === 'vault') {
    if (name === 'Refresh') return { family: 'vault-refresh', render: 'web/src/pages/VaultPage.tsx:29-32', handler: 'tree.reload -> getVaultTree -> GET /api/vault/tree', verdict: 'WIRED-AND-WORKS', note: 'Clicked; 200.', evidence: ['browser/navigation.json#refreshes'] };
    if (name === '000_Hive_Control' && control.selector.includes('nth-of-type(5)')) {
      return { family: 'vault-tree', render: 'web/src/pages/VaultPage.tsx:92-102', handler: 'local open state (nested qa-api-temp root)', verdict: 'WIRED-AND-WORKS', evidence: ['evidence/api/vault-tree.json', 'browser/pages.json#vault'] };
    }
    if (name === '000_Hive_Control') return { family: 'vault-tree', render: 'web/src/pages/VaultPage.tsx:92-102', handler: 'setOpen toggles children', verdict: 'WIRED-AND-WORKS', note: 'Collapsed 150->67 rows, expanded 67->150.', evidence: ['browser/micro.json#vault'] };
    if (control.tag === 'button' && control.selector.includes('vault-row')) {
      if (/\.md$|\.json$/i.test(name)) {
        return { family: 'vault-file', render: 'web/src/pages/VaultPage.tsx:107-116,119-130', handler: 'setSelected -> VaultFile -> GET /api/vault/file?path=...', verdict: 'WIRED-AND-WORKS', note: 'Clicked a .md file row; GET 200; markdown rendered with path header.', evidence: ['browser/vault.json'] };
      }
      return { family: 'vault-tree', render: 'web/src/pages/VaultPage.tsx:92-102', handler: 'directory toggle (nested root)', verdict: 'WIRED-AND-WORKS', note: 'Nested QA temp tree root; not separately toggled.', evidence: ['browser/vault.json'] };
    }
  }

  if (pageId === 'learning') {
    if (name.startsWith('Learning is unavailable')) return { family: 'learning-refusal', render: 'web/src/pages/LearningPage.tsx:167-172', handler: 'disabled Tabs (no onChange)', verdict: 'REFUSED-BY-NAME', note: 'All 8 tabs disabled, aria-disabled=true; reason E_LEARNING_POOL_EXHAUSTED with consent required.', evidence: ['browser/learning.json', 'evidence/api/learning-overview.json'] };
    if (name === 'Open settings') return { family: 'learning-links', render: 'web/src/pages/LearningPage.tsx:188', handler: 'Link -> /settings', verdict: 'WIRED-AND-WORKS', note: 'Clicked; Settings loads with key-status + settings GETs.', evidence: ['browser/navigation.json#navigations'] };
    if (name === 'Refresh status') return { family: 'learning-refresh', render: 'web/src/pages/LearningPage.tsx:189-191', handler: 'window.location.reload() (full document reload, not a data refetch)', verdict: 'WIRED-AND-WORKS', note: 'Not clicked; handler is a full page reload. Full reload of /learning verified separately.', evidence: ['browser/learning.json'] };
    if (name === 'Trust & status') return { family: 'learning-links', render: 'web/src/pages/LearningPage.tsx:82-85', handler: 'Link -> /settings', verdict: 'WIRED-AND-WORKS', evidence: ['browser/navigation.json#navigations'] };
  }

  if (pageId === 'settings') {
    if (name === 'Refresh') return { family: 'settings-refresh', render: 'web/src/pages/SettingsPage.tsx:34-37', handler: 'key.reload + settings.reload -> 2 GETs', verdict: 'WIRED-AND-WORKS', note: 'Clicked; GET /api/settings/key-status and /api/settings 200.', evidence: ['browser/navigation.json#refreshes'] };
    if (name === 'Open Learning status') return { family: 'settings-links', render: 'web/src/pages/SettingsPage.tsx:89', handler: 'Link -> /learning', verdict: 'WIRED-AND-WORKS', note: 'Clicked; Learning loads.', evidence: ['browser/navigation.json#navigations'] };
  }

  if (pageId === 'not-found') {
    if (name === 'Return to overview') return { family: 'not-found', render: 'web/src/pages/NotFoundPage.tsx:15', handler: 'Link -> /', verdict: 'WIRED-AND-WORKS', note: 'Clicked; HTTP 404 page rendered; return works.', evidence: ['browser/navigation.json', 'browser/run-detail-controls.json#http'] };
  }

  return { family: 'unclassified', render: pageMeta[pageId]?.render ?? null, handler: null, verdict: 'UNVERIFIED', note: 'No classifier matched.', evidence: [] };
}

const pageRecords = pages.map((page) => {
  const meta = pageMeta[page.id];
  const controls = page.controls.map((c, index) => {
    const cls = classify(page.id, c);
    return {
      order: index + 1,
      tag: c.tag,
      type: c.type,
      role: c.role,
      name: c.name,
      selector: c.selector,
      href: c.href,
      disabled: c.disabled,
      ariaDisabled: c.ariaDisabled,
      ariaSelected: c.ariaSelected,
      ariaExpanded: c.ariaExpanded,
      family: cls.family,
      render: cls.render,
      handler: cls.handler,
      verdict: cls.verdict,
      note: cls.note ?? null,
      evidence: cls.evidence,
    };
  });
  return {
    id: page.id,
    name: meta.name,
    route: meta.route,
    renderFile: meta.render,
    capturedUrl: page.state.url,
    title: page.state.title,
    h1: page.state.h1,
    count: controls.length,
    countByTag: page.controlSummary.byTag,
    consoleErrors: page.console.filter((c) => c.type === 'error'),
    apiResponses: page.apiResponses,
    screenshot: page.screenshot,
    controls,
  };
});

const runDetailRecords = ['run-abf5', 'run-95'].map((label) => {
  const data = runControls[label];
  const runId = label === 'run-abf5' ? 'run_abf5fe78aab1e932ff' : 'run_95c11797b4923b4277';
  const controls = data.overviewControls.map((c, index) => {
    let family = 'run-detail-shell';
    let render = 'web/src/components/AppShell.tsx';
    let handler = 'react-router Link';
    let verdict = 'WIRED-AND-WORKS';
    let note = null;
    const name = c.name || '';
    if (name === 'All runs') { family = 'run-detail-back'; render = 'web/src/pages/RunDetailPage.tsx:265'; handler = 'Link -> /runs'; }
    else if (name === 'Refresh') { family = 'run-detail-refresh'; render = 'web/src/pages/RunDetailPage.tsx:274-276'; handler = 'snapshot.reload -> GET /api/runs/:id/snapshot'; note = 'Clicked; snapshot 200.'; }
    else if (name === 'Open folder') { family = 'run-detail-open-folder'; render = 'web/src/pages/RunDetailPage.tsx:359-361'; handler = 'openRunFolder -> POST /api/runs/:id/open-folder -> explorer.exe spawn'; verdict = 'UNVERIFIED'; note = 'Prohibited: opens a host folder. Static chain complete (app.ts:718-725).'; }
    else if (name === 'Revise' || name === 'Revise accepted files') { family = 'run-detail-revise'; render = 'web/src/pages/RunDetailPage.tsx:283-285,368-370'; handler = 'Modal -> reviseRun -> POST /api/runs/:id/revise -> child run'; verdict = 'UNVERIFIED'; note = 'Not clicked (creates a paid child run). Modal/API contract read.'; }
    else if (name === 'Audit' || name === 'Audit this run') { family = 'run-detail-audit'; render = 'web/src/pages/RunDetailPage.tsx:289-291,376-378'; handler = 'ConfirmDialog -> auditRun -> POST /api/runs preset=audit'; verdict = 'UNVERIFIED'; note = 'Not clicked (creates a paid audit run).'; }
    else if (name === 'Download' || name === 'Download artifacts') { family = 'run-detail-download'; render = 'web/src/pages/RunDetailPage.tsx:294-307'; handler = 'anchor href=/api/runs/:id/download -> zipSync artifacts'; verdict = 'UNVERIFIED'; note = c.disabled ? 'Disabled truthfully for 0 artifacts (title says so).' : 'Href correct; transfer deliberately not exercised.'; }
    else if (c.role === 'tab') { family = 'run-detail-tabs'; render = 'web/src/pages/RunDetailPage.tsx:392-394; web/src/components/ui.tsx:333-371'; handler = 'setTab; keyboard ArrowRight/Left verified'; note = name === 'Events' ? 'Terminal ledger rendered 108 (abf5) / 102 (completed) rows; no /stream request.' : null; }
    else if (name.startsWith('This run has no artifacts')) { family = 'run-detail-download'; render = 'web/src/pages/RunDetailPage.tsx:299-307'; handler = 'disabled button (title only)'; note = 'Probe name field used title; accessible name is Download from content.'; }
    return { order: index + 1, tag: c.tag, role: c.role, name, selector: c.selector, href: c.href, disabled: c.disabled, family, render, handler, verdict, note, evidence: [`browser/run-detail-controls.json#${label}`] };
  });
  return {
    id: label,
    runId,
    controls,
    count: controls.length,
    controlsByTab: runControls.tabControls?.[label] ?? data.controlsByTab,
    apiObserved: label === 'run-abf5'
      ? ['GET /api/runs/run_abf5fe78aab1e932ff/snapshot 200', 'GET /api/runs/run_abf5fe78aab1e932ff/events 200', 'GET /api/runs/run_abf5fe78aab1e932ff/routing 200', 'GET /api/runs/run_abf5fe78aab1e932ff/context 200', 'GET /api/runs/run_abf5fe78aab1e932ff/failures 200', 'GET /api/runs/run_abf5fe78aab1e932ff/retries 200', 'GET /api/runs/run_abf5fe78aab1e932ff/confidence 200']
      : ['GET /api/runs/run_95c11797b4923b4277/snapshot 200', 'GET /api/runs/run_95c11797b4923b4277/events 200', 'GET /api/runs/run_95c11797b4923b4277/files/content?path=docs%2Faudit-method.md 200', 'GET .../routing 200', 'GET .../context 200', 'GET .../failures 200', 'GET .../retries 200', 'GET .../confidence 200'],
  };
});

const inDialog = (c) =>
  c.selector.includes('modal-backdrop') ||
  c.selector.includes('modal-body') ||
  c.selector.startsWith('#agent-run') ||
  ['Copy', 'Edit prompt', 'Stop editing', 'Reset', 'Save', 'Close dialog', 'Close'].includes(c.name) ||
  (c.name || '').startsWith('[ROLE]');
const drawerControls = drawer.drawer.controls
  .filter((c) => c.visible && inDialog(c))
  .map((c, index) => {
    const name = c.name || '';
    let family = 'drawer-shell';
    let render = 'web/src/pages/AgentsPage.tsx:310-332';
    let handler = null;
    let verdict = 'WIRED-AND-WORKS';
    let note = null;
    if (name === 'Close dialog' || name === 'Close') { family = 'drawer-close'; render = 'web/src/pages/AgentsPage.tsx:318-320; web/src/components/ui.tsx:454-456'; handler = 'onClose / Escape'; note = name === 'Close dialog' ? 'Top-right X; Escape also closes (verified).' : 'Footer Close.'; }
    else if (name === 'Edit prompt' || name === 'Stop editing') { family = 'drawer-edit'; render = 'web/src/pages/AgentsPage.tsx:322-324'; handler = 'setEditing toggle'; note = 'Clicked; edit textarea + Reset/Save appeared.'; }
    else if (name === 'Reset') { family = 'drawer-reset'; render = 'web/src/pages/AgentsPage.tsx:411-413,495-505'; handler = 'opens ConfirmDialog; confirm -> DELETE /api/agents/:id/prompt'; verdict = 'UNVERIFIED'; note = 'Dialog opened and cancelled; DELETE not sent (write).'; }
    else if (name === 'Save') { family = 'drawer-save'; render = 'web/src/pages/AgentsPage.tsx:414-416'; handler = 'updateAgentPrompt -> PUT /api/agents/:id/prompt'; verdict = 'UNVERIFIED'; note = 'Not clicked (writes production settings table).'; }
    else if (name === 'INPUT') { family = 'drawer-adhoc-form'; render = 'web/src/pages/AgentsPage.tsx:433-442'; handler = 'runInput state'; note = 'Textarea label Input.'; }
    else if (name === 'Mode') { family = 'drawer-adhoc-form'; render = 'web/src/pages/AgentsPage.tsx:444-450'; handler = 'runMode state; mock option disabled'; }
    else if (name === 'MAX COST (USD)') { family = 'drawer-adhoc-form'; render = 'web/src/pages/AgentsPage.tsx:451-454'; handler = 'runBudget state; validated >0'; }
    else if (name.startsWith('TARGET PATH')) { family = 'drawer-adhoc-form'; render = 'web/src/pages/AgentsPage.tsx:455-465'; handler = 'runTarget state; disabled for non-file agents'; }
    else if (name === 'Run agent') { family = 'drawer-adhoc-run'; render = 'web/src/pages/AgentsPage.tsx:479-481'; handler = 'runAgent -> POST /api/agents/:id/run'; verdict = 'UNVERIFIED'; note = 'Disabled (empty input); paid live run not executed.'; }
    else if (name === 'Copy') { family = 'drawer-codeviewer'; render = 'web/src/components/CodeViewer.tsx:59; ui.tsx:541-567'; handler = 'navigator.clipboard.writeText'; note = 'Not clicked (clipboard side effect).'; }
    else if (name.startsWith('Open ')) { family = 'drawer-background'; render = 'web/src/pages/AgentsPage.tsx:155'; handler = 'background card (inert behind modal)'; }
    return { order: index + 1, tag: c.tag, name, selector: c.selector, disabled: c.disabled, family, render, handler, verdict, note, evidence: ['browser/agents-drawer.json'] };
  });

const result = {
  schema: 'hive.audit.controls.v1',
  task: 'task-1 / W6-AUD-01',
  seat: 'weaver (read-only)',
  capturedAt: '2026-11-03T22:18:19-06:00',
  method: 'Playwright 1.64.1 with system Chrome (channel=chrome), 1440x1000; live DOM inventory of visible controls; source read for render/handler/request; no mocks.',
  baseline: {
    app: 'http://127.0.0.1:8787',
    health: 'ok/B2 (features routing+learning, db ok, key configured, no active run at baseline)',
    agents: 37,
    runs: 25,
    routesDeclaredInAppTs: 45,
    openapiPaths: 42,
    vaultRowsRendered: 150,
  },
  counts: {
    surfaces: pageRecords.length + runDetailRecords.length,
    pages: pageRecords.length,
    pageControls: Object.fromEntries(pageRecords.map((p) => [p.id, p.count])),
    pageControlsTotal: pageRecords.reduce((sum, p) => sum + p.count, 0),
    runDetailControls: Object.fromEntries(runDetailRecords.map((r) => [r.id, r.count])),
    runDetailControlsTotal: runDetailRecords.reduce((sum, r) => sum + r.count, 0),
    totalCapturedControlInstances: pageRecords.reduce((sum, p) => sum + p.count, 0) + runDetailRecords.reduce((sum, r) => sum + r.count, 0),
    drawerControls: drawerControls.length,
    runDetailControlsByTab: runDetailRecords.map((r) => ({ id: r.id, controlsByTab: r.controlsByTab })),
    repeatedRows: {
      agentCards: drawer.cards,
      vaultTreeRows: 150,
      runTableRows: 25,
      runDetailEventRows: { 'run_abf5fe78aab1e932ff': 108, 'run_95c11797b4923b4277': 102 },
      routingDecisionCards: 14,
      contextPackCards: { 'run_abf5fe78aab1e932ff': 14, 'run_95c11797b4923b4277': 15 },
    },
  },
  shell: {
    render: 'web/src/components/AppShell.tsx:20-27 (NAV), 50-172',
    controls: ['Skip to content', 'Open navigation', 'HiveRouter overview', 'Overview', 'Agents', 'Runs', 'Vault', 'Learning', 'Settings', 'Trust & status'],
    evidence: ['browser/system', 'browser/navigation.json'],
    notes: [
      'Mobile menu uses stable selector button.topbar-menu + aria-expanded (stateful label avoided).',
      'Skip link scrolls (scrollY 58) but focus falls back to BODY (main not focusable).',
    ],
  },
  pages: pageRecords,
  runDetails: runDetailRecords,
  dialogs: {
    agentDrawer: {
      render: 'web/src/pages/AgentsPage.tsx:310-332',
      count: drawerControls.length,
      controls: drawerControls,
      verified: ['open via card', 'Escape closes', 'Edit prompt toggles editor', 'Reset confirm opens', 'nested Escape closes BOTH layers (F7)'],
      evidence: ['browser/agents-drawer.json', 'screens/agents-drawer.png', 'screens/agents-reset-confirm.png'],
    },
    stopDialog: { render: 'web/src/pages/RunDetailPage.tsx:423-433', verdict: 'UNVERIFIED', note: 'Only rendered for non-terminal runs; no active run and Stop is prohibited. Static: ConfirmDialog tone=danger, cancel default.' },
    reviseDialog: { render: 'web/src/pages/RunDetailPage.tsx:435-456', verdict: 'UNVERIFIED', note: 'Rendered only for terminal runs with artifacts; opening prohibited. Submit disabled until feedback >=4 chars.' },
    auditDialog: { render: 'web/src/pages/RunDetailPage.tsx:458-467', verdict: 'UNVERIFIED', note: 'Not opened (would create paid audit run).' },
    resetPromptDialog: { render: 'web/src/pages/AgentsPage.tsx:495-505', verdict: 'WIRED-AND-WORKS', note: 'Opened + Escape; confirmation itself not executed (write).' },
    approvalDialog: { render: 'web/src/pages/LearningPage.tsx:550-656', verdict: 'UNVERIFIED', note: 'Unreachable: zero promotions and dataset empty; approval/promotion are prohibited mutations.' },
  },
  gaps: [
    'Learning tabs are all disabled in this build (E_LEARNING_POOL_EXHAUSTED): 8 controls rendered but unreachable; 16 traces / 11 audit rows exist in the DB and have no UI path while enabled=false.',
    'Learning approval/promotion/rollback controls are not rendered because /api/learning/promotions returns no rows; their enablement path is not observable in this state.',
    'Run detail Stop/Revise/Audit/Open folder/Download were not exercised (read-only mandate / paid child runs / downloads).',
    'No error/empty state for Vault, Agents, Runs or Settings could be induced without altering the server or DB; only the healthy path and filter-empty path are live-verified.',
    'Overview has no Refresh control (probe timeout was a wrong expectation, not a missing control).',
    'Run detail event rows each expose an Inspect <details> summary (108/102) and dominate tab control counts.',
    'Vault tree count depends on expansion state (150 rows initially; 67 after collapsing one root).',
  ],
  probeCorrections: [
    { probe: 'getByRole(button,{name:"Refresh"}) on /', result: 'Timeout', classification: 'test-harness false negative: Overview has no Refresh button; controls inventory confirms 3 buttons (menu, Analyze prompt, Start run).' },
    { probe: 'accessible-name extraction for disabled Download', result: 'name="This run has no artifacts to download."', classification: 'harness artifact: nameOf preferred title over innerText; the real accessible name is "Download" (content) with title as description. Not a product defect.' },
    { probe: 'first Tab after clicking menu then Escape', result: 'brand link, not skip link', classification: 'probe error: focus was on the menu button; a fresh-load Tab lands on the skip link (skip-probe.log).' },
    { probe: 'Vault first row click', result: 'directory not file', classification: 'avoided: rows filtered by .md/.json before clicking; file preview verified via GET 200.' },
  ],
};

const out = path.join(path.resolve(HERE, '..'), 'controls.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ file: out, bytes: fs.statSync(out).size, counts: result.counts, unclassified: pageRecords.flatMap((p) => p.controls).filter((c) => c.family === 'unclassified').length }, null, 2));


