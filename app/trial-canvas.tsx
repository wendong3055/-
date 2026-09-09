'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { generationLabels, type GenerationTask } from '../lib/generation-types';

type Props = {
  importedResult?: { url: string; name: string } | null;
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
  outputSummary: string;
  references: { src: string; label: string }[];
};

function taskLabel(task: GenerationTask) {
  return `${task.name} · ${new Date(task.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

function ImageViewport({ src, label, zoom, fit }: { src: string; label: string; zoom: number; fit: 'contain' | 'cover' }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBounds({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setFailed(false); setNatural({ width: 0, height: 0 }); }, [src]);
  const scale = natural.width ? (fit === 'cover' ? Math.max(bounds.width / natural.width, bounds.height / natural.height) : Math.min(bounds.width / natural.width, bounds.height / natural.height)) * zoom / 100 : 1;
  const width = Math.max(1, natural.width * scale);
  const height = Math.max(1, natural.height * scale);
  useEffect(() => { const element = viewport.current; if (element) { element.scrollLeft = (width - bounds.width) / 2; element.scrollTop = (height - bounds.height) / 2; } }, [src, width, height, bounds.width, bounds.height]);
  return <div ref={viewport} className="trial-viewport" tabIndex={0} aria-label={`${label}，${zoom}% 倍率。放大后可拖动或用方向键滚动。`}
    onPointerDown={(event) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
      event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
    }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    {failed ? <div className="preview-image-error">图片暂时无法加载，请刷新或重新选择素材。</div> : <div className="trial-image-plane" style={{ width: Math.max(bounds.width, width), height: Math.max(bounds.height, height) }}><img key={src} src={src} alt={label} draggable={false} onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)} style={{ width: natural.width ? width : undefined, height: natural.height ? height : undefined, visibility: natural.width ? 'visible' : 'hidden' }} /></div>}
  </div>;
}

export function TrialCanvas(props: Props) {
  const { tasks, activeTaskId, working, status, loading, fallback, onSelect, onReuse, reuseDisabled, onHistory, onGenerate, canGenerate, generateLabel } = props;
  const completed = tasks.filter((task) => task.status === 'succeeded' && task.url);
  // Keep the last result visible while settings change or the next task is running.
  const shown = props.importedResult ? undefined : completed.find((task) => task.id === activeTaskId) || completed[0];
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [height, setHeight] = useState(560);
  const [referenceIndex, setReferenceIndex] = useState(0);
  const heightDrag = useRef<{ y: number; height: number } | null>(null);
  useEffect(() => { try { const saved = Number(localStorage.getItem('studio-preview-height')); if (saved >= 320 && saved <= 1000) setHeight(saved); } catch { /* Optional preference. */ } }, []);
  function resizeHeight(next: number) { const value = Math.min(1000, Math.max(320, next)); setHeight(value); try { localStorage.setItem('studio-preview-height', String(value)); } catch { /* Optional preference. */ } }
  const [comparing, setComparing] = useState(false);
  const [baselineId, setBaselineId] = useState('');
  const alternatives = completed.filter((task) => task.id !== shown?.id);
  const baseline = alternatives.find((task) => task.id === baselineId) || alternatives[0];
  const canCompare = Boolean(shown && baseline);
  const showComparison = comparing && canCompare;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setZoom(100); }, [shown?.id, props.importedResult?.url, showComparison]);

  const zoomControls = (prefix: string) => <div className="trial-zoom-controls">
    <button type="button" disabled={zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))} aria-label={`${prefix}缩小`}>−</button>
    <button type="button" onClick={() => setZoom(100)} aria-label={`${prefix}恢复100%适配倍率`}>{zoom}%</button>
    <button type="button" disabled={zoom >= 400} onClick={() => setZoom((value) => Math.min(400, value + 25))} aria-label={`${prefix}放大`}>＋</button>
  </div>;

  const pictures = () => props.importedResult ? <div className="trial-pictures"><figure><figcaption><b>官网导入 · 临时预览</b><span>{props.importedResult.name}</span></figcaption><ImageViewport src={props.importedResult.url} label={props.importedResult.name} zoom={zoom} fit={fit} /></figure></div> : shown ? <div className={showComparison ? 'trial-pictures comparing' : 'trial-pictures'}>
    {showComparison && baseline && <figure><figcaption><b>A · 对比图</b><span>{taskLabel(baseline)}</span></figcaption><ImageViewport src={baseline.url!} label={baseline.name} zoom={zoom} fit={fit} /></figure>}
    <figure><figcaption><b>{showComparison ? 'B · 正在查看' : '正在查看'}</b><span>{taskLabel(shown)}</span></figcaption><ImageViewport src={shown.url!} label={shown.name} zoom={zoom} fit={fit} /></figure>
  </div> : props.references.length ? <div className="trial-pictures"><figure><figcaption><b>参考素材 · 尚未组合</b><span>{(props.references[referenceIndex] || props.references[0]).label}</span></figcaption><ImageViewport src={(props.references[referenceIndex] || props.references[0]).src} label={(props.references[referenceIndex] || props.references[0]).label} zoom={zoom} fit={fit} /></figure></div> : <div className="trial-empty">{fallback}</div>;

  return <section className="trial-canvas" aria-label="效果大图与试稿记录">
    <header className="compose-heading"><div><p>DESIGN CANVAS</p><h2>效果预览</h2></div><span className={working ? 'trial-status working' : 'trial-status'} role="status">{working ? status : props.importedResult ? '临时预览 · 尚未保存' : shown ? '已保留生成结果' : '等待第一张效果图'}</span></header>
    <div className="trial-toolbar">
      <div className="trial-modes"><button type="button" aria-pressed={fit === 'contain'} onClick={() => { setFit('contain'); setZoom(100); }}>完整显示</button><button type="button" aria-pressed={fit === 'cover'} onClick={() => { setFit('cover'); setZoom(100); }}>填满窗口</button></div>
      {zoomControls('画布')}
      <button type="button" className="trial-expand" onClick={() => dialog.current?.showModal()}>全屏查看 ↗</button>
    </div>
    <div className="canvas-view-options">{!shown && !props.importedResult ? <div className="reference-tabs">{props.references.map((reference, index) => <button type="button" key={reference.label} aria-pressed={referenceIndex === index} onClick={() => { setReferenceIndex(index); setZoom(100); }}>{reference.label}</button>)}</div> : shown ? <button type="button" aria-pressed={showComparison} disabled={!canCompare} onClick={() => setComparing(!showComparison)}>{showComparison ? '结束对比' : '两张对比'}</button> : null}<label>窗口高度 <input type="range" min="320" max="1000" step="20" value={height} onChange={(event) => resizeHeight(Number(event.target.value))} /><span>{height}px</span></label></div>
    {showComparison && <label className="trial-baseline">A 对比图<select value={baseline?.id || ''} onChange={(event) => setBaselineId(event.target.value)}>{alternatives.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}</select></label>}
    <div className="trial-stage" style={{ height }}>{pictures()}{working && <div className="trial-progress" role="status"><i />{status} · 完成后自动显示新图</div>}</div>
    <div className="preview-height-resizer" role="separator" aria-orientation="horizontal" aria-label="调整预览高度，上下方向键微调" aria-valuenow={height} aria-valuemin={320} aria-valuemax={1000} tabIndex={0} title="上下拖动调整高度"
      onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); resizeHeight(height + (event.key === 'ArrowUp' ? -20 : 20)); } }}
      onPointerDown={(event) => { if (event.button !== 0) return; heightDrag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (heightDrag.current) resizeHeight(heightDrag.current.height + event.clientY - heightDrag.current.y); }}
      onPointerUp={() => { heightDrag.current = null; }} onPointerCancel={() => { heightDrag.current = null; }} onLostPointerCapture={() => { heightDrag.current = null; }}><span /></div>
    <div className="trial-caption"><span>{fit === 'cover' ? '填满模式会超出窗口边缘，可拖动查看；不裁切原文件。' : zoom > 100 ? '拖动画面查看细节；100% 表示适配窗口的大小。' : props.importedResult ? '本地导入仅临时查看，不会上传到 RunningHub。' : shown ? '改设置、再生成，历史结果始终保留' : '这里是参考原图。官网生成后，可导入效果图查看。'}</span><a className="trial-controls-link" href="#studio-controls">返回调整搭配</a></div>
    {shown && <div className="trial-result-actions"><button type="button" disabled={reuseDisabled || !shown.recipe} onClick={() => onReuse(shown)}>带入这张的设置</button><a href={shown.url!} target="_blank" rel="noreferrer">打开原图 ↗</a><a href={`${shown.url}${shown.url?.includes('?') ? '&' : '?'}download=1`} download>下载图片 ↓</a></div>}
    {shown?.recipe && <details className="saved-brief"><summary>这张图的制作要求</summary><p>{shown.recipe.instruction || '使用默认制作要求'}</p></details>}
    <div className="trial-next"><div><strong>{shown ? '继续下一轮' : '确认搭配后生成'}</strong><span>{props.outputSummary} · 1 张</span></div><button type="button" disabled={!canGenerate} onClick={onGenerate}>{generateLabel} →</button></div>
    <section className="trial-history"><div className="row-label"><h3>试稿记录 <span>{completed.length} 张</span></h3><button type="button" onClick={onHistory}>全部记录 →</button></div>
      {loading ? <p className="trial-history-empty">正在读取记录…</p> : tasks.length ? <div className="trial-filmstrip">{tasks.slice(0, 12).map((task) => <button type="button" key={task.id} aria-pressed={shown?.id === task.id} onClick={() => task.url ? onSelect(task.id) : onHistory()} aria-label={`查看${taskLabel(task)}，${generationLabels[task.status]}`}><span className="trial-film-image">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><strong>{task.name}</strong><small>{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {generationLabels[task.status]}</small></button>)}</div> : <p className="trial-history-empty">每轮结果都会留在这里。选中任意一张，即可查看、对比或带入它的设置。</p>}
    </section>
    <dialog ref={dialog} className="trial-dialog" aria-label="全屏效果预览"><header><strong>效果预览{showComparison ? ' · 两张对比' : ''}</strong>{zoomControls('全屏')}<button type="button" autoFocus onClick={() => dialog.current?.close()}>关闭 · Esc</button></header>{pictures()}</dialog>
  </section>;
}
