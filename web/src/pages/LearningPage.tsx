import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  FlaskConical,
  History,
  Lock,
  ScrollText,
  Sparkles,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import {
  ApiError,
  getLearningOverview,
  listLearningRecords,
  promoteLearning,
  requestApproval,
  rollbackLearning,
} from '../api';
import type {
  ApprovalResponse,
  LearningOverview,
  LearningRecord,
} from '../api-types';
import { useApiResource } from '../hooks/useApi';
import {
  Card,
  EmptyState,
  ErrorPanel,
  EvidenceBadge,
  formatDate,
  formatInteger,
  humanError,
  InlineNotice,
  JsonPreview,
  LoadingPanel,
  Modal,
  PageHeader,
  SectionTitle,
  Spinner,
  Tabs,
  type TabItem,
} from '../components/ui';

type LearningTab = 'overview' | 'traces' | 'failures' | 'datasets' | 'candidates' | 'evaluations' | 'promotions' | 'audit';
type LearningKind = Exclude<LearningTab, 'overview'>;

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'traces', label: 'Traces' },
  { id: 'failures', label: 'Failures' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'evaluations', label: 'Evaluations' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'audit', label: 'Audit' },
];

export function LearningPage() {
  const overview = useApiResource(getLearningOverview);
  const [tab, setTab] = useState<LearningTab>('overview');

  const disabled =
    overview.data?.enabled === false ||
    (overview.error !== null &&
      (overview.error.code === 'E_LEARNING_DISABLED' ||
        overview.error.code === 'E_LEARNING_CONSENT_REQUIRED'));

  const notAvailable = overview.error?.status === 404 || overview.error?.code === 'E_STAGE_LEAK';

  return (
    <div className="page">
      <PageHeader
        eyebrow="P7 · Screening-grade, human-gated"
        title="Learning"
        description="A learning loop only proposes candidates; a human approves or rejects a promotion. No candidate auto-applies, and no metric is displayed without its sample size."
        actions={
          <Link to="/settings" className="btn btn-secondary">
            <Lock size={15} aria-hidden /> Trust &amp; status
          </Link>
        }
      />

      {overview.loading ? (
        <LoadingPanel label="Reading learning status…" />
      ) : disabled ? (
        <LearningDisabled overview={overview.data} error={overview.error} />
      ) : notAvailable ? (
        <EmptyState
          icon={FlaskConical}
          title="Learning is not part of this release stage"
          body="The API returned no P7 learning surface. The page states that refusal rather than showing an empty fake dataset."
        />
      ) : overview.error ? (
        <ErrorPanel error={overview.error} onRetry={overview.reload} title="Learning status unavailable" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <EvidenceBadge tone="needs_review" label="Screening-grade" detail="Low power; no general-quality claim; promotion is not expected." />
            <span className="text-xs text-slate-500">
              {overview.data?.screeningLabel ?? 'No candidate is promoted without a single-use 50-pair holdout and a human approval token.'}
            </span>
          </div>

          {overview.data?.reason ? (
            <div className="mb-4">
              <InlineNotice tone="warn">
                <strong>Learning is limited ({overview.data.reason}).</strong>{' '}
                {overview.data.reason === 'E_LEARNING_POOL_EXHAUSTED'
                  ? 'No sealed 65-case evaluation block is available. Evaluation and promotion are refused; the tabs below are inspect-only. Empty tables do not mean ready.'
                  : 'The learning loop reported a refusal. Tabs below are inspect-only until the stated prerequisite is resolved.'}
              </InlineNotice>
            </div>
          ) : null}
          {overview.data?.consentRequired ? (
            <div className="mb-4">
              <InlineNotice tone="warn">
                <strong>Consent is not configured.</strong> Trace retention and case-to-provider evaluation scopes are not granted. No trace or evaluation can enter the loop.
              </InlineNotice>
            </div>
          ) : null}

          <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as LearningTab)} label="Learning sections" />

          <div className="mt-5">
            {tab === 'overview' ? (
              <LearningOverviewPanel overview={overview.data} />
            ) : tab === 'datasets' ? (
              <DatasetsTab />
            ) : tab === 'candidates' ? (
              <CandidatesTab />
            ) : tab === 'evaluations' ? (
              <EvaluationsTab />
            ) : tab === 'promotions' ? (
              <PromotionsTab />
            ) : (
              <LearningListTab kind={tab as LearningKind} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LearningDisabled({ overview, error }: { overview: LearningOverview | null; error: ApiError | null }) {
  const code = error?.code ?? overview?.reason ?? 'E_LEARNING_DISABLED';
  const poolRefused = code === 'E_LEARNING_POOL_EXHAUSTED';
  const consentRefused = code === 'E_LEARNING_CONSENT_REQUIRED' || (!error && overview?.consentRequired === true);
  const sampleRefused = code === 'E_LEARNING_INSUFFICIENT_SAMPLE';
  const title = poolRefused ? 'Learning is unavailable' : consentRefused ? 'Consent required' : sampleRefused ? 'More evidence needed' : 'Learning is off';
  const body = poolRefused
    ? 'The sealed evaluation pool is empty. No candidate can be evaluated or promoted; this is a refusal, not an empty dataset.'
    : consentRefused
      ? 'Learning consent is not configured. Trace retention and case-to-provider evaluation scopes are not granted.'
      : sampleRefused
        ? 'The sealed pool and consent exist, but there are not yet enough terminal traces to form a baseline. The loop refuses to fabricate a sample.'
        : error?.message ?? 'The API reports learning disabled. This is a refusal, not an empty dataset.';
  const tabHint = poolRefused ? 'Learning is unavailable: sealed pool exhausted.' : 'Learning is unavailable for this stage.';

  return (
    <div className="space-y-4">
      <Tabs
        tabs={TABS.map((tab) => ({ ...tab, disabled: true, hint: tabHint }))}
        active="overview"
        onChange={() => undefined}
        label="Learning sections (disabled)"
      />
      <p className="text-xs text-slate-500">All learning sections are unavailable while the API reports this refusal.</p>
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-amber-50 p-3 text-amber-700">
            <Lock size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{body}</p>
            <p className="mt-2 text-xs text-slate-500">
              Reason <code className="code-chip">{code}</code>
              {overview?.consentRequired ? ' · consent required' : ''}
            </p>
            {error?.hint ? <p className="mt-2 text-sm text-slate-600">{error.hint}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/settings" className="btn btn-secondary">Open settings</Link>
              <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
                Refresh status
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-400">
              {poolRefused
                ? 'The loop must not fabricate an evaluation. This build stays at P6a until the sealed pool exists.'
                : 'Enabling learning requires explicit consent scopes. The UI has no toggle that pretends to grant them.'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LearningOverviewPanel({ overview }: { overview: LearningOverview | null }) {
  if (!overview) return <EmptyState title="No learning overview" body="The API returned no overview payload." />;
  const counts = overview.counts ?? {};
  const countEntries = Object.entries(counts).filter(([, value]) => value !== null && value !== undefined);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-6">
        <SectionTitle title="Evidence status" description="Counts are supplied by the API. Missing counts stay “not reported”." />
        {countEntries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No counts are reported. Nothing is rendered as zero.</p>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {countEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{key.replace(/_/g, ' ')}</dt>
                <dd className="mt-1 font-display text-2xl">{typeof value === 'number' ? formatInteger(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-5">
          <InlineNotice tone="warn">
            The gate is a screening test: n=50 paired holdout cases, lower 95% bound ≥ +15 pp, zero critical safety regression.
            A <code className="code-chip">refused</code> or <code className="code-chip">no_promotion</code> result is a valid outcome.
          </InlineNotice>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="Consent & provenance" description="Learning never runs without explicit consent." />
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Last evaluation</dt>
            <dd>{formatDate(overview.lastEvalAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Phase</dt>
            <dd className="font-mono text-xs">{overview.phase ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Consent required</dt>
            <dd>{overview.consentRequired ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
        {overview.consent ? (
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            {Object.entries(overview.consent).map(([scope, granted]) => (
              <li key={scope} className="flex justify-between gap-3">
                <span>{scope}</span>
                <span>{granted === null || granted === undefined ? 'Not reported' : granted ? 'Granted' : 'Not granted'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">No consent scopes reported.</p>
        )}
      </Card>
    </div>
  );
}

function LearningListTab({ kind }: { kind: LearningKind }) {
  const records = useApiResource((signal) => listLearningRecords(kind, signal), [kind]);
  const icon = kind === 'traces' ? FileSearch : kind === 'failures' ? AlertTriangle : kind === 'audit' ? ScrollText : Database;

  return (
    <Card className="p-6">
      <SectionTitle
        title={kindLabel(kind)}
        description="Metadata only. Holdout text and unredacted content are never returned here."
        action={<button type="button" className="btn btn-ghost btn-small" onClick={records.reload}>Refresh</button>}
      />
      <div className="mt-4">
        {records.loading ? <LoadingPanel label={`Loading ${kind}…`} /> : records.error ? (
          <ErrorPanel error={records.error} onRetry={records.reload} title={`${kindLabel(kind)} unavailable`} />
        ) : (records.data ?? []).length === 0 ? (
          <EmptyState icon={icon} title={`No ${kind} recorded`} body="No record was returned. That is not the same as zero evaluated cases." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(records.data ?? []).map((record, index) => (
              <LearningRecordCard key={String(record.id ?? index)} record={record} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function DatasetsTab() {
  const datasets = useApiResource((signal) => listLearningRecords('datasets', signal));
  return (
    <Card className="p-6">
      <SectionTitle title="Datasets & sealed pool" description="Provenance, freeze state, and counts. No holdout cases are exposed." action={<button type="button" className="btn btn-ghost btn-small" onClick={datasets.reload}>Refresh</button>} />
      <div className="mt-4">
        {datasets.loading ? <LoadingPanel label="Loading datasets…" /> : datasets.error ? (
          <ErrorPanel error={datasets.error} onRetry={datasets.reload} title="Datasets unavailable" />
        ) : (datasets.data ?? []).length === 0 ? (
          <EmptyState icon={Database} title="No datasets available" body="A dataset must be built from terminal runs with consent. Nothing is fabricated here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(datasets.data ?? []).map((record, index) => (
              <Card key={String(record.id ?? index)} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-slate-400">{String(record.id ?? 'dataset')}</p>
                    <h3 className="mt-1 font-semibold">{String(record.name ?? record.kind ?? 'Dataset')}</h3>
                  </div>
                  <EvidenceBadge
                    tone={record.frozen === true ? 'schema' : 'not_configured'}
                    label={
                      record.frozen === true
                        ? 'Frozen'
                        : record.frozen === false
                          ? 'Not frozen'
                          : 'Freeze state not reported'
                    }
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Field label="Cases" value={numberText(record.case_count ?? record.caseCount ?? record.sample_count ?? record.sampleCount)} />
                  <Field label="Provenance" value={String(record.provenance ?? '—')} />
                  <Field label="Hash" value={shortValue(record.manifest_hash ?? record.hash)} />
                  <Field label="Created" value={formatDate(textValue(record.created_at ?? record.createdAt) ?? null)} />
                </dl>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-slate-500">Metadata</summary>
                  <JsonPreview value={record} maxChars={1800} />
                </details>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CandidatesTab() {
  const candidates = useApiResource((signal) => listLearningRecords('candidates', signal));
  return (
    <Card className="p-6">
      <SectionTitle title="Candidates" description="Human-initiated prompt, context-template, or threshold candidates. Route-policy learning is forbidden." action={<button type="button" className="btn btn-ghost btn-small" onClick={candidates.reload}>Refresh</button>} />
      <div className="mt-4">
        {candidates.loading ? <LoadingPanel label="Loading candidates…" /> : candidates.error ? (
          <ErrorPanel error={candidates.error} onRetry={candidates.reload} title="Candidates unavailable" />
        ) : (candidates.data ?? []).length === 0 ? (
          <EmptyState icon={Sparkles} title="No candidates" body="Candidates are created only after evidence is mined and a human initiates them." />
        ) : (
          <div className="space-y-3">
            {(candidates.data ?? []).map((record, index) => (
              <LearningRecordCard key={String(record.id ?? index)} record={record} showDiff />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function EvaluationsTab() {
  const evaluations = useApiResource((signal) => listLearningRecords('evaluations', signal));
  return (
    <Card className="p-6">
      <SectionTitle title="Evaluations" description="Sample size and uncertainty are shown with every metric. A missing n is not a zero." action={<button type="button" className="btn btn-ghost btn-small" onClick={evaluations.reload}>Refresh</button>} />
      <div className="mt-4">
        {evaluations.loading ? <LoadingPanel label="Loading evaluations…" /> : evaluations.error ? (
          <ErrorPanel error={evaluations.error} onRetry={evaluations.reload} title="Evaluations unavailable" />
        ) : (evaluations.data ?? []).length === 0 ? (
          <EmptyState icon={FlaskConical} title="No evaluations" body="No single-use suite has been evaluated. No percentages are invented." />
        ) : (
          <div className="space-y-4">
            {(evaluations.data ?? []).map((record, index) => (
              <EvaluationCard key={String(record.id ?? index)} record={record} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function EvaluationCard({ record }: { record: LearningRecord }) {
  const metrics = Array.isArray(record.metrics) ? record.metrics.filter(isRecord) : [];
  const n = numberValue(record.n ?? record.pairs ?? record.pair_count ?? record.pairCount ?? record.valid_pairs ?? record.validPairs ?? record.sample_size ?? record.sampleSize);
  const status = textValue(record.status ?? record.verdict);
  const measured = n !== null && n >= 50;
  const tone = measured && (status === 'pass' || status === 'promotable')
    ? 'accepted'
    : n === null || status === 'insufficient'
      ? 'insufficient_sample'
      : 'needs_review';

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{String(record.id ?? 'evaluation')}</p>
          <h3 className="mt-1 font-semibold">{textValue(record.name ?? record.candidate_id ?? record.candidateId) || 'Evaluation'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <EvidenceBadge
            tone={tone}
            label={status ? status.replace(/[-_]/g, ' ') : 'Status not reported'}
          />
          <span className="font-mono text-xs text-slate-500">{n === null ? 'n not reported' : `n=${formatInteger(n)}`}</span>
        </div>
      </div>
      {metrics.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No metric rows were reported. This record is not a measured comparison; no metric or percentage is invented.
        </p>
      ) : (
        <div className="table-wrap mt-3">
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>Candidate</th>
                <th>Δ</th>
                <th>n</th>
                <th>95% CI</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, index) => {
                const rowN = numberValue(metric.n ?? record.n ?? record.pairs ?? record.pair_count);
                const lower = numberValue(metric.ci_lower ?? metric.ciLower);
                const upper = numberValue(metric.ci_upper ?? metric.ciUpper);
                return (
                  <tr key={String(metric.metric ?? metric.name ?? index)}>
                    <td className="font-medium">{textValue(metric.metric ?? metric.name) || `Unnamed metric ${index + 1}`}</td>
                    <td className="font-mono text-xs">{numberText(metric.baseline ?? metric.baseline_value)}</td>
                    <td className="font-mono text-xs">{numberText(metric.candidate ?? metric.candidate_value)}</td>
                    <td className="font-mono text-xs">{numberText(metric.delta)}</td>
                    <td className="font-mono text-xs">{rowN === null ? '—' : formatInteger(rowN)}</td>
                    <td className="font-mono text-xs">
                      {lower === null || upper === null ? '—' : `${lower.toFixed(3)} – ${upper.toFixed(3)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">No percentage is shown without a denominator and interval.</p>
    </Card>
  );
}

function PromotionsTab() {
  const promotions = useApiResource((signal) => listLearningRecords('promotions', signal));
  const [dialog, setDialog] = useState<{
    action: 'promote' | 'rollback';
    candidateId?: string;
    evaluationId?: string;
    promotionId?: string;
  } | null>(null);

  return (
    <Card className="p-6">
      <SectionTitle title="Promotions" description="Promotion and rollback require a single-use approval token. The token is held in memory only." action={<button type="button" className="btn btn-ghost btn-small" onClick={promotions.reload}>Refresh</button>} />
      <div className="mt-4">
        {promotions.loading ? <LoadingPanel label="Loading promotions…" /> : promotions.error ? (
          <ErrorPanel error={promotions.error} onRetry={promotions.reload} title="Promotions unavailable" />
        ) : (promotions.data ?? []).length === 0 ? (
          <EmptyState icon={History} title="No promotions" body="No candidate has reached a promotion packet. A no-promotion result is a valid outcome." />
        ) : (
          <div className="space-y-3">
            {(promotions.data ?? []).map((record, index) => {
              const status = textValue(record.status) ?? 'unknown';
              const candidateId = textValue(record.candidate_id ?? record.candidateId);
              const evaluationId = textValue(record.evaluation_id ?? record.evaluationId);
              const promotionId = textValue(record.id);
              const active = status === 'active' || status === 'promoted' || status === 'live';
              const pending = status === 'pending' || status === 'pending_approval' || status === 'awaiting_approval';
              const canApprove = pending && Boolean(candidateId && evaluationId);
              return (
                <Card key={String(record.id ?? index)} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-400">{String(record.id ?? 'promotion')}</p>
                      <h3 className="mt-1 font-semibold">{textValue(record.name ?? candidateId) || 'Promotion packet'}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Candidate {shortValue(candidateId)} · Evaluation {shortValue(evaluationId)}
                      </p>
                    </div>
                    <EvidenceBadge tone={active ? 'accepted' : pending ? 'needs_review' : 'not_configured'} label={status.replace(/[-_]/g, ' ')} />
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <Field label="n" value={numberText(record.n ?? record.pairs)} />
                    <Field label="Evidence" value={shortValue(record.evidence_hash ?? record.evidenceHash)} />
                    <Field label="Created" value={formatDate(textValue(record.created_at ?? record.createdAt) ?? null)} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pending ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={!canApprove}
                        title={canApprove ? undefined : 'Promotion is blocked until the candidate and evaluation evidence are present.'}
                        onClick={() => setDialog({ action: 'promote', candidateId, evaluationId, promotionId })}
                      >
                        <ThumbsUp size={13} aria-hidden /> Approve &amp; promote
                      </button>
                    ) : null}
                    {active ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setDialog({ action: 'rollback', promotionId, candidateId, evaluationId })}
                      >
                        <Undo2 size={13} aria-hidden /> Rollback
                      </button>
                    ) : null}
                    {!pending && !active ? (
                      <span className="text-xs text-slate-500">No action is available for this status.</span>
                    ) : null}
                  </div>
                  {pending && !canApprove ? (
                    <p className="mt-2 text-xs text-amber-800">Approval unavailable: the candidate or evaluation id is not reported.</p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ApprovalDialog
        open={dialog !== null}
        action={dialog?.action ?? 'promote'}
        candidateId={dialog?.candidateId}
        evaluationId={dialog?.evaluationId}
        promotionId={dialog?.promotionId}
        onClose={() => setDialog(null)}
        onDone={() => promotions.reload()}
      />
    </Card>
  );
}

function ApprovalDialog({
  open,
  action,
  candidateId,
  evaluationId,
  promotionId,
  onClose,
  onDone,
}: {
  open: boolean;
  action: 'promote' | 'rollback';
  candidateId?: string;
  evaluationId?: string;
  promotionId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalResponse | null>(null);

  useEffect(() => {
    if (open) {
      setPhrase('');
      setBusy(false);
      setError(null);
      setSuccess(null);
      setApproval(null);
    }
  }, [open, action]);

  async function approve() {
    if (phrase !== 'APPROVE') return;
    if (action === 'promote' && (!candidateId || !evaluationId)) {
      setError('Candidate and evaluation ids are required for promotion.');
      return;
    }
    if (action === 'rollback' && !promotionId) {
      setError('A promotion id is required for rollback.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = approval ?? (await requestApproval({ action, candidateId, evaluationId, promotionId, typedPhrase: 'APPROVE' }));
      setApproval(token);
      if (action === 'promote') {
        await promoteLearning({ candidateId: candidateId!, evaluationId: evaluationId! }, token.approvalToken);
        setSuccess('Promotion applied. The approval token was consumed and is not retained.');
      } else {
        await rollbackLearning({ promotionId: promotionId!, reason: 'Human-approved rollback' }, token.approvalToken);
        setSuccess('Rollback applied. The approval token was consumed and is not retained.');
      }
      setApproval(null);
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? humanError(caught) : 'Approval or promotion failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={action === 'promote' ? 'Approve promotion' : 'Approve rollback'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button type="button" className={action === 'rollback' ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy || phrase !== 'APPROVE' || success !== null} onClick={approve}>
            {busy ? <Spinner /> : action === 'rollback' ? <Undo2 size={14} aria-hidden /> : <CheckCircle2 size={14} aria-hidden />}
            {busy ? 'Approving…' : action === 'promote' ? 'Approve & promote' : 'Approve rollback'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-600">
        <p>
          This issues a single-use approval token bound to the candidate, evaluation, baseline, and action. It expires in ten
          minutes and is consumed by the mutation.
        </p>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <Field label="Action" value={action} />
          <Field label="Candidate" value={shortValue(candidateId)} />
          <Field label="Evaluation" value={shortValue(evaluationId)} />
          <Field label="Promotion" value={shortValue(promotionId)} />
        </dl>
        <label className="block">
          <span className="label">
            Type <code className="code-chip">APPROVE</code> to issue the token
          </span>
          <input className="input mt-1" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" />
        </label>
        {approval ? <p className="text-xs text-slate-500">Approval token issued; it is held only in this dialog’s memory.</p> : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {success ? <InlineNotice tone="info">{success}</InlineNotice> : null}
        <p className="text-xs text-slate-400">
          No auto-promotion. No canary. A human token is required; rollback is a recorded authority action.
        </p>
      </div>
    </Modal>
  );
}

function LearningRecordCard({ record, showDiff = false }: { record: LearningRecord; showDiff?: boolean }) {
  const id = textValue(record.id) ?? 'record';
  const title = textValue(record.name ?? record.title ?? record.signature ?? record.kind) ?? id;
  const status = textValue(record.status ?? record.verdict ?? record.outcome);
  const diff = textValue(record.diff ?? record.patch);
  const scalars = Object.entries(record)
    .filter(([key, value]) => !['diff', 'patch'].includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
    .slice(0, 5);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-400">{id}</p>
          <h3 className="mt-1 truncate font-semibold">{title}</h3>
        </div>
        {status ? <EvidenceBadge tone={status === 'pass' || status === 'promoted' ? 'accepted' : 'needs_review'} label={status.replace(/[-_]/g, ' ')} /> : null}
      </div>
      <dl className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        {scalars.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt className="truncate">{key.replace(/_/g, ' ')}</dt>
            <dd className="truncate font-mono text-slate-700">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {showDiff && diff ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500">Prompt diff</summary>
          <pre className="json-preview mt-2">{diff.slice(0, 2000)}</pre>
        </details>
      ) : null}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500">Metadata</summary>
        <JsonPreview value={record} maxChars={1800} />
      </details>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 truncate text-xs text-slate-700">{value}</dd>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberText(value: unknown): string {
  const number = numberValue(value);
  return number === null ? '—' : formatInteger(number);
}

function shortValue(value: unknown): string {
  const text = textValue(value);
  return text ? (text.length > 18 ? `${text.slice(0, 18)}…` : text) : '—';
}

function kindLabel(kind: LearningKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
