/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LEVELS, WORLDS } from './Levels';
import { ArrowLeft, Lock, Star, Zap, Volume2, Music, Check, Trophy, Crown, Award, LogOut, Trash2 } from 'lucide-react';
import audioEngine from './AudioEngine';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { getLeaderboard } from '../lib/leaderboard';
import { fetchAllScoresFromFirebase, isFirebaseEnabled } from '../firebase';

interface LevelSelectScreenProps {
  unlockedLevels: number[];
  levelBestTimes: Record<string, number>;
  newlySetRecordLevelIds?: number[];
  onSelectLevel: (levelId: number) => void;
  onBack: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isFirebaseEnabled: boolean;
  isSyncing: boolean;
  playerName: string;
  onUpdatePlayerName: (newName: string) => void;
  onSyncLeaderboards?: () => Promise<void>;
  onLogout?: () => void;
  onDeleteAccount?: () => Promise<void>;
}

export default function LevelSelectScreen({
  unlockedLevels,
  levelBestTimes,
  newlySetRecordLevelIds = [],
  onSelectLevel,
  onBack,
  user,
  onSignIn,
  onSignOut,
  isFirebaseEnabled,
  isSyncing,
  playerName,
  onUpdatePlayerName,
  onSyncLeaderboards,
  onLogout,
  onDeleteAccount
}: LevelSelectScreenProps) {
  // Find highest unlocked level that does not have a completion time yet (newly unlocked)
  const newlyUnlockedId = useMemo(() => {
    const uncompleted = unlockedLevels.filter((id) => !levelBestTimes[`level${id}`]);
    if (uncompleted.length === 0) return null;
    return Math.max(...uncompleted);
  }, [unlockedLevels, levelBestTimes]);

  const [selectedWorld, setSelectedWorld] = useState<number>(() => {
    if (newlyUnlockedId) {
      return Math.ceil(newlyUnlockedId / 6);
    }
    return 1;
  });

  const [keyFocusId, setKeyFocusId] = useState<number>(() => {
    if (newlyUnlockedId) {
      return newlyUnlockedId;
    }
    return 1;
  });

  const [animUnlockedLevels, setAnimUnlockedLevels] = useState<number[]>(() => {
    if (newlyUnlockedId) {
      return unlockedLevels.filter((id) => id !== newlyUnlockedId);
    }
    return unlockedLevels;
  });

  const [leaderboardLevelId, setLeaderboardLevelId] = useState<number | null>(null);
  const [showGlobalRankings, setShowGlobalRankings] = useState(false);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<number>(1);

  const medalCounts = useMemo(() => {
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    LEVELS.forEach((lvl) => {
      const finalEntries = getLeaderboard(lvl.id, levelBestTimes, playerName);
      const playerIndex = finalEntries.findIndex((e) => e.isPlayer);
      if (playerIndex === 0) {
        gold++;
      } else if (playerIndex === 1) {
        silver++;
      } else if (playerIndex === 2) {
        bronze++;
      }
    });

    return { gold, silver, bronze };
  }, [levelBestTimes, playerName]);

  const overallStanding = useMemo(() => {
    let sumRank = 0;
    let count = 0;
    LEVELS.forEach((lvl) => {
      const bestTime = levelBestTimes[`level${lvl.id}`];
      if (bestTime) {
        const finalEntries = getLeaderboard(lvl.id, levelBestTimes, playerName);
        const playerIndex = finalEntries.findIndex((e) => e.isPlayer);
        if (playerIndex !== -1) {
          sumRank += (playerIndex + 1);
          count++;
        }
      }
    });
    if (count === 0) return 'UNRANKED';
    const avg = Math.round(sumRank / count);
    if (avg === 1) return '1ST';
    if (avg === 2) return '2ND';
    if (avg === 3) return '3RD';
    return `${avg}TH`;
  }, [levelBestTimes, playerName]);

  useEffect(() => {
    if (newlyUnlockedId) {
      const timer = setTimeout(() => {
        setAnimUnlockedLevels(unlockedLevels);
      }, 500); // 500ms delay for a perfect dramatic wait before unlocking
      return () => clearTimeout(timer);
    } else {
      setAnimUnlockedLevels(unlockedLevels);
    }
  }, [unlockedLevels, newlyUnlockedId]);

  // Filter levels for the currently active world
  const activeWorldLevels = LEVELS.filter((l) => l.world === selectedWorld);

  // Dynamic scale factor to fit perfectly in viewport
  const [scaleFactor, setScaleFactor] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const padding = window.innerWidth < 640 ? 4 : 24;
      const scaleX = (window.innerWidth - padding) / 800;
      const scaleY = (window.innerHeight - padding) / 450;
      // Clamped minimum of 0.15 prevents full collapse on extremely tight screens or initial mount frames
      const scale = Math.max(0.15, Math.min(scaleX, scaleY, 1.5));
      setScaleFactor(scale);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard Navigation through levels grid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentActiveIndex = activeWorldLevels.findIndex((l) => l.id === keyFocusId);
      
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        audioEngine.playClick();
        if (currentActiveIndex < activeWorldLevels.length - 1) {
          setKeyFocusId(activeWorldLevels[currentActiveIndex + 1].id);
        } else if (selectedWorld < 5) {
          // Wrap to next world
          const nextWorld = selectedWorld + 1;
          setSelectedWorld(nextWorld);
          setKeyFocusId(LEVELS.find((l) => l.world === nextWorld)!.id);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        audioEngine.playClick();
        if (currentActiveIndex > 0) {
          setKeyFocusId(activeWorldLevels[currentActiveIndex - 1].id);
        } else if (selectedWorld > 1) {
          // Back to previous world
          const prevWorld = selectedWorld - 1;
          setSelectedWorld(prevWorld);
          const prevWorldLevels = LEVELS.filter((l) => l.world === prevWorld);
          setKeyFocusId(prevWorldLevels[prevWorldLevels.length - 1].id);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        audioEngine.playClick();
        // Move upward inside grid (3 columns: subtract 3)
        if (currentActiveIndex >= 3) {
          setKeyFocusId(activeWorldLevels[currentActiveIndex - 3].id);
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        audioEngine.playClick();
        // Move downward inside grid (3 columns: add 3)
        if (currentActiveIndex < 3 && currentActiveIndex + 3 < activeWorldLevels.length) {
          setKeyFocusId(activeWorldLevels[currentActiveIndex + 3].id);
        }
      } else if (e.key === 'Escape') {
        audioEngine.playClick();
        onBack();
      } else if (e.key === 'Enter' || e.key === ' ') {
        const selected = LEVELS.find((l) => l.id === keyFocusId);
        if (selected && unlockedLevels.includes(selected.id)) {
          audioEngine.playClick();
          onSelectLevel(selected.id);
        } else {
          // Play a dull click for locked level
          audioEngine.playClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyFocusId, selectedWorld, unlockedLevels, activeWorldLevels, onBack, onSelectLevel]);

  const handleLevelClick = (levelId: number) => {
    if (unlockedLevels.includes(levelId)) {
      audioEngine.playClick();
      onSelectLevel(levelId);
    }
  };

  const currentWorldInfo = WORLDS.find((w) => w.id === selectedWorld);

  return (
    <div 
      style={{
        width: `${800 * scaleFactor}px`,
        height: `${450 * scaleFactor}px`,
      }}
      className="relative overflow-hidden select-none flex-shrink-0"
    >
      <div
        style={{
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top left',
          width: '800px',
          height: '450px',
        }}
        className="absolute top-0 left-0 overflow-hidden flex-shrink-0"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden select-none flex flex-col justify-between p-4 font-mono text-left bg-gradient-to-b from-sky-100 via-sky-50 to-slate-50 rounded-lg border-4 border-slate-400 shadow-2xl w-full h-full"
        >
        {/* Scanline CRT overlay */}
        <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.03)_50%)] bg-[length:100%_4px]" />

        {/* Header Panel */}
        <div className="flex justify-between items-center border-b border-slate-250 pb-2 z-10 font-bold">
          <button
            onClick={() => {
              audioEngine.playClick();
              onBack();
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 hover:border-slate-400 transition-all font-semibold uppercase text-xs cursor-pointer shadow-sm"
          >
            <ArrowLeft size={12} />
            <span>BACK</span>
          </button>

          <span className="text-rose-600 font-extrabold tracking-widest text-sm uppercase font-sans flex items-center gap-1.5">
            <span>SELECT SPEEDWAY</span>
          </span>

          <div className="flex items-center gap-2">
            {isFirebaseEnabled && (
              <div className="flex items-center bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm text-xs gap-3">
                {isSyncing ? (
                  <div className="flex items-center gap-1 text-amber-600 font-semibold font-mono text-[9px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>SYNCING...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-emerald-600 font-mono text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="truncate max-w-[90px] font-black uppercase">DRVR: {playerName}</span>
                    </div>

                    {onLogout && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          audioEngine.playClick();
                          onLogout();
                        }}
                        className="flex items-center gap-1 text-[8px] text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-1.5 py-0.5 rounded font-black cursor-pointer leading-none transition duration-150 uppercase"
                      >
                        <LogOut size={9} />
                        <span>LOGOUT</span>
                      </button>
                    )}

                    {onDeleteAccount && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          audioEngine.playClick();
                          const confirmed = window.confirm("Are you sure? This will delete your records permanently.");
                          if (confirmed) {
                            await onDeleteAccount();
                          }
                        }}
                        className="flex items-center gap-1 text-[8px] text-rose-700 hover:bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded font-black cursor-pointer leading-none transition duration-150 uppercase"
                      >
                        <Trash2 size={9} />
                        <span>DELETE</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => {
                audioEngine.playClick();
                setShowGlobalRankings(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-sans font-black text-[10px] uppercase tracking-wider rounded shadow-sm cursor-pointer border border-amber-500 active:scale-95 transition-all shadow-md animate-pulse"
              id="global-standings-header-btn"
            >
              <Trophy size={11} className="fill-slate-950" />
              <span>LEADERBOARD</span>
            </button>

            <span className="text-slate-800 font-bold text-[11px] uppercase tracking-wider bg-slate-200 border border-slate-300 px-2.5 py-1 rounded shadow-sm">
              UNLOCKED: {unlockedLevels.length} / 30
            </span>
          </div>
        </div>

        {/* World Selection Tabs */}
        <div className="grid grid-cols-5 gap-1.5 py-2 z-10 font-bold">
          {WORLDS.map((world) => {
            const isSelected = selectedWorld === world.id;
            const isWorldUnlocked = LEVELS.some(
              (lvl) => lvl.world === world.id && unlockedLevels.includes(lvl.id)
            );

            return (
              <button
                key={world.id}
                onClick={() => {
                  audioEngine.playClick();
                  setSelectedWorld(world.id);
                  const firstLvlOfWorld = LEVELS.find((l) => l.world === world.id);
                  if (firstLvlOfWorld) {
                    setKeyFocusId(firstLvlOfWorld.id);
                  }
                }}
                className={`py-1 py-1.5 text-center font-bold font-sans text-xs rounded cursor-pointer border tracking-wider transition-all duration-150 ${
                  isSelected
                    ? 'bg-rose-500 text-white border-rose-600 shadow-sm font-extrabold'
                    : isWorldUnlocked
                    ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    : 'bg-slate-100/60 text-slate-400 border-slate-200 opacity-60'
                }`}
              >
                {world.id === 1 && 'SECTOR 1'}
                {world.id === 2 && 'SECTOR 2'}
                {world.id === 3 && 'SECTOR 3'}
                {world.id === 4 && 'SECTOR 4'}
                {world.id === 5 && 'SECTOR 5'}
              </button>
            );
          })}
        </div>

        {/* Center Grid Area containing Active World Meta and the 6 Level grids */}
        <div className="flex-1 grid grid-cols-12 gap-4 items-center py-2 z-10">
          
          {/* World description side-panel */}
          <motion.div
            key={`${selectedWorld}-desc`}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="col-span-4 flex flex-col justify-center h-full p-3 bg-white/95 rounded-lg border border-slate-250 text-left shadow-sm"
          >
            <span className="text-rose-500 font-sans text-xs tracking-widest uppercase font-extrabold">
              AREA {selectedWorld}
            </span>
            <span className="text-slate-900 text-sm font-bold uppercase leading-tight mt-1">
              {currentWorldInfo?.name}
            </span>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {currentWorldInfo?.description}
            </p>
            <div className="mt-4 flex flex-col gap-1 border-t border-slate-200 pt-2">
              <span className="text-slate-550 text-[10px] uppercase font-bold tracking-wider">
                MECHANISM:
              </span>
              <div className="flex items-center gap-1.5 text-rose-500 text-[11px] uppercase font-black">
                <Zap size={12} />
                <span>
                  {selectedWorld === 1 && 'MIRRORED STEERING'}
                  {selectedWorld === 2 && 'SEPARATE ENGINES'}
                  {selectedWorld === 3 && 'ASYM BOOST PADS'}
                  {selectedWorld === 4 && 'CORNER PHYSICS'}
                  {selectedWorld === 5 && 'ROTATED STAGES'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Level selection panels: 6 positions inside 3 columns x 2 rows */}
          <div className="col-span-8 grid grid-cols-3 gap-2.5">
            {activeWorldLevels.map((lvl) => {
              const isUnlockedVisually = animUnlockedLevels.includes(lvl.id);
              const isFocused = keyFocusId === lvl.id;
              const completionTime = levelBestTimes[`level${lvl.id}`];
              const isNewRecord = newlySetRecordLevelIds.includes(lvl.id);

              // Realtime ranking lookup
              const finalEntries = getLeaderboard(lvl.id, levelBestTimes, playerName);
              const playerIndex = finalEntries.findIndex((e) => e.isPlayer);
              const playerRank = playerIndex !== -1 ? playerIndex + 1 : null;

              return (
                <motion.div
                  key={lvl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: activeWorldLevels.indexOf(lvl) * 0.04, ease: 'easeOut' }}
                  whileHover={{ scale: isUnlockedVisually ? 1.025 : 1 }}
                  whileTap={{ scale: isUnlockedVisually ? 0.98 : 1 }}
                  onClick={() => handleLevelClick(lvl.id)}
                  onMouseEnter={() => setKeyFocusId(lvl.id)}
                  className={`relative h-[115px] p-2.5 rounded-md text-left flex flex-col justify-between transition-all duration-300 border cursor-pointer ${
                    !isUnlockedVisually
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      : isNewRecord
                      ? isFocused
                        ? 'bg-amber-100 text-slate-900 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-amber-50/95 text-amber-900 border-amber-300'
                      : isFocused
                      ? 'bg-rose-50 text-slate-900 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-350 shadow-sm'
                  }`}
                >
                  {/* Level Title */}
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[11.5px] uppercase font-extrabold text-slate-500 flex items-center gap-1.5">
                      STAGE {String(lvl.id).padStart(2, '0')}
                      {isNewRecord && (
                        <span className="text-[8.5px] font-sans font-black bg-amber-100 text-amber-700 border border-amber-300 px-1 py-0.5 rounded tracking-widest animate-pulse flex items-center gap-0.5">
                          🏆 RECORD
                        </span>
                      )}
                    </span>
                    
                    {/* Decorative Lock to Checkmark to Star deck */}
                    <div className="relative w-4 h-4 flex items-center justify-center">
                      <Lock
                        size={11}
                        className={`absolute transition-all duration-700 ease-out ${
                          isUnlockedVisually
                            ? 'opacity-0 scale-50 rotate-90 pointer-events-none'
                            : 'text-slate-400 opacity-100 scale-100 rotate-0'
                        }`}
                      />
                      <Check
                        size={12}
                        className={`absolute transition-all duration-700 ease-out text-emerald-500 font-bold ${
                          isUnlockedVisually && !completionTime
                            ? 'opacity-100 scale-100 rotate-0'
                            : 'opacity-0 scale-50 -rotate-90 pointer-events-none'
                        }`}
                      />
                      <Star
                        size={11}
                        className={`absolute transition-all duration-700 ease-out fill-emerald-500 text-emerald-500 ${
                          completionTime
                            ? 'opacity-100 scale-100 rotate-0 animate-pulse'
                            : 'opacity-0 scale-50 rotate-90 pointer-events-none'
                        }`}
                      />
                    </div>
                  </div>

                  {isUnlockedVisually ? (
                    <>
                      {/* Record Info */}
                      <div className="flex flex-col gap-0.5 mt-0.5 flex-1 justify-center">
                        <span className="text-[9px] text-slate-500 uppercase font-sans font-extrabold">
                          TARGET DIST:
                        </span>
                        <span className="text-[11px] text-slate-800 font-black tracking-tight font-mono">
                          {lvl.length} METERS
                        </span>
                      </div>

                      {/* Speed Vault & Medals Bottom Row */}
                      <div className="flex justify-between items-center w-full border-t border-slate-100 pt-1.5 text-xs mt-1.5 min-h-[24px]">
                        {/* 1. Medals & Best Time */}
                        <div>
                          {playerRank && playerRank <= 3 ? (
                            <RankingBadge rank={playerRank} />
                          ) : completionTime ? (
                            <div className="text-[8.5px] font-mono font-bold text-slate-450 uppercase tracking-widest bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                              {completionTime.toFixed(2)}S
                            </div>
                          ) : (
                            <span className="text-[8px] font-mono font-bold text-slate-400 tracking-wider">
                              UNBEATEN
                            </span>
                          )}
                        </div>

                        {/* 2. Interactive Speed Vault Trophy button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // crucial to prevent initiating gameplay!
                            audioEngine.playClick();
                            setLeaderboardLevelId(lvl.id);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all font-sans font-black text-[8.5px] uppercase tracking-wider select-none border cursor-pointer ${
                            isFocused
                              ? 'bg-rose-500 text-white border-rose-600 shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-rose-500 hover:text-white border-slate-200 hover:border-rose-600 shadow-sm'
                          }`}
                          title="View Speed Vault Rankings"
                        >
                          <Trophy 
                            size={9} 
                            className={`${isFocused ? 'text-white fill-white' : 'text-rose-500 fill-rose-100'} animate-bounce`} 
                            style={{ animationDuration: '3s' }} 
                          />
                          <span>VAULT</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-450 text-[10.5px] font-black tracking-widest uppercase">
                      LOCKED
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom control bar instructions */}
        <div className="flex justify-between items-center border-t border-slate-250 pt-2 mt-1 z-10 font-mono text-[10px] font-bold text-slate-500 tracking-wider">
          <span>ARROW KEYS: SELECT &middot; ENTER: START</span>
          <span className="text-rose-600/80">DRIVE SAFELY, AVOID ALL COLLISIONS</span>
        </div>
      </motion.div>
      </div>

      {/* Speed Vault Leaderboard Modal */}
      <AnimatePresence>
        {leaderboardLevelId !== null && (
          <LeaderboardModal
            levelId={leaderboardLevelId}
            playerName={playerName}
            levelBestTimes={levelBestTimes}
            onClose={() => setLeaderboardLevelId(null)}
            onSyncLeaderboards={onSyncLeaderboards}
          />
        )}
      </AnimatePresence>

      {/* Global Rankings Leaderboard Modal */}
      <AnimatePresence>
        {showGlobalRankings && (
          <GlobalRankingsModal
            playerName={playerName}
            levelBestTimes={levelBestTimes}
            onClose={() => setShowGlobalRankings(false)}
            medalCounts={medalCounts}
            overallStanding={overallStanding}
            selectedLeaderboardId={selectedLeaderboardId}
            setSelectedLeaderboardId={setSelectedLeaderboardId}
            onSyncLeaderboards={onSyncLeaderboards}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS FOR HIGH SCORE METRICS
// ==========================================

function RankingBadge({ rank }: { rank: number }) {
  if (rank < 1 || rank > 3) return null;
  const colors = {
    1: { bg: 'bg-amber-400/10 border-amber-500/30 text-amber-500 shadow-amber-500/5', text: 'GOLD 1ST' },
    2: { bg: 'bg-slate-300/15 border-slate-400/40 text-slate-300 shadow-slate-300/5', text: 'SLVR 2ND' },
    3: { bg: 'bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-orange-500/5', text: 'BRNZ 3RD' },
  }[rank as 1 | 2 | 3];

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider shadow-sm animate-pulse ${colors.bg}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-300' : 'bg-orange-400'}`}></span>
      </span>
      <span>{colors.text}</span>
    </div>
  );
}

interface LeaderboardModalProps {
  levelId: number;
  playerName: string;
  levelBestTimes: Record<string, number>;
  onClose: () => void;
  onSyncLeaderboards?: () => Promise<void>;
}

function LeaderboardModal({ levelId, playerName, levelBestTimes, onClose, onSyncLeaderboards }: LeaderboardModalProps) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return null;

  const [syncCounter, setSyncCounter] = useState(0);

  const entries = getLeaderboard(levelId, levelBestTimes, playerName);

  useEffect(() => {
    if (onSyncLeaderboards) {
      onSyncLeaderboards().then(() => {
        setSyncCounter((prev) => prev + 1);
      });
    }
  }, [onSyncLeaderboards]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-mono select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-sm bg-slate-900 border-4 border-rose-500 rounded-2xl p-5 shadow-[0_0_30px_rgba(244,63,94,0.35)] text-slate-100 flex flex-col gap-4 font-mono border-solid"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 w-7 h-7 rounded-full flex items-center justify-center font-sans font-bold text-[10px] cursor-pointer border border-slate-700 hover:scale-105 active:scale-95 transition-all"
        >
          ✕
        </button>

        <div className="flex flex-col items-center text-center gap-1 border-b border-rose-500/20 pb-3">
          <div className="flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-500 animate-bounce fill-amber-500/20" />
            <span className="text-[8.5px] text-rose-500 font-extrabold uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              SPEED VAULT SECURE
            </span>
          </div>
          <h2 className="text-base font-black text-white uppercase italic mt-1 font-sans">
            STAGE {String(level.id).padStart(2, '0')}: {level.name}
          </h2>
          <span className="text-[8.5px] text-slate-450 uppercase tracking-widest">
            SECTOR STANDINGS &middot; {level.length} METERS
          </span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-0.5">
          {entries.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-[9px] uppercase font-bold tracking-widest">
              NO CALLSIGNS ENROLLED
            </div>
          ) : (
            entries.map((entry, idx) => {
              const rank = idx + 1;
              const isCurrentPlayer = entry.isPlayer || entry.playerName === playerName;

              const rankColors = {
                1: 'text-amber-400 font-extrabold',
                2: 'text-slate-300 font-bold',
                3: 'text-orange-400 font-bold',
              }[rank] || 'text-slate-450 font-medium';

              const rankMedal = {
                1: '🥇',
                2: '🥈',
                3: '🥉',
              }[rank] || `${rank}.`;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-3 py-1.5 rounded border text-[11px] transition-all ${
                    isCurrentPlayer
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.15)] font-extrabold relative overflow-hidden'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                  }`}
                >
                  {isCurrentPlayer && (
                    <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-rose-500 animate-pulse" />
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`w-5 text-center text-xs font-black ${rankColors}`}>
                      {rankMedal}
                    </span>
                    <span className="uppercase tracking-wider">
                      {entry.playerName}
                    </span>
                    {isCurrentPlayer && (
                      <span className="text-[7.5px] font-black bg-rose-500 text-slate-950 px-1 py-0.2 rounded font-sans tracking-widest ml-1 animate-pulse">
                        YOU
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10.5px] font-bold ${isCurrentPlayer ? 'text-rose-200' : 'text-slate-100'}`}>
                      {entry.completionTime.toFixed(2)}s
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">
                      {entry.date}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-800 pt-2 text-center">
          <p className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">
            TAP OUTSIDE OR PRESS ESC TO DISMISS
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// GLOBAL RANKINGS MODELPORT FOR THE LEVEL
// ==========================================

export interface GlobalRankingsModalProps {
  playerName: string;
  levelBestTimes: Record<string, number>;
  onClose: () => void;
  medalCounts: { gold: number; silver: number; bronze: number };
  overallStanding: string;
  selectedLeaderboardId: number;
  setSelectedLeaderboardId: (id: number) => void;
  onSyncLeaderboards?: () => Promise<void>;
}

export function GlobalRankingsModal({
  playerName,
  levelBestTimes,
  onClose,
  medalCounts,
  overallStanding,
  selectedLeaderboardId,
  setSelectedLeaderboardId,
  onSyncLeaderboards
}: GlobalRankingsModalProps) {
  const [syncCounter, setSyncCounter] = useState(0);
  const [globalEntries, setGlobalEntries] = useState<any[]>([]);

  useEffect(() => {
    if (onSyncLeaderboards) {
      onSyncLeaderboards().then(() => {
        setSyncCounter((prev) => prev + 1);
      });
    }
  }, [onSyncLeaderboards]);

  useEffect(() => {
    fetchAllScoresFromFirebase().then((data) => {
      setGlobalEntries(data || []);
    });
  }, [syncCounter]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 font-mono select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-sm bg-slate-900 border-4 border-rose-500 rounded-2xl p-4 shadow-[0_0_30px_rgba(244,63,94,0.35)] text-slate-100 flex flex-col gap-3 font-mono border-solid"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-755 w-6 h-6 rounded-full flex items-center justify-center font-sans font-bold text-[10px] cursor-pointer border border-slate-700 hover:scale-105 active:scale-95 transition-all"
        >
          ✕
        </button>

        {/* Header with Game branding & logo */}
        <div className="flex gap-3 bg-slate-950/80 p-2 rounded-xl border border-rose-500/30 shadow-inner relative overflow-hidden" id="rankings-header-brand">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(244,63,94,0.1)_95%)] bg-[size:100%_4px] pointer-events-none opacity-50"></div>
          
          <img 
            src="/icon-512.png" 
            referrerPolicy="no-referrer" 
            className="w-12 h-12 object-cover rounded-lg border-2 border-rose-500 bg-slate-900 shadow-md flex-shrink-0"
            id="rankings_header_img"
            alt="Mirror Drive Cover" 
          />
          
          <div className="flex-1 flex flex-col justify-between z-10">
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-rose-400 font-black tracking-wider uppercase font-sans flex items-center gap-1">
                <Trophy size={9} className="text-amber-400 animate-bounce" />
                <span>SPEED VAULT LEADERS</span>
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xs font-black font-sans text-white tracking-widest leading-none">
                MIRROR DRIVE
              </h2>
              <div className="inline-flex max-w-max bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[7px] font-black tracking-widest uppercase mt-0.5 border border-rose-400 shadow animate-pulse">
                TOUGE CHERRY EDITION
              </div>
            </div>
          </div>
        </div>

        {/* Pilot Standings / Medal Shelf Widget */}
        <div id="speed-vault-standings" className="flex flex-col items-center w-full bg-slate-950/60 border border-slate-800 text-white rounded-xl p-2 pb-1.5 shadow-inner">
          <div className="flex items-center justify-between w-full border-b border-slate-800/80 pb-1 mb-1.5 px-0.5">
            <span className="text-[8.5px] text-rose-400 font-black tracking-widest uppercase flex items-center gap-1">
              <Award size={10} className="text-rose-400 fill-rose-500/20" />
              <span>MY PERFORMANCE</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[7.5px] bg-rose-500 text-white font-sans font-black px-1.5 py-0.5 rounded tracking-wider">
                {overallStanding}
              </span>
              <span className="text-[8.5px] font-black text-rose-300 tracking-widest font-mono font-bold">
                {playerName || 'DRVR'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 w-full text-center">
            {/* Gold Medals */}
            <div className="bg-slate-950/90 border border-slate-800/60 rounded-lg py-1 px-0.5 flex flex-col items-center">
              <span className="text-[6.5px] font-extrabold text-amber-400 tracking-wider uppercase mb-0.5 font-sans">GOLD (1ST)</span>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-bold leading-none">🥇</span>
                <span className="text-[10px] font-mono font-black text-white">{medalCounts.gold}</span>
              </div>
            </div>

            {/* Silver Medals */}
            <div className="bg-slate-950/90 border border-slate-800/60 rounded-lg py-1 px-0.5 flex flex-col items-center">
              <span className="text-[6.5px] font-extrabold text-slate-350 tracking-wider uppercase mb-0.5 font-sans">SILVER (2ND)</span>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-bold leading-none">🥈</span>
                <span className="text-[10px] font-mono font-black text-white">{medalCounts.silver}</span>
              </div>
            </div>

            {/* Bronze Medals */}
            <div className="bg-slate-950/90 border border-slate-800/60 rounded-lg py-1 px-0.5 flex flex-col items-center">
              <span className="text-[6.5px] font-extrabold text-orange-450 tracking-wider uppercase mb-0.5 font-sans">BRONZE (3RD)</span>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-bold leading-none">🥉</span>
                <span className="text-[10px] font-mono font-black text-white">{medalCounts.bronze}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Selection Tabs */}
        <div className="grid grid-cols-6 gap-1 pb-1 max-h-[70px] overflow-y-auto">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => {
                audioEngine.playClick();
                setSelectedLeaderboardId(lvl.id);
              }}
              className={`py-1 text-[8px] font-sans font-bold rounded cursor-pointer border text-center transition-all ${
                selectedLeaderboardId === lvl.id
                  ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              W{lvl.id}
            </button>
          ))}
        </div>

        {/* Selected Stage Detail */}
        {(() => {
          const currentLvl = LEVELS.find(l => l.id === selectedLeaderboardId);
          if (!currentLvl) return null;
          
          let entries;
          if (isFirebaseEnabled && globalEntries && globalEntries.length > 0) {
            const list: any[] = [];
            let playerFoundInGlobal = false;

            globalEntries.forEach((user: any) => {
              const bestTime = user.levelBestTimes?.[`level${selectedLeaderboardId}`];
              if (bestTime && bestTime > 0) {
                let entryDate = '';
                if (user.updatedAt) {
                  try {
                    if (typeof user.updatedAt.toDate === 'function') {
                      entryDate = user.updatedAt.toDate().toISOString().split('T')[0];
                    } else if (user.updatedAt.seconds) {
                      entryDate = new Date(user.updatedAt.seconds * 1000).toISOString().split('T')[0];
                    } else if (typeof user.updatedAt === 'string' || typeof user.updatedAt === 'number') {
                      entryDate = new Date(user.updatedAt).toISOString().split('T')[0];
                    }
                  } catch (e) {
                    entryDate = new Date().toISOString().split('T')[0];
                  }
                }
                if (!entryDate) {
                  entryDate = new Date().toISOString().split('T')[0];
                }

                const isCurrentPlayer = user.playerName === playerName;
                if (isCurrentPlayer) {
                  playerFoundInGlobal = true;
                }

                list.push({
                  playerName: user.playerName || 'DRVR',
                  completionTime: bestTime,
                  date: entryDate,
                  isPlayer: isCurrentPlayer,
                });
              }
            });

            // Fallback: merge current player's local best time if not present or is better
            const localBest = levelBestTimes?.[`level${selectedLeaderboardId}`];
            if (localBest && localBest > 0) {
              if (playerFoundInGlobal) {
                const idx = list.findIndex(e => e.isPlayer);
                if (idx !== -1 && localBest < list[idx].completionTime) {
                  list[idx].completionTime = localBest;
                  list[idx].date = new Date().toISOString().split('T')[0];
                }
              } else {
                list.push({
                  playerName: playerName || 'DRVR',
                  completionTime: localBest,
                  date: new Date().toISOString().split('T')[0],
                  isPlayer: true,
                });
              }
            }

            // Deduplicate by playerName, keeping fastest run
            const uniqMap = new Map<string, any>();
            list.forEach((entry) => {
              const existing = uniqMap.get(entry.playerName);
              if (!existing || entry.completionTime < existing.completionTime) {
                uniqMap.set(entry.playerName, entry);
              }
            });

            const dedupedList = Array.from(uniqMap.values());
            dedupedList.sort((a, b) => a.completionTime - b.completionTime);
            entries = dedupedList.slice(0, 10);
          } else {
            entries = getLeaderboard(selectedLeaderboardId, levelBestTimes, playerName);
          }

          return (
            <>
              <div className="bg-slate-950/45 border border-slate-800 px-2.5 py-1 rounded-lg flex flex-col gap-0.5 text-center">
                <span className="text-[10px] font-extrabold text-white uppercase italic font-sans truncate">
                  STAGE {selectedLeaderboardId}: {currentLvl.name}
                </span>
                <span className="text-[7.5px] text-slate-400 tracking-wider leading-none">
                  LEN: {currentLvl.length}M &middot; DRIFT TO SPEEDWAY SUPREMACY
                </span>
              </div>

              {/* Rankings List */}
              <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-0.5">
                {entries.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-[8px] uppercase font-bold tracking-widest">
                    NO RUN TIMES FORWARDED
                  </div>
                ) : (
                  entries.map((entry, idx) => {
                    const rank = idx + 1;
                    const isCurrentPlayer = entry.isPlayer || entry.playerName === playerName;

                    const rankColors = {
                      1: 'text-amber-400 font-extrabold',
                      2: 'text-slate-300 font-bold',
                      3: 'text-orange-400 font-bold',
                    }[rank] || 'text-slate-450';

                    const rankMedal = {
                      1: '🥇',
                      2: '🥈',
                      3: '🥉',
                    }[rank] || `${rank}.`;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-2 py-0.5 rounded border text-[9.5px] transition-all ${
                          isCurrentPlayer
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-extrabold relative overflow-hidden'
                            : 'bg-slate-950/30 border-slate-800/80 text-slate-350'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 text-center font-black ${rankColors}`}>
                            {rankMedal}
                          </span>
                          <span className="uppercase tracking-wider truncate max-w-[120px]">
                            {entry.playerName}
                          </span>
                          {isCurrentPlayer && (
                            <span className="text-[6.5px] font-black bg-rose-500 text-slate-950 px-1 py-0.2 rounded font-sans tracking-wide">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center font-mono text-[9.5px]">
                          <span className={isCurrentPlayer ? 'text-rose-200' : 'text-slate-200'}>
                            {entry.completionTime.toFixed(2)}s
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          );
        })()}

        <button
          onClick={onClose}
          className="mt-1 py-1 bg-rose-500 hover:bg-rose-450 text-white font-sans font-bold text-[8.5px] uppercase tracking-widest rounded-lg cursor-pointer text-center border-2 border-rose-600 transition"
        >
          DISMISS STANDINGS
        </button>
      </motion.div>
    </motion.div>
  );
}
