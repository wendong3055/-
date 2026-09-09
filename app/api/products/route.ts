import { env } from 'cloudflare:workers';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../db';
import { products } from '../../../db/schema';
import { generationOwner } from '../../../lib/generation-auth';
import { frameSources, frameStyle, type FrameAsset } from '../../../lib/frame-catalog';

export async function GET() {
  const owner = await generationOwner();
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  try {
    const rows = await getDb().select().from(products).where(eq(products.ownerId, owner)).orderBy(desc(products.createdAt));
    return NextResponse.json(rows, { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: '新品记录暂时无法读取。' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const owner = await generationOwner(request);
  if (!owner) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
  const body = await request.json().catch(() => null) as { artworkId?: string; artworkName?: string; frameId?: string; frameName?: string; sampleAssetId?: string; sizeCount?: number } | null;
  if (!body || !['artworkId', 'artworkName', 'frameId', 'frameName', 'sampleAssetId'].every((key) => typeof body[key as keyof typeof body] === 'string' && String(body[key as keyof typeof body]).length > 0 && String(body[key as keyof typeof body]).length <= 250)) {
    return NextResponse.json({ error: '图案、框架或已确认效果图信息不完整。' }, { status: 400 });
  }
  try {
    const asset = await env.DB.prepare("SELECT id FROM assets WHERE id = ? AND owner_id = ? AND category = '生成效果图'").bind(body.sampleAssetId!, owner).first();
    if (!asset) return NextResponse.json({ error: '未找到属于你的生成效果图，请先生成再保存。' }, { status: 400 });
    const id = `product-${body.sampleAssetId}`;
    const now = Date.now();
    const { results: frameRows } = await env.DB.prepare("SELECT id, name, category, tags, object_key FROM assets WHERE owner_id = ? AND category IN ('框架模板','框架规格原图')").bind(owner).all<FrameAsset>();
    const representative = frameRows.find((row) => `uploaded-frame-${row.id}` === body.frameId) || frameRows.find((row) => row.category === '框架模板' && frameStyle(row.name) === frameStyle(body.frameName!.split('·')[0]));
    const sizes = representative ? frameSources(frameRows, representative).sizes : [];
    const sizeCount = sizes.length;
    const product = { id, name: `${body.artworkName}新品`, sampleAssetId: body.sampleAssetId, status: 'approved' };
    const statements = [
      env.DB.prepare("INSERT INTO products (id, owner_id, name, artwork_id, artwork_name, frame_id, frame_name, sample_asset_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?) ON CONFLICT(id) DO NOTHING")
        .bind(id, owner, product.name, body.artworkId!, body.artworkName!, body.frameId!, body.frameName!, body.sampleAssetId!, now),
      ...[['main_images', 1], ['single_sizes', sizeCount], ['detail_page', 12]].map(([kind, count]) =>
        env.DB.prepare("INSERT INTO jobs (id, owner_id, product_id, kind, status, version, output_count, specs_json, created_at) VALUES (?, ?, ?, ?, ?, 'v1', ?, ?, ?) ON CONFLICT(id) DO NOTHING")
          .bind(`${id}-${kind}`, owner, id, kind, kind === 'single_sizes' && !sizeCount ? 'needs_spec_confirmation' : 'waiting_for_production', count, kind === 'single_sizes' ? JSON.stringify(sizes) : '[]', now)),
    ];
    await env.DB.batch(statements);
    return NextResponse.json(product, { status: 201 });
  } catch { return NextResponse.json({ error: '新品保存失败，已生成图片仍保留，请稍后重试。' }, { status: 503 }); }
}
