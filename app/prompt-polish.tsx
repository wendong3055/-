'use client';
import {useRef,useState} from 'react';

export function PromptPolish({text,context,disabled,onApply}:{text:string;context:string;disabled:boolean;onApply:(text:string)=>void}) {
  const busyRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [suggestion,setSuggestion]=useState<{text:string;original:string;context:string}|null>(null);
  async function polish(){
    if(busyRef.current||disabled||!text.trim())return;
    busyRef.current=true;setBusy(true);setError('');setSuggestion(null);
    const original=text, originalContext=context;
    try {
      const response=await fetch('/api/prompt-polish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:original,context:originalContext})});
      const result=await response.json() as {text?:string;error?:string};
      if(!response.ok||typeof result.text!=='string')throw new Error(result.error||'润色失败，原文已保留。');
      setSuggestion({text:result.text,original,context:originalContext});
    }catch(e){setError(e instanceof Error?e.message:'连接中断，请先核对 RunningHub LLM 记录再重试。');}
    finally{busyRef.current=false;setBusy(false);}
  }
  const stale=suggestion&&(suggestion.original!==text||suggestion.context!==context);
  return <div onKeyDown={e=>e.stopPropagation()}>
    <button type="button" disabled={disabled||busy||!text.trim()} onClick={polish}>{busy?'正在润色…':'AI 润色'}</button>
    <small> RunningHub 文字模型 · 点击才调用，可能产生文字费用，不会生图</small>
    {error&&<p role="alert">{error}</p>}
    {suggestion&&<div className="polish-suggestion" aria-live="polite" style={{padding:12,border:'1px solid #c9d8ce',borderRadius:8,marginTop:8}}>
      <strong>润色建议</strong><p style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{suggestion.text}</p>
      {stale&&<p>要求或搭配已修改，请重新润色。</p>}
      <button type="button" disabled={disabled||!!stale} onClick={()=>{onApply(suggestion.text);setSuggestion(null);}}>采用润色</button>
      <button type="button" onClick={()=>setSuggestion(null)}>保留原文</button>
    </div>}
  </div>;
}
