// W6-AUD-04 capability auditor — READ-ONLY event vocabulary parity probe.
// Derives emitted types from source and subscribed types from the client list.
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir, ext = /\.ts$/) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(entry.name)) out.push(p);
  }
  return out;
};

// 1. emitted: emitEvent(runId, 'type', ...)
const emitted = new Map();
for (const file of walk('src/server')) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /emitEvent\(\s*[^,]+,\s*'([^']+)'/g;
  for (const m of text.matchAll(re)) {
    const list = emitted.get(m[1]) ?? [];
    if (!list.includes(file)) list.push(file);
    emitted.set(m[1], list);
  }
}

// 2. subscribed: STREAM_EVENT_TYPES array in useApi.ts
const useApi = fs.readFileSync('web/src/hooks/useApi.ts', 'utf8');
const block = useApi.match(/const STREAM_EVENT_TYPES = \[([\s\S]*?)\];/);
const subscribed = block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

// 3. payload field consumption in web/src (event.* accesses)
const webFiles = walk('web/src', /\.tsx?$/);
const eventFieldReads = [];
for (const file of webFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bevent\.(\w+)/g)) eventFieldReads.push({ file: path.relative('.', file), field: m[1] });
}

const emittedTypes = [...emitted.keys()].sort();
const overlap = emittedTypes.filter((t) => subscribed.includes(t));
const emittedNotSubscribed = emittedTypes.filter((t) => !subscribed.includes(t));
const subscribedNotEmitted = subscribed.filter((t) => !emittedTypes.includes(t));

console.log(JSON.stringify({
  emittedCount: emittedTypes.length,
  emittedTypes,
  emittedSites: Object.fromEntries(emittedTypes.map((t) => [t, emitted.get(t).map((f) => path.relative('.', f))])),
  subscribedCount: subscribed.length,
  overlapCount: overlap.length,
  overlap,
  emittedNotSubscribed,
  subscribedNotEmitted,
  eventFieldReads: [...new Set(eventFieldReads.map((r) => `${r.field}`))].sort(),
  eventFieldReadSites: eventFieldReads,
}, null, 2));
