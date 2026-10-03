import { isActiveGeneration, type GenerationTask } from './generation-types';
export function latestGenerationNotice(tasks: GenerationTask[], activeId: string) {
  const task = tasks.find(item => item.id === activeId) || tasks.reduce<GenerationTask|undefined>((latest,item) => !latest || item.createdAt > latest.createdAt ? item : latest,undefined);
  if (!task || task.status === 'succeeded') return null;
  if (task.status === 'unknown') return {task,kind:'attention' as const,title:'这次提交需要核对',detail:'暂时不能确定是否已经创建任务。先查看记录并核对服务商结果，再决定下一步。'};
  if (task.status === 'failed') return {task,kind:'failed' as const,title:'这张没有完成',detail:'搭配和文字要求仍保留。可以带回设置修改，核对后再手动生成。'};
  if (isActiveGeneration(task.status)) return {task,kind:'working' as const,title:'图片正在制作中',detail:'可以查看任务进度，生成完成后会保存。无需再次点击生成。'};
  return null;
}
