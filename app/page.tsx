'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { artworkCategories, classifyArtworkCategory } from '../lib/artwork-category';
import { GenerationHistory, RunningHubSettings, useGenerations } from './generation-studio';
import { generationLabels, isActiveGeneration, type GenerationTask } from '../lib/generation-types';
import { studioIntents, type StudioIntent } from '../lib/studio-brief';

type FrameOption = { id: string; name: string; tone: string; color: string; profile: string; file?: string; variantCount?: number; artworkBox?: { left: string; top: string; width: string; height: string }; artworkClipPaths?: string[] };
type FrameColorOption = { id: string; name: string; color: string; texture?: string; note?: string };

function frameVariantCount(tags: string | undefined) {
  const matched = tags?.match(/规格数量:(\d+)/);
  return matched ? Number(matched[1]) : 1;
}

function frameFolderName(files: File[]) {
  const relativePath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relativePath?.split('/').filter(Boolean)[0] || files[0].name.replace(/\.[^.]+$/, '');
}

function representativeFrame(files: File[]) {
  const keywords = ['空框结构样图', '空框', '样图', '标准'];
  return [...files].sort((left, right) => {
    const leftName = left.name.replace(/\.[^.]+$/, '');
    const rightName = right.name.replace(/\.[^.]+$/, '');
    const leftRank = keywords.findIndex((keyword) => leftName.includes(keyword));
    const rightRank = keywords.findIndex((keyword) => rightName.includes(keyword));
    return (leftRank < 0 ? keywords.length : leftRank) - (rightRank < 0 ? keywords.length : rightRank) || leftName.localeCompare(rightName, 'zh-CN');
  })[0];
}

const frameColors: FrameColorOption[] = [
  { id: 'natural', name: '原木', color: '#c69d62', texture: '/materials/frame-colors/natural.png' },
  { id: 'redwood', name: '红木色', color: '#6d211f', texture: '/materials/frame-colors/redwood.png' },
  { id: 'pear', name: '黄花梨色', color: '#a95617', texture: '/materials/frame-colors/pear.png' },
  { id: 'walnut', name: '胡桃木色', color: '#402b24', texture: '/materials/frame-colors/walnut.png' },
  { id: 'simple-gray', name: '简约灰', color: '#7b7e80', texture: '/materials/frame-colors/simple-gray.png' },
  { id: 'warm-white', name: '暖白色', color: '#efeee9', note: '低黄度象牙暖白' },
];

const artworks = [
  { id: 'mist', name: '浅绿云雾山影', file: '/demo/浅绿云雾山影.png', tag: '山水风景', ratio: '1:1', tone: '雾绿' },
  { id: 'floral', name: '暖白花枝', file: '/demo/暖白花枝.jpg', tag: '花卉植物', ratio: '1:1', tone: '暖白' },
  { id: 'collage', name: '米白灰绿植物', file: '/demo/米白灰绿植物.jpg', tag: '花卉植物', ratio: '1:1', tone: '灰绿' },
  { id: 'abstract', name: '米灰抽象花影', file: '/demo/米灰抽象花影.jpg', tag: '抽象艺术', ratio: '1:1', tone: '米灰' },
  { id: 'blue', name: '雾蓝极简单花', file: '/demo/雾蓝极简单花.png', tag: '花卉植物', ratio: '1:1', tone: '雾蓝' },
];

const frames: FrameOption[] = [
  { id: 'ruyi-walnut', name: '如意葫芦款', tone: '胡桃木色', color: '#3a2a22', profile: 'classic' },
  { id: 'ruyi-natural', name: '如意葫芦款', tone: '原木色', color: '#d5ad72', profile: 'classic' },
  { id: 'straight-warm', name: '极简直边款', tone: '暖白色', color: '#d8d0bd', profile: 'slim' },
  { id: 'wide-redwood', name: '加宽立柱款', tone: '红木色', color: '#6e3428', profile: 'wide' },
  { id: 'classic-pear', name: '经典榫卯款', tone: '黄花梨色', color: '#a4592d', profile: 'joinery' },
  { id: 'simple-gray', name: '简约滑轮款', tone: '简约灰色', color: '#66645f', profile: 'slim' },
];

const cabinetFrameStyles: FrameOption[] = [
  { id: 'fubao-ankang', name: '双门双抽玄关柜框架', tone: '标准合并框架 · 80×200cm', color: '#432d24', profile: 'cabinet', file: '/frames/style-previews/福报安康_80-200.png', variantCount: 30 },
  { id: 'qingyun-zhishang', name: '青云直上玄关柜', tone: '标准合并框架 · 60×200cm', color: '#432d24', profile: 'cabinet', file: '/frames/style-previews/青云直上_60-200.png', variantCount: 1 },
  { id: 'large-screen-white', name: '大屏风框架', tone: '标准合并框架 · 白色 · 100×190cm', color: '#e8e6df', profile: 'cabinet', file: '/frames/style-previews/大屏风_白100-190.png', variantCount: 1, artworkBox: { left: '32.6%', top: '7.1%', width: '35.4%', height: '75.2%' } },
  { id: 'five-drawer-walnut', name: '五斗柜框架', tone: '标准合并框架 · 胡桃色 · 60×200cm', color: '#432d24', profile: 'cabinet', file: '/frames/style-previews/五斗柜_胡桃60-200.png', variantCount: 1, artworkBox: { left: '35.4%', top: '4.6%', width: '29.2%', height: '50.7%' } },
  {
    id: 'fei-he-six-panel',
    name: '飞鹤六连屏框架',
    tone: '标准合并框架 · 红木色 · 50×6片×190cm',
    color: '#713027',
    profile: 'cabinet',
    file: '/frames/style-previews/飞鹤六连屏_50x6-190.png',
    variantCount: 39,
    artworkBox: { left: '5.9%', top: '14.2%', width: '87.5%', height: '68.5%' },
    artworkClipPaths: [
      'polygon(0% 0.3%, 15.5% 0.6%, 15.6% 100%, 0% 99%)',
      'polygon(18.2% 0.5%, 32.5% 0.1%, 33.1% 99.8%, 18% 99.8%)',
      'polygon(35.8% 0.6%, 49.5% 1.2%, 50.1% 99.1%, 35.8% 99.7%)',
      'polygon(52.3% 1.2%, 66% 0.6%, 66.8% 99.6%, 52.4% 99.1%)',
      'polygon(69.5% 0.4%, 82.7% 0.2%, 83.7% 99.8%, 69.5% 99.6%)',
      'polygon(85.4% 0.2%, 98.7% 0%, 100% 99%, 84.9% 99.8%)',
    ],
  },
];

const navItems = [
  ['new', '新品项目', '08'],
  ['gallery', '图库收纳', '128'],
  ['frames', '框架库', '10'],
  ['colors', '颜色库', '06'],
  ['jobs', '生成任务', '03'],
  ['delivery', '交付中心', '12'],
];

const sizeMatrix = ['187 × 71', '187 × 81', '187 × 91', '187 × 101', '187 × 111', '197 × 71', '197 × 81', '197 × 91', '197 × 101', '197 × 111', '207 × 71', '207 × 81', '207 × 91', '207 × 101', '207 × 111', '217 × 71', '217 × 81', '217 × 91', '217 × 101', '217 × 111'];

export default function Home() {
  const generations = useGenerations();
  const [previewTaskId, setPreviewTaskId] = useState('');
  const aspectRatio = '16:9';
  const resolution = '2k';
  const [intent, setIntent] = useState<StudioIntent>('composition');
  const [instruction, setInstruction] = useState<string>(studioIntents[0].instruction);
  const [previousInstruction, setPreviousInstruction] = useState<string | null>(null);
  const [viewedTaskId, setViewedTaskId] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const submitGuard = useRef(false);
  const [libraryItems, setLibraryItems] = useState(artworks);
  const [uploadedFrames, setUploadedFrames] = useState<FrameOption[]>([]);
  const [frameUploading, setFrameUploading] = useState(false);
  const [frameUploadProgress, setFrameUploadProgress] = useState('');
  const [homeSampleIds, setHomeSampleIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('mist');
  const [frameId, setFrameId] = useState('ruyi-walnut');
  const [frameColorId, setFrameColorId] = useState('walnut');
  const [previewReady, setPreviewReady] = useState(false);
  const [previewGenerating, setPreviewGenerating] = useState(false);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState('');
  const [generatedPreviewId, setGeneratedPreviewId] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [hiddenArtworkIds, setHiddenArtworkIds] = useState<string[]>([]);
  const [hiddenFrameIds, setHiddenFrameIds] = useState<string[]>([]);
  const [activeNav, setActiveNav] = useState('new');
  const [notice, setNotice] = useState('');
  const visibleLibraryItems = useMemo(() => libraryItems.filter((item) => !hiddenArtworkIds.includes(item.id)), [hiddenArtworkIds, libraryItems]);
  const visibleCabinetFrames = useMemo(() => [...uploadedFrames, ...cabinetFrameStyles].filter((item) => !hiddenFrameIds.includes(item.id)), [hiddenFrameIds, uploadedFrames]);
  const visibleScreenFrames = useMemo(() => frames.filter((item) => !hiddenFrameIds.includes(item.id)), [hiddenFrameIds]);
  const visibleFrameOptions = [...visibleCabinetFrames, ...visibleScreenFrames];
  const selected = visibleLibraryItems.find((item) => item.id === selectedId) ?? visibleLibraryItems[0];
  const frame: FrameOption = visibleFrameOptions.find((item) => item.id === frameId) ?? visibleFrameOptions[0];
  const frameColor = frameColors.find((item) => item.id === frameColorId) ?? frameColors[0];
  const sizeOutputCount = frame.variantCount ?? sizeMatrix.length;
  const homeArtworks = [selected, ...homeSampleIds.filter((id) => id !== selected?.id).map((id) => visibleLibraryItems.find((item) => item.id === id))].filter((item): item is typeof artworks[number] => Boolean(item)).slice(0, 3);
  const homeFrames = [frame, ...visibleFrameOptions.filter((item) => item.id !== frame?.id)].filter(Boolean).slice(0, 4);
  const currentIntent = studioIntents.find((item) => item.id === intent)!;
  const viewedTask = generations.tasks.find((task) => task.id === viewedTaskId);
  const previewTask = generations.tasks.find((task) => task.id === previewTaskId);

  useEffect(() => {
    if (!previewTask) return;
    setPreviewGenerating(isActiveGeneration(previewTask.status));
    if (previewTask.status === 'succeeded' && previewTask.url) {
      setGeneratedPreviewUrl(previewTask.url);
      setGeneratedPreviewId(previewTask.assetId || '');
      setPreviewReady(true);
      setPreviewError('');
    } else if (previewTask.error) setPreviewError(previewTask.error);
  }, [previewTask]);

  useEffect(() => {
    const readLocalIds = (key: string) => {
      try {
        const value = JSON.parse(window.localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    };
    const localArtworkIds = readLocalIds('pingfeng-hidden-artworks');
    const localFrameIds = readLocalIds('pingfeng-hidden-frames');
    setHiddenArtworkIds(localArtworkIds);
    setHiddenFrameIds(localFrameIds);
    fetch('/api/hidden-options').then((response) => response.ok ? response.json() : null).then(async (data) => {
      const saved = data as { artworkIds?: string[]; frameIds?: string[] } | null;
      const artworkIds = [...new Set([...(saved?.artworkIds || []), ...localArtworkIds])];
      const frameIds = [...new Set([...(saved?.frameIds || []), ...localFrameIds])];
      setHiddenArtworkIds(artworkIds);
      setHiddenFrameIds(frameIds);
      const migrations = await Promise.all([
        localArtworkIds.length ? fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'artwork', ids: localArtworkIds }) }) : null,
        localFrameIds.length ? fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'frame', ids: localFrameIds }) }) : null,
      ]);
      if (!migrations[0] || migrations[0].ok) window.localStorage.removeItem('pingfeng-hidden-artworks');
      if (!migrations[1] || migrations[1].ok) window.localStorage.removeItem('pingfeng-hidden-frames');
    }).catch(() => undefined);
    fetch('/library/2026-08-27-v2/library-index.json').then((response) => response.ok ? response.json() : null).then((data) => {
      const manifest = data as { items?: Array<{ id: string; name: string; thumb: string; category: string; collection: string; date: string }> } | null;
      if (!manifest?.items || !Array.isArray(manifest.items)) return;
      const localItems = manifest.items.map((row: { id: string; name: string; thumb: string; category: string; collection: string; date: string }) => ({ id: row.id, name: row.name, file: row.thumb, tag: classifyArtworkCategory(row.name, row.category), ratio: row.collection, tone: row.date }));
      setLibraryItems((current) => [...localItems, ...current.filter((item) => !localItems.some((local: { id: string }) => local.id === item.id))]);
    }).catch(() => undefined);
    fetch('/api/library').then((response) => response.ok ? response.json() : []).then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const frameUploads = rows.filter((row: { category: string }) => row.category === '框架模板').map((row: { id: string; name: string; url: string; tags?: string }) => {
        const variantCount = frameVariantCount(row.tags);
        return { id: `uploaded-frame-${row.id}`, name: row.name, file: row.url, tone: variantCount > 1 ? `文件夹上传 · ${variantCount}张规格图` : '本地上传 · 标准合并框架', color: '#432d24', profile: 'cabinet', variantCount };
      });
      const uploads = rows.filter((row: { category: string }) => !row.category.startsWith('框架')).map((row: { id: string; name: string; url: string; category: string; tone: string }) => ({ id: row.id, name: row.name, file: row.url, tag: classifyArtworkCategory(row.name, row.category), ratio: '原图', tone: row.tone || '自动归类' }));
      setUploadedFrames(frameUploads);
      setLibraryItems((current) => [...uploads, ...current.filter((item) => !uploads.some((upload) => upload.id === item.id))]);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (visibleLibraryItems.length === 0) return;
    const pool = [...visibleLibraryItems];
    for (let index = pool.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    setHomeSampleIds(pool.slice(0, 3).map((item) => item.id));
  }, [visibleLibraryItems]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (frame && frame.id !== frameId) setFrameId(frame.id);
  }, [frame, frameId]);

  async function createProduct() {
    if (productSaving) return;
    if (!previewReady || !selected || !frame) {
      setNotice('请先确认组合并查看效果图。');
      window.setTimeout(() => setNotice(''), 3000);
      return;
    }
    setProductSaving(true);
    const response = await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: selected.id, artworkName: selected.name, frameId: frame.id, frameName: `${frame.name}·${frameColor.name}`, sampleAssetId: generatedPreviewId, sizeCount: sizeOutputCount }) }).catch(() => null);
    setProductSaving(false);
    setNotice(response?.ok ? `“${selected.name} · ${frame.name}”已连同效果图保存，后续制作任务尚未启动。` : '新品保存失败，请稍后重试；生成的效果图仍然保留。');
    window.setTimeout(() => setNotice(''), 3600);
  }

  function resetPreview() {
    if (previewGenerating || submitGuard.current) return;
    setPreviewTaskId('');
    setViewedTaskId('');
    setPreviewReady(false);
    setPreviewGenerating(false);
    setGeneratedPreviewUrl('');
    setGeneratedPreviewId('');
    setPreviewError('');
  }

  function changeInstruction(value: string) {
    if (previewGenerating || submitGuard.current) return;
    setPreviousInstruction(instruction);
    setInstruction(value.slice(0, 1500));
    resetPreview();
  }

  function chooseIntent(next: StudioIntent) {
    if (previewGenerating || submitGuard.current) return;
    setIntent(next);
    if (!instruction.trim() || studioIntents.some((item) => item.instruction === instruction)) changeInstruction(studioIntents.find((item) => item.id === next)!.instruction);
    resetPreview();
  }

  function reuseTask(task: GenerationTask) {
    if (generations.busy || previewGenerating || submitGuard.current) { setNotice('请先等待当前任务完成，再使用历史设置。'); return; }
    const recipe = task.recipe;
    if (!recipe) return;
    if (!visibleLibraryItems.some((item) => item.id === recipe.artworkId) || !visibleFrameOptions.some((item) => item.id === recipe.frameId) || !frameColors.some((item) => item.id === recipe.colorId)) {
      setNotice('这组设置中的图案或框架当前不可选，请先在素材库恢复或重新选择。');
      return;
    }
    resetPreview();
    setSelectedId(recipe.artworkId);
    setFrameId(recipe.frameId);
    setFrameColorId(recipe.colorId);
    setIntent(recipe.intent);
    setInstruction(recipe.instruction);
    setPreviousInstruction(null);
    if (task.status === 'succeeded' && task.url) {
      setPreviewTaskId(task.id);
      setGeneratedPreviewUrl(task.url);
      setGeneratedPreviewId(task.assetId || '');
      setPreviewReady(true);
    }
    setActiveNav('new');
    setNotice('已带入图案、框架、木色和制作要求。修改后点击生成，不会自动提交。');
    window.setTimeout(() => setNotice(''), 4000);
  }

  async function generatePreview() {
    if (!selected || !frame || previewGenerating || submitGuard.current || generations.busy || !generations.config?.configured) return;
    submitGuard.current = true;
    setViewedTaskId('');
    setPreviewTaskId('');
    setPreviewReady(false);
    setPreviewGenerating(true);
    setGeneratedPreviewUrl('');
    setGeneratedPreviewId('');
    setPreviewError('');
    try {
        const artworkResponse = await fetch(selected.file);
        if (!artworkResponse.ok) throw new Error('所选图案暂时无法读取。');
        const form = new FormData();
        form.set('artwork', await artworkResponse.blob(), `${selected.name}.png`);
        if (frame.file) {
          const frameResponse = await fetch(frame.file);
          if (!frameResponse.ok) throw new Error('所选框架暂时无法读取。');
          form.set('frame', await frameResponse.blob(), `${frame.name}.png`);
        }
        form.set('artworkName', selected.name);
        form.set('artworkId', selected.id);
        form.set('frameName', frame.name);
        form.set('frameId', frame.id);
        form.set('frameProfile', frame.profile);
        form.set('colorId', frameColor.id);
        form.set('colorName', frameColor.name);
        form.set('colorHex', frameColor.color);
        form.set('aspectRatio', aspectRatio);
        form.set('resolution', resolution);
        form.set('instruction', instruction);
        form.set('intent', intent);
        const task = await generations.submit(form);
        setPreviewTaskId(task.id);
        setPreviewGenerating(isActiveGeneration(task.status));
        setNotice('任务已提交给 RunningHub，可在「生成任务」查看进度。');
    } catch (error) {
      setPreviewGenerating(false);
      setPreviewError(error instanceof Error ? error.message : '提交状态未确认，请先查看任务记录，不要重复生成。');
    } finally {
      submitGuard.current = false;
      window.setTimeout(() => setNotice(''), 3600);
    }
  }

  function selectArtwork(id: string) {
    if (previewGenerating || submitGuard.current) { setNotice('当前组合正在生成，请完成后再更换图案。'); return; }
    setSelectedId(id);
    resetPreview();
  }

  function selectFrame(id: string) {
    if (previewGenerating || submitGuard.current) { setNotice('当前组合正在生成，请完成后再更换框架。'); return; }
    setFrameId(id);
    resetPreview();
  }

  function selectFrameColor(id: string) {
    if (previewGenerating || submitGuard.current) { setNotice('当前组合正在生成，请完成后再更换颜色。'); return; }
    setFrameColorId(id);
    resetPreview();
  }

  async function removeArtwork(id: string, name: string) {
    if (previewGenerating || submitGuard.current) { setNotice('请等待当前组合生成完成。'); return; }
    if (visibleLibraryItems.length <= 1) {
      setNotice('图库至少需要保留一个可选图案。');
      return;
    }
    if (!window.confirm(`确定从工作台选择列表中移除“${name}”吗？原始图片文件不会删除。`)) return;
    const next = [...new Set([...hiddenArtworkIds, id])];
    setHiddenArtworkIds(next);
    window.localStorage.setItem('pingfeng-hidden-artworks', JSON.stringify(next));
    resetPreview();
    const response = await fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'artwork', ids: [id] }) }).catch(() => null);
    if (response?.ok) window.localStorage.removeItem('pingfeng-hidden-artworks');
    setNotice(response?.ok ? `“${name}”已从图库选项中永久移除。` : `“${name}”已在本页移除，后台保存暂未完成。`);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function removeFrame(id: string, name: string) {
    if (previewGenerating || submitGuard.current) { setNotice('请等待当前组合生成完成。'); return; }
    if (visibleFrameOptions.length <= 1) {
      setNotice('框架库至少需要保留一个可选框架。');
      return;
    }
    if (!window.confirm(`确定从工作台选择列表中移除“${name}”吗？原始框架文件不会删除。`)) return;
    const next = [...new Set([...hiddenFrameIds, id])];
    setHiddenFrameIds(next);
    window.localStorage.setItem('pingfeng-hidden-frames', JSON.stringify(next));
    resetPreview();
    const response = await fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'frame', ids: [id] }) }).catch(() => null);
    if (response?.ok) window.localStorage.removeItem('pingfeng-hidden-frames');
    setNotice(response?.ok ? `“${name}”已从框架选项中永久移除。` : `“${name}”已在本页移除，后台保存暂未完成。`);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function restoreArtworks() {
    const response = await fetch('/api/hidden-options?kind=artwork', { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setNotice('恢复没有完成，请稍后重试。');
      return;
    }
    setHiddenArtworkIds([]);
    window.localStorage.removeItem('pingfeng-hidden-artworks');
    setNotice('已恢复全部图库选项。');
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function restoreFrames() {
    const response = await fetch('/api/hidden-options?kind=frame', { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setNotice('恢复没有完成，请稍后重试。');
      return;
    }
    setHiddenFrameIds([]);
    window.localStorage.removeItem('pingfeng-hidden-frames');
    setNotice('已恢复全部框架选项。');
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function uploadAsset(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('name', file.name.replace(/\.[^.]+$/, ''));
    form.set('category', '自动分类');
    const response = await fetch('/api/library', { method: 'POST', body: form }).catch(() => null);
    if (!response?.ok) {
      setNotice('上传没有完成，请检查图片格式或稍后重试。');
      return;
    }
    const row = await response.json() as { id: string; name: string; url: string; category: string };
    const uploaded = { id: row.id as string, name: row.name as string, file: row.url as string, tag: classifyArtworkCategory(row.name as string, row.category as string), ratio: '原图', tone: '自动归类' };
    setLibraryItems((current) => [uploaded, ...current]);
    selectArtwork(uploaded.id);
    setNotice(`“${uploaded.name}”已自动归入“${uploaded.tag}”。`);
    window.setTimeout(() => setNotice(''), 3600);
  }

  async function uploadFrame(fileList: FileList | null) {
    if (!fileList || frameUploading) return;
    const images = Array.from(fileList).filter((file) => file.type === 'image/png' || file.type === 'image/jpeg' || /\.(png|jpe?g)$/i.test(file.name));
    if (images.length === 0) {
      setNotice('所选文件夹里没有可用的 JPG 或 PNG 图片。');
      window.setTimeout(() => setNotice(''), 3600);
      return;
    }

    setFrameUploading(true);
    setFrameUploadProgress(`准备上传，共 ${images.length} 张`);
    const folderName = frameFolderName(images);
    const representative = representativeFrame(images);
    const uploadOne = async (file: File, category: '框架模板' | '框架规格原图') => {
      const form = new FormData();
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      form.set('file', file);
      form.set('name', category === '框架模板' ? folderName : `${folderName}/${relativePath.split('/').slice(1).join('/') || file.name}`);
      form.set('category', category);
      form.set('tags', category === '框架模板' ? `款式文件夹:${folderName};规格数量:${images.length};标准合并框架` : `所属款式:${folderName};规格原图`);
      return fetch('/api/library', { method: 'POST', body: form }).catch(() => null);
    };

    const representativeResponse = await uploadOne(representative, '框架模板');
    if (!representativeResponse?.ok) {
      const message = await representativeResponse?.json().catch(() => null) as { error?: string } | null;
      setNotice(message?.error || '框架文件夹上传没有完成，请检查图片格式后重试。');
      setFrameUploadProgress('');
      setFrameUploading(false);
      return;
    }

    const row = await representativeResponse.json() as { id: string; url: string };
    let completed = 1;
    let failed = 0;
    setFrameUploadProgress(`正在上传 ${completed}/${images.length}`);
    const remaining = images.filter((file) => file !== representative);
    for (let index = 0; index < remaining.length; index += 4) {
      const batch = remaining.slice(index, index + 4);
      const results = await Promise.all(batch.map((file) => uploadOne(file, '框架规格原图')));
      completed += results.length;
      failed += results.filter((response) => !response?.ok).length;
      setFrameUploadProgress(`正在上传 ${completed}/${images.length}`);
    }

    const uploaded: FrameOption = { id: `uploaded-frame-${row.id}`, name: folderName, file: row.url as string, tone: `文件夹上传 · ${images.length}张规格图`, color: '#432d24', profile: 'cabinet', variantCount: images.length };
    setUploadedFrames((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
    selectFrame(uploaded.id);
    setFrameUploadProgress('');
    setFrameUploading(false);
    setNotice(failed === 0 ? `“${folderName}”整套 ${images.length} 张已保存，框架库只生成一个代表框架。` : `“${folderName}”代表框架已保存；${images.length - failed}/${images.length} 张上传成功，${failed} 张可稍后补传。`);
    window.setTimeout(() => setNotice(''), 5200);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><span>屏</span></div>
          <div>
            <strong>屏风新品工作台</strong>
            <small>PRODUCT STUDIO</small>
          </div>
        </div>

        <nav className="side-nav" aria-label="工作台导航">
          <p className="nav-label">工作流</p>
          {navItems.map(([id, label]) => (
            <button key={id} title={label} aria-current={activeNav === id ? 'page' : undefined} className={activeNav === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(id)}>
              <span className={`nav-icon nav-icon-${id}`} aria-hidden="true" />
              <span>{label}</span>
              <em>{id === 'gallery' ? visibleLibraryItems.length : id === 'frames' ? visibleFrameOptions.length : id === 'colors' ? frameColors.length : id === 'jobs' ? generations.tasks.length : id === 'delivery' ? generations.tasks.filter((task) => task.status === 'succeeded').length : ''}</em>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <section className="storage-card">
          <div className="storage-title"><span>生图服务</span><b>RunningHub</b></div>
          <p>{generations.config?.configured ? '服务端密钥已配置' : '服务端密钥待配置'}</p>
          <button onClick={() => setActiveNav('jobs')}>查看生成记录</button>
        </section>
        <div className="profile-row">
          <span className="avatar">徐</span>
          <div><strong>徐艺木业</strong><small>个人工作台</small></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">PRODUCT STUDIO / 徐艺木业</p>
            <h1>{navItems.find(([id]) => id === activeNav)?.[1] || '新品项目'}</h1>
          </div>
          <div className="top-actions">
            <span className="sync-state">RunningHub 图像生成</span>
            <button className="ghost-button" onClick={() => setActiveNav(activeNav === 'new' ? 'jobs' : 'new')}>{activeNav === 'new' ? '查看生成记录' : '返回组合生图'}</button>
          </div>
        </header>

        {activeNav === 'new' && <div className="studio-flow" aria-label="制作步骤"><span><b>01</b>选出图用途</span><span><b>02</b>搭配图案与框架</span><span><b>03</b>调整制作要求</span><span className={previewReady ? 'flow-complete' : 'flow-active'}><b>04</b>{previewReady ? '效果图已生成' : '生成并确认'}</span></div>}
        <div className={`content-grid ${activeNav === 'new' ? '' : 'view-hidden'}`}>
          <section className="library-panel">
            <fieldset className="intent-picker" disabled={previewGenerating}>
              <legend>这次想做什么图？</legend>
              <div className="intent-options">{studioIntents.map((item, index) => <label key={item.id} className={intent === item.id ? 'intent-option selected' : 'intent-option'}><input type="radio" name="studio-intent" value={item.id} checked={intent === item.id} onChange={() => chooseIntent(item.id)} /><span className="intent-number">0{index + 1}</span><strong>{item.name}</strong><small>{item.subtitle}</small></label>)}</div>
            </fieldset>
            <section className="choice-section artwork-choice-section">
              <div className="section-heading">
                <div><p>ARTWORK OPTIONS</p><h2>图案选项</h2></div>
                <button className="upload-button" onClick={() => setActiveNav('gallery')}>更多图案 <span>→</span></button>
              </div>

              <p className="home-gallery-note">已选图案固定在首位，也可以直接上传新的画芯。</p>
              <div className="gallery-grid home-gallery-grid">
                {(homeArtworks.length ? homeArtworks : visibleLibraryItems.slice(0, 3)).map((item) => (
                  <div className="option-card-wrap" key={item.id}>
                    <button className={selectedId === item.id ? 'art-card selected' : 'art-card'} onClick={() => selectArtwork(item.id)}>
                      <div className="art-thumb"><img src={item.file} alt={item.name} loading="lazy" />
                        <span className="asset-state">已入库</span>
                        {selectedId === item.id && <span className="selected-check">✓</span>}
                      </div>
                      <div className="art-meta"><strong>{item.name}</strong><p><span>{item.tag}</span><span>{item.tone}</span></p></div>
                      <div className="art-info"><span>JPG · {item.ratio}</span><span>•••</span></div>
                    </button>
                  </div>
                ))}
              </div>
              <div className="home-library-footer"><span>当前可选 {visibleLibraryItems.length} 张图案</span><label className="inline-upload">＋ 上传画芯<input type="file" accept="image/png,image/jpeg,image/webp" disabled={previewGenerating} onChange={(event) => { void uploadAsset(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><button onClick={() => setActiveNav('gallery')}>从图库选择 →</button></div>
            </section>

            <section className="choice-section frame-choice-section">
              <div className="section-heading">
                <div><p>FRAME OPTIONS</p><h2>框架选项</h2></div>
                <button className="upload-button" onClick={() => setActiveNav('frames')}>更多框架 <span>→</span></button>
              </div>
              <p className="home-gallery-note">优先显示已选框架。完整款式和规格原图保留在框架库。</p>
              <div className="home-frame-grid">
                {homeFrames.map((item) => <div className="option-card-wrap" key={item.id}>
                  <button className={frameId === item.id ? 'home-frame-card selected' : 'home-frame-card'} onClick={() => selectFrame(item.id)}>
                    {item.file ? <span className="home-frame-thumb image-frame-thumb"><img src={item.file} alt={`${item.name}标准合并框架`} /></span> : <span className="home-frame-thumb"><i style={{ '--swatch': item.color } as React.CSSProperties}><em /></i></span>}
                    <span><strong>{item.name}</strong><small>{item.tone}</small></span>
                    {frameId === item.id && <b>✓</b>}
                  </button>
                </div>)}
              </div>
            </section>

            <section className="frame-color-picker">
              <div className="row-label"><span>框架颜色</span><b>{frameColor.name}</b></div>
              <div className="frame-color-options">
                {frameColors.map((item) => <button key={item.id} className={frameColorId === item.id ? 'selected' : ''} disabled={previewGenerating} onClick={() => selectFrameColor(item.id)} aria-pressed={frameColorId === item.id} aria-label={`选择${item.name}框架颜色`}><i style={{ backgroundColor: item.color, backgroundImage: item.texture ? `url(${item.texture})` : 'none' }} /><strong>{item.name}</strong>{frameColorId === item.id && <b>✓</b>}</button>)}
              </div>
            </section>

            <section className="generation-parameters" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void generatePreview(); } }}>
              <div className="row-label"><label htmlFor="generation-instruction">制作要求</label><b>{currentIntent.label}</b></div>
              <p className="brief-help">说清楚想保留什么、调整什么；图案、框架和木色会自动带入。</p>
              <div className="brief-tools"><button disabled={previewGenerating} onClick={() => changeInstruction(currentIntent.instruction)}>填入用途示例</button><button disabled={previewGenerating || previousInstruction === null} onClick={() => { if (previousInstruction !== null) { setInstruction(previousInstruction); setPreviousInstruction(null); resetPreview(); } }}>撤回修改</button><span>{instruction.length}/1500</span></div>
              <textarea id="generation-instruction" value={instruction} maxLength={1500} disabled={previewGenerating} onChange={(event) => changeInstruction(event.target.value)} placeholder="例如：画芯居中完整，木纹清晰，主体不要被背景家具遮挡。" rows={4} />
              <p className="brief-rules">默认要求：保留产品结构 · 保留画芯内容 · 使用所选木色</p>
              <details className="output-settings"><summary><span>单次 1 张 · 16:9 · 2K</span><span>查看生成设置</span></summary><RunningHubSettings config={generations.config} onRefresh={generations.refreshConfig} /><p>当前使用 GPT Image 2 标准质量。每次提交生成一张图片。</p></details>
              {generations.error && <p className="generation-warning" role="status">{generations.error}</p>}
              <p className="generation-privacy">参考图和制作要求将发送至 RunningHub，按账户的 API 规则计费。</p>
              <button className="combine-button" disabled={previewGenerating || generations.busy || !generations.config?.configured} onClick={generatePreview}>{previewGenerating ? '任务处理中…' : generations.busy ? '请先处理已有任务' : !generations.config?.configured ? '配置 RunningHub 后可生成' : previewReady ? '按当前要求再生成一张' : `生成${currentIntent.name}`} <span>→</span></button>
              <p className="generation-shortcut">Ctrl / ⌘ + Enter 生成 · 结果保存在右侧</p>
              {generations.busy && !previewGenerating && <button className="open-color-library" onClick={() => setActiveNav('jobs')}>查看待处理任务 →</button>}
            </section>
          </section>

          <aside className="compose-panel">
            <div className="compose-heading"><div><p>RESULTS</p><h2>{viewedTask ? '历史效果' : '效果预览'}</h2></div><span className={previewReady ? 'draft-badge ready' : previewError ? 'draft-badge error' : 'draft-badge'}>{viewedTask ? generationLabels[viewedTask.status] : previewTask ? generationLabels[previewTask.status] : previewGenerating ? '准备参考图' : previewReady ? '已生成' : '待生成'}</span></div>
            {viewedTask && <div className="viewed-task-heading"><strong>{viewedTask.name}</strong><button onClick={() => setViewedTaskId('')}>返回当前组合</button></div>}
            <div className="preview-stage">
              <div className="ambient-circle" />
              {viewedTask?.url ? <figure className="generated-preview"><img src={viewedTask.url} alt={viewedTask.name} /><figcaption>{new Date(viewedTask.createdAt).toLocaleString('zh-CN')}</figcaption></figure> : previewGenerating ? <div className="preview-generating"><i /><strong>{previewTask ? generationLabels[previewTask.status] : '正在准备参考图'}</strong><small>{generations.paused ? '自动查询已暂停，请恢复查询。' : '图片生成后会自动显示在这里，无需重复提交。'}</small></div> : previewReady && generatedPreviewUrl ? <figure className="generated-preview"><img src={generatedPreviewUrl} alt={`${selected.name}与${frame.name}${frameColor.name}真实生成效果`} /><figcaption>RunningHub · GPT Image 2</figcaption></figure> : <div className="preview-placeholder"><span className="preview-pair"><img src={selected.file} alt="已选图案" />＋<i style={{ '--preview-frame': frameColor.color, '--preview-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}>{frame.file ? <img src={frame.file} alt="已选框架" /> : <em />}</i></span><strong>{currentIntent.name}</strong><small>选好搭配，调整制作要求后生成第一张。</small></div>}
            </div>

            {previewError && <p className="generation-warning" role="alert">{previewError}</p>}
            {generations.paused && <button className="resume-generation" onClick={generations.resume}>恢复任务查询</button>}
            {(viewedTask?.url || previewReady) && <div className="preview-actions"><a href={viewedTask?.url || generatedPreviewUrl} target="_blank" rel="noreferrer">查看原图 ↗</a><a href={`${viewedTask?.url || generatedPreviewUrl}?download=1`} download>下载结果 ↓</a></div>}
            {viewedTask?.recipe && <button className="reuse-result" disabled={generations.busy || previewGenerating} onClick={() => reuseTask(viewedTask)}>使用这组搭配与制作要求</button>}
            {viewedTask?.recipe && <details className="saved-brief"><summary>查看当时的制作要求</summary><p>{viewedTask.recipe.instruction || '使用默认制作要求'}</p></details>}

            {!viewedTask && <div className="selection-summary">
              <div className="summary-art"><img src={selected.file} alt="" /><span><small>已选图案</small><strong>{selected.name}</strong></span><button onClick={() => setActiveNav('gallery')}>更换</button></div>
              <div className="summary-frame"><span className="summary-frame-icon" style={{ '--summary-frame': frameColor.color, '--summary-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}>{frame.file ? <img src={frame.file} alt="" /> : <i />}<em /></span><span><small>已选框架</small><strong>{frame.name} · {frameColor.name}</strong></span><button onClick={() => setActiveNav('frames')}>更换</button></div>
            </div>}

            {!viewedTask && <><button className="create-cta" disabled={!previewReady || previewGenerating || productSaving} onClick={createProduct}>{productSaving ? '保存新品中…' : '确认效果，保存新品'} <span>→</span></button><p className="approval-note">确认后把当前效果图与新品关联，方便后续制作。</p></>}
            <section className="recent-generations"><div className="row-label"><h3>最近生成</h3><button onClick={() => setActiveNav('jobs')}>全部记录 →</button></div>
              {generations.loading ? <p className="recent-empty">正在读取生成记录…</p> : generations.tasks.length ? <div className="recent-list">{generations.tasks.slice(0, 5).map((task) => <button className={(viewedTask?.id || previewTaskId) === task.id ? 'recent-item selected' : 'recent-item'} key={task.id} onClick={() => { if (task.url) setViewedTaskId(task.id); else setActiveNav('jobs'); }}><span className="recent-thumb">{task.url ? <img src={task.url} alt="" loading="lazy" /> : <span>{generationLabels[task.status]}</span>}</span><span><strong>{task.name}</strong><small>{task.recipe ? studioIntents.find((item) => item.id === task.recipe?.intent)?.name : '组合效果图'} · {new Date(task.createdAt).toLocaleDateString('zh-CN')}</small></span><em>{generationLabels[task.status]}</em></button>)}</div> : <div className="recent-empty"><strong>第一张效果图，从左侧开始</strong><p>生成后会自动保留在这里，可下载或再次使用设置。</p></div>}
            </section>
            <details className="output-plan">
              <summary>后续交付规划</summary>
              <div className="output-items">
                <div><strong>新品主图</strong><small>场景图与电商白底图</small></div>
                <div><strong>单尺寸图</strong><small>{sizeOutputCount} 个规格</small></div>
                <div><strong>全新详情页</strong><small>790px 长图、切片与 QA</small></div>
              </div>
              <p className="approval-note">以上是后续交付计划，保存新品不会自动启动批量制作。</p>
            </details>
          </aside>
        </div>

        {activeNav !== 'new' && activeNav !== 'jobs' && activeNav !== 'delivery' && <SecondaryView view={activeNav} libraryItems={visibleLibraryItems} selectedArtworkId={selectedId} onSelectArtwork={selectArtwork} onDeleteArtwork={removeArtwork} onRestoreArtworks={restoreArtworks} hiddenArtworkCount={hiddenArtworkIds.length} onUploadArtwork={uploadAsset} frameId={frameId} frameStyles={visibleCabinetFrames} screenFrames={visibleScreenFrames} onSelectFrame={selectFrame} onDeleteFrame={removeFrame} onRestoreFrames={restoreFrames} hiddenFrameCount={hiddenFrameIds.length} onUploadFrame={uploadFrame} frameUploading={frameUploading} frameUploadProgress={frameUploadProgress} frameColorId={frameColorId} onSelectFrameColor={selectFrameColor} onCreate={() => setActiveNav('new')} />}

      {(activeNav === 'jobs' || activeNav === 'delivery') && <div className="history-workspace"><GenerationHistory tasks={generations.tasks} loading={generations.loading} error={generations.error} paused={generations.paused} onRefresh={generations.resume} onResolve={generations.resolveUnknown} onReuse={reuseTask} delivery={activeNav === 'delivery'} /></div>}
      </section>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}

function SecondaryView({ view, libraryItems, selectedArtworkId, onSelectArtwork, onDeleteArtwork, onRestoreArtworks, hiddenArtworkCount, onUploadArtwork, frameId, frameStyles, screenFrames, onSelectFrame, onDeleteFrame, onRestoreFrames, hiddenFrameCount, onUploadFrame, frameUploading, frameUploadProgress, frameColorId, onSelectFrameColor, onCreate }: { view: string; libraryItems: typeof artworks; selectedArtworkId: string; onSelectArtwork: (id: string) => void; onDeleteArtwork: (id: string, name: string) => void; onRestoreArtworks: () => void; hiddenArtworkCount: number; onUploadArtwork: (file: File | undefined) => void; frameId: string; frameStyles: FrameOption[]; screenFrames: FrameOption[]; onSelectFrame: (id: string) => void; onDeleteFrame: (id: string, name: string) => void; onRestoreFrames: () => void; hiddenFrameCount: number; onUploadFrame: (files: FileList | null) => void; frameUploading: boolean; frameUploadProgress: string; frameColorId: string; onSelectFrameColor: (id: string) => void; onCreate: () => void }) {
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('全部素材');
  const filteredGallery = useMemo(() => libraryItems.filter((item) => {
    const searchMatch = `${item.name}${item.tag}${item.tone}${item.ratio}`.includes(gallerySearch.trim());
    const categoryMatch = galleryCategory === '全部素材' || item.tag === galleryCategory;
    return searchMatch && categoryMatch;
  }), [galleryCategory, gallerySearch, libraryItems]);
  const categoryCounts = useMemo(() => Object.fromEntries(artworkCategories.map((category) => [category, libraryItems.filter((item) => item.tag === category).length])), [libraryItems]);
  const galleryGroups = useMemo(() => artworkCategories.map((category) => ({ category, items: filteredGallery.filter((item) => item.tag === category) })).filter((group) => group.items.length > 0), [filteredGallery]);
  const headings: Record<string, [string, string]> = {
    gallery: ['图库收纳', '统一管理画芯、场景参考与已用素材'],
    frames: ['框架库', '按框型、木色和结构选择真实产品模板'],
    colors: ['颜色库', '独立管理框架材质与六种标准颜色'],
    jobs: ['生成任务', '样图审批通过后，自动推进批量任务'],
    delivery: ['交付中心', '按新品版本汇总主图、尺寸图、详情页与 QA 文件'],
  };
  const [title, description] = headings[view] ?? ['新品项目', '管理所有新品制作进度'];
  return (
    <section className="secondary-view">
      <header className="secondary-head"><div><p className="eyebrow">WORKSPACE LIBRARY</p><h2>{title}</h2><span>{description}</span></div><button className="primary-button" onClick={onCreate}>＋ 创建新品</button></header>
      {view === 'frames' && <>
        <section className="cabinet-style-section">
          <div className="frame-subheading"><div><p className="eyebrow">ONE STYLE · ONE COMBINE FRAME</p><h3>结构框架款式</h3></div><span>每个款式只提供一个标准空框用于合并</span></div>
          <div className="cabinet-style-grid">
            {frameStyles.map((item) => <div className="option-card-wrap" key={item.id}>
              <button className={frameId === item.id ? 'cabinet-style-card selected' : 'cabinet-style-card'} onClick={() => onSelectFrame(item.id)}>
                <div><img src={item.file} alt={`${item.name}标准合并框架`} />{frameId === item.id && <b>已选择 ✓</b>}</div>
                <span><small>标准合并框架</small><strong>{item.name}</strong><em>{item.tone}</em><i>{item.variantCount} 张规格原图保留在款式内部</i></span>
              </button>
              <button className="remove-option" onClick={() => onDeleteFrame(item.id, item.name)} aria-label={`删除框架选项${item.name}`}>删除</button>
            </div>)}
          </div>
          <div className="style-choice-bar"><span>选择款式后直接返回新品页与图案组合，尺寸变体在生成阶段调用。</span><span className="style-bar-actions">{hiddenFrameCount > 0 && <button className="restore-button" onClick={onRestoreFrames}>恢复已移除</button>}<button onClick={onCreate}>使用已选款式创建新品 →</button></span></div>
        </section>
        <div className="frame-subheading"><div><p className="eyebrow">OTHER FRAME SERIES</p><h3>其他屏风框架</h3></div><span>也可继续选择已有的滑轮屏风框型</span></div>
        <div className="frame-library-grid">
          {screenFrames.map((item, index) => <div className="option-card-wrap" key={item.id}>
            <button className={frameId === item.id ? 'frame-library-card selected' : 'frame-library-card'} onClick={() => onSelectFrame(item.id)}>
              <div className="frame-stage"><div className={`mini-screen profile-${item.profile}`} style={{ '--frame-color': item.color } as React.CSSProperties}><span /></div></div>
              <div><small>FRAME {String(index + 1).padStart(2, '0')}</small><strong>{item.name}</strong><p><i style={{ background: item.color }} />{item.tone}<em>{item.profile === 'classic' ? '滑轮底座' : item.profile === 'wide' ? '加宽立柱' : item.profile === 'joinery' ? '榫卯装饰' : '窄边框体'}</em></p></div>
              <span>{frameId === item.id ? '已选择 ✓' : '选择此框架'}</span>
            </button>
            <button className="remove-option" onClick={() => onDeleteFrame(item.id, item.name)} aria-label={`删除框架选项${item.name}`}>删除</button>
          </div>)}
          <label className={frameUploading ? 'frame-upload-card uploading' : 'frame-upload-card'}><b>{frameUploading ? '…' : '＋'}</b><strong>{frameUploading ? '正在上传文件夹' : '选择框架文件夹'}</strong><small>{frameUploading ? frameUploadProgress : '整套 JPG / PNG 一次上传，只生成一个代表框架'}</small><input type="file" accept="image/png,image/jpeg" multiple disabled={frameUploading} {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { onUploadFrame(event.target.files); event.currentTarget.value = ''; }} /></label>
        </div>
      </>}
      {view === 'colors' && <>
        <div className="color-library-intro"><div><p className="eyebrow">FRAME MATERIAL LIBRARY</p><h3>六种标准框架颜色</h3></div><span>颜色独立于框架款式保存，选择后用于组合预览与新品生成。</span></div>
        <div className="color-library-grid">
          {frameColors.map((item, index) => <button key={item.id} className={frameColorId === item.id ? 'color-library-card selected' : 'color-library-card'} onClick={() => onSelectFrameColor(item.id)}>
            <span className="color-material-preview" style={{ backgroundColor: item.color, backgroundImage: item.texture ? `url(${item.texture})` : 'none' }} />
            <span><small>COLOR {String(index + 1).padStart(2, '0')}</small><strong>{item.name}</strong><em>{item.note || (item.texture ? '实拍材质样板' : '标准色板')}</em></span>
            <b>{frameColorId === item.id ? '已选择 ✓' : '选择此颜色'}</b>
          </button>)}
        </div>
        <div className="color-choice-bar"><span>已选颜色：<strong>{frameColors.find((item) => item.id === frameColorId)?.name}</strong></span><button onClick={onCreate}>使用所选颜色创建新品 →</button></div>
      </>}
      {view === 'gallery' && <>
        <div className="library-stats"><div><span>全部素材</span><strong>{libraryItems.length}</strong><small>本地图库与上传素材统一归类</small></div><div><span>图库类别</span><strong>{artworkCategories.length}</strong><small>按图案内容分类收纳</small></div><div><span>自动分类</span><strong>开启</strong><small>上传后立即识别类别</small></div><div><span>未识别素材</span><strong>{categoryCounts['综合图案']}</strong><small>统一收纳在综合图案</small></div></div>
        <div className="secondary-gallery-toolbar"><label className="search-box"><span aria-hidden="true" /><input value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} placeholder="搜索图案、类别、日期或文件夹" /><kbd>{filteredGallery.length}张</kbd></label><div className="filter-chips"><button className={galleryCategory === '全部素材' ? 'selected' : ''} onClick={() => setGalleryCategory('全部素材')}>全部素材 <b>{libraryItems.length}</b></button>{artworkCategories.map((item) => <button key={item} className={galleryCategory === item ? 'selected' : ''} onClick={() => setGalleryCategory(item)}>{item} <b>{categoryCounts[item]}</b></button>)}</div>{hiddenArtworkCount > 0 && <button className="restore-button" onClick={onRestoreArtworks}>恢复已移除</button>}<label className="upload-button"><span>＋</span> 上传并自动分类<input type="file" accept="image/png,image/jpeg" onChange={(event) => onUploadArtwork(event.target.files?.[0])} /></label></div>
        <div className="gallery-category-stack">{galleryGroups.map((group) => <section className="gallery-category-section" key={group.category}><header><h3>{group.category}</h3><span>{group.items.length} 张</span></header><div className="gallery-wide-grid selectable-gallery">{group.items.map((item) => <div className="option-card-wrap" key={item.id}><button className={selectedArtworkId === item.id ? 'selected' : ''} onClick={() => onSelectArtwork(item.id)}><div className="gallery-image-wrap"><img src={item.file} alt={item.name} loading="lazy" />{selectedArtworkId === item.id && <b>已选择 ✓</b>}</div><div><small>{item.tag}</small><strong>{item.name}</strong><p>{item.tone} · {item.ratio}</p></div></button><button className="remove-option" onClick={() => onDeleteArtwork(item.id, item.name)} aria-label={`删除图案选项${item.name}`}>删除</button></div>)}</div></section>)}{galleryGroups.length === 0 && <div className="gallery-empty-state"><strong>没有找到符合条件的图案</strong><span>可以更换类别或清空搜索词后再查看。</span></div>}</div>
        <div className="gallery-selection-bar"><span>已选择：<strong>{libraryItems.find((item) => item.id === selectedArtworkId)?.name ?? '尚未选择'}</strong></span><button onClick={onCreate}>使用所选图案创建新品 →</button></div>
      </>}

    </section>
  );
}
