const colors: Record<string, string> = {
  natural: '浅原木色，清晰自然木纹，明亮中性蜂蜜木色，不偏橙',
  redwood: '深红棕木纹，稳重但不过分发紫或发黑',
  pear: '温润金棕木纹，轻微橙调但不过饱和',
  walnut: '深棕色天然木纹，保留真实明暗层次',
  'simple-gray': '中性低饱和灰色木纹，哑光质感',
  'warm-white': '象牙暖白，接近中性白，极轻微暖感，低黄度、不奶黄，保留细微木纹和真实阴影',
};

export function compositionPrompt(input: { hasFrame: boolean; frameName: string; frameProfile: string; colorId: string; colorName: string; colorHex: string; instruction: string }) {
  const structure = input.hasFrame
    ? '参考图1是框架或柜体，参考图2是画芯。保留图1的产品结构、比例、视角、框体粗细、底座、柜门、抽屉、格栅、铰链、把手、脚轮、五金、透视、光影和背景。将图2画芯完整自然地装入所有有效画芯开口。'
    : `参考图是画芯。为它制作“${input.frameName}”独立落地屏风框架，框型特征为 ${input.frameProfile}。完整保留画芯主体，使用真实木纹、接缝、底座和脚轮，在浅中性电商背景上完整展示产品。`;
  return `制作一张可用于家居电商新品确认的真实组合效果图。${structure}所有木质框架部件整体使用“${input.colorName}”：${colors[input.colorId] || input.colorName}，参考色值 ${input.colorHex}。保留木纹、明暗、反射和接缝，画芯、墙地面及金属五金保持原色。输出完整产品，保持原有结构，不添加文字、尺寸线或无关装饰。${input.instruction ? `补充制作要求：${input.instruction}` : ''}`;
}
