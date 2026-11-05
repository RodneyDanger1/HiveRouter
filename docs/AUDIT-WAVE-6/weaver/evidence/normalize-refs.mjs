import fs from 'node:fs';
const files = ['controls.json', 'traces.json', 'payloads.json'];
const prefix = (s) => (/^(browser|screens|api|logs)\//.test(s) ? `evidence/${s}` : s);
const walk = (v) => {
  if (typeof v === 'string') return prefix(v);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  return v;
};
for (const f of files) {
  const p = `docs/AUDIT-WAVE-6/weaver/${f}`;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  fs.writeFileSync(p, JSON.stringify(walk(j), null, 2));
  console.log(f, 'normalized', fs.statSync(p).size);
}
