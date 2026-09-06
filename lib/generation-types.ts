export type GenerationStatus = 'uploading' | 'submitting' | 'queued' | 'running' | 'saving' | 'succeeded' | 'failed' | 'unknown';

export type GenerationTask = {
  id: string;
  name: string;
  status: GenerationStatus;
  model: string;
  aspectRatio: string;
  resolution: string;
  createdAt: number;
  error: string;
  url: string | null;
  assetId: string | null;
  remoteTaskId: string | null;
};

export const generationLabels: Record<GenerationStatus, string> = {
  uploading: '上传参考图', submitting: '提交任务', queued: '排队中', running: '生成中',
  saving: '保存图片', succeeded: '已完成', failed: '未完成', unknown: '待核对',
};
export const isActiveGeneration = (status: GenerationStatus) => !['succeeded', 'failed', 'unknown'].includes(status);
