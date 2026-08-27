import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { getDb } from '../../../../../db';
import { jobs, products } from '../../../../../db/schema';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  const ownerId = user?.userId ?? 'local-preview';
  const { id } = await context.params;
  const db = getDb();
  await db.update(products).set({ status: 'approved' }).where(and(eq(products.id, id), eq(products.ownerId, ownerId)));
  await db.update(jobs).set({ status: 'queued' }).where(and(eq(jobs.productId, id), eq(jobs.ownerId, ownerId)));
  return NextResponse.json({ ok: true, productId: id });
}
