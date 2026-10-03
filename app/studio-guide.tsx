'use client';

import { studioSteps, type StudioReadiness, type StudioStep } from '../lib/studio-onboarding';

export function StudioSteps({ step, onChange }: { step: StudioStep; onChange: (step: StudioStep) => void }) {
  const current = studioSteps.find(item => item.id === step)!;
  return <div className="studio-guide">
    <nav aria-label="制作一张图片的步骤"><ol>{studioSteps.map((item, index) => <li key={item.id}><button type="button" aria-current={step === item.id ? 'step' : undefined} onClick={() => onChange(item.id)}><span>{index + 1}</span>{item.title}</button></li>)}</ol></nav>
    <h2 id="studio-step-title" tabIndex={-1}>{current.title}</h2><p>{current.help}</p>
  </div>;
}

export function GenerationReadiness({ state, onNavigate }: { state: StudioReadiness; onNavigate: (view: string) => void }) {
  return <div className={`generation-readiness ${state.ready ? 'is-ready' : 'needs-action'}`} role="status">
    <div><strong>{state.title}</strong><p>{state.detail}</p></div>
    {state.action && <button type="button" onClick={() => onNavigate(state.action!.view)}>{state.action.label} →</button>}
  </div>;
}

export function StudioReview({ artwork, frame, color, purpose, instruction, scene, onEdit }: {
  artwork?: string; frame?: string; color: string; purpose: string; instruction: string; scene?: string; onEdit?: (step: StudioStep) => void;
}) {
  return <section className="studio-review" aria-label="本次生成内容">
    <h3>这次要生成的图片</h3>
    <dl><div><dt>图案</dt><dd>{artwork || '尚未选择'}</dd></div><div><dt>框架</dt><dd>{frame || '尚未选择'} · {color}</dd></div><div><dt>用途</dt><dd>{purpose}</dd></div>{scene && <div><dt>场景</dt><dd>{scene}</dd></div>}</dl>
    <p>{instruction.trim() || '使用所选用途的默认要求'}</p>
    {onEdit && <div className="review-edit-actions"><button type="button" onClick={() => onEdit('materials')}>修改搭配</button><button type="button" onClick={() => onEdit('brief')}>修改要求</button></div>}
  </section>;
}
