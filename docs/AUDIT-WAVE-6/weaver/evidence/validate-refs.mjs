import fs from 'node:fs';
import path from 'node:path';
const root = 'docs/AUDIT-WAVE-6/weaver';
const files = ['controls.json', 'traces.json', 'payloads.json', 'findings.md'];
const refs = new Set();
const collect = (v) => {
  if (typeof v === 'string') {
    for (const m of v.matchAll(/(evidence\/[A-Za-z0-9_.\-/]+)/g)) refs.add(m[1]);
  } else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
for (const f of files) {
  const p = path.join(root, f);
  const text = fs.readFileSync(p, 'utf8');
  if (f.endsWith('.json')) collect(JSON.parse(text));
  else for (const m of text.matchAll(/(evidence\/[A-Za-z0-9_.\-/]+)/g)) refs.add(m[1]);
}
const missing = [...refs].filter((r) => !fs.existsSync(path.join(root, r)) && !fs.existsSync(path.join(root, r.replace(/[.,;]$/, ''))));
console.log('refs', refs.size, 'missing', missing.length);
console.log(missing.join('\n'));
