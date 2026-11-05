/**
 * FSN — failure signature and triage (P6a A2).
 *
 * Pure: normalizes checker output, classifies it by ordered rules, clusters by
 * category/language + token Jaccard, computes blast radius from a dependency
 * graph and suppresses a cluster after two failed repairs.
 */
import {
  AlgorithmRefusal,
  FAILURE_CATEGORIES,
  FailureCategory,
  FailureCluster,
  FailureClusterSchema,
  FailureInput,
  FailureInputSchema,
  FailureTriageRequest,
  FailureTriageRequestSchema,
  FailureTriageResult,
  FailureTriageResultSchema,
  sha256Hex,
} from '../../shared/algorithms';

const JACCARD_THRESHOLD = 0.8;
const MAX_SIGNATURE_CHARS = 512;

const CATEGORY_RULES: ReadonlyArray<readonly [FailureCategory, RegExp]> = [
  ['auth', /\b(401|403|unauthori[sz]ed|forbidden|invalid.{0,12}(api.?key|token)|authentication)\b/i],
  ['budget', /\b(402|budget|quota|insufficient.{0,20}balance|cost.{0,20}exceed)\b/i],
  ['secret', /\b(secret|credential|token.{0,12}leak|redaction)\b/i],
  ['permission', /\b(eacces|eperm|permission denied|access denied)\b/i],
  ['syntax', /\b(syntaxerror|unexpected token|parse error|invalid syntax|unexpected end|unterminated)\b/i],
  ['type', /\b(typeerror|type.{0,20}not assignable|cannot find name|ts\d{4})\b/i],
  ['import', /\b(module not found|cannot find module|importerror|modulenotfound|failed to resolve|no matching export)\b/i],
  ['missing-file', /\b(enoent|no such file|file not found|missing file|does not exist)\b/i],
  ['timeout', /\b(timeout|timed out|etimedout)\b/i],
  ['rate-limit', /\b(429|rate limit|too many requests)\b/i],
  ['placeholder', /\b(todo|fixme|placeholder|not implemented|implementation here)\b/i],
  ['path', /\b(path traversal|unsafe path|outside workspace|invalid path)\b/i],
  ['test-assert', /\b(assertionerror|expected .{0,30} received|test failed|assert failed)\b/i],
  ['runtime', /\b(runtimeerror|referenceerror|undefined is not|cannot read prop|segmentation fault|panic|crash)\b/i],
];

const SEVERITY: Record<FailureCategory, number> = {
  auth: 3,
  secret: 3,
  path: 3,
  policy: 3,
  budget: 2,
  permission: 2,
  syntax: 2,
  type: 2,
  import: 2,
  'missing-file': 2,
  timeout: 2,
  'rate-limit': 1,
  placeholder: 2,
  'test-assert': 1,
  verification: 2,
  runtime: 2,
  unknown: 1,
};

const now = (): string => new Date(0).toISOString();

export function normalizeFailure(input: FailureInput): string {
  const raw = `${input.message}\n${input.stderr}`.toLowerCase();
  return raw
    .replace(/\u001b\[[0-9;]*m/g, ' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '<uuid>')
    .replace(/(?:[a-z]:\\[^\s:]+|\/(?:[^\s:]+\/)+[^\s:]+)/g, '<path>')
    .replace(/\b\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/g, '<time>')
    .replace(/\bline\s*\d+\b/g, 'line <n>')
    .replace(/:\d+(?::\d+)?/g, ':<n>')
    .replace(/\b[a-f0-9]{8,}\b/g, '<hash>')
    .replace(/\b0x[a-f0-9]+\b/g, '<hex>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SIGNATURE_CHARS);
}

export function classifyFailure(normalized: string): FailureCategory {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(normalized)) return category;
  }
  return 'unknown';
}

export function failureSignature(input: FailureInput): string {
  return sha256Hex(normalizeFailure(input)).slice(0, 16);
}

export function tokenSet(normalized: string): Set<string> {
  return new Set(normalized.match(/[a-z0-9_]{2,}/g) ?? []);
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function refusal(code: AlgorithmRefusal['code'], message: string, details: Record<string, unknown> = {}): AlgorithmRefusal {
  return { code, message, details };
}

interface GraphInfo {
  dependents: Map<string, string[]>;
  blast: Map<string, number>;
}

function graphInfo(nodes: string[], edges: Array<[string, string]>): GraphInfo {
  const dependents = new Map<string, string[]>();
  for (const node of nodes) dependents.set(node, []);
  for (const [from, to] of edges) {
    const list = dependents.get(to) ?? [];
    list.push(from);
    dependents.set(to, list);
  }
  const blast = new Map<string, number>();
  for (const node of nodes) {
    const seen = new Set<string>();
    const queue = [...(dependents.get(node) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      queue.push(...(dependents.get(current) ?? []));
    }
    blast.set(node, seen.size);
  }
  return { dependents, blast };
}

function targetsFor(file: string, graph: GraphInfo): string[] {
  const direct = (graph.dependents.get(file) ?? []).slice().sort((a, b) => {
    const radius = (graph.blast.get(b) ?? 0) - (graph.blast.get(a) ?? 0);
    return radius !== 0 ? radius : a.localeCompare(b);
  });
  return [file, ...direct].slice(0, 3);
}

export function triageFailures(raw: unknown): FailureTriageResult {
  const request = FailureTriageRequestSchema.parse(raw) as FailureTriageRequest;
  const graph = graphInfo(request.graph.nodes, request.graph.edges);
  const clusters: FailureCluster[] = request.existing.map((cluster) =>
    FailureClusterSchema.parse({
      ...cluster,
      signatures: [...new Set(cluster.signatures)].sort(),
      representative: [...new Set(cluster.signatures)].sort()[0] ?? cluster.representative,
      suppressed: cluster.suppressed || cluster.repairFailures >= 2,
    }),
  );
  const refusals: AlgorithmRefusal[] = [];
  const suppressedSignatures: string[] = [];
  const occurrences: FailureTriageResult['occurrences'] = [];

  const failures = request.failures
    .map((failure) => {
      const parsed = FailureInputSchema.parse(failure);
      const normalized = normalizeFailure(parsed);
      const category = classifyFailure(normalized);
      const signature = sha256Hex(normalized).slice(0, 16);
      return { failure: parsed, normalized, category, signature, tokens: tokenSet(normalized) };
    })
    .sort((a, b) => a.signature.localeCompare(b.signature));

  for (const entry of failures) {
    const sameCategory = clusters.filter(
      (cluster) => cluster.category === entry.category && cluster.language === entry.failure.language,
    );
    let best: FailureCluster | undefined = sameCategory.find((cluster) =>
      cluster.signatures.includes(entry.signature),
    );
    let bestSimilarity = -1;
    if (!best) {
      for (const cluster of sameCategory) {
        const similarity = jaccard(entry.tokens, tokenSet(cluster.representativeText ?? cluster.representative));
        if (
          similarity >= JACCARD_THRESHOLD &&
          (similarity > bestSimilarity ||
            (similarity === bestSimilarity && cluster.clusterId < (best?.clusterId ?? '~')))
        ) {
          best = cluster;
          bestSimilarity = similarity;
        }
      }
    }

    if (!best) {
      if (clusters.length >= request.maxClusters) {
        refusals.push(refusal('E_FSN_CLUSTER_LIMIT', 'Failure cluster cap reached.', {
          maxClusters: request.maxClusters,
          failureSignature: entry.signature,
        }));
        continue;
      }
      const representative = entry.signature;
      best = FailureClusterSchema.parse({
        clusterId: sha256Hex(`${entry.category}|${entry.failure.language}|${representative}`).slice(0, 16),
        category: entry.category,
        language: entry.failure.language,
        representative,
        representativeText: entry.normalized,
        signatures: [],
        occurrences: 0,
        blastRadius: 0,
        repairFailures: 0,
        suppressed: false,
      });
      clusters.push(best);
    }

    if (!best.signatures.includes(entry.signature)) best.signatures.push(entry.signature);
    best.signatures.sort();
    best.representative = best.signatures[0];
    best.occurrences += 1;
    best.blastRadius = Math.max(best.blastRadius, graph.blast.get(entry.failure.file) ?? 0);
    if (best.repairFailures >= 2) {
      best.suppressed = true;
      if (!suppressedSignatures.includes(entry.signature)) suppressedSignatures.push(entry.signature);
      refusals.push(refusal('E_REPAIR_STALLED', 'A cluster has failed repair twice; no third blind attempt.', {
        clusterId: best.clusterId,
        signature: entry.signature,
      }));
    }
    const targets = targetsFor(entry.failure.file, graph);
    occurrences.push({
      signature: entry.signature,
      clusterId: best.clusterId,
      category: entry.category,
      targets,
      priority: SEVERITY[entry.category] * (1 + Math.log1p(best.blastRadius)),
    });
  }

  clusters.sort((a, b) => a.clusterId.localeCompare(b.clusterId));
  occurrences.sort((a, b) => a.signature.localeCompare(b.signature));
  const result: FailureTriageResult = {
    clusters: clusters.map((cluster) => FailureClusterSchema.parse({ ...cluster })),
    occurrences,
    refusals,
    suppressedSignatures: [...new Set(suppressedSignatures)].sort(),
  };
  return FailureTriageResultSchema.parse(result);
}

export const FSN = {
  threshold: JACCARD_THRESHOLD,
  maxSignatureChars: MAX_SIGNATURE_CHARS,
  categories: FAILURE_CATEGORIES,
  timestamp: now,
} as const;
