import { env } from 'cloudflare:workers';
import { generationOwner } from '../../../lib/generation-auth';
import { productionJson } from '../../../lib/production-request';
import { internationalSnapshotKey, latestInternationalKeyId } from '../../../db/runninghub-international';
import { polishInput, polishText } from '../../../lib/prompt-polish';

export async function POST(request:Request) {
  const owner=await generationOwner(request);
  if(!owner)return Response.json({error:'请登录后再润色。'},{status:401});
  let input;try{input=polishInput(await productionJson(request,16000));}catch{return Response.json({error:'制作要求格式不正确，请填写 1–1500 字。'},{status:400});}
  try {
    const id=await latestInternationalKeyId(owner);
    const key=id?await internationalSnapshotKey(owner,id):env.RUNNINGHUB_API_KEY;
    if(!key)return Response.json({error:'请先在连接设置配置 RunningHub 国际站企业共享 Key。'},{status:400});
    const text=await polishText(key,input);
    return Response.json({text},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const message=error instanceof Error && /^(当前 RunningHub|RunningHub 文字|文字接口|润色)/.test(error.message)?error.message:'润色未确认完成，请先查看 RunningHub 的 LLM 记录再重试；原文已保留。';
    return Response.json({error:message},{status:502,headers:{'Cache-Control':'no-store'}});
  }
}
