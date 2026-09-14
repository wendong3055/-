import { env } from 'cloudflare:workers';
import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { assets } from '../../../db/schema';
import { libraryAssetFilter } from '../../../db/library-filter';
import { classifyArtworkCategory } from '../../../lib/artwork-category';

function ownerId(userId: string | undefined) {
  return userId ?? 'local-preview';
}

export async function GET() {
  const user = await getChatGPTUser();
  const rows = await getDb().select().from(assets).where(libraryAssetFilter(ownerId(user?.userId))).orderBy(desc(assets.createdAt));
  return NextResponse.json(rows.map((row) => ({ ...row, url: `/api/files/${row.id}` })), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: '请选择 JPG 或 PNG 图片。' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: '单张图片不能超过 20 MB。' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const currentOwner = ownerId(user?.userId);
  const name = String(form.get('name') || file.name.replace(/\.[^.]+$/, ''));
  const requestedCategory = String(form.get('category') || '未分类');
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '-');
  const objectKey = `${currentOwner}/${id}/${safeName}`;
  await env.FILES.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });

  const row = {
    id,
    ownerId: currentOwner,
    name,
    category: requestedCategory === '自动分类' ? classifyArtworkCategory(`${name} ${file.name}`) : requestedCategory,
    tags: requestedCategory.startsWith('框架')
      ? `${String(form.get('tags') || '').split(';').filter((tag) => !tag.startsWith('原始文件名:')).join(';')};原始文件名:${encodeURIComponent(file.name)}`
      : String(form.get('tags') || ''),
    tone: String(form.get('tone') || ''),
    mimeType: file.type,
    objectKey,
    size: file.size,
    createdAt: new Date(),
  };
  await getDb().insert(assets).values(row);
  return NextResponse.json({ ...row, url: `/api/files/${id}` }, { status: 201 });
}
