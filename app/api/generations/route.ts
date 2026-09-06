import { NextResponse } from 'next/server';
import { generationOwner } from '../../../lib/generation-auth';
import { listTasks, publicTask } from '../../../db/generation-tasks';

export async function GET() {
  const owner = await generationOwner();
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  try { return NextResponse.json((await listTasks(owner)).map(publicTask), { headers: { 'cache-control': 'no-store' } }); }
  catch { return NextResponse.json({ error: '任务记录暂时无法读取，请稍后重试。' }, { status: 503 }); }
}
