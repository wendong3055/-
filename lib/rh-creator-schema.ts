export type RhParam = { key: string; type: string; required?: boolean; default?: string|number|boolean; options?: (string|number)[]; min?: number; max?: number; maxLength?: number; multiple?: boolean; maxCount?: number; maxSizeMB?: number; label?: string; nodeId?: string; fieldName?: string };
export type RhModel = { endpoint: string; name_cn: string; task: string; output_type: string; params: RhParam[]; fingerprint?: string };
export const creatorCategories = [['image','图片'],['video','视频'],['audio','音频'],['3d','3D 模型'],['string','文字与理解'],['app','AI 应用']] as const;
const labels: Record<string,string> = {
 prompt:'制作要求',text_prompt:'制作要求',textPrompt:'制作要求',text:'文本内容',negativePrompt:'不希望出现的内容',instructions:'制作说明',
 imageUrl:'参考图片',imageUrls:'参考图片',image_url:'参考图片',image:'参考图片',imageRef:'参考图片',referenceImages:'参考图片',referenceImageUrl:'参考图片',
 videoUrl:'参考视频',videoUrls:'参考视频',video:'参考视频',videos:'参考视频',baseVideoUrl:'原始视频',startVideo:'起始视频',
 audioUrl:'参考音频',audioUrls:'参考音频',audio_url:'参考音频',audio:'参考音频',
 firstImageUrl:'首帧图片',lastImageUrl:'尾帧图片',firstFrameUrl:'首帧图片',lastFrameUrl:'尾帧图片',endImageUrl:'尾帧图片',
 frontImageUrl:'正面图片',backImageUrl:'背面图片',leftImageUrl:'左侧图片',rightImageUrl:'右侧图片',topImageUrl:'顶部图片',bottomImageUrl:'底部图片',leftFrontImageUrl:'左前方图片',rightFrontImageUrl:'右前方图片',
 aspectRatio:'画面比例',ratio:'画面比例',resolution:'清晰度',size:'图片尺寸',width:'宽度（像素）',height:'高度（像素）',quality:'画质',
 duration:'时长（秒）',outputFormat:'输出格式',format:'输出格式',seed:'随机种子',model:'模型版本',imageNum:'图片数量',maxImages:'最多图片数量',numImages:'图片数量',n:'生成数量',
 promptExtend:'自动扩写描述',promptExtendMode:'扩写方式',enablePromptExpansion:'自动扩写描述',promptOptimizer:'优化描述',
 sound:'生成声音',generateAudio:'生成声音',enableAudio:'生成声音',generateAudioSwitch:'生成声音',keepOriginalSound:'保留原声',originalAudioVolume:'原声音量',bgm:'背景音乐',
 voice_id:'音色',voiceId:'音色',voice:'音色',speaker:'说话人',speed:'语速',voiceSpeed:'语速',speech_rate:'语速',volume:'音量',loudness_rate:'音量',pitch:'音调',pitch_rate:'音调',emotion:'情绪',
 lyrics:'歌词',isInstrumental:'纯音乐',make_instrumental:'纯音乐',title:'标题',description:'内容说明',name:'名称',languageType:'语言',voiceLanguage:'语言',
 sample_rate:'采样率',sampleRate:'采样率',bitrate:'码率',bit_rate:'码率',style:'风格',styleName:'风格名称',artStyle:'画面风格',strength:'变化强度',scale:'放大倍数',upscale:'放大',
 faceCount:'模型面数',targetPolycount:'目标面数',enablePbr:'物理材质',generateType:'生成类型',topology:'网格结构',symmetryMode:'对称方式',shouldRemesh:'重新构建网格',shouldTexture:'生成纹理',texturePrompt:'纹理描述',textureImageUrl:'纹理参考图',textureLevel:'纹理细节',
 cameraFixed:'固定镜头',motion:'运动方式',motionMode:'运动方式',movementAmplitude:'运动幅度',loop:'循环播放',returnLastFrame:'同时输出尾帧',storyboard:'分镜内容',multiShot:'多镜头',shotType:'镜头类型',
 cfgScale:'描述跟随程度',guidanceScale:'描述跟随程度',background:'背景',inputFidelity:'参考图保真度',outputWidth:'输出宽度',outputHeight:'输出高度',outputFrameRate:'输出帧率',targetFps:'目标帧率',targetResolution:'目标清晰度',
 sourceLang:'原始语言',targetLangs:'目标语言',isDub:'配音',enable_subtitle:'生成字幕',isPano:'全景',aigc_watermark:'AI 标识',aigcWatermark:'AI 标识',
 denoise:'降噪',sharpen:'锐化',faceEnhancement:'面部增强',cropToFill:'裁切填满',raw:'原始模式',draft:'草稿模式',mode:'制作模式',
};
export const mediaParam = (p:RhParam) => ['IMAGE','VIDEO','AUDIO'].includes(p.type);
export const hiddenParam = (p:RhParam) => /api.?key|password|secret|authorization|clientToken|permission|stream|webSearch/i.test(p.key);
export const commonParam = (p:RhParam) => p.required || mediaParam(p) || /^(prompt|text|text_prompt|textPrompt|resolution|aspectRatio|duration|quality|size|voice|voice_id|voiceId|lyrics)$/.test(p.key);
export function paramLabel(p:RhParam) { return p.label && /[\u4e00-\u9fff]/.test(p.label) ? p.label : labels[p.key] || (mediaParam(p)? ({IMAGE:'参考图片',VIDEO:'参考视频',AUDIO:'参考音频'}[p.type]!) : '模型补充设置'); }
export function defaultValues(model:RhModel) { return Object.fromEntries(model.params.filter(p=>!hiddenParam(p)&&!mediaParam(p)).map(p=>[p.key,p.default===undefined?'':String(p.default)])); }
export function validateParams(model:RhModel, values:Record<string,unknown>, media:Record<string,number> = {}) {
  const result:Record<string,unknown> = Object.create(null);
  for (const p of model.params) {
    if (hiddenParam(p)) { if(p.type==='BOOLEAN') result[p.key]=false; continue; }
    if (mediaParam(p)) { const count=media[p.key]||0; if(p.required&&!count) throw new Error(`请提供${paramLabel(p)}。`); if(count>(p.multiple?(p.maxCount||10):1)) throw new Error(`${paramLabel(p)}数量过多。`); continue; }
    const v=values[p.key] ?? (p.default===undefined?'':String(p.default));
    if(typeof v!=='string' || v.length>Math.min(p.maxLength||12000,20000)) throw new Error(`${paramLabel(p)}内容无效或过长。`);
    if(!v.trim()) { if(p.required)throw new Error(`请填写${paramLabel(p)}。`); continue; }
    if(p.options?.length && p.type!=='SIZE' && !p.options.some(o=>String(o)===v)) throw new Error(`${paramLabel(p)}不支持这个选项。`);
    if(['INT','FLOAT'].includes(p.type)) { const n=Number(v); if(!Number.isFinite(n)||p.type==='INT'&&!Number.isInteger(n)||p.min!==undefined&&n<p.min||p.max!==undefined&&n>p.max)throw new Error(`${paramLabel(p)}超出有效范围。`); result[p.key]=n; }
    else if(p.type==='BOOLEAN') { if(!['true','false'].includes(v))throw new Error(`${paramLabel(p)}请使用开关。`); result[p.key]=v==='true'; }
    else if(p.type==='SIZE') { if(!p.options?.some(o=>String(o)===v) && !/^\d{2,5}[x*]\d{2,5}$/.test(v))throw new Error('请填写有效图片尺寸，例如 1024*1024。'); if(v==='custom')throw new Error('请直接填写自定义宽度*高度。'); result[p.key]=v; }
    else if(p.options?.length) result[p.key]=p.options.find(o=>String(o)===v);
    else result[p.key]=v;
  }
  return result;
}
export function appIdFrom(value:string) { if(/^\d{10,25}$/.test(value))return value; try {const u=new URL(value);if(u.protocol==='https:'&&['www.runninghub.cn','runninghub.cn','www.runninghub.ai','runninghub.ai'].includes(u.hostname))return u.pathname.match(/^\/ai-detail\/(\d{10,25})\/?$/)?.[1]||'';}catch{}return ''; }
