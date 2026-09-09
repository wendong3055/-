import { generationOwner } from '../../../../../lib/generation-auth';
import { getImageModel } from '../../../../../lib/generation-models';
import { loadMemberApp, runningHubConnection, RunningHubError } from '../../../../../lib/runninghub';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const owner = await generationOwner(request);
  if (!owner) return Response.json({ error: '请先登录工作台。' }, { status: 401 });
  const { id } = await context.params;
  const model = getImageModel(id);
  if (!model?.appId || model.apiMode !== 'member-app') return Response.json({ error: '请选择已收录的会员图像应用。' }, { status: 400 });
  try {
    return Response.json(await loadMemberApp(model.appId, await runningHubConnection(owner, model.id)), { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return Response.json({ error: error instanceof RunningHubError ? error.message : '应用参数暂时无法读取。' }, { status: 503 }); }
}
