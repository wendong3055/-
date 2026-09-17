// Offline checks for the frame-variant viewer. No browser, no paid calls.
// Values returned by the vm-loaded module are compared field by field: a
// deepEqual would fail on the cross-realm prototype, not on the value.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(path) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({}) });
  return module.exports;
}
const catalog = load('../lib/frame-catalog.ts');

// --- The bundled SKU index must match the images actually on disk -------------
const manifest = JSON.parse(read('../public/frames/fubao-ankang/sku-frame-index.json'));
assert.equal(manifest.skuCount, manifest.items.length, 'skuCount must match the number of entries');
assert.ok(manifest.items.length >= 30, 'the bundled index ships the full spec set');
assert.ok(manifest.items.some((item) => item.id === manifest.defaultSkuId), 'defaultSkuId must exist');

const parsed = catalog.parseFrameSkuIndex(manifest);
assert.equal(parsed.length, manifest.items.length, 'every shipped entry must survive parsing');
const ids = parsed.map((item) => item.id);
assert.equal(ids.length, new Set(ids).size, 'ids must be unique');
for (const item of parsed) {
  assert.ok(existsSync(new URL('../public' + item.thumb, import.meta.url)), 'missing image: ' + item.thumb);
  assert.ok(item.name, 'every entry needs a label');
  assert.ok(item.totalWidth > 0 && item.height > 0, 'every entry needs real dimensions');
}

// --- Untrusted manifest input must not become an arbitrary image source ------
const hostile = catalog.parseFrameSkuIndex({ items: [
  { id: 'ok', name: '可用', thumb: '/frames/fubao-ankang/60-200.jpg', totalWidth: 60, height: 200 },
  { id: 'ok', name: '重复 id', thumb: '/frames/fubao-ankang/60-220.jpg' },
  { id: 'remote', name: '外部地址', thumb: 'https://evil.invalid/a.png' },
  { id: 'traversal', name: '越权路径', thumb: '/frames/../../etc/passwd' },
  { id: 'protocol', name: '协议相对', thumb: '//evil.invalid/frames/a.png' },
  { id: 'quote', name: '引号注入', thumb: '/frames/a".png' },
  { name: '没有 id', thumb: '/frames/fubao-ankang/60-230.jpg' },
  { id: 'nolabel', name: '   ', thumb: '/frames/fubao-ankang/80-200.jpg' },
  null,
  'not-an-object',
] });
assert.equal(hostile.length, 1, 'only the safe, unique, complete entry survives');
assert.equal(hostile[0].id, 'ok');
assert.equal(hostile[0].thumb, '/frames/fubao-ankang/60-200.jpg');
assert.equal(catalog.parseFrameSkuIndex(null).length, 0);
assert.equal(catalog.parseFrameSkuIndex({ items: 'nope' }).length, 0);
assert.equal(catalog.safeFrameThumb('/frames/a.png'), '/frames/a.png');
assert.equal(catalog.safeFrameThumb(' /frames/a.png '), '/frames/a.png');
assert.equal(catalog.safeFrameThumb('/other/a.png'), null);

// --- One flat image list per style, from whichever source it has -------------
const skuImages = catalog.frameVariantImages({ name: '款式', file: '/frames/style-previews/x.png', skuItems: parsed });
assert.equal(skuImages.length, parsed.length, 'the SKU index wins over the single preview');
assert.equal(skuImages[0].src, parsed[0].thumb);
assert.match(skuImages[0].note, /×200cm/);

const sizes = [{ key: 'k', widthCm: 80, heightCm: 200, depthCm: 30, widthParts: [80], sourceIds: ['1', '2'], sourceUrls: ['/api/files/1', '/api/files/2'] }];
const uploaded = catalog.frameVariantImages({ name: '上传款式', sizes });
assert.equal(uploaded.length, 2, 'an uploaded style exposes every recognised source image');
assert.equal(uploaded[0].src, '/api/files/1');
assert.equal(uploaded[1].src, '/api/files/2');
assert.equal(uploaded[0].label, '80×200cm');
assert.equal(uploaded[0].note, '80cm · 深30cm');

const single = catalog.frameVariantImages({ name: '单图款式', file: '/frames/style-previews/y.png' });
assert.equal(single.length, 1);
assert.equal(single[0].src, '/frames/style-previews/y.png');
assert.equal(single[0].label, '单图款式');
assert.equal(catalog.frameVariantImages({ name: '没有图' }).length, 0);
assert.equal(catalog.frameVariantImages({ name: '空规格', sizes: [{ key: 'k', widthCm: 1, heightCm: 1, widthParts: [1], sourceIds: [], sourceUrls: [] }] }).length, 0);

// --- The frames library must actually wire the viewer up ---------------------
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(page.includes('onDoubleClick={(event) => { event.preventDefault(); void openFrameVariants(item); }}'), 'double-click opens the viewer');
assert.ok(page.includes("skuIndex: '/frames/fubao-ankang/sku-frame-index.json'"), 'the bundled style points at its index');
assert.ok(page.includes('{frameVariants && <dialog open className="frame-variant-dialog"'), 'the viewer renders as a dialog');
assert.ok(page.includes('onClick={() => setZoomedVariant(image)}'), 'a thumbnail enlarges on click');
assert.ok(page.includes("if (event.key === 'Escape') closeFrameVariants();"), 'Escape closes the viewer');
const css = readFileSync('app/globals.css', 'utf8');
assert.match(css, /\.frame-variant-dialog\{[^}]*position:\s*fixed/);
assert.match(css, /\.frame-variant-grid\{[^}]*grid-template-columns:\s*repeat\(auto-fill/);
console.log('PASS frame SKU index integrity, safe manifest parsing, one flat image list per style, and the double-click viewer wiring.');
