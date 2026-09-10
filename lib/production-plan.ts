import type { FrameSize } from './frame-catalog';
import type { GenerationTask } from './generation-types';

export const artworkRules = {
  upper: '只在上方屏芯装画，柜门、抽屉和其余木质部件不加图案。',
  all: '只在原框架已有的画芯开口装画，不覆盖木框、格栅、柜门、抽屉或五金。',
  continuous: '连屏使用一幅连续图案，按各扇画芯顺序分割，不在每扇重复完整图案。',
  repeat: '每扇画芯重复同一幅完整图案，不改变扇数与结构。',
} as const;
export const mainOptions = ['白底主图', '玄关场景', '客厅场景'] as const;
export const detailOptions = ['新品形象', '画芯设计', '框架与配色', '空间搭配', '规格选择', '选购须知'] as const;
export type ProductionPlanInput = {
  name: string; expectedVersion: number; rule: keyof typeof artworkRules; notes: string;
  sizes: FrameSize[]; main: string[]; details: string[]; confirmed: boolean;
};
export type ProductionItem = { id: string; title: string; kind: 'main'|'size'|'detail'; brief: string; spec: FrameSize|null;
  generationId: string|null; review: string; note: string; task: GenerationTask|null };
export type ProductionPlan = { id: string; version: number; createdAt: number; config: ProductionPlanInput; items: ProductionItem[] };
export type ProductWorkspace = { product: {id:string;name:string;frameName:string;artworkName:string;sampleAssetId:string};
  sample: GenerationTask|null; sources: {id:string;name:string}[]; sizes: FrameSize[]; unknown: number; missing: number; plans: ProductionPlan[] };

export function validateProductionPlan(value: unknown, sources: string[]): ProductionPlanInput {
  const p = value as ProductionPlanInput;
  if (!p || typeof p !== 'object' || p.confirmed !== true || !Number.isInteger(p.expectedVersion) || p.expectedVersion < 0 ||
      typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120 || typeof p.notes !== 'string' || p.notes.length > 1000 ||
      !Object.hasOwn(artworkRules, p.rule) || !Array.isArray(p.sizes) || p.sizes.length > 100) throw new Error('请填写新品名称、装画规则，并确认制作清单。');
  const choices = (values: string[], allowed: readonly string[]) => {
    if (!Array.isArray(values) || values.length > allowed.length || new Set(values).size !== values.length || values.some(v => !allowed.includes(v))) throw new Error('制作项目无效。');
    return values;
  };
  const sizes = p.sizes.map((s, index) => {
    if (!s || ![s.widthCm,s.heightCm].every(n => Number.isFinite(n) && n >= 10 && n <= 1800) ||
      (s.depthCm !== undefined && (!Number.isFinite(s.depthCm) || s.depthCm <= 0 || s.depthCm > 300)) ||
      !Array.isArray(s.sourceIds) || s.sourceIds.length !== 1 || !sources.includes(s.sourceIds[0])) throw new Error(`第 ${index + 1} 个规格需要有效尺寸和对应框架原图。`);
    if (s.panelCount !== undefined && (!Number.isInteger(s.panelCount) || s.panelCount < 1 || s.panelCount > 20)) throw new Error('扇数须为 1–20 的整数。');
    return {key:`${s.widthCm}x${s.heightCm}x${s.depthCm ?? ''}:${s.panelCount ?? 1}`,widthCm:s.widthCm,heightCm:s.heightCm,
      ...(s.depthCm !== undefined ? {depthCm:s.depthCm}:{}),...(s.panelCount ? {panelCount:s.panelCount}:{}),
      widthParts:[s.widthCm],sourceIds:[s.sourceIds[0]],sourceUrls:[`/api/files/${s.sourceIds[0]}`]};
  });
  if (new Set(sizes.map(s=>s.key)).size !== sizes.length) throw new Error('有重复规格，请合并后再确认。');
  const main = choices(p.main, mainOptions), details = choices(p.details, detailOptions);
  if (!main.length && !details.length && !sizes.length) throw new Error('请至少选择一个制作项目。');
  return {name:p.name.trim(),expectedVersion:p.expectedVersion,rule:p.rule,notes:p.notes.trim(),sizes,main:[...mainOptions].filter(x=>main.includes(x)),details:[...detailOptions].filter(x=>details.includes(x)),confirmed:true};
}
export function planItems(plan: ProductionPlanInput) {
  const lock = `${artworkRules[plan.rule]} ${plan.notes}`;
  return [
    ...plan.main.map(title=>({title,kind:'main' as const,spec:null,brief:`以确认样图为产品标准，制作${title}。保留产品结构、画芯和框架色，完整展示产品，不添加尺寸或营销文字。${lock}`})),
    ...plan.sizes.map(spec=>({title:`宽${spec.widthCm} × 高${spec.heightCm}cm${spec.panelCount ? ` · ${spec.panelCount}扇`:''}`,kind:'size' as const,spec,
      brief:`依据这张规格框架原图制作白底产品净图，宽${spec.widthCm}cm，高${spec.heightCm}cm${spec.depthCm ? `，深${spec.depthCm}cm`:''}。保持该规格原图结构和透视，不拉伸确认样图替代。不要生成文字或尺寸箭头，尺寸标识在下载时由确认数据准确排版。${lock}`})),
    ...plan.details.map(title=>({title,kind:'detail' as const,spec:null,brief:`根据确认产品，重新设计电商详情页的“${title}”模块。保留产品结构、画芯及木色，版式清晰有留白，不照搬原详情页，不编造材质、认证、承重或尺寸参数。生成不带文字的模块配图；模块标题和已确认参数在交付时排版。${lock}`})),
  ];
}
