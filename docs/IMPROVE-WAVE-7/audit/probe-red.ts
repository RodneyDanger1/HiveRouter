/**
 * Wave 7 RED reproduction on a clean copy of the pre-fix recorder.
 * red-copy-recorder.ts is the byte-identical backup body (docs/IMPROVE-WAVE-7/
 * backup/src/server/runs/recorder.ts, sha256 83223417…) with only the four
 * relative import specifiers rewritten to point at the same product modules.
 * It never touches the production DB: initDb(':memory:').
 */
import { closeDb, initDb } from '../../../src/server/db/database.js';
import { createRunRow, getRun, updateRun } from './red-copy-recorder.js';

initDb(':memory:', 'B2');

function makeRun(id: string): void {
  createRunRow({
    id,
    brief: 'wave-7 RED probe',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: `workspace/runs/${id}`,
  });
}

const results: Array<Record<string, unknown>> = [];

// RED 1: old updateRun lets a terminal run move back to running.
makeRun('red_terminal');
updateRun('red_terminal', { status: 'running' });
updateRun('red_terminal', { status: 'completed', phase: 'done' });
try {
  updateRun('red_terminal', { status: 'running' });
  results.push({
    case: 'RED pre-fix: completed->running',
    outcome: 'NO-THROW (defect reproduced)',
    row: getRun('red_terminal'),
  });
} catch (error) {
  results.push({ case: 'RED pre-fix: completed->running', outcome: 'threw (unexpected for old code)', message: (error as Error).message });
}

// RED 2: old updateRun lets queued jump straight to completed.
makeRun('red_skip');
try {
  updateRun('red_skip', { status: 'completed' });
  results.push({
    case: 'RED pre-fix: queued->completed',
    outcome: 'NO-THROW (defect reproduced)',
    row: getRun('red_skip'),
  });
} catch (error) {
  results.push({ case: 'RED pre-fix: queued->completed', outcome: 'threw (unexpected for old code)', message: (error as Error).message });
}

closeDb();
console.log(JSON.stringify({ probe: 'RED on pre-fix recorder copy', results }, null, 2));
