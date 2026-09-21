// Offline checks for the artwork library batch actions. No browser, no network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({}) });
  return module.exports;
}
const batch = load('../lib/artwork-batch.ts');

// --- Export naming must stay predictable and safe ------------------------------
assert.equal(batch.exportExtension('/api/files/abc.png'), 'png');
assert.equal(batch.exportExtension('/demo/a.JPG'), 'jpg');
assert.equal(batch.exportExtension('/demo/a.jpeg'), 'jpg');
assert.equal(batch.exportExtension('/demo/a.webp'), 'webp');
assert.equal(batch.exportExtension('/demo/a.gif'), 'png');           // unknown falls back
assert.equal(batch.exportExtension('/demo/a'), 'png');               // no extension at all
assert.equal(batch.exportExtension('/api/files/abc.png?download=1'), 'png');

assert.equal(batch.exportFileName('浅绿云雾山影', 0, '/demo/x.png'), '01-浅绿云雾山影.png');
assert.equal(batch.exportFileName('浅绿云雾山影', 9, '/demo/x.jpg'), '10-浅绿云雾山影.jpg');
assert.equal(batch.exportFileName('浅绿云雾山影', 99, '/demo/x.webp'), '100-浅绿云雾山影.webp');
// Path separators and control characters must never survive into an archive name.
assert.equal(batch.exportFileName('a/b\\c:d*e?f"g<h>i|j', 0, '/demo/x.png'), '01-a_b_c_d_e_f_g_h_i_j.png');
assert.equal(batch.exportFileName('line\nbreak', 0, '/demo/x.png'), '01-line_break.png');
assert.equal(batch.exportFileName('   ', 0, '/demo/x.png'), '01-图案.png');
assert.equal(batch.exportFileName('', 0, '/demo/x.png'), '01-图案.png');
assert.equal(batch.exportFileName('x'.repeat(120), 0, '/demo/x.png').length, 3 + 60 + 4);
assert.equal(batch.exportFileName('  多   空格  ', 0, '/demo/x.png'), '01-多 空格.png');

// --- Removal only hides an option; it never empties the library ----------------
assert.equal(batch.selectableAfterRemoval(['a', 'b', 'c'], ['b']).join(','), 'a,c');
assert.equal(batch.selectableAfterRemoval(['a', 'b', 'c'], ['a', 'b', 'c']).length, 0);
assert.equal(batch.selectableAfterRemoval(['a', 'b'], []).join(','), 'a,b');
assert.equal(batch.selectableAfterRemoval(['a', 'b'], ['zz']).join(','), 'a,b');

// --- The library must actually wire the batch UI up ---------------------------
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(page.includes('批量选择'), 'the toolbar offers a batch mode');
assert.ok(page.includes('className="gallery-bulk-bar"'), 'a bulk action bar renders');
assert.ok(page.includes('批量移除'), 'bulk removal is offered');
assert.ok(page.includes('导出 ZIP'), 'bulk export is offered');
assert.ok(page.includes('全选当前筛选'), 'select-all respects the current filter');
assert.ok(page.includes("import { zipSync } from 'fflate'"), 'the archive is built with the bundled zip library');
assert.ok(page.includes('zipSync(files, { level: 0 })'), 'the archive is assembled from the selected images');
assert.ok(page.includes('className="bulk-check"'), 'each card exposes a selection checkbox');
assert.ok(page.includes('onDeleteArtworks={removeArtworksBulk}'), 'the page passes a bulk removal handler');
assert.ok(page.includes('原始图片文件不会删除'), 'bulk removal keeps the same "file is not deleted" contract');
assert.ok(page.includes('className="bulk-hint"'), 'the bar states plainly that removal only hides the option');
assert.ok(page.includes('从图库选项移除'), 'the single-item action is labelled as a removal, not a file delete');
assert.ok(!page.includes('aria-label={`删除图案选项'), 'the artwork action no longer claims to delete');
assert.ok(!page.includes('aria-label={`删除框架选项'), 'the frame action no longer claims to delete either');
assert.ok(page.includes('aria-label={`从框架选项移除'), 'frame removal uses the same wording as artwork');
assert.ok(page.includes('原始框架文件不会删除'), 'frame removal keeps its "file is not deleted" contract');
assert.ok(page.includes('图库至少需要保留一个可选图案。'), 'bulk removal refuses to empty the library');
assert.ok(!page.includes('onDeleteArtworks={() => {}}'), 'no placeholder handler');
const css = readFileSync('app/globals.css', 'utf8');
assert.match(css, /\.gallery-bulk-bar\{/);
assert.match(css, /\.bulk-check\{/);
console.log('PASS artwork batch selection: export naming, hide-not-delete removal contract, and the library wiring.');
