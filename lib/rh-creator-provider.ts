import { fetchWithoutRedirect, transportMessage } from './safe-http';
import { env } from 'cloudflare:workers';
import { checkDestination, limitedBytes } from './custom-image-provider';
import { publicHttps } from './custom-image-config';
import { type RhModel, type RhParam, hiddenParam } from './rh-creator-schema';
export const RH_CREATOR_ORIGIN='https://www.runninghub.cn';
export class CreatorError extends Error {constructor(message:string,public uncertain=false){super(message);}}
export async function rhRequest(key:string,path:string,body:Record<string,unknown>|FormData,billable=false,rawAuth=false){
  let r:Response;
  try{r=await fetchWithoutRedirect(RH_CREATOR_ORIGIN+path,{method:'POST',signal:AbortSignal.timeout(45000),headers:{authorization:rawAuth?key:`Bearer ${key}`,...(body instanceof FormData?{}:{'content-type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});}catch(error){throw new CreatorError(billable?'提交结果尚未确认，请在 RunningHub 核对，勿重复生成。':transportMessage(error,'连接 RunningHub 暂时失败，请稍后重试。'),billable);}
  let p:Record<string,any>;
  try{p=JSON.parse(new TextDecoder().decode(await limitedBytes(r,2*1024*1024)));}catch{throw new CreatorError('平台返回内容暂时无法识别。',billable);}
  if(!r.ok||p.errorCode||p.code!==undefined&&![0,200,'0','200'].includes(p.code)){
    const hint=String(p.errorCode||p.code||'')+' '+String(p.errorMessage||p.msg||'');
    const message=r.status===401||r.status===403||/key|token|auth|1002/i.test(hint)?'Key 无效或没有此模型权限，请检查通用模型 Key。':/balance|余额|insufficient|416/i.test(hint)?'RunningHub API 余额不足，请在官网核对。':'RunningHub 没有接受请求，请核对模型参数或稍后重试。';
    throw new CreatorError(message,billable&&(r.status>=500||r.status===408));
  }
  return p;
}
export async function creatorAccount(key:string){const p=await rhRequest(key,'/uc/openapi/accountStatus',{apiKey:key});return {valid:true,balance:p.data?.remainMoney===undefined?null:String(p.data.remainMoney),note:'连接检查不代表所有模型都可用；权限和费用以官网为准。'};}
export async function creatorUpload(key:string,file:File,app=false){const f=new FormData();f.set('file',file,file.name.replace(/[^a-zA-Z0-9._-]/g,'_'));if(app){f.set('apiKey',key);f.set('fileType','input');}const p=await rhRequest(key,app?'/task/openapi/upload':'/openapi/v2/media/upload/binary',f);const v=app?p.data?.fileName:p.data?.download_url;if(typeof v!=='string'||!v||v.length>2000)throw new CreatorError('素材上传未返回有效地址，尚未生成。');return v;}
export async function creatorApp(key:string,id:string):Promise<RhModel>{
  if(!/^\d{10,25}$/.test(id))throw new CreatorError('请粘贴正确的 RunningHub 应用链接。');
  let p:Record<string,any>;
  try{const u=new URL('/api/webapp/apiCallDemo',RH_CREATOR_ORIGIN);u.searchParams.set('apiKey',key);u.searchParams.set('webappId',id);const r=await fetchWithoutRedirect(u,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error();p=JSON.parse(new TextDecoder().decode(await limitedBytes(r,1024*1024)));}catch(error){throw new CreatorError(transportMessage(error,'应用参数读取失败，请确认应用链接和 Key 权限。'));}
  if(p.code!==0||!Array.isArray(p.data?.nodeInfoList)||!p.data.nodeInfoList.length||p.data.nodeInfoList.length>80)throw new CreatorError('该应用没有可读取的参数，请先在 RunningHub 网页上成功运行一次。');
  const params:RhParam[]=p.data.nodeInfoList.map((n:Record<string,any>)=>{
    const nodeId=String(n.nodeId),fieldName=String(n.fieldName),type=String(n.fieldType).toUpperCase();
    if(!/^[\w-]{1,60}$/.test(nodeId)||!/^[\w.-]{1,80}$/.test(fieldName)||!['STRING','INT','FLOAT','BOOLEAN','LIST','IMAGE','VIDEO','AUDIO'].includes(type))throw new CreatorError('这个应用有暂不支持的输入类型，未提交生成。');
    let data=n.fieldData;try{if(typeof data==='string')data=JSON.parse(data);}catch{data=[];}
    if(Array.isArray(data)&&Array.isArray(data[0]))data=data[0];
    const options=type==='LIST'&&Array.isArray(data)?data.map(v=>typeof v==='object'?v.index:v).filter(v=>typeof v==='string'||typeof v==='number').slice(0,200):undefined;
    if(type==='LIST'&&!options?.length)throw new CreatorError('应用选项无法识别，请重新读取。');
    const media=['IMAGE','VIDEO','AUDIO'].includes(type);
    const param:RhParam={key:`${nodeId}.${fieldName}`,nodeId,fieldName,type,label:String(n.description||fieldName).slice(0,160),options,required:media&&!/选填|可选|optional/i.test(String(n.description||'')),default:media?'':String(n.fieldValue??'').slice(0,12000)};
    if(hiddenParam({...param,key:fieldName}))throw new CreatorError('应用包含安全敏感参数，请更换应用。');
    if(type==='LIST'&&!options!.some(v=>String(v)===String(param.default)))param.default=options![0];
    return param;
  });
  if(new Set(params.map(p=>p.key)).size!==params.length)throw new CreatorError('应用参数重复，未提交生成。');
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(params)))),v=>v.toString(16).padStart(2,'0')).join('');
  return {endpoint:`app:${id}`,name_cn:String(p.data.webappName||'我的 AI 应用').slice(0,160),task:'app',output_type:'app',params,fingerprint};
}
export async function creatorApps(key:string,page:number,sort:string){const p=await rhRequest(key,'/openapi/v2/aiapp/list',{current:page,size:12,sort,days:7},false,true);const rows=p.data?.records||p.data?.list||[];return (Array.isArray(rows)?rows:[]).map((a:Record<string,any>)=>({id:String(a.webappId||String(a.invokeExample||'').match(/\/run\/ai-app\/(\d{10,25})/)?.[1]||''),name:String(a.title||a.name||a.webappName||'AI 应用').slice(0,160)})).filter(a=>/^\d{10,25}$/.test(a.id));}
export function safeMediaUrl(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash)throw new CreatorError('素材链接必须是安全的 HTTPS 地址。');publicHttps(u.origin);return u;}
export async function archiveCreatorResult(owner:string,id:string,index:number,source:string,kind:string){
  const u=safeMediaUrl(source);await checkDestination(u.origin);
  const r=await fetchWithoutRedirect(u,{signal:AbortSignal.timeout(90000)});
  if(!r.ok||!r.body)throw new CreatorError('结果下载暂时失败，可恢复保存。');
  if(Number(r.headers.get('content-length')||0)>200*1024*1024)throw new CreatorError('结果超过200MB，请先从原平台下载。');
  const extension=u.pathname.split('.').pop()?.toLowerCase()||'';
  const known:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',flac:'audio/flac',glb:'model/gltf-binary',gltf:'model/gltf+json',obj:'text/plain',zip:'application/zip',json:'application/json'};
  const rawMime=(r.headers.get('content-type')||'').split(';')[0];const mime=known[extension]||(/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|ogg|flac)|model\/gltf-binary)$/.test(rawMime)?rawMime:'application/octet-stream');
  if(/html|javascript|svg/i.test(rawMime))throw new CreatorError('平台返回了网页而非结果文件，已拒绝保存。');
  const key=`${owner}/rh-creator/${id}/${index}`;const existing=await env.FILES.head(key);if(existing)return {key,mime:existing.httpMetadata?.contentType||mime,name:`作品-${index+1}.${extension||'bin'}`};
  const multi=await env.FILES.createMultipartUpload(key,{httpMetadata:{contentType:mime}});const parts:R2UploadedPart[]=[];const reader=r.body.getReader();let buffer=new Uint8Array(8*1024*1024),used=0,total=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>200*1024*1024)throw new CreatorError('结果超过200MB，请从原平台下载。');let offset=0;while(offset<value.length){const n=Math.min(buffer.length-used,value.length-offset);buffer.set(value.subarray(offset,offset+n),used);used+=n;offset+=n;if(used===buffer.length){parts.push(await multi.uploadPart(parts.length+1,buffer));buffer=new Uint8Array(8*1024*1024);used=0;}}}if(!total)throw new CreatorError('结果文件为空。');if(used)parts.push(await multi.uploadPart(parts.length+1,buffer.subarray(0,used)));await multi.complete(parts);}catch(e){await multi.abort().catch(()=>undefined);throw e;}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  return {key,mime,name:`${kind==='app'?'应用结果':'作品'}-${index+1}.${known[extension]?extension:'bin'}`};
}
