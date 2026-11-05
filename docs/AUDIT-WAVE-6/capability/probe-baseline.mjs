import fs from 'node:fs';
import crypto from 'node:crypto';

const lines = fs.readFileSync('docs/AUDIT-WAVE-6/baseline.sha256', 'utf8').split(/\r?\n/).filter(Boolean);
let ok = 0;
const mismatched = [];
const missing = [];
for (const line of lines) {
  const m = line.match(/^([0-9A-F]{64})\s+\*?(.+)$/);
  if (!m) continue;
  const [, expected, rel] = m;
  if (!fs.existsSync(rel)) { missing.push(rel); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(rel)).digest('hex').toUpperCase();
  if (actual === m[1]) ok += 1;
  else mismatched.push({ rel, expected, actual });
}
console.log(`baseline entries: ${lines.length}`);
console.log(`match: ${ok}`);
console.log(`mismatched: ${mismatched.length}`);
for (const m of mismatched) console.log(`  ${m.rel}\n    expected ${m.expected}\n    actual   ${m.actual}`);
console.log(`missing: ${missing.length}`);
for (const m of missing) console.log(`  ${m}`);
