import { strToU8, zipSync } from 'fflate';
import type { ProductionItem, ProductionPlan, ProductWorkspace } from './production-plan';
import { drawSizeAnnotations, detailCaptions } from './production-annotations';
import { validSizeMarks, preservesSourceSizeMarks } from './production-scene';
import { findScene } from './scene-library';
const safeName=(s:string)=>s.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100);
export function downloadBlob(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function ownedImage(url:string) {
  if(!/^\/api\/files\/[\w-]+$/.test(url)) throw new Error('交付图地址无效。');
  const r=await fetch(url);if(!r.ok)throw new Error('有图片无法读取，已停止打包，请刷新后重试。');
  const b=await r.blob();if(b.size>30*1024*1024||!b.type.startsWith('image/'))throw new Error('图片格式或大小不支持打包。');return b;
}
export async function publicationImage(item:ProductionItem,workspace:ProductWorkspace,plan:ProductionPlan):Promise<Blob> {
  if(!item.task?.url)throw new Error('图片尚未完成。');
  const blob=await ownedImage(item.task.url);
  // Source-preserved images already have their annotations; never overlay twice.
  if(preservesSourceSizeMarks(item))return blob;
  if(item.kind==='main')return blob;
  // New details are already fully typeset. Preserve the entire aspect ratio;
  // never cap their height or overlay the legacy caption block a second time.
  if(item.kind==='detail'&&item.task.recipe?.detailLayoutMode==='chinese-editorial-v2'){
    const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');
    canvas.width=790;canvas.height=Math.round(bitmap.height*790/bitmap.width);
    if(canvas.height>24000){bitmap.close();throw new Error('详情长图过长，请下载原图。');}
    const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('浏览器无法排版图片。');}
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('详情图导出失败。')),'image/png'));
  }
  if(item.kind==='size'&&plan.config.sceneTitle){
    if(!item.spec||!validSizeMarks(item.spec.marks,item.generationId||'',!!item.spec.depthCm))throw new Error('请先保存尺寸标注位置，再查看或下载成品。');
    const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2048;
    const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('浏览器无法排版图片。');}
    ctx.fillStyle='#fff';ctx.fillRect(0,0,2048,2048);
    const scale=Math.min(2048/bitmap.width,2048/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;
    ctx.drawImage(bitmap,(2048-w)/2,(2048-h)/2,w,h);bitmap.close();
    drawSceneSizeMarks(ctx,item,(2048-w)/2,(2048-h)/2,w,h);
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('尺寸图排版失败。')),'image/png'));
  }
  const bitmap=await createImageBitmap(blob,{resizeWidth:790,resizeQuality:'high'});
  const canvas=document.createElement('canvas');canvas.width=790;
  const imageHeight=Math.min(1100,Math.max(460,bitmap.height));
  const captions=detailCaptions[item.title]||[];
  const extra=item.kind==='size'?170:item.title==='规格选择'?Math.max(120,Math.ceil(plan.config.sizes.length/2)*36+70):100+captions.length*38;
  canvas.height=110+imageHeight+extra;
  const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('浏览器无法排版图片。');}
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#203c33';ctx.font='bold 34px sans-serif';ctx.textAlign='left';
  ctx.fillText(item.kind==='size'?'产品规格':item.title,36,65,718);
  const scale=Math.min(718/bitmap.width,imageHeight/bitmap.height);
  const imageBox={x:(790-bitmap.width*scale)/2,y:100,width:bitmap.width*scale,height:bitmap.height*scale};
  ctx.drawImage(bitmap,imageBox.x,imageBox.y,imageBox.width,imageBox.height);bitmap.close();
  if(item.kind==='size')drawSizeAnnotations(ctx,item,imageBox);
  let y=110+imageHeight+32;ctx.font='24px sans-serif';
  if(item.spec){const s=item.spec;ctx.fillText(`宽 ${s.widthCm} cm × 高 ${s.heightCm} cm`,36,y,718);y+=38;
    ctx.fillText(`${s.depthCm?`进深 ${s.depthCm} cm　`:''}${s.panelCount?`${s.panelCount} 扇`:''}`,36,y,718);y+=38;ctx.font='18px sans-serif';ctx.fillText('尺寸以本版本确认清单为准；请核对实物后上架。',36,y,718);
  }else if(item.title==='规格选择'){
    ctx.font='20px sans-serif';if(!plan.config.sizes.length)ctx.fillText('请根据商品实际规格选购。',36,y);
    plan.config.sizes.forEach((s,i)=>ctx.fillText(`宽${s.widthCm} × 高${s.heightCm}cm${s.panelCount?` / ${s.panelCount}扇`:''}`,36+(i%2)*370,y+Math.floor(i/2)*36,350));
  }else{ctx.font='bold 23px sans-serif';ctx.fillText(plan.config.name||workspace.product.name,36,y,718);ctx.font='22px sans-serif';
    for(const line of captions){y+=38;ctx.fillText(line,36,y,718);}}
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片排版失败。')),'image/png'));
}
export function drawSceneSizeMarks(ctx:CanvasRenderingContext2D,item:ProductionItem,x:number,y:number,w:number,h:number){
  const s=item.spec!,p=s.marks!.points;
  ctx.save();ctx.strokeStyle='#b52228';ctx.fillStyle='#b52228';ctx.lineWidth=5;
  for(let i=0;i<p.length;i+=2){
    const a={x:x+p[i].x*w,y:y+p[i].y*h},b={x:x+p[i+1].x*w,y:y+p[i+1].y*h};
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    const angle=Math.atan2(b.y-a.y,b.x-a.x);
    for(const [pt,theta] of [[a,angle+Math.PI],[b,angle]] as const){ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(pt.x-20*Math.cos(theta-.42),pt.y-20*Math.sin(theta-.42));ctx.lineTo(pt.x-20*Math.cos(theta+.42),pt.y-20*Math.sin(theta+.42));ctx.closePath();ctx.fill();}
    ctx.font='bold 42px sans-serif';ctx.textAlign='center';
    const label=i===0?`宽 ${s.widthCm} cm`:i===2?`高 ${s.heightCm} cm`:`深 ${s.depthCm} cm`;
    const tx=Math.max(175,Math.min(1873,(a.x+b.x)/2)),ty=Math.max(55,Math.min(1990,(a.y+b.y)/2-26));
    ctx.lineWidth=10;ctx.strokeStyle='#fff';ctx.strokeText(label,tx,ty);ctx.fillText(label,tx,ty);ctx.strokeStyle='#b52228';ctx.lineWidth=5;
  }
  ctx.restore();
}
export async function exportProduction(workspace:ProductWorkspace,plan:ProductionPlan,onProgress:(s:string)=>void) {
  const accepted=plan.items.filter(i=>i.review==='accepted'&&i.task?.status==='succeeded'&&i.task.url);
  if(!accepted.length)throw new Error('请先验收至少一张图片。');
  const files:Record<string,Uint8Array>={}, prefix=`${safeName(plan.config.name)}_v${plan.version}`;
  const missing=plan.items.filter(i=>!accepted.includes(i)).map(i=>i.title);
  files[`${prefix}/制作清单.json`]=strToU8(JSON.stringify({name:plan.config.name,version:plan.version,config:plan.config,missing,items:plan.items.map(i=>({title:i.title,kind:i.kind,status:i.task?.status||'pending',review:i.review,note:i.note,generationId:i.generationId}))},null,2));
  files[`${prefix}/交付说明.txt`]=strToU8(missing.length?`这是部分交付，尚缺：\n${missing.join('\n')}`:'全部制作项已人工验收。上架前请复核产品结构、木色、文字与尺寸。');
  const sceneIds=new Set([workspace.sample?.recipe?.sceneId,...plan.items.map(i=>i.task?.recipe?.sceneId)].filter(Boolean));
  const credits=[...sceneIds].map(id=>findScene(id)).filter(s=>!!s);
  if(credits.length)files[`${prefix}/场景来源与授权.txt`]=strToU8('以下场景用作本产品生成参考。发布或改编时请保留适用的作者、来源、授权及修改说明。成图经 AI 重新构图并加入产品，并非原始场景图。\n\n'+credits.map(s=>`${s.name}\n作者：${s.author}\n来源：${s.source}\n授权：${s.license} ${s.licenseUrl}`).join('\n\n'));
  let bytes=0;const detailBlobs:Blob[]=[];
  for(let n=0;n<accepted.length;n++){
    const item=accepted[n];onProgress(`正在整理 ${n+1}/${accepted.length}：${item.title}`);
    const blob=await publicationImage(item,workspace,plan), data=new Uint8Array(await blob.arrayBuffer());bytes+=data.byteLength;
    if(bytes>100*1024*1024)throw new Error('本次图片超过 100 MB，请改为单项下载，避免浏览器内存不足。');
    files[`${prefix}/${{main:'主图',size:'单尺寸图',detail:'详情切片'}[item.kind]}/${String(n+1).padStart(2,'0')}_${safeName(item.title)}.${blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png'}`]=data;
    if(item.kind==='detail')detailBlobs.push(blob);
  }
  const detailItems=plan.items.filter(i=>i.kind==='detail');
  if(detailBlobs.length && detailBlobs.length===detailItems.length){
    onProgress('正在拼接已验收详情页…');const bitmaps=await Promise.all(detailBlobs.map(b=>createImageBitmap(b)));
    try{const canvas=document.createElement('canvas');canvas.width=790;canvas.height=bitmaps.reduce((h,b)=>h+b.height,0);
      if(canvas.height>24000)throw new Error('详情页过长，请下载单独切片。');
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('详情页拼接失败。');let y=0;for(const b of bitmaps){ctx.drawImage(b,0,y);y+=b.height;}
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('详情页导出失败。')),'image/png'));
      files[`${prefix}/详情长图_790.png`]=new Uint8Array(await blob.arrayBuffer());
    }finally{bitmaps.forEach(b=>b.close());}
  }
  onProgress('正在打包…');downloadBlob(new Blob([zipSync(files,{level:0}) as Uint8Array<ArrayBuffer>],{type:'application/zip'}),`${prefix}${missing.length?'_部分交付':''}.zip`);
}
