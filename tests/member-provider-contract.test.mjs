// Execute our Apache-2.0 official RH_CLI adaptation without a Key or billable request.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function load(path) { const r = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' }); return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`); }
const { readMemberTask } = await load('lib/runninghub-member-query.ts');
for (const status of ['QUEUED','RUNNING','SUCCESS','FAILED']) {
  let calls = 0;
  const result = await readMemberTask('case-task', async (path, body) => { calls++; assert.equal(path, '/openapi/v2/query'); assert.deepEqual(body, { taskId: 'case-task' }); return { status, results: [{ outputUrl: 'https://www.runninghub.cn/x.png', outputType: 'png' }, { url: 'https://www.runninghub.cn/x.mp4', outputType: 'video' }] }; });
  assert.equal(result.status, status); assert.equal(calls, 1); assert.equal(result.results.length, 1);
}
await assert.rejects(readMemberTask('case-task', async () => ({ status: 'UNRECOGNIZED' })));
let calls = 0; await assert.rejects(readMemberTask('case-task', async () => { calls++; throw new Error('offline timeout'); })); assert.equal(calls, 1);
const { reconcileAppSetup, cleanAppSetup } = await load('lib/app-setup-storage.ts');
const { parseAppSpec, initialAppSetup, setupForReferences, compileAppInputs } = await load('lib/runninghub-app-schema.ts');
const nodes = [1,2,3].map((nodeId) => ({ nodeId, fieldName: 'image', fieldType: 'IMAGE' }));
nodes.push({ nodeId: 4, fieldName: 'prompt', fieldType: 'STRING', fieldValue: '' }, { nodeId: 4, fieldName: 'resolution', fieldType: 'LIST', fieldData: ['4k','8k'], fieldValue: '4k' });
const spec = await parseAppSpec('123', { nodeInfoList: nodes });
let setup = initialAppSetup(spec, 2); setup.values['4.resolution'] = '8k'; setup.referenceKeys = ['3.image','2.image']; setup.imageKeys = setup.referenceKeys;
const single = setupForReferences(spec, setup, 1); single.values = { ...single.values, '4.resolution': '4k' };
assert.deepEqual(setupForReferences(spec, single, 2).imageKeys, ['3.image','2.image']);
assert.equal(reconcileAppSetup(spec, setup, 2).setup.values['4.resolution'], '8k');
nodes.at(-1).fieldData = ['4k']; const changed = await parseAppSpec('123', { nodeInfoList: nodes });
const restored = reconcileAppSetup(changed, setup, 2); assert.ok(restored.review); assert.equal(restored.setup.values['4.resolution'], '4k');
const removed = { ...changed, fingerprint: 'new', fields: changed.fields.filter((f) => f.key !== '3.image') };
const broken = reconcileAppSetup(removed, setup, 2); assert.ok(broken.review); assert.throws(() => compileAppInputs(removed, broken.setup, ['f','a'], 'x'));
assert.equal(cleanAppSetup({ ...setup, values: { api_key: 'do-not-store' } }), null);
assert.equal(cleanAppSetup({ ...setup, imageKeys: [123] }), null);
const added = await parseAppSpec('123', { nodeInfoList: [...nodes, { nodeId: 9, fieldName: 'quality', fieldType: 'LIST', fieldData: ['expensive'], fieldValue: 'expensive' }] });
assert.ok(reconcileAppSetup(added, setup, 2).review);
console.log('PASS: pinned official query contract, no automatic resubmit, state normalization, validated schema reconciliation and reference roles.');
