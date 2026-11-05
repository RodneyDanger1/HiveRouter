import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { RunRecord } from '@shared/types';
import { formatDate, formatUsd, shortId, StatusBadge, titleCase } from './ui';

export function RunTable({ runs }: { runs: RunRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Brief</th>
            <th>Status</th>
            <th>Preset</th>
            <th>Spend</th>
            <th>Created</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="font-mono text-xs text-slate-500">{shortId(run.id, 12)}</td>
              <td className="max-w-[360px]">
                <Link to={`/runs/${encodeURIComponent(run.id)}`} className="font-medium text-slate-900 hover:underline">
                  {run.brief.trim().length > 120 ? `${run.brief.trim().slice(0, 120)}…` : run.brief}
                </Link>
              </td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td className="text-sm text-slate-600">{titleCase(run.preset)}</td>
              <td className="font-mono text-xs text-slate-600">{formatUsd(run.costUsd)}</td>
              <td className="text-xs text-slate-500">{formatDate(run.createdAt)}</td>
              <td className="text-right">
                <Link
                  to={`/runs/${encodeURIComponent(run.id)}`}
                  className="icon-button"
                  aria-label={`Open run ${shortId(run.id, 12)}`}
                >
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
