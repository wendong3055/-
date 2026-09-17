import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { apiKeyConfigured, RUNNINGHUB_MODEL } from '../../../../lib/runninghub';
import { credentialStatus, saveChinaKey } from '../../../../lib/runninghub-credentials';
import { latestInternationalKeyId, connectSavedInternationalKey } from '../../../../db/runninghub-international';

export async function GET() {
  const owner = await generationOwner();
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  try {
    const { canSaveKey, ...regions } = await credentialStatus(owner);
    const internationalSaved = Boolean(await latestInternationalKeyId(owner));
    regions.international ||= internationalSaved;
    return NextResponse.json({ configured: apiKeyConfigured() || internationalSaved, provider: 'RunningHub', model: RUNNINGHUB_MODEL, regions, internationalSaved, canSaveKey, tested: false }, { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: '接口配置暂时无法读取，请稍后重试。' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请登录后配置。' }, { status: 401 });
  // Bounded body; keys never enter task records, logs, browser storage or responses.
  if (Number(request.headers.get('content-length') || 0) > 2048 || !request.body) return NextResponse.json({ error: '配置内容无效。' }, { status: 400 });
  const reader = request.body.getReader();
  let raw = '', size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2048) { await reader.cancel(); return NextResponse.json({ error: '配置内容过大。' }, { status: 413 }); } raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
    const body = JSON.parse(raw) as { apiKey?: unknown; action?: unknown; confirmedInternational?: unknown };
    if (body.action === 'connect-saved-international') {
      if (body.confirmedInternational !== true) return NextResponse.json({error:'请先确认已保存的是国际站 Key。'},{status:400});
      await connectSavedInternationalKey(owner);
      return NextResponse.json({saved:true,tested:false},{headers:{'cache-control':'no-store'}});
    }
    if (typeof body.apiKey !== 'string' || !/^[\x21-\x7e]{16,512}$/.test(body.apiKey.trim())) return NextResponse.json({ error: '请填写完整 API Key，不包含空格或换行。' }, { status: 400 });
    // The China-site (runninghub.cn) node is retired: this endpoint only stores
    // and connects the international key, which is saved through /api/rh-creator.
    return NextResponse.json({ error: '中国站密钥已停用；请在连接设置里保存国际站 Key。' }, { status: 410 });
  } catch { return NextResponse.json({ error: '密钥没有保存成功，请检查工作台安全存储配置后重试。' }, { status: 503 }); }
  finally { reader.releaseLock(); }
}
