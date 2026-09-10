// Offline synthetic rendering/layout-contract checks; no browser or paid calls.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const bundled = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { TrialCanvas } from './app/trial-canvas';
    export const render = (props) => renderToStaticMarkup(React.createElement(TrialCanvas, props));
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { render } = module.exports;
let submissions = 0;
const references = [{ src: '/artwork.png', label: '图案原图' }, { src: '/frame.png', label: '框架原图' }];
const base = {
  tasks: [], activeTaskId: '', working: false, status: '', loading: false,
  onSelect() {}, onReuse() {}, reuseDisabled: false, onHistory() {},
  onGenerate() { submissions++; }, canGenerate: true, generateLabel: '生成效果图', outputSummary: '测试设置', references,
};
const task = (id, status = 'succeeded') => ({ id, name: id, status, url: status === 'succeeded' ? `/api/files/${id}` : null, createdAt: 1, model: 'test' });
function checkWindow(markup) {
  assert.equal((markup.match(/class="preview-window output-preview-window"/g) || []).length, 1);
  for (const removed of ['A 窗口', 'B 窗口', '参考 / 对比', 'DESIGN CANVAS', '第一张效果图，从这组搭配开始', 'preview-pair', 'dual-preview-grid']) assert.ok(!markup.includes(removed), removed);
  assert.ok(markup.includes('全屏效果预览'));
  assert.ok(markup.includes('调整预览高度'));
  assert.equal((markup.match(/生成效果图 →/g) || []).length, 1);
}
const empty = render(base);
checkWindow(empty);
const mainEmpty = empty.slice(0, empty.indexOf('<dialog'));
assert.equal((mainEmpty.match(/<figure/g) || []).length, 2);
assert.ok(mainEmpty.includes('图案与框架，各占一半'));
assert.ok(mainEmpty.includes('src="/artwork.png"'));
assert.ok(mainEmpty.includes('src="/frame.png"'));
assert.ok(!mainEmpty.includes('disabled=""'));
assert.ok(!mainEmpty.includes('trial-empty'));
assert.ok(!mainEmpty.includes('选择预览图片')); // No inert result selector before first generation.
for (const refs of [[], references.slice(0, 1)]) {
  const markup = render({ ...base, references: refs });
  checkWindow(markup);
  assert.ok(markup.includes('此框架暂无原图'));
  if (!refs.length) assert.ok(markup.includes('请选择图案'));
}
for (const tasks of [[task('one')], [task('two'), task('one')]]) {
  const markup = render({ ...base, tasks });
  checkWindow(markup);
  assert.ok(markup.includes(`src="/api/files/${tasks[0].id}"`));
  assert.ok(!markup.includes('reference-pair-preview')); // Output gets the whole viewport.
}
const running = render({ ...base, tasks: [task('new', 'running'), task('old')], activeTaskId: 'new', working: true, status: '正在生成' });
checkWindow(running);
assert.ok(running.includes('src="/api/files/old"'));
assert.ok(running.includes('完成后自动显示效果图'));
const historical = render({ ...base, tasks: [task('new'), task('old')], activeTaskId: 'old' });
assert.ok(historical.includes('value="old" selected=""'));
const imported = render({ ...base, tasks: [task('one')], importedResult: { url: 'blob:offline-import', name: '本地图片' } });
checkWindow(imported);
assert.ok(imported.includes('blob:offline-import'));
assert.ok(!imported.includes('reference-pair-preview'));
assert.equal(submissions, 0);
const css = readFileSync('app/workspace-refresh.css', 'utf8');
assert.match(css, /\.reference-pair-preview \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*height: 100%/);
assert.ok(css.includes('.trial-dialog > .reference-pair-preview { flex: 1; min-height: 0;'));
assert.ok(!css.includes('.dual-preview-grid'));
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(page.includes('确认样图，进入新品制作'));
assert.ok(!page.includes('B 窗口'));
assert.ok(page.indexOf('<details className="local-preview-import">') > page.indexOf('<TrialCanvas'));
console.log('PASS: single output window, two equal full-height reference cells, missing references, full-window results/imports, safe history selection and unchanged generation.');
