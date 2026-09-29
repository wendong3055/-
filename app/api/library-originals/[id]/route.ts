import {env} from 'cloudflare:workers';
import {originalRecord,checkedOriginalBody} from '../../../../lib/library-original-store';

// These are shared, bundled catalog originals, NOT user uploads or generated
// results. The owner-private Site dispatch authenticates browsers and service
// callers. Only exact bytes in the checked-in hash allowlist may be written.
// No arbitrary object names, overwrite/delete API, library rows or credentials.
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context){
  const entry=originalRecord((await context.params).id);
  if(!entry)return new Response('原图不存在',{status:404});
  try{
    const object=await env.FILES.get(entry.key);
    if(!object)return new Response('原图尚未完成同步，请稍后重试，不会以缩略图代替。',{status:404,headers:{'Cache-Control':'no-store'}});
    return new Response(object.body,{headers:{'Content-Type':entry.mime,'Content-Length':String(object.size),'X-Original-SHA256':entry.originalHash,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('原图存储暂不可用',{status:503});}
}
export async function HEAD(_request:Request,context:Context){
  const entry=originalRecord((await context.params).id);
  if(!entry)return new Response(null,{status:404});
  try{const object=await env.FILES.head(entry.key);return new Response(null,{status:object?.size===entry.originalBytes?200:404,headers:{'X-Original-SHA256':entry.originalHash,'Cache-Control':'no-store'}});}catch{return new Response(null,{status:503});}
}
export async function PUT(request:Request,context:Context){
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))return new Response('Forbidden',{status:403});
  const entry=originalRecord((await context.params).id);
  if(!entry)return new Response('未登记的原图',{status:404});
  let bytes:ArrayBuffer;
  try{bytes=await checkedOriginalBody(request,entry);}catch(e){return Response.json({error:e instanceof Error?e.message:'原图校验失败'},{status:400});}
  try{
    const existing=await env.FILES.head(entry.key);
    if(!existing)await env.FILES.put(entry.key,bytes,{httpMetadata:{contentType:entry.mime},customMetadata:{sha256:entry.originalHash}});
    else if(existing.size!==entry.originalBytes)return Response.json({error:'存储内容异常，未覆盖'},{status:409});
    return Response.json({ok:true,sha256:entry.originalHash,bytes:entry.originalBytes});
  }catch{return Response.json({error:'原图存储暂不可用，请重试'},{status:503});}
}
