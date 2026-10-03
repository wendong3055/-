'use client';
// The Key saved here is the source of the international runninghub.ai key: the
// settings section below copies it into the international snapshot once the
// owner confirms it came from .ai. The standalone creator surface and every
// 中国站 (.cn) call were removed, so no China-site node is involved.
import { useCallback, useEffect, useRef, useState } from 'react';
import './rh-creator.css';
// Saving a key is refused while a task is active, so that gate stays visible.
const activeCreatorStatuses = ['uploading', 'submitting', 'queued', 'running', 'saving', 'unknown'];
async function api(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const payload = await response.json() as Record<string, unknown>;
  if (!payload || typeof payload !== 'object') throw new Error('返回内容无效，请刷新记录。');
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '请求暂时失败，请稍后重试。');
  return payload;
}
export default function RhCreator({ onSaved }: { onSaved?: () => void } = {}) {
  const [configured, setConfigured] = useState(false);
  const [internationalConfigured, setInternationalConfigured] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [key, setKey] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [activeTask, setActiveTask] = useState(false);
  const guard = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const payload = await api('/api/rh-creator');
      setConfigured(Boolean(payload.key?.configured));
      setInternationalConfigured(Boolean(payload.key?.internationalConfigured));
      setCanSave(Boolean(payload.key?.canSave));
      setActiveTask(Array.isArray(payload.tasks) && payload.tasks.some((task: { status?: string }) => activeCreatorStatuses.includes(task?.status || '')));
      setNotice('');
    } catch (error) { setNotice((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function saveKey() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setNotice('');
    try {
      await api('/api/rh-creator', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'key', apiKey: key }) });
      setKey(''); await refresh();
      setNotice('密钥已保存。请继续下方第 2 步，启用这份密钥。');
      onSaved?.();
      setShowKey(false);
    } catch (error) { setNotice((error as Error).message); }
    finally { guard.current = false; setBusy(false); }
  }
  const blocked = busy || activeTask;
  return <div className="rh-creator" aria-label="RunningHub 国际站 Key">
    <section className="rh-connect">
      <div><h3>RunningHub 国际站</h3><span className="rh-state">{loading ? '读取中…' : configured ? '密钥已保存' : '还未保存密钥'}</span></div>
      <p>{internationalConfigured ? '已有密钥接入制作。更换密钥后，请重新完成第 2 步。' : '保存密钥后，请继续下方第 2 步。'}</p>
      <p>API Key 就是允许工作台使用你账户生图的连接密钥。</p>
      {(!configured || showKey) && <>
        <ol><li><a href="https://www.runninghub.ai/" target="_blank" rel="noreferrer">打开 RunningHub 国际站</a>，登录后创建 API Key。</li><li>复制 Key，粘贴到下面并保存。不要发在聊天里。</li></ol>
        <label>RunningHub 国际站 API Key<input type="password" autoComplete="off" spellCheck={false} value={key} maxLength={512} onChange={(event) => setKey(event.target.value)} placeholder="在此粘贴 Key" disabled={blocked} /></label>
        <button className="rh-primary" disabled={!canSave || key.trim().length < 16 || blocked} onClick={() => void saveKey()}>{busy ? '正在保存…' : '保存密钥，继续第 2 步'}</button>
        {!canSave && !loading && <p>安全存储尚未就绪，请联系工作台管理员。</p>}
      </>}
      <div className="rh-actions">
        {configured && <button disabled={blocked} onClick={() => setShowKey(!showKey)}>{showKey ? '收起' : '更换密钥'}</button>}
        <button disabled={busy} onClick={() => void refresh()}>刷新状态</button>
      </div>
      {activeTask && <p role="status">当前有任务进行中或待核对，完成后才能更换密钥。</p>}
      <small>密钥加密保存。保存不会生图，也不会校验余额；可在第 2 步检查连接。</small>
    </section>
    {notice && <p className="rh-notice" role="status">{notice}</p>}
  </div>;
}
