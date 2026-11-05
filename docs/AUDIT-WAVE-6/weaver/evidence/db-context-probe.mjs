// Read-only: context pack projection completeness across the two audited runs.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/hive.db', { readOnly: true });
for (const id of ['run_abf5fe78aab1e932ff', 'run_95c11797b4923b4277']) {
  const rows = db.prepare('SELECT task_id, included_json, excluded_json FROM context_packs WHERE run_id = ?').all(id);
  let excludedNonEmpty = 0;
  let itemCount = 0;
  let itemsWithTokens = 0;
  let itemsWithChars = 0;
  let itemsWithReason = 0;
  let itemsWithIncluded = 0;
  for (const row of rows) {
    const excluded = JSON.parse(String(row.excluded_json));
    if (Array.isArray(excluded) && excluded.length > 0) excludedNonEmpty += 1;
    for (const item of JSON.parse(String(row.included_json))) {
      itemCount += 1;
      if (item.tokens !== null && item.tokens !== undefined) itemsWithTokens += 1;
      if (item.chars !== undefined) itemsWithChars += 1;
      if (item.reason !== undefined) itemsWithReason += 1;
      if (item.included !== undefined) itemsWithIncluded += 1;
    }
  }
  console.log(JSON.stringify({ runId: id, packs: rows.length, excludedNonEmpty, itemCount, itemsWithTokens, itemsWithChars, itemsWithReason, itemsWithIncluded }, null, 2));
}
db.close();
