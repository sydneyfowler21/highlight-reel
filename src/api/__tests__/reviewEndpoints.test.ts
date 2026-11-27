import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../app';
import { approve, reject } from '../../highlightReel';
import { applyMigrations, createDb } from '../../db/client';
import * as reelStore from '../../db/reels';
import { reviewClip } from '../reviewClip';
import { recordings } from '../../db/schema';
import * as seedGame from '../../fixtures/seedGame';
import { type Reel } from '../../types';

function dbWithReel(reel: Reel = seedGame.expectedReel) {
  const db = createDb(':memory:');
  applyMigrations(db);
  db.insert(recordings).values(seedGame.recording).run();
  const stored = reelStore.insertReel(db, seedGame.recording.id, reel);
  return { db, stored };
}

function reviewRequest(
  db: ReturnType<typeof createDb>,
  endpoint: 'approve' | 'reject',
  reelId: string,
  clipId: string,
  ifMatch?: string,
) {
  return createApp(db).request(`/reels/${reelId}/clips/${clipId}/${endpoint}`, {
    method: 'POST',
    headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
  });
}

const reviewEndpoints: { endpoint: 'approve' | 'reject' }[] = [
  { endpoint: 'approve' },
  { endpoint: 'reject' },
];

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /reels/:reelId/clips/:clipId/approve', () => {
  it('approves the clip, saves the next version, and returns the new reel with its ETag', async () => {
    const { db, stored } = dbWithReel();

    const response = await reviewRequest(
      db,
      'approve',
      stored.id,
      'clip-0',
      '"1"',
    );

    const approvedReel = approve(seedGame.expectedReel, 'clip-0');
    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"2"');
    expect(await response.json()).toEqual({
      id: stored.id,
      recordingId: seedGame.recording.id,
      shareable: false,
      ...approvedReel,
    });
    expect(reelStore.findReel(db, stored.id)).toMatchObject({
      version: 2,
      reel: approvedReel,
    });
  });
});

describe('POST /reels/:reelId/clips/:clipId/reject', () => {
  it('rejects the clip, backfills the leftover time, saves the next version, and returns the new reel with its ETag', async () => {
    const { db, stored } = dbWithReel();

    const response = await reviewRequest(
      db,
      'reject',
      stored.id,
      'clip-0',
      '"1"',
    );

    const rejectedReel = reject(seedGame.expectedReel, 'clip-0');
    expect(rejectedReel.clips.map((clip) => clip.id)).toContain('clip-8');
    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe('"2"');
    expect(await response.json()).toEqual({
      id: stored.id,
      recordingId: seedGame.recording.id,
      shareable: false,
      ...rejectedReel,
    });
    expect(reelStore.findReel(db, stored.id)).toMatchObject({
      version: 2,
      reel: rejectedReel,
    });
  });
});

describe.each(reviewEndpoints)(
  'POST /reels/:reelId/clips/:clipId/$endpoint',
  ({ endpoint }) => {
    it('returns 428 with reason if-match-required and no reel when If-Match is missing', async () => {
      const { db, stored } = dbWithReel();

      const response = await reviewRequest(db, endpoint, stored.id, 'clip-0');

      expect(response.status).toBe(428);
      expect(response.headers.get('ETag')).toBeNull();
      expect(await response.json()).toEqual({
        reason: 'if-match-required',
        message: "Send the reel's ETag in an If-Match header",
      });
      expect(reelStore.findReel(db, stored.id)).toEqual(stored);
    });

    it('checks for If-Match before looking up the reel', async () => {
      const { db } = dbWithReel();

      const response = await reviewRequest(
        db,
        endpoint,
        'no-such-reel',
        'clip-0',
      );

      expect(response.status).toBe(428);
    });

    it('returns 404 with reason reel-not-found and no reel for an unknown reel id', async () => {
      const { db } = dbWithReel();

      const response = await reviewRequest(
        db,
        endpoint,
        'no-such-reel',
        'clip-0',
        '"1"',
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('ETag')).toBeNull();
      expect(await response.json()).toEqual({
        reason: 'reel-not-found',
        message: 'No reel with id no-such-reel',
      });
    });

    it('returns 412 with reason stale-version and the current reel when If-Match is not the stored version', async () => {
      const { db, stored } = dbWithReel();
      const current = reelStore.saveReel(
        db,
        stored.id,
        1,
        approve(seedGame.expectedReel, 'clip-1'),
      );

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-0',
        '"1"',
      );

      expect(response.status).toBe(412);
      expect(response.headers.get('ETag')).toBe('"2"');
      expect(await response.json()).toMatchObject({
        reason: 'stale-version',
        reel: { id: stored.id, ...current?.reel },
      });
      expect(reelStore.findReel(db, stored.id)).toEqual(current);
    });

    it.each(['1', 'W/"1"', '"01"', '*', '"1", "2"', 'not-a-version'])(
      'returns 412 for an If-Match of %s, which is not the quoted stored version',
      async (ifMatch) => {
        const { db, stored } = dbWithReel();

        const response = await reviewRequest(
          db,
          endpoint,
          stored.id,
          'clip-0',
          ifMatch,
        );

        expect(response.status).toBe(412);
        expect(reelStore.findReel(db, stored.id)).toEqual(stored);
      },
    );

    it('returns 412, not 409, when a stale If-Match names a clip that has since been approved', async () => {
      const { db, stored } = dbWithReel();
      reelStore.saveReel(
        db,
        stored.id,
        1,
        approve(seedGame.expectedReel, 'clip-0'),
      );

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-0',
        '"1"',
      );

      expect(response.status).toBe(412);
      expect(await response.json()).toMatchObject({ reason: 'stale-version' });
    });

    it('returns 404 with reason unknown-id and the current reel for a clip id the reel does not have', async () => {
      const { db, stored } = dbWithReel();

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-99',
        '"1"',
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('ETag')).toBe('"1"');
      expect(await response.json()).toEqual({
        reason: 'unknown-id',
        message: 'No clip with id clip-99 in this reel',
        reel: reelResponseFor(stored),
      });
    });

    it.each([
      { clipId: 'clip-1', reason: 'already-approved' },
      { clipId: 'clip-0', reason: 'already-rejected' },
      { clipId: 'clip-4', reason: 'not-in-reel' },
    ])(
      'returns 409 with reason $reason and the current reel',
      async ({ clipId, reason }) => {
        const reviewedReel = approve(
          reject(seedGame.expectedReel, 'clip-0'),
          'clip-1',
        );
        const { db, stored } = dbWithReel(reviewedReel);

        const response = await reviewRequest(
          db,
          endpoint,
          stored.id,
          clipId,
          '"1"',
        );

        expect(response.status).toBe(409);
        expect(response.headers.get('ETag')).toBe('"1"');
        expect(await response.json()).toMatchObject({
          reason,
          message: expect.stringContaining(clipId),
          reel: reelResponseFor(stored),
        });
        expect(reelStore.findReel(db, stored.id)).toEqual(stored);
      },
    );

    it('returns 412 with the reel read again when another save lands between the version check and this save', async () => {
      const { db, stored } = dbWithReel();
      const findReel = reelStore.findReel;
      const otherReview = approve(seedGame.expectedReel, 'clip-1');
      jest.spyOn(reelStore, 'findReel').mockImplementationOnce((...args) => {
        const readBeforeOtherSave = findReel(...args);
        reelStore.saveReel(db, stored.id, 1, otherReview);
        return readBeforeOtherSave;
      });

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-0',
        '"1"',
      );

      expect(response.status).toBe(412);
      expect(response.headers.get('ETag')).toBe('"2"');
      expect(await response.json()).toMatchObject({
        reason: 'stale-version',
        reel: { id: stored.id, ...otherReview },
      });
      expect(findReel(db, stored.id)).toMatchObject({
        version: 2,
        reel: otherReview,
      });
    });

    it('answers 500 and saves nothing when a stored clip has a status review does not handle', async () => {
      const { db, stored } = dbWithReel();
      db.$client
        .prepare(
          "UPDATE reels SET reel = json_set(reel, '$.clips[0].status', 'bogus') WHERE id = ?",
        )
        .run(stored.id);
      const storedWithBogusStatus = reelStore.findReel(db, stored.id);
      const serverLog = silencedServerLog();

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-0',
        '"1"',
      );

      await expectInternalError(response);
      expect(serverLog).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('status review does not handle'),
        }),
      );
      expect(reelStore.findReel(db, stored.id)).toEqual(storedWithBogusStatus);
    });

    it('answers 500 through the route when an error that is not a ReviewError escapes', async () => {
      const { db, stored } = dbWithReel();
      const databaseError = new Error('the database is gone');
      jest.spyOn(reelStore, 'saveReel').mockImplementationOnce(() => {
        throw databaseError;
      });
      const serverLog = silencedServerLog();

      const response = await reviewRequest(
        db,
        endpoint,
        stored.id,
        'clip-0',
        '"1"',
      );

      await expectInternalError(response);
      expect(serverLog).toHaveBeenCalledWith(databaseError);
    });
  },
);

describe('reviewClip', () => {
  it('lets an error that is not a ReviewError escape instead of turning it into a response', () => {
    const { db, stored } = dbWithReel();
    const failingAction = () => {
      throw new Error('a bug in the review action');
    };

    expect(() =>
      reviewClip(db, stored.id, 'clip-0', '"1"', failingAction),
    ).toThrow('a bug in the review action');
    expect(reelStore.findReel(db, stored.id)).toEqual(stored);
  });
});

function silencedServerLog() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}

async function expectInternalError(response: Response) {
  expect(response.status).toBe(500);
  expect(response.headers.get('ETag')).toBeNull();
  expect(await response.json()).toEqual({
    reason: 'internal-error',
    message: 'Something went wrong on the server',
  });
}

function reelResponseFor(stored: reelStore.StoredReel) {
  return {
    id: stored.id,
    recordingId: stored.recordingId,
    shareable: false,
    ...stored.reel,
  };
}
