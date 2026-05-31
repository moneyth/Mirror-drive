/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameState {
  TITLE = 'TITLE',
  LEVEL_SELECT = 'LEVEL_SELECT',
  GAMEPLAY = 'GAMEPLAY',
  GAMEOVER = 'GAMEOVER',
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}

export enum GameMode {
  MIRRORED_SOLO = 'MIRRORED_SOLO', // Original signature
}

export enum DynamicTheme {
  WORLD_1 = 'WORLD_1',
  WORLD_2 = 'WORLD_2',
  WORLD_3 = 'WORLD_3',
  WORLD_4 = 'WORLD_4',
  WORLD_5 = 'WORLD_5',
}

export interface PlayerStats {
  speed: number;       // Current speed in km/h
  isCrashed: boolean;
  crashTimer: number;  // Duration of current crash impact
  x: number;           // Current lateral lane coordinate, range from -1.0 to 1.0 (center is 0)
  targetX: number;     // Target lateral position for interpolation
  roadOffset: number;  // Current absolute road coordinate for scrolling background
  hitFlash: number;    // Flash indicator opacity
  boostDuration: number; // Remaining time of speed boosts
  completed: boolean;   // Has crossed the finish line
}

export interface Obstacle {
  id: string;
  type: 'BARRIER' | 'TRAFFIC_CAR' | 'BOOST_PAD' | 'OIL_SLICK';
  lane: number;        // -1.0 to 1.0 position
  worldY: number;      // Scroll position relative to the viewport (0 to height)
  passed: boolean;
  hit?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface LevelConfig {
  id: number;          // 1 to 30
  world: number;       // 1 to 5
  worldName: string;
  name: string;
  length: number;      // Total meters to travel (e.g. 500 to 2000)
  baseSpeed: number;    // Target normal scroll speed multiplier
  difficultyScale: number; // Spawn rate scale
}

export interface LeaderboardEntry {
  playerName: string;
  completionTime: number;
  date: string;
  isPlayer?: boolean;
}

