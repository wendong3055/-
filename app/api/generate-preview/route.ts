import { NextResponse } from 'next/server';
import { FormLimitError, limitedFormData } from '../../../lib/limited-form';
import { generationOwner } from '../../../lib/generation-auth';
import { compositionPrompt } from '../../../lib/composition-prompt';
import { apiKeyConfigured, aspectRatios, providerError, resolutions, RUNNINGHUB_MODEL, RunningHubError, submitGeneration, uploadReference } from '../../../lib/runninghub';
import { claimSubmission, getTask, insertTask, listTasks, publicTask, type TaskRow, updateTask } from '../../../db/generation-tasks';

export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请登录后再生成。' }, { status: 401 });
  if (!apiKeyConfigured()) return NextResponse.json({ error: '请先在站点服务端配置 RUNNINGHUB_API_KEY。' }, { status: 503 });
  if (Number(request.headers.get('content-length') || 0) > 22 * 1024 * 1024) return NextResponse.json({ error: '参考图总大小过大。' }, { status: 413 });
  let id = '';
  let submitted = false;
  let inserted = false;
  let acceptedRemoteId: string | null = null;
  try {
    const form = await limitedFormData(request, 22 * 1024 * 1024);
    id = String(form.get('requestId') || '');
    if (!/^[a-f0-9-]{36}$/i.test(id)) return NextResponse.json({ error: '请求标识无效，请刷新后重试。' }, { status: 400 });
    const previous = await getTask(owner, id);
    if (previous) return NextResponse.json(publicTask(previous));
    const artwork = form.get('artwork');
    const frame = form.get('frame');
    const refs = frame instanceof File && frame.size ? [frame, artwork] : [artwork];
    if (refs.some((file) => !(file instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024)) return NextResponse.json({ error: '请选择 JPG、PNG 或 WebP 参考图，每张不超过 10 MB。' }, { status: 400 });
    const field = (name: string, fallback = '') => String(form.get(name) || fallback).trim().slice(0, name === 'instruction' ? 1500 : 160);
    const ratio = field('aspectRatio', '16:9');
    const resolution = field('resolution', '2k');
    if (!(aspectRatios as readonly string[]).includes(ratio) || !(resolutions as readonly string[]).includes(resolution)) return NextResponse.json({ error: '不支持的画幅或分辨率。' }, { status: 400 });
    const artworkName = field('artworkName', '画芯');
    const frameName = field('frameName', '屏风框架');
    const colorName = field('colorName', '胡桃木色');
    const prompt = compositionPrompt({ hasFrame: refs.length === 2, frameName, frameProfile: field('frameProfile'), colorId: field('colorId'), colorName, colorHex: field('colorHex'), instruction: field('instruction') });
    await listTasks(owner);
    const row: TaskRow = { id, owner_id: owner, remote_task_id: null, name: `${artworkName} · ${frameName} · ${colorName}`,
      status: 'uploading', model: RUNNINGHUB_MODEL, prompt, aspect_ratio: ratio, resolution, color_name: colorName,
      asset_id: null, error: '', last_polled_at: 0, created_at: Date.now(), updated_at: Date.now() };
    if (!await insertTask(row)) {
      const existing = await getTask(owner, id);
      if (existing) return NextResponse.json(publicTask(existing));
      return NextResponse.json({ error: '已有生成任务或待核对的提交，请先在生成任务中处理。' }, { status: 409 });
    }
    inserted = true;
    const imageUrls: string[] = [];
    for (const file of refs) imageUrls.push(await uploadReference(file as File));
    if (!await claimSubmission(owner, id)) throw new RunningHubError('参考图上传已过期，请重新创建任务。');
    submitted = true;
    // Never retry this billable request automatically.
    const result = await submitGeneration({ prompt, imageUrls, aspectRatio: ratio, resolution });
    acceptedRemoteId = result.taskId!;
    await updateTask(owner, id, result.status === 'FAILED' ? 'failed' : 'queued', result.status === 'FAILED' ? providerError(result) : '', acceptedRemoteId);
    return NextResponse.json(publicTask((await getTask(owner, id))!), { status: 202 });
  } catch (error) {
    if (error instanceof FormLimitError) return NextResponse.json({ error: error.message }, { status: 413 });
    const message = error instanceof RunningHubError ? error.message : '服务暂时不可用，请稍后查看任务记录。';
    const uncertain = submitted && (!(error instanceof RunningHubError) || error.uncertain);
    if (inserted) await updateTask(owner, id, acceptedRemoteId ? 'queued' : uncertain ? 'unknown' : 'failed', message, acceptedRemoteId).catch(() => undefined);
    return NextResponse.json({ error: message, requestId: id || undefined, uncertain }, { status: 502 });
  }
}
