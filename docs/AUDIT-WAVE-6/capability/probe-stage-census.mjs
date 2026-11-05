import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
const db = new DatabaseSync('data/hive.db', { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('tables:', tables.length);
console.log(tables.map((t) => t.name).join(','));
db.close();

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('scripts:', Object.keys(pkg.scripts).length);
const p7 = JSON.parse(fs.readFileSync('config/releases/p7.json', 'utf8'));
console.log('p7.tables:', p7.tables.length, 'p7.routes:', p7.routes.length, 'p7.scripts:', p7.scripts.length);
const missingTables = p7.tables.filter((t) => !tables.some((row) => row.name === t));
console.log('p7 tables absent from DB:', missingTables.length, missingTables.join(','));
const dbNotInP7 = tables.map((t) => t.name).filter((n) => !p7.tables.includes(n));
console.log('DB tables absent from p7:', dbNotInP7.length, dbNotInP7.join(','));
