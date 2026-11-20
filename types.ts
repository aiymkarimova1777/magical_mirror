
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_DONE = 'LEVEL_DONE',
  FINISHED = 'FINISHED'
}

export interface Target {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  color: string;
  state: 'alive' | 'popping';
  pop_t: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  trail: { x: number; y: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface LevelConfig {
  name: string;
  icon: string;
  goal: number;
  spawn: number;
  r_min: number;
  r_max: number;
  vx: number;
}

export type HandState = 'idle' | 'armed';

export interface HandsTracker {
  L: { state: HandState; x: number; y: number };
  R: { state: HandState; x: number; y: number };
}
