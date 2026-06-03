/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Difficulty } from './types';
import TitleScreen from './components/TitleScreen';
import LevelSelectScreen from './components/LevelSelectScreen';
import GameplayScreen from './components/GameplayScreen';
import DriverRegistryScreen from './components/DriverRegistryScreen';
import { auth, isFirebaseEnabled, signInWithGoogle, logOut, saveProgressToFirebase, loadProgressFromFirebase, fetchAllScoresFromFirebase, deleteProgressFromFirebase } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Smartphone, RotateCw } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameState>(GameState.TITLE);
  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);
  
  // Pilot name registry state
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('mirrordrive_player_name') || '';
    } catch {
      return '';
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      return localStorage.getItem('mirrordrive_user_id') || '';
    } catch {
      return '';
    }
  });

  const handleUpdatePlayerName = (newName: string) => {
    setPlayerName(newName);
    localStorage.setItem('mirrordrive_player_name', newName);
  };

  const handleLoginSuccess = (
    name: string,
    userId: string,
    unlocked: number[],
    bestTimes: Record<string, number>
  ) => {
    setPlayerName(name);
    setCurrentUserId(userId);
    setUnlockedLevels(unlocked);
    setLevelBestTimes(bestTimes);
    
    localStorage.setItem('mirrordrive_player_name', name);
    localStorage.setItem('mirrordrive_user_id', userId);
    localStorage.setItem('mirrordrive_unlocked_levels', JSON.stringify(unlocked));
    
    // Clear old times
    for (let i = 1; i <= 30; i++) {
      localStorage.removeItem(`mirrordrive_best_level_${i}`);
    }
    // Store new times
    for (const key of Object.keys(bestTimes)) {
      const levelNum = key.replace('level', '');
      localStorage.setItem(`mirrordrive_best_level_${levelNum}`, bestTimes[key].toString());
    }
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('mirrordrive_player_name');
    localStorage.removeItem('mirrordrive_user_id');
    localStorage.removeItem('mirrordrive_unlocked_levels');
    for (let i = 1; i <= 30; i++) {
      localStorage.removeItem(`mirrordrive_best_level_${i}`);
    }
    // Clear state
    setPlayerName('');
    setCurrentUserId('');
    setUnlockedLevels([1]);
    setLevelBestTimes({});
    setCurrentScreen(GameState.TITLE);
  };

  const handleDeleteAccount = async () => {
    if (!currentUserId || !isFirebaseEnabled) {
      handleLogout();
      return;
    }
    try {
      await deleteProgressFromFirebase(currentUserId);
      await syncGlobalLeaderboards();
    } catch (err) {
      console.warn("Failed to delete account on Firestore:", err);
    }
    handleLogout();
  };

  // Unlocked levels registry
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);
  // Record times catalog
  const [levelBestTimes, setLevelBestTimes] = useState<Record<string, number>>({});
  // Track levels that just set a new personal record in this session
  const [newlySetRecordLevelIds, setNewlySetRecordLevelIds] = useState<number[]>([]);

  // Selected Difficulty (Speed modes: EASY = 1x, NORMAL = 1.5x, HARD = 2x)
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);

  // Screen device orientation detection
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [bypassPortraitPrompt, setBypassPortraitPrompt] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerWidth < window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Auth & Cloud Sync States
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Initial local profile loading on mount with a safe one-time wipe of prior play history & test rides
  useEffect(() => {
    try {
      const needsFreshPurge = !localStorage.getItem('mirrordrive_force_wipe_records_v6');
      if (needsFreshPurge) {
        // Purge all best times records
        for (let i = 1; i <= 30; i++) {
          localStorage.removeItem(`mirrordrive_best_level_${i}`);
          localStorage.removeItem(`mirrordrive_leaderboard_level_${i}`);
        }
        // Force unlock of Level 1 only
        localStorage.setItem('mirrordrive_unlocked_levels', JSON.stringify([1]));
        localStorage.removeItem('mirrordrive_player_name');
        
        // Track that cloud database needs to be overwritten on next connection
        localStorage.setItem('mirrordrive_cloud_reset_needed', 'true');
        
        // Mark force wipe as successfully executed
        localStorage.setItem('mirrordrive_force_wipe_records_v6', 'true');
        
        // Reset react state immediately for this session
        setUnlockedLevels([1]);
        setLevelBestTimes({});
        setPlayerName('');
      } else {
        // Regular unlocked levels loading
        const savedUnlocked = localStorage.getItem('mirrordrive_unlocked_levels');
        let initialUnlocked = [1];
        if (savedUnlocked) {
          const parsed = JSON.parse(savedUnlocked);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialUnlocked = parsed;
          }
        } else {
          localStorage.setItem('mirrordrive_unlocked_levels', JSON.stringify([1]));
        }
        setUnlockedLevels(initialUnlocked);

        // Regular best times loading
        const times: Record<string, number> = {};
        for (let i = 1; i <= 30; i++) {
          const key = `mirrordrive_best_level_${i}`;
          const recordVal = localStorage.getItem(key);
          if (recordVal) {
            times[`level${i}`] = parseFloat(recordVal);
          }
        }
        setLevelBestTimes(times);
      }

      // Load difficulty speed mode setting
      const savedDifficulty = localStorage.getItem('mirrordrive_difficulty');
      if (savedDifficulty && ['EASY', 'NORMAL', 'HARD'].includes(savedDifficulty)) {
        setDifficulty(savedDifficulty as Difficulty);
      }
    } catch (e) {
      console.warn('localStorage is not accessible in this context', e);
    }
  }, []);

  // Synchronizes and compiles centralized leaderboards from Firestore users data
  const syncGlobalLeaderboards = useCallback(async () => {
    try {
      const allRivalData = await fetchAllScoresFromFirebase();
      if (!allRivalData || allRivalData.length === 0) return;

      for (let i = 1; i <= 30; i++) {
        const levelEntries: { playerName: string; completionTime: number; date: string }[] = [];
        
        allRivalData.forEach((rival) => {
          const completionTime = rival.levelBestTimes?.[`level${i}`];
          if (completionTime && completionTime > 0) {
            let entryDate = '';
            if (rival.updatedAt) {
              try {
                if (typeof rival.updatedAt.toDate === 'function') {
                  entryDate = rival.updatedAt.toDate().toISOString().split('T')[0];
                } else if (rival.updatedAt.seconds) {
                  entryDate = new Date(rival.updatedAt.seconds * 1000).toISOString().split('T')[0];
                } else if (typeof rival.updatedAt === 'string' || typeof rival.updatedAt === 'number') {
                  entryDate = new Date(rival.updatedAt).toISOString().split('T')[0];
                }
              } catch (e) {
                entryDate = new Date().toISOString().split('T')[0];
              }
            }
            if (!entryDate) {
              entryDate = new Date().toISOString().split('T')[0];
            }

            levelEntries.push({
              playerName: rival.playerName || 'DRVR',
              completionTime,
              date: entryDate,
            });
          }
        });

        const uniqueEntriesMap = new Map<string, typeof levelEntries[0]>();
        levelEntries.forEach(entry => {
          const existing = uniqueEntriesMap.get(entry.playerName);
          if (!existing || entry.completionTime < existing.completionTime) {
            uniqueEntriesMap.set(entry.playerName, entry);
          }
        });

        const finalEntries = Array.from(uniqueEntriesMap.values())
          .sort((a, b) => a.completionTime - b.completionTime)
          .slice(0, 10);

        localStorage.setItem(`mirrordrive_leaderboard_level_${i}`, JSON.stringify(finalEntries));
      }
    } catch (err) {
      console.warn("Failed to synchronize global leaderboards:", err);
    }
  }, []);

  useEffect(() => {
    if (isFirebaseEnabled) {
      syncGlobalLeaderboards();
    }
  }, []);

  // 2. Real-time cloud progress synchronizer based on username ID
  useEffect(() => {
    if (!isFirebaseEnabled || !currentUserId) return;

    const syncUserProgress = async () => {
      setIsSyncing(true);
      try {
        const remoteData = await loadProgressFromFirebase(currentUserId);
        
        let localUnlocked = [1];
        const savedUnlocked = localStorage.getItem('mirrordrive_unlocked_levels');
        if (savedUnlocked) {
          const parsed = JSON.parse(savedUnlocked);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localUnlocked = parsed;
          }
        }

        const localTimes: Record<string, number> = {};
        for (let i = 1; i <= 30; i++) {
          const key = `mirrordrive_best_level_${i}`;
          const recordVal = localStorage.getItem(key);
          if (recordVal) {
            localTimes[`level${i}`] = parseFloat(recordVal);
          }
        }

        let mergedUnlocked = [...localUnlocked];
        let mergedTimes = { ...localTimes };

        const needsCloudReset = localStorage.getItem('mirrordrive_cloud_reset_needed') === 'true';

        if (remoteData && !needsCloudReset) {
          // Take the Union of all unlocked levels
          const remoteUnlocked: number[] = remoteData.unlockedLevels || [];
          mergedUnlocked = Array.from(new Set([...localUnlocked, ...remoteUnlocked])).sort((a, b) => a - b);

          // Take the fastest (minimum) completion times
          const remoteTimes: Record<string, number> = remoteData.levelBestTimes || {};
          const allKeys = new Set([...Object.keys(localTimes), ...Object.keys(remoteTimes)]);
          for (const key of allKeys) {
            const valLocal = localTimes[key];
            const valRemote = remoteTimes[key];
            if (valLocal !== undefined && valRemote !== undefined) {
              mergedTimes[key] = Math.min(valLocal, valRemote);
            } else if (valRemote !== undefined) {
              mergedTimes[key] = valRemote;
            } else if (valLocal !== undefined) {
              mergedTimes[key] = valLocal;
            }
          }
        } else if (needsCloudReset) {
          localStorage.removeItem('mirrordrive_cloud_reset_needed');
        }

        // Apply consensus values to state
        setUnlockedLevels(mergedUnlocked);
        setLevelBestTimes(mergedTimes);

        // Write consensus values to localStorage as offline mirror
        localStorage.setItem('mirrordrive_unlocked_levels', JSON.stringify(mergedUnlocked));
        for (const key of Object.keys(mergedTimes)) {
          const levelNum = key.replace('level', '');
          localStorage.setItem(`mirrordrive_best_level_${levelNum}`, mergedTimes[key].toString());
        }

        // Sync verified consensus records back to Firebase
        await saveProgressToFirebase(currentUserId, mergedUnlocked, mergedTimes, false);
        await syncGlobalLeaderboards();
      } catch (err) {
        console.error("Cloud progress consensus synchronization failed:", err);
      } finally {
        setIsSyncing(false);
      }
    };

    syncUserProgress();
  }, [currentUserId]);

  // Menu control callback handlers
  const handleOpenLevelSelect = () => {
    setCurrentScreen(GameState.LEVEL_SELECT);
  };

  const handleSelectLevel = (levelId: number) => {
    setSelectedLevelId(levelId);
    setCurrentScreen(GameState.GAMEPLAY);
  };

  const handleLevelComplete = async (levelId: number, completionTime: number) => {
    // 1. Update personal best records time registry
    const nextTimes = { ...levelBestTimes };
    const existingBest = levelBestTimes[`level${levelId}`];
    if (existingBest === undefined || completionTime < existingBest) {
      nextTimes[`level${levelId}`] = completionTime;
      // Register this level ID as having achieved a new personal record in this session
      setNewlySetRecordLevelIds((prev) => [...prev.filter((id) => id !== levelId), levelId]);
    }
    setLevelBestTimes(nextTimes);

    // 2. Unlock the immediate subsequent level if within limits (1 to 30)
    let nextUnlocked = [...unlockedLevels];
    const targetNextLevel = levelId + 1;
    if (targetNextLevel <= 30 && !unlockedLevels.includes(targetNextLevel)) {
      nextUnlocked.push(targetNextLevel);
      setUnlockedLevels(nextUnlocked);
    }

    // Persist to local offline storage cache
    try {
      localStorage.setItem('mirrordrive_unlocked_levels', JSON.stringify(nextUnlocked));
      localStorage.setItem(`mirrordrive_best_level_${levelId}`, completionTime.toString());
    } catch (e) {
      console.warn('Unable to persist next unlocked level state', e);
    }

    // 3. Persist to Firestore instantly if logged in
    if (currentUserId && isFirebaseEnabled) {
      try {
        await saveProgressToFirebase(currentUserId, nextUnlocked, nextTimes, false);
      } catch (err) {
        console.warn("Cloud write failed during level completion", err);
      }
    }

    // Sync global leaderboards reactively
    if (isFirebaseEnabled) {
      try {
        await syncGlobalLeaderboards();
      } catch (err) {
        console.warn("Leaderboard sync failed", err);
      }
    }

    // Go back to the choice screen so they see their unlocked level and record statistics!
    setCurrentScreen(GameState.LEVEL_SELECT);
  };

  const handleGameOver = (elapsedSeconds: number, distance: number, perfect: boolean) => {
    // Back to Level select on session term
    setCurrentScreen(GameState.LEVEL_SELECT);
  };

  const handleExitGameplay = () => {
    setCurrentScreen(GameState.LEVEL_SELECT);
  };

  const handleSetDifficulty = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    try {
      localStorage.setItem('mirrordrive_difficulty', newDiff);
    } catch (e) {
      console.warn('Unable to persist difficulty setting', e);
    }
  };

  const handleReturnToTitle = () => {
    setCurrentScreen(GameState.TITLE);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Google login interaction failed:", err);
    }
  };

  const handleLogOut = async () => {
    try {
      await logOut();
      setUser(null);
    } catch (err) {
      console.error("Log out operation failed:", err);
    }
  };

  // Screen router logic
  const renderScreen = () => {
    switch (currentScreen) {
      case GameState.LEVEL_SELECT:
        return (
          <LevelSelectScreen
            unlockedLevels={unlockedLevels}
            levelBestTimes={levelBestTimes}
            newlySetRecordLevelIds={newlySetRecordLevelIds}
            onSelectLevel={handleSelectLevel}
            onBack={handleReturnToTitle}
            user={user}
            onSignIn={handleGoogleSignIn}
            onSignOut={handleLogOut}
            isFirebaseEnabled={isFirebaseEnabled}
            isSyncing={isSyncing}
            playerName={playerName}
            onUpdatePlayerName={handleUpdatePlayerName}
            onSyncLeaderboards={syncGlobalLeaderboards}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      case GameState.GAMEPLAY:
        return (
          <GameplayScreen
            levelId={selectedLevelId}
            difficulty={difficulty}
            onGameOver={handleGameOver}
            onLevelComplete={handleLevelComplete}
            onExit={handleExitGameplay}
            playerName={playerName}
          />
        );
      case GameState.TITLE:
      default:
        return (
          <TitleScreen
            onOpenLevelSelect={handleOpenLevelSelect}
            difficulty={difficulty}
            onChangeDifficulty={handleSetDifficulty}
            user={user}
            onSignIn={handleGoogleSignIn}
            onSignOut={handleLogOut}
            isFirebaseEnabled={isFirebaseEnabled}
            isSyncing={isSyncing}
            playerName={playerName}
            onUpdatePlayerName={handleUpdatePlayerName}
            levelBestTimes={levelBestTimes}
            onSyncLeaderboards={syncGlobalLeaderboards}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        );
    }
  };

  if (!playerName) {
    return (
      <DriverRegistryScreen
        onRegister={handleLoginSuccess}
      />
    );
  }

  return (
    <div className={`w-full min-h-screen flex flex-col items-center justify-center transition-all duration-300 ${
      currentScreen === GameState.GAMEPLAY
        ? 'bg-slate-100 p-0'
        : currentScreen === GameState.LEVEL_SELECT
        ? 'bg-[#f0f9ff] p-2 sm:p-4'
        : 'bg-sky-200 p-2 sm:p-4'
    }`}>
      {/* Smart orientation check and bypass button */}
      {isPortrait && !bypassPortraitPrompt && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center select-none cursor-default font-mono border-4 border-[#f43f5e]/30 m-2 rounded-2xl shadow-2xl overflow-hidden">
          {/* Glass CRT scanlines overlay inside prompt */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
          
          <div className="relative flex flex-col items-center max-w-sm gap-6 z-20">
            {/* Spinning Phone illustration */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 bg-cyan-500/10 rounded-full animate-ping opacity-25" />
              <div className="absolute inset-2 bg-amber-500/10 rounded-full animate-pulse opacity-40 border border-amber-500/20" />
              
              <div className="relative animate-bounce">
                <Smartphone className="w-16 h-16 text-cyan-400 transform -rotate-12 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <RotateCw className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-widest text-[#f43f5e] uppercase italic drop-shadow-[0_2px_4px_rgba(244,63,94,0.3)] font-sans">
                WIDESCREEN RATIO
              </h1>
              <p className="text-slate-300 text-xs leading-relaxed max-w-[280px] mx-auto font-sans">
                Mirror Drive DX is designed for high-octane <strong>landscape viewports</strong>. Rotate your device 90&deg; for optimal race track display!
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
              <button 
                onClick={() => {
                  setBypassPortraitPrompt(true);
                }}
                className="w-full bg-cyan-400 hover:bg-cyan-500 border-2 border-cyan-300 hover:border-cyan-400 text-slate-950 text-[10px] font-black uppercase py-2.5 rounded shadow-lg transition-all font-sans tracking-widest active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>PLAY IN PORTRAIT ANYWAY</span>
              </button>
              <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold font-sans">
                * Console displays will scale to fit narrow width
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Landscape indicator on mobile / small portrait screens */}
      {isPortrait && bypassPortraitPrompt && (
        <div className="mb-3 text-[10px] font-bold text-center text-amber-400 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-lg animate-pulse tracking-wide uppercase max-w-[320px] leading-normal font-mono shadow-md z-30">
          🔄 ROTATE PHONE TO ENLARGE THE GAME!
        </div>
      )}
      {renderScreen()}
    </div>
  );
}
