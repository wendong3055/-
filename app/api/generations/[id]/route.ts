import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { claimPoll, completeTask, getTask, publicTask, releasePoll, updateTask } from '../../../../db/generation-tasks';
import { downloadResult, providerError, queryGeneration, runningHubConnection, RunningHubError } from '../../../../lib/runninghub';
import { getImageModel } from '../../../../lib/generation-models';
import { isCustomModel } from '../../../../lib/custom-image-config';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await generationOwner();
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const { id } = await context.params;
  try {
    const row = await getTask(owner, id);
    if (!row) return NextResponse.json({ error: '没有找到此任务。' }, { status: 404 });
    if (isCustomModel(row.model)) {
      if (!['succeeded','failed'].includes(row.status)) {
        const key = `${owner}/generated-previews/${id}/result`;
        const image = await env.FILES.head(key);
        if (!image && row.status === 'submitting' && row.updated_at < Date.now() - 600000) {
          await updateTask(owner, id, 'unknown', '提交结果尚未确认。请先在所选服务商的记录中核对，避免重复扣费。');
        }
        if (image && ['image/png','image/jpeg','image/webp'].includes(image.httpMetadata?.contentType || '')) {
          if (['submitting','unknown'].includes(row.status)) await updateTask(owner, id, 'queued', '', 'custom-result');
          const customLease = await claimPoll(owner, id);
          if (customLease) {
            try { await updateTask(owner, id, 'saving', '', null, customLease); await completeTask(row, image.httpMetadata!.contentType!, image.size, key, customLease); }
            finally { await releasePoll(owner, id, customLease); }
          }
        }
      }
      return NextResponse.json(publicTask((await getTask(owner, id))!), { headers: { 'cache-control': 'no-store' } });
    }
    const lease = row.remote_task_id ? await claimPoll(owner, id) : null;
    if (row.remote_task_id && lease) {
      try {
        const connection = await runningHubConnection(owner, row.model, row.credential_id ?? null);
        const result = await queryGeneration(row.remote_task_id, connection);
        if (result.status === 'SUCCESS') {
          await updateTask(owner, id, 'saving', '', null, lease);
          const image = result.results?.find((item) => item.url && (!item.outputType || ['image', 'jpg', 'jpeg', 'png', 'webp'].includes(item.outputType.toLowerCase())));
          if (!image?.url) throw new RunningHubError('平台显示完成但未返回图片，请在 RunningHub 任务记录核对。');
          const { bytes, mime, size } = await downloadResult(image.url);
          const key = `${owner}/generated-previews/${id}/result`;
          await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
          await completeTask(row, mime, size, key, lease);
        } else if (result.status === 'FAILED') {
          await updateTask(owner, id, 'failed', providerError(result), null, lease);
        } else if (result.status === 'QUEUED' || result.status === 'RUNNING') {
          await updateTask(owner, id, result.status === 'QUEUED' ? 'queued' : 'running', '', null, lease);
        } else throw new RunningHubError('平台任务状态暂时无法识别，请稍后恢复查询。');
      } catch (error) {
        const message = error instanceof RunningHubError ? error.message : '生成任务已保留，查询或保存暂时中断。请恢复查询，不要重复生图。';
        const current = await getTask(owner, id);
        if (current && current.status !== 'succeeded' && current.status !== 'failed') await updateTask(owner, id, current.status, message, null, lease);
      } finally { await releasePoll(owner, id, lease).catch(() => undefined); }
    }
    return NextResponse.json(publicTask((await getTask(owner, id))!), { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: '暂时无法查询任务，请稍后重试，不要重复提交。' }, { status: 503 }); }
}
