import { and, desc, eq, sql } from 'drizzle-orm';
import { type Reel } from '../types';
import { type HighlightReelDb } from './client';
import { reels } from './schema';

export type StoredReel = typeof reels.$inferSelect;

export function insertReel(
  db: HighlightReelDb,
  recordingId: string,
  reel: Reel,
  createdAt: Date = new Date(),
): StoredReel {
  return db
    .insert(reels)
    .values({
      id: crypto.randomUUID(),
      recordingId,
      createdAt,
      reel,
    })
    .returning()
    .get();
}

export function findReel(
  db: HighlightReelDb,
  reelId: string,
): StoredReel | undefined {
  return db.select().from(reels).where(eq(reels.id, reelId)).get();
}

export function findLatestReelForRecording(
  db: HighlightReelDb,
  recordingId: string,
): StoredReel | undefined {
  return db
    .select()
    .from(reels)
    .where(eq(reels.recordingId, recordingId))
    .orderBy(desc(reels.createdAt), desc(reels.seq))
    .limit(1)
    .get();
}

export function saveReel(
  db: HighlightReelDb,
  reelId: string,
  expectedVersion: number,
  reel: Reel,
): StoredReel | undefined {
  return db
    .update(reels)
    .set({ reel, version: sql`${reels.version} + 1` })
    .where(and(eq(reels.id, reelId), eq(reels.version, expectedVersion)))
    .returning()
    .get();
}
