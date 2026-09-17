// RunningHub official schemas checked on 2026-09-09. Keep endpoint-specific
// options together so the browser and server accept the same parameters.
import {internationalCompositionModels} from './international-composition-models';
export type ImageModel = {
  id: string;
  name: string;
  endpoint: string;
  ratios: readonly string[];
  resolutions: readonly string[];
  qualities: readonly string[];
  backgrounds?: readonly string[];
  outputFormats?: readonly string[];
  maxImages?: number;
  maxPromptLength?: number;
  source: string;
  region?: 'cn' | 'international';
  appId?: string;
  note?: string;
  apiMode?: 'openai-compatible';
  catalogEndpoint?:string;
};

const commonRatios = ['1:1', '3:4', '4:3', '2:3', '3:2', '4:5', '5:4', '9:16', '16:9', '21:9'];
export const imageModels: readonly ImageModel[] = [
  ...internationalCompositionModels,
  {
    id: 'gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst · 图片编辑',
    endpoint: '/openapi/v2/rhart-image-g-2.5-official-token/sunburst/edit',
    ratios: [...commonRatios, '1:2', '2:1', '1:3', '3:1', '9:21'],
    resolutions: ['1k', '2k', '4k'], qualities: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'],
    backgrounds: ['auto', 'transparent', 'opaque'], outputFormats: ['png', 'jpeg', 'webp'],
    maxImages: 16, maxPromptLength: 32000,
    source: 'https://www.runninghub.ai/zh-cn/call-api/api-detail/2133100000000800376',
    note: '沿用国际站企业级共享 Key。高质量档位会增加耗时与 token 用量，按实际用量计费；透明背景请选择 PNG 或 WebP。',
  },
  {
    id: 'gpt-image-2', name: 'GPT Image 2',
    endpoint: '/openapi/v2/rhart-image-g-2-official/image-to-image',
    ratios: [...commonRatios, '1:2', '2:1', '1:3', '3:1', '9:21'],
    resolutions: ['1k', '2k', '4k'], qualities: ['low', 'medium', 'high'],
    source: 'https://www.runninghub.ai/runninghub-api-doc-en/api-448969336',
  },
  {
    id: 'nano-banana-pro', name: 'Nano Banana Pro',
    endpoint: '/openapi/v2/rhart-image-n-pro-official/edit',
    ratios: commonRatios, resolutions: ['1k', '2k', '4k'], qualities: [],
    source: 'https://www.runninghub.ai/runninghub-api-doc-en/api-448184497',
  },
  {
    id: 'nano-banana-2', name: 'Nano Banana 2',
    endpoint: '/openapi/v2/rhart-image-n-g31-flash-official/image-to-image',
    ratios: [...commonRatios, '1:4', '4:1', '1:8', '8:1'],
    resolutions: ['1k', '2k', '4k'], qualities: [],
    source: 'https://www.runninghub.ai/runninghub-api-doc-en/api-448184501',
  },
];

// New work uses the owner's selected official GPT Image 2 channel.
// Historical tasks keep their recorded model and are never silently migrated.
export const defaultImageModel = imageModels.find(model => model.id === 'gpt-image-2')!;
export function getImageModel(id: string) { return imageModels.find((model) => model.id === id); }
export const qualityLabels: Record<string, string> = { auto: '自动', low: '快速', medium: '标准', high: '精细', xhigh: '超精细 · 用量更高', max: '最高质量 · 用量更高' };
export const backgroundLabels: Record<string, string> = { auto: '自动', transparent: '透明背景', opaque: '不透明背景' };

export function validModelSettings(model: ImageModel, ratio: string, resolution: string, quality?: string, background?: string, outputFormat?: string) {
  return model.ratios.includes(ratio) && model.resolutions.includes(resolution)
    && (model.qualities.length ? model.qualities.includes(quality || 'medium') : !quality)
    && (model.backgrounds?.length ? model.backgrounds.includes(background || 'auto') : !background)
    && (model.outputFormats?.length ? model.outputFormats.includes(outputFormat || 'png') : !outputFormat)
    && !(background === 'transparent' && outputFormat === 'jpeg');
}
