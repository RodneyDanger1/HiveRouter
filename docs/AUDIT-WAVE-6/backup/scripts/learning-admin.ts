/**
 * learning-admin.ts
 * Operator-only local CLI for the two external prerequisites of the learning
 * loop: consent scopes and a real sealed 65-case block. It never applies a
 * candidate and never fabricates cases. The server refuses evaluation until
 * these are supplied by a human.
 *
 * Usage:
 *   tsx scripts/learning-admin.ts consent status
 *   tsx scripts/learning-admin.ts consent grant case_to_provider_eval
 *   tsx scripts/learning-admin.ts consent revoke trace_retention
 *   tsx scripts/learning-admin.ts import-block <blockId> <cases.json>
 */
import fs from 'node:fs';
import { initDb, getDb } from '../src/server/db/database.js';
import {
  consentMatrix,
  grantConsent,
  revokeConsent,
  LEARNING_CONSENT_SCOPES,
  createSealedBlock,
  type LearningConsentScope,
} from '../src/server/learning/index.js';

function usage(): never {
  console.error(
    'usage: learning-admin.ts consent status|grant|revoke [scope] | import-block <blockId> <cases.json>',
  );
  process.exit(2);
}

function pickScope(raw: string | undefined): LearningConsentScope {
  if (!raw || !(LEARNING_CONSENT_SCOPES as readonly string[]).includes(raw)) {
    console.error(`scope must be one of: ${LEARNING_CONSENT_SCOPES.join(', ')}`);
    process.exit(2);
  }
  return raw as LearningConsentScope;
}

function main(): void {
  initDb();
  const db = getDb();
  const [group, action, value, file] = process.argv.slice(2);
  if (group === 'consent') {
    if (action === 'status') {
      process.stdout.write(JSON.stringify({ consent: consentMatrix(db) }, null, 2) + '\n');
      return;
    }
    if (action === 'grant') {
      const scope = pickScope(value);
      const record = grantConsent(db, scope);
      process.stdout.write(`granted ${scope} version ${record.version}\n`);
      return;
    }
    if (action === 'revoke') {
      const scope = pickScope(value);
      const record = revokeConsent(db, scope);
      process.stdout.write(`revoked ${scope} ${record ? `version ${record.version}` : '(already revoked)'}\n`);
      return;
    }
    usage();
  }
  if (group === 'import-block') {
    if (!action || !value) usage();
    if (!fs.existsSync(value)) {
      console.error(`cases file not found: ${value}`);
      process.exit(2);
    }
    const parsed = JSON.parse(fs.readFileSync(value, 'utf8')) as { cases?: unknown[] } | unknown[];
    const cases = Array.isArray(parsed) ? parsed : Array.isArray(parsed.cases) ? parsed.cases : null;
    if (!cases) {
      console.error('cases file must be a JSON array or { "cases": [...] }');
      process.exit(2);
    }
    const block = createSealedBlock(db, { blockId: action, cases: cases as never[] });
    process.stdout.write(JSON.stringify({ block }, null, 2) + '\n');
    return;
  }
  usage();
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
}
