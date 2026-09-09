import { env } from 'cloudflare:workers';

function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function decode(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
async function encryptionKey() {
  if (!env.CREDENTIAL_ENCRYPTION_KEY) throw new Error('密钥安全存储尚未就绪，请联系工作台管理员。');
  const raw = decode(env.CREDENTIAL_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error('密钥安全存储配置有误。');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function stored(owner: string) {
  return env.DB.prepare('SELECT encrypted_key FROM runninghub_credentials WHERE owner_id = ?').bind(owner).first<{ encrypted_key: string }>();
}
export async function credentialStatus(owner: string) {
  return { cn: Boolean((await stored(owner))?.encrypted_key || env.RUNNINGHUB_CN_API_KEY), international: Boolean(env.RUNNINGHUB_API_KEY), canSaveKey: Boolean(env.CREDENTIAL_ENCRYPTION_KEY) };
}
export async function saveChinaKey(owner: string, apiKey: string) {
  if (!/^[\x21-\x7e]{16,512}$/.test(apiKey)) throw new Error('请填写完整的 API Key，不包含空格或换行。');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`runninghub.cn:${owner}`) }, await encryptionKey(), new TextEncoder().encode(apiKey));
  const result = await env.DB.prepare("INSERT INTO runninghub_credentials (owner_id, encrypted_key, updated_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM generation_tasks WHERE owner_id = ? AND status IN ('uploading','submitting','queued','running','saving','unknown')) ON CONFLICT(owner_id) DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at")
    .bind(owner, `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`, Date.now(), owner).run();
  if (!result.meta.changes) throw new Error('当前有进行中的任务，请完成后再更换密钥。');
}
export async function chinaKey(owner: string) {
  const row = await stored(owner);
  if (!row) return env.RUNNINGHUB_CN_API_KEY || '';
  try {
    const [version, iv, ciphertext] = row.encrypted_key.split('.');
    if (version !== 'v1') throw new Error('Unsupported key version');
    const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(`runninghub.cn:${owner}`) }, await encryptionKey(), decode(ciphertext));
    return new TextDecoder().decode(clear);
  } catch { throw new Error('已保存的 API Key 暂时无法读取，请在设置中重新填写。'); }
}
