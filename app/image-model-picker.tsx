'use client';
import {useState} from 'react';
import {imageModels} from '../lib/generation-models';
export function ImageModelPicker({value,onChange,scene=false}:{value:string;onChange:(id:string)=>void;scene?:boolean}){
 const [search,setSearch]=useState('');
 const candidates=imageModels;
 const groups=[['已有出图记录',(id:string)=>['gpt-image-2','gpt-image-2.5-sunburst'].includes(id)],['国际站 · 图案与框架合成',(id:string)=>!['gpt-image-2','gpt-image-2.5-sunburst'].includes(id)]] as const;
 return <div className="image-model-picker"><label>查找图片模型<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="例如 GPT、Nano、千问、Seedream"/></label><label>RunningHub 模型 / 应用<select value={value} onChange={e=>onChange(e.target.value)}>{groups.map(([label,matches])=><optgroup key={label} label={label}>{candidates.filter(m=>matches(m.id)&&(m.id===value||m.name.toLowerCase().includes(search.toLowerCase()))).map(m=><option key={m.id} value={m.id} disabled={scene&&(!m.resolutions.includes('2k')||!m.ratios.includes('1:1'))}>{m.name}{scene&&(!m.resolutions.includes('2k')||!m.ratios.includes('1:1'))?'（不适用本套 2K 场景）':''}</option>)}</optgroup>)}</select></label><small>这里只列支持产品参考图的接口；文生图、放大等其余接口不参与新品出图，已不再单独展示。</small></div>;
}
