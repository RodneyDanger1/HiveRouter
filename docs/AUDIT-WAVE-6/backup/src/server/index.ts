import { buildApp } from './app.js';
import { config, ensureRuntimeDirs } from './config.js';
import { initDb, closeDb, nowIso } from './db/database.js';
import { markStartupInterrupted, setExecutor } from './runs/manager.js';
import { executeRun } from './pipeline/run.js';
import { reapExpired } from './runs/budget.js';
import { ensureDir } from './security/paths.js';
import { recoverFinalizeDirectories } from './runs/publish.js';
import path from 'node:path';
import { recordCrash, recordError } from './observability/error-log.js';

let closing = false;

function fatal(source: 'crash' | 'startup', error: unknown, context: Record<string, unknown> = {}): void {
  const normalized = error instanceof Error ? error : new Error(String(error));
  recordCrash({
    source,
    code: normalized.message.startsWith('E_') ? normalized.message.split(':')[0] : 'E_INTERNAL',
    message: normalized.message,
    stack: normalized.stack ?? null,
    context,
  });
}

process.on('uncaughtException', (error) => {
  fatal('crash', error, { origin: 'uncaughtException', pid: process.pid });
  // eslint-disable-next-line no-console
  console.error('HiveRouter uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  fatal('crash', reason, { origin: 'unhandledRejection', pid: process.pid });
  // eslint-disable-next-line no-console
  console.error('HiveRouter unhandled rejection:', reason);
  process.exit(1);
});

async function main(): Promise<void> {
  ensureRuntimeDirs();
  ensureDir(config.workspaceDir);
  initDb();
  const recovered = recoverFinalizeDirectories(path.join(config.workspaceDir, 'runs'));
  const interrupted = markStartupInterrupted();
  const reaped = reapExpired();
  setExecutor(executeRun);
  const app = await buildApp();
  await app.listen({ host: config.host, port: config.port });
  app.log.info({ host: config.host, port: config.port, phase: config.phase, interrupted, reaped, recovered, at: nowIso() }, 'HiveRouter online');

  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    recordError({ source: 'shutdown', code: 'E_SHUTDOWN', message: `Received ${signal}`, context: { signal } });
    try {
      await app.close();
    } finally {
      closeDb();
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  fatal('startup', error, { pid: process.pid });
  // eslint-disable-next-line no-console
  console.error('HiveRouter failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});

