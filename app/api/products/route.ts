import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { jobs, products } from '../../../db/schema';

export async function GET() {
  const user = await getChatGPTUser();
  const ownerId = user?.userId ?? 'local-preview';
  const rows = await getDb().select().from(products).where(eq(products.ownerId, ownerId)).orderBy(desc(products.createdAt));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const ownerId = user?.userId ?? 'local-preview';
  const body = await request.json() as { artworkId?: string; artworkName?: string; frameId?: string; frameName?: string; name?: string };
  if (!body.artworkId || !body.artworkName || !body.frameId || !body.frameName) {
    return NextResponse.json({ error: '画芯与框架信息不完整。' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const product = { id, ownerId, name: body.name || `${body.artworkName}新品`, artworkId: body.artworkId, artworkName: body.artworkName, frameId: body.frameId, frameName: body.frameName, status: 'sample_pending', createdAt: now };
  await getDb().insert(products).values(product);
  await getDb().insert(jobs).values([
    { id: crypto.randomUUID(), ownerId, productId: id, kind: 'main_images', status: 'sample_pending', version: 'v1', outputCount: 1, createdAt: now },
    { id: crypto.randomUUID(), ownerId, productId: id, kind: 'single_sizes', status: 'waiting_for_sample', version: 'v1', outputCount: 20, createdAt: now },
    { id: crypto.randomUUID(), ownerId, productId: id, kind: 'detail_page', status: 'waiting_for_sample', version: 'v1', outputCount: 12, createdAt: now },
  ]);
  return NextResponse.json(product, { status: 201 });
}
