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
  DB: db, RUNNINGHUB_API_KEY: 'offline-test-key', FILES: { async put(key, bytes) { storage.set(key, bytes); }, async get(key) { const value = storage.get(key); if (!value) return null; const bytes = value instanceof Uint8Array ? value : new Uint8Array(value); return { size: bytes.byteLength, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } }; } },
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
let metadataFields = memberFields, failMetadata = false, failOutputs = false, memberSubmitBody, memberQueries = 0, memberOutputs = 0, metadataRedirect = '', metadataCalls = 0;
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
    metadataCalls++;
    const parsed = new URL(target);
    assert.equal(parsed.origin, 'https://www.runninghub.cn');
    assert.equal(parsed.searchParams.get('apiKey'), expectedKey);
    assert.match(parsed.searchParams.get('webappId'), /^\d{19}$/);
    assert.equal(options.redirect, 'manual'); assert.equal(options.headers['cache-control'], 'no-store');
    assert.equal(options.cache, undefined); // Avoid platform-dependent RequestInit cache support.
    if (failMetadata) throw new Error(`Network error at ${target}`);
    if (metadataRedirect) return new Response(null, {status:302,headers:{location:metadataRedirect}});
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
    assert.ok(body.prompt.includes('画芯')); assert.ok([2, 3].includes(body.imageUrls.length), 'two references, plus the shared scene when a size job reuses one');
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
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM jobs').get().n, 0); // no placeholder production before plan confirmation
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
await check('new product plans preserve versions, enforce real specification sources and do not submit generation', async () => {
  testContext.user = { userId: 'owner-1', email: 'test@example.invalid' };
  sqlite.exec("UPDATE generation_tasks SET status = 'failed' WHERE status NOT IN ('succeeded','failed')");
  sqlite.prepare("INSERT INTO assets (id,owner_id,name,category,tags,tone,mime_type,object_key,size,created_at) VALUES ('spec-source','owner-1','框架','框架模板','所属款式:框架;原始文件名:60宽_200高.png','','image/png','fixture.png',1,1)").run();
  const work=await load('app/api/products/[id]/workspace/route.ts'), itemRoute=await load('app/api/production/[id]/route.ts');
  const id=sqlite.prepare('SELECT id FROM products LIMIT 1').get().id, ctx=context(id), before=submissions;
  const initial=await (await work.GET(new Request(origin),ctx)).json();
  assert.equal(initial.sizes[0].widthCm,60);assert.equal(initial.plans.length,0);
  const body={name:'测试新品',expectedVersion:0,confirmed:true,rule:'upper',notes:'不改变柜门',main:['白底主图','玄关场景'],sceneTitle:'玄关场景',details:['规格选择'],sizes:[{widthCm:61,heightCm:207,sourceIds:['spec-source']}]};
  const post=(bodyValue=body)=>new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(bodyValue)});
  assert.equal((await work.POST(post({...body,confirmed:false}),ctx)).status,400);
  assert.equal((await work.POST(post({...body,sizes:[{widthCm:61,heightCm:207,sourceIds:['foreign-owner']}] }),ctx)).status,400);
  const made=await work.POST(post(),ctx);assert.equal(made.status,200);
  const saved=await made.json();assert.equal(saved.plans[0].items.length,4);assert.equal(submissions,before);
  assert.equal((await work.POST(post(),ctx)).status,409);
  const version2=await (await work.POST(post({...body,expectedVersion:1,notes:'新版本要求'}),ctx)).json();
  assert.equal(version2.plans.length,2);assert.equal(version2.plans[1].config.notes,'不改变柜门');
  const sizeItem=version2.plans[0].items.find(i=>i.kind==='size');
  const prepared=await (await itemRoute.GET(new Request(origin),context(sizeItem.id))).json();
  assert.equal(prepared.frameUrl,'/api/files/spec-source');assert.equal(prepared.spec.heightCm,207);assert.equal(submissions,before);
  const review=(generationId,review,note='')=>new Request(origin,{method:'POST',headers:{origin},body:JSON.stringify({generationId,review,note})});
  // A size job may only reuse an accepted, succeeded shared-scene main image.
  const sceneItem=version2.plans[0].items.find(i=>i.kind==='main'&&i.title==='玄关场景');
  assert.ok(sceneItem,'the plan must contain the shared-scene main item');
  const sceneTaskId=crypto.randomUUID();
  expectedModel={endpoint:'/rhart-image-g-2-official/image-to-image',quality:'medium',resolution:'2k',ratio:'1:1'};
  const sceneSubmit=await create.POST(request(sceneTaskId,{model:'gpt-image-2',aspectRatio:'1:1',productionItemId:sceneItem.id}));
  assert.equal(sceneSubmit.status,202,await sceneSubmit.clone().text());
  storage.set('scenes/shared.png',new Uint8Array([1,2,3]));
  sqlite.prepare("INSERT INTO assets (id,owner_id,name,category,tags,tone,mime_type,object_key,size,created_at) VALUES ('scene-asset','owner-1','共用场景','生成结果','','','image/png','scenes/shared.png',3,1)").run();
  sqlite.prepare("UPDATE generation_tasks SET status='succeeded',asset_id=? WHERE id=?").run('scene-asset',sceneTaskId);
  assert.equal((await itemRoute.POST(review(sceneTaskId,'accepted'),context(sceneItem.id))).status,200);
  const base=submissions;
  const taskId=crypto.randomUUID();
  const generated=await create.POST(request(taskId,{model:'gpt-image-2',aspectRatio:'1:1',productionItemId:sizeItem.id}));
  assert.equal(generated.status,202,await generated.clone().text());assert.equal(submissions,base+1);
  assert.equal((await generated.json()).recipe.productionItemId,sizeItem.id);
  assert.equal((await create.POST(request(taskId,{model:'gpt-image-2',aspectRatio:'1:1',productionItemId:sizeItem.id}))).status,200);
  assert.equal(submissions,base+1);
  assert.equal((await itemRoute.POST(review(taskId,'accepted'),context(sizeItem.id))).status,400);
  sqlite.prepare("UPDATE generation_tasks SET status='succeeded',asset_id=? WHERE id=?").run(taskId,taskId);
  assert.equal((await itemRoute.POST(review('stale-id','accepted'),context(sizeItem.id))).status,409);
  assert.equal((await itemRoute.POST(review(taskId,'accepted'),context(sizeItem.id))).status,200);
  const duplicate=await create.POST(request(crypto.randomUUID(),{model:'gpt-image-2',productionItemId:sizeItem.id}));
  assert.equal(duplicate.status,502);assert.equal(submissions,base+1);
  assert.equal((await itemRoute.POST(review(taskId,'rework','颜色偏黄'),context(sizeItem.id))).status,200);
  assert.equal((await create.POST(request(crypto.randomUUID(),{model:'gpt-image-2',aspectRatio:'1:1',productionItemId:sizeItem.id}))).status,202);
  assert.equal(submissions,base+2);
  testContext.user={userId:'owner-2',email:'other@example.invalid'};
  assert.equal((await work.GET(new Request(origin),ctx)).status,404);
  assert.equal((await itemRoute.GET(new Request(origin),context(sizeItem.id))).status,404);
  testContext.user=null;assert.equal((await work.POST(post(),ctx)).status,401);
});
sqlite.close();
