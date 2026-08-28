export const artworkCategories = ['山水风景', '花卉植物', '花鸟动物', '抽象艺术', '吉祥纹样', '综合图案'] as const;

export type ArtworkCategory = typeof artworkCategories[number];

const categoryAliases: Array<[ArtworkCategory, string[]]> = [
  ['山水风景', ['山水风景', '山水留白', '山水', '风景']],
  ['花卉植物', ['花卉植物', '植物拼贴', '植物', '花卉']],
  ['花鸟动物', ['花鸟动物', '花鸟新中式', '花鸟', '动物']],
  ['抽象艺术', ['抽象艺术', '抽象肌理', '抽象']],
  ['吉祥纹样', ['吉祥纹样', '吉祥图案', '纹样']],
  ['综合图案', ['综合图案']],
];

const keywordRules: Array<[ArtworkCategory, string[]]> = [
  ['花鸟动物', ['蜂鸟', '孔雀', '飞鹤', '双雀', '归鸟', '喜鹊', '仙鹤', '白鹭', '鹭鸶', '蝴蝶', 'bird', 'crane', 'deer', '鸟', '雀', '鹤', '鹿', '鱼', '蝶']],
  ['吉祥纹样', ['如意葫芦', '福报安康', '大吉大利', '福字', '祥云', '吉祥', '如意', '葫芦', '招财', '团花']],
  ['山水风景', ['浅绿云雾山影', '远山', '山影', '云雾', '水墨', '湖泊', '江河', '溪流', '瀑布', '小舟', '田野', 'landscape', 'mountain', 'river', 'lake', 'waterfall', '山水', '风景', '湖', '江', '海', '溪', '山']],
  ['花卉植物', ['灰绿尤加利', '米白灰绿植物', '暖白花枝', '极简单花', '没骨荷花', '百合', '玉兰', '尤加利', '牡丹', '荷花', '莲花', '梅花', '竹叶', '竹子', '花枝', '枝叶', 'botanical', 'flower', 'floral', 'plant', '植物', '花', '叶', '竹', '荷', '莲', '梅']],
  ['抽象艺术', ['米灰抽象花影', '抽象花影', 'abstract', 'geometric', 'texture', 'collage', '抽象', '拼贴', '肌理', '几何', '色块', '涂鸦', '现代艺术', '极简构成']],
];

export function classifyArtworkCategory(name: string, categoryHint = ''): ArtworkCategory {
  const cleanHint = categoryHint.trim();
  if (cleanHint && cleanHint !== '自动分类' && cleanHint !== '我的上传' && cleanHint !== '未分类' && cleanHint !== '综合图案') {
    const aliasMatch = categoryAliases.find(([, aliases]) => aliases.some((alias) => cleanHint.includes(alias)));
    if (aliasMatch) return aliasMatch[0];
  }

  const text = `${name} ${cleanHint}`.replace(/\s+/g, '').toLowerCase();
  let bestCategory: ArtworkCategory = '综合图案';
  let bestScore = 0;
  keywordRules.forEach(([category, keywords]) => {
    const score = keywords.reduce((total, keyword) => text.includes(keyword.toLowerCase()) ? total + keyword.length : total, 0);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  });
  return bestCategory;
}
