import type { ImageModel } from './generation-models';

export type CustomImageConfig = {
  id: string; name: string; baseUrl: string; modelName: string;
  editPath: string; format: 'multipart' | 'json'; sizes: string[];
  qualities: string[]; imageHosts: string[]; revision: string;
};
export const customModelId = (id: string) => `custom-${id}`;
export const isCustomModel = (id: string) => /^custom-[a-f0-9-]{36}$/i.test(id);
export function publicHttps(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('请填写完整的 HTTPS 接口地址。'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || (url.port && url.port !== '443') ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|lan|test|invalid|example|onion)$/.test(host)) {
    throw new Error('仅支持公网 HTTPS 域名；不能填写本机、内网、IP、端口、密钥或查询参数。');
  }
  return url;
}
export function cleanCustomConfig(raw: unknown, id: string, revision: string): CustomImageConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('接口配置格式不正确。');
  const v = raw as Record<string, unknown>;
  const name = String(v.name || '').trim(), modelName = String(v.modelName || '').trim();
  if (!name || name.length > 80 || !/^[\w./:@+-]{1,160}$/.test(modelName)) throw new Error('请填写接口名称和服务商提供的模型 ID。');
  const baseUrl = publicHttps(String(v.baseUrl || '').trim()).href.replace(/\/$/, '');
  const editPath = String(v.editPath || '/images/edits').trim();
  if (!/^\/[a-zA-Z0-9/_-]{1,150}$/.test(editPath) || editPath.includes('//')) throw new Error('编辑路径须以单个 / 开头，不能含网址或查询参数。');
  if (v.format !== 'multipart' && v.format !== 'json') throw new Error('请选择参考图的传输格式。');
  const list = (key: string) => Array.isArray(v[key]) ? (v[key] as unknown[]).map(String) : String(v[key] || '').split(/[\s,，;；]+/);
  const sizes = [...new Set(list('sizes').map(s => s.trim()).filter(Boolean))];
  if (!sizes.length || sizes.length > 30 || sizes.some(s => s !== 'auto' && !/^\d{3,4}x\d{3,4}$/.test(s))) throw new Error('尺寸请填写 auto 或 宽x高，例如 1024x1536，最多30项。');
  if (sizes.some(s => s !== 'auto' && s.split('x').some(n => +n < 128 || +n > 8192))) throw new Error('像素边长须为128至8192；实际可用范围以模型文档为准。');
  const qualities = [...new Set(list('qualities').map(s => s.trim()).filter(Boolean))];
  if (qualities.length > 15 || qualities.some(s => !/^[a-zA-Z0-9_-]{1,30}$/.test(s))) throw new Error('画质值格式不正确，不支持画质参数请留空。');
  const imageHosts = [...new Set(list('imageHosts').map(s => s.toLowerCase().trim()).filter(Boolean))];
  if (imageHosts.length > 10) throw new Error('最多填写10个结果图片域名。');
  imageHosts.forEach(host => { if (publicHttps(`https://${host}`).hostname !== host) throw new Error('结果图片域名不要带路径。'); });
  return { id, name, baseUrl, modelName, editPath, format: v.format, sizes, qualities, imageHosts, revision };
}
export function customImageModel(config: CustomImageConfig): ImageModel {
  return { id: customModelId(config.id), name: `${config.name} · ${config.modelName}`, endpoint: config.editPath,
    apiMode: 'openai-compatible', ratios: ['auto'], resolutions: config.sizes, qualities: config.qualities,
    source: config.baseUrl, note: '使用所填服务商的图像编辑接口；尺寸决定画幅，不额外发送比例参数。' };
}
