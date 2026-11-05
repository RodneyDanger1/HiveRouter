import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, Send, Square } from 'lucide-react';
import type { ChatJobProjection, ChatMessageProjection, ChatThreadSnapshot } from '@shared/chat';
import {
  ApiError,
  cancelChatJob,
  createChatThread,
  getChatThreadSnapshot,
  listAgents,
  listChatThreads,
  sendChatMessage,
} from '../api';
import type { AgentView } from '../api-types';
import { useUi } from '../context';
import { useApiResource } from '../hooks/useApi';
import { useChatStream, type ChatStreamStatus } from '../hooks/useChatStream';
import {
  Card,
  EmptyState,
  ErrorPanel,
  formatDate,
  formatUsd,
  humanError,
  LoadingPanel,
  PageHeader,
  SectionTitle,
  Spinner,
  StageGate,
} from '../components/ui';

function statusClass(status: string | null | undefined): string {
  if (status === 'succeeded' || status === 'complete') return 'text-emerald-700 bg-emerald-50';
  if (status === 'failed' || status === 'cancelled') return 'text-red-700 bg-red-50';
  if (status === 'running') return 'text-amber-700 bg-amber-50';
  return 'text-slate-600 bg-slate-100';
}

function liveLabel(status: ChatStreamStatus): string {
  if (status === 'live') return 'live';
  if (status === 'connecting') return 'connecting';
  if (status === 'reconnecting') return 'reconnecting';
  return 'closed';
}

function jobSummary(job: ChatJobProjection | null): string {
  if (!job) return 'no job';
  return `${job.status} · attempt ${job.attempts}/${job.maxAttempts}`;
}

function MessageCard({
  message,
  job,
  agentName,
  onCancel,
  cancelling,
}: {
  message: ChatMessageProjection;
  job: ChatJobProjection | null;
  agentName: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const user = message.role === 'user';
  const canCancel = job && (job.status === 'queued' || job.status === 'running');
  return (
    <article className={`chat-message ${user ? 'chat-message-user' : 'chat-message-agent'}`}>
      <div className="chat-message-head">
        <span className="font-mono-ui text-[10px] uppercase tracking-widest text-slate-500">
          {user ? 'You' : agentName}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${statusClass(message.status)}`}>
          {message.status}
          {message.jobStatus ? ` · ${message.jobStatus}` : ''}
        </span>
        <span className="ml-auto font-mono-ui text-[10px] text-slate-400">#{message.seq}</span>
      </div>
      {message.content ? (
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-800">{message.content}</pre>
      ) : message.status === 'pending' ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Waiting for {agentName} to answer…
        </div>
      ) : null}
      {message.errorCode ? (
        <p className="mt-2 rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-800">
          <code className="code-chip">{message.errorCode}</code> {message.errorMessage ?? 'The message failed without a detail.'}
        </p>
      ) : null}
      {!user && job ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>{jobSummary(job)}</span>
          {job.costUsd != null ? <span>{formatUsd(job.costUsd)}</span> : <span>cost not reported</span>}
          {canCancel ? (
            <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={cancelling}>
              {cancelling ? <Spinner /> : <Square size={11} aria-hidden />} Cancel
            </button>
          ) : null}
          <details className="ml-auto">
            <summary className="cursor-pointer select-none">Job fields</summary>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <dt>job id</dt><dd className="font-mono-ui">{job.id}</dd>
              <dt>message id</dt><dd className="font-mono-ui">{job.messageId}</dd>
              <dt>agent</dt><dd>{job.agentId}</dd>
              <dt>kind</dt><dd>{job.kind}</dd>
              <dt>queued</dt><dd>{formatDate(job.createdAt)}</dd>
              <dt>started</dt><dd>{formatDate(job.startedAt)}</dd>
              <dt>finished</dt><dd>{formatDate(job.finishedAt)}</dd>
              <dt>available</dt><dd>{formatDate(job.availableAt)}</dd>
              <dt>lease expires</dt><dd>{formatDate(job.leaseExpiresAt)}</dd>
              <dt>tokens</dt>
              <dd>{job.promptTokens == null ? 'not reported' : `${job.promptTokens} in / ${job.completionTokens ?? 0} out`}</dd>
              <dt>last error</dt>
              <dd>{job.lastErrorCode ?? 'none'}{job.lastErrorMessage ? ` — ${job.lastErrorMessage}` : ''}</dd>
            </dl>
          </details>
        </div>
      ) : null}
    </article>
  );
}

export function ChatPage() {
  const { meta } = useUi();
  const threads = useApiResource((signal) => listChatThreads(50, signal));
  const agents = useApiResource(listAgents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newAgentId, setNewAgentId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [sendAgentId, setSendAgentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshot = useApiResource<ChatThreadSnapshot | null>(
    (signal) => (selectedId ? getChatThreadSnapshot(selectedId, signal) : Promise.resolve(null)),
    [selectedId],
  );

  const threadList = threads.data?.threads ?? [];
  const agentList: AgentView[] = agents.data ?? [];
  const agentById = useMemo<Map<string, AgentView>>(() => new Map(agentList.map((agent) => [agent.id, agent])), [agentList]);
  const selectedThread = snapshot.data?.thread ?? threadList.find((thread) => thread.id === selectedId) ?? null;
  const jobsById = useMemo(
    () => new Map((snapshot.data?.jobs ?? []).map((job) => [job.id, job])),
    [snapshot.data?.jobs],
  );

  const scheduleRefresh = (): void => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      snapshot.reload();
      threads.reload();
    }, 120);
  };
  const streamStatus = useChatStream(selectedId, scheduleRefresh);

  useEffect(() => {
    if (!newAgentId && agentList.length > 0) setNewAgentId(agentList[0].id);
  }, [agentList, newAgentId]);

  useEffect(() => {
    if (!selectedId && threadList.length > 0) setSelectedId(threadList[0].id);
  }, [selectedId, threadList]);

  useEffect(() => {
    if (selectedThread) setSendAgentId(selectedThread.agentId);
  }, [selectedThread?.id, selectedThread?.agentId]);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const create = async (): Promise<void> => {
    if (!newAgentId) return;
    setCreating(true);
    setActionError(null);
    try {
      const created = await createChatThread({ agentId: newAgentId, title: newTitle.trim() || undefined });
      setNewTitle('');
      setSelectedId(created.thread.id);
      await threads.reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Thread creation failed.' }));
    } finally {
      setCreating(false);
    }
  };

  const send = async (): Promise<void> => {
    if (!selectedId || !draft.trim() || !sendAgentId) return;
    setSending(true);
    setActionError(null);
    try {
      await sendChatMessage(
        selectedId,
        { content: draft, agentIds: [sendAgentId] },
        crypto.randomUUID(),
      );
      setDraft('');
      snapshot.reload();
      threads.reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Message failed to queue.' }));
    } finally {
      setSending(false);
    }
  };

  const cancel = async (jobId: string): Promise<void> => {
    setCancellingJobId(jobId);
    setActionError(null);
    try {
      await cancelChatJob(jobId);
      snapshot.reload();
      threads.reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error : new ApiError({ code: 'E_NETWORK', status: 0, message: 'Cancellation failed.' }));
    } finally {
      setCancellingJobId(null);
    }
  };

  if (meta?.features.chat === false) {
    return (
      <div className="page">
        <PageHeader eyebrow="Agent conversations" title="Chat" description="The live-chat projection is release-gated." />
        <StageGate feature="Live chat" stage="B2" description="Live chat is a B2 surface. The API registers no chat routes in this stage, so this page makes no request and shows no fabricated conversation." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Agent conversations"
        title="Chat"
        description="One live conversation with any registered agent. Every answer is a durable job with an explicit lease, attempt count, error state, and projected cost. This page does not execute code or hide a queued/failed answer."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => { threads.reload(); snapshot.reload(); }} disabled={threads.loading}>
            {threads.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
          </button>
        }
      />

      {actionError ? (
        <div className="mb-4">
          <ErrorPanel error={actionError} onRetry={() => setActionError(null)} title="Chat action failed" />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-4">
          <SectionTitle title="Conversations" description="Durable threads; each selected agent answer runs as a job." />
          <div className="mt-4 space-y-2">
            <label className="toolbar-field block">
              <span className="label">Agent</span>
              <select className="input" value={newAgentId} onChange={(event) => setNewAgentId(event.target.value)}>
                {agentList.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </label>
            <label className="toolbar-field block">
              <span className="label">Title (optional)</span>
              <input className="input" value={newTitle} maxLength={120} onChange={(event) => setNewTitle(event.target.value)} placeholder="New conversation" />
            </label>
            <button type="button" className="btn btn-primary w-full" onClick={() => void create()} disabled={creating || !newAgentId}>
              {creating ? <Spinner /> : <Plus size={14} aria-hidden />} New conversation
            </button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            {threads.loading ? (
              <LoadingPanel label="Loading conversations…" />
            ) : threads.error ? (
              <ErrorPanel error={threads.error} onRetry={threads.reload} title="Conversations unavailable" />
            ) : threadList.length === 0 ? (
              <p className="text-sm text-slate-500">No conversations yet. Create one above.</p>
            ) : (
              <ul className="space-y-1">
                {threadList.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className={`chat-thread-row ${thread.id === selectedId ? 'chat-thread-row-active' : ''}`}
                      onClick={() => { setSelectedId(thread.id); setActionError(null); }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <MessageSquare size={14} aria-hidden />
                        <span className="truncate text-left font-medium">{thread.title}</span>
                      </span>
                      <span className="mt-1 block truncate text-left text-xs text-slate-500">
                        {thread.lastMessagePreview ?? 'No messages yet'}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{agentById.get(thread.agentId)?.name ?? thread.agentId}</span>
                        <span>·</span>
                        <span>{thread.messageCount} messages</span>
                        {thread.lastJobStatus ? <span className={`rounded px-1.5 py-0.5 ${statusClass(thread.lastJobStatus)}`}>{thread.lastJobStatus}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="min-h-[560px] p-4">
          {!selectedThread ? (
            <EmptyState icon={MessageSquare} title="Select a conversation" body="Create a conversation or select one from the left. No conversation is fabricated." />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-display text-2xl text-slate-900">{selectedThread.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {agentById.get(selectedThread.agentId)?.name ?? selectedThread.agentId} · {selectedThread.model} · {selectedThread.thinking}
                    {selectedThread.effort ? ` · ${selectedThread.effort}` : ''} · {formatDate(selectedThread.createdAt)}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${streamStatus === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> {liveLabel(streamStatus)}
                </span>
              </div>

              {snapshot.loading ? (
                <LoadingPanel label="Loading conversation…" />
              ) : snapshot.error ? (
                <ErrorPanel error={snapshot.error} onRetry={snapshot.reload} title="Conversation unavailable" />
              ) : snapshot.data ? (
                <>
                  <div className="chat-transcript mt-4">
                    {snapshot.data.messages.length === 0 ? (
                      <p className="text-sm text-slate-500">No messages yet. Ask the first question below.</p>
                    ) : (
                      snapshot.data.messages.map((message) => (
                        <MessageCard
                          key={message.id}
                          message={message}
                          job={message.jobId ? jobsById.get(message.jobId) ?? null : null}
                          agentName={agentById.get(message.agentId ?? selectedThread.agentId)?.name ?? message.agentId ?? selectedThread.agentId}
                          onCancel={() => message.jobId ? void cancel(message.jobId) : undefined}
                          cancelling={message.jobId === cancellingJobId}
                        />
                      ))
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="toolbar-field min-w-[180px] flex-1">
                        <span className="label">Answer as</span>
                        <select className="input" value={sendAgentId} onChange={(event) => setSendAgentId(event.target.value)}>
                          {agentList.map((agent) => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </label>
                      <span className="text-xs text-slate-500">
                        {selectedThread.queuedJobCount + selectedThread.runningJobCount > 0
                          ? `${selectedThread.queuedJobCount + selectedThread.runningJobCount} job(s) active`
                          : 'No active jobs'}
                      </span>
                    </div>
                    <label className="mt-3 block">
                      <span className="label">Message</span>
                      <textarea
                        className="input min-h-[96px] w-full resize-y"
                        value={draft}
                        maxLength={8000}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                          }
                        }}
                        placeholder="Ask the selected agent… (Enter sends, Shift+Enter adds a line)"
                      />
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">{draft.length}/8000</span>
                      <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={sending || !draft.trim() || !sendAgentId}>
                        {sending ? <Spinner /> : <Send size={14} aria-hidden />} Send &amp; queue job
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState icon={MessageSquare} title="Conversation unavailable" body="The API returned no snapshot for this thread." />
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
