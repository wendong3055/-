'use client';

import { useEffect, useMemo, useState } from 'react';

const artworks = [
  { id: 'mist', name: '浅绿云雾山影', file: '/demo/浅绿云雾山影.png', tag: '山水留白', ratio: '1:1', tone: '雾绿' },
  { id: 'floral', name: '暖白花枝', file: '/demo/暖白花枝.jpg', tag: '花鸟新中式', ratio: '1:1', tone: '暖白' },
  { id: 'collage', name: '米白灰绿植物', file: '/demo/米白灰绿植物.jpg', tag: '植物拼贴', ratio: '1:1', tone: '灰绿' },
  { id: 'abstract', name: '米灰抽象花影', file: '/demo/米灰抽象花影.jpg', tag: '抽象肌理', ratio: '1:1', tone: '米灰' },
  { id: 'blue', name: '雾蓝极简单花', file: '/demo/雾蓝极简单花.png', tag: '极简花卉', ratio: '1:1', tone: '雾蓝' },
];

const frames = [
  { id: 'ruyi-walnut', name: '如意葫芦款', tone: '胡桃木色', color: '#3a2a22', profile: 'classic' },
  { id: 'ruyi-natural', name: '如意葫芦款', tone: '原木色', color: '#d5ad72', profile: 'classic' },
  { id: 'straight-warm', name: '极简直边款', tone: '暖白色', color: '#d8d0bd', profile: 'slim' },
  { id: 'wide-redwood', name: '加宽立柱款', tone: '红木色', color: '#6e3428', profile: 'wide' },
  { id: 'classic-pear', name: '经典榫卯款', tone: '黄花梨色', color: '#a4592d', profile: 'joinery' },
  { id: 'simple-gray', name: '简约滑轮款', tone: '简约灰色', color: '#66645f', profile: 'slim' },
];

const navItems = [
  ['new', '新品项目', '08'],
  ['gallery', '图库收纳', '128'],
  ['frames', '框架库', '06'],
  ['jobs', '生成任务', '03'],
  ['delivery', '交付中心', '12'],
];

const sizeMatrix = ['187 × 71', '187 × 81', '187 × 91', '187 × 101', '187 × 111', '197 × 71', '197 × 81', '197 × 91', '197 × 101', '197 × 111', '207 × 71', '207 × 81', '207 × 91', '207 × 101', '207 × 111', '217 × 71', '217 × 81', '217 × 91', '217 × 101', '217 × 111'];

export default function Home() {
  const [libraryItems, setLibraryItems] = useState(artworks);
  const [selectedId, setSelectedId] = useState('mist');
  const [frameId, setFrameId] = useState('ruyi-walnut');
  const [activeNav, setActiveNav] = useState('new');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const selected = libraryItems.find((item) => item.id === selectedId) ?? libraryItems[0];
  const frame = frames.find((item) => item.id === frameId) ?? frames[0];
  const visibleArtworks = useMemo(() => libraryItems.filter((item) => `${item.name}${item.tag}${item.tone}`.includes(search.trim())), [libraryItems, search]);

  useEffect(() => {
    fetch('/api/library').then((response) => response.ok ? response.json() : []).then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const uploads = rows.map((row: { id: string; name: string; url: string; category: string; tone: string }) => ({ id: row.id, name: row.name, file: row.url, tag: row.category || '我的上传', ratio: '原图', tone: row.tone || '未标注' }));
      setLibraryItems((current) => [...uploads, ...current.filter((item) => !uploads.some((upload) => upload.id === item.id))]);
    }).catch(() => undefined);
  }, []);

  async function createProduct() {
    const response = await fetch('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId: selected.id, artworkName: selected.name, frameId: frame.id, frameName: `${frame.name}·${frame.tone}` }) }).catch(() => null);
    setNotice(response?.ok ? `“${selected.name} · ${frame.name}”已保存，第一张样图任务已建立。` : `“${selected.name} · ${frame.name}”已进入样图确认阶段。`);
    window.setTimeout(() => setNotice(''), 3600);
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
    setSelectedId(uploaded.id);
    setNotice(`“${uploaded.name}”已收纳到图库。`);
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
              <em>{count}</em>
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

        <div className="workflow-steps" aria-label="新品制作进度">
          {[
            ['01', '选择画芯', '从图库挑选图案'],
            ['02', '拼接框架', '确认框色与比例'],
            ['03', '生成素材', '主图 · 尺寸图 · 详情页'],
            ['04', 'QA 与交付', '审批样图后批量导出'],
          ].map(([number, title, desc], index) => (
            <div key={number} className={`step ${index === 0 ? 'current' : ''}`}>
              <span>{number}</span><div><strong>{title}</strong><small>{desc}</small></div>{index < 3 && <i />}
            </div>
          ))}
        </div>

        <div className={`content-grid ${activeNav === 'new' ? '' : 'view-hidden'}`}>
          <section className="library-panel">
            <div className="section-heading">
              <div><p>第一步</p><h2>从图库选择画芯</h2></div>
              <label className="upload-button"><span>＋</span> 上传新图片<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadAsset(event.target.files?.[0])} /></label>
            </div>
            <div className="library-toolbar">
              <label className="search-box"><span aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索图案、标签或色系" />
                <kbd>⌘ K</kbd>
              </label>
              <div className="filter-chips">
                <button className="selected">全部素材</button><button>新中式</button><button>植物花卉</button><button>抽象肌理</button>
              </div>
            </div>

            <div className="gallery-grid">
              {visibleArtworks.map((item) => (
                <button key={item.id} className={selectedId === item.id ? 'art-card selected' : 'art-card'} onClick={() => setSelectedId(item.id)}>
                  <div className="art-thumb"><img src={item.file} alt={item.name} />
                    <span className="asset-state">已入库</span>
                    {selectedId === item.id && <span className="selected-check">✓</span>}
                  </div>
                  <div className="art-meta"><strong>{item.name}</strong><p><span>{item.tag}</span><span>{item.tone}</span></p></div>
                  <div className="art-info"><span>JPG · {item.ratio}</span><span>•••</span></div>
                </button>
              ))}
              <button className="add-card"><span>＋</span><strong>收纳更多画芯</strong><small>JPG / PNG，单张不超过 20 MB</small></button>
            </div>
          </section>

          <aside className="compose-panel">
            <div className="compose-heading"><div><p>新品预览</p><h2>画芯 × 框架</h2></div><span className="draft-badge">草稿</span></div>
            <div className="preview-stage">
              <div className="ambient-circle" />
              <div className={`screen-product profile-${frame.profile}`} style={{ '--frame-color': frame.color } as React.CSSProperties}>
                <div className="screen-frame"><img src={selected.file} alt={`${selected.name}屏风预览`} /></div>
                <div className="screen-base"><i /><b /><i /></div>
              </div>
              <span className="preview-scale">预览比例 1:2.6</span>
            </div>

            <div className="selection-summary">
              <div className="summary-art"><img src={selected.file} alt="" /><span><small>当前画芯</small><strong>{selected.name}</strong></span><button>更换</button></div>
              <div className="frame-picker"><div className="row-label"><span>框架型号</span><b>{frame.name} · {frame.tone}</b></div>
                <div className="frame-options">{frames.map((item) => <button key={item.id} aria-label={`${item.name}${item.tone}`} className={frameId === item.id ? 'selected' : ''} onClick={() => setFrameId(item.id)}><i style={{ '--swatch': item.color } as React.CSSProperties}><span /></i><em>{item.name}<small>{item.tone}</small></em>{frameId === item.id && <b>✓</b>}</button>)}</div>
                <button className="add-frame"><span>＋</span> 从框架库选择或上传新模板</button>
              </div>
            </div>

            <section className="output-plan">
              <div className="row-label"><span>生成内容</span><b>按已确认标准</b></div>
              <div className="output-items">
                <label><input type="checkbox" defaultChecked /><span><i className="cover-icon" /><strong>新品主图</strong><small>场景图与电商白底图</small></span></label>
                <label><input type="checkbox" defaultChecked /><span><i className="size-icon" /><strong>单尺寸图</strong><small>20 个规格，每尺寸一张</small></span></label>
                <label><input type="checkbox" defaultChecked /><span><i className="detail-icon" /><strong>全新详情页</strong><small>790px 长图、切片与 QA 图</small></span></label>
              </div>
            </section>
            <button className="create-cta" onClick={createProduct}>创建新品并生成第一张样图 <span>→</span></button>
            <p className="approval-note"><span>i</span> 样图确认前不会启动批量生成，原图始终保留。</p>
          </aside>
        </div>

        {activeNav !== 'new' && <SecondaryView view={activeNav} libraryItems={libraryItems} frameId={frameId} onSelectFrame={setFrameId} onCreate={() => setActiveNav('new')} />}

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

function SecondaryView({ view, libraryItems, frameId, onSelectFrame, onCreate }: { view: string; libraryItems: typeof artworks; frameId: string; onSelectFrame: (id: string) => void; onCreate: () => void }) {
  const headings: Record<string, [string, string]> = {
    gallery: ['图库收纳', '统一管理画芯、场景参考与已用素材'],
    frames: ['框架库', '按框型、木色和结构选择真实产品模板'],
    jobs: ['生成任务', '样图审批通过后，自动推进批量任务'],
    delivery: ['交付中心', '按新品版本汇总主图、尺寸图、详情页与 QA 文件'],
  };
  const [title, description] = headings[view] ?? ['新品项目', '管理所有新品制作进度'];
  return (
    <section className="secondary-view">
      <header className="secondary-head"><div><p className="eyebrow">WORKSPACE LIBRARY</p><h2>{title}</h2><span>{description}</span></div><button className="primary-button" onClick={onCreate}>＋ 创建新品</button></header>
      {view === 'frames' && <div className="frame-library-grid">
        {frames.map((item, index) => <button key={item.id} className={frameId === item.id ? 'frame-library-card selected' : 'frame-library-card'} onClick={() => onSelectFrame(item.id)}>
          <div className="frame-stage"><div className={`mini-screen profile-${item.profile}`} style={{ '--frame-color': item.color } as React.CSSProperties}><span /></div></div>
          <div><small>FRAME {String(index + 1).padStart(2, '0')}</small><strong>{item.name}</strong><p><i style={{ background: item.color }} />{item.tone}<em>{item.profile === 'classic' ? '滑轮底座' : item.profile === 'wide' ? '加宽立柱' : item.profile === 'joinery' ? '榫卯装饰' : '窄边框体'}</em></p></div>
          <span>{frameId === item.id ? '已选择 ✓' : '选择此框架'}</span>
        </button>)}
        <button className="frame-upload-card"><b>＋</b><strong>录入新框架模板</strong><small>上传正面产品图，并标注框型、框色、底座与滑轮</small></button>
      </div>}
      {view === 'gallery' && <>
        <div className="library-stats"><div><span>全部素材</span><strong>{128 + Math.max(0, libraryItems.length - artworks.length)}</strong><small>含 {libraryItems.length} 张演示画芯</small></div><div><span>本月新增</span><strong>24</strong><small>较上月 +18%</small></div><div><span>已用于新品</span><strong>46</strong><small>36% 使用率</small></div><div><span>待整理</span><strong>07</strong><small>缺少标签或来源</small></div></div>
        <div className="gallery-wide-grid">{libraryItems.map((item) => <article key={item.id}><img src={item.file} alt={item.name} /><div><small>{item.tag}</small><strong>{item.name}</strong><p>{item.tone} · {item.ratio}</p></div><button>•••</button></article>)}<button className="frame-upload-card"><b>＋</b><strong>上传并收纳素材</strong><small>支持批量录入名称、标签、色系与来源</small></button></div>
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
