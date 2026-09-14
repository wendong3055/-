import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { runningHubConnection, uploadReference, RunningHubError } from '../../../../lib/runninghub';

// A fixed tiny upload validates transport and upload credentials only. No model
// submission, user image, task row or stored output is involved.
export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const region = new URL(request.url).searchParams.get('region');
  if (region !== 'cn' && region !== 'international') return NextResponse.json({ error: '请选择接口站点。' }, { status: 400 });
  try {
    const connection = await runningHubConnection(owner, region === 'cn' ? 'cn-rhart-image-g-2' : 'gpt-image-2');
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
    await uploadReference(new File([bytes], 'connection-test.png', { type: 'image/png' }), connection);
    return NextResponse.json({ message: '连接及测试文件上传成功。没有提交生图；模型权限、余额及实际出图仍需另行验证。', generationSubmitted: false }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RunningHubError ? error.message : '连接检查未完成。没有提交生图。', generationSubmitted: false }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
