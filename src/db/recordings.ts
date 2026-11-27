import { eq } from 'drizzle-orm';
import { type Recording } from '../types';
import { type HighlightReelDb } from './client';
import { recordings } from './schema';

export function findRecording(
  db: HighlightReelDb,
  recordingId: string,
): Recording | undefined {
  return db
    .select()
    .from(recordings)
    .where(eq(recordings.id, recordingId))
    .get();
}
