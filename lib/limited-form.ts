export class FormLimitError extends Error {}

export async function limitedFormData(request: Request, limit: number) {
  if (!request.body) throw new Error('请求内容为空。');
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new FormLimitError('参考图总大小不能超过 22 MB。'); }
    chunks.push(new Uint8Array(value));
  }
  return new Response(new Blob(chunks), { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData();
}
