// Exercise the shared controller with a tiny offline hook scheduler, not a browser.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const bundled = await build({ stdin: { contents: "export { useMemberApp } from './app/member-app-settings';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent', external: ['react/jsx-runtime'], plugins: [{ name: 'offline-hooks', setup(build) {
  build.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'test' }));
  build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useState = (...args) => globalThis.memberTestHooks.useState(...args); export const useRef = (...args) => globalThis.memberTestHooks.useRef(...args); export const useEffect = (...args) => globalThis.memberTestHooks.useEffect(...args);' }));
} }] });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { useMemberApp } = module.exports;
const slots = [];
let cursor = 0, dirty = false, effects = [], current;
globalThis.memberTestHooks = {
  useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, (next) => { const value = typeof next === 'function' ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
  useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
  useEffect(fn, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((value, j) => !Object.is(value, previous.deps[j]))) { slots[i] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
};
let props = { modelId: 'member-app-a', configured: false, configRevision: 0, referenceCount: 2 };
function render(changes = {}) { props = { ...props, ...changes }; let guard = 0; do { cursor = 0; dirty = false; current = useMemberApp(props); const pending = effects; effects = []; pending.forEach((fn) => fn()); assert.ok(++guard < 10, 'no hook loop'); } while (dirty); return current; }
const requests = [], originalFetch = globalThis.fetch;
const savedPreferences = new Map();
globalThis.fetch = (url, init) => {
  if (url.startsWith('/api/runninghub/preferences/')) {
    if (init.method === 'POST') { savedPreferences.set(url, JSON.parse(init.body)); return Promise.resolve(Response.json({ saved: true })); }
    return Promise.resolve(Response.json({ setup: savedPreferences.get(url) || null }));
  }
  return new Promise((resolve, reject) => requests.push({ url, init, resolve, reject }));
};
const spec = (appId) => ({ appId, name: appId, fingerprint: appId, fields: [
  { key: '1.image', nodeId: '1', fieldName: 'image', type: 'IMAGE', label: '框架', options: [], value: '' },
  { key: '2.image', nodeId: '2', fieldName: 'image', type: 'IMAGE', label: '图案', options: [], value: '' },
  { key: '3.prompt', nodeId: '3', fieldName: 'prompt', type: 'STRING', label: '要求', options: [], value: '' },
  { key: '4.resolution', nodeId: '4', fieldName: 'resolution', type: 'LIST', label: '清晰度', options: ['4k', '8k'], value: '4k' },
] });
async function settle(request, appId, status = 200) { request.resolve(new Response(JSON.stringify(status === 200 ? spec(appId) : { error: '测试读取失败' }), { status })); await new Promise(setImmediate); await new Promise(setImmediate); return render(); }
try {
  assert.equal(render().inputs, null); assert.equal(requests.length, 0);
  assert.equal(render({ configured: true, configRevision: 1 }).loading, true);
  assert.equal(requests.length, 1); assert.ok(requests[0].url.endsWith('member-app-a'));
  await settle(requests[0], 'a'); assert.equal(current.validation, '');
  current.update({ ...current.inputs.setup, values: { ...current.inputs.setup.values, '4.resolution': '8k' } }); render();
  // Mounting/unmounting presentational views does not change controller identity.
  render(); render(); assert.equal(requests.length, 1); assert.equal(current.inputs.setup.values['4.resolution'], '8k');
  render({ referenceCount: 1 }); assert.deepEqual(current.inputs.setup.imageKeys, ['2.image']); assert.equal(current.inputs.setup.values['4.resolution'], '8k');
  render({ referenceCount: 2 }); assert.deepEqual(current.inputs.setup.imageKeys, ['1.image', '2.image']); assert.equal(requests.length, 1);
  render({ modelId: 'member-app-b' }); assert.equal(current.inputs, null); assert.equal(requests[0].init.signal.aborted, true);
  render({ modelId: 'member-app-c' }); assert.equal(requests[1].init.signal.aborted, true);
  await settle(requests[1], 'b'); assert.equal(current.inputs, null); // Stale response cannot replace current app.
  await settle(requests[2], 'c'); assert.equal(current.inputs.spec.appId, 'c');
  // Replacing an already configured Key still invalidates and reloads metadata.
  render({ configRevision: 2 }); assert.equal(current.inputs, null); assert.equal(requests.length, 4);
  await settle(requests[3], 'c', 503); assert.equal(current.inputs, null); assert.equal(current.loading, false); assert.ok(current.error);
  current.reload(); render(); assert.equal(requests.length, 5); await settle(requests[4], 'c'); assert.ok(current.inputs);
  render({ modelId: '' }); assert.equal(current.inputs, null); assert.equal(current.loading, false); assert.equal(requests.length, 5);
  render({ modelId: 'member-app-d' }); await settle(requests[5], 'wrong-app'); assert.equal(current.inputs, null); assert.ok(current.error.includes('不匹配'));
  render({ modelId: 'member-app-a' }); await settle(requests[6], 'a'); assert.equal(current.inputs.setup.values['4.resolution'], '8k');
  current.reload(); render(); await settle(requests[7], 'a'); assert.equal(current.inputs.setup.values['4.resolution'], '8k');
  slots.forEach((slot) => slot.cleanup?.()); slots.length = 0;
  render(); await settle(requests[8], 'a'); assert.equal(current.inputs.setup.values['4.resolution'], '8k');
  assert.equal(current.review, '');
  for (const request of requests) { assert.ok(request.url.startsWith('/api/runninghub/apps/')); assert.ok(!request.init.method || request.init.method === 'GET'); }
  console.log('PASS: shared state survives navigation, output and reference selections stay aligned, old requests are aborted, changed Key reloads, failures/mismatches block ready state; no billable requests.');
} finally { globalThis.fetch = originalFetch; delete globalThis.memberTestHooks; }
