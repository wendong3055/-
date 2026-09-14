import { fetchWithoutRedirect } from './safe-http';
import { publicHttps, type CustomImageConfig } from './custom-image-config';

export class CustomImageError extends Error {
  constructor(message: string, public uncertain = false) { super(message); }
}
// Requests are HTTPS-only and never follow redirects with a bearer token.
// DNS validation rejects private/metadata destinations before any secret is sent.
export function publicAddress(address: string) {
  if (address.includes(':')) return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address) && !address.includes('.');
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(v => !Number.isInteger(v) || v < 0 || v > 255)) return false;
  return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    p[0] === 169 && p[1] === 254 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 ||
    p[0] === 192 && (p[1] === 168 || p[1] === 0 || p[1] === 2) ||
    p[0] === 100 && p[1] >= 64 && p[1] <= 127 || p[0] === 198 && [18,19,51].includes(p[1]) || p[0] === 203 && p[1] === 0);
}
export async function checkDestination(value: string, fetcher: typeof fetch = fetch) {
  const url = publicHttps(value);
  const answers = await Promise.all(['A','AAAA'].map(async type => {
    const r = await fetchWithoutRedirect(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(10000) }, fetcher);
    if (!r.ok) throw new CustomImageError('接口域名暂时无法安全校验，请稍后重试。');
    const data = await r.json() as { Status?: number; Answer?: { type: number; data: string }[] };
    if (data.Status !== 0) throw new CustomImageError('接口域名解析失败，请检查地址。');
    return (data.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => a.data);
  }));
  if (!answers.flat().length || answers.flat().some(a => !publicAddress(a))) throw new CustomImageError('接口域名不是可用的公网地址，已停止连接。');
  return url;
}
export async function limitedBytes(response: Response, limit: number) {
  if (!response.body || Number(response.headers.get('content-length') || 0) > limit) throw new CustomImageError('平台返回内容为空或超过保存限制。', true);
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > limit) { await reader.cancel(); throw new CustomImageError('结果超过保存限制，请在服务商后台下载，勿重复生成。', true); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function imageMime(bytes: Uint8Array) {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  throw new CustomImageError('接口没有返回有效的 PNG、JPG 或 WebP 图片。请核对服务商记录，勿重复生成。', true);
}
export async function buildEditBody(config: CustomImageConfig, refs: File[], prompt: string, size: string, quality: string): Promise<{body: FormData | string; headers: Record<string,string>}> {
  if (!config.sizes.includes(size) || (config.qualities.length ? !config.qualities.includes(quality) : Boolean(quality))) throw new CustomImageError('当前接口不支持所选尺寸或画质。');
  if (!refs.length || refs.length > 2) throw new CustomImageError('需要1至2张参考图。');
  const fields: Record<string, string | number> = { model: config.modelName, prompt, n: 1, size };
  if (quality) fields.quality = quality;
  if (config.format === 'multipart') {
    const body = new FormData(); Object.entries(fields).forEach(([k,v]) => body.set(k,String(v)));
    refs.forEach((file, i) => body.append('image[]', file, `reference-${i+1}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`));
    return { body, headers: {} };
  }
  const images = [];
  for (const file of refs) {
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    images.push({ image_url: `data:${file.type};base64,${btoa(binary)}` });
  }
  return { body: JSON.stringify({ ...fields, images }), headers: { 'content-type': 'application/json' } };
}
export async function editCustomImage(config: CustomImageConfig, apiKey: string, refs: File[], prompt: string, size: string, quality: string, fetcher: typeof fetch = fetch) {
  const destination = await checkDestination(`${config.baseUrl}${config.editPath}`, fetcher);
  const input = await buildEditBody(config, refs, prompt, size, quality);
  let response: Response;
  try { response = await fetchWithoutRedirect(destination, { method: 'POST', headers: { ...input.headers, Authorization: `Bearer ${apiKey}` }, body: input.body, signal: AbortSignal.timeout(300000) }, fetcher); }
  catch { throw new CustomImageError('提交结果未确认，请先在所选服务商后台核对，避免重复扣费。', true); }
  if (!response.ok) {
    await response.body?.cancel();
    const messages: Record<number,string> = { 400: '平台拒绝参数，请核对模型、尺寸和参考图格式。', 401: '此平台的 API Key 无效，请重新配置。', 403: '此密钥没有所选模型权限。', 404: '接口路径或模型不存在，请检查配置。', 429: '平台额度不足或请求过多，请检查账户后再试。' };
    throw new CustomImageError(messages[response.status] || '服务商未正常返回结果，请先核对平台记录。', response.status >= 500 || response.status === 408);
  }
  let payload: { data?: { b64_json?: string; url?: string }[] };
  try { payload = JSON.parse(new TextDecoder().decode(await limitedBytes(response, 12*1024*1024))); }
  catch { throw new CustomImageError('平台返回格式无法读取，请先核对平台记录，勿重复生成。', true); }
  const result = payload?.data?.[0]; let bytes: Uint8Array;
  if (typeof result?.b64_json === 'string') {
    if (result.b64_json.length > 11*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.b64_json)) throw new CustomImageError('平台返回的图片编码无效或过大，请从服务商后台下载。', true);
    try { bytes = Uint8Array.from(atob(result.b64_json), c => c.charCodeAt(0)); } catch { throw new CustomImageError('平台返回的图片编码无法读取。', true); }
  } else if (typeof result?.url === 'string') {
    let url: URL;
    try { url = new URL(result.url); const checked = new URL(url); checked.search = ''; publicHttps(checked.href); }
    catch { throw new CustomImageError('结果图片地址未通过安全校验，请在服务商后台下载。', true); }
    if (![new URL(config.baseUrl).hostname, ...config.imageHosts].includes(url.hostname)) throw new CustomImageError('图片来自未配置的结果域名，请在服务商后台下载，并在下次使用前补充该域名。', true);
    await checkDestination(`${url.origin}${url.pathname}`, fetcher);
    // Never send the API key to a result image or follow redirects.
    const downloaded = await fetchWithoutRedirect(url, { signal: AbortSignal.timeout(60000) }, fetcher);
    if (!downloaded.ok) throw new CustomImageError('图片已生成但下载失败，请在服务商后台下载，勿重复生图。', true);
    bytes = await limitedBytes(downloaded, 16*1024*1024);
  } else throw new CustomImageError('此接口未直接返回 data[0].b64_json 或 url，当前不支持它的异步任务格式。请核对平台记录。', true);
  return { bytes, mime: imageMime(bytes), size: bytes.byteLength };
}
