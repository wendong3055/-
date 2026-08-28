'use client';

import { useEffect, useMemo, useState } from 'react';

type FrameOption = { id: string; name: string; tone: string; color: string; profile: string; file?: string; variantCount?: number; artworkBox?: { left: string; top: string; width: string; height: string } };
type FrameColorOption = { id: string; name: string; color: string; texture?: string };

const frameColors: FrameColorOption[] = [
  { id: 'natural', name: '原木', color: '#c69d62', texture: '/materials/frame-colors/natural.png' },
  { id: 'redwood', name: '红木色', color: '#6d211f', texture: '/materials/frame-colors/redwood.png' },
  { id: 'pear', name: '黄花梨色', color: '#a95617', texture: '/materials/frame-colors/pear.png' },
  { id: 'walnut', name: '胡桃木色', color: '#402b24', texture: '/materials/frame-colors/walnut.png' },
  { id: 'simple-gray', name: '简约灰', color: '#7b7e80', texture: '/materials/frame-colors/simple-gray.png' },
  { id: 'warm-white', name: '暖白色', color: '#e9e3d7' },
];

const artworks = [
  { id: 'mist', name: '浅绿云雾山影', file: '/demo/浅绿云雾山影.png', tag: '山水留白', ratio: '1:1', tone: '雾绿' },
  { id: 'floral', name: '暖白花枝', file: '/demo/暖白花枝.jpg', tag: '花鸟新中式', ratio: '1:1', tone: '暖白' },
  { id: 'collage', name: '米白灰绿植物', file: '/demo/米白灰绿植物.jpg', tag: '植物拼贴', ratio: '1:1', tone: '灰绿' },
  { id: 'abstract', name: '米灰抽象花影', file: '/demo/米灰抽象花影.jpg', tag: '抽象肌理', ratio: '1:1', tone: '米灰' },
  { id: 'blue', name: '雾蓝极简单花', file: '/demo/雾蓝极简单花.png', tag: '极简花卉', ratio: '1:1', tone: '雾蓝' },
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
  const [libraryItems, setLibraryItems] = useState(artworks);
  const [uploadedFrames, setUploadedFrames] = useState<FrameOption[]>([]);
  const [frameUploading, setFrameUploading] = useState(false);
  const [homeSampleIds, setHomeSampleIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState('mist');
  const [frameId, setFrameId] = useState('ruyi-walnut');
  const [frameColorId, setFrameColorId] = useState('walnut');
  const [previewReady, setPreviewReady] = useState(false);
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
  const homeArtworks = homeSampleIds.map((id) => visibleLibraryItems.find((item) => item.id === id)).filter((item): item is typeof artworks[number] => Boolean(item));

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
    fetch('/api/hidden-options').then((response) => response.ok ? response.json() : null).then(async (saved) => {
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
    fetch('/library/2026-08-27-v2/library-index.json').then((response) => response.ok ? response.json() : null).then((manifest) => {
      if (!manifest?.items || !Array.isArray(manifest.items)) return;
      const localItems = manifest.items.map((row: { id: string; name: string; thumb: string; category: string; collection: string; date: string }) => ({ id: row.id, name: row.name, file: row.thumb, tag: row.category, ratio: row.collection, tone: row.date }));
      setLibraryItems((current) => [...localItems, ...current.filter((item) => !localItems.some((local: { id: string }) => local.id === item.id))]);
    }).catch(() => undefined);
    fetch('/api/library').then((response) => response.ok ? response.json() : []).then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const frameUploads = rows.filter((row: { category: string }) => row.category === '框架模板').map((row: { id: string; name: string; url: string }) => ({ id: `uploaded-frame-${row.id}`, name: row.name, file: row.url, tone: '本地上传 · 标准合并框架', color: '#432d24', profile: 'cabinet', variantCount: 1 }));
      const uploads = rows.filter((row: { category: string }) => row.category !== '框架模板').map((row: { id: string; name: string; url: string; category: string; tone: string }) => ({ id: row.id, name: row.name, file: row.url, tag: row.category || '我的上传', ratio: '原图', tone: row.tone || '未标注' }));
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
    if (!previewReady) {
      setNotice('请先确认组合并查看效果图。');
      window.setTimeout(() => setNotice(''), 3000);
      return;
    }
    const response = await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: selected.id, artworkName: selected.name, frameId: frame.id, frameName: `${frame.name}·${frameColor.name}` }) }).catch(() => null);
    setNotice(response?.ok ? `“${selected.name} · ${frame.name}”已保存，第一张样图任务已建立。` : `“${selected.name} · ${frame.name}”已进入样图确认阶段。`);
    window.setTimeout(() => setNotice(''), 3600);
  }

  function selectArtwork(id: string) {
    setSelectedId(id);
    setPreviewReady(false);
  }

  function selectFrame(id: string) {
    setFrameId(id);
    setPreviewReady(false);
  }

  function selectFrameColor(id: string) {
    setFrameColorId(id);
    setPreviewReady(false);
  }

  async function removeArtwork(id: string, name: string) {
    if (visibleLibraryItems.length <= 1) {
      setNotice('图库至少需要保留一个可选图案。');
      return;
    }
    if (!window.confirm(`确定从工作台选择列表中移除“${name}”吗？原始图片文件不会删除。`)) return;
    const next = [...new Set([...hiddenArtworkIds, id])];
    setHiddenArtworkIds(next);
    window.localStorage.setItem('pingfeng-hidden-artworks', JSON.stringify(next));
    setPreviewReady(false);
    const response = await fetch('/api/hidden-options', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'artwork', ids: [id] }) }).catch(() => null);
    if (response?.ok) window.localStorage.removeItem('pingfeng-hidden-artworks');
    setNotice(response?.ok ? `“${name}”已从图库选项中永久移除。` : `“${name}”已在本页移除，后台保存暂未完成。`);
    window.setTimeout(() => setNotice(''), 3200);
  }

  async function removeFrame(id: string, name: string) {
    if (visibleFrameOptions.length <= 1) {
      setNotice('框架库至少需要保留一个可选框架。');
      return;
    }
    if (!window.confirm(`确定从工作台选择列表中移除“${name}”吗？原始框架文件不会删除。`)) return;
    const next = [...new Set([...hiddenFrameIds, id])];
    setHiddenFrameIds(next);
    window.localStorage.setItem('pingfeng-hidden-frames', JSON.stringify(next));
    setPreviewReady(false);
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
    form.set('category', '我的上传');
    const response = await fetch('/api/library', { method: 'POST', body: form }).catch(() => null);
    if (!response?.ok) {
      setNotice('上传没有完成，请检查图片格式或稍后重试。');
      return;
    }
    const row = await response.json();
    const uploaded = { id: row.id as string, name: row.name as string, file: row.url as string, tag: '我的上传', ratio: '原图', tone: '未标注' };
    setLibraryItems((current) => [uploaded, ...current]);
    selectArtwork(uploaded.id);
    setNotice(`“${uploaded.name}”已收纳到图库。`);
    window.setTimeout(() => setNotice(''), 3600);
  }

  async function uploadFrame(file: File | undefined) {
    if (!file || frameUploading) return;
    setFrameUploading(true);
    const form = new FormData();
    form.set('file', file);
    form.set('name', file.name.replace(/\.[^.]+$/, ''));
    form.set('category', '框架模板');
    form.set('tags', '标准合并框架');
    const response = await fetch('/api/library', { method: 'POST', body: form }).catch(() => null);
    if (!response?.ok) {
      const message = await response?.json().catch(() => null);
      setNotice(message?.error || '框架上传没有完成，请选择 JPG 或 PNG 图片后重试。');
      setFrameUploading(false);
      return;
    }
    const row = await response.json();
    const uploaded: FrameOption = { id: `uploaded-frame-${row.id}`, name: row.name as string, file: row.url as string, tone: '本地上传 · 标准合并框架', color: '#432d24', profile: 'cabinet', variantCount: 1 };
    setUploadedFrames((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
    selectFrame(uploaded.id);
    setFrameUploading(false);
    setNotice(`“${uploaded.name}”已上传到框架库并自动选中。`);
    window.setTimeout(() => setNotice(''), 3600);
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
          {navItems.map(([id, label, count]) => (
            <button key={id} className={activeNav === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(id)}>
              <span className={`nav-icon nav-icon-${id}`} aria-hidden="true" />
              <span>{label}</span>
              <em>{id === 'gallery' ? visibleLibraryItems.length : id === 'frames' ? visibleFrameOptions.length : count}</em>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <section className="storage-card">
          <div className="storage-title"><span>图库空间</span><b>38%</b></div>
          <div className="storage-track"><i /></div>
          <p>已使用 7.6 GB / 20 GB</p>
          <button>管理素材</button>
        </section>
        <div className="profile-row">
          <span className="avatar">徐</span>
          <div><strong>徐艺木业</strong><small>个人工作台</small></div>
          <button aria-label="更多账户选项">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">NEW PRODUCT WORKFLOW</p>
            <h1>创建一个屏风新品</h1>
          </div>
          <div className="top-actions">
            <span className="sync-state"><i /> 已自动保存</span>
            <button className="ghost-button">查看交付规范</button>
            <button className="primary-button" onClick={createProduct}>创建新品 <span>→</span></button>
          </div>
        </header>

        <div className={`content-grid ${activeNav === 'new' ? '' : 'view-hidden'}`}>
          <section className="library-panel">
            <section className="choice-section artwork-choice-section">
              <div className="section-heading">
                <div><p>ARTWORK OPTIONS</p><h2>图案选项</h2></div>
                <button className="upload-button" onClick={() => setActiveNav('gallery')}>更多图案 <span>→</span></button>
              </div>

              <p className="home-gallery-note">随机展示3张图案。点击即可选择，也可以进入完整图库搜索。</p>
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
              <div className="home-library-footer"><span>当前可选 {visibleLibraryItems.length} 张图案</span><button onClick={() => setActiveNav('gallery')}>进入完整图库选择 →</button></div>
            </section>

            <section className="choice-section frame-choice-section">
              <div className="section-heading">
                <div><p>FRAME OPTIONS</p><h2>框架选项</h2></div>
                <button className="upload-button" onClick={() => setActiveNav('frames')}>更多框架 <span>→</span></button>
              </div>
              <p className="home-gallery-note">选择一种框型或柜体空框。更换选项后，需要重新确认组合预览。</p>
              <div className="home-frame-grid">
                {visibleCabinetFrames.map((item) => <div className="option-card-wrap" key={item.id}>
                  <button className={frameId === item.id ? 'home-frame-card selected' : 'home-frame-card'} onClick={() => selectFrame(item.id)}>
                    <span className="home-frame-thumb image-frame-thumb"><img src={item.file} alt={`${item.name}标准合并框架`} /></span>
                    <span><strong>{item.name}</strong><small>{item.tone}</small></span>
                    {frameId === item.id && <b>✓</b>}
                  </button>
                </div>)}
                {visibleScreenFrames.map((item) => (
                  <div className="option-card-wrap" key={item.id}>
                    <button className={frameId === item.id ? 'home-frame-card selected' : 'home-frame-card'} onClick={() => selectFrame(item.id)}>
                      <span className="home-frame-thumb"><i style={{ '--swatch': item.color } as React.CSSProperties}><em /></i></span>
                      <span><strong>{item.name}</strong><small>{item.tone}</small></span>
                      {frameId === item.id && <b>✓</b>}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="compose-panel">
            <div className="compose-heading"><div><p>COMBINATION PREVIEW</p><h2>组合效果</h2></div><span className={previewReady ? 'draft-badge ready' : 'draft-badge'}>{previewReady ? '已组合' : '待确认'}</span></div>
            <div className="preview-stage">
              <div className="ambient-circle" />
              {!previewReady ? <div className="preview-placeholder"><span className="preview-pair"><img src={selected.file} alt="已选图案" />＋<i style={{ '--preview-frame': frameColor.color, '--preview-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}>{frame.file ? <img src={frame.file} alt="已选框架" /> : <em />}</i></span><strong>确认后查看组合效果</strong><small>已选择“{selected.name}”＋“{frame.name}”＋“{frameColor.name}”</small></div> : frame.profile === 'cabinet' && frame.file ? <div className="cabinet-first-frame" style={{ '--selected-frame-color': frameColor.color, '--selected-frame-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}><img className="cabinet-frame-image" src={frame.file} alt={`${frame.name}${frameColor.name}首帧`} /><div className="cabinet-art-overlay" style={frame.artworkBox}><img src={selected.file} alt={`${selected.name}装入空框后的效果`} /></div><span>款式标准框架 · {frameColor.name}</span></div> : <div className={`screen-product profile-${frame.profile}`} style={{ '--frame-color': frameColor.color, '--frame-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}>
                  <div className="screen-frame"><img src={selected.file} alt={`${selected.name}屏风预览`} /></div>
                  <div className="screen-base"><i /><b /><i /></div>
                </div>}
              {previewReady && <span className="preview-scale">预览比例 1:2.6</span>}
            </div>

            <button className="combine-button" onClick={() => setPreviewReady(true)}>{previewReady ? '重新确认组合预览' : '确认组合并查看效果'} <span>→</span></button>

            <div className="selection-summary">
              <div className="summary-art"><img src={selected.file} alt="" /><span><small>已选图案</small><strong>{selected.name}</strong></span><button onClick={() => setActiveNav('gallery')}>更换</button></div>
              <div className="summary-frame"><span className="summary-frame-icon" style={{ '--summary-frame': frameColor.color, '--summary-texture': frameColor.texture ? `url(${frameColor.texture})` : 'none' } as React.CSSProperties}>{frame.file ? <img src={frame.file} alt="" /> : <i />}<em /></span><span><small>已选框架</small><strong>{frame.name} · {frameColor.name}</strong></span><button onClick={() => setActiveNav('frames')}>更换</button></div>
            </div>

            <section className="frame-color-picker">
              <div className="row-label"><span>框架颜色</span><b>{frameColor.name}</b></div>
              <div className="frame-color-options">
                {frameColors.map((item) => <button key={item.id} className={frameColorId === item.id ? 'selected' : ''} onClick={() => selectFrameColor(item.id)} aria-label={`选择${item.name}框架颜色`}><i style={{ backgroundColor: item.color, backgroundImage: item.texture ? `url(${item.texture})` : 'none' }} /><strong>{item.name}</strong>{frameColorId === item.id && <b>✓</b>}</button>)}
              </div>
              <button className="open-color-library" onClick={() => setActiveNav('colors')}>进入颜色库查看材质 →</button>
            </section>

            <section className="output-plan">
              <div className="row-label"><span>生成内容</span><b>按已确认标准</b></div>
              <div className="output-items">
                <label><input type="checkbox" defaultChecked /><span><i className="cover-icon" /><strong>新品主图</strong><small>场景图与电商白底图</small></span></label>
                <label><input type="checkbox" defaultChecked /><span><i className="size-icon" /><strong>单尺寸图</strong><small>20 个规格，每尺寸一张</small></span></label>
                <label><input type="checkbox" defaultChecked /><span><i className="detail-icon" /><strong>全新详情页</strong><small>790px 长图、切片与 QA 图</small></span></label>
              </div>
            </section>
            <button className="create-cta" disabled={!previewReady} onClick={createProduct}>创建新品并生成第一张样图 <span>→</span></button>
            <p className="approval-note"><span>i</span> 样图确认前不会启动批量生成，原图始终保留。</p>
          </aside>
        </div>

        {activeNav !== 'new' && <SecondaryView view={activeNav} libraryItems={visibleLibraryItems} selectedArtworkId={selectedId} onSelectArtwork={selectArtwork} onDeleteArtwork={removeArtwork} onRestoreArtworks={restoreArtworks} hiddenArtworkCount={hiddenArtworkIds.length} onUploadArtwork={uploadAsset} frameId={frameId} frameStyles={visibleCabinetFrames} screenFrames={visibleScreenFrames} onSelectFrame={selectFrame} onDeleteFrame={removeFrame} onRestoreFrames={restoreFrames} hiddenFrameCount={hiddenFrameIds.length} onUploadFrame={uploadFrame} frameUploading={frameUploading} frameColorId={frameColorId} onSelectFrameColor={selectFrameColor} onCreate={() => setActiveNav('new')} />}

        <footer className={`spec-strip ${activeNav === 'new' ? '' : 'view-hidden'}`}>
          <div><span>尺寸矩阵</span><strong>高 187 / 197 / 207 / 217 cm</strong><strong>长 71 / 81 / 91 / 101 / 111 cm</strong></div>
          <div className="matrix-popover"><b>20</b><span>单尺寸图</span><small>{sizeMatrix.length} 个规格已锁定</small></div>
          <div><span>底座进深</span><strong>30 cm</strong><small>手工测量允许 1–3 cm 误差</small></div>
        </footer>
      </section>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}

function SecondaryView({ view, libraryItems, selectedArtworkId, onSelectArtwork, onDeleteArtwork, onRestoreArtworks, hiddenArtworkCount, onUploadArtwork, frameId, frameStyles, screenFrames, onSelectFrame, onDeleteFrame, onRestoreFrames, hiddenFrameCount, onUploadFrame, frameUploading, frameColorId, onSelectFrameColor, onCreate }: { view: string; libraryItems: typeof artworks; selectedArtworkId: string; onSelectArtwork: (id: string) => void; onDeleteArtwork: (id: string, name: string) => void; onRestoreArtworks: () => void; hiddenArtworkCount: number; onUploadArtwork: (file: File | undefined) => void; frameId: string; frameStyles: FrameOption[]; screenFrames: FrameOption[]; onSelectFrame: (id: string) => void; onDeleteFrame: (id: string, name: string) => void; onRestoreFrames: () => void; hiddenFrameCount: number; onUploadFrame: (file: File | undefined) => void; frameUploading: boolean; frameColorId: string; onSelectFrameColor: (id: string) => void; onCreate: () => void }) {
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('全部素材');
  const filteredGallery = useMemo(() => libraryItems.filter((item) => {
    const searchMatch = `${item.name}${item.tag}${item.tone}${item.ratio}`.includes(gallerySearch.trim());
    const categoryMatch = galleryCategory === '全部素材' || item.tag.includes(galleryCategory);
    return searchMatch && categoryMatch;
  }), [galleryCategory, gallerySearch, libraryItems]);
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
          <div className="frame-subheading"><div><p className="eyebrow">ONE STYLE · ONE COMBINE FRAME</p><h3>玄关柜款式</h3></div><span>每个款式只提供一个标准空框用于合并</span></div>
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
          <label className={frameUploading ? 'frame-upload-card uploading' : 'frame-upload-card'}><b>{frameUploading ? '…' : '＋'}</b><strong>{frameUploading ? '正在上传框架' : '录入新框架模板'}</strong><small>点击选择本地 JPG 或 PNG，上传后自动加入框架库</small><input type="file" accept="image/png,image/jpeg" disabled={frameUploading} onChange={(event) => { onUploadFrame(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>
        </div>
      </>}
      {view === 'colors' && <>
        <div className="color-library-intro"><div><p className="eyebrow">FRAME MATERIAL LIBRARY</p><h3>六种标准框架颜色</h3></div><span>颜色独立于框架款式保存，选择后用于组合预览与新品生成。</span></div>
        <div className="color-library-grid">
          {frameColors.map((item, index) => <button key={item.id} className={frameColorId === item.id ? 'color-library-card selected' : 'color-library-card'} onClick={() => onSelectFrameColor(item.id)}>
            <span className="color-material-preview" style={{ backgroundColor: item.color, backgroundImage: item.texture ? `url(${item.texture})` : 'none' }} />
            <span><small>COLOR {String(index + 1).padStart(2, '0')}</small><strong>{item.name}</strong><em>{item.texture ? '实拍材质样板' : '标准暖白色板'}</em></span>
            <b>{frameColorId === item.id ? '已选择 ✓' : '选择此颜色'}</b>
          </button>)}
        </div>
        <div className="color-choice-bar"><span>已选颜色：<strong>{frameColors.find((item) => item.id === frameColorId)?.name}</strong></span><button onClick={onCreate}>使用所选颜色创建新品 →</button></div>
      </>}
      {view === 'gallery' && <>
        <div className="library-stats"><div><span>全部素材</span><strong>{libraryItems.length}</strong><small>已合并本地图库与上传素材</small></div><div><span>本地图库</span><strong>267</strong><small>已按文件内容去重</small></div><div><span>来源目录</span><strong>17</strong><small>D:\网页找图</small></div><div><span>待高清处理</span><strong>02</strong><small>超大原图保留在本地</small></div></div>
        <div className="secondary-gallery-toolbar"><label className="search-box"><span aria-hidden="true" /><input value={gallerySearch} onChange={(event) => setGallerySearch(event.target.value)} placeholder="搜索图案、日期或文件夹" /><kbd>{filteredGallery.length}张</kbd></label><div className="filter-chips">{['全部素材', '山水风景', '花卉植物', '综合图案'].map((item) => <button key={item} className={galleryCategory === item ? 'selected' : ''} onClick={() => setGalleryCategory(item)}>{item}</button>)}</div>{hiddenArtworkCount > 0 && <button className="restore-button" onClick={onRestoreArtworks}>恢复已移除</button>}<label className="upload-button"><span>＋</span> 上传图片<input type="file" accept="image/png,image/jpeg" onChange={(event) => onUploadArtwork(event.target.files?.[0])} /></label></div>
        <div className="gallery-wide-grid selectable-gallery">{filteredGallery.map((item) => <div className="option-card-wrap" key={item.id}><button className={selectedArtworkId === item.id ? 'selected' : ''} onClick={() => onSelectArtwork(item.id)}><div className="gallery-image-wrap"><img src={item.file} alt={item.name} loading="lazy" />{selectedArtworkId === item.id && <b>已选择 ✓</b>}</div><div><small>{item.tag}</small><strong>{item.name}</strong><p>{item.tone} · {item.ratio}</p></div></button><button className="remove-option" onClick={() => onDeleteArtwork(item.id, item.name)} aria-label={`删除图案选项${item.name}`}>删除</button></div>)}</div>
        <div className="gallery-selection-bar"><span>已选择：<strong>{libraryItems.find((item) => item.id === selectedArtworkId)?.name ?? '尚未选择'}</strong></span><button onClick={onCreate}>使用所选图案创建新品 →</button></div>
      </>}
      {view === 'jobs' && <div className="job-board">
        <div className="job-column"><h3>等待样图确认 <span>2</span></h3><JobCard name="浅绿云雾山影新品" image="/demo/浅绿云雾山影.png" state="第一张主图待确认" progress="1 / 33" /><JobCard name="暖白花枝新品" image="/demo/暖白花枝.jpg" state="框架结构待复核" progress="0 / 33" /></div>
        <div className="job-column"><h3>批量生成中 <span>1</span></h3><JobCard name="米灰抽象花影新品" image="/demo/米灰抽象花影.jpg" state="20张单尺寸图生成中" progress="12 / 33" /></div>
        <div className="job-column"><h3>QA 检查 <span>1</span></h3><JobCard name="米白灰绿植物新品" image="/demo/米白灰绿植物.jpg" state="详情页文字与尺寸复核" progress="31 / 33" /></div>
      </div>}
      {view === 'delivery' && <div className="delivery-list">
        {[
          ['浅绿云雾山影新品', '2026-08-27_v1', '待样图确认', '1 / 33'],
          ['米灰抽象花影新品', '2026-08-26_v2', '生成中', '12 / 33'],
          ['米白灰绿植物新品', '2026-08-25_v1', 'QA检查', '31 / 33'],
          ['暖白花枝新品', '2026-08-24_v3', '已交付', '33 / 33'],
        ].map(([name, version, state, count]) => <article key={version}><div className="package-icon"><i /><i /><i /></div><div><small>{version}</small><strong>{name}</strong><p>主图 · 20张单尺寸图 · 790px详情页 · QA总览 · 交付清单</p></div><span className={`package-state state-${state}`}>{state}</span><b>{count}</b><button>查看文件 →</button></article>)}
      </div>}
    </section>
  );
}

function JobCard({ name, image, state, progress }: { name: string; image: string; state: string; progress: string }) {
  return <article className="job-card"><div><img src={image} alt="" /><span><small>屏风新品</small><strong>{name}</strong></span></div><p>{state}</p><footer><span>{progress} 个文件</span><button>查看任务 →</button></footer></article>;
}
