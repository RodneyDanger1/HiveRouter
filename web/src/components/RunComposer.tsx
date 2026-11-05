import { useEffect, useState } from 'react';
import { ArrowRight, Play, ShieldCheck, Sparkles } from 'lucide-react';
import type { Preset } from '@shared/types';
import type { PromptAnalysisResponse } from '../api-types';
import { ApiError, analyzePrompt, startRun } from '../api';
import { cn, humanError, Spinner } from './ui';
import { PromptAnalysisCard } from './PromptAnalysisCard';

const COMPOSER_PRESETS: Array<{ value: Preset; label: string; description: string }> = [
  { value: 'full-build', label: 'Full build', description: 'Plan, route, generate, review, verify.' },
  { value: 'blueprint', label: 'Blueprint only', description: 'Architecture and file matrix; no generation.' },
  { value: 'ui-build', label: 'UI build', description: 'Plan and generate an interface, then harden and verify.' },
  { value: 'docs', label: 'Documentation', description: 'Plan and write project documentation.' },
];

const DRAFT_KEY = 'hive.composer.v1';
const MODEL_IDS = new Set(['deepseek-flash', 'deepseek-v4-pro']);
const THINKING_MODES = new Set(['disabled', 'enabled']);
const EFFORTS = new Set(['low', 'high', 'max']);

interface ComposerDraft {
  brief?: string;
  preset?: Preset;
  model?: string;
  thinking?: string;
  effort?: string;
  maxCostUsd?: string;
}

function readDraft(): ComposerDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ComposerDraft;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      brief: typeof parsed.brief === 'string' ? parsed.brief.slice(0, 8000) : undefined,
      preset: COMPOSER_PRESETS.some((item) => item.value === parsed.preset) ? parsed.preset : undefined,
      model: typeof parsed.model === 'string' && MODEL_IDS.has(parsed.model) ? parsed.model : undefined,
      thinking: typeof parsed.thinking === 'string' && THINKING_MODES.has(parsed.thinking) ? parsed.thinking : undefined,
      effort: typeof parsed.effort === 'string' && EFFORTS.has(parsed.effort) ? parsed.effort : undefined,
      maxCostUsd: typeof parsed.maxCostUsd === 'string' && /^\d+(\.\d+)?$/.test(parsed.maxCostUsd) ? parsed.maxCostUsd : undefined,
    };
  } catch {
    return {};
  }
}

export function RunComposer({
  onStarted,
  disabledReason,
}: {
  onStarted: (runId: string) => void;
  disabledReason?: string | null;
}) {
  const [draft] = useState<ComposerDraft>(readDraft);
  const [brief, setBrief] = useState(draft.brief ?? '');
  const [preset, setPreset] = useState<Preset>(draft.preset ?? 'full-build');
  const [model, setModel] = useState(draft.model ?? 'deepseek-flash');
  const [thinking, setThinking] = useState(draft.thinking ?? 'disabled');
  const [effort, setEffort] = useState(draft.effort ?? 'high');
  const [maxCostUsd, setMaxCostUsd] = useState(draft.maxCostUsd ?? '0.50');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PromptAnalysisResponse | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<ApiError | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ brief, preset, model, thinking, effort, maxCostUsd }));
    } catch {
      // Private browsing / storage-disabled is not fatal; the run still starts.
    }
  }, [brief, preset, model, thinking, effort, maxCostUsd]);


  const disabled = Boolean(disabledReason) || busy || analysisBusy;

  async function analyze() {
    setAnalysisError(null);
    setValidation(null);
    if (brief.trim().length < 8) {
      setValidation('Write at least 8 characters before asking for an analysis.');
      return;
    }
    setAnalysisBusy(true);
    try {
      const result = await analyzePrompt(brief.trim());
      setAnalysis(result);
    } catch (caught) {
      setAnalysisError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ code: 'E_NETWORK', status: 0, message: 'The prompt analysis could not be reached.' }),
      );
    } finally {
      setAnalysisBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setValidation(null);
    if (brief.trim().length < 8) {
      setValidation('Describe the project in at least 8 characters.');
      return;
    }
    const cap = Number(maxCostUsd);
    if (!Number.isFinite(cap) || cap <= 0) {
      setValidation('Max cost must be a positive number.');
      return;
    }
    setBusy(true);
    try {
      const runId = await startRun({
        brief: brief.trim(),
        preset,
        model,
        thinking,
        effort: thinking === 'enabled' ? effort : undefined,
        maxCostUsd: cap,
      });
      onStarted(runId);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({ code: 'E_NETWORK', status: 0, message: 'The run could not be started.' }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby={validation ? 'composer-validation' : undefined}>
      <div>
        <label className="label" htmlFor="run-brief">
          Project brief
        </label>
        <textarea
          id="run-brief"
          className="input mt-1 min-h-[132px] resize-y"
          placeholder="Describe the software you want built, the constraints, and how success will be checked."
          value={brief}
          onChange={(event) => {
            setBrief(event.target.value);
            setAnalysis(null);
            setAnalysisError(null);
          }}
          maxLength={8000}
          disabled={disabled}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span>Briefs are untrusted data. The factory plans before it writes.</span>
          <span className="font-mono">{brief.length}/8000</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Sparkles size={15} className="text-indigo-600" aria-hidden /> Prompt analyst
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Separates your literal requirements from inferred/unknown details and names the proof needed. It never runs code or claims tests passed.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={analyze} disabled={disabled || brief.trim().length < 8}>
            {analysisBusy ? <Spinner /> : <Sparkles size={14} aria-hidden />}
            {analysisBusy ? 'Analyzing…' : 'Analyze prompt'}
          </button>
        </div>
        {analysisError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {humanError(analysisError)} <code className="code-chip">{analysisError.code}</code>
          </p>
        ) : null}
        {analysis ? (
          <div className="mt-3">
            <PromptAnalysisCard
              analysis={analysis.analysis}
              onDismiss={() => setAnalysis(null)}
              onApply={() => {
                setBrief(analysis.analysis.restatedBrief);
                setValidation(null);
                setAnalysis(null);
              }}
            />
            {analysis.repairAttempted ? (
              <p className="mt-2 text-xs text-amber-700">
                The analyst was asked once to correct an unquoted claim; the returned analysis passed exact-quote validation.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Preset</span>
          <select className="input mt-1" value={preset} onChange={(event) => setPreset(event.target.value as Preset)} disabled={disabled}>
            {COMPOSER_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Model</span>
          <select className="input mt-1" value={model} onChange={(event) => setModel(event.target.value)} disabled={disabled}>
            <option value="deepseek-flash">deepseek-flash</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Thinking</span>
          <select
            className="input mt-1"
            value={thinking}
            onChange={(event) => setThinking(event.target.value)}
            disabled={disabled}
          >
            <option value="disabled">Disabled (deterministic generation)</option>
            <option value="enabled">Enabled (planning / review)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Max run cost (USD)</span>
          <input
            className="input mt-1"
            inputMode="decimal"
            value={maxCostUsd}
            onChange={(event) => setMaxCostUsd(event.target.value)}
            disabled={disabled}
          />
        </label>
        {thinking === 'enabled' ? (
          <label className="block">
            <span className="label">Reasoning effort</span>
            <select className="input mt-1" value={effort} onChange={(event) => setEffort(event.target.value)} disabled={disabled}>
              <option value="low">low</option>
              <option value="high">high</option>
              <option value="max">max</option>
            </select>
          </label>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        {COMPOSER_PRESETS.find((option) => option.value === preset)?.description}
      </p>

      {validation ? (
        <p id="composer-validation" className="text-sm text-red-700" role="alert">
          {validation}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {humanError(error)} <code className="code-chip">{error.code}</code>
        </p>
      ) : null}
      {disabledReason ? (
        <p className="text-sm text-amber-800" role="status">
          {disabledReason}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={14} aria-hidden /> Human approval is required for promotions; this button only starts a run.
        </span>
        <button type="submit" className={cn('btn btn-primary')} disabled={disabled || brief.trim().length < 8}>
          {busy ? <Spinner /> : <Play size={15} aria-hidden />}
          {busy ? 'Starting…' : 'Start run'}
          {!busy ? <ArrowRight size={15} aria-hidden /> : null}
        </button>
      </div>
    </form>
  );
}
