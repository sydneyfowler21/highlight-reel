/**
 * Named test data for highlight-reel tests. Import as
 * `import * as fixtures from './fixtures'`.
 */

import { clip, rawMoment } from './builders';
import { PlayType, type RawMoment, type Recording, type Reel } from '../types';

export const recording10min: Recording = { id: 1, durationMs: 600_000 };

// --- Raw moment fixtures --------------------------------------------------

// Valid mid-recording moment: 2:00–2:04.
export const validSave = rawMoment(PlayType.Save, 120_000, 124_000, {
  players: ['p5'],
  confidence: 0.92,
});

// Merge: overlapping goals (current merge already handles this).
export const overlapGoalA = rawMoment(PlayType.Goal, 58_000, 62_000, {
  players: ['p1', 'p3'],
  confidence: 0.8,
});
export const overlapGoalB = rawMoment(PlayType.Goal, 60_000, 65_000, {
  players: ['p1', 'p2'],
  confidence: 0.95,
});

// Merge: first goal (0:10–0:20) of the gap, touch, and interleave pairs.
export const mergeGoalA = rawMoment(PlayType.Goal, 10_000, 20_000, {
  confidence: 0.8,
});

// Same type, touching mergeGoalA (gap 0).
export const touchB = rawMoment(PlayType.Goal, 20_000, 30_000, {
  players: ['p2'],
});

// Same type, gap exactly 1000ms after mergeGoalA.
export const gap1sB = rawMoment(PlayType.Goal, 21_000, 30_000, {
  players: ['p2'],
});

// Same type, gap 1001ms after mergeGoalA.
export const gap1001B = rawMoment(PlayType.Goal, 21_001, 30_000, {
  players: ['p2'],
});

// --- Saved for the interleaved-merge fix ----------------------------------
// Not used by any test yet. Each pairs with mergeGoalA, and their tests
// will be added with that fix.

// Interleaved: a save between mergeGoalA and an overlapping goal.
export const interleaveSave = rawMoment(PlayType.Save, 15_000, 25_000, {
  players: ['p2'],
  confidence: 0.7,
});
export const interleaveGoalB = rawMoment(PlayType.Goal, 18_000, 28_000, {
  players: ['p3'],
  confidence: 0.95,
});

// Interleaved: a save in the 800ms gap between mergeGoalA and the next goal.
export const interleaveGapSave = rawMoment(PlayType.Save, 20_500, 25_000, {
  players: ['p2'],
  confidence: 0.7,
});
export const interleaveGapGoalB = rawMoment(PlayType.Goal, 20_800, 30_000, {
  players: ['p3'],
});

// --- Clip fixtures for selection ------------------------------------------

export const goal20sA = clip('clip-0', PlayType.Goal, 0, 20_000);

export const goal20sB = clip('clip-30000', PlayType.Goal, 30_000, 50_000, {
  confidence: 0.8,
  players: ['p2'],
});

export const save20s = clip('clip-60000', PlayType.Save, 60_000, 80_000, {
  confidence: 0.7,
  players: ['p3'],
});

export const saveJustOver = clip('clip-60000', PlayType.Save, 60_000, 80_001, {
  players: ['p3'],
});

export const skill10s = clip('clip-90000', PlayType.Skill, 90_000, 100_000, {
  confidence: 0.5,
  players: ['p4'],
});

export const bigPlay40sFirst = clip('clip-0', PlayType.BigPlay, 0, 40_000, {
  confidence: 0.5,
});

export const bigPlay40sSecond = clip(
  'clip-50000',
  PlayType.BigPlay,
  50_000,
  90_000,
  {
    confidence: 0.5,
    players: ['p2'],
  },
);

export const overlappingSave = clip('clip-5000', PlayType.Save, 5_000, 15_000, {
  confidence: 0.99,
  players: ['p5'],
});

export const laterSkill = clip('clip-20000', PlayType.Skill, 20_000, 25_000, {
  confidence: 0.6,
  players: ['p10'],
});

export const overCapClip = clip('clip-0', PlayType.NearMiss, 0, 61_000, {
  confidence: 0.99,
  players: ['p12'],
});

export const underCapSkill = clip(
  'clip-70000',
  PlayType.Skill,
  70_000,
  80_000,
  {
    confidence: 0.4,
    players: ['p10'],
  },
);

// --- Seed scenario (buildReel full game) ---------------------------------

export const seedRecording: Recording = recording10min;

export const seedRawMoments: RawMoment[] = [
  // Two overlapping goal detections around 1:00; same play, should merge
  // 0:58–1:02
  rawMoment(PlayType.Goal, 58_000, 62_000, {
    players: ['p1', 'p3'],
    confidence: 0.8,
  }),

  // 1:00–1:05
  rawMoment(PlayType.Goal, 60_000, 65_000, {
    players: ['p1', 'p2'],
    confidence: 0.95,
  }),

  // Goal around 8:30 (8:28–8:32)
  rawMoment(PlayType.Goal, 508_000, 512_000, { players: ['p3'] }),

  // Goal near 10:00 (9:56–9:59); padding would run past the recording and must clamp
  rawMoment(PlayType.Goal, 596_000, 599_000, { confidence: 0.88 }),

  // Moment near 0:00 (0:01–0:04); padding before it must clamp to 0
  rawMoment(PlayType.Save, 1_000, 4_000, { players: ['p4'], confidence: 0.8 }),

  // High-confidence save around 2:00 (2:00–2:04)
  rawMoment(PlayType.Save, 120_000, 124_000, {
    players: ['p5'],
    confidence: 0.92,
  }),

  // Low-confidence save 2s later (2:06–2:10): gap is 2s (over 1s, so not the same play),
  // but they overlap after padding, so only the high-confidence one is selected
  rawMoment(PlayType.Save, 126_000, 130_000, {
    players: ['p6'],
    confidence: 0.4,
  }),

  // Big plays, skills, and near misses — unfiltered total exceeds 60s
  // 3:20–3:26
  rawMoment(PlayType.BigPlay, 200_000, 206_000, {
    players: ['p7'],
    confidence: 0.85,
  }),

  // 4:10–4:15
  rawMoment(PlayType.BigPlay, 250_000, 255_000, {
    players: ['p8'],
    confidence: 0.7,
  }),

  // 5:00–5:06
  rawMoment(PlayType.BigPlay, 300_000, 306_000, {
    players: ['p9'],
    confidence: 0.6,
  }),

  // Short skill that fills leftover time exactly (1s raw + 2s before + 3s after = 6s)
  // 1:20–1:21
  rawMoment(PlayType.Skill, 80_000, 81_000, {
    players: ['p10'],
    confidence: 0.8,
  }),

  // Same length, lower confidence; left out, but a clear backfill if the in-reel skill is rejected
  // 5:50–5:51
  rawMoment(PlayType.Skill, 350_000, 351_000, {
    players: ['p11'],
    confidence: 0.65,
  }),

  // 7:30–7:34
  rawMoment(PlayType.NearMiss, 450_000, 454_000, {
    players: ['p12'],
    confidence: 0.88,
  }),

  // 7:50–7:55
  rawMoment(PlayType.NearMiss, 470_000, 475_000, {
    players: ['p13'],
    confidence: 0.6,
  }),

  // Malformed rows — should be skipped
  // End before start
  rawMoment(PlayType.Goal, 200_000, 100_000),

  // Confidence outside [0, 1]
  rawMoment(PlayType.Save, 140_000, 145_000, {
    players: ['p5'],
    confidence: 1.4,
  }),

  // Different recording
  rawMoment(PlayType.Goal, 60_000, 65_000, {
    recordingId: 2,
    confidence: 0.99,
  }),

  // Not a valid play type
  rawMoment('foul' as PlayType, 90_000, 95_000),
];

export const expectedReel: Reel = {
  shareable: false,
  clips: [
    clip('clip-0', PlayType.Save, 0, 7_000, {
      players: ['p4'],
      confidence: 0.8,
    }),
    clip('clip-56000', PlayType.Goal, 56_000, 68_000, {
      players: ['p1', 'p3', 'p2'],
      confidence: 0.95,
    }),
    clip('clip-78000', PlayType.Skill, 78_000, 84_000, {
      players: ['p10'],
      confidence: 0.8,
    }),
    clip('clip-118000', PlayType.Save, 118_000, 127_000, {
      players: ['p5'],
      confidence: 0.92,
    }),
    clip('clip-198000', PlayType.BigPlay, 198_000, 209_000, {
      players: ['p7'],
      confidence: 0.85,
    }),
    clip('clip-506000', PlayType.Goal, 506_000, 515_000, { players: ['p3'] }),
    clip('clip-594000', PlayType.Goal, 594_000, 600_000, { confidence: 0.88 }),
  ],
  candidates: [
    clip('clip-124000', PlayType.Save, 124_000, 133_000, {
      players: ['p6'],
      confidence: 0.4,
    }),
    clip('clip-248000', PlayType.BigPlay, 248_000, 258_000, {
      players: ['p8'],
      confidence: 0.7,
    }),
    clip('clip-298000', PlayType.BigPlay, 298_000, 309_000, {
      players: ['p9'],
      confidence: 0.6,
    }),
    clip('clip-348000', PlayType.Skill, 348_000, 354_000, {
      players: ['p11'],
      confidence: 0.65,
    }),
    clip('clip-448000', PlayType.NearMiss, 448_000, 457_000, {
      players: ['p12'],
      confidence: 0.88,
    }),
    clip('clip-468000', PlayType.NearMiss, 468_000, 478_000, {
      players: ['p13'],
      confidence: 0.6,
    }),
  ],
  capMs: 60_000,
};
