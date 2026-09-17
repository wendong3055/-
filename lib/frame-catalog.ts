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
export function assetStyle(row: FrameAsset) {
  return frameStyle(row.tags?.match(/(?:款式文件夹|所属款式):([^;]+)/)?.[1] || row.name.split(/[\\/]/)[0]);
}
export function isGenericFrameFolder(name: string) {
  return /^(?:成品(?:png|图)?|图片|框架|images?|sku|png|jpe?g|output|分割图)$/i.test(name.trim());
}
export function validFrameStyleName(name: string) {
  return !!name.trim() && name.length <= 80 && !/[;:\/\\\r\n]/.test(name) && !isGenericFrameFolder(name);
}
export function frameSizeFromFilename(style: string, name: string): Omit<FrameSize, 'sourceIds' | 'sourceUrls'> | null {
  let file = name.split(/[\\/]/).at(-1)!.replace(/\.[^.]+$/, '').replace(/^SKU[_-]\d+[_-]/i, '');
  let parts: number[] = [], height = 0, depth: number | undefined, panels: number | undefined;
  const explicit = file.match(/^(\d+(?:\.\d+)?(?:加\d+(?:\.\d+)?)*)宽?[_-](\d+(?:\.\d+)?)高(?:_|$)/);
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
    const match = file.match(/^(?:原木|红木|黄花梨|胡桃木?|灰|白)?(\d+(?:\+\d+)*)-(200|220|230)(?:_|$)/);
    if (match) { parts = match[1].split('+').map(Number); height = Number(match[2]); depth = 30; }
  }
  if (!height || !parts.length || parts.some((v) => v < 10 || v > 300)) return null;
  return { key: `${style}:${parts.join('+')}x${height}:${panels || 0}`, widthCm: parts.reduce((a, b) => a + b, 0), heightCm: height, widthParts: parts, ...(depth ? { depthCm: depth } : {}), ...(panels ? { panelCount: panels } : {}) };
}
export function frameSources(rows: FrameAsset[], representative: FrameAsset) {
  const style = assetStyle(representative);
  const sources = rows.filter((row) => row.category.startsWith('框架') && assetStyle(row) === style);
  const sizes = new Map<string, FrameSize>(); let unknown = 0, ignored = 0;
  for (const row of sources) {
    const filename = row.objectKey || row.object_key || row.name;
    let originalName = '';
    try { originalName = decodeURIComponent(row.tags?.match(/原始文件名:([^;]+)/)?.[1] || ''); } catch { /* Older metadata may not contain an encoded original name. */ }
    if (/(?:QA总览|联系表|contact[-_ ]?sheet)/i.test(originalName || row.name)) { ignored++; continue; }
    const size = frameSizeFromFilename(style, originalName) || frameSizeFromFilename(style, row.name) || frameSizeFromFilename(style, filename);
    if (!size) { unknown++; continue; }
    const existing = sizes.get(size.key) || { ...size, sourceIds: [], sourceUrls: [] };
    existing.sourceIds.push(row.id); existing.sourceUrls.push(row.url || `/api/files/${row.id}`); sizes.set(size.key, existing);
  }
  const expectedFiles = Math.max(0, ...sources.map((row) => Number(row.tags?.match(/规格数量:(\d+)/)?.[1] || 0)));
  const missing = Math.max(0, expectedFiles - sources.length);
  return { styleKey: style, sizes: [...sizes.values()].sort((a, b) => a.heightCm - b.heightCm || a.widthCm - b.widthCm), fileCount: sources.length, unknown, ignored, missing };
}
export function frameSpecStatus(catalog: ReturnType<typeof frameSources> | null) {
  return catalog?.sizes.length && !catalog.unknown && !catalog.missing ? 'waiting_for_production' : 'needs_spec_confirmation';
}
export function groupFrameOptions<T extends { id: string; name: string; styleKey?: string; sizes?: FrameSize[]; memberIds?: string[] }>(frames: T[], hidden: string[]) {
  const groups = new Map<string, T[]>();
  for (const item of frames) { const key = item.styleKey || frameStyle(item.name); groups.set(key, [...(groups.get(key) || []), item]); }
  return [...groups.entries()].flatMap(([style, members]) => {
    const memberIds = [`style:${style}`, ...members.flatMap((item) => [item.id, ...(item.memberIds || [])])];
    // Group before filtering so a removed upload cannot resurrect its built-in alias.
    if (memberIds.some((id) => hidden.includes(id))) return [];
    const preferred = members.find((item) => item.id.startsWith('uploaded-frame-')) || members[0];
    return [{ ...preferred, memberIds, sizes: members.find((item) => item.sizes?.length)?.sizes || preferred.sizes }];
  });
}

// A style keeps its spec originals internally: an uploaded style carries the
// recognised sizes with their source images, and a bundled style can ship a
// SKU index. Both are reduced to one flat list of viewable images.
export type FrameSku = { id: string; name: string; thumb: string; totalWidth?: number; height?: number; depth?: number };
export type FrameVariantImage = { src: string; label: string; note?: string };
export type FrameVariantSource = { name: string; file?: string; sizes?: FrameSize[]; skuItems?: FrameSku[] };

// A fetched index is untrusted input: only same-site frame assets may become an
// image source, so a hostile manifest cannot point a page at another origin.
export function safeFrameThumb(value: unknown) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/frames/') || path.includes('..') || path.includes('//') || /[\\'"<>]/.test(path)) return null;
  return path;
}

export function parseFrameSkuIndex(value: unknown): FrameSku[] {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: FrameSku[] = [];
  for (const row of items) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const { id, name, thumb, totalWidth, height, depth } = row as Record<string, unknown>;
    const src = safeFrameThumb(thumb);
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    if (typeof name !== 'string' || !name.trim() || !src) continue;
    seen.add(id);
    out.push({
      id, name: name.trim().slice(0, 60), thumb: src,
      ...(typeof totalWidth === 'number' && Number.isFinite(totalWidth) ? { totalWidth } : {}),
      ...(typeof height === 'number' && Number.isFinite(height) ? { height } : {}),
      ...(typeof depth === 'number' && Number.isFinite(depth) ? { depth } : {}),
    });
  }
  return out;
}

export function frameVariantImages(option: FrameVariantSource): FrameVariantImage[] {
  if (option.skuItems?.length) {
    return option.skuItems.map((sku) => ({
      src: sku.thumb, label: sku.name,
      ...(sku.totalWidth && sku.height ? { note: `${sku.totalWidth}×${sku.height}cm${sku.depth ? ` · 深${sku.depth}cm` : ''}` } : {}),
    }));
  }
  const fromSizes = (option.sizes || []).flatMap((size) => size.sourceUrls.map((src) => ({
    src,
    label: `${size.widthCm}×${size.heightCm}cm`,
    note: `${size.widthParts.join('+')}cm${size.depthCm ? ` · 深${size.depthCm}cm` : ''}`,
  })));
  if (fromSizes.length) return fromSizes;
  return option.file ? [{ src: option.file, label: option.name }] : [];
}
