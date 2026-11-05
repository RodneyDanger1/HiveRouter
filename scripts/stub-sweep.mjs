#!/usr/bin/env node
// Stub/placeholder sweep for HiveRouter source surfaces.
// Read-only. Exit 0 clean, 2 usage, 4 findings, 9 internal.
import fs from 'node:fs';
import path from 'node:path';

const PATTERNS = [
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /\bXXX\b/i,
  /\bHACK\b/i,
  /\bplaceholder\b/i,
  /\bnot implemented\b/i,
  /\bunimplemented\b/i,
  /\bmock(?:ed|ing)?\b/i,
  /\bstub(?:bed|bing)?\b/i,
  /\bdummy\b/i,
  /\blorem ipsum\b/i,
  /\bsimplified for\b/i,
  /\bfor illustration\b/i,
];

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.yaml', '.yml',
  '.md', '.txt', '.css', '.html', '.sql', '.sh', '.ps1', '.cmd', '.bat',
]);

function parseArgs(argv) {
  let root = process.cwd();
  let json = false;
  let includeTests = false;
  let dirs = ['src', 'web/src'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--json') json = true;
    else if (arg === '--include-tests') includeTests = true;
    else if (arg === '--root' && next) {
      root = path.resolve(next);
      i += 1;
    } else if (arg === '--dirs' && next) {
      dirs = next.split(',').map((d) => d.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write('Usage: stub-sweep [--json] [--root DIR] [--include-tests] [--dirs src,web/src]\n');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { root, json, includeTests, dirs };
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
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'data') continue;
      walk(path.join(target, entry), root, out);
    }
    return;
  }
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return;
  if (!TEXT_EXT.has(path.extname(target).toLowerCase())) return;
  out.push({ absolute: target, relative: path.relative(root, target).replace(/\\/g, '/') });
}

function classify(relative) {
  return (
    relative.startsWith('test/') ||
    relative.startsWith('e2e/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(relative)
  );
}

function commentPart(line) {
  const trimmed = line.trim();
  if (/^(?:\/\/|\/\*|\*|#|<!--|--)/.test(trimmed)) return trimmed;
  const slash = line.indexOf('//');
  if (slash >= 0) return line.slice(slash);
  const block = line.indexOf('/*');
  if (block >= 0) return line.slice(block);
  return '';
}

function sweep(root, dirs, includeTests) {
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
      const line = lines[i];
      const comment = commentPart(line);
      // Only comment declarations are placeholders. Detector regexes and
      // provenance enums legitimately contain words like "placeholder"/"mock".
      if (!comment) continue;
      if (!PATTERNS.some((re) => re.test(comment))) continue;
      const item = {
        file: file.relative,
        line: i + 1,
        text: line.trim().slice(0, 160),
      };
      if (includeTests && classify(file.relative)) allowed.push(item);
      else hits.push(item);
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
  const result = sweep(options.root, options.dirs, options.includeTests);
  const report = {
    schema: 'hive.cli.v1',
    ok: result.hits.length === 0,
    command: 'hive.stub-sweep',
    code: result.hits.length === 0 ? null : 'E_STUB_SWEEP',
    data: result,
    warnings: result.allowed.length > 0
      ? [{ code: 'TEST_DOUBLES_CLASSIFIED', message: `${result.allowed.length} allowed test-double marker(s).` }]
      : [],
    meta: { version: '0.1.0', durationMs: 0 },
  };
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    process.stdout.write(
      result.hits.length === 0
        ? `stub-sweep: clean (${result.scanned} files)\n`
        : `stub-sweep: ${result.hits.length} finding(s) in ${result.scanned} files\n${result.hits
            .map((h) => `  ${h.file}:${h.line}  ${h.text}`)
            .join('\n')}\n`,
    );
  }
  process.exit(result.hits.length === 0 ? 0 : 4);
} catch (error) {
  const report = {
    schema: 'hive.cli.v1',
    ok: false,
    command: 'hive.stub-sweep',
    code: 'E_INTERNAL',
    error: { code: 'E_INTERNAL', message: error instanceof Error ? error.message : String(error) },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(9);
}
