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
  // Retry ONLY the read-only download, never an upload or generation request.
  let response:Response|undefined,blob:Blob|undefined;
  let failure='网络中断或读取超时';
  for(let attempt=0;attempt<3;attempt++){
    try{
      response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(60000)});
      if(!response.ok){if([408,429,502,503,504].includes(response.status)&&attempt<2){await response.body?.cancel();continue;}break;}
      blob=await response.blob();
      const expected=Number(response.headers.get('X-Original-Bytes'));
      if(expected>0&&blob.size!==expected){blob=undefined;failure='原图传输不完整';continue;}
      break;
    }catch(error){response=undefined;blob=undefined;failure=error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?'图片下载超时':'图片下载连接中断';}
  }
  if(!response)throw fail(`${failure}，自动重试后仍未完成，请稍后重试`);
  if(!response.ok)throw fail(response.status===401||response.status===403?'登录状态失效，请刷新页面':response.status===404?'原图地址不存在或尚未同步':`服务器返回 HTTP ${response.status}`);
  if(!blob)throw fail(`${failure}，自动重试后仍未完成`);
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
