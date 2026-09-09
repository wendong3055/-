// RunningHub official schemas checked on 2026-09-09. Keep endpoint-specific
// options together so the browser and server accept the same parameters.
export type ImageModel = {
  id: string;
  name: string;
  endpoint: string;
  ratios: readonly string[];
  resolutions: readonly string[];
  qualities: readonly string[];
  source: string;
};

const commonRatios = ['1:1', '3:4', '4:3', '2:3', '3:2', '4:5', '5:4', '9:16', '16:9', '21:9'];
export const imageModels: readonly ImageModel[] = [
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

export const defaultImageModel = imageModels[0];
export function getImageModel(id: string) { return imageModels.find((model) => model.id === id); }
export const qualityLabels: Record<string, string> = { low: '快速', medium: '标准', high: '精细' };

export function validModelSettings(model: ImageModel, ratio: string, resolution: string, quality?: string) {
  return model.ratios.includes(ratio) && model.resolutions.includes(resolution)
    && (model.qualities.length ? model.qualities.includes(quality || 'medium') : !quality);
}
