import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { assets } from '../../../../db/schema';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
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
  return new Response(object.body, { headers });
}
