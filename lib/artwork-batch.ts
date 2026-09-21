// Batch actions for the artwork library. The naming rules live here so the
// exported archive stays predictable and safe regardless of the source name.
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export function exportExtension(value: string) {
  const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(value || '');
  const ext = (match?.[1] || '').toLowerCase();
  if (!EXTENSIONS.includes(ext)) return 'png';
  return ext === 'jpeg' ? 'jpg' : ext;
}
export function exportFileName(name: string, index: number, value: string) {
  const cleaned = (name || '图案')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || '图案';
  return `${String(index + 1).padStart(2, '0')}-${cleaned}.${exportExtension(value)}`;
}
// A hidden option is removed from the selectable list; the stored file stays.
export function selectableAfterRemoval(ids: string[], removal: string[]) {
  const removing = new Set(removal);
  return ids.filter((id) => !removing.has(id));
}
