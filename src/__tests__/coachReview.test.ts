import { describe, expect, it } from '@jest/globals';
import {
  approve,
  buildReelFromRawMoments,
  isShareable,
  reject,
  ReviewError,
} from '../highlightReel';
import { approved, clip, rejected } from '../fixtures/builders';
import * as seedGame from '../fixtures/seedGame';
import {
  PlayType,
  type ReelClip,
  type Reel,
  type ReviewErrorReason,
} from '../types';

function reelOf(clips: ReelClip[]): Reel {
  return { clips, candidates: [], rejected: [], capMs: 60_000 };
}

const approvedGoal = approved(clip('clip-0', PlayType.Goal, 0, 30_000));
const approvedSave = approved(clip('clip-1', PlayType.Save, 100_000, 130_000));
const pendingSave = clip('clip-1', PlayType.Save, 100_000, 130_000);
const approvedSkillPastCap = approved(
  clip('clip-2', PlayType.Skill, 200_000, 200_001),
);

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
const rejectedBigPlay = rejected(
  clip('clip-1', PlayType.BigPlay, 100_000, 110_000),
);
const approvedSkill = approved(
  clip('clip-2', PlayType.Skill, 200_000, 210_000),
);
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

function idsOf(clips: ReelClip[] | Reel['rejected']): string[] {
  return clips.map((clip) => clip.id);
}

describe.each([
  { action: 'Approving', review: approve },
  { action: 'Rejecting', review: reject },
])('$action', ({ action, review }) => {
  it(`${action} leaves the reel passed in unchanged`, () => {
    const before = structuredClone(reelInReview);
    review(reelInReview, 'clip-0');
    expect(reelInReview).toEqual(before);
  });

  it(`${action} an id that does not exist throws unknown-id`, () => {
    expectReviewError(
      () => review(reelInReview, 'clip-99'),
      'unknown-id',
      'clip-99',
    );
  });

  it(`${action} an id that was already rejected throws already-rejected`, () => {
    expectReviewError(
      () => review(reelInReview, 'clip-1'),
      'already-rejected',
      'clip-1',
    );
  });

  it(`${action} a candidate that is not in the reel throws not-in-reel`, () => {
    expectReviewError(
      () => review(reelInReview, 'clip-3'),
      'not-in-reel',
      'clip-3',
    );
  });

  it(`${action} a clip that is already approved throws already-approved`, () => {
    expectReviewError(
      () => review(reelInReview, 'clip-2'),
      'already-approved',
      'clip-2',
    );
  });
});

describe('approve', () => {
  it('Approving a pending clip sets only that clip to approved and leaves the rest of the reel as it was', () => {
    expect(approve(reelInReview, 'clip-0')).toEqual({
      ...reelInReview,
      clips: [approved(pendingGoal), approvedSkill, pendingSaveLater],
    });
  });

  it('Approving the last pending clip makes the reel shareable', () => {
    const oneClipLeftToReview = approve(reelInReview, 'clip-0');
    expect(isShareable(oneClipLeftToReview)).toBe(false);
    expect(isShareable(approve(oneClipLeftToReview, 'clip-4'))).toBe(true);
  });
});

const backfillApprovedGoal = approved(clip('clip-0', PlayType.Goal, 0, 20_000));
const backfillBigPlay = clip('clip-1', PlayType.BigPlay, 100_000, 125_000);
const backfillPendingSkill = clip('clip-2', PlayType.Skill, 200_000, 210_000);
const nearMissOverlappingSkill = clip(
  'clip-3',
  PlayType.NearMiss,
  205_000,
  215_000,
);
const lateSaveToReject = clip('clip-4', PlayType.Save, 500_000, 530_000);
const saveTooLongForLeftover = clip('clip-5', PlayType.Save, 550_000, 590_000);

const reelReadyForBackfill: Reel = {
  clips: [backfillApprovedGoal, backfillPendingSkill, lateSaveToReject],
  candidates: [
    saveTooLongForLeftover,
    backfillBigPlay,
    nearMissOverlappingSkill,
  ],
  rejected: [],
  capMs: 60_000,
};

const reelApprovedExceptLateSave: Reel = {
  ...reelReadyForBackfill,
  clips: [
    backfillApprovedGoal,
    approved(backfillPendingSkill),
    lateSaveToReject,
  ],
};

describe('reject', () => {
  it('Rejecting the only clip with no candidate to backfill leaves an empty reel that is not shareable', () => {
    const rejectedOnlyClip = reject(reelOf([pendingGoal]), 'clip-0');
    expect(rejectedOnlyClip.clips).toEqual([]);
    expect(isShareable(rejectedOnlyClip)).toBe(false);
  });

  it('Rejecting a clip when no candidate fits leaves a shorter reel that is shareable when every clip left is approved', () => {
    const noCandidateFits: Reel = {
      ...reelOf([approvedGoal, pendingSave]),
      candidates: [clip('clip-2', PlayType.Skill, 300_000, 340_000)],
    };
    const afterReject = reject(noCandidateFits, 'clip-1');
    expect(afterReject.clips).toEqual([approvedGoal]);
    expect(isShareable(afterReject)).toBe(true);
  });

  it('Rejecting a clip in an otherwise all-approved reel where a backfill fits leaves the reel not shareable', () => {
    const afterReject = reject(reelApprovedExceptLateSave, 'clip-4');
    expect(idsOf(afterReject.clips)).toContain('clip-1');
    expect(isShareable(afterReject)).toBe(false);
  });

  it('A rejected clip is in the rejected list with a rejected status and is not backfilled into its own leftover time', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    expect(afterReject.rejected).toEqual([rejected(lateSaveToReject)]);
    expect(idsOf(afterReject.clips)).not.toContain('clip-4');
  });

  it('Rejecting adds the clip to the end of the rejected list and keeps the clips rejected before it', () => {
    const earlierRejected = rejected(
      clip('clip-6', PlayType.Skill, 400_000, 405_000),
    );
    const afterReject = reject(
      { ...reelReadyForBackfill, rejected: [earlierRejected] },
      'clip-4',
    );
    expect(afterReject.rejected).toEqual([
      earlierRejected,
      rejected(lateSaveToReject),
    ]);
  });

  it("Backfill uses the reel's own cap and takes a candidate that fills the leftover time exactly", () => {
    const goalThatFitsOnlyUnder60s = clip(
      'clip-2',
      PlayType.Goal,
      100_000,
      126_000,
    );
    const saveThatFillsLeftoverExactly = clip(
      'clip-3',
      PlayType.Save,
      200_000,
      225_000,
    );
    const reelWith45sCap: Reel = {
      clips: [
        backfillApprovedGoal,
        clip('clip-1', PlayType.Skill, 50_000, 75_000),
      ],
      candidates: [goalThatFitsOnlyUnder60s, saveThatFillsLeftoverExactly],
      rejected: [],
      capMs: 45_000,
    };
    const afterReject = reject(reelWith45sCap, 'clip-1');
    expect(afterReject.clips).toEqual([
      backfillApprovedGoal,
      saveThatFillsLeftoverExactly,
    ]);
    expect(afterReject.candidates).toEqual([goalThatFitsOnlyUnder60s]);
    expect(afterReject.capMs).toBe(45_000);
  });

  it('After a reject the candidates come back in fill order: play type first, then higher confidence', () => {
    const lowSave = clip('clip-5', PlayType.Save, 300_000, 370_000, {
      confidence: 0.5,
    });
    const highSave = clip('clip-6', PlayType.Save, 400_000, 470_000);
    const bigPlay = clip('clip-7', PlayType.BigPlay, 500_000, 570_000, {
      confidence: 0.8,
    });
    const skill = clip('clip-3', PlayType.Skill, 200_000, 270_000, {
      confidence: 0.6,
    });
    const nearMiss = clip('clip-1', PlayType.NearMiss, 100_000, 170_000);
    const reelWithUnsortedCandidates: Reel = {
      clips: [clip('clip-0', PlayType.Skill, 0, 50_000)],
      candidates: [nearMiss, skill, lowSave, highSave, bigPlay],
      rejected: [],
      capMs: 60_000,
    };

    const afterReject = reject(reelWithUnsortedCandidates, 'clip-0');

    expect(afterReject.clips).toEqual([]);
    expect(idsOf(afterReject.candidates)).toEqual([
      'clip-6',
      'clip-5',
      'clip-7',
      'clip-3',
      'clip-1',
    ]);
  });

  it('After a backfill neither the rejected clip nor the backfilled clip is a candidate', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    expect(idsOf(afterReject.candidates)).not.toContain('clip-4');
    expect(idsOf(afterReject.candidates)).not.toContain('clip-1');
  });

  it('After a reject with backfill every id is in exactly one of clips, candidates, or rejected', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    const allIds = [
      ...idsOf(afterReject.clips),
      ...idsOf(afterReject.candidates),
      ...idsOf(afterReject.rejected),
    ];
    expect(allIds.sort()).toEqual([
      'clip-0',
      'clip-1',
      'clip-2',
      'clip-3',
      'clip-4',
      'clip-5',
    ]);
  });

  it('Backfill leaves an approved clip as it was, and the backfilled clip keeps its built id and starts pending', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    expect(afterReject.clips).toContainEqual(backfillApprovedGoal);
    expect(afterReject.clips).toContainEqual(backfillBigPlay);
  });

  it('A backfill earlier in the game than the clips already in the reel keeps the reel sorted by start time', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    expect(idsOf(afterReject.clips)).toEqual(['clip-0', 'clip-1', 'clip-2']);
  });

  it('Backfill skips a candidate that overlaps a pending clip and one that does not fit the leftover time', () => {
    const afterReject = reject(reelReadyForBackfill, 'clip-4');
    expect(idsOf(afterReject.candidates)).toEqual(['clip-5', 'clip-3']);
  });

  it('Rejecting a late clip lets an earlier candidate backfill, and the reel is shareable only once the backfilled clip is approved', () => {
    const afterReject = reject(reelApprovedExceptLateSave, 'clip-4');
    expect(afterReject.clips).toEqual([
      backfillApprovedGoal,
      backfillBigPlay,
      approved(backfillPendingSkill),
    ]);
    expect(isShareable(afterReject)).toBe(false);
    expect(isShareable(approve(afterReject, 'clip-1'))).toBe(true);
  });
});
