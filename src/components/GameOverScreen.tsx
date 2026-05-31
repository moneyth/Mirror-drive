/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Award, Timer, Navigation, RotateCcw, Home } from 'lucide-react';
import audioEngine from './AudioEngine';

interface GameOverScreenProps {
  score: number;
  bestScore: number;
  timeElapsed: number;
  distance: number;
  onRestart: () => void;
  onMainMenu: () => void;
}

export default function GameOverScreen({
  score,
  bestScore,
  timeElapsed,
  distance,
  onRestart,
  onMainMenu,
}: GameOverScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Parse total elapsed runner duration to a readable format
  const formatTime = (secs: number) => {
    const minStr = String(Math.floor(secs / 60)).padStart(2, '0');
    const secStr = String(Math.floor(secs % 60)).padStart(2, '0');
    const msStr = String(Math.floor((secs % 1) * 100)).padStart(2, '0');
    return `${minStr}:${secStr}.${msStr}`;
  };

  // Bind key inputs for rapid, low-friction arcade restarts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeKey = e.key.toLowerCase();
      if (activeKey === 'r') {
        audioEngine.playClick();
        onRestart();
      } else if (activeKey === 'x' || activeKey === 'escape') {
        audioEngine.playClick();
        onMainMenu();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onRestart, onMainMenu]);

  // Render a dramatic Retro Pixelated Wreckage collision layout inside canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas sizes supporting crisp pixels
    const boundsW = 450;
    const boundsH = 240;
    canvas.width = boundsW;
    canvas.height = boundsH;

    let particleFrame = 0;
    let animationId: number;

    const render = () => {
      particleFrame++;
      // Clean canvas with a nostalgic bright grid sky
      ctx.fillStyle = '#bae6fd'; // Bright sky blue
      ctx.fillRect(0, 0, boundsW, boundsH);

      // Draw GBA hills in background
      ctx.fillStyle = '#7ec850'; // Lush grassy hill
      ctx.beginPath();
      ctx.arc(100, 150, 90, 0, Math.PI * 2);
      ctx.arc(350, 150, 110, 0, Math.PI * 2);
      ctx.fill();

      // Asphalt roadway
      ctx.fillStyle = '#64748b'; // Road grey
      ctx.fillRect(0, 140, boundsW, boundsH - 140);

      // Ground white borders
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 137, boundsW, 3);

      // Red/White curbs at top
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 135, boundsW, 2);

      // 1. Draw Wrecked Blue Car (chassis split slide on left side of track)
      ctx.save();
      ctx.translate(140, 175);
      ctx.rotate(-0.16);
      
      // Draw pixelated car body in blue
      ctx.fillStyle = '#1e3a8a'; // Dark navy / blue body
      ctx.fillRect(-22, -12, 44, 24);
      // Wheels disjoined or slightly askew
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-17, -15, 8, 4); // front wheels
      ctx.fillRect(9, -15, 8, 4);
      ctx.fillRect(-19, 11, 8, 4);  // rear wheels skew
      ctx.fillRect(11, 11, 8, 4);
      // Windshield crack
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-1, -7, 12, 14);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3, -7);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();

      // 2. Draw Wrecked Red Car (flipped slightly on the right side)
      ctx.save();
      ctx.translate(310, 168);
      ctx.rotate(0.24);
      
      // Flipped red car frame
      ctx.fillStyle = '#991b1b'; // Deep hazard crimson
      ctx.fillRect(-22, -12, 44, 24);
      // Wheels separated
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-14, -15, 8, 4);
      ctx.fillRect(12, -15, 8, 4);
      ctx.fillRect(-18, 11, 8, 4);
      ctx.fillRect(10, 11, 8, 4);
      // Crack windshield
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-6, -7, 12, 14);
      ctx.strokeStyle = '#e11d48';
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.lineTo(2, 4);
      ctx.stroke();
      ctx.restore();

      // 3. Render organic rising gray chiptune smoke/sparks over the wrecked cars
      ctx.save();
      const drawSmoke = (sx: number, sy: number) => {
        for (let idx = 0; idx < 3; idx++) {
          const size = 6 + ((particleFrame + idx * 25) % 20) * 0.55;
          const scrollY = sy - ((particleFrame + idx * 25) % 35) * 0.95;
          const swayX = sx + Math.sin((particleFrame + idx * 15) * 0.08) * 8;
          const alphaStr = (1.0 - ((particleFrame + idx * 25) % 35) / 35).toFixed(2);
          
          ctx.fillStyle = `rgba(100, 116, 139, ${alphaStr})`; // Charcoal smoke
          ctx.beginPath();
          ctx.arc(swayX, scrollY, size, 0, Math.PI * 2);
          ctx.fill();

          // Spark particle sparks
          if (idx % 2 === 0 && Math.random() < 0.6) {
            ctx.fillStyle = '#fb923c'; // Fire orange sparks
            ctx.fillRect(swayX - 5 + Math.random() * 10, scrollY - 2 + Math.random() * 5, 2.5, 2.5);
          }
        }
      };

      drawSmoke(140, 165);
      drawSmoke(310, 158);

      // Warning red indicator flashing light
      const alertState = Math.floor(particleFrame / 15) % 2 === 0;
      if (alertState) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'; // Ambient crimson danger flashing light
        ctx.fillRect(0, 0, boundsW, boundsH);
      }

      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="flex flex-col justify-center items-center w-full min-h-screen bg-slate-100 text-slate-800 p-4 select-none">
      
      {/* Outer framing wrapper to resemble retro high-contrast monitors */}
      <div className="w-full max-w-[850px] bg-gradient-to-b from-sky-50 to-slate-50 border-4 border-slate-400 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 relative">
        
        {/* Top Header Panel - Title & Red Hazard Indicator */}
        <div className="flex flex-col items-center justify-center relative drop-shadow-md">
          {/* Alternating hazard flashing red/orange border */}
          <div className="absolute inset-x-0 -top-2 flex justify-between px-6">
            <span className="w-3 h-3 bg-rose-600 rounded-full animate-ping" />
            <span className="w-3 h-3 bg-rose-600 rounded-full animate-ping delay-500" />
          </div>

          <h1 
            style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
            className="text-4xl md:text-5xl font-extrabold font-sans text-transparent bg-clip-text bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 italic tracking-wider uppercase text-center select-none"
          >
            GAME OVER
          </h1>
          
          <div className="relative mt-2">
            <div className="border-2 border-rose-500 bg-rose-50 text-rose-600 font-mono text-[11px] font-bold px-5 py-0.5 uppercase tracking-[0.25em] rounded relative shadow-inner">
              [ SYSTEM CRASHED ]
            </div>
          </div>
        </div>

        {/* Mid Section Grid - Dashboard stats on Left, Animated Canvas in Center, Buttons on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch h-auto">
          
          {/* 1. STATS PANEL (Left side matching layout) */}
          <div className="md:col-span-4 flex flex-col gap-3 justify-center">
            
            {/* SCORE BOX */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-slate-350 transition-colors flex flex-col text-left">
              <span className="text-[10px] text-emerald-600 font-mono tracking-widest font-bold uppercase flex items-center gap-1.5 mb-1">
                <Award size={14} /> YOUR SCORE
              </span>
              <div className="text-3xl font-mono text-slate-800 font-bold tracking-wider pt-0.5">
                {score.toLocaleString()}
              </div>
              {score >= bestScore && score > 0 && (
                <span className="font-mono text-[9px] text-rose-500 font-extrabold uppercase mt-1 animate-pulse">
                  🏆 NEW PERSONAL HIGH!
                </span>
              )}
            </div>

            {/* TIME ELAPSED BOX */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col text-left">
              <span className="text-[10px] text-sky-600 font-mono tracking-widest font-bold uppercase flex items-center gap-1.5 mb-1">
                <Timer size={14} /> ELAPSED TIME
              </span>
              <div className="text-2xl font-mono text-slate-800 font-bold tracking-wider pt-0.5">
                {formatTime(timeElapsed)}
              </div>
            </div>

            {/* TOTAL DISTANCE BOX */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col text-left font-mono">
              <span className="text-[10px] text-amber-600 font-mono tracking-widest font-bold uppercase flex items-center gap-1.5 mb-1">
                <Navigation size={14} /> TOTAL DISTANCE
              </span>
              <div className="text-2xl font-mono text-slate-800 font-bold tracking-wider pt-0.5">
                {distance.toFixed(2)} <span className="text-xs text-slate-500">KM</span>
              </div>
            </div>

          </div>

          {/* 2. CENTER WRECKAGE CANVAS (matching middle graphical component) */}
          <div className="md:col-span-8 flex flex-col justify-between items-center bg-white border border-slate-200 rounded-2xl p-2.5 relative shadow-sm">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[450px] aspect-[15/8] border border-slate-200 rounded-xl bg-sky-100"
            />
            
            {/* Dynamic wreckage label */}
            <span className="text-[8px] font-mono text-rose-500 font-bold uppercase tracking-widest mt-2 text-center select-none">
              SEVERE COLLISION EVENT DETECTED &middot; CHASSIS INTEGRITY COMPROMISED
            </span>
          </div>

        </div>

        {/* BOTTOM OPTION CONTROLS BAR (glorious pixel shortcuts) */}
        <div className="grid grid-cols-2 gap-4 mt-1 border-t border-slate-250 pt-5 font-mono">
          {/* RESTART */}
          <button
            onClick={() => {
              audioEngine.playClick();
              onRestart();
            }}
            id="crash-restart-btn"
            className="flex items-center justify-between py-2.5 px-6 rounded-lg bg-white border border-slate-300 hover:border-rose-400 hover:bg-rose-50 text-rose-600 text-xs uppercase tracking-widest font-bold cursor-pointer group transition-all duration-150 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-350 text-rose-500" />
              <span>RESTART RUN</span>
            </div>
            <div className="bg-slate-100 text-[10px] px-2 py-0.5 text-slate-500 border border-slate-200 rounded">
              R Key
            </div>
          </button>

          {/* MAIN MENU */}
          <button
            onClick={() => {
              audioEngine.playClick();
              onMainMenu();
            }}
            id="crash-menu-btn"
            className="flex items-center justify-between py-2.5 px-6 rounded-lg bg-white border border-slate-300 hover:border-amber-400 hover:bg-amber-50 text-amber-600 text-xs uppercase tracking-widest font-bold cursor-pointer group transition-all duration-150 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Home size={14} className="text-amber-500 animate-pulse" />
              <span>MAIN MENU</span>
            </div>
            <div className="bg-slate-100 text-[10px] px-2 py-0.5 text-slate-500 border border-slate-200 rounded">
              X Key
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
