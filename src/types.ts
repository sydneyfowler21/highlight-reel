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

export type Reel = {
  shareable: boolean;
  clips: Clip[];
  candidates: Clip[];
  capMs: number;
};
