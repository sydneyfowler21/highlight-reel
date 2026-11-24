export type Recording = {
  id: number;
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
  recordingId: number;
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
  clips: Clip[]; // What's in the reel
  candidates: Clip[]; // Prioritized list of extra clips
  capMs: number;
};
