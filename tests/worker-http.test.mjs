import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Run the real transport in workerd, not a Node fetch mock. No network or keys.
const result = await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import { fetchWithoutRedirect } from './lib/safe-http';
export default {async fetch(){
  const result={oldRejected:false,newAccepted:false,redirectBlocked:false,calls:0,secretHidden:false};
  try{new Request('https://example.com',{redirect:'error'});}catch{result.oldRejected=true;}
  const request={method:'POST',headers:{authorization:'Bearer test-only'},body:'{}'};
  const ok=await fetchWithoutRedirect('https://example.com',request,async(url,init)=>{
    result.calls++;const r=new Request(url,init);
    result.newAccepted=r.redirect==='manual'&&r.method==='POST'&&await r.text()==='{}';
    return Response.json({ok:true});
  });
  if(!ok.ok)throw Error('expected success');
  try{await fetchWithoutRedirect('https://example.com',request,async(url,init)=>{
    result.calls++;new Request(url,init);return new Response(null,{status:307,headers:{location:'https://other.example/secret'}});
  });}catch(e){result.redirectBlocked=e.message.includes('HTTP 307')&&!e.message.includes('other.example');}
  try{await fetchWithoutRedirect('https://example.com',request,async()=>{result.calls++;throw Error('TLS failure ?apiKey=secret-value');});}
  catch(e){result.secretHidden=!e.message.includes('secret-value')&&e.message.includes('安全连接失败');}
  return Response.json(result);
}};
`},bundle:true,write:false,format:'esm',platform:'browser'});
const mf=new Miniflare({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-05-22'});
try {
  const actual=await(await mf.dispatchFetch('http://localhost/')).json();
  assert.deepEqual(actual,{oldRejected:true,newAccepted:true,redirectBlocked:true,calls:3,secretHidden:true});
  console.log('PASS: actual Workers runtime accepts repaired request, rejects old option, blocks redirects, never retries or exposes secrets. No network.');
} finally {await mf.dispose();}
