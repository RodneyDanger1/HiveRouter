import fs from 'node:fs';
const p = 'docs/AUDIT-WAVE-6/weaver/findings.md';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  "- **Write scope:** only `docs/AUDIT-WAVE-6/weaver/**`. No `src/`, `web/src/`, `test/`, `e2e/`, `package.json`, config, skills, production DB, workspace, or runs were modified. No git commands.",
  "- **Write scope:** only `docs/AUDIT-WAVE-6/weaver/**`. No `src/`, `web/src/`, `test/`, `e2e/`, `package.json`, config, skills, production DB, workspace, or runs were modified. No git commands.\n- **No-write proof:** all **150/150** files inventoried in `docs/AUDIT-WAVE-6/baseline.sha256` still hash-match after the audit (SHA-256 recomputed read-only).",
);
s = s.replace(
  "- **Screenshots:** `evidence/screens/` (34: all pages, both runs, all tabs, dialogs, vault preview, filter state, parent run)",
  "- **Screenshots:** `evidence/screens/` (34: all pages, both runs, all tabs, dialogs, vault preview, filter state, parent run)\n- **No-write proof:** `docs/AUDIT-WAVE-6/baseline.sha256` re-verified read-only: 150/150 hashes match.",
);
fs.writeFileSync(p, s, 'utf8');
const clean = !/Ã|â€|Â·|Ã—/.test(s);
console.log({ bytes: Buffer.byteLength(s), clean, has150: s.includes('150/150') });
