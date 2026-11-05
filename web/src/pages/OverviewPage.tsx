import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Coins,
  KeyRound,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { getKeyStatus, getStats, listRuns } from '../api';
import { useUi } from '../context';
import { useApiResource } from '../hooks/useApi';
import { RunComposer } from '../components/RunComposer';
import { RunTable } from '../components/RunTable';
import {
  Card,
  EmptyState,
  ErrorPanel,
  formatInteger,
  formatUsd,
  InlineNotice,
  LoadingPanel,
  PageHeader,
  SectionTitle,
  ShieldNote,
  SuccessMark,
} from '../components/ui';

const PIPELINE = ['Intake', 'Plan', 'Route', 'Generate', 'Clean', 'Harden', 'Test', 'Verify', 'Finalize'];

export function OverviewPage() {
  const navigate = useNavigate();
  const { meta, health, healthError } = useUi();
  const stats = useApiResource(getStats);
  const runs = useApiResource((signal) => listRuns(5, signal));
  const key = useApiResource(getKeyStatus);

  const recent = runs.data?.runs ?? [];
  const composerDisabled = healthError
    ? 'The API is offline; a run cannot be started until the connection is restored.'
    : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Hive Control"
        title="Build with a routed factory, not a single bot."
        description="Plan a project, route each file to a specialist agent, generate and review the result, then inspect every check before you trust it."
        actions={
          <>
            <Link to="/runs" className="btn btn-secondary">
              <Boxes size={15} aria-hidden /> Run history
            </Link>
            <Link to="/agents" className="btn btn-secondary">
              <Bot size={15} aria-hidden /> Agent registry
            </Link>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
        <Card className="p-6">
          <SectionTitle
            title="Start a run"
            description="A brief is planned before it is generated. The cost cap is hard; a failed gate is never a green run."
          />
          <div className="mt-5">
            <RunComposer onStarted={(runId) => navigate(`/runs/${encodeURIComponent(runId)}`)} disabledReason={composerDisabled} />
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Provider</p>
                <h2 className="mt-1 text-lg font-semibold">DeepSeek connection</h2>
              </div>
              <KeyRound size={18} className="text-slate-400" aria-hidden />
            </div>
            {key.loading ? (
              <p className="mt-4 text-sm text-slate-500">Checking key status…</p>
            ) : key.error ? (
              <div className="mt-4">
                <InlineNotice tone="warn">Key status is unavailable ({key.error.code}).</InlineNotice>
              </div>
            ) : key.data?.configured ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Configured</dt>
                  <dd>
                    <SuccessMark>Yes</SuccessMark>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Source</dt>
                  <dd className="font-mono text-xs">{key.data.source ?? 'reported'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Fingerprint</dt>
                  <dd className="font-mono text-xs">{key.data.fingerprint ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Balance</dt>
                  <dd className="font-mono text-xs">
                    {key.data.balance?.total !== null && key.data.balance?.total !== undefined
                      ? `${key.data.balance.currency ?? 'USD'} ${String(key.data.balance.total)}`
                      : 'Not reported'}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 space-y-3">
                <InlineNotice tone="warn">
                  Not configured. The browser never accepts or displays a provider key.
                </InlineNotice>
                <p className="text-xs text-slate-500">
                  Set <code className="code-chip">DEEPSEEK_API_KEY</code> in <code className="code-chip">.env.local</code> or run{' '}
                  <code className="code-chip">npm.cmd run key:import -- --from-env</code>, then refresh.
                </p>
              </div>
            )}
            <div className="mt-4">
              <Link to="/settings" className="link-button">
                Open trust &amp; status <ArrowRight size={13} aria-hidden />
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Factory stage</p>
                <h2 className="mt-1 text-lg font-semibold">
                  {meta ? `Stage ${meta.phase}` : 'Stage unavailable'}
                </h2>
              </div>
              <Layers size={18} className="text-slate-400" aria-hidden />
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                Routing:{' '}
                {meta ? (meta.features.routing ? <SuccessMark>enabled</SuccessMark> : 'not in this stage') : 'unknown'}
              </p>
              <p>
                Learning feature:{' '}
                {meta ? (meta.features.learning ? <SuccessMark>enabled</SuccessMark> : 'disabled') : 'unknown'}
              </p>
              <p className="text-xs text-slate-500">
                Availability depends on consent and the sealed evaluation pool. The Learning page reports the actual state.
              </p>
              <p className="text-xs text-slate-500">
                API: {healthError ? 'offline' : health ? 'reachable' : 'checking'} · Version {meta?.version ?? '—'}
              </p>
            </div>
            <div className="mt-4">
              <ShieldNote>No provider-key route. No arbitrary shell. Generated code is never executed.</ShieldNote>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Bot}
          label="Registered agents"
          value={stats.data ? formatInteger(stats.data.agentCount) : stats.error ? 'Not available' : '…'}
          note="Derived from the registry, not a typed claim."
        />
        <StatCard
          icon={Boxes}
          label="Runs recorded"
          value={stats.data ? formatInteger(stats.data.runCount) : stats.error ? 'Not available' : '…'}
          note="All statuses, including failures."
        />
        <StatCard
          icon={Activity}
          label="Prompt / completion tokens"
          value={
            stats.data
              ? `${formatInteger(stats.data.totalPromptTokens)} / ${formatInteger(stats.data.totalCompletionTokens)}`
              : stats.error
                ? 'Not available'
                : '…'
          }
          note="Provider usage where reported; unknown stays unknown."
        />
        <StatCard
          icon={Coins}
          label="Estimated spend"
          value={stats.data ? formatUsd(stats.data.totalCostUsd) : stats.error ? 'Not available' : '…'}
          note="Null when no cost has been reported."
        />
      </div>
      {stats.error ? (
        <div className="mt-3">
          <InlineNotice tone="warn">Stats are unavailable ({stats.error.code}); they are not shown as zero.</InlineNotice>
        </div>
      ) : stats.data?.partial ? (
        <div className="mt-3">
          <InlineNotice tone="warn">
            Unknown spend: {stats.data.unknownUsageRows} provider usage row(s), {stats.data.unknownRunSpendRows} terminal run(s), and {stats.data.unknownChatSpendJobs} chat job(s). Measured run spend is {formatUsd(stats.data.measuredCostUsd)}; the total is intentionally not shown as zero.
          </InlineNotice>
        </div>
      ) : null}

      <Card className="mt-5 p-6">
        <SectionTitle
          title="The factory line"
          description="Every phase is explicit. A repair re-enters verification; it never silently marks a failed gate as passed."
          action={<span className="font-mono-ui text-xs text-slate-400">RELEASE-STAGED</span>}
        />
        <ol className="pipeline mt-5" aria-label="Factory phases">
          {PIPELINE.map((phase, index) => (
            <li key={phase} className="pipeline-step">
              <span className="pipeline-index font-mono-ui">{String(index + 1).padStart(2, '0')}</span>
              <span>{phase}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-5 p-6">
        <SectionTitle
          title="Recent runs"
          description="Live state comes from the API. No demo rows are inserted."
          action={
            <Link to="/runs" className="link-button">
              View all <ArrowRight size={13} aria-hidden />
            </Link>
          }
        />
        <div className="mt-4">
          {runs.loading ? (
            <LoadingPanel label="Loading runs…" />
          ) : runs.error ? (
            <ErrorPanel error={runs.error} onRetry={runs.reload} title="Runs unavailable" />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No runs recorded yet"
              body="Start a run above. Until the API records one, there is nothing to show — not zero, not a placeholder."
            />
          ) : (
            <RunTable runs={recent} />
          )}
        </div>
      </Card>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={13} aria-hidden /> HiveRouter is a local tool. Provider usage is billed to the configured DeepSeek
        account; every run carries a hard cost cap.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <Icon size={16} className="text-slate-400" aria-hidden />
      </div>
      <p className="mt-3 font-display text-4xl leading-none text-slate-900">{value}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{note}</p>
    </Card>
  );
}
