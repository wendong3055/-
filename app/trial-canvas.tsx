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
  const image = useRef<HTMLImageElement>(null);
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
  // The parent keys this viewport by src. Never clear a cached image's onLoad
  // result in a passive effect: onLoad can run before this effect during mount.
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth > 0) {
      setNatural({ width: element.naturalWidth, height: element.naturalHeight });
    }
  }, [src]);
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
    {failed ? <div className="preview-image-error">图片暂时无法加载，请刷新或重新选择素材。</div> : <div className="trial-image-plane" style={{ width: Math.max(bounds.width, width), height: Math.max(bounds.height, height) }}><img ref={image} key={src} src={src} alt={label} draggable={false} onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)} style={{ width: natural.width ? width : '100%', height: natural.height ? height : '100%', objectFit: fit }} /></div>}
  </div>;
}

type PreviewPicture = { src: string; label: string };

function PreviewWindow({ picture, selector, references, working = false, status = '' }: {
  picture?: PreviewPicture; selector: ReactNode; references: Props['references']; working?: boolean; status?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [height, setHeight] = useState(560);
  const heightDrag = useRef<{ y: number; height: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const hasImage = Boolean(picture || references.some((reference) => reference.src));
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('studio-preview-height-B') || localStorage.getItem('studio-preview-height'));
      if (saved >= 320 && saved <= 1000) setHeight(saved);
    } catch { /* Device-local view preference only. */ }
  }, []);
  const referenceKey = references.map(reference => reference.src).join('|');
  useEffect(() => { setZoom(100); }, [picture?.src, referenceKey]);
  const previewReferences = [
    references.find(reference => reference.label === '图案原图') || {src:'',label:'图案原图'},
    references.find(reference => reference.label === '框架原图' || reference.label === '本项确认参考图') || {src:'',label:'框架原图'},
    ...references.filter(reference => reference.label.includes('场景')),
  ];
  function resizeHeight(next: number) {
    const value = Math.min(1000, Math.max(320, next)); setHeight(value);
    try { localStorage.setItem('studio-preview-height-B', String(value)); } catch { /* Optional preference. */ }
  }
  const zoomControls = () => <div className="trial-zoom-controls">
    <button type="button" disabled={!hasImage || zoom <= 50} onClick={() => setZoom((v) => Math.max(50, v - 25))} aria-label="预览缩小">−</button>
    <button type="button" disabled={!hasImage} onClick={() => setZoom(100)} aria-label="恢复适配倍率">{zoom}%</button>
    <button type="button" disabled={!hasImage || zoom >= 400} onClick={() => setZoom((v) => Math.min(400, v + 25))} aria-label="预览放大">＋</button>
  </div>;
  const pictureView = () => picture ? <div className="trial-pictures"><figure>
    <figcaption title={picture.label}><span>{picture.label}</span></figcaption>
    <ImageViewport key={picture.src} src={picture.src} label={picture.label} zoom={zoom} fit={fit} />
  </figure></div> : <div className={`reference-pair-preview ${previewReferences.length > 2 ? 'with-scene-reference' : ''}`} aria-label="所选图案、框架与场景参考">
    {previewReferences.map(({src,label}, index) => <figure key={label}>
      <figcaption>{label}</figcaption>
      {src ? <ImageViewport key={src} src={src} label={label} zoom={zoom} fit={fit} /> : <div className="reference-missing">{index === 0 ? '请选择图案' : '此框架暂无原图'}</div>}
    </figure>)}
  </div>;

  return <section className="preview-window output-preview-window" aria-label="生成效果窗口">
    {selector && <div className="preview-window-selector">{selector}</div>}
    <div className="trial-toolbar">
      <label className="preview-fit"><span className="sr-only">预览显示方式</span><select disabled={!hasImage} value={fit} onChange={(event) => { setFit(event.target.value as 'contain' | 'cover'); setZoom(100); }}><option value="contain">完整显示</option><option value="cover">填满窗口</option></select></label>
      {zoomControls()}
      <button type="button" disabled={!hasImage} onClick={() => dialog.current?.showModal()} aria-label="全屏查看预览">全屏 ↗</button>
    </div>
    <div className="trial-stage" style={{ height }}>{pictureView()}{working && <div className="trial-progress" role="status"><i />{status} · 完成后自动显示效果图</div>}</div>
    <div className="preview-height-resizer" role="separator" aria-orientation="horizontal" aria-label="调整预览高度，上下方向键微调" aria-valuenow={height} aria-valuemin={320} aria-valuemax={1000} tabIndex={0} title="上下拖动调整高度"
      onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); resizeHeight(height + (event.key === 'ArrowUp' ? -20 : 20)); } }}
      onPointerDown={(event) => { if (event.button !== 0) return; heightDrag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (heightDrag.current) resizeHeight(heightDrag.current.height + event.clientY - heightDrag.current.y); }}
      onPointerUp={() => { heightDrag.current = null; }} onPointerCancel={() => { heightDrag.current = null; }} onLostPointerCapture={() => { heightDrag.current = null; }}><span /></div>
    <div className="canvas-view-options"><label>窗口高度 <input type="range" aria-label="预览窗口高度" min="320" max="1000" step="20" value={height} onChange={(event) => resizeHeight(Number(event.target.value))} /><span>{height}px</span></label></div>
    <dialog ref={dialog} className="trial-dialog" aria-label="全屏效果预览"><header><strong>生成效果</strong>{zoomControls()}<button type="button" autoFocus onClick={() => dialog.current?.close()}>关闭 · Esc</button></header>{pictureView()}</dialog>
  </section>;
}

export function TrialCanvas(props: Props) {
  const { tasks, activeTaskId, working, status, loading, onSelect, onReuse, reuseDisabled, onHistory, onGenerate, canGenerate, generateLabel } = props;
  const completed = tasks.filter((task) => task.status === 'succeeded' && task.url);
  // Keep the selected/last generated result visible during the next generation.
  const shown = props.importedResult ? undefined : completed.find((task) => task.id === activeTaskId) || completed[0];
  const picture: PreviewPicture | undefined = props.importedResult ? { src: props.importedResult.url, label: `本地临时预览 · ${props.importedResult.name}` } : shown ? { src: shown.url!, label: taskLabel(shown) } : undefined;

  return <section className="trial-canvas single-preview-canvas" aria-label="生成效果与试稿记录">
    <header className="compose-heading"><h2>生成效果</h2><span className={working ? 'trial-status working' : 'trial-status'} role="status">{working ? status : props.importedResult ? '本地图片 · 临时预览' : shown ? '已保留生成结果' : '待生成'}</span></header>
    <PreviewWindow picture={picture} working={working} status={status} references={props.references}
      selector={picture && <label>查看图片<select aria-label="选择预览图片" value={props.importedResult ? 'local' : shown?.id || ''} onChange={(event) => onSelect(event.target.value)} disabled={!completed.length}>
        {props.importedResult && <option value="local">本地导入 · 临时预览</option>}
        {completed.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}
      </select></label>} />
    <div className="trial-caption"><span>放大后可拖动查看细节；填满窗口不裁切原文件。</span><a className="trial-controls-link" href="#studio-controls">返回调整搭配</a></div>
    {shown && <div className="trial-result-actions"><button type="button" disabled={reuseDisabled || !shown.recipe} onClick={() => onReuse(shown)}>带入这张的设置</button><a href={shown.url!} target="_blank" rel="noreferrer">打开原图 ↗</a><a href={`${shown.url}${shown.url?.includes('?') ? '&' : '?'}download=1`} download>下载图片 ↓</a></div>}
    {shown?.recipe && <details className="saved-brief"><summary>这张图的制作要求</summary><p>{shown.recipe.instruction || '使用默认制作要求'}</p></details>}
    <div className="trial-next"><div><strong>{shown ? '继续下一轮' : '确认搭配后生成'}</strong><span>{props.outputSummary} · 1 张</span></div><button type="button" disabled={!canGenerate} onClick={onGenerate}>{generateLabel} →</button></div>
    <section className="trial-history"><div className="row-label"><h3>试稿记录 <span>{completed.length} 张</span></h3><button type="button" onClick={onHistory}>全部记录 →</button></div>
      {loading ? <p className="trial-history-empty">正在读取记录…</p> : tasks.length ? <div className="trial-filmstrip">{tasks.slice(0, 12).map((task) => <button type="button" key={task.id} aria-pressed={shown?.id === task.id} onClick={() => task.status === 'succeeded' && task.url ? onSelect(task.id) : onHistory()} aria-label={`查看${taskLabel(task)}，${generationLabels[task.status]}`}><span className="trial-film-image">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><strong>{task.name}</strong><small>{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {generationLabels[task.status]}</small></button>)}</div> : <p className="trial-history-empty">生成后的效果图会自动保留在这里。</p>}
    </section>
  </section>;
}
