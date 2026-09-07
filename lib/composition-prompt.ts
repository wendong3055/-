import type { StudioIntent } from './studio-brief';

const colors: Record<string, string> = {
  natural: '浅原木色，清晰自然木纹，明亮中性蜂蜜木色，不偏橙',
  redwood: '深红棕木纹，稳重但不过分发紫或发黑',
  pear: '温润金棕木纹，轻微橙调但不过饱和',
  walnut: '深棕色天然木纹，保留真实明暗层次',
  'simple-gray': '中性低饱和灰色木纹，哑光质感',
  'warm-white': '象牙暖白，接近中性白，极轻微暖感，低黄度、不奶黄，保留细微木纹和真实阴影',
};

export function compositionPrompt(input: { hasFrame: boolean; frameName: string; frameProfile: string; colorId: string; colorName: string; colorHex: string; instruction: string; intent?: StudioIntent }) {
  const structure = input.hasFrame
    ? '参考图1是框架或柜体，参考图2是画芯。保留图1的产品结构、比例、视角、框体粗细、底座、柜门、抽屉、格栅、铰链、把手、脚轮和五金。将图2画芯完整自然地装入所有有效画芯开口。'
    : `参考图是画芯。为它制作“${input.frameName}”独立落地屏风框架，框型特征为 ${input.frameProfile}。完整保留画芯主体，使用真实木纹、接缝、底座和脚轮，完整展示产品。`;
  const presentation = input.intent === 'catalog'
    ? '出图用途为电商白底主图：将原背景替换为纯白棚拍背景，完整呈现产品，保留自然落地阴影，产品边缘干净。'
    : input.intent === 'interior'
      ? '出图用途为真实家居场景图：将产品放入与其风格协调的玄关或客厅空间，重新匹配环境透视、自然光和接触阴影，保持产品和画芯清晰完整，不被家具遮挡。'
      : '出图用途为新品组合确认图：有框架参考图时保留原有透视、光影和背景；没有框架参考图时使用浅中性电商背景。';
  return `制作一张可用于家居电商的真实产品效果图。${structure}${presentation}所有木质框架部件整体使用“${input.colorName}”：${colors[input.colorId] || input.colorName}，参考色值 ${input.colorHex}。保留木纹、明暗、反射和接缝，画芯及金属五金保持原色。输出完整产品，保持原有结构，不添加文字、尺寸线或无关装饰。${input.instruction ? `补充制作要求：${input.instruction}` : ''}`;
}
