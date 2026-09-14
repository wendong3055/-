import { cleanAppSetup } from './app-setup-storage';
import type { AppSetup } from './runninghub-app-schema';
const productRequirements = '使用所选图案与框架组合新品。图案仅放入指定画芯区域，保留完整内容，不裁掉主体、不拉伸变形。严格保留参考框架的结构、比例、门、抽屉、五金和脚轮，不新增或删除部件。仅将框架木色替换为所选颜色，保留真实木纹、材质和光影，不改变画芯颜色；选择暖白色时接近自然白，不泛黄。';
export const studioIntents = [
  { id: 'composition', name: '组合确认图', subtitle: '先看画芯、框架和木色是否合适', label: '确认组合', instruction: `${productRequirements} 纯白背景，产品居中完整展示，保留自然落地阴影，不添加文字、水印或尺寸标识。` },
  { id: 'catalog', name: '电商白底图', subtitle: '突出完整产品，便于上架展示', label: '白底主图', instruction: `${productRequirements} 制作电商白底主图，产品居中，顶部、底座和脚轮完整入镜，边缘清晰，保留自然落地阴影，不添加文字、水印或尺寸标识。` },
  { id: 'interior', name: '家居场景图', subtitle: '把屏风放进真实的家居空间', label: '家居场景', instruction: `${productRequirements} 放在简洁的现代中式玄关，柔和自然光，产品是画面主角，比例符合真实空间，周围家具不遮挡产品，不添加文字、水印或尺寸标识。` },
] as const;

export type StudioIntent = typeof studioIntents[number]['id'];
export type GenerationRecipe = { artworkId: string; frameId: string; colorId: string; intent: StudioIntent; instruction: string; quality?: string; appSetup?: AppSetup; productionItemId?: string };
export function isStudioIntent(value: string): value is StudioIntent { return studioIntents.some((item) => item.id === value); }

export function parseRecipe(value: string | null | undefined): GenerationRecipe | null {
  if (!value || value.length > 55000) return null;
  try {
    const data = JSON.parse(value) as Partial<GenerationRecipe>;
    if (!data || typeof data !== 'object' || !(['artworkId', 'frameId', 'colorId'] as const).every((key) => typeof data[key] === 'string' && data[key]!.length > 0 && data[key]!.length <= 160) || typeof data.intent !== 'string' || !isStudioIntent(data.intent) || typeof data.instruction !== 'string' || data.instruction.length > 1500) return null;
    return { artworkId: data.artworkId!, frameId: data.frameId!, colorId: data.colorId!, intent: data.intent, instruction: data.instruction,
      ...(typeof data.productionItemId === 'string' && /^[a-f0-9-]{36}$/i.test(data.productionItemId) ? {productionItemId:data.productionItemId}:{}),
      ...(typeof data.quality === 'string' && /^[a-zA-Z0-9_-]{1,30}$/.test(data.quality) ? { quality: data.quality } : {}), ...(cleanAppSetup(data.appSetup) ? { appSetup: cleanAppSetup(data.appSetup)! } : {}) };
  } catch { return null; }
}
