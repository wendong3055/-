// Transport-only conversion. The image content is not cropped or recolored.
export async function referenceUpload(blob: Blob, name: string): Promise<File> {
  if (blob.type !== 'image/webp') return new File([blob], `${name}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`, { type: blob.type });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法准备参考图，请改用 JPG 或 PNG。');
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('参考图格式转换失败，请改用 JPG 或 PNG。')), 'image/png'));
    if (png.size > 10 * 1024 * 1024) throw new Error('参考图转为 PNG 后超过 10 MB，请上传较小的 JPG 或 PNG。');
    return new File([png], `${name}.png`, { type: 'image/png' });
  } finally { bitmap.close(); }
}
