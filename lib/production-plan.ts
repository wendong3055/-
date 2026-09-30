import type { FrameSize } from './frame-catalog';
import type { GenerationTask } from './generation-types';
import type { SizeMarks } from './production-scene';
import { sizeProductionBrief } from './production-scene';
import { expandedDetails, extraDetailBriefs, backArtworkBrief, validateDetailEvidence, detailMissing, type DetailEvidence } from './detail-template';

export const artworkRules = {
  upper: '只在上方屏芯装画，柜门、抽屉和其余木质部件不加图案。',
  all: '只在原框架已有的画芯开口装画，不覆盖木框、格栅、柜门、抽屉或五金。',
  continuous: '连屏使用一幅连续图案，按各扇画芯顺序分割，不在每扇重复完整图案。',
  repeat: '每扇画芯重复同一幅完整图案，不改变扇数与结构。',
} as const;
export const mainOptions = ['白底主图', '玄关场景', '客厅场景', '书房场景', '办公场景', '画芯特写', '框架细节', '空间全景'] as const;
export const detailOptions = ['完整详情长图', ...expandedDetails] as const;
export const detailTemplateReference = {name:'家居编辑式长图',source:'https://www.zcool.com.cn/work/ZNDg1MzExODg%3D.html',note:'仅参考分区、图文节奏和留白；不复制原图、品牌、文案或产品卖点。'};
export function sizeOverviewBrief(sizes:FrameSize[]) {
  if(!sizes.length)return '暂未匹配到本款的规格数据，不得编造尺寸或声称已列全规格。';
  const values=(numbers:number[])=>[...new Set(numbers)].sort((a,b)=>a-b).join('/');
  const groups=new Map<string,FrameSize[]>();
  for(const s of sizes){const key=`${s.widthParts.length}:${s.panelCount||1}`;groups.set(key,[...(groups.get(key)||[]),s]);}
  const diagrams=[...groups.values()].map((group,i)=>{
    const first=group[0],depths=group.flatMap(s=>s.depthCm===undefined?[]:[s.depthCm]);
    return `产品图${i+1}：${first.widthParts.length}段结构${first.panelCount?`，${first.panelCount}扇`:''}，严格按该组尺寸原图外形绘制。右侧竖向双箭头标总高 ${values(group.map(s=>s.heightCm))}cm；底部外侧横向双箭头标总宽 ${values(group.map(s=>s.widthCm))}cm。${first.widthParts.length>1?first.widthParts.map((_,n)=>`第${n+1}段宽度箭头对应原图该段边界，标 ${values(group.map(s=>s.widthParts[n]))}cm`).join('；'):'单段只标总宽，不重复标注'}。${depths.length?`右下侧边斜向双箭头标进深 ${values(depths)}cm${depths.length<group.length?'，仅用于已提供深度的规格，其他规格写“进深未提供”':''}`:'进深未提供，省略进深箭头，不猜测'}。此组实际可选组合：${group.map(s=>`${s.widthParts.join('+')}cm（总宽${s.widthCm}cm，高${s.heightCm}cm，深${s.depthCm??'未提供'}${s.depthCm===undefined?'':'cm'}）`).join('；')}。`;
  });
  return `本页是详情最后一张全规格尺寸总览，标题“全规格尺寸总览”。参考用户提供的“参数展示”图的产品主体与尺寸箭头布局，不复制其图案、文字、印章、材质或包装声明。纯白或自然暖白背景，完整写实产品为主体，保留木纹、画芯和每个可摆放位置的摆件，底座不裁切。尺寸直接对应产品标注：高度箭头在右侧，宽度与分段宽度箭头在底部，进深箭头沿右下可见侧边；黑色细实线、双向箭头、清晰大字、单位cm。尺寸线紧贴对应部位的外侧，不压在画芯、柜体或摆件上；总宽与分段宽度分两行，避免重叠。全部${sizes.length}个规格均须覆盖，不使用“产品小图＋尺寸表格”排版。共${groups.size}组结构，结构相同的规格共用一张大产品图，在对应尺寸箭头旁用斜杠列出可选值；结构不同则在同一页分组用各自尺寸原图的完整产品图展示，不把不同段数、扇数或深度强行套进一个外形，不拉伸样图冒充规格。\n${diagrams.join('\n')}\n尺寸数据逐项核对（仅供制作，不画成表格）：\n${sizes.map((s,i)=>`${i+1} | ${s.widthCm} | ${s.heightCm} | ${s.depthCm??'未提供'} | ${s.widthParts.join('+')}`).join('\n')}\n实际可选组合用简短中文列在对应产品图下，不暗示各段宽度可以任意交叉组合；不能产生数据之外的新规格，不能漏规格。同总宽不同结构分别保留。若尺寸多，可增加本页纵向排版空间，不用微小字号塞满。底部短注“尺寸单位：cm；以对应规格原图为准”。`;
}
export function detailProductionBrief(title:string,rule:string,notes:string,evidence?:DetailEvidence,sizes:FrameSize[]=[]) {
  const props='详情页摆件要求：凡展示完整产品或可见置物区域，默认在每个适合承托的现有台面、层板或置物格各放一个小巧摆件，如简约陶瓷器、小花瓶或小雕塑；根据画芯和木色统一搭配，若已有摆件则保留，不重复叠加。整套各页沿用同一摆件造型、配色和摆放逻辑；六色展示和半透／不透对比的各组摆件必须一致，只改变该模块指定的产品属性。只在真实已有且可见的位置摆放，不新增层板、不改变结构、不悬浮，不遮挡画芯、五金、木纹细节、尺寸标注或文案。画芯与木纹局部特写、示意轮廓及纯文字模块不强行添加摆件；无可摆放位置的产品不添加。摆件仅为拍摄道具，不宣称随产品赠送。';
  notes=`${props} ${notes}`;
  const long=title==='完整详情长图';
  const illustrative=detailMissing(title,evidence).length>0;
  const fallbacks:Record<string,string>={
    '半透与不透对比':'按用户的半透／不透需求制作左右对比效果示意。同一产品、图案、场景与照明，只改变画芯的透景程度，木框不透明。左标“半透效果”，右标“不透效果”，清楚标注“效果示意，实际表现以实物为准”，不写透光率或性能保证。',
    '木纹装饰面细节':'直接从确认样图的可见木纹装饰面取局部放大，表现纹理和边缘；不要求额外上传，不臆造内部、厚度或触感，不把木纹饰面称为实木。',
    '材质介绍':'以画芯、木纹装饰面、框架等可见部分排版介绍，描述其位置和可见外观；不推测实际材料成分或木材树种。注明“材料以商品实际说明为准”，不宣称环保、防水、承重或认证。',
    '正反对比':`正面使用确认样图，背面为同款产品的写实效果示意，两栏同等比例、相同木色和照明，标签“正面”“背面效果示意”。保留可验证的木纹、厚度、层板与底座，不增加未知背板、门抽、五金或内部结构。不能伪称实拍；底部短注“背面结构与画芯表现以实物为准”。${backArtworkBrief}`,
    '三视图':`正面沿用确认样图，侧面和背面必须是同款产品的写实效果图，三栏同等尺度、同一基线、同一木色和照明，标签“正面”“侧面”“背面”。侧面为90度正侧视，背面展示完整产品，保留木纹、厚度、接缝和自然落地阴影，依据现有同款参考中可确认的进深和结构关系，不添加未知构件或未确认数值。禁止用轮廓线稿、技术草图、空框或几何示意替代侧面和背面，不伪称实拍；底部短注“产品效果图”。${backArtworkBrief}`,
  };
  const modules:Record<string,string>={
    ...extraDetailBriefs,
    '新品形象':'产品首屏：上方大标题，下方完整正面产品为主体，底座与脚轮不裁切；只概括已确认的图案和框架搭配。',
    '画芯设计':'画芯展示：以原画芯正面放大特写为主，配短句描述可见色彩与构图；不增加完整产品小图，不改变原画芯内容。',
    '框架与配色':'结构细节：放大参考图中已有的框架或柜体正面细节，准确保留抽屉、门、拉手和木色。只介绍可见结构，不打开门抽、不展示未知内部。',
    '空间搭配':'空间场景：同一产品完整正面置于简洁客厅，周边家具陪衬且不遮挡产品，配两句简短搭配说明。不要重复细节页构图。',
    '规格选择':sizeOverviewBrief(sizes),
    '选购须知':'选购说明：以三条清楚的大字信息为主：“确认规格与摆放空间”“屏幕显示存在色差，请以实物为准”“产品尺寸以所选规格原图为准”。辅以一张完整正面产品小图。',
  };
  const layout=long
    ? '输出一张1:3竖版完整电商详情长图，不是单张场景照，不是多视图联系表。五段从上到下连贯排版：①首屏，中文大标题“让图案融入日常”，副标题“画芯与框架的搭配”，配一张完整正面产品场景图；②“画芯之美”，正文“在色彩与线条间，感受画面的层次”，仅放大已有画芯；③“细节有序”，正文“框架与画芯，自然相衬”，仅裁切参考图可见结构，不打开柜门或抽屉；④“融入空间”，正文“为日常空间，添一处风景”，保持同一产品和视角；⑤“选购提示”，只写“下单前请确认规格、颜色与摆放空间。屏幕显示存在色差，请以实物为准。”'
    : `只输出一张3:4竖版、带中文排版的“${title}”详情切片，不要将整套其他模块拼入本页。${(illustrative?fallbacks[title]:undefined)||modules[title]||'一个明确标题，配与本页主题相关的产品图和简短介绍。'}标题默认使用“${title==='规格选择'?'全规格尺寸总览':title}”，补充要求指定本页标题时以指定标题为准，不重复两套文案。不是无文字配图，不生成整套联系表。`;
  const facts=title==='材质介绍'&&evidence?.material?`已确认材质：${evidence.material}`:title==='半透与不透对比'&&evidence?.transparency?`已确认透光说明：${evidence.transparency}`:'';
  const views=['正反对比','三视图'].includes(title)?(illustrative?'所有视角都用写实产品效果图，不使用线稿或轮廓示意替代；以现有参考中可确认的结构为准，未知内部或隐藏构件不展示，不把效果图说成实拍或结构证明。':'仅按额外提供并标明用途的同款侧面／背面原图展示对应视角，禁止推测缺失结构；各视角均保留写实材质和光影，不转成线稿。'):'禁止新增未经参考图证实的侧面、背面、俯视、爆炸图或内部结构。';
  const colorLock=title==='六种颜色展示'?'本页仅允许按六色要求替换木质部分颜色，画芯与结构不变。':'保持确认样图木色不变。';
  return `${layout}参考家居编辑式模板的场景大图、局部细节、短文案与留白节奏，重新设计，不复制参考品牌或商品。自然暖白底、深棕标题、清晰中文无衬线正文，统一边距和字号层级；不得使用微小文字、乱码、英文占位或水印。严格锁定确认样图的产品比例、画芯、门、抽屉、五金和脚轮；同一产品在各分区保持一致。${colorLock}${views}${facts}不得编造材质、认证、承重、尺寸、价格或服务承诺；不印未经核实的参数。${rule} ${notes} 最终输出必须包含清晰中文标题和说明；忽略旧规则中的“不带文字配图、交付时再排版”，不得用无依据的新视角填充版面。`;
}
export type ProductionPlanInput = {
  name: string; expectedVersion: number; rule: keyof typeof artworkRules; notes: string;
  sizes: FrameSize[]; main: string[]; details: string[]; confirmed: boolean; sceneTitle?:string; backgroundOnly?:boolean; detailEvidence?:DetailEvidence; workflow?:'one-click-v1';
};
export type ProductionItem = { id: string; title: string; kind: 'main'|'size'|'detail'; brief: string; spec: (FrameSize&{marks?:SizeMarks})|null;
  generationId: string|null; review: string; note: string; task: GenerationTask|null };
export type ProductionPlan = { id: string; version: number; createdAt: number; config: ProductionPlanInput; items: ProductionItem[] };
export type ProductWorkspace = { product: {id:string;name:string;frameName:string;artworkName:string;sampleAssetId:string};
  sample: GenerationTask|null; sources: {id:string;name:string}[]; sizes: FrameSize[]; unknown: number; missing: number; plans: ProductionPlan[] };

// Opening a confirmed sample only prepares an editable draft. No save or
// generation is performed until the user explicitly requests that action.
export function initialProductionDraft(data: ProductWorkspace): ProductionPlanInput {
  return {name:data.product.name,expectedVersion:0,rule:'all',notes:'',sceneTitle:'客厅场景',
    sizes:data.sizes.map(s=>({...s,sourceIds:s.sourceIds.slice(0,1),sourceUrls:s.sourceUrls.slice(0,1)})),
    main:[...mainOptions],details:detailOptions.filter(x=>x!=='完整详情长图'),confirmed:false};
}

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
  const backgroundOnly=p.backgroundOnly===true;
  if(backgroundOnly&&(sizes.length||details.length||main.length!==1||!['客厅场景','玄关场景'].includes(main[0])||p.sceneTitle!==main[0]))throw new Error('背景环节只制作一张客厅或玄关背景效果图。');
  const sceneTitle=sizes.length||backgroundOnly?p.sceneTitle:undefined;
  if(sizes.length && (!sceneTitle||!['客厅场景','玄关场景'].includes(sceneTitle)||!main.includes(sceneTitle)))throw new Error('尺寸图需要共用场景，请在主图中勾选对应场景。');
  if (!main.length && !details.length && !sizes.length) throw new Error('请至少选择一个制作项目。');
  const detailEvidence=validateDetailEvidence(p.detailEvidence);
  return {name:p.name.trim(),expectedVersion:p.expectedVersion,rule:p.rule,notes:p.notes.trim(),sizes,main:[...mainOptions].filter(x=>main.includes(x)),details:[...detailOptions].filter(x=>details.includes(x)),confirmed:true,...(sceneTitle?{sceneTitle}:{}),...(backgroundOnly?{backgroundOnly:true}:{}),...(detailEvidence?{detailEvidence}:{}),...(p.workflow==='one-click-v1'?{workflow:'one-click-v1' as const}:{})};
}
// Carry forward only an explicitly accepted background from this product's
// immediately preceding background-only version. No other output is inherited.
export function reusableBackground(previous:ProductionPlan|undefined,next:ProductionPlanInput){
  if(!previous?.config.backgroundOnly||next.backgroundOnly||previous.config.sceneTitle!==next.sceneTitle||previous.config.rule!==next.rule||previous.config.notes!==next.notes)return undefined;
  return previous.items.find(i=>i.kind==='main'&&i.title===next.sceneTitle&&i.review==='accepted'&&i.generationId&&i.task?.status==='succeeded'&&i.task.url);
}
export function planItems(plan: ProductionPlanInput) {
  const lock = `${artworkRules[plan.rule]} ${plan.notes}`;
  return [
    ...plan.main.map(title=>({title,kind:'main' as const,spec:null,brief:`以确认样图为产品标准，制作${title}。保留产品结构、画芯和框架色，不添加尺寸或营销文字。${title==='画芯特写'?'放大原有画芯的可见纹理和图案细节，不重新绘制图案。':title==='框架细节'?'放大样图已有木纹装饰面与接缝，不推测截面或内部结构。':title==='空间全景'?'用更宽松的室内全景构图展示摆放关系，产品完整、不遮挡。':'完整展示产品，不裁切底座或脚轮。'}${title===plan.sceneTitle?'此图同时作为尺寸图的共用场景：正方形构图，产品正面为主，侧面进深适度可见，机位端正，背景简洁明亮，产品四周保留标注空间，不被其他家具遮挡。':''}${lock}`})),
    ...plan.sizes.map(spec=>({title:`宽${spec.widthCm} × 高${spec.heightCm}cm${spec.panelCount ? ` · ${spec.panelCount}扇`:''}`,kind:'size' as const,spec,
      brief:sizeProductionBrief(spec,artworkRules[plan.rule],plan.notes,plan.sceneTitle)})),
    ...plan.details.map(title=>({title,kind:'detail' as const,spec:null,brief:detailProductionBrief(title,artworkRules[plan.rule],plan.notes,plan.detailEvidence)})),
  ];
}
