import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
const moduleUrl=async path=>{
  let code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  if(code.includes("from './production-scene'"))code=code.replace("from './production-scene'",`from '${await moduleUrl('../lib/production-scene.ts')}'`);
  return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
};
const load=async path=>import(await moduleUrl(path));
const {sharedScene,canReuseScene,validSizeMarks,sceneSizeBrief}=await load('../lib/production-scene.ts');
const {validateProductionPlan,planItems}=await load('../lib/production-plan.ts');
const spec={widthCm:60,heightCm:200,depthCm:30,sourceIds:['representative']};
const scene={id:'main',title:'客厅场景',kind:'main',review:'accepted',generationId:'g',task:{status:'succeeded',url:'/api/files/a',model:'gpt-image-2',resolution:'2k',aspectRatio:'1:1'}};
const plan={config:{sceneTitle:'客厅场景'},items:[scene]};
const item={kind:'size',spec};const workspace={sample:{recipe:{frameId:'uploaded-frame-representative'}}};
assert.equal(sharedScene(plan),scene);assert.equal(sharedScene({...plan,items:[{...scene,review:'rework'}]}),undefined);
assert.ok(!canReuseScene(item,workspace,plan));assert.ok(!canReuseScene({...item,spec:{...spec,sourceIds:['other']}},workspace,plan));
assert.ok(!canReuseScene(item,workspace,{...plan,items:[{...scene,task:{...scene.task,model:'gpt-image-2.5-sunburst'}}]}));
assert.ok(!canReuseScene(item,workspace,{...plan,items:[{...scene,task:{...scene.task,model:'other'}}]}));
const marks={generationId:'g',points:[{x:.3,y:.8},{x:.6,y:.8},{x:.2,y:.1},{x:.2,y:.8},{x:.6,y:.8},{x:.7,y:.75}]};
assert.ok(validSizeMarks(marks,'g',true));assert.ok(!validSizeMarks(marks,'other',true));assert.ok(!validSizeMarks({...marks,points:Array(6)},'g',true));
assert.ok(!validSizeMarks({...marks,points:marks.points.map(()=>({x:2,y:1}))},'g',true));
assert.match(sceneSizeBrief(spec,'only upper',''),/图3为共用场景主图/);assert.match(sceneSizeBrief(spec,'',''),/不沿用图3产品的尺寸或数量/);
assert.match(sceneSizeBrief(spec,'',''),/完整保留框架原图里的尺寸文字、数字、单位、尺寸线、箭头/);
assert.doesNotMatch(sceneSizeBrief(spec,'','不要生成文字或尺寸箭头；根据确认数据添加标注，成品预览与下载一致。'),/不要生成文字或尺寸箭头/);
const {preservesSourceSizeMarks}=await load('../lib/production-scene.ts');
assert.equal(preservesSourceSizeMarks({...item,id:'i',task:{recipe:{productionItemId:'i',sizeAnnotationMode:'source-preserved-v1'}}}),true);
assert.ok(!preservesSourceSizeMarks({...item,id:'i',task:{recipe:{productionItemId:'other',sizeAnnotationMode:'source-preserved-v1'}}}));
assert.ok(!preservesSourceSizeMarks({...item,id:'i',task:{recipe:{}}}));
const input={name:'test',expectedVersion:0,rule:'upper',notes:'',sizes:[spec],main:['客厅场景'],details:['新品形象'],confirmed:true,sceneTitle:'客厅场景'};
const validated=validateProductionPlan(input,['representative']);assert.equal(validated.sceneTitle,'客厅场景');
assert.throws(()=>validateProductionPlan({...input,main:['白底主图']},['representative']));
assert.match(planItems(validated).find(i=>i.kind==='size').brief,/沿用客厅场景背景/);
assert.match(planItems(validated).find(i=>i.kind==='main').brief,/四周保留标注空间/);
const models=await readFile(new URL('../lib/generation-models.ts',import.meta.url),'utf8');assert.match(models,/defaultImageModel = imageModels.find\(model => model.id === 'gpt-image-2'\)/);
// Execute the export path: preserve original bytes without a second annotation
// layer; legacy results still require their saved annotation positions.
const exportCode=ts.transpileModule(await readFile(new URL('../lib/production-export.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const outputModule={exports:{}}, originalBlob=new Blob(['image bytes'],{type:'image/png'});
vm.runInNewContext(exportCode,{module:outputModule,exports:outputModule.exports,
  require:n=>n==='./production-scene'?{preservesSourceSizeMarks,validSizeMarks}:{},
  fetch:async()=>({ok:true,blob:async()=>originalBlob})});
const annotated={...item,id:'i',generationId:'g',task:{url:'/api/files/g',recipe:{productionItemId:'i',sizeAnnotationMode:'source-preserved-v1'}}};
assert.equal(await outputModule.exports.publicationImage(annotated,workspace,plan),originalBlob);
await assert.rejects(()=>outputModule.exports.publicationImage({...annotated,task:{url:'/api/files/g',recipe:{}}},workspace,plan),/请先保存尺寸标注位置/);
const recipeCode=ts.transpileModule(await readFile(new URL('../lib/studio-brief.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const recipeModule={exports:{}};
vm.runInNewContext(recipeCode,{module:recipeModule,exports:recipeModule.exports,require:()=>({cleanAppSetup:()=>null})});
const parsed=recipeModule.exports.parseRecipe(JSON.stringify({artworkId:'a',frameId:'f',colorId:'c',intent:'catalog',instruction:'',productionItemId:'12345678-1234-1234-1234-123456789012',sizeAnnotationMode:'source-preserved-v1'}));
assert.equal(parsed.sizeAnnotationMode,'source-preserved-v1');
console.log('Unified scene, original frame annotations, no new main-image reuse, and legacy mark compatibility passed');
