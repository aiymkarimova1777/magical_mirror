
import { LevelConfig } from './types';

export const BALLOON_COLORS = [
  '#FF5252', // Қызыл
  '#1A237E', // Қанық Көк
  '#FFD740', // Сары
  '#2E7D32', // Қою Жасыл
  '#E040FB', // Күлгін
  '#FF4081', // Қызғылт
  '#00B8D4', // Ашық Көгілдір
  '#FF6D00'  // Қызғылт сары
];

export const GRAVITY = 1.1;
export const THROW_FORCE = -55; 
export const ARM_THRESHOLD = 0.75; 
export const THROW_THRESHOLD = 0.35; 

export const LEVELS: LevelConfig[] = [
  { name: "Балапан", icon: "🐣", goal: 5, spawn: 5, r_min: 20, r_max: 26, vx: 3.2 },
  { name: "Түлкі", icon: "🦊", goal: 10, spawn: 8, r_min: 17, r_max: 23, vx: 6.0 },
  { name: "Айдаһар", icon: "🐲", goal: 15, spawn: 10, r_min: 14, r_max: 20, vx: 9.5 },
];

export const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
  [11, 23], [12, 24], [23, 24],                    // Torso
  [23, 25], [25, 27], [24, 26], [26, 28]           // Legs
];
