import { describe, expect, it } from '@jest/globals';
import { createApp } from '../app';
import { applyMigrations, createDb } from '../../db/client';
import { insertReel } from '../../db/reels';
import { eq } from 'drizzle-orm';
import { recordings, reels } from '../../db/schema';
import { approved, clip, rejected } from '../../fixtures/builders';
import * as seedGame from '../../fixtures/seedGame';
import { PlayType, type Reel } from '../../types';

function seededDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  db.insert(recordings).values(seedGame.recording).run();
  return db;
}

const reviewedReelWith45sCap: Reel = {
  clips: [approved(clip('clip-0', PlayType.Goal, 0, 20_000))],
  candidates: [clip('clip-2', PlayType.Save, 300_000, 340_000)],
  rejected: [rejected(clip('clip-1', PlayType.Skill, 100_000, 110_000))],
  capMs: 45_000,
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

  it('returns a reviewed reel with every list and its cap as stored, and works out shareable on read', async () => {
    const db = seededDb();
    const stored = insertReel(
      db,
      seedGame.recording.id,
      reviewedReelWith45sCap,
    );

    const response = await createApp(db).request(`/reels/${stored.id}`);

    expect(await response.json()).toEqual({
      id: stored.id,
      recordingId: seedGame.recording.id,
      shareable: true,
      ...reviewedReelWith45sCap,
    });
  });

  it('sends the stored version, not a fixed one, as the ETag', async () => {
    const db = seededDb();
    const stored = insertReel(db, seedGame.recording.id, seedGame.expectedReel);
    db.update(reels).set({ version: 3 }).where(eq(reels.id, stored.id)).run();

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

describe('GET /recordings/:recordingId/reel', () => {
  const earlier = new Date('2026-11-01T10:00:00.000Z');
  const later = new Date('2026-11-01T10:05:00.000Z');

  it('returns the latest reel for the recording, with its version as the ETag', async () => {
    const db = seededDb();
    const latest = insertReel(
      db,
      seedGame.recording.id,
      reviewedReelWith45sCap,
      later,
    );
    insertReel(db, seedGame.recording.id, seedGame.expectedReel, earlier);

    const response = await createApp(db).request(
      `/recordings/${seedGame.recording.id}/reel`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"1"');
    expect(await response.json()).toEqual({
      id: latest.id,
      recordingId: seedGame.recording.id,
      shareable: true,
      ...reviewedReelWith45sCap,
    });
  });

  it('returns the reel inserted last when two reels share a created-at time', async () => {
    const db = seededDb();
    insertReel(db, seedGame.recording.id, seedGame.expectedReel, later);
    const insertedLast = insertReel(
      db,
      seedGame.recording.id,
      seedGame.expectedReel,
      later,
    );

    const response = await createApp(db).request(
      `/recordings/${seedGame.recording.id}/reel`,
    );

    expect(await response.json()).toMatchObject({ id: insertedLast.id });
  });

  it('ignores a newer reel that belongs to a different recording', async () => {
    const db = seededDb();
    db.insert(recordings).values({ id: 'rec-2', durationMs: 600_000 }).run();
    const ownReel = insertReel(
      db,
      seedGame.recording.id,
      seedGame.expectedReel,
      earlier,
    );
    insertReel(db, 'rec-2', seedGame.expectedReel, later);

    const response = await createApp(db).request(
      `/recordings/${seedGame.recording.id}/reel`,
    );

    expect(await response.json()).toMatchObject({ id: ownReel.id });
  });

  it('returns 404 with reason recording-not-found and no reel for an unknown recording', async () => {
    const db = seededDb();
    insertReel(db, seedGame.recording.id, seedGame.expectedReel);

    const response = await createApp(db).request(
      '/recordings/no-such-recording/reel',
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('ETag')).toBeNull();
    expect(await response.json()).toEqual({
      reason: 'recording-not-found',
      message: 'No recording with id no-such-recording',
    });
  });

  it('returns 404 with reason reel-not-found and no reel for a recording that has no reel', async () => {
    const db = seededDb();

    const response = await createApp(db).request(
      `/recordings/${seedGame.recording.id}/reel`,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('ETag')).toBeNull();
    expect(await response.json()).toEqual({
      reason: 'reel-not-found',
      message: `Recording ${seedGame.recording.id} has no reel`,
    });
  });
});
