import { describe, expect, it } from '@jest/globals';
import { buildReelFromRawMoments, isShareable } from '../highlightReel';
import { clip } from './builders';
import * as seedGame from './seedGame';
import { PlayType, type Clip, type Reel } from '../types';

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
