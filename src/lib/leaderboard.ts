/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LEVELS } from '../components/Levels';
import { LeaderboardEntry, LevelConfig } from '../types';

// Seed AI competitive high scores (empty by default as requested)
export function generateSeedEntries(level: LevelConfig): LeaderboardEntry[] {
  return [];
}

// Loads high scores for a level.
export function getLeaderboard(
  levelId: number,
  playerBestTimes: Record<string, number> = {},
  customPlayerName?: string
): LeaderboardEntry[] {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return [];

  const key = `mirrordrive_leaderboard_level_${levelId}`;
  let entries: LeaderboardEntry[] = [];

  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      entries = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse leaderboard from localStorage', e);
  }

  // Ensure active customPlayerName and current best scores are injected reactively
  const playerName = customPlayerName || localStorage.getItem('mirrordrive_player_name') || 'PLAYER';
  const playerTime = playerBestTimes[`level${levelId}`] || null;

  // Filter out any duplicate name entry
  entries = entries.filter((e) => e.playerName !== playerName);

  if (playerTime && playerTime > 0) {
    entries.push({
      playerName,
      completionTime: playerTime,
      date: new Date().toISOString().split('T')[0],
      isPlayer: true,
    });
  }

  // Sort ascending by time
  entries.sort((a, b) => a.completionTime - b.completionTime);

  return entries.slice(0, 10);
}

// Submits a score. Sorts, filters duplicates, and returns final ranking details.
export function submitScore(
  levelId: number,
  playerName: string,
  time: number
): { rank: number | null; isNewBest: boolean; entries: LeaderboardEntry[] } {
  const key = `mirrordrive_leaderboard_level_${levelId}`;
  
  // Load current entries
  let entries = getLeaderboard(levelId, {}, playerName);

  // Check if player has a best time already
  const playerEntry = entries.find((e) => e.playerName === playerName);
  const isNewBest = !playerEntry || time < playerEntry.completionTime;

  if (isNewBest) {
    // Filter old entry out
    entries = entries.filter((e) => e.playerName !== playerName);
    // Push new entry
    entries.push({
      playerName,
      completionTime: time,
      date: new Date().toISOString().split('T')[0],
      isPlayer: true,
    });
    // Sort
    entries.sort((a, b) => a.completionTime - b.completionTime);
    // Write best scores limit to 10 entries
    const finalEntries = entries.slice(0, 10);
    try {
      localStorage.setItem(key, JSON.stringify(finalEntries));
    } catch (e) {
      console.warn('Failed to save updated leaderboard', e);
    }
  }

  // Get finalized sorted list
  const sortedEntries = getLeaderboard(levelId, {}, playerName);
  const activeTime = isNewBest ? time : (playerEntry?.completionTime || time);
  
  const finalRankIdx = sortedEntries.findIndex(
    (e) => e.playerName === playerName && e.completionTime === activeTime
  );
  
  const rank = finalRankIdx !== -1 ? finalRankIdx + 1 : null;

  return {
    rank,
    isNewBest,
    entries: sortedEntries,
  };
}
