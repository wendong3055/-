import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../../chatgpt-auth';

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录工作台。' }, { status: 401 });
  }

  const result = await env.DB.prepare(`
    UPDATE assets
    SET owner_id = ?
    WHERE owner_id = 'local-preview'
      AND (
        category = '框架规格原图'
        OR (category = '框架模板' AND tags LIKE '%规格数量:%')
      )
  `).bind(user.userId).run();

  return NextResponse.json({ moved: result.meta.changes ?? 0 });
}
