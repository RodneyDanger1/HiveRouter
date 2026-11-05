import fs from 'node:fs';
import path from 'node:path';

// Side-effect module: load the local environment before any module parses
// HIVE_PHASE or reads DEEPSEEK_API_KEY. Import this first from config/server entrypoints.
const envLocal = path.join(process.cwd(), '.env.local');
try {
  if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);
} catch {
  // A malformed local env file must not crash the process; the key resolver
  // and settings endpoint report the actionable refusal.
}
