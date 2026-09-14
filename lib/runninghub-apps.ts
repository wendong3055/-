import { fetchWithoutRedirect } from './safe-http';
export const runningHubAppsSource = 'https://www.runninghub.cn/ai-apps';
export type RunningHubApp = { id: string; name: string; url: string; kind: '图像生成' | '图片处理'; source: 'verified' | 'directory' };

// Links and names observed on the user's specified AI Apps page, 2026-09-09.
// An app listing is not an API model identifier or a promise of account entitlement.
export const verifiedRunningHubApps: RunningHubApp[] = [
  ['2061718706446753793', '全能图片PRO-图生图Ultra-官方稳定版'],
  ['2061690429824917505', '全能图片PRO-图生图-低价渠道版'],
  ['2046794946094571522', '全能图片G-2.0-图生图-低价渠道版'],
  ['2061699451919618049', '全能图片V2-图生图-低价渠道版'],
  ['2027211316242423809', '全能图片2.0'],
].map(([id, name]) => ({ id, name, url: `https://www.runninghub.cn/ai-detail/${id}`, kind: '图像生成', source: 'verified' }));

export function appFromLink(name: unknown, link: unknown): RunningHubApp | null {
  if (typeof name !== 'string' || typeof link !== 'string' || name.length > 180) return null;
  let url: URL;
  try { url = new URL(link.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.runninghub.cn' || url.port || url.username || url.password) return null;
  const match = url.pathname.match(/^\/ai-detail\/(\d{10,25})\/?$/);
  if (!match) return null;
  if (/视频|动作迁移|动作模仿|换脸|换装|数字人|音频|TTS/i.test(name)) return null;
  if (!/图片|图像|文生图|图生图|修复|抠图|扣图|图案|封面|设计图|分镜图/.test(name)) return null;
  return { id: match[1], name: name.trim(), url: `${url.origin}/ai-detail/${match[1]}`, kind: /修复|抠图|扣图|提取|编辑/.test(name) ? '图片处理' : '图像生成', source: 'directory' };
}

export function parseRunningHubApps(html: string): RunningHubApp[] {
  // Read only the published Nuxt payload. Never execute scripts or follow arbitrary links.
  const payload = html.match(/<script\b[^>]*\bid=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!payload) throw new Error('官网页面结构已变化，请直接打开应用广场。');
  const data: unknown = JSON.parse(payload);
  if (!Array.isArray(data)) throw new Error('官网应用目录暂时不可读取。');
  const apps = new Map<string, RunningHubApp>();
  for (const row of data) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const { title, jumpUrl } = row as Record<string, unknown>;
    if (!Number.isInteger(title) || !Number.isInteger(jumpUrl)) continue;
    const app = appFromLink(data[title as number], data[jumpUrl as number]);
    if (app) apps.set(app.id, app);
    if (apps.size === 100) break;
  }
  if (!apps.size) throw new Error('官网精选列表暂未提供图像应用，请前往应用广场查看。');
  return [...apps.values()];
}

export async function readRunningHubApps(fetcher: typeof fetch = fetch) {
  const response = await fetchWithoutRedirect(runningHubAppsSource, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(15000) }, fetcher);
  if (!response.ok || !response.body) throw new Error('官网应用目录暂时无法读取，请稍后刷新。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '', bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2 * 1024 * 1024) throw new Error('官网目录超过读取上限，请直接前往应用广场。');
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  return parseRunningHubApps(html);
}
