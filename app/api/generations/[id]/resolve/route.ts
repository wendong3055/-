import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../../lib/generation-auth';
import { getTask, updateTask } from '../../../../../db/generation-tasks';
import { env } from 'cloudflare:workers';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const body = await request.json().catch(() => null) as { confirmedNoTask?: boolean } | null;
  if (body?.confirmedNoTask !== true) return NextResponse.json({ error: '需要先核实平台任务。' }, { status: 400 });
  const { id } = await context.params;
  try {
    const row = await getTask(owner, id);
    if (!row || row.status !== 'unknown' || row.remote_task_id) return NextResponse.json({ error: '此任务不能解除锁定。' }, { status: 409 });
    if (row.model.startsWith('custom-') && await env.FILES.head(`${owner}/generated-previews/${id}/result`)) return NextResponse.json({ error: '已找到保存的图片，请恢复查询，不要重新生成。' }, { status: 409 });
    await updateTask(owner, id, 'failed', '用户已在所选服务商核实未创建任务，解除提交锁定。');
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: '任务记录暂时不可用。' }, { status: 503 }); }
}
