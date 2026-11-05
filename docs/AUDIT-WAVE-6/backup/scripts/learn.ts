/**
 * learn.ts
 * Inspect the local learning dataset/pool and produce an honest status packet.
 * It never applies a candidate. --apply is forbidden by contract.
 * Exit 0 ok (including refused/no_promotion), 2 usage, 3 forbidden, 6 insufficient data, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { initDb, getDb } from '../src/server/db/database.js';
import { isConsentActive } from '../src/server/learning/consent.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');

function count(db: ReturnType<typeof getDb>, table: string): number | null {
  try {
    return Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
  } catch {
    return null;
  }
}

async function main() {
  if (apply) {
    console.error('LEARN_APPLY_FORBIDDEN: the learning CLI never applies a candidate; promote through the human-approved API.');
    process.exit(3);
  }
  initDb();
  const db = getDb();
  const traces = count(db, 'traces') ?? 0;
  const blocks = count(db, 'sealed_pool_blocks') ?? 0;
  const suites = count(db, 'eval_suites') ?? 0;
  const candidates = count(db, 'variants') ?? 0;
  const promotions = count(db, 'promotions') ?? 0;
  let completeBlocks = 0;
  try {
    completeBlocks = Number(
      (
        db
          .prepare(
            `SELECT COUNT(*) AS n
             FROM sealed_pool_blocks b
             WHERE b.status = 'ready'
               AND (SELECT COUNT(*) FROM sealed_pool p WHERE p.block_id = b.block_id) = 65`,
          )
          .get() as { n: number }
      ).n,
    );
  } catch {
    completeBlocks = 0;
  }
  let caseConsent = false;
  try {
    caseConsent = isConsentActive(db, 'case_to_provider_eval');
  } catch {
    caseConsent = false;
  }
  const refusal = completeBlocks < 6
    ? { code: 'E_LEARNING_POOL_EXHAUSTED', message: `Need at least 6 complete sealed 65-case blocks; have ${completeBlocks}.` }
    : !caseConsent
      ? { code: 'E_LEARNING_CONSENT_REQUIRED', message: 'Case-to-provider eval consent is not active.' }
      : traces < 3
        ? { code: 'E_LEARNING_INSUFFICIENT_SAMPLE', message: `Need at least 3 terminal traces; have ${traces}.` }
        : null;
  const result = {
    schema: 'hive.cli.v1',
    command: 'hive.learn',
    ok: true,
    mode: 'inspect-only',
    screeningLabel: 'Screening-grade, low power; no general-quality claim; no promotion expected.',
    counts: { traces, blocks, completeBlocks, caseConsent, suites, candidates, promotions },
    refused: refusal,
    note: refusal ? 'No evaluation/promotion is possible; this is an honest refusal, not a failure.' : 'A human-initiated candidate may be proposed through the UI/API.',
  };
  const dir = path.join(config.dataDir, 'learning');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `learn-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`learning: traces=${traces} blocks=${blocks} suites=${suites} candidates=${candidates} promotions=${promotions}\nreport: ${reportPath}\n`);
  process.exit(refusal ? 6 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
