'use client';
import { useEffect, useRef, useState } from 'react';
import { appOutputField, compileAppInputs, initialAppSetup, promptCandidates, setupForReferences, type AppField, type AppSpec, type AppSetup, type OutputFieldKind } from '../lib/runninghub-app-schema';

type AppInputs = { spec: AppSpec; setup: AppSetup };
type LoadedApp = { identity: string; inputs: AppInputs | null; error: string; loading: boolean };

// One shared controller stays mounted in Home, including while the settings view is open.
export function useMemberApp({ modelId, configured, referenceCount, configRevision }: { modelId: string; configured: boolean; referenceCount: number; configRevision: number }) {
  const [loaded, setLoaded] = useState<LoadedApp | null>(null);
  const [revision, setRevision] = useState(0);
  const countRef = useRef(referenceCount);
  countRef.current = referenceCount;
  const identity = `${modelId}:${configRevision}:${revision}`;
  const enabled = Boolean(modelId && configured);
  const current = enabled && loaded?.identity === identity ? loaded : null;
  const inputs = current?.inputs ? { spec: current.inputs.spec, setup: setupForReferences(current.inputs.spec, current.inputs.setup, referenceCount) } : null;
  const loading = enabled && (!current || current.loading);
  useEffect(() => {
    const abort = new AbortController();
    if (!enabled) { setLoaded(null); return () => abort.abort(); }
    setLoaded({ identity, inputs: null, loading: true, error: '' });
    fetch(`/api/runninghub/apps/${encodeURIComponent(modelId)}`, { cache: 'no-store', signal: abort.signal }).then(async (response) => {
      const data = await response.json() as AppSpec & { error?: string };
      if (!response.ok) throw new Error(data.error || '读取失败。');
      if (data.appId !== modelId.replace(/^member-app-/, '')) throw new Error('应用参数不匹配，请重新读取。');
      if (abort.signal.aborted) return;
      setLoaded({ identity, inputs: { spec: data, setup: initialAppSetup(data, countRef.current) }, loading: false, error: '' });
    }).catch((cause) => {
      if (!abort.signal.aborted) setLoaded({ identity, inputs: null, loading: false, error: cause instanceof Error ? cause.message : '读取失败。' });
    });
    return () => abort.abort();
  }, [modelId, enabled, identity]);
  function update(setup: AppSetup) {
    setLoaded((previous) => previous?.identity === identity && previous.inputs ? { ...previous, inputs: { spec: previous.inputs.spec, setup } } : previous);
  }
  let validation = '';
  if (inputs) {
    try { compileAppInputs(inputs.spec, inputs.setup, Array.from({ length: referenceCount }, (_, i) => `reference-${i}`), '制作要求'); }
    catch (cause) { validation = cause instanceof Error ? cause.message : '请确认输入参数。'; }
  }
  return { inputs, configured, loading, error: current?.error || '', validation, update, reload: () => setRevision((value) => value + 1) };
}
export type MemberAppController = ReturnType<typeof useMemberApp>;

export function AppFieldControl({ field, setup, label = field.label, disabled = false, onChange }: { field: AppField; setup: AppSetup; label?: string; disabled?: boolean; onChange: (setup: AppSetup) => void }) {
  const value = setup.values[field.key] ?? field.value;
  const locked = disabled || /batch|num_images|image_count/i.test(field.fieldName);
  const change = (next: string) => onChange({ ...setup, values: { ...setup.values, [field.key]: next } });
  return <label>{label}{field.type === 'LIST' ? <select value={value} disabled={locked} onChange={(event) => change(event.target.value)}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'BOOLEAN' ? <select value={value.toLowerCase() || 'false'} disabled={locked} onChange={(event) => change(event.target.value)}><option value="true">开启</option><option value="false">关闭</option></select> : <input type={['INT', 'FLOAT'].includes(field.type) ? 'number' : 'text'} step={field.type === 'FLOAT' ? 'any' : '1'} maxLength={4000} disabled={locked} value={value} onChange={(event) => change(event.target.value)} />}</label>;
}

const outputLabels: Record<OutputFieldKind, string> = { ratio: '图片比例', resolution: '清晰度 / 分辨率', quality: '生成质量', model: '应用内模型' };
export function MemberOutputOptions({ controller, disabled, onSettings, onChange }: { controller: MemberAppController; disabled: boolean; onSettings: () => void; onChange: () => void }) {
  const { inputs, loading, configured, error, validation } = controller;
  const update = (setup: AppSetup) => { controller.update(setup); onChange(); };
  const placeholder = !configured ? '请先完成后台连接' : loading ? '正在读取可用选项…' : error ? '参数读取失败' : '由应用自动决定';
  const controls = (['ratio', 'resolution', 'quality', 'model'] as const).map((kind) => {
    const field = inputs && appOutputField(inputs.spec, kind);
    if (field && inputs) return <AppFieldControl key={kind} field={field} setup={inputs.setup} label={outputLabels[kind]} disabled={disabled} onChange={update} />;
    if (kind === 'quality' || kind === 'model') return null;
    return <label key={kind}>{outputLabels[kind]}<select disabled value=""><option value="">{placeholder}</option></select></label>;
  });
  return <div className="member-output-options">
    <div className="output-fields">{controls}</div>
    {!configured ? <div className="output-setup-notice" role="status"><span>当前会员应用尚未连接，连接后可选择它支持的比例与清晰度。</span><button type="button" onClick={onSettings}>前往后台设置 →</button></div> : loading ? <p role="status">正在读取当前应用的可选参数，不会发起生图。</p> : error || validation ? <div className="output-setup-notice" role="status"><span>{error ? '暂时无法读取可用参数，请在后台检查连接并重试。' : '应用输入尚未配置完整，请到后台确认。'}</span><button type="button" onClick={onSettings}>检查后台设置 →</button></div> : <p>按当前应用支持的选项出图；自动项由应用决定。</p>}
  </div>;
}

export function MemberAppSettings({ controller, referenceCount, disabled }: { controller: MemberAppController; referenceCount: number; disabled: boolean }) {
  const { inputs, configured, loading, error, validation, update } = controller;
  const outputKeys = new Set(inputs ? (['ratio', 'resolution', 'quality', 'model'] as const).map((kind) => appOutputField(inputs.spec, kind)?.key).filter(Boolean) : []);
  return <section className="member-app-settings">
    <div className="row-label"><strong>应用输入绑定</strong><button type="button" disabled={!configured || loading || disabled} onClick={controller.reload}>{loading ? '正在读取…' : '重新读取参数'}</button></div>
    <p>绑定制作要求和参考图；比例、清晰度在做图页面调整。重新读取会恢复应用默认参数。</p>
    {!configured ? <p>先保存上方的消费级-会员 Key，再读取应用参数。</p> : loading ? <p role="status">正在读取应用输入项，不会提交生图。</p> : error ? <p className="generation-warning" role="alert">{error}</p> : null}
    {inputs && <fieldset className="image-output-options" disabled={disabled}>
      <legend>{inputs.spec.name}</legend>
      <label>制作要求对应的输入<select value={inputs.setup.promptKey} onChange={(event) => update({ ...inputs.setup, promptKey: event.target.value })}><option value="">请选择文本输入</option>{promptCandidates(inputs.spec).map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>
      {Array.from({ length: referenceCount }, (_, index) => <label key={index}>{referenceCount === 2 && index === 0 ? '框架参考图' : '图案参考图'}<select value={inputs.setup.imageKeys[index] || ''} onChange={(event) => { const imageKeys = inputs.setup.imageKeys.map((key, i) => i === index ? event.target.value : key); update({ ...inputs.setup, imageKeys }); }}><option value="">请选择图像输入</option>{inputs.spec.fields.filter((field) => field.type === 'IMAGE').map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>)}
      <details className="backend-advanced"><summary>其他应用参数</summary>{inputs.spec.fields.filter((field) => field.type !== 'IMAGE' && field.key !== inputs.setup.promptKey && !outputKeys.has(field.key)).map((field) => <AppFieldControl key={field.key} field={field} setup={inputs.setup} onChange={update} />)}</details>
      {validation && <p className="generation-warning" role="status">{validation}</p>}
      <p>未使用的图像输入会清空；每次生成 1 张。提交前会再次核对参数。</p>
    </fieldset>}
  </section>;
}
