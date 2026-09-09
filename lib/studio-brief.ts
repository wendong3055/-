export const studioIntents = [
  { id: 'composition', name: '组合确认图', subtitle: '先看画芯、框架和木色是否合适', label: '确认组合', instruction: '画芯居中完整，保留产品结构和真实木纹，木色不要偏红。' },
  { id: 'catalog', name: '电商白底图', subtitle: '突出完整产品，便于上架展示', label: '白底主图', instruction: '纯白背景，产品居中完整展示，边缘清晰，保留自然落地阴影。' },
  { id: 'interior', name: '家居场景图', subtitle: '把屏风放进真实的家居空间', label: '家居场景', instruction: '放在简洁的现代中式玄关，柔和自然光，产品是画面主角，周围家具不要遮挡画芯。' },
] as const;

export type StudioIntent = typeof studioIntents[number]['id'];
export type GenerationRecipe = { artworkId: string; frameId: string; colorId: string; intent: StudioIntent; instruction: string; quality?: string };
export function isStudioIntent(value: string): value is StudioIntent { return studioIntents.some((item) => item.id === value); }

export function parseRecipe(value: string | null | undefined): GenerationRecipe | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value) as Partial<GenerationRecipe>;
    if (!data || typeof data !== 'object' || !['artworkId', 'frameId', 'colorId'].every((key) => typeof data[key as keyof GenerationRecipe] === 'string' && data[key as keyof GenerationRecipe]!.length > 0 && data[key as keyof GenerationRecipe]!.length <= 160) || typeof data.intent !== 'string' || !isStudioIntent(data.intent) || typeof data.instruction !== 'string' || data.instruction.length > 1500) return null;
    return { artworkId: data.artworkId!, frameId: data.frameId!, colorId: data.colorId!, intent: data.intent, instruction: data.instruction,
      ...(['low', 'medium', 'high'].includes(data.quality || '') ? { quality: data.quality } : {}) };
  } catch { return null; }
}
