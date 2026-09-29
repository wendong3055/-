export type PropsMode='none'|'auto'|'custom';
export function mainPropsBrief(kind:string,mode:PropsMode,text:string){
 if(kind!=='main'&&kind!=='size')return '';
 const marker=kind==='size'?'[尺寸图摆件]':'[主图摆件]';
 if(mode==='none')return `${marker} 摆件布置：不添加摆件，保持产品本身干净展示。`;
 return `${marker} ${mode==='auto'?'在产品每个适合摆放的现有台面、层板或置物格各放置一个大小合适的摆件，根据画芯与木色统一搭配。':text.trim().slice(0,400)} 仅放在参考产品已有且可见的台面或置物格，合理承托，不悬浮。不新增隔板、不改变产品结构，不遮挡画芯、五金和主要细节。如果产品没有合适的摆放位置，则不添加摆件。摆件仅作为拍摄道具，不属于产品配置；同套主图和尺寸图保持相同搭配风格，按各规格实际置物格布置。${kind==='size'?'摆件小巧克制，避开全部尺寸文字、尺寸线和箭头，不在产品外额外堆放道具。':''}`;
}
