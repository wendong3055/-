export const detailReferenceLabels = {
  transparency: '半透／不透实物对比', wood: '木纹装饰面近照', back: '同款背面原图', side: '同款侧面原图', colors: '六色色样（可选）',
} as const;
export type DetailReferenceKey = keyof typeof detailReferenceLabels;
export type DetailEvidence = { material?:string; transparency?:string; refs?:Partial<Record<DetailReferenceKey,string>> };
export const expandedDetails = ['新品形象','画芯设计','半透与不透对比','木纹装饰面细节','六种颜色展示','材质介绍','框架与配色','正反对比','三视图','空间搭配','选购须知','规格选择'] as const;
// Keep the stored module title and historical item IDs; only move the size
// overview to the end when presenting or exporting an existing suite.
export function detailPageOrder<T extends {kind:string;title:string}>(items:readonly T[]):T[] {
  const last=(item:T)=>item.kind==='detail'&&item.title==='规格选择';
  return [...items.filter(item=>!last(item)),...items.filter(last)];
}
export function detailDisplayTitle(title:string){return title==='规格选择'?'全规格尺寸总览':title;}
export const extraDetailBriefs:Record<string,string> = {
  '半透与不透对比':'左右等宽对照，同一图案、同一框架、同一场景、机位与照明，仅画芯透景程度不同。左栏“半透效果”，右栏“不透效果”，按已确认实物与说明展示；不能通过整体降透明度让木框也变透明。参考“详情12”的大标题、左右对照、底部大字标签布局，不复制其中山川画芯或实物。未经证实不写“透光不透景”、透光率或隐私保证。',
  '木纹装饰面细节':'以真实木纹装饰面近照为依据，做一张大幅局部特写和一处接缝细节，说明可见纹理、饰面与边缘处理。装饰木纹不等于实木，不能把木色名写成木材树种，不能编造截面、厚度、工艺或触感测试。',
  '六种颜色展示':'3列×2行等大的同款完整产品：原木、红木色、黄花梨色、胡桃木色、简约灰、暖白色。六格只替换木质框架或柜体颜色，画芯、比例、门抽、五金、脚轮和背景完全一致。各格下方清晰写中文色名。暖白接近自然白，不发黄。木色是配色名，不是材质声明。无上传色样时参考色值依次 #c69d62、#6d211f、#a95617、#402b24、#7b7e80、#efeee9，并标注“配色示意，实物颜色以色样为准”；上传色样时以色样为准。',
  '材质介绍':'按已确认资料分成画芯、木纹装饰面、框架／柜体等实际存在的部分，用清晰中文信息卡介绍。只写提供的材料信息，不写没有依据的实木、环保等级、零甲醛、防水阻燃、承重、认证或质保；不做猜测的剖面或爆炸图。',
  '正反对比':'同款产品正面和背面并排等比例展示，中文标签“正面”“背面”。正面以确认样图为准，背面严格按同款背面原图；不得将正面镜像当背面，不得假设双面同图或增加背部构件。',
  '三视图':'正面、侧面、背面三栏展示，同一尺度和基线，标签清晰。分别使用确认样图、同款侧面、同款背面参考，保持深度与结构关系；不是三个随机透视图，不新增或推测未知结构，不印未确认尺寸。',
};
export function detailReferenceKeys(title:string):DetailReferenceKey[] {
  return title==='半透与不透对比'?['transparency']:title==='木纹装饰面细节'?['wood']:title==='正反对比'?['back']:title==='三视图'?['side','back']:title==='六种颜色展示'?['colors']:[];
}
export function detailMissing(title:string,e?:DetailEvidence):string[] {
  const missing=detailReferenceKeys(title).filter(k=>k!=='colors'&&!e?.refs?.[k]).map(k=>detailReferenceLabels[k] as string);
  if(title==='材质介绍'&&!e?.material?.trim())missing.push('已确认的材质说明');
  if(title==='半透与不透对比'&&!e?.transparency?.trim())missing.push('已确认的半透／不透说明');
  return missing;
}
export function validateDetailEvidence(value:unknown):DetailEvidence|undefined {
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('详情资料格式无效。');
  const v=value as DetailEvidence,out:DetailEvidence={refs:{}};
  for(const key of ['material','transparency'] as const){if(v[key]!==undefined&&(typeof v[key]!=='string'||v[key]!.length>1500))throw new Error('详情说明请控制在1500字以内。');if(v[key]?.trim())out[key]=v[key]!.trim();}
  if(v.refs!==undefined&&(!v.refs||typeof v.refs!=='object'||Array.isArray(v.refs)))throw new Error('详情参考图格式无效。');
  for(const key of Object.keys(detailReferenceLabels) as DetailReferenceKey[]){const id=v.refs?.[key];if(id!==undefined){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('请选择已上传的详情参考图。');out.refs![key]=id;}}
  return out;
}
