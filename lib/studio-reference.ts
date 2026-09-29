import { referenceUpload } from './reference-upload';
import {decodeReference} from './decode-reference';

export type OriginalReference = { file: string; name: string; originalFile?: string | null; originalStatus?: string; originalWidth?: number; originalHeight?: number };
export function artworkOriginal(art: OriginalReference): string {
  if (art.originalStatus === 'verified' && art.originalFile) return art.originalFile;
  throw new Error(`“${art.name}”缺少已核对的原图，请补充原图后再生成；不会用缩略图替代。`);
}
// Decode the actual bytes, not just the URL, suffix or HTTP status. No paid call.
export async function readReference(url: string | undefined, label: string): Promise<File> {
  if (!url) throw new Error(`${label}缺失，已停止提交，请重新选择或上传参考图。`);
  const fail=(reason:string)=>new Error(`${label}读取或解码失败：${reason}。已停止提交，未调用生图。`);
  let response:Response;
  try{response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw fail('网络中断或读取超时，请重试');}
  if(!response.ok)throw fail(response.status===401||response.status===403?'登录状态失效，请刷新页面':response.status===404?'原图地址不存在或尚未同步':`服务器返回 HTTP ${response.status}`);
  let blob:Blob;try{blob=await response.blob();}catch{throw fail('图片下载未完成');}
  if(!blob.size)throw fail('原图文件为空');
  if(!['image/png','image/jpeg','image/webp'].includes(blob.type))throw fail('服务器未返回 JPG、PNG 或 WebP 图片，可能需要重新登录');
  try{const decoded=await decodeReference(blob);decoded.close();}catch{throw fail('浏览器无法解码原图，请尝试重新上传 JPG 或 PNG');}
  try{return await referenceUpload(blob,label);}catch{throw fail('图片已读取，但上传副本准备失败');}
}
export async function prepareStudioReferences(art: OriginalReference, frameUrl: string | undefined) {
  if (!frameUrl) throw new Error('框架参考图缺失，已停止提交，请重新选择或上传框架。');
  const url = artworkOriginal(art);
  const [artwork, frame] = await Promise.all([readReference(url, '图案原图'), readReference(frameUrl, '框架参考图')]);
  return { artwork, frame };
}
