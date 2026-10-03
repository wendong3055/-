import { isActiveGeneration, type GenerationTask } from './generation-types';
import { getImageModel } from './generation-models';
export type HistoryStatus = 'all' | 'active' | 'succeeded' | 'attention';
export type HistoryRange = 'all' | '7' | '30';
export type HistoryFilters = { query: string; status: HistoryStatus; range: HistoryRange; model: string; favoritesOnly: boolean; delivery?: boolean };
export function historyModelName(id: string) { return getImageModel(id)?.name || (id.startsWith('custom-') ? '自定义模型' : id); }
export function filterGenerationHistory(tasks: GenerationTask[], filters: HistoryFilters, now = Date.now()) {
  const query = filters.query.trim().toLocaleLowerCase('zh-CN');
  const since = filters.range === 'all' ? -Infinity : now - Number(filters.range) * 86400000;
  return tasks.filter(task => {
    if (filters.delivery && task.status !== 'succeeded') return false;
    if (filters.status === 'active' && !isActiveGeneration(task.status)) return false;
    if (filters.status === 'succeeded' && task.status !== 'succeeded') return false;
    if (filters.status === 'attention' && task.status !== 'failed' && task.status !== 'unknown') return false;
    if (filters.favoritesOnly && (!task.favorite || task.status !== 'succeeded' || !task.url)) return false;
    if (filters.model && task.model !== filters.model) return false;
    if (task.createdAt < since) return false;
    return !query || `${task.name} ${task.recipe?.instruction || ''} ${task.model} ${historyModelName(task.model)} ${task.id} ${task.remoteTaskId || ''}`.toLocaleLowerCase('zh-CN').includes(query);
  }).sort((a, b) => b.createdAt - a.createdAt);
}
