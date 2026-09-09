export type FrameAsset = { id: string; name: string; category: string; tags?: string; objectKey?: string; object_key?: string; url?: string };
export type FrameSize = { key: string; widthCm: number; heightCm: number; depthCm?: number; widthParts: number[]; panelCount?: number; sourceIds: string[]; sourceUrls: string[] };
const aliases: Record<string, string> = {
  '福报安康双门抽屉玄关柜': 'fubao-ankang', '双门双抽玄关柜框架': 'fubao-ankang',
  '大屏风': 'large-screen', '大屏风框架': 'large-screen', '清新绿洲大尺寸': 'large-screen',
  '五斗柜': 'five-drawer', '五斗柜框架': 'five-drawer', '五斗滑轮柜': 'five-drawer',
  '飞鹤6连屏': 'fei-he', '飞鹤六连屏框架': 'fei-he', '飞鹤六连屏': 'fei-he',
  '青云直上玄关柜': 'qingyun',
};
export function frameStyle(name: string) {
  const normalized = name.replace(/^\d{2}_/, '').trim();
  return aliases[normalized] || normalized;
}
function assetStyle(row: FrameAsset) {
  return frameStyle(row.tags?.match(/(?:款式文件夹|所属款式):([^;]+)/)?.[1] || row.name.split(/[\\/]/)[0]);
}
export function frameSizeFromFilename(style: string, name: string): Omit<FrameSize, 'sourceIds' | 'sourceUrls'> | null {
  let file = name.split(/[\\/]/).at(-1)!.replace(/\.[^.]+$/, '').replace(/^SKU[_-]\d+[_-]/i, '');
  let parts: number[] = [], height = 0, depth: number | undefined, panels: number | undefined;
  const explicit = file.match(/(\d+(?:\.\d+)?(?:加\d+(?:\.\d+)?)*)宽[_-]?(\d+(?:\.\d+)?)高/);
  if (explicit) { parts = explicit[1].split('加').map(Number); height = Number(explicit[2]); }
  else if (style === 'large-screen') {
    const pair = file.match(/(?:白|胡桃)?(180|190|200|210)-(60|70|80|90|100)(?:_|$)/);
    const ordinary = file.match(/(?:白|红木|胡桃|黄花梨|灰|原木)(60|70|80|90|100)(?:_|$)/);
    if (pair) { height = Number(pair[1]); parts = [Number(pair[2])]; }
    else if (ordinary) { height = 190; parts = [Number(ordinary[1])]; }
    depth = 29;
  } else if (style === 'five-drawer') {
    if (file === '黄花梨80-2220') file = '黄花梨80-220'; // Explicit exception in this style's delivery manifest.
    const match = file.match(/(60|80)(?:-(60|80))?-(200|220|230)(?:_|$)/);
    if (match) { parts = [Number(match[1]), ...(match[2] ? [Number(match[2])] : [])]; height = Number(match[3]); depth = 30; }
  } else if (style === 'fei-he') {
    const match = file.match(/(40|50|60)(?:[x×]([2-6]))?-(180|190|200)(?:_|$)/i);
    if (match) { panels = Number(match[2] || 1); parts = Array.from({ length: panels }, () => Number(match[1])); height = Number(match[3]); if (panels === 1) depth = 29; }
  } else if (style === 'fubao-ankang' || style === 'qingyun') {
    const match = file.match(/(\d+(?:\+\d+)*)-(200|220|230)(?:_|$)/);
    if (match) { parts = match[1].split('+').map(Number); height = Number(match[2]); depth = 30; }
  }
  if (!height || !parts.length || parts.some((v) => v < 10 || v > 300)) return null;
  return { key: `${style}:${parts.join('+')}x${height}:${panels || 0}`, widthCm: parts.reduce((a, b) => a + b, 0), heightCm: height, widthParts: parts, ...(depth ? { depthCm: depth } : {}), ...(panels ? { panelCount: panels } : {}) };
}
export function frameSources(rows: FrameAsset[], representative: FrameAsset) {
  const style = assetStyle(representative);
  const sources = rows.filter((row) => row.category.startsWith('框架') && assetStyle(row) === style);
  const sizes = new Map<string, FrameSize>(); let unknown = 0;
  for (const row of sources) {
    const filename = row.objectKey || row.object_key || row.name;
    const size = frameSizeFromFilename(style, row.name) || frameSizeFromFilename(style, filename);
    if (!size) { unknown++; continue; }
    const existing = sizes.get(size.key) || { ...size, sourceIds: [], sourceUrls: [] };
    existing.sourceIds.push(row.id); existing.sourceUrls.push(row.url || `/api/files/${row.id}`); sizes.set(size.key, existing);
  }
  return { sizes: [...sizes.values()].sort((a, b) => a.heightCm - b.heightCm || a.widthCm - b.widthCm), fileCount: sources.length, unknown };
}
export function groupFrameOptions<T extends { id: string; name: string; sizes?: FrameSize[]; memberIds?: string[] }>(frames: T[], hidden: string[]) {
  const groups = new Map<string, T[]>();
  for (const item of frames) { const key = frameStyle(item.name); groups.set(key, [...(groups.get(key) || []), item]); }
  return [...groups.entries()].flatMap(([style, members]) => {
    const memberIds = [`style:${style}`, ...members.flatMap((item) => [item.id, ...(item.memberIds || [])])];
    // Group before filtering so a removed upload cannot resurrect its built-in alias.
    if (memberIds.some((id) => hidden.includes(id))) return [];
    const preferred = members.find((item) => item.id.startsWith('uploaded-frame-')) || members[0];
    return [{ ...preferred, memberIds, sizes: members.find((item) => item.sizes?.length)?.sizes || preferred.sizes }];
  });
}
