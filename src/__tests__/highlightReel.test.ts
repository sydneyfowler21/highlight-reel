import { describe, expect, it } from '@jest/globals';
import {
  buildReelFromRawMoments,
  convertToClips,
  filterRawMoments,
  mergeRawMoments,
  selectClips,
} from '../highlightReel';
import { DEFAULT_REEL_SETTINGS } from '../consts';
import { clip, rawMoment } from './builders';
import * as fixtures from './fixtures';
import * as seedGame from './seedGame';
import { PlayType, type RawMoment, type Recording } from '../types';

function withoutField(field: keyof RawMoment): Partial<RawMoment> {
  const moment: Partial<RawMoment> = rawMoment(PlayType.Goal, 100_000, 200_000);
  delete moment[field];
  return moment;
}

const invalidDurations = [[NaN], [Infinity], [-Infinity], [-1], [0]];

function recordingLasting(durationMs: number): Recording {
  return { ...fixtures.recording10min, durationMs };
}

function ignoringPlayerOrder<T extends { players: string[] }>(items: T[]): T[] {
  return items.map((item) => ({ ...item, players: [...item.players].sort() }));
}

describe('filterRawMoments', () => {
  it('An empty input list yields an empty result', () => {
    expect(filterRawMoments(fixtures.recording10min, [])).toEqual([]);
  });

  it('A moment that ends before it starts is invalid and is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 200_000, 100_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment that ends at the same instant it starts is invalid and is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 200_000, 200_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with a play type that is not in the known set is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        { ...rawMoment(PlayType.Goal, 100_000, 200_000), type: 'foul' },
      ]),
    ).toEqual([]);
  });

  it.each([[null], ['goal']])(
    'A value that is not an object, like %p, is skipped',
    (value) => {
      expect(filterRawMoments(fixtures.recording10min, [value])).toEqual([]);
    },
  );

  it('A moment with a confidence score under 0 is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: -0.1 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with a confidence score over 1 is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1.1 }),
      ]),
    ).toEqual([]);
  });

  it('A moment with confidence score 0 or 1 is valid', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 0 }),
      ]),
    ).toEqual([rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 0 })]);

    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1 }),
      ]),
    ).toEqual([rawMoment(PlayType.Goal, 100_000, 200_000, { confidence: 1 })]);
  });

  it('A moment that belongs to a different recording is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { recordingId: 'rec-2' }),
      ]),
    ).toEqual([]);
  });

  it('A moment that starts at or after the recording ends is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 600_000, 605_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it('A moment that ends after the recording is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 598_000, 601_000, { confidence: 0.9 }),
      ]),
    ).toEqual([]);
  });

  it.each(['startMs', 'endMs'] as const)(
    'A moment missing %s is skipped',
    (field) => {
      expect(
        filterRawMoments(fixtures.recording10min, [withoutField(field)]),
      ).toEqual([]);
    },
  );

  it.each(['confidence', 'players'] as const)(
    'A moment missing %s is skipped',
    (field) => {
      expect(
        filterRawMoments(fixtures.recording10min, [withoutField(field)]),
      ).toEqual([]);
    },
  );

  it.each([
    ['startMs', NaN],
    ['endMs', NaN],
    ['confidence', NaN],
    ['startMs', -Infinity],
  ] as const)('A moment with a %s of %p is skipped', (field, value) => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 200_000, { [field]: value }),
      ]),
    ).toEqual([]);
  });

  it.each([['p1'], [[null, 3]]])(
    'A moment whose players is %p is skipped',
    (players) => {
      expect(
        filterRawMoments(fixtures.recording10min, [
          { ...rawMoment(PlayType.Goal, 100_000, 200_000), players },
        ]),
      ).toEqual([]);
    },
  );

  it('A well-formed moment for this recording is kept unchanged', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [fixtures.validSave]),
    ).toEqual([fixtures.validSave]);
  });

  it('Mixed list keeps only valid moments', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [
        fixtures.validSave,
        rawMoment(PlayType.Goal, 200_000, 100_000, { confidence: 0.9 }),
        rawMoment(PlayType.Save, 140_000, 145_000, { confidence: 1.4 }),
        rawMoment(PlayType.Goal, 60_000, 65_000, {
          recordingId: 'rec-2',
          confidence: 0.99,
        }),
        { ...rawMoment(PlayType.Goal, 90_000, 95_000), type: 'foul' },
        rawMoment(PlayType.Goal, 50_000, 50_000, { confidence: 0.9 }),
      ]),
    ).toEqual([fixtures.validSave]);
  });

  it('A 1ms recording is valid and keeps a moment that fills it', () => {
    const moment = rawMoment(PlayType.Goal, 0, 1);
    expect(filterRawMoments(recordingLasting(1), [moment])).toEqual([moment]);
  });

  it('A moment whose recordingId is the number form of the recording id is skipped', () => {
    expect(
      filterRawMoments({ ...fixtures.recording10min, id: '1' }, [
        { ...rawMoment(PlayType.Goal, 100_000, 200_000), recordingId: 1 },
      ]),
    ).toEqual([]);
  });

  it('A moment with no recordingId is skipped', () => {
    expect(
      filterRawMoments(fixtures.recording10min, [withoutField('recordingId')]),
    ).toEqual([]);
  });
});

describe('mergeRawMoments', () => {
  it('An empty input list yields an empty result', () => {
    expect(mergeRawMoments([])).toEqual([]);
  });

  it('A single moment is unchanged', () => {
    expect(mergeRawMoments([fixtures.validSave])).toEqual([fixtures.validSave]);
  });

  it('Overlapping same-type moments become one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([fixtures.overlapGoalA, fixtures.overlapGoalB]),
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
      ignoringPlayerOrder(
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

  it('A chain of same-type moments becomes one play even when only neighbors overlap', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          rawMoment(PlayType.Goal, 10_000, 20_000, { confidence: 0.5 }),
          rawMoment(PlayType.Goal, 18_000, 30_000, {
            players: ['p2'],
            confidence: 0.7,
          }),
          rawMoment(PlayType.Goal, 28_000, 40_000, {
            players: ['p3'],
            confidence: 0.6,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 40_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.7,
      }),
    ]);
  });

  it('Input order does not change the result', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([fixtures.overlapGoalB, fixtures.overlapGoalA]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 58_000, 65_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.95,
      }),
    ]);
  });

  it('Same-type moments that touch (gap 0) are one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([fixtures.mergeGoalA, fixtures.touchB]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 30_000, {
        players: ['p1', 'p2'],
        confidence: 0.9,
      }),
    ]);
  });

  it('Same-type moments exactly 1s apart are one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([fixtures.mergeGoalA, fixtures.gap1sB]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 30_000, {
        players: ['p1', 'p2'],
        confidence: 0.9,
      }),
    ]);
  });

  it('Same-type moments 0.5s apart are one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          rawMoment(PlayType.Save, 10_000, 20_000, {
            players: ['p4'],
            confidence: 0.6,
          }),
          rawMoment(PlayType.Save, 20_500, 28_000, {
            players: ['p5'],
            confidence: 0.8,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Save, 10_000, 28_000, {
        players: ['p4', 'p5'],
        confidence: 0.8,
      }),
    ]);
  });

  it('A chain of same-type moments each 1s apart becomes one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          rawMoment(PlayType.Goal, 0, 1_000, { confidence: 0.5 }),
          rawMoment(PlayType.Goal, 2_000, 2_500, {
            players: ['p2'],
            confidence: 0.7,
          }),
          rawMoment(PlayType.Goal, 3_500, 4_000, {
            players: ['p3'],
            confidence: 0.9,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 0, 4_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.9,
      }),
    ]);
  });

  it('The 1s gap is measured from the end of the merged play, not the previous moment', () => {
    const longGoal = rawMoment(PlayType.Goal, 0, 10_000, { confidence: 0.5 });
    const goalInsideLongGoal = rawMoment(PlayType.Goal, 2_000, 3_000, {
      players: ['p2'],
      confidence: 0.7,
    });
    const goalUnder1sAfterLongGoal = rawMoment(PlayType.Goal, 10_800, 12_000, {
      players: ['p3'],
      confidence: 0.6,
    });
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          longGoal,
          goalInsideLongGoal,
          goalUnder1sAfterLongGoal,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 0, 12_000, {
        players: ['p1', 'p2', 'p3'],
        confidence: 0.7,
      }),
    ]);
  });

  it('Same-type moments more than 1s apart stay separate', () => {
    expect(mergeRawMoments([fixtures.mergeGoalA, fixtures.gap1001B])).toEqual([
      fixtures.mergeGoalA,
      fixtures.gap1001B,
    ]);
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

  it('Overlapping same-type moments merge when another type starts between them', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          fixtures.mergeGoalA,
          fixtures.interleaveSave,
          fixtures.interleaveGoalB,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 28_000, {
        players: ['p1', 'p3'],
        confidence: 0.95,
      }),
      fixtures.interleaveSave,
    ]);
  });

  it('Same-type moments within 1s merge when another type starts in the gap', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          fixtures.mergeGoalA,
          fixtures.interleaveGapSave,
          fixtures.interleaveGapGoalB,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 30_000, {
        players: ['p1', 'p3'],
        confidence: 0.9,
      }),
      fixtures.interleaveGapSave,
    ]);
  });

  it('Input order does not change an interleaved merge', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          fixtures.interleaveGoalB,
          fixtures.interleaveSave,
          fixtures.mergeGoalA,
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 28_000, {
        players: ['p1', 'p3'],
        confidence: 0.95,
      }),
      fixtures.interleaveSave,
    ]);
  });

  it('Two interleaved plays of different types each merge into one play', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          rawMoment(PlayType.Goal, 10_000, 20_000, { confidence: 0.6 }),
          rawMoment(PlayType.Save, 12_000, 22_000, {
            players: ['p4'],
            confidence: 0.7,
          }),
          rawMoment(PlayType.Goal, 15_000, 25_000, {
            players: ['p2'],
            confidence: 0.8,
          }),
          rawMoment(PlayType.Save, 21_000, 27_000, {
            players: ['p5'],
            confidence: 0.5,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 10_000, 25_000, {
        players: ['p1', 'p2'],
        confidence: 0.8,
      }),
      rawMoment(PlayType.Save, 12_000, 27_000, {
        players: ['p4', 'p5'],
        confidence: 0.7,
      }),
    ]);
  });

  it('Merging does not change the input moments', () => {
    const input = [
      fixtures.mergeGoalA,
      fixtures.interleaveSave,
      fixtures.interleaveGoalB,
    ].map((moment) => structuredClone(moment));
    const original = structuredClone(input);
    for (const moment of input) {
      Object.freeze(moment.players);
      Object.freeze(moment);
    }
    Object.freeze(input);

    mergeRawMoments(input);
    expect(input).toEqual(original);
  });

  it('A moment is compared with the latest play of its type', () => {
    expect(
      ignoringPlayerOrder(
        mergeRawMoments([
          rawMoment(PlayType.Goal, 0, 1_000, { confidence: 0.5 }),
          rawMoment(PlayType.Goal, 5_000, 6_000, {
            players: ['p2'],
            confidence: 0.7,
          }),
          rawMoment(PlayType.Goal, 6_500, 7_000, {
            players: ['p3'],
            confidence: 0.6,
          }),
        ]),
      ),
    ).toEqual([
      rawMoment(PlayType.Goal, 0, 1_000, { confidence: 0.5 }),
      rawMoment(PlayType.Goal, 5_000, 7_000, {
        players: ['p2', 'p3'],
        confidence: 0.7,
      }),
    ]);
  });

  it('Another type in the gap does not link same-type moments more than 1s apart', () => {
    const gapSave = rawMoment(PlayType.Save, 20_500, 21_500, {
      players: ['p4'],
      confidence: 0.7,
    });
    expect(
      mergeRawMoments([fixtures.mergeGoalA, gapSave, fixtures.gap1001B]),
    ).toEqual([fixtures.mergeGoalA, gapSave, fixtures.gap1001B]);
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
    expect(
      convertToClips(fixtures.recording10min, [], DEFAULT_REEL_SETTINGS),
    ).toEqual([]);
  });

  it('Pads 2s before and 3s after a mid-recording moment', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [fixtures.validSave],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([
      clip('clip-0', PlayType.Save, 118_000, 127_000, {
        players: ['p5'],
        confidence: 0.92,
      }),
    ]);
  });

  it('Padding before a moment near 0:00 clamps to 0:00', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [
          rawMoment(PlayType.Save, 1_000, 4_000, {
            players: ['p4'],
            confidence: 0.8,
          }),
        ],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([
      clip('clip-0', PlayType.Save, 0, 7_000, {
        players: ['p4'],
        confidence: 0.8,
      }),
    ]);
  });

  it('A moment that starts at 0:00 stays at 0:00', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [rawMoment(PlayType.Goal, 0, 3_000)],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([clip('clip-0', PlayType.Goal, 0, 6_000)]);
  });

  it('Padding after a moment near the end clamps to the recording end', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [rawMoment(PlayType.Goal, 596_000, 599_000, { confidence: 0.88 })],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([
      clip('clip-0', PlayType.Goal, 594_000, 600_000, {
        confidence: 0.88,
      }),
    ]);
  });

  it('A moment that ends at the recording end stays there', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [rawMoment(PlayType.Goal, 595_000, 600_000, { confidence: 0.88 })],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([
      clip('clip-0', PlayType.Goal, 593_000, 600_000, {
        confidence: 0.88,
      }),
    ]);
  });

  it('Each clip gets its own copy of the players list', () => {
    const moment = rawMoment(PlayType.Goal, 100_000, 104_000);
    const [result] = convertToClips(
      fixtures.recording10min,
      [moment],
      DEFAULT_REEL_SETTINGS,
    );
    expect(result.players).toEqual(moment.players);
    expect(result.players).not.toBe(moment.players);
  });

  it('Padding after a moment in a 1ms recording clamps to 1ms', () => {
    expect(
      convertToClips(
        recordingLasting(1),
        [rawMoment(PlayType.Goal, 0, 1)],
        DEFAULT_REEL_SETTINGS,
      ),
    ).toEqual([clip('clip-0', PlayType.Goal, 0, 1)]);
  });

  it('Ids number the clips from 0 in input order, even when starts clamp to the same 0:00', () => {
    expect(
      convertToClips(
        fixtures.recording10min,
        [
          rawMoment(PlayType.Save, 1_000, 4_000),
          rawMoment(PlayType.Goal, 500, 3_000),
          rawMoment(PlayType.Skill, 300_000, 304_000),
        ],
        DEFAULT_REEL_SETTINGS,
      ).map((c) => [c.startMs, c.id]),
    ).toEqual([
      [0, 'clip-0'],
      [0, 'clip-1'],
      [298_000, 'clip-2'],
    ]);
  });
  it('Pads by the given settings instead of the defaults', () => {
    expect(
      convertToClips(fixtures.recording10min, [fixtures.validSave], {
        prePadMs: 5_000,
        postPadMs: 0,
      }),
    ).toEqual([
      clip('clip-0', PlayType.Save, 115_000, 124_000, {
        players: ['p5'],
        confidence: 0.92,
      }),
    ]);
  });
});

describe('selectClips', () => {
  it('An empty input list yields no selected clips and no candidates', () => {
    expect(selectClips([], DEFAULT_REEL_SETTINGS.capMs)).toEqual({
      selected: [],
      candidates: [],
    });
  });

  it('Clips that sum to exactly the 60s cap are all included', () => {
    expect(
      selectClips(
        [fixtures.goal20sA, fixtures.goal20sB, fixtures.save20s],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.goal20sA, fixtures.goal20sB, fixtures.save20s],
      candidates: [],
    });
  });

  it('A clip just over the remaining time is skipped for a later one that fits', () => {
    expect(
      selectClips(
        [
          fixtures.goal20sA,
          fixtures.goal20sB,
          fixtures.saveJustOver,
          fixtures.skill10s,
        ],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.goal20sA, fixtures.goal20sB, fixtures.skill10s],
      candidates: [fixtures.saveJustOver],
    });
  });

  it('A clip longer than the cap is skipped and later clips can still fill the reel', () => {
    expect(
      selectClips(
        [fixtures.overCapClip, fixtures.underCapSkill],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.underCapSkill],
      candidates: [fixtures.overCapClip],
    });
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

    expect(
      selectClips([nearMiss, skill, goal, save], DEFAULT_REEL_SETTINGS.capMs),
    ).toEqual({
      selected: [goal, save],
      candidates: [skill, nearMiss],
    });
  });

  it('Within the same play type, higher confidence wins', () => {
    const low = clip('clip-low', PlayType.Goal, 0, 50_000, { confidence: 0.4 });
    const high = clip('clip-high', PlayType.Goal, 60_000, 110_000, {
      players: ['p2'],
    });

    expect(selectClips([low, high], DEFAULT_REEL_SETTINGS.capMs)).toEqual({
      selected: [high],
      candidates: [low],
    });
  });

  it('Ties in play type and confidence keep input order', () => {
    expect(
      selectClips(
        [fixtures.bigPlay40sSecond, fixtures.bigPlay40sFirst],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.bigPlay40sSecond],
      candidates: [fixtures.bigPlay40sFirst],
    });
  });

  it('Clips that touch end to start do not overlap and are both selected', () => {
    expect(fixtures.goal20sA.endMs).toBe(fixtures.laterSkill.startMs);
    expect(
      selectClips(
        [fixtures.goal20sA, fixtures.laterSkill],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.goal20sA, fixtures.laterSkill],
      candidates: [],
    });
  });

  it('A clip that overlaps an already selected clip is skipped', () => {
    expect(
      selectClips(
        [fixtures.goal20sA, fixtures.overlappingSave, fixtures.laterSkill],
        DEFAULT_REEL_SETTINGS.capMs,
      ),
    ).toEqual({
      selected: [fixtures.goal20sA, fixtures.laterSkill],
      candidates: [fixtures.overlappingSave],
    });
  });

  it('Fills up to the given cap instead of the default', () => {
    expect(
      selectClips(
        [fixtures.goal20sA, fixtures.goal20sB, fixtures.save20s],
        40_000,
      ),
    ).toEqual({
      selected: [fixtures.goal20sA, fixtures.goal20sB],
      candidates: [fixtures.save20s],
    });
  });
});

describe('buildReelFromRawMoments', () => {
  it('A full game of raw moments becomes a sorted reel within the 60s cap', () => {
    const reel = buildReelFromRawMoments(
      seedGame.recording,
      seedGame.rawMoments,
    );
    expect({
      ...reel,
      clips: ignoringPlayerOrder(reel.clips),
      candidates: ignoringPlayerOrder(reel.candidates),
    }).toEqual({
      ...seedGame.expectedReel,
      clips: ignoringPlayerOrder(seedGame.expectedReel.clips),
      candidates: ignoringPlayerOrder(seedGame.expectedReel.candidates),
    });
  });

  it('An empty input list yields an empty reel under the default cap', () => {
    expect(buildReelFromRawMoments(fixtures.recording10min, [])).toEqual({
      clips: [],
      candidates: [],
      rejected: [],
      capMs: 60_000,
    });
  });

  it('Candidates are ranked by play type, then confidence', () => {
    expect(
      buildReelFromRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.NearMiss, 100_000, 110_000, {
          players: ['p12'],
          confidence: 0.99,
        }),
        rawMoment(PlayType.Skill, 200_000, 210_000, {
          players: ['p10'],
          confidence: 0.5,
        }),
        rawMoment(PlayType.Goal, 0, 50_000),
        rawMoment(PlayType.Skill, 300_000, 310_000, {
          players: ['p11'],
          confidence: 0.8,
        }),
      ]).candidates,
    ).toEqual([
      clip('clip-3', PlayType.Skill, 298_000, 313_000, {
        players: ['p11'],
        confidence: 0.8,
      }),
      clip('clip-2', PlayType.Skill, 198_000, 213_000, {
        players: ['p10'],
        confidence: 0.5,
      }),
      clip('clip-1', PlayType.NearMiss, 98_000, 113_000, {
        players: ['p12'],
        confidence: 0.99,
      }),
    ]);
  });

  it('A moment with no players is skipped instead of crashing the merge', () => {
    const goalWithoutPlayers = withoutField('players');
    const overlappingGoal = rawMoment(PlayType.Goal, 190_000, 195_000);
    expect(
      buildReelFromRawMoments(fixtures.recording10min, [
        goalWithoutPlayers,
        overlappingGoal,
      ]),
    ).toEqual({
      clips: [clip('clip-0', PlayType.Goal, 188_000, 198_000)],
      candidates: [],
      rejected: [],
      capMs: 60_000,
    });
  });

  it('Moments with NaN times or confidence are skipped and the rest of the reel is built', () => {
    expect(
      buildReelFromRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, NaN, 50_000),
        rawMoment(PlayType.Goal, 300_000, NaN),
        rawMoment(PlayType.Goal, 400_000, 404_000, { confidence: NaN }),
        fixtures.validSave,
      ]),
    ).toEqual({
      clips: [
        clip('clip-0', PlayType.Save, 118_000, 127_000, {
          players: ['p5'],
          confidence: 0.92,
        }),
      ],
      candidates: [],
      rejected: [],
      capMs: 60_000,
    });
  });

  it.each(invalidDurations)(
    'A recording with a durationMs of %p throws',
    (durationMs) => {
      expect(() =>
        buildReelFromRawMoments(recordingLasting(durationMs), [
          fixtures.validSave,
        ]),
      ).toThrow(RangeError);
    },
  );

  it('A recording with a NaN durationMs throws even with no moments', () => {
    expect(() => buildReelFromRawMoments(recordingLasting(NaN), [])).toThrow(
      RangeError,
    );
  });

  it('A 1ms recording is valid and builds a 1ms clip', () => {
    expect(
      buildReelFromRawMoments(recordingLasting(1), [
        rawMoment(PlayType.Goal, 0, 1),
      ]).clips,
    ).toEqual([clip('clip-0', PlayType.Goal, 0, 1)]);
  });

  it('The error names the invalid durationMs', () => {
    expect(() => buildReelFromRawMoments(recordingLasting(NaN), [])).toThrow(
      'Expected recording.durationMs to be a finite number above 0, got NaN',
    );
  });

  it('Selected clips are sorted by start time', () => {
    expect(
      buildReelFromRawMoments(fixtures.recording10min, [
        rawMoment(PlayType.Goal, 100_000, 104_000),
        rawMoment(PlayType.Save, 10_000, 14_000, {
          players: ['p5'],
          confidence: 0.8,
        }),
      ]),
    ).toEqual({
      clips: [
        clip('clip-0', PlayType.Save, 8_000, 17_000, {
          players: ['p5'],
          confidence: 0.8,
        }),
        clip('clip-1', PlayType.Goal, 98_000, 107_000),
      ],
      candidates: [],
      rejected: [],
      capMs: 60_000,
    });
  });

  it('Builds with the given cap and padding and reports that cap', () => {
    expect(
      buildReelFromRawMoments(
        fixtures.recording10min,
        [
          rawMoment(PlayType.Goal, 100_000, 120_000),
          rawMoment(PlayType.Goal, 300_000, 320_000, { confidence: 0.8 }),
        ],
        { capMs: 30_000, prePadMs: 1_000, postPadMs: 0 },
      ),
    ).toEqual({
      clips: [clip('clip-0', PlayType.Goal, 99_000, 120_000)],
      candidates: [
        clip('clip-1', PlayType.Goal, 299_000, 320_000, { confidence: 0.8 }),
      ],
      rejected: [],
      capMs: 30_000,
    });
  });

  it('Fills past 60s when the cap is above the default', () => {
    expect(
      buildReelFromRawMoments(
        fixtures.recording10min,
        [
          rawMoment(PlayType.Goal, 100_000, 115_000),
          rawMoment(PlayType.Goal, 200_000, 215_000),
          rawMoment(PlayType.Goal, 300_000, 315_000),
          rawMoment(PlayType.Goal, 400_000, 415_000),
        ],
        { ...DEFAULT_REEL_SETTINGS, capMs: 90_000 },
      ),
    ).toEqual({
      clips: [
        clip('clip-0', PlayType.Goal, 98_000, 118_000),
        clip('clip-1', PlayType.Goal, 198_000, 218_000),
        clip('clip-2', PlayType.Goal, 298_000, 318_000),
        clip('clip-3', PlayType.Goal, 398_000, 418_000),
      ],
      candidates: [],
      rejected: [],
      capMs: 90_000,
    });
  });

  it.each([[NaN], [Infinity], [-1], [0]])(
    'A capMs of %p throws a RangeError even with no moments',
    (capMs) => {
      const build = () =>
        buildReelFromRawMoments(fixtures.recording10min, [], {
          ...DEFAULT_REEL_SETTINGS,
          capMs,
        });
      expect(build).toThrow(RangeError);
      expect(build).toThrow(
        `Expected settings.capMs to be a finite number above 0, got ${capMs}`,
      );
    },
  );

  it.each([
    ['prePadMs', NaN],
    ['prePadMs', -1],
    ['postPadMs', Infinity],
    ['postPadMs', -1],
  ] as const)(
    'A %s of %p throws a RangeError even with no moments',
    (field, value) => {
      const build = () =>
        buildReelFromRawMoments(fixtures.recording10min, [], {
          ...DEFAULT_REEL_SETTINGS,
          [field]: value,
        });
      expect(build).toThrow(RangeError);
      expect(build).toThrow(
        `Expected settings.${field} to be a finite number at or above 0, got ${value}`,
      );
    },
  );

  it('Zero padding is valid and leaves the moment unpadded', () => {
    expect(
      buildReelFromRawMoments(fixtures.recording10min, [fixtures.validSave], {
        ...DEFAULT_REEL_SETTINGS,
        prePadMs: 0,
        postPadMs: 0,
      }).clips,
    ).toEqual([
      clip('clip-0', PlayType.Save, 120_000, 124_000, {
        players: ['p5'],
        confidence: 0.92,
      }),
    ]);
  });
});
