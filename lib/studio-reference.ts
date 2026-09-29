import { referenceUpload } from './reference-upload';

export type OriginalReference = { file: string; name: string; originalFile?: string | null; originalStatus?: string; originalWidth?: number; originalHeight?: number };
export function artworkOriginal(art: OriginalReference): string {
  if (art.originalStatus === 'verified' && art.originalFile) return art.originalFile;
  throw new Error(`“${art.name}”缺少已核对的原图，请补充原图后再生成；不会用缩略图替代。`);
}
// Decode the actual bytes, not just the URL, suffix or HTTP status. No paid call.
export async function readReference(url: string | undefined, label: string): Promise<File> {
  if (!url) throw new Error(`${label}缺失，已停止提交，请重新选择或上传参考图。`);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('fetch');
    const blob = await response.blob();
    if (!blob.size || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('format');
    const bitmap = await createImageBitmap(blob);
    try { if (!bitmap.width || !bitmap.height) throw new Error('decode'); } finally { bitmap.close(); }
    return await referenceUpload(blob, label);
  } catch {
    throw new Error(`${label}读取或解码失败，已停止提交，请检查图片后重试。`);
  }
}
export async function prepareStudioReferences(art: OriginalReference, frameUrl: string | undefined) {
  if (!frameUrl) throw new Error('框架参考图缺失，已停止提交，请重新选择或上传框架。');
  const url = artworkOriginal(art);
  const [artwork, frame] = await Promise.all([readReference(url, '图案原图'), readReference(frameUrl, '框架参考图')]);
  return { artwork, frame };
}
