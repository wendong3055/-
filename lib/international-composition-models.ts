import {internationalImageModels,catalogPayload,modelDefaults} from './international-image-catalog';
import type {ImageModel} from './generation-models';
const existing=new Set(['2133100000000800376','2046514150500524035','2004544343584849921','2027661818379649025']);
export const internationalCompositionModels:ImageModel[]=internationalImageModels.filter(m=>{
  const images=m.params.filter(p=>p.type==='IMAGE');
  return m.task==='图像编辑'&&!existing.has(m.skuId!)&&images.length===1&&images[0].multiple&&(images[0].maxCount||10)>=2;
}).map(m=>{
  const options=(key:string)=>m.params.find(p=>p.key===key)?.options?.filter(v=>v!=='custom').map(String)||[];
  const ratios=options('aspectRatio'),sizes=options('resolution').length?options('resolution'):options('size');
  return {id:`rh-image-${m.skuId}`,name:m.name_cn,endpoint:'/openapi/v2/'+m.endpoint.slice(5),catalogEndpoint:m.endpoint,
    ratios:ratios.length?ratios:['auto'],resolutions:sizes.length?sizes:['auto'],qualities:options('quality'),
    backgrounds:options('background'),outputFormats:options('outputFormat'),maxImages:m.params.find(p=>p.type==='IMAGE')?.maxCount||10,
    maxPromptLength:m.params.find(p=>p.key==='prompt')?.maxLength,source:m.source!,
    note:`国际站 · ${m.channel} · 接口已接入，尚未逐个付费实测。${m.channel==='经济版'?'稳定性与实际分辨率可能波动。':''}`};
});
export function compositionCatalogPayload(model:ImageModel,input:{prompt:string;imageUrls:string[];aspectRatio:string;resolution:string;quality?:string;background?:string;outputFormat?:string}){
  const m=internationalImageModels.find(x=>x.endpoint===model.catalogEndpoint);
  if(!m)throw new Error('未找到此模型的国际站参数。');
  const values=modelDefaults(m);values.prompt=input.prompt;
  for(const [key,value] of Object.entries({aspectRatio:input.aspectRatio,resolution:input.resolution,size:input.resolution,quality:input.quality,background:input.background,outputFormat:input.outputFormat})) {
    if(value&&m.params.some(p=>p.key===key)&&value!=='auto')values[key]=value;
    else if(value==='auto'&&m.params.some(p=>p.key===key&&p.options?.includes('auto')))values[key]=value;
  }
  return catalogPayload(m,values,input.imageUrls);
}
