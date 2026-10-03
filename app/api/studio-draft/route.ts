import { generationOwner } from '../../../lib/generation-auth';
import { parseStudioDraft } from '../../../lib/studio-draft';
import { getStudioDraft, saveStudioDraft } from '../../../db/studio-drafts';

const headers = { 'cache-control': 'no-store' };
export async function GET() {
  const owner = await generationOwner();
  if (!owner) return Response.json({error:'请先登录。'},{status:401,headers});
  try { return Response.json({draft:await getStudioDraft(owner)},{headers}); }
  catch { return Response.json({error:'草稿暂时无法读取，原记录已保留。'},{status:503,headers}); }
}

export async function PUT(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return Response.json({error:'请先登录后保存。'},{status:401,headers});
  if (!request.body || Number(request.headers.get('content-length') || 0) > 16384) return Response.json({error:'草稿内容过大或为空。'},{status:413,headers});
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let raw = '', size = 0, body: {data?:unknown;baseRevision?:unknown};
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 16384) { await reader.cancel(); return Response.json({error:'草稿内容过大。'},{status:413,headers}); } raw += decoder.decode(part.value,{stream:true}); }
    raw += decoder.decode(); body = JSON.parse(raw);
  } catch { return Response.json({error:'草稿内容无效。'},{status:400,headers}); }
  finally { reader.releaseLock(); }
  const data = parseStudioDraft(body?.data), revision = body?.baseRevision;
  if (!data || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647) return Response.json({error:'草稿内容或版本无效。'},{status:400,headers});
  try {
    const result = await saveStudioDraft(owner,data,revision);
    return Response.json(result.saved ? result : {...result,error:'另一处已保存新编辑，请选择继续哪一份。'},{status:result.saved ? 200 : 409,headers});
  } catch { return Response.json({error:'草稿未保存，请保持页面打开并重试。'},{status:503,headers}); }
}
