import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, readdirSync } from 'node:fs';
const r = await build({ entryPoints: ['lib/frame-catalog.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { frameSources, frameSizeFromFilename, groupFrameOptions } = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
assert.equal(frameSizeFromFilename('large-screen', '胡桃180-100.png').heightCm, 180);
assert.equal(frameSizeFromFilename('large-screen', '白100.png').heightCm, 190);
assert.equal(frameSizeFromFilename('five-drawer', '黄花梨80-2220.png').heightCm, 220);
assert.deepEqual(frameSizeFromFilename('five-drawer', '60-60-200.png').widthParts, [60,60]);
assert.equal(frameSizeFromFilename('fei-he', '40x6-190.png').panelCount, 6);
assert.equal(frameSizeFromFilename('福字双门抽屉', 'sku_2.png'), null);
for (const [name, expected] of [['大屏风',17],['五斗柜',12],['05_飞鹤6连屏',39]]) {
  const dir = `D:/屏风素材/结构拆分成品_2026-08-27_v1/${name}/成品PNG`;
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((file) => /\.png$/i.test(file));
  const rows = files.map((file, i) => ({ id: String(i), name: `${name}/${file}`, category: i ? '框架规格原图' : '框架模板', tags: `所属款式:${name}` }));
  assert.equal(frameSources(rows, rows[0]).sizes.length, expected, name);
}
const frames = [{ id: 'uploaded-frame-a', name: '五斗柜' },{ id: 'five-drawer-walnut', name: '五斗柜框架' }];
assert.equal(groupFrameOptions(frames, []).length, 1);
for (const id of ['uploaded-frame-a','five-drawer-walnut','style:five-drawer']) assert.equal(groupFrameOptions(frames, [id]).length, 0);
assert.equal(groupFrameOptions([{ id:'a',name:'福字双门抽屉' },{ id:'b',name:'福报安康双门抽屉玄关柜' }], []).length, 2);
const clientBundle = await build({ entryPoints: ['lib/hidden-options-client.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { syncHiddenOptions } = await import(`data:text/javascript;base64,${Buffer.from(clientBundle.outputFiles[0].text).toString('base64')}`);
const values = new Map(); globalThis.localStorage = { getItem: (key) => values.get(key), setItem: (key,value) => values.set(key,value), removeItem: (key) => values.delete(key) };
const oldFetch = globalThis.fetch;
try {
  localStorage.setItem('pingfeng-hidden-frames', JSON.stringify(['failed-a','saved-b']));
  globalThis.fetch = async (_url, options) => Response.json({ ids: JSON.parse(options.body).ids });
  assert.equal(await syncHiddenOptions('frame',['saved-b']), true);
  assert.deepEqual(JSON.parse(localStorage.getItem('pingfeng-hidden-frames')), ['failed-a']);
  const ids = Array.from({length:450},(_,i)=>String(i)); let count = 0;
  localStorage.setItem('pingfeng-hidden-artworks', JSON.stringify(ids));
  globalThis.fetch = async (_url, options) => { count++; const ids = JSON.parse(options.body).ids; assert.ok(ids.length <= 200); return Response.json({ ids }); };
  assert.equal(await syncHiddenOptions('artwork',ids), true); assert.equal(count,3); assert.equal(localStorage.getItem('pingfeng-hidden-artworks'), undefined);
} finally { globalThis.fetch = oldFetch; delete globalThis.localStorage; }
console.log('PASS: real dimensions vs color/image count, panel and cabinet structure, exact aliases, hidden styles stay hidden, deletion acknowledgements preserve failures.');
