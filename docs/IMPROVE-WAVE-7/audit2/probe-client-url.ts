/**
 * INDEPENDENT Wave 7 auditor probe — client listRuns URL construction/encoding.
 * Replaces global fetch with a recorder; no network and no server are used.
 *
 * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit2\probe-client-url.ts
 */
import { listRuns } from '../../../web/src/api.js';

const requested: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  requested.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
  return new Response(JSON.stringify({ runs: [], total: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

try {
  await listRuns(100, undefined, 'failed');
  await listRuns(100, undefined, 'all');
  await listRuns(50);
  await listRuns(10, undefined, 'completed with warnings&x=1');
  await listRuns(7, undefined, 'completed_with_warnings');
  await listRuns(100, undefined, '');
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ requested, decoded: requested.map((u) => ({ url: u, query: Object.fromEntries(new URLSearchParams(u.split('?')[1] ?? '')) })) }, null, 2));
