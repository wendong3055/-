'use client';
import {useState} from 'react';
import type {ProductionItem} from '../lib/production-plan';
import type {AnnotationPoint,SizeMarks} from '../lib/production-scene';
const names=['宽度起点','宽度终点','高度起点','高度终点','进深起点','进深终点'];
export function SizeMarksEditor({item,busy,onSave}:{item:ProductionItem;busy:boolean;onSave:(marks:SizeMarks)=>void}){
  const count=item.spec?.depthCm?6:4;
  const [points,setPoints]=useState<AnnotationPoint[]>(item.spec?.marks?.generationId===item.generationId?item.spec.marks.points:[]);
  const [index,setIndex]=useState(0);
  return <details className="size-mark-editor"><summary>设置尺寸箭头位置</summary><p>依次点选起点和终点。宽度沿底部、高度沿侧边，进深沿可见侧面；数字自动取自本规格。保存后成品预览与下载相同，不调用生图。</p>
    <div className="product-actions">{names.slice(0,count).map((n,i)=><button key={n} aria-pressed={index===i} onClick={()=>setIndex(i)}>{points[i]?'✓ ':''}{n}</button>)}</div>
    <div style={{position:'relative',maxWidth:620,cursor:'crosshair'}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),next=[...points];next[index]={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};setPoints(next);setIndex(Math.min(count-1,index+1));}}>
      <img src={item.task!.url!} alt={`标注画布，当前选择${names[index]}`} style={{display:'block',width:'100%',height:'auto'}}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>{points.map((p,i)=>p&&<g key={i}>{i%2===1&&points[i-1]&&<line x1={points[i-1].x*100} y1={points[i-1].y*100} x2={p.x*100} y2={p.y*100} stroke="#b52228" strokeWidth=".3"/>}<circle cx={p.x*100} cy={p.y*100} r="1" fill="#b52228"/><text x={p.x*100+1.5} y={p.y*100} fontSize="3" fill="#b52228" stroke="#fff" strokeWidth=".15" paintOrder="stroke">{i+1}</text></g>)}</svg>
    </div>
    <button disabled={busy||Array.from({length:count},(_,i)=>!points[i]).some(Boolean)} onClick={()=>onSave({generationId:item.generationId!,points})}>保存标注并预览成品</button>
  </details>;
}
