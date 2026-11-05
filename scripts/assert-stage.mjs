#!/usr/bin/env node
// Stage allowlist enforcement for HiveRouter.
// Reads config/releases/{a,p6a,p7}.json when present; otherwise uses a conservative
// bootstrap allowlist and reports `fallback:true` with warnings for non-path checks.
// Exit 0 pass, 2 usage, 9 stage leak/internal.
import fs from 'node:fs';
import path from 'node:path';

const STAGE_ORDER = ['a', 'p6a', 'p7'];
const STAGE_LABEL = { a: 'A', p6a: 'B1', p7: 'B2' };

const A_TABLES = [
  'runs', 'steps', 'events', 'artifacts', 'reviews', 'checks', 'usage', 'settings',
  'run_snapshots', 'prompt_versions', 'policy_versions', 'budget_reservations',
  'gate_decisions', 'idempotency_keys', 'schema_migrations', 'agent_evidence',
];
const B1_TABLES = [
  'route_decisions', 'route_candidates', 'agent_stats', 'context_packs', 'context_manifests',
  'failure_signatures', 'failure_occurrences', 'verification_plans', 'confidence_records',
  'retry_attempts', 'script_runs',
];
const B2_TABLES = [
  'traces', 'repair_memory', 'variants', 'eval_suites', 'eval_cases', 'sealed_pool',
  'sealed_pool_blocks', 'suite_uses', 'eval_runs', 'eval_results', 'promotions',
  'approval_tokens', 'post_promotion_monitor', 'learning_jobs', 'learning_audit',
  'feedback', 'user_edits', 'consent_records',
];

const FALLBACK = {
  a: {
    paths: [
      'src/shared/', 'src/server/config.ts', 'src/server/index.ts', 'src/server/app.ts',
      'src/server/env.ts', 'src/server/db/', 'src/server/llm/', 'src/server/pipeline/', 'src/server/runs/',
      'src/server/routes/', 'src/server/security/', 'src/server/verify/', 'src/server/vault/',
      'src/server/agents/', 'src/server/logic/', 'web/', 'public/', 'scripts/',
      'test/', 'e2e/', 'config/', 'docs/', 'logs/', 'reports/',
      'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', '.env.example',
      'README.md', 'AGENTS.md', 'playwright.config.ts', 'vitest.config.ts',
    ],
    tables: A_TABLES,
    routes: ['/api/health', '/api/meta', '/api/settings', '/api/runs', '/api/agents', '/api/vault', '/api/stats', '/openapi.json', '/api/docs'],
    uiRoutes: ['/', '/agents', '/runs', '/vault', '/settings'],
    scripts: ['dev', 'dev:server', 'dev:web', 'build', 'start', 'typecheck', 'test', 'test:watch', 'e2e', 'preflight', 'stub-sweep', 'secret-scan', 'assert-stage', 'verify'],
  },
  p6a: {
    paths: ['src/server/routing/', 'src/server/context/', 'src/server/repair/', 'src/server/quality/', 'src/server/retry/', 'scripts/bench-suite.ts', 'scripts/replay-run.ts', 'scripts/build-repo-map.ts', 'scripts/context-pack-report.ts', 'scripts/integrity-check.ts'],
    tables: B1_TABLES,
    routes: ['/api/runs/:id/routing', '/api/runs/:id/context', '/api/runs/:id/failures', '/api/runs/:id/checks', '/api/runs/:id/confidence', '/api/runs/:id/retries', '/api/runs/:id/integrity', '/api/runs/:id/replay-check', '/api/stats/router', '/api/ops/reports/:kind', '/api/scripts'],
    uiRoutes: ['/runs/:id/routing', '/runs/:id/context', '/runs/:id/repairs', '/runs/:id/checks', '/runs/:id/confidence', '/system/ops', '/scripts'],
    scripts: ['bench', 'replay', 'repo-map', 'context:report', 'integrity'],
  },
  p7: {
    paths: ['src/server/learning/', 'web/src/pages/Learning', 'scripts/learn.ts', 'scripts/eval-router.ts', 'eval/'],
    tables: B2_TABLES,
    routes: ['/api/learning', '/api/learning/approvals'],
    uiRoutes: ['/learning'],
    scripts: ['learn', 'eval:router', 'test:live'],
  },
};

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'data', 'workspace', 'vault', 'reports', 'logs',
  'test-results', 'dist', 'web/dist', '.cache',
]);

function parseArgs(argv) {
  let stage = null;
  let root = process.cwd();
  let json = false;
  let noFallback = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    const eq = arg.indexOf('=');
    const flag = eq > 0 ? arg.slice(0, eq) : arg;
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined;
    if ((flag === '--stage') && (next || inline)) {
      stage = (inline ?? next).toLowerCase();
      if (stage === 'b1') stage = 'p6a';
      if (stage === 'b2') stage = 'p7';
      if (!inline) i += 1;
    } else if (flag === '--root' && (next || inline)) {
      root = path.resolve(inline ?? next);
      if (!inline) i += 1;
    } else if (arg === '--json') json = true;
    else if (arg === '--no-fallback') noFallback = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write('Usage: assert-stage --stage a|p6a|p7 [--root DIR] [--json] [--no-fallback]\n');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!stage || !STAGE_ORDER.includes(stage)) throw new Error('--stage must be a|p6a|p7');
  return { stage, root, json, noFallback };
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string').map((v) => v.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, ''));
}

function readManifest(root, stage) {
  const file = path.join(root, 'config', 'releases', `${stage}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    paths: normalizeList(raw.paths ?? raw.files ?? raw.sourcePaths),
    tables: normalizeList(raw.tables ?? raw.dbTables),
    routes: normalizeList(raw.routes ?? raw.apiRoutes),
    uiRoutes: normalizeList(raw.uiRoutes ?? raw.nav ?? raw.pages),
    scripts: normalizeList(raw.scripts ?? raw.packageScripts),
  };
}

function cumulativeManifest(root, stage, noFallback) {
  const wanted = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(stage) + 1);
  const manifests = [];
  const warnings = [];
  let fallback = false;
  for (const item of wanted) {
    const manifest = readManifest(root, item);
    if (manifest) {
      manifests.push({ stage: item, ...manifest });
      continue;
    }
    if (noFallback) {
      throw new Error(`missing manifest config/releases/${item}.json`);
    }
    fallback = true;
    warnings.push({ code: 'STAGE_MANIFEST_MISSING', message: `using fallback allowlist for ${item}` });
    manifests.push({ stage: item, ...FALLBACK[item], fallback: true });
  }
  const merged = { paths: [], tables: [], routes: [], uiRoutes: [], scripts: [] };
  for (const manifest of manifests) {
    for (const key of Object.keys(merged)) merged[key].push(...manifest[key]);
  }
  return { manifests, merged, fallback, warnings };
}

function listFiles(root, dirs) {
  const out = [];
  function walk(target) {
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) {
        if (SKIP_DIRS.has(entry)) continue;
        walk(path.join(target, entry));
      }
      return;
    }
    if (stat.isFile()) out.push(path.relative(root, target).replace(/\\/g, '/'));
  }
  for (const dir of dirs) walk(path.join(root, dir));
  return out;
}

function allowedPath(relative, patterns) {
  if (relative === 'package.json' || relative === 'package-lock.json') return true;
  if (relative.startsWith('config/releases/')) return true;
  return patterns.some((pattern) => {
    if (pattern.endsWith('/**')) return relative.startsWith(pattern.slice(0, -3) + '/');
    if (pattern.endsWith('/')) return relative.startsWith(pattern);
    return relative === pattern || relative.startsWith(`${pattern}/`);
  });
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return '';
  }
}

function readRouteStrings(root) {
  const dirs = ['src/server/routes', 'src/server/app.ts', 'web/src'];
  const files = [];
  for (const dir of dirs) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    if (fs.statSync(absolute).isFile()) files.push(absolute);
    else for (const file of listFiles(root, [dir])) files.push(path.join(root, file));
  }
  const routes = new Set();
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
    const text = readText(file);
    for (const m of text.matchAll(/(?:\.(?:get|post|put|delete|patch)|route)\(\s*['"`](\/[^'"`]+)/g)) routes.add(m[1]);
    for (const m of text.matchAll(/path=["'](\/[^"']+)["']/g)) routes.add(m[1]);
  }
  return [...routes].sort();
}

function readTableNames(root) {
  const file = path.join(root, 'src', 'server', 'db', 'migrations.ts');
  const text = readText(file);
  const names = new Set();
  for (const m of text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/gi)) names.add(m[1]);
  return [...names].sort();
}

function readPackageScripts(root) {
  const raw = readText(path.join(root, 'package.json'));
  if (!raw.trim()) throw new Error('E_STAGE_PACKAGE_UNREADABLE: package.json is missing or empty');
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch (error) {
    throw new Error(`E_STAGE_PACKAGE_UNREADABLE: ${error instanceof Error ? error.message : String(error)}`);
  }
  return Object.keys(pkg.scripts ?? {}).sort();
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}

try {
  const { manifests, merged, fallback, warnings } = cumulativeManifest(
    options.root,
    options.stage,
    options.noFallback,
  );
  const violations = [];
  const pathFiles = listFiles(options.root, ['src', 'web', 'scripts', 'test', 'e2e', 'config', 'public']);
  const missingPathAllowlist = merged.paths.length === 0;
  if (missingPathAllowlist) {
    warnings.push({ code: 'PATHS_NOT_DECLARED', message: 'no paths in stage manifest; path check skipped' });
  } else {
    for (const file of pathFiles) {
      if (!allowedPath(file, merged.paths)) {
        violations.push({ kind: 'path', value: file, code: 'E_STAGE_LEAK' });
      }
    }
  }

  const tables = readTableNames(options.root);
  if (tables.length > 0) {
    if (fallback) {
      const unexpected = tables.filter((t) => !merged.tables.includes(t));
      if (unexpected.length > 0) {
        warnings.push({
          code: 'STAGE_TABLE_CHECK_SOFT',
          message: `fallback mode: table(s) not in bootstrap allowlist: ${unexpected.join(', ')}`,
        });
      }
    } else {
      for (const table of tables) {
        if (!merged.tables.includes(table)) {
          violations.push({ kind: 'table', value: table, code: 'E_STAGE_LEAK' });
        }
      }
    }
  }

  const routes = readRouteStrings(options.root);
  if (routes.length > 0) {
    const allowed = new Set([...merged.routes, ...merged.uiRoutes]);
    const unexpected = routes.filter((r) => !allowed.has(r));
    if (unexpected.length > 0) {
      if (fallback) {
        warnings.push({
          code: 'STAGE_ROUTE_CHECK_SOFT',
          message: `fallback mode: route(s) not in bootstrap allowlist: ${unexpected.join(', ')}`,
        });
      } else {
        for (const route of unexpected) {
          violations.push({ kind: 'route', value: route, code: 'E_STAGE_LEAK' });
        }
      }
    }
  }

  const packageScripts = readPackageScripts(options.root);
  const allowedScripts = new Set(merged.scripts);
  const unexpectedScripts = packageScripts.filter((s) => !allowedScripts.has(s));
  if (unexpectedScripts.length > 0) {
    if (fallback) {
      warnings.push({
        code: 'STAGE_SCRIPT_CHECK_SOFT',
        message: `fallback mode: script(s) not in bootstrap allowlist: ${unexpectedScripts.join(', ')}`,
      });
    } else {
      for (const script of unexpectedScripts) {
        violations.push({ kind: 'script', value: script, code: 'E_STAGE_LEAK' });
      }
    }
  }

  const report = {
    schema: 'hive.cli.v1',
    ok: violations.length === 0,
    command: 'hive.assert-stage',
    code: violations.length === 0 ? null : 'E_STAGE_LEAK',
    data: {
      stage: options.stage,
      label: STAGE_LABEL[options.stage],
      fallback,
      manifests: manifests.map((m) => ({ stage: m.stage, fallback: Boolean(m.fallback) })),
      counts: {
        files: pathFiles.length,
        tables: tables.length,
        routes: routes.length,
        scripts: packageScripts.length,
      },
      violations,
    },
    warnings,
    meta: { version: '0.1.0' },
  };
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(
      violations.length === 0
        ? `assert-stage ${options.stage}: clean${fallback ? ' (fallback allowlist)' : ''}\n`
        : `assert-stage ${options.stage}: ${violations.length} leak(s)\n${violations
            .map((v) => `  ${v.kind}: ${v.value}`)
            .join('\n')}\n`,
    );
  }
  process.exit(violations.length === 0 ? 0 : 9);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({
      schema: 'hive.cli.v1',
      ok: false,
      command: 'hive.assert-stage',
      code: 'E_STAGE_LEAK',
      error: { code: 'E_STAGE_LEAK', message: error instanceof Error ? error.message : String(error) },
    }, null, 2)}\n`,
  );
  process.exit(9);
}
