import { isStudioIntent, type StudioIntent } from './studio-brief';
import type { ImageModel } from './generation-models';
import type { StudioStep } from './studio-onboarding';

export type StudioDraft = {
  artworkId: string; frameId: string; colorId: string; sceneId: string;
  intent: StudioIntent; instruction: string; modelId: string;
  aspectRatio: string; resolution: string; quality: string; background: string; outputFormat: string;
  step: StudioStep;
};
export type SavedStudioDraft = { data: StudioDraft; revision: number; updatedAt: number };
const fields = ['artworkId','frameId','colorId','sceneId','intent','instruction','modelId','aspectRatio','resolution','quality','background','outputFormat','step'] as const;

export function parseStudioDraft(value: unknown): StudioDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !fields.includes(key as typeof fields[number]))) return null;
  if (fields.some(key => typeof data[key] !== 'string' || (data[key] as string).length > (key === 'instruction' ? 1500 : 160))) return null;
  if (!['artworkId','frameId','colorId','modelId','aspectRatio','resolution'].every(key => (data[key] as string).trim())) return null;
  if (!isStudioIntent(data.intent as string) || !['materials','brief','review'].includes(data.step as string)) return null;
  return Object.fromEntries(fields.map(key => [key, data[key]])) as StudioDraft;
}

export function studioDraftIssues(draft: StudioDraft, catalog: {
  artworkIds: string[]; frameIds: string[]; colorIds: string[]; sceneIds: string[]; models: readonly ImageModel[];
}): string[] {
  const issues: string[] = [];
  if (!catalog.artworkIds.includes(draft.artworkId)) issues.push('原来的图案当前不可选');
  if (!catalog.frameIds.includes(draft.frameId)) issues.push('原来的框架当前不可选');
  if (!catalog.colorIds.includes(draft.colorId)) issues.push('原来的木色当前不可选');
  if (draft.sceneId && !catalog.sceneIds.includes(draft.sceneId)) issues.push('原来的场景当前不可选');
  const model = catalog.models.find(item => item.id === draft.modelId);
  if (!model) issues.push('原来的模型已不可用');
  else {
    if (!model.ratios.includes(draft.aspectRatio) || !model.resolutions.includes(draft.resolution) || (model.qualities.length > 0 && !model.qualities.includes(draft.quality)) || (model.backgrounds?.length && !model.backgrounds.includes(draft.background)) || (model.outputFormats?.length && !model.outputFormats.includes(draft.outputFormat))) issues.push('原来的出图参数已不受支持');
  }
  return issues;
}
