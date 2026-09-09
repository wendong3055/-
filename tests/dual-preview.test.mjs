// Synthetic, offline rendering and selection checks. No browser or generation.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const bundled = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { TrialCanvas, comparisonPicture } from './app/trial-canvas';
    export { comparisonPicture };
    export const render = (props) => renderToStaticMarkup(React.createElement(TrialCanvas, props));
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { render, comparisonPicture } = module.exports;
let submissions = 0;
const references = [{ src: '/artwork.png', label: '图案原图' }, { src: '/frame.png', label: '框架原图' }];
const base = {
  tasks: [], activeTaskId: '', working: false, status: '', loading: false,
  fallback: '等待生成', onSelect() {}, onReuse() {}, reuseDisabled: false, onHistory() {},
  onGenerate() { submissions++; }, canGenerate: true, generateLabel: '生成效果图', outputSummary: '测试设置', references,
};
const task = (id, status = 'succeeded') => ({ id, name: id, status, url: status === 'succeeded' ? `/api/files/${id}` : null, createdAt: 1, model: 'test' });
function checkWindows(markup) {
  assert.equal((markup.match(/class="preview-window"/g) || []).length, 2);
  assert.ok(markup.includes('A 窗口 · 参考 / 对比'));
  assert.ok(markup.includes('B 窗口 · 生成效果'));
  assert.ok(markup.includes('选择 A 窗口图片'));
  assert.ok(markup.includes('选择 B 窗口图片'));
  assert.ok(markup.includes('A 窗口缩小'));
  assert.ok(markup.includes('B 窗口缩小'));
  assert.ok(markup.includes('A 窗口全屏预览'));
  assert.ok(markup.includes('B 窗口全屏预览'));
  assert.equal((markup.match(/生成效果图 →/g) || []).length, 1);
  assert.ok(!markup.includes('两张对比'));
}
for (const tasks of [[], [task('one')], [task('two'), task('one')]]) checkWindows(render({ ...base, tasks }));
checkWindows(render({ ...base, references: [] }));
assert.equal(comparisonPicture('ref:1', references, []).src, '/frame.png');
assert.equal(comparisonPicture('ref:99', references, []).src, '/artwork.png');
assert.equal(comparisonPicture('task:missing', references, []).src, '/artwork.png');
assert.equal(comparisonPicture('task:missing', [], []), undefined);
assert.equal(comparisonPicture('task:one', references, [task('new'), task('one')]).task.id, 'one');
assert.equal(comparisonPicture('task:one', references, [task('one')]).task.id, 'one'); // Same image may occupy both windows.
assert.equal(comparisonPicture('task:pending', references, [task('pending', 'running')]).src, '/artwork.png');
const markup = render({ ...base, tasks: [task('new'), task('old')], activeTaskId: 'old', working: true, status: '正在生成' });
checkWindows(markup);
assert.ok(markup.includes('value="old" selected=""'));
assert.ok(markup.includes('完成后显示在 B'));
const imported = render({ ...base, tasks: [task('one')], importedResult: { url: 'blob:offline-import', name: '本地图片' } });
checkWindows(imported);
assert.ok(imported.includes('/artwork.png'));
assert.ok(imported.includes('blob:offline-import'));
assert.equal(submissions, 0);
const source = readFileSync('app/trial-canvas.tsx', 'utf8');
assert.ok(source.includes('studio-preview-height-${slot}'));
assert.ok(source.includes('setComparison(`task:${task.id}`) : onSelect(task.id)'));
assert.ok(readFileSync('app/page.tsx', 'utf8').includes('将 B 窗口的效果图保存为新品'));
assert.ok(readFileSync('app/workspace-refresh.css', 'utf8').includes('@container (max-width: 660px)'));
console.log('PASS: two permanent windows, empty/single/multiple results, pinned comparisons, per-window controls, local preview separation, B save mapping and no generation side effects.');
