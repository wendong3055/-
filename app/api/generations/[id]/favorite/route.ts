import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../../lib/generation-auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const body = await request.json().catch(() => null) as { favorite?: unknown } | null;
  if (typeof body?.favorite !== 'boolean') return NextResponse.json({ error: '收藏内容无效。' }, { status: 400 });
  try {
    const { id } = await context.params;
    const result = await env.DB.prepare(`UPDATE generation_tasks SET favorite = ?
      WHERE id = ? AND owner_id = ? AND status = 'succeeded' AND asset_id IS NOT NULL`)
      .bind(body.favorite ? 1 : 0, id, owner).run();
    if (!result.meta.changes) return NextResponse.json({ error: '这张结果暂时无法收藏，请刷新记录。' }, { status: 404 });
    return NextResponse.json({ id, favorite: body.favorite }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '收藏未保存，请稍后重试。' }, { status: 503 });
  }
}
