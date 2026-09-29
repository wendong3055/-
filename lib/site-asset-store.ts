import index from './site-asset-index.json';
import {env} from 'cloudflare:workers';
import {checkedOriginalBody} from './library-original-store';
type Asset={originalHash:string;originalBytes:number;originalDiskFile:string;originalStatus:string;mime:string};
const catalog=index as Record<string,Asset>;
export function siteAsset(path:string){if(!Object.hasOwn(catalog,path))return null;const entry=catalog[path];return {...entry,key:`bundled-site-assets/v1/${entry.originalHash}`};}
export function siteAssetByHash(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))return null;const path=Object.keys(catalog).find(path=>catalog[path].originalHash===hash);return path?siteAsset(path):null;}
export async function readSiteAsset(path:string){
 const entry=siteAsset(path);if(!entry)return new Response('Not found',{status:404});
 try{const object=await env.FILES.get(entry.key);if(!object)return new Response('图片尚未完成同步',{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(object.body,{headers:{'Content-Type':entry.mime,'Content-Length':String(object.size),'X-Original-SHA256':entry.originalHash,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('图片存储暂不可用',{status:503});}
}
export async function writeSiteAsset(request:Request,hash:string){
 const origin=request.headers.get('origin');
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))return new Response('Forbidden',{status:403});
 const entry=siteAssetByHash(hash);if(!entry)return new Response('未登记的图片',{status:404});
 let bytes:ArrayBuffer;try{bytes=await checkedOriginalBody(request,entry);}catch{return new Response('图片内容与登记原件不符',{status:400});}
 try{const existing=await env.FILES.head(entry.key);if(!existing)await env.FILES.put(entry.key,bytes,{httpMetadata:{contentType:entry.mime},customMetadata:{sha256:entry.originalHash}});else if(existing.size!==entry.originalBytes)return new Response('存储内容异常，未覆盖',{status:409});return Response.json({ok:true,sha256:entry.originalHash});}catch{return new Response('图片存储暂不可用',{status:503});}
}
export async function headSiteAsset(hash:string){
 const entry=siteAssetByHash(hash);if(!entry)return new Response(null,{status:404});
 try{const object=await env.FILES.head(entry.key);return new Response(null,{status:object?.size===entry.originalBytes?200:404,headers:{'Cache-Control':'no-store'}});}catch{return new Response(null,{status:503});}
}
