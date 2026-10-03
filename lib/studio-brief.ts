const productRequirements = '将画芯替换为所选图案，框架改为所选颜色，保持原有结构不变。';
export const studioIntents = [
  { id: 'composition', name: '先看搭配效果', subtitle: '检查图案、框架和木色是否合适', label: '搭配效果', instruction: productRequirements },
  { id: 'catalog', name: '做白底商品图', subtitle: '完整展示产品，方便放到商品页面', label: '白底商品图', instruction: `${productRequirements} 白底，完整展示产品。` },
  { id: 'interior', name: '放进家居场景', subtitle: '看看产品摆在房间里的样子', label: '家居场景', instruction: `${productRequirements} 搭配自然家居场景，突出产品。` },
] as const;

export type StudioIntent = typeof studioIntents[number]['id'];
export type GenerationRecipe = { artworkId: string; frameId: string; colorId: string; intent: StudioIntent; instruction: string; quality?: string; background?: string; outputFormat?: string; productionItemId?: string; sceneGenerationId?:string; sceneId?:string; sizeAnnotationMode?:'source-preserved-v1'; detailLayoutMode?:'chinese-editorial-v2'; batchSettings?: { propsMode: 'auto' | 'none' | 'custom'; propsText: string } };
export function isStudioIntent(value: string): value is StudioIntent { return studioIntents.some((item) => item.id === value); }

export function parseRecipe(value: string | null | undefined): GenerationRecipe | null {
  if (!value || value.length > 55000) return null;
  try {
    const data = JSON.parse(value) as Partial<GenerationRecipe>;
    if (!data || typeof data !== 'object' || !(['artworkId', 'frameId', 'colorId'] as const).every((key) => typeof data[key] === 'string' && data[key]!.length > 0 && data[key]!.length <= 160) || typeof data.intent !== 'string' || !isStudioIntent(data.intent) || typeof data.instruction !== 'string' || data.instruction.length > 1500) return null;
    return { artworkId: data.artworkId!, frameId: data.frameId!, colorId: data.colorId!, intent: data.intent, instruction: data.instruction,
      ...(typeof data.background === 'string' && ['auto','transparent','opaque'].includes(data.background) ? {background:data.background}:{}),
      ...(typeof data.outputFormat === 'string' && ['png','jpeg','webp'].includes(data.outputFormat) ? {outputFormat:data.outputFormat}:{}),
      ...(typeof data.productionItemId === 'string' && /^[a-f0-9-]{36}$/i.test(data.productionItemId) ? {productionItemId:data.productionItemId}:{}),
      ...(typeof data.sceneGenerationId === 'string' && /^[a-f0-9-]{36}$/i.test(data.sceneGenerationId) ? {sceneGenerationId:data.sceneGenerationId}:{}),
      ...(data.sizeAnnotationMode==='source-preserved-v1' ? {sizeAnnotationMode:data.sizeAnnotationMode}:{}),
      ...(data.detailLayoutMode==='chinese-editorial-v2' ? {detailLayoutMode:data.detailLayoutMode}:{}),
      ...(typeof data.sceneId === 'string' && /^[a-z0-9-]{1,100}$/.test(data.sceneId) ? {sceneId:data.sceneId}:{}),
      ...(data.batchSettings && ['auto', 'none', 'custom'].includes(data.batchSettings.propsMode) && typeof data.batchSettings.propsText === 'string' && data.batchSettings.propsText.length <= 400 ? { batchSettings: { propsMode: data.batchSettings.propsMode, propsText: data.batchSettings.propsText.trim() } } : {}),
      ...(typeof data.quality === 'string' && /^[a-zA-Z0-9_-]{1,30}$/.test(data.quality) ? { quality: data.quality } : {}) };
  } catch { return null; }
}
