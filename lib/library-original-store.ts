import originals from '../public/library/2026-08-27-v2/originals-index.json';

type Original = {originalHash:string;originalBytes:number;originalDiskFile:string;originalStatus:string};
const catalog = originals as Record<string, Original>;
export function originalRecord(id: string) {
  if (!/^local-[a-f0-9]{16}$/.test(id) || !Object.hasOwn(catalog,id)) return null;
  const entry=catalog[id];
  if(entry.originalStatus!=='verified'||!entry.originalHash||!entry.originalBytes)return null;
  return {...entry,key:`bundled-library-originals/v1/${entry.originalHash}`,mime:entry.originalDiskFile.endsWith('.png')?'image/png':entry.originalDiskFile.endsWith('.webp')?'image/webp':'image/jpeg'};
}
export async function checkedOriginalBody(request: Request, entry: NonNullable<ReturnType<typeof originalRecord>>) {
  if(!request.body || Number(request.headers.get('content-length')||entry.originalBytes)!==entry.originalBytes)throw new Error('原图长度不符');
  const reader=request.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>entry.originalBytes){await reader.cancel();throw new Error('原图大小超限');}chunks.push(new Uint8Array(value));}
  if(total!==entry.originalBytes)throw new Error('原图上传不完整');
  const bytes=await new Blob(chunks).arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==entry.originalHash)throw new Error('原图哈希不符，未写入');
  return bytes;
}
