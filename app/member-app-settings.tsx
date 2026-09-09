'use client';
import { useEffect, useState } from 'react';
import { compileAppInputs, initialAppSetup, promptCandidates, type AppSpec, type AppSetup } from '../lib/runninghub-app-schema';

export function MemberAppSettings({ modelId, configured, referenceCount, disabled, onChange }: { modelId: string; configured: boolean; referenceCount: number; disabled: boolean; onChange: (value: { spec: AppSpec; setup: AppSetup } | null) => void }) {
  const [spec, setSpec] = useState<AppSpec | null>(null);
  const [setup, setSetup] = useState<AppSetup | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setSpec(null); setSetup(null); setError(''); onChange(null);
    if (!configured) { setLoading(false); return () => abort.abort(); }
    setLoading(true);
    fetch(`/api/runninghub/apps/${encodeURIComponent(modelId)}`, { cache: 'no-store', signal: abort.signal }).then(async (response) => {
      const data = await response.json() as AppSpec & { error?: string };
      if (!response.ok) throw new Error(data.error || '读取失败。');
      if (abort.signal.aborted) return;
      const next = initialAppSetup(data, referenceCount); setSpec(data); setSetup(next); onChange({ spec: data, setup: next });
    }).catch((cause) => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '读取失败。'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
    // onChange only reports state; it does not change the upstream app identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, configured, referenceCount, revision]);
  function update(next: AppSetup) { if (!spec) return; setSetup(next); onChange({ spec, setup: next }); }
  let validation = '';
  if (spec && setup) { try { compileAppInputs(spec, setup, Array.from({ length: referenceCount }, (_, i) => `reference-${i}`), '制作要求'); } catch (cause) { validation = cause instanceof Error ? cause.message : '请确认输入参数。'; } }
  return <section className="member-app-settings">
    <div className="row-label"><strong>会员应用参数</strong><button type="button" disabled={!configured || loading || disabled} onClick={() => setRevision((v) => v + 1)}>{loading ? '正在读取…' : '重新读取参数'}</button></div>
    {!configured ? <p>先在下方保存消费级-会员 Key，随后读取此应用真实支持的模型、比例和清晰度。</p> : loading ? <p role="status">正在读取应用输入项，不会提交生图。</p> : error ? <p className="generation-warning" role="alert">{error}</p> : null}
    {spec && setup && <fieldset className="image-output-options" disabled={disabled}>
      <legend>{spec.name}</legend>
      <label>制作要求对应的输入<select value={setup.promptKey} onChange={(e) => update({ ...setup, promptKey: e.target.value })}><option value="">请选择文本输入</option>{promptCandidates(spec).map((f) => <option value={f.key} key={f.key}>{f.label}</option>)}</select></label>
      {Array.from({ length: referenceCount }, (_, index) => <label key={index}>{referenceCount === 2 && index === 0 ? '框架参考图' : '图案参考图'}<select value={setup.imageKeys[index] || ''} onChange={(e) => { const imageKeys = Array.from({ length: referenceCount }, (_, i) => i === index ? e.target.value : setup.imageKeys[i] || ''); update({ ...setup, imageKeys }); }}><option value="">请选择图像输入</option>{spec.fields.filter((f) => f.type === 'IMAGE').map((f) => <option value={f.key} key={f.key}>{f.label}</option>)}</select></label>)}
      {spec.fields.filter((f) => f.type !== 'IMAGE' && f.key !== setup.promptKey).map((field) => <label key={field.key}>{field.label}{field.type === 'LIST' ? <select value={setup.values[field.key] || ''} disabled={/batch|num_images|image_count/i.test(field.fieldName)} onChange={(e) => update({ ...setup, values: { ...setup.values, [field.key]: e.target.value } })}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'BOOLEAN' ? <select value={(setup.values[field.key] || 'false').toLowerCase()} onChange={(e) => update({ ...setup, values: { ...setup.values, [field.key]: e.target.value } })}><option value="true">开启</option><option value="false">关闭</option></select> : <input type={['INT','FLOAT'].includes(field.type) ? 'number' : 'text'} step={field.type === 'FLOAT' ? 'any' : '1'} maxLength={4000} disabled={/batch|num_images|image_count/i.test(field.fieldName)} value={setup.values[field.key] || ''} onChange={(e) => update({ ...setup, values: { ...setup.values, [field.key]: e.target.value } })} />}</label>)}
      {validation && <p className="generation-warning" role="status">{validation}</p>}
      <p>以上选项来自应用接口，提交时会再次核对。未使用的图像输入会清空，避免混入示例图片。应用没有提供的设置不会强行传入。</p>
    </fieldset>}
  </section>;
}
