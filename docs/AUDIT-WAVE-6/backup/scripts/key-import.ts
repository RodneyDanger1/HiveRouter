/**
 * key-import.ts — local DeepSeek key ingress for the app-secret store.
 * The key is never echoed. Prefer environment/.env.local for CI.
 *
 * usage:
 *   npm.cmd run key:import -- --file C:\path\to\key.txt
 *   Get-Content key.txt | npm.cmd run key:import -- --stdin
 *   npm.cmd run key:import -- --status
 *   npm.cmd run key:import -- --clear
 */
import fs from 'node:fs';
import { config } from '../src/server/config.js';
import { clearAppKey, keyStatus, saveAppKey } from '../src/server/security/keys.js';

const args = process.argv.slice(2);

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

if (args.includes('--status')) {
  const status = keyStatus();
  process.stdout.write(JSON.stringify({ configured: status.configured, source: status.source, fingerprint: status.fingerprint, dataDir: config.dataDir }) + '\n');
  process.exit(0);
}
if (args.includes('--clear')) {
  clearAppKey();
  process.stdout.write('app-secret key cleared\n');
  process.exit(0);
}

let raw: string | null = null;
const fileIndex = args.indexOf('--file');
if (fileIndex >= 0) {
  const file = args[fileIndex + 1];
  if (!file) fail(2, 'usage: key-import --file <path> | --stdin | --status | --clear');
  if (!fs.existsSync(file)) fail(3, `key file not found: ${file}`);
  raw = fs.readFileSync(file, 'utf8');
} else if (args.includes('--stdin')) {
  raw = fs.readFileSync(0, 'utf8');
} else {
  fail(2, 'usage: key-import --file <path> | --stdin | --status | --clear');
}

const key = (raw ?? '').trim();
if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) fail(4, 'E_KEY_INVALID: expected a DeepSeek sk- key');
saveAppKey(key);
const status = keyStatus();
process.stdout.write(JSON.stringify({ saved: true, configured: status.configured, source: status.source, fingerprint: status.fingerprint }) + '\n');
