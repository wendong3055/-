import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, readdirSync } from 'node:fs';
const r = await build({ entryPoints: ['lib/frame-catalog.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { frameSources, frameSizeFromFilename, frameSpecStatus, groupFrameOptions, validFrameStyleName } = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
assert.equal(frameSizeFromFilename('large-screen', '胡桃180-100.png').heightCm, 180);
assert.equal(frameSizeFromFilename('large-screen', '白100.png').heightCm, 190);
assert.equal(frameSizeFromFilename('five-drawer', '黄花梨80-2220.png').heightCm, 220);
assert.deepEqual(frameSizeFromFilename('five-drawer', '60-60-200.png').widthParts, [60,60]);
assert.equal(frameSizeFromFilename('fei-he', '40x6-190.png').panelCount, 6);
assert.equal(frameSizeFromFilename('福字双门抽屉', 'sku_2.png'), null);
assert.deepEqual(frameSizeFromFilename('竹报平安无把手组合玄关柜', 'SKU_07_60加30_200高_空框结构图.png').widthParts, [60,30]);
assert.deepEqual(frameSizeFromFilename('竖纹圆形置物架大橱柜', 'SKU_07_40加50_200高_圆圈无隔板结构图.png').widthParts, [40,50]);
assert.equal(frameSizeFromFilename('fubao-ankang', '30-30-80-200.png'), null);
// Uploaded names retain '+', storage keys sanitize it to '-'. The style's
// representative is SKU_03, not a ninth spec and not a missing original.
const huluNames = ['30+70','30+80','30+90','30+100','30+110','30+30+90','30+30+100','40+40+100'];
const huluRows = huluNames.map((widths,i) => ({ id:`hulu-${i}`, name:i===2?'葫芦大屏风柜':`葫芦大屏风柜/SKU_${i+1}_${widths}.png`, category:i===2?'框架模板':'框架规格原图', tags:i===2?'款式文件夹:08_葫芦大屏风柜;规格数量:8;代表图:SKU_03_30+90.png':'所属款式:08_葫芦大屏风柜', object_key:`local/id/SKU_${i+1}_${widths.replaceAll('+','-')}.png` }));
const hulu = frameSources(huluRows,huluRows[2]);
assert.deepEqual(hulu.sizes.map(s=>s.widthCm),[100,110,120,130,140,150,160,180]);
assert.equal(hulu.unknown,0); assert.equal(hulu.missing,0);
assert.equal(frameSpecStatus(hulu),'waiting_for_production');
for (const [i,s] of hulu.sizes.entries()) {
  assert.equal(s.heightCm,200); assert.equal(s.depthCm,30);
  assert.deepEqual(s.sourceIds,[`hulu-${i}`]); assert.deepEqual(s.sourceUrls,[`/api/files/hulu-${i}`]);
  assert.deepEqual(s.widthParts,huluNames[i].split('+').map(Number));
}
assert.equal(frameSizeFromFilename('别的框架','SKU_01_30+70.png'),null);
assert.equal(frameSizeFromFilename('葫芦大屏风柜','SKU_10_30+120.png'),null);
assert.equal(frameSizeFromFilename('葫芦大屏风柜','SKU_01_30-70.png').widthCm,100);
assert.equal(frameSources([...huluRows,{...huluRows[2],id:'duplicate'}],huluRows[2]).sizes.length,8);
const source = { id:'p', name:'福报安康双门抽屉玄关柜', category:'框架模板', objectKey:'owner/id/30-30-80-200.png', tags:'款式文件夹:福报安康双门抽屉玄关柜;原始文件名:30%2B30%2B80-200.png' };
assert.equal(frameSources([source], source).sizes[0].widthCm, 140);
assert.equal(frameSpecStatus(frameSources([source], source)), 'waiting_for_production');
const unknownSource = { ...source, id:'unknown',name:'sku_2.png',objectKey:'sku_2.png',tags:'所属款式:福报安康双门抽屉玄关柜' };
assert.equal(frameSpecStatus(frameSources([source,unknownSource], source)), 'needs_spec_confirmation');
assert.equal(frameSpecStatus(frameSources([{...source,tags:source.tags+';规格数量:2'}], source)), 'needs_spec_confirmation');
for (const name of ['成品PNG','images','SKU','', '名字;所属款式:五斗柜', '两种/款式']) assert.equal(validFrameStyleName(name),false);
for (const name of ['五斗柜','05_飞鹤6连屏']) assert.equal(validFrameStyleName(name),true);
assert.equal(groupFrameOptions([{id:'uploaded-frame-a', name:'五斗柜/胡桃60-200.png', styleKey:'five-drawer'},{id:'b',name:'五斗柜框架'}],[]).length,1);
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
