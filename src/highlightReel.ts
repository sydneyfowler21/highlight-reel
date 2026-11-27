import * as consts from './consts';
import {
  PlayType,
  type Clip,
  type ClipSelection,
  type RawMoment,
  type Recording,
  type Reel,
  type ReelSettings,
} from './types';

export { DEFAULT_REEL_SETTINGS } from './consts';
export { PlayType } from './types';
export type {
  Clip,
  ClipSelection,
  RawMoment,
  Recording,
  Reel,
  ReelSettings,
} from './types';

type UncheckedMoment = { [Field in keyof RawMoment]?: unknown };

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

function assertValidRecording(recording: Recording): void {
  if (!Number.isFinite(recording.durationMs) || recording.durationMs <= 0) {
    throw new RangeError(
      `Expected recording.durationMs to be a finite number above 0, got ${recording.durationMs}`,
    );
  }
}

function assertValidSettings(settings: ReelSettings): void {
  if (!Number.isFinite(settings.capMs) || settings.capMs <= 0) {
    throw new RangeError(
      `Expected settings.capMs to be a finite number above 0, got ${settings.capMs}`,
    );
  }
  for (const field of ['prePadMs', 'postPadMs'] as const) {
    if (!Number.isFinite(settings[field]) || settings[field] < 0) {
      throw new RangeError(
        `Expected settings.${field} to be a finite number at or above 0, got ${settings[field]}`,
      );
    }
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
  padding: Pick<ReelSettings, 'prePadMs' | 'postPadMs'>,
): Clip[] {
  return rawMoments.map((moment, index) => {
    const paddedStart = Math.max(moment.startMs - padding.prePadMs, 0);
    const paddedEnd = Math.min(
      moment.endMs + padding.postPadMs,
      recording.durationMs,
    );

    return {
      id: `clip-${index}`,
      startMs: paddedStart,
      endMs: paddedEnd,
      type: moment.type,
      confidence: moment.confidence,
      players: [...moment.players],
      status: 'pending',
    };
  });
}

export function selectClips(clips: Clip[], capMs: number): ClipSelection {
  const clipsByImportance = [...clips].sort(
    (a, b) =>
      consts.PLAY_TYPE_PRIORITY[a.type] - consts.PLAY_TYPE_PRIORITY[b.type] ||
      b.confidence - a.confidence,
  );
  const selected: Clip[] = [];
  const candidates: Clip[] = [];

  let index = 0;
  let reelLength = 0;
  while (reelLength < capMs && index < clipsByImportance.length) {
    const clipLength =
      clipsByImportance[index].endMs - clipsByImportance[index].startMs;
    if (reelLength + clipLength <= capMs) {
      if (
        selected.some(
          (clip) =>
            clip.startMs < clipsByImportance[index].endMs &&
            clipsByImportance[index].startMs < clip.endMs,
        )
      ) {
        candidates.push(clipsByImportance[index]);
      } else {
        selected.push(clipsByImportance[index]);
        reelLength += clipLength;
      }
    } else {
      candidates.push(clipsByImportance[index]);
    }

    index++;
  }

  candidates.push(...clipsByImportance.slice(index));

  return { selected, candidates };
}

export function buildReelFromRawMoments(
  recording: Recording,
  rawMoments: unknown[],
  settings: ReelSettings = consts.DEFAULT_REEL_SETTINGS,
): Reel {
  assertValidRecording(recording);
  assertValidSettings(settings);
  const filteredMoments = filterRawMoments(recording, rawMoments);
  const mergedMoments = mergeRawMoments(filteredMoments);
  const clips = convertToClips(recording, mergedMoments, settings);
  const { selected, candidates } = selectClips(clips, settings.capMs);
  const sortedSelected = [...selected].sort((a, b) => a.startMs - b.startMs);

  return {
    clips: sortedSelected,
    candidates,
    rejected: [],
    capMs: settings.capMs,
  };
}

export function isShareable(reel: Reel): boolean {
  const totalMs = reel.clips.reduce(
    (sum, clip) => sum + clip.endMs - clip.startMs,
    0,
  );
  return (
    reel.clips.length > 0 &&
    reel.clips.every((clip) => clip.status === 'approved') &&
    totalMs <= reel.capMs
  );
}
