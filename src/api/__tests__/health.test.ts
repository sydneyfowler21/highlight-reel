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
