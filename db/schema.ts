import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('未分类'),
  tags: text('tags').notNull().default(''),
  tone: text('tone').notNull().default(''),
  mimeType: text('mime_type').notNull(),
  objectKey: text('object_key').notNull(),
  size: integer('size').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('assets_owner_created_idx').on(table.ownerId, table.createdAt)]);

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  artworkId: text('artwork_id').notNull(),
  artworkName: text('artwork_name').notNull(),
  frameId: text('frame_id').notNull(),
  frameName: text('frame_name').notNull(),
  status: text('status').notNull().default('sample_pending'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('products_owner_created_idx').on(table.ownerId, table.createdAt)]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  productId: text('product_id').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('waiting_for_sample'),
  version: text('version').notNull().default('v1'),
  outputCount: integer('output_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('jobs_product_idx').on(table.productId)]);
