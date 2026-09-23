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
assert.ok(mainEmpty.includes('所选图案、框架与场景参考'));
const withScene = render({ ...base, references: [...references, { src: '/scene.png', label: '场景参考 · 现代木色门厅' }] });
checkWindow(withScene);
const withSceneMain = withScene.slice(0, withScene.indexOf('<dialog'));
assert.equal((withSceneMain.match(/<figure/g) || []).length, 3); // A selected scene adds a third cell.
assert.ok(withScene.includes('with-scene-reference'));
assert.ok(withScene.includes('src="/scene.png"'));
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
// The scene slot needs its own column rule; the markup emitted the class with
// no matching CSS, so the third cell used to wrap onto a second row.
assert.match(css, /\.reference-pair-preview\.with-scene-reference \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.ok(css.includes('.trial-dialog > .reference-pair-preview { flex: 1; min-height: 0;'));
assert.ok(!css.includes('.dual-preview-grid'));
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(page.includes('nextStep={!production && !importedResult'));
assert.ok(!page.includes('className="create-cta"'));
const savedTask = { ...task('sample'), assetId: 'sample', recipe: { artworkId: 'art', frameId: 'frame', colorId: 'walnut' } };
const nextStep = { onConfirm() { throw new Error('must not confirm during render'); }, saving: false };
const nextMarkup = render({ ...base, tasks: [savedTask], nextStep });
assert.ok(nextMarkup.includes('确认样图，进入下一步'));
assert.ok(nextMarkup.includes('重新生成样图'));
assert.ok(!nextMarkup.includes('继续下一轮'));
assert.ok(nextMarkup.indexOf('确认样图，进入下一步') < nextMarkup.indexOf('trial-history'));
assert.ok(nextMarkup.includes('不会重新生成样图，也不会扣费'));
assert.ok(nextMarkup.includes('下一步：制作主图、尺寸图和详情页'));
assert.ok(!nextMarkup.includes('进入背景制作'));
assert.ok(render({ ...base, tasks: [savedTask], nextStep: {...nextStep, saving: true} }).includes('disabled="">正在进入…'));
assert.ok(render({ ...base, tasks: [savedTask], working: true, nextStep }).includes('disabled="">确认样图，进入下一步'));
assert.ok(!render({ ...base, tasks: [savedTask], nextStep, importedResult: { url: 'blob:local', name: 'local' } }).includes('确认样图，进入下一步'));
const legacy = render({ ...base, tasks: [task('legacy')], nextStep });
assert.ok(legacy.includes('disabled="">确认样图，进入下一步'));
assert.ok(legacy.includes('缺少原始搭配记录'));
assert.ok(!legacy.includes('继续下一轮'));
assert.ok(!render({ ...base, tasks: [savedTask] }).includes('确认样图，进入下一步'));
assert.ok(!page.includes('B 窗口'));
assert.ok(page.indexOf('<details className="local-preview-import">') > page.indexOf('<TrialCanvas'));
console.log('PASS: single output window, two equal full-height reference cells plus a third for a scene, missing references, full-window results/imports, safe history selection and unchanged generation.');

// Invoke the rendered event handlers with inert hooks: next-step must call
// confirmation only, while the separately labelled retry calls generation.
const interactive = await build({
  stdin: { contents: `export { TrialCanvas } from './app/trial-canvas';`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',
  plugins:[{name:'inert-hooks',setup(b){
    b.onResolve({filter:/^react$/},args=>args.importer.endsWith('trial-canvas.tsx')?{path:'hooks',namespace:'test-hooks'}:undefined);
    b.onLoad({filter:/.*/,namespace:'test-hooks'},()=>({contents:'export const useState = x => [typeof x === "function" ? x() : x, () => {}]; export const useRef = x => ({current:x}); export const useEffect = () => {};',loader:'js'}));
  }}],
});
const handlers = {exports:{}};
new Function('require','module','exports',interactive.outputFiles[0].text)(createRequire(import.meta.url),handlers,handlers.exports);
let confirmations=0;
const tree=handlers.exports.TrialCanvas({...base,tasks:[savedTask],nextStep:{onConfirm(){confirmations++;},saving:false}});
function elements(node){if(Array.isArray(node))return node.flatMap(elements);if(!node||typeof node!=='object')return [];return [node,...elements(node.props?.children)];}
function label(node){if(Array.isArray(node))return node.map(label).join('');if(node==null||typeof node==='boolean')return '';return typeof node==='object'?label(node.props?.children):String(node);}
const buttons=elements(tree).filter(n=>n.type==='button');
buttons.find(n=>label(n).includes('确认样图，进入下一步')).props.onClick();
assert.equal(confirmations,1);assert.equal(submissions,0);
buttons.find(n=>label(n)==='重新生成样图').props.onClick();
assert.equal(confirmations,1);assert.equal(submissions,1);
const confirmBody=page.slice(page.indexOf('async function createProduct()'),page.indexOf('function resetPreview()'));
assert.ok(confirmBody.includes("fetch('/api/products'"));
assert.ok(confirmBody.includes('sampleAssetId: displayedTask.assetId'));
assert.ok(confirmBody.includes("setActiveNav('products')"));
assert.ok(!/\/api\/generations|onGenerate|submitGeneration/.test(confirmBody));
console.log('PASS: next-step click confirms existing sample without generating; retry is a separate action.');
