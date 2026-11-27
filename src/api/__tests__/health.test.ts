import { describe, expect, it } from '@jest/globals';
import { createApp } from '../app';
import { applyMigrations, createDb } from '../../db/client';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const db = createDb(':memory:');
    applyMigrations(db);
    const app = createApp(db);

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it.each([
    ['GET', '/no-such-route'],
    ['POST', '/reels/some-reel/clips/clip-0/archive'],
  ])(
    'answers %s %s with a JSON 404 and reason route-not-found',
    async (method, path) => {
      const db = createDb(':memory:');
      applyMigrations(db);

      const response = await createApp(db).request(path, { method });

      expect(response.status).toBe(404);
      expect(response.headers.get('ETag')).toBeNull();
      expect(await response.json()).toEqual({
        reason: 'route-not-found',
        message: `No route for ${method} ${path}`,
      });
    },
  );
});
