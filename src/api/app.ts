import { Hono } from 'hono';
import { type HighlightReelDb } from '../db/client';
import { findReel } from '../db/reels';
import { etagFor, reelResponse } from './reelResponse';

type ApiEnv = {
  Variables: {
    db: HighlightReelDb;
  };
};

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
  return app;
}
