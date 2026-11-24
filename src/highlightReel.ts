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

type Unchecked<Checked> = { [Field in keyof Checked]?: unknown };

type UncheckedMoment = Unchecked<RawMoment>;

export type UncheckedRecording = Unchecked<Recording>;

type CheckedFields<Field extends keyof RawMoment> = UncheckedMoment &
  Pick<RawMoment, Field>;

const PLAY_TYPES: ReadonlySet<unknown> = new Set(Object.values(PlayType));

function isObject(value: unknown): value is UncheckedMoment {
  return typeof value === 'object' && value !== null;
}

function hasFiniteNumbers(
  moment: UncheckedMoment,
): moment is CheckedFields<'startMs' | 'endMs' | 'confidence'> {
  return (
    Number.isFinite(moment.startMs) &&
    Number.isFinite(moment.endMs) &&
    Number.isFinite(moment.confidence)
  );
}

function hasValidPlayers(
  moment: UncheckedMoment,
): moment is CheckedFields<'players'> {
  return (
    Array.isArray(moment.players) &&
    moment.players.every((player: unknown) => typeof player === 'string')
  );
}

function fitsInRecording(
  moment: Pick<RawMoment, 'startMs' | 'endMs'>,
  recording: Recording,
): boolean {
  return moment.startMs < moment.endMs && moment.endMs <= recording.durationMs;
}

function hasValidConfidence(moment: Pick<RawMoment, 'confidence'>): boolean {
  return moment.confidence >= 0 && moment.confidence <= 1;
}

function isKnownPlayType(type: unknown): type is PlayType {
  return PLAY_TYPES.has(type);
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' || value === undefined) {
    return String(value);
  }
  return `${typeof value} ${JSON.stringify(value)}`;
}

function assertValidRecording(
  recording: UncheckedRecording,
): asserts recording is Recording {
  if (!Number.isSafeInteger(recording.id)) {
    throw new RangeError(
      `Expected recording.id to be a safe integer, got ${describeValue(recording.id)}`,
    );
  }
  if (
    typeof recording.durationMs !== 'number' ||
    !Number.isFinite(recording.durationMs) ||
    recording.durationMs <= 0
  ) {
    throw new RangeError(
      `Expected recording.durationMs to be a finite number above 0, got ${describeValue(recording.durationMs)}`,
    );
  }
}

export function filterRawMoments(
  recording: Recording,
  rawMoments: unknown[],
): RawMoment[] {
  return rawMoments.filter(
    (moment): moment is RawMoment =>
      isObject(moment) &&
      moment.recordingId === recording.id &&
      hasFiniteNumbers(moment) &&
      hasValidPlayers(moment) &&
      fitsInRecording(moment, recording) &&
      hasValidConfidence(moment) &&
      isKnownPlayType(moment.type),
  );
}

export function mergeRawMoments(rawMoments: RawMoment[]): RawMoment[] {
  const sortedMoments = [...rawMoments].sort((a, b) => a.startMs - b.startMs);
  const mergedMoments: RawMoment[] = [];
  const latestByType = new Map<PlayType, RawMoment>();

  for (const moment of sortedMoments) {
    const latestOfType = latestByType.get(moment.type);
    if (
      latestOfType &&
      moment.startMs - consts.MERGE_GAP_MS <= latestOfType.endMs
    ) {
      latestOfType.endMs = Math.max(latestOfType.endMs, moment.endMs);
      latestOfType.confidence = Math.max(
        latestOfType.confidence,
        moment.confidence,
      );
      latestOfType.players = [
        ...new Set([...latestOfType.players, ...moment.players]),
      ];
    } else {
      const merged = { ...moment };
      latestByType.set(moment.type, merged);
      mergedMoments.push(merged);
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

export function buildReel(
  recording: UncheckedRecording,
  rawMoments: unknown[],
): Reel {
  assertValidRecording(recording);
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
