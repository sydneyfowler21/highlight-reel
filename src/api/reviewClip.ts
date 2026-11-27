import { ReviewError, type Reel } from '../highlightReel';
import { type HighlightReelDb } from '../db/client';
import { findReel, saveReel, type StoredReel } from '../db/reels';
import { etagFor, reelResponse, type ReelResponse } from './reelResponse';

export type ReviewAction = (reel: Reel, clipId: string) => Reel;

type ErrorBody = {
  reason: string;
  message: string;
  reel?: ReelResponse;
};

type ErrorStatus = 404 | 409 | 412 | 428;

export type ReviewResult =
  | { status: 200; body: ReelResponse; etag: string }
  | { status: ErrorStatus; body: ErrorBody; etag?: string };

function errorWithReel(
  status: ErrorStatus,
  reason: string,
  message: string,
  stored: StoredReel,
): ReviewResult {
  return {
    status,
    body: { reason, message, reel: reelResponse(stored) },
    etag: etagFor(stored),
  };
}

function reelNotFound(reelId: string): ReviewResult {
  return {
    status: 404,
    body: { reason: 'reel-not-found', message: `No reel with id ${reelId}` },
  };
}

function reviewOrError(
  action: ReviewAction,
  reel: Reel,
  clipId: string,
): Reel | ReviewError {
  try {
    return action(reel, clipId);
  } catch (error) {
    if (error instanceof ReviewError) {
      return error;
    }
    throw error;
  }
}

export function reviewClip(
  db: HighlightReelDb,
  reelId: string,
  clipId: string,
  ifMatch: string | undefined,
  action: ReviewAction,
): ReviewResult {
  if (ifMatch === undefined || ifMatch.trim() === '') {
    return {
      status: 428,
      body: {
        reason: 'if-match-required',
        message: "Send the reel's ETag in an If-Match header",
      },
    };
  }
  const stored = findReel(db, reelId);
  if (!stored) {
    return reelNotFound(reelId);
  }
  if (ifMatch !== etagFor(stored)) {
    return errorWithReel(
      412,
      'stale-version',
      `Reel ${reelId} is at ${etagFor(stored)}, not ${ifMatch}`,
      stored,
    );
  }
  const reviewed = reviewOrError(action, stored.reel, clipId);
  if (reviewed instanceof ReviewError) {
    return errorWithReel(
      reviewed.reason === 'unknown-id' ? 404 : 409,
      reviewed.reason,
      reviewed.message,
      stored,
    );
  }
  const saved = saveReel(db, reelId, stored.version, reviewed);
  if (saved) {
    return { status: 200, body: reelResponse(saved), etag: etagFor(saved) };
  }
  const current = findReel(db, reelId);
  if (!current) {
    return reelNotFound(reelId);
  }
  return errorWithReel(
    412,
    'stale-version',
    `Reel ${reelId} changed while this review was being saved`,
    current,
  );
}
