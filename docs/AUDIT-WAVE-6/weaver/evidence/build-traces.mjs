// Builds traces.json: per control family, the 11-hop front-to-back chain with file:line and verdict.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const hop = (file, line, detail) => ({ file, line, detail });
const family = (id, name, page, controls, verdict, level, hops, evidence, extra = {}) => ({
  id, name, page, controls, verdict, verifiedLevel: level, hops, evidence, ...extra,
});

const families = [
  family('T01', 'Primary navigation links', 'AppShell', ['Overview', 'Agents', 'Runs', 'Vault', 'Learning', 'Settings'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/components/AppShell.tsx', '102-114', 'NavLink list from NAV array at 20-27; active class; no aria-current'),
    handler: hop('web/src/components/AppShell.tsx', '107', 'onClick closes mobile drawer; router navigates'),
    client: { file: 'n/a', detail: 'react-router Link opens the route directly; no API call' },
    request: { detail: 'GET document + SPA route; no XHR for navigation' },
    route: hop('web/src/App.tsx', '32-41', 'Routes map: /, /agents, /runs, /runs/:runId, /vault, /settings, /learning, *'),
    service: { detail: 'Page component mounts and issues its own resource GETs' },
    store: { detail: 'n/a (navigation)' },
    response: { detail: 'Each destination rendered its h1 and API data (all six verified)' },
    renderBack: hop('web/src/components/AppShell.tsx', '106,112', 'nav-link-active class on match; screen changes'),
    reentry: { detail: 'Direct URL loads verified for every route; back/forward not separately exercised' },
  }, ['browser/navigation.json#navigations', 'browser/pages.json#h1']),

  family('T02', 'Mobile navigation toggle', 'AppShell', ['button.topbar-menu'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/components/AppShell.tsx', '57-66', 'aria-label Open/Close navigation; aria-expanded; aria-controls=primary-navigation'),
    handler: hop('web/src/components/AppShell.tsx', '63', 'setMobileOpen toggle; Escape listener at 41-48'),
    client: { detail: 'local state only' }, request: { detail: 'none' }, route: { detail: 'none' }, service: { detail: 'none' }, store: { detail: 'none' },
    response: { detail: 'aria-expanded false->true; sidebar class sidebar->sidebar-open' },
    renderBack: hop('web/src/components/AppShell.tsx', '96,131-138', 'sidebar-open class + scrim; Escape restores'),
    reentry: { detail: 'Escape and link-click both close the drawer (verified Escape)' },
  }, ['browser/interactions.json#shell']),

  family('T03', 'Skip to content link', 'AppShell', ['a.skip-link'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/components/AppShell.tsx', '52-54', 'first focusable element; href=#main-content'),
    handler: { detail: 'native anchor' }, client: { detail: 'none' }, request: { detail: 'none' }, route: { detail: 'none' }, service: { detail: 'none' }, store: { detail: 'none' },
    response: { detail: 'hash #main-content set; window scrollY 58' },
    renderBack: hop('web/src/components/AppShell.tsx', '140', '<main id="main-content"> is not tabindex=-1, so focus falls back to BODY'),
    reentry: { detail: 'Next Tab starts from the top of the document; keyboard users do not land in main content' },
  }, ['evidence/logs/skip-probe.log'], { defect: 'F8' }),

  family('T04', 'Composer form state (brief/preset/model/thinking/effort/max cost)', 'Overview', ['PROJECT BRIEF', 'PRESET', 'MODEL', 'THINKING', 'MAX RUN COST (USD)', 'Reasoning effort (conditional)'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/components/RunComposer.tsx', '141-156,203-253', 'labeled fields; brief maxLength 8000; effort shown only when thinking=enabled'),
    handler: hop('web/src/components/RunComposer.tsx', '57-62,70-76', 'useState defaults; localStorage draft hive.composer.v1 validated at 30-47'),
    client: hop('web/src/api.ts', '334-346', 'startRun(input) builds StartRunInput; validates run id in response'),
    request: { detail: 'POST /api/runs eventually; body {brief,preset,model,thinking,effort?,maxCostUsd}; headers Content-Type, Idempotency-Key (api.ts:123-138,338)' },
    route: hop('src/server/app.ts', '734-766', 'enum validation for preset/model/thinking/effort; maxCost numeric + cap check'),
    service: hop('src/server/runs/manager.ts', '80-165', 'createRun: brief length, idempotency reuse, one-active-run guard, snapshot, run_limit settings, queued event'),
    store: hop('src/server/db/migrations.ts', '7-30,119-124', 'runs row + settings run_limit/run_meta; idempotency_keys tx at manager.ts:127-134'),
    provider: { detail: 'not reached in this trace (no submit)' },
    response: { detail: 'would be 202 {runId,replayed} (app.ts:779)' },
    renderBack: { detail: 'composer navigates via onStarted (OverviewPage.tsx:70) -> RunDetailPage' },
    reentry: { detail: 'Draft reloaded from localStorage on mount; validation errors render under role=alert' },
  }, ['browser/pages.json#overview', 'browser/interactions.json'], { note: 'State/DOM verified; submit deliberately not exercised (paid run).' }),

  family('T05', 'Analyze prompt (prompt analyst)', 'Overview', ['Analyze prompt'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/components/RunComposer.tsx', '173-176', 'disabled when brief <8 chars or busy'),
    handler: hop('web/src/components/RunComposer.tsx', '81-101', 'analyze() -> analyzePrompt(brief)'),
    client: hop('web/src/api.ts', '297-303', 'POST /api/prompt/analyze body {prompt}'),
    request: { method: 'POST', path: '/api/prompt/analyze', body: '{prompt}', headers: 'Content-Type: application/json' },
    route: hop('src/server/app.ts', '225-259', '8..8000 chars, secret-pattern refusal, key required, analyst call, refusal mapping'),
    service: hop('src/server/prompt/analyst.ts', '1-260', 'DeepSeek Flash call + one repair on invalid exact quote; E_PROMPT_ANALYSIS_INVALID'),
    store: { detail: 'read-only: no ledger/reservation row for analyst calls (RECEIPT.md notes this)' },
    provider: { detail: 'DeepSeek API; key server-side only; no browser key' },
    response: { detail: '200 {schema,analysis,repairAttempted,model,promptChars}' },
    renderBack: hop('web/src/components/PromptAnalysisCard.tsx', '1-145', 'quotes/labels/acceptance proof/limitations; Apply rewrites brief'),
    reentry: { detail: 'Repair banner at RunComposer.tsx:194-199' },
  }, ['evidence/logs/short-prompt-response.txt'], { note: 'Not clicked: paid provider call. Validation path probed with a 3-char prompt.' }),

  family('T06', 'Start run', 'Overview', ['Start run'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/components/RunComposer.tsx', '279-283', 'submit disabled until brief >=8 chars and not busy'),
    handler: hop('web/src/components/RunComposer.tsx', '103-136', 'submit() client validation then startRun'),
    client: hop('web/src/api.ts', '334-346', 'Idempotency-Key from crypto.randomUUID (276-279)'),
    request: { method: 'POST', path: '/api/runs', body: '{brief,preset,model,thinking,effort,maxCostUsd}', headers: 'Content-Type, Idempotency-Key' },
    route: hop('src/server/app.ts', '734-785', '202 on create; 422 refusals for enum/idempotency/budget'),
    service: hop('src/server/runs/manager.ts', '80-165', 'createRun + queueMicrotask executor'),
    store: hop('src/server/runs/recorder.ts', '76-105', 'runs row status=queued, phase=intake'),
    provider: { detail: 'executor pipeline; paid' },
    response: { detail: '202 {runId,replayed}' },
    renderBack: hop('web/src/pages/OverviewPage.tsx', '70', 'navigate to /runs/:id'),
    reentry: { detail: 'Idempotent replay returns the same runId (manager.ts:91-96)' },
  }, ['browser/pages.json#overview'], { note: 'Not clicked: starts a paid run. Exact blocker recorded; static chain complete.' }),

  family('T07', 'Provider key status surfaces', 'Overview/Settings', ['Provider card', 'Provider key panel'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/OverviewPage.tsx', '75-130', 'key.loading/error/configured branches; balance "Not reported"'),
    handler: hop('web/src/pages/OverviewPage.tsx', '38', 'useApiResource(getKeyStatus)'),
    client: hop('web/src/api.ts', '293-295', 'GET /api/settings/key-status'),
    request: { method: 'GET', path: '/api/settings/key-status' },
    route: hop('src/server/app.ts', '223', 'returns keyStatus() only'),
    service: hop('src/server/security/keys.ts', '1-200', 'configured/source/fingerprint; no key material'),
    store: { detail: 'env/.env.local or data/secrets; not read by browser' },
    provider: { detail: 'no provider call for status' },
    response: { detail: '{"configured":true,"source":"environment","fingerprint":"c30cfdbc"} - no checkedAt/balance' },
    renderBack: hop('web/src/pages/SettingsPage.tsx', '42-75', 'Configured Yes / Source / Fingerprint / Checked Not reported / Balance Not reported'),
    reentry: { detail: 'Refresh re-fetches both key-status and settings (verified)' },
  }, ['evidence/api/key-status.json', 'browser/navigation.json#refreshes']),

  family('T08', 'Overview stat cards', 'Overview', ['Registered agents', 'Runs recorded', 'Prompt/completion tokens', 'Estimated spend'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/OverviewPage.tsx', '165-196', 'four StatCards; "Not available" on error, never zero'),
    handler: hop('web/src/pages/OverviewPage.tsx', '36', 'useApiResource(getStats)'),
    client: hop('web/src/api.ts', '289-291', 'GET /api/stats'),
    request: { method: 'GET', path: '/api/stats' },
    route: hop('src/server/app.ts', '943-955', 'COUNT runs, SUM usage, REGISTRY.length'),
    service: { detail: 'direct SQL aggregates; COALESCE(...,0)' },
    store: hop('src/server/db/migrations.ts', '7-30,101-118', 'runs + usage tables'),
    response: { detail: '{"agentCount":37,"runCount":25,"totalPromptTokens":1367744,"totalCompletionTokens":524716,"totalCostUsd":0.924624168}' },
    renderBack: hop('web/src/pages/OverviewPage.tsx', '169-194', 'formatInteger/formatUsd'),
    reentry: { detail: 'Reload refetches; totals include failed-run usage that the run rows show as ? (F2)' },
  }, ['evidence/api/stats.json', 'browser/pages.json#overview']),

  family('T09', 'Run links (recent + ledger rows)', 'Overview/Runs', ['row brief link', 'Open run icon'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/components/RunTable.tsx', '22-45', '2 links per row; aria-label Open run <id>'),
    handler: { detail: 'react-router Link' }, client: { detail: 'no API call until RunDetailPage mounts' },
    request: { detail: 'snapshot/events GETs after navigation' },
    route: hop('web/src/App.tsx', '36', '/runs/:runId -> RunDetailPage'),
    service: { detail: 'route reads DB via recorder.getRun/getSteps/...' },
    store: hop('src/server/runs/recorder.ts', '128-163,266-324', 'runs/steps/checks/artifacts'),
    response: { detail: 'run_95 snapshot 200 with 19 steps / 20 artifacts' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '127-139,262-310', 'header + overview from snapshot'),
    reentry: { detail: 'Direct URL and row click both render; reload verified' },
  }, ['browser/navigation.json#runRowClick', 'browser/run-95-detail.json']),

  family('T10', 'Runs status filter', 'Runs', ['select STATUS', 'shown count'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunsPage.tsx', '45-59', '8 options (RUN_STATUSES minus interrupted)'),
    handler: hop('web/src/pages/RunsPage.tsx', '20,22-25', 'useState + client filter over runs.data'),
    client: { file: 'web/src/api.ts', line: '309-314', detail: 'listRuns(100) already loaded' },
    request: { method: 'GET', path: '/api/runs?limit=100' },
    route: hop('src/server/app.ts', '727-732', 'status query param supported by API but unused by UI'),
    service: hop('src/server/runs/recorder.ts', '158-163', 'listRuns(limit, status)'),
    store: hop('src/server/db/migrations.ts', '7-30', 'runs.status'),
    response: { detail: '25 runs' },
    renderBack: hop('web/src/pages/RunsPage.tsx', '56-58,76-80', '3 of 25 for failed; empty state otherwise'),
    reentry: { detail: 'Filter resets on reload (local state); not in URL' },
  }, ['browser/runs-filter.json'], { note: 'Only the first 100 runs are filtered client-side; >100 runs would cap the ledger silently.' }),

  family('T11', 'Runs/Vault/Agents/Settings Refresh buttons', 'Runs/Vault/Agents/Settings', ['Refresh'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunsPage.tsx', '38-40', 'spinner while loading; disabled while loading'),
    handler: hop('web/src/hooks/useApi.ts', '66', 'reload() increments nonce'),
    client: hop('web/src/hooks/useApi.ts', '24-64', 'effect refetches loader on nonce'),
    request: { detail: 'same GET as initial load' },
    route: { detail: 'see each family' }, service: { detail: 'see each family' }, store: { detail: 'see each family' },
    response: { detail: '200' },
    renderBack: { detail: 'data replaced; loading spinner shown' },
    reentry: { detail: 'Verified one click per page: /agents, /runs, /vault, /settings' },
  }, ['browser/navigation.json#refreshes'], { note: 'Overview has no Refresh control (probe correction).' }),

  family('T12', 'Run detail Refresh', 'RunDetail', ['Refresh (header)'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '274-276', 'spinner while loading'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '113-114', 'reloadRef -> snapshot.reload'),
    client: hop('web/src/api.ts', '316-325', 'GET /api/runs/:id/snapshot (falls back to /runs/:id on 404)'),
    request: { method: 'GET', path: '/api/runs/run_abf5fe78aab1e932ff/snapshot' },
    route: hop('src/server/app.ts', '802-816', 'run + steps + checks + artifacts(200) + lastEventId + truncated(artifacts)'),
    service: { detail: 'recorder getRun/getSteps/getChecks/getArtifacts' },
    store: hop('src/server/db/migrations.ts', '7-30,35-100', 'runs/steps/checks/artifacts'),
    response: { detail: '200; keys run,lastEventId,steps,checks,artifacts,truncated - NO limits' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '320-342', 'badges/facts/CostMeter update'),
    reentry: { detail: 'Stale-while-error banner at 312-318 keeps last snapshot truthfully' },
  }, ['browser/run-detail-controls.json', 'browser/interactions.json#runRefresh']),

  family('T13', 'Run terminal actions (Stop/Revise/Audit/Download/Open folder)', 'RunDetail', ['Stop', 'Revise', 'Audit', 'Download', 'Open folder'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/pages/RunDetailPage.tsx', '277-307,358-383', 'Stop only while non-terminal; Revise/Audit only terminal+artifacts; Download disabled otherwise; Open folder always'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '206-260', 'confirmStop/submitRevision/startAudit/openFolder'),
    client: hop('web/src/api.ts', '348-397', 'POST /cancel, /revise, /runs {preset:audit}, GET /download, POST /open-folder'),
    request: { detail: 'cancel: POST /api/runs/:id/cancel Idempotency-Key; revise: POST /revise {feedback,files}; audit: POST /api/runs {brief,preset:audit,sourceRunId}; open-folder: POST /open-folder' },
    route: hop('src/server/app.ts', '695-725,867-916', 'download zip (E_ZIP_EMPTY if 0 artifacts), open-folder spawns explorer, cancel E_RUN_NOT_CANCELLABLE, revise E_INVALID_PARENT'),
    service: hop('src/server/runs/manager.ts', '167-190', 'cancelRun aborts controller or marks no-controller run cancelled'),
    store: { detail: 'cancel updates runs.status; revise/audit create child runs; download reads artifacts + workspace files' },
    provider: { detail: 'revise/audit would spend provider budget' },
    response: { detail: 'abf5: Download disabled with truthful title; completed: anchor href /api/runs/run_95.../download' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '282-307,362-382', 'buttons/links per state'),
    reentry: { detail: 'No exercise: prohibited read-only audit actions; no active run for Stop.' },
  }, ['browser/run-abf5-detail.json', 'browser/run-detail-controls.json'], { note: 'Rendered state verified; effects deliberately not executed.' }),

  family('T14', 'Run detail tabs (8) + keyboard', 'RunDetail', ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '79-88,392-394; web/src/components/ui.tsx:333-371', 'role=tablist/tab, aria-selected, roving tabIndex, disabled support'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '98', 'setTab(id); panel rendered at 396-421'),
    client: { detail: 'tab panels fetch their own resource on mount' },
    request: { detail: 'routing/context/failures/retries/confidence/events GETs' },
    route: { detail: 'see T18-T23' }, service: { detail: 'see T18-T23' }, store: { detail: 'see T18-T23' },
    response: { detail: 'all 200' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '396-421', 'single role=tabpanel swaps content'),
    reentry: { detail: 'ArrowRight from Events wraps to Overview (verified); ArrowLeft code at ui.tsx:354-366; no aria-controls/tabpanel id (F9)' },
  }, ['browser/run-detail-controls.json#a11y', 'browser/run-abf5-detail.json#tabResults']),

  family('T15', 'Run Overview tab (timeline/brief/checks-artifacts counts)', 'RunDetail', ['Execution timeline', 'Brief', 'Checks & artifacts'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '472-548', 'steps sorted by seq; failedChecks = fail|unverified'),
    handler: { detail: 'props from snapshot (no extra fetch)' },
    client: hop('web/src/api.ts', '316-325', 'snapshot'),
    request: { method: 'GET', path: '/api/runs/:id/snapshot' },
    route: hop('src/server/app.ts', '802-816', 'same snapshot'),
    service: { detail: 'getSteps/getChecks/getArtifacts' },
    store: hop('src/server/db/migrations.ts', '35-100', 'steps/checks/artifacts'),
    response: { detail: 'abf5: 20 steps, 16 checks, 0 artifacts; 95: 19/5/20' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '489-544', 'timeline rows show per-step tokens/cost; run-level facts use run.promptTokens/costUsd'),
    reentry: { detail: 'Reload matches; run-level tokens/cost are null on failed runs (F2) while every step shows measured usage' },
  }, ['browser/run-abf5-detail.json', 'evidence/logs/db-usage-probe.txt'], { defect: 'F2' }),

  family('T16', 'Files tab + artifact viewer', 'RunDetail', ['artifact rows', 'CodeViewer'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '550-623', 'empty state when 0; first artifact auto-selected; badges kind/language/redaction'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '551-556', 'setSelectedPath; ArtifactView fetch'),
    client: hop('web/src/api.ts', '399-404', 'requestText GET /files/content?path='),
    request: { method: 'GET', path: '/api/runs/run_95c11797b4923b4277/files/content?path=docs%2Faudit-method.md', headers: 'Accept: text/plain' },
    route: hop('src/server/app.ts', '924-941', 'safePath under run.workspacePath; 404 E_FILE_NOT_FOUND; text/plain + nosniff'),
    service: hop('src/server/security/paths.ts', '1-200', 'safePath normalizes and blocks traversal'),
    store: { detail: 'workspace files + artifacts table metadata' },
    response: { detail: '200 text; 20 artifacts in snapshot; bytes 7,828 for docs/audit-method.md' },
    renderBack: hop('web/src/components/CodeViewer.tsx', '1-84', 'syntax-highlighted code + Copy + path/bytes'),
    reentry: { detail: 'Artifact switching refetches per path; abf5 shows truthful empty state (0 artifacts)' },
  }, ['browser/run-95-detail.json#tabResults', 'browser/run-95-detail.json#responses']),

  family('T17', 'Checks tab', 'RunDetail', ['checks table'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '625-668', 'table Check/Status/Mandatory/Detail/File/Time; empty state'),
    handler: { detail: 'snapshot.checks prop' },
    client: { detail: 'no dedicated call; snapshot includes checks' },
    request: { method: 'GET', path: '/api/runs/:id/snapshot' },
    route: hop('src/server/app.ts', '802-816', 'getChecks(id)'),
    service: hop('src/server/runs/recorder.ts', '284-303', 'insertCheck stores id,status,detail,mandatory,file,line only'),
    store: hop('src/server/db/migrations.ts', '88-99', 'checks table has no code/duration'),
    response: { detail: 'abf5 16 rows incl. 4 stub.scan fails; 95 5 rows all pass' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '649-660', 'status badge; File falls back to check.code; Time uses durationMs'),
    reentry: { detail: 'TIME always ? (durationMs never produced/persisted); code fallback unreachable (F12)' },
  }, ['browser/run-abf5-detail.json#tabResults', 'evidence/logs/db-probe.txt'], { defect: 'F12' }),

  family('T18', 'Routing tab', 'RunDetail', ['routing decisions', 'candidate table', 'Raw decision'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '670-762', 'one card per decision; 8 candidate columns; refusals block; Raw decision JSON'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '671', 'useApiResource(getRouting) + Refresh'),
    client: hop('web/src/api.ts', '452-454', 'GET /api/runs/:id/routing'),
    request: { method: 'GET', path: '/api/runs/run_abf5fe78aab1e932ff/routing' },
    route: hop('src/server/app.ts', '359-443', 'route_decisions + route_candidates join; hardcoded reason/qualitySource/sampleSize fallbacks'),
    service: hop('src/server/routing/ccr.ts', '1-200', 'routing writes route_decisions/candidates during pipeline'),
    store: hop('src/server/db/migrations.ts', '200-235', 'route_decisions.score,features_json,rejected_json; route_candidates'),
    response: { detail: '14 decisions / 42 candidates / 0 refusals / allocated .0301056 / reserve .1; reason="static prior route" on all' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '719-760', 'reason line; quality "prior ? n=0"; Raw decision JSON'),
    reentry: { detail: 'Refresh re-fetches (verified 200); reason is constant regardless of decision features (F5)' },
  }, ['evidence/api/run_abf5fe78aab1e932ff_routing.json', 'browser/run-abf5-detail.json#tabResults', 'browser/micro.json'], { defect: 'F5' }),

  family('T19', 'Context tab (packs load)', 'RunDetail', ['context packs', 'items tables'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '764-844', 'pack cards with usedTokens/prefixHash; items table'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '765', 'useApiResource(getContext) + Refresh'),
    client: hop('web/src/api.ts', '456-458', 'GET /api/runs/:id/context'),
    request: { method: 'GET', path: '/api/runs/run_abf5fe78aab1e932ff/context' },
    route: hop('src/server/app.ts', '445-470', 'reads context_packs.included_json; hardcodes agentId:null,maxTokens:null; ignores excluded_json'),
    service: hop('src/server/pipeline/run.ts', '627-669', 'packContext -> context_packs row (included items id/kind/path/tokens/mandatory; excluded_json=pack.excluded)'),
    store: hop('src/server/db/migrations.ts', '245-258', 'context_packs.included_json/excluded_json'),
    response: { detail: '14 packs / 61 items; item tokens all null; no chars/reason/included; no maxTokens/agentId' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '801-843', '4 of 7 item columns structurally empty; pack usedTokens renders'),
    reentry: { detail: 'Refresh verified 200; layout stable' },
  }, ['evidence/api/run_abf5fe78aab1e932ff_context.json', 'evidence/logs/db-context-probe.txt', 'browser/run-abf5-detail.json#tabResults']),

  family('T20', 'Context item projection (chars/tokens/reason/included/excluded)', 'RunDetail', ['items table columns', 'excluded items'], 'WIRED-BUT-DEAD', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '823-843', 'render Chars, Reason, Included; copy at 768 claims excluded items and reasons'),
    handler: { detail: 'no data to render: route never supplies those keys' },
    client: hop('web/src/api.ts', '456-458', 'GET /api/runs/:id/context'),
    request: { method: 'GET', path: '/api/runs/:id/context' },
    route: hop('src/server/app.ts', '455-467', 'items map {id,path,kind,tokens,mandatory}; excluded_json never read'),
    service: hop('src/server/pipeline/run.ts', '661', 'included_json stores tokens: item.tokens ?? null (packer emits null for brief/task/interfaces)'),
    store: hop('src/server/db/migrations.ts', '245-258', 'excluded_json exists but unused by route'),
    response: { detail: '0/129 items have tokens/chars/reason/included; 0 excluded arrays non-empty in these runs' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '833-837', 'Tokens ?, Chars ?, Reason ?, Included "Not reported" on every row'),
    reentry: { detail: 'No state change can populate these columns; dead projection' },
  }, ['evidence/logs/db-context-probe.txt', 'browser/run-abf5-detail.json#tabResults'], { defect: 'F4' }),

  family('T21', 'Repairs tab (failures + retries)', 'RunDetail', ['failure clusters', 'retry attempts'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '846-911', 'two cards; empty states; signature/category/count/severity/repair'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '847-848', 'useApiResource(getFailures/getRetries)'),
    client: hop('web/src/api.ts', '460-466', 'GET failures + retries'),
    request: { method: 'GET', path: '/api/runs/:id/failures and /retries' },
    route: hop('src/server/app.ts', '472-486', 'failure_signatures x occurrences GROUP BY; retry_attempts rows'),
    service: hop('src/server/pipeline/run.ts', '837-847', 'failure_memory inserts signatures/occurrences during repair'),
    store: hop('src/server/db/migrations.ts', '272-293,316-327', 'failure_signatures/occurrences/retry_attempts'),
    response: { detail: 'abf5 2 clusters (stub.scan), 0 retries; 95 0 clusters, 0 retries' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '870-909', 'REPAIR column always ? because route omits repairStatus; retries empty state'),
    reentry: { detail: 'Refresh verified 200' },
  }, ['evidence/api/run_abf5fe78aab1e932ff_failures.json', 'browser/micro.json']),

  family('T22', 'Confidence tab', 'RunDetail', ['confidence record'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '913-989', 'decision badge, score, provisional, components, reasons, raw JSON'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '914', 'useApiResource(getConfidence)'),
    client: hop('web/src/api.ts', '468-470', 'GET /api/runs/:id/confidence'),
    request: { method: 'GET', path: '/api/runs/run_abf5fe78aab1e932ff/confidence' },
    route: hop('src/server/app.ts', '494-500', 'latest confidence_records row or none_measured default; omits mandatoryFailed/Unverified'),
    service: hop('src/server/pipeline/run.ts', '793-810', 'computeConfidence components; INSERT confidence_records'),
    store: hop('src/server/db/migrations.ts', '303-315', 'confidence_records'),
    response: { detail: 'abf5 {decision:needs_review,score:.786667,provisional:true,components{verification:.6667,...}}' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '925-987', 'NEEDS REVIEW / score 0.787 / components; contradiction banner unreachable (route omits mandatory lists)'),
    reentry: { detail: 'Refresh verified 200; "No green badge" behavior intact' },
  }, ['evidence/api/run_abf5fe78aab1e932ff_confidence.json', 'browser/micro.json']),

  family('T23', 'Events tab (terminal persisted ledger)', 'RunDetail', ['Events tab', 'Inspect details'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/RunDetailPage.tsx', '991-1054', 'terminal title "Persisted events"; latest 500 copy; empty state prints lastEventId'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '129-133', 'persistedEvents useApiResource only when terminal; visibleEvents honors live buffer first'),
    client: hop('web/src/api.ts', '327-332', 'GET /events -> mapPersistedRunEvents'),
    request: { method: 'GET', path: '/api/runs/run_abf5fe78aab1e932ff/events' },
    route: hop('src/server/app.ts', '818-833', 'eventReplayWindow=500 slice; truncated flag computed from global seq'),
    service: hop('src/server/runs/recorder.ts', '58-69', 'SELECT seq,run_id,type,payload_json,created_at WHERE seq>after LIMIT'),
    store: hop('src/server/db/migrations.ts', '54-61', 'events table (autoincrement seq global across runs)'),
    response: { detail: 'abf5 108 events (seq 552-659), lastEventId 659, truncated true; 95 102 events, truncated true' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '1031-1049', 'rows reversed (latest first); Inspect shows payload'),
    reentry: { detail: 'No /stream request for terminal runs (D09 verified); truncated flag ignored by client (F6)' },
  }, ['browser/run-abf5-detail.json#tabResults', 'evidence/api/run_abf5fe78aab1e932ff_events.json'], { defect: 'F6' }),

  family('T24', 'Live SSE subscription (non-terminal run)', 'RunDetail', ['stream badge', 'live events'], 'WIRED-BUT-DEAD', 'READ', {
    render: hop('web/src/pages/RunDetailPage.tsx', '135-162', 'live stream label only when !terminal && live; reconnecting label'),
    handler: hop('web/src/pages/RunDetailPage.tsx', '135-139', 'useRunStream(runId, onEvent) -> buffer 100 + 250ms reload'),
    client: hop('web/src/hooks/useApi.ts', '106-157', 'EventSource + STREAM_EVENT_TYPES listeners'),
    request: { method: 'GET', path: '/api/runs/:id/stream', headers: 'Accept: text/event-stream; Last-Event-ID optional' },
    route: hop('src/server/app.ts', '835-865', 'writes id/event/data frames; heartbeat comment; replay window'),
    service: hop('src/server/runs/recorder.ts', '36-56', 'emitEvent persists + EventEmitter push'),
    store: { detail: 'events table; emitter in-process (no cross-process bus)' },
    response: { detail: '108 SSE frames captured for abf5 incl. run.queued + repair.stalled; frame shape {schema,type,data,meta}' },
    renderBack: hop('web/src/pages/RunDetailPage.tsx', '1006-1049', 'Events tab rows; missing 5 emitted types (F1)'),
    reentry: { detail: 'No live run exists to exercise end-to-end; classification READ plus raw SSE transport evidence' },
  }, ['evidence/logs/sse_abf5.txt', 'evidence/payloads.json', 'web/src/hooks/useApi.ts:72-100'], { defect: 'F1' }),

  family('T25', 'Agents refresh/search/filters', 'Agents', ['Refresh', 'SearchField', 'GROUP', 'OUTPUT'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/AgentsPage.tsx', '73-126', 'search input, two selects, shown count'),
    handler: hop('web/src/pages/AgentsPage.tsx', '49-64', 'client filtering by name/id/role/group/outputKind'),
    client: hop('web/src/api.ts', '406-409', 'GET /api/agents'),
    request: { method: 'GET', path: '/api/agents' },
    route: hop('src/server/app.ts', '261-268', 'REGISTRY.map(toAgentView) with evidence + stepped badges'),
    service: hop('src/server/agents/registry.ts', '1-200', '37 agent definitions; prompt text included'),
    store: hop('src/server/db/migrations.ts', '186-199', 'agent_evidence; steps join for representative-live'),
    response: { detail: '37 agents (94KB payload incl. full prompts)' },
    renderBack: hop('web/src/pages/AgentsPage.tsx', '131-136', '37 cards; python search 1 of 37; Control 5; files 28'),
    reentry: { detail: 'Refresh refetches 200; filters reset on reload' },
  }, ['browser/interactions.json#agents', 'evidence/api/agents.json']),

  family('T26', 'Agent card -> drawer (+ Escape/close)', 'Agents', ['37 cards', 'Close', 'Close dialog'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/AgentsPage.tsx', '151-183', 'button.agent-card with aria-label Open <name>'),
    handler: hop('web/src/pages/AgentsPage.tsx', '133', 'setSelected(agent.id) -> AgentDrawer Modal'),
    client: hop('web/src/pages/AgentsPage.tsx', '200-203', 'getAgent(id) via useApiResource'),
    request: { method: 'GET', path: '/api/agents/router' },
    route: hop('src/server/app.ts', '270-279', 'single agent + evidence + stepped badges'),
    service: { detail: 'registry.getAgent' },
    store: { detail: 'agent_evidence rows' },
    response: { detail: '200 agent view (same shape as list)' },
    renderBack: hop('web/src/pages/AgentsPage.tsx', '310-508', 'contract/evidence/prompt/adhoc form; Escape closes'),
    reentry: { detail: 'Escape closes drawer (verified); opening a second agent resets form state (222-228)' },
  }, ['browser/agents-drawer.json']),

  family('T27', 'Agent prompt edit/save/reset', 'Agents', ['Edit prompt', 'Save', 'Reset'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/pages/AgentsPage.tsx', '399-420', 'editor textarea maxLength 20000; Reset opens ConfirmDialog; Save disabled on empty/busy'),
    handler: hop('web/src/pages/AgentsPage.tsx', '235-267', 'savePrompt/confirmReset'),
    client: hop('web/src/api.ts', '421-436', 'PUT/DELETE /api/agents/:id/prompt with Idempotency-Key'),
    request: { method: 'PUT/DELETE', path: '/api/agents/:id/prompt', body: '{prompt}', headers: 'Content-Type, Idempotency-Key' },
    route: hop('src/server/app.ts', '281-304', 'trim, length<=20000, secret refusal, settings upsert/delete, E_UNSUPPORTED_AGENT'),
    service: { detail: 'settings table prompt_override:<id>; snapshot.ts:35-50 pins prompt into run snapshot' },
    store: hop('src/server/db/migrations.ts', '119-124', 'settings key/value_json'),
    response: { detail: '{agentId,saved,chars} / {agentId,reset}' },
    renderBack: hop('web/src/pages/AgentsPage.tsx', '240-242,257-259', 'editing=false + agent.reload; CodeViewer shows new prompt'),
    reentry: { detail: 'Not executed: writes production DB. Dialog open/Escape verified only.' },
  }, ['browser/agents-drawer.json'], { defect: 'F7', note: 'Save/Reset effects unverified by mandate; nested Escape bug observed.' }),

  family('T28', 'Agent ad-hoc run', 'Agents', ['Input', 'Mode', 'Max cost', 'Target path', 'Run agent'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/pages/AgentsPage.tsx', '430-483', 'file-writing agents require target; live badge; mock option disabled'),
    handler: hop('web/src/pages/AgentsPage.tsx', '269-308', 'submitRun validates cap/target/key then runAgent'),
    client: hop('web/src/api.ts', '438-450', 'POST /api/agents/:id/run Idempotency-Key'),
    request: { method: 'POST', path: '/api/agents/router/run', body: '{input,mode,maxCostUsd,targetPath}', headers: 'Content-Type, Idempotency-Key' },
    route: hop('src/server/app.ts', '306-357', 'E_AGENT_MOCK_UNAVAILABLE, key required, E_AGENT_TARGET_REQUIRED, path safety, budget, 202'),
    service: hop('src/server/runs/manager.ts', '340-350', 'createRun runKind=adhoc with metadata agentId/input/targetPath'),
    store: hop('src/server/db/migrations.ts', '119-124', 'run_meta:<id> settings row'),
    provider: { detail: 'paid DeepSeek call' },
    response: { detail: '202 {runId,replayed}' },
    renderBack: hop('web/src/pages/AgentsPage.tsx', '300', 'navigate to /runs/:id'),
    reentry: { detail: 'Not executed: paid run. Run agent disabled with empty input (verified DOM).' },
  }, ['browser/agents-drawer.json'], { note: 'No live run exercised; all inputs rendered correctly.' }),

  family('T29', 'Vault tree + file preview', 'Vault', ['Refresh', '150 tree rows', 'file preview'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/VaultPage.tsx', '23-73', '5 roots, expandable dirs, 150 rows; preview card'),
    handler: hop('web/src/pages/VaultPage.tsx', '87,92-116,119-130', 'open state, setSelected, VaultFile fetch'),
    client: hop('web/src/api.ts', '522-528', 'GET /vault/tree; GET /vault/file?path='),
    request: { method: 'GET', path: '/api/vault/tree' },
    route: hop('src/server/app.ts', '681-693', 'buildVaultTree recursive, safePath, text/plain'),
    service: hop('src/server/app.ts', '1025-1043', 'readdir walk (dotfiles skipped, dirs first)'),
    store: { detail: 'vault/ directory on disk' },
    response: { detail: 'tree 15.7KB / 5 roots; file 200 markdown' },
    renderBack: hop('web/src/pages/VaultPage.tsx', '124-129', 'ReactMarkdown + path; raw HTML not enabled'),
    reentry: { detail: 'Dir toggle 150->67->150; file click rendered Log_007238d763_architect.md' },
  }, ['browser/vault.json', 'browser/micro.json#vault', 'evidence/api/vault-tree.json']),

  family('T30', 'Learning refusal state', 'Learning', ['8 disabled tabs', 'Reason', 'Open settings', 'Refresh status'], 'REFUSED-BY-NAME', 'VERIFIED', {
    render: hop('web/src/pages/LearningPage.tsx', '88-97,150-203', 'disabled branch: tabs disabled with hint; title "Learning is unavailable"; reason code chip'),
    handler: hop('web/src/pages/LearningPage.tsx', '67-73', 'disabled when enabled===false or E_LEARNING_DISABLED/CONSENT_REQUIRED'),
    client: hop('web/src/api.ts', '472-474', 'GET /api/learning/overview'),
    request: { method: 'GET', path: '/api/learning/overview' },
    route: hop('src/server/app.ts', '538-541', 'buildLearningOverview(db, phase)'),
    service: hop('src/server/learning/overview.ts', '1-200', 'enabled false when pool exhausted; consent scopes; counts'),
    store: hop('src/server/db/migrations.ts', '341-380', 'consent_records, traces, sealed_pool'),
    response: { detail: '{"enabled":false,"reason":"E_LEARNING_POOL_EXHAUSTED","consentRequired":true,counts{traces:16,failures:2,audit:11,...}}' },
    renderBack: hop('web/src/pages/LearningPage.tsx', '150-203', 'only reason + consent-required + settings link; counts/scopes not rendered'),
    reentry: { detail: 'All 8 tabs aria-disabled=true; Refresh status is window.location.reload()' },
  }, ['evidence/api/learning-overview.json', 'browser/learning.json']),

  family('T31', 'Learning approvals/promotions/rollback', 'Learning', ['Approve & promote', 'Rollback', 'ApprovalDialog'], 'UNVERIFIED', 'READ', {
    render: hop('web/src/pages/LearningPage.tsx', '458-547', 'action buttons only for pending/active promotion rows'),
    handler: hop('web/src/pages/LearningPage.tsx', '583-612', 'typed APPROVE -> requestApproval -> promote/rollback'),
    client: hop('web/src/api.ts', '484-520', 'POST /learning/approvals /promotions /rollback + HiveAuthorization header'),
    request: { method: 'POST', path: '/api/learning/approvals|promotions|rollback', body: '{action,candidateId,evaluationId,promotionId,typedPhrase}', headers: 'Authorization: HiveApproval <token>' },
    route: hop('src/server/app.ts', '560-679', 'approval gate + real learning services; refusals E_LEARNING_*'),
    service: hop('src/server/learning/index.ts', '1-200', 'approval/promotion/rollback services'),
    store: hop('src/server/db/migrations.ts', '403-556', 'variants/eval_runs/promotions/approval_tokens'),
    response: { detail: 'promotions list is empty (0 rows); approvals/promotions refused E_LEARNING_DATASET_EMPTY / APPROVAL_REQUIRED per W5 receipt' },
    renderBack: { detail: 'no pending/active row exists, so no approval control is rendered' },
    reentry: { detail: 'Not executed: approval/promotion mutations prohibited; dataset empty.' },
  }, ['evidence/api/learning-promotions.json', 'docs/BUGFIX-WAVE-5/RECEIPT.md:32'], { note: 'Reachable only after sealed pool + consent + data; currently unreachable.' }),

  family('T32', 'Settings key/status/runtime', 'Settings', ['Refresh', 'key panel', 'runtime settings', 'Open Learning status'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/SettingsPage.tsx', '40-109', 'key panel + factory stage + runtime scalar rows'),
    handler: hop('web/src/pages/SettingsPage.tsx', '24-25,34', 'useApiResource(getKeyStatus/getSettings); Refresh both'),
    client: hop('web/src/api.ts', '293-307', 'GET key-status + settings'),
    request: { method: 'GET', path: '/api/settings + /api/settings/key-status' },
    route: hop('src/server/app.ts', '212-223', 'settings payload {model,thinking,limits,features,key}; key POST/PUT refused at 220-221'),
    service: { detail: 'config values; keyStatus()' },
    store: { detail: 'data/secrets or env; not returned' },
    response: { detail: 'settings 200 incl. limits.maxRunCostUsd .5; key-status 200 (no checkedAt/balance)' },
    renderBack: hop('web/src/pages/SettingsPage.tsx', '134-158', 'knownKeys filter drops nested limits -> runtime shows only MODEL/THINKING (F3); key panel shows Not reported truthfully'),
    reentry: { detail: 'Refresh triggers both GETs (verified); provider-key POST/PUT 403 FORBIDDEN_PROVIDER_KEY_ACCESS (curl)' },
  }, ['evidence/api/settings.json', 'browser/navigation.json#refreshes', 'evidence/logs/key-refusal.txt'], { defect: 'F3' }),

  family('T33', 'Not found route', 'NotFound', ['Return to overview'], 'WIRED-AND-WORKS', 'VERIFIED', {
    render: hop('web/src/pages/NotFoundPage.tsx', '1-17', 'Page not found + Return to overview'),
    handler: { detail: 'react-router * route' },
    client: { detail: 'none' },
    request: { method: 'GET', path: '/no-such-page', headers: 'Accept: text/html' },
    route: hop('src/server/app.ts', '969-989', 'known SPA routes 200; unknown HTML 404 index.html; unknown API 404 JSON'),
    service: { detail: 'none' }, store: { detail: 'none' },
    response: { detail: 'HTTP 404 text/html for /no-such-page; HTTP 404 E_RUN_NOT_FOUND JSON for /api/nope (F11)' },
    renderBack: hop('web/src/pages/NotFoundPage.tsx', '9-16', 'rendered inside AppShell'),
    reentry: { detail: 'Return link verified; /missing HTML 404; /runs 200' },
  }, ['browser/run-detail-controls.json#http', 'evidence/logs/unknown-api.txt'], { defect: 'F11' }),

  family('T34', 'Served routes with no UI consumer (census)', 'API', ['n/a'], 'UNVERIFIED', 'READ', {
    render: { detail: 'no component' },
    handler: { detail: 'no handler' }, client: { detail: 'no client function in web/src/api.ts' },
    request: { detail: 'none from browser' },
    route: hop('src/server/app.ts', '502-536,918-922,957-964', '/api/stats/router, /api/ops/reports/:kind, /api/scripts, /api/scripts/:id/dry-run, /api/runs/:id/files, /api/runs/:id/checks, /api/ops/system'),
    service: { detail: 'CLI/ops/API surface only' }, store: { detail: 'n/a' },
    response: { detail: 'not exercised from UI' },
    renderBack: { detail: 'none' },
    reentry: { detail: 'census note only; not a defect' },
  }, ['src/server/app.ts', 'web/src/api.ts'], { note: '48-route baseline vs 45 app.ts declarations / 42 OpenAPI paths - counting basis not documented.' }),
];

const verdictCounts = families.reduce((acc, f) => { acc[f.verdict] = (acc[f.verdict] || 0) + 1; return acc; }, {});
const levelCounts = families.reduce((acc, f) => { acc[f.verifiedLevel] = (acc[f.verifiedLevel] || 0) + 1; return acc; }, {});

const result = {
  schema: 'hive.audit.traces.v1',
  task: 'task-1 / W6-AUD-01',
  seat: 'weaver (read-only)',
  ladder: ['render', 'handler', 'client', 'request', 'route', 'service', 'store', 'provider', 'response', 'renderBack', 'reentry'],
  verdictCounts,
  levelCounts,
  families,
  confirmedDefects: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  evidenceRoots: ['docs/AUDIT-WAVE-6/weaver/evidence/api', 'docs/AUDIT-WAVE-6/weaver/evidence/browser', 'docs/AUDIT-WAVE-6/weaver/evidence/logs', 'docs/AUDIT-WAVE-6/weaver/evidence/screens'],
};

const out = path.join(path.resolve(HERE, '..'), 'traces.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ file: out, bytes: fs.statSync(out).size, verdictCounts, levelCounts, families: families.length }, null, 2));



