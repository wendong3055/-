import type {ProductWorkspace,ProductionItem} from './production-plan';
import type {GenerationTask} from './generation-types';
import {artworkOriginal,readReference,type OriginalReference} from './studio-reference';
import {mainPropsBrief} from './main-props';

async function json<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,init);const b=await r.json() as T&{error?:string};if(!r.ok)throw new Error(b.error||'操作未完成，请刷新核对记录。');return b;}
// Explicit clicks only. Download/validate references before marking rework;
// never retry a billable submission, including after an ambiguous response.
export async function submitProductionItem(input:{data:ProductWorkspace;item:ProductionItem;artworks:(OriginalReference&{id:string})[];colors:{id:string;name:string;color:string}[];note:string;adjust:boolean;stopped?:()=>boolean},confirm:(message:string)=>boolean){
  const {data,item,artworks,colors,adjust}=input,note=input.note.trim();
  if(adjust&&!note)throw new Error('请填写要调整的内容。');
  const recipe=data.sample?.recipe,art=artworks.find(a=>a.id===recipe?.artworkId),color=colors.find(c=>c.id===recipe?.colorId);
  if(!recipe||!art||!color)throw new Error('原图或搭配资料尚未加载，请刷新重试。');
  const ctx=await json<{itemId:string;productId:string;generationId:string|null;kind:string;frameUrl:string}>(`/api/production/${item.id}`,{cache:'no-store'});
  if(ctx.itemId!==item.id||ctx.productId!==data.product.id||ctx.kind!==item.kind||ctx.generationId!==item.generationId)throw new Error('图片版本已变化，请刷新后再操作。');
  const tasks=await json<GenerationTask[]>('/api/generations',{cache:'no-store'});
  if(tasks.some(t=>!['succeeded','failed'].includes(t.status)))throw new Error('还有正在执行或待核对的任务，请先核对生成任务，不会重复提交。');
  const [artFile,frameFile]=await Promise.all([readReference(artworkOriginal(art),'图案原图'),readReference(ctx.frameUrl,'本项框架参考图')]);
  const task=item.task,model=task?.model||'gpt-image-2',ratio=task?.aspectRatio||(item.kind==='detail'?'3:4':'1:1'),resolution=task?.resolution||'2k';
  if(input.stopped?.())return null;
  if(!confirm(`${adjust?'调整':'重做'}“${item.title}”一张，沿用原模型与出图参数。\n参考图将发送至 RunningHub，可能产生生图费用。原图和历史记录保留，不重做其他图片。`))return null;
  const instruction=adjust?note:`按本页默认制作要求重新制作，只重做这一张，不沿用上一轮临时修改要求。${item.kind==='detail'?'':mainPropsBrief(item.kind,'auto','')}`;
  if(task?.status==='succeeded')await json(`/api/production/${item.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({generationId:item.generationId,review:'rework',note:instruction.slice(0,600)})});
  if(input.stopped?.())return null;
  const form=new FormData();form.set('artwork',artFile);form.set('frame',frameFile);
  const fields={requestId:crypto.randomUUID(),productionItemId:item.id,artworkId:recipe.artworkId,frameId:recipe.frameId,colorId:recipe.colorId,artworkName:art.name,frameName:data.product.frameName,colorName:color.name,colorHex:color.color,model,aspectRatio:ratio,resolution,quality:task?.recipe?.quality||'medium',intent:'catalog',instruction};
  Object.entries(fields).forEach(([k,v])=>form.set(k,v));
  if(task?.recipe?.background)form.set('background',task.recipe.background);
  if(task?.recipe?.outputFormat)form.set('outputFormat',task.recipe.outputFormat);
  return json<GenerationTask>('/api/generate-preview',{method:'POST',body:form});
}

export async function watchProductionItem(task:GenerationTask,io:{stopped:()=>boolean;progress:(task:GenerationTask)=>Promise<void>;wait:()=>Promise<void>;maxPolls?:number}){
  let current=task;await io.progress(current);
  for(let n=0;!['succeeded','failed','unknown'].includes(current.status);n++){
    if(io.stopped())return;
    if(n>=(io.maxPolls??100))throw new Error('查询已暂停，请刷新核对原任务，不要重复提交。');
    await io.wait();if(io.stopped())return;
    current=await json<GenerationTask>(`/api/generations/${current.id}`,{cache:'no-store'});await io.progress(current);
  }
  if(current.status!=='succeeded')throw new Error(current.error||'本张图片未完成，请核对任务后再重做。');
}
