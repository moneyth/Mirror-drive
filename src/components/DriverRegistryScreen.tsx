/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Shield, Cpu, Sparkles } from 'lucide-react';
import audioEngine from './AudioEngine';

interface DriverRegistryScreenProps {
  onRegister: (name: string) => void;
}

export default function DriverRegistryScreen({ onRegister }: DriverRegistryScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = name.trim().toUpperCase();
    if (trimmed.length < 2) {
      setError('CALLSIGN MUST BE AT LEAST 2 CHARACTERS');
      audioEngine.playClick();
      return;
    }
    
    if (trimmed.length > 12) {
      setError('CALLSIGN MUST BE 12 CHARACTERS OR LESS');
      audioEngine.playClick();
      return;
    }

    if (!/^[A-Z0-9.\-_ ]+$/.test(trimmed)) {
      setError('ALPHANUMERIC CHARACTERS ONLY, SOLDIER');
      audioEngine.playClick();
      return;
    }

    audioEngine.playClick();
    audioEngine.playSuccess(); // play arpeggio fanfare in greeting!
    onRegister(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 select-none font-mono text-left z-50">
      {/* Scanline CRT overlay */}
      <div className="pointer-events-none absolute inset-0 z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" />
      
      {/* Grid background */}
      <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#0284c7_1px,transparent_1px),linear-gradient(to_bottom,#0284c7_1px,transparent_1px)] bg-[length:30px_30px]" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[460px] bg-slate-900 border-4 border-sky-500 rounded-2xl p-6 md:p-8 shadow-[0_0_30px_rgba(14,165,233,0.3)] z-10 text-center flex flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-1.5 border-b border-sky-500/20 pb-4">
          <div className="relative mb-2">
            <div className="absolute inset-0 rounded-full bg-sky-500/10 blur animate-pulse" />
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          
          <h1 className="text-xl font-black tracking-widest text-sky-400 uppercase italic font-sans dark:drop-shadow-[0_2px_8px_rgba(56,189,248,0.4)]">
            DRIVER REGISTRATION
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-relaxed">
            INPUT CALLSIGN TO CALIBRATE COGNITIVE DRIVE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-sky-500/90 font-extrabold pb-0.5 uppercase tracking-widest">
              PILOT CALLSIGN
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                maxLength={12}
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="E.G. GIGARIDER"
                className="w-full bg-slate-950 border-2 border-sky-500/40 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 text-sky-200 text-center font-bold font-mono py-3.5 px-4 rounded text-base uppercase tracking-widest focus:outline-none selection:bg-sky-500/30 shadow-inner"
              />
              <div className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none">
                <Sparkles className="w-4 h-4 text-sky-550 opacity-40" />
              </div>
            </div>
            
            <div className="flex justify-between text-[8.5px] font-bold text-slate-500 uppercase tracking-wider pt-0.5 px-1">
              <span>ALPHANUMERIC ONLY</span>
              <span className={name.length >= 10 ? 'text-amber-500' : ''}>
                {name.length} / 12 CHARS
              </span>
            </div>
          </div>

          <div className="min-h-5 flex items-center justify-center">
            {error && (
              <motion.span
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-400 text-[9.5px] font-bold uppercase tracking-wider border border-rose-500/20 bg-rose-950/20 py-1 px-3 rounded w-full text-center"
              >
                ⚠️ {error}
              </motion.span>
            )}
          </div>

          <button
            type="submit"
            disabled={name.trim().length < 2}
            className={`w-full font-sans font-black uppercase text-xs py-3.5 rounded transition-all tracking-wider flex items-center justify-center gap-2 border-2 cursor-pointer ${
              name.trim().length >= 2 
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-300 hover:border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.35)] active:scale-95' 
                : 'bg-slate-800 text-slate-500 border-slate-750 opacity-50 cursor-not-allowed'
            }`}
          >
            <span>INITIALIZE COGNIZANCE</span>
          </button>
        </form>

        <div className="border-t border-sky-500/10 pt-4 text-center">
          <p className="text-[8px] text-slate-500 tracking-widest uppercase font-bold max-w-[280px] mx-auto leading-normal">
            * Speed Vault leaderboards track high score indexes across all 30 Mirror sectors automatically.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
