import { describe, expect, it } from '@jest/globals';
import { approve } from '../../highlightReel';
import { applyMigrations, createDb } from '../client';
import { findReel, insertReel, saveReel } from '../reels';
import { recordings } from '../schema';
import * as seedGame from '../../fixtures/seedGame';

function dbWithSeedReel() {
  const db = createDb(':memory:');
  applyMigrations(db);
  db.insert(recordings).values(seedGame.recording).run();
  const stored = insertReel(db, seedGame.recording.id, seedGame.expectedReel);
  return { db, stored };
}

const approvedFirstClip = approve(seedGame.expectedReel, 'clip-0');

describe('saveReel', () => {
  it('saves the reel and adds 1 to the version when the expected version matches', () => {
    const { db, stored } = dbWithSeedReel();

    const saved = saveReel(db, stored.id, 1, approvedFirstClip);

    expect(saved).toMatchObject({ version: 2, reel: approvedFirstClip });
    expect(findReel(db, stored.id)).toEqual(saved);
  });

  it('changes nothing and returns undefined when the expected version is stale', () => {
    const { db, stored } = dbWithSeedReel();

    const saved = saveReel(db, stored.id, 0, approvedFirstClip);

    expect(saved).toBeUndefined();
    expect(findReel(db, stored.id)).toEqual(stored);
  });

  it('changes nothing and returns undefined when the expected version is ahead of the stored one', () => {
    const { db, stored } = dbWithSeedReel();

    const saved = saveReel(db, stored.id, 2, approvedFirstClip);

    expect(saved).toBeUndefined();
    expect(findReel(db, stored.id)).toEqual(stored);
  });

  it('adds 1 to the version on each save in a row', () => {
    const { db, stored } = dbWithSeedReel();
    const approvedTwoClips = approve(approvedFirstClip, 'clip-1');

    saveReel(db, stored.id, 1, approvedFirstClip);
    const secondSave = saveReel(db, stored.id, 2, approvedTwoClips);

    expect(secondSave).toMatchObject({ version: 3, reel: approvedTwoClips });
  });

  it('lets only the first of two saves from the same version succeed', () => {
    const { db, stored } = dbWithSeedReel();
    const approvedSecondClip = approve(seedGame.expectedReel, 'clip-1');

    const first = saveReel(db, stored.id, 1, approvedFirstClip);
    const second = saveReel(db, stored.id, 1, approvedSecondClip);

    expect(first).toMatchObject({ version: 2 });
    expect(second).toBeUndefined();
    expect(findReel(db, stored.id)).toMatchObject({
      version: 2,
      reel: approvedFirstClip,
    });
  });

  it('changes nothing and returns undefined for an unknown reel id', () => {
    const { db, stored } = dbWithSeedReel();

    expect(saveReel(db, 'no-such-reel', 1, approvedFirstClip)).toBeUndefined();
    expect(findReel(db, stored.id)).toEqual(stored);
  });

  it('changes only the reel it names', () => {
    const { db, stored } = dbWithSeedReel();
    const other = insertReel(db, seedGame.recording.id, seedGame.expectedReel);

    saveReel(db, stored.id, 1, approvedFirstClip);

    expect(findReel(db, other.id)).toEqual(other);
  });
});
