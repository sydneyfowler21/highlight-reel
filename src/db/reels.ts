import { eq } from 'drizzle-orm';
import { type Reel } from '../types';
import { type HighlightReelDb } from './client';
import { reels } from './schema';

export type StoredReel = typeof reels.$inferSelect;

export function insertReel(
  db: HighlightReelDb,
  recordingId: string,
  reel: Reel,
): StoredReel {
  return db
    .insert(reels)
    .values({
      id: crypto.randomUUID(),
      recordingId,
      createdAt: new Date(),
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
