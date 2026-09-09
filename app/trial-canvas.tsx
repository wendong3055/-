'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { generationLabels, type GenerationTask } from '../lib/generation-types';

type Props = {
  tasks: GenerationTask[];
  activeTaskId: string;
  working: boolean;
  status: string;
  loading: boolean;
  fallback: ReactNode;
  onSelect: (id: string) => void;
  onReuse: (task: GenerationTask) => void;
  reuseDisabled: boolean;
  onHistory: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  generateLabel: string;
};

function taskLabel(task: GenerationTask) {
  return `${task.name} · ${new Date(task.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

function ImageViewport({ task, zoom }: { task: GenerationTask; zoom: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => {
    const element = viewport.current;
    if (element) { element.scrollLeft = 0; element.scrollTop = 0; }
  }, [task.id, zoom]);
  return <div ref={viewport} className="trial-viewport" tabIndex={0} aria-label={`${task.name}，${zoom}% 适配倍率。放大后可拖动或用方向键滚动。`}
    style={{ '--trial-zoom': zoom / 100 } as CSSProperties}
    onPointerDown={(event) => {
      if (zoom === 100 || event.button !== 0 || event.pointerType === 'touch') return;
      drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
      event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
    }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <div className="trial-image-plane"><img src={task.url!} alt={task.name} draggable={false} /></div>
  </div>;
}

export function TrialCanvas(props: Props) {
  const { tasks, activeTaskId, working, status, loading, fallback, onSelect, onReuse, reuseDisabled, onHistory, onGenerate, canGenerate, generateLabel } = props;
  const completed = tasks.filter((task) => task.status === 'succeeded' && task.url);
  // Keep the last result visible while settings change or the next task is running.
  const shown = completed.find((task) => task.id === activeTaskId) || completed[0];
  const [zoom, setZoom] = useState(100);
  const [comparing, setComparing] = useState(false);
  const [baselineId, setBaselineId] = useState('');
  const alternatives = completed.filter((task) => task.id !== shown?.id);
  const baseline = alternatives.find((task) => task.id === baselineId) || alternatives[0];
  const canCompare = Boolean(shown && baseline);
  const showComparison = comparing && canCompare;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setZoom(100); }, [shown?.id, showComparison]);

  const zoomControls = (prefix: string) => <div className="trial-zoom-controls">
    <button type="button" disabled={!shown || zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))} aria-label={`${prefix}缩小`}>−</button>
    <button type="button" disabled={!shown} onClick={() => setZoom(100)} aria-label={`${prefix}恢复适合画布`}>{zoom === 100 ? '适合画布' : `${zoom}%`}</button>
    <button type="button" disabled={!shown || zoom >= 300} onClick={() => setZoom((value) => Math.min(300, value + 25))} aria-label={`${prefix}放大`}>＋</button>
  </div>;

  const pictures = () => shown ? <div className={showComparison ? 'trial-pictures comparing' : 'trial-pictures'}>
    {showComparison && baseline && <figure><figcaption><b>A · 对比图</b><span>{taskLabel(baseline)}</span></figcaption><ImageViewport task={baseline} zoom={zoom} /></figure>}
    <figure><figcaption><b>{showComparison ? 'B · 正在查看' : '正在查看'}</b><span>{taskLabel(shown)}</span></figcaption><ImageViewport task={shown} zoom={zoom} /></figure>
  </div> : <div className="trial-empty">{fallback}</div>;

  return <section className="trial-canvas" aria-label="效果大图与试稿记录">
    <header className="compose-heading"><div><p>DESIGN CANVAS</p><h2>效果预览</h2></div><span className={working ? 'trial-status working' : 'trial-status'} role="status">{working ? status : shown ? '已保留生成结果' : '等待第一张效果图'}</span></header>
    <div className="trial-toolbar">
      <div className="trial-modes"><button type="button" aria-pressed={!showComparison} onClick={() => setComparing(false)}>单图</button><button type="button" aria-pressed={showComparison} disabled={!canCompare} onClick={() => setComparing(true)} title={canCompare ? '对比两张生成结果' : '完成两张效果图后可对比'}>两张对比</button></div>
      {zoomControls('画布')}
      <button type="button" className="trial-expand" onClick={() => dialog.current?.showModal()}>全屏查看 ↗</button>
    </div>
    {showComparison && <label className="trial-baseline">A 对比图<select value={baseline?.id || ''} onChange={(event) => setBaselineId(event.target.value)}>{alternatives.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}</select></label>}
    <div className="trial-stage">{pictures()}{working && <div className="trial-progress" role="status"><i />{status} · 完成后自动显示新图</div>}</div>
    <div className="trial-caption"><span>{zoom > 100 ? '放大后拖动画面查看细节' : shown ? '改设置、再生成，历史结果始终保留' : '图案与框架是参考素材，生成后在此显示效果图'}</span><a className="trial-controls-link" href="#studio-controls">调整制作要求 ↓</a></div>
    {shown && <div className="trial-result-actions"><button type="button" disabled={reuseDisabled || !shown.recipe} onClick={() => onReuse(shown)}>带入这张的设置</button><a href={shown.url!} target="_blank" rel="noreferrer">打开原图 ↗</a><a href={`${shown.url}${shown.url?.includes('?') ? '&' : '?'}download=1`} download>下载图片 ↓</a></div>}
    {shown?.recipe && <details className="saved-brief"><summary>这张图的制作要求</summary><p>{shown.recipe.instruction || '使用默认制作要求'}</p></details>}
    <div className="trial-next"><div><strong>继续下一轮</strong><span>每次生成 1 张 · 16:9 · 2K</span></div><button type="button" disabled={!canGenerate} onClick={onGenerate}>{generateLabel} →</button></div>
    <section className="trial-history"><div className="row-label"><h3>试稿记录 <span>{completed.length} 张</span></h3><button type="button" onClick={onHistory}>全部记录 →</button></div>
      {loading ? <p className="trial-history-empty">正在读取记录…</p> : tasks.length ? <div className="trial-filmstrip">{tasks.slice(0, 12).map((task) => <button type="button" key={task.id} aria-pressed={shown?.id === task.id} onClick={() => task.url ? onSelect(task.id) : onHistory()} aria-label={`查看${taskLabel(task)}，${generationLabels[task.status]}`}><span className="trial-film-image">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><strong>{task.name}</strong><small>{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {generationLabels[task.status]}</small></button>)}</div> : <p className="trial-history-empty">每轮结果都会留在这里。选中任意一张，即可查看、对比或带入它的设置。</p>}
    </section>
    <dialog ref={dialog} className="trial-dialog" aria-label="全屏效果预览"><header><strong>效果预览{showComparison ? ' · 两张对比' : ''}</strong>{zoomControls('全屏')}<button type="button" autoFocus onClick={() => dialog.current?.close()}>关闭 · Esc</button></header>{pictures()}</dialog>
  </section>;
}
