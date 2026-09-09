import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  sampleAssetId: text('sample_asset_id'),
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
  specsJson: text('specs_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('jobs_product_idx').on(table.productId)]);

export const hiddenOptions = sqliteTable('hidden_options', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  kind: text('kind').notNull(),
  optionId: text('option_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('hidden_options_owner_kind_idx').on(table.ownerId, table.kind)]);

export const runningHubCredentials = sqliteTable('runninghub_credentials', {
  ownerId: text('owner_id').primaryKey(),
  encryptedKey: text('encrypted_key').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const memberAppPreferences = sqliteTable('member_app_preferences', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  modelId: text('model_id').notNull(),
  setupJson: text('setup_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [uniqueIndex('member_app_preferences_owner_model_idx').on(table.ownerId, table.modelId)]);

export const generationTasks = sqliteTable('generation_tasks', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  remoteTaskId: text('remote_task_id'),
  name: text('name').notNull(),
  status: text('status').notNull().default('uploading'),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  recipeJson: text('recipe_json'),
  aspectRatio: text('aspect_ratio').notNull(),
  resolution: text('resolution').notNull(),
  colorName: text('color_name').notNull(),
  assetId: text('asset_id'),
  error: text('error').notNull().default(''),
  lastPolledAt: integer('last_polled_at').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('generation_tasks_owner_created_idx').on(table.ownerId, table.createdAt),
  uniqueIndex('generation_tasks_owner_active_idx').on(table.ownerId).where(sql`${table.status} IN ('uploading','submitting','queued','running','saving','unknown')`),
]);
