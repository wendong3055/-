import type { ProductionItem, ProductionPlan } from './production-plan';
import { pageItems, type ProductionPage } from './production-workflow';
import { mainPropsBrief, type PropsMode } from './main-props';
export type BatchSettings = { model: string; quality: string; propsMode: PropsMode; propsText: string };
export function productionSample(plan: ProductionPlan, page: ProductionPage) {
  return (page === 'size' && plan.config.sceneTitle ? plan.items.find(item => item.kind === 'main' && item.title === plan.config.sceneTitle) : undefined) || pageItems(plan, page)[0];
}
export function sampleApproved(item: ProductionItem | undefined) {
  return Boolean(item?.generationId && item.task?.id === item.generationId && item.task.status === 'succeeded' && item.task.url && item.review === 'accepted');
}
export function savedBatchSettings(item?: ProductionItem): BatchSettings | null {
  const task = item?.task;
  if (!task?.recipe || !task.model) return null;
  const saved = task.recipe.batchSettings;
  const instruction = task.recipe.instruction;
  const marker = item?.kind === 'size' ? '[尺寸图摆件]' : '[主图摆件]';
  let propsMode: PropsMode = 'auto', propsText = '';
  if (saved) { propsMode = saved.propsMode; propsText = saved.propsText; }
  else if (instruction.includes(`${marker} 摆件布置：不添加摆件`)) propsMode = 'none';
  else if (instruction.includes(marker) && !instruction.includes('在产品每个适合摆放的现有台面')) {
    propsMode = 'custom'; propsText = instruction.split(marker)[1]?.split(' 仅放在参考产品')[0]?.trim().slice(0, 400) || '';
  }
  return { model: task.model, quality: task.recipe.quality || 'medium', propsMode, propsText };
}
export function sampleMatches(item: ProductionItem | undefined, settings: BatchSettings) {
  const saved = savedBatchSettings(item);
  if (!saved || item?.task?.resolution !== '2k' || saved.model !== settings.model || saved.quality !== settings.quality) return false;
  // Old detail samples recorded no prop placement; their model/quality still apply.
  if (item.kind === 'detail' && !item.task.recipe?.batchSettings) return true;
  return saved.propsMode === settings.propsMode && saved.propsText === settings.propsText.trim().slice(0, 400)
    && Boolean(item.task.recipe?.batchSettings || item.kind === 'detail' || !item.task.recipe!.instruction.includes('[主图摆件]') || item.task.recipe!.instruction.includes(mainPropsBrief(item.kind, settings.propsMode, settings.propsText)));
}
