import type { ProductionPlan, ProductionItem, ProductWorkspace } from './production-plan';
export type AnnotationPoint = {x:number;y:number};
export type SizeMarks = {generationId:string;points:AnnotationPoint[]};
export function validSizeMarks(value:unknown,generationId:string,depth:boolean):value is SizeMarks {
  const v=value as SizeMarks;
  return !!v && v.generationId===generationId && Array.isArray(v.points) && v.points.length===(depth?6:4) &&
    Array.from(v.points).every(p=>p && Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1) &&
    v.points.every((p,i)=>i%2===0||Math.hypot(p.x-v.points[i-1].x,p.y-v.points[i-1].y)>.005);
}
export function sharedScene(plan:ProductionPlan) {
  return plan.items.find(i=>i.kind==='main'&&i.title===plan.config.sceneTitle&&i.review==='accepted'&&i.task?.status==='succeeded'&&i.task.url);
}
export function canReuseScene(item:ProductionItem,workspace:ProductWorkspace,plan:ProductionPlan) {
  // New size jobs need the annotated frame, not an unannotated main image.
  // Historical reused images and their saved marks remain readable.
  return false;
}
export function preservesSourceSizeMarks(item:ProductionItem) {
  return item.kind==='size' && item.task?.recipe?.sizeAnnotationMode==='source-preserved-v1'
    && item.task.recipe.productionItemId===item.id;
}
function cleanSizeNotes(notes:string) {
  return notes.replace(/不要生成文字或尺寸箭头；根据确认数据添加标注，成品预览与下载一致。/g,'')
    .replace(/不添加任何文字、数字、箭头。尺寸稍后根据真实数值准确标注。/g,'')
    .replace(/不添加文字、水印或尺寸标识。/g,'不添加水印。')
    .replace(/不添加文字、尺寸线或无关装饰。/g,'不添加无关装饰。');
}
export function sizeProductionBrief(spec:NonNullable<ProductionItem['spec']>,rule:string,notes:string,sceneTitle='本套统一场景') {
  return `依据本规格框架原图制作尺寸图，沿用${sceneTitle}背景。完整保留框架原图里的尺寸文字、数字、单位、尺寸线、箭头及其与产品的对应位置，不能删除、改写、遮挡、裁切或重复添加。仅替换画芯、确认木色和环境背景；本规格的产品结构、数量、比例和透视以框架原图为准，不使用场景主图里的产品替代。核对清单：宽${spec.widthCm}cm、高${spec.heightCm}cm${spec.depthCm?`、深${spec.depthCm}cm`:''}；若与原图标注不符或原图标注缺失，停止并核对，不自行编造。完整展示产品及全部原有标注。${rule} ${cleanSizeNotes(notes)}`;
}
export function sceneSizeBrief(spec:NonNullable<ProductionItem['spec']>,rule:string,notes:string) {
  return `图1为本规格真实框架（含原有尺寸标注），图2为原画芯，图3为共用场景主图。仅沿用图3的房间背景、地面、布置和光线，不沿用图3产品的尺寸或数量，也不复制图3的文字。背景透视适配图1产品，保持统一场景，不另换房间。${sizeProductionBrief(spec,rule,notes)} 最终优先要求：图1原有尺寸标注必须完整清晰地保留；不新增另一套标注，不执行旧补充要求中去除尺寸或换白底的指令。`;
}
