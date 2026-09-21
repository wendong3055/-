'use client';
import {useEffect,useRef,useState} from 'react';
import type {ProductWorkspace,ProductionPlan,ProductionItem} from '../lib/production-plan';
import type {GenerationTask} from '../lib/generation-types';
import {generationLabels} from '../lib/generation-types';
import {detailCandidates,runDetailBatch} from '../lib/detail-batch';
import {referenceUpload} from '../lib/reference-upload';
import {downloadBlob,detailLongImage,exportDetailDraft} from '../lib/production-export';

type Reference={id:string;file:string;name:string};
type Color={id:string;name:string;color:string};
async function json<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,init);const b=await r.json() as T&{error?:string};if(!r.ok)throw new Error(b.error||'请求未完成，请先刷新核对任务。');return b;}
export function DetailBatch({data,plan,artworks,colors,onUpdate,onBusy}:{data:ProductWorkspace;plan:ProductionPlan;artworks:Reference[];colors:Color[];onUpdate:(data:ProductWorkspace)=>void;onBusy:(busy:boolean)=>void}){
  const [running,setRunning]=useState(false),[message,setMessage]=useState(''),[current,setCurrent]=useState('');
  const [model,setModel]=useState('gpt-image-2');
  const stop=useRef(false),lock=useRef(false),mounted=useRef(true);
  const [preview,setPreview]=useState(''),[exporting,setExporting]=useState(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;onBusy(false);};},[onBusy]);
  const details=plan.items.filter(i=>i.kind==='detail'),pending=detailCandidates(details),retry=detailCandidates(details,true);
  const completed=details.filter(i=>i.task?.status==='succeeded'&&i.review!=='rework').length;
  async function exportDraft(show=false){setExporting(true);try{if(show)setPreview(URL.createObjectURL(await detailLongImage(data,plan)));else await exportDetailDraft(data,plan);setMessage('这是待验收样稿，不会自动标记为通过。');}catch(e){setMessage(String(e));}finally{setExporting(false);}}
  async function refresh(){const next=await json<ProductWorkspace>(`/api/products/${encodeURIComponent(data.product.id)}/workspace`,{cache:'no-store'});if(mounted.current)onUpdate(next);return next;}
  async function start(retryOnly=false){
    if(lock.current)return;lock.current=true;stop.current=false;setMessage('正在核对清单…');setRunning(true);onBusy(true);
    try{
      const next=await refresh(),fresh=next.plans.find(p=>p.id===plan.id);
      if(!fresh)throw new Error('制作版本已变化，请刷新后再试。');
      const items=detailCandidates(fresh.items,retryOnly);
      if(!items.length)throw new Error('没有需要提交的详情页。已完成图片不会重复生成。');
      const tasks=await json<GenerationTask[]>('/api/generations',{cache:'no-store'});
      if(tasks.some(t=>!['succeeded','failed'].includes(t.status)))throw new Error('还有运行中或待核对的任务，请先在生成任务中处理，再继续整套制作。');
      const recipe=next.sample?.recipe,art=artworks.find(a=>a.id===recipe?.artworkId),color=colors.find(c=>c.id===recipe?.colorId);
      if(!recipe||!art||!color)throw new Error('原画芯或颜色资料尚未加载，请刷新后重试；不会使用替代素材。');
      if(stop.current||!mounted.current)return;
      if(!window.confirm(`${retryOnly?'仅重试失败或已标记重做的':'开始制作'} ${items.length} 张详情页：${items.map(i=>i.title).join('、')}。\n使用 ${model==='gpt-image-2'?'GPT Image 2':'GPT Image 2.5 Sunburst'}，2K，标准质量；切片3:4、长图1:3。参考图与制作要求发送到 RunningHub，按实际规则计费，总费用暂无法预估。\n确认一次后自动逐页完成，不包含主图和尺寸图。失败或状态不明会暂停，不会自动重试。保持页面打开；离开或刷新会停止后续提交。`)){setMessage('已取消，未提交生成。');return;}
      const file=async(url:string,name:string)=>{const r=await fetch(url);if(!r.ok)throw new Error('参考图读取失败，未继续提交。');return referenceUpload(await r.blob(),name);};
      const [artFile,sampleFile]=await Promise.all([file(art.file,art.name),file(`/api/files/${next.product.sampleAssetId}`,'确认样图')]);
      await runDetailBatch(items,{
        stopped:()=>stop.current||!mounted.current,
        submit:async(item:ProductionItem)=>{
          const ctx=await json<{planId:string;productId:string;generationId:string|null;kind:string;brief:string}>(`/api/production/${item.id}`,{cache:'no-store'});
          if(ctx.planId!==fresh.id||ctx.productId!==next.product.id||ctx.kind!=='detail'||ctx.generationId!==item.generationId)throw new Error('清单状态已改变，已暂停；请刷新核对。');
          if(stop.current||!mounted.current)throw new Error('已暂停后续提交。');
          const form=new FormData();
          form.set('artwork',artFile);form.set('frame',sampleFile);
          const fields={requestId:crypto.randomUUID(),productionItemId:item.id,artworkId:recipe.artworkId,frameId:recipe.frameId,colorId:recipe.colorId,artworkName:art.name,frameName:next.product.frameName,colorName:color.name,colorHex:color.color,model,aspectRatio:item.title==='完整详情长图'?'1:3':'3:4',resolution:'2k',quality:'medium',intent:'catalog',instruction:`本次只制作“${item.title}”这一页，不要把其他模块拼在此页。沿用清单统一风格。`};
          Object.entries(fields).forEach(([k,v])=>form.set(k,v));
          return json<GenerationTask>('/api/generate-preview',{method:'POST',body:form});
        },
        poll:id=>json<GenerationTask>(`/api/generations/${id}`,{cache:'no-store'}),
        wait:()=>new Promise(resolve=>setTimeout(resolve,12000)),
        progress:async(item,task)=>{if(mounted.current){setCurrent(`${item.title} · ${generationLabels[task.status]}`);setMessage('');if(['succeeded','failed','unknown'].includes(task.status))await refresh();} },
      });
      setMessage(stop.current?'已暂停后续提交；已经提交的任务继续运行，可刷新查看。':'本轮详情页已生成，请在下方集中检查。');
    }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'制作暂停，请先核对任务记录，不要重复提交。');}
    finally{try{await refresh();}catch{}lock.current=false;if(mounted.current){setRunning(false);onBusy(false);setCurrent('');}}
  }
  if(!details.length)return null;
  return <section className="detail-batch" aria-label="整套详情制作"><h3>整套详情 · 一次确认，自动逐页制作</h3><p>已生成 {completed}/{details.length} 页 · 待首次制作 {pending.length} 页 · 待重做 {retry.length} 页</p><progress aria-label="详情生成进度" value={completed} max={details.length}/><label>生图模型<select disabled={running} value={model} onChange={e=>setModel(e.target.value)}><option value="gpt-image-2">GPT Image 2</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></select></label><p>2K · 标准质量 · 每页自动使用对应文案。已完成页面不重复生成，不连带制作主图和尺寸图。</p><div className="product-actions"><button disabled={running||!pending.length} onClick={()=>void start()}>一键生成剩余详情（{pending.length} 张）</button>{retry.length>0&&<button disabled={running} onClick={()=>void start(true)}>仅重做失败 / 已标记页（{retry.length} 张）</button>}{running&&<button onClick={()=>{stop.current=true;setMessage('已要求暂停，已提交任务不会取消。');}}>暂停后续提交</button>}<button disabled={running||exporting||completed!==details.length} onClick={()=>void exportDraft(true)}>整套长图预览</button><button disabled={running||exporting||completed!==details.length} onClick={()=>void exportDraft()}>下载详情样稿（切片＋长图）</button></div><p role="status">{message||current}</p><small>保持页面打开。刷新后不会自动提交；运行中或状态不明的任务需先核对，不会重复扣费重试。</small>{preview&&<dialog open className="publication-preview" aria-label="整套详情样稿预览"><button onClick={()=>setPreview('')}>关闭预览</button><h3>整套详情 · 待验收样稿</h3><button onClick={()=>void fetch(preview).then(r=>r.blob()).then(b=>downloadBlob(b,'详情长图_待验收.png'))}>下载长图</button><img src={preview} alt="整套详情长图"/></dialog>}</section>;
}
