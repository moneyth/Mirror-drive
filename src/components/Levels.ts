/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelConfig } from '../types';

export const WORLDS = [
  { id: 1, name: 'Shibuya Parkway', description: 'Perfect mirror grid with identical track synchronization in downtown Shibuya.' },
  { id: 2, name: 'Shinkansen Bypass', description: 'Asymmetrical obstacle layouts along the high-speed bullet train bypass lines.' },
  { id: 3, name: 'Kyoto Cherry Pass', description: 'Scenic cherry blossom paths and ancient boost bridges with asymmetrical powerups.' },
  { id: 4, name: 'Fuji Switchbacks', description: 'Slippery volcanic drift tracks, tight switchbacks, and extreme grip asymmetry.' },
  { id: 5, name: 'Akihabara Grid', description: 'Extreme pixel grid matrix, rotated coordinates, and rapid reflex overrides.' },
];

export const LEVELS: LevelConfig[] = Array.from({ length: 30 }).map((_, idx) => {
  const id = idx + 1;
  const world = Math.ceil(id / 6);
  const worldName = WORLDS[world - 1].name;
  
  // Progressively increase track length to avoid ultra-short play times
  const length = (400 + (world * 150) + ((id % 6) * 50)) * 5; // range from ~3000m to ~10000m (~18s - ~60s of active play)
  const baseSpeed = 1.0 + (world * 0.15) + ((id % 6) * 0.05); // slightly faster speeds in later worlds
  const difficultyScale = 0.8 + (world * 0.2) + ((id % 6) * 0.08); // denser spawns as we go

  // Pure English arcade names inspired by Touge Racing and regions
  const sectorNames = [
    'Meiji Gate', 'Hachiko Grid', 'Harajuku Pass', 'Yoyogi Drift', 'Shinjuku Route', 'Crossing Core',
    'Nozomi Line', 'Bullet Bypass', 'Linear Speed', 'Saitama Split', 'Yokohama Port', 'Overpass Route',
    'Gion Bridge', 'Kiyomizu Slope', 'Bamboo Alley', 'Kamo River', 'Pagoda Ascent', 'Zen Garden',
    'Subaru Forest', 'Aokigahara Mist', 'Gogome Slope', 'Drift Hairpin', 'Snow Cap Peak', 'Summit Loop',
    'Chuo Street', 'Retro Arcade', 'Arcade Core', 'Radio Route', 'Cyber Gate', 'Matrix Core'
  ];
  const name = sectorNames[idx] || `Sector ${id}`;

  return {
    id,
    world,
    worldName,
    name,
    length,
    baseSpeed,
    difficultyScale
  };
});

export function getLevelConfig(id: number): LevelConfig {
  const found = LEVELS.find((l) => l.id === id);
  if (found) return found;
  return LEVELS[0];
}
