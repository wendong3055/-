import { and, eq, ne, sql } from 'drizzle-orm';
import { assets, generationTasks, products } from './schema';

// Assets is shared file storage, NOT the artwork catalog. Keep finished images
// available to products/history/downloads while excluding them from selection.
export function libraryAssetFilter(ownerId: string) {
  return and(
    eq(assets.ownerId, ownerId),
    ne(assets.category, '生成效果图'),
    sql`NOT EXISTS (
      SELECT 1 FROM ${generationTasks}
      WHERE ${generationTasks.ownerId} = ${assets.ownerId}
        AND (${generationTasks.assetId} = ${assets.id} OR ${generationTasks.id} = ${assets.id})
    )`,
    sql`NOT EXISTS (
      SELECT 1 FROM ${products}
      WHERE ${products.ownerId} = ${assets.ownerId}
        AND ${products.sampleAssetId} = ${assets.id}
    )`,
  );
}
