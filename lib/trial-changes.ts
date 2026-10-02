import type { GenerationTask } from './generation-types';
import { studioIntents } from './studio-brief';
export type TrialChange = { label: string; before: string; after: string };
export type RecipeLabel = (kind: 'artwork' | 'frame' | 'color' | 'scene', id: string) => string;
const names: Record<string, string> = { auto: '自动', low: '快速', medium: '标准', high: '精细', transparent: '透明', opaque: '不透明', 'gpt-image-2': 'GPT Image 2', 'gpt-image-2.5-sunburst': 'GPT Image 2.5' };
export function trialChanges(current: GenerationTask, previous?: GenerationTask, resolve?: RecipeLabel): TrialChange[] | null {
  if (!previous || !current.recipe || !previous.recipe) return null;
  const changes: TrialChange[] = [];
  const add = (label: string, before: string | undefined, after: string | undefined) => {
    if ((before || '') !== (after || '')) changes.push({ label, before: before || '未记录', after: after || '未记录' });
  };
  for (const [key, kind, label] of [['artworkId', 'artwork', '图案'], ['frameId', 'frame', '框架'], ['colorId', 'color', '木色'], ['sceneId', 'scene', '场景']] as const) {
    const old = previous.recipe[key], next = current.recipe[key];
    if ((old || '') !== (next || '')) changes.push({ label, before: old ? resolve?.(kind, old) || old : '未选择', after: next ? resolve?.(kind, next) || next : '未选择' });
  }
  add('用途', studioIntents.find(i => i.id === previous.recipe?.intent)?.name, studioIntents.find(i => i.id === current.recipe?.intent)?.name);
  add('制作要求', previous.recipe.instruction, current.recipe.instruction);
  add('模型', names[previous.model] || previous.model, names[current.model] || current.model);
  add('画幅', previous.aspectRatio, current.aspectRatio);
  add('分辨率', previous.resolution?.toUpperCase(), current.resolution?.toUpperCase());
  add('画质', names[previous.recipe.quality || ''] || previous.recipe.quality, names[current.recipe.quality || ''] || current.recipe.quality);
  add('背景', names[previous.recipe.background || ''] || previous.recipe.background, names[current.recipe.background || ''] || current.recipe.background);
  add('格式', previous.recipe.outputFormat?.toUpperCase(), current.recipe.outputFormat?.toUpperCase());
  return changes;
}
export function previousTrial(current: GenerationTask, tasks: GenerationTask[]) {
  return tasks.filter(t => t.status === 'succeeded' && t.url && t.id !== current.id && t.createdAt < current.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}
