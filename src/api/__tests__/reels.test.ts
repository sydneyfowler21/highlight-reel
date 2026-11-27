import { describe, expect, it } from '@jest/globals';
import { createApp } from '../app';
import { applyMigrations, createDb } from '../../db/client';
import { insertReel } from '../../db/reels';
import { recordings, reels } from '../../db/schema';
import { approved, clip } from '../../fixtures/builders';
import * as seedGame from '../../fixtures/seedGame';
import { PlayType, type Reel } from '../../types';

function seededDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  db.insert(recordings).values(seedGame.recording).run();
  return db;
}

const allApprovedReel: Reel = {
  clips: [approved(clip('clip-0', PlayType.Goal, 0, 20_000))],
  candidates: [],
  rejected: [],
  capMs: 60_000,
};

describe('GET /reels/:reelId', () => {
  it('returns the stored reel with its id, recording id, and shareable, and its version as the ETag', async () => {
    const db = seededDb();
    const stored = insertReel(db, seedGame.recording.id, seedGame.expectedReel);

    const response = await createApp(db).request(`/reels/${stored.id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"1"');
    expect(await response.json()).toEqual({
      id: stored.id,
      recordingId: seedGame.recording.id,
      shareable: false,
      ...seedGame.expectedReel,
    });
  });

  it('works out shareable from the stored clips when the reel is read', async () => {
    const db = seededDb();
    const stored = insertReel(db, seedGame.recording.id, allApprovedReel);

    const response = await createApp(db).request(`/reels/${stored.id}`);

    expect(await response.json()).toMatchObject({ shareable: true });
  });

  it('sends the stored version, not a fixed one, as the ETag', async () => {
    const db = seededDb();
    const stored = insertReel(db, seedGame.recording.id, seedGame.expectedReel);
    db.update(reels).set({ version: 3 }).run();

    const response = await createApp(db).request(`/reels/${stored.id}`);

    expect(response.headers.get('ETag')).toBe('"3"');
  });

  it('returns 404 with reason reel-not-found and no reel for an unknown id', async () => {
    const db = seededDb();
    insertReel(db, seedGame.recording.id, seedGame.expectedReel);

    const response = await createApp(db).request('/reels/no-such-reel');

    expect(response.status).toBe(404);
    expect(response.headers.get('ETag')).toBeNull();
    expect(await response.json()).toEqual({
      reason: 'reel-not-found',
      message: 'No reel with id no-such-reel',
    });
  });
});
