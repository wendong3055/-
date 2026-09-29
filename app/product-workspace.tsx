'use client';
import {useEffect,useState} from 'react';
import {mainOptions,type ProductWorkspace,type ProductionItem} from '../lib/production-plan';
import {productionPageNames,oneClickDraft,usablePlan,pageItems,type ProductionPage} from '../lib/production-workflow';
import {generationLabels} from '../lib/generation-types';
import {downloadBlob,exportProduction,publicationImage} from '../lib/production-export';
import {sharedScene,preservesSourceSizeMarks,type SizeMarks} from '../lib/production-scene';
import {SizeMarksEditor} from './size-marks-editor';
import {ProductionBatch} from './production-batch';
import type {OriginalReference} from '../lib/studio-reference';
async function responseData<T>(r:Response):Promise<T>{const b=await r.json() as T&{error?:string};if(!r.ok)throw new Error(b.error||'请求未完成，请重试。');return b;}
function currentPage():ProductionPage {if(typeof window==='undefined')return 'detail';const p=new URLSearchParams(window.location.search).get('studio');return p==='main'||p==='size'?p:'detail';}
export function ProductWorkspaceView({productId='',delivery=false,onNew,onOpen,artworks=[],colors=[]}:{productId?:string;delivery?:boolean;onNew:()=>void;onOpen:(id:string)=>void;artworks?:(OriginalReference&{id:string})[];colors?:{id:string;name:string;color:string}[]}){
  const [products,setProducts]=useState<{id:string;name:string;sampleAssetId:string;frameName:string}[]>([]);
  const [data,setData]=useState<ProductWorkspace|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [version,setVersion]=useState(''),[page,setPage]=useState<ProductionPage>('detail'),[newSet,setNewSet]=useState(false);
  const [preview,setPreview]=useState<{url:string;title:string}|null>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
  useEffect(()=>{setPage(currentPage());const back=()=>{setPage(currentPage());setNewSet(false);};window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
  async function read(){return responseData<ProductWorkspace>(await fetch(`/api/products/${encodeURIComponent(productId)}/workspace`,{cache:'no-store'}));}
  async function reload(){setLoading(true);setError('');try{if(productId){setData(await read());}else{setProducts(await responseData<typeof products>(await fetch('/api/products',{cache:'no-store'})));setData(null);}}catch(e){setError(e instanceof Error?e.message:'读取失败。');}finally{setLoading(false);}}
  useEffect(()=>{setData(null);setVersion('');setNewSet(false);void reload();},[productId]);
  const selected=data?.plans.find(p=>p.id===version);
  const plan=!newSet?(selected||data?.plans.find(p=>usablePlan(p,page))):undefined;
  const workingPlan=usablePlan(plan,page)?plan:undefined;
  function navigate(next:ProductionPage){if(busy)return;const url=new URL(window.location.href);url.searchParams.set('product',productId);url.searchParams.set('studio',next);window.history.pushState(null,'',url);setPage(next);setVersion('');setNewSet(false);setError('');}
  async function prepare(){
    const fresh=await read();let active=!newSet?fresh.plans.find(p=>p.id===workingPlan?.id):undefined;
    if(!active){const input=oneClickDraft(fresh,page,selected||fresh.plans[0]);const next=await responseData<ProductWorkspace>(await fetch(`/api/products/${encodeURIComponent(productId)}/workspace`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));active=next.plans[0];setData(next);setVersion(active.id);setNewSet(false);return{data:next,plan:active};}
    setData(fresh);return{data:fresh,plan:active};
  }
  async function show(item:ProductionItem){if(!data||!plan)return;setBusy(true);try{setPreview({url:URL.createObjectURL(await publicationImage(item,data,plan)),title:item.title});}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function review(item:ProductionItem,value:'accepted'|'rework',note:string){setBusy(true);setError('');try{await responseData(await fetch(`/api/production/${item.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({generationId:item.generationId,review:value,note})}));setData(await read());}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function exportZip(){if(!data||!plan)return;setBusy(true);setError('');try{await exportProduction(data,plan,setError);setError('交付包已整理，请查看下载。');}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function marks(item:ProductionItem,value:SizeMarks){setBusy(true);try{await responseData(await fetch(`/api/production/${item.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'save-marks',generationId:item.generationId,marks:value})}));setData(await read());}catch(e){setError(String(e));}finally{setBusy(false);}}
  const visible=plan?pageItems(plan,page).filter(i=>i.task||i.generationId):[];
  return <section className="product-workspace" aria-label={delivery?'新品交付中心':'新品制作'}>
    <header className="product-head"><div><h2>{data?.product.name||(delivery?'新品交付中心':'我的新品')}</h2></div><div className="product-actions">{productId&&<button disabled={busy} onClick={()=>onOpen('')}>全部新品</button>}<button disabled={busy} onClick={()=>void reload()}>刷新结果</button><button disabled={busy} onClick={onNew}>返回工作台</button></div></header>
    {error&&<p role="status" className="product-message">{error}</p>}{loading&&<p>正在读取新品…</p>}
    {!loading&&!productId&&<div className="product-grid">{products.map(p=><button className="product-card" key={p.id} onClick={()=>onOpen(p.id)}><img src={`/api/files/${p.sampleAssetId}`} alt={p.name}/><strong>{p.name}</strong><span>{p.frameName}</span><b>{delivery?'查看交付':'进入制作'}</b></button>)}{!products.length&&<div className="product-empty"><h3>先确认一张新品样图</h3><button onClick={onNew}>去搭配新品</button></div>}</div>}
    {data&&!loading&&<>
      <div className="production-product"><img src={`/api/files/${data.product.sampleAssetId}`} alt="已确认产品"/><div><strong>{data.product.frameName}</strong><p>{data.product.artworkName}</p><span>沿用已确认的搭配</span></div></div>
      <nav className="production-pages" aria-label="制作页面">{(['main','size','detail'] as const).map(p=><a key={p} href={`/?product=${encodeURIComponent(productId)}&studio=${p}`} aria-current={page===p?'page':undefined} aria-disabled={busy} onClick={e=>{e.preventDefault();navigate(p);}}>{productionPageNames[p]}</a>)}</nav>
      {!data.sample?.recipe?<p role="alert">此旧新品缺少搭配记录，请回工作台重新确认样图。原图和历史仍保留。</p>:<>
        {!delivery&&<ProductionBatch key={`${productId}:${page}`} data={data} plan={workingPlan} page={page} count={page==='detail'?12:page==='main'?mainOptions.length:data.sizes.length} artworks={artworks} colors={colors} onPrepare={prepare} onUpdate={setData} onBusy={setBusy}/>}
        {page==='size'&&<p className="production-short-note">已识别 {data.sizes.length} 个规格，自动按对应框架原图制作并保留尺寸标注。{(data.unknown>0||data.missing>0)?`另有 ${data.unknown+data.missing} 份原图需在框架库核对，不影响已识别规格。`:''}</p>}
        {page==='main'&&!workingPlan&&<div className="main-module-list">{mainOptions.map(title=><span key={title}>{title}</span>)}</div>}
        <div className="production-history-bar">{data.plans.length>0&&<details><summary>历史版本</summary><select aria-label="查看历史制作版本" disabled={busy} value={plan?.id||''} onChange={e=>{setVersion(e.target.value);setNewSet(false);}}><option value="">当前页面最新版本</option>{data.plans.map(p=><option key={p.id} value={p.id}>第 {p.version} 套 · {p.config.name}</option>)}</select></details>}{!delivery&&workingPlan&&<button disabled={busy} onClick={()=>{setNewSet(true);setVersion('');}}>按现有{page==='size'?'规格':'搭配'}开始新一套</button>}{plan&&<button disabled={busy||!plan.items.some(i=>i.review==='accepted')} onClick={()=>void exportZip()}>下载已验收交付包</button>}</div>
        {visible.length>0&&<div className="production-list">{visible.map(item=><ProductionCard key={`${item.id}:${item.generationId}`} item={item} busy={busy} sceneReady={!!plan&&!!sharedScene(plan)} onMarks={v=>void marks(item,v)} onPreview={()=>void show(item)} onReview={(v,n)=>void review(item,v,n)} onDownload={()=>{if(!plan)return;setBusy(true);void publicationImage(item,data,plan).then(b=>downloadBlob(b,`${item.title}.${b.type==='image/png'?'png':b.type==='image/webp'?'webp':'jpg'}`)).catch(e=>setError(String(e))).finally(()=>setBusy(false));}}/>)}</div>}
        {!visible.length&&<div className="production-empty-result"><h3>制作完成后，图片会显示在这里</h3><p>满意后下载；需要修改时，直接在图片下调整。</p></div>}
      </>}
    </>}
    {preview&&<dialog open className="publication-preview" aria-label="成品预览"><button onClick={()=>setPreview(null)}>关闭预览</button><h3>{preview.title}</h3><img src={preview.url} alt={preview.title}/></dialog>}
  </section>;
}
function ProductionCard({item,busy,onPreview,onReview,onDownload,sceneReady,onMarks}:{item:ProductionItem;busy:boolean;onPreview:()=>void;onReview:(v:'accepted'|'rework',n:string)=>void;onDownload:()=>void;sceneReady:boolean;onMarks:(marks:SizeMarks)=>void}){
  const [note,setNote]=useState(item.note);
  const ready=!item.task||item.task.status==='failed'||item.review==='rework';
  return <article className="production-card"><div>{item.task?.url?<img src={item.task.url} alt={item.title}/>:<span>{item.task?generationLabels[item.task.status]:'待制作'}</span>}</div><section><h3>{item.title}</h3><p>{item.review==='accepted'?'已验收':item.review==='rework'?'待调整':item.task?.status==='succeeded'?'已生成':item.task?generationLabels[item.task.status]:'待制作'}</p>{item.task?.error&&<p role="status">{item.task.error}</p>}
    {ready&&(item.kind!=='size'||sceneReady)&&<a className="production-start" aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}} href={`/?production=${item.id}`}>{item.task?'调整后重做此图':'单独制作此图'}</a>}
    {item.task?.url&&<><div className="product-actions"><button disabled={busy} onClick={onPreview}>查看大图</button><button disabled={busy} onClick={onDownload}>下载</button><button disabled={busy||item.review==='accepted'} onClick={()=>onReview('accepted',note)}>确认这张图</button></div><details className="result-adjustment"><summary>调整这张图</summary><label>修改要求<textarea value={note} maxLength={600} onChange={e=>setNote(e.target.value)} placeholder="告诉我这张图要改哪里…"/></label><button disabled={busy||!note.trim()} onClick={()=>onReview('rework',note)}>保存修改要求</button></details>{item.kind==='size'&&!preservesSourceSizeMarks(item)&&<details><summary>调整旧图尺寸标注</summary><SizeMarksEditor item={item} busy={busy} onSave={onMarks}/></details>}</>}
  </section></article>;
}
