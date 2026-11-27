import { describe, expect, it } from '@jest/globals';
import {
  approve,
  buildReelFromRawMoments,
  isShareable,
  ReviewError,
} from '../highlightReel';
import { clip } from '../fixtures/builders';
import * as seedGame from '../fixtures/seedGame';
import {
  PlayType,
  type Clip,
  type Reel,
  type ReviewErrorReason,
} from '../types';

function reelOf(clips: Clip[]): Reel {
  return { clips, candidates: [], rejected: [], capMs: 60_000 };
}

const approvedGoal = clip('clip-0', PlayType.Goal, 0, 30_000, {
  status: 'approved',
});
const approvedSave = clip('clip-1', PlayType.Save, 100_000, 130_000, {
  status: 'approved',
});
const pendingSave = clip('clip-1', PlayType.Save, 100_000, 130_000);
const approvedSkillPastCap = clip('clip-2', PlayType.Skill, 200_000, 200_001, {
  status: 'approved',
});

describe('isShareable', () => {
  it('A newly built reel is not shareable', () => {
    expect(
      isShareable(
        buildReelFromRawMoments(seedGame.recording, seedGame.rawMoments),
      ),
    ).toBe(false);
  });

  it('An empty reel is not shareable', () => {
    expect(isShareable(reelOf([]))).toBe(false);
  });

  it('A reel of approved clips that fills the cap exactly is shareable', () => {
    expect(isShareable(reelOf([approvedGoal, approvedSave]))).toBe(true);
  });

  it('A reel with a pending clip is not shareable', () => {
    expect(isShareable(reelOf([approvedGoal, pendingSave]))).toBe(false);
  });

  it('A reel of approved clips over the cap is not shareable', () => {
    expect(
      isShareable(reelOf([approvedGoal, approvedSave, approvedSkillPastCap])),
    ).toBe(false);
  });
});

const pendingGoal = clip('clip-0', PlayType.Goal, 0, 20_000);
const rejectedBigPlay = clip('clip-1', PlayType.BigPlay, 100_000, 110_000, {
  status: 'rejected',
});
const approvedSkill = clip('clip-2', PlayType.Skill, 200_000, 210_000, {
  status: 'approved',
});
const candidateNearMiss = clip('clip-3', PlayType.NearMiss, 300_000, 310_000);
const pendingSaveLater = clip('clip-4', PlayType.Save, 400_000, 410_000);

const reelInReview: Reel = {
  clips: [pendingGoal, approvedSkill, pendingSaveLater],
  candidates: [candidateNearMiss],
  rejected: [rejectedBigPlay],
  capMs: 60_000,
};

function reviewErrorFrom(action: () => unknown): ReviewError {
  try {
    action();
  } catch (error) {
    if (error instanceof ReviewError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ReviewError, but nothing was thrown');
}

function expectReviewError(
  action: () => unknown,
  reason: ReviewErrorReason,
  clipId: string,
): void {
  const error = reviewErrorFrom(action);
  expect(error).toBeInstanceOf(RangeError);
  expect(error.name).toBe('ReviewError');
  expect(error.reason).toBe(reason);
  expect(error.message).toContain(clipId);
}

describe('approve', () => {
  it('Approving a pending clip sets only that clip to approved and leaves the rest of the reel as it was', () => {
    expect(approve(reelInReview, 'clip-0')).toEqual({
      ...reelInReview,
      clips: [
        { ...pendingGoal, status: 'approved' },
        approvedSkill,
        pendingSaveLater,
      ],
    });
  });

  it('Approving the last pending clip makes the reel shareable', () => {
    const oneClipLeftToReview = approve(reelInReview, 'clip-0');
    expect(isShareable(oneClipLeftToReview)).toBe(false);
    expect(isShareable(approve(oneClipLeftToReview, 'clip-4'))).toBe(true);
  });

  it('Approving leaves the reel passed in unchanged', () => {
    const before = structuredClone(reelInReview);
    approve(reelInReview, 'clip-0');
    expect(reelInReview).toEqual(before);
  });

  it('Approving an id that does not exist throws unknown-id', () => {
    expectReviewError(
      () => approve(reelInReview, 'clip-99'),
      'unknown-id',
      'clip-99',
    );
  });

  it('Approving an id that was already rejected throws already-rejected', () => {
    expectReviewError(
      () => approve(reelInReview, 'clip-1'),
      'already-rejected',
      'clip-1',
    );
  });

  it('Approving a clip in the reel whose status is rejected throws already-rejected', () => {
    const rejectedInReel = clip('clip-5', PlayType.Goal, 0, 10_000, {
      status: 'rejected',
    });
    expectReviewError(
      () => approve(reelOf([rejectedInReel]), 'clip-5'),
      'already-rejected',
      'clip-5',
    );
  });

  it('Approving a candidate that is not in the reel throws not-in-reel', () => {
    expectReviewError(
      () => approve(reelInReview, 'clip-3'),
      'not-in-reel',
      'clip-3',
    );
  });

  it('Approving a clip that is already approved throws already-approved', () => {
    expectReviewError(
      () => approve(reelInReview, 'clip-2'),
      'already-approved',
      'clip-2',
    );
  });
});
