export type Recording = {
  id: number;
  durationMs: number;
};

export enum PlayType {
  Goal = 'goal',
  Save = 'save',
  BigPlay = 'bigPlay',
  Skill = 'skill',
  NearMiss = 'nearMiss',
}

export type RawMoment = {
  recordingId: number;
  startMs: number;
  endMs: number;
  type: PlayType;
  confidence: number;
  players: string[];
};

export type Clip = {
  id: string;
  startMs: number;
  endMs: number;
  type: PlayType;
  confidence: number;
  players: string[];
  status: 'pending' | 'approved' | 'rejected';
};

export type Reel = {
  shareable: boolean;
  clips: Clip[]; // What's in the reel
  candidates: Clip[]; // Prioritized list of extra clips
  capMs: number;
};

const MAX_REEL_LENGTH = 60000;
const PRE_PAD_MS = 2000;
const POST_PAD_MS = 3000;

const PLAY_TYPE_PRIORITY: Record<PlayType, number> = {
  [PlayType.Goal]: 1,
  [PlayType.Save]: 2,
  [PlayType.BigPlay]: 3,
  [PlayType.Skill]: 4,
  [PlayType.NearMiss]: 5,
};

function filterRawMoments(recording: Recording, rawMoments: RawMoment[]) {
  return rawMoments.filter((moment) => {
    if (moment.recordingId !== recording.id) return false;
    if (!(
      typeof moment.startMs === 'number' && typeof moment.endMs === 'number'
    ))
      return false;
    if (moment.startMs >= moment.endMs) return false;
    if (
      moment.startMs >= recording.durationMs ||
      moment.endMs > recording.durationMs
    )
      return false;
    if (moment.confidence < 0 || moment.confidence > 1) return false;
    if (!Object.values(PlayType).includes(moment.type)) return false;

    return true;
  });
}

function mergeRawMoments(rawMoments: RawMoment[]): RawMoment[] {
  if (rawMoments.length === 0) return [];

  const sortedMoments = [...rawMoments].sort((a, b) => a.startMs - b.startMs);
  const mergedMoments = [sortedMoments[0]];

  for (let i = 1; i < sortedMoments.length; i++) {
    const lastMergeIndex = mergedMoments.length - 1;
    const sameType =
      sortedMoments[i].type === mergedMoments[lastMergeIndex].type;
    const overlapping =
      sortedMoments[i].startMs < mergedMoments[lastMergeIndex].endMs;
    if (sameType && overlapping) {
      mergedMoments[lastMergeIndex] = {
        recordingId: mergedMoments[lastMergeIndex].recordingId,
        startMs: mergedMoments[lastMergeIndex].startMs,
        endMs:
          sortedMoments[i].endMs > mergedMoments[lastMergeIndex].endMs
            ? sortedMoments[i].endMs
            : mergedMoments[lastMergeIndex].endMs,
        type: mergedMoments[lastMergeIndex].type,
        confidence:
          sortedMoments[i].confidence > mergedMoments[lastMergeIndex].confidence
            ? sortedMoments[i].confidence
            : mergedMoments[lastMergeIndex].confidence,
        players: [
          ...new Set([
            ...sortedMoments[i].players,
            ...mergedMoments[lastMergeIndex].players,
          ]),
        ],
      };
    } else {
      mergedMoments.push(sortedMoments[i]);
    }
  }

  return mergedMoments;
}

function convertToClips(recording: Recording, rawMoments: RawMoment[]): Clip[] {
  return rawMoments.map((moment) => {
    const paddedStart = Math.max(moment.startMs - PRE_PAD_MS, 0);
    const paddedEnd = Math.min(
      moment.endMs + POST_PAD_MS,
      recording.durationMs,
    );

    return {
      id: `clip-${paddedStart}`,
      startMs: paddedStart,
      endMs: paddedEnd,
      type: moment.type,
      confidence: moment.confidence,
      players: [...moment.players],
      status: 'pending',
    };
  });
}

function selectClips(clips: Clip[]): [Clip[], Clip[]] {
  const clipsByImportance = [...clips].sort(
    (a, b) =>
      PLAY_TYPE_PRIORITY[a.type] - PLAY_TYPE_PRIORITY[b.type] ||
      b.confidence - a.confidence,
  );
  const selectedClips: Clip[] = [];
  const extraClips: Clip[] = [];

  let index = 0;
  let reelLength = 0;
  while (reelLength < MAX_REEL_LENGTH && index < clipsByImportance.length) {
    const clipLength =
      clipsByImportance[index].endMs - clipsByImportance[index].startMs;
    if (reelLength + clipLength <= MAX_REEL_LENGTH) {
      if (
        selectedClips.some(
          (clip) =>
            clip.startMs < clipsByImportance[index].endMs &&
            clipsByImportance[index].startMs < clip.endMs,
        )
      ) {
        extraClips.push(clipsByImportance[index]);
      } else {
        selectedClips.push(clipsByImportance[index]);
        reelLength += clipLength;
      }
    } else {
      extraClips.push(clipsByImportance[index]);
    }

    index++;
  }

  extraClips.push(...clipsByImportance.slice(index));

  return [selectedClips, extraClips];
}

export function buildReel(recording: Recording, rawMoments: RawMoment[]): Reel {
  const filteredMoments = filterRawMoments(recording, rawMoments);
  const mergedMoments = mergeRawMoments(filteredMoments);
  const clips = convertToClips(recording, mergedMoments);
  const [selectedClips, extraClips] = selectClips(clips);
  const sortedSelectedClips = [...selectedClips].sort(
    (a, b) => a.startMs - b.startMs,
  );

  return {
    shareable: false,
    clips: sortedSelectedClips,
    candidates: extraClips,
    capMs: MAX_REEL_LENGTH,
  };
}
