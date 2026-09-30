'use client';
import {useEffect,useRef,useState} from 'react';
import type {ProductWorkspace,ProductionItem} from '../lib/production-plan';
import type {OriginalReference} from '../lib/studio-reference';
import {generationLabels} from '../lib/generation-types';
import {submitProductionItem,watchProductionItem} from '../lib/production-item-action';

export function ProductionItemActions({data,item,artworks,colors,disabled,onBusy,onRefresh}:{data:ProductWorkspace;item:ProductionItem;artworks:(OriginalReference&{id:string})[];colors:{id:string;name:string;color:string}[];disabled:boolean;onBusy:(busy:boolean)=>void;onRefresh:()=>Promise<void>}){
  const [note,setNote]=useState(''),[message,setMessage]=useState(''),[running,setRunning]=useState(false);
  const lock=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function start(adjust:boolean){
    if(lock.current||disabled)return;lock.current=true;setRunning(true);onBusy(true);setMessage('正在检查参考图…');
    try{
      const task=await submitProductionItem({data,item,artworks,colors,note,adjust,stopped:()=>!mounted.current},m=>window.confirm(m));
      if(!task){setMessage('已取消，未提交生图。');return;}
      await watchProductionItem(task,{stopped:()=>!mounted.current,wait:()=>new Promise(r=>setTimeout(r,12000)),progress:async t=>{if(mounted.current){setMessage(`${generationLabels[t.status]} · 本轮完成前保留上一轮图片`);if(['succeeded','failed','unknown'].includes(t.status))await onRefresh();}}});
      if(mounted.current){setMessage('这张图已更新，原图保留在生成记录中。');setNote('');}
    }catch(e){if(mounted.current)setMessage(e instanceof Error?e.message:'操作未完成，请刷新核对记录，不要重复提交。');}
    finally{if(mounted.current){try{await onRefresh();}catch{}setRunning(false);onBusy(false);}lock.current=false;}
  }
  const blocked=disabled||running||!!item.task&&!['succeeded','failed'].includes(item.task.status);
  return <div className="production-item-actions">
    <details className="result-adjustment"><summary>调整这张图</summary><label>修改要求<textarea value={note} maxLength={600} disabled={blocked} onChange={e=>setNote(e.target.value)} placeholder="告诉我这张图要改哪里…"/></label><button disabled={blocked||!note.trim()} onClick={()=>void start(true)}>{running?'正在处理…':'按要求调整这张图'}</button></details>
    <button disabled={blocked} onClick={()=>void start(false)}>{running?'正在处理…':item.task?'重做这张图':'生成这张图'}</button>
    <small>仅处理这一张，沿用本页规则和原出图参数；原图保留。</small>
    {message&&<p role="status">{message}</p>}
  </div>;
}
