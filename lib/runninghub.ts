import { env } from 'cloudflare:workers';
import { defaultImageModel, getImageModel, validModelSettings } from './generation-models';

// https://www.runninghub.ai/runninghub-api-doc-en/api-448969336
// V2 only: do not mix in the legacy data/taskStatus response envelope.
export const RUNNINGHUB_ORIGIN = 'https://www.runninghub.ai';
export const RUNNINGHUB_MODEL = defaultImageModel.id;
export const MODEL_PATH = defaultImageModel.endpoint;
export type ProviderResult = { taskId?: string; status?: string; errorCode?: string; errorMessage?: string; results?: Array<{ url?: string; outputType?: string }> };
export class RunningHubError extends Error {
  constructor(message: string, public uncertain = false) { super(message); }
}
export function apiKeyConfigured() { return Boolean(env.RUNNINGHUB_API_KEY); }

function friendlyError(code: unknown, message: unknown, status: number) {
  const value = `${code ?? ''} ${message ?? ''}`;
  const codes: Record<string, string> = {
    '1002': 'RunningHub 密钥无效，请检查国际站 API 密钥。',
    '1003': 'RunningHub 请求频率受限，请稍后重试。',
    '1004': '平台任务不存在或已过期，请在 RunningHub 记录中核对。',
    '1007': '平台未接受生成参数，请核对模型接口配置。',
    '1008': '参考图超过平台限制，请压缩后重新提交。',
    '1011': '模型忙，请稍后重试。',
    '1015': '平台生成失败，请调整参考图或制作要求后重试。',
    '1501': '内容未通过平台审核，请调整参考图或制作要求。',
    '416': 'RunningHub API 余额不足，请检查 API 账户余额。',
    '421': 'RunningHub 并发任务已达上限，请稍后重试。',
  };
  if (codes[String(code)]) return codes[String(code)];
  if (status === 401 || status === 403 || /API_KEY|TOKEN|UNAUTHORIZED/i.test(value)) return 'RunningHub 密钥无效或没有该接口权限，请检查服务端密钥。';
  if (/BALANCE|INSUFFICIENT|ACCOUNT.*FUNDS|余额|积分不足/i.test(value)) return 'RunningHub API 余额不足，请检查 API 账户余额后再试。';
  if (status === 429 || /QUEUE|CONCURRENT|RATE_LIMIT|频率|并发/i.test(value)) return 'RunningHub 当前排队或请求过多，请稍后再试。';
  if (/CONTENT|SENSITIVE|SAFETY|审核|违规/i.test(value)) return '图片或制作要求未通过平台审核，请调整内容。';
  return 'RunningHub 未完成请求，请检查所选模型的可用性和参数，或稍后再试。';
}

async function call(path: string, body: FormData | Record<string, unknown>, billable = false): Promise<Record<string, unknown>> {
  const key = env.RUNNINGHUB_API_KEY;
  if (!key) throw new RunningHubError('尚未配置 RUNNINGHUB_API_KEY，请在站点服务端添加密钥。');
  let response: Response;
  try {
    response = await fetch(`${RUNNINGHUB_ORIGIN}${path}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45_000),
      headers: { authorization: `Bearer ${key}`, ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }) },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new RunningHubError(billable ? '提交结果尚未确认。请先在 RunningHub 任务记录核对，避免重复扣费。' : '连接 RunningHub 超时，请稍后恢复查询。', billable);
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload) throw new RunningHubError(friendlyError(payload?.errorCode ?? payload?.code, payload?.errorMessage ?? payload?.message, response.status), billable && (response.status >= 500 || !payload));
  return payload;
}

export async function uploadReference(file: File) {
  const form = new FormData();
  form.set('file', file, `reference.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`);
  const payload = await call('/openapi/v2/media/upload/binary', form) as { code?: number; message?: string; data?: { download_url?: string } };
  if (payload.code !== 200 || !payload.data?.download_url) throw new RunningHubError(friendlyError(payload.code, payload.message, 200));
  const url = new URL(payload.data.download_url);
  if (url.protocol !== 'https:') throw new RunningHubError('平台返回了无效的参考图地址。');
  return url.href;
}
export async function submitGeneration(input: { prompt: string; imageUrls: string[]; aspectRatio: string; resolution: string; model?: string; quality?: string }) {
  const model = getImageModel(input.model || RUNNINGHUB_MODEL);
  if (!model || !validModelSettings(model, input.aspectRatio, input.resolution, input.quality)) throw new RunningHubError('所选模型不支持这组生成参数。');
  const payload = await call(model.endpoint, {
    prompt: input.prompt, imageUrls: input.imageUrls, aspectRatio: input.aspectRatio, resolution: input.resolution,
    ...(model.qualities.length ? { quality: input.quality || 'medium' } : {}),
  }, true) as ProviderResult;
  if (!payload.taskId) throw new RunningHubError(friendlyError(payload.errorCode, payload.errorMessage, 200), !payload.errorCode);
  return payload;
}
export async function queryGeneration(taskId: string) {
  const payload = await call('/openapi/v2/query', { taskId }) as ProviderResult;
  if (!payload.status) throw new RunningHubError(friendlyError(payload.errorCode, payload.errorMessage, 200));
  return payload;
}
export function providerError(payload: ProviderResult) { return friendlyError(payload.errorCode, payload.errorMessage, 200); }

export async function downloadResult(value: string) {
  const url = new URL(value);
  const allowedRoots = ['runninghub.ai', 'runninghub.cn', 'rhart.ai'];
  const allowedHosts = ['rh-images-1252422369.cos.ap-beijing.myqcloud.com', 'rh-images-switch-1252422369.cos.ap-guangzhou.myqcloud.com', 'rh-images.xiaoyaoyou.com'];
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    !(allowedHosts.includes(url.hostname) || allowedRoots.some((root) => url.hostname === root || url.hostname.endsWith(`.${root}`)))) throw new RunningHubError('生成已完成，但图片地址未通过安全校验。请在 RunningHub 任务记录下载，勿重新生成。');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(40_000) });
  const mime = (response.headers.get('content-type') || '').split(';')[0];
  if (!response.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(mime) || !response.body) throw new RunningHubError('生成已完成，图片暂时无法保存。可恢复查询，不会再次生图。');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    size += chunk.byteLength;
    if (size > 30 * 1024 * 1024) { await reader.cancel(); throw new RunningHubError('结果超过 30 MB，请从 RunningHub 任务记录下载原图。'); }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { bytes, mime, size };
}
