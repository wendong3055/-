import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../../lib/generation-auth';
import { productWorkspace, saveProductionPlan, ProductionError } from '../../../../../db/production';
import { productionJson } from '../../../../../lib/production-request';
async function handle(request:Request,context:{params:Promise<{id:string}>},write:boolean) {
  const owner=await generationOwner(write?request:undefined);
  if(!owner) return NextResponse.json({error:'请先登录。'},{status:401});
  try {
    const {id}=await context.params;
    let body:unknown;
    if(write){try{body=await productionJson(request);}catch(e){throw new ProductionError(e instanceof Error?e.message:'清单格式无效。');}}
    return NextResponse.json(write?await saveProductionPlan(owner,id,body):await productWorkspace(owner,id),{headers:{'cache-control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof ProductionError?e.message:'新品清单暂时无法读取或保存，请稍后重试。'},{status:e instanceof ProductionError?e.status:503});}
}
export const GET=(r:Request,c:{params:Promise<{id:string}>})=>handle(r,c,false);
export const POST=(r:Request,c:{params:Promise<{id:string}>})=>handle(r,c,true);
