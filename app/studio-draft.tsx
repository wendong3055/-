'use client';
import { useEffect, useRef, useState } from 'react';
import { parseStudioDraft, type SavedStudioDraft, type StudioDraft } from '../lib/studio-draft';

type Phase = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';
function savedDraft(value: unknown): SavedStudioDraft | null {
  if (value === null) return null;
  const v = value as SavedStudioDraft | undefined;
  const data = parseStudioDraft(v?.data);
  if (!data || !Number.isSafeInteger(v?.revision) || v!.revision < 1 || !Number.isFinite(v?.updatedAt)) throw new Error('草稿返回内容无效，请重试读取。');
  return { data, revision: v!.revision, updatedAt: v!.updatedAt };
}

export function useStudioDraft(enabled: boolean, snapshot: StudioDraft) {
  const control = useRef({ loaded:false, reading:false, writing:false, revision:0, signature:'', phase:'idle' as Phase, error:'', pending:null as SavedStudioDraft|null, savedAt:0 });
  const latest = useRef<StudioDraft | null>(null), mounted = useRef(true);
  const [tick, update] = useState(0);
  if (enabled && parseStudioDraft(snapshot)) latest.current = snapshot;
  const signature = JSON.stringify(snapshot);
  function notify() { if (mounted.current) update(value => value + 1); }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function read() {
    const c = control.current;
    if (c.reading || new URLSearchParams(window.location.search).has('production')) return;
    const baseline = JSON.stringify(latest.current);
    c.reading = true; c.phase = 'loading'; c.error = ''; notify();
    try {
      const response = await fetch('/api/studio-draft',{cache:'no-store'});
      const body = await response.json() as {draft?:unknown;error?:string};
      if (!body || typeof body !== 'object') throw new Error('草稿返回内容无效，请重试。');
      if (!response.ok) throw new Error(body.error || '上次的编辑暂时无法读取。');
      const draft = savedDraft(body.draft);
      c.loaded = true; c.revision = draft?.revision || 0; c.pending = draft;
      c.signature = draft ? JSON.stringify(draft.data) : baseline;
      c.savedAt = draft?.updatedAt || 0; c.phase = draft ? 'saved' : 'idle';
    } catch (error) { c.phase = 'error'; c.error = error instanceof Error ? error.message : '草稿读取失败。'; }
    finally { c.reading = false; notify(); }
  }
  async function save() {
    const c = control.current, data = latest.current;
    if (!c.loaded || !data || c.writing || c.pending || c.error || JSON.stringify(data) === c.signature) return;
    c.writing = true; c.phase = 'saving'; notify();
    try {
      const response = await fetch('/api/studio-draft',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({data,baseRevision:c.revision}),keepalive:true});
      const body = await response.json() as {draft?:unknown;error?:string};
      if (!body || typeof body !== 'object') throw new Error('未收到保存结果，请重试。');
      if (response.status === 409) {
        const draft = savedDraft(body.draft);
        if (!draft) throw new Error('草稿版本变化，请重新打开页面读取。');
        c.pending = draft; c.revision = draft.revision; c.signature = JSON.stringify(draft.data); c.savedAt = draft.updatedAt; c.phase = 'conflict';
      } else {
        if (!response.ok) throw new Error(body.error || '当前编辑没有保存，请重试。');
        const draft = savedDraft(body.draft);
        if (!draft) throw new Error('未收到保存结果，请重试。');
        c.revision = draft.revision; c.signature = JSON.stringify(draft.data); c.savedAt = draft.updatedAt; c.phase = 'saved';
      }
    } catch (error) { c.phase = 'error'; c.error = error instanceof Error ? error.message : '当前编辑没有保存，请保持页面打开并重试。'; }
    finally {
      c.writing = false; notify();
      // Finish edits made during the request, including when navigation already
      // left the editor. `latest` retains only the last eligible general draft.
      if (!c.error && !c.pending && latest.current && JSON.stringify(latest.current) !== c.signature) void save();
    }
  }
  useEffect(() => { if (enabled && !control.current.loaded && !control.current.reading && !control.current.error) void read(); }, [enabled]);
  useEffect(() => {
    const c = control.current;
    if (!enabled || !c.loaded || c.pending || c.writing || c.error || signature === c.signature) return;
    const timer = window.setTimeout(() => void save(), 500);
    return () => window.clearTimeout(timer);
  }, [enabled, signature, tick]);
  useEffect(() => {
    if (!enabled) return;
    return () => { void save(); };
  }, [enabled]);
  useEffect(() => {
    const flush = () => { void save(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide',flush); document.addEventListener('visibilitychange',visibility);
    return () => { window.removeEventListener('pagehide',flush); document.removeEventListener('visibilitychange',visibility); };
  }, []);
  function accept() { const c=control.current; c.pending=null; c.error=''; c.phase='saved'; notify(); }
  function retry() { const c=control.current; c.error=''; c.phase='idle'; if (!c.loaded) void read(); else notify(); }
  const c=control.current;
  return { pending:c.pending, phase:c.phase, error:c.error, savedAt:c.savedAt, dirty:c.loaded && !c.pending && signature!==c.signature, accept, retry };
}

export function StudioDraftBar({ draft, busy, restoreIssue, onRestore, onUseCurrent, onTextOnly }: {
  draft: ReturnType<typeof useStudioDraft>; busy:boolean; restoreIssue:string;
  onRestore:()=>void; onUseCurrent:()=>void; onTextOnly:()=>void;
}) {
  const time=draft.savedAt ? new Date(draft.savedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  return <section className={`studio-draft-bar ${draft.pending || draft.error ? 'draft-expanded' : ''}`} aria-label="编辑草稿">
    <div role="status"><strong>{draft.pending ? draft.phase==='conflict' ? '另一处保存了新编辑' : '可以继续上次的编辑' : draft.error ? '当前编辑尚未保存' : draft.phase==='loading' ? '正在读取上次的编辑…' : draft.phase==='saving' || draft.dirty ? '正在保存编辑…' : draft.savedAt ? '编辑已保存到账号' : '修改后会自动保存编辑'}</strong><span>{draft.pending ? `${time} · 恢复搭配和文字，不会自动生图。` : draft.error || (draft.savedAt ? `${time} · 图案、要求和出图设置` : '仅保存制作一张图的编辑内容。')}</span></div>
    {draft.pending && <><div className="draft-actions"><button disabled={busy} onClick={onRestore}>继续上次编辑</button><button disabled={busy} onClick={onUseCurrent}>{draft.phase==='conflict' ? '保存本页这份编辑' : '使用当前搭配'}</button>{restoreIssue && <button disabled={busy} onClick={onTextOnly}>只恢复文字要求</button>}</div>{restoreIssue && <p className="draft-issue" role="alert">{restoreIssue}</p>}<details><summary>查看上次的文字要求</summary><p>{draft.pending.data.instruction || '使用默认制作要求'}</p></details></>}
    {draft.error && <button disabled={busy} onClick={draft.retry}>重试保存 / 读取</button>}
  </section>;
}
