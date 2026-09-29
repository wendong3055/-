// Owner-private Site shared catalog provisioning. No DB/library/history changes.
// Token enters hidden stdin and is never stored, logged or sent on redirects.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const stdin=process.stdin;
stdin.setRawMode(true);stdin.setEncoding('utf8');
console.log('Ready for original sync JSON (input hidden).');
const config=await new Promise((resolve,reject)=>{let input='';stdin.on('data',chunk=>{input+=chunk;if(input.includes('\n')||input.includes('\r')){stdin.pause();stdin.setRawMode(false);try{resolve(JSON.parse(input.trim()));}catch{reject(Error('Invalid configuration'));}});});
const origin='https://pingfeng-product-studio.shinokard.chatgpt.site';
if(config.origin!==origin||!config.token)throw Error('Wrong Site or missing service credential');
const index=JSON.parse(readFileSync('public/library/2026-08-27-v2/originals-index.json','utf8').replace(/^\uFEFF/,''));
const staticIndex=JSON.parse(readFileSync('lib/site-asset-index.json','utf8').replace(/^\uFEFF/,''));
const queue=[...Object.entries(staticIndex).map(([path,row])=>[path,{...row,apiPath:'/api/site-assets/'+row.originalHash,readPath:path}]),...Object.entries(index).map(([id,row])=>[id,{...row,apiPath:'/api/library-originals/'+id,readPath:'/api/library-originals/'+id}])];const total=queue.length;let done=0,uploaded=0;const failures=[];
async function request(path,options={}){return fetch(new URL(path,origin),{...options,redirect:'error',headers:{...options.headers,'OAI-Sites-Authorization':`Bearer ${config.token}`},signal:AbortSignal.timeout(240000)});}
async function worker(){while(queue.length){const [id,entry]=queue.shift();try{
 const path=entry.apiPath;
 const head=await request(path,{method:'HEAD'});
 if(head.status!==200){
   if(head.status!==404)throw Error(`HEAD ${head.status}`);
   const bytes=readFileSync(entry.originalDiskFile);
   if(createHash('sha256').update(bytes).digest('hex')!==entry.originalHash)throw Error('Local hash mismatch');
   const r=await request(path,{method:'PUT',body:bytes,headers:{'Content-Type':'application/octet-stream'}});
   if(!r.ok)throw Error(`PUT ${r.status}`);uploaded++;
 }
 const check=await request(entry.readPath);
 if(!check.ok)throw Error(`GET ${check.status}`);
 const hash=createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex');
 if(hash!==entry.originalHash)throw Error('Remote hash mismatch');
 done++;if(done%20===0)console.log(`Verified ${done}/${total} image files`);
 }catch(e){failures.push({id,error:e.message.replace(config.token,'[redacted]')});}}
}
await Promise.all(Array.from({length:4},worker));
console.log(JSON.stringify({verified:done,uploaded,failures}));
process.exitCode=failures.length?1:0;
