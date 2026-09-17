import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const code=await readFile(new URL('../lib/production-consent.ts',import.meta.url),'utf8');
const helpers=await import('data:text/javascript;base64,'+Buffer.from(compile(code)).toString('base64'));
const {createConsent,consumeConsent,consentCovers,consentSettings,readConsent,consentKey}=helpers;
const scope={planId:'p1',productId:'product1',settings:'s1'};
const receipt=createConsent(scope,['i1','i2']);
assert.ok(consentCovers(receipt,scope,'i1',false));
assert.ok(!consentCovers(receipt,scope,'i1',true));
assert.ok(!consentCovers(receipt,scope,'new-item',false));
assert.ok(!consentCovers(receipt,{...scope,planId:'p2'},'i1',false));
assert.ok(!consentCovers(receipt,{...scope,settings:'4k-new-model'},'i1',false));
assert.ok(!consentCovers(receipt,{...scope,productId:'other'},'i1',false));
assert.ok(!consentCovers(consumeConsent(receipt,'i1'),scope,'i1',false));
assert.ok(consentCovers(consumeConsent(receipt,'i1'),scope,'i2',false));
assert.equal(consentSettings({a:1,b:{x:2,y:3}}),consentSettings({b:{y:3,x:2},a:1}));
assert.equal(readConsent({getItem:()=>'{broken'},'p1'),null);
assert.equal(readConsent({getItem:()=>JSON.stringify({...receipt,remaining:'all'})},'p1'),null);

// Execute the real UI submit handler with fake networking: no paid requests.
const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
const handler=page.slice(page.indexOf('  async function generatePreview()'),page.indexOf('  function selectArtwork('));
const memory=new Map();let calls=0,dialogs=[],confirm=true,fresh,fail=false;
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const noop=()=>{};
const ctx={...helpers,FormData,URL,console,canGenerate:true,selected:{file:'/art',id:'art',name:'art'},frame:{id:'f',file:'/frame',name:'frame'},frameColor:{id:'walnut',name:'walnut',color:'#402b24'},
 production:{itemId:'i1',productId:'product1',planId:'p1',planVersion:2,pendingItemIds:['i1','i2'],generationId:null},
 previewGenerating:false,submitGuard:{current:false},modelConfigured:true,appReady:true,model:{id:'m',name:'model',qualities:[]},customConfig:null,outputRatio:'1:1',outputResolution:'4k',confirmationSettings:'s1',aspectRatio:'1:1',resolution:'4k',quality:'',instruction:'Chinese prompt',intent:'catalog',memberInputs:null,sceneInUse:undefined,
 window:{localStorage:storage,confirm:s=>{dialogs.push(s);return confirm;},setTimeout:noop},
 fetch:async url=>url.startsWith('/api/production/')?{ok:true,json:async()=>fresh}:{ok:true,blob:async()=>new Blob(['test'])},
 referenceUpload:async blob=>blob,
 generations:{busy:false,submit:async()=>{calls++;if(fail)throw new Error('unknown submit');return {id:'task1',status:'queued'};}},
 isActiveGeneration:()=>true,
 storeProductionConsent:value=>value?storage.setItem(consentKey(value.planId),JSON.stringify(value)):storage.removeItem(consentKey('p1')),
 setProduction:value=>{ctx.production=value;},setPreviewGenerating:noop,setPreviewError:noop,setNotice:noop,setImportedResult:noop,setViewedTaskId:noop,setPreviewTaskId:noop,setPreviewReady:noop};
vm.createContext(ctx);vm.runInContext(compile(handler),ctx);
fresh={...ctx.production};
confirm=false;await ctx.generatePreview();assert.equal(calls,0);assert.equal(memory.size,0);assert.equal(ctx.submitGuard.current,false);
confirm=true;dialogs=[];await ctx.generatePreview();assert.equal(calls,1);assert.equal(dialogs.length,1);assert.match(dialogs[0],/剩余 2 项/);
assert.deepEqual(readConsent(storage,'p1').remaining,['i2']);
// A fresh page/tab reading the same saved preference skips the second confirmation.
ctx.production={...ctx.production,itemId:'i2'};fresh={...ctx.production,pendingItemIds:['i2']};dialogs=[];
await ctx.generatePreview();assert.equal(calls,2);assert.equal(dialogs.length,0);
// Retrying even an ambiguous submission must ask again, never auto-retry.
dialogs=[];fail=true;await ctx.generatePreview();assert.equal(calls,3);assert.equal(dialogs.length,1);assert.match(dialogs[0],/重新提交/);
fail=false;fresh={...fresh,generationId:'failed-task'};dialogs=[];await ctx.generatePreview();assert.equal(dialogs.length,1);
// Model change and revocation both restore the first confirmation.
ctx.production={...ctx.production,itemId:'i3'};fresh={...ctx.production,generationId:null,pendingItemIds:['i3']};ctx.confirmationSettings='s2';dialogs=[];
await ctx.generatePreview();assert.equal(dialogs.length,1);
storage.removeItem(consentKey('p1'));dialogs=[];await ctx.generatePreview();assert.equal(dialogs.length,1);
// Cancellation and active-task gates still prevent charging.
const before=calls;ctx.generations.busy=true;await ctx.generatePreview();assert.equal(calls,before);
assert.match(page,/撤销本套确认/);
console.log('PASS: plan-scoped consent, reload reuse, scope changes, retry, cancellation, revoke and submission gates (mock only).');
