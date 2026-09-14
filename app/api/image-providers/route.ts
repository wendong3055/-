import { env } from 'cloudflare:workers';
import { generationOwner } from '../../../lib/generation-auth';
import { listCustomProviders, saveCustomProvider } from '../../../db/custom-image-providers';
import { limitedBytes } from '../../../lib/custom-image-provider';
export async function GET() {
  const owner = await generationOwner();
  if (!owner) return Response.json({ error: '请先登录。' }, { status: 401 });
  try { return Response.json({ providers: await listCustomProviders(owner), canSaveKey: Boolean(env.CREDENTIAL_ENCRYPTION_KEY) }, { headers: { 'cache-control': 'no-store' } }); }
  catch { return Response.json({ error: '自定义接口暂时无法读取，请稍后重试。' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return Response.json({ error: '请先登录。' }, { status: 401 });
  let body: Record<string,unknown>;
  try { body = JSON.parse(new TextDecoder().decode(await limitedBytes(new Response(request.body), 12000))); }
  catch { return Response.json({ error: '配置内容无效或过大。' }, { status: 400 }); }
  try { return Response.json({ provider: await saveCustomProvider(owner, body), tested: false }, { headers: { 'cache-control': 'no-store' } }); }
  catch (error) {
    // Only our validation errors are shown; never echo database/network errors or keys.
    const message = error instanceof Error && /^[\u4e00-\u9fff]/.test(error.message) ? error.message : '接口没有保存成功，请稍后重试。';
    return Response.json({ error: message }, { status: 400 });
  }
}
