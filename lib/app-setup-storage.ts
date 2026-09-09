import { initialAppSetup, promptCandidates, setupForReferences, type AppSetup, type AppSpec } from './runninghub-app-schema';

// Persist only input selections, never provider keys, uploaded filenames or URLs.
export function cleanAppSetup(value: unknown): AppSetup | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as AppSetup;
  const key = (k: unknown): k is string => typeof k === 'string' && k.length <= 150 && !/api.?key|secret|password|token|authorization/i.test(k);
  if (typeof v.fingerprint !== 'string' || v.fingerprint.length > 128 || !key(v.promptKey) || !Array.isArray(v.imageKeys) || v.imageKeys.length > 2 || !v.imageKeys.every(key) || !v.values || typeof v.values !== 'object' || Array.isArray(v.values)) return null;
  const entries = Object.entries(v.values);
  if (entries.length > 50 || entries.some(([k, x]) => !key(k) || typeof x !== 'string' || x.length > 4000)) return null;
  const fieldTypes = v.fieldTypes && typeof v.fieldTypes === 'object' ? Object.fromEntries(Object.entries(v.fieldTypes).filter(([k, x]) => key(k) && ['IMAGE','STRING','LIST','INT','FLOAT','BOOLEAN'].includes(x)).slice(0, 50)) : undefined;
  return { fingerprint: v.fingerprint, promptKey: v.promptKey, imageKeys: [...v.imageKeys], values: Object.fromEntries(entries), ...(fieldTypes ? { fieldTypes } : {}), ...(Array.isArray(v.referenceKeys) && v.referenceKeys.length <= 2 && v.referenceKeys.every(key) ? { referenceKeys: [...v.referenceKeys] } : {}) };
}

export function reconcileAppSetup(spec: AppSpec, saved: unknown, referenceCount: number) {
  const clean = cleanAppSetup(saved);
  const defaults = initialAppSetup(spec, referenceCount);
  if (!clean) return { setup: defaults, review: '' };
  const same = clean.fingerprint === spec.fingerprint;
  let changed = !same && spec.fields.some((field) => clean.fieldTypes?.[field.key] !== field.type);
  const compatible = (key: string) => spec.fields.some((f) => f.key === key && (same || clean.fieldTypes?.[key] === f.type));
  const values = { ...defaults.values };
  for (const [key, value] of Object.entries(clean.values)) {
    const f = spec.fields.find((f) => f.key === key);
    if (!f || !compatible(key)) { changed = true; continue; }
    const valid = f.type === 'LIST' ? f.options.includes(value) : f.type === 'BOOLEAN' ? ['true','false'].includes(value.toLowerCase()) : ['INT','FLOAT'].includes(f.type) ? Boolean(value.trim()) && Number.isFinite(Number(value)) && (f.type !== 'INT' || Number.isInteger(Number(value))) : f.type === 'STRING';
    if (valid) values[key] = /batch|num_images|image_count/i.test(f.fieldName) ? '1' : value;
    else if (f.type !== 'IMAGE') changed = true;
  }
  const promptKey = compatible(clean.promptKey) && promptCandidates(spec).some((f) => f.key === clean.promptKey) ? clean.promptKey : '';
  const referenceKeys = (clean.referenceKeys || clean.imageKeys).map((key) => compatible(key) && spec.fields.some((f) => f.key === key && f.type === 'IMAGE') ? key : '');
  if (!promptKey || referenceKeys.some((key) => !key) || new Set(referenceKeys).size !== referenceKeys.length) changed = true;
  const setup = setupForReferences(spec, { ...defaults, promptKey, imageKeys: referenceKeys, referenceKeys, values }, referenceCount);
  return { setup, review: changed ? '应用参数有变化，已保留仍有效的选项。请核对比例、清晰度和参考图绑定后确认。' : '' };
}
