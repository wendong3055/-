import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { assets } from '../../../../db/schema';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { id } = await context.params;
  const ownerId = user?.userId ?? 'local-preview';
  const [asset] = await getDb().select().from(assets).where(and(eq(assets.id, id), eq(assets.ownerId, ownerId))).limit(1);
  if (!asset) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(asset.objectKey);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('x-content-type-options', 'nosniff');
  if (new URL(request.url).searchParams.get('download') === '1') {
    const extension = asset.mimeType === 'image/jpeg' ? 'jpg' : asset.mimeType === 'image/webp' ? 'webp' : 'png';
    headers.set('content-disposition', `attachment; filename="result.${extension}"; filename*=UTF-8''${encodeURIComponent(`${asset.name}.${extension}`)}`);
  }
  return new Response(object.body, { headers });
}
