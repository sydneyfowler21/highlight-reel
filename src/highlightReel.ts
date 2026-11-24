import * as consts from './consts';
import {
  PlayType,
  type Clip,
  type RawMoment,
  type Recording,
  type Reel,
} from './types';

export { PlayType } from './types';
export type { Clip, RawMoment, Recording, Reel } from './types';

export function filterRawMoments(
  recording: Recording,
  rawMoments: RawMoment[],
) {
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

export function mergeRawMoments(rawMoments: RawMoment[]): RawMoment[] {
  if (rawMoments.length === 0) return [];

  const sortedMoments = [...rawMoments].sort((a, b) => a.startMs - b.startMs);
  const mergedMoments = [sortedMoments[0]];

  for (let i = 1; i < sortedMoments.length; i++) {
    const moment = sortedMoments[i];
    const lastIndex = mergedMoments.length - 1;
    const last = mergedMoments[lastIndex];
    const sameType = moment.type === last.type;
    const withinMergeGap = moment.startMs - consts.MERGE_GAP_MS <= last.endMs;
    if (sameType && withinMergeGap) {
      mergedMoments[lastIndex] = {
        recordingId: last.recordingId,
        startMs: last.startMs,
        endMs: Math.max(last.endMs, moment.endMs),
        type: last.type,
        confidence: Math.max(last.confidence, moment.confidence),
        players: [...new Set([...moment.players, ...last.players])],
      };
    } else {
      mergedMoments.push(moment);
    }
  }

  return mergedMoments;
}

export function convertToClips(
  recording: Recording,
  rawMoments: RawMoment[],
): Clip[] {
  return rawMoments.map((moment) => {
    const paddedStart = Math.max(moment.startMs - consts.PRE_PAD_MS, 0);
    const paddedEnd = Math.min(
      moment.endMs + consts.POST_PAD_MS,
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

export function selectClips(clips: Clip[]): [Clip[], Clip[]] {
  const clipsByImportance = [...clips].sort(
    (a, b) =>
      consts.PLAY_TYPE_PRIORITY[a.type] - consts.PLAY_TYPE_PRIORITY[b.type] ||
      b.confidence - a.confidence,
  );
  const selectedClips: Clip[] = [];
  const extraClips: Clip[] = [];

  let index = 0;
  let reelLength = 0;
  while (
    reelLength < consts.MAX_REEL_LENGTH &&
    index < clipsByImportance.length
  ) {
    const clipLength =
      clipsByImportance[index].endMs - clipsByImportance[index].startMs;
    if (reelLength + clipLength <= consts.MAX_REEL_LENGTH) {
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
    capMs: consts.MAX_REEL_LENGTH,
  };
}
