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
const credentials = await load('lib/runninghub-credentials.ts');
const memberMetadata = await load('app/api/runninghub/apps/[id]/route.ts');
const appSchema = await load('lib/runninghub-app-schema.ts');
const { imageModels } = await load('lib/generation-models.ts');
const taskStore = await load('db/generation-tasks.ts');
const limitedForm = await load('lib/limited-form.ts');
const productRoutes = await load('app/api/products/route.ts');
const { compositionPrompt } = await load('lib/composition-prompt.ts');
const { parseRecipe } = await load('lib/studio-brief.ts');
const origin = 'https://studio.example';
let submissions = 0;
let providerStatus = 'RUNNING';
let failSubmit = false;
let failUpload = false;
let outputUrl = 'https://www.runninghub.ai/results/test.png';
let uploads = 0;
let expectedOrigin = 'https://www.runninghub.ai';
let expectedKey = 'offline-test-key';
const memberFields = [
  { nodeId: '10', fieldName: 'image', fieldType: 'IMAGE', fieldValue: 'sample-do-not-send.png', description: '参考图一' },
  { nodeId: '11', fieldName: 'image', fieldType: 'IMAGE', fieldValue: 'sample-do-not-send.png', description: '参考图二' },
  { nodeId: '12', fieldName: 'image', fieldType: 'IMAGE', fieldValue: 'sample-do-not-send.png', description: '可选参考图' },
  { nodeId: '20', fieldName: 'prompt', fieldType: 'STRING', fieldValue: 'example prompt', description: '制作要求' },
  { nodeId: '20', fieldName: 'aspect_ratio', fieldType: 'LIST', fieldValue: '16:9', fieldData: JSON.stringify([{ name: '16:9', index: '16:9' }, { name: '3:4', index: '3:4' }, { default: '16:9' }]), description: '比例' },
  { nodeId: '20', fieldName: 'resolution', fieldType: 'LIST', fieldValue: '4k', fieldData: '["4k","8k"]', description: '清晰度' },
  { nodeId: '20', fieldName: 'model', fieldType: 'LIST', fieldValue: 'pro', fieldData: '[{"name":"Pro","index":"pro"},{"name":"Ultra","index":"ultra"}]', description: '模型' },
  { nodeId: '21', fieldName: 'num_images', fieldType: 'INT', fieldValue: '5', description: '数量' },
];
let metadataFields = memberFields, failMetadata = false, failOutputs = false, memberSubmitBody, memberQueries = 0, memberOutputs = 0;
let memberMode = false;
let expectedModel = { endpoint: '/rhart-image-g-2-official/image-to-image', quality: 'medium', resolution: '2k', ratio: '16:9' };
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.includes('/media/upload/binary')) {
    uploads++;
    if (failUpload) throw new Error('offline upload timeout');
    assert.equal(new URL(target).origin, expectedOrigin);
    assert.equal(options.headers.authorization, `Bearer ${expectedKey}`);
    assert.ok(options.body.get('file') instanceof File);
    return Response.json({ code: expectedOrigin.endsWith('.cn') ? 0 : 200, data: { download_url: `${expectedOrigin}/references/test.png`, fileName: `openapi/reference-${uploads}.png` } });
  }
  if (target.includes('/api/webapp/apiCallDemo')) {
    const parsed = new URL(target);
    assert.equal(parsed.origin, 'https://www.runninghub.cn');
    assert.equal(parsed.searchParams.get('apiKey'), expectedKey);
    assert.match(parsed.searchParams.get('webappId'), /^\d{19}$/);
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    if (failMetadata) throw new Error(`Network error at ${target}`);
    return Response.json({ code: 0, data: { webappName: 'Offline AI App', curl: `NEVER EXECUTE ${expectedKey}`, nodeInfoList: metadataFields } });
  }
  if (target.endsWith('/task/openapi/ai-app/run')) {
    assert.ok(memberMode); submissions++;
    assert.equal(new URL(target).origin, 'https://www.runninghub.cn');
    assert.equal(options.headers.authorization, `Bearer ${expectedKey}`);
    const body = JSON.parse(options.body); memberSubmitBody = body;
    assert.equal(body.apiKey, expectedKey); assert.match(body.webappId, /^\d{19}$/);
    const fields = Object.fromEntries(body.nodeInfoList.map((f) => [`${f.nodeId}.${f.fieldName}`, f.fieldValue]));
    assert.match(fields['10.image'], /^openapi\/reference-\d+\.png$/);
    assert.match(fields['11.image'], /^openapi\/reference-\d+\.png$/);
    assert.notEqual(fields['10.image'], fields['11.image']); assert.equal(fields['12.image'], '');
    assert.ok(fields['20.prompt'].includes('画芯'));
    assert.equal(fields['20.aspect_ratio'], '3:4'); assert.equal(fields['20.resolution'], '8k'); assert.equal(fields['20.model'], 'ultra');
    assert.equal(fields['21.num_images'], '1');
    if (failSubmit) return Response.json({ code: 500, msg: 'UNKNOWN_ERROR' });
    return Response.json({ code: 0, data: { taskId: `member-${submissions}`, taskStatus: 'RUNNING' } });
  }
  if (target.endsWith('/task/openapi/status') || target.endsWith('/task/openapi/outputs')) {
    assert.ok(memberMode); assert.equal(new URL(target).origin, 'https://www.runninghub.cn');
    const body = JSON.parse(options.body); assert.equal(body.apiKey, expectedKey); assert.match(body.taskId, /^member-/);
    if (target.endsWith('/status')) { memberQueries++; return Response.json({ code: 0, data: providerStatus }); }
    memberOutputs++;
    if (failOutputs) return Response.json({ code: 500, msg: 'UNKNOWN_ERROR' });
    return Response.json({ code: 0, data: [{ fileUrl: outputUrl, fileType: 'png' }, { fileUrl: 'https://www.runninghub.cn/output.mp4', fileType: 'mp4' }] });
  }
  if (target.includes('/openapi/v2/rhart-image-')) {
    assert.ok(!memberMode, 'member Key must never submit a model API request');
    submissions++;
    assert.ok(target.endsWith(expectedModel.endpoint));
    assert.equal(new URL(target).origin, expectedOrigin);
    assert.equal(options.headers.authorization, `Bearer ${expectedKey}`);
    const body = JSON.parse(options.body);
    assert.equal(body.quality, expectedModel.quality); assert.equal(body.resolution, expectedModel.resolution); assert.equal(body.aspectRatio, expectedModel.ratio);
    assert.ok(body.prompt.includes('画芯')); assert.equal(body.imageUrls.length, 2);
    if (failSubmit) throw new Error('offline uncertain submission');
    return Response.json({ taskId: `provider-${submissions}`, status: 'QUEUED' });
  }
  if (target.endsWith('/openapi/v2/query')) {
    assert.equal(new URL(target).origin, expectedOrigin); assert.equal(options.headers.authorization, `Bearer ${expectedKey}`);
    if (memberMode) { memberQueries++; if (providerStatus === 'SUCCESS') { memberOutputs++; if (failOutputs) return Response.json({ errorCode: '500' }); } }
    return Response.json({ taskId: JSON.parse(options.body).taskId, status: providerStatus, results: providerStatus === 'SUCCESS' ? [{ outputType: 'image', url: outputUrl }] : [] });
  }
  if (target === outputUrl && target.startsWith('https://www.runninghub.ai/')) return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { headers: { 'content-type': 'image/png' } });
  throw new Error(`Unexpected network attempt blocked: ${target}`);
};

function request(id, overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ requestId: id, model: 'gpt-image-2', artworkId: 'artwork-test', frameId: 'frame-test', artworkName: '测试画芯', frameName: '测试框架', colorName: '胡桃木色', colorId: 'walnut', aspectRatio: '16:9', resolution: '2k', ...overrides })) form.set(key, value);
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
await check('saved generation settings remain available after a fresh list request', async () => {
  const rows = await (await list.GET()).json();
  assert.deepEqual(rows.find((task) => task.id === first).recipe, { artworkId: 'artwork-test', frameId: 'frame-test', colorId: 'walnut', intent: 'composition', instruction: '', quality: 'medium' });
  const row = await taskStore.getTask('owner-1', first);
  assert.equal(taskStore.publicTask({ ...row, recipe_json: null }).recipe, null);
  assert.equal(parseRecipe('{invalid'), null);
  assert.equal(parseRecipe(JSON.stringify({ artworkId: 'a', frameId: 'f', colorId: 'walnut', intent: 'invalid', instruction: '' })), null);
});
await check('unsupported output intents are rejected without submitting or uploading', async () => {
  const before = submissions;
  assert.equal((await create.POST(request(crypto.randomUUID(), { intent: 'batch-100' }))).status, 400);
  assert.equal(submissions, before);
});
await check('catalog and interior briefs do not contradict their background choice', async () => {
  const input = { frameName: '框架', frameProfile: 'classic', colorId: 'walnut', colorName: '胡桃木色', colorHex: '#402b24', instruction: '画芯完整' };
  for (const hasFrame of [true, false]) {
    const catalog = compositionPrompt({ ...input, hasFrame, intent: 'catalog' });
    const interior = compositionPrompt({ ...input, hasFrame, intent: 'interior' });
    assert.ok(catalog.includes('纯白棚拍背景'));
    assert.ok(interior.includes('玄关或客厅空间'));
    for (const prompt of [catalog, interior]) {
      assert.ok(!prompt.includes('保留原有透视、光影和背景'));
      assert.ok(!prompt.includes('在浅中性电商背景上'));
      assert.ok(prompt.includes('画芯完整'));
    }
  }
});
await check('model-specific invalid ratios and quality are rejected before upload', async () => {
  const beforeUploads = uploads;
  const beforeSubmissions = submissions;
  for (const overrides of [{ model: 'unknown' }, { aspectRatio: 'auto' }, { model: 'nano-banana-pro', aspectRatio: '1:8' }, { model: 'nano-banana-2', quality: 'high' }, { quality: 'ultra' }]) {
    assert.equal((await create.POST(request(crypto.randomUUID(), overrides))).status, 400);
  }
  assert.equal(uploads, beforeUploads); assert.equal(submissions, beforeSubmissions);
});
await check('all selectable models send their own endpoint and selected image settings', async () => {
  sqlite.exec("UPDATE generation_tasks SET status = 'failed' WHERE status = 'saving'");
  for (const settings of [
    { model: 'gpt-image-2', endpoint: '/rhart-image-g-2-official/image-to-image', quality: 'high', resolution: '4k', ratio: '3:4' },
    { model: 'nano-banana-pro', endpoint: '/rhart-image-n-pro-official/edit', quality: undefined, resolution: '1k', ratio: '1:1' },
    { model: 'nano-banana-2', endpoint: '/rhart-image-n-g31-flash-official/image-to-image', quality: undefined, resolution: '2k', ratio: '1:8' },
  ]) {
    expectedModel = settings;
    const id = crypto.randomUUID();
    const response = await create.POST(request(id, { model: settings.model, quality: settings.quality || '', resolution: settings.resolution, aspectRatio: settings.ratio }));
    assert.equal(response.status, 202);
    const saved = await response.json();
    assert.equal(saved.model, settings.model); assert.equal(saved.resolution, settings.resolution); assert.equal(saved.aspectRatio, settings.ratio); assert.equal(saved.recipe.quality, settings.quality);
    await taskStore.updateTask('owner-1', id, 'failed', 'End offline test task');
  }
});
await check('China models never reuse the existing international credential', async () => {
  const before = uploads;
  assert.equal((await create.POST(request(crypto.randomUUID(), { model: 'cn-rhart-image-g-2' }))).status, 503);
  assert.equal(uploads, before);
});
await check('China credential is encrypted, owner-scoped and never returned in config', async () => {
  testContext.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const keyRequest = (apiKey, requestOrigin = origin) => new Request(`${origin}/api/runninghub/config`, { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ apiKey }) });
  assert.equal((await config.POST(keyRequest('cn-offline-test-key', 'https://evil.invalid'))).status, 401);
  assert.equal((await config.POST(keyRequest('cn-offline-test-key'))).status, 200);
  const stored = sqlite.prepare('SELECT encrypted_key FROM runninghub_credentials WHERE owner_id = ?').get('owner-1').encrypted_key;
  assert.ok(!stored.includes('cn-offline-test-key'));
  assert.equal(await credentials.chinaKey('owner-1'), 'cn-offline-test-key');
  assert.equal(await credentials.chinaKey('owner-2'), '');
  // Authenticated encryption binds ciphertext to its owner, not just a DB lookup.
  sqlite.prepare('INSERT INTO runninghub_credentials VALUES (?, ?, ?)').run('owner-2', stored, Date.now());
  await assert.rejects(credentials.chinaKey('owner-2'));
  const body = await (await config.GET()).json();
  assert.equal(body.regions.cn, true); assert.equal(body.regions.international, true);
  assert.ok(!JSON.stringify(body).includes('cn-offline-test-key'));
  assert.ok(!JSON.stringify(body).includes(stored));
  assert.equal((await config.POST(keyRequest('short'))).status, 400);
  assert.ok(!(await (await config.POST(keyRequest('x'.repeat(2500)))).text()).includes('x'.repeat(100)));
});
await check('all China models submit/query the correct host and accept code-zero uploads', async () => {
  expectedOrigin = 'https://www.runninghub.cn'; expectedKey = 'cn-offline-test-key'; providerStatus = 'SUCCESS'; outputUrl = 'https://www.runninghub.ai/results/test.png';
  for (const settings of [
    { model: 'cn-rhart-image-g-2', endpoint: '/rhart-image-g-2/image-to-image', resolution: '2k', ratio: '9:21' },
    { model: 'cn-rhart-image-n-pro', endpoint: '/rhart-image-n-pro/edit', resolution: '1k', ratio: '1:1' },
    { model: 'cn-rhart-image-n-pro-ultra', endpoint: '/rhart-image-n-pro-official/edit-ultra', resolution: '8k', ratio: '3:4' },
  ]) {
    expectedModel = settings;
    const id = crypto.randomUUID();
    assert.equal((await create.POST(request(id, { model: settings.model, resolution: settings.resolution, aspectRatio: settings.ratio }))).status, 202);
    await assert.rejects(credentials.saveChinaKey('owner-1', 'replacement-test-key'));
    assert.equal(await credentials.chinaKey('owner-1'), 'cn-offline-test-key');
    const result = await (await query.GET(new Request(origin), context(id))).json();
    assert.equal(result.status, 'succeeded'); assert.ok(result.url);
    assert.equal(result.model, settings.model);
  }
  assert.equal((await create.POST(request(crypto.randomUUID(), { model: 'cn-rhart-image-n-pro-ultra', resolution: '2k' }))).status, 400);
  await assert.rejects(provider.submitGeneration({ model: 'cn-rhart-image-g-2', prompt: '画芯', imageUrls: [], aspectRatio: '1:1', resolution: '1k' }, { origin: 'https://www.runninghub.ai', key: expectedKey }));
});
memberMode = true;
const memberModels = imageModels.filter((m) => m.apiMode === 'member-app');
let spec, setup;
await check('member app metadata authenticates via official query contract and returns safe schema only', async () => {
  testContext.user = null;
  assert.equal((await memberMetadata.GET(new Request(origin), context(memberModels[0].id))).status, 401);
  testContext.user = { userId: 'owner-1', email: 'test@example.invalid' };
  assert.equal((await memberMetadata.GET(new Request(origin), context('unknown-app'))).status, 400);
  const result = await memberMetadata.GET(new Request(origin), context(memberModels[0].id));
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  spec = await result.json();
  assert.ok(!JSON.stringify(spec).includes(expectedKey)); assert.ok(!JSON.stringify(spec).includes('curl'));
  assert.ok(!JSON.stringify(spec).includes('sample-do-not-send'));
  setup = appSchema.initialAppSetup(spec, 2);
  setup.values['20.aspect_ratio'] = '3:4'; setup.values['20.resolution'] = '8k'; setup.values['20.model'] = 'ultra';
  failMetadata = true;
  const error = await (await memberMetadata.GET(new Request(origin), context(memberModels[0].id))).text();
  assert.ok(!error.includes(expectedKey)); assert.ok(!error.includes('apiKey='));
  failMetadata = false;
});
await check('invalid, changed or ambiguous member inputs stop before upload or charge', async () => {
  const before = [uploads, submissions];
  for (const value of ['', '{invalid', JSON.stringify({ ...setup, fingerprint: 'stale' }), JSON.stringify({ ...setup, imageKeys: ['10.image', '10.image'] }), JSON.stringify({ ...setup, promptKey: '10.image' }), JSON.stringify({ ...setup, values: { ...setup.values, '20.aspect_ratio': '99:1' } })]) {
    assert.equal((await create.POST(request(crypto.randomUUID(), { model: memberModels[0].id, appSetup: value }))).status, 400);
  }
  metadataFields = memberFields.filter((f) => f.fieldType !== 'IMAGE' || f.nodeId === '10');
  const single = await appSchema.parseAppSpec(memberModels[0].appId, { nodeInfoList: metadataFields });
  const singleResponse = await create.POST(request(crypto.randomUUID(), { model: memberModels[0].id, appSetup: JSON.stringify(appSchema.initialAppSetup(single, 2)) }));
  assert.equal(singleResponse.status, 400, await singleResponse.text());
  metadataFields = memberFields;
  await assert.rejects(appSchema.parseAppSpec('123', { nodeInfoList: [{ nodeId: '1', fieldName: 'api_key', fieldType: 'STRING' }] }));
  assert.deepEqual([uploads, submissions], before);
});
await check('every member app sends chosen inputs with uploaded filenames and never calls enterprise model APIs', async () => {
  for (const model of memberModels) {
    const app = await (await memberMetadata.GET(new Request(origin), context(model.id))).json();
    const values = { ...setup, fingerprint: app.fingerprint };
    const id = crypto.randomUUID(), before = submissions;
    const response = await create.POST(request(id, { model: model.id, appSetup: JSON.stringify(values) }));
    assert.equal(response.status, 202);
    const task = await response.json();
    assert.equal(task.model, model.id); assert.equal(task.aspectRatio, '3:4'); assert.equal(task.resolution, '8k');
    assert.equal(task.recipe.appSetup.values['20.resolution'], '8k');
    assert.equal(memberSubmitBody.webappId, model.appId);
    assert.ok(!JSON.stringify(task).includes(expectedKey));
    await create.POST(request(id, { model: model.id, appSetup: JSON.stringify(values) }));
    assert.equal(submissions, before + 1);
    providerStatus = 'RUNNING';
    const outputCount = memberOutputs;
    assert.equal((await (await query.GET(new Request(origin), context(id))).json()).status, 'running');
    assert.equal(memberOutputs, outputCount);
    providerStatus = 'SUCCESS'; resetPoll(); failOutputs = true;
    const interrupted = await (await query.GET(new Request(origin), context(id))).json();
    assert.notEqual(interrupted.status, 'succeeded'); assert.equal(submissions, before + 1);
    failOutputs = false; resetPoll();
    const saved = await (await query.GET(new Request(origin), context(id))).json();
    assert.equal(saved.status, 'succeeded'); assert.equal(saved.url, `/api/files/${id}`); assert.ok(storage.has(id) || storage.size > 1);
    assert.equal(submissions, before + 1);
  }
  assert.ok(memberQueries >= memberModels.length * 3);
});
await check('ambiguous member submission stays locked and cannot silently fall back or double-charge', async () => {
  const id = crypto.randomUUID(), before = submissions;
  failSubmit = true;
  const req = () => request(id, { model: memberModels[0].id, appSetup: JSON.stringify(setup) });
  assert.equal((await create.POST(req())).status, 502);
  assert.equal((await taskStore.getTask('owner-1', id)).status, 'unknown');
  assert.equal((await create.POST(req())).status, 200);
  assert.equal(submissions, before + 1);
  assert.equal((await create.POST(request(crypto.randomUUID(), { model: memberModels[0].id, appSetup: JSON.stringify(setup) }))).status, 409);
  assert.equal(submissions, before + 1);
  failSubmit = false;
});
await check('member preferences persist per owner and model, reject cross-site and oversized payloads', async () => {
  const preferences = await load('app/api/runninghub/preferences/[id]/route.ts');
  const ctx = context(memberModels[0].id);
  const post = (body = setup, headers = { origin }) => new Request(`${origin}/api/runninghub/preferences/${memberModels[0].id}`, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal((await preferences.POST(post(), ctx)).status, 200);
  const saved = await (await preferences.GET(new Request(origin), ctx)).json();
  assert.equal(saved.setup.values['20.resolution'], '8k');
  testContext.user = { userId: 'owner-2', email: 'other@example.invalid' };
  assert.equal((await (await preferences.GET(new Request(origin), ctx)).json()).setup, null);
  assert.equal((await preferences.POST(post(setup, { origin: 'https://evil.invalid' }), ctx)).status, 401);
  assert.equal((await preferences.POST(post({ ...setup, values: { api_key: 'secret' } }), ctx)).status, 400);
  assert.equal((await preferences.POST(post({ x: 'x'.repeat(50001) }), ctx)).status, 413);
  testContext.user = null; assert.equal((await preferences.GET(new Request(origin), ctx)).status, 401);
});
sqlite.close();
