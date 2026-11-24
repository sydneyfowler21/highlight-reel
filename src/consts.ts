import { PlayType } from './types';

export const MAX_REEL_LENGTH = 60000;
export const PRE_PAD_MS = 2000;
export const POST_PAD_MS = 3000;

export const PLAY_TYPE_PRIORITY: Record<PlayType, number> = {
  [PlayType.Goal]: 1,
  [PlayType.Save]: 2,
  [PlayType.BigPlay]: 3,
  [PlayType.Skill]: 4,
  [PlayType.NearMiss]: 5,
};
