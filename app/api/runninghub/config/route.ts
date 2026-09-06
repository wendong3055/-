import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { apiKeyConfigured, RUNNINGHUB_MODEL } from '../../../../lib/runninghub';

export async function GET() {
  if (!await generationOwner()) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  return NextResponse.json({ configured: apiKeyConfigured(), provider: 'RunningHub', model: RUNNINGHUB_MODEL, region: 'runninghub.ai', tested: false }, { headers: { 'cache-control': 'no-store' } });
}
