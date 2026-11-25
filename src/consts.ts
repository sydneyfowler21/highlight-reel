import { PlayType, type ReelSettings } from './types';

export const DEFAULT_REEL_SETTINGS: Readonly<ReelSettings> = {
  capMs: 60_000,
  prePadMs: 2_000,
  postPadMs: 3_000,
};
export const MERGE_GAP_MS = 1000;

export const PLAY_TYPE_PRIORITY: Record<PlayType, number> = {
  [PlayType.Goal]: 1,
  [PlayType.Save]: 2,
  [PlayType.BigPlay]: 3,
  [PlayType.Skill]: 4,
  [PlayType.NearMiss]: 5,
};
