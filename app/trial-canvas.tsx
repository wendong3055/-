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

type PreviewPicture = { src: string; label: string; task?: GenerationTask };

export function comparisonPicture(selection: string, references: Props['references'], completed: GenerationTask[]): PreviewPicture | undefined {
  if (selection.startsWith('task:')) {
    const task = completed.find((item) => item.id === selection.slice(5) && item.status === 'succeeded' && item.url);
    if (task) return { src: task.url!, label: taskLabel(task), task };
  }
  const reference = references[Number(selection.slice(4))] || references[0];
  return reference ? { src: reference.src, label: reference.label } : undefined;
}

function PreviewWindow({ slot, title, picture, selector, empty, working = false, status = '' }: {
  slot: 'A' | 'B'; title: string; picture?: PreviewPicture; selector: ReactNode; empty: ReactNode; working?: boolean; status?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [height, setHeight] = useState(520);
  const heightDrag = useRef<{ y: number; height: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`studio-preview-height-${slot}`) || localStorage.getItem('studio-preview-height'));
      if (saved >= 320 && saved <= 1000) setHeight(saved);
    } catch { /* Device-local view preference only. */ }
  }, [slot]);
  useEffect(() => { setZoom(100); }, [picture?.src]);
  function resizeHeight(next: number) {
    const value = Math.min(1000, Math.max(320, next)); setHeight(value);
    try { localStorage.setItem(`studio-preview-height-${slot}`, String(value)); } catch { /* Optional preference. */ }
  }
  const zoomControls = () => <div className="trial-zoom-controls">
    <button type="button" disabled={!picture || zoom <= 50} onClick={() => setZoom((v) => Math.max(50, v - 25))} aria-label={`${slot} 窗口缩小`}>−</button>
    <button type="button" disabled={!picture} onClick={() => setZoom(100)} aria-label={`${slot} 窗口恢复适配倍率`}>{zoom}%</button>
    <button type="button" disabled={!picture || zoom >= 400} onClick={() => setZoom((v) => Math.min(400, v + 25))} aria-label={`${slot} 窗口放大`}>＋</button>
  </div>;
  const pictureView = () => picture ? <div className="trial-pictures"><figure>
    <figcaption title={picture.label}><span>{picture.label}</span></figcaption>
    <ImageViewport key={picture.src} src={picture.src} label={picture.label} zoom={zoom} fit={fit} />
  </figure></div> : <div className="trial-empty">{empty}</div>;

  return <section className="preview-window" aria-label={`${slot} 窗口 · ${title}`}>
    <header className="preview-window-heading"><span>{slot}</span><h3>{title}</h3></header>
    <div className="preview-window-selector">{selector}</div>
    <div className="trial-toolbar">
      <label className="preview-fit"><span className="sr-only">{slot} 窗口显示方式</span><select disabled={!picture} value={fit} onChange={(event) => { setFit(event.target.value as 'contain' | 'cover'); setZoom(100); }}><option value="contain">完整显示</option><option value="cover">填满窗口</option></select></label>
      {zoomControls()}
      <button type="button" disabled={!picture} onClick={() => dialog.current?.showModal()} aria-label={`全屏查看 ${slot} 窗口`}>全屏 ↗</button>
    </div>
    <div className="trial-stage" style={{ height }}>{pictureView()}{working && <div className="trial-progress" role="status"><i />{status} · 完成后显示在 B</div>}</div>
    <div className="preview-height-resizer" role="separator" aria-orientation="horizontal" aria-label={`调整 ${slot} 窗口高度，上下方向键微调`} aria-valuenow={height} aria-valuemin={320} aria-valuemax={1000} tabIndex={0} title="上下拖动调整高度"
      onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); resizeHeight(height + (event.key === 'ArrowUp' ? -20 : 20)); } }}
      onPointerDown={(event) => { if (event.button !== 0) return; heightDrag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (heightDrag.current) resizeHeight(heightDrag.current.height + event.clientY - heightDrag.current.y); }}
      onPointerUp={() => { heightDrag.current = null; }} onPointerCancel={() => { heightDrag.current = null; }} onLostPointerCapture={() => { heightDrag.current = null; }}><span /></div>
    <div className="canvas-view-options"><label>{slot} 高度 <input type="range" aria-label={`${slot} 窗口高度`} min="320" max="1000" step="20" value={height} onChange={(event) => resizeHeight(Number(event.target.value))} /><span>{height}px</span></label></div>
    <dialog ref={dialog} className="trial-dialog" aria-label={`${slot} 窗口全屏预览`}><header><strong>{slot} · {title}</strong>{zoomControls()}<button type="button" autoFocus onClick={() => dialog.current?.close()}>关闭 · Esc</button></header>{pictureView()}</dialog>
  </section>;
}

export function TrialCanvas(props: Props) {
  const { tasks, activeTaskId, working, status, loading, fallback, onSelect, onReuse, reuseDisabled, onHistory, onGenerate, canGenerate, generateLabel } = props;
  const completed = tasks.filter((task) => task.status === 'succeeded' && task.url);
  // B follows the selected/current generated result; A remains independently pinned.
  const shown = props.importedResult ? undefined : completed.find((task) => task.id === activeTaskId) || completed[0];
  const [comparison, setComparison] = useState('ref:0');
  const [historyTarget, setHistoryTarget] = useState<'A' | 'B'>('B');
  const comparisonChoices = [
    ...props.references.map((reference, index) => ({ id: `ref:${index}`, label: reference.label })),
    ...completed.map((task) => ({ id: `task:${task.id}`, label: taskLabel(task) })),
  ];
  const comparisonValue = comparisonChoices.some((item) => item.id === comparison) ? comparison : comparisonChoices[0]?.id || '';
  const left = comparisonPicture(comparisonValue, props.references, completed);
  const right: PreviewPicture | undefined = props.importedResult ? { src: props.importedResult.url, label: `本地临时预览 · ${props.importedResult.name}` } : shown ? { src: shown.url!, label: taskLabel(shown), task: shown } : undefined;

  return <section className="trial-canvas dual-preview-canvas" aria-label="双窗口效果预览与试稿记录">
    <header className="compose-heading"><div><p>DESIGN CANVAS</p><h2>效果预览</h2></div><span className={working ? 'trial-status working' : 'trial-status'} role="status">{working ? status : props.importedResult ? '本地图片 · 临时预览' : shown ? '已保留生成结果' : '等待第一张效果图'}</span></header>
    <p className="dual-preview-note">A 保留对比图，B 查看生成结果。两个窗口可以分别选图、放大。</p>
    <div className="dual-preview-grid">
      <PreviewWindow slot="A" title="参考 / 对比" picture={left}
        selector={<label>A 窗口图片<select aria-label="选择 A 窗口图片" value={comparisonValue} onChange={(event) => setComparison(event.target.value)} disabled={!comparisonChoices.length}>
          {!comparisonChoices.length && <option value="">暂无参考图</option>}
          {props.references.length > 0 && <optgroup label="当前参考素材">{props.references.map((reference, index) => <option key={index} value={`ref:${index}`}>{reference.label}</option>)}</optgroup>}
          {completed.length > 0 && <optgroup label="已生成效果图">{completed.map((task) => <option key={task.id} value={`task:${task.id}`}>{taskLabel(task)}</option>)}</optgroup>}
        </select></label>}
        empty={<p>选择图案或历史效果图，放在这里对比。</p>} />
      <PreviewWindow slot="B" title="生成效果" picture={right} working={working} status={status}
        selector={<label>B 窗口图片<select aria-label="选择 B 窗口图片" value={props.importedResult ? 'local' : shown?.id || ''} onChange={(event) => onSelect(event.target.value)} disabled={!completed.length}>
          {props.importedResult && <option value="local">本地导入 · 临时预览</option>}
          {!right && <option value="">等待生成结果</option>}
          {completed.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}
        </select></label>}
        empty={fallback} />
    </div>
    <div className="trial-caption"><span>放大后可拖动查看细节；填满窗口不裁切原文件。</span><a className="trial-controls-link" href="#studio-controls">返回调整搭配</a></div>
    {left?.task && <div className="comparison-actions"><span>A · {left.task.name}</span><button type="button" onClick={() => onSelect(left.task!.id)}>在 B 窗口查看这张 →</button></div>}
    {shown && <div className="trial-result-actions"><span>B 窗口</span><button type="button" disabled={reuseDisabled || !shown.recipe} onClick={() => onReuse(shown)}>带入这张的设置</button><a href={shown.url!} target="_blank" rel="noreferrer">打开原图 ↗</a><a href={`${shown.url}${shown.url?.includes('?') ? '&' : '?'}download=1`} download>下载图片 ↓</a></div>}
    {shown?.recipe && <details className="saved-brief"><summary>B 窗口图片的制作要求</summary><p>{shown.recipe.instruction || '使用默认制作要求'}</p></details>}
    <div className="trial-next"><div><strong>{shown ? '继续下一轮' : '确认搭配后生成'}</strong><span>{props.outputSummary} · 1 张</span></div><button type="button" disabled={!canGenerate} onClick={onGenerate}>{generateLabel} →</button></div>
    <section className="trial-history"><div className="row-label"><h3>试稿记录 <span>{completed.length} 张</span></h3><button type="button" onClick={onHistory}>全部记录 →</button></div>
      <div className="history-preview-target"><span>点击记录放入</span>{(['A', 'B'] as const).map((slot) => <button key={slot} type="button" aria-pressed={historyTarget === slot} onClick={() => setHistoryTarget(slot)}>{slot} 窗口</button>)}</div>
      {loading ? <p className="trial-history-empty">正在读取记录…</p> : tasks.length ? <div className="trial-filmstrip">{tasks.slice(0, 12).map((task) => <button type="button" key={task.id} aria-pressed={(historyTarget === 'A' ? left?.task?.id : shown?.id) === task.id} onClick={() => task.status === 'succeeded' && task.url ? historyTarget === 'A' ? setComparison(`task:${task.id}`) : onSelect(task.id) : onHistory()} aria-label={`在 ${historyTarget} 窗口查看${taskLabel(task)}，${generationLabels[task.status]}`}><span className="trial-film-image">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><strong>{task.name}</strong><small>{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {generationLabels[task.status]}</small></button>)}</div> : <p className="trial-history-empty">每轮结果都会保留。生成第一张后，即可和 A 窗口的参考图对比。</p>}
    </section>
  </section>;
}
