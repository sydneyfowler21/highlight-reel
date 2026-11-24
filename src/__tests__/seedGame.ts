import { at, clip, rawMoment } from './builders';
import { PlayType, type Recording, type Reel } from '../types';

export const recording: Recording = { id: 1, durationMs: at('10:00') };

const goalDetectedEarly = rawMoment(PlayType.Goal, at('0:58'), at('1:02'), {
  players: ['p1', 'p3'],
  confidence: 0.8,
});

const sameGoalDetectedLater = rawMoment(PlayType.Goal, at('1:00'), at('1:05'), {
  players: ['p1', 'p2'],
  confidence: 0.95,
});

const midGameGoal = rawMoment(PlayType.Goal, at('8:28'), at('8:32'), {
  players: ['p3'],
});

const goalWhosePaddingRunsPastRecordingEnd = rawMoment(
  PlayType.Goal,
  at('9:56'),
  at('9:59'),
  { confidence: 0.88 },
);

const saveWhosePaddingRunsBeforeRecordingStart = rawMoment(
  PlayType.Save,
  at('0:01'),
  at('0:04'),
  { players: ['p4'], confidence: 0.8 },
);

const highConfidenceSave = rawMoment(PlayType.Save, at('2:00'), at('2:04'), {
  players: ['p5'],
  confidence: 0.92,
});

const separateSaveThatOverlapsHighConfidenceSaveOnlyAfterPadding = rawMoment(
  PlayType.Save,
  at('2:06'),
  at('2:10'),
  { players: ['p6'], confidence: 0.4 },
);

const bestBigPlay = rawMoment(PlayType.BigPlay, at('3:20'), at('3:26'), {
  players: ['p7'],
  confidence: 0.85,
});

const secondBestBigPlay = rawMoment(PlayType.BigPlay, at('4:10'), at('4:15'), {
  players: ['p8'],
  confidence: 0.7,
});

const thirdBestBigPlay = rawMoment(PlayType.BigPlay, at('5:00'), at('5:06'), {
  players: ['p9'],
  confidence: 0.6,
});

const skillThatExactlyFillsRemainingTime = rawMoment(
  PlayType.Skill,
  at('1:20'),
  at('1:21'),
  { players: ['p10'], confidence: 0.8 },
);

const backupSkillOfSameLength = rawMoment(
  PlayType.Skill,
  at('5:50'),
  at('5:51'),
  { players: ['p11'], confidence: 0.65 },
);

const betterNearMiss = rawMoment(PlayType.NearMiss, at('7:30'), at('7:34'), {
  players: ['p12'],
  confidence: 0.88,
});

const worseNearMiss = rawMoment(PlayType.NearMiss, at('7:50'), at('7:55'), {
  players: ['p13'],
  confidence: 0.6,
});

const malformed = {
  endsBeforeItStarts: rawMoment(PlayType.Goal, at('3:20'), at('1:40')),
  confidenceAboveOne: rawMoment(PlayType.Save, at('2:20'), at('2:25'), {
    players: ['p5'],
    confidence: 1.4,
  }),
  fromAnotherRecording: rawMoment(PlayType.Goal, at('1:00'), at('1:05'), {
    recordingId: 2,
    confidence: 0.99,
  }),
  unknownPlayType: {
    ...rawMoment(PlayType.Goal, at('1:30'), at('1:35')),
    type: 'foul',
  },
};

export const rawMoments: unknown[] = [
  goalDetectedEarly,
  sameGoalDetectedLater,
  midGameGoal,
  goalWhosePaddingRunsPastRecordingEnd,
  saveWhosePaddingRunsBeforeRecordingStart,
  highConfidenceSave,
  separateSaveThatOverlapsHighConfidenceSaveOnlyAfterPadding,
  bestBigPlay,
  secondBestBigPlay,
  thirdBestBigPlay,
  skillThatExactlyFillsRemainingTime,
  backupSkillOfSameLength,
  betterNearMiss,
  worseNearMiss,
  ...Object.values(malformed),
];

export const expectedReel: Reel = {
  shareable: false,
  clips: [
    clip('clip-0', PlayType.Save, at('0:00'), at('0:07'), {
      players: ['p4'],
      confidence: 0.8,
    }),
    clip('clip-56000', PlayType.Goal, at('0:56'), at('1:08'), {
      players: ['p1', 'p3', 'p2'],
      confidence: 0.95,
    }),
    clip('clip-78000', PlayType.Skill, at('1:18'), at('1:24'), {
      players: ['p10'],
      confidence: 0.8,
    }),
    clip('clip-118000', PlayType.Save, at('1:58'), at('2:07'), {
      players: ['p5'],
      confidence: 0.92,
    }),
    clip('clip-198000', PlayType.BigPlay, at('3:18'), at('3:29'), {
      players: ['p7'],
      confidence: 0.85,
    }),
    clip('clip-506000', PlayType.Goal, at('8:26'), at('8:35'), {
      players: ['p3'],
    }),
    clip('clip-594000', PlayType.Goal, at('9:54'), at('10:00'), {
      confidence: 0.88,
    }),
  ],
  candidates: [
    clip('clip-124000', PlayType.Save, at('2:04'), at('2:13'), {
      players: ['p6'],
      confidence: 0.4,
    }),
    clip('clip-248000', PlayType.BigPlay, at('4:08'), at('4:18'), {
      players: ['p8'],
      confidence: 0.7,
    }),
    clip('clip-298000', PlayType.BigPlay, at('4:58'), at('5:09'), {
      players: ['p9'],
      confidence: 0.6,
    }),
    clip('clip-348000', PlayType.Skill, at('5:48'), at('5:54'), {
      players: ['p11'],
      confidence: 0.65,
    }),
    clip('clip-448000', PlayType.NearMiss, at('7:28'), at('7:37'), {
      players: ['p12'],
      confidence: 0.88,
    }),
    clip('clip-468000', PlayType.NearMiss, at('7:48'), at('7:58'), {
      players: ['p13'],
      confidence: 0.6,
    }),
  ],
  capMs: at('1:00'),
};
