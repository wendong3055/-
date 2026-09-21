import type { FrameSize } from './frame-catalog';
import type { GenerationTask } from './generation-types';
import type { SizeMarks } from './production-scene';
import { sizeProductionBrief } from './production-scene';

export const artworkRules = {
  upper: '只在上方屏芯装画，柜门、抽屉和其余木质部件不加图案。',
  all: '只在原框架已有的画芯开口装画，不覆盖木框、格栅、柜门、抽屉或五金。',
  continuous: '连屏使用一幅连续图案，按各扇画芯顺序分割，不在每扇重复完整图案。',
  repeat: '每扇画芯重复同一幅完整图案，不改变扇数与结构。',
} as const;
export const mainOptions = ['白底主图', '玄关场景', '客厅场景'] as const;
export const detailOptions = ['完整详情长图', '新品形象', '画芯设计', '框架与配色', '空间搭配', '规格选择', '选购须知'] as const;
export const detailTemplateReference = {name:'家居编辑式长图',source:'https://www.zcool.com.cn/work/ZNDg1MzExODg%3D.html',note:'仅参考分区、图文节奏和留白；不复制原图、品牌、文案或产品卖点。'};
export function detailProductionBrief(title:string,rule:string,notes:string) {
  const long=title==='完整详情长图';
  const layout=long
    ? '输出一张1:3竖版完整电商详情长图，不是单张场景照，不是多视图联系表。五段从上到下连贯排版：①首屏，中文大标题“让图案融入日常”，副标题“画芯与框架的搭配”，配一张完整正面产品场景图；②“画芯之美”，正文“在色彩与线条间，感受画面的层次”，仅放大已有画芯；③“细节有序”，正文“框架与画芯，自然相衬”，仅裁切参考图可见结构，不打开柜门或抽屉；④“融入空间”，正文“为日常空间，添一处风景”，保持同一产品和视角；⑤“选购提示”，只写“下单前请确认规格、颜色与摆放空间。屏幕显示存在色差，请以实物为准。”'
    : `输出一张3:4竖版、带中文排版的“${title}”详情切片；一个明确标题、一张主体图、一处已有细节裁切和两句简短中文介绍。标题使用“${title}”，介绍只描述参考图中可见的图案、配色和外观。不是无文字配图，不生成多视图联系表。`;
  return `${layout}参考家居编辑式模板的场景大图、局部细节、短文案与留白节奏，重新设计，不复制参考品牌或商品。自然暖白底、深棕标题、清晰中文无衬线正文，统一边距和字号层级；不得使用微小文字、乱码、英文占位或水印。严格锁定确认样图的产品比例、画芯、木色、门、抽屉、五金和脚轮；同一产品在各分区保持一致。禁止新增侧面、背面、俯视、爆炸图及未经参考图证实的内部结构。不得编造材质、认证、承重、尺寸、价格或服务承诺；不印未经核实的参数。${rule} ${notes} 最终输出必须包含清晰中文标题和说明；忽略旧规则中的“不带文字配图、交付时再排版”，不得用无依据的新视角填充版面。`;
}
export type ProductionPlanInput = {
  name: string; expectedVersion: number; rule: keyof typeof artworkRules; notes: string;
  sizes: FrameSize[]; main: string[]; details: string[]; confirmed: boolean; sceneTitle?:string;
};
export type ProductionItem = { id: string; title: string; kind: 'main'|'size'|'detail'; brief: string; spec: (FrameSize&{marks?:SizeMarks})|null;
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
  if(details.includes('完整详情长图')&&details.length>1)throw new Error('完整详情长图与单模块请分开制作，避免重复生成。');
  if(p.sceneTitle && (!['客厅场景','玄关场景'].includes(p.sceneTitle)||!main.includes(p.sceneTitle)))throw new Error('请在主图中勾选共用场景，再保存清单。');
  if (!main.length && !details.length && !sizes.length) throw new Error('请至少选择一个制作项目。');
  return {name:p.name.trim(),expectedVersion:p.expectedVersion,rule:p.rule,notes:p.notes.trim(),sizes,main:[...mainOptions].filter(x=>main.includes(x)),details:[...detailOptions].filter(x=>details.includes(x)),confirmed:true,...(p.sceneTitle?{sceneTitle:p.sceneTitle}:{})};
}
export function planItems(plan: ProductionPlanInput) {
  const lock = `${artworkRules[plan.rule]} ${plan.notes}`;
  return [
    ...plan.main.map(title=>({title,kind:'main' as const,spec:null,brief:`以确认样图为产品标准，制作${title}。保留产品结构、画芯和框架色，完整展示产品，不添加尺寸或营销文字。${title===plan.sceneTitle?'此图同时作为尺寸图的共用场景：正方形构图，产品正面为主，侧面进深适度可见，机位端正，背景简洁明亮，产品四周保留标注空间，不被其他家具遮挡。':''}${lock}`})),
    ...plan.sizes.map(spec=>({title:`宽${spec.widthCm} × 高${spec.heightCm}cm${spec.panelCount ? ` · ${spec.panelCount}扇`:''}`,kind:'size' as const,spec,
      brief:sizeProductionBrief(spec,artworkRules[plan.rule],plan.notes,plan.sceneTitle)})),
    ...plan.details.map(title=>({title,kind:'detail' as const,spec:null,brief:detailProductionBrief(title,artworkRules[plan.rule],plan.notes)})),
  ];
}
