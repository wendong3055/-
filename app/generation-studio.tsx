'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generationLabels, isActiveGeneration, type GenerationTask } from '../lib/generation-types';
import { studioIntents } from '../lib/studio-brief';
import { filterGenerationHistory, historyModelName, type HistoryRange, type HistoryStatus } from '../lib/generation-history-view';

type Config = { configured: boolean; model: string; regions: { cn: boolean; international: boolean }; canSaveKey: boolean; internationalSaved?: boolean };

export function useGenerations() {
  const [config, setConfig] = useState<Config | null>(null);
  const [configRevision, setConfigRevision] = useState(0);
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paused, setPaused] = useState(false);
  const submissionLock = useRef(false);
  const requestId = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const tasksRef = useRef(tasks);
  const pollingStarted = useRef(Date.now());
  const favoriteLock = useRef(new Set<string>());
  const [favoriteSaving, setFavoriteSaving] = useState<string[]>([]);
  tasksRef.current = tasks;
  useEffect(() => {
    if (requestId.current && tasks.some((task) => task.id === requestId.current && task.status === 'failed')) requestId.current = null;
  }, [tasks]);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const response = await fetch('/api/generations', { cache: 'no-store' });
      const payload = await response.json() as GenerationTask[] | { error?: string };
      if (!response.ok || !Array.isArray(payload)) throw new Error(('error' in payload && payload.error) || '任务记录加载失败。');
      if (sequence === refreshSequence.current) { setTasks(payload); setError(''); }
    } catch (cause) { if (sequence === refreshSequence.current) setError(cause instanceof Error ? cause.message : '任务记录加载失败。'); }
    finally { if (sequence === refreshSequence.current) setLoading(false); }
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/runninghub/config', { cache: 'no-store' });
      const payload = await response.json() as Config & { error?: string };
      if (!response.ok) throw new Error(payload.error || '无法读取接口配置。');
      setConfig(payload);
      setConfigRevision((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取接口配置。'); }
  }, []);

  useEffect(() => { void refresh(); void refreshConfig(); }, [refresh, refreshConfig]);
  useEffect(() => {
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refresh]);

  const resume = useCallback(() => {
    pollingStarted.current = Date.now(); setPaused(false); void refresh();
  }, [refresh]);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (Date.now() - pollingStarted.current > 20 * 60_000) { setPaused(true); return; }
      if (document.visibilityState !== 'hidden') {
        const pending = tasksRef.current.filter((task) => isActiveGeneration(task.status) || task.model.startsWith('custom-') && task.status === 'unknown');
        try {
          for (const task of pending) {
            if (!task.remoteTaskId && !task.model.startsWith('custom-')) { await refresh(); continue; }
            const response = await fetch(`/api/generations/${task.id}`, { cache: 'no-store' });
            const payload = await response.json() as GenerationTask & { error?: string };
            if (!response.ok) throw new Error(payload.error || '状态查询中断。');
            if (!cancelled) setTasks((current) => current.map((item) => item.id === payload.id ? payload : item));
          }
        } catch { if (!cancelled) setError('查询暂时中断，稍后自动重试。已提交的任务不会重复生成。'); }
      }
      if (!cancelled) timer = setTimeout(poll, 12_000);
    }
    timer = setTimeout(poll, 3_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [paused, refresh]);

  async function submit(form: FormData) {
    if (submissionLock.current) throw new Error('正在提交，请勿重复点击。');
    submissionLock.current = true; setSubmitting(true);
    requestId.current ??= crypto.randomUUID();
    form.set('requestId', requestId.current);
    try {
      const response = await fetch('/api/generate-preview', { method: 'POST', body: form });
      const payload = await response.json() as GenerationTask & { error?: string; uncertain?: boolean };
      if (!response.ok) {
        // Retain the id after an ambiguous outcome. Reusing it can never create a second task.
        if (!payload.uncertain && response.status < 500) requestId.current = null;
        throw new Error(payload.error || '任务未提交，请先查看任务记录。');
      }
      const task = payload as GenerationTask;
      refreshSequence.current++;
      requestId.current = null;
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      pollingStarted.current = Date.now(); setPaused(false);
      return task;
    } finally { submissionLock.current = false; setSubmitting(false); void refresh(); }
  }

  async function resolveUnknown(task: GenerationTask) {
    if (!window.confirm('仅当你已在所选服务商后台核实这次请求没有创建任务或生成图片时，才解除锁定。若已有结果，请先联系管理员核对，避免再次扣费。确认没有创建任务或图片？')) return;
    try {
      const response = await fetch(`/api/generations/${task.id}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmedNoTask: true }) });
      if (!response.ok) throw new Error('解除锁定没有完成，请稍后重试。');
      requestId.current = null; await refresh();
    } catch { setError('解除锁定没有完成，请稍后重试。'); }
  }

  async function toggleFavorite(task: GenerationTask) {
    if (favoriteLock.current.has(task.id)) return;
    favoriteLock.current.add(task.id); setFavoriteSaving([...favoriteLock.current]);
    try {
      const response = await fetch(`/api/generations/${encodeURIComponent(task.id)}/favorite`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ favorite: !task.favorite }),
      });
      const result = await response.json() as { favorite: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || '收藏未保存，请重试。');
      refreshSequence.current++;
      setTasks(current => current.map(t => t.id === task.id ? { ...t, favorite: result.favorite } : t));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '收藏未保存，请重试。'); }
    finally { favoriteLock.current.delete(task.id); setFavoriteSaving([...favoriteLock.current]); }
  }

  return { config, configRevision, tasks, error, loading, submitting, paused, submit, resume, refresh, refreshConfig, resolveUnknown, toggleFavorite, favoriteSaving,
    busy: submitting || tasks.some((task) => isActiveGeneration(task.status) || task.status === 'unknown') };
}

export function RunningHubSettings({ config, onRefresh, busy, expanded = false }: { config: Config | null; onRefresh: () => void; busy: boolean; expanded?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmedInternational, setConfirmedInternational] = useState(false);
  const [message, setMessage] = useState('');
  const configured = Boolean(config?.regions?.international);
  async function connectInternational() {
    if (!confirmedInternational || busy || saving || checking) return;
    setSaving(true); setMessage('正在连接已保存的国际站 Key…');
    try {
      const response = await fetch('/api/runninghub/config', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'connect-saved-international',confirmedInternational:true}) });
      const result = await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || '连接没有保存。');
      setMessage('已将保存的国际站 Key 接入新品制作。之后的国际站任务使用此连接，旧任务不变。尚未提交生图。');
      setConfirmedInternational(false); onRefresh();
    } catch(error) { setMessage(error instanceof Error ? error.message : '连接未完成。'); }
    finally { setSaving(false); }
  }
  async function check() {
    if (checking || saving || busy) return;
    setChecking(true); setMessage('正在检查连接与测试文件上传，不会提交生图…');
    try {
      const response = await fetch('/api/runninghub/check?region=international', { method: 'POST' });
      const result = await response.json() as { message?: string; error?: string };
      setMessage(result.error || result.message || '检查未完成。');
    } catch { setMessage('连接检查中断。没有提交生图。'); }
    finally { setChecking(false); }
  }
  return <details className="rh-connection" open={expanded || undefined}>
    <summary><span className="rh-monogram" aria-hidden="true">RH</span><span><strong>启用并检查连接</strong><small>RunningHub 国际站</small></span><span className={configured ? 'rh-configured' : 'rh-unconfigured'}>{config ? configured ? '连接已配置' : '尚未连接' : '正在读取'}</span></summary>
    <div className="rh-connection-body">
      <p>{config?.internationalSaved ? '已启用保存的国际站密钥。更换密钥后，需要在这里再次启用。' : configured ? '当前已有连接配置。如果要使用第 1 步保存的新密钥，请在这里启用。' : '完成第 1 步后，在下面确认并启用密钥。'}</p>
      {message && <p role="status">{message}</p>}
      <div><label><input type="checkbox" checked={confirmedInternational} onChange={e=>setConfirmedInternational(e.target.checked)} disabled={busy || saving || checking} />我确认密钥来自 runninghub.ai 国际站</label><button type="button" disabled={!confirmedInternational || busy || saving || checking} onClick={connectInternational}>{saving ? '正在启用…' : '启用已保存的密钥'}</button><small>启用后供后续任务使用，历史图片与任务不变。</small></div>
      <p>配置存在不代表验证通过；模型权限及费用以 RunningHub 账户为准。</p>
      <div><button type="button" disabled={saving || busy || checking} onClick={onRefresh}>重新检查配置</button><button type="button" disabled={saving || busy || checking || !configured} onClick={check}>{checking ? '连接检查中…' : '检查连接（不生图）'}</button></div>
    </div>
  </details>;
}

export function GenerationHistory({ tasks, loading, error, paused, onRefresh, onResolve, onReuse, onFavorite, favoriteSaving = [], delivery = false }: {
  tasks: GenerationTask[]; loading: boolean; error: string; paused: boolean; onRefresh: () => void;
  onResolve: (task: GenerationTask) => void; onReuse: (task: GenerationTask) => void; delivery?: boolean;
  onFavorite?: (task: GenerationTask) => void; favoriteSaving?: string[];
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryStatus>('all');
  const [range, setRange] = useState<HistoryRange>('all');
  const [model, setModel] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const rows = filterGenerationHistory(tasks, { query, status: delivery ? 'succeeded' : filter, range, model, favoritesOnly, delivery });
  const pageSize = 24, pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const models = [...new Set(tasks.map(task => task.model))];
  const favoriteCount = tasks.filter(task => task.favorite && task.status === 'succeeded' && task.url).length;
  const filtered = Boolean(query.trim() || (!delivery && filter !== 'all') || range !== 'all' || model || favoritesOnly);
  function clearFilters() { setQuery(''); setFilter('all'); setRange('all'); setModel(''); setFavoritesOnly(false); setPage(1); }
  const compared = tasks.filter((task) => compareIds.includes(task.id) && task.url);
  return <section className="generation-history">
    <header><div><p className="eyebrow">{delivery ? 'GENERATED ASSETS' : 'GENERATION TASKS'}</p><h2>{delivery ? '生成结果' : '生成任务'}</h2><p>{delivery ? '已保存的组合效果图，可查看或下载。' : '显示实际提交记录；离开页面不会取消平台任务。'}</p></div><button className="ghost-button" onClick={onRefresh}>{paused ? '恢复查询' : '刷新记录'}</button></header>
    {(error || paused) && <p className="generation-warning" role="status">{error || '已暂停自动查询。点击「恢复查询」继续，不会重新扣费。'}</p>}
    <div className="generation-stats"><span>全部 <b>{tasks.length}</b></span><span>进行中 <b>{tasks.filter((task) => isActiveGeneration(task.status)).length}</b></span><span>已完成 <b>{tasks.filter((task) => task.status === 'succeeded').length}</b></span></div>
    <div className="history-toolbar">
      <label className="history-search"><span>查找记录</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="图案、框架、制作要求或任务编号" /></label>
      <label className="history-select"><span>时间范围</span><select value={range} onChange={event => { setRange(event.target.value as HistoryRange); setPage(1); }}><option value="all">全部时间</option><option value="7">近 7 天</option><option value="30">近 30 天</option></select></label>
      <label className="history-select"><span>生图模型</span><select value={model} onChange={event => { setModel(event.target.value); setPage(1); }}><option value="">全部模型</option>{models.map(id => <option key={id} value={id}>{historyModelName(id)}</option>)}</select></label>
      <label className="history-favorite-filter"><input type="checkbox" checked={favoritesOnly} onChange={event => { setFavoritesOnly(event.target.checked); setPage(1); }} />只看收藏 <span>{favoriteCount}</span></label>
    </div>
    <div className="history-filter-row">{!delivery && <div className="history-filters" aria-label="按任务状态筛选">{([['all', '全部'], ['active', '进行中'], ['succeeded', '已完成'], ['attention', '待处理']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{label}</button>)}</div>}{filtered && <button className="history-clear" onClick={clearFilters}>清空筛选</button>}</div>
    {!loading && <p className="history-result-count" role="status">{filtered ? `找到 ${rows.length} 条` : `当前载入 ${tasks.length} 条记录`}{rows.length > 0 ? ` · 显示 ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rows.length)} 条` : ''}</p>}
    {compared.length > 0 && <section className="result-comparison" aria-label="效果图对比"><header><strong>效果对比 · {compared.length}/2</strong><button onClick={() => setCompareIds([])}>结束对比</button></header><div>{compared.map((task) => <figure key={task.id}><a href={task.url!} target="_blank" rel="noreferrer"><img src={task.url!} alt={task.name} /></a><figcaption><strong>{task.name}</strong><span>{task.recipe ? studioIntents.find((item) => item.id === task.recipe?.intent)?.name : '组合效果图'}</span></figcaption></figure>)}{compared.length === 1 && <p>再勾选一张已完成的图片，即可并排比较。</p>}</div></section>}
    {loading ? <p className="generation-empty">正在读取任务记录…</p> : rows.length === 0 ? <div className="generation-empty"><strong>{filtered ? '没有符合条件的记录' : delivery ? '还没有生成结果' : '还没有提交任务'}</strong><p>{filtered ? '试试其他关键词，或清空筛选查看已载入的记录。' : '选好图案、框架和颜色后，在新品页生成第一张组合效果图。'}</p>{filtered && <button className="ghost-button" onClick={clearFilters}>清空筛选</button>}</div> :
      <div className="generation-cards">{visibleRows.map((task) => <article className="generation-card" key={task.id}>
        <div className="generation-card-image">{task.url ? <a href={task.url} target="_blank" rel="noreferrer"><img src={task.url} alt={task.name} loading="lazy" /></a> : <span className={isActiveGeneration(task.status) ? 'task-waiting' : ''}>{generationLabels[task.status]}</span>}<span className={`task-badge task-${task.status}`}>{generationLabels[task.status]}</span></div>
        <div className="generation-card-info"><h3>{task.favorite && <span className="history-star" aria-label="已收藏">★ </span>}{task.name}</h3><p>{task.recipe ? studioIntents.find((item) => item.id === task.recipe?.intent)?.name : '组合效果图'} · {task.aspectRatio === 'auto' ? '自动画幅' : task.aspectRatio} · {task.resolution.toUpperCase()} · {historyModelName(task.model)}</p><time>{new Date(task.createdAt).toLocaleString('zh-CN')}</time>
          {task.error && <p className="generation-error">{task.error}</p>}
          {task.recipe && <details className="saved-brief"><summary>制作要求</summary><p>{task.recipe.instruction || '使用默认制作要求'}</p></details>}
          {task.remoteTaskId && <details><summary>平台任务编号</summary><code>{task.remoteTaskId}</code></details>}
          <footer>{task.url ? <><a href={task.url} target="_blank" rel="noreferrer">查看原图 ↗</a><a href={`${task.url}?download=1`} download>下载图片 ↓</a></> : task.status === 'unknown' ? <button onClick={() => onResolve(task)}>已核实未创建任务，解除锁定</button> : <span>{task.status === 'failed' ? '可返回新品页调整后重新提交' : '状态自动更新，无需重复提交'}</span>}</footer>
          {(task.recipe || task.url) && <div className="history-reuse-row">{onFavorite && task.status === 'succeeded' && task.url && <button type="button" aria-pressed={Boolean(task.favorite)} disabled={favoriteSaving.includes(task.id)} onClick={() => onFavorite(task)}>{favoriteSaving.includes(task.id) ? '正在保存…' : task.favorite ? '★ 已收藏' : '☆ 收藏'}</button>}{task.recipe && <button disabled={isActiveGeneration(task.status) || task.status === 'unknown'} onClick={() => onReuse(task)}>使用这组设置</button>}{task.url && <label><input type="checkbox" checked={compareIds.includes(task.id)} disabled={compareIds.length === 2 && !compareIds.includes(task.id)} onChange={(event) => setCompareIds((ids) => event.target.checked ? [...ids.filter((id) => id !== task.id), task.id].slice(0, 2) : ids.filter((id) => id !== task.id))} />加入对比</label>}</div>}
        </div>
      </article>)}</div>}
    {!loading && pageCount > 1 && <nav className="history-pagination" aria-label="生成记录翻页"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>上一页</button><span>第 {currentPage} / {pageCount} 页</span><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button></nav>}
  </section>;
}
