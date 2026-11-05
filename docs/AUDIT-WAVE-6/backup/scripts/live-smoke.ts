/**
 * live-smoke.ts
 * Opt-in live DeepSeek verification. Requires --yes. Never prints the key.
 * Checks /models, /user/balance, and a small JSON-mode completion.
 * Exit 0 pass, 2 usage, 3 key/setup, 4 provider/contract failure, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { resolveKey, keyStatus } from '../src/server/security/keys.js';
import { chat, models, balance } from '../src/server/llm/client.js';
import { redactString } from '../src/server/security/redact.js';

const args = new Set(process.argv.slice(2));

async function main() {
  if (!args.has('--yes')) {
    console.error('live-smoke: pass --yes to authorize a real (tiny) DeepSeek call');
    process.exit(2);
  }
  if (!resolveKey().key) {
    console.error('live-smoke: E_KEY_NOT_CONFIGURED');
    process.exit(3);
  }
  const started = Date.now();
  const modelList = await models();
  const balanceInfo = await balance();
  const completion = await chat(
    [
      { role: 'system', content: 'You return strictly valid JSON with the word json in the contract. Return {"ok":true,"product":"HiveRouter"} and nothing else.' },
      { role: 'user', content: 'Return the required JSON object now.' },
    ],
    { model: config.model, thinking: 'disabled', maxTokens: 256, json: true, temperature: 0, userId: 'hive-live-smoke' },
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.content);
  } catch {
    throw new Error('E_PROVIDER_INVALID_JSON');
  }
  const ok = typeof parsed === 'object' && parsed !== null && (parsed as { ok?: boolean }).ok === true;
  const evidence = {
    schema: 'hive.live-smoke.v1',
    ok,
    at: new Date().toISOString(),
    model: completion.usage.model,
    finishReason: completion.finishReason,
    parsed,
    usage: completion.usage,
    key: keyStatus(),
    models: modelList,
    balance: balanceInfo,
    durationMs: Date.now() - started,
  };
  const dir = path.join(config.root, 'docs', 'verification');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `live-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, redactString(JSON.stringify(evidence, null, 2)), 'utf8');
  process.stdout.write(`live smoke: ${ok ? 'PASS' : 'FAIL'} model=${completion.usage.model} costUsd=${completion.usage.costUsd}\n`);
  process.stdout.write(`evidence: ${reportPath}\n`);
  process.exit(ok ? 0 : 4);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
