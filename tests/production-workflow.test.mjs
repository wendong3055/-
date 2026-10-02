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
assert.match(view,/ProductionItemActions/);assert.match(view,/production-pages/);

// Exercise sample approval and continuation with the actual rendered handlers.
const hooks={name:'test-hooks',setup(b){b.onResolve({filter:/^react$/},a=>a.importer.endsWith('production-batch.tsx')?{path:'hooks',namespace:'test'}:undefined);b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useState=x=>[x,()=>{}];export const useRef=x=>({current:x});export const useEffect=()=>{};',loader:'js'}));}};
const {ProductionBatch}=await bundle(`export {ProductionBatch} from './app/production-batch';`,[hooks]);
function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
function text(n){return Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):n==null||typeof n==='boolean'?'':String(n);}
const originals={fetch:globalThis.fetch,window:globalThis.window,createImageBitmap:globalThis.createImageBitmap};
try{
  for(const scenario of ['detail','main','size','full','cancel','missing-frame','unknown','failed','active','stale-review','changed-plan','withdrawn','settings-change']){
    const page=scenario==='full'?'main':['detail','main','size'].includes(scenario)?scenario:scenario==='missing-frame'?'size':'detail';
    const plans=scenario==='full'?['main','size','detail'].map(makePlan):[makePlan(page)],plan=plans[0],ws={...data,plans};
    let done=false,prepared=0,confirmed=0,mode='sample';const submitted=[],confirmations=[];
    globalThis.window={confirm:message=>{confirmed++;confirmations.push(message);return scenario!=='cancel';}};
    globalThis.createImageBitmap=async()=>({width:100,height:200,close(){}});
    globalThis.fetch=async(url,init)=>{
      if(url==='/api/generations')return Response.json(scenario==='active'?[{status:'unknown'}]:[]);
      if(url==='/api/products/p/workspace')return Response.json(ws);
      if(String(url).startsWith('/api/production/')){
        const item=plans.flatMap(p=>p.items).find(i=>i.id===url.split('/').at(-1));assert.ok(item,url);
        if(init?.method==='POST'){const body=JSON.parse(init.body);assert.equal(body.generationId,item.generationId);item.review=body.review;return Response.json({ok:true});}
        const ownerPlan=plans.find(p=>p.items.includes(item));
        return Response.json({planId:ownerPlan.id,productId:'p',generationId:item.generationId,kind:item.kind,review:mode==='continue'&&scenario==='withdrawn'?'rework':item.review,taskStatus:item.task?.status});
      }
      if(url==='/api/generate-preview'){
        const id=init.body.get('productionItemId');submitted.push(id);const item=plans.flatMap(p=>p.items).find(i=>i.id===id);
        assert.equal(init.body.get('aspectRatio'),item.kind==='detail'?'3:4':'1:1');assert.ok(init.body.get('frame') instanceof File);
        const instruction=init.body.get('instruction');
        if(item.kind==='size')assert.match(instruction,/\[尺寸图摆件\].*每个适合摆放/);
        if(item.kind==='main')assert.match(instruction,/\[主图摆件\]/);
        if(item.kind==='detail')assert.doesNotMatch(instruction,/\[尺寸图摆件\]|\[主图摆件\]/);
        if(mode==='sample')assert.equal(init.body.get('batchSampleId'),null);
        else {assert.equal(init.body.get('batchSampleId'),plan.items[0].id);assert.equal(init.body.get('batchScope'),scenario==='full'?'full':'page');}
        item.generationId=id;item.review='pending';item.task={id,status:scenario==='unknown'?'unknown':scenario==='failed'?'failed':'succeeded',url:['unknown','failed'].includes(scenario)?null:`/api/files/${id}`,model:init.body.get('model'),resolution:'2k',recipe:{instruction,quality:init.body.get('quality'),batchSettings:JSON.parse(init.body.get('batchSettings'))}};
        return Response.json(item.task);
      }
      if(scenario==='missing-frame'&&url==='/api/files/frame')return new Response('missing',{status:404});
      if(url==='/original'||String(url).startsWith('/api/files/'))return new Response(new Blob(['bytes'],{type:'image/png'}));
      throw Error(`Unexpected network path ${url}`);
    };
    const props={data:ws,plan,page,count:plan.items.length,artworks:[{id:'art',name:'图案',file:'/thumb',originalStatus:'verified',originalFile:'/original'}],colors:[{id:'color',name:'原木',color:'#aaa'}],onPrepare:async target=>{prepared++;if(mode==='continue'&&scenario==='stale-review')plan.items[0].review='rework';if(mode==='continue'&&scenario==='changed-plan')return {data:ws,plan:makePlan(page)};return{data:ws,plan:plans.find(p=>p.id===target)};},onUpdate(){},onBusy:b=>{done=!b;}};
    const tree=ProductionBatch(props);assert.equal(prepared,0);assert.equal(submitted.length,0);
    assert.ok(nodes(tree).find(n=>n.type==='details'&&n.props.className==='batch-settings'&&!n.props.open));
    const buttons=nodes(tree).filter(n=>n.type==='button');
    const start=scenario==='full'?buttons.find(n=>text(n)==='先试做一张主图'):buttons.find(n=>text(n)===(page==='detail'?'先试做一张详情样稿':page==='size'?'先试做背景样稿':'先试做一张主图'));
    assert.ok(start,scenario);start.props.onClick();start.props.onClick();
    for(let n=0;n<100&&!done;n++)await new Promise(r=>setImmediate(r));
    assert.ok(done,scenario);assert.equal(prepared,1);
    const expected=['cancel','missing-frame','active'].includes(scenario)?0:1;
    assert.equal(submitted.length,expected,scenario);assert.equal(confirmed,['missing-frame','active'].includes(scenario)?0:1);
    if(expected&&scenario!=='cancel')assert.match(confirmations[0],/只试做 1 张/);
    if(page==='size'&&expected)assert.equal(plan.items[0].kind,'main');
    if(['cancel','missing-frame','active','unknown','failed'].includes(scenario))continue;
    // Rendering a saved sample does not approve it or submit another request.
    const reviewTree=ProductionBatch(props);
    assert.ok(nodes(reviewTree).find(n=>n.type==='button'&&text(n)===(scenario==='full'?'先验收主图样稿':'先验收样稿')&&n.props.disabled));
    const approve=nodes(reviewTree).find(n=>n.type==='button'&&text(n)==='认可样稿');assert.ok(approve);
    done=false;approve.props.onClick();for(let n=0;n<100&&!done;n++)await new Promise(r=>setImmediate(r));assert.ok(done);
    assert.equal(plan.items[0].review,'accepted');assert.equal(submitted.length,1);
    if(scenario==='settings-change')plan.items[0].task.model='different-model';
    mode='continue';done=false;
    const continuedTree=ProductionBatch(props);
    const next=nodes(continuedTree).find(n=>n.type==='button'&&text(n)===(scenario==='full'?'继续制作全套余图':'继续生成剩余图片'));assert.ok(next,scenario);next.props.onClick();next.props.onClick();
    for(let n=0;n<250&&!done;n++)await new Promise(r=>setImmediate(r));assert.ok(done,scenario);
    const blocked=['stale-review','changed-plan','withdrawn','settings-change'].includes(scenario);
    const expectedAll=blocked?1:scenario==='full'?22:plan.items.length;
    assert.equal(submitted.length,expectedAll,scenario);assert.equal(new Set(submitted).size,submitted.length,scenario);
    if(!blocked)assert.match(confirmations.at(-1),new RegExp(`制作 ${expectedAll-1} 张余图`));
  }
}finally{Object.assign(globalThis,originals);}
console.log('PASS sample-only, explicit approval/continuation, all pages/full set, accurate consent counts, cancellation, double-click, fresh-state gates, withdrawn approval, settings changes, missing references and unknown/failed stop. Mock calls only.');
