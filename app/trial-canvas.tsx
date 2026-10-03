'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { generationLabels, type GenerationTask } from '../lib/generation-types';
import { previousTrial, trialChanges, type RecipeLabel } from '../lib/trial-changes';

type Props = {
  itemMode?: boolean;
  stale?: boolean;
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
  reviewFirst?: () => void;
  onEdit?: () => void;
  outputSummary: string;
  nextStep?: { onConfirm: () => void; saving: boolean };
  references: { src: string; label: string }[];
  onFavorite?: (task: GenerationTask) => void;
  favoriteSaving?: string[];
  recipeLabel?: RecipeLabel;
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

function PreviewWindow({ picture, comparison, selector, references, working = false, status = '' }: {
  picture?: PreviewPicture; comparison?: PreviewPicture; selector: ReactNode; references: Props['references']; working?: boolean; status?: string;
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
    references.find(reference => reference.label.startsWith('图案')) || {src:'',label:'图案原图'},
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
  const pictureView = () => picture ? <div className={`trial-pictures${comparison ? ' comparing' : ''}`}>
    {[picture, ...(comparison ? [comparison] : [])].map((p, index) => <figure key={`${index}:${p.src}`}>
      <figcaption title={p.label}>{comparison && <b>{index === 0 ? '当前' : '对比'}</b>}<span>{p.label}</span></figcaption>
      <ImageViewport key={p.src} src={p.src} label={p.label} zoom={zoom} fit={fit} />
    </figure>)}
  </div> : <div className={`reference-pair-preview ${previewReferences.length > 2 ? 'with-scene-reference' : ''}`} aria-label="所选图案、框架与场景参考">
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
  const [comparing, setComparing] = useState(false);
  const [compareId, setCompareId] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const candidates = completed.filter(task => task.id !== shown?.id);
  const compared = comparing && shown ? candidates.find(task => task.id === compareId) || previousTrial(shown, completed) || candidates[0] : undefined;
  const previous = shown ? previousTrial(shown, completed) : undefined;
  const baseline = compared || previous;
  const changes = shown ? trialChanges(shown, baseline, props.recipeLabel) : null;
  const history = favoritesOnly ? completed.filter(task => task.favorite) : tasks;

  return <section className="trial-canvas single-preview-canvas" aria-label="生成效果与试稿记录">
    {props.stale && shown && <p className="generation-warning" role="status">{props.itemMode?'修改要求尚未生成，当前仍为已保存结果':'搭配已修改，右侧为上一轮结果'}</p>}
    <header className="compose-heading"><h2>{picture ? '生成效果' : '参考图片'}</h2><span className={working ? 'trial-status working' : 'trial-status'} role="status">{working ? status : props.importedResult ? '本地图片 · 临时预览' : shown ? '已保留生成结果' : '还未生成'}</span></header>
    {!picture && <p className="preview-explainer">这里显示你选的图案和框架。生成后的效果图会出现在这里。</p>}
    <PreviewWindow picture={picture} comparison={compared ? { src: compared.url!, label: taskLabel(compared) } : undefined} working={working} status={status} references={props.references}
      selector={picture && <div className="trial-selectors"><label>查看图片<select aria-label="选择预览图片" value={props.importedResult ? 'local' : shown?.id || ''} onChange={(event) => onSelect(event.target.value)} disabled={!completed.length}>
        {props.importedResult && <option value="local">本地导入 · 临时预览</option>}
        {completed.map((task) => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}
      </select></label>{shown && candidates.length > 0 && <button type="button" aria-pressed={comparing} onClick={() => setComparing(value => !value)}>{comparing ? '结束对比' : '对比两版'}</button>}
      {compared && <label>对比图片<select aria-label="选择对比图片" value={compared.id} onChange={event => setCompareId(event.target.value)}>{candidates.map(task => <option key={task.id} value={task.id}>{taskLabel(task)}</option>)}</select></label>}</div>} />
    <div className="trial-caption"><span>可以放大或全屏检查细节。</span><a className="trial-controls-link" href="#studio-controls" onClick={props.onEdit ? event => { event.preventDefault(); props.onEdit!(); } : undefined}>{props.itemMode?'调整这张图':'返回调整搭配'}</a></div>
    {shown && <div className="trial-result-actions">{props.onFavorite && <button type="button" aria-pressed={Boolean(shown.favorite)} disabled={props.favoriteSaving?.includes(shown.id)} onClick={() => props.onFavorite?.(shown)}>{props.favoriteSaving?.includes(shown.id) ? '正在保存…' : shown.favorite ? '★ 已收藏' : '☆ 收藏这版'}</button>}{!props.itemMode&&<button type="button" disabled={reuseDisabled || !shown.recipe} onClick={() => onReuse(shown)}>带入这张的设置</button>}<a href={shown.url!} target="_blank" rel="noreferrer">打开原图 ↗</a><a href={`${shown.url}${shown.url?.includes('?') ? '&' : '?'}download=1`} download>下载图片 ↓</a></div>}
    {shown && <details className="trial-changes" open><summary>{compared ? '与对比图片的设置差异' : '这一轮改了什么'}<span>{changes ? changes.length ? changes.map(change => change.label).join('、') : '设置相同，重新试做' : baseline ? '旧记录缺少设置，无法核对' : '当前记录的第一版'}</span></summary>
      {changes && changes.length > 0 && <div className="trial-change-list">{changes.map(change => <div key={change.label}><strong>{change.label}</strong><span>{change.before}</span><span>{change.after}</span></div>)}</div>}
      {compared && <p>两边同步缩放；不同画幅按各自窗口适配。</p>}
    </details>}
    {shown?.recipe && <details className="saved-brief"><summary>这张图的制作要求</summary><p>{shown.recipe.instruction || '使用默认制作要求'}</p></details>}
    {!props.itemMode && (shown && props.nextStep ? <>
      <div className="trial-next" aria-label="确认样图并进入下一步"><div><strong>下一步：制作主图、尺寸图和详情页</strong><span>{!shown.assetId || !shown.recipe ? '这张历史图缺少原始搭配记录，暂不能进入制作；原图仍可下载。' : '使用当前展示的样图进入制作清单，不会重新生成样图，也不会扣费。'}</span></div><button type="button" disabled={working || props.nextStep.saving || reuseDisabled || !shown.assetId || !shown.recipe} onClick={props.nextStep.onConfirm}>{props.nextStep.saving ? '正在进入…' : '确认样图，进入下一步'} →</button></div>
      <div className="trial-result-actions"><span>样图还不满意？</span><a href="#studio-controls" onClick={props.onEdit ? event => { event.preventDefault(); props.onEdit!(); } : undefined}>修改搭配</a><button type="button" disabled={working || props.nextStep.saving || (!props.reviewFirst && !canGenerate)} onClick={props.reviewFirst || onGenerate}>{working ? '正在生成…' : props.reviewFirst ? '核对下一张的设置' : '再生成 1 张样图'}</button></div>
    </> : <div className="trial-next"><div><strong>{shown ? '继续下一轮' : '准备好后，先生成 1 张'}</strong><span>{props.outputSummary} · 按服务商规则计费</span></div><button type="button" disabled={working || (!props.reviewFirst && !canGenerate)} onClick={props.reviewFirst || onGenerate}>{props.reviewFirst ? '去核对并生图' : generateLabel} →</button></div>)}
    <section className="trial-history"><div className="row-label"><h3>{props.itemMode?'这张图的历史版本':'试稿记录'} <span>{completed.length} 张</span></h3><div className="trial-history-filters"><button type="button" aria-pressed={!favoritesOnly} onClick={() => setFavoritesOnly(false)}>全部</button><button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(true)}>收藏 · {completed.filter(task => task.favorite).length}</button>{!props.itemMode&&<button type="button" onClick={onHistory}>全部记录 →</button>}</div></div>
      {loading ? <p className="trial-history-empty">正在读取记录…</p> : history.length ? <div className="trial-filmstrip">{history.slice(0, favoritesOnly ? 500 : 12).map((task) => {
        const delta = trialChanges(task, previousTrial(task, completed));
        return <button type="button" key={task.id} aria-pressed={shown?.id === task.id} onClick={() => task.status === 'succeeded' && task.url ? onSelect(task.id) : onHistory()} aria-label={`查看${taskLabel(task)}，${generationLabels[task.status]}`}><span className="trial-film-image">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><strong>{task.favorite ? '★ ' : ''}{task.name}</strong><small>{new Date(task.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {generationLabels[task.status]}</small>{task.status === 'succeeded' && <small className="trial-delta" title={delta?.map(change => change.label).join('、')}>{delta ? delta.length ? `改动：${delta.map(change => change.label).join('、')}` : '同设置再试' : '起始记录 / 设置未记录'}</small>}</button>;
      })}</div> : <p className="trial-history-empty">{favoritesOnly ? '还没有收藏。在满意的结果下点击“收藏这版”。' : '生成后的效果图会自动保留在这里。'}</p>}
    </section>
  </section>;
}
