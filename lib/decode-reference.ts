// Embedded browsers can reject createImageBitmap for valid JPEGs.
// The fallback decodes the SAME bytes, never a preview or thumbnail.
export async function decodeReference(blob:Blob):Promise<{source:CanvasImageSource;width:number;height:number;close:()=>void}>{
 if(typeof createImageBitmap==='function'){try{const b=await createImageBitmap(blob);if(b.width&&b.height)return{source:b,width:b.width,height:b.height,close:()=>b.close()};b.close();}catch{}}
 if(typeof Image==='undefined')throw new Error('图片解码失败');
 const url=URL.createObjectURL(blob),image=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{image.onload=null;image.onerror=null;reject(new Error('图片解码超时'));},15000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('图片解码失败'));};image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('图片尺寸无效');
  return{source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>{image.onload=null;image.onerror=null;image.src='';URL.revokeObjectURL(url);}};
 }catch(e){image.src='';URL.revokeObjectURL(url);throw e;}
}
