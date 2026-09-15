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
  const scene=sharedScene(plan), recipe=workspace.sample?.recipe;
  return !!(scene&&recipe&&item.kind==='size'&&item.spec?.sourceIds.length===1&&
    recipe.frameId===`uploaded-frame-${item.spec.sourceIds[0]}`&&
    scene.task && ['gpt-image-2','gpt-image-2.5-sunburst'].includes(scene.task.model)&&scene.task.resolution==='2k'&&scene.task.aspectRatio==='1:1');
}
export function sceneSizeBrief(spec:NonNullable<ProductionItem['spec']>,rule:string,notes:string) {
  return `图1为本规格真实框架，图2为原画芯，图3为共用场景主图。仅沿用图3的房间背景、地面、机位和光线，不沿用图3产品的尺寸或数量。以图1的真实结构、扇数、抽屉和比例为准，使用图2画芯和确认木色。宽${spec.widthCm}cm、高${spec.heightCm}cm${spec.depthCm?`、深${spec.depthCm}cm`:''}。正方形完整入镜，四周留足尺寸标注空间，禁止裁切或拉伸，不添加任何文字、数字、箭头。尺寸稍后根据真实数值准确标注。${rule} ${notes}`;
}
