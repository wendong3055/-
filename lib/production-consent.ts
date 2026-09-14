// A device-local dialog preference, never a replacement for server authorization,
// task ownership checks, the paid-request lock, or per-request idempotency.
export type ProductionConsentScope = { planId: string; productId: string; settings: string };
export type ProductionConsent = ProductionConsentScope & { schema: 1; remaining: string[] };
export const consentKey = (planId: string) => `pingfeng-production-consent-v1:${planId}`;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]));
  return value;
}
export function consentSettings(value: unknown) { return JSON.stringify(canonical(value)); }
export function readConsent(storage: Pick<Storage,'getItem'>, planId: string): ProductionConsent | null {
  try {
    const r = JSON.parse(storage.getItem(consentKey(planId)) || 'null');
    return r?.schema === 1 && r.planId === planId && typeof r.productId === 'string' && typeof r.settings === 'string' && Array.isArray(r.remaining) && r.remaining.length <= 120 && r.remaining.every((id: unknown) => typeof id === 'string') ? r : null;
  } catch { return null; }
}
export function consentCovers(receipt: ProductionConsent | null, scope: ProductionConsentScope, itemId: string, attempted: boolean) {
  return !attempted && !!receipt && receipt.planId === scope.planId && receipt.productId === scope.productId && receipt.settings === scope.settings && receipt.remaining.includes(itemId);
}
export function createConsent(scope: ProductionConsentScope, itemIds: string[]): ProductionConsent {
  return { ...scope, schema: 1, remaining: [...new Set(itemIds)] };
}
export function consumeConsent(receipt: ProductionConsent, itemId: string): ProductionConsent {
  return { ...receipt, remaining: receipt.remaining.filter(id => id !== itemId) };
}
