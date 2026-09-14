import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { generationOwner } from '../../../../lib/generation-auth';
import { productionContext, ProductionError, updateSizeLayout } from '../../../../db/production';
import { sharedScene, validSizeMarks } from '../../../../lib/production-scene';
import { productionJson } from '../../../../lib/production-request';
export async function GET(_r:Request,c:{params:Promise<{id:string}>}) {
  const owner=await generationOwner(); if(!owner)return NextResponse.json({error:'请先登录。'},{status:401});
  try { const {row,workspace,spec,config}=await productionContext(owner,(await c.params).id);
    const plan=workspace.plans.find(p=>p.id===row.plan_id)!;
    return NextResponse.json({itemId:row.id,productId:row.product_id,planId:row.plan_id,planVersion:plan.version,
      generationId:row.generation_id,pendingItemIds:plan.items.filter(i=>!i.generationId).map(i=>i.id),
      title:row.title,brief:row.brief,kind:row.kind,spec,rule:config.rule,sceneTitle:config.sceneTitle,sceneUrl:sharedScene(plan)?.task?.url||null,
      sample:workspace.sample,frameUrl:spec?`/api/files/${spec.sourceIds[0]}`:`/api/files/${workspace.product.sampleAssetId}`},{headers:{'cache-control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof ProductionError?e.message:'制作项暂时无法读取。'},{status:e instanceof ProductionError?e.status:503});}
}
export async function POST(r:Request,c:{params:Promise<{id:string}>}) {
  const owner=await generationOwner(r);if(!owner)return NextResponse.json({error:'请先登录。'},{status:401});
  try {const {row,spec,config}=await productionContext(owner,(await c.params).id);let b:{generationId:string;review:string;note:string;action?:string;marks?:unknown;sceneGenerationId?:string};
    try{b=await productionJson(r,4000) as typeof b;}catch(e){throw new ProductionError(e instanceof Error?e.message:'验收内容无效。');}
    if(b?.action==='reuse-scene'||b?.action==='save-marks'){await updateSizeLayout(owner,row.id,b);return NextResponse.json({ok:true});}
    if(b?.review==='accepted'&&row.kind==='size'&&config.sceneTitle&&!validSizeMarks(spec?.marks,row.generation_id,!!spec?.depthCm))throw new ProductionError('请先在尺寸图上保存准确标注，再验收。');
    if(!b||!['accepted','rework'].includes(b.review)||typeof b.note!=='string'||b.note.length>600||b.generationId!==row.generation_id)throw new ProductionError('图片已变化，请刷新后验收。',409);
    if(b.review==='rework'&&!b.note.trim())throw new ProductionError('请填写重做原因，方便下次修正。');
    const result=await env.DB.prepare(`UPDATE production_items SET review=?,note=? WHERE id=? AND owner_id=? AND generation_id=? AND EXISTS
      (SELECT 1 FROM generation_tasks g WHERE g.id=? AND g.owner_id=? AND g.status='succeeded' AND g.asset_id IS NOT NULL)`).bind(b.review,b.note.trim(),row.id,owner,b.generationId,b.generationId,owner).run();
    if(!result.meta.changes)throw new ProductionError('只有成功保存的图片可以验收。');
    return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({error:e instanceof ProductionError?e.message:'验收保存失败，请重试。'},{status:e instanceof ProductionError?e.status:503});}
}
