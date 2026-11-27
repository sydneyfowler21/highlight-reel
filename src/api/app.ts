import { Hono, type Context } from 'hono';
import { approve, reject } from '../highlightReel';
import { type HighlightReelDb } from '../db/client';
import { findLatestReelForRecording, findReel } from '../db/reels';
import { findRecording } from '../db/recordings';
import { etagFor, reelResponse } from './reelResponse';
import { reviewClip, type ReviewAction } from './reviewClip';

type ApiEnv = {
  Variables: {
    db: HighlightReelDb;
  };
};

function reviewRoute(action: ReviewAction) {
  return (c: Context<ApiEnv, '/reels/:reelId/clips/:clipId/*'>) => {
    const result = reviewClip(
      c.get('db'),
      c.req.param('reelId'),
      c.req.param('clipId'),
      c.req.header('If-Match'),
      action,
    );
    if (result.etag) {
      c.header('ETag', result.etag);
    }
    return c.json(result.body, result.status);
  };
}

export function createApp(db: HighlightReelDb) {
  const app = new Hono<ApiEnv>();
  app.use(async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/reels/:reelId', (c) => {
    const reelId = c.req.param('reelId');
    const stored = findReel(c.get('db'), reelId);
    if (!stored) {
      return c.json(
        { reason: 'reel-not-found', message: `No reel with id ${reelId}` },
        404,
      );
    }
    c.header('ETag', etagFor(stored));
    return c.json(reelResponse(stored));
  });
  app.get('/recordings/:recordingId/reel', (c) => {
    const recordingId = c.req.param('recordingId');
    if (!findRecording(c.get('db'), recordingId)) {
      return c.json(
        {
          reason: 'recording-not-found',
          message: `No recording with id ${recordingId}`,
        },
        404,
      );
    }
    const latest = findLatestReelForRecording(c.get('db'), recordingId);
    if (!latest) {
      return c.json(
        {
          reason: 'reel-not-found',
          message: `Recording ${recordingId} has no reel`,
        },
        404,
      );
    }
    c.header('ETag', etagFor(latest));
    return c.json(reelResponse(latest));
  });
  app.post('/reels/:reelId/clips/:clipId/approve', reviewRoute(approve));
  app.post('/reels/:reelId/clips/:clipId/reject', reviewRoute(reject));
  return app;
}
