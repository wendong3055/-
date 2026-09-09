import { generationOwner } from '../../../../../lib/generation-auth';
import { getImageModel } from '../../../../../lib/generation-models';
import { cleanAppSetup } from '../../../../../lib/app-setup-storage';
import { readAppPreference, saveAppPreference } from '../../../../../db/member-app-preferences';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const owner = await generationOwner(request);
  if (!owner) return Response.json({ error: '请先登录工作台。' }, { status: 401 });
  const { id } = await context.params;
  if (getImageModel(id)?.apiMode !== 'member-app') return Response.json({ error: '应用不支持。' }, { status: 400 });
  try { return Response.json({ setup: await readAppPreference(owner, id) }, { headers: { 'cache-control': 'no-store' } }); }
  catch { return Response.json({ error: '已保存参数暂时无法读取。' }, { status: 503 }); }
}
export async function POST(request: Request, context: Context) {
  const owner = await generationOwner(request);
  if (!owner) return Response.json({ error: '请先登录工作台。' }, { status: 401 });
  const { id } = await context.params;
  if (getImageModel(id)?.apiMode !== 'member-app' || !request.body) return Response.json({ error: '应用不支持。' }, { status: 400 });
  const reader = request.body.getReader(); let bytes = 0, raw = ''; const decoder = new TextDecoder();
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 50000) { await reader.cancel(); return Response.json({ error: '参数过大。' }, { status: 413 }); } raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
    let setup; try { setup = cleanAppSetup(JSON.parse(raw)); } catch { setup = null; }
    if (!setup) return Response.json({ error: '参数格式不正确。' }, { status: 400 });
    await saveAppPreference(owner, id, setup);
    return Response.json({ saved: true }, { headers: { 'cache-control': 'no-store' } });
  } catch { return Response.json({ error: '参数未保存，请重试。' }, { status: 503 }); }
  finally { reader.releaseLock(); }
}
