import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { assets } from '../../../db/schema';

type PreviewRequest = {
  artworkUrl?: string;
  artworkName?: string;
  frameUrl?: string | null;
  frameName?: string;
  frameProfile?: string;
  colorId?: string;
  colorName?: string;
  colorHex?: string;
};

const colorDirections: Record<string, string> = {
  natural: '浅原木色，清晰自然木纹，明亮中性蜂蜜木色，不偏橙',
  redwood: '红木色，深红棕木纹，稳重但不过分发紫或发黑',
  pear: '黄花梨色，温润金棕木纹，轻微橙调但不过饱和',
  walnut: '胡桃木色，深棕色天然木纹，保留真实明暗层次',
  'simple-gray': '简约灰，中性低饱和灰色木纹，哑光质感',
  'warm-white': '象牙暖白，接近中性白，只有极轻微暖感，低黄度、不奶黄，保留细微木纹和真实阴影',
};

function ownerId(userId: string | undefined) {
  return userId ?? 'local-preview';
}

function safeFileName(value: string, fallback: string) {
  const safe = value.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
  return safe || fallback;
}

async function readImage(request: Request, path: string, currentOwner: string, fallbackName: string) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('图片地址无效。');

  const fileMatch = path.match(/^\/api\/files\/([^/?#]+)/);
  if (fileMatch) {
    const [asset] = await getDb().select().from(assets).where(and(eq(assets.id, fileMatch[1]), eq(assets.ownerId, currentOwner))).limit(1);
    if (!asset) throw new Error('所选素材不存在或无权读取。');
    const object = await env.FILES.get(asset.objectKey);
    if (!object) throw new Error('所选素材文件不存在。');
    const bytes = await object.arrayBuffer();
    return new File([bytes], safeFileName(asset.name, fallbackName), { type: asset.mimeType || 'image/png' });
  }

  const headers = new Headers();
  for (const key of ['cookie', 'oai-authenticated-user-id', 'oai-authenticated-user-email', 'oai-authenticated-user-full-name', 'oai-authenticated-user-full-name-encoding']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('accept', 'image/png,image/jpeg,image/webp');
  const response = await fetch(new URL(path, request.url), { headers });
  if (!response.ok) throw new Error('所选图片暂时无法读取。');
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
  if (!mimeType.startsWith('image/')) throw new Error('所选文件不是可用图片。');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('单张参考图不能超过 20 MB。');
  const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
  return new File([bytes], `${fallbackName}.${extension}`, { type: mimeType });
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) output[index] = binary.charCodeAt(index);
  return output;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const currentOwner = ownerId(user?.userId);
  const body = await request.json() as PreviewRequest;
  if (!body.artworkUrl || !body.artworkName || !body.frameName || !body.colorName) {
    return NextResponse.json({ error: '图案、框架或颜色信息不完整。' }, { status: 400 });
  }

  const runtimeEnv = env as unknown as { OPENAI_API_KEY?: string };
  const apiKey = runtimeEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '工作台尚未配置图像生成密钥。' }, { status: 503 });
  }

  try {
    const artwork = await readImage(request, body.artworkUrl, currentOwner, 'artwork');
    const frame = body.frameUrl ? await readImage(request, body.frameUrl, currentOwner, 'frame') : null;
    const colorDirection = colorDirections[body.colorId || ''] || `${body.colorName}，色值参考 ${body.colorHex || '所选色板'}`;
    const prompt = frame
      ? `你正在制作家居电商新品的第一张真实效果图。输入图1是必须严格保留结构的框架或柜体产品参考，输入图2是必须使用的完整画芯图案。保持图1的产品结构、比例、视角、框体粗细、底座、柜门、抽屉、格栅、铰链、把手、脚轮、五金、透视、光影和背景不变；只把画芯区域原有内容替换为图2图案，使图案自然完整地装入所有有效画芯开口。把所有可见的木质框架部件整体替换为“${body.colorName}”：${colorDirection}，参考色值 ${body.colorHex || '按描述'}。颜色必须真实作用在木框与木质底座表面，保留木纹、明暗、反射和接缝；不要给画芯、墙面、地面、金属脚轮、把手或其他非木质部件染色。不要新增文字、尺寸线、装饰物、格栅或产品结构，不要裁掉产品。最终输出干净、真实、可直接用于确认的完整产品效果图。`
      : `你正在制作家居电商新品的第一张真实效果图。输入图是必须完整使用的画芯图案。为它制作“${body.frameName}”独立落地屏风框架，框型特征为 ${body.frameProfile || '标准直边滑轮屏风'}，画芯完整铺入框内，不裁掉主体内容。框架全部使用“${body.colorName}”：${colorDirection}，参考色值 ${body.colorHex || '按描述'}。框架要有真实木纹、接缝、底座和脚轮，颜色只作用于木质框架，不污染画芯与金属件。白色或浅中性电商背景，完整显示产品，不新增文字、尺寸线或无关装饰。`;

    const form = new FormData();
    form.set('model', 'gpt-image-2');
    form.set('prompt', prompt);
    form.set('size', 'auto');
    form.set('quality', 'medium');
    form.set('input_fidelity', 'high');
    form.set('output_format', 'png');
    if (frame) form.append('image[]', frame, frame.name);
    form.append('image[]', artwork, artwork.name);

    const generation = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const payload = await generation.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
    const base64 = payload.data?.[0]?.b64_json;
    if (!generation.ok || !base64) {
      return NextResponse.json({ error: payload.error?.message || '图像模型暂时没有返回结果，请稍后重试。' }, { status: 502 });
    }

    const id = crypto.randomUUID();
    const bytes = decodeBase64(base64);
    const name = `${body.artworkName}-${body.frameName}-${body.colorName}-组合效果`;
    const fileName = safeFileName(`${name}.png`, `${id}.png`);
    const objectKey = `${currentOwner}/generated-previews/${id}/${fileName}`;
    await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: 'image/png' } });
    const row = {
      id,
      ownerId: currentOwner,
      name,
      category: '生成效果图',
      tags: `真实生成;图案:${body.artworkName};框架:${body.frameName};框色:${body.colorName}`,
      tone: body.colorName,
      mimeType: 'image/png',
      objectKey,
      size: bytes.byteLength,
      createdAt: new Date(),
    };
    await getDb().insert(assets).values(row);
    return NextResponse.json({ id, url: `/api/files/${id}`, name }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成没有完成，请稍后重试。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
