'use client';
import {useRef,useState} from 'react';
import {prepareStudioReferences,type OriginalReference} from '../lib/studio-reference';
export function ReferenceCheck({art,frameUrl,disabled}:{art?:OriginalReference;frameUrl?:string;disabled:boolean}){
 const lock=useRef(false);const [busy,setBusy]=useState(false);const [result,setResult]=useState<{key:string;text:string}|null>(null);
 const key=JSON.stringify([art?.originalFile,frameUrl]);
 async function check(){if(lock.current||disabled)return;lock.current=true;setBusy(true);setResult(null);try{if(!art)throw new Error('请先选择图案。');await prepareStudioReferences(art,frameUrl);setResult({key,text:'检查通过：图案原图与框架均可读取，可继续生成。'});}catch(e){setResult({key,text:e instanceof Error?e.message:'检查失败，请重试。'});}finally{lock.current=false;setBusy(false);}}
 return <div><button type="button" disabled={busy||disabled} onClick={check}>{busy?'正在检查…':'检查参考图（不生图）'}</button>{result?.key===key&&<p role="status">{result.text}</p>}</div>;
}
