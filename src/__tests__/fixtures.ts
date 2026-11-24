import { clip, rawMoment } from './builders';
import { PlayType, type Recording } from '../types';

export const recording10min: Recording = { id: 1, durationMs: 600_000 };

export const validSave = rawMoment(PlayType.Save, 120_000, 124_000, {
  players: ['p5'],
  confidence: 0.92,
});

export const overlapGoalA = rawMoment(PlayType.Goal, 58_000, 62_000, {
  players: ['p1', 'p3'],
  confidence: 0.8,
});
export const overlapGoalB = rawMoment(PlayType.Goal, 60_000, 65_000, {
  players: ['p1', 'p2'],
  confidence: 0.95,
});

export const mergeGoalA = rawMoment(PlayType.Goal, 10_000, 20_000, {
  confidence: 0.8,
});

export const touchB = rawMoment(PlayType.Goal, 20_000, 30_000, {
  players: ['p2'],
});

export const gap1sB = rawMoment(PlayType.Goal, 21_000, 30_000, {
  players: ['p2'],
});

export const gap1001B = rawMoment(PlayType.Goal, 21_001, 30_000, {
  players: ['p2'],
});

export const interleaveSave = rawMoment(PlayType.Save, 15_000, 25_000, {
  players: ['p2'],
  confidence: 0.7,
});
export const interleaveGoalB = rawMoment(PlayType.Goal, 18_000, 28_000, {
  players: ['p3'],
  confidence: 0.95,
});

export const interleaveGapSave = rawMoment(PlayType.Save, 20_500, 25_000, {
  players: ['p2'],
  confidence: 0.7,
});
export const interleaveGapGoalB = rawMoment(PlayType.Goal, 20_800, 30_000, {
  players: ['p3'],
});

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
