import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const replacements={
  'cloudflare:workers':'export const env={FILES:{put:async()=>{}}};',
  'chatgpt-auth':'export const getChatGPTUser=async()=>({userId:"owner"});',
  'custom-image-providers':'export const customProvider=async()=>null;',
  'runninghub-international':'export const latestInternationalKeyId=async()=>null;',
  'generation-tasks':`export const getTask=async()=>globalThis.batchTest.task;export const listTasks=async()=>[];export const insertTask=async row=>{globalThis.batchTest.task=row;return true;};export const publicTask=row=>row;export const claimSubmission=async()=>true;export const updateTask=async(_,__,status)=>{globalThis.batchTest.task.status=status;};`,
  'production':`export const productionContext=async(_,id)=>globalThis.batchTest.context(id);export const claimProductionItem=async()=>{};export const productionFrameFile=async()=>null;export const productionDetailFiles=async()=>[];export const productionSceneFile=async()=>{throw Error('not used');};export class ProductionError extends Error{constructor(message,status=400){super(message);this.status=status;}}`,
  'runninghub':`export const RUNNINGHUB_MODEL='gpt-image-2';export const runningHubConnection=async()=>({});export const providerError=()=>'';export class RunningHubError extends Error{};export const uploadReference=async()=>{globalThis.batchTest.uploads++;if(globalThis.batchTest.withdraw)globalThis.batchTest.sample.review='rework';return 'https://mock.test/image';};export const submitGeneration=async()=>{globalThis.batchTest.billable++;return{taskId:'remote',status:'QUEUED'};};`,
};
const plugin={name:'mock-io',setup(b){b.onResolve({filter:/.*/},a=>{const key=a.path==='cloudflare:workers'?a.path:Object.keys(replacements).find(key=>a.path.endsWith('/'+key)||a.path.endsWith('/'+key+'.ts'));return key?{path:key,namespace:'mock'}:undefined;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:replacements[a.path],loader:'js'}));}};
const built=await build({stdin:{contents:`export {POST} from './app/api/generate-preview/route';export {mainOptions} from './lib/production-plan';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',external:['next/server'],logLevel:'silent',plugins:[plugin]});
const m={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,m,m.exports);const {POST,mainOptions}=m.exports;
const sampleId='11111111-1111-4111-8111-111111111111', generationId='22222222-2222-4222-8222-222222222222',targetId='33333333-3333-4333-8333-333333333333';
for(const scenario of ['valid-page','valid-full','pending','wrong-generation','different-product','old-plan','config-change','wrong-sample','changed-settings','withdraw-during-upload']){
  const sample={id:sampleId,title:mainOptions[0],kind:'main',generationId,review:'accepted',task:{id:generationId,status:'succeeded',url:'/api/files/sample',model:'gpt-image-2',resolution:'2k',recipe:{quality:'medium',instruction:'saved',batchSettings:{propsMode:'none',propsText:''}}}};
  const config={rule:'all',notes:'',workflow:'one-click-v1'};
  const plan={id:'plan',config,items:mainOptions.map((title,n)=>n?{id:n===1?targetId:`item-${n}`,kind:'main',title,generationId:null,review:'pending'}:sample)};
  const target=plan.items[1];
  const workspace={product:{id:'p',frameName:'框架'},sample:{recipe:{artworkId:'art',frameId:'frame',colorId:'color'}},sizes:[],plans:[plan]};
  if(scenario==='pending')sample.review='pending';
  if(scenario==='old-plan')workspace.plans.unshift({...plan,id:'new-plan',items:plan.items.map(i=>({...i,id:`new-${i.id}`}))});
  if(scenario==='wrong-sample')sample.id='other';
  globalThis.batchTest={task:null,sample,billable:0,uploads:0,withdraw:scenario==='withdraw-during-upload',context(id){
    const isSample=id===sampleId;
    return{workspace,config:scenario==='config-change'&&!isSample?{...config,notes:'different'}:config,row:{id,plan_id:'plan',product_id:scenario==='different-product'&&isSample?'other':'p',kind:'main',title:isSample?sample.title:target.title,brief:'保持产品',review:isSample?sample.review:'pending',generation_id:isSample?generationId:null}};
  }};
  const form=new FormData();form.set('artwork',new File(['x'],'art.png',{type:'image/png'}));form.set('frame',new File(['x'],'frame.png',{type:'image/png'}));
  const fields={requestId:crypto.randomUUID(),productionItemId:targetId,artworkId:'art',frameId:'frame',colorId:'color',model:'gpt-image-2',aspectRatio:'1:1',resolution:'2k',quality:'medium',intent:'catalog',instruction:'保持产品结构',batchSettings:JSON.stringify({propsMode:scenario==='changed-settings'?'auto':'none',propsText:''}),batchSampleId:sampleId,batchSampleGenerationId:scenario==='wrong-generation'?'different':generationId,batchScope:['valid-full','old-plan'].includes(scenario)?'full':'page'};
  Object.entries(fields).forEach(([key,value])=>form.set(key,value));
  const response=await POST(new Request('https://studio.test/api/generate-preview',{method:'POST',body:form}));
  const allowed=scenario==='valid-page'||scenario==='valid-full';
  assert.equal(globalThis.batchTest.billable,allowed?1:0,scenario);
  assert.equal(response.status,allowed?202:502,scenario);
  if(scenario==='withdraw-during-upload'){assert.ok(globalThis.batchTest.uploads>0);assert.equal(globalThis.batchTest.task.status,'failed');}
  else if(!allowed)assert.equal(globalThis.batchTest.uploads,0,scenario);
}
delete globalThis.batchTest;
console.log('PASS real generation route: page/full scope, current sample/generation/configuration, owner-product boundary, pending rejection and approval withdrawn during upload. All provider I/O mocked.');
