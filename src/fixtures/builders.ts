import {
  type PlayType,
  type Clip,
  type PendingClip,
  type RawMoment,
  type ReelClip,
  type RejectedClip,
} from '../types';

export function at(gameClock: string): number {
  const minutesAndSeconds = /^(\d+):([0-5]\d)$/.exec(gameClock);
  if (!minutesAndSeconds) {
    throw new Error(`Expected a game clock like '8:30', got '${gameClock}'`);
  }
  const [, minutes, seconds] = minutesAndSeconds.map(Number);
  return (minutes * 60 + seconds) * 1000;
}

export function rawMoment(
  type: PlayType,
  startMs: number,
  endMs: number,
  extra: Partial<RawMoment> = {},
): RawMoment {
  return {
    recordingId: 'rec-1',
    type,
    startMs,
    endMs,
    confidence: 0.9,
    players: ['p1'],
    ...extra,
  };
}

export function clip(
  id: string,
  type: PlayType,
  startMs: number,
  endMs: number,
  extra: Partial<Omit<Clip, 'status'>> = {},
): PendingClip {
  return {
    id,
    type,
    startMs,
    endMs,
    confidence: 0.9,
    players: ['p1'],
    status: 'pending',
    ...extra,
  };
}

export function approved(pendingClip: PendingClip): ReelClip {
  return { ...pendingClip, status: 'approved' };
}

export function rejected(pendingClip: PendingClip): RejectedClip {
  return { ...pendingClip, status: 'rejected' };
}
