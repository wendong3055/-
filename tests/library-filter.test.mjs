import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

const require = createRequire(import.meta.url);
function loadTs(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => overrides[name] ?? require(name) });
  return module.exports;
}
const schema = loadTs('../db/schema.ts');
const { libraryAssetFilter } = loadTs('../db/library-filter.ts', { './schema': schema });
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE assets (id TEXT PRIMARY KEY, owner_id TEXT, name TEXT, category TEXT);
  CREATE TABLE generation_tasks (id TEXT PRIMARY KEY, owner_id TEXT, asset_id TEXT);
  CREATE TABLE products (id TEXT PRIMARY KEY, owner_id TEXT, sample_asset_id TEXT);`);
const insert = db.prepare('INSERT INTO assets VALUES (?, ?, ?, ?)');
for (const [id, owner, category] of [
  ['art', 'owner', '抽象艺术'], ['frame', 'owner', '框架模板'],
  ['frame-variant', 'owner', '框架规格'], ['color', 'owner', '颜色素材'],
  ['output', 'owner', '生成效果图'], ['legacy-output', 'owner', '抽象艺术'],
  ['task-id-output', 'owner', '未分类'], ['sample', 'owner', '未分类'],
  ['foreign', 'other', '抽象艺术'], ['foreign-link', 'owner', '抽象艺术'],
]) insert.run(id, owner, '新品形象 · 暖色抽象圆叶', category);
db.prepare('INSERT INTO generation_tasks VALUES (?, ?, ?)').run('g1', 'owner', 'legacy-output');
db.prepare('INSERT INTO generation_tasks VALUES (?, ?, ?)').run('task-id-output', 'owner', null);
db.prepare('INSERT INTO generation_tasks VALUES (?, ?, ?)').run('g2', 'other', 'foreign-link');
db.prepare('INSERT INTO products VALUES (?, ?, ?)').run('p1', 'owner', 'sample');

// Execute the exact production Drizzle predicate against SQLite, not a duplicate.
const query = new SQLiteSyncDialect().sqlToQuery(libraryAssetFilter('owner'));
const select = () => db.prepare(`SELECT id FROM assets WHERE ${query.sql} ORDER BY id`).all(...query.params).map(row => row.id);
assert.deepEqual(select(), ['art', 'color', 'foreign-link', 'frame', 'frame-variant']);
insert.run('future-output', 'owner', '新成图', '生成效果图');
assert.ok(!select().includes('future-output'), 'new results never become source artwork');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assets').get().n, 11, 'filter never deletes file records');
assert.equal(db.prepare("SELECT id FROM assets WHERE id='output'").get().id, 'output', 'direct file/history access retained');
assert.equal(db.prepare('SELECT sample_asset_id FROM products').get().sample_asset_id, 'sample');
const route = readFileSync(new URL('../app/api/library/route.ts', import.meta.url), 'utf8');
assert.match(route, /where\(libraryAssetFilter\(/);
assert.match(route, /'Cache-Control': 'no-store'/);
const writer = readFileSync(new URL('../db/generation-tasks.ts', import.meta.url), 'utf8');
assert.match(writer, /'生成效果图'/, 'generation writer continues marking output provenance');
db.close();
console.log('PASS library filter: originals/frame/color retained; current, legacy and future outputs excluded; ownership and stored results preserved.');
