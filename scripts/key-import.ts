/**
 * key-import.ts — local DeepSeek key ingress for the app-secret store.
 * The key is never echoed. Prefer environment/.env.local for CI.
 *
 * usage:
 *   npm.cmd run key:import -- --from-env
 *   npm.cmd run key:import -- --file C:\path\to\key.txt
 *   Get-Content key.txt | npm.cmd run key:import -- --stdin
 *   npm.cmd run key:import -- --status
 *   npm.cmd run key:import -- --clear
 */
import fs from 'node:fs';
import { config } from '../src/server/config.js';
import { clearAppKey, keyStatus, saveAppKey } from '../src/server/security/keys.js';

const MAX_KEY_INPUT_BYTES = 64 * 1024;
const args = process.argv.slice(2);

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

function boundedUtf8(buffer: Buffer, label: string): string {
  if (buffer.byteLength > MAX_KEY_INPUT_BYTES) {
    fail(4, `E_KEY_INVALID: ${label} exceeds ${MAX_KEY_INPUT_BYTES} bytes`);
  }
  return buffer.toString('utf8');
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
  if (!file) fail(2, 'usage: key-import --from-env | --file <path> | --stdin | --status | --clear');
  if (!fs.existsSync(file)) fail(3, `key file not found: ${file}`);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(4, 'E_KEY_INVALID: key file must be a regular, non-symlink file');
  if (stat.size > MAX_KEY_INPUT_BYTES) fail(4, `E_KEY_INVALID: key file exceeds ${MAX_KEY_INPUT_BYTES} bytes`);
  raw = fs.readFileSync(file, 'utf8');
} else if (args.includes('--stdin')) {
  raw = boundedUtf8(fs.readFileSync(0), 'stdin');
} else if (args.includes('--from-env')) {
  raw = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
  if (raw.length === 0) fail(4, 'E_KEY_NOT_CONFIGURED: DEEPSEEK_API_KEY is not set');
} else {
  fail(2, 'usage: key-import --from-env | --file <path> | --stdin | --status | --clear');
}

const key = (raw ?? '').trim();
if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) fail(4, 'E_KEY_INVALID: expected a DeepSeek sk- key');
saveAppKey(key);
const status = keyStatus();
process.stdout.write(JSON.stringify({ saved: true, configured: status.configured, source: status.source, fingerprint: status.fingerprint }) + '\n');
