/**
 * File-level dominator analysis.
 *
 * This is a STATIC dependency-graph heuristic, not a control-flow graph, not
 * dynamic execution data, and not a proof that a file is critical at runtime.
 * Edges mean "from depends on to"; the explicit root is the entry file. Only
 * nodes reachable from the root receive dominator sets.
 */

export type DominatorErrorCode =
  | 'E_DOMINATOR_INVALID_ROOT'
  | 'E_DOMINATOR_INVALID_NODE'
  | 'E_DOMINATOR_INVALID_EDGE'
  | 'E_DOMINATOR_INVALID_BOUND';

export class DominatorInputError extends Error {
  readonly code: DominatorErrorCode;

  constructor(code: DominatorErrorCode, message: string) {
    super(message);
    this.name = 'DominatorInputError';
    this.code = code;
  }
}

export interface FileDependencyEdge {
  /** The depending file. */
  from: string;
  /** The file it depends on. */
  to: string;
}

export interface DominatorInput {
  /** Explicit entry file. */
  root: string;
  /** Optional explicit node set; inferred from root + edges when omitted. */
  nodes?: readonly string[];
  edges: readonly FileDependencyEdge[];
  /** Hard bound on intersection passes; a safety valve for cycles/pathological graphs. */
  maxIterations?: number;
}

export interface DominatorAnalysis {
  /** Static-file label; never presented as dynamic or CFG evidence. */
  readonly analysis: 'static-file-dominators';
  readonly kind: 'static';
  readonly dynamic: false;
  readonly cfg: false;
  root: string;
  nodes: string[];
  edgeCount: number;
  reachable: string[];
  unreachable: string[];
  /** For each node, the sorted set of nodes on every root->node path, including itself. */
  dominators: Record<string, string[]>;
  /** Number of other reachable nodes dominated by each node (self excluded). */
  dominatedCounts: Record<string, number>;
  /** Static centrality risk in [0,1], normalized by the largest possible dominated count. */
  risk: Record<string, number>;
  /** Mean of per-node risk, useful only as a coarse static summary. */
  overallRisk: number;
  iterations: number;
  maxIterations: number;
  truncated: boolean;
}

const STATIC_LABEL = {
  analysis: 'static-file-dominators' as const,
  kind: 'static' as const,
  dynamic: false as const,
  cfg: false as const,
};

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function validateName(value: string, code: DominatorErrorCode, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DominatorInputError(code, `${field} must be a non-empty string`);
  }
}

function normalizedBound(value: number | undefined, nodeCount: number, edgeCount: number): number {
  if (value === undefined) {
    return Math.min(100_000, Math.max(64, nodeCount * nodeCount + edgeCount * 2 + 1));
  }
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new DominatorInputError('E_DOMINATOR_INVALID_BOUND', 'maxIterations must be an integer in [1, 100000]');
  }
  return value;
}

function reachableFrom(root: string, adjacency: ReadonlyMap<string, readonly string[]>): string[] {
  const visited = new Set<string>([root]);
  const queue: string[] = [root];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return [...visited].sort(compare);
}

/**
 * Compute static file-level dominators. Pure and deterministic. A cycle cannot
 * loop forever: the intersection passes are capped by maxIterations and the
 * result is marked `truncated` if the cap is reached before a fixed point.
 */
export function computeDominators(input: DominatorInput): DominatorAnalysis {
  if (!input || typeof input !== 'object') {
    throw new DominatorInputError('E_DOMINATOR_INVALID_ROOT', 'input graph is required');
  }
  validateName(input.root, 'E_DOMINATOR_INVALID_ROOT', 'root');
  if (!Array.isArray(input.edges)) {
    throw new DominatorInputError('E_DOMINATOR_INVALID_EDGE', 'edges must be an array');
  }

  const nodeSet = new Set<string>();
  if (input.nodes !== undefined) {
    if (!Array.isArray(input.nodes)) {
      throw new DominatorInputError('E_DOMINATOR_INVALID_NODE', 'nodes must be an array when provided');
    }
    for (const node of input.nodes) {
      validateName(node, 'E_DOMINATOR_INVALID_NODE', 'node');
      nodeSet.add(node);
    }
  }
  nodeSet.add(input.root);

  const adjacency = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const seenEdges = new Set<string>();
  for (const edge of input.edges) {
    if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
      throw new DominatorInputError('E_DOMINATOR_INVALID_EDGE', 'each edge must have string from/to');
    }
    validateName(edge.from, 'E_DOMINATOR_INVALID_EDGE', 'edge.from');
    validateName(edge.to, 'E_DOMINATOR_INVALID_EDGE', 'edge.to');
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);
    const key = `${edge.from}\u0000${edge.to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    const outgoing = adjacency.get(edge.from) ?? [];
    outgoing.push(edge.to);
    adjacency.set(edge.from, outgoing);
    const incoming = predecessors.get(edge.to) ?? [];
    incoming.push(edge.from);
    predecessors.set(edge.to, incoming);
  }

  if (!nodeSet.has(input.root)) {
    throw new DominatorInputError('E_DOMINATOR_INVALID_ROOT', `root ${input.root} is not a node`);
  }
  for (const edge of input.edges) {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
      throw new DominatorInputError(
        'E_DOMINATOR_INVALID_EDGE',
        `edge ${edge.from}->${edge.to} references an unknown node`,
      );
    }
  }

  const nodes = [...nodeSet].sort(compare);
  for (const list of adjacency.values()) list.sort(compare);
  for (const list of predecessors.values()) list.sort(compare);
  const reachable = reachableFrom(input.root, adjacency);
  const reachableSet = new Set(reachable);
  const unreachable = nodes.filter((node) => !reachableSet.has(node));
  const maxIterations = normalizedBound(input.maxIterations, nodes.length, seenEdges.size);

  const dominators = new Map<string, Set<string>>();
  for (const node of reachable) {
    dominators.set(node, node === input.root ? new Set([input.root]) : new Set(reachable));
  }

  let iterations = 0;
  let truncated = false;
  let changed = true;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations += 1;
    for (const node of reachable) {
      if (node === input.root) continue;
      const preds = (predecessors.get(node) ?? []).filter((pred) => reachableSet.has(pred));
      let next: Set<string>;
      if (preds.length === 0) {
        next = new Set([node]);
      } else {
        next = new Set(dominators.get(preds[0]) as Set<string>);
        for (const pred of preds.slice(1)) {
          const predSet = dominators.get(pred) as Set<string>;
          for (const candidate of [...next]) {
            if (!predSet.has(candidate)) next.delete(candidate);
          }
        }
        next.add(node);
      }
      const current = dominators.get(node) as Set<string>;
      if (next.size !== current.size || [...next].some((value) => !current.has(value))) {
        dominators.set(node, next);
        changed = true;
      }
    }
  }
  if (changed) truncated = true;

  const sortedDominators: Record<string, string[]> = {};
  for (const node of nodes) {
    sortedDominators[node] = [...(dominators.get(node) ?? new Set<string>())].sort(compare);
  }

  const dominatedCounts: Record<string, number> = {};
  for (const node of nodes) {
    const count = reachable.filter(
      (other) => other !== node && (dominators.get(other)?.has(node) ?? false),
    ).length;
    dominatedCounts[node] = count;
  }
  const denominator = Math.max(1, reachable.length - 1);
  const risk: Record<string, number> = {};
  for (const node of nodes) {
    risk[node] = Number((dominatedCounts[node] / denominator).toFixed(6));
  }
  const overallRisk =
    reachable.length === 0
      ? 0
      : Number(
          (
            reachable.reduce((sum, node) => sum + risk[node], 0) /
            reachable.length
          ).toFixed(6),
        );

  return {
    ...STATIC_LABEL,
    root: input.root,
    nodes,
    edgeCount: seenEdges.size,
    reachable,
    unreachable,
    dominators: sortedDominators,
    dominatedCounts,
    risk,
    overallRisk,
    iterations,
    maxIterations,
    truncated,
  };
}

export { STATIC_LABEL };
