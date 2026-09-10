import { env } from 'cloudflare:workers';
import { getTask, publicTask, type TaskRow } from './generation-tasks';
import { assetStyle, frameSources, frameStyle, type FrameAsset } from '../lib/frame-catalog';
import { planItems, validateProductionPlan, type ProductWorkspace, type ProductionPlanInput } from '../lib/production-plan';
export class ProductionError extends Error { constructor(message:string, public status=400){super(message);} }
export async function productWorkspace(owner:string,id:string): Promise<ProductWorkspace> {
  const p = await env.DB.prepare('SELECT * FROM products WHERE owner_id = ? AND id = ?').bind(owner,id).first<Record<string,string>>();
  if(!p) throw new ProductionError('未找到这个新品。',404);
  const {results: frames}=await env.DB.prepare("SELECT id,name,category,tags,object_key FROM assets WHERE owner_id = ? AND category IN ('框架模板','框架规格原图')").bind(owner).all<FrameAsset>();
  const representative=frames.find(f=>`uploaded-frame-${f.id}`===p.frame_id) || frames.find(f=>f.category==='框架模板' && assetStyle(f)===frameStyle(p.frame_name.split('·')[0]));
  const catalog=representative ? frameSources(frames,representative):null;
  const sampleRow=await getTask(owner,p.sample_asset_id);
  const {results: plans}=await env.DB.prepare('SELECT * FROM production_plans WHERE owner_id = ? AND product_id = ? ORDER BY version DESC').bind(owner,id).all<{id:string;version:number;plan_json:string;created_at:number}>();
  const {results:items}=await env.DB.prepare('SELECT i.* FROM production_items i JOIN production_plans p ON i.plan_id = p.id WHERE i.owner_id = ? AND p.product_id = ?').bind(owner,id).all<Record<string,string|null>>();
  const taskIds=items.map(i=>i.generation_id).filter(Boolean) as string[];
  const tasks=new Map<string,TaskRow>();
  for(let offset=0;offset<taskIds.length;offset+=80) {
    const ids=taskIds.slice(offset,offset+80);
    const {results}=await env.DB.prepare(`SELECT * FROM generation_tasks WHERE owner_id = ? AND id IN (${ids.map(()=>'?').join(',')})`).bind(owner,...ids).all<TaskRow>();
    results.forEach(t=>tasks.set(t.id,t));
  }
  const orderItems=(plan:typeof plans[number])=>{const intended=planItems(JSON.parse(plan.plan_json));return items.filter(i=>i.plan_id===plan.id).sort((a,b)=>intended.findIndex(i=>i.kind===a.kind&&i.title===a.title)-intended.findIndex(i=>i.kind===b.kind&&i.title===b.title));};
  return { product:{id:p.id,name:p.name,frameName:p.frame_name,artworkName:p.artwork_name,sampleAssetId:p.sample_asset_id},sample:sampleRow?publicTask(sampleRow):null,
    sources:representative?frames.filter(f=>assetStyle(f)===assetStyle(representative)).map(f=>({id:f.id,name:f.name})):[],sizes:catalog?.sizes||[],unknown:catalog?.unknown||0,missing:catalog?.missing||0,
    plans:plans.map(plan=>({id:plan.id,version:plan.version,createdAt:plan.created_at,config:JSON.parse(plan.plan_json),items:orderItems(plan).map(i=>({id:i.id!,title:i.title!,kind:i.kind as 'main'|'size'|'detail',brief:i.brief!,spec:JSON.parse(i.spec_json||'null'),generationId:i.generation_id,review:i.review!,note:i.note!,task:i.generation_id&&tasks.has(i.generation_id)?publicTask(tasks.get(i.generation_id)!):null}))})) };
}
export async function saveProductionPlan(owner:string,id:string,value:unknown) {
  const workspace=await productWorkspace(owner,id);
  if(!workspace.sample?.recipe || workspace.sample.status!=='succeeded') throw new ProductionError('请先确认一张包含完整搭配信息的成功样图。');
  let plan:ProductionPlanInput;
  try {plan=validateProductionPlan(value,workspace.sources.map(s=>s.id));}catch(e){throw new ProductionError(e instanceof Error?e.message:'制作清单格式无效。');}
  if(plan.expectedVersion!==(workspace.plans[0]?.version||0)) throw new ProductionError('制作清单已有更新，请重新读取后再保存。',409);
  const planId=crypto.randomUUID(), version=plan.expectedVersion+1;
  try { await env.DB.batch([
    env.DB.prepare('INSERT INTO production_plans (id,owner_id,product_id,version,plan_json,created_at) VALUES (?,?,?,?,?,?)').bind(planId,owner,id,version,JSON.stringify(plan),Date.now()),
    ...planItems(plan).map(item=>env.DB.prepare("INSERT INTO production_items (id,owner_id,plan_id,title,kind,brief,spec_json,review,note) VALUES (?,?,?,?,?,?,?,'pending','')").bind(crypto.randomUUID(),owner,planId,item.title,item.kind,item.brief,JSON.stringify(item.spec))),
  ]); } catch {throw new ProductionError('清单保存未完成。请重新读取，确认是否已保存后再试；原版本不变。',409);}
  return productWorkspace(owner,id);
}
export async function productionContext(owner:string,itemId:string) {
  const row=await env.DB.prepare('SELECT i.*,p.product_id,p.plan_json,p.version FROM production_items i JOIN production_plans p ON p.id=i.plan_id WHERE i.owner_id = ? AND i.id = ?').bind(owner,itemId).first<Record<string,string>>();
  if(!row) throw new ProductionError('制作项不存在。',404);
  const workspace=await productWorkspace(owner,row.product_id);
  if(!workspace.sample?.recipe) throw new ProductionError('新品缺少确认样图信息。');
  return {row,workspace,config:JSON.parse(row.plan_json) as ProductionPlanInput,spec:JSON.parse(row.spec_json||'null')};
}
export async function claimProductionItem(owner:string,itemId:string,taskId:string) {
  const result=await env.DB.prepare(`UPDATE production_items SET generation_id = ?, review = 'pending' WHERE owner_id = ? AND id = ? AND
    (generation_id IS NULL OR EXISTS (SELECT 1 FROM generation_tasks g WHERE g.id = production_items.generation_id AND g.owner_id = ? AND
    (g.status = 'failed' OR (g.status = 'succeeded' AND production_items.review = 'rework'))))`).bind(taskId,owner,itemId,owner).run();
  if(!result.meta.changes) throw new ProductionError('此项已生成或正在处理；需要重做时先在新品清单标记重做。',409);
}
