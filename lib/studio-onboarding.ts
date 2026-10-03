export type StudioStep = 'materials' | 'brief' | 'review';
export const studioSteps: { id: StudioStep; title: string; help: string }[] = [
  { id: 'materials', title: '选搭配', help: '选一张图案，再选框架和木色。已有搭配也可以直接用。' },
  { id: 'brief', title: '写要求', help: '选图片用途。默认要求已填好，有想调整的再补充。' },
  { id: 'review', title: '核对并生图', help: '核对下面的搭配和设置，点击生成后才会提交一张图片。' },
];
export type StudioReadiness = { ready: boolean; title: string; detail: string; action?: { view: 'settings' | 'gallery' | 'frames' | 'jobs'; label: string } };
export function studioReadiness(input: {
  working: boolean; loading: boolean; busy: boolean; configured: boolean;
  originalReady: boolean; frameReady: boolean; productionMatches: boolean;
}): StudioReadiness {
  if (input.working) return { ready: false, title: '正在制作这一张', detail: '结果会自动保存。可以查看进度，无需重复点击。', action: { view: 'jobs', label: '查看生成进度' } };
  if (input.loading) return { ready: false, title: '正在读取工作台信息', detail: '读取连接和任务状态后，即可核对是否能生成。' };
  if (input.busy) return { ready: false, title: '还有任务需要等待或核对', detail: '先查看已有任务的状态，处理完成后再开始下一张。', action: { view: 'jobs', label: '查看已有任务' } };
  if (!input.configured) return { ready: false, title: '还差一步：连接生图服务', detail: '先完成 RunningHub 连接；已有图案和搭配会留在这里。', action: { view: 'settings', label: '去连接生图服务' } };
  if (!input.originalReady) return { ready: false, title: '请选一张有原图的图案', detail: '当前图案缺少原图。可以换一张，或上传清晰的 JPG、PNG、WebP 图片。', action: { view: 'gallery', label: '选择或上传图案' } };
  if (!input.frameReady) return { ready: false, title: '请选择框架图片', detail: '选择有原图的框架后，才能保留产品的完整结构。', action: { view: 'frames', label: '去选择框架' } };
  if (!input.productionMatches) return { ready: false, title: '当前搭配与已确认的产品不同', detail: '请通过上方入口返回这款产品的制作清单，再打开要调整的图片。' };
  return { ready: true, title: '已具备生图条件', detail: '将按当前设置生成 1 张。费用和可用额度以 RunningHub 账户为准。' };
}
