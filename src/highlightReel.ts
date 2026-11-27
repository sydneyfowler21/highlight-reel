import * as consts from './consts';
import {
  PlayType,
  type Clip,
  type ClipSelection,
  type PendingClip,
  type RawMoment,
  type Recording,
  type Reel,
  type ReelClip,
  type ReelSettings,
  type ReviewErrorReason,
} from './types';

export { DEFAULT_REEL_SETTINGS } from './consts';
export { PlayType } from './types';
export type {
  ApprovedClip,
  Clip,
  ClipSelection,
  PendingClip,
  RawMoment,
  Recording,
  Reel,
  ReelClip,
  ReelSettings,
  RejectedClip,
  ReviewErrorReason,
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

function overlapsRecording(
  moment: Pick<RawMoment, 'startMs' | 'endMs'>,
  recording: Recording,
): boolean {
  return (
    moment.startMs < moment.endMs &&
    moment.endMs > 0 &&
    moment.startMs < recording.durationMs
  );
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
      overlapsRecording(moment, recording) &&
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
): PendingClip[] {
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

function overlaps(a: Clip, b: Clip): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function lengthMs(clip: Clip): number {
  return clip.endMs - clip.startMs;
}

function totalLengthMs(clips: Clip[]): number {
  return clips.reduce((sum, clip) => sum + lengthMs(clip), 0);
}

function sortedByStart(clips: ReelClip[]): ReelClip[] {
  return [...clips].sort((a, b) => a.startMs - b.startMs);
}

export function selectClips(
  keptClips: ReelClip[],
  clips: PendingClip[],
  capMs: number,
): ClipSelection {
  const clipsByImportance = [...clips].sort(
    (a, b) =>
      consts.PLAY_TYPE_PRIORITY[a.type] - consts.PLAY_TYPE_PRIORITY[b.type] ||
      b.confidence - a.confidence,
  );
  const selected = [...keptClips];
  const candidates: PendingClip[] = [];
  let reelLengthMs = totalLengthMs(keptClips);

  for (const clip of clipsByImportance) {
    const fits = reelLengthMs + lengthMs(clip) <= capMs;
    if (fits && !selected.some((chosen) => overlaps(chosen, clip))) {
      selected.push(clip);
      reelLengthMs += lengthMs(clip);
    } else {
      candidates.push(clip);
    }
  }

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
  const { selected, candidates } = selectClips([], clips, settings.capMs);

  return {
    clips: sortedByStart(selected),
    candidates,
    rejected: [],
    capMs: settings.capMs,
  };
}

export function isShareable(reel: Reel): boolean {
  return (
    reel.clips.length > 0 &&
    reel.clips.every((clip) => clip.status === 'approved') &&
    totalLengthMs(reel.clips) <= reel.capMs
  );
}

export class ReviewError extends RangeError {
  readonly reason: ReviewErrorReason;

  constructor(reason: ReviewErrorReason, message: string) {
    super(message);
    this.name = 'ReviewError';
    this.reason = reason;
  }
}

function alreadyRejectedError(clipId: string): ReviewError {
  return new ReviewError(
    'already-rejected',
    `Clip ${clipId} was already rejected`,
  );
}

function errorForIdNotInReel(reel: Reel, clipId: string): ReviewError {
  if (reel.rejected.some((clip) => clip.id === clipId)) {
    return alreadyRejectedError(clipId);
  }
  if (reel.candidates.some((clip) => clip.id === clipId)) {
    return new ReviewError(
      'not-in-reel',
      `Clip ${clipId} is a candidate, not a clip in the reel`,
    );
  }
  return new ReviewError(
    'unknown-id',
    `No clip with id ${clipId} in this reel`,
  );
}

function findPendingClip(reel: Reel, clipId: string): PendingClip {
  const clipInReel = reel.clips.find((clip) => clip.id === clipId);
  if (!clipInReel) {
    throw errorForIdNotInReel(reel, clipId);
  }
  switch (clipInReel.status) {
    case 'pending':
      return clipInReel;
    case 'approved':
      throw new ReviewError(
        'already-approved',
        `Clip ${clipId} is already approved`,
      );
    default: {
      const unhandledClip: never = clipInReel;
      throw new Error(
        `Clip ${clipId} has a status review does not handle: ${JSON.stringify(unhandledClip)}`,
      );
    }
  }
}

export function approve(reel: Reel, clipId: string): Reel {
  const pendingClip = findPendingClip(reel, clipId);
  return {
    ...reel,
    clips: reel.clips.map((clip) =>
      clip === pendingClip ? { ...clip, status: 'approved' } : clip,
    ),
  };
}

export function reject(reel: Reel, clipId: string): Reel {
  const pendingClip = findPendingClip(reel, clipId);
  const keptClips = reel.clips.filter((clip) => clip !== pendingClip);
  const { selected, candidates } = selectClips(
    keptClips,
    reel.candidates,
    reel.capMs,
  );

  return {
    clips: sortedByStart(selected),
    candidates,
    rejected: [...reel.rejected, { ...pendingClip, status: 'rejected' }],
    capMs: reel.capMs,
  };
}
