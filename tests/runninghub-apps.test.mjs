// Offline fixtures only: no credentials, reference uploads or billable generation.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

async function load(entry, auth = false) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', plugins: auth ? [{ name: 'test-auth', setup(b) {
    b.onResolve({ filter: /generation-auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export async function generationOwner() { return globalThis.testCatalogOwner; }' }));
  } }] : [] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const lib = await load('lib/runninghub-apps.ts');
const data = [
  { title: 1, jumpUrl: 2 }, '全能图片2.0', 'https://www.runninghub.cn/ai-detail/2027211316242423809?from=home',
  { title: 4, jumpUrl: 5 }, '高清图片修复', 'https://www.runninghub.cn/ai-detail/1965719821155500034',
  { title: 7, jumpUrl: 8 }, '图生视频', 'https://www.runninghub.cn/ai-detail/2085886991404720129',
  { title: 10, jumpUrl: 11 }, '图片编辑', 'https://evil.invalid/ai-detail/2027211316242423809',
  { title: 1, jumpUrl: 2 },
];
const html = `<script type="application/json" id="__NUXT_DATA__">${JSON.stringify(data)}</script>`;
const apps = lib.parseRunningHubApps(html);
assert.equal(apps.length, 2);
assert.equal(apps[0].url, 'https://www.runninghub.cn/ai-detail/2027211316242423809');
assert.equal(apps[1].kind, '图片处理');
for (const bad of ['javascript:alert(1)', 'https://www.runninghub.cn.evil.invalid/ai-detail/123456789012', 'https://x@www.runninghub.cn/ai-detail/123456789012', 'http://www.runninghub.cn/ai-detail/123456789012', 'https://www.runninghub.cn:444/ai-detail/123456789012', 'https://www.runninghub.cn/api/run']) assert.equal(lib.appFromLink('图片', bad), null);
assert.throws(() => lib.parseRunningHubApps('<script>throw new Error()</script>'));
assert.throws(() => lib.parseRunningHubApps('<script id="__NUXT_DATA__">{}</script>'));
assert.equal((await lib.readRunningHubApps(async (url, init) => {
  assert.equal(url, lib.runningHubAppsSource);
  assert.equal(init.redirect, 'error');
  assert.equal(Object.keys(init.headers).join(), 'Accept');
  return new Response(html);
})).length, 2);
await assert.rejects(lib.readRunningHubApps(async () => new Response('failed', { status: 503 })));
await assert.rejects(lib.readRunningHubApps(async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))));
const route = await load('app/api/runninghub-apps/route.ts', true);
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async () => { calls++; return new Response(html); };
try {
  globalThis.testCatalogOwner = null;
  assert.equal((await route.GET(new Request('https://studio.invalid/api/runninghub-apps'))).status, 401);
  assert.equal(calls, 0);
  globalThis.testCatalogOwner = 'owner';
  const response = await route.GET(new Request('https://studio.invalid/api/runninghub-apps'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).apps.length, 2);
  globalThis.fetch = async () => { throw new Error('private upstream detail'); };
  const failed = await route.GET(new Request('https://studio.invalid/api/runninghub-apps'));
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes('private upstream'));
} finally { globalThis.fetch = originalFetch; }
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(!page.includes('window.open('));
assert.ok(page.includes('generations.submit(form)'));
assert.ok(!page.includes('rhtv.runninghub.cn'));
assert.ok(page.includes('模型与出图设置'));
console.log('PASS: catalog parsing, image filtering, URL allowlist, dedup, payload bounds, source-only fetch, authorization, safe errors and direct generation (no website handoff).');
