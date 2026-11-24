import { describe, expect, it } from '@jest/globals';
import {
  PlayType,
  buildReel,
  type RawMoment,
  type Recording,
  type Reel,
} from './highlightReel';

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(normalize);
    const allPrimitive = items.every(
      (v) => v === null || typeof v !== 'object',
    );
    return allPrimitive ? [...items].sort() : items;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = normalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

const seedRecording: Recording = {
  id: 1,
  durationMs: 600000, // 10 * 60 * 1000
};

const seedRawMoments: RawMoment[] = [
  // Two overlapping goal detections around 1:00; same play, should merge
  {
    recordingId: 1,
    type: PlayType.Goal,
    startMs: 58000, // 0:58
    endMs: 62000, // 1:02
    players: ['p1', 'p3'],
    confidence: 0.8,
  },
  {
    recordingId: 1,
    type: PlayType.Goal,
    startMs: 60000, // 1:00
    endMs: 65000, // 1:05
    players: ['p1', 'p2'],
    confidence: 0.95,
  },

  // Goal around 8:30
  {
    recordingId: 1,
    type: PlayType.Goal,
    startMs: 508000, // 8:28
    endMs: 512000, // 8:32
    players: ['p3'],
    confidence: 0.9,
  },

  // Goal near 10:00; padding would run past the recording and must clamp
  {
    recordingId: 1,
    type: PlayType.Goal,
    startMs: 596000, // 9:56
    endMs: 599000, // 9:59
    players: ['p1'],
    confidence: 0.88,
  },

  // Moment near 0:00; padding before it must clamp to 0
  {
    recordingId: 1,
    type: PlayType.Save,
    startMs: 1000, // 0:01
    endMs: 4000, // 0:04
    players: ['p4'],
    confidence: 0.8,
  },

  // High-confidence save around 2:00
  {
    recordingId: 1,
    type: PlayType.Save,
    startMs: 120000, // 2:00
    endMs: 124000, // 2:04
    players: ['p5'],
    confidence: 0.92,
  },

  // Low-confidence save 2s later: gap is 2s (over 1s, so not the same play),
  // but they overlap after padding, so only the high-confidence one is selected
  {
    recordingId: 1,
    type: PlayType.Save,
    startMs: 126000, // 2:06
    endMs: 130000, // 2:10
    players: ['p6'],
    confidence: 0.4,
  },

  // Big plays, skills, and near misses — unfiltered total exceeds 60s
  {
    recordingId: 1,
    type: PlayType.BigPlay,
    startMs: 200000, // 3:20
    endMs: 206000, // 3:26
    players: ['p7'],
    confidence: 0.85,
  },
  {
    recordingId: 1,
    type: PlayType.BigPlay,
    startMs: 250000, // 4:10
    endMs: 255000, // 4:15
    players: ['p8'],
    confidence: 0.7,
  },
  {
    recordingId: 1,
    type: PlayType.BigPlay,
    startMs: 300000, // 5:00
    endMs: 306000, // 5:06
    players: ['p9'],
    confidence: 0.6,
  },

  // Short skill that fills leftover time exactly (1s raw + 2s before + 3s after = 6s)
  {
    recordingId: 1,
    type: PlayType.Skill,
    startMs: 80000, // 1:20
    endMs: 81000, // 1:21
    players: ['p10'],
    confidence: 0.8,
  },
  // Same length, lower confidence; left out, but a clear backfill if the in-reel skill is rejected
  {
    recordingId: 1,
    type: PlayType.Skill,
    startMs: 350000, // 5:50
    endMs: 351000, // 5:51
    players: ['p11'],
    confidence: 0.65,
  },

  {
    recordingId: 1,
    type: PlayType.NearMiss,
    startMs: 450000, // 7:30
    endMs: 454000, // 7:34
    players: ['p12'],
    confidence: 0.88,
  },
  {
    recordingId: 1,
    type: PlayType.NearMiss,
    startMs: 470000, // 7:50
    endMs: 475000, // 7:55
    players: ['p13'],
    confidence: 0.6,
  },

  // Malformed rows — should be skipped
  {
    recordingId: 1,
    type: PlayType.Goal,
    startMs: 200000,
    endMs: 100000, // end before start
    players: ['p1'],
    confidence: 0.9,
  },
  {
    recordingId: 1,
    type: PlayType.Save,
    startMs: 140000,
    endMs: 145000,
    players: ['p5'],
    confidence: 1.4, // outside [0, 1]
  },
  {
    recordingId: 2, // different recording
    type: PlayType.Goal,
    startMs: 60000,
    endMs: 65000,
    players: ['p1'],
    confidence: 0.99,
  },
  {
    recordingId: 1,
    type: 'foul' as any, // not a valid play type
    startMs: 90000,
    endMs: 95000,
    players: ['p1'],
    confidence: 0.9,
  },
];

const expectedReel: Reel = {
  shareable: false,
  clips: [
    {
      id: 'clip-0',
      type: PlayType.Save,
      startMs: 0,
      endMs: 7000,
      players: ['p4'],
      confidence: 0.8,
      status: 'pending',
    },
    {
      id: 'clip-56000',
      type: PlayType.Goal,
      startMs: 56000,
      endMs: 68000,
      players: ['p1', 'p3', 'p2'],
      confidence: 0.95,
      status: 'pending',
    },
    {
      id: 'clip-78000',
      type: PlayType.Skill,
      startMs: 78000,
      endMs: 84000,
      players: ['p10'],
      confidence: 0.8,
      status: 'pending',
    },
    {
      id: 'clip-118000',
      type: PlayType.Save,
      startMs: 118000,
      endMs: 127000,
      players: ['p5'],
      confidence: 0.92,
      status: 'pending',
    },
    {
      id: 'clip-198000',
      type: PlayType.BigPlay,
      startMs: 198000,
      endMs: 209000,
      players: ['p7'],
      confidence: 0.85,
      status: 'pending',
    },
    {
      id: 'clip-506000',
      type: PlayType.Goal,
      startMs: 506000,
      endMs: 515000,
      players: ['p3'],
      confidence: 0.9,
      status: 'pending',
    },
    {
      id: 'clip-594000',
      type: PlayType.Goal,
      startMs: 594000,
      endMs: 600000,
      players: ['p1'],
      confidence: 0.88,
      status: 'pending',
    },
  ],
  candidates: [
    {
      id: 'clip-124000',
      type: PlayType.Save,
      startMs: 124000,
      endMs: 133000,
      players: ['p6'],
      confidence: 0.4,
      status: 'pending',
    },
    {
      id: 'clip-248000',
      type: PlayType.BigPlay,
      startMs: 248000,
      endMs: 258000,
      players: ['p8'],
      confidence: 0.7,
      status: 'pending',
    },
    {
      id: 'clip-298000',
      type: PlayType.BigPlay,
      startMs: 298000,
      endMs: 309000,
      players: ['p9'],
      confidence: 0.6,
      status: 'pending',
    },
    {
      id: 'clip-348000',
      type: PlayType.Skill,
      startMs: 348000,
      endMs: 354000,
      players: ['p11'],
      confidence: 0.65,
      status: 'pending',
    },
    {
      id: 'clip-448000',
      type: PlayType.NearMiss,
      startMs: 448000,
      endMs: 457000,
      players: ['p12'],
      confidence: 0.88,
      status: 'pending',
    },
    {
      id: 'clip-468000',
      type: PlayType.NearMiss,
      startMs: 468000,
      endMs: 478000,
      players: ['p13'],
      confidence: 0.6,
      status: 'pending',
    },
  ],
  capMs: 60000,
};

describe('buildReel', () => {
  it('buildReel: happy path', () => {
    expect(
      JSON.stringify(normalize(buildReel(seedRecording, seedRawMoments))),
    ).toBe(JSON.stringify(normalize(expectedReel)));
  });
});
