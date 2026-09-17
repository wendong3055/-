import { fetchWithoutRedirect, transportMessage } from './safe-http';
import { env } from 'cloudflare:workers';
import { defaultImageModel, getImageModel, validModelSettings } from './generation-models';
import {compositionCatalogPayload} from './international-composition-models';
import { diagnosticSuffix } from './runninghub-diagnostic';
import { internationalSnapshotKey } from '../db/runninghub-international';

// https://www.runninghub.ai/runninghub-api-doc-en/api-448969336
// Model V2 and member AI App envelopes are normalized by separate adapters.
export const RUNNINGHUB_ORIGIN = 'https://www.runninghub.ai';
export const RUNNINGHUB_MODEL = defaultImageModel.id;
export const MODEL_PATH = defaultImageModel.endpoint;
export type ProviderResult = { taskId?: string; status?: string; errorCode?: string; errorMessage?: string; results?: Array<{ url?: string; outputType?: string }> };
export class RunningHubError extends Error {
  constructor(message: string, public uncertain = false) { super(message); }
}
export function apiKeyConfigured() { return Boolean(env.RUNNINGHUB_API_KEY); }
export type RunningHubConnection = { origin: 'https://www.runninghub.cn' | 'https://www.runninghub.ai'; key: string };
export async function runningHubConnection(owner: string, modelId: string, credentialId: string | null = null): Promise<RunningHubConnection> {
  const model = getImageModel(modelId);
  if (!model) throw new RunningHubError('任务模型暂不受支持，不能自动切换接口。');
  try {
    const key = credentialId ? await internationalSnapshotKey(owner, credentialId) : env.RUNNINGHUB_API_KEY || '';
    if (!key) throw new Error('请先配置国际站服务端密钥。');
    return { origin: RUNNINGHUB_ORIGIN, key };
  } catch (error) { throw new RunningHubError(error instanceof Error ? error.message : '接口密钥暂时不可读取。'); }
}

function friendlyError(code: unknown, message: unknown, status: number) {
  const value = `${code ?? ''} ${message ?? ''}`;
  const codes: Record<string, string> = {
    '1002': 'RunningHub 密钥无效，请检查所选站点的 API Key。',
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

async function call(path: string, body: FormData | Record<string, unknown>, billable = false, connection?: RunningHubConnection): Promise<Record<string, unknown>> {
  const key = connection?.key || env.RUNNINGHUB_API_KEY;
  if (!key) throw new RunningHubError('尚未配置 RUNNINGHUB_API_KEY，请在站点服务端添加密钥。');
  let response: Response;
  try {
    response = await fetchWithoutRedirect(`${connection?.origin || RUNNINGHUB_ORIGIN}${path}`, {
      method: 'POST', signal: AbortSignal.timeout(45_000),
      headers: { authorization: `Bearer ${key}`, ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }) },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    throw new RunningHubError(billable ? '提交结果尚未确认。请先在 RunningHub 任务记录核对，避免重复扣费。' : transportMessage(error, '连接 RunningHub 暂时失败，请稍后恢复查询。'), billable);
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload) throw new RunningHubError(friendlyError(payload?.errorCode ?? payload?.code, payload?.errorMessage ?? payload?.message ?? payload?.msg, response.status) + diagnosticSuffix(path, payload?.errorCode ?? payload?.code, response.status), billable && (response.status >= 500 || !payload));
  return payload;
}

export async function uploadReference(file: File, connection?: RunningHubConnection, asFilename = false) {
  const form = new FormData();
  form.set('file', file, `reference.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`);
  const payload = await call('/openapi/v2/media/upload/binary', form, false, connection) as { code?: number; message?: string; msg?: string; data?: { download_url?: string; fileName?: string } };
  if (![0, 200].includes(payload.code ?? -1)) throw new RunningHubError(friendlyError(payload.code, payload.message ?? payload.msg, 200) + diagnosticSuffix('/media/upload/', payload.code, 200));
  if (asFilename) {
    if (typeof payload.data?.fileName !== 'string' || !payload.data.fileName || payload.data.fileName.length > 600) throw new RunningHubError('平台没有返回应用需要的参考图文件名，未提交生图。');
    return payload.data.fileName;
  }
  if (!payload.data?.download_url) throw new RunningHubError('平台没有返回有效的参考图地址。');
  const url = new URL(payload.data.download_url);
  if (url.protocol !== 'https:') throw new RunningHubError('平台返回了无效的参考图地址。');
  return url.href;
}
// Official non-generating account endpoint. Keep raw account response server-only.
export async function checkAccount(connection: RunningHubConnection) {
  const path = '/uc/openapi/accountStatus';
  const payload = await call(path, { apikey: connection.key }, false, connection) as { code?: number; msg?: string; data?: { remainMoney?: unknown; currency?: unknown; apiType?: unknown } };
  if (![0, 200].includes(payload.code ?? -1)) throw new RunningHubError(friendlyError(payload.code, payload.msg, 200) + diagnosticSuffix(path, payload.code, 200));
  const money = String(payload.data?.remainMoney ?? '');
  const currency = String(payload.data?.currency ?? '');
  const type = String(payload.data?.apiType ?? '');
  return { balance: /^\d{1,12}(\.\d{1,8})?$/.test(money) ? money : null, currency: /^(CNY|USD)$/.test(currency) ? currency : '', keyType: /^(NORMAL|SHARED|ENTERPRISE|CONSUMER)$/.test(type) ? type : '未识别' };
}
export async function submitGeneration(input: { prompt: string; imageUrls: string[]; aspectRatio: string; resolution: string; model?: string; quality?: string; background?: string; outputFormat?: string }, connection?: RunningHubConnection) {
  const model = getImageModel(input.model || RUNNINGHUB_MODEL);
  if (!model || !validModelSettings(model, input.aspectRatio, input.resolution, input.quality, input.background, input.outputFormat)) throw new RunningHubError('所选模型不支持这组生成参数；透明背景需使用 PNG 或 WebP。');
  if (model.maxImages && (!input.imageUrls.length || input.imageUrls.length > model.maxImages)) throw new RunningHubError('参考图片数量超出所选模型限制。');
  if (model.maxPromptLength && (input.prompt.trim().length < 2 || input.prompt.length > model.maxPromptLength)) throw new RunningHubError('制作要求长度超出所选模型限制。');
  if (connection?.origin !== RUNNINGHUB_ORIGIN) throw new RunningHubError('模型与接口站点不匹配，已停止提交。');
  let catalogBody:Record<string,unknown>|undefined;
  if(model.catalogEndpoint){try{catalogBody=compositionCatalogPayload(model,input);}catch(e){throw new RunningHubError(e instanceof Error?e.message:'图片模型参数无效。');}}
  const payload = await call(model.endpoint, catalogBody || {
    prompt: input.prompt, imageUrls: input.imageUrls, aspectRatio: input.aspectRatio, resolution: input.resolution,
    ...(model.qualities.length ? { quality: input.quality || 'medium' } : {}),
    ...(model.backgrounds?.length ? { background: input.background || 'auto' } : {}),
    ...(model.outputFormats?.length ? { outputFormat: input.outputFormat || 'png' } : {}),
  }, true, connection) as ProviderResult;
  if (!payload.taskId) throw new RunningHubError(friendlyError(payload.errorCode, payload.errorMessage, 200) + diagnosticSuffix(model.endpoint, payload.errorCode, 200), !payload.errorCode);
  return payload;
}
export async function queryGeneration(taskId: string, connection?: RunningHubConnection) {
  const payload = await call('/openapi/v2/query', { taskId }, false, connection) as ProviderResult;
  if (!payload.status) throw new RunningHubError(friendlyError(payload.errorCode, payload.errorMessage, 200));
  return payload;
}
export function providerError(payload: ProviderResult) { return friendlyError(payload.errorCode, payload.errorMessage, 200); }

export async function downloadResult(value: string) {
  const url = new URL(value);
  const allowedRoots = ['runninghub.ai', 'runninghub.cn', 'rhart.ai'];
  // International GPT Image 2 results also use RunningHub's Hong Kong COS bucket.
  const allowedHosts = ['rh-images-1252422369.cos.ap-beijing.myqcloud.com', 'rh-images-switch-1252422369.cos.ap-guangzhou.myqcloud.com', 'rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com', 'rh-images.xiaoyaoyou.com'];
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    !(allowedHosts.includes(url.hostname) || allowedRoots.some((root) => url.hostname === root || url.hostname.endsWith(`.${root}`)))) {
    // Hostname-only diagnostic: never expose the signed path, query or credentials.
    const host = /^[a-z0-9.-]{1,253}$/.test(url.hostname) ? url.hostname : 'invalid-host';
    throw new RunningHubError(`生成已完成，但图片地址未通过安全校验（来源域名：${host}）。请保留任务并恢复查询，勿重新生成。`);
  }
  const response = await fetchWithoutRedirect(url, { signal: AbortSignal.timeout(40_000) });
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
