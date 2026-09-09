// Public AI-app metadata format, no credentials or billable calls.
// Source: https://www.runninghub.cn/ai-detail/2061718706446753793
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['lib/runninghub-app-schema.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { parseAppSpec, appOutputField, initialAppSetup, compileAppInputs } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const choice = (fieldName, fieldData, fieldValue) => ({ nodeId: '1', fieldName, fieldType: 'LIST', fieldData, fieldValue });
const nodes = [
  { nodeId: '2', fieldName: 'image', fieldType: 'IMAGE' },
  { nodeId: '1', fieldName: 'prompt', fieldType: 'STRING' },
  choice('resolution', '[["4k", "8k"], {"default": "8k"}]', '4k'),
  choice('aspectRatio', '[["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"], {"default": "3:4"}]', '16:9'),
];
const spec = await parseAppSpec('2061718706446753793', { nodeInfoList: nodes });
assert.deepEqual(appOutputField(spec, 'resolution').options, ['4k', '8k']);
assert.equal(appOutputField(spec, 'resolution').value, '4k');
assert.equal(appOutputField(spec, 'ratio').options.length, 10);
assert.equal(appOutputField(spec, 'ratio').value, '16:9');
const setup = initialAppSetup(spec, 1);
setup.values['1.aspectRatio'] = '3:4';
setup.values['1.resolution'] = '8k';
const inputs = compileAppInputs(spec, setup, ['test.png'], 'test');
assert.equal(inputs.find(n => n.fieldName === 'aspectRatio').fieldValue, '3:4');
assert.equal(inputs.find(n => n.fieldName === 'resolution').fieldValue, '8k');
setup.values['1.resolution'] = '2k';
assert.throws(() => compileAppInputs(spec, setup, ['test.png'], 'test'), /不支持/);
for (const fieldData of ['[]', '[[], {"default":"4k"}]', '{"default":"4k"}', 'not-json', '[[["4k"]], {}]']) {
  await assert.rejects(parseAppSpec('test', { nodeInfoList: [choice('resolution', fieldData, '4k')] }), /选项列表/);
}
const numeric = await parseAppSpec('test', { nodeInfoList: [choice('steps', [[1, 2], {default: 3}], '2')] });
assert.deepEqual(numeric.fields[0].options, ['1', '2']);
console.log('PASS: real nested member choices, camelCase ratio, upstream current value, enum submission and malformed-option rejection.');
