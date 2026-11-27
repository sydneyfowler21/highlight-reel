import { Hono } from 'hono';
import { type HighlightReelDb } from '../db/client';

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
  return app;
}
