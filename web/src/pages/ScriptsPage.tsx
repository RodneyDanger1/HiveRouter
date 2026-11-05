import { useState } from 'react';
import { RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import { ApiError, dryRunScript, getScripts } from '../api';
import type { ScriptDryRunResult, ScriptInfo } from '../api-types';
import { useApiResource } from '../hooks/useApi';
import {
  Card,
  EmptyState,
  ErrorPanel,
  InlineNotice,
  LoadingPanel,
  PageHeader,
  SectionTitle,
  Spinner,
} from '../components/ui';

function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({
    code: 'E_SCRIPT_UI',
    status: 0,
    message: error instanceof Error ? error.message : 'The script request failed.',
  });
}

function safetyClass(script: ScriptInfo): string {
  if (script.safety === 'paid') return 'badge badge-warn';
  if (script.safety === 'write') return 'badge badge-warn';
  return 'badge badge-success';
}

export function ScriptsPage() {
  const scripts = useApiResource(getScripts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ScriptDryRunResult>>({});
  const [errors, setErrors] = useState<Record<string, ApiError>>({});

  async function runDry(id: string) {
    setBusyId(id);
    setErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    try {
      const result = await dryRunScript(id);
      setResults((current) => ({ ...current, [id]: result }));
    } catch (caught) {
      const error = asApiError(caught);
      setErrors((current) => ({ ...current, [id]: error }));
    } finally {
      setBusyId(null);
    }
  }

  const list = scripts.data?.scripts ?? [];
  const runnable = list.filter((script) => script.dryRun).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Read-only operator scripts"
        title="Scripts"
        description="A catalog of the repository's verification scripts with their safety class. A dry-run returns the exact local command; the server never executes a script from this page."
        actions={
          <button type="button" className="btn btn-secondary" onClick={scripts.reload} disabled={scripts.loading}>
            {scripts.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
          </button>
        }
      />

      <InlineNotice tone="warn">
        Dry-run is a command hint, not remote execution. Paid scripts are listed but not dry-runnable; the API refuses them by name.
      </InlineNotice>

      <div className="mt-5">
        <Card className="p-6">
          <SectionTitle
            title="Available scripts"
            description={scripts.loading ? 'Loading the catalog…' : `${list.length} catalog entries, ${runnable} dry-runnable. The list is served by GET /api/scripts.`}
            action={<Terminal size={16} className="text-slate-400" aria-hidden />}
          />

          {scripts.loading ? (
            <div className="mt-4"><LoadingPanel label="Loading script catalog…" /></div>
          ) : scripts.error ? (
            <div className="mt-4"><ErrorPanel error={scripts.error} onRetry={scripts.reload} title="Script catalog unavailable" /></div>
          ) : list.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Terminal} title="No scripts reported" body="The API returned an empty catalog. This page does not invent commands." />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table w-full text-sm">
                <caption className="sr-only">Repository scripts, safety class, and dry-run availability</caption>
                <thead>
                  <tr>
                    <th scope="col">Script</th>
                    <th scope="col">Safety</th>
                    <th scope="col">Dry-run</th>
                    <th scope="col">Description</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((script) => {
                    const result = results[script.id];
                    const error = errors[script.id];
                    return (
                      <tr key={script.id}>
                        <td>
                          <div className="font-mono text-xs text-slate-900">{script.name}</div>
                        </td>
                        <td><span className={safetyClass(script)}>{script.safety}</span></td>
                        <td className="text-xs">
                          {script.dryRun ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck size={13} aria-hidden /> supported</span>
                          ) : (
                            <span className="text-slate-500">not available</span>
                          )}
                        </td>
                        <td className="max-w-md text-xs text-slate-600">
                          <p>{script.description}</p>
                          {result ? (
                            <div className="mt-2 rounded-md bg-slate-50 p-2" role="status" aria-live="polite">
                              <span className="font-medium text-slate-700">Local command: </span>
                              <code className="code-chip break-all">{result.message}</code>
                            </div>
                          ) : null}
                          {error ? (
                            <div className="mt-2" role="alert">
                              <span className="code-chip mr-1">{error.code}</span>
                              <span className="text-rose-700">{error.message}</span>
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {script.dryRun ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => runDry(script.id)}
                              disabled={busyId !== null}
                              aria-label={`Dry-run ${script.name}`}
                            >
                              {busyId === script.id ? <Spinner /> : <Terminal size={13} aria-hidden />} Dry-run
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm btn-disabled"
                              disabled
                              aria-label={`Dry-run ${script.name} unavailable`}
                              title="This script is paid or has no dry-run endpoint; it must be run deliberately from a terminal."
                            >
                              Not dry-runnable
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card className="p-6">
          <SectionTitle title="What this page does not do" description="The boundary is deliberate." />
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>It does not spawn a process, shell, or script.</li>
            <li>It does not run a paid bench or learning job.</li>
            <li>It does not hide a paid script; it labels it and disables the unsafe action.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
