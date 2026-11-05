import { useState } from 'react';
import { AlertTriangle, GitBranch, RefreshCw, Scale } from 'lucide-react';
import {
  analyzeDominators,
  ApiError,
  evaluateScorecards,
} from '../api';
import type {
  DominatorAnalysisView,
  DominatorEdge,
  ScorecardInputView,
  ScorecardResultView,
} from '../api-types';
import {
  Card,
  ErrorPanel,
  InlineNotice,
  PageHeader,
  SectionTitle,
  Spinner,
} from '../components/ui';

const SPECIALISTS: Array<{ id: ScorecardInputView['specialist']; label: string }> = [
  { id: 'architect', label: 'Architect' },
  { id: 'risk-auditor', label: 'Risk auditor' },
  { id: 'testability-engineer', label: 'Testability engineer' },
  { id: 'clarity-editor', label: 'Clarity editor' },
];

function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({
    code: 'E_ANALYSIS_UI',
    status: 0,
    message: error instanceof Error ? error.message : 'The analysis request failed.',
  });
}

function parseEdges(text: string): DominatorEdge[] {
  const edges: DominatorEdge[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(.+?)\s*->\s*(.+)$/.exec(line);
    if (!match) throw new Error(`Invalid edge "${line}". Use "from -> to".`);
    edges.push({ from: match[1].trim(), to: match[2].trim() });
  }
  if (edges.length === 0) throw new Error('Add at least one edge before analyzing.');
  return edges;
}

function initialScorecards(): ScorecardInputView[] {
  return SPECIALISTS.map((specialist) => ({
    specialist: specialist.id,
    architecture: 3,
    risk: 3,
    testability: 3,
    clarity: 3,
    evidenceRefs: [],
  }));
}

export function AnalysisPage() {
  const [root, setRoot] = useState('');
  const [edgeText, setEdgeText] = useState('');
  const [dominatorResult, setDominatorResult] = useState<DominatorAnalysisView | null>(null);
  const [dominatorError, setDominatorError] = useState<ApiError | null>(null);
  const [dominatorBusy, setDominatorBusy] = useState(false);

  const [scorecards, setScorecards] = useState<ScorecardInputView[]>(initialScorecards);
  const [threshold, setThreshold] = useState(1.5);
  const [scorecardResult, setScorecardResult] = useState<ScorecardResultView | null>(null);
  const [scorecardError, setScorecardError] = useState<ApiError | null>(null);
  const [scorecardBusy, setScorecardBusy] = useState(false);

  async function runDominators(event: React.FormEvent) {
    event.preventDefault();
    setDominatorError(null);
    setDominatorResult(null);
    let edges: DominatorEdge[];
    try {
      edges = parseEdges(edgeText);
    } catch (error) {
      setDominatorError(asApiError(error));
      return;
    }
    setDominatorBusy(true);
    try {
      setDominatorResult(await analyzeDominators({ root: root.trim(), edges }));
    } catch (error) {
      setDominatorError(asApiError(error));
    } finally {
      setDominatorBusy(false);
    }
  }

  async function runScorecards(event: React.FormEvent) {
    event.preventDefault();
    setScorecardError(null);
    setScorecardResult(null);
    setScorecardBusy(true);
    try {
      setScorecardResult(await evaluateScorecards({
        scorecards: scorecards.map((card) => ({
          ...card,
          evidenceRefs: card.evidenceRefs.flatMap((ref) => ref.split(',').map((part) => part.trim()).filter(Boolean)),
        })),
        threshold,
      }));
    } catch (error) {
      setScorecardError(asApiError(error));
    } finally {
      setScorecardBusy(false);
    }
  }

  function updateScore(index: number, field: 'architecture' | 'risk' | 'testability' | 'clarity', value: number) {
    setScorecards((current) => current.map((card, cardIndex) => (cardIndex === index ? { ...card, [field]: value } : card)));
  }

  function updateEvidence(index: number, value: string) {
    setScorecards((current) => current.map((card, cardIndex) => (cardIndex === index ? { ...card, evidenceRefs: [value] } : card)));
  }

  const rankedDominators = dominatorResult
    ? dominatorResult.nodes.slice().sort((a, b) => (dominatorResult.dominatedCounts[b] ?? 0) - (dominatorResult.dominatedCounts[a] ?? 0) || a.localeCompare(b))
    : [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Read-only static analysis"
        title="Analysis"
        description="Two bounded, non-executing questions over JSON: which files dominate a dependency graph, and whether specialist scorecards disagree enough to warrant debate."
      />

      <InlineNotice tone="warn">
        Dominators are a static file-level heuristic, not a control-flow graph. Scorecards are opinions with evidence
        references; a debate flag is a scheduler hint, not a verdict. Neither operation reads a file path, calls a
        model, or executes code.
      </InlineNotice>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle
            title="File dominators"
            description="Edges are dependency -> dependent. The API caps nodes at 2,000 and edges at 5,000."
            action={<GitBranch size={16} className="text-slate-400" aria-hidden />}
          />
          <form className="mt-4 space-y-4" onSubmit={runDominators}>
            <label className="label block">
              Root file
              <input
                className="input mt-1 w-full"
                value={root}
                onChange={(event) => setRoot(event.target.value)}
                placeholder="src/app.ts"
                autoComplete="off"
              />
            </label>
            <label className="label block">
              Edges, one per line
              <textarea
                className="input mt-1 min-h-40 w-full font-mono text-xs"
                value={edgeText}
                onChange={(event) => setEdgeText(event.target.value)}
                placeholder={'src/app.ts -> src/api.ts\nsrc/api.ts -> src/store.ts'}
              />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={dominatorBusy}>
                {dominatorBusy ? <Spinner /> : <GitBranch size={15} aria-hidden />} Analyze graph
              </button>
              <span className="text-xs text-slate-500">Static only</span>
            </div>
          </form>

          <div className="mt-5" aria-live="polite">
            {dominatorError ? <ErrorPanel error={dominatorError} title="Graph refused" /> : null}
            {dominatorResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Files</div><div className="font-mono text-lg">{dominatorResult.nodes.length}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Edges</div><div className="font-mono text-lg">{dominatorResult.edgeCount}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Overall risk</div><div className="font-mono text-lg">{dominatorResult.overallRisk.toFixed(2)}</div></div>
                  <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Truncated</div><div className="font-mono text-lg">{dominatorResult.truncated ? 'yes' : 'no'}</div></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr><th scope="col">File</th><th scope="col">Dominated</th><th scope="col">Risk</th><th scope="col">Reachable</th></tr>
                    </thead>
                    <tbody>
                      {rankedDominators.map((file) => (
                        <tr key={file}>
                          <td className="font-mono text-xs">{file}</td>
                          <td className="font-mono text-xs">{dominatorResult.dominatedCounts[file] ?? 0}</td>
                          <td className="font-mono text-xs">{(dominatorResult.risk[file] ?? 0).toFixed(2)}</td>
                          <td className="text-xs">{dominatorResult.reachable.includes(file) ? 'yes' : 'no'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dominatorResult.iterations >= dominatorResult.maxIterations ? (
                  <p className="text-xs text-amber-700">Iteration cap reached; results are bounded, not exact.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="Specialist disagreement"
            description="Four opinions on a 1..5 scale. Variance is the largest per-dimension spread."
            action={<Scale size={16} className="text-slate-400" aria-hidden />}
          />
          <form className="mt-4 space-y-4" onSubmit={runScorecards}>
            <div className="space-y-3">
              {scorecards.map((card, index) => (
                <div key={card.specialist} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-36 text-xs font-medium text-slate-700">{SPECIALISTS[index].label}</span>
                    {(['architecture', 'risk', 'testability', 'clarity'] as const).map((field) => (
                      <label key={field} className="text-[10px] uppercase tracking-wide text-slate-500">
                        {field === 'architecture' ? 'Arch' : field === 'testability' ? 'Test' : field === 'risk' ? 'Risk' : 'Clarity'}
                        <input
                          aria-label={`${SPECIALISTS[index].label} ${field}`}
                          className="input ml-1 w-16 text-center"
                          type="number"
                          min={1}
                          max={5}
                          step={1}
                          value={card[field]}
                          onChange={(event) => updateScore(index, field, Number(event.target.value))}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="mt-2 block text-[10px] uppercase tracking-wide text-slate-500">
                    Evidence refs
                    <input
                      aria-label={`${SPECIALISTS[index].label} evidence references`}
                      className="input mt-1 w-full text-xs"
                      value={card.evidenceRefs[0] ?? ''}
                      onChange={(event) => updateEvidence(index, event.target.value)}
                      placeholder="src/a.ts:10, review:7"
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="label block">
                Debate threshold
                <input
                  className="input mt-1 w-24"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={scorecardBusy}>
                {scorecardBusy ? <Spinner /> : <Scale size={15} aria-hidden />} Evaluate disagreement
              </button>
            </div>
          </form>

          <div className="mt-5" aria-live="polite">
            {scorecardError ? <ErrorPanel error={scorecardError} title="Scorecards refused" /> : null}
            {scorecardResult ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <InlineNotice tone={scorecardResult.needsDebate ? 'warn' : 'info'}>
                    {scorecardResult.needsDebate ? 'Debate budget suggested' : 'No debate trigger'}
                  </InlineNotice>
                  <span className="font-mono text-sm">variance {scorecardResult.variance}</span>
                </div>
                {scorecardResult.missing.length > 0 ? (
                  <InlineNotice tone="warn">
                    Missing specialists: {scorecardResult.missing.join(', ')}. Missing opinions force a debate hint.
                  </InlineNotice>
                ) : null}
                <table className="data-table w-full text-sm">
                  <thead><tr><th scope="col">Specialist</th><th scope="col">A</th><th scope="col">R</th><th scope="col">T</th><th scope="col">C</th></tr></thead>
                  <tbody>
                    {scorecardResult.scorecards.map((card) => (
                      <tr key={card.specialist}>
                        <td className="text-xs">{card.specialist}</td>
                        <td className="font-mono text-xs">{card.architecture}</td>
                        <td className="font-mono text-xs">{card.risk}</td>
                        <td className="font-mono text-xs">{card.testability}</td>
                        <td className="font-mono text-xs">{card.clarity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                  This is not a quality certificate. It only says whether spending a debate turn is justified.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw size={13} aria-hidden />
        Results are computed on demand; nothing is persisted, cached, or attributed to a run.
      </div>
    </div>
  );
}
