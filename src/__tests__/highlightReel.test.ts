import { describe, expect, it } from '@jest/globals';
import {
  buildReel,
  convertToClips,
  filterRawMoments,
  mergeRawMoments,
  selectClips,
} from '../highlightReel';
import { clip, rawMoment } from './consts';
import * as consts from './consts';
import { PlayType, RawMoment } from '../types';

// Player order after a merge is unspecified, so compare players as sets.
function sortPlayers<T extends { players: string[] }>(items: T[]): T[] {
  return items.map((item) => ({ ...item, players: [...item.players].sort() }));
}

describe('filterRawMoments', () => {
  it('An empty input list yields an empty result', () => {
    expect(filterRawMoments(consts.recording10min, [])).toEqual([]);
  });

  it('A moment that ends before it starts is invalid and is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 200_000, 100_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment that ends at the same instant it starts is invalid and is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 200_000, 200_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with a play type that is not in the known set is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawMoment('foul' as any, 100_000, 200_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with a confidence score under 0 is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: -0.1 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with a confidence score over 1 is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1.1 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with confidence score 0 or 1 is valid', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 0 }),
      ]),
    ).toEqual([rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 0 })]);

    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1 }),
      ]),
    ).toEqual([rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1 })]);
  });

  it('A moment that belongs to a different recording is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { recordingId: 2 }),
      ]),
    ).toEqual([]);
  });

  it('A moment that starts at or after the recording ends is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 600_000, 605_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment that ends after the recording is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        rawMoment(PlayType.Goal, 598_000, 601_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment missing a required field is skipped', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        {
          recordingId: 1,
          type: PlayType.Goal,
          endMs: 2_000,
          confidence: 0.9,
          players: ['p1'],
        } as RawMoment,
      ]),
    ).toEqual([]);
  });

  it('A well-formed moment for this recording is kept unchanged', () => {
    expect(
      filterRawMoments(consts.recording10min, [consts.fixtures.validSave]),
    ).toEqual([consts.fixtures.validSave]);
  });

  it('Mixed list keeps only valid moments', () => {
    expect(
      filterRawMoments(consts.recording10min, [
        consts.fixtures.validSave,
        rawMoment(PlayType.Goal, 200_000, 100_000, { confidence: 0.9 }),
        rawMoment(PlayType.Save, 140_000, 145_000, { confidence: 1.4 }),
        rawMoment(PlayType.Goal, 60_000, 65_000, {
          recordingId: 2,
          confidence: 0.99,
        }),
        rawMoment('foul' as PlayType, 90_000, 95_000, { confidence: 0.9 }),
        rawMoment(PlayType.Goal, 50_000, 50_000, { confidence: 0.9 }),
      ]),
    ).toEqual([consts.fixtures.validSave]);
  });
});

describe('mergeRawMoments', () => {
  it('An empty input list yields an empty result', () => {
    expect(mergeRawMoments([])).toEqual([]);
  });

  it('A single moment is unchanged', () => {
    expect(mergeRawMoments([consts.fixtures.validSave])).toEqual([
      consts.fixtures.validSave,
    ]);
  });

  it('Overlapping same-type moments become one play', () => {
    expect(
      sortPlayers(
        mergeRawMoments([
          consts.fixtures.overlapGoalA,
          consts.fixtures.overlapGoalB,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 58_000, 65_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.95,
      }),
    ]);
  });

  it('A same-type moment fully inside another is merged into it', () => {
    expect(
      sortPlayers(
        mergeRawMoments([
          rawMoment(PlayType.Goal, 10_000, 50_000, { confidence: 0.7 }),
          rawMoment(PlayType.Goal, 20_000, 30_000, {
            players: ['p2'],
            confidence: 0.95,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 50_000, {
        players: ['p1', 'p2'],
        confidence: 0.95,
      }),
    ]);
  });

  it('Input order does not change the result', () => {
    expect(
      sortPlayers(
        mergeRawMoments([
          consts.fixtures.overlapGoalB,
          consts.fixtures.overlapGoalA,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 58_000, 65_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.95,
      }),
    ]);
  });

  it('Same-type moments more than 1s apart stay separate', () => {
    expect(
      mergeRawMoments([consts.fixtures.mergeGoalA, consts.fixtures.gap1001B]),
    ).toEqual([consts.fixtures.mergeGoalA, consts.fixtures.gap1001B]);
  });

  it('Different-type moments that overlap never merge', () => {
    expect(
      mergeRawMoments([
        rawMoment(PlayType.Goal, 10_000, 20_000),
        rawMoment(PlayType.Save, 10_000, 20_000, {
          players: ['p2'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 20_000),
      rawMoment(PlayType.Save, 10_000, 20_000, {
        players: ['p2'],
        confidence: 0.8,
      }),
    ]);
  });

  it('Different-type moments within 1s never merge', () => {
    expect(
      mergeRawMoments([
        rawMoment(PlayType.Goal, 10_000, 20_000),
        rawMoment(PlayType.Save, 20_500, 28_000, {
          players: ['p2'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 20_000),
      rawMoment(PlayType.Save, 20_500, 28_000, {
        players: ['p2'],
        confidence: 0.8,
      }),
    ]);
  });
});

describe('convertToClips', () => {
  it('An empty input list yields an empty result', () => {
    expect(convertToClips(consts.recording10min, [])).toEqual([]);
  });

  it('Pads 2s before and 3s after a mid-recording moment', () => {
    expect(
      convertToClips(consts.recording10min, [consts.fixtures.validSave]),
    ).toEqual([
      clip('clip-118000', PlayType.Save, 118_000, 127_000, {
        players: ['p5'],
        confidence: 0.92,
      }),
    ]);
  });

  it('Padding before a moment near 0:00 clamps to 0:00', () => {
    expect(
      convertToClips(consts.recording10min, [
        rawMoment(PlayType.Save, 1_000, 4_000, {
          players: ['p4'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual([
      clip('clip-0', PlayType.Save, 0, 7_000, {
        players: ['p4'],
        confidence: 0.8,
      }),
    ]);
  });

  it('A moment that starts at 0:00 stays at 0:00', () => {
    expect(
      convertToClips(consts.recording10min, [
        rawMoment(PlayType.Goal, 0, 3_000),
      ]),
    ).toEqual([clip('clip-0', PlayType.Goal, 0, 6_000)]);
  });

  it('Padding after a moment near the end clamps to the recording end', () => {
    expect(
      convertToClips(consts.recording10min, [
        rawMoment(PlayType.Goal, 596_000, 599_000, { confidence: 0.88 }),
      ]),
    ).toEqual([
      clip('clip-594000', PlayType.Goal, 594_000, 600_000, {
        confidence: 0.88,
      }),
    ]);
  });

  it('A moment that ends at the recording end stays there', () => {
    expect(
      convertToClips(consts.recording10min, [
        rawMoment(PlayType.Goal, 595_000, 600_000, { confidence: 0.88 }),
      ]),
    ).toEqual([
      clip('clip-593000', PlayType.Goal, 593_000, 600_000, {
        confidence: 0.88,
      }),
    ]);
  });

  it('Clips start pending and use the padded start in the id', () => {
    expect(
      convertToClips(consts.recording10min, [
        rawMoment(PlayType.Skill, 80_000, 81_000, {
          players: ['p10'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual([
      clip('clip-78000', PlayType.Skill, 78_000, 84_000, {
        players: ['p10'],
        confidence: 0.8,
      }),
    ]);
  });
});

describe('selectClips', () => {
  it('An empty input list yields no selected clips and no candidates', () => {
    expect(selectClips([])).toEqual([[], []]);
  });

  it('Clips that sum to exactly the 60s cap are all included', () => {
    expect(
      selectClips([consts.goal20sA, consts.goal20sB, consts.save20s]),
    ).toEqual([[consts.goal20sA, consts.goal20sB, consts.save20s], []]);
  });

  it('A clip just over the remaining time is skipped for a later one that fits', () => {
    expect(
      selectClips([
        consts.goal20sA,
        consts.goal20sB,
        consts.saveJustOver,
        consts.skill10s,
      ]),
    ).toEqual([
      [consts.goal20sA, consts.goal20sB, consts.skill10s],
      [consts.saveJustOver],
    ]);
  });

  it('A clip longer than the cap is skipped and later clips can still fill the reel', () => {
    expect(selectClips([consts.overCapClip, consts.underCapSkill])).toEqual([
      [consts.underCapSkill],
      [consts.overCapClip],
    ]);
  });

  it('Play-type priority is goal, save, big play, skill, then near miss', () => {
    const nearMiss = clip('clip-nm', PlayType.NearMiss, 0, 40_000, {
      players: ['p12'],
      confidence: 0.99,
    });
    const skill = clip('clip-skill', PlayType.Skill, 50_000, 90_000, {
      players: ['p10'],
      confidence: 0.99,
    });
    const goal = clip('clip-goal', PlayType.Goal, 100_000, 120_000, {
      confidence: 0.5,
    });
    const save = clip('clip-save', PlayType.Save, 130_000, 150_000, {
      players: ['p5'],
      confidence: 0.5,
    });

    expect(selectClips([nearMiss, skill, goal, save])).toEqual([
      [goal, save],
      [skill, nearMiss],
    ]);
  });

  it('Within the same play type, higher confidence wins', () => {
    const low = clip('clip-low', PlayType.Goal, 0, 50_000, { confidence: 0.4 });
    const high = clip('clip-high', PlayType.Goal, 60_000, 110_000, {
      players: ['p2'],
    });

    expect(selectClips([low, high])).toEqual([[high], [low]]);
  });

  it('Ties in play type and confidence keep input order', () => {
    expect(
      selectClips([consts.bigPlay40sSecond, consts.bigPlay40sFirst]),
    ).toEqual([[consts.bigPlay40sSecond], [consts.bigPlay40sFirst]]);
  });

  it('A clip that overlaps an already selected clip is skipped', () => {
    expect(
      selectClips([consts.goal20sA, consts.overlappingSave, consts.laterSkill]),
    ).toEqual([[consts.goal20sA, consts.laterSkill], [consts.overlappingSave]]);
  });
});

describe('buildReel', () => {
  it('A full game of raw moments becomes a sorted, unshareable reel within the 60s cap', () => {
    const reel = buildReel(consts.seedRecording, consts.seedRawMoments);
    expect({
      ...reel,
      clips: sortPlayers(reel.clips),
      candidates: sortPlayers(reel.candidates),
    }).toEqual({
      ...consts.expectedReel,
      clips: sortPlayers(consts.expectedReel.clips),
      candidates: sortPlayers(consts.expectedReel.candidates),
    });
  });

  it('An empty input list yields an unshareable empty reel under the default cap', () => {
    expect(buildReel(consts.recording10min, [])).toEqual({
      shareable: false,
      clips: [],
      candidates: [],
      capMs: 60_000,
    });
  });

  it('Selected clips are sorted by start time', () => {
    expect(
      buildReel(consts.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 104_000),
        rawMoment(PlayType.Save, 10_000, 14_000, {
          players: ['p5'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual({
      shareable: false,
      clips: [
        clip('clip-8000', PlayType.Save, 8_000, 17_000, {
          players: ['p5'],
          confidence: 0.8,
        }),
        clip('clip-98000', PlayType.Goal, 98_000, 107_000),
      ],
      candidates: [],
      capMs: 60_000,
    });
  });
});
