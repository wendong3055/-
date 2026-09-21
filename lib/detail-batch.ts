import type { ProductionItem } from './production-plan';
import type { GenerationTask } from './generation-types';

export function detailCandidates(items:ProductionItem[],retry=false) {
  return items.filter(i=>i.kind==='detail' && (retry
    ? i.task?.status==='failed'||(i.task?.status==='succeeded'&&i.review==='rework')
    : !i.generationId&&!i.task));
}

// One submission per item. Failed/ambiguous results stop the queue; never retry
// a billable call automatically. Refresh/unmount only stops future submissions.
export async function runDetailBatch(items:ProductionItem[],io:{
  stopped:()=>boolean; submit:(item:ProductionItem)=>Promise<GenerationTask>;
  poll:(id:string)=>Promise<GenerationTask>; wait:()=>Promise<void>;
  progress:(item:ProductionItem,task:GenerationTask)=>void|Promise<void>; maxPolls?:number;
}) {
  for(const item of items){
    if(io.stopped())return;
    let task=await io.submit(item);await io.progress(item,task);
    let count=0;
    while(!['succeeded','failed','unknown'].includes(task.status)){
      if(io.stopped())return;
      if(count++>=(io.maxPolls??100))throw new Error('查询已暂停，请先刷新核对原任务；不会重复提交。');
      await io.wait();if(io.stopped())return;
      task=await io.poll(task.id);await io.progress(item,task);
    }
    if(task.status!=='succeeded'||!task.url)throw new Error(`${item.title}：${task.error||'任务未成功保存，整套制作已暂停。请核对后仅重试失败页。'}`);
  }
}
