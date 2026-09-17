import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`export * from './lib/international-image-catalog';export * from './lib/international-composition-models';export * from './lib/rh-creator-schema';export * from './lib/generation-models';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
assert.equal(m.internationalImageModels.length,108);
assert.equal(new Set(m.internationalImageModels.map(x=>x.endpoint)).size,108);
assert.equal(m.internationalImageModels.filter(x=>x.verified).length,2);
assert.equal(m.defaultImageModel.id,'gpt-image-2');
let checked=0;
for(const model of m.internationalImageModels){
 assert.match(model.endpoint,/^intl:[a-zA-Z0-9._/-]+$/);
 assert.equal(new Set(model.params.map(p=>p.key)).size,model.params.length);
 assert.ok(model.params.every(p=>!p.key.includes('##')));
 const values=m.defaultValues(model),counts={};
 for(const p of model.params){
  if(m.mediaParam(p)){if(p.required)counts[p.key]=1;continue;}
  if(p.key==='prompt')values[p.key]='保留产品结构，生成自然家居场景。';
  if(p.required&&!String(values[p.key]||'').trim())values[p.key]=p.type==='BOOLEAN'?'false':p.options?.length?String(p.options.find(x=>x!=='custom')):p.type==='SIZE'?'1024*1024':['INT','FLOAT'].includes(p.type)?String(p.min??1):'测试内容';
 }
 try{m.validateParams(model,values,counts);}catch(e){throw Error(`${model.name_cn}: ${e.message}`);}
 checked++;
}
for(const model of m.internationalCompositionModels){
 const quality=model.qualities.includes('medium')?'medium':model.qualities[0];
 const background=model.backgrounds?.includes('auto')?'auto':model.backgrounds?.[0];
 const outputFormat=model.outputFormats?.includes('png')?'png':model.outputFormats?.[0];
 const input={prompt:'保持结构，生成新品。',imageUrls:['https://test.invalid/frame.png','https://test.invalid/art.png'],aspectRatio:model.ratios[0],resolution:model.resolutions[0],quality,background,outputFormat};
 assert.ok(m.validModelSettings(model,input.aspectRatio,input.resolution,quality,background,outputFormat),model.name);
 const body=m.compositionCatalogPayload(model,input);
 const official=m.internationalImageModel(model.catalogEndpoint);
 assert.ok(Object.keys(body).every(k=>official.params.some(p=>p.key===k)),model.name);
 assert.throws(()=>m.compositionCatalogPayload(model,{...input,imageUrls:Array(100).fill('https://test.invalid/a')}));
}
const z=m.internationalImageModels.find(x=>x.skuId==='2034529136204316673');
assert.deepEqual(z.params.find(p=>p.key==='aspectRatio').options,['1:1','3:4','4:3','9:16','16:9','2:3','3:2']);
assert.equal(m.defaultValues(z).outputFormat,'png');
const q=m.internationalImageModels.find(x=>x.skuId==='2133000000000504077');
assert.throws(()=>m.validateParams(q,{...m.defaultValues(q),prompt:'测试',size:'9999*9999'}));
console.log(`PASS ${checked} official image schemas, ${m.internationalCompositionModels.length} additional multi-reference adapters, semantic enum mapping, real limits and non-billable validation.`);
