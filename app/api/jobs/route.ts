import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { jobs } from '../../../db/schema';

export async function GET() {
  const user = await getChatGPTUser();
  const ownerId = user?.userId ?? 'local-preview';
  const rows = await getDb().select().from(jobs).where(eq(jobs.ownerId, ownerId)).orderBy(desc(jobs.createdAt));
  return NextResponse.json(rows);
}
