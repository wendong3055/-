import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { runningHubConnection, uploadReference, checkAccount, RunningHubError } from '../../../../lib/runninghub';
import { latestInternationalKeyId } from '../../../../db/runninghub-international';

// A fixed tiny upload validates transport and upload credentials only. No model
// submission, user image, task row or stored output is involved.
export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const region = new URL(request.url).searchParams.get('region');
  if (region !== 'cn' && region !== 'international') return NextResponse.json({ error: '请选择接口站点。' }, { status: 400 });
  try {
    const credentialId = region === 'international' ? await latestInternationalKeyId(owner) : null;
    const connection = await runningHubConnection(owner, region === 'cn' ? 'cn-rhart-image-g-2' : 'gpt-image-2', credentialId);
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='), char => char.charCodeAt(0));
    await uploadReference(new File([bytes], 'connection-test.png', { type: 'image/png' }), connection);
    const account = await checkAccount(connection);
    return NextResponse.json({ message: `连接、测试文件上传及账户查询成功。接口余额：${account.balance ?? '未返回'} ${account.currency}；Key 类型：${account.keyType}。没有提交生图，GPT Image 2 模型权限及实际出图尚未验证。`, generationSubmitted: false }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RunningHubError ? error.message : '连接检查未完成。没有提交生图。', generationSubmitted: false }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
