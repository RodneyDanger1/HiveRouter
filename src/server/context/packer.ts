/**
 * CPO — dependency-aware budgeted context packer (P6a A1).
 *
 * Pure: no network, DB, filesystem or provider call. Mandatory items and the
 * stable cache prefix are always first; optional items are selected by a 0/1
 * knapsack over 1k-token units under the remaining context budget.
 */
import {
  AlgorithmRefusal,
  ContextItem,
  ContextPack,
  ContextPackSchema,
  ContextRequest,
  ContextRequestSchema,
  clamp,
  sha256Hex,
} from '../../shared/algorithms';

export interface PageRankResult {
  ranks: Record<string, number>;
  incoming: Record<string, number>;
  converged: boolean;
  iterations: number;
}

const DAMPING = 0.85;
const MAX_ITERATIONS = 50;
const DELTA = 1e-9;
const KIND_WEIGHTS: Record<ContextItem['kind'], number> = {
  system: 1,
  brief: 1,
  plan: 0.85,
  interface: 0.9,
  dependency: 1,
  review: 0.8,
  test: 0.7,
  outline: 0.5,
};

function estimateItemTokens(item: ContextItem): number {
  return item.tokens ?? Math.max(1, Math.ceil(item.text.length / 4));
}

export function pageRank(
  nodes: string[],
  edges: Array<[string, string]>,
  damping = DAMPING,
  maxIterations = MAX_ITERATIONS,
  tolerance = DELTA,
): PageRankResult {
  const sortedNodes = [...new Set(nodes)].sort();
  const count = sortedNodes.length;
  const incoming: Record<string, number> = {};
  const outgoing: Record<string, string[]> = {};
  for (const node of sortedNodes) {
    incoming[node] = 0;
    outgoing[node] = [];
  }
  for (const [from, to] of edges) {
    if (!(from in outgoing) || !(to in incoming)) continue;
    outgoing[from].push(to);
    incoming[to] += 1;
  }
  if (count === 0) return { ranks: {}, incoming, converged: true, iterations: 0 };

  let ranks: Record<string, number> = {};
  for (const node of sortedNodes) ranks[node] = 1 / count;

  let converged = false;
  let iterations = 0;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterations = iteration + 1;
    const danglingMass = sortedNodes
      .filter((node) => outgoing[node].length === 0)
      .reduce((sum, node) => sum + ranks[node], 0);
    const next: Record<string, number> = {};
    for (const node of sortedNodes) {
      let inbound = 0;
      for (const source of sortedNodes) {
        if (outgoing[source].includes(node)) {
          inbound += ranks[source] / outgoing[source].length;
        }
      }
      next[node] = (1 - damping) / count + damping * (inbound + danglingMass / count);
    }
    let delta = 0;
    for (const node of sortedNodes) delta += Math.abs(next[node] - ranks[node]);
    ranks = next;
    if (delta <= tolerance) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    const maxIncoming = Math.max(1, ...sortedNodes.map((node) => incoming[node]));
    ranks = {};
    for (const node of sortedNodes) ranks[node] = incoming[node] / maxIncoming;
  }
  return { ranks, incoming, converged, iterations };
}

function refusal(code: AlgorithmRefusal['code'], message: string, details: Record<string, unknown> = {}): AlgorithmRefusal {
  return { code, message, details };
}

function emptyPack(
  request: ContextRequest,
  prefixHash: string,
  pageRankResult: PageRankResult,
  refusal: AlgorithmRefusal,
): ContextPack {
  return ContextPackSchema.parse({
    ok: false,
    taskId: request.taskId,
    items: [],
    excluded: [],
    estimatedTokens: 0,
    mandatoryTokens: 0,
    prefixHash,
    cachePrefixStable: request.expectedPrefixHash ? request.expectedPrefixHash === prefixHash : true,
    pageRank: { converged: pageRankResult.converged, iterations: pageRankResult.iterations },
    degraded: !pageRankResult.converged,
    refusal,
  });
}

export function packContext(raw: unknown): ContextPack {
  const request = ContextRequestSchema.parse(raw) as ContextRequest;
  const prefixText = `${request.prefix.system}\n${request.prefix.briefDigest}\n${request.prefix.planSummary}`;
  const prefixHash = sha256Hex(prefixText);
  const prefixTokens = Math.max(1, Math.ceil(prefixText.length / 4));
  const pageRankResult = request.graph
    ? pageRank(request.graph.nodes, request.graph.edges)
    : { ranks: {}, incoming: {}, converged: true, iterations: 0 };

  const mandatoryTokens = prefixTokens + request.mandatory.reduce((sum, item) => sum + estimateItemTokens(item), 0);
  if (mandatoryTokens > request.maxTokens) {
    return emptyPack(
      request,
      prefixHash,
      pageRankResult,
      refusal('E_CONTEXT_INFEASIBLE', 'Mandatory context exceeds maxTokens.', {
        mandatoryTokens,
        maxTokens: request.maxTokens,
      }),
    );
  }

  const mandatorySecret = request.mandatory.find((item) => item.secret);
  if (mandatorySecret) {
    return emptyPack(
      request,
      prefixHash,
      pageRankResult,
      refusal('E_POLICY_BLOCKED', `Mandatory context item ${mandatorySecret.id} contains a secret.`, {
        itemId: mandatorySecret.id,
      }),
    );
  }

  const seen = new Set<string>();
  const excluded: ContextPack['excluded'] = [];
  const optional: Array<{ item: ContextItem; tokens: number; units: number; value: number }> = [];

  for (const item of request.optional) {
    if (seen.has(item.id)) {
      excluded.push({ id: item.id, reason: 'duplicate' });
      continue;
    }
    seen.add(item.id);
    if (item.secret) {
      excluded.push({ id: item.id, reason: 'secret' });
      continue;
    }
    const tokens = estimateItemTokens(item);
    const units = Math.ceil(tokens / 1000);
    const rank = item.path ? pageRankResult.ranks[item.path] ?? 0 : 0;
    const incoming = item.path ? pageRankResult.incoming[item.path] ?? 0 : 0;
    const importance = item.importance ?? rank + 0.5 * incoming + 0.25 * item.criticality;
    optional.push({ item, tokens, units, value: importance * KIND_WEIGHTS[item.kind] });
  }

  const capacityUnits = Math.floor((request.maxTokens - mandatoryTokens) / 1000);
  const ordered = optional.slice().sort((a, b) => a.item.id.localeCompare(b.item.id));
  const dp = new Float64Array(capacityUnits + 1).fill(Number.NEGATIVE_INFINITY);
  dp[0] = 0;
  const choices: Int32Array[] = [];

  for (const entry of ordered) {
    const next = new Float64Array(capacityUnits + 1).fill(Number.NEGATIVE_INFINITY);
    const choice = new Int32Array(capacityUnits + 1).fill(-1);
    for (let unit = 0; unit <= capacityUnits; unit += 1) {
      if (!Number.isFinite(dp[unit])) continue;
      if (dp[unit] > next[unit] + 1e-12) {
        next[unit] = dp[unit];
        choice[unit] = -1;
      }
      const nextUnit = unit + entry.units;
      if (nextUnit <= capacityUnits) {
        const value = dp[unit] + entry.value;
        if (value > next[nextUnit] + 1e-12) {
          next[nextUnit] = value;
          choice[nextUnit] = 1;
        }
      }
    }
    choices.push(choice);
    dp.set(next);
  }

  let bestUnit = 0;
  for (let unit = 1; unit <= capacityUnits; unit += 1) {
    if (dp[unit] > dp[bestUnit] + 1e-12) bestUnit = unit;
  }
  const selected: ContextItem[] = [];
  let cursor = bestUnit;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (cursor < 0) break;
    if (choices[index][cursor] === 1) {
      selected.push(ordered[index].item);
      cursor -= ordered[index].units;
    }
  }
  const selectedIds = new Set(selected.map((item) => item.id));
  for (const entry of ordered) {
    if (!selectedIds.has(entry.item.id)) excluded.push({ id: entry.item.id, reason: 'low-importance' });
  }
  for (const entry of ordered) {
    if (entry.units > capacityUnits) {
      const index = excluded.findIndex((row) => row.id === entry.item.id && row.reason === 'low-importance');
      if (index >= 0) excluded[index] = { id: entry.item.id, reason: 'over-budget' };
    }
  }

  const items = [...request.mandatory, ...selected.slice().sort((a, b) => a.id.localeCompare(b.id))];
  const estimatedTokens =
    prefixTokens + items.reduce((sum, item) => sum + estimateItemTokens(item), 0);
  const result: ContextPack = {
    ok: true,
    taskId: request.taskId,
    items,
    excluded,
    estimatedTokens,
    mandatoryTokens,
    prefixHash,
    cachePrefixStable: request.expectedPrefixHash ? request.expectedPrefixHash === prefixHash : true,
    pageRank: { converged: pageRankResult.converged, iterations: pageRankResult.iterations },
    degraded: !pageRankResult.converged,
  };
  return ContextPackSchema.parse(result);
}

export { estimateItemTokens, KIND_WEIGHTS };
export const CPO_PAGE_RANK = { damping: DAMPING, maxIterations: MAX_ITERATIONS, tolerance: DELTA } as const;
export const CPO_CLAMP = clamp;
