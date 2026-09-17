import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(path, dependencies = {}) {
  const module = {exports:{}};
  const code = ts.transpileModule(read(path), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code, {module,exports:module.exports,require:name=>dependencies[name]||{},Response,Request,File,FormData,URL,JSON,Date});
  return module.exports;
}
const scenes = load('../lib/scene-library.ts');
assert.ok(scenes.sceneReferences.length >= 3, 'ship actual curated images, not empty placeholders');
for(const scene of scenes.sceneReferences) {
  assert.ok(scene.source.startsWith('https://github.com/'));
  assert.ok(scene.author && scene.license && scene.licenseUrl);
  const file=new URL('../public'+scene.image,import.meta.url);
  assert.ok(existsSync(file),scene.image);
  // The declared size must match the real file: the card reserves space with it
  // and the server rejects a reference whose dimensions disagree.
  const size=scenes.pngPixelSize(new Uint8Array(readFileSync(file)));
  assert.ok(size,scene.image+' must be a readable PNG');
  assert.equal(size.width,scene.width,scene.image+' declared width');
  assert.equal(size.height,scene.height,scene.image+' declared height');
}
let saved, submitted, references=[];
const deps = {
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '../../../lib/generation-auth':{generationOwner:async()=> 'owner'},
  '../../../lib/limited-form':{limitedFormData:async r=>r.formData(),FormLimitError:class extends Error{}},
  '../../../lib/custom-image-config':{isCustomModel:()=>false},
  '../../../lib/custom-image-provider':{CustomImageError:class extends Error{}},
  '../../../lib/composition-prompt':{compositionPrompt:()=> '保留产品结构与画芯'},
  '../../../lib/studio-brief':{isStudioIntent:v=>['interior','composition'].includes(v),parseRecipe:JSON.parse},
  '../../../lib/scene-library':scenes,
  '../../../lib/generation-models':{getImageModel:()=>({id:'gpt-image-2',region:'cn',apiMode:'direct',qualities:['medium']}),validModelSettings:()=>true},
  '../../../db/generation-tasks':{getTask:async()=>saved,listTasks:async()=>[],insertTask:async row=>{saved=row;return true;},claimSubmission:async()=>true,updateTask:async()=>{},publicTask:r=>r},
  '../../../lib/runninghub':{RunningHubError:class extends Error{},runningHubConnection:async()=>({}),uploadReference:async f=>{references.push(f.name);return 'ref-'+f.name;},submitGeneration:async args=>{submitted=args;return {taskId:'remote',status:'QUEUED'};}},
  '../../../db/production':{ProductionError:class extends Error{},productionContext:async()=>({workspace:{sample:{recipe:{}}},row:{kind:'size'}})},
};
const {POST}=load('../app/api/generate-preview/route.ts',deps);
const pngHeader=(width,height)=>{const bytes=new Uint8Array(24);bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);const view=new DataView(bytes.buffer);view.setUint32(8,13);bytes.set([0x49,0x48,0x44,0x52],12);view.setUint32(16,width);view.setUint32(20,height);return bytes;};
async function request({id=scenes.sceneReferences[0].id, file=true, production=false, background=null, sceneBytes=null}={}) {
  saved=undefined;submitted=undefined;references=[];
  const form=new FormData();
  for(const [key,value] of Object.entries({requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',model:'gpt-image-2',intent:'interior',artworkId:'art',frameId:'frame',colorId:'walnut',sceneId:id}))form.set(key,value);
  form.set('frame',new File(['frame'],'frame.png',{type:'image/png'}));
  form.set('artwork',new File(['art'],'art.png',{type:'image/png'}));
  if(background)form.set('background',background);
  if(file)form.set('scene',new File([sceneBytes||'scene'],'scene.png',{type:'image/png'}));
  if(production)form.set('productionItemId','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  return POST(new Request('https://example.com/api/generate-preview',{method:'POST',body:form}));
}
assert.equal((await request()).status,202);
assert.deepEqual(references,['frame.png','art.png','scene.png']);
assert.match(submitted.prompt,/图3.*室内环境参考/);
assert.match(submitted.prompt,/不把场景印进画芯/);
assert.equal(JSON.parse(saved.recipe_json).sceneId,scenes.sceneReferences[0].id);
assert.equal((await request({id:'invalid-scene'})).status,400);assert.equal(submitted,undefined);
assert.equal((await request({file:false})).status,400);assert.equal(submitted,undefined);
await request({production:true});assert.equal(submitted,undefined,'size workflow must not replace confirmed shared scene');
// A scene supplies the room background, so transparent output must be refused.
// This one rule is also what disables the option in the client, so the two
// sides cannot drift apart.
assert.equal(scenes.sceneRequiresOpaqueBackground(true,'transparent'),true);
assert.equal(scenes.sceneRequiresOpaqueBackground(true,'auto'),false);
assert.equal(scenes.sceneRequiresOpaqueBackground(false,'transparent'),false);
assert.equal((await request({background:'transparent'})).status,400);assert.equal(submitted,undefined,'transparent output must not reach the provider with a scene');
// The uploaded bytes must be the bundled scene the id names. PNG dimensions are
// read from the 24-byte header and compared before anything is uploaded.
const header=scenes.pngPixelSize(pngHeader(1024,1024));
assert.ok(header&&header.width===1024&&header.height===1024,'PNG header width/height must be read big-endian');
assert.equal(scenes.pngPixelSize(new Uint8Array([1,2,3])),null);
assert.equal((await request({sceneBytes:pngHeader(64,64)})).status,400);assert.equal(submitted,undefined,'mismatched scene bytes must never be submitted');
assert.equal((await request({sceneBytes:pngHeader(1024,1024)})).status,202);
console.log('PASS scene catalog, bundled assets and attribution, third reference submission, history recipe, invalid scene, transparent-background and dimension mismatch guards (mock; no paid generation).');
