import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Copy,
  Info,
  Loader2,
  Lock,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { CheckResult, RunStatus } from '@shared/types';
import { ApiError } from '../api';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function shortId(value: string | null | undefined, length = 10): string {
  if (!value) return '—';
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toFixed(4)}`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function humanError(error: ApiError | null | undefined): string {
  if (!error) return '';
  return error.hint ? `${error.message} ${error.hint}` : error.message;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title font-display">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('card', className)}>{children}</section>;
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('animate-spin', className)} size={16} />;
}

export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="card flex items-center gap-3 p-6 text-sm text-slate-500" role="status" aria-live="polite">
      <Spinner />
      <span>{label}</span>
      <span className="sr-only">Please wait</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Info,
  title,
  body,
  action,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={20} aria-hidden />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        {body ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{body}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorPanel({
  error,
  title = 'Request failed',
  onRetry,
}: {
  error: ApiError | null;
  title?: string;
  onRetry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="card border-red-200 bg-red-50/60 p-5" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 shrink-0 text-red-700" size={18} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-red-950">{title}</h3>
            <code className="code-chip">{error.code}</code>
            {error.status > 0 ? <span className="text-xs text-red-800">HTTP {error.status}</span> : null}
          </div>
          <p className="mt-1 text-sm text-red-900">{error.message}</p>
          {error.hint ? <p className="mt-1 text-sm text-red-800">{error.hint}</p> : null}
          {onRetry ? (
            <button type="button" className="btn btn-secondary mt-3" onClick={onRetry}>
              Retry <ArrowRight size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  title?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-950'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-slate-200 bg-white text-slate-700';
  return (
    <div className={cn('rounded-xl border p-4 text-sm', toneClass)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  );
}

const RUN_STATUS_STYLES: Record<string, string> = {
  queued: 'badge-muted',
  running: 'badge-info',
  paused: 'badge-warn',
  needs_review: 'badge-warn',
  completed: 'badge-success',
  completed_with_warnings: 'badge-warn',
  failed: 'badge-error',
  cancelled: 'badge-muted',
  budget_exceeded: 'badge-error',
  interrupted: 'badge-muted',
};

export function StatusBadge({ status }: { status: RunStatus | string }) {
  return (
    <span className={cn('badge', RUN_STATUS_STYLES[status] ?? 'badge-muted')}>
      <span className="status-dot" aria-hidden />
      {titleCase(status)}
    </span>
  );
}

const CHECK_STYLES: Record<CheckResult['status'], string> = {
  pass: 'badge-success',
  fail: 'badge-error',
  warn: 'badge-warn',
  unverified: 'badge-muted',
  skipped: 'badge-muted',
};

export function CheckBadge({ status }: { status: CheckResult['status'] }) {
  return <span className={cn('badge', CHECK_STYLES[status] ?? 'badge-muted')}>{titleCase(status)}</span>;
}

export type EvidenceTone =
  | 'accepted'
  | 'needs_review'
  | 'insufficient_sample'
  | 'none_measured'
  | 'not_configured'
  | 'refused'
  | 'forbidden'
  | 'live'
  | 'mock'
  | 'schema'
  | 'registered';

const EVIDENCE_STYLES: Record<EvidenceTone, { className: string; label: string }> = {
  accepted: { className: 'badge-success', label: 'Accepted' },
  needs_review: { className: 'badge-warn', label: 'Needs review' },
  insufficient_sample: { className: 'badge-muted', label: 'Insufficient sample' },
  none_measured: { className: 'badge-muted', label: 'None measured' },
  not_configured: { className: 'badge-muted', label: 'Not configured' },
  refused: { className: 'badge-error', label: 'Refused' },
  forbidden: { className: 'badge-error', label: 'Forbidden' },
  live: { className: 'badge-success', label: 'Live evidence' },
  mock: { className: 'badge-info', label: 'Mock evidence' },
  schema: { className: 'badge-info', label: 'Schema valid' },
  registered: { className: 'badge-muted', label: 'Registered' },
};

export function EvidenceBadge({
  tone,
  label,
  detail,
}: {
  tone: EvidenceTone;
  label?: string;
  detail?: string;
}) {
  const style = EVIDENCE_STYLES[tone];
  return (
    <span className={cn('badge', style.className)} title={detail}>
      {label ?? style.label}
    </span>
  );
}

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(index: number) {
    const enabled = tabs
      .map((tab, position) => ({ tab, position }))
      .filter(({ tab }) => !tab.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex(({ tab }) => tab.id === tabs[index]?.id);
    const next = enabled[(current + 1) % enabled.length];
    if (next) {
      onChange(next.tab.id);
      refs.current[next.position]?.focus();
    }
  }

  return (
    <div className="tab-list" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-disabled={tab.disabled || undefined}
          tabIndex={active === tab.id ? 0 : -1}
          disabled={tab.disabled}
          title={tab.hint}
          className={cn('tab', active === tab.id && 'tab-active', tab.disabled && 'tab-disabled')}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              moveFocus(index);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              const previous = tabs
                .map((item, position) => ({ item, position }))
                .filter(({ item }) => !item.disabled)
                .reverse()
                .find(({ position }) => position < index);
              const target = previous ?? tabs.map((item, position) => ({ item, position })).filter(({ item }) => !item.disabled).pop();
              if (target) {
                onChange(target.item.id);
                refs.current[target.position]?.focus();
              }
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = '560px',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** While a mutation is in flight the modal owns the outcome and cannot be dismissed. */
  busy?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    window.setTimeout(() => focusable?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (busyRef.current) return;
        onClose();
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: width }}
      >
        <div className="modal-head">
          <h2 id={titleId} className="font-display text-2xl">
            {title}
          </h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={busy}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
  error,
  typedPhrase,
  tone = 'primary',
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  typedPhrase?: string;
  tone?: 'primary' | 'danger';
}) {
  const [phrase, setPhrase] = useState('');
  useEffect(() => {
    if (open) setPhrase('');
  }, [open]);
  const blocked = Boolean(typedPhrase) && phrase !== typedPhrase;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={cn('btn', tone === 'danger' ? 'btn-danger' : 'btn-primary')}
            disabled={busy || blocked}
            onClick={onConfirm}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        <div>{body}</div>
        {typedPhrase ? (
          <label className="block">
            <span className="label">
              Type <code className="code-chip">{typedPhrase}</code> to confirm
            </span>
            <input
              className="input mt-1"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              autoComplete="off"
            />
          </label>
        ) : null}
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState('copied');
        } catch {
          setState('failed');
        }
      }}
      aria-live="polite"
    >
      {state === 'copied' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function JsonPreview({ value, maxChars = 4000 }: { value: unknown; maxChars?: number }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (!text) return <span className="text-slate-400">—</span>;
  const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}\n… truncated (${text.length} chars)` : text;
  return <pre className="json-preview">{clipped}</pre>;
}

export function CostMeter({
  costUsd,
  capUsd,
}: {
  costUsd: number | null | undefined;
  capUsd: number | null | undefined;
}) {
  const known = typeof costUsd === 'number';
  const percent =
    known && typeof capUsd === 'number' && capUsd > 0 ? Math.min(100, (costUsd / capUsd) * 100) : null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Estimated spend</span>
        <span className="font-mono text-slate-800">
          {known ? formatUsd(costUsd) : 'Not measured'}
          {typeof capUsd === 'number' ? ` / ${formatUsd(capUsd)} cap` : ''}
        </span>
      </div>
      <div className="meter mt-2" aria-hidden>
        <div className="meter-fill" style={{ width: `${percent ?? 0}%` }} />
      </div>
      {!known ? <p className="mt-1 text-xs text-slate-400">The provider has not reported a cost yet.</p> : null}
    </div>
  );
}

export function StageGate({
  feature,
  stage,
  description,
}: {
  feature: string;
  stage: string;
  description?: string;
}) {
  return (
    <Notice tone="warn" title={`${feature} requires ${stage}`}>
      {description ?? 'This surface is registered for a later release phase. Nothing is hidden; no request was made.'}
    </Notice>
  );
}

export function InlineNotice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'warn' ? AlertTriangle : Info;
  return (
    <p className={cn('inline-notice', `inline-notice-${tone}`)}>
      <Icon size={14} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={15} aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function LockHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Lock size={12} aria-hidden /> {children}
    </span>
  );
}

export function ShieldNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-start gap-2 text-xs text-slate-500">
      <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function SuccessMark({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
      <CheckCircle2 size={13} aria-hidden /> {children ?? 'Ready'}
    </span>
  );
}
