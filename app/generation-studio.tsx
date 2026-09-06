'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generationLabels, isActiveGeneration, type GenerationTask } from '../lib/generation-types';

type Config = { configured: boolean; model: string; region: string };

export function useGenerations() {
  const [config, setConfig] = useState<Config | null>(null);
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

  return { config, tasks, error, loading, submitting, paused, submit, resume, refresh, refreshConfig, resolveUnknown,
    busy: submitting || tasks.some((task) => isActiveGeneration(task.status) || task.status === 'unknown') };
}

export function RunningHubSettings({ config, onRefresh }: { config: Config | null; onRefresh: () => void }) {
  return <details className="rh-connection">
    <summary><span className="rh-monogram" aria-hidden="true">RH</span><span><strong>RunningHub</strong><small>GPT Image 2 · 图生图</small></span><span className={config?.configured ? 'rh-configured' : 'rh-unconfigured'}>{config ? config.configured ? '密钥已配置' : '待配置' : '检查配置中'}</span></summary>
    <div className="rh-connection-body"><p>使用 RunningHub 国际站标准模型接口，不需要工作流 ID。密钥只在服务端使用。</p>
      {!config?.configured && <p>在站点的服务端环境变量中添加 <code>RUNNINGHUB_API_KEY</code>，设为密钥并发布后生效。不要将密钥写进提示词或聊天。</p>}
      <p>配置存在不代表验证通过；模型权限及费用以 RunningHub 账户为准。</p>
      <div><a href="https://www.runninghub.ai/runninghub-api-doc-en/api-448969336" target="_blank" rel="noreferrer">接口说明 ↗</a><button type="button" onClick={onRefresh}>重新检查配置</button></div>
    </div>
  </details>;
}

export function GenerationHistory({ tasks, loading, error, paused, onRefresh, onResolve, delivery = false }: {
  tasks: GenerationTask[]; loading: boolean; error: string; paused: boolean; onRefresh: () => void;
  onResolve: (task: GenerationTask) => void; delivery?: boolean;
}) {
  const rows = delivery ? tasks.filter((task) => task.status === 'succeeded') : tasks;
  return <section className="generation-history">
    <header><div><p className="eyebrow">{delivery ? 'GENERATED ASSETS' : 'RUNNINGHUB TASKS'}</p><h2>{delivery ? '生成结果' : '生成任务'}</h2><p>{delivery ? '已保存的组合效果图，可查看或下载。' : '显示实际提交记录；离开页面不会取消平台任务。'}</p></div><button className="ghost-button" onClick={onRefresh}>{paused ? '恢复查询' : '刷新记录'}</button></header>
    {(error || paused) && <p className="generation-warning" role="status">{error || '已暂停自动查询。点击「恢复查询」继续，不会重新扣费。'}</p>}
    <div className="generation-stats"><span>全部 <b>{tasks.length}</b></span><span>进行中 <b>{tasks.filter((task) => isActiveGeneration(task.status)).length}</b></span><span>已完成 <b>{tasks.filter((task) => task.status === 'succeeded').length}</b></span></div>
    {loading ? <p className="generation-empty">正在读取任务记录…</p> : rows.length === 0 ? <div className="generation-empty"><strong>{delivery ? '还没有生成结果' : '还没有提交任务'}</strong><p>选好图案、框架和颜色后，在新品页生成第一张组合效果图。</p></div> :
      <div className="generation-cards">{rows.map((task) => <article className="generation-card" key={task.id}>
        <div className="generation-card-image">{task.url ? <a href={task.url} target="_blank" rel="noreferrer"><img src={task.url} alt={task.name} loading="lazy" /></a> : <span className={isActiveGeneration(task.status) ? 'task-waiting' : ''}>{generationLabels[task.status]}</span>}<span className={`task-badge task-${task.status}`}>{generationLabels[task.status]}</span></div>
        <div className="generation-card-info"><h3>{task.name}</h3><p>{task.model} · {task.aspectRatio === 'auto' ? '自动画幅' : task.aspectRatio} · {task.resolution.toUpperCase()}</p><time>{new Date(task.createdAt).toLocaleString('zh-CN')}</time>
          {task.error && <p className="generation-error">{task.error}</p>}
          {task.remoteTaskId && <details><summary>平台任务编号</summary><code>{task.remoteTaskId}</code></details>}
          <footer>{task.url ? <><a href={task.url} target="_blank" rel="noreferrer">查看原图 ↗</a><a href={`${task.url}?download=1`} download>下载图片 ↓</a></> : task.status === 'unknown' ? <button onClick={() => onResolve(task)}>已核实未创建任务，解除锁定</button> : <span>{task.status === 'failed' ? '可返回新品页调整后重新提交' : '状态自动更新，无需重复提交'}</span>}</footer>
        </div>
      </article>)}</div>}
  </section>;
}
