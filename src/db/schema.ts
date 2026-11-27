import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { type Reel } from '../types';

export const recordings = sqliteTable('recordings', {
  id: text('id').primaryKey(),
  durationMs: integer('duration_ms').notNull(),
});

export const reels = sqliteTable('reels', {
  id: text('id').primaryKey(),
  recordingId: text('recording_id')
    .notNull()
    .references(() => recordings.id),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  reel: text('reel', { mode: 'json' }).$type<Reel>().notNull(),
});
