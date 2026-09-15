import { env } from 'cloudflare:workers';
const decode = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));
export async function latestInternationalKeyId(owner: string) {
  return (await env.DB.prepare('SELECT id FROM runninghub_international_keys WHERE owner_id=? ORDER BY created_at DESC, id DESC LIMIT 1').bind(owner).first<{id:string}>())?.id ?? null;
}
// Invoked only after the owner confirms the already-saved key came from .ai.
// Copy ciphertext atomically; plaintext never leaves the credential reader.
export async function connectSavedInternationalKey(owner: string) {
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(`INSERT INTO runninghub_international_keys (id,owner_id,encrypted_key,created_at)
    SELECT ?,owner_id,encrypted_key,? FROM rh_creator_keys WHERE owner_id=?
    AND NOT EXISTS (SELECT 1 FROM generation_tasks WHERE owner_id=? AND status IN ('uploading','submitting','queued','running','saving','unknown'))
    AND NOT EXISTS (SELECT 1 FROM rh_creator_tasks WHERE owner_id=? AND status IN ('uploading','submitting','queued','running','saving','unknown'))`)
    .bind(id, Date.now(), owner, owner, owner).run();
  if (!result.meta.changes) throw new Error('未连接：请先保存通用模型 Key，并完成或处理进行中的任务。');
}
export async function internationalSnapshotKey(owner: string, id: string) {
  const row = await env.DB.prepare('SELECT encrypted_key FROM runninghub_international_keys WHERE owner_id=? AND id=?').bind(owner,id).first<{encrypted_key:string}>();
  if (!row || !env.CREDENTIAL_ENCRYPTION_KEY) throw new Error('此任务的国际站密钥快照不可用，已停止，未切换其他密钥。');
  try {
    const [version, iv, ciphertext] = row.encrypted_key.split('.');
    if (version !== 'v1') throw new Error();
    const key = await crypto.subtle.importKey('raw', decode(env.CREDENTIAL_ENCRYPTION_KEY), 'AES-GCM', false, ['decrypt']);
    // The encrypted snapshot retains its original owner-bound AAD.
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(`rh-creator:${owner}`)},key,decode(ciphertext));
    return new TextDecoder().decode(plain);
  } catch { throw new Error('此任务的国际站密钥无法解密，未切换其他密钥。'); }
}
