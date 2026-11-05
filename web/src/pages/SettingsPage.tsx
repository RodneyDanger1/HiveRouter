import { Link } from 'react-router-dom';
import { RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { getKeyStatus, getSettings } from '../api';
import type { RawRecord } from '../api-types';
import { useUi } from '../context';
import { useApiResource } from '../hooks/useApi';
import {
  Card,
  EmptyState,
  ErrorPanel,
  formatDate,
  InlineNotice,
  KeyValue,
  LoadingPanel,
  PageHeader,
  SectionTitle,
  ShieldNote,
  Spinner,
  SuccessMark,
} from '../components/ui';

export function SettingsPage() {
  const { meta, health, healthError } = useUi();
  const key = useApiResource(getKeyStatus);
  const settings = useApiResource(getSettings);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Trust, status, and configuration"
        title="Settings"
        description="The provider key is never accepted or displayed by this page. Status is read-only and sourced from the API."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => { key.reload(); settings.reload(); }} disabled={key.loading || settings.loading}>
            {key.loading || settings.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle title="Provider key" description="Read-only status. No key material is returned by the API or rendered here." />
          {key.loading ? <div className="mt-4"><LoadingPanel label="Checking key status…" /></div> : key.error ? (
            <div className="mt-4"><ErrorPanel error={key.error} onRetry={key.reload} title="Key status unavailable" /></div>
          ) : key.data?.configured ? (
            <dl className="mt-4 space-y-3 text-sm">
              <KeyValue label="Configured"><SuccessMark>Yes</SuccessMark></KeyValue>
              <KeyValue label="Source"><span className="font-mono text-xs">{key.data.source ?? 'reported'}</span></KeyValue>
              <KeyValue label="Fingerprint"><span className="font-mono text-xs">{key.data.fingerprint ?? '—'}</span></KeyValue>
              <KeyValue label="Checked"><span className="text-xs">{key.data.checkedAt ? formatDate(key.data.checkedAt) : 'Not reported'}</span></KeyValue>
              <KeyValue label="Balance">
                <span className="font-mono text-xs">
                  {key.data.balance?.total !== null && key.data.balance?.total !== undefined
                    ? `${key.data.balance.currency ?? 'USD'} ${String(key.data.balance.total)}`
                    : 'Not reported'}
                </span>
              </KeyValue>
            </dl>
          ) : (
            <div className="mt-4 space-y-3">
              <InlineNotice tone="warn">Not configured. The API will refuse paid calls until a key is available.</InlineNotice>
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Local key ingress</p>
                <p className="mt-1">The browser never accepts a provider key. Use one of these local paths:</p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{`# .env.local in the HiveRouter root
DEEPSEEK_API_KEY=<your key>

# or the CLI import path
hive key import --from-env`}</pre>
              </div>
            </div>
          )}
          <div className="mt-5">
            <ShieldNote>Requests for a provider-key route must return <code className="code-chip">FORBIDDEN_PROVIDER_KEY_ACCESS</code>.</ShieldNote>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle title="Factory stage" description="Features are release-gated by the API, not by a UI switch." />
          <dl className="mt-4 space-y-3 text-sm">
            <KeyValue label="Phase"><span className="font-mono">{meta?.phase ?? 'unreported'}</span></KeyValue>
            <KeyValue label="Version"><span className="font-mono">{meta?.version ?? '—'}</span></KeyValue>
            <KeyValue label="Routing feature">{meta ? (meta.features.routing ? <SuccessMark>enabled</SuccessMark> : 'Not in this stage') : 'Unknown'}</KeyValue>
            <KeyValue label="Learning feature">{meta ? (meta.features.learning ? <SuccessMark>enabled</SuccessMark> : 'Disabled') : 'Unknown'}</KeyValue>
            <KeyValue label="API">{healthError ? 'offline' : health ? 'reachable' : 'checking'}</KeyValue>
          </dl>
          <div className="mt-5 space-y-2 text-xs text-slate-500">
            <p>Feature flags are release-gated. Learning availability (consent and sealed pool) is reported on the Learning page; the feature flag alone is not a claim that an evaluation can run.</p>
            <Link to="/learning" className="link-button">Open Learning status</Link>
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-6">
        <SectionTitle
          title="Runtime settings"
          description="Only values the API exposes are shown. Unknown values remain “not reported”; they are never rendered as zero."
          action={<SlidersHorizontal size={16} className="text-slate-400" aria-hidden />}
        />
        {settings.loading ? (
          <div className="mt-4"><LoadingPanel label="Loading settings…" /></div>
        ) : settings.error ? (
          <div className="mt-4"><ErrorPanel error={settings.error} onRetry={settings.reload} title="Settings unavailable" /></div>
        ) : settings.data ? (
          <SettingsView settings={settings.data} />
        ) : (
          <EmptyState icon={SlidersHorizontal} title="No settings exposed" body="The API returned no settings payload." />
        )}
      </Card>

      <Card className="mt-5 p-6">
        <SectionTitle title="Safety posture" description="Non-negotiable boundaries from the approved plan." />
        <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {[
            'No provider key over HTTP or in the browser',
            'No arbitrary shell execution',
            'No generated-code execution',
            'No auto-promotion of learning candidates',
            'No learned routing in this release',
            'DSH credential store is read only after explicit consent',
            'Every paid mutation carries an idempotency key',
            'Static-only and unverified outputs are labeled as such',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SettingsView({ settings }: { settings: RawRecord }) {
  const knownKeys = ['model', 'thinking', 'effort', 'maxRunCostUsd', 'workspaceRoot', 'vaultRoot', 'dataRoot', 'retentionDays', 'phase', 'version'];
  const rows: Array<[string, string | number | boolean]> = [];
  for (const key of knownKeys) {
    const value = settings[key];
    if (value !== undefined && value !== null && typeof value !== 'object') {
      rows.push([key, value as string | number | boolean]);
    }
  }
  // The API nests the limits and feature flags. They are real settings and
  // must not disappear just because the payload is one level deeper.
  const flatten = (prefix: string, value: unknown, depth: number): void => {
    if (depth > 2 || value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const label = `${prefix}.${key}`;
      if (nested !== null && nested !== undefined && typeof nested !== 'object') {
        rows.push([label, nested as string | number | boolean]);
      } else {
        flatten(label, nested, depth + 1);
      }
    }
  };
  flatten('limits', settings.limits, 0);
  flatten('features', settings.features, 0);

  if (rows.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        The settings payload is present but exposes no displayable scalar values.
      </p>
    );
  }

  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {rows.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{key}</dt>
          <dd className="mt-1 break-words text-sm text-slate-800">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
