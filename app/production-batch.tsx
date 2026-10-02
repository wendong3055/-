'use client';
import { useEffect, useRef, useState } from 'react';
import type { ProductWorkspace, ProductionItem, ProductionPlan } from '../lib/production-plan';
import { generationLabels, type GenerationTask } from '../lib/generation-types';
import { runDetailBatch } from '../lib/detail-batch';
import { batchCandidates, batchQueue, pageItems, usablePlan, type ProductionPage } from '../lib/production-workflow';
import { productionSample, sampleApproved, sampleMatches, savedBatchSettings } from '../lib/production-sample';
import { artworkOriginal, readReference, type OriginalReference } from '../lib/studio-reference';
import { downloadBlob, detailLongImage, exportDetailDraft } from '../lib/production-export';
import { mainPropsBrief, type PropsMode } from '../lib/main-props';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || '请求未完成，请刷新核对任务。');
  return body;
}
export function ProductionBatch({ data, plan, page, count, artworks, colors, onPrepare, onUpdate, onBusy }: {
  data: ProductWorkspace; plan?: ProductionPlan; page: ProductionPage; count: number;
  artworks: (OriginalReference & { id: string })[]; colors: { id: string; name: string; color: string }[];
  onPrepare: (target?: ProductionPage) => Promise<{ data: ProductWorkspace; plan: ProductionPlan }>;
  onUpdate: (data: ProductWorkspace) => void; onBusy: (busy: boolean) => void;
}) {
  const [running, setRunning] = useState(false), [message, setMessage] = useState(''), [current, setCurrent] = useState('');
  const [failed, setFailed] = useState(false);
  const [model, setModel] = useState('gpt-image-2'), [quality, setQuality] = useState('medium');
  const stop = useRef(false), lock = useRef(false), mounted = useRef(true);
  const [preview, setPreview] = useState(''), [exporting, setExporting] = useState(false);
  const [propsMode, setPropsMode] = useState<PropsMode>('auto'), [propsText, setPropsText] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; onBusy(false); }; }, [onBusy]);
  const items = plan ? pageItems(plan, page) : [], pending = plan ? batchCandidates(items) : [], retry = batchCandidates(items, true);
  const sample = plan ? productionSample(plan, page) : undefined;
  const fullPlan = page === 'main' ? plan : data.plans.find(p => usablePlan(p, 'main'));
  const fullSample = fullPlan ? productionSample(fullPlan, 'main') : undefined;
  const settingsSample = sample?.task?.status === 'succeeded' && sample.review !== 'rework' ? sample : undefined;
  const settingsLocked = Boolean(settingsSample);
  useEffect(() => {
    const saved = savedBatchSettings(settingsSample);
    if (saved) { setModel(saved.model); setQuality(saved.quality); setPropsMode(saved.propsMode); setPropsText(saved.propsText); }
  }, [settingsSample?.id, settingsSample?.generationId]);
  const completed = items.filter(i => i.task?.status === 'succeeded' && i.review !== 'rework').length;
  const savedFailure = items.find(i => i.task?.status === 'failed' && i.task.error)?.task?.error;
  const visibleError = failed || (!running && !message && !!savedFailure);
  const total = plan ? items.length : count, remaining = plan ? pending.length : count;
  const awaitingReview = (item?: ProductionItem) => item?.task?.status === 'succeeded' && !!item.task.url && !sampleApproved(item) && item.review !== 'rework';
  async function refresh() {
    const next = await json<ProductWorkspace>(`/api/products/${encodeURIComponent(data.product.id)}/workspace`, { cache: 'no-store' });
    if (mounted.current) onUpdate(next);
    return next;
  }
  async function acceptSample(item: ProductionItem) {
    if (lock.current || !item.generationId) return;
    lock.current = true; setRunning(true); onBusy(true); setFailed(false);
    try {
      await json(`/api/production/${encodeURIComponent(item.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ generationId: item.generationId, review: 'accepted', note: item.note }) });
      await refresh(); setMessage('样稿已验收。点击“继续”并确认数量后，才会制作余图。');
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : '验收未保存，请重试。'); }
    finally { lock.current = false; if (mounted.current) { setRunning(false); onBusy(false); } }
  }
  async function exportDraft(show = false) {
    if (!plan) return;
    setExporting(true);
    try { if (show) setPreview(URL.createObjectURL(await detailLongImage(data, plan))); else await exportDetailDraft(data, plan); }
    catch (error) { setMessage(String(error)); } finally { setExporting(false); }
  }
  async function start(retryOnly = false, fullSet = false, sampleOnly = true) {
    if (lock.current) return;
    lock.current = true; stop.current = false; setRunning(true); setFailed(false); onBusy(true); setMessage('正在准备本套制作…');
    try {
      if ((page === 'main' || page === 'size' || fullSet) && propsMode === 'custom' && !propsText.trim()) throw new Error('请填写摆件要求，或选择自动搭配。');
      if (fullSet && !data.sizes.length) throw new Error('尚未找到尺寸原图，无法制作全套；请先补充，或单独制作主图和详情。');
      const firstStage = fullSet ? 'main' : page;
      const prepared = await onPrepare(firstStage);
      let next = prepared.data;
      const firstSample = productionSample(prepared.plan, firstStage);
      if (!firstSample) throw new Error('没有可试做的样稿，请刷新制作清单。');
      const settings = fullSet && !sampleOnly ? savedBatchSettings(firstSample) || { model, quality, propsMode, propsText: propsText.trim().slice(0, 400) } : { model, quality, propsMode, propsText: propsText.trim().slice(0, 400) };
      if (!sampleOnly && (!sampleApproved(firstSample) || !sampleMatches(firstSample, settings))) throw new Error('请先验收本套样稿，并沿用样稿的模型、画质和摆件设置。需要改变风格时请开始新一套。');
      if (sampleOnly && firstSample.task?.status === 'succeeded' && firstSample.review !== 'rework') { setMessage('这张样稿已保存，请先查看并验收；不会重新生成。'); return; }
      const contexts = new Map<string, { planId: string; stage: ProductionPage }>();
      const queue: ProductionItem[] = [];
      function addItems(preparedPlan: ProductionPlan, stage: ProductionPage) {
        if (preparedPlan.config.rule !== prepared.plan.config.rule || preparedPlan.config.notes !== prepared.plan.config.notes) throw new Error('各页面的制作规则不同，请按现有搭配开始新一套，或分别制作。');
        for (const item of batchQueue(preparedPlan, stage, retryOnly)) {
          if (!contexts.has(item.id)) { contexts.set(item.id, { planId: preparedPlan.id, stage }); queue.push(item); }
        }
      }
      if (sampleOnly) { contexts.set(firstSample.id, { planId: prepared.plan.id, stage: firstStage }); queue.push(firstSample); }
      else {
        addItems(prepared.plan, firstStage);
        for (const stage of fullSet ? (['size', 'detail'] as const) : []) {
          if (stop.current || !mounted.current) return;
          const extra = await onPrepare(stage); next = extra.data; addItems(extra.plan, stage);
        }
      }
      if (!queue.length) throw new Error('本轮没有待制作图片，已完成结果不会重复生成。');
      const tasks = await json<GenerationTask[]>('/api/generations', { cache: 'no-store' });
      if (tasks.some(t => !['succeeded', 'failed'].includes(t.status))) throw new Error('还有运行中或状态待核对的任务，请先查看生成任务。不会重复提交。');
      const recipe = next.sample?.recipe, art = artworks.find(a => a.id === recipe?.artworkId), color = colors.find(c => c.id === recipe?.colorId);
      if (!recipe || !art || !color) throw new Error('原画芯或颜色资料尚未加载，请刷新重试，不会替换素材。');
      const sampleReference = !sampleOnly && firstSample.kind === 'main' ? firstSample.task!.url! : `/api/files/${next.product.sampleAssetId}`;
      const [artFile, sampleFile] = await Promise.all([readReference(artworkOriginal(art), art.name), readReference(sampleReference, '确认样图')]);
      const frames = new Map<string, File>();
      // Check every applicable size source before a sample or a batch costs money.
      const sizeReferences = sampleOnly && (page === 'size' || fullSet) ? next.sizes.map(spec => ({ id: spec.key, title: '尺寸原图', sourceId: spec.sourceIds[0] })) : queue.filter(item => item.kind === 'size').map(item => ({ id: item.id, title: item.title, sourceId: item.spec?.sourceIds[0] }));
      for (const item of sizeReferences) {
        if (!item.sourceId) throw new Error(`${item.title}缺少尺寸框架原图，已停止。`);
        frames.set(item.id, await readReference(`/api/files/${item.sourceId}`, item.title));
      }
      if (sampleOnly && firstSample.kind === 'size') {
        const file = frames.get(firstSample.spec?.key || '');
        if (!file) throw new Error('样稿缺少对应尺寸原图，请刷新核对。');
        frames.set(firstSample.id, file);
      }
      if (stop.current || !mounted.current) return;
      const backgroundCount = queue.filter(item => contexts.get(item.id)?.stage === 'size' && item.kind === 'main').length;
      const title = sampleOnly ? `本次只试做 1 张${firstStage === 'size' && firstSample.kind === 'main' ? '统一背景样稿' : '样稿'}` : `本次制作 ${queue.length} 张余图${backgroundCount ? '（含 1 张统一背景）' : ''}`;
      if (!window.confirm(`${title}，使用 ${settings.model === 'gpt-image-2' ? 'GPT Image 2' : 'GPT Image 2.5 Sunburst'}、2K。\n参考图发送至 RunningHub，按实际规则计费，当前无法预估总费用。\n${sampleOnly ? '生成后暂停，验收并点击继续后才会制作其余图片。' : '仅本次确认的余图会依次制作，已完成图片跳过。'}\n失败或状态不明将暂停，不自动重试。请保持页面打开。`)) { setMessage('已取消，未提交生图。'); return; }
      await runDetailBatch(queue, {
        stopped: () => stop.current || !mounted.current,
        submit: async (item: ProductionItem) => {
          if (!sampleOnly) {
            const gate = await json<{ generationId: string | null; review: string; taskStatus: string }>(`/api/production/${firstSample.id}`, { cache: 'no-store' });
            if (gate.generationId !== firstSample.generationId || gate.review !== 'accepted' || gate.taskStatus !== 'succeeded') throw new Error('样稿验收已变化，后续制作已停止，请刷新核对。');
          }
          const context = await json<{ planId: string; productId: string; generationId: string | null; kind: string }>(`/api/production/${item.id}`, { cache: 'no-store' });
          if (context.planId !== contexts.get(item.id)?.planId || context.productId !== next.product.id || context.kind !== item.kind || context.generationId !== item.generationId) throw new Error('制作状态已改变，请刷新核对，已停止后续提交。');
          if (stop.current || !mounted.current) throw new Error('已暂停。');
          const form = new FormData(); form.set('artwork', artFile); form.set('frame', item.kind === 'size' ? frames.get(item.id)! : sampleFile);
          const fields: Record<string, string> = { requestId: crypto.randomUUID(), productionItemId: item.id, artworkId: recipe.artworkId, frameId: recipe.frameId, colorId: recipe.colorId, artworkName: art.name, frameName: next.product.frameName, colorName: color.name, colorHex: color.color, model: settings.model, aspectRatio: item.kind === 'detail' ? '3:4' : '1:1', resolution: '2k', quality: settings.quality, intent: 'catalog', instruction: `只制作“${item.title}”，使用本套默认要求，沿用确认产品和统一风格。`, batchSettings: JSON.stringify({ propsMode: settings.propsMode, propsText: settings.propsText }) };
          fields.instruction += mainPropsBrief(item.kind, settings.propsMode, settings.propsText);
          if (!sampleOnly) { fields.batchSampleId = firstSample.id; fields.batchSampleGenerationId = firstSample.generationId!; fields.batchScope = fullSet ? 'full' : 'page'; }
          Object.entries(fields).forEach(([key, value]) => form.set(key, value));
          return json<GenerationTask>('/api/generate-preview', { method: 'POST', body: form });
        },
        poll: id => json<GenerationTask>(`/api/generations/${id}`, { cache: 'no-store' }), wait: () => new Promise(resolve => setTimeout(resolve, 12000)),
        progress: async (item, task) => { if (mounted.current) { setCurrent(`${queue.indexOf(item) + 1} / ${queue.length} · ${item.title} · ${generationLabels[task.status]}`); setMessage(''); if (['succeeded', 'failed', 'unknown'].includes(task.status)) await refresh(); } },
      });
      setMessage(stop.current ? '已暂停后续制作，已提交任务仍会运行。' : sampleOnly ? '样稿已生成，制作已暂停。请先查看、验收，再点击继续制作余图。' : '本套已生成，请查看结果；需要修改时在对应图片下调整。');
    } catch (error) { if (mounted.current) { setFailed(true); setMessage(error instanceof Error ? error.message : '制作已暂停，请核对任务记录。'); } }
    finally { try { await refresh(); } catch { /* Keep the request error visible. */ } lock.current = false; if (mounted.current) { setRunning(false); onBusy(false); setCurrent(''); } }
  }
  function sampleCard(item: ProductionItem, title: string) {
    if (!item.task?.url || item.task.status !== 'succeeded') return null;
    return <section className="batch-sample" aria-label={title}><a href={item.task.url} target="_blank" rel="noreferrer"><img src={item.task.url} alt={`${title} · ${item.title}`} /></a><div><strong>{title} · {item.title}</strong><p>{sampleApproved(item) ? `已验收；余图沿用这张样稿的 ${item.task.model === 'gpt-image-2' ? 'GPT Image 2' : item.task.model} 和画质设置。` : item.review === 'rework' ? '这张样稿需调整，请在图片下修改后重新验收。' : '先核对产品结构、图案与整体风格；确认后才制作余图。'}</p><a href={item.task.url} target="_blank" rel="noreferrer">查看样稿大图</a><button disabled={running || sampleApproved(item) || item.review === 'rework'} onClick={() => void acceptSample(item)}>{sampleApproved(item) ? '样稿已验收' : '认可样稿'}</button></div></section>;
  }
  return <section className="production-batch" aria-label="先试样稿，再制作余图">
    <div className="batch-heading"><div><h3>先试一张，再做全套</h3><p>先确认一张主图的风格，再制作主图、全部尺寸图和 12 页详情；已完成图片跳过。</p></div><button className="batch-primary" disabled={running || awaitingReview(fullSample)} onClick={() => void start(false, true, !sampleApproved(fullSample))}>{running ? '正在制作…' : awaitingReview(fullSample) ? '先验收主图样稿' : sampleApproved(fullSample) ? '继续制作全套余图' : '先试做一张主图'}</button></div>
    {fullSample && fullSample.id !== sample?.id && sampleCard(fullSample, '全套主图样稿')}
    <div className="batch-heading"><div><h3>{page === 'detail' ? '整套详情页' : page === 'size' ? '全部规格尺寸图' : '整套主图'}</h3><p>{plan ? `已生成 ${completed} / ${total} 张` : `${total} ${page === 'detail' ? '页' : '张'} · 已为你准备好`}</p></div><button className="batch-primary" disabled={running || awaitingReview(sample) || (sampleApproved(sample) && !remaining)} onClick={() => void start(false, false, !sampleApproved(sample))}>{running ? '制作中…' : awaitingReview(sample) ? '先验收样稿' : sampleApproved(sample) ? '继续生成剩余图片' : page === 'size' ? '先试做背景样稿' : `先试做一张${page === 'detail' ? '详情样稿' : '主图'}`}</button></div>
    {sample && sampleCard(sample, page === 'size' && sample.kind === 'main' ? '统一背景样稿' : '本套样稿')}
    {total > 0 && <progress aria-label="制作进度" value={completed} max={total} />}
    <fieldset disabled={running || settingsLocked} className="batch-settings"><legend>主图与尺寸图摆件布置</legend><label>摆放方式<select value={propsMode} onChange={event => setPropsMode(event.target.value as PropsMode)}><option value="auto">每个可摆放位置放一个（默认）</option><option value="none">不放摆件</option><option value="custom">填写我的摆件要求</option></select></label>{propsMode === 'custom' && <label>摆件要求<textarea value={propsText} maxLength={400} rows={3} placeholder="例如：各置物格放一个陶瓷摆件，简约自然。" onChange={event => setPropsText(event.target.value)} /></label>}<p>只放在现有台面、层板或置物格，不改变结构，不遮挡画芯和尺寸标注。</p></fieldset>
    <details className="batch-settings"><summary>出图设置 <span>{model === 'gpt-image-2' ? 'GPT Image 2' : 'GPT Image 2.5'} · 2K · {quality === 'low' ? '快速' : quality === 'high' ? '精细' : '标准'}</span></summary><label>生图模型<select disabled={running || settingsLocked} value={model} onChange={event => setModel(event.target.value)}><option value="gpt-image-2">GPT Image 2</option><option value="gpt-image-2.5-sunburst">GPT Image 2.5 Sunburst</option></select></label><label>画质<select disabled={running || settingsLocked} value={quality} onChange={event => setQuality(event.target.value)}><option value="low">快速</option><option value="medium">标准</option><option value="high">精细</option></select></label><p>整套统一：详情 3:4，主图和尺寸图 1:1，清晰度 2K。</p></details>
    {settingsLocked && <p className="batch-sample-note">余图沿用已保存样稿的设置。需要改变风格时，请调整样稿或按现有搭配开始新一套。</p>}
    <div className="product-actions">{sampleApproved(sample) && retry.length > 0 && <button disabled={running} onClick={() => void start(true, false, false)}>重做失败或已标记图片（{retry.length}）</button>}{running && <button onClick={() => { stop.current = true; setMessage('已要求暂停，当前图片完成后不再提交下一张。'); }}>暂停后续制作</button>}{page === 'detail' && plan && completed === total && total > 0 && <><button disabled={running || exporting} onClick={() => void exportDraft(true)}>预览完整长图</button><button disabled={running || exporting} onClick={() => void exportDraft()}>下载长图和切片</button></>}</div>
    {(message || current || savedFailure) && <p className={visibleError ? 'batch-error' : ''} role={visibleError ? 'alert' : 'status'}>{visibleError ? '制作暂停：' : ''}{message || current || savedFailure}</p>}
    <small>样稿验收后需再次点击继续；请保持页面打开，刷新不会自动提交或重复生成。</small>
    {preview && <dialog open className="publication-preview" aria-label="详情长图预览"><button onClick={() => setPreview('')}>关闭预览</button><button onClick={() => void fetch(preview).then(response => response.blob()).then(blob => downloadBlob(blob, '详情长图_待验收.png'))}>下载长图</button><img src={preview} alt="整套详情长图" /></dialog>}
  </section>;
}
