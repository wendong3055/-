import type { ProductionItem } from './production-plan';

/** Locate the non-white product in a white-background output; shadows stay outside. */
export function productBounds(data: Uint8ClampedArray, width: number, height: number) {
  let left=width, right=-1, top=height, bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;
    if(data[i+3]>32 && Math.min(data[i],data[i+1],data[i+2])<180) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  return right>=left && bottom>=top ? {left,right,top,bottom} : null;
}

export function drawSizeAnnotations(ctx:CanvasRenderingContext2D,item:ProductionItem,image:{x:number;y:number;width:number;height:number}) {
  if(!item.spec)return;
  const x=Math.floor(image.x),y=Math.floor(image.y),w=Math.ceil(image.width),h=Math.ceil(image.height);
  const bounds=productBounds(ctx.getImageData(x,y,w,h).data,w,h);
  if(!bounds)throw new Error('无法识别产品轮廓，请检查白底净图后再导出尺寸图。');
  const l=x+bounds.left,r=x+bounds.right,t=y+bounds.top,b=y+bounds.bottom;
  ctx.save();ctx.strokeStyle='#b63832';ctx.fillStyle='#b63832';ctx.lineWidth=2;
  const arrow=(x1:number,y1:number,x2:number,y2:number)=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    const angle=Math.atan2(y2-y1,x2-x1);
    for(const [px,py,a] of [[x1,y1,angle+Math.PI],[x2,y2,angle]]) {
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-8*Math.cos(a-.45),py-8*Math.sin(a-.45));ctx.lineTo(px-8*Math.cos(a+.45),py-8*Math.sin(a+.45));ctx.closePath();ctx.fill();
    }
  };
  const label=(text:string,px:number,py:number)=>{
    ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#fff';ctx.strokeText(text,px,py);ctx.fillText(text,px,py);ctx.strokeStyle='#b63832';ctx.lineWidth=2;
  };
  const hx=Math.max(60,l-24),wy=b+25;
  arrow(hx,t,hx,b);
  ctx.save();ctx.translate(hx-15,(t+b)/2);ctx.rotate(-Math.PI/2);label(`高 ${item.spec.heightCm} cm`,0,0);ctx.restore();
  arrow(l,wy,r,wy);label(`宽 ${item.spec.widthCm} cm`,(l+r)/2,wy+30);
  if(item.spec.depthCm) {
    const dx=Math.min(680,r+38);
    arrow(dx,b-35,dx+30,b-65);label(`深 ${item.spec.depthCm} cm`,Math.min(713,dx+15),b-6);
  }
  ctx.restore();
}

export const detailCaptions:Record<string,string[]>={
  '新品形象':['一款新品，从画芯与框架的搭配开始。','以已确认样图为准，呈现完整产品。'],
  '画芯设计':['图案只用于指定画芯区域。','边框、柜体与五金保留原有结构。'],
  '框架与配色':['本页展示已选框架与木色。','屏幕显示与光线可能影响色感，请以实物为准。'],
  '空间搭配':['场景图用于展示搭配效果。','摆放前请核对空间、通道及产品实际尺寸。'],
  '选购须知':['尺寸：下单前核对宽度、高度和进深。','颜色：请确认所选木色，以实物为准。','摆放：提前核对通道、摆放位置和活动空间。','安装与服务：请以商品页面约定及客服确认为准。'],
};
