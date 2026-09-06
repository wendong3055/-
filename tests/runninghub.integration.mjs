// Offline integration checks. No provider calls or real credentials are used.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';

const sqlite = new DatabaseSync(':memory:');
for (const name of readdirSync('drizzle').filter((name) => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, 'utf8'));
const storage = new Map();
const db = {
  prepare(sql) {
    return { bind(...args) {
      const statement = sqlite.prepare(sql);
      return {
        first: async () => statement.get(...args) ?? null,
        all: async () => ({ results: statement.all(...args) }),
        run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }),
      };
    } };
  },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
const testContext = { user: { userId: 'owner-1', email: 'test@example.invalid' }, env: {
  DB: db, RUNNINGHUB_API_KEY: 'offline-test-key', FILES: { async put(key, bytes) { storage.set(key, bytes); } },
} };
globalThis.__runningHubTest = testContext;

async function load(entry) {
  const output = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{
    name: 'offline-test-adapter', setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$|^next\/server$|chatgpt-auth$/ }, (args) => ({ path: args.path, namespace: 'offline' }));
      builder.onLoad({ filter: /.*/, namespace: 'offline' }, ({ path }) => ({ contents: path === 'cloudflare:workers'
        ? 'export const env = globalThis.__runningHubTest.env;'
        : path === 'next/server' ? 'export const NextResponse = { json: (body, init) => Response.json(body, init) };'
        : 'export async function getChatGPTUser() { return globalThis.__runningHubTest.user; }', loader: 'js' }));
    },
  }] });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}

const create = await load('app/api/generate-preview/route.ts');
const query = await load('app/api/generations/[id]/route.ts');
const resolve = await load('app/api/generations/[id]/resolve/route.ts');
const list = await load('app/api/generations/route.ts');
const config = await load('app/api/runninghub/config/route.ts');
const provider = await load('lib/runninghub.ts');
const taskStore = await load('db/generation-tasks.ts');
const limitedForm = await load('lib/limited-form.ts');
const productRoutes = await load('app/api/products/route.ts');
const origin = 'https://studio.example';
let submissions = 0;
let providerStatus = 'RUNNING';
let failSubmit = false;
let failUpload = false;
let outputUrl = 'https://www.runninghub.ai/results/test.png';
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('/media/upload/binary')) {
    if (failUpload) throw new Error('offline upload timeout');
    assert.equal(options.headers.authorization, 'Bearer offline-test-key');
    assert.ok(options.body.get('file') instanceof File);
    return Response.json({ code: 200, data: { download_url: 'https://www.runninghub.ai/references/test.png' } });
  }
  if (target.endsWith('/rhart-image-g-2-official/image-to-image')) {
    submissions++;
    assert.equal(options.headers.authorization, 'Bearer offline-test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.quality, 'medium'); assert.equal(body.resolution, '2k');
    assert.ok(body.prompt.includes('画芯')); assert.equal(body.imageUrls.length, 2);
    if (failSubmit) throw new Error('offline uncertain submission');
    return Response.json({ taskId: `provider-${submissions}`, status: 'QUEUED' });
  }
  if (target.endsWith('/openapi/v2/query')) return Response.json({ taskId: JSON.parse(options.body).taskId, status: providerStatus, results: providerStatus === 'SUCCESS' ? [{ outputType: 'image', url: outputUrl }] : [] });
  if (target === outputUrl && target.startsWith('https://www.runninghub.ai/')) return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { 'content-type': 'image/png' } });
  throw new Error(`Unexpected network attempt blocked: ${target}`);
};

function request(id, overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ requestId: id, artworkName: '测试画芯', frameName: '测试框架', colorName: '胡桃木色', colorId: 'walnut', aspectRatio: '16:9', resolution: '2k', ...overrides })) form.set(key, value);
  form.set('artwork', new File(['art'], 'art.png', { type: 'image/png' }));
  form.set('frame', new File(['frame'], 'frame.png', { type: 'image/png' }));
  return new Request(`${origin}/api/generate-preview`, { method: 'POST', headers: { origin }, body: form });
}
const check = async (name, action) => { await action(); process.stdout.write(`PASS ${name}\n`); };
const context = (id) => ({ params: Promise.resolve({ id }) });
const resetPoll = () => sqlite.exec('UPDATE generation_tasks SET last_polled_at = 0');
let first = crypto.randomUUID();

await check('rejects anonymous and cross-site generation before any upload', async () => {
  testContext.user = null;
  assert.equal((await create.POST(request(first))).status, 401);
  testContext.user = { userId: 'owner-1', email: 'test@example.invalid' };
  const crossSite = request(first); crossSite.headers.set('origin', 'https://untrusted.example');
  assert.equal((await create.POST(crossSite)).status, 401);
  assert.equal(submissions, 0);
});
await check('config never returns the API key and missing-key calls do not submit', async () => {
  const result = await (await config.GET()).json(); assert.equal(result.configured, true);
  assert.ok(!JSON.stringify(result).includes('offline-test-key'));
  testContext.env.RUNNINGHUB_API_KEY = '';
  assert.equal((await create.POST(request(first))).status, 503);
  testContext.env.RUNNINGHUB_API_KEY = 'offline-test-key';
});
await check('submits references and deduplicates repeated request IDs', async () => {
  assert.equal((await create.POST(request(first))).status, 202);
  assert.equal((await create.POST(request(first))).status, 200);
  assert.equal(submissions, 1);
  assert.equal((await create.POST(request(crypto.randomUUID()))).status, 409);
});
await check('task reads remain owner-scoped', async () => {
  testContext.user.userId = 'owner-2';
  assert.equal((await query.GET(new Request(origin), context(first))).status, 404);
  assert.deepEqual(await (await list.GET()).json(), []);
  testContext.user.userId = 'owner-1';
});
await check('query transitions to running without another billable request', async () => {
  const result = await (await query.GET(new Request(origin), context(first))).json();
  assert.equal(result.status, 'running'); assert.equal(submissions, 1);
});
await check('success saves real bytes and owned asset metadata idempotently', async () => {
  providerStatus = 'SUCCESS'; resetPoll();
  const result = await (await query.GET(new Request(origin), context(first))).json();
  assert.equal(result.status, 'succeeded'); assert.equal(result.url, `/api/files/${first}`);
  assert.equal(storage.size, 1); assert.equal(sqlite.prepare('SELECT count(*) AS n FROM assets').get().n, 1);
  await query.GET(new Request(origin), context(first)); assert.equal(submissions, 1);
});
await check('a terminal task cannot regress from a late polling update', async () => {
  await taskStore.updateTask('owner-1', first, 'running');
  assert.equal((await taskStore.getTask('owner-1', first)).status, 'succeeded');
});
await check('confirmed products retain the owned sample and repeated saves are idempotent', async () => {
  const body = { artworkId: 'artwork-test', artworkName: '画芯', frameId: 'frame-test', frameName: '框架', sampleAssetId: first };
  const save = () => productRoutes.POST(new Request(`${origin}/api/products`, { method: 'POST', headers: { origin }, body: JSON.stringify(body) }));
  assert.equal((await save()).status, 201); assert.equal((await save()).status, 201);
  const row = sqlite.prepare('SELECT * FROM products').get();
  assert.equal(row.sample_asset_id, first); assert.equal(row.status, 'approved');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM products').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM jobs').get().n, 3);
});
await check('ambiguous billable timeout is locked and is never automatically resubmitted', async () => {
  first = crypto.randomUUID(); failSubmit = true;
  assert.equal((await create.POST(request(first))).status, 502);
  assert.equal(sqlite.prepare('SELECT status FROM generation_tasks WHERE id = ?').get(first).status, 'unknown');
  await create.POST(request(first)); assert.equal(submissions, 2);
  assert.equal((await create.POST(request(crypto.randomUUID()))).status, 409);
  const result = await resolve.POST(new Request(origin, { method: 'POST', headers: { origin }, body: JSON.stringify({ confirmedNoTask: true }) }), context(first));
  assert.equal(result.status, 200); failSubmit = false;
});
await check('upload failure never invokes the billable model', async () => {
  failUpload = true;
  assert.equal((await create.POST(request(crypto.randomUUID()))).status, 502);
  assert.equal(submissions, 2); failUpload = false;
});
await check('completed upstream results with unsafe URLs never become successful local tasks', async () => {
  first = crypto.randomUUID(); await create.POST(request(first));
  outputUrl = 'http://127.0.0.1/private'; resetPoll();
  const result = await (await query.GET(new Request(origin), context(first))).json();
  assert.equal(result.status, 'saving'); assert.equal(result.url, null);
  assert.ok(result.error.includes('安全校验'));
  await assert.rejects(provider.downloadResult('https://www.runninghub.ai.attacker.invalid/test.png'));
});
await check('poll lease excludes concurrent queries until its exact token is released', async () => {
  resetPoll();
  const lease = await taskStore.claimPoll('owner-1', first); assert.ok(lease);
  assert.equal(await taskStore.claimPoll('owner-1', first), null);
  await taskStore.releasePoll('owner-1', first, lease - 1);
  assert.equal(await taskStore.claimPoll('owner-1', first), null);
  await taskStore.releasePoll('owner-1', first, lease);
  assert.ok((await taskStore.getTask('owner-1', first)).last_polled_at < lease);
});
await check('a retry database lookup failure never unlocks an existing paid task', async () => {
  const originalPrepare = db.prepare;
  let failOnce = true;
  db.prepare = (sql) => {
    if (failOnce && sql.startsWith('SELECT * FROM generation_tasks')) { failOnce = false; throw new Error('offline database failure'); }
    return originalPrepare(sql);
  };
  assert.equal((await create.POST(request(first))).status, 502);
  db.prepare = originalPrepare;
  assert.equal((await taskStore.getTask('owner-1', first)).status, 'saving');
});
await check('lengthless request bodies have a streaming size cap', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32)); controller.close(); } });
  const req = new Request(origin, { method: 'POST', duplex: 'half', body: stream, headers: { 'content-type': 'multipart/form-data; boundary=test' } });
  assert.equal(req.headers.get('content-length'), null);
  await assert.rejects(limitedForm.limitedFormData(req, 16), { name: 'Error', message: '参考图总大小不能超过 22 MB。' });
});
await check('invalid model parameters are rejected locally', async () => {
  assert.equal((await create.POST(request(crypto.randomUUID(), { resolution: '64k' }))).status, 400);
});
sqlite.close();
