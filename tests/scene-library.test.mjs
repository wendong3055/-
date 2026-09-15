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
  assert.ok(existsSync(new URL('../public'+scene.image,import.meta.url)),scene.image);
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
async function request({id=scenes.sceneReferences[0].id, file=true, production=false}={}) {
  saved=undefined;submitted=undefined;references=[];
  const form=new FormData();
  for(const [key,value] of Object.entries({requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',model:'gpt-image-2',intent:'interior',artworkId:'art',frameId:'frame',colorId:'walnut',sceneId:id}))form.set(key,value);
  form.set('frame',new File(['frame'],'frame.png',{type:'image/png'}));
  form.set('artwork',new File(['art'],'art.png',{type:'image/png'}));
  if(file)form.set('scene',new File(['scene'],'scene.png',{type:'image/png'}));
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
console.log('PASS scene catalog, bundled assets and attribution, third reference submission, history recipe, invalid scene and size guards (mock; no paid generation).');
