// Transport-only copy. The stored original is never changed or replaced.
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
export async function referenceUpload(blob: Blob, name: string): Promise<File> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('参考图需要 JPG、PNG 或 WebP 格式。');
  if (blob.type !== 'image/webp' && blob.size <= MAX_REFERENCE_BYTES) return new File([blob], `${name}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`, { type: blob.type });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法准备参考图，请改用 JPG 或 PNG。');
    context.drawImage(bitmap, 0, 0);
    const encode = (type: string, quality?: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('参考副本准备失败，高清原图仍保留，请重试。')), type, quality));
    if (blob.type === 'image/webp') {
      const png = await encode('image/png');
      if (png.size <= MAX_REFERENCE_BYTES) return new File([png], `${name}.png`, { type: 'image/png' });
    }
    // Oversized generated PNGs must also pass through this path. Keep the full
    // aspect ratio; only reduce transport resolution if high-quality JPEG is large.
    for (const maxSide of [4096, 3072, 2048]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const jpeg = await encode('image/jpeg', 0.94);
      if (jpeg.size <= MAX_REFERENCE_BYTES) return new File([jpeg], `${name}.jpg`, { type: 'image/jpeg' });
    }
    throw new Error('参考副本压缩后仍超过 10 MB，高清原图仍保留，请选择较小的参考图。');
  } finally { bitmap.close(); }
}
