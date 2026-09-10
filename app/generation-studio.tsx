'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generationLabels, isActiveGeneration, type GenerationTask } from '../lib/generation-types';
import { studioIntents } from '../lib/studio-brief';

type Config = { configured: boolean; model: string; regions: { cn: boolean; international: boolean }; canSaveKey: boolean };

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
        const pending = tasksRef.current.filter((task) => isActiveGeneration(task.status));
        try {
          for (const task of pending) {
            if (!task.remoteTaskId) { await refresh(); continue; }
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
    if (!window.confirm('仅当你已在 RunningHub 核实这次请求没有创建任务时，才解除锁定。若任务已存在，请先联系管理员核对，避免再次扣费。确认没有创建任务？')) return;
    try {
      const response = await fetch(`/api/generations/${task.id}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmedNoTask: true }) });
      if (!response.ok) throw new Error('解除锁定没有完成，请稍后重试。');
      requestId.current = null; await refresh();
    } catch { setError('解除锁定没有完成，请稍后重试。'); }
  }

  return { config, configRevision, tasks, error, loading, submitting, paused, submit, resume, refresh, refreshConfig, resolveUnknown,
    busy: submitting || tasks.some((task) => isActiveGeneration(task.status) || task.status === 'unknown') };
}

export function RunningHubSettings({ config, onRefresh, region, busy, member = false }: { config: Config | null; onRefresh: () => void; region: 'cn' | 'international'; busy: boolean; member?: boolean }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const configured = Boolean(config?.regions?.[region]);
  async function save() {
    if (saving || busy) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/runninghub/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim() }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || '保存失败，请重试。');
      setApiKey(''); setMessage('已加密保存。尚未发起生图，接口权限与余额未验证。'); onRefresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请重试。'); }
    finally { setSaving(false); }
  }
  return <details className="rh-connection">
    <summary><span className="rh-monogram" aria-hidden="true">RH</span><span><strong>API 密钥配置</strong><small>{region === 'cn' ? '中国站 · runninghub.cn' : '国际站 · runninghub.ai'}</small></span><span className={configured ? 'rh-configured' : 'rh-unconfigured'}>{config ? configured ? '密钥已配置' : '点击配置密钥' : '检查配置中'}</span></summary>
    <div className="rh-connection-body"><p>{member ? '使用「消费级-会员」API Key 调用 AI 应用，在工作台内接收结果。不是网页登录，也不会改走企业级模型 API。' : '原有国际站模型接口独立配置，不能使用中国站会员 Key 代替。'}</p>
      {member && <p>会员 Key 可调用 AI 应用，不代表所有应用免费；额外模型费用、并发与额度以该应用的接口权益为准。</p>}
      {region === 'cn' ? <div className="rh-key-form"><label htmlFor="rh-api-key">消费级-会员 API Key<input id="rh-api-key" type="password" autoComplete="off" spellCheck={false} maxLength={512} value={apiKey} disabled={saving || busy || !config?.canSaveKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? '填写新密钥可替换当前配置' : '粘贴 RunningHub 中国站会员 Key'} /></label><button type="button" disabled={saving || busy || !config?.canSaveKey || apiKey.trim().length < 16} onClick={save}>{saving ? '正在安全保存…' : '加密保存密钥'}</button><small>密钥加密保存在服务端，仅供当前工作台账号使用；不会返回浏览器或写入图片记录。</small>{!config?.canSaveKey && <p>安全存储尚未准备好，请等待页面发布完成，或联系工作台管理员。</p>}<a href="https://www.runninghub.cn/enterprise-api/consumerApi" target="_blank" rel="noreferrer">前往官网获取 API Key ↗</a></div> : <p>沿用原有国际站服务端密钥。中国站密钥不会自动用于国际站，历史任务仍使用原站点查询。</p>}
      {message && <p role="status">{message}</p>}
      <p>配置存在不代表验证通过；模型权限及费用以 RunningHub 账户为准。</p>
      <div><button type="button" disabled={saving || busy} onClick={onRefresh}>重新检查配置</button></div>
    </div>
  </details>;
}

export function GenerationHistory({ tasks, loading, error, paused, onRefresh, onResolve, onReuse, delivery = false }: {
  tasks: GenerationTask[]; loading: boolean; error: string; paused: boolean; onRefresh: () => void;
  onResolve: (task: GenerationTask) => void; onReuse: (task: GenerationTask) => void; delivery?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const rows = tasks.filter((task) => {
    if (delivery && task.status !== 'succeeded') return false;
    if (!delivery && filter === 'active' && !isActiveGeneration(task.status)) return false;
    if (!delivery && filter === 'succeeded' && task.status !== 'succeeded') return false;
    if (!delivery && filter === 'attention' && !['failed', 'unknown'].includes(task.status)) return false;
    return `${task.name} ${task.recipe?.instruction || ''}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const compared = tasks.filter((task) => compareIds.includes(task.id) && task.url);
  return <section className="generation-history">
    <header><div><p className="eyebrow">{delivery ? 'GENERATED ASSETS' : 'RUNNINGHUB TASKS'}</p><h2>{delivery ? '生成结果' : '生成任务'}</h2><p>{delivery ? '已保存的组合效果图，可查看或下载。' : '显示实际提交记录；离开页面不会取消平台任务。'}</p></div><button className="ghost-button" onClick={onRefresh}>{paused ? '恢复查询' : '刷新记录'}</button></header>
    {(error || paused) && <p className="generation-warning" role="status">{error || '已暂停自动查询。点击「恢复查询」继续，不会重新扣费。'}</p>}
    <div className="generation-stats"><span>全部 <b>{tasks.length}</b></span><span>进行中 <b>{tasks.filter((task) => isActiveGeneration(task.status)).length}</b></span><span>已完成 <b>{tasks.filter((task) => task.status === 'succeeded').length}</b></span></div>
    <div className="history-toolbar"><label className="history-search"><span>查找记录</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索图案、框架或制作要求" /></label>{!delivery && <div className="history-filters" aria-label="按任务状态筛选">{[['all', '全部'], ['active', '进行中'], ['succeeded', '已完成'], ['attention', '待处理']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>}</div>
    {compared.length > 0 && <section className="result-comparison" aria-label="效果图对比"><header><strong>效果对比 · {compared.length}/2</strong><button onClick={() => setCompareIds([])}>结束对比</button></header><div>{compared.map((task) => <figure key={task.id}><a href={task.url!} target="_blank" rel="noreferrer"><img src={task.url!} alt={task.name} /></a><figcaption><strong>{task.name}</strong><span>{task.recipe ? studioIntents.find((item) => item.id === task.recipe?.intent)?.name : '组合效果图'}</span></figcaption></figure>)}{compared.length === 1 && <p>再勾选一张已完成的图片，即可并排比较。</p>}</div></section>}
    {loading ? <p className="generation-empty">正在读取任务记录…</p> : rows.length === 0 ? <div className="generation-empty"><strong>{query || (!delivery && filter !== 'all') ? '没有符合条件的记录' : delivery ? '还没有生成结果' : '还没有提交任务'}</strong><p>{query || (!delivery && filter !== 'all') ? '试试其他关键词或任务状态。' : '选好图案、框架和颜色后，在新品页生成第一张组合效果图。'}</p></div> :
      <div className="generation-cards">{rows.map((task) => <article className="generation-card" key={task.id}>
        <div className="generation-card-image">{task.url ? <a href={task.url} target="_blank" rel="noreferrer"><img src={task.url} alt={task.name} loading="lazy" /></a> : <span className={isActiveGeneration(task.status) ? 'task-waiting' : ''}>{generationLabels[task.status]}</span>}<span className={`task-badge task-${task.status}`}>{generationLabels[task.status]}</span></div>
        <div className="generation-card-info"><h3>{task.name}</h3><p>{task.recipe ? studioIntents.find((item) => item.id === task.recipe?.intent)?.name : '组合效果图'} · {task.aspectRatio === 'auto' ? '自动画幅' : task.aspectRatio} · {task.resolution.toUpperCase()}</p><time>{new Date(task.createdAt).toLocaleString('zh-CN')}</time>
          {task.error && <p className="generation-error">{task.error}</p>}
          {task.recipe && <details className="saved-brief"><summary>制作要求</summary><p>{task.recipe.instruction || '使用默认制作要求'}</p></details>}
          {task.remoteTaskId && <details><summary>平台任务编号</summary><code>{task.remoteTaskId}</code></details>}
          <footer>{task.url ? <><a href={task.url} target="_blank" rel="noreferrer">查看原图 ↗</a><a href={`${task.url}?download=1`} download>下载图片 ↓</a></> : task.status === 'unknown' ? <button onClick={() => onResolve(task)}>已核实未创建任务，解除锁定</button> : <span>{task.status === 'failed' ? '可返回新品页调整后重新提交' : '状态自动更新，无需重复提交'}</span>}</footer>
          {(task.recipe || task.url) && <div className="history-reuse-row">{task.recipe && <button disabled={isActiveGeneration(task.status) || task.status === 'unknown'} onClick={() => onReuse(task)}>使用这组设置</button>}{task.url && <label><input type="checkbox" checked={compareIds.includes(task.id)} disabled={compareIds.length === 2 && !compareIds.includes(task.id)} onChange={(event) => setCompareIds((ids) => event.target.checked ? [...ids.filter((id) => id !== task.id), task.id].slice(0, 2) : ids.filter((id) => id !== task.id))} />加入对比</label>}</div>}
        </div>
      </article>)}</div>}
  </section>;
}
