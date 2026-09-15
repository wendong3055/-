import snapshot from './runninghub-catalog.json';
import { defaultValues, validateParams, type RhModel, type RhParam } from './rh-creator-schema';

export const imageCatalogDate = snapshot.checkedAt;
export const imageCatalogSource = snapshot.source;
const tested = new Set(['2133100000000800376','2046514150500524035']);
export function imageModelName(name:string) {
  return name.replace(/\/stable-token/g,' · 稳定版（按用量）').replace(/\/stable/g,' · 稳定版').replace(/\/economy/g,' · 经济版')
    .replace(/\/text-to-image/g,' · 文生图').replace(/\/(image-to-image|edit)(?=\/| ·|$)/g,' · 图像编辑').replace(/\/edit-ultra/g,' · 超清编辑')
    .replace(/\/turbo/g,' · Turbo').replace(/\//g,' · ');
}
export const internationalImageModels:RhModel[] = snapshot.models.map(m=>{
  const params:RhParam[]=m.fields.map(raw=>{
    const f=raw as {fieldKey:string;title:string;type:string;required?:boolean;defaultValue?:string|number|boolean;options?:{value:string|number;label:string}[];min?:number;max?:number;minLength?:number;maxLength?:number;multipleInputs?:boolean;maxInpuNum?:number;maxSize?:number};
    const node=f.fieldKey.includes('##');
    // The standard API exposes titles / semantic enum labels, not ComfyUI node IDs.
    const key=node?f.title:f.fieldKey;
    const options=f.options?.map(o=>node?o.label:o.value);
    let value=f.defaultValue??undefined;
    if(options?.length && !options.some(o=>String(o)===String(value))) value=f.required?options.find(o=>o!=='custom')??options[0]:undefined;
    if(['INT','FLOAT'].includes(f.type)&&value!==undefined&&value!==''&&(!Number.isFinite(Number(value))||f.min!==undefined&&Number(value)<f.min||f.max!==undefined&&Number(value)>f.max))value=f.required?f.min??0:undefined;
    if(['n','numImages','imageNum','maxImages'].includes(key)) value=options?.find(o=>String(o)==='1')??1;
    if(key==='forceSingle')value=true;
    return {key,type:f.type,required:!!f.required,default:value,options,min:f.min,max:f.max,minLength:f.minLength,maxLength:f.maxLength,
      multiple:!!f.multipleInputs,maxCount:f.maxInpuNum,maxSizeMB:f.maxSize,label:node?undefined:f.title};
  });
  const task=/topazlabs|layer-decomposition/.test(m.endpoint)?'图片处理':m.endpoint.includes('text-to-image')||!params.some(p=>p.type==='IMAGE')?'文生图':'图像编辑';
  return {endpoint:'intl:'+m.endpoint.slice('/openapi/v2/'.length),name_cn:imageModelName(m.name),task,output_type:'image',params,
    region:'international',source:`https://www.runninghub.ai/zh-cn/call-api/api-detail/${m.skuId}`,vendor:m.vendor,
    channel:m.channel==='economy'?'经济版':'稳定版',verified:tested.has(m.skuId),skuId:m.skuId};
});
export function internationalImageModel(endpoint:string) {return internationalImageModels.find(m=>m.endpoint===endpoint);}
export function catalogPayload(model:RhModel, values:Record<string,string>, imageUrls:string[]) {
  const media=model.params.filter(p=>p.type==='IMAGE');
  if(media.length!==1)throw new Error('此模型请到创作中心分别配置参考图。');
  const p=media[0];const body=validateParams(model,values,{[p.key]:imageUrls.length});
  body[p.key]=p.multiple?imageUrls:imageUrls[0];return body;
}
export function modelDefaults(model:RhModel){return defaultValues(model);}
