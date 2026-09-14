'use client';
import { useCallback, useEffect, useState } from 'react';
import { customImageModel, type CustomImageConfig } from '../lib/custom-image-config';

export function useCustomProviders() {
  const [providers, setProviders] = useState<CustomImageConfig[]>([]);
  const [canSaveKey, setCanSaveKey] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/image-providers', { cache: 'no-store' });
      const p = await r.json() as { providers: CustomImageConfig[]; canSaveKey: boolean; error?: string };
      if (!r.ok || !Array.isArray(p.providers)) throw new Error(p.error || '接口列表读取失败。');
      setProviders(p.providers); setCanSaveKey(p.canSaveKey); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '接口列表读取失败。'); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { providers, models: providers.map(customImageModel), canSaveKey, error, loaded, refresh };
}
const blank = { id: '', name: '', baseUrl: '', modelName: '', editPath: '/images/edits', format: 'multipart' as 'multipart'|'json', sizes: 'auto, 1024x1024, 1024x1536, 1536x1024', qualities: '', imageHosts: '' };
export function CustomApiSettings({ controller, busy, onSelect }: { controller: ReturnType<typeof useCustomProviders>; busy: boolean; onSelect: (id: string) => void }) {
  const [draft, setDraft] = useState(blank), [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  const disabled = busy || saving;
  function edit(p?: CustomImageConfig) {
    setDraft(p ? { ...p, sizes: p.sizes.join(', '), qualities: p.qualities.join(', '), imageHosts: p.imageHosts.join(', ') } : blank);
    setApiKey(''); setMessage('');
  }
  async function save() {
    if (disabled) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/image-providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...draft, apiKey }) });
      const payload = await response.json() as { provider: CustomImageConfig; error?: string };
      if (!response.ok) throw new Error(payload.error || '保存失败。');
      setApiKey(''); await controller.refresh(); setDraft(d => ({ ...d, id: payload.provider.id }));
      setMessage('已加密保存。尚未调用模型；回到新品页选择此接口后，再确认生成。');
    } catch (e) { setMessage(e instanceof Error ? e.message : '保存失败，请重试。'); }
    finally { setSaving(false); }
  }
  return <section className="custom-api-settings" aria-label="自定义生图API">
    <header><div><span className="api-label">多平台接入</span><h3>接入你自己的生图 API</h3><p>填写服务商地址、密钥和模型 ID。RunningHub 与自定义接口互相独立。</p></div><button type="button" onClick={() => edit()} disabled={disabled}>＋ 新增接口模型</button></header>
    <div className="api-provider-list">{controller.providers.map(p => <article key={p.id}><div><strong>{p.name}</strong><span>{p.modelName}</span><small>{p.baseUrl}</small></div><div><button type="button" disabled={disabled} onClick={() => edit(p)}>编辑配置</button><button type="button" disabled={disabled} onClick={() => onSelect(customImageModel(p).id)}>选择此模型</button></div></article>)}</div>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={disabled}><legend>{draft.id ? '编辑接口模型' : '新增接口模型'}</legend>
        <div className="api-form-grid">
          <label>接口名称<input required maxLength={80} placeholder="例如：我的生图服务" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
          <label>模型 ID<input required maxLength={160} placeholder="填写服务商提供的完整模型 ID" value={draft.modelName} onChange={e => setDraft({ ...draft, modelName: e.target.value })}/></label>
          <label className="api-wide">接口地址（Base URL）<input required type="url" placeholder="https://你的服务商域名/v1" value={draft.baseUrl} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })}/><small>只填基础地址；通常包含 /v1，不包含 /images/edits。</small></label>
          <label className="api-wide">API Key<input required={!draft.id} type="password" autoComplete="off" spellCheck={false} maxLength={512} placeholder={draft.id ? '留空保留密钥；更换平台地址必须重新填写' : '粘贴此平台的 API Key'} value={apiKey} onChange={e => setApiKey(e.target.value)}/><small>仅加密保存在当前账号的服务端，不回显、不写入浏览器存储。</small></label>
          <label>参考图传输格式<select value={draft.format} onChange={e => setDraft({ ...draft, format: e.target.value as 'multipart'|'json' })}><option value="multipart">OpenAI 兼容 · 文件上传</option><option value="json">OpenAI 兼容 · JSON 内嵌图片</option></select></label>
          <label>图像编辑路径<input required value={draft.editPath} onChange={e => setDraft({ ...draft, editPath: e.target.value })}/></label>
          <label className="api-wide">支持的图片尺寸<input required value={draft.sizes} onChange={e => setDraft({ ...draft, sizes: e.target.value })}/><small>按模型文档填写，用逗号分隔。尺寸决定比例；auto 表示交给模型。不要填产品厘米尺寸。</small></label>
          <label>支持的画质值（可选）<input placeholder="例如 low, medium, high；不支持则留空" value={draft.qualities} onChange={e => setDraft({ ...draft, qualities: e.target.value })}/></label>
          <label>结果图片域名（可选）<input placeholder="返回图片链接时填写 CDN 域名，逗号分隔" value={draft.imageHosts} onChange={e => setDraft({ ...draft, imageHosts: e.target.value })}/></label>
        </div>
        <p className="api-scope-note">适用：支持多参考图编辑，直接返回 data[0].b64_json 或 data[0].url 的接口。原生 Gemini、聊天接口、异步任务型接口不能直接套用此格式，需按该平台文档适配。没有填写的画质参数不会发送。</p>
        <p className="api-privacy-note">确认生成时，所选参考图与中文制作要求只发送到你配置的服务商；费用由该服务商收取。保存配置不会生图。参考图合计最多8MB；超大结果请到服务商后台下载。</p>
        <button className="primary-button" type="submit" disabled={!controller.canSaveKey}>{saving ? '正在加密保存…' : '保存接口配置'}</button>
        {!controller.canSaveKey && <p role="status">密钥安全存储暂不可用，当前不能保存。{controller.error || '请等待配置加载，或联系管理员。'}</p>}
        {message && <p role="status">{message}</p>}
      </fieldset>
    </form>
    {controller.error && <p role="status">{controller.error} <button type="button" onClick={() => void controller.refresh()}>重新读取</button></p>}
  </section>;
}
