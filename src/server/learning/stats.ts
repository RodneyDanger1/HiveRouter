import type { PairedOutcome } from './contracts.js';
import { BOOTSTRAP_ITERATIONS, DEFAULT_SEED } from './contracts.js';

export interface Interval {
  low: number;
  high: number;
  center: number;
}

export interface ScreeningMetrics {
  n: number;
  baselineRate: number;
  candidateRate: number;
  delta: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  mcnemarP: number;
  wilsonBaseline: Interval;
  wilsonCandidate: Interval;
  discordantBaselinePass: number;
  discordantCandidatePass: number;
  criticalRegressions: number;
  seed: number;
  iterations: number;
}

export function wilson(successes: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { low: 0, high: 1, center: 0 };
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    center: p,
  };
}

const LOG_CHOOSE_CACHE = new Map<string, number>();

function logChoose(n: number, k: number): number {
  const key = `${n}:${k}`;
  const cached = LOG_CHOOSE_CACHE.get(key);
  if (cached !== undefined) return cached;
  const value =
    logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  LOG_CHOOSE_CACHE.set(key, value);
  return value;
}

function logFactorial(n: number): number {
  let value = 0;
  for (let i = 2; i <= n; i += 1) value += Math.log(i);
  return value;
}

/** Two-sided exact McNemar p-value on the discordant counts. */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i += 1) {
    tail += Math.exp(logChoose(n, i) - n * Math.log(2));
  }
  return Math.min(1, Math.max(0, 2 * tail));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pairedBootstrap(
  pairs: PairedOutcome[],
  options: { alpha?: number; iterations?: number; seed?: number } = {},
): { lowerBound: number; upperBound: number; confidence: number; iterations: number; seed: number } {
  const alpha = options.alpha ?? 0.05;
  const iterations = options.iterations ?? BOOTSTRAP_ITERATIONS;
  const seed = options.seed ?? DEFAULT_SEED;
  const n = pairs.length;
  if (n === 0) {
    return { lowerBound: 0, upperBound: 0, confidence: 1 - alpha, iterations, seed };
  }
  const random = mulberry32(seed);
  const differences: number[] = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let baseline = 0;
    let candidate = 0;
    for (let i = 0; i < n; i += 1) {
      const pick = pairs[Math.floor(random() * n)]!;
      if (pick.baselinePass) baseline += 1;
      if (pick.candidatePass) candidate += 1;
    }
    differences.push((candidate - baseline) / n);
  }
  differences.sort((a, b) => a - b);
  const lowerIndex = Math.max(0, Math.min(iterations - 1, Math.floor(alpha * iterations)));
  const upperIndex = Math.max(0, Math.min(iterations - 1, Math.ceil((1 - alpha) * iterations) - 1));
  return {
    lowerBound: differences[lowerIndex]!,
    upperBound: differences[upperIndex]!,
    confidence: 1 - alpha,
    iterations,
    seed,
  };
}

export function evaluateScreening(
  pairs: PairedOutcome[],
  options: { alpha?: number; iterations?: number; seed?: number } = {},
): ScreeningMetrics {
  const n = pairs.length;
  const baselineSuccesses = pairs.filter((pair) => pair.baselinePass).length;
  const candidateSuccesses = pairs.filter((pair) => pair.candidatePass).length;
  const baselineRate = n === 0 ? 0 : baselineSuccesses / n;
  const candidateRate = n === 0 ? 0 : candidateSuccesses / n;
  const discordantBaselinePass = pairs.filter(
    (pair) => pair.baselinePass && !pair.candidatePass,
  ).length;
  const discordantCandidatePass = pairs.filter(
    (pair) => !pair.baselinePass && pair.candidatePass,
  ).length;
  const bootstrap = pairedBootstrap(pairs, options);
  return {
    n,
    baselineRate,
    candidateRate,
    delta: candidateRate - baselineRate,
    lowerBound: bootstrap.lowerBound,
    upperBound: bootstrap.upperBound,
    confidence: bootstrap.confidence,
    mcnemarP: mcnemarExact(discordantBaselinePass, discordantCandidatePass),
    wilsonBaseline: wilson(baselineSuccesses, n),
    wilsonCandidate: wilson(candidateSuccesses, n),
    discordantBaselinePass,
    discordantCandidatePass,
    criticalRegressions: pairs.filter((pair) => pair.candidateCriticalSafety === true).length,
    seed: bootstrap.seed,
    iterations: bootstrap.iterations,
  };
}
