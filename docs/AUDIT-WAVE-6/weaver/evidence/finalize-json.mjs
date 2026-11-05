import fs from 'node:fs';
const files = ['controls.json', 'traces.json', 'payloads.json'];
const prefix = (s) => (/^(browser|screens|api|logs)\//.test(s) ? `evidence/${s}` : s);
const fix = (s) => prefix(s)
  .replace('evidence/browser/skip-probe.log', 'evidence/logs/skip-probe.log')
  .replace('"evidence/browser/system"', '"evidence/browser/pages.json"')
  .replace('evidence/browser/system', 'evidence/browser/pages.json')
  .replace('evidence/payloads.json', 'payloads.json')
  .replace('contract/evidence/prompt/adhoc form', 'contract, evidence, prompt and adhoc form');
const walk = (v) => {
  if (typeof v === 'string') return fix(v);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  return v;
};
for (const f of files) {
  const p = `docs/AUDIT-WAVE-6/weaver/${f}`;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = walk(j);
  fs.writeFileSync(p, JSON.stringify(out, null, 2), 'utf8');
  console.log(f, fs.statSync(p).size);
}
