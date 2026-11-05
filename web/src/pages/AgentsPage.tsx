import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Code2,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import type { AgentDefinition } from '@shared/types';
import {
  agentBadgeLabel,
  agentIsEnabled,
  ApiError,
  getAgent,
  getKeyStatus,
  listAgents,
  newIdempotencyKey,
  resetAgentPrompt,
  runAgent,
  updateAgentPrompt,
} from '../api';
import type { AgentView, KeyStatusResponse } from '../api-types';
import { useApiResource } from '../hooks/useApi';
import { CodeViewer } from '../components/CodeViewer';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorPanel,
  EvidenceBadge,
  formatInteger,
  humanError,
  InlineNotice,
  LoadingPanel,
  Modal,
  PageHeader,
  SearchField,
  SectionTitle,
  Spinner,
  titleCase,
} from '../components/ui';

export function AgentsPage() {
  const navigate = useNavigate();
  const agents = useApiResource(listAgents);
  const key = useApiResource(getKeyStatus);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [output, setOutput] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const list = agents.data ?? [];
  const groups = useMemo(() => Array.from(new Set(list.map((agent) => agent.group))).sort(), [list]);
  const outputs = useMemo(() => Array.from(new Set(list.map((agent) => agent.outputKind))).sort(), [list]);
  const filtered = list.filter((agent) => {
    const haystack = `${agent.name} ${agent.id} ${agent.role} ${agent.group}`.toLowerCase();
    return (
      (group === 'all' || agent.group === group) &&
      (output === 'all' || agent.outputKind === output) &&
      (query.trim().length === 0 || haystack.includes(query.trim().toLowerCase()))
    );
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Capability census"
        title="Agents"
        description="Every row is a registry entry with an output contract, declared language surface, and verification support. Evidence badges are derived by the API; this page cannot grant one."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => { agents.reload(); key.reload(); }} disabled={agents.loading}>
            {agents.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
          </button>
        }
      />

      {agents.loading ? (
        <LoadingPanel label="Loading the agent registry…" />
      ) : agents.error ? (
        <ErrorPanel error={agents.error} onRetry={agents.reload} title="Agent registry unavailable" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents registered"
          body="The API returned an empty registry. The page does not fill in a demo list or claim 37 agents."
        />
      ) : (
        <>
          {list.length !== 37 ? (
            <div className="mb-4">
              <InlineNotice tone="warn">
                The registry reports {list.length} agents; the plan requires 37. The actual count is shown, not the target.
              </InlineNotice>
            </div>
          ) : null}

          <div className="toolbar">
            <SearchField value={query} onChange={setQuery} placeholder="Search agents, roles, IDs…" />
            <label className="toolbar-field">
              <span className="label">Group</span>
              <select className="input" value={group} onChange={(event) => setGroup(event.target.value)}>
                <option value="all">All groups</option>
                {groups.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="toolbar-field">
              <span className="label">Output</span>
              <select className="input" value={output} onChange={(event) => setOutput(event.target.value)}>
                <option value="all">All outputs</option>
                {outputs.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto font-mono text-xs text-slate-500">
              {filtered.length} of {list.length} shown
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Bot} title="No agents match those filters" body="Clear the search or filter to see the registry." />
          ) : (
            <div className="agent-grid">
              {filtered.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onOpen={() => setSelected(agent.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <AgentDrawer
        agentId={selected}
        onClose={() => setSelected(null)}
        onRun={(runId) => navigate(`/runs/${encodeURIComponent(runId)}`)}
        keyStatus={key.data}
        keyError={key.error}
      />
    </div>
  );
}

function AgentCard({ agent, onOpen }: { agent: AgentView; onOpen: () => void }) {
  const badges = agent.badges ?? [];
  const disabled = agent.enabled === false;
  return (
    <button type="button" className="agent-card" onClick={onOpen} aria-label={`Open ${agent.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono-ui text-[10px] uppercase tracking-widest text-slate-400">{agent.group}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-slate-900">{agent.name}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">{agent.id}</p>
        </div>
        <span className="code-chip">{agent.outputKind}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-slate-600">
        {agent.role || agent.objective || 'Open for role, prompt, and evidence.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="badge badge-muted">{titleCase(agent.verificationSupport)}</span>
        {badges.length === 0 ? <span className="badge badge-muted">No badge evidence</span> : null}
        {badges.slice(0, 3).map((badge) => (
          <span key={badge} className="badge badge-info">
            {agentBadgeLabel(badge)}
          </span>
        ))}
        {disabled ? <span className="badge badge-warn">Disabled</span> : null}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono">{agent.canWrite ? 'write' : agent.canReview ? 'review' : agent.canTest ? 'test-files' : 'plan'}</span>
        <span className="inline-flex items-center gap-1">
          Open <Sparkles size={12} aria-hidden />
        </span>
      </div>
    </button>
  );
}

function AgentDrawer({
  agentId,
  onClose,
  onRun,
  keyStatus,
  keyError,
}: {
  agentId: string | null;
  onClose: () => void;
  onRun: (runId: string) => void;
  keyStatus: KeyStatusResponse | null;
  keyError: ApiError | null;
}) {
  const agent = useApiResource<AgentView | null>(
    (signal) => (agentId ? getAgent(agentId, signal) : Promise.resolve(null)),
    [agentId],
  );
  const [prompt, setPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<ApiError | null>(null);
  const [runInput, setRunInput] = useState('');
  const [runMode, setRunMode] = useState<'mock' | 'live'>('live');
  const [runTarget, setRunTarget] = useState('');
  const [runBudget, setRunBudget] = useState('0.05');
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<ApiError | null>(null);
  const runRequestKey = useMemo(
    () => newIdempotencyKey(),
    [agentId, runInput, runMode, runTarget, runBudget],
  );

  useEffect(() => {
    if (agent.data) setPrompt(agent.data.prompt);
  }, [agent.data]);

  useEffect(() => {
    setEditing(false);
    setSaveError(null);
    setRunError(null);
    setRunInput('');
    setRunTarget('');
  }, [agentId]);

  const data = agent.data;
  const liveDisabled = !keyStatus?.configured || Boolean(keyError);
  const needsTarget = data?.outputKind === 'files';
  const canRun = Boolean(data) && agentIsEnabled(data as AgentDefinition) && runInput.trim().length > 0;

  async function savePrompt() {
    if (!data) return;
    setSaveBusy(true);
    setSaveError(null);
    try {
      await updateAgentPrompt(data.id, prompt);
      setEditing(false);
      agent.reload();
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Prompt save failed.' }),
      );
    } finally {
      setSaveBusy(false);
    }
  }

  async function confirmReset() {
    if (!data) return;
    setResetBusy(true);
    setResetError(null);
    try {
      await resetAgentPrompt(data.id);
      setResetOpen(false);
      agent.reload();
    } catch (caught) {
      setResetError(
        caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Prompt reset failed.' }),
      );
    } finally {
      setResetBusy(false);
    }
  }

  async function submitRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const cap = Number(runBudget);
    if (!Number.isFinite(cap) || cap <= 0) {
      setRunError(new ApiError({ code: 'E_INVALID_INPUT', status: 0, message: 'Max cost must be positive.' }));
      return;
    }
    if (runMode === 'live' && liveDisabled) {
      setRunError(
        new ApiError({
          code: keyError?.code ?? 'E_KEY_NOT_CONFIGURED',
          status: 0,
          message: 'Live ad-hoc runs require a configured provider key.',
        }),
      );
      return;
    }
    if (data.outputKind === 'files' && runTarget.trim().length === 0) {
      setRunError(new ApiError({ code: 'E_AGENT_TARGET_REQUIRED', status: 0, message: 'A target path is required for a file-writing agent.' }));
      return;
    }
    setRunBusy(true);
    setRunError(null);
    try {
      const runId = await runAgent(data.id, {
        input: runInput,
        mode: runMode,
        maxCostUsd: cap,
        targetPath: runTarget.trim() || undefined,
      }, undefined, runRequestKey);
      onRun(runId);
    } catch (caught) {
      setRunError(
        caught instanceof ApiError ? caught : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Agent run failed.' }),
      );
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <Modal
      open={agentId !== null}
      onClose={onClose}
      title={data?.name ?? 'Agent'}
      width="980px"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {data ? (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing((value) => !value)}>
              <Code2 size={14} aria-hidden /> {editing ? 'Stop editing' : 'Edit prompt'}
            </button>
          ) : null}
        </>
      }
    >
      {agent.loading ? <LoadingPanel label="Loading agent…" /> : agent.error ? (
        <ErrorPanel error={agent.error} onRetry={agent.reload} title="Agent unavailable" />
      ) : data ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="code-chip">{data.id}</span>
            <span className="badge badge-muted">{titleCase(data.outputKind)}</span>
            <span className="badge badge-muted">{titleCase(data.verificationSupport)}</span>
            {data.canWrite ? <span className="badge badge-info">write</span> : null}
            {data.canReview ? <span className="badge badge-info">review</span> : null}
            {data.canTest ? <span className="badge badge-info">writes test files (not executed)</span> : null}
            {data.enabled === false ? <span className="badge badge-warn">disabled</span> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionTitle title="Contract" description="What the runtime will actually accept from this agent." />
              <dl className="mt-3 space-y-2 text-sm">
                <KV label="Role" value={data.role || '—'} />
                <KV label="Objective" value={data.objective || '—'} />
                <KV label="Languages" value={data.languages.length ? data.languages.join(', ') : '—'} />
                <KV label="Path globs" value={data.pathGlobs.length ? data.pathGlobs.join(', ') : '—'} />
                <KV label="Output tokens" value={formatInteger(data.maxOutputTokens)} />
                <KV label="Static prior" value={typeof data.staticPrior === 'number' ? data.staticPrior.toFixed(3) : '—'} />
                <KV label="Prior version" value={data.priorVersion || '—'} />
                <KV label="Prompt version" value={data.promptVersion || '—'} />
                <KV label="Schema" value={data.schemaId || '—'} />
              </dl>
              {data.rules.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {data.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}
              {data.verificationSupport === 'unverified' || data.verificationSupport === 'static-only' ? (
                <div className="mt-3">
                  <InlineNotice tone="warn">
                    This agent’s output is <strong>{data.verificationSupport}</strong>. A generated file from it is never labeled as
                    runtime-verified.
                  </InlineNotice>
                </div>
              ) : null}
            </div>

            <div>
              <SectionTitle title="Evidence" description="Badges come from recorded evidence, not from this page." />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(data.badges ?? []).length === 0 ? (
                  <span className="badge badge-muted">No badge evidence</span>
                ) : (
                  (data.badges ?? []).map((badge) => (
                    <EvidenceBadge
                      key={badge}
                      tone={badge === 'representative-live' ? 'live' : badge === 'mock-run' ? 'mock' : badge === 'schema-valid' ? 'schema' : 'registered'}
                      label={agentBadgeLabel(badge)}
                    />
                  ))
                )}
              </div>
              {data.evidence?.length ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {data.evidence.slice(0, 5).map((entry, index) => (
                    <li key={`${entry.badge}-${index}`}>
                      {agentBadgeLabel(entry.badge)} · {entry.provenance ?? 'unknown'} · {entry.runId ? entry.runId.slice(0, 12) : 'no run'}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4">
                <p className="label">
                  Prompt{' '}
                  {data.promptSource === 'override' ? (
                    <span className="badge badge-warn">override</span>
                  ) : (
                    <span className="badge badge-muted">registry</span>
                  )}
                </p>
                {editing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      className="input min-h-[240px] font-mono text-xs"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      maxLength={20000}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{prompt.length}/20000</span>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setResetOpen(true)}>
                          <Undo2 size={13} aria-hidden /> Reset
                        </button>
                        <button type="button" className="btn btn-primary btn-small" disabled={saveBusy || prompt.trim().length === 0} onClick={savePrompt}>
                          {saveBusy ? <Spinner /> : <Save size={13} aria-hidden />} Save
                        </button>
                      </div>
                    </div>
                    {saveError ? <InlineNotice tone="error">{humanError(saveError)}</InlineNotice> : null}
                  </div>
                ) : (
                  <p className="mt-2 line-clamp-4 text-xs text-slate-500">
                    {data.prompt ? data.prompt.slice(0, 360) : 'No prompt returned.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <SectionTitle title="Ad-hoc run" description="Runs through the same registry contract, budget, and output validation as a factory step." />
            <form className="mt-3 space-y-3" onSubmit={submitRun}>
              <label className="block" htmlFor="agent-run-input">
                <span className="label">Input</span>
                <textarea
                  id="agent-run-input"
                  className="input mt-1 min-h-[92px]"
                  value={runInput}
                  onChange={(event) => setRunInput(event.target.value)}
                  maxLength={8000}
                  placeholder="Give the agent a precise task. Treat its output as untrusted until checked."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block" htmlFor="agent-run-mode">
                  <span className="label">Mode</span>
                  <select id="agent-run-mode" aria-label="Mode" className="input mt-1" value={runMode} onChange={(event) => setRunMode(event.target.value as 'mock' | 'live')}>
                    <option value="live">Live (provider spend)</option>
                    <option value="mock" disabled>Mock (unavailable from this server build)</option>
                  </select>
                </label>
                <label className="block" htmlFor="agent-run-budget">
                  <span className="label">Max cost (USD)</span>
                  <input id="agent-run-budget" className="input mt-1" value={runBudget} onChange={(event) => setRunBudget(event.target.value)} inputMode="decimal" />
                </label>
                <label className="block" htmlFor="agent-run-target">
                  <span className="label">Target path {needsTarget ? '(required)' : '(optional)'}</span>
                  <input
                    id="agent-run-target"
                    className="input mt-1"
                    value={runTarget}
                    onChange={(event) => setRunTarget(event.target.value)}
                    disabled={!needsTarget}
                    placeholder={needsTarget ? 'src/example.py' : 'tests/example.test.ts (not required)'}
                  />
                </label>
              </div>
              {runMode === 'live' ? (
                <InlineNotice tone={liveDisabled ? 'warn' : 'error'}>
                  {liveDisabled
                    ? 'Live mode is unavailable because no provider key is configured or key status cannot be read. Mock mode is test-only and refused in the product; fix key ingress in Settings.'
                    : 'Live mode spends the configured DeepSeek balance and requires a budget. This page never receives the key.'}
                </InlineNotice>
              ) : null}
              {runError ? <InlineNotice tone="error">{humanError(runError)}</InlineNotice> : null}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {needsTarget && !runTarget.trim() ? 'A file-writing run needs an explicit target path.' : 'Structured JSON outputs are schema-validated before they are stored; text output is stored as text.'}
                </span>
                <button type="submit" className="btn btn-primary" disabled={!canRun || runBusy || (runMode === 'live' && liveDisabled)}>
                  {runBusy ? <Spinner /> : <Play size={14} aria-hidden />} Run agent
                </button>
              </div>
            </form>
          </div>

          <div>
            <SectionTitle title="Full prompt" description="The resolved system prompt the runtime would use, including the output contract. Edits are stored as overrides and pinned by a snapshot." />
            <div className="mt-3">
              <CodeViewer code={data.systemPrompt ?? data.prompt} language="text" path={`${data.id}.prompt.txt`} />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={resetOpen}
        title="Reset prompt override"
        body="This removes the stored override and restores the registry prompt. Future runs use the restored prompt; existing snapshots keep their pinned text."
        confirmLabel="Reset prompt"
        tone="danger"
        busy={resetBusy}
        error={resetError ? humanError(resetError) : null}
        onConfirm={confirmReset}
        onClose={() => setResetOpen(false)}
      />
      {resetError && !resetOpen ? <InlineNotice tone="error">{humanError(resetError)}</InlineNotice> : null}
    </Modal>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{value}</dd>
    </div>
  );
}
