import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  FolderOpen,
  History,
  RefreshCw,
  RotateCcw,
  Square,
  Wrench,
} from 'lucide-react';
import type { ArtifactRecord, CheckResult, RunRecord, StepRecord } from '@shared/types';
import { TERMINAL_STATUSES } from '@shared/types';
import {
  ApiError,
  auditRun,
  cancelRun,
  getConfidence,
  getContext,
  getFailures,
  getFileContent,
  getRetries,
  getRouting,
  getRunEvents,
  getRunSnapshot,
  openRunFolder,
  reviseRun,
  runDownloadUrl,
} from '../api';
import type {
  ConfidenceView,
  ContextItemView,
  ContextPackView,
  ContextView,
  FailureClusterView,
  FailuresView,
  RetriesView,
  RetryAttemptView,
  RouteCandidateView,
  RouteDecisionView,
  RoutingView,
  RunSnapshotView,
  RunStreamEvent,
} from '../api-types';
import { useUi } from '../context';
import { useApiResource, useRunStream } from '../hooks/useApi';
import { CodeViewer } from '../components/CodeViewer';
import {
  Card,
  CheckBadge,
  ConfirmDialog,
  CostMeter,
  EmptyState,
  ErrorPanel,
  EvidenceBadge,
  formatDate,
  formatDuration,
  formatInteger,
  formatUsd,
  humanError,
  InlineNotice,
  JsonPreview,
  LoadingPanel,
  Modal,
  PageHeader,
  SectionTitle,
  Spinner,
  StageGate,
  StatusBadge,
  Tabs,
  titleCase,
  type TabItem,
} from '../components/ui';

type RunTab = 'overview' | 'files' | 'checks' | 'routing' | 'context' | 'repairs' | 'confidence' | 'events';

const BASE_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'checks', label: 'Checks' },
  { id: 'routing', label: 'Routing' },
  { id: 'context', label: 'Context' },
  { id: 'repairs', label: 'Repairs' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'events', label: 'Events' },
];

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { meta } = useUi();
  const snapshot = useApiResource<RunSnapshotView>(
    (signal) => (runId ? getRunSnapshot(runId, signal) : Promise.reject(new ApiError({ code: 'E_RUN_NOT_FOUND', status: 404, message: 'No run id supplied.' }))),
    [runId],
  );
  const [tab, setTab] = useState<RunTab>('overview');
  const [events, setEvents] = useState<RunStreamEvent[]>([]);
  const [stopOpen, setStopOpen] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<ApiError | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviseBusy, setReviseBusy] = useState(false);
  const [reviseError, setReviseError] = useState<ApiError | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<ApiError | null>(null);
  const [folderError, setFolderError] = useState<ApiError | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef(snapshot.reload);
  reloadRef.current = snapshot.reload;

  useEffect(() => {
    setTab('overview');
    setEvents([]);
  }, [runId]);

  useEffect(() => {
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, []);

  const run = snapshot.data?.run ?? null;
  const terminal = run ? TERMINAL_STATUSES.has(run.status) : false;
  const persistedEvents = useApiResource<RunStreamEvent[]>(
    (signal) => (runId && terminal ? getRunEvents(runId, signal) : Promise.resolve([])),
    [runId, terminal],
  );
  const visibleEvents = events.length > 0 ? events : persistedEvents.data ?? [];

  const streamStatus = useRunStream(run && !terminal ? runId ?? null : null, (event) => {
    setEvents((previous) => [...previous.slice(-99), event]);
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => reloadRef.current(), 250);
  });

  useEffect(() => {
    if (!run || terminal) return;
    const interval = window.setInterval(() => snapshot.reload(), 5000);
    return () => window.clearInterval(interval);
  }, [run, terminal, snapshot.reload]);

  const streamBadgeClass = terminal
    ? 'badge badge-muted'
    : streamStatus === 'live'
      ? 'badge badge-success'
      : streamStatus === 'reconnecting'
        ? 'badge badge-warn'
        : 'badge badge-muted';
  const streamLabel = terminal && run
    ? run.status === 'completed' || run.status === 'completed_with_warnings'
      ? 'Complete · snapshot'
      : 'Terminal · snapshot'
    : streamStatus === 'live'
      ? 'Live stream'
      : streamStatus === 'reconnecting'
        ? 'Reconnecting · snapshot fallback'
        : 'Snapshot only';

  const routingEnabled = meta?.features.routing !== false;
  const tabs = BASE_TABS.map((item) =>
    item.id === 'routing' || item.id === 'context' || item.id === 'repairs' || item.id === 'confidence'
      ? { ...item, disabled: !routingEnabled, hint: routingEnabled ? undefined : 'Requires B1 decision intelligence' }
      : item,
  );

  useEffect(() => {
    if (!routingEnabled && ['routing', 'context', 'repairs', 'confidence'].includes(tab)) setTab('overview');
  }, [routingEnabled, tab]);

  if (!runId) {
    return (
      <div className="page">
        <EmptyState title="No run selected" body="Open a run from the run history." action={<Link to="/runs" className="btn btn-primary">Back to runs</Link>} />
      </div>
    );
  }

  if (snapshot.loading && !snapshot.data) return <div className="page"><LoadingPanel label="Loading run snapshot…" /></div>;
  if (snapshot.error && !snapshot.data) {
    return (
      <div className="page">
        <ErrorPanel error={snapshot.error} onRetry={snapshot.reload} title="Run unavailable" />
        <div className="mt-4"><Link to="/runs" className="link-button"><ArrowLeft size={13} aria-hidden /> Back to runs</Link></div>
      </div>
    );
  }
  if (!run) {
    return <div className="page"><EmptyState title="Run not found" body="The API returned no run record." /></div>;
  }

  const artifacts = snapshot.data?.artifacts ?? [];
  const checks = snapshot.data?.checks ?? [];
  const steps = snapshot.data?.steps ?? [];
  const snapshotRecord = snapshot.data as unknown as Record<string, unknown> | undefined;
  const limitRecord = snapshotRecord && isRecord(snapshotRecord.limits) ? snapshotRecord.limits : {};
  const costCap = readNumber(limitRecord.maxCostUsd) ?? null;
  const canRevise = terminal && artifacts.length > 0;
  const canAudit = terminal && artifacts.length > 0;
  const downloadable = terminal && artifacts.length > 0;

  async function confirmStop() {
    setStopBusy(true);
    setStopError(null);
    try {
      await cancelRun(run!.id);
      setStopOpen(false);
      snapshot.reload();
    } catch (caught) {
      setStopError(caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Cancel failed.' }));
    } finally {
      setStopBusy(false);
    }
  }

  async function submitRevision() {
    if (!feedback.trim()) return;
    setReviseBusy(true);
    setReviseError(null);
    try {
      const childId = await reviseRun(run!.id, feedback.trim());
      setReviseOpen(false);
      navigate(`/runs/${encodeURIComponent(childId)}`);
    } catch (caught) {
      setReviseError(caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Revision failed.' }));
    } finally {
      setReviseBusy(false);
    }
  }

  async function startAudit() {
    if (!canAudit) return;
    setAuditBusy(true);
    setAuditError(null);
    try {
      const childId = await auditRun(run!.id, `Audit run ${run!.id}: inspect the accepted artifacts and report defects.`);
      setAuditOpen(false);
      navigate(`/runs/${encodeURIComponent(childId)}`);
    } catch (caught) {
      setAuditError(caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Audit run failed.' }));
    } finally {
      setAuditBusy(false);
    }
  }

  async function openFolder() {
    setFolderBusy(true);
    setFolderError(null);
    try {
      await openRunFolder(run!.id);
    } catch (caught) {
      setFolderError(caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Open folder failed.' }));
    } finally {
      setFolderBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="mb-4">
        <Link to="/runs" className="link-button"><ArrowLeft size={13} aria-hidden /> All runs</Link>
      </div>

      <PageHeader
        eyebrow={`${run.id} · ${titleCase(run.runKind)} run`}
        title={truncate(run.brief, 120)}
        description={`${titleCase(run.preset)} · ${run.model} · thinking ${run.thinking}${run.effort ? ` · effort ${run.effort}` : ''}`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={snapshot.reload} disabled={snapshot.loading}>
              {snapshot.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
            </button>
            {!terminal ? (
              <button type="button" className="btn btn-danger" onClick={() => setStopOpen(true)}>
                <Square size={14} aria-hidden /> Stop
              </button>
            ) : null}
            {canRevise ? (
              <button type="button" className="btn btn-secondary" onClick={() => setReviseOpen(true)}>
                <RotateCcw size={14} aria-hidden /> Revise
              </button>
            ) : null}
            {terminal ? (
              canAudit ? (
                <button type="button" className="btn btn-secondary" onClick={() => setAuditOpen(true)}>
                  <Wrench size={14} aria-hidden /> Audit
                </button>
              ) : null
            ) : null}
            {downloadable ? (
              <a className="btn btn-secondary" href={runDownloadUrl(run.id)} title="Download artifacts">
                <Download size={14} aria-hidden /> Download
              </a>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-disabled"
                disabled
                title={terminal ? 'This run has no artifacts to download.' : 'Downloads are available only after a terminal state.'}
              >
                <Download size={14} aria-hidden /> Download
              </button>
            )}
          </>
        }
      />

      {snapshot.error && snapshot.data ? (
        <div className="mb-4">
          <InlineNotice tone="warn">
            Refresh failed ({snapshot.error.code}); showing the last persisted snapshot. No new state has been invented.
          </InlineNotice>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            <span className="badge badge-muted">{titleCase(run.phase)}</span>
            <span className="badge badge-muted">{(snapshot.data?.steps ?? []).length} steps</span>
            <span className={streamBadgeClass}>
              <span className="status-dot" aria-hidden />
              {streamLabel}
            </span>
            {snapshot.data?.truncated ? <span className="badge badge-warn">Replay truncated</span> : null}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="Created" value={formatDate(run.createdAt)} />
            <Fact label="Duration" value={formatDuration(run.startedAt, run.finishedAt)} />
            <Fact label="Prompt tokens" value={formatInteger(run.promptTokens)} />
            <Fact label="Completion tokens" value={formatInteger(run.completionTokens)} />
            <Fact label="Snapshot" value={run.snapshotHash ? `${run.snapshotHash.slice(0, 16)}…` : '—'} />
            <Fact label="Parent" value={run.parentRunId ? <Link className="link-button" to={`/runs/${encodeURIComponent(run.parentRunId)}`}>{run.parentRunId.slice(0, 12)}…</Link> : 'None'} />
          </dl>
          <div className="mt-4">
            <CostMeter costUsd={run.costUsd} capUsd={costCap} />
          </div>
          {run.errorCode || run.errorMessage ? (
            <div className="mt-4">
              <InlineNotice tone="error">
                {run.errorCode ? <code className="code-chip">{run.errorCode}</code> : null} {run.errorMessage ?? 'The run reported an error without a message.'}
              </InlineNotice>
            </div>
          ) : null}
          {run.status === 'needs_review' ? (
            <div className="mt-4"><InlineNotice tone="warn">This run is paused for review. It is not complete; do not treat its artifacts as accepted.</InlineNotice></div>
          ) : null}
          {folderError ? <div className="mt-4"><InlineNotice tone="error">{humanError(folderError)}</InlineNotice></div> : null}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Run actions" description="Actions are real API calls; unavailable actions are not rendered." />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={openFolder} disabled={folderBusy}>
              {folderBusy ? <Spinner /> : <FolderOpen size={14} aria-hidden />} Open folder
            </button>
            {!terminal ? (
              <button type="button" className="btn btn-danger" onClick={() => setStopOpen(true)}>
                <Square size={14} aria-hidden /> Stop run
              </button>
            ) : null}
            {canRevise ? (
              <button type="button" className="btn btn-secondary" onClick={() => setReviseOpen(true)}>
                <RotateCcw size={14} aria-hidden /> Revise accepted files
              </button>
            ) : (
              <span className="text-xs text-slate-500">Revision requires a terminal run with artifacts.</span>
            )}
            {terminal ? (
              canAudit ? (
                <button type="button" className="btn btn-secondary" onClick={() => setAuditOpen(true)}>
                  <Wrench size={14} aria-hidden /> Audit this run
                </button>
              ) : (
                <span className="text-xs text-slate-500">Audit requires stored artifacts.</span>
              )
            ) : null}
          </div>
          <div className="mt-4">
            <p className="label">Accepted tree</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{run.workspacePath || 'Not reported'}</p>
          </div>
          <p className="mt-4 text-xs text-slate-400">Downloads are available only for terminal runs that have stored artifacts.</p>
        </Card>
      </div>

      <div className="mt-5">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as RunTab)} label="Run sections" />
      </div>

      <div className="mt-4" role="tabpanel">
        {tab === 'overview' ? (
          <OverviewTab run={run} steps={steps} checks={checks} artifacts={artifacts} />
        ) : tab === 'files' ? (
          <FilesTab runId={run.id} artifacts={artifacts} terminal={terminal} />
        ) : tab === 'checks' ? (
          <ChecksTab checks={checks} />
        ) : tab === 'routing' ? (
          routingEnabled ? <RoutingTab runId={run.id} /> : <StageGate feature="Routing" stage="B1 decision intelligence" />
        ) : tab === 'context' ? (
          routingEnabled ? <ContextTab runId={run.id} /> : <StageGate feature="Context inspection" stage="B1 decision intelligence" />
        ) : tab === 'repairs' ? (
          routingEnabled ? <RepairsTab runId={run.id} /> : <StageGate feature="Repairs" stage="B1 decision intelligence" />
        ) : tab === 'confidence' ? (
          routingEnabled ? <ConfidenceTab runId={run.id} /> : <StageGate feature="Confidence" stage="B1 decision intelligence" />
        ) : (
          <EventsTab
            events={visibleEvents}
            lastEventId={snapshot.data?.lastEventId}
            streamStatus={streamStatus}
            terminal={terminal}
            loading={persistedEvents.loading}
            error={persistedEvents.error}
          />
        )}
      </div>

      <ConfirmDialog
        open={stopOpen}
        title="Stop this run?"
        body="Stop requests cancellation. In-flight provider calls are aborted and the run is marked cancelled. No fake completion is recorded."
        confirmLabel="Stop run"
        tone="danger"
        busy={stopBusy}
        error={stopError ? humanError(stopError) : null}
        onConfirm={confirmStop}
        onClose={() => setStopOpen(false)}
      />

      <Modal
        open={reviseOpen}
        onClose={() => setReviseOpen(false)}
        title="Revise this run"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setReviseOpen(false)} disabled={reviseBusy}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={reviseBusy || feedback.trim().length < 4} onClick={submitRevision}>
              {reviseBusy ? <Spinner /> : <RotateCcw size={14} aria-hidden />} Start revision
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          A revision creates a child run from the accepted artifacts. The parent is never mutated. Describe the change; only targeted files should be revised.
        </p>
        <label className="mt-4 block">
          <span className="label">Revision feedback</span>
          <textarea className="input mt-1 min-h-[120px]" value={feedback} onChange={(event) => setFeedback(event.target.value)} />
        </label>
        {reviseError ? <div className="mt-3"><InlineNotice tone="error">{humanError(reviseError)}</InlineNotice></div> : null}
      </Modal>

      <ConfirmDialog
        open={auditOpen}
        title="Start an audit run?"
        body="The audit preset reviews the accepted files through the cleaner, hardener, tests, and verifier. It does not regenerate the original brief."
        confirmLabel="Start audit"
        busy={auditBusy}
        error={auditError ? humanError(auditError) : null}
        onConfirm={startAudit}
        onClose={() => setAuditOpen(false)}
      />
    </div>
  );
}

function OverviewTab({
  run,
  steps,
  checks,
  artifacts,
}: {
  run: RunRecord;
  steps: StepRecord[];
  checks: CheckResult[];
  artifacts: ArtifactRecord[];
}) {
  const failedChecks = checks.filter((check) => check.status === 'fail' || check.status === 'unverified');
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="p-6">
        <SectionTitle title="Execution timeline" description="Steps are read from the persisted snapshot; active runs also refresh from the stream. Terminal runs are snapshot-only." />
        <div className="mt-4">
          {steps.length === 0 ? (
            <EmptyState icon={History} title="No steps recorded" body="The run has not persisted a step yet. This is not a successful empty run." />
          ) : (
            <ol className="timeline">
              {[...steps].sort((a, b) => a.seq - b.seq).map((step) => (
                <li key={step.id} className="timeline-item">
                  <span className={`timeline-dot timeline-${step.status}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400">#{step.seq}</span>
                      <span className="badge badge-muted">{titleCase(step.phase)}</span>
                      {step.agentId ? <span className="font-mono text-xs text-slate-600">{step.agentId}</span> : null}
                      <span className={`badge ${step.status === 'succeeded' ? 'badge-success' : step.status === 'failed' ? 'badge-error' : 'badge-muted'}`}>
                        {titleCase(step.status)}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-slate-400">{formatDuration(step.startedAt, step.finishedAt)}</span>
                    </div>
                    {step.outputSummary ? <p className="mt-1 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{truncate(step.outputSummary, 240)}</p> : null}
                    {step.errorCode || step.errorMessage ? (
                      <p className="mt-1 text-xs text-red-700">{step.errorCode ? `${step.errorCode}: ` : ''}{step.errorMessage}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-[10px] text-slate-400">
                      {formatInteger(step.promptTokens)} in / {formatInteger(step.completionTokens)} out / {formatUsd(step.costUsd)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <div className="min-w-0 space-y-5">
        <Card className="p-6">
          <SectionTitle title="Brief" description="The exact input that was planned. It is treated as untrusted data." />
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{run.brief}</p>
          {run.summary ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="label">Run summary</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{run.summary}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <SectionTitle title="Checks & artifacts" description="Counts are facts; a passing count is not a quality guarantee." />
          <dl className="mt-3 space-y-2 text-sm">
            <Fact label="Checks" value={`${checks.length} total · ${failedChecks.length} fail/unverified`} />
            <Fact label="Artifacts" value={formatInteger(artifacts.length)} />
            <Fact label="Trace complete" value={run.traceComplete ? 'Yes' : 'No'} />
            <Fact label="Policy version" value={run.policyVersionId ?? '—'} />
          </dl>
          <div className="mt-4 text-xs text-slate-500">
            Use the Checks and Files tabs above to inspect the persisted verification and artifacts.
          </div>
        </Card>
      </div>
    </div>
  );
}

function FilesTab({ runId, artifacts, terminal }: { runId: string; artifacts: ArtifactRecord[]; terminal: boolean }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selected = artifacts.find((artifact) => artifact.path === selectedPath) ?? artifacts[0] ?? null;

  useEffect(() => {
    if (!selectedPath && artifacts[0]) setSelectedPath(artifacts[0].path);
  }, [artifacts, selectedPath]);

  return (
    <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
      <Card className="p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="font-mono-ui text-[10px] uppercase tracking-widest text-slate-400">Artifacts</span>
          <span className="text-xs text-slate-400">{artifacts.length}</span>
        </div>
        {artifacts.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">No artifacts have been stored.</p>
        ) : (
          <div className="vault-tree">
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                className={`vault-row ${selected?.path === artifact.path ? 'vault-row-active' : ''}`}
                onClick={() => setSelectedPath(artifact.path)}
              >
                <FileText size={14} aria-hidden />
                <span className="truncate">{artifact.path}</span>
              </button>
            ))}
          </div>
        )}
        {!terminal ? <p className="p-3 text-xs text-slate-400">Files are staged until the run reaches a terminal state.</p> : null}
      </Card>

      <Card className="p-5">
        {selected ? (
          <ArtifactView runId={runId} artifact={selected} />
        ) : (
          <EmptyState icon={FileText} title="No file selected" body="Artifacts appear only when the API has stored them." />
        )}
      </Card>
    </div>
  );
}

function ArtifactView({ runId, artifact }: { runId: string; artifact: ArtifactRecord }) {
  const content = useApiResource((signal) => getFileContent(runId, artifact.path, signal), [runId, artifact.path]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-muted">{titleCase(artifact.kind)}</span>
        <span className="badge badge-muted">{artifact.language}</span>
        <span className={`badge ${artifact.redactionStatus === 'clean' ? 'badge-success' : artifact.redactionStatus === 'redacted' ? 'badge-warn' : 'badge-error'}`}>
          {titleCase(artifact.redactionStatus)}
        </span>
        {artifact.revisedFrom ? <span className="badge badge-info">revised</span> : null}
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Fact label="Path" value={artifact.path} />
        <Fact label="Bytes" value={formatInteger(artifact.bytes)} />
        <Fact label="Agent" value={artifact.agentId ?? '—'} />
        <Fact label="SHA-256" value={`${artifact.sha256.slice(0, 18)}…`} />
      </dl>
      <div className="mt-4">
        {content.loading ? <LoadingPanel label="Loading file…" /> : content.error ? (
          <ErrorPanel error={content.error} onRetry={content.reload} title="File unavailable" />
        ) : content.data !== null ? (
          <CodeViewer code={content.data} language={artifact.language} path={artifact.path} bytes={artifact.bytes} />
        ) : null}
      </div>
    </div>
  );
}

function ChecksTab({ checks }: { checks: CheckResult[] }) {
  return (
    <Card className="p-6">
      <SectionTitle
        title="Verification checks"
        description="Mandatory checks are never skipped. Unverified is not a pass; a missing tool stays unverified."
      />
      <div className="mt-4">
        {checks.length === 0 ? (
          <EmptyState title="No checks recorded" body="No verification result has been persisted. This is not an all-clear." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Mandatory</th>
                  <th>Detail</th>
                  <th>File</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id}>
                    <td className="font-mono text-xs">{check.id}</td>
                    <td><CheckBadge status={check.status} /></td>
                    <td>{check.mandatory ? 'Yes' : 'No'}</td>
                    <td className="max-w-[420px] text-sm text-slate-600">{check.detail || '—'}</td>
                    <td className="font-mono text-xs">
                      {check.file ? `${check.file}${check.line ? `:${check.line}` : ''}` : check.code ?? '—'}
                    </td>
                    <td className="font-mono text-xs">{typeof check.durationMs === 'number' ? `${check.durationMs} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function RoutingTab({ runId }: { runId: string }) {
  const routing = useApiResource((signal) => getRouting(runId, signal), [runId]);
  return (
    <Card className="p-6">
      <SectionTitle title="Routing decisions" description="Every factor is shown. A composite score is never displayed without its capability, cost, latency, risk, and evidence inputs." action={<button type="button" className="btn btn-ghost btn-small" onClick={routing.reload}>Refresh</button>} />
      <div className="mt-4">
        {routing.loading ? <LoadingPanel label="Loading routing decisions…" /> : routing.error ? (
          <ErrorPanel error={routing.error} onRetry={routing.reload} title="Routing unavailable" />
        ) : !routing.data ? (
          <EmptyState title="No routing record" body="The API returned no routing decision for this run." />
        ) : (
          <RoutingViewPanel data={routing.data} />
        )}
      </div>
    </Card>
  );
}

function RoutingViewPanel({ data }: { data: RoutingView }) {
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const refusals = Array.isArray(data.refusals) ? data.refusals : [];
  if (decisions.length === 0 && refusals.length === 0) {
    return <EmptyState title="No route decisions" body="No decision or refusal was returned. This tab does not infer a route." />;
  }
  return (
    <div className="space-y-4">
      {refusals.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-950">Route refusals</p>
          <ul className="mt-2 space-y-1 text-sm text-red-900">
            {refusals.map((refusal, index) => (
              <li key={index}>{typeof refusal === 'string' ? refusal : <JsonPreview value={refusal} maxChars={1200} />}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {decisions.map((decision, index) => <RouteDecisionCard key={String(decision.id ?? index)} decision={decision} />)}
      {typeof data.allocatedCostUsd === 'number' || typeof data.reserveUsd === 'number' ? (
        <p className="text-xs text-slate-500">
          Allocated {formatUsd(data.allocatedCostUsd)} · repair reserve {formatUsd(data.reserveUsd)}
        </p>
      ) : null}
    </div>
  );
}

function RouteDecisionCard({ decision }: { decision: RouteDecisionView }) {
  const candidates = Array.isArray(decision.candidates) ? decision.candidates : [];
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-400">{decision.id ?? decision.taskId ?? 'decision'}</p>
          <h3 className="mt-1 font-semibold">{decision.taskPath ?? decision.taskId ?? 'Task'}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {decision.agentId ? <span className="badge badge-info">{decision.agentId}</span> : null}
          {decision.chosen === false ? <span className="badge badge-muted">not chosen</span> : null}
          {decision.risk ? <span className="badge badge-warn">{decision.risk}</span> : null}
        </div>
      </div>
      {decision.reason ? <p className="mt-2 text-sm text-slate-600">{decision.reason}</p> : null}
      {candidates.length > 0 ? (
        <div className="table-wrap mt-3">
          <table className="data-table">
            <thead>
              <tr><th>Candidate</th><th>Model</th><th>Quality</th><th>Evidence</th><th>Cost</th><th>Latency</th><th>Risk</th><th>Chosen</th></tr>
            </thead>
            <tbody>
              {candidates.map((candidate, index) => (
                <tr key={`${candidate.agentId ?? 'candidate'}-${index}`}>
                  <td className="font-mono text-xs">{candidate.agentId ?? '—'}</td>
                  <td className="text-xs">{candidate.model ?? '—'}{candidate.thinking ? ` · ${candidate.thinking}` : ''}</td>
                  <td className="font-mono text-xs">{formatMetric(candidate.quality)}</td>
                  <td className="text-xs">{candidate.qualitySource ?? '—'}{typeof candidate.sampleSize === 'number' ? ` · n=${candidate.sampleSize}` : ''}</td>
                  <td className="font-mono text-xs">{formatUsd(candidate.costUsd)}</td>
                  <td className="font-mono text-xs">{typeof candidate.latencyMs === 'number' ? `${candidate.latencyMs} ms` : '—'}</td>
                  <td className="text-xs">{candidate.risk ?? '—'}</td>
                  <td>{candidate.chosen ? <span className="badge badge-info">Chosen</span> : <span className="text-xs text-slate-400">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {decision.fallbacks?.length ? <p className="mt-2 text-xs text-slate-500">Fallbacks: {decision.fallbacks.join(' → ')}</p> : null}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-500">Raw decision</summary>
        <JsonPreview value={decision} maxChars={2400} />
      </details>
    </div>
  );
}

function ContextTab({ runId }: { runId: string }) {
  const context = useApiResource((signal) => getContext(runId, signal), [runId]);
  return (
    <Card className="p-6">
      <SectionTitle title="Context packs" description="Included and excluded items are shown with reasons and estimated size. No raw context is dumped here." action={<button type="button" className="btn btn-ghost btn-small" onClick={context.reload}>Refresh</button>} />
      <div className="mt-4">
        {context.loading ? <LoadingPanel label="Loading context packs…" /> : context.error ? (
          <ErrorPanel error={context.error} onRetry={context.reload} title="Context unavailable" />
        ) : !context.data ? (
          <EmptyState title="No context records" body="The API returned no context pack for this run." />
        ) : (
          <ContextViewPanel data={context.data} />
        )}
      </div>
    </Card>
  );
}

function ContextViewPanel({ data }: { data: ContextView }) {
  const packs = Array.isArray(data.packs) ? data.packs : [];
  const looseItems = Array.isArray(data.items) ? data.items : [];
  if (packs.length === 0 && looseItems.length === 0) {
    return <EmptyState title="No context packs" body="No pack or item was returned. No token estimate is invented." />;
  }
  return (
    <div className="space-y-4">
      {packs.map((pack, index) => <ContextPackCard key={String(pack.id ?? index)} pack={pack} />)}
      {looseItems.length > 0 ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Context items</h3>
          <ContextItems items={looseItems} />
        </div>
      ) : null}
    </div>
  );
}

function ContextPackCard({ pack }: { pack: ContextPackView }) {
  const items = Array.isArray(pack.items) ? pack.items : [];
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-slate-400">{pack.id ?? 'pack'}</p>
          <h3 className="mt-1 font-semibold">{pack.taskId ?? pack.agentId ?? 'Context pack'}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-muted">
            {typeof pack.usedTokens === 'number' ? `${formatInteger(pack.usedTokens)} tokens` : 'tokens not reported'}
            {typeof pack.maxTokens === 'number' ? ` / ${formatInteger(pack.maxTokens)} max` : ''}
          </span>
          {pack.prefixHash ? <span className="badge badge-info">prefix {pack.prefixHash.slice(0, 10)}…</span> : null}
        </div>
      </div>
      {items.length > 0 ? <ContextItems items={items} /> : <p className="mt-3 text-sm text-slate-500">No items were reported for this pack.</p>}
    </div>
  );
}

function ContextItems({ items }: { items: ContextItemView[] }) {
  return (
    <div className="table-wrap mt-3">
      <table className="data-table">
        <thead><tr><th>Path</th><th>Kind</th><th>Tokens</th><th>Chars</th><th>Mandatory</th><th>Reason</th><th>Included</th></tr></thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={String(item.id ?? item.path ?? index)}>
              <td className="font-mono text-xs">{item.path ?? item.id ?? '—'}</td>
              <td className="text-xs">{item.kind ?? '—'}</td>
              <td className="font-mono text-xs">{formatInteger(item.tokens)}</td>
              <td className="font-mono text-xs">{formatInteger(item.chars)}</td>
              <td className="text-xs">{typeof item.mandatory === 'boolean' ? (item.mandatory ? 'Yes' : 'No') : 'Not reported'}</td>
              <td className="text-xs text-slate-600">{item.reason ?? '—'}</td>
              <td>{item.included === true ? <span className="badge badge-success">Included</span> : item.included === false ? <span className="badge badge-muted">Excluded</span> : <span className="text-xs text-slate-400">Not reported</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepairsTab({ runId }: { runId: string }) {
  const failures = useApiResource((signal) => getFailures(runId, signal), [runId]);
  const retries = useApiResource((signal) => getRetries(runId, signal), [runId]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-6">
        <SectionTitle title="Failure signatures" description="Clusters are normalized; recurrence at two failed repairs becomes a stall, not a third blind attempt." action={<button type="button" className="btn btn-ghost btn-small" onClick={failures.reload}>Refresh</button>} />
        <div className="mt-4">
          {failures.loading ? <LoadingPanel label="Loading failures…" /> : failures.error ? <ErrorPanel error={failures.error} onRetry={failures.reload} title="Failures unavailable" /> : <FailuresPanel data={failures.data} />}
        </div>
      </Card>
      <Card className="p-6">
        <SectionTitle title="Retry / switch history" description="No retry for auth, payment, path, policy, or budget. Unknown amounts stay unknown." action={<button type="button" className="btn btn-ghost btn-small" onClick={retries.reload}>Refresh</button>} />
        <div className="mt-4">
          {retries.loading ? <LoadingPanel label="Loading retries…" /> : retries.error ? <ErrorPanel error={retries.error} onRetry={retries.reload} title="Retries unavailable" /> : <RetriesPanel data={retries.data} />}
        </div>
      </Card>
    </div>
  );
}

function FailuresPanel({ data }: { data: FailuresView | null }) {
  const clusters = Array.isArray(data?.clusters) ? data.clusters : Array.isArray(data?.signatures) ? data.signatures : [];
  if (clusters.length === 0) return <EmptyState title="No failure clusters" body="No signature was recorded. This is not a claim that the code is correct." />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Signature</th><th>Category</th><th>Count</th><th>Severity</th><th>Repair</th></tr></thead>
        <tbody>
          {clusters.map((cluster: FailureClusterView, index) => (
            <tr key={String(cluster.id ?? cluster.signature ?? index)}>
              <td className="max-w-[260px] truncate font-mono text-xs">{cluster.signature ?? cluster.id ?? '—'}</td>
              <td className="text-xs">{cluster.category ?? '—'}</td>
              <td className="font-mono text-xs">{formatInteger(cluster.count)}</td>
              <td className="text-xs">{cluster.severity ?? '—'}</td>
              <td className="text-xs">{cluster.repairStatus ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetriesPanel({ data }: { data: RetriesView | null }) {
  const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
  if (attempts.length === 0) return <EmptyState title="No retry attempts" body="No retry or switch record was returned." />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Task</th><th>Attempt</th><th>Action</th><th>Decision</th><th>Cost</th></tr></thead>
        <tbody>
          {attempts.map((attempt: RetryAttemptView, index) => (
            <tr key={String(attempt.id ?? index)}>
              <td className="font-mono text-xs">{attempt.taskId ?? '—'}</td>
              <td className="font-mono text-xs">{attempt.attempt ?? '—'}</td>
              <td className="text-xs">{attempt.action ?? '—'}</td>
              <td className="text-xs">{attempt.decision ?? attempt.reason ?? '—'}</td>
              <td className="font-mono text-xs">{formatUsd(attempt.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceTab({ runId }: { runId: string }) {
  const confidence = useApiResource((signal) => getConfidence(runId, signal), [runId]);
  return (
    <Card className="p-6">
      <SectionTitle title="Conservative confidence" description="Mandatory fail or unverified forbids acceptance. n<30 calibration is not a P6a gate." action={<button type="button" className="btn btn-ghost btn-small" onClick={confidence.reload}>Refresh</button>} />
      <div className="mt-4">
        {confidence.loading ? <LoadingPanel label="Loading confidence…" /> : confidence.error ? <ErrorPanel error={confidence.error} onRetry={confidence.reload} title="Confidence unavailable" /> : <ConfidencePanel data={confidence.data} />}
      </div>
    </Card>
  );
}

function ConfidencePanel({ data }: { data: ConfidenceView | null }) {
  if (!data) return <EmptyState title="No confidence record" body="No confidence decision was returned. No green badge is invented." />;
  const failed = Array.isArray(data.mandatoryFailed) ? data.mandatoryFailed : [];
  const unverified = Array.isArray(data.mandatoryUnverified) ? data.mandatoryUnverified : [];
  const decision = (data.decision ?? '').toLowerCase();
  const contradiction = (decision === 'accept' || decision === 'accepted') && (failed.length > 0 || unverified.length > 0);
  const tone =
    contradiction || decision === 'reject' || decision === 'refused'
      ? ('refused' as const)
      : decision === 'none_measured'
        ? ('none_measured' as const)
        : decision === 'insufficient' || decision === 'insufficient_sample'
          ? ('insufficient_sample' as const)
          : decision === 'forbidden'
            ? ('forbidden' as const)
            : decision === 'accept' || decision === 'accepted'
              ? ('accepted' as const)
              : ('needs_review' as const);
  const decisionLabel =
    decision === 'none_measured'
      ? 'None measured'
      : decision === 'insufficient_sample' || decision === 'insufficient'
        ? 'Insufficient sample'
        : decision
          ? decision.replace(/[-_]/g, ' ')
          : 'No decision';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceBadge tone={tone} label={decisionLabel} />
        <span className="font-mono text-xs text-slate-500">score {formatMetric(data.score)}</span>
        {data.provisional ? <span className="badge badge-warn">Provisional</span> : null}
      </div>
      {contradiction ? (
        <InlineNotice tone="error">
          The confidence record says accept while mandatory checks are failed or unverified. The plan forbids this; the UI does not show a green acceptance.
        </InlineNotice>
      ) : null}
      {failed.length > 0 || unverified.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold">Mandatory evidence gaps</p>
          {failed.length > 0 ? <p className="mt-1">Failed: {failed.join(', ')}</p> : null}
          {unverified.length > 0 ? <p className="mt-1">Unverified: {unverified.join(', ')}</p> : null}
        </div>
      ) : null}
      {data.components ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {Object.entries(data.components).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <dt className="text-slate-500">{key.replace(/_/g, ' ')}</dt>
              <dd className="font-mono">{formatMetric(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">No component scores were returned.</p>
      )}
      {data.reasons?.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">{data.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
      <details>
        <summary className="cursor-pointer text-xs text-slate-500">Raw confidence record</summary>
        <JsonPreview value={data} maxChars={2400} />
      </details>
    </div>
  );
}

function EventsTab({
  events,
  lastEventId,
  streamStatus,
  terminal,
  loading,
  error,
}: {
  events: RunStreamEvent[];
  lastEventId?: number;
  streamStatus: string;
  terminal: boolean;
  loading: boolean;
  error: ApiError | null;
}) {
  return (
    <Card className="p-6">
      <SectionTitle
        title={terminal ? 'Persisted events' : 'Live events'}
        description={
          terminal
            ? 'Terminal runs load the persisted event ledger (latest 500). The snapshot remains the source of truth.'
            : `Connection: ${streamStatus}. Events are bounded to the latest 100; the snapshot is the source of truth after reconnect.`
        }
      />
      <div className="mt-4">
        {loading ? (
          <LoadingPanel label="Loading persisted events…" />
        ) : error ? (
          <ErrorPanel error={error} title="Events unavailable" />
        ) : events.length === 0 ? (
          <EmptyState
            title={terminal ? 'No persisted events recorded' : 'No live events observed'}
            body={
              terminal
                ? `The events endpoint returned no rows. Snapshot last event id: ${lastEventId ?? 'not reported'}.`
                : `No event has arrived in this browser session. Snapshot last event id: ${lastEventId ?? 'not reported'}.`
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Type</th><th>Received</th><th>Payload</th></tr></thead>
              <tbody>
                {events.slice().reverse().map((event, index) => (
                  <tr key={`${event.receivedAt}-${index}`}>
                    <td className="font-mono text-xs">{event.type}</td>
                    <td className="text-xs text-slate-500">{formatDate(event.receivedAt)}</td>
                    <td className="max-w-[520px]">
                      <details>
                        <summary className="cursor-pointer text-xs text-slate-500">Inspect</summary>
                        <JsonPreview value={event.data} maxChars={1500} />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatMetric(value: unknown): string {
  const number = readNumber(value);
  return number === null ? '—' : number.toFixed(3);
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
