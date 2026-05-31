/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GameMode, Difficulty } from '../types';
import { drawPixelCar } from './CarRenderer';
import { Settings, Music, Volume2, Shield, Info, HelpCircle, Trophy, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import audioEngine from './AudioEngine';
import { User } from 'firebase/auth';
import { LEVELS } from './Levels';
import { getLeaderboard } from '../lib/leaderboard';

interface TitleScreenProps {
  onOpenLevelSelect: () => void;
  difficulty: Difficulty;
  onChangeDifficulty: (newDifficulty: Difficulty) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isFirebaseEnabled: boolean;
  isSyncing: boolean;
  playerName: string;
  onUpdatePlayerName: (newName: string) => void;
  levelBestTimes: Record<string, number>;
}

export default function TitleScreen({ 
  onOpenLevelSelect, 
  difficulty,
  onChangeDifficulty,
  user, 
  onSignIn, 
  onSignOut, 
  isFirebaseEnabled, 
  isSyncing,
  playerName,
  onUpdatePlayerName,
  levelBestTimes
}: TitleScreenProps) {
   const [selectedIdx, setSelectedIdx] = useState(0); // 0: START, 1: SETTINGS, 2: MANUAL
  const [showOptions, setShowOptions] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Settings state
  const [musicOn, setMusicOn] = useState(true);
  const [sfxMuted, setSfxMuted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic scale factor to fit perfectly in viewport (even in portrait mobile iframe views!)
  const [scaleFactor, setScaleFactor] = useState(1);

  const [editingName, setEditingName] = useState(playerName);

  useEffect(() => {
    setEditingName(playerName);
  }, [playerName, showOptions]);

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

  // Keyboard navigation on title screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showOptions || showInfo) return;
      
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        audioEngine.playClick();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : 2));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        audioEngine.playClick();
        setSelectedIdx((prev) => (prev < 2 ? prev + 1 : 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        audioEngine.playClick();
        triggerMenuAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx, showOptions, showInfo]);

  const triggerMenuAction = () => {
    if (selectedIdx === 0) {
      onOpenLevelSelect();
    } else if (selectedIdx === 1) {
      setShowOptions(true);
    } else if (selectedIdx === 2) {
      setShowInfo(true);
    }
  };

  // Canvas cherry blossom wind sway and warm ground animation loop!
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Make canvas sharp on retina displays
    const dpr = window.devicePixelRatio || 1;
    const width = 800;
    const height = 450;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    interface SakuraPetal {
      x: number;
      y: number;
      vy: number;
      size: number;
      sway: number;
      swaySpeed: number;
      swayWidth: number;
      angle: number;
      spinSpeed: number;
      color: string;
    }
    
    interface Ripple {
      x: number;
      y: number;
      r: number;
      maxR: number;
      alpha: number;
    }

    const petals: SakuraPetal[] = [];
    const ripples: Ripple[] = [];
    const colors = ['#fbcfe8', '#f472b6', '#fca5a5', '#fda4af', '#fecdd3'];

    // Initialize beautiful cherry blossom petals to drift in the breeze
    for (let i = 0; i < 35; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        vy: 1.0 + Math.random() * 1.3,
        size: 3.5 + Math.random() * 2.5,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.008 + Math.random() * 0.015,
        swayWidth: 12 + Math.random() * 20,
        angle: Math.random() * Math.PI * 2,
        spinSpeed: -0.04 + Math.random() * 0.08,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    let animationId: number;

    const render = () => {
      // 1. Draw warm clear daytime background (GBA skies inspired by Pokemon & Mario Kart)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#38bdf8'); // Saturated sky blue
      bgGrad.addColorStop(0.35, '#bae6fd'); // Soft lighter horizon blue
      bgGrad.addColorStop(0.55, '#f4fbf7'); // Bright mist at horizon
      bgGrad.addColorStop(1, '#f4fbf7');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const horizonY = height * 0.55;

      // 1b. Mount Fuji background silhouette (warm emerald green hill under sunny sky)
      ctx.fillStyle = '#0f766e'; // Teal-green mountain layer
      ctx.beginPath();
      ctx.moveTo(width / 2 - 140, horizonY);
      ctx.quadraticCurveTo(width / 2 - 40, horizonY - 45, width / 2 - 25, horizonY - 100);
      ctx.lineTo(width / 2 + 25, horizonY - 100);
      ctx.quadraticCurveTo(width / 2 + 40, horizonY - 45, width / 2 + 140, horizonY);
      ctx.closePath();
      ctx.fill();

      // Mount Fuji snowy peak (Pure snowy white)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(width / 2 - 25, horizonY - 100);
      ctx.lineTo(width / 2 + 25, horizonY - 100);
      ctx.quadraticCurveTo(width / 2 + 30, horizonY - 78, width / 2 + 18, horizonY - 74);
      ctx.lineTo(width / 2 + 8, horizonY - 80);
      ctx.lineTo(width / 2 - 4, horizonY - 65);
      ctx.lineTo(width / 2 - 13, horizonY - 76);
      ctx.quadraticCurveTo(width / 2 - 29, horizonY - 78, width / 2 - 25, horizonY - 100);
      ctx.closePath();
      ctx.fill();

      // Flat asphalt ground
      ctx.fillStyle = '#64748b'; // Road grey
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Grass banks on the far sides of the track (Lush GBA warm green)
      ctx.fillStyle = '#7ec850'; 
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(160, horizonY);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width, horizonY);
      ctx.lineTo(width - 160, horizonY);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Flat white/yellow borders of grass (GBA tracks style)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(160, horizonY);
      ctx.lineTo(0, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width - 160, horizonY);
      ctx.lineTo(width, height);
      ctx.stroke();

      // Red and white curbs at grass boundary
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(158, horizonY);
      ctx.lineTo(-2, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width - 158, horizonY);
      ctx.lineTo(width + 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw lovely pixelated cherry trees and GBA rounded hills
      ctx.fillStyle = '#34a853'; // Green soft hill left
      ctx.beginPath();
      ctx.arc(80, horizonY, 50, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = '#2e7d32'; // Darker green soft hill right
      ctx.beginPath();
      ctx.arc(720, horizonY, 60, Math.PI, 0);
      ctx.fill();

      // Draw some cherry trees (pink puffs on brown trunks)
      const drawPinkTree = (x: number, y: number, r: number) => {
        // trunk
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - 3, y - r, 6, r);
        // foliage petals
        ctx.fillStyle = '#fbcfe8';
        ctx.beginPath();
        ctx.arc(x, y - r - 5, r * 1.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y - r - 8, r * 0.7, 0, Math.PI * 2);
        ctx.arc(x + r * 0.5, y - r - 2, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      };

      drawPinkTree(120, horizonY, 14);
      drawPinkTree(670, horizonY, 16);

      // 2. Draw realistic daytime vehicle shadows on asphalt
      const reflectionY = height * 0.72;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)'; // Clear soft grey shadow
      ctx.beginPath();
      ctx.ellipse(240, reflectionY + 2, 54, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(560, reflectionY + 2, 54, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Matte yellow warning lane divider
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width / 2, horizonY);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // 3. Draw Side-by-Side Supercars
      drawPixelCar(ctx, 240, height * 0.73, 56, 102, -0.06, 'TRAFFIC_BLUE', false, null);
      drawPixelCar(ctx, 560, height * 0.73, 56, 102, 0.06, 'BLACK_RED', false, null);

      // 4. Update and Render floating Sakura Cherry Blossom Petals
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        
        ctx.save();
        // Sway sideways based on sine-wave multiplier
        const currentXPos = p.x + Math.sin(p.sway) * p.swayWidth;
        ctx.translate(currentXPos, p.y);
        ctx.rotate(p.angle);
        
        ctx.fillStyle = p.color;
        
        // Draw real organic leaf/petal shape
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Highlight tip for beautiful depth
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(-p.size * 0.4, -p.size * 0.1, p.size * 0.5, p.size * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        // Movement
        p.y += p.vy;
        p.sway += p.swaySpeed;
        p.angle += p.spinSpeed;

        // Reset if hitting ground
        if (p.y > height - 15) {
          if (Math.random() < 0.25) {
            ripples.push({
              x: currentXPos,
              y: height - 15 + Math.random() * 10,
              r: 1,
              maxR: 5 + Math.random() * 8,
              alpha: 0.5
            });
          }
          p.x = Math.random() * width;
          p.y = -20;
          p.vy = 0.9 + Math.random() * 1.4;
          p.angle = Math.random() * Math.PI * 2;
        }
      }

      // 5. Update and Draw soft pink ground drifts
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        ctx.strokeStyle = `rgba(244, 114, 182, ${rip.alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rip.x, rip.y, rip.r, rip.r * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();

        rip.r += 0.28;
        rip.alpha -= 0.025;

        if (rip.alpha <= 0) {
          ripples.splice(i, 1);
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    audioEngine.playMusic();

    return () => {
      cancelAnimationFrame(animationId);
      audioEngine.stopMusic();
    };
  }, []);

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
        className="absolute top-0 left-0 overflow-hidden rounded-lg border-4 border-slate-400 shadow-2xl flex flex-col justify-between items-center p-6 text-slate-805 font-mono select-none bg-sky-200"
      >
        {/* Absolute background cherry blossom simulator canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

        {/* Glass CRT scanline mesh overlay filter */}
        <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.04)_50%)] bg-[length:100%_4px]" />

        {/* Top Header Row has been removed as requested */}

        {/* Center Logo Panel (Super Mario Kart style bright gradients) */}
        <div className="flex flex-col items-center my-auto transform -translate-y-4 z-15">
          <div className="relative group select-none cursor-default drop-shadow-[0_4px_6px_rgba(15,23,42,0.18)]">
            <h1 
              style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
              className="text-6xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 font-sans italic text-center select-none uppercase"
            >
              MIRROR
            </h1>
            <h1 
              style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
              className="text-6xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 font-sans italic text-center select-none uppercase -mt-5"
            >
              DRIVE DX
            </h1>
            <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 bg-amber-500 text-slate-900 border-2 border-slate-50 px-4 py-0.5 rounded shadow-md font-sans text-[10px] font-extrabold uppercase tracking-[0.25em] whitespace-nowrap">
              TOUGE CHERRY EDITION
            </div>
          </div>
          <span className="mt-8 text-[11px] font-mono tracking-[0.3em] text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-3 py-1 font-bold uppercase shadow-sm">
            16-BIT RETRO SPEEDWAY
          </span>
        </div>

        {/* Bottom Menu Panel (Clean dynamic retro styling) */}
        <div className="flex flex-col items-center w-full max-w-[340px] gap-2 mb-2 z-15 bg-white p-2.5 rounded-lg border-2 border-slate-300 shadow-md">
          
          {/* START BUTTON */}
          <button
            onClick={() => {
              audioEngine.playClick();
              onOpenLevelSelect();
            }}
            onMouseEnter={() => setSelectedIdx(0)}
            className={`w-full py-2 px-5 rounded text-sm uppercase transition-all duration-150 tracking-wider font-sans cursor-pointer flex justify-between items-center ${
              selectedIdx === 0
                ? 'bg-rose-500 text-white border-2 border-rose-600 shadow-sm font-extrabold'
                : 'bg-slate-100 text-slate-700 border-2 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className="font-mono text-[11px] opacity-70">{selectedIdx === 0 ? '▶' : ' '}</span>
            <span className="font-bold flex items-center gap-1.5">
              <span>ENGAGE RACE</span>
            </span>
            <span className="font-mono text-[11px] opacity-70">{selectedIdx === 0 ? '◀' : ' '}</span>
          </button>

          {/* LOWER ICON PANEL */}
          <div className="grid grid-cols-2 gap-2 w-full">
            {/* SETTINGS ICON */}
            <button
              onClick={() => {
                audioEngine.playClick();
                setShowOptions(true);
              }}
              onMouseEnter={() => setSelectedIdx(1)}
              className={`flex flex-col items-center justify-center py-1.5 rounded border font-sans cursor-pointer transition-all duration-150 active:scale-95 group ${
                selectedIdx === 1
                  ? 'bg-rose-50 border-2 border-rose-500 text-rose-600 ring-1 ring-rose-400'
                  : 'bg-slate-55 border-slate-200 bg-slate-100 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-650 text-slate-700'
              }`}
            >
              <Settings size={15} className="group-hover:rotate-45 transition-transform duration-300" />
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">SETTINGS</span>
            </button>

            {/* MANUAL ICON */}
            <button
              onClick={() => {
                audioEngine.playClick();
                setShowInfo(true);
              }}
              onMouseEnter={() => setSelectedIdx(2)}
              className={`flex flex-col items-center justify-center py-1.5 rounded border font-sans cursor-pointer transition-all duration-150 active:scale-95 group ${
                selectedIdx === 2
                  ? 'bg-rose-50 border-2 border-rose-500 text-rose-600 ring-1 ring-rose-400'
                  : 'bg-slate-55 border-slate-200 bg-slate-100 hover:bg-rose-50 hover:border-rose-400 hover:text-rose-650 text-slate-700'
              }`}
            >
              <Info size={15} className="group-hover:scale-110 transition-transform text-slate-600" />
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">MANUAL</span>
            </button>
          </div>
        </div>

        {/* Quick navigation hint */}
        <div className="text-[10px] font-mono font-bold text-slate-600 text-center tracking-wider bg-white/95 border border-slate-200 py-1.5 px-3 rounded z-15 uppercase shadow-sm">
          USE ARROWS OR W/S TO NAVIGATE &middot; ENTER TO DECIDE
        </div>

      {/* 1. OPTIONS OVERLAY */}
      {showOptions && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-[420px] bg-slate-50 border-4 border-slate-400 rounded-xl p-5 shadow-xl flex flex-col gap-4 text-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-slate-950 font-bold tracking-wider font-sans border-b-2 border-slate-200 pb-2 text-[11px] uppercase">
              <Settings size={13} />
              <span>ARCADE SYSTEM SETUP</span>
            </div>

            {/* MUSIC TOGGLE */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-sans text-[10px] text-slate-700 uppercase font-bold">
                  SYNTH BGM VOLUME
                </span>
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    const nextVal = !musicOn;
                    setMusicOn(nextVal);
                    if (nextVal) {
                      audioEngine.playMusic();
                    } else {
                      audioEngine.stopMusic();
                    }
                  }}
                  className={`px-3 py-1 font-mono text-[9px] font-bold rounded cursor-pointer border-2 ${
                    musicOn 
                      ? 'bg-rose-500 text-white border-rose-600 shadow-sm' 
                      : 'bg-slate-100 text-slate-400 border-slate-300'
                  }`}
                >
                  {musicOn ? 'ON / PLAYING' : 'OFF / MUTED'}
                </button>
              </div>
              {musicOn && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 px-2.5 py-1 rounded font-mono text-[8.5px] font-bold uppercase text-center mt-0.5 tracking-wider">
                  ACTIVE BGM: AKIHABARA CHIPTUNE POP (130 BPM)
                </div>
              )}
            </div>

            {/* SOUND SFX TOGGLE */}
            <div className="flex justify-between items-center text-xs">
              <span className="font-sans text-[10px] text-slate-700 uppercase font-bold">
                CHIPTUNE SFX SOUND
              </span>
              <button
                onClick={() => {
                  audioEngine.playClick();
                  const state = audioEngine.toggleMute();
                  setSfxMuted(state);
                }}
                className={`px-3 py-1 font-mono text-[9px] font-bold rounded cursor-pointer border-2 ${
                  !sfxMuted 
                    ? 'bg-rose-500 text-white border-rose-600 shadow-sm' 
                    : 'bg-slate-100 text-slate-400 border-slate-300'
                }`}
              >
                {!sfxMuted ? 'ENABLED' : 'MUTED'}
              </button>
            </div>

            {/* DIFFICULTY SETTINGS */}
            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200">
              <span className="font-sans text-[10px] text-slate-700 uppercase font-bold text-left flex flex-col">
                <span>DIFFICULTY SPEEDWAYS</span>
              </span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((diff) => {
                  return (
                    <button
                      key={diff}
                      onClick={() => {
                        audioEngine.playClick();
                        onChangeDifficulty(diff);
                      }}
                      className={`py-1 font-sans text-[9px] border-2 rounded font-bold cursor-pointer transition-all flex flex-col items-center justify-center leading-tight ${
                        difficulty === diff
                          ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm'
                          : 'bg-slate-100 text-slate-500 border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      <span>{diff}</span>
                      <span className="text-[7.5px] font-mono font-bold mt-0.5 opacity-80">
                        {diff === 'EASY' ? '1.0x SPEED' : diff === 'NORMAL' ? '1.5x SPEED' : '2.0x SPEED'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DRIVER CALLSIGN SETTING */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200">
              <span className="font-sans text-[10px] text-slate-700 uppercase font-bold text-left flex justify-between items-center">
                <span>DRIVER CALLSIGN (LEADERBOARDS)</span>
                {editingName.trim().length < 2 && (
                  <span className="text-rose-500 text-[8px] font-mono font-bold">MIN 2 CHARS</span>
                )}
              </span>
              <input
                type="text"
                maxLength={12}
                value={editingName}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.\-_ ]/g, '');
                  setEditingName(val);
                }}
                className={`w-full bg-white border font-mono font-bold text-slate-800 text-[11px] px-2.5 py-1.5 rounded uppercase tracking-wider focus:outline-none shadow-sm ${
                  editingName.trim().length < 2 ? 'border-rose-450 focus:border-rose-500' : 'border-slate-300 focus:border-rose-500'
                }`}
                placeholder="CALLSIGN"
              />
            </div>

            <button
              onClick={() => {
                audioEngine.playClick();
                audioEngine.playMusic();
                
                const trimmed = editingName.trim().toUpperCase();
                if (trimmed.length >= 2 && trimmed.length <= 12) {
                  onUpdatePlayerName(trimmed);
                }
                
                setShowOptions(false);
              }}
              disabled={editingName.trim().length < 2}
              className={`mt-3 py-2 text-white font-sans font-bold text-[10px] uppercase tracking-widest rounded-lg cursor-pointer text-center shadow-md transition-all duration-150 border-2 ${
                editingName.trim().length >= 2
                  ? 'bg-rose-500 hover:bg-rose-450 border-rose-600 active:scale-95'
                  : 'bg-slate-300 text-slate-500 border-slate-350 cursor-not-allowed opacity-60'
              }`}
            >
              APPLY SETTINGS
            </button>
          </div>
        </div>
      )}

      {/* 2. MANUAL GUIDE OVERLAY */}
      {showInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-[490px] bg-slate-50 border-4 border-slate-400 rounded-xl p-5 shadow-lg flex flex-col gap-4 text-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-slate-950 font-bold tracking-wider font-sans border-b-2 border-slate-200 pb-2 text-[11px] uppercase">
              <Info size={13} />
              <span>CAR MANUAL & SAFETY RULES</span>
            </div>

            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1 text-[10px] text-slate-700 leading-relaxed font-sans text-left">
              <div>
                <h4 className="text-rose-600 font-bold text-[11px] border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5 uppercase">
                  <span>🕹 CONTROLS</span>
                </h4>
                <ul className="space-y-1 font-mono text-[9.5px]">
                  <li className="flex justify-between">
                     <span className="text-slate-500">Steer Left/Right:</span>
                     <span className="font-bold text-rose-600">A/D or LEFT/RIGHT</span>
                  </li>
                  <li className="flex justify-between">
                     <span className="text-slate-500">Accelerate (Gas):</span>
                     <span className="font-bold text-rose-600">W or UP</span>
                  </li>
                  <li className="flex justify-between">
                     <span className="text-slate-500">Brake (Slow):</span>
                     <span className="font-bold text-rose-600">S or DOWN</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-rose-600 font-bold text-[11px] border-b border-slate-200 pb-1 mb-1 flex items-center gap-1.5 uppercase">
                  <span>🧠 COGNITIVE RULES</span>
                </h4>
                <p className="text-[9.5px] text-slate-600 mt-1 leading-normal">
                   You steer BOTH cars sharing a single set of inputs! Turning left makes the Blue Car drift left, whilst the Red Car turns right. Accelerate to advance the tracks. Watch out for static blocks, slow traffic cars, and slippery oil slicks! Ensure BOTH cross the checkered flags to unlock the subsequent sector.
                </p>
              </div>

              <div>
                <h4 className="text-emerald-700 font-bold text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5 uppercase">
                  <span>🌸 THE 5 SPEEDWAY SECTORS</span>
                </h4>
                <ul className="list-disc pl-3 mt-1 space-y-1 text-[9px] text-slate-600">
                  <li><strong>W1: Shibuya Gate</strong>: Perfectly symmetrical lanes and obstacles configuration.</li>
                  <li><strong>W2: Shinkansen Route</strong>: Completely randomized layouts scroll separately.</li>
                  <li><strong>W3: Kyoto Cherry</strong>: Dynamic cherry blossom tracks with boost pads.</li>
                  <li><strong>W4: Fuji Pass</strong>: Extreme physics modifications on slippery volcanic tarmac lanes.</li>
                  <li><strong>W5: Akihabara Center</strong>: Coordinate rotations to challenge your synchronization limits.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => {
                audioEngine.playClick();
                setShowInfo(false);
              }}
              className="mt-2 py-2 bg-rose-500 hover:bg-rose-450 text-white font-sans font-bold text-[10px] uppercase tracking-widest rounded-lg cursor-pointer text-center border-2 border-rose-600 transition"
            >
              CLOSE MANUAL
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
