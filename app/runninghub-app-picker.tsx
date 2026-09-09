'use client';

import { useEffect, useState } from 'react';
import { appFromLink, runningHubAppsSource, verifiedRunningHubApps, type RunningHubApp } from '../lib/runninghub-apps';

export function RunningHubAppPicker({ selected, onSelect }: { selected: RunningHubApp; onSelect: (app: RunningHubApp) => void }) {
  const [apps, setApps] = useState<RunningHubApp[]>(verifiedRunningHubApps);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('已核对入口 · 2026-09-09；正在获取官网精选应用…');
  async function refresh(signal?: AbortSignal) {
    setLoading(true);
    try {
      const response = await fetch('/api/runninghub-apps', { cache: 'no-store', signal });
      const data = await response.json() as { apps?: RunningHubApp[]; error?: string };
      if (!response.ok) throw new Error(data.error || '读取失败，请稍后刷新。');
      const found: RunningHubApp[] = Array.isArray(data.apps) ? data.apps.map((item: RunningHubApp) => appFromLink(item.name, item.url)).filter((app): app is RunningHubApp => app !== null) : [];
      if (!found.length) throw new Error('暂未读取到图像应用，可直接打开应用广场。');
      // Keep previously verified app links separate from the current featured directory.
      const combined = new Map(verifiedRunningHubApps.map((app) => [app.id, app]));
      for (const app of found) combined.set(app.id, app);
      setApps([...combined.values()]);
      setMessage(`刚刚读取官网精选：${found.length} 个图像应用。其余为 2026-09-09 核对入口。`);
    } catch (error) {
      if (!signal?.aborted) setMessage(error instanceof Error ? error.message : '读取失败，保留已核对入口。');
    } finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, []);
  const options = apps.some((app) => app.id === selected.id) ? apps : [selected, ...apps];
  return <section className="rh-app-picker" aria-label="RunningHub 官网应用选择">
    <label htmlFor="rh-official-app">官网图像应用<select id="rh-official-app" value={selected.id} onChange={(event) => { const app = options.find((item) => item.id === event.target.value); if (app) onSelect(app); }}>
      {(['图像生成', '图片处理'] as const).map((kind) => <optgroup key={kind} label={kind}>{options.filter((app) => app.kind === kind).map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}</optgroup>)}
    </select></label>
    <div className="rh-directory-actions"><button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? '正在读取…' : '刷新官网精选'}</button><a href={runningHubAppsSource} target="_blank" rel="noopener noreferrer">更多应用 ↗</a></div>
    <p role="status">{message}</p><p>来源：RunningHub「AI 应用」。这里只列出部分图像应用，不等于你账号的可用权益清单；实际模型、参考图数量、参数和费用请在官网确认。</p>
  </section>;
}
