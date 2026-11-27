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

export type PendingClip = Clip & { status: 'pending' };
export type ApprovedClip = Clip & { status: 'approved' };
export type ReelClip = PendingClip | ApprovedClip;
export type RejectedClip = Clip & { status: 'rejected' };

export type ClipSelection = {
  selected: ReelClip[];
  candidates: PendingClip[];
};

export type Reel = {
  clips: ReelClip[];
  candidates: PendingClip[];
  rejected: RejectedClip[];
  capMs: number;
};

export type ReviewErrorReason =
  'unknown-id' | 'already-rejected' | 'not-in-reel' | 'already-approved';

export type ReelSettings = {
  capMs: number;
  prePadMs: number;
  postPadMs: number;
};
