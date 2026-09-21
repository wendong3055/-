'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { artworkCategories, classifyArtworkCategory } from '../lib/artwork-category';
import { SceneLibrary } from './scene-library';
import { findScene, sceneRequiresOpaqueBackground } from '../lib/scene-library';
import { GenerationHistory, RunningHubSettings, useGenerations } from './generation-studio';
import RhCreator from './rh-creator';
import type { CustomImageConfig } from '../lib/custom-image-config';
import { TrialCanvas } from './trial-canvas';
import { ResizableWorkspace } from './resizable-workspace';
import {ImageModelPicker} from './image-model-picker';
import { backgroundLabels, defaultImageModel, getImageModel, imageModels, qualityLabels } from '../lib/generation-models';
import { referenceUpload } from '../lib/reference-upload';
import { generationLabels, isActiveGeneration, type GenerationTask } from '../lib/generation-types';
import { studioIntents, type StudioIntent } from '../lib/studio-brief';
import { frameSources, frameStyle, frameVariantImages, groupFrameOptions, parseFrameSkuIndex, validFrameStyleName, type FrameAsset, type FrameSize, type FrameVariantImage } from '../lib/frame-catalog';
import { syncHiddenOptions } from '../lib/hidden-options-client';
import { exportFileName, selectableAfterRemoval } from '../lib/artwork-batch';
import { zipSync } from 'fflate';
import { ProductWorkspaceView } from './product-workspace';
import { consentKey, consentSettings, readConsent, consentCovers, createConsent, consumeConsent, type ProductionConsent } from '../lib/production-consent';

type FrameOption = { id: string; name: string; styleKey?: string; tone: string; color: string; profile: string; file?: string; variantCount?: number; sizes?: FrameSize[]; memberIds?: string[]; skuIndex?: string; artworkBox?: { left: string; top: string; width: string; height: string }; artworkClipPaths?: string[] };
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

const frames: FrameOption[] = [];

const cabinetFrameStyles: FrameOption[] = [
  { id: 'fubao-ankang', name: '双门双抽玄关柜框架', tone: '标准合并框架 · 80×200cm', color: '#432d24', profile: 'cabinet', file: '/frames/style-previews/福报安康_80-200.png', variantCount: 30, skuIndex: '/frames/fubao-ankang/sku-frame-index.json' },
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
  ['products', '我的新品', ''],
  ['gallery', '图库收纳', '128'],
  ['scenes', '场景图库', ''],
  ['frames', '框架库', '10'],
  ['colors', '颜色库', '06'],
  ['jobs', '生成任务', '03'],
  ['delivery', '交付中心', '12'],
  ['settings', '连接设置', ''],
];


export default function Home() {
  const generations = useGenerations();
  const customProviders = { providers: [] as CustomImageConfig[] };
  const availableModels = imageModels;
  const [importedResult, setImportedResult] = useState<{ url: string; name: string } | null>(null);
  const [previewTaskId, setPreviewTaskId] = useState('');
  const [modelId, setModelId] = useState(defaultImageModel.id);
  const model = availableModels.find(item => item.id === modelId) || defaultImageModel;
  const customConfig = customProviders.providers.find(p => `custom-${p.id}` === modelId);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2k');
  const [quality, setQuality] = useState('medium');
  const [background, setBackground] = useState('auto');
  const [outputFormat, setOutputFormat] = useState('png');
  const [intent, setIntent] = useState<StudioIntent>('composition');
  const [sceneId, setSceneId] = useState('');
  const scene = findScene(sceneId);
  const [instruction, setInstruction] = useState<string>(studioIntents[0].instruction);
  const [previousInstruction, setPreviousInstruction] = useState<string | null>(null);
  const [viewedTaskId, setViewedTaskId] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const submitGuard = useRef(false);
  const lastCompletedPreview = useRef('');
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
  const [previewError, setPreviewError] = useState('');
  const [hiddenArtworkIds, setHiddenArtworkIds] = useState<string[]>([]);
  const [hiddenFrameIds, setHiddenFrameIds] = useState<string[]>([]);
  const [activeNav, setActiveNav] = useState('new');
  const [productId, setProductId] = useState('');
  const [production, setProduction] = useState<{itemId:string;productId:string;planId:string;planVersion:number;generationId:string|null;pendingItemIds:string[];title:string;brief:string;kind:string;frameUrl:string;sample:GenerationTask;sceneTitle?:string;sceneUrl?:string|null}|null>(null);
  const [productionConsent,setProductionConsent] = useState<ProductionConsent|null>(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const visibleLibraryItems = useMemo(() => libraryItems.filter((item) => !hiddenArtworkIds.includes(item.id)), [hiddenArtworkIds, libraryItems]);
  const visibleCabinetFrames = useMemo(() => groupFrameOptions([...uploadedFrames, ...cabinetFrameStyles], hiddenFrameIds), [hiddenFrameIds, uploadedFrames]);
  // The drawn "screen frame" types were removed: only real frame styles, plus
  // whatever the owner uploads, are selectable. `frames` stays empty so the
  // grouping path is unchanged.
  const visibleScreenFrames = useMemo(() => groupFrameOptions(frames, hiddenFrameIds), [hiddenFrameIds]);
  const visibleFrameOptions = [...visibleCabinetFrames, ...visibleScreenFrames];
  const selected = visibleLibraryItems.find((item) => item.id === selectedId) ?? visibleLibraryItems[0];
  const frame: FrameOption = visibleFrameOptions.find((item) => item.id === frameId) ?? visibleFrameOptions[0];
  const frameColor = frameColors.find((item) => item.id === frameColorId) ?? frameColors[0];
  const homeArtworks = [selected, ...homeSampleIds.filter((id) => id !== selected?.id).map((id) => visibleLibraryItems.find((item) => item.id === id))].filter((item): item is typeof artworks[number] => Boolean(item)).slice(0, 3);
  const homeFrames = [frame, ...visibleFrameOptions.filter((item) => item.id !== frame?.id)].filter(Boolean);
  const currentIntent = studioIntents.find((item) => item.id === intent)!;
  const previewTask = generations.tasks.find((task) => task.id === previewTaskId);
  const completedTasks = generations.tasks.filter((task) => task.status === 'succeeded' && task.url);
  const displayedTask = completedTasks.find((task) => task.id === (viewedTaskId || previewTaskId)) || completedTasks[0];
  const modelConfigured = modelId.startsWith('custom-') ? Boolean(customConfig) : Boolean(generations.config?.regions?.international);
  const sceneInUse = production?.kind === 'size' ? undefined : scene;
  const canGenerate = Boolean(selected && frame) && !productionLoading && !previewGenerating && !generations.busy && modelConfigured && (!production || (selected?.id === production.sample.recipe?.artworkId && frame?.id === production.sample.recipe?.frameId && frameColor.id === production.sample.recipe?.colorId));
  const generateLabel = previewGenerating ? '正在生成…' : generations.busy ? '请先处理已有任务' : !modelConfigured ? '请先完成后台连接' : '在工作台生成效果图';
  const confirmationSettings = consentSettings({model:model.id,providerRevision:customConfig?.revision || '',ratio:aspectRatio,resolution,quality,
    sceneId:sceneInUse?.id || '',
    ...(model.backgrounds?.length ? {background}:{}), ...(model.outputFormats?.length ? {outputFormat}:{})});
  const consentActive = !!production && !!productionConsent && productionConsent.planId===production.planId && productionConsent.settings===confirmationSettings;
  useEffect(()=>{
    if(!production)return;
    const load=()=>{try{setProductionConsent(readConsent(window.localStorage,production.planId));}catch{setProductionConsent(null);}};
    load();window.addEventListener('storage',load);
    return()=>window.removeEventListener('storage',load);
  },[production?.planId]);
  function storeProductionConsent(value:ProductionConsent|null) {
    if(!production)return;
    try {
      if(value)window.localStorage.setItem(consentKey(production.planId),JSON.stringify(value));
      else window.localStorage.removeItem(consentKey(production.planId));
      setProductionConsent(value);
    } catch {setProductionConsent(null);setNotice('浏览器未允许保存确认方式，本次仍可生成；下次会重新询问。');}
  }
  useEffect(() => () => { if (importedResult) URL.revokeObjectURL(importedResult.url); }, [importedResult]);
  useEffect(() => {
    const query=new URLSearchParams(window.location.search), item=query.get('production'), saved=query.get('product');
    if(saved){setProductId(saved);setActiveNav('products');}
    if(!item)return;
    const controller=new AbortController();setProductionLoading(true);
    fetch(`/api/production/${encodeURIComponent(item)}`,{signal:controller.signal}).then(async r=>{const b=await r.json() as NonNullable<typeof production>&{error?:string};if(!r.ok||!b.sample?.recipe)throw new Error(b.error||'制作项信息不完整。');return b;}).then(b=>{
      const recipe=b.sample.recipe!;
      setProduction(b);setProductId(b.productId);setSelectedId(recipe.artworkId);setFrameId(recipe.frameId);setFrameColorId(recipe.colorId);
      setInstruction(b.brief.slice(0,1500));setIntent(b.kind==='main'&&b.title.includes('场景')?'interior':'catalog');
      // The sample locks the product, not obsolete 4K/PRO generation parameters.
      setModelId(defaultImageModel.id);setAspectRatio(b.kind==='detail'?(b.title==='完整详情长图'?'1:3':'3:4'):'1:1');setResolution('2k');setQuality('medium');
      setActiveNav('new');
    }).catch(e=>{if(!controller.signal.aborted)setPreviewError(e instanceof Error?e.message:'制作项读取失败。');}).finally(()=>{if(!controller.signal.aborted)setProductionLoading(false);});
    return()=>controller.abort();
  },[]);

  useEffect(() => {
    if (!previewTask) return;
    setPreviewGenerating(isActiveGeneration(previewTask.status));
    if (previewTask.status === 'succeeded' && previewTask.url) {
      if (lastCompletedPreview.current !== previewTask.id) {
        lastCompletedPreview.current = previewTask.id;
        setViewedTaskId('');
        setImportedResult(null);
      }
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
      setHiddenArtworkIds((current) => [...new Set([...current, ...artworkIds])]);
      setHiddenFrameIds((current) => [...new Set([...current, ...frameIds])]);
      await Promise.all([syncHiddenOptions('artwork', localArtworkIds), syncHiddenOptions('frame', localFrameIds)]);
    }).catch(() => undefined);
    fetch('/library/2026-08-27-v2/library-index.json').then((response) => response.ok ? response.json() : null).then((data) => {
      const manifest = data as { items?: Array<{ id: string; name: string; thumb: string; category: string; collection: string; date: string }> } | null;
      if (!manifest?.items || !Array.isArray(manifest.items)) return;
      const localItems = manifest.items.map((row: { id: string; name: string; thumb: string; category: string; collection: string; date: string }) => ({ id: row.id, name: row.name, file: row.thumb, tag: classifyArtworkCategory(row.name, row.category), ratio: row.collection, tone: row.date }));
      setLibraryItems((current) => [...localItems, ...current.filter((item) => !localItems.some((local: { id: string }) => local.id === item.id))]);
    }).catch(() => undefined);
    fetch('/api/library').then((response) => response.ok ? response.json() : []).then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const frameUploads = rows.filter((row: FrameAsset) => row.category === '框架模板').map((row: FrameAsset) => {
        const { sizes, fileCount, styleKey, unknown, missing } = frameSources(rows, row);
        return { id: `uploaded-frame-${row.id}`, name: row.name, styleKey, file: row.url, tone: sizes.length ? `${sizes.length} 种已识别规格 · ${fileCount} 张原图${unknown || missing ? ' · 尚有规格待确认' : ''}` : '尺寸规格待确认', color: '#432d24', profile: 'cabinet', variantCount: fileCount, sizes };
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
    const savedArtwork = libraryItems.find((item) => item.id === displayedTask?.recipe?.artworkId);
    const savedFrame = [...uploadedFrames, ...cabinetFrameStyles, ...frames].find((item) => item.id === displayedTask?.recipe?.frameId);
    const savedColor = frameColors.find((item) => item.id === displayedTask?.recipe?.colorId);
    if (!displayedTask?.assetId || !savedArtwork || !savedFrame || !savedColor) {
      setNotice('这张历史图的搭配信息不完整，仍可下载原图。');
      window.setTimeout(() => setNotice(''), 3000);
      return;
    }
    setProductSaving(true);
    const response = await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: savedArtwork.id, artworkName: savedArtwork.name, frameId: savedFrame.id, frameName: `${savedFrame.name}·${savedColor.name}`, sampleAssetId: displayedTask.assetId }) }).catch(() => null);
    setProductSaving(false);
    if(response?.ok){const p=await response.json() as {id:string};setProductId(p.id);setActiveNav('products');setNotice('样图已保存。请核对这个新品的规格与制作清单，保存清单不会扣费。');}
    else setNotice('新品保存失败，请稍后重试；生成的效果图仍然保留。');
    window.setTimeout(() => setNotice(''), 3600);
  }

  function resetPreview() {
    if (previewGenerating || submitGuard.current) return;
    setPreviewTaskId('');
    setViewedTaskId('');
    setPreviewReady(false);
    setPreviewGenerating(false);
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
    if(next !== 'interior') setSceneId('');
    if (!instruction.trim() || studioIntents.some((item) => item.instruction === instruction)) changeInstruction(studioIntents.find((item) => item.id === next)!.instruction);
    resetPreview();
  }

  function reuseTask(task: GenerationTask) {
    if(production){setNotice('当前正在制作新品清单项；请先返回新品清单或退出此项制作。');return;}
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
    setSceneId(findScene(recipe.sceneId)?.id || '');
    setInstruction(recipe.instruction);
    setPreviousInstruction(null);
    const savedModel = availableModels.find(item => item.id === task.model);
    if (!savedModel) { setNotice('这张图使用的模型已不可用，请手动选择模型，不会自动替换。'); return; }
    setModelId(savedModel.id);
    setAspectRatio(savedModel.ratios.includes(task.aspectRatio) ? task.aspectRatio : savedModel.ratios[0] || '16:9');
    setResolution(savedModel.resolutions.includes(task.resolution) ? task.resolution : savedModel.resolutions[0] || '2k');
    setQuality(savedModel.qualities.includes(recipe.quality || '') ? recipe.quality! : savedModel.qualities[0] || '');
    setBackground(savedModel.backgrounds?.includes(recipe.background || '') ? recipe.background! : 'auto');
    setOutputFormat(savedModel.outputFormats?.includes(recipe.outputFormat || '') ? recipe.outputFormat! : 'png');
    if (task.status === 'succeeded' && task.url) {
      setPreviewTaskId(task.id);
      setPreviewReady(true);
    }
    setActiveNav('new');
    setNotice('已带入搭配和出图参数，核对后点击生成，不会自动提交。');
    window.setTimeout(() => setNotice(''), 4000);
  }

  function returnToStudio() {
    setActiveNav('new');
    window.requestAnimationFrame(() => document.getElementById('studio-controls')?.scrollTo({ top: 0 }));
  }

  function chooseModel(id: string) {
    if (previewGenerating || generations.busy) return;
    const next = availableModels.find(item => item.id === id);
    if (!next) return;
    setModelId(next.id);
    if (next.ratios.length && !next.ratios.includes(aspectRatio)) setAspectRatio(next.ratios[0]);
    if (next.resolutions.length && !next.resolutions.includes(resolution)) setResolution(next.resolutions[0]);
    setQuality(next.qualities.includes('medium') ? 'medium' : next.qualities[0] || '');
    setBackground(next.backgrounds?.includes('auto')?'auto':next.backgrounds?.[0]||'auto');setOutputFormat(next.outputFormats?.includes('png')?'png':next.outputFormats?.[0]||'png');
    resetPreview();
  }

  async function generatePreview() {
    if (!canGenerate || !selected || !frame || previewGenerating || submitGuard.current || generations.busy || !modelConfigured) return;
    submitGuard.current = true;
    setPreviewGenerating(true);
    setPreviewError('');
    try {
        let receipt:ProductionConsent|null=null;
        const pricing=`使用 ${model.name}，${aspectRatio}，${resolution.toUpperCase()}。参考图和制作要求发送到 ${customConfig ? new URL(customConfig.baseUrl).hostname : 'RunningHub'}，按服务商实际规则计费；当前无法保证固定总价。`;
        if(production){
          // Refresh ownership and attempt state before honoring a remembered dialog choice.
          const r=await fetch(`/api/production/${encodeURIComponent(production.itemId)}`,{cache:'no-store'});
          const fresh=await r.json() as NonNullable<typeof production>&{error?:string};
          if(!r.ok||fresh.planId!==production.planId||fresh.productId!==production.productId||!Array.isArray(fresh.pendingItemIds))throw new Error(fresh.error||'清单已变化，请刷新后重新确认。');
          setProduction(fresh);
          const scope={planId:fresh.planId,productId:fresh.productId,settings:confirmationSettings};
          try{receipt=readConsent(window.localStorage,fresh.planId);}catch{receipt=null;}
          if(fresh.generationId || (receipt?.settings===scope.settings && !receipt.remaining.includes(fresh.itemId))){
            if(!window.confirm(`重新提交“${fresh.title}”可能再次计费，不包含在本套首次制作确认中。${pricing}\n请先确认旧任务已失败或已标记重做；状态不明时不要重试。确认仅重做此项？`)){setPreviewGenerating(false);return;}
          }else if(!consentCovers(receipt,scope,fresh.itemId,false)){
            if(!window.confirm(`一次确认本套 v${fresh.planVersion} 剩余 ${fresh.pendingItemIds.length} 项的首次制作，每项一张。\n${pricing}\n同一版本、同一参数下不再逐张弹窗；更换参数、新版本、失败重试或重做需重新确认。\n仍需点击生成才会提交，不会因刷新或打开页面自动扣费。可随时撤销本套确认。\n确认本套，并开始当前这一项？`)){setPreviewGenerating(false);return;}
            receipt=createConsent(scope,fresh.pendingItemIds);
            storeProductionConsent(receipt);
          }
        }else if(customConfig && !window.confirm(`${pricing}确认生成一张效果图？`)){setPreviewGenerating(false);return;}
        setImportedResult(null);setViewedTaskId('');setPreviewTaskId('');setPreviewReady(false);
        const artworkResponse = await fetch(selected.file);
        if (!artworkResponse.ok) throw new Error('所选图案暂时无法读取。');
        const form = new FormData();
        form.set('artwork', await referenceUpload(await artworkResponse.blob(), selected.name));
        if (production?.frameUrl || frame.file) {
          const frameResponse = await fetch(production?.frameUrl || frame.file!);
          if (!frameResponse.ok) throw new Error('所选框架暂时无法读取。');
          form.set('frame', await referenceUpload(await frameResponse.blob(), frame.name));
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
        form.set('model', model.id);
        if (customConfig) form.set('providerRevision', customConfig.revision);
        if (model.qualities.length) form.set('quality', quality);
        if (model.backgrounds?.length) form.set('background', background);
        if (model.outputFormats?.length) form.set('outputFormat', outputFormat);
        form.set('instruction', instruction);
        form.set('intent', intent);
        if(sceneInUse) {
          const response = await fetch(sceneInUse.image);
          if(!response.ok) throw new Error('场景参考暂时无法读取，请重新选择。');
          form.set('scene', await referenceUpload(await response.blob(), sceneInUse.name));
          form.set('sceneId', sceneInUse.id);
        }
        if(production)form.set('productionItemId',production.itemId);
        // Consume BEFORE submission: ambiguous failures must never silently retry a paid item.
        if(receipt && production)storeProductionConsent(consumeConsent(receipt,production.itemId));
        const task = await generations.submit(form);
        setPreviewTaskId(task.id);
        setPreviewGenerating(isActiveGeneration(task.status));
        setNotice(task.status === 'succeeded' ? '图片已生成并保存，可在生成记录查看。' : '任务已提交给所选服务商，可在「生成任务」查看进度。');
    } catch (error) {
      setPreviewGenerating(false);
      setPreviewError(error instanceof Error ? error.message : '提交状态未确认，请先查看任务记录，不要重复生成。');
    } finally {
      submitGuard.current = false;
      window.setTimeout(() => setNotice(''), 3600);
    }
  }

  function selectArtwork(id: string) {
    if(production){setNotice('此项沿用确认样图的搭配，请返回新品清单调整版本。');return;}
    if (previewGenerating || submitGuard.current) { setNotice('当前组合正在生成，请完成后再更换图案。'); return; }
    setSelectedId(id);
    resetPreview();
  }

  function selectFrame(id: string) {
    if(production){setNotice('此项使用已确认的框架，请返回新品清单调整版本。');return;}
    if (previewGenerating || submitGuard.current) { setNotice('当前组合正在生成，请完成后再更换框架。'); return; }
    setFrameId(id);
    resetPreview();
  }

  function selectFrameColor(id: string) {
    if(production){setNotice('此项沿用新品已确认木色；更换颜色请另存新品样图。');return;}
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
    const saved = await syncHiddenOptions('artwork', [id]);
    setNotice(saved ? `“${name}”已从图库选项中移除。` : `“${name}”已在本页移除，后台保存暂未完成。`);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function removeArtworksBulk(ids: string[], labels: string[]) {
    if (previewGenerating || submitGuard.current) { setNotice('请等待当前组合生成完成。'); return; }
    if (!ids.length) return;
    if (!selectableAfterRemoval(visibleLibraryItems.map((item) => item.id), ids).length) {
      setNotice('图库至少需要保留一个可选图案。');
      return;
    }
    const preview = `${labels.slice(0, 6).join('、')}${labels.length > 6 ? ` 等 ${labels.length} 个` : ''}`;
    if (!window.confirm(`确定从工作台选择列表中移除这 ${ids.length} 个图案吗？\n${preview}\n原始图片文件不会删除，可用“恢复已移除”找回。`)) return;
    const next = [...new Set([...hiddenArtworkIds, ...ids])];
    setHiddenArtworkIds(next);
    window.localStorage.setItem('pingfeng-hidden-artworks', JSON.stringify(next));
    resetPreview();
    const saved = await syncHiddenOptions('artwork', ids);
    setNotice(saved ? `已从图库选项中移除 ${ids.length} 个图案。` : `已在本页移除 ${ids.length} 个图案，后台保存暂未完成。`);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function removeFrame(id: string, name: string) {
    if (previewGenerating || submitGuard.current) { setNotice('请等待当前组合生成完成。'); return; }
    if (visibleFrameOptions.length <= 1) {
      setNotice('框架库至少需要保留一个可选框架。');
      return;
    }
    if (!window.confirm(`确定从工作台选择列表中移除“${name}”吗？原始框架文件不会删除。`)) return;
    const removalIds = visibleFrameOptions.find((item) => item.id === id)?.memberIds || [id];
    const next = [...new Set([...hiddenFrameIds, ...removalIds])];
    setHiddenFrameIds(next);
    window.localStorage.setItem('pingfeng-hidden-frames', JSON.stringify(next));
    resetPreview();
    const saved = await syncHiddenOptions('frame', removalIds);
    setNotice(saved ? `“${name}”已从框架选项中移除。` : `“${name}”已在本页移除，后台保存暂未完成。`);
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

  async function uploadFrame(fileList: FileList | null, requestedStyleName = '') {
    if (!fileList || frameUploading) return;
    const images = Array.from(fileList).filter((file) => file.type === 'image/png' || file.type === 'image/jpeg' || /\.(png|jpe?g)$/i.test(file.name));
    if (images.length === 0) {
      setNotice('所选文件夹里没有可用的 JPG 或 PNG 图片。');
      window.setTimeout(() => setNotice(''), 3600);
      return;
    }

    const folderName = requestedStyleName.trim() || frameFolderName(images);
    if (!validFrameStyleName(folderName)) {
      setNotice('请先填写明确的款式名称，再选文件夹。不能只用“成品PNG / images / sku”，也不要包含分号、冒号或路径符号。');
      return;
    }
    if(!window.confirm('确认这张样图的产品结构、画芯位置和木色均正确，并作为新品制作标准？保存后仍可保留旧版并另做新版本，不会立即收费生成。'))return;
    const styleKey = frameStyle(folderName);
    const matchingMembers = [...uploadedFrames, ...cabinetFrameStyles, ...frames].filter((item) => (item.styleKey || frameStyle(item.name)) === styleKey);
    if ([`style:${styleKey}`, ...matchingMembers.flatMap((item) => [item.id, ...(item.memberIds || [])])].some((id) => hiddenFrameIds.includes(id))) {
      setNotice('这个款式已被移除。请先主动恢复，或为不同的新款式填写另一个名称；本次未上传。');
      return;
    }
    setFrameUploading(true);
    setFrameUploadProgress(`准备上传，共 ${images.length} 张`);
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

    const savedRows = await fetch('/api/library').then((response) => response.ok ? response.json() : []).catch(() => []) as FrameAsset[];
    const representativeRow = savedRows.find((item) => item.id === row.id);
    const sourceInfo = representativeRow ? frameSources(savedRows, representativeRow) : null;
    const uploaded: FrameOption = { id: `uploaded-frame-${row.id}`, name: folderName, styleKey, file: row.url as string, tone: sourceInfo?.sizes.length ? `${sourceInfo.sizes.length} 种已识别规格${sourceInfo.unknown || sourceInfo.missing ? ' · 尚有规格待确认' : ''}` : '尺寸规格待确认', color: '#432d24', profile: 'cabinet', variantCount: images.length - failed, sizes: sourceInfo?.sizes };
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
              <em>{id === 'gallery' ? visibleLibraryItems.length : id === 'frames' ? visibleFrameOptions.length : id === 'colors' ? frameColors.length : id === 'jobs' ? generations.tasks.length : ''}</em>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <section className="storage-card">
          <div className="storage-title"><span>生图接口</span><b>{customConfig?.name || 'RunningHub API'}</b></div>
          <p>{generations.config ? modelConfigured ? '当前通道已配置' : '当前通道待配置' : '正在检查当前通道'}</p>
          <button onClick={() => setActiveNav('settings')}>配置 API →</button>
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
            <span className="sync-state">{customConfig?.name || 'RunningHub'} 图像生成</span>
            <button className="ghost-button" onClick={() => setActiveNav(activeNav === 'new' ? 'jobs' : 'new')}>{activeNav === 'new' ? '查看生成记录' : '返回组合生图'}</button>
          </div>
        </header>

        {activeNav === 'new' && <div className="studio-intro"><div><h2>搭配你的下一款新品</h2><p>选图案、框架与颜色，确认后再生成。每轮结果都会保留。</p></div><span>拖动中间分隔线，可调整预览宽度</span></div>}
        {activeNav === 'new' && production && <div className="production-context"><strong>当前制作：{production.title}</strong><span>沿用确认样图与对应规格原图，结果自动归入这个新品的制作清单。</span><a href={`/?product=${production.productId}`}>返回新品清单</a><a href="/">退出此项，做其他新品</a></div>}
        <ResizableWorkspace hidden={activeNav !== 'new'}>
          <section className="library-panel" id="studio-controls">
            <section className="studio-output-panel" aria-label="模型与出图设置">
              <div className="row-label"><strong>模型与出图设置</strong><button type="button" onClick={() => setActiveNav('settings')}>后台设置 →</button></div>
              <fieldset className="image-output-options" disabled={previewGenerating || generations.busy}>
                <legend className="sr-only">选择生成模型和图片参数</legend>
                <ImageModelPicker value={modelId} onChange={chooseModel} scene={Boolean(production?.sceneTitle)} />
                {customConfig ? <div className="output-fields"><label>图片尺寸（像素）<select value={resolution} onChange={e => { setResolution(e.target.value); resetPreview(); }}>{customConfig.sizes.map(size => <option key={size} value={size}>{size === 'auto' ? '自动 · 由模型决定' : size.replace('x',' × ')}</option>)}</select></label><p>画幅比例由所选尺寸决定，不额外发送 RunningHub 参数。</p></div> : <div className="output-fields"><label>图片比例<select value={aspectRatio} onChange={(event) => { setAspectRatio(event.target.value); resetPreview(); }}>{model.ratios.map((ratio) => <option key={ratio} value={ratio}>{ratio==='auto'?'由模型决定':ratio}{ratio === '1:1' ? ' · 正方形' : ratio === '3:4' ? ' · 竖版主图' : ratio === '16:9' ? ' · 横版场景' : ratio === '9:16' ? ' · 竖版全景' : ''}</option>)}</select></label><label>清晰度 / 分辨率<select value={resolution} onChange={(event) => { setResolution(event.target.value); resetPreview(); }}>{model.resolutions.map((item) => <option key={item} value={item}>{item==='auto'?'由模型决定':item.toUpperCase()}</option>)}</select></label></div>}
                {model.qualities.length > 0 && <label>生成质量<select value={quality} onChange={(event) => { setQuality(event.target.value); resetPreview(); }}>{model.qualities.map((item) => <option key={item} value={item}>{qualityLabels[item] || item}</option>)}</select></label>}
                {!!model.backgrounds?.length && <label>输出背景<select value={background} onChange={event => { setBackground(event.target.value); if(event.target.value==='transparent' && outputFormat==='jpeg')setOutputFormat('png'); resetPreview(); }}>{model.backgrounds.map(item => <option key={item} value={item} disabled={sceneRequiresOpaqueBackground(Boolean(production?.sceneTitle)||Boolean(sceneInUse), item)}>{backgroundLabels[item] || item}</option>)}</select></label>}
                {!!model.outputFormats?.length && <label>图片格式<select value={outputFormat} onChange={event => { setOutputFormat(event.target.value); resetPreview(); }}>{model.outputFormats.map(item => <option key={item} value={item} disabled={background==='transparent' && item==='jpeg'}>{item.toUpperCase()}</option>)}</select></label>}
                {model.note && <p className="home-gallery-note">{model.note}</p>}
                {!modelConfigured && <div className="output-setup-notice"><span>当前接口尚未连接。</span><button type="button" onClick={() => setActiveNav('settings')}>前往后台设置 →</button></div>}
              </fieldset>
            </section>
            <fieldset className="intent-picker" disabled={previewGenerating}>
              <legend>这次想做什么图？</legend>
              <div className="intent-options">{studioIntents.map((item) => <label key={item.id} className={intent === item.id ? 'intent-option selected' : 'intent-option'}><input type="radio" name="studio-intent" value={item.id} checked={intent === item.id} onChange={() => chooseIntent(item.id)} /><strong>{item.name}</strong><small>{item.subtitle}</small></label>)}</div>
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
              <p className="home-gallery-note">可选 {homeFrames.length} 款框架，每款展示一个合并框架；点击图片选择，查看原图可放大检查完整结构。</p>
              <div className="home-frame-grid">
                {homeFrames.map((item) => <div className="option-card-wrap" key={item.id}>
                  <button className={frameId === item.id ? 'home-frame-card selected' : 'home-frame-card'} onClick={() => selectFrame(item.id)}>
                    {item.file ? <span className="home-frame-thumb image-frame-thumb"><img src={item.file} alt={`${item.name}标准合并框架`} /></span> : <span className="home-frame-thumb"><i style={{ '--swatch': item.color } as React.CSSProperties}><em /></i></span>}
                    <span><strong>{item.name}</strong><small>{item.tone}</small></span>
                    {frameId === item.id && <b>✓</b>}
                  </button>
                  {item.file && <a className="frame-original-link" href={item.file} target="_blank" rel="noopener noreferrer" aria-label={`查看${item.name}完整框架原图`}>查看完整原图 ↗</a>}
                </div>)}
              </div>
            </section>

            <section className="frame-color-picker">
              <div className="row-label"><span>框架颜色</span><b>{frameColor.name}</b></div>
              <div className="frame-color-options">
                {frameColors.map((item) => <button key={item.id} className={frameColorId === item.id ? 'selected' : ''} disabled={previewGenerating} onClick={() => selectFrameColor(item.id)} aria-pressed={frameColorId === item.id} aria-label={`选择${item.name}框架颜色`}><i style={{ backgroundColor: item.color, backgroundImage: item.texture ? `url(${item.texture})` : 'none' }} /><strong>{item.name}</strong>{frameColorId === item.id && <b>✓</b>}</button>)}
              </div>
            </section>

            <section className="scene-selection" aria-label="场景参考选择"><div><strong>场景参考 · 可选</strong><button type="button" onClick={()=>setActiveNav('scenes')}>从场景图库选择</button></div>{production?.kind==='size'?<p>尺寸图沿用本套已确认的共用场景，不在这里替换。</p>:sceneInUse?<><p>{sceneInUse.name} · 作为独立参考图随本次生成提交</p><img src={sceneInUse.image} alt={`已选场景：${sceneInUse.name}`} /><div><span>只参考空间，不改变画芯与框架</span><button type="button" disabled={previewGenerating||generations.busy} onClick={()=>{setSceneId('');resetPreview();}}>取消场景</button></div></>:<p>未指定场景，按制作要求生成；选择场景不会自动出图。</p>}</section>
            <section className="generation-parameters" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void generatePreview(); } }}>
              <div className="row-label"><label htmlFor="generation-instruction">制作要求</label><b>{currentIntent.label}</b></div>
              <p className="brief-help">说清楚想保留什么、调整什么；图案、框架和木色会自动带入。</p>
              <div className="brief-tools"><button disabled={previewGenerating} onClick={() => { if (!instruction.trim() || instruction === currentIntent.instruction || window.confirm('用整理好的默认要求替换当前文字？替换后可撤回。')) changeInstruction(currentIntent.instruction); }}>填入我的默认要求</button><button disabled={previewGenerating || previousInstruction === null} onClick={() => { if (previousInstruction !== null) { setInstruction(previousInstruction); setPreviousInstruction(null); resetPreview(); } }}>撤回修改</button><span>{instruction.length}/1500</span></div>
              <textarea id="generation-instruction" value={instruction} maxLength={1500} disabled={previewGenerating} onChange={(event) => changeInstruction(event.target.value)} placeholder="例如：画芯居中完整，木纹清晰，主体不要被背景家具遮挡。" rows={4} />
              <p className="brief-rules">默认要求：保留产品结构 · 保留画芯内容 · 使用所选木色</p>
              {generations.error && <p className="generation-warning" role="status">{generations.error}</p>}
              <p className="generation-privacy">生成时将发送所选参考图与制作要求，按当前应用权益与费用规则计费。</p>
              {production&&<div className="production-confirmation" role="status"><strong>{consentActive?'本套已确认 · 不再逐张弹窗':'本套只需确认一次'}</strong><p>此浏览器记住同一版本、同一模型参数的首次制作确认。点击生成才会提交；重做另行确认，刷新不会自动扣费。</p>{productionConsent&&<button type="button" disabled={previewGenerating||generations.busy} onClick={()=>{storeProductionConsent(null);setNotice('已撤销本套确认。不会撤回或取消已经提交的任务。');}}>撤销本套确认</button>}</div>}
              <button className="combine-button" disabled={!canGenerate} onClick={generatePreview}>{generateLabel} <span>→</span></button>
              <p className="generation-shortcut">Ctrl / ⌘ + Enter 生成 · 不跳转官网 · 每轮结果自动保留</p>
              {generations.busy && !previewGenerating && <button className="open-color-library" onClick={() => setActiveNav('jobs')}>查看待处理任务 →</button>}
            </section>
          </section>

          <aside className="compose-panel">
            <TrialCanvas
              importedResult={importedResult}
              tasks={generations.tasks} activeTaskId={viewedTaskId || previewTaskId}
              working={previewGenerating} status={previewTask ? generationLabels[previewTask.status] : '正在准备参考图'}
              loading={generations.loading} onSelect={(id) => { setImportedResult(null); setViewedTaskId(id); }} onReuse={reuseTask}
              reuseDisabled={generations.busy || previewGenerating} onHistory={() => setActiveNav('jobs')}
              onGenerate={generatePreview} canGenerate={canGenerate} generateLabel={generateLabel}
              outputSummary={`${model.name} · ${aspectRatio === 'auto' ? '应用画幅' : aspectRatio} · ${resolution === 'auto' ? '应用清晰度' : resolution.toUpperCase()}`}
              references={[...(selected?.file ? [{ src: selected.file, label: '图案原图' }] : []), ...(production?.frameUrl || frame?.file ? [{ src: production?.frameUrl || frame.file!, label: production ? '本项确认参考图' : '框架原图' }] : []),...(production?.kind==='size'&&production.sceneUrl?[{src:production.sceneUrl,label:'与主图共用的场景背景'}]:[]),...(sceneInUse?[{src:sceneInUse.image,label:`场景参考 · ${sceneInUse.name}`}]:[])]}
            />
            {previewError && <p className="generation-warning" role="alert">{previewError}</p>}
            {generations.paused && <button className="resume-generation" onClick={generations.resume}>恢复任务查询</button>}
            {generations.busy && !previewGenerating && <button className="reuse-result" onClick={() => setActiveNav('jobs')}>查看待处理任务 →</button>}
            <details className="current-combination">
              <summary><span>下一张使用的搭配</span><strong>{selected?.name || '请选择图案'} · {frameColor.name}</strong></summary>
              <div className="selection-summary">
                <div className="summary-art">{selected?.file && <img src={selected.file} alt="" />}<span><small>已选图案</small><strong>{selected?.name || '请选择图案'}</strong></span><button onClick={() => setActiveNav('gallery')}>更换</button></div>
                <div className="summary-frame"><span className="summary-frame-icon" style={{ '--summary-frame': frameColor.color } as React.CSSProperties}>{frame?.file ? <img src={frame.file} alt="" /> : <i />}</span><span><small>已选框架</small><strong>{frame?.name || '请选择框架'} · {frameColor.name}</strong></span><button onClick={() => setActiveNav('frames')}>更换</button></div>
              </div>
              <p>{instruction || '使用默认制作要求'}</p>
            </details>
            {!production && !importedResult && displayedTask?.assetId && displayedTask.recipe && <><button className="create-cta" disabled={productSaving} onClick={createProduct}>{productSaving ? '保存新品中…' : '确认样图，进入新品制作'} <span>→</span></button><p className="approval-note">按当前效果图当时的搭配保存，其他试稿继续保留。</p></>}
            <details className="local-preview-import"><summary>可选：预览本地图片</summary><div className="official-result-import"><label>选择本地图片<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { setNotice('请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。'); } else { setImportedResult({ url: URL.createObjectURL(file), name: file.name }); } } event.currentTarget.value = ''; }} /></label><small>仅在此页预览，刷新后不保留；工作台生成的结果自动保存，无需手动导入。</small>{importedResult && <button onClick={() => setImportedResult(null)}>返回工作台记录</button>}</div></details>
          </aside>
        </ResizableWorkspace>

        {activeNav === 'settings' && <section className="backend-settings-view" aria-label="后台设置">
          <header><h2>RunningHub 连接设置</h2><p>只需要配置 RunningHub 国际站，不用填写接口地址、传输格式或域名。</p></header>
          <RhCreator />
          <details><summary>原有新品制作连接（已配置通常不用改）</summary>
          <fieldset className="image-output-options" disabled={previewGenerating || generations.busy}>
            <legend>当前调用应用</legend>
            <label className="model-select">RunningHub 模型 / 应用<select value={modelId} onChange={event => chooseModel(event.target.value)}>{imageModels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </fieldset>
          {!customConfig && <RunningHubSettings config={generations.config} onRefresh={generations.refreshConfig} busy={generations.busy || previewGenerating} />}
          {model.note && <p className="generation-warning">{model.note}</p>}
          {generations.error && <p className="generation-warning" role="status">{generations.error}</p>}
          </details><footer><span>Key 加密保存在当前账号下，历史作品不受影响。</span></footer>
        </section>}

        {['gallery','frames','colors'].includes(activeNav) && <SecondaryView view={activeNav} libraryItems={visibleLibraryItems} selectedArtworkId={selectedId} onSelectArtwork={selectArtwork} onDeleteArtwork={removeArtwork} onDeleteArtworks={removeArtworksBulk} onRestoreArtworks={restoreArtworks} hiddenArtworkCount={hiddenArtworkIds.length} onUploadArtwork={uploadAsset} frameId={frameId} frameStyles={visibleCabinetFrames} onSelectFrame={selectFrame} onDeleteFrame={removeFrame} onRestoreFrames={restoreFrames} hiddenFrameCount={hiddenFrameIds.length} onUploadFrame={uploadFrame} frameUploading={frameUploading} frameUploadProgress={frameUploadProgress} frameColorId={frameColorId} onSelectFrameColor={selectFrameColor} onCreate={() => setActiveNav('new')} />}

      {(activeNav === 'products' || activeNav === 'delivery') && <ProductWorkspaceView key={`${activeNav}:${productId}`} productId={productId} delivery={activeNav==='delivery'} artworks={libraryItems} colors={frameColors} onOpen={setProductId} onNew={()=>setActiveNav('new')}/>}
      {activeNav === 'scenes' && <SceneLibrary selectedId={sceneId} disabled={previewGenerating||generations.busy||production?.kind==='size'} onSelect={id=>{if(previewGenerating||generations.busy||production?.kind==='size')return;setSceneId(id);chooseIntent('interior');setBackground('auto');resetPreview();setActiveNav('new');setNotice('已添加场景参考，点击生成才会提交。');}} />}
      {activeNav === 'jobs' && <div className="history-workspace"><GenerationHistory tasks={generations.tasks} loading={generations.loading} error={generations.error} paused={generations.paused} onRefresh={generations.resume} onResolve={generations.resolveUnknown} onReuse={reuseTask}/></div>}
      </section>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}

function SecondaryView({ view, libraryItems, selectedArtworkId, onSelectArtwork, onDeleteArtwork, onDeleteArtworks, onRestoreArtworks, hiddenArtworkCount, onUploadArtwork, frameId, frameStyles, onSelectFrame, onDeleteFrame, onRestoreFrames, hiddenFrameCount, onUploadFrame, frameUploading, frameUploadProgress, frameColorId, onSelectFrameColor, onCreate }: { view: string; libraryItems: typeof artworks; selectedArtworkId: string; onSelectArtwork: (id: string) => void; onDeleteArtwork: (id: string, name: string) => void; onDeleteArtworks: (ids: string[], labels: string[]) => void; onRestoreArtworks: () => void; hiddenArtworkCount: number; onUploadArtwork: (file: File | undefined) => void; frameId: string; frameStyles: FrameOption[]; onSelectFrame: (id: string) => void; onDeleteFrame: (id: string, name: string) => void; onRestoreFrames: () => void; hiddenFrameCount: number; onUploadFrame: (files: FileList | null, styleName?: string) => void; frameUploading: boolean; frameUploadProgress: string; frameColorId: string; onSelectFrameColor: (id: string) => void; onCreate: () => void }) {
  const [gallerySearch, setGallerySearch] = useState('');
  const [newFrameStyleName, setNewFrameStyleName] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('全部素材');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState('');
  const [frameVariants, setFrameVariants] = useState<{ name: string; items: FrameVariantImage[] } | null>(null);
  const [zoomedVariant, setZoomedVariant] = useState<FrameVariantImage | null>(null);
  // Double-click a style image to see every spec original kept inside that style.
  // A bundled style reads its SKU index; an uploaded one already carries its
  // recognised source images, so it needs no request at all.
  async function openFrameVariants(option: FrameOption) {
    const inline = frameVariantImages(option);
    setFrameVariants({ name: option.name, items: inline });
    if (!option.skuIndex) return;
    try {
      const response = await fetch(option.skuIndex, { cache: 'no-store' });
      if (!response.ok) return;
      const items = frameVariantImages({ ...option, skuItems: parseFrameSkuIndex(await response.json()) });
      if (items.length) setFrameVariants({ name: option.name, items });
    } catch { /* Keep the single inline image when the index cannot be read. */ }
  }
  function closeFrameVariants() { setFrameVariants(null); setZoomedVariant(null); }
  const filteredGallery = useMemo(() => libraryItems.filter((item) => {
    const searchMatch = `${item.name}${item.tag}${item.tone}${item.ratio}`.includes(gallerySearch.trim());
    const categoryMatch = galleryCategory === '全部素材' || item.tag === galleryCategory;
    return searchMatch && categoryMatch;
  }), [galleryCategory, gallerySearch, libraryItems]);
  const categoryCounts = useMemo(() => Object.fromEntries(artworkCategories.map((category) => [category, libraryItems.filter((item) => item.tag === category).length])), [libraryItems]);
  const galleryGroups = useMemo(() => artworkCategories.map((category) => ({ category, items: filteredGallery.filter((item) => item.tag === category) })).filter((group) => group.items.length > 0), [filteredGallery]);
  // Bulk selection works on the currently filtered list, and "removal" keeps the
  // same meaning as the single-item action: the option is hidden, the file stays.
  function toggleBulk(id: string) {
    setBulkIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function leaveBulkMode() { setBulkMode(false); setBulkIds([]); setBulkNotice(''); }
  async function exportSelection() {
    const chosen = libraryItems.filter((item) => bulkIds.includes(item.id));
    if (!chosen.length) return;
    setBulkBusy(true); setBulkNotice(`正在打包 ${chosen.length} 张…`);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const [index, item] of chosen.entries()) {
        const response = await fetch(item.file, { cache: 'no-store' });
        if (!response.ok) throw new Error(`“${item.name}”读取失败，已停止导出。`);
        files[exportFileName(item.name, index, item.file)] = new Uint8Array(await response.arrayBuffer());
      }
      const archive = zipSync(files, { level: 0 });
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url; link.download = `图案素材-${chosen.length}张.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      setBulkNotice(`已导出 ${chosen.length} 张图案。`);
    } catch (error) { setBulkNotice((error as Error).message); }
    finally { setBulkBusy(false); }
  }
  async function removeSelection() {
    const chosen = libraryItems.filter((item) => bulkIds.includes(item.id));
    if (!chosen.length) return;
    await onDeleteArtworks(chosen.map((item) => item.id), chosen.map((item) => item.name));
    setBulkIds([]);
  }
  const headings: Record<string, [string, string]> = {
    gallery: ['图库收纳', '仅收纳原始画芯图案；背景参考请到场景图库'],
    frames: ['框架库', '按框型、木色和结构选择真实产品模板'],
    colors: ['颜色库', '独立管理框架材质与六种标准颜色'],
    jobs: ['生成任务', '样图审批通过后，自动推进批量任务'],
    delivery: ['交付中心', '按新品版本汇总主图、尺寸图、详情页与 QA 文件'],
  };
  const [title, description] = headings[view] ?? ['新品项目', '管理所有新品制作进度'];
  return (
    <section className="secondary-view">
      <header className="secondary-head"><div>{view !== 'frames' && <><p className="eyebrow">WORKSPACE LIBRARY</p><h2>{title}</h2></>}<span>{description}</span></div><button className="primary-button" onClick={onCreate}>＋ 创建新品</button></header>
      {view === 'frames' && <>
        <section className="cabinet-style-section">
          <div className="cabinet-style-grid">
            {frameStyles.map((item) => <div className="option-card-wrap" key={item.id}>
              <button className={frameId === item.id ? 'cabinet-style-card selected' : 'cabinet-style-card'} onClick={() => onSelectFrame(item.id)}>
                <div onDoubleClick={(event) => { event.preventDefault(); void openFrameVariants(item); }} title="双击查看该款式全部框架图"><img src={item.file} alt={`${item.name}标准合并框架`} />{frameId === item.id && <b>已选择 ✓</b>}</div>
                <span><small>标准合并框架</small><strong>{item.name}</strong><em>{item.tone}</em><i>{item.variantCount} 张规格原图保留在款式内部 · 双击框架图查看</i></span>
              </button>
              <button className="remove-option" onClick={() => onDeleteFrame(item.id, item.name)} aria-label={`从框架选项移除${item.name}`}>移除</button>
            </div>)}
          </div>
          {frameVariants && <dialog open className="frame-variant-dialog" aria-label={`${frameVariants.name}全部框架图`} onKeyDown={(event) => { if (event.key === 'Escape') closeFrameVariants(); }}>
            <header><div><p className="eyebrow">ALL SPEC ORIGINALS</p><h3>{frameVariants.name}</h3><span>{frameVariants.items.length} 张框架图 · 双击卡片图片打开，单击缩略图放大</span></div><button type="button" autoFocus onClick={closeFrameVariants}>关闭 · Esc</button></header>
            <div className="frame-variant-body">
              <div className="frame-variant-grid">
                {frameVariants.items.map((image, index) => <button type="button" key={`${image.src}:${index}`} className={zoomedVariant?.src === image.src ? 'selected' : ''} aria-pressed={zoomedVariant?.src === image.src} onClick={() => setZoomedVariant(image)}>
                  <img src={image.src} alt={`${frameVariants.name} ${image.label}`} loading="lazy" />
                  <span>{image.label}</span>
                  {image.note && <small>{image.note}</small>}
                </button>)}
              </div>
              {zoomedVariant && <figure className="frame-variant-zoom"><img src={zoomedVariant.src} alt={zoomedVariant.label} /><figcaption>{zoomedVariant.label}{zoomedVariant.note ? ` · ${zoomedVariant.note}` : ''}</figcaption></figure>}
            </div>
          </dialog>}
          {hiddenFrameCount > 0 && <div className="frame-restore-line"><button className="restore-button" onClick={onRestoreFrames}>恢复已移除的框架（{hiddenFrameCount}）</button></div>}
        </section>
        <label className="frame-style-name">新框架款式名称<input value={newFrameStyleName} onChange={(event) => setNewFrameStyleName(event.target.value)} maxLength={80} placeholder="如：飞鹤六连屏（普通款式文件夹可留空）" disabled={frameUploading} /><small>文件夹叫“成品PNG / images / sku”时必填；每次只上传同一个款式。</small></label>
        <div className="frame-library-grid">
          <label className={frameUploading ? 'frame-upload-card uploading' : 'frame-upload-card'}><b>{frameUploading ? '…' : '＋'}</b><strong>{frameUploading ? '正在上传文件夹' : '选择框架文件夹'}</strong><small>{frameUploading ? frameUploadProgress : '整套 JPG / PNG 一次上传，只生成一个代表框架'}</small><input type="file" accept="image/png,image/jpeg" multiple disabled={frameUploading} {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(event) => { onUploadFrame(event.target.files, newFrameStyleName); event.currentTarget.value = ''; }} /></label>
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
        <div className="library-stats"><div><span>全部素材</span><strong>{libraryItems.length}</strong><small>本地图库与上传素材统一归类</small></div><div><span>图库类别</span><strong>{artworkCategories.length}</strong><small>按类别筛选与收纳</small></div><div><span>自动分类</span><strong>文件名</strong><small>当前按文件名关键词归类，未接入看图识别</small></div><div><span>未识别素材</span><strong>{categoryCounts['综合图案']}</strong><small>统一收纳在综合图案</small></div></div>
        <div className="secondary-gallery-toolbar"><label className="search-box"><span aria-hidden="true" /><input value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} placeholder="搜索图案、类别、日期或文件夹" /><kbd>{filteredGallery.length}张</kbd></label><div className="filter-chips"><button className={galleryCategory === '全部素材' ? 'selected' : ''} onClick={() => setGalleryCategory('全部素材')}>全部素材 <b>{libraryItems.length}</b></button>{artworkCategories.map((item) => <button key={item} className={galleryCategory === item ? 'selected' : ''} onClick={() => setGalleryCategory(item)}>{item} <b>{categoryCounts[item]}</b></button>)}</div>{hiddenArtworkCount > 0 && <button className="restore-button" onClick={onRestoreArtworks}>恢复已移除</button>}<button className={bulkMode ? 'restore-button selected' : 'restore-button'} onClick={() => bulkMode ? leaveBulkMode() : setBulkMode(true)}>{bulkMode ? '退出批量' : '批量选择'}</button><label className="upload-button"><span>＋</span> 上传并自动分类<input type="file" accept="image/png,image/jpeg" onChange={(event) => onUploadArtwork(event.target.files?.[0])} /></label></div>
        <div className="gallery-category-stack">{galleryGroups.map((group) => <section className="gallery-category-section" key={group.category}><header><h3>{group.category}</h3><span>{group.items.length} 张</span></header><div className="gallery-wide-grid selectable-gallery">{group.items.map((item) => <div className={bulkMode && bulkIds.includes(item.id) ? 'option-card-wrap bulk-selected' : 'option-card-wrap'} key={item.id}><button className={selectedArtworkId === item.id ? 'selected' : ''} onClick={() => bulkMode ? toggleBulk(item.id) : onSelectArtwork(item.id)}><div className="gallery-image-wrap"><img src={item.file} alt={item.name} loading="lazy" />{selectedArtworkId === item.id && !bulkMode && <b>已选择 ✓</b>}</div><div><small>{item.tag}</small><strong>{item.name}</strong><p>{item.tone} · {item.ratio}</p></div></button>{bulkMode ? <label className="bulk-check"><input type="checkbox" checked={bulkIds.includes(item.id)} onChange={() => toggleBulk(item.id)} aria-label={`选择图案${item.name}`} /></label> : <button className="remove-option" onClick={() => onDeleteArtwork(item.id, item.name)} aria-label={`从图库选项移除${item.name}`}>移除</button>}</div>)}</div></section>)}{galleryGroups.length === 0 && <div className="gallery-empty-state"><strong>没有找到符合条件的图案</strong><span>可以更换类别或清空搜索词后再查看。</span></div>}</div>
        {bulkMode
          ? <div className="gallery-bulk-bar"><span className="bulk-summary">已选 <strong>{bulkIds.length}</strong> / {filteredGallery.length} 张{bulkNotice ? ` · ${bulkNotice}` : ''}<em className="bulk-hint">移除只是从列表隐藏，可用「恢复已移除」找回；原始文件不会被删除</em></span><span className="gallery-bulk-actions"><button type="button" disabled={bulkBusy || !filteredGallery.length} onClick={() => setBulkIds(filteredGallery.map((item) => item.id))}>全选当前筛选</button><button type="button" disabled={bulkBusy || !bulkIds.length} onClick={() => setBulkIds([])}>清空选择</button><button type="button" className="bulk-danger" disabled={bulkBusy || !bulkIds.length} onClick={() => void removeSelection()}>批量移除</button><button type="button" className="bulk-primary" disabled={bulkBusy || !bulkIds.length} onClick={() => void exportSelection()}>{bulkBusy ? '正在打包…' : `导出 ZIP（${bulkIds.length}）`}</button><button type="button" disabled={bulkBusy} onClick={leaveBulkMode}>完成</button></span></div>
          : <div className="gallery-selection-bar"><span>已选择：<strong>{libraryItems.find((item) => item.id === selectedArtworkId)?.name ?? '尚未选择'}</strong></span><button onClick={onCreate}>使用所选图案创建新品 →</button></div>}
      </>}

    </section>
  );
}
