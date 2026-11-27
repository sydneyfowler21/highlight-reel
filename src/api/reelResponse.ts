import { isShareable } from '../highlightReel';
import { type StoredReel } from '../db/reels';

export type ReelResponse = ReturnType<typeof reelResponse>;

export function reelResponse(stored: StoredReel) {
  return {
    id: stored.id,
    recordingId: stored.recordingId,
    shareable: isShareable(stored.reel),
    clips: stored.reel.clips,
    candidates: stored.reel.candidates,
    rejected: stored.reel.rejected,
    capMs: stored.reel.capMs,
  };
}

export function etagFor(stored: StoredReel): string {
  return `"${stored.version}"`;
}
