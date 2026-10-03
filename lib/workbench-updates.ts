export type WorkbenchUpdate = {
  id: string;
  date: string;
  time?: string;
  title: string;
  summary: string;
  changes: { title: string; detail: string }[];
};

// Keep this release history alongside the feature change that it describes.
export const workbenchUpdates: WorkbenchUpdate[] = [
  {
    id: '2026-10-03', date: '2026-10-03', title: '优化记录与试稿查找',
    summary: '每次改动有处可查，满意的试稿更容易找回。',
    changes: [
      { title: '网页内查看优化记录', detail: '侧栏新增“优化记录”，按日期查看本轮与 10 月 2 日更新的具体内容。' },
      { title: '组合筛选生成记录', detail: '按关键词、任务状态、时间范围和模型查找，也可以只看已收藏的结果。' },
      { title: '在记录中直接收藏', detail: '在生成任务页面收藏或取消收藏，与预览区同步；记录较多时可翻页浏览。' },
    ],
  },
  {
    id: '2026-10-02', date: '2026-10-02', time: '23:56', title: '两版对比与样稿验收',
    summary: '对照每轮变化，再决定是否继续批量制作。',
    changes: [
      { title: '预览区对比两版', detail: '选择两张已完成图片，共享缩放倍率、显示方式和全屏视图。' },
      { title: '看清每轮改了什么', detail: '根据保存的图案、框架、木色、要求和出图设置显示差异。相同设置标为重新试做，旧记录缺少设置时明确提示。' },
      { title: '收藏满意的版本', detail: '收藏跟随登录账号保存，刷新后仍可从试稿记录中筛选出来。' },
      { title: '先做样稿再做余图', detail: '批量先生成一张并暂停，验收后需再次点击继续。尺寸页先做统一背景样稿，全套先做主图样稿。' },
      { title: '衔接样稿与后续制作', detail: '主图余图参考已认可的主图样稿，沿用模型、画质和摆件设置；单张调整、重做后可重新验收。' },
      { title: '核对后再提交下一张', detail: '取消、状态不明或样稿验收变化时停止后续提交；失败不会自动重试。' },
    ],
  },
];
