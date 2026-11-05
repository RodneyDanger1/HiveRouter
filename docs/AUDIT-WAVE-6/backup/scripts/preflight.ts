import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Preflight gate. Read-only: it never opens a key, a DB, or the network.
 * Exit codes: 0 pass, 2 usage, 7 resource/browser/port refusal, 9 internal.
 */

export const NODE_EXACT = '26.7.0';
export const NPM_EXACT = '11.19.0';
export const MIN_DISK_GB = 4.5;
export const MIN_RAM_GB = 1.5;

export interface PreflightConstraints {
  minDiskGb: number;
  minRamGb: number;
  nodeVersion: string;
  npmVersion: string;
  chromePaths: string[];
  port: number;
  host: string;
}

export interface PreflightEnvironment {
  nodeVersion: string;
  npmVersion: string;
  freeDiskGb: number;
  freeRamGb: number;
  chromePath: string | null;
  portFree: boolean;
}

export interface PreflightCheck {
  name: 'node' | 'npm' | 'disk' | 'ram' | 'chrome' | 'port';
  ok: boolean;
  actual: string | number;
  required: string | number;
  code: 'E_RESOURCE_INSUFFICIENT' | 'E_E2E_BROWSER_MISSING' | null;
}

export interface PreflightResult {
  ok: boolean;
  code: 'E_RESOURCE_INSUFFICIENT' | 'E_E2E_BROWSER_MISSING' | null;
  checks: PreflightCheck[];
}

export function evaluatePreflight(
  env: PreflightEnvironment,
  constraints: PreflightConstraints,
): PreflightResult {
  const checks: PreflightCheck[] = [
    {
      name: 'node',
      ok: env.nodeVersion === `v${constraints.nodeVersion}`,
      actual: env.nodeVersion,
      required: `v${constraints.nodeVersion}`,
      code: 'E_RESOURCE_INSUFFICIENT',
    },
    {
      name: 'npm',
      ok: env.npmVersion === constraints.npmVersion,
      actual: env.npmVersion,
      required: constraints.npmVersion,
      code: 'E_RESOURCE_INSUFFICIENT',
    },
    {
      name: 'disk',
      ok: env.freeDiskGb >= constraints.minDiskGb,
      actual: env.freeDiskGb,
      required: constraints.minDiskGb,
      code: 'E_RESOURCE_INSUFFICIENT',
    },
    {
      name: 'ram',
      ok: env.freeRamGb >= constraints.minRamGb,
      actual: env.freeRamGb,
      required: constraints.minRamGb,
      code: 'E_RESOURCE_INSUFFICIENT',
    },
    {
      name: 'chrome',
      ok: env.chromePath !== null,
      actual: env.chromePath ?? 'missing',
      required: 'installed system Chrome',
      code: 'E_E2E_BROWSER_MISSING',
    },
    {
      name: 'port',
      ok: env.portFree,
      actual: env.portFree ? 'free' : 'in use',
      required: `free ${constraints.host}:${constraints.port}`,
      code: 'E_RESOURCE_INSUFFICIENT',
    },
  ];

  const failed = checks.filter((c) => !c.ok);
  const code = failed.some((c) => c.code === 'E_E2E_BROWSER_MISSING')
    ? 'E_E2E_BROWSER_MISSING'
    : failed.length > 0
      ? 'E_RESOURCE_INSUFFICIENT'
      : null;
  return { ok: failed.length === 0, code, checks };
}

export function defaultChromePaths(): string[] {
  const paths = [process.env.CHROME_PATH];
  if (process.platform === 'win32') {
    paths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    );
  } else if (process.platform === 'darwin') {
    paths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    paths.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium');
  }
  return paths.filter((p): p is string => Boolean(p));
}

function findChrome(paths: string[]): string | null {
  for (const candidate of paths) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // try the next known location
    }
  }
  return null;
}

function readNpmVersion(): string {
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args =
      process.platform === 'win32' ? ['/d', '/c', 'npm', '--version'] : ['--version'];
    const out = execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return 'unknown';
  }
}

function freeDiskGiB(root: string): number {
  try {
    const stat = fs.statfsSync(root);
    return (Number(stat.bavail) * Number(stat.bsize)) / 1024 ** 3;
  } catch {
    return 0;
  }
}

async function isPortFree(port: number, host: string): Promise<boolean> {
  if (port === 0) return true;
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function collectEnvironment(
  root: string,
  constraints: PreflightConstraints,
): Promise<PreflightEnvironment> {
  const chromePath = findChrome(constraints.chromePaths);
  return {
    nodeVersion: process.version,
    npmVersion: readNpmVersion(),
    freeDiskGb: Number(freeDiskGiB(root).toFixed(2)),
    freeRamGb: Number((os.freemem() / 1024 ** 3).toFixed(2)),
    chromePath,
    portFree: await isPortFree(constraints.port, constraints.host),
  };
}

function parseArgs(argv: string[]): {
  constraints: PreflightConstraints;
  root: string;
  json: boolean;
} {
  let minDiskGb = MIN_DISK_GB;
  let minRamGb = MIN_RAM_GB;
  let port = 8787;
  let host = '127.0.0.1';
  let root = process.cwd();
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--json') json = true;
    else if (arg === '--min-disk-gb' && next) {
      minDiskGb = Number(next);
      i += 1;
    } else if (arg === '--min-ram-gb' && next) {
      minRamGb = Number(next);
      i += 1;
    } else if (arg === '--port' && next) {
      port = Number(next);
      i += 1;
    } else if (arg === '--host' && next) {
      host = next;
      i += 1;
    } else if (arg === '--root' && next) {
      root = path.resolve(next);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Usage: preflight [--json] [--min-disk-gb 4.5] [--min-ram-gb 1.5] [--port 8787] [--host 127.0.0.1] [--root DIR]\n',
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(minDiskGb) || minDiskGb < 0 || minDiskGb > 1000) {
    throw new Error('--min-disk-gb must be between 0 and 1000');
  }
  if (!Number.isFinite(minRamGb) || minRamGb < 0 || minRamGb > 1000) {
    throw new Error('--min-ram-gb must be between 0 and 1000');
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('--port must be an integer 0-65535');
  }
  return {
    constraints: {
      minDiskGb,
      minRamGb,
      nodeVersion: NODE_EXACT,
      npmVersion: NPM_EXACT,
      chromePaths: defaultChromePaths(),
      port,
      host,
    },
    root,
    json,
  };
}

async function main(): Promise<void> {
  const start = Date.now();
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(2);
  }

  try {
    const env = await collectEnvironment(parsed.root, parsed.constraints);
    const result = evaluatePreflight(env, parsed.constraints);
    const report = {
      schema: 'hive.cli.v1',
      ok: result.ok,
      command: 'hive.preflight',
      code: result.code,
      data: {
        checks: result.checks,
        measurements: env,
        constraints: {
          minDiskGb: parsed.constraints.minDiskGb,
          minRamGb: parsed.constraints.minRamGb,
          nodeVersion: parsed.constraints.nodeVersion,
          npmVersion: parsed.constraints.npmVersion,
          port: parsed.constraints.port,
          host: parsed.constraints.host,
        },
      },
      warnings: result.ok ? [] : result.checks.filter((c) => !c.ok),
      meta: {
        durationMs: Date.now() - start,
        dryRun: true,
        provenance: 'human',
      },
    };
    process.stdout.write(`${JSON.stringify(report, null, parsed.json ? 2 : 0)}\n`);
    process.exit(result.ok ? 0 : 7);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = {
      schema: 'hive.cli.v1',
      ok: false,
      command: 'hive.preflight',
      code: 'E_INTERNAL',
      error: { code: 'E_INTERNAL', message, retryable: false },
      meta: { durationMs: Date.now() - start },
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(9);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const thisPath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath === thisPath) {
  void main();
}
