import { env } from 'cloudflare:workers';
import { cleanCustomConfig, type CustomImageConfig } from '../lib/custom-image-config';
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const decode = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));
async function key() {
  const raw = decode(env.CREDENTIAL_ENCRYPTION_KEY || '');
  if (raw.length !== 32) throw new Error('接口密钥安全存储尚未就绪，请联系管理员。');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
type Row = { id: string; config_json: string; encrypted_key: string };
export async function listCustomProviders(owner: string) {
  const { results } = await env.DB.prepare('SELECT id, config_json FROM custom_image_providers WHERE owner_id = ? ORDER BY updated_at DESC').bind(owner).all<Row>();
  return results.map(r => JSON.parse(r.config_json) as CustomImageConfig);
}
export async function customProvider(owner: string, id: string, secret = false) {
  const row = await env.DB.prepare('SELECT id, config_json, encrypted_key FROM custom_image_providers WHERE owner_id = ? AND id = ?').bind(owner, id).first<Row>();
  if (!row) throw new Error('自定义接口不存在或不属于当前账号，请重新选择。');
  const config = JSON.parse(row.config_json) as CustomImageConfig;
  if (!secret) return { config, apiKey: '' };
  try {
    const [version, iv, cipher] = row.encrypted_key.split('.');
    if (version !== 'v1') throw new Error();
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(`image-provider:${owner}:${id}:${config.baseUrl}`) }, await key(), decode(cipher));
    return { config, apiKey: new TextDecoder().decode(clear) };
  } catch { throw new Error('此接口的密钥暂时无法读取，请重新保存。'); }
}
export async function saveCustomProvider(owner: string, body: Record<string, unknown>) {
  const suppliedId = typeof body.id === 'string' && body.id;
  if (suppliedId && !/^[a-f0-9-]{36}$/i.test(suppliedId)) throw new Error('接口标识无效。');
  const id = suppliedId || crypto.randomUUID();
  const previous = suppliedId ? await customProvider(owner, id) : null;
  const config = cleanCustomConfig(body, id, crypto.randomUUID());
  const enteredKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (previous && previous.config.baseUrl !== config.baseUrl && !enteredKey) throw new Error('接口地址已改变，请重新填写该平台密钥，不能沿用旧平台密钥。');
  const apiKey = enteredKey || (previous ? (await customProvider(owner, id, true)).apiKey : '');
  if (!/^[\x21-\x7e]{8,512}$/.test(apiKey)) throw new Error('请填写有效的 API Key，不包含空格或换行。');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`image-provider:${owner}:${id}:${config.baseUrl}`) }, await key(), new TextEncoder().encode(apiKey));
  const result = await env.DB.prepare(`INSERT INTO custom_image_providers (id, owner_id, config_json, encrypted_key, updated_at)
    SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM generation_tasks WHERE owner_id = ? AND status IN ('uploading','submitting','queued','running','saving','unknown'))
    AND (? OR (SELECT COUNT(*) FROM custom_image_providers WHERE owner_id = ?) < 20)
    ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at WHERE custom_image_providers.owner_id = excluded.owner_id`)
    .bind(id, owner, JSON.stringify(config), `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`, Date.now(), owner, suppliedId ? 1 : 0, owner).run();
  if (!result.meta.changes) throw new Error('请先处理进行中或待核对的任务；每个账号最多保存20个接口模型配置。');
  return config;
}
