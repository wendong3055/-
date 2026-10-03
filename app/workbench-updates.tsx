'use client';
import { workbenchUpdates } from '../lib/workbench-updates';

export function WorkbenchUpdates({ onNavigate }: { onNavigate: (view: 'new' | 'jobs') => void }) {
  return <section className="workbench-updates" aria-label="工作台优化记录">
    <header className="updates-intro"><div><h2>每次优化，留一份记录</h2><p>按日期查看改动内容和功能入口，时间按北京时间显示。</p></div><button className="ghost-button" onClick={() => onNavigate('jobs')}>查看生成记录</button></header>
    <div className="updates-timeline">{workbenchUpdates.map((update, index) => <article key={update.id} className={`update-entry${index === 0 ? ' update-latest' : ''}`}>
      <div className="update-date"><time dateTime={update.date}>{update.date.replaceAll('-', '.')}</time>{update.time && <span>{update.time} 上线</span>}{index === 0 && <b>本轮更新</b>}</div>
      <div className="update-card"><h3>{update.title}</h3><p className="update-summary">{update.summary}</p><ul>{update.changes.map(change => <li key={change.title}><strong>{change.title}</strong><p>{change.detail}</p></li>)}</ul>
        <div className="update-actions"><button onClick={() => onNavigate(index === 0 ? 'jobs' : 'new')}>{index === 0 ? '查找我的试稿' : '去预览区试用'}</button></div>
      </div>
    </article>)}</div>
    <p className="updates-note">连续批量制作仍需保持页面打开。查看优化记录、筛选或收藏图片不会提交生图任务。</p>
  </section>;
}
