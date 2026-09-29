'use client';
import {useEffect,useRef,useState} from 'react';
import type {ProductWorkspace,ProductionPlan,ProductionItem} from '../lib/production-plan';
import type {GenerationTask} from '../lib/generation-types';
import {generationLabels} from '../lib/generation-types';
import {runDetailBatch} from '../lib/detail-batch';
import {batchCandidates,batchQueue,pageItems,type ProductionPage} from '../lib/production-workflow';
import {artworkOriginal,readReference,type OriginalReference} from '../lib/studio-reference';
import {downloadBlob,detailLongImage,exportDetailDraft} from '../lib/production-export';
async function json<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,init);const b=await r.json() as T&{error?:string};if(!r.ok)throw new Error(b.error||'请求未完成，请刷新核对任务。');return b;}
export function ProductionBatch({data,plan,page,count,artworks,colors,onPrepare,onUpdate,onBusy}:{data:ProductWorkspace;plan?:ProductionPlan;page:ProductionPage;count:number;artworks:(OriginalReference&{id:string})[];colors:{id:string;name:string;color:string}[];onPrepare:()=>Promise<{data:ProductWorkspace;plan:ProductionPlan}>;onUpdate:(data:ProductWorkspace)=>void;onBusy:(busy:boolean)=>void}){
  const [running,setRunning]=useState(false),[message,setMessage]=useState(''),[current,setCurrent]=useState('');
  const [model,setModel]=useState('gpt-image-2'),[quality,setQuality]=useState('medium');
  const stop=useRef(false),lock=useRef(false),mounted=useRef(true);
  const [preview,setPreview]=useState(''),[exporting,setExporting]=useState(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;onBusy(false);};},[onBusy]);
  const items=plan?pageItems(plan,page):[],pending=plan?batchCandidates(items):[],retry=batchCandidates(items,true);
  const completed=items.filter(i=>i.task?.status==='succeeded'&&i.review!=='rework').length;
  const total=plan?items.length:count,remaining=plan?pending.length:count;
  async function refresh(){const next=await json<ProductWorkspace>(`/api/products/${encodeURIComponent(data.product.id)}/workspace`,{cache:'no-store'});if(mounted.current)onUpdate(next);return next;}
  async function exportDraft(show=false){if(!plan)return;setExporting(true);try{if(show)setPreview(URL.createObjectURL(await detailLongImage(data,plan)));else await exportDetailDraft(data,plan);}catch(e){setMessage(String(e));}finally{setExporting(false);}}
  async function start(retryOnly=false){
    if(lock.current)return;lock.current=true;stop.current=false;setRunning(true);onBusy(true);setMessage('正在准备本套制作…');
    try{
      const {data:next,plan:fresh}=await onPrepare();
      const queue=batchQueue(fresh,page,retryOnly);
      if(!queue.length)throw new Error('本轮没有待制作图片，已完成结果不会重复生成。');
      const tasks=await json<GenerationTask[]>('/api/generations',{cache:'no-store'});
      if(tasks.some(t=>!['succeeded','failed'].includes(t.status)))throw new Error('还有运行中或状态待核对的任务，请先查看生成任务。不会重复提交。');
      const recipe=next.sample?.recipe,art=artworks.find(a=>a.id===recipe?.artworkId),color=colors.find(c=>c.id===recipe?.colorId);
      if(!recipe||!art||!color)throw new Error('原画芯或颜色资料尚未加载，请刷新重试，不会替换素材。');
      const [artFile,sampleFile]=await Promise.all([readReference(artworkOriginal(art),art.name),readReference(`/api/files/${next.product.sampleAssetId}`,'确认样图')]);
      const frames=new Map<string,File>();
      // Validate every size reference before the first billable request.
      for(const item of queue.filter(i=>i.kind==='size')){const id=item.spec?.sourceIds[0];if(!id)throw new Error(`${item.title}缺少尺寸框架原图，已停止。`);frames.set(item.id,await readReference(`/api/files/${id}`,item.title));}
      if(stop.current||!mounted.current)return;
      const backgroundCount=queue.filter(i=>page==='size'&&i.kind==='main').length;
      if(!window.confirm(`本次制作 ${queue.length} 张${backgroundCount?'（含 1 张统一背景）':''}，使用 ${model==='gpt-image-2'?'GPT Image 2':'GPT Image 2.5 Sunburst'}、2K。\n参考图发送至 RunningHub，按实际规则计费，当前无法预估总费用。确认本套后自动逐张制作，不再逐张询问。\n失败或状态不明将暂停，不自动重试。请保持页面打开。`)){setMessage('已取消，未提交生图。');return;}
      await runDetailBatch(queue,{
        stopped:()=>stop.current||!mounted.current,
        submit:async(item:ProductionItem)=>{
          const ctx=await json<{planId:string;productId:string;generationId:string|null;kind:string}>(`/api/production/${item.id}`,{cache:'no-store'});
          if(ctx.planId!==fresh.id||ctx.productId!==next.product.id||ctx.kind!==item.kind||ctx.generationId!==item.generationId)throw new Error('制作状态已改变，请刷新核对，已停止后续提交。');
          if(stop.current||!mounted.current)throw new Error('已暂停。');
          const form=new FormData();form.set('artwork',artFile);form.set('frame',item.kind==='size'?frames.get(item.id)!:sampleFile);
          const fields={requestId:crypto.randomUUID(),productionItemId:item.id,artworkId:recipe.artworkId,frameId:recipe.frameId,colorId:recipe.colorId,artworkName:art.name,frameName:next.product.frameName,colorName:color.name,colorHex:color.color,model,aspectRatio:item.kind==='detail'?'3:4':'1:1',resolution:'2k',quality,intent:'catalog',instruction:`只制作“${item.title}”，使用本套默认要求，沿用确认产品和统一风格。`};
          Object.entries(fields).forEach(([k,v])=>form.set(k,v));return json<GenerationTask>('/api/generate-preview',{method:'POST',body:form});
        },
        poll:id=>json<GenerationTask>(`/api/generations/${id}`,{cache:'no-store'}),wait:()=>new Promise(resolve=>setTimeout(resolve,12000)),
        progress:async(item,task)=>{if(mounted.current){setCurrent(`${item.title} · ${generationLabels[task.status]}`);setMessage('');if(['succeeded','failed','unknown'].includes(task.status))await refresh();}},
      });
      setMessage(stop.current?'已暂停后续制作，已提交任务仍会运行。':'本套已生成，请查看结果；需要修改时在对应图片下调整。');
    }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'制作已暂停，请核对任务记录。');}
    finally{try{await refresh();}catch{}lock.current=false;if(mounted.current){setRunning(false);onBusy(false);setCurrent('');}}
  }
  return <section className="production-batch" aria-label="一键制作">
    <div className="batch-heading"><div><h3>{page==='detail'?'整套详情页':page==='size'?'全部规格尺寸图':'整套主图'}</h3><p>{plan?`已生成 ${completed} / ${total} 张`:`${total} ${page==='detail'?'页':'张'} · ${page==='size'?'自动沿用框架尺寸原图':'已为你准备好'}`}</p></div><button className="batch-primary" disabled={running||!remaining} onClick={()=>void start()}>{running?'制作中…':completed?'继续生成剩余图片':`一键生成${page==='detail'?'详情页':page==='size'?'尺寸图':'主图'}`}</button></div>
    {total>0&&<progress aria-label="制作进度" value={completed} max={total}/>}
    <details className="batch-settings"><summary>出图设置 <span>{model==='gpt-image-2'?'GPT Image 2':'GPT Image 2.5'} · 2K · {page==='detail'?'3:4':'1:1'} · {quality==='low'?'快速':quality==='high'?'精细':'标准'}</span></summary><label>生图模型<select disabled={running} value={model} onChange={e=>setModel(e.target.value)}><option value="gpt-image-2">GPT Image 2</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></select></label><label>画质<select disabled={running} value={quality} onChange={e=>setQuality(e.target.value)}><option value="low">快速</option><option value="medium">标准</option><option value="high">精细</option></select></label><p>整套统一：详情 3:4，主图和尺寸图 1:1，清晰度 2K。</p></details>
    <div className="product-actions">{retry.length>0&&<button disabled={running} onClick={()=>void start(true)}>重做失败或已标记图片（{retry.length}）</button>}{running&&<button onClick={()=>{stop.current=true;setMessage('已要求暂停，当前图片完成后不再提交下一张。');}}>暂停后续制作</button>}{page==='detail'&&plan&&completed===total&&total>0&&<><button disabled={running||exporting} onClick={()=>void exportDraft(true)}>预览完整长图</button><button disabled={running||exporting} onClick={()=>void exportDraft()}>下载长图和切片</button></>}</div>
    {(message||current)&&<p role="status">{message||current}</p>}<small>本套确认一次后连续制作；请保持页面打开，刷新不会自动重复提交。</small>
    {preview&&<dialog open className="publication-preview" aria-label="详情长图预览"><button onClick={()=>setPreview('')}>关闭预览</button><button onClick={()=>void fetch(preview).then(r=>r.blob()).then(b=>downloadBlob(b,'详情长图_待验收.png'))}>下载长图</button><img src={preview} alt="整套详情长图"/></dialog>}
  </section>;
}
