// RunningHub official schemas checked on 2026-09-09. Keep endpoint-specific
// options together so the browser and server accept the same parameters.
import { verifiedRunningHubApps } from './runninghub-apps';
export type ImageModel = {
  id: string;
  name: string;
  endpoint: string;
  ratios: readonly string[];
  resolutions: readonly string[];
  qualities: readonly string[];
  source: string;
  region?: 'cn' | 'international';
  appId?: string;
  note?: string;
  apiMode?: 'member-app';
};

const commonRatios = ['1:1', '3:4', '4:3', '2:3', '3:2', '4:5', '5:4', '9:16', '16:9', '21:9'];
export const imageModels: readonly ImageModel[] = [
  ...verifiedRunningHubApps.map((app): ImageModel => ({ id: `member-app-${app.id}`, name: app.name, region: 'cn', apiMode: 'member-app', appId: app.id,
    endpoint: '/task/openapi/ai-app/run', ratios: [], resolutions: [], qualities: [], source: 'https://www.runninghub.cn/ai-apps',
    note: '消费级-会员 Key 调用 AI 应用；按该应用的会员接口权益与附加费用规则结算。' })),
  {
    id: 'cn-rhart-image-g-2', name: '全能图片G-2.0 · 图生图 · 低价渠道版', region: 'cn', appId: '2046794946094571522',
    endpoint: '/openapi/v2/rhart-image-g-2/image-to-image',
    ratios: [...commonRatios, '1:2', '2:1', '1:3', '3:1', '9:21'], resolutions: ['1k', '2k', '4k'], qualities: [],
    source: 'https://www.runninghub.cn/runninghub-api-doc-cn/api-448183227',
    note: '低价渠道稳定性较低；选择 2K/4K 也可能返回 1K，以平台实际输出为准。',
  },
  {
    id: 'cn-rhart-image-n-pro', name: '全能图片PRO · 图生图 · 低价渠道版', region: 'cn', appId: '2061690429824917505',
    endpoint: '/openapi/v2/rhart-image-n-pro/edit', ratios: commonRatios, resolutions: ['1k', '2k', '4k'], qualities: [],
    source: 'https://www.runninghub.cn/runninghub-api-doc-cn/api-448183220', note: '低价渠道稳定性较低，按实际 API 调用计费。',
  },
  {
    id: 'cn-rhart-image-n-pro-ultra', name: '全能图片PRO · 图生图Ultra · 官方稳定版', region: 'cn', appId: '2061718706446753793',
    endpoint: '/openapi/v2/rhart-image-n-pro-official/edit-ultra', ratios: commonRatios, resolutions: ['4k', '8k'], qualities: [],
    source: 'https://www.runninghub.cn/runninghub-api-doc-cn/api-448183218', note: '支持 4K/8K，费用与低价渠道不同，请确认账号接口权限。',
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

export const defaultImageModel = imageModels[0];
export function getImageModel(id: string) { return imageModels.find((model) => model.id === id); }
export const qualityLabels: Record<string, string> = { low: '快速', medium: '标准', high: '精细' };

export function validModelSettings(model: ImageModel, ratio: string, resolution: string, quality?: string) {
  return model.ratios.includes(ratio) && model.resolutions.includes(resolution)
    && (model.qualities.length ? model.qualities.includes(quality || 'medium') : !quality);
}
