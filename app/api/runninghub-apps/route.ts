import { generationOwner } from '../../../lib/generation-auth';
import { readRunningHubApps, runningHubAppsSource } from '../../../lib/runninghub-apps';

export async function GET(request: Request) {
  if (!await generationOwner(request)) return Response.json({ error: '请先登录工作台。' }, { status: 401 });
  try {
    const apps = await readRunningHubApps();
    return Response.json({ apps, source: runningHubAppsSource, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch {
    return Response.json({ error: '暂时无法读取官网精选列表。已保留核对过的入口，也可以直接打开应用广场。' }, { status: 502 });
  }
}
