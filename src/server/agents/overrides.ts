import { getDb } from '../db/database.js';

/**
 * Prompt overrides are persisted as settings rows and are read by both the
 * snapshot builder (what the runtime pins) and the agent API (what the operator
 * sees). Keeping one reader prevents the drawer from showing a prompt the next
 * run will not actually use.
 */
export function loadPromptOverrides(db = getDb()): Map<string, string> {
  const rows = db
    .prepare("SELECT key, value_json FROM settings WHERE substr(key, 1, 16) = 'prompt_override:'")
    .all() as Array<{ key: string; value_json: string }>;
  const overrides = new Map<string, string>();
  for (const row of rows) {
    const agentId = row.key.slice('prompt_override:'.length);
    if (!agentId) continue;
    try {
      const parsed = JSON.parse(row.value_json) as { prompt?: unknown };
      if (typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0) {
        overrides.set(agentId, parsed.prompt.trim());
      }
    } catch {
      // A corrupt override is ignored here; the writer validates before save.
    }
  }
  return overrides;
}

export function readPromptOverride(agentId: string, db = getDb()): string | null {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(`prompt_override:${agentId}`) as
    | { value_json: string }
    | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value_json) as { prompt?: unknown };
    return typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0 ? parsed.prompt.trim() : null;
  } catch {
    return null;
  }
}
