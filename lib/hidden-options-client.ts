export async function syncHiddenOptions(kind: 'artwork' | 'frame', ids: string[]) {
  const storageKey = kind === 'artwork' ? 'pingfeng-hidden-artworks' : 'pingfeng-hidden-frames';
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const response = await fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, ids: chunk }) }).catch(() => null);
    if (!response?.ok) return false;
    const payload = await response.json().catch(() => null) as { ids?: string[] } | null;
    if (!Array.isArray(payload?.ids)) return false;
    const acknowledged = new Set(payload.ids.filter((id) => chunk.includes(id)));
    try {
      const pending = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(pending)) {
        const remaining = pending.filter((id) => !acknowledged.has(id));
        if (remaining.length) localStorage.setItem(storageKey, JSON.stringify(remaining)); else localStorage.removeItem(storageKey);
      }
    } catch { /* Keep server acknowledgement separate from optional local cache. */ }
    if (acknowledged.size !== chunk.length) return false;
  }
  return true;
}
