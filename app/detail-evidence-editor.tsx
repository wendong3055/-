'use client';
import {useState} from 'react';
import {detailReferenceLabels,detailMissing,type DetailReferenceKey,type DetailEvidence} from '../lib/detail-template';
export function DetailEvidenceEditor({value={},titles,onChange,onBusy}:{value?:DetailEvidence;titles:string[];onChange:(value:DetailEvidence)=>void;onBusy:(busy:boolean)=>void}){
  const [uploading,setUploading]=useState(''),[error,setError]=useState('');
  async function upload(key:DetailReferenceKey,file?:File){
    if(!file||uploading)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('请选择10MB以内的 JPG、PNG 或 WebP 图片。');return;}
    setUploading(key);onBusy(true);setError('');
    try{const form=new FormData();form.set('file',file);form.set('category','详情参考');form.set('name',detailReferenceLabels[key]);
      const r=await fetch('/api/library',{method:'POST',body:form}),b=await r.json() as {id?:string;error?:string};
      if(!r.ok||!b.id)throw new Error(b.error||'参考图上传失败。');onChange({...value,refs:{...value.refs,[key]:b.id}});
    }catch(e){setError(e instanceof Error?e.message:'上传失败，请重试。');}finally{setUploading('');onBusy(false);}
  }
  const missing=titles.map(title=>({title,missing:detailMissing(title,value)})).filter(x=>x.missing.length);
  return <section className="detail-evidence" aria-label="详情真实资料"><h4>详情资料 · 只上传同款产品</h4><p>这些参考仅用于本套详情，不收入图案库。缺资料的页面会暂停，其他页面可以先做。</p>
    <label>已确认的材质说明<textarea disabled={!!uploading} maxLength={1500} value={value.material||''} onChange={e=>onChange({...value,material:e.target.value})} placeholder="分别说明画芯、木纹装饰面、框架或柜体的实际材料。木纹饰面不等于实木。"/></label>
    <label>半透／不透说明<textarea disabled={!!uploading} maxLength={1500} value={value.transparency||''} onChange={e=>onChange({...value,transparency:e.target.value})} placeholder="填写实际可选画芯及透光、透景表现；不要仅凭参考模板作性能保证。"/></label>
    <div className="detail-reference-grid">{(Object.keys(detailReferenceLabels) as DetailReferenceKey[]).map(key=><div key={key}><label>{detailReferenceLabels[key]}<input disabled={!!uploading} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(key,e.target.files?.[0]);e.currentTarget.value='';}}/></label>{value.refs?.[key]&&<><a href={`/api/files/${value.refs[key]}`} target="_blank" rel="noreferrer"><img src={`/api/files/${value.refs[key]}`} alt={detailReferenceLabels[key]}/></a><button type="button" disabled={!!uploading} onClick={()=>{const refs={...value.refs};delete refs[key];onChange({...value,refs});}}>取消引用</button></>}</div>)}</div>
    <p>正面沿用已确认样图。六色：原木、红木色、黄花梨色、胡桃木色、简约灰、暖白色；未上传色样时标明“配色示意”。</p>
    <details><summary>半透／不透版式参考</summary><img className="detail-template-example" src="/templates/transparency-comparison.jpg" alt="左右并列的半透和不透对照版式参考，不作为当前产品材质证明"/><p>参考左右对照与大字标签，不套用示例山川图案或未经确认的性能文案。</p></details>
    {missing.length>0&&<ul>{missing.map(x=><li key={x.title}>{x.title}：待补充{x.missing.join('、')}</li>)}</ul>}
    <p role="status">{uploading?'正在上传参考图…':error}</p>
  </section>;
}
