export async function productionJson(request:Request,limit=100000):Promise<unknown> {
  const reader=request.body?.getReader();if(!reader)throw new Error('请求内容为空。');
  const chunks:Uint8Array[]=[];let total=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit)throw new Error('请求内容过大。');chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>undefined);throw e;}
  finally{reader.releaseLock();}
  const all=new Uint8Array(total);let cursor=0;chunks.forEach(c=>{all.set(c,cursor);cursor+=c.length;});
  try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new Error('请求格式不正确。');}
}
