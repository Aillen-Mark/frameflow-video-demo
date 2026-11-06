import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const videoConfigs = sqliteTable('video_configs', {
  userId: text('user_id').notNull(), provider: text('provider').notNull(),
  config: text('config').notNull(), credentials: text('credentials').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({columns:[t.userId,t.provider]})]);
export const videoTasks = sqliteTable('video_tasks', {
  id:text('id').primaryKey(), userId:text('user_id').notNull(), provider:text('provider').notNull(),
  requestId:text('request_id').notNull(), inputHash:text('input_hash').notNull(),
  externalId:text('external_id'), status:text('status').notNull(),
  config:text('config').notNull(), credentials:text('credentials').notNull(),
  title:text('title').notNull(), prompt:text('prompt').notNull(), duration:integer('duration').notNull(),
  aspect:text('aspect').notNull(), videoUrl:text('video_url'), error:text('error'),
  createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(),
}, t => [uniqueIndex('video_tasks_user_request').on(t.userId,t.requestId)]);
