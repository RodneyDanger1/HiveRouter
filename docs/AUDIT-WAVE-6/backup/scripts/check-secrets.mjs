#!/usr/bin/env node
// Secret scan for HiveRouter text surfaces. Read-only; never prints a full secret.
// Exit 0 clean, 2 usage, 4 findings, 9 internal.
import fs from 'node:fs';
import path from 'node:path';

const PATTERNS = [
  { name: 'openrouter', re: /\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'deepseek', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'gemini', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { name: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{20,}?-----END/g },
  { name: 'password', re: /\b(password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{8,}/gi },
  { name: 'dsh-yaml-key', re: /^\s*(?:DEEPSEEK_API_KEY|OPENROUTER_API_KEY):\s*\S+\s*$/gm },
];

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.yaml', '.yml',
  '.md', '.txt', '.css', '.html', '.sql', '.sh', '.ps1', '.cmd', '.bat', '.env', '.example',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'web/dist', 'data', 'workspace', 'vault',
  'test-results', 'logs', 'reports', '.cache',
]);

function parseArgs(argv) {
  let root = process.cwd();
  let json = false;
  let dirs = ['src', 'scripts', 'web/src', 'config', 'test', 'e2e', '.env.example'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--json') json = true;
    else if (arg === '--root' && next) {
      root = path.resolve(next);
      i += 1;
    } else if (arg === '--dirs' && next) {
      dirs = next.split(',').map((d) => d.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write('Usage: check-secrets [--json] [--root DIR] [--dirs src,scripts,web/src]\n');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { root, json, dirs };
}

function extensionOf(file) {
  const base = path.basename(file);
  if (base === '.env.example' || base.startsWith('.env')) return '.env';
  return path.extname(file).toLowerCase();
}

function walk(target, root, out) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(path.join(target, entry), root, out);
    }
    return;
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return;
  if (!TEXT_EXT.has(extensionOf(target))) return;
  out.push({ absolute: target, relative: path.relative(root, target).replace(/\\/g, '/') });
}

function redactLine(line) {
  let out = line;
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, `[REDACTED:${name}]`);
  }
  return out.slice(0, 240);
}

function isTestFixture(relative) {
  return (
    relative.startsWith('test/') ||
    relative.startsWith('e2e/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(relative)
  );
}

function scan(root, dirs) {
  const files = [];
  for (const dir of dirs) walk(path.join(root, dir), root, files);
  const hits = [];
  const allowed = [];
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file.absolute, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const pattern of PATTERNS) {
        pattern.re.lastIndex = 0;
        if (!pattern.re.test(lines[i])) continue;
        const item = {
          file: file.relative,
          line: i + 1,
          pattern: pattern.name,
          preview: redactLine(lines[i]),
        };
        if (isTestFixture(file.relative)) allowed.push(item);
        else hits.push(item);
        break;
      }
    }
  }
  return { scanned: files.length, hits, allowed };
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}

try {
  const result = scan(options.root, options.dirs);
  const report = {
    schema: 'hive.cli.v1',
    ok: result.hits.length === 0,
    command: 'hive.secret-scan',
    code: result.hits.length === 0 ? null : 'E_SECRET_SCAN',
    data: result,
    warnings: result.allowed.length > 0
      ? [{ code: 'TEST_DOUBLES_CLASSIFIED', message: `${result.allowed.length} synthetic test-fixture match(es) allowed.` }]
      : [],
    meta: { version: '0.1.0' },
  };
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(
      result.hits.length === 0
        ? `secret-scan: clean (${result.scanned} files)\n`
        : `secret-scan: ${result.hits.length} finding(s) in ${result.scanned} files\n${result.hits
            .map((h) => `  ${h.file}:${h.line}  ${h.pattern}  ${h.preview}`)
            .join('\n')}\n`,
    );
  }
  process.exit(result.hits.length === 0 ? 0 : 4);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({
      schema: 'hive.cli.v1',
      ok: false,
      command: 'hive.secret-scan',
      code: 'E_INTERNAL',
      error: { code: 'E_INTERNAL', message: error instanceof Error ? error.message : String(error) },
    }, null, 2)}\n`,
  );
  process.exit(9);
}
