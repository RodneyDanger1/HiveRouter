/**
 * Forge W6 static data-flow probe for the live->terminal Events tab.
 * Reads the real source lines (no execution of product code, no mocks) and
 * evaluates the shipped selector expression against the states it can receive.
 * Also records the prior-fix claim and the existing e2e coverage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const REPO = path.resolve(FORGE, '..', '..', '..');

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').split('\n');
const pick = (rel, from, to) => read(rel).slice(from - 1, to).map((text, index) => ({ line: from + index, text }));

const page = 'web/src/pages/RunDetailPage.tsx';
const out = {
  capturedAt: new Date().toISOString(),
  source: {
    resetOnRunId: pick(page, 116, 119),
    persistedFetch: pick(page, 129, 132),
    selector: pick(page, 133, 133),
    streamHook: pick(page, 135, 139),
    eventsHeading: pick(page, 1007, 1013),
  },
  dynamicImport: pick(page, 48, 48),
  priorFixClaim: pick('docs/TRACE/20261103T2200Z/03-forgewright-fixes.md', 82, 82),
  priorFixReceipt: pick('docs/TRACE/20261103T2200Z/fixes/trace-06.md', 4, 5),
  e2eCoverage: pick('e2e/trace-fixes.spec.ts', 4, 23),
};

// The shipped expression is `events.length > 0 ? events : persistedEvents.data ?? []`.
// Evaluate it for the two reachable terminal states: fresh terminal load and
// watched-live-then-terminal.
const selector = (live, persisted) => (live.length > 0 ? live : (persisted ?? []));
const persisted108 = Array.from({ length: 108 }, (_, index) => ({ type: index % 2 ? 'phase.started' : 'agent.started', receivedAt: 'persisted' }));
const liveAfterCap = Array.from({ length: 100 }, (_, index) => ({ type: 'agent.started', receivedAt: 'live' }));
out.selectorTruthTable = [
  {
    state: 'fresh terminal load (events=[])',
    inputs: { live: 0, persisted: 108 },
    visible: selector([], persisted108).length,
    usesPersisted: selector([], persisted108) === persisted108,
  },
  {
    state: 'watched live to terminal (events capped at 100)',
    inputs: { live: 100, persisted: 108 },
    visible: selector(liveAfterCap, persisted108).length,
    usesPersisted: selector(liveAfterCap, persisted108) === persisted108,
    missingRows: persisted108.length - selector(liveAfterCap, persisted108).length,
    headingWouldBe: 'Persisted events (terminal === true)',
  },
];
out.liveBufferCap = { codeLine: 'setEvents((previous) => [...previous.slice(-99), event]);', maxRows: 100 };

// The hook closes the stream at terminal but never clears the live array.
out.streamClosedButEventsKept = out.source.streamHook.some((line) => line.text.includes('run && !terminal'))
  && out.source.resetOnRunId.every((line) => !line.text.includes('terminal'));

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, 'probe-static.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
