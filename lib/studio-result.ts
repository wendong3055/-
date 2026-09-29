import type { GenerationTask } from './generation-types';
import type { GenerationRecipe } from './studio-brief';

export function isPreviousResult(task: GenerationTask | undefined, current: GenerationRecipe): boolean {
  if (!task?.recipe) return false;
  return (['artworkId', 'frameId', 'colorId', 'intent', 'instruction', 'sceneId'] as const)
    .some(key => (task.recipe![key] || '').trim() !== (current[key] || '').trim());
}
