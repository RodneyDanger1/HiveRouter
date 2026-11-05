import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Plus, RefreshCw } from 'lucide-react';
import { listRuns } from '../api';
import { useApiResource } from '../hooks/useApi';
import { RunTable } from '../components/RunTable';
import {
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  PageHeader,
  Spinner,
  titleCase,
} from '../components/ui';

const FILTERS = ['all', 'queued', 'running', 'paused', 'completed', 'completed_with_warnings', 'failed', 'cancelled', 'budget_exceeded', 'needs_review', 'interrupted'];

export function RunsPage() {
  const [status, setStatus] = useState('all');
  const runs = useApiResource((signal) => listRuns(100, signal, status), [status]);
  const list = runs.data?.runs ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Execution ledger"
        title="Runs"
        description="Every run is persisted with its status, phase, spend, and artifacts. Terminal states are terminal; a failed gate is not a success."
        actions={
          <>
            <Link to="/" className="btn btn-primary">
              <Plus size={15} aria-hidden /> New run
            </Link>
            <button type="button" className="btn btn-secondary" onClick={runs.reload} disabled={runs.loading}>
              {runs.loading ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Refresh
            </button>
          </>
        }
      />

      <div className="toolbar">
        <label className="toolbar-field">
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All statuses' : titleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-mono text-xs text-slate-500">
          {list.length} run{list.length === 1 ? '' : 's'} · server-filtered
        </span>
      </div>

      {runs.loading ? (
        <LoadingPanel label="Loading runs…" />
      ) : runs.error ? (
        <ErrorPanel error={runs.error} onRetry={runs.reload} title="Runs unavailable" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No runs recorded"
          body="The API has no runs for this status. Start one from the overview; this page does not invent a history."
          action={
            <Link to="/" className="btn btn-primary">
              Start a run
            </Link>
          }
        />
      ) : (
        <RunTable runs={list} />
      )}
    </div>
  );
}
