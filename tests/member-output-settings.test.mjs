// Offline UI contracts and schema payload checks. No browser or billable provider requests.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const bundle = await build({ stdin: { contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import Home from './app/page';
  import { MemberOutputOptions, MemberAppSettings } from './app/member-app-settings';
  export * from './lib/runninghub-app-schema';
  export const home = () => renderToStaticMarkup(React.createElement(Home));
  export const output = (controller, disabled = false) => renderToStaticMarkup(React.createElement(MemberOutputOptions, {controller, disabled, onSettings() {}, onChange() {}}));
  export const backend = (controller) => renderToStaticMarkup(React.createElement(MemberAppSettings, {controller, referenceCount: 2, disabled: false}));
`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' } });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { home, output, backend, parseAppSpec, initialAppSetup, compileAppInputs, appOutputField, appOutputSetting, setupForReferences } = module.exports;
const node = (fieldName, fieldType, fieldValue, fieldData = [], description = fieldName) => ({ nodeId: '10', fieldName, fieldType, fieldValue, fieldData, description });
const spec = await parseAppSpec('test', { webappName: '测试会员应用', nodeInfoList: [
  node('image1', 'IMAGE', 'sample-a'), node('image2', 'IMAGE', 'sample-b'), node('unused', 'IMAGE', 'sample-c'),
  node('prompt', 'STRING', ''), node('negative', 'STRING', 'blur'),
  node('aspect_ratio', 'LIST', '1:1', ['1:1', '3:4', '16:9']),
  node('resolution', 'LIST', '4k', ['4k', '8k']), node('quality', 'LIST', 'standard', ['standard', 'ultra']),
  node('model', 'LIST', 'pro', ['pro', 'max']), node('batch_size', 'INT', '1'),
] });
let setup = initialAppSetup(spec, 2);
setup = { ...setup, values: { ...setup.values, '10.aspect_ratio': '3:4', '10.resolution': '8k', '10.quality': 'ultra', '10.model': 'max' } };
const controller = { inputs: { spec, setup }, configured: true, loading: false, error: '', validation: '', update() {}, reload() {} };
const view = output(controller);
for (const label of ['图片比例', '清晰度 / 分辨率', '生成质量', '应用内模型']) assert.ok(view.includes(label));
for (const value of ['3:4', '8k', 'ultra', 'max']) assert.ok(view.includes(`value="${value}" selected=""`));
for (const technical of ['制作要求对应的输入', '框架参考图', '图案参考图', 'API Key', 'batch_size', 'negative']) assert.ok(!view.includes(technical));
const bound = backend(controller);
for (const label of ['制作要求对应的输入', '框架参考图', '图案参考图', '其他应用参数']) assert.ok(bound.includes(label));
assert.ok(!bound.includes('value="8k"'));
assert.ok(!bound.includes('value="3:4"'));
const payload = compileAppInputs(spec, setup, ['frame-file', 'art-file'], '新制作要求');
for (const [fieldName, fieldValue] of [['aspect_ratio', '3:4'], ['resolution', '8k'], ['quality', 'ultra'], ['model', 'max'], ['image1', 'frame-file'], ['image2', 'art-file'], ['unused', ''], ['batch_size', '1']]) assert.equal(payload.find((field) => field.fieldName === fieldName).fieldValue, fieldValue);
assert.equal(appOutputSetting(spec, setup, 'ratio'), '3:4');
assert.equal(appOutputSetting(spec, setup, 'resolution'), '8k');
assert.throws(() => compileAppInputs(spec, { ...setup, values: { ...setup.values, '10.resolution': '2k' } }, ['f', 'a'], 'x'));
assert.throws(() => compileAppInputs(spec, { ...setup, fingerprint: 'stale' }, ['f', 'a'], 'x'));
assert.throws(() => compileAppInputs(spec, { ...setup, imageKeys: ['10.image1', '10.image1'] }, ['f', 'a'], 'x'));
const single = setupForReferences(spec, setup, 1);
assert.deepEqual(single.imageKeys, ['10.image2']);
assert.deepEqual(setupForReferences(spec, single, 2).imageKeys, ['10.image1', '10.image2']);
assert.equal(single.values['10.resolution'], '8k');

for (const state of [
  { configured: false }, { configured: true, loading: true }, { configured: true, error: '读取失败' },
]) {
  const markup = output({ ...controller, inputs: null, ...state });
  assert.ok(markup.includes('图片比例'));
  assert.ok(markup.includes('清晰度 / 分辨率'));
  assert.equal((markup.match(/<select disabled/g) || []).length, 2);
  assert.ok(!markup.includes('16:9')); // No invented defaults before metadata exists.
  if (!state.loading) assert.ok(markup.includes('后台设置'));
}
const noOutputSpec = { ...spec, fields: spec.fields.filter((field) => !['aspect_ratio', 'resolution', 'quality', 'model'].includes(field.fieldName)) };
assert.ok(output({ ...controller, inputs: { spec: noOutputSpec, setup } }).includes('由应用自动决定'));
const aliasSpec = { ...spec, fields: [node('x', 'LIST', '3:4', ['3:4'])].map((field) => ({ ...field, key: 'x', type: 'LIST', options: ['3:4'], value: '3:4', label: '画面比例' })) };
assert.equal(appOutputField(aliasSpec, 'ratio').key, 'x');
assert.equal(appOutputSetting(aliasSpec, { ...setup, values: { x: '3:4' } }, 'ratio'), '3:4');
const main = home();
assert.ok(main.includes('模型与出图设置'));
assert.ok(main.includes('图片比例'));
assert.ok(main.indexOf('studio-output-panel') < main.indexOf('artwork-choice-section'));
assert.ok(!main.includes('type="password"'));
assert.ok(!main.includes('应用输入绑定'));
assert.ok(!main.includes('rh-connection'));
assert.ok(main.includes('待设置'));
const source = readFileSync('app/page.tsx', 'utf8');
assert.ok(source.indexOf('useMemberApp({') < source.indexOf('<main className="app-shell">'));
assert.ok(source.indexOf('<RunningHubSettings') > source.indexOf("{activeNav === 'settings'"));
assert.ok(source.includes("form.set('appSetup', JSON.stringify(memberInputs.setup))"));
assert.ok(source.includes("['gallery','frames','colors'].includes(activeNav) && <SecondaryView"));
console.log('PASS: prominent output controls, backend-only wiring, honest unavailable states, real supported settings in payload and summary, reference mapping, existing validation.');
