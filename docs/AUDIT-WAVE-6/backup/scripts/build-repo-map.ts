/**
 * build-repo-map.ts
 * Lightweight symbol/import map for a generated run (no tree-sitter, no network).
 * Exit 0 pass, 2 usage, 3 not found, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { initDb, getDb } from '../src/server/db/database.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const runArg = args.indexOf('--run');
const runId = runArg >= 0 ? args[runArg + 1] : undefined;

function extract(rel: string, content: string) {
  const ext = path.extname(rel).toLowerCase();
  const imports: string[] = [];
  const symbols: string[] = [];
  if (ext === '.py') {
    for (const line of content.split(/\r?\n/)) {
      const imp = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/.exec(line);
      if (imp) imports.push(imp[1] ?? imp[2]);
      const def = /^\s*(?:def|class)\s+([A-Za-z_]\w*)/.exec(line);
      if (def) symbols.push(def[1]);
    }
  } else if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) {
    for (const match of content.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) imports.push(match[1] ?? match[2]);
    for (const match of content.matchAll(/\b(?:function|class|const|let|interface|type)\s+([A-Za-z_$][\w$]*)/g)) symbols.push(match[1]);
  }
  return { imports: [...new Set(imports)], symbols: [...new Set(symbols)] };
}

async function main() {
  if (!runId || runId.startsWith('--')) {
    console.error('usage: build-repo-map --run <runId> [--json]');
    process.exit(2);
  }
  initDb();
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!run) {
    console.error(`E_RUN_NOT_FOUND ${runId}`);
    process.exit(3);
  }
  const root = String(run.workspace_path);
  const MAX_FILES = 2_000;
  const MAX_BYTES = 10 * 1024 * 1024;
  const DENY_DIRS = new Set(['.git', 'node_modules', 'data', '.staging', 'coverage', '.qa-api-results']);
  const DENY_FILES = [/^\.env/i, /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|7z|exe|dll|so|dylib|bin|woff2?|ttf|otf|mp4|mov)$/i];
  const nodes: Array<Record<string, unknown>> = [];
  let totalBytes = 0;
  const walk = (dir: string, rel: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (DENY_DIRS.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, childRel);
      else if (entry.isFile()) {
        if (DENY_FILES.some((pattern) => pattern.test(entry.name))) continue;
        if (nodes.length >= MAX_FILES) throw new Error(`E_REPO_MAP_TOO_LARGE: more than ${MAX_FILES} files`);
        const size = fs.statSync(full).size;
        totalBytes += size;
        if (totalBytes > MAX_BYTES) throw new Error(`E_REPO_MAP_TOO_LARGE: more than ${MAX_BYTES} bytes`);
        const content = fs.readFileSync(full, 'utf8');
        nodes.push({ path: childRel, bytes: size, ...extract(childRel, content) });
      }
    }
  };
  walk(root, '');
  const result = { schema: 'hive.cli.v1', command: 'hive.repo-map', ok: true, runId, files: nodes.length, nodes };
  const dir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `repo-map-${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`repo-map ${runId}: ${nodes.length} files\nreport: ${reportPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
