export type Recording = {
  id: string;
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
  recordingId: string;
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

export type ClipSelection = {
  selected: Clip[];
  candidates: Clip[];
};

export type Reel = {
  clips: Clip[];
  candidates: Clip[];
  rejected: Clip[];
  capMs: number;
};

export type ReviewErrorReason =
  'unknown-id' | 'already-rejected' | 'not-in-reel' | 'already-approved';

export type ReelSettings = {
  capMs: number;
  prePadMs: number;
  postPadMs: number;
};
