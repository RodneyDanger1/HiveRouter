// W6-AUD-04 capability auditor — READ-ONLY route/client/manifest census.
// Reads source + release manifests + live OpenAPI. Writes nothing.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const out = {};

// 1. Derive every server route registration from app.ts (and any other route file).
const appSrc = read('src/server/app.ts');
const routeRe = /app\.(get|post|put|delete|patch)\(\s*'([^']+)'/g;
const registrations = [];
for (const m of appSrc.matchAll(routeRe)) registrations.push({ method: m[1].toUpperCase(), path: m[2] });
out.appTsRegistrations = registrations.length;
out.appTsDistinctPaths = new Set(registrations.map((r) => r.path)).size;
out.methodsByPath = Object.fromEntries(
  [...new Set(registrations.map((r) => r.path))]
    .sort()
    .map((p) => [p, registrations.filter((r) => r.path === p).map((r) => r.method).sort()]),
);

// 2. p7 manifest allowlist
const p7 = JSON.parse(read('config/releases/p7.json'));
out.p7 = { routes: p7.routes.length, tables: p7.tables.length, scripts: p7.scripts.length, uiRoutes: p7.uiRoutes };

const apiManifest = p7.routes.filter((r) => r.startsWith('/api') || r === '/openapi.json');
const uiManifest = p7.routes.filter((r) => !(r.startsWith('/api') || r === '/openapi.json'));
out.p7ApiRouteStrings = apiManifest.length;
out.p7UiRouteStrings = uiManifest.length;
out.p7UiList = uiManifest;

// 3. Compare manifest vs code (normalise :param -> :param)
const norm = (s) => s.replace(/:([A-Za-z_]+)/g, ':_');
const codePaths = new Set(registrations.map((r) => norm(r.path)));
const manPaths = new Set(apiManifest.map(norm));
out.inCodeNotManifest = [...codePaths].filter((p) => !manPaths.has(p)).sort();
out.inManifestNotCode = [...manPaths].filter((p) => !codePaths.has(p)).sort();

// 4. Client calls in web/src/api.ts
const apiSrc = read('web/src/api.ts');
const callRe = /request<[^>]*>\(\s*'([^']+)'|request\(\s*'([^']+)'|api\.(get|post|put|delete)[^(]*\(\s*`([^`]+)`/g;
const clientPaths = new Set();
for (const m of apiSrc.matchAll(/'(\/api\/[^']+)'|`(\/api\/[^`]+)`/g)) {
  const raw = m[1] ?? m[2];
  if (raw) clientPaths.add(norm(raw.split('?')[0]));
}
out.clientPaths = [...clientPaths].sort();
out.clientPathsNotInCode = out.clientPaths.filter((p) => !codePaths.has(p));

// 5. Live OpenAPI
try {
  const res = await fetch('http://127.0.0.1:8787/openapi.json');
  const spec = await res.json();
  out.openapiPaths = Object.keys(spec.paths).length;
  const ops = [];
  for (const [p, methods] of Object.entries(spec.paths)) for (const m of Object.keys(methods)) ops.push(`${m.toUpperCase()} ${p}`);
  out.openapiOperations = ops.length;
} catch (e) {
  out.openapiError = String(e);
}

console.log(JSON.stringify(out, null, 2));
