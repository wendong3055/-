'use client';
import { useState } from 'react';
import { sceneReferences } from '../lib/scene-library';

export function SceneLibrary({ selectedId, disabled, onSelect }: { selectedId: string; disabled: boolean; onSelect: (id: string) => void }) {
  const [category, setCategory] = useState('全部场景');
  const [search, setSearch] = useState('');
  const categories = ['全部场景', ...new Set(sceneReferences.map(scene => scene.category))];
  const items = sceneReferences.filter(scene => (category === '全部场景' || scene.category === category) && `${scene.name} ${scene.description}`.includes(search.trim()));
  return <section className="scene-library" aria-label="场景图库">
    <header><div><h2>场景图库</h2><p>选一个室内环境，作为新品的背景参考。场景不进入画芯库，产品成图也不收入这里。</p></div><span>{sceneReferences.length} 个场景</span></header>
    <div className="scene-toolbar"><label>搜索场景<input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索客厅、楼梯、自然光…" /></label><div role="group" aria-label="场景分类">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <p className="scene-note">GitHub 开源室内渲染参考，并非空房实拍。图片已随工作台保存，不依赖临时外链；使用时注意下方作者及授权。</p>
    <div className="scene-grid">{items.map(scene => <article key={scene.id} className={selectedId === scene.id ? 'scene-card selected' : 'scene-card'}>
      <a href={scene.image} target="_blank" rel="noopener noreferrer" aria-label={`查看${scene.name}大图`}><img src={scene.image} alt={scene.name} width={scene.width} height={scene.height} loading="lazy" /></a>
      <div className="scene-card-body"><span>{scene.category}</span><h3>{scene.name}</h3><p>{scene.description}</p>
      <button type="button" disabled={disabled} aria-pressed={selectedId === scene.id} onClick={() => onSelect(scene.id)}>{selectedId === scene.id ? '已选中 · 返回使用' : '用作场景参考'}</button>
      <details><summary>来源与使用授权</summary><p>作者：{scene.author}</p><p>授权：<a href={scene.licenseUrl} target="_blank" rel="noopener noreferrer">{scene.license}</a></p><a href={scene.source} target="_blank" rel="noopener noreferrer">查看 GitHub 原始来源 ↗</a><p>站内图片未作内容修改。商用及改编请遵循原授权；需署名的场景应随交付保留作者、来源和授权说明。</p></details></div>
    </article>)}</div>
    {!items.length && <p role="status">没有匹配的场景，请换个关键词。</p>}
    {disabled && <p role="status">当前任务进行中，请完成后更换场景；尺寸图沿用本套已确认的共用场景。</p>}
  </section>;
}
