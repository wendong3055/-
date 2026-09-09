export type AppField = { key: string; nodeId: string; fieldName: string; type: string; label: string; options: string[]; value: string };
export type AppSpec = { appId: string; name: string; fingerprint: string; fields: AppField[] };
export type AppSetup = { fingerprint: string; promptKey: string; imageKeys: string[]; values: Record<string, string>; fieldTypes?: Record<string, string>; referenceKeys?: string[] };
export function promptCandidates(spec: AppSpec) {
  return spec.fields.filter((f) => f.type === 'STRING' && !/negative|负面|system|系统/i.test(`${f.fieldName} ${f.label}`));
}
export function initialAppSetup(spec: AppSpec, referenceCount: number): AppSetup {
  const prompts = promptCandidates(spec);
  const preferred = prompts.filter((f) => /^(prompt|text|positive_prompt|positive)$/.test(f.fieldName));
  const prompt = preferred.length === 1 ? preferred[0] : prompts.length === 1 ? prompts[0] : undefined;
  const referenceKeys = spec.fields.filter((f) => f.type === 'IMAGE').slice(0, 2).map((f) => f.key);
  return setupForReferences(spec, { fingerprint: spec.fingerprint, promptKey: prompt?.key || '', imageKeys: referenceKeys, referenceKeys, fieldTypes: Object.fromEntries(spec.fields.map((f) => [f.key, f.type])), values: Object.fromEntries(spec.fields.filter((f) => f.type !== 'IMAGE').map((f) => [f.key, /batch|num_images|image_count/i.test(f.fieldName) ? '1' : f.value])) }, referenceCount);
}
export async function parseAppSpec(appId: string, data: unknown): Promise<AppSpec> {
  const raw = data as { webappName?: unknown; nodeInfoList?: unknown } | null;
  if (!raw || !Array.isArray(raw.nodeInfoList) || !raw.nodeInfoList.length || raw.nodeInfoList.length > 50) throw new Error('应用没有返回可用的输入参数。');
  const fields: AppField[] = [];
  for (const node of raw.nodeInfoList as Record<string, unknown>[]) {
    if (!node || typeof node !== 'object') throw new Error('应用参数格式不支持。');
    const nodeId = String(node.nodeId || ''), fieldName = String(node.fieldName || '');
    if (!/^[\w-]{1,60}$/.test(nodeId) || !/^[\w.-]{1,80}$/.test(fieldName) || /api.?key|secret|password|token|authorization/i.test(fieldName)) throw new Error('应用包含敏感或不支持的输入参数。');
    const type = String(node.fieldType || '').toUpperCase();
    if (!['IMAGE', 'STRING', 'LIST', 'INT', 'FLOAT', 'BOOLEAN'].includes(type)) throw new Error('该应用包含暂不支持的输入类型，请换一个图像应用。');
    let fieldData: unknown = node.fieldData;
    if (typeof fieldData === 'string') { try { fieldData = JSON.parse(fieldData); } catch { fieldData = []; } }
    const options = type === 'LIST' && Array.isArray(fieldData) ? fieldData.flatMap((item: unknown) => {
      if (typeof item === 'string') return [item];
      if (item && typeof item === 'object' && 'index' in item && ['string', 'number'].includes(typeof item.index)) return [String(item.index)];
      return [];
    }).filter((value) => value.length < 300).slice(0, 100) : [];
    if (type === 'LIST' && !options.length) throw new Error('应用选项列表暂时无法读取，请稍后重新读取。');
    let value = type === 'IMAGE' ? '' : String(node.fieldValue ?? '').slice(0, 4000);
    if (type === 'LIST' && !options.includes(value)) value = options[0];
    const field = { key: `${nodeId}.${fieldName}`, nodeId, fieldName, type, label: String(node.description || fieldName).slice(0, 120), options, value };
    if (fields.some((f) => f.key === field.key)) throw new Error('应用参数重复，已停止自动适配。');
    fields.push(field);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ appId, fields })));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { appId, name: String(raw.webappName || 'RunningHub 图像应用').slice(0, 160), fingerprint, fields };
}
export function compileAppInputs(spec: AppSpec, setup: AppSetup, filenames: string[], prompt: string) {
  if (!setup || setup.fingerprint !== spec.fingerprint) throw new Error('应用参数已更新，请重新读取并确认后生成。');
  if (!Array.isArray(setup.imageKeys) || setup.imageKeys.length !== filenames.length || new Set(setup.imageKeys).size !== filenames.length || !setup.imageKeys.every((key) => spec.fields.some((f) => f.key === key && f.type === 'IMAGE'))) throw new Error('请为每张参考图选择不同的应用图像输入。');
  if (!promptCandidates(spec).some((f) => f.key === setup.promptKey)) throw new Error('请确认制作要求对应的文本输入。');
  return spec.fields.map((f) => {
    let value: string;
    if (f.key === setup.promptKey) value = prompt;
    else if (f.type === 'IMAGE') { const index = setup.imageKeys.indexOf(f.key); value = index < 0 ? '' : filenames[index]; }
    else {
      value = setup.values?.[f.key] ?? f.value;
      if (typeof value !== 'string' || value.length > 4000) throw new Error('应用参数内容无效。');
      if (/batch|num_images|image_count/i.test(f.fieldName)) value = '1';
      if (f.type === 'LIST' && !f.options.includes(value)) throw new Error(`“${f.label}”不支持此选项。`);
      if (['INT', 'FLOAT'].includes(f.type) && (!value.trim() || !Number.isFinite(Number(value)) || (f.type === 'INT' && !Number.isInteger(Number(value))))) throw new Error(`“${f.label}”需要有效数字。`);
      if (f.type === 'BOOLEAN' && !['true', 'false'].includes(value.toLowerCase())) throw new Error(`“${f.label}”需要开关值。`);
    }
    return { nodeId: f.nodeId, fieldName: f.fieldName, fieldValue: value };
  });
}
export type OutputFieldKind = 'ratio' | 'resolution' | 'quality' | 'model';
export function appOutputField(spec: AppSpec, type: OutputFieldKind) {
  const names = { ratio: /^(aspect_?ratio|ratio)$/i, resolution: /^(resolution|image_?size)$/i, quality: /^(quality|image_?quality)$/i, model: /^(model|model_?name)$/i };
  const labels = { ratio: /图片比例|画面比例|宽高比|画幅|aspect.?ratio/i, resolution: /分辨率|清晰度|resolution/i, quality: /生成质量|图像质量|image.?quality/i, model: /选择模型|生图模型|model.?name/i };
  const fields = spec.fields.filter((field) => field.type !== 'IMAGE');
  return fields.find((field) => names[type].test(field.fieldName))
    || fields.find((field) => field.type === 'LIST' && labels[type].test(field.label));
}
export function appOutputSetting(spec: AppSpec, setup: AppSetup, type: 'ratio' | 'resolution') {
  const match = appOutputField(spec, type);
  return match ? setup.values[match.key] || match.value : 'auto';
}

// Upload order is [frame, artwork], or [artwork] when no frame image exists.
export function setupForReferences(spec: AppSpec, setup: AppSetup, referenceCount: number): AppSetup {
  const referenceKeys = setup.referenceKeys || setup.imageKeys;
  const artworkKey = referenceKeys.at(-1) || '';
  const frameKey = referenceKeys.length === 2 ? referenceKeys[0] : spec.fields.find((field) => field.type === 'IMAGE' && field.key !== artworkKey)?.key || '';
  const imageKeys = referenceCount === 1 ? [artworkKey] : [frameKey, artworkKey];
  return { ...setup, referenceKeys: [frameKey, artworkKey], imageKeys };
}
