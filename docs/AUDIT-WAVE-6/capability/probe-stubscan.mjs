// W6-AUD-04 capability auditor — READ-ONLY re-test of R-3 (stub-scan reproducibility).
// Runs the CURRENT shipped scanner against the stored abf5 staging tree. No writes.
import fs from 'node:fs';
import path from 'node:path';
import { scanText } from '../../../src/server/verify/stub-scan.ts';

const root = path.resolve('workspace/runs/run_abf5fe78aab1e932ff/.staging/attempt-1');
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(root);
let total = 0;
for (const file of files.sort()) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const findings = scanText(fs.readFileSync(file, 'utf8'), rel);
  total += findings.length;
  console.log(`${rel} -> ${findings.length}${findings.length ? ' ' + JSON.stringify(findings) : ''}`);
}
console.log(`TOTAL_FINDINGS=${total}`);
console.log(`FILES=${files.length}`);

// The historical failing line, quoted from the stored tree:
const toolAccess = path.join(root, 'src/probes/tool_access.py');
if (fs.existsSync(toolAccess)) {
  const lines = fs.readFileSync(toolAccess, 'utf8').split(/\r?\n/);
  console.log(`tool_access.py:121 = ${JSON.stringify(lines[120])}`);
}
