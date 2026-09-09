import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { hiddenOptions } from '../../../db/schema';

function ownerId(userId: string | undefined) {
  return userId ?? 'local-preview';
}

function validKind(value: unknown): value is 'artwork' | 'frame' {
  return value === 'artwork' || value === 'frame';
}

export async function GET() {
  const user = await getChatGPTUser();
  const rows = await getDb().select({ kind: hiddenOptions.kind, optionId: hiddenOptions.optionId }).from(hiddenOptions).where(eq(hiddenOptions.ownerId, ownerId(user?.userId)));
  return NextResponse.json({
    artworkIds: rows.filter((row) => row.kind === 'artwork').map((row) => row.optionId),
    frameIds: rows.filter((row) => row.kind === 'frame').map((row) => row.optionId),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const body = await request.json().catch(() => null) as { kind?: unknown; ids?: unknown } | null;
  if (!validKind(body?.kind) || !Array.isArray(body?.ids)) {
    return NextResponse.json({ error: '删除记录格式不正确。' }, { status: 400 });
  }
  const ids = [...new Set(body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ saved: 0 });

  const currentOwner = ownerId(user?.userId);
  const kind = body.kind;
  await getDb().insert(hiddenOptions).values(ids.map((optionId) => ({
    id: `${currentOwner}:${body.kind}:${optionId}`,
    ownerId: currentOwner,
    kind,
    optionId,
    createdAt: new Date(),
  }))).onConflictDoNothing();
  return NextResponse.json({ saved: ids.length, ids });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  const kind = new URL(request.url).searchParams.get('kind');
  if (!validKind(kind)) {
    return NextResponse.json({ error: '恢复类型不正确。' }, { status: 400 });
  }
  await getDb().delete(hiddenOptions).where(and(eq(hiddenOptions.ownerId, ownerId(user?.userId)), eq(hiddenOptions.kind, kind)));
  return NextResponse.json({ restored: true });
}
