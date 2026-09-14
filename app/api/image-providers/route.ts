import { generationOwner } from '../../../lib/generation-auth';
// Historical credentials remain encrypted; the user disabled new custom API use.
export async function GET(){if(!await generationOwner())return Response.json({error:'请先登录。'},{status:401});return Response.json({providers:[],canSaveKey:false,disabled:true},{headers:{'cache-control':'no-store'}});}
export async function POST(request:Request){if(!await generationOwner(request))return Response.json({error:'请先登录。'},{status:401});return Response.json({error:'工作台现仅使用 RunningHub，其他平台的配置入口已关闭。'},{status:410});}
