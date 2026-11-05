/**
 * CCR — capability-constrained, cost-aware, DAG router (P6a R1).
 *
 * Pure: no network, database, filesystem or clock. The route seed comes from
 * the policy version/id, never from a run id, so the same tasks + policy route
 * identically across runs.
 */
import {
  AgentCapability,
  AlgorithmRefusal,
  CandidateOption,
  DEFAULT_MODEL_PROFILES,
  FileTask,
  ModelProfile,
  ROUTE_WEIGHT_PRESETS,
  RoutePolicy,
  RouteRequest,
  RouteRequestSchema,
  RouteResult,
  RouteResultSchema,
  TaskRoute,
  clamp,
  isSafeRelativePath,
  matchesAnyPathGlob,
  normalizeLanguage,
  shortHash,
  sha256Hex,
  RISK_HINT_WEIGHTS,
  RISK_PATH_WEIGHTS,
} from '../../shared/algorithms';

const PROMPT_OVERHEAD_TOKENS = 2048;
const EPS = 1e-9;
const MAX_DP_CAPACITY = 1_000_000;

const REFUSAL_PRECEDENCE: Record<AlgorithmRefusal['code'], number> = {
  E_DAG_CYCLE_DETECTED: 0,
  E_MISSING_DEPENDENCY: 1,
  E_ALL_CANDIDATES_DISABLED: 2,
  E_NO_CAPABLE_AGENT: 3,
  E_RISK_UNVERIFIABLE: 4,
  E_POLICY_BLOCKED: 5,
  E_CONTEXT_INFEASIBLE: 6,
  E_ROUTE_BUDGET_INFEASIBLE: 7,
  E_FSN_CLUSTER_LIMIT: 99,
  E_REPAIR_STALLED: 99,
  E_REPAIR_BUDGET_EXHAUSTED: 99,
  E_VERIFY_TOOL_UNAVAILABLE: 99,
  E_CONFIDENCE_ABSTAIN: 99,
  E_BUDGET_EXCEEDED: 99,
  E_BUDGET_UNKNOWN_RESERVATION: 99,
  E_RETRY_INFEASIBLE: 99,
  E_KEY_INVALID: 99,
  E_BALANCE_LOW: 99,
};

function orderedRefusals(refusals: AlgorithmRefusal[]): AlgorithmRefusal[] {
  return refusals.slice().sort((a, b) => REFUSAL_PRECEDENCE[a.code] - REFUSAL_PRECEDENCE[b.code]);
}

interface DagInfo {
  order: FileTask[];
  critical: Set<string>;
}

interface OptionBuild {
  option: CandidateOption;
  rawCostUsd: number;
  rawLatencyMs: number;
}

function refusal(
  code: AlgorithmRefusal['code'],
  message: string,
  details: Record<string, unknown> = {},
  taskId?: string,
): AlgorithmRefusal {
  return { code, message, details, ...(taskId ? { taskId } : {}) };
}

function fallbackPreset(policy: RoutePolicy): RoutePolicy {
  if (policy.weights) return policy;
  return { ...policy, weights: ROUTE_WEIGHT_PRESETS[policy.preset] };
}

function outputKindForTask(): 'files' {
  return 'files';
}

function pathMatches(path: string, globs: string[]): boolean {
  return matchesAnyPathGlob(path, globs);
}

function agentSupportsLanguage(agent: AgentCapability, language: string): boolean {
  const target = normalizeLanguage(language);
  if (agent.languages.includes('*')) return true;
  return agent.languages.some((declared) => normalizeLanguage(declared) === target);
}

function agentMatchesTask(agent: AgentCapability, task: FileTask): boolean {
  if (!agent.outputKinds.includes(outputKindForTask())) return false;
  if (!agent.canWrite) return false;
  if (!agentSupportsLanguage(agent, task.language)) return false;
  if (!pathMatches(task.path, agent.pathGlobs)) return false;
  return true;
}

function hasRequiredOutput(agent: AgentCapability): boolean {
  return agent.outputKinds.includes('files') && agent.canWrite;
}

function riskScore(task: FileTask): number {
  let risk = 0;
  for (const hint of task.riskHints) risk += RISK_HINT_WEIGHTS[hint.toLowerCase()] ?? 0;
  for (const [pattern, weight] of RISK_PATH_WEIGHTS) {
    if (pattern.test(task.path)) risk += weight;
  }
  if (task.requiredChecks.some((check) => check === 'secret.scan' || check === 'path.safety')) {
    risk += 0.1;
  }
  return clamp(risk, 0, 1);
}

function estimatePromptTokens(task: FileTask): number {
  return Math.max(256, Math.ceil(task.estimatedBytes / 4) + PROMPT_OVERHEAD_TOKENS);
}

function buildDag(tasks: FileTask[]): { dag?: DagInfo; refusal?: AlgorithmRefusal } {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (byId.size !== tasks.length) {
    return { refusal: refusal('E_POLICY_BLOCKED', 'Duplicate task ids are not routable.') };
  }
  for (const task of tasks) {
    for (const dep of task.deps) {
      if (!byId.has(dep)) {
        return {
          refusal: refusal('E_MISSING_DEPENDENCY', `Task ${task.id} depends on unknown task ${dep}.`, {
            taskId: task.id,
            dependency: dep,
          }),
        };
      }
    }
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const task of tasks) indegree.set(task.id, 0);
  for (const task of tasks) {
    for (const dep of task.deps) {
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      const list = dependents.get(dep) ?? [];
      list.push(task.id);
      dependents.set(dep, list);
    }
  }

  const ready = tasks.filter((task) => indegree.get(task.id) === 0).map((task) => task.id).sort();
  const order: FileTask[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    const task = byId.get(id);
    if (task) order.push(task);
    for (const next of (dependents.get(id) ?? []).sort()) {
      const value = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, value);
      if (value === 0) ready.push(next);
    }
    ready.sort();
  }

  if (order.length !== tasks.length) {
    return {
      refusal: refusal('E_DAG_CYCLE_DETECTED', 'The file dependency graph contains a cycle.', {
        taskIds: tasks.filter((task) => !order.some((row) => row.id === task.id)).map((task) => task.id),
      }),
    };
  }

  const depth = new Map<string, number>();
  for (const task of order) {
    depth.set(task.id, 0);
    for (const dep of task.deps) depth.set(task.id, Math.max(depth.get(task.id) ?? 0, (depth.get(dep) ?? 0) + 1));
  }
  const height = new Map<string, number>();
  const reverse = [...order].reverse();
  for (const task of reverse) {
    height.set(task.id, 0);
    for (const dependent of dependents.get(task.id) ?? []) {
      height.set(task.id, Math.max(height.get(task.id) ?? 0, (height.get(dependent) ?? 0) + 1));
    }
  }
  const longest = Math.max(...order.map((task) => (depth.get(task.id) ?? 0) + (height.get(task.id) ?? 0)));
  const critical = new Set(
    order
      .filter((task) => (depth.get(task.id) ?? 0) + (height.get(task.id) ?? 0) === longest)
      .map((task) => task.id),
  );
  return { dag: { order, critical } };
}

function requiredClosure(tasks: FileTask[]): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const closure = new Set<string>();
  const visit = (id: string): void => {
    if (closure.has(id)) return;
    closure.add(id);
    const task = byId.get(id);
    if (!task) return;
    for (const dep of task.deps) visit(dep);
  };
  for (const task of tasks) if (task.required) visit(task.id);
  return closure;
}

function candidateKey(option: CandidateOption): string {
  return `${option.agentId}|${option.model}|${option.thinking}|${option.effort ?? '-'}`;
}

function buildOptions(
  task: FileTask,
  agents: AgentCapability[],
  modelProfiles: ModelProfile[],
  policy: RoutePolicy,
  seed: string,
  critical: Set<string>,
): { options: CandidateOption[]; contextRejected: number; riskRejected: number } {
  const raw: OptionBuild[] = [];
  const risk = riskScore(task);
  let contextRejected = 0;
  let riskRejected = 0;

  for (const agent of agents) {
    for (const profile of modelProfiles) {
      if (policy.requireJsonForStructured && !profile.supportsJson) continue;
      if (!policy.allowThinkingDowngrade && profile.thinking === 'disabled') continue;
      const maxOutputTokens = Math.min(agent.maxOutputTokens, profile.maxOutputTokens);
      if (maxOutputTokens < 64) continue;
      const promptTokens = estimatePromptTokens(task);
      const outputTokens = Math.min(maxOutputTokens, Math.max(256, Math.ceil(task.estimatedBytes / 4)));
      if (promptTokens + outputTokens > profile.contextTokens) {
        contextRejected += 1;
        continue;
      }
      if (risk >= policy.riskThreshold && agent.verificationSupport === 'unverified') {
        riskRejected += 1;
        continue;
      }
      const quality = clamp(agent.staticPrior + profile.qualityDelta, 0, 1);
      const costUsd =
        (promptTokens / 1_000_000) * profile.inputUsdPerMTok +
        (outputTokens / 1_000_000) * profile.outputUsdPerMTok;
      const optionRank = shortHash(`${seed}:${task.id}:${agent.agentId}|${profile.model}|${profile.thinking}|${profile.effort ?? '-'}`, 24);
      raw.push({
        rawCostUsd: costUsd,
        rawLatencyMs: profile.latencyMs,
        option: {
          agentId: agent.agentId,
          model: profile.model,
          thinking: profile.thinking,
          ...(profile.effort ? { effort: profile.effort } : {}),
          quality,
          qualitySource: 'prior',
          sampleSize: 0,
          costUsd,
          costMicroUsd: Math.ceil(costUsd * 1_000_000),
          latencyMs: profile.latencyMs,
          contextFit: clamp(1 - (promptTokens + outputTokens) / profile.contextTokens, 0, 1),
          risk,
          score: 0,
          criticalPath: critical.has(task.id) ? 1 : 0,
          rankKey: optionRank,
        },
      });
    }
  }

  if (raw.length === 0) return { options: [], contextRejected, riskRejected };

  const options = raw.map(({ option }) => {
    // Use the policy's constant normalizers. Per-task min-max normalization
    // collapses small cost differences into a full 0..1 range and lets the
    // cheapest model dominate regardless of budget.
    const costNorm = clamp(option.costUsd / Math.max(1e-9, policy.weights.costNormUsd), 0, 1);
    const latencyNorm = clamp(option.latencyMs / Math.max(1, policy.weights.latencyNormMs), 0, 1);
    const score =
      option.quality * policy.weights.qualityWeight * (1 + policy.weights.criticalPathFactor * option.criticalPath) -
      policy.weights.wC * costNorm -
      policy.weights.wL * latencyNorm -
      policy.weights.wR * option.risk * (1 - option.quality);
    return { ...option, score };
  });
  options.sort(
    (a, b) =>
      a.rankKey.localeCompare(b.rankKey) ||
      a.agentId.localeCompare(b.agentId) ||
      a.model.localeCompare(b.model) ||
      a.thinking.localeCompare(b.thinking) ||
      (a.effort ?? '').localeCompare(b.effort ?? ''),
  );
  return { options, contextRejected, riskRejected };
}

function selectExact(
  tasks: FileTask[],
  optionsByTask: Map<string, CandidateOption[]>,
  skippable: Set<string>,
  capacityMicro: number,
): { selections: Map<string, CandidateOption | null>; utility: number } | null {
  if (capacityMicro < 0) return null;
  // Above the exact-DP ceiling, quantize costs upward. The post-DP actual-cost
  // assertion remains authoritative, so quantization can only be conservative:
  // it may reject a marginal route, never publish one above the cap.
  const quantum = capacityMicro > MAX_DP_CAPACITY
    ? Math.ceil(capacityMicro / MAX_DP_CAPACITY)
    : 1;
  const capacity = Math.floor(capacityMicro / quantum);
  const costUnits = (option: CandidateOption): number => Math.ceil(option.costMicroUsd / quantum);
  const choices: Int32Array[] = [];
  let prev = new Float64Array(capacity + 1).fill(Number.NEGATIVE_INFINITY);
  prev[0] = 0;
  let reachable: number[] = [0];

  for (const task of tasks) {
    const options = optionsByTask.get(task.id) ?? [];
    const canSkip = skippable.has(task.id);
    if (!canSkip && options.length === 0) return null;
    const next = new Float64Array(capacity + 1).fill(Number.NEGATIVE_INFINITY);
    const choice = new Int32Array(capacity + 1).fill(-1);
    const flags = new Uint8Array(capacity + 1);

    for (const budget of reachable) {
      const base = prev[budget];
      if (!Number.isFinite(base)) continue;
      for (let index = 0; index < options.length; index += 1) {
        const option = options[index];
        const nextBudget = budget + costUnits(option);
        if (nextBudget > capacity) continue;
        const value = base + option.score;
        if (value > next[nextBudget] + EPS || (Math.abs(value - next[nextBudget]) <= EPS && (choice[nextBudget] === -1 || index < choice[nextBudget]))) {
          next[nextBudget] = value;
          choice[nextBudget] = index;
          flags[nextBudget] = 1;
        }
      }
      if (canSkip) {
        if (base > next[budget] + EPS) {
          next[budget] = base;
          choice[budget] = -1;
          flags[budget] = 1;
        } else if (Math.abs(base - next[budget]) <= EPS && choice[budget] === -1) {
          flags[budget] = 1;
        }
      }
    }

    const nextReachable: number[] = [];
    for (let budget = 0; budget <= capacity; budget += 1) {
      if (flags[budget] === 1) nextReachable.push(budget);
    }
    if (nextReachable.length === 0) return null;
    choices.push(choice);
    prev = next;
    reachable = nextReachable;
  }

  let bestBudget = -1;
  let bestUtility = Number.NEGATIVE_INFINITY;
  for (const budget of reachable) {
    if (prev[budget] > bestUtility + EPS) {
      bestUtility = prev[budget];
      bestBudget = budget;
    }
  }
  if (bestBudget < 0) return null;

  const selections = new Map<string, CandidateOption | null>();
  let budget = bestBudget;
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index];
    const choice = choices[index][budget];
    if (choice === -1) {
      selections.set(task.id, null);
      continue;
    }
    const option = (optionsByTask.get(task.id) ?? [])[choice];
    if (!option) return null;
    selections.set(task.id, option);
    budget -= costUnits(option);
  }
  return { selections, utility: bestUtility };
}

export function routeTasks(raw: unknown): RouteResult {
  const parsed = RouteRequestSchema.parse(raw) as RouteRequest;
  const policy = fallbackPreset(parsed.policy);
  const seed = sha256Hex(`${policy.policyVersion}:${policy.routePolicyId}`);
  const reserveUsd =
    Math.ceil(Math.round(policy.budgetUsd * 1_000_000) * policy.reserveRatio) / 1_000_000;
  const allocatableUsd = Math.max(0, policy.budgetUsd - reserveUsd);
  const baseResult = {
    ok: false,
    seed,
    routes: [] as TaskRoute[],
    skippedTasks: [] as string[],
    refusals: [] as AlgorithmRefusal[],
    allocatedCostUsd: 0,
    reserveUsd,
    allocatableUsd,
    decisionIds: [] as string[],
    criticalPath: [] as string[],
    constraints: {
      policyVersion: policy.policyVersion,
      routePolicyId: policy.routePolicyId,
      preset: policy.preset,
      budgetUsd: policy.budgetUsd,
      reserveUsd,
      allocatableUsd,
      maxFiles: policy.maxFiles,
      weights: policy.weights,
    },
  };

  if (parsed.tasks.length > policy.maxFiles) {
    return RouteResultSchema.parse({
      ...baseResult,
      refusals: [
        refusal('E_POLICY_BLOCKED', `Task count ${parsed.tasks.length} exceeds policy maxFiles ${policy.maxFiles}.`, {
          taskCount: parsed.tasks.length,
          maxFiles: policy.maxFiles,
        }),
      ],
    });
  }

  const { dag, refusal: dagRefusal } = buildDag(parsed.tasks);
  if (!dag || dagRefusal) {
    return RouteResultSchema.parse({ ...baseResult, refusals: dagRefusal ? [dagRefusal] : [] });
  }

  const closure = requiredClosure(parsed.tasks);
  const skippable = new Set(
    parsed.tasks.filter((task) => !task.required && !closure.has(task.id)).map((task) => task.id),
  );
  const modelProfiles = parsed.modelProfiles.length > 0 ? parsed.modelProfiles : [...DEFAULT_MODEL_PROFILES];

  const optionsByTask = new Map<string, CandidateOption[]>();
  const refusals: AlgorithmRefusal[] = [];

  for (const task of dag.order) {
    if (!isSafeRelativePath(task.path)) {
      refusals.push(refusal('E_POLICY_BLOCKED', `Unsafe task path: ${task.path}`, { path: task.path }, task.id));
      continue;
    }
    if (task.riskHints.some((hint) => policy.blockedRiskHints.includes(hint))) {
      refusals.push(refusal('E_POLICY_BLOCKED', `Policy blocks risk hint on ${task.path}.`, { taskId: task.id }, task.id));
      continue;
    }

    const allMatching = parsed.capabilities.filter((agent) => hasRequiredOutput(agent) && agentMatchesTask(agent, task));
    const enabled = allMatching.filter((agent) => agent.enabled);
    let eligible = enabled;
    if (task.engineHint) {
      const exact = enabled.filter((agent) => agent.agentId === task.engineHint);
      if (exact.length > 0) {
        eligible = exact;
      } else {
        const fallback = enabled.filter((agent) => agent.fallbackFor.includes(task.engineHint as string));
        if (fallback.length > 0) {
          eligible = fallback;
        } else {
          const polyglot = enabled.filter((agent) => agent.agentId === 'polyglot-engine');
          if (polyglot.length > 0) eligible = polyglot;
        }
      }
    }

    if (eligible.length === 0) {
      if (allMatching.length > 0 && allMatching.every((agent) => !agent.enabled)) {
        refusals.push(
          refusal('E_ALL_CANDIDATES_DISABLED', `All candidates for ${task.path} are disabled.`, {
            considered: allMatching.map((agent) => agent.agentId),
          }, task.id),
        );
      } else {
        refusals.push(
          refusal('E_NO_CAPABLE_AGENT', `No enabled agent can write ${task.path} (${task.language}).`, {
            language: task.language,
            outputKind: outputKindForTask(),
            considered: allMatching.map((agent) => agent.agentId),
          }, task.id),
        );
      }
      continue;
    }

    if (riskScore(task) >= policy.riskThreshold && eligible.every((agent) => agent.verificationSupport === 'unverified')) {
      refusals.push(
        refusal('E_RISK_UNVERIFIABLE', `High-risk task ${task.path} has no verifiable candidate.`, {
          risk: riskScore(task),
          considered: eligible.map((agent) => agent.agentId),
        }, task.id),
      );
      continue;
    }

    const built = buildOptions(task, eligible, modelProfiles, policy, seed, dag.critical);
    if (built.options.length === 0) {
      if (skippable.has(task.id)) {
        optionsByTask.set(task.id, []);
        continue;
      }
      const code: AlgorithmRefusal['code'] =
        built.contextRejected > 0 ? 'E_CONTEXT_INFEASIBLE' : built.riskRejected > 0 ? 'E_RISK_UNVERIFIABLE' : 'E_NO_CAPABLE_AGENT';
      refusals.push(refusal(code, `No viable candidate for ${task.path}.`, {
        contextRejected: built.contextRejected,
        riskRejected: built.riskRejected,
      }, task.id));
      continue;
    }
    optionsByTask.set(task.id, built.options);
  }

  if (refusals.length > 0) {
    return RouteResultSchema.parse({ ...baseResult, refusals: orderedRefusals(refusals) });
  }

  const capacityMicro = Math.floor(allocatableUsd * 1_000_000);
  const selected = selectExact(dag.order, optionsByTask, skippable, capacityMicro);
  if (!selected) {
    const cheapest = dag.order.reduce((sum, task) => {
      if (!closure.has(task.id)) return sum;
      const options = optionsByTask.get(task.id) ?? [];
      return sum + (options.length > 0 ? Math.min(...options.map((option) => option.costUsd)) : 0);
    }, 0);
    return RouteResultSchema.parse({
      ...baseResult,
      refusals: [
        refusal('E_ROUTE_BUDGET_INFEASIBLE', 'No route fits the allocatable budget.', {
          budgetUsd: policy.budgetUsd,
          reserveUsd,
          allocatableUsd,
          cheapestRequiredUsd: Number(cheapest.toFixed(6)),
          shortfallUsd: Number(Math.max(0, cheapest - allocatableUsd).toFixed(6)),
        }),
      ],
    });
  }

  const routes: TaskRoute[] = [];
  const skippedTasks: string[] = [];
  for (const task of dag.order) {
    const option = selected.selections.get(task.id) ?? null;
    if (!option) {
      skippedTasks.push(task.id);
      continue;
    }
    routes.push({
      taskId: task.id,
      agentId: option.agentId,
      model: option.model,
      thinking: option.thinking,
      ...(option.effort ? { effort: option.effort } : {}),
      quality: option.quality,
      qualitySource: 'prior',
      sampleSize: 0,
      score: option.score,
      costUsd: option.costUsd,
      latencyMs: option.latencyMs,
      rankKey: option.rankKey,
      criticalPath: option.criticalPath,
      candidates: (optionsByTask.get(task.id) ?? []).slice(),
    });
  }

  const allocatedCostUsd = routes.reduce((sum, route) => sum + route.costUsd, 0);
  if (allocatedCostUsd > allocatableUsd + 1e-6) {
    return RouteResultSchema.parse({
      ...baseResult,
      refusals: [
        refusal('E_ROUTE_BUDGET_INFEASIBLE', 'Post-DP actual cost exceeded the allocatable budget.', {
          allocatedCostUsd,
          allocatableUsd,
        }),
      ],
    });
  }

  const decisionIds = routes.map((route) => shortHash(`${seed}:${route.taskId}`, 16));
  return RouteResultSchema.parse({
    ...baseResult,
    ok: true,
    routes,
    skippedTasks,
    allocatedCostUsd: Number(allocatedCostUsd.toFixed(6)),
    decisionIds,
    criticalPath: [...dag.critical].sort(),
  });
}

export { candidateKey };
