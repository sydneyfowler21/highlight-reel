import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { type Reel } from '../types';

export const recordings = sqliteTable('recordings', {
  id: text('id').primaryKey(),
  durationMs: integer('duration_ms').notNull(),
});

export const reels = sqliteTable(
  'reels',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    id: text('id').notNull().unique(),
    recordingId: text('recording_id')
      .notNull()
      .references(() => recordings.id),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    reel: text('reel', { mode: 'json' }).$type<Reel>().notNull(),
  },
  (table) => [
    index('reels_recording_id_created_at_idx').on(
      table.recordingId,
      table.createdAt,
    ),
  ],
);
