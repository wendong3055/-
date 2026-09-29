import {mainOptions, type ProductWorkspace, type ProductionItem, type ProductionPlan, type ProductionPlanInput} from './production-plan';
import {expandedDetails} from './detail-template';
import {sharedScene} from './production-scene';

export type ProductionPage = 'main'|'size'|'detail';
export const productionPageNames = {main:'主图制作',size:'尺寸图',detail:'详情页'};
export function batchCandidates(items:ProductionItem[],retry=false) {
  return items.filter(i=>retry ? i.task?.status==='failed'||(i.task?.status==='succeeded'&&i.review==='rework') : !i.generationId&&!i.task);
}
export function pageItems(plan:ProductionPlan,page:ProductionPage) {return plan.items.filter(i=>i.kind===page);}
export function usablePlan(plan:ProductionPlan|undefined,page:ProductionPage) {
  if(!plan||plan.config.backgroundOnly)return false;
  const items=pageItems(plan,page);
  return page==='detail'?expandedDetails.every(title=>items.some(i=>i.title===title)):page==='main'?mainOptions.every(title=>items.some(i=>i.title===title)):items.length>0&&(plan.config.workflow==='one-click-v1'||!!sharedScene(plan));
}
// The server still validates all automatically derived dimensions and ownership.
// Never persist, submit or upgrade a historical plan merely by opening a page.
export function oneClickDraft(data:ProductWorkspace,page:ProductionPage,previous?:ProductionPlan):ProductionPlanInput {
  const base=previous?.config;
  const sceneTitle=base?.sceneTitle||'客厅场景';
  const sizes=page==='size'?data.sizes.map(s=>({...s,sourceIds:s.sourceIds.slice(0,1),sourceUrls:s.sourceUrls.slice(0,1)})):[];
  if(page==='size'&&!sizes.length)throw new Error('未找到这款框架的尺寸原图，请先在框架库补充；无需逐项填写尺寸。');
  return {name:data.product.name,expectedVersion:data.plans[0]?.version||0,rule:base?.rule||'all',notes:base?.notes||'',
    main:page==='main'?[...mainOptions]:page==='size'?[sceneTitle]:[],sizes,
    details:page==='detail'?[...expandedDetails]:[],confirmed:true,workflow:'one-click-v1',
    ...(page==='size'?{sceneTitle}:{}),...(base?.detailEvidence?{detailEvidence:base.detailEvidence}:{})};
}
export function batchQueue(plan:ProductionPlan,page:ProductionPage,retry=false) {
  const targets=batchCandidates(pageItems(plan,page),retry);
  if(page!=='size'||!targets.length||sharedScene(plan))return targets;
  const scene=plan.items.find(i=>i.kind==='main'&&i.title===plan.config.sceneTitle);
  if(!scene)throw new Error('这份旧清单没有共用背景，请使用“按现有规格开始新一套”。');
  if(scene.task?.status==='succeeded'&&scene.review!=='rework')throw new Error('请先确认旧版本的背景，或按现有规格开始新一套。');
  if(scene.generationId&&!batchCandidates([scene],true).length)throw new Error('背景任务正在处理或状态待核对，请刷新任务，避免重复生成。');
  return [scene,...targets];
}
export function reusableWorkflowBackground(plans:ProductionPlan[],next:ProductionPlanInput) {
  if(next.workflow!=='one-click-v1'||!next.sceneTitle)return undefined;
  for(const plan of plans){
    if(plan.config.rule!==next.rule||plan.config.notes!==next.notes)continue;
    const scene=plan.items.find(i=>i.kind==='main'&&i.title===next.sceneTitle&&i.review!=='rework'&&i.generationId&&i.task?.status==='succeeded'&&i.task.url);
    if(scene)return scene;
  }
}
