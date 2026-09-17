import { generationOwner } from '../../../../lib/generation-auth';
import { limitedFormData } from '../../../../lib/limited-form';
import { creatorModel } from '../../../../lib/rh-creator-catalog';
import {newCreatorBinding,creatorBindingKey} from '../../../../db/creator-image-connection';
import { mediaParam,validateParams } from '../../../../lib/rh-creator-schema';
import { creatorKey,creatorTask,creatorTasks,insertCreator,setCreator,publicCreatorTask } from '../../../../db/rh-creator';
import { creatorApp,creatorUpload,rhRequest,CreatorError,safeMediaUrl } from '../../../../lib/rh-creator-provider';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:Request){const owner=await generationOwner(request);if(!owner)return json({error:'请先登录。'},401);let id='',inserted=false,submitted=false;try{
  const form=await limitedFormData(request,24*1024*1024);id=String(form.get('requestId')||'');if(!/^[a-f\d-]{36}$/i.test(id)||form.get('confirmed')!=='yes')return json({error:'请先确认本次生成及费用。'},400);
  const old=await creatorTask(owner,id);if(old)return json(publicCreatorTask(old));
  await creatorTasks(owner);const endpoint=String(form.get('endpoint')||'');const binding=await newCreatorBinding(owner,endpoint);const key=await creatorBindingKey(owner,binding);const app=endpoint.startsWith('app:');const model=app?await creatorApp(key,endpoint.slice(4)):creatorModel(endpoint);if(!model)return json({error:'模型不存在。'},400);
  if(app&&model.fingerprint!==form.get('fingerprint'))return json({error:'应用参数已变化，请重新读取后确认。'},409);
  const raw=JSON.parse(String(form.get('values')||'{}'));if(!raw||typeof raw!=='object'||Array.isArray(raw))return json({error:'输入无效。'},400);
  const files:Record<string,File[]>=Object.create(null),urls:Record<string,string[]>=Object.create(null),counts:Record<string,number>=Object.create(null);
  for(const p of model.params.filter(mediaParam)){files[p.key]=form.getAll(`file:${p.key}`).filter(v=>v instanceof File&&v.size) as File[];urls[p.key]=String(raw[p.key]||'').split('\n').map(v=>v.trim()).filter(Boolean);if(app&&urls[p.key].length)throw new Error('AI 应用请上传文件，不使用外部链接。');urls[p.key].forEach(safeMediaUrl);for(const f of files[p.key]){if(f.size>Math.min(p.maxSizeMB||20,20)*1024*1024||!f.type.startsWith(p.type.toLowerCase()+'/')||/svg|html|javascript/i.test(f.type))throw new Error('素材格式不匹配或大小超限，每个文件最多20MB。');}counts[p.key]=files[p.key].length+urls[p.key].length;}
  const payload=validateParams(model,raw,counts);await insertCreator({id,owner,name:model.name_cn,endpoint,kind:model.output_type,inputs:{values:payload,fingerprint:model.fingerprint,binding}});inserted=true;
  for(const p of model.params.filter(mediaParam)){const values=[...urls[p.key]];for(const file of files[p.key])values.push(await creatorUpload(key,file,app,binding.origin));if(values.length)payload[p.key]=p.multiple?values:values[0];else if(app)payload[p.key]='';}
  await setCreator(owner,id,'submitting');submitted=true;
  const body=app?{apiKey:key,webappId:endpoint.slice(4),nodeInfoList:model.params.map(p=>({nodeId:p.nodeId,fieldName:p.fieldName,fieldValue:String(payload[p.key]??'')}))}:payload;
  const r=await rhRequest(key,app?'/task/openapi/ai-app/run':`/openapi/v2/${endpoint.replace(/^intl:/,'')}`,body,true,false,binding.origin);const remote=app?r.data?.taskId:r.taskId;
  if(typeof remote!=='string'&&typeof remote!=='number')throw new CreatorError('平台没有返回可查询的任务编号，请先到官网核对。',true);
  await setCreator(owner,id,'queued','',String(remote));return json(publicCreatorTask((await creatorTask(owner,id))!),202);
}catch(e){const message=e instanceof CreatorError?e.message:e instanceof Error&&/^[\u4e00-\u9fff]/.test(e.message)?e.message:inserted?'处理暂时中断，请刷新任务记录，勿重复提交。':'当前已有任务或输入无效，请先刷新记录。';if(inserted)await setCreator(owner,id,submitted&&(!(e instanceof CreatorError)||e.uncertain)?'unknown':'failed',message).catch(()=>undefined);return json({error:message,id:inserted?id:undefined},e instanceof CreatorError&&e.uncertain?409:400);}}
