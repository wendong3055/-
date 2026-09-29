import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
async function bundle(contents,plugins=[]){const b=await build({stdin:{contents,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {oneClickDraft,usablePlan,batchQueue,reusableWorkflowBackground,validateProductionPlan,planItems,sharedScene}=await bundle(`export * from './lib/production-workflow';export * from './lib/production-plan';export {sharedScene} from './lib/production-scene';`);
const spec={key:'60x200',widthCm:60,heightCm:200,depthCm:30,widthParts:[60],sourceIds:['frame'],sourceUrls:['/api/files/frame']};
const data={product:{id:'p',name:'新品',sampleAssetId:'sample',frameName:'测试框架'},sizes:[spec],sources:[{id:'frame'}],plans:[],sample:{recipe:{artworkId:'art',frameId:'frame',colorId:'color'}}};
function makePlan(page){const config=validateProductionPlan(oneClickDraft(data,page),['frame']);return{id:page,version:1,config,items:planItems(config).map((i,n)=>({...i,id:`${page}-${n}`,generationId:null,review:'pending',note:'',task:null}))};}
for(const page of ['main','size','detail'])assert.ok(usablePlan(makePlan(page),page));
assert.equal(makePlan('main').items.length,8);assert.equal(makePlan('detail').items.length,12);assert.equal(makePlan('size').items.length,2);
assert.deepEqual(data.sizes[0],spec);assert.equal(oneClickDraft(data,'size').sizes[0].sourceIds[0],'frame');
assert.throws(()=>oneClickDraft({...data,sizes:[]},'size'),/框架库/);
const size=makePlan('size');assert.deepEqual(batchQueue(size,'size').map(i=>i.kind),['main','size']);
const ready={...size.items[0],generationId:'bg',task:{status:'succeeded',url:'/bg'},review:'pending'};
const progressed={...size,items:[ready,size.items[1]]};
assert.equal(sharedScene(progressed),ready);assert.equal(ready.review,'pending');
assert.equal(sharedScene({...progressed,config:{...progressed.config,workflow:undefined}}),undefined);
assert.deepEqual(batchQueue(progressed,'size').map(i=>i.kind),['size']);
assert.equal(reusableWorkflowBackground([progressed],size.config),ready);
assert.equal(reusableWorkflowBackground([{...progressed,items:[{...ready,review:'rework'}]}],size.config),undefined);
assert.equal(reusableWorkflowBackground([progressed],{...size.config,notes:'不同要求'}),undefined);
assert.throws(()=>batchQueue({...size,items:[{...ready,task:{status:'unknown'}},size.items[1]]},'size'),/待核对/);
const detail=makePlan('detail');detail.items[0]={...detail.items[0],generationId:'done',task:{status:'succeeded',url:'/done'}};
assert.equal(batchQueue(detail,'detail').length,11);assert.equal(batchQueue(detail,'detail',true).length,0);
const view=readFileSync('app/product-workspace.tsx','utf8');
for(const removed of ['图案放置规则','结构、颜色与排版补充要求','使用新版12页详情模板','只做整套详情','DetailEvidenceEditor','spec-editor','保存确认清单','布局参考：'])assert.ok(!view.includes(removed),removed);
assert.match(view,/调整这张图/);assert.match(view,/production-pages/);

// Exercise actual rendered batch handlers with inert hooks and entirely mocked I/O.
const hooks={name:'test-hooks',setup(b){b.onResolve({filter:/^react$/},a=>a.importer.endsWith('production-batch.tsx')?{path:'hooks',namespace:'test'}:undefined);b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useState=x=>[x,()=>{}];export const useRef=x=>({current:x});export const useEffect=()=>{};',loader:'js'}));}};
const {ProductionBatch}=await bundle(`export {ProductionBatch} from './app/production-batch';`,[hooks]);
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):n==null||typeof n==='boolean'?'':String(n);}
const originals={fetch:globalThis.fetch,window:globalThis.window,createImageBitmap:globalThis.createImageBitmap};
try{
  for(const scenario of ['detail','main','size','cancel','missing-frame','unknown']){
    const page=['detail','main','size'].includes(scenario)?scenario:scenario==='missing-frame'?'size':'detail';
    const plan=makePlan(page),ws={...data,plans:[plan]};let done=false,prepared=0,confirmed=0;const submitted=[];
    globalThis.window={confirm:()=>{confirmed++;return scenario!=='cancel';}};
    globalThis.createImageBitmap=async()=>({width:100,height:200,close(){}});
    globalThis.fetch=async(url,init)=>{
      if(url==='/api/generations')return Response.json([]);
      if(url==='/api/products/p/workspace')return Response.json(ws);
      if(String(url).startsWith('/api/production/')){const i=plan.items.find(i=>i.id===url.split('/').at(-1));return Response.json({planId:plan.id,productId:'p',generationId:i.generationId,kind:i.kind});}
      if(url==='/api/generate-preview'){
        const id=init.body.get('productionItemId');submitted.push(id);const i=plan.items.find(i=>i.id===id);
        assert.equal(init.body.get('aspectRatio'),i.kind==='detail'?'3:4':'1:1');assert.ok(init.body.get('frame') instanceof File);
        const instruction=init.body.get('instruction');
        if(i.kind==='size')assert.match(instruction,/\[尺寸图摆件\].*每个适合摆放/);
        if(i.kind==='detail')assert.doesNotMatch(instruction,/\[尺寸图摆件\]|\[主图摆件\]/);
        i.generationId=id;i.task={id,status:scenario==='unknown'?'unknown':'succeeded',url:scenario==='unknown'?null:'/result'};return Response.json(i.task);
      }
      if(scenario==='missing-frame'&&url==='/api/files/frame')return new Response('missing',{status:404});
      if(url==='/original'||url==='/api/files/sample'||url==='/api/files/frame')return new Response(new Blob(['bytes'],{type:'image/png'}));
      throw Error(`Unexpected network path ${url}`);
    };
    const tree=ProductionBatch({data:ws,plan,page,count:plan.items.length,artworks:[{id:'art',name:'图案',file:'/thumb',originalStatus:'verified',originalFile:'/original'}],colors:[{id:'color',name:'原木',color:'#aaa'}],onPrepare:async()=>{prepared++;return{data:ws,plan};},onUpdate(){},onBusy:b=>{if(!b)done=true;}});
    assert.equal(prepared,0);assert.equal(submitted.length,0);
    assert.ok(nodes(tree).find(n=>n.type==='details'&&n.props.className==='batch-settings'&&!n.props.open));
    const start=nodes(tree).find(n=>n.type==='button'&&text(n)===`一键生成${page==='detail'?'详情页':page==='size'?'尺寸图':'主图'}`);assert.ok(start);
    start.props.onClick();start.props.onClick(); // double click must not duplicate a batch
    for(let n=0;n<100&&!done;n++)await new Promise(r=>setImmediate(r));
    assert.ok(done,scenario);assert.equal(prepared,1);
    const expected=scenario==='cancel'||scenario==='missing-frame'?0:scenario==='unknown'?1:plan.items.length;
    assert.equal(submitted.length,expected,scenario);assert.equal(new Set(submitted).size,submitted.length);
    assert.equal(confirmed,scenario==='missing-frame'?0:1);
  }
}finally{Object.assign(globalThis,originals);}
console.log('PASS one-click main/detail/size handlers, automatic defaults/background, 12 pages, preflight, cancellation, double-click lock, unknown stop, history and no mount submission. Mock calls only.');
