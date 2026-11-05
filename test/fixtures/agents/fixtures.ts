/**
 * Schema fixtures for the agent registry. Kept separate from the tests so the
 * same valid/invalid cases can be reused by future adapter tests.
 */

export const validProjectPlan = {
  projectName: 'demo-app',
  coreParadigm: 'local-first event pipeline',
  storageTarget: 'sqlite',
  files: [
    {
      path: 'src/main.py',
      engine: 'python-engine',
      language: 'python',
      duty: 'entry point',
      deps: [],
      interfaces: ['run() -> int'],
    },
  ],
  interfaces: [{ name: 'run', input: 'argv', output: 'exit code' }],
  executionGraph: [{ step: 1, file: 'src/main.py', deps: [] }],
  risks: ['none'],
};

export const validRouterPlan = {
  kind: 'router',
  summary: 'Build a small local service.',
  useEpic: false,
  preset: 'full-build',
  suggestedAgents: ['architect', 'python-engine'],
  steps: [{ agent: 'architect', objective: 'plan the files' }],
  risks: [],
};

export const validEpicPlan = {
  kind: 'epic',
  projectName: 'demo-app',
  sprints: [
    {
      id: 'SPRINT-01',
      targetModule: 'src/main.py',
      engine: 'python-engine',
      responsibility: 'entry point',
      interfaceDependencies: [],
    },
  ],
  pipeline: [{ id: 'SPRINT-01', blocking: false, produces: 'src/main.py' }],
  risks: [],
};

export const validCartographerPlan = {
  kind: 'cartographer',
  order: [
    { step: 1, nodeId: 'main', targetFile: 'src/main.py', engine: 'python-engine', dependencies: [] },
  ],
  cycles: [],
};

export const validFileEmission = {
  path: 'src/main.py',
  language: 'python',
  content: 'def main():\n    return 0\n',
  summary: 'entry point',
  execution: 'python src/main.py',
  complete: true,
};

export const validReview = {
  verdict: 'changes_required',
  summary: 'one issue',
  findings: [{ severity: 'warn', file: 'src/main.py', issue: 'missing guard', fix: 'add guard' }],
  files: [{ path: 'src/main.py', content: 'def main():\n    return 0\n' }],
  execution: 'python src/main.py',
};

export const validTests = {
  summary: 'unit tests',
  testCommand: 'python -m unittest discover -s tests',
  files: [{ path: 'tests/test_main.py', language: 'python', content: 'import unittest\n' }],
};

export const validCandidateDraft = {
  targetAgent: 'python-engine',
  candidateType: 'prompt',
  before: 'old prompt',
  after: 'new prompt',
  rationale: 'clearer contract',
  evidenceRefs: ['run-1'],
};

export const invalidProjectPlan = {
  projectName: 'demo-app',
  coreParadigm: 'x',
  storageTarget: 'sqlite',
  files: [],
};

export const invalidRouterPlan = {
  kind: 'router',
  useEpic: false,
  preset: 'full-build',
  suggestedAgents: [],
  steps: [],
  risks: [],
};

export const invalidFileEmission = {
  path: 'src/main.py',
  language: 'python',
  content: '',
  summary: '',
  execution: '',
  complete: true,
};

export const invalidReview = {
  verdict: 'changes_required',
  summary: 'x',
  findings: [{ severity: 'blocker', file: 'src/main.py', issue: 'x', fix: 'y' }],
  files: [],
};

export const invalidTests = {
  summary: 'x',
  testCommand: 'x',
  files: [{ path: '', language: '', content: '' }],
};

export const invalidCandidateDraft = {
  targetAgent: 'python-engine',
  candidateType: 'route-policy',
  before: 'x',
  after: 'y',
  rationale: 'z',
  evidenceRefs: [],
};
