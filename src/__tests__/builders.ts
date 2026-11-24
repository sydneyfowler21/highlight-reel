import { type PlayType, type Clip, type RawMoment } from '../types';

export function at(gameClock: string): number {
  const [minutes, seconds] = gameClock.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

export function rawMoment(
  type: PlayType,
  startMs: number,
  endMs: number,
  extra: Partial<RawMoment> = {},
): RawMoment {
  return {
    recordingId: 1,
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
  extra: Partial<Clip> = {},
): Clip {
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
