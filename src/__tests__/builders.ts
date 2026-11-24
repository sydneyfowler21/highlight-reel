/**
 * Builders for test data. Each fills in defaults (recording 1, confidence 0.9,
 * players ['p1'], status 'pending') that the caller can override.
 */

import { type PlayType, type Clip, type RawMoment } from '../types';

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
