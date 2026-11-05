import { Check, CircleHelp, ClipboardCheck, Sparkles, X } from 'lucide-react';
import type { PromptAnalysis } from '@shared/prompt-analysis';

function SourcePill({ source }: { source: 'user' | 'inferred' | 'unknown' }) {
  const tone =
    source === 'user'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : source === 'inferred'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>{source}</span>;
}

export function PromptAnalysisCard({
  analysis,
  onApply,
  onDismiss,
}: {
  analysis: PromptAnalysis;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4" aria-label="Prompt analyst result">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles size={17} className="mt-0.5 text-indigo-600" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Prompt analyst</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Interpretation only. “User” items quote your exact text; inferred/unknown items are not claims.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-small" onClick={onApply}>
            <ClipboardCheck size={14} aria-hidden /> Use analyzed brief
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={onDismiss} aria-label="Dismiss prompt analysis">
            <X size={14} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="eyebrow">Interpreted goal</p>
            <p className="mt-1 text-sm text-slate-800">{analysis.interpretedGoal}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="eyebrow">Summary</p>
            <p className="mt-1 text-sm text-slate-700">{analysis.summary}</p>
          </div>
        </div>

        {analysis.deliverables.length > 0 ? (
          <div>
            <p className="eyebrow">Deliverables</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {analysis.deliverables.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="eyebrow">Requirements</p>
          <ul className="mt-1 space-y-2">
            {analysis.requirements.map((requirement) => (
              <li key={requirement.id} className="rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SourcePill source={requirement.source} />
                  <span className="text-sm text-slate-800">{requirement.text}</span>
                </div>
                {requirement.evidenceQuote ? (
                  <p className="mt-1 border-l-2 border-emerald-200 pl-2 text-xs text-slate-500">
                    Exact prompt quote: “{requirement.evidenceQuote}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Acceptance proof</p>
          <ul className="mt-1 grid gap-2 md:grid-cols-2">
            {analysis.acceptanceCriteria.map((criterion) => (
              <li key={criterion.id} className="rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden />
                  <div>
                    <p className="text-sm text-slate-800">{criterion.criterion}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Proof:</span> {criterion.proof}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                      {criterion.status === 'stated' ? 'User-stated' : criterion.status === 'inferred' ? 'Inferred check' : 'Unproven'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {analysis.ambiguities.length > 0 ? (
          <div>
            <p className="eyebrow">Ambiguities to resolve</p>
            <ul className="mt-1 space-y-2">
              {analysis.ambiguities.map((ambiguity) => (
                <li key={ambiguity.id} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
                  <p className="flex items-start gap-2 text-sm text-slate-800">
                    <CircleHelp size={14} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
                    {ambiguity.question}
                  </p>
                  <p className="mt-1 pl-6 text-xs text-slate-500">{ambiguity.whyItMatters}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {analysis.nonGoals.length > 0 ? (
          <div>
            <p className="eyebrow">Explicit non-goals</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {analysis.nonGoals.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="eyebrow">Analyst limitations</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-500">
            {analysis.limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`}>{limitation}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Analyst confidence: <span className="font-mono font-medium text-slate-700">{Math.round(analysis.confidence * 100)}%</span>. Confidence is
            not evidence; the quoted requirements and proof checks are what you can inspect.
          </p>
        </div>
      </div>
    </section>
  );
}
