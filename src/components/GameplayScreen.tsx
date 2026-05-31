/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameMode, Difficulty, PlayerStats, Obstacle, Particle, LevelConfig } from '../types';
import { getLevelConfig } from './Levels';
import { drawPixelCar, drawObstacle } from './CarRenderer';
import { Volume2, VolumeX, Pause, Play, RotateCcw, ArrowRight, Home, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import audioEngine from './AudioEngine';
import { submitScore } from '../lib/leaderboard';

interface GameplayScreenProps {
  levelId: number;
  difficulty: Difficulty;
  onGameOver: (elapsedSeconds: number, distance: number, perfect: boolean) => void;
  onLevelComplete: (levelId: number, completionTime: number) => void;
  onExit: () => void;
  playerName: string;
}

export default function GameplayScreen({
  levelId,
  difficulty,
  onGameOver,
  onLevelComplete,
  onExit,
  playerName,
}: GameplayScreenProps) {
  const levelConfig = getLevelConfig(levelId);
  const worldNum = levelConfig.world;

  // Game speed modes: EASY = 1.0x, NORMAL = 1.5x, HARD = 2.0x
  const speedMultiplier = difficulty === 'EASY' ? 1.0 : difficulty === 'NORMAL' ? 1.5 : 2.0;

  // React component states for displaying overlays
  const [levelStatus, setLevelStatus] = useState<'DRIVING' | 'CRASHED' | 'FINISH'>('DRIVING');
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(audioEngine.getMuteState());
  const [elapsedTime, setElapsedTime] = useState(0.0);
  const [bestTime, setBestTime] = useState<number | null>(null);

  const [celebrationRank, setCelebrationRank] = useState<number | null>(null);
  const [countdownVal, setCountdownVal] = useState<number | 'GO' | null>(3);
  const countdownValRef = useRef<number | 'GO' | null>(3);

  // Sync ref with state
  useEffect(() => {
    countdownValRef.current = countdownVal;
  }, [countdownVal]);

  // Update music low-pass filter on pause state change for premium sound design
  useEffect(() => {
    audioEngine.setMusicPauseFilter(isGamePaused);
    return () => {
      // Clear filter when unmounting
      audioEngine.setMusicPauseFilter(false);
    };
  }, [isGamePaused]);

  // High precision refs for 60fps loop
  const timeElapsedRef = useRef(0); // in milliseconds
  const lastTimeRef = useRef(0);
  const animationIdRef = useRef<number | null>(null);
  const keysPressed = useRef<Record<string, boolean>>({});

  // Render scale factor to fit the 800x600 combined console & gamepad perfectly in viewport
  const [scaleFactor, setScaleFactor] = useState(1);

  // Dynamic sizing of centered 800x600 sandbox containing both board & buttons
  useEffect(() => {
    const handleResize = () => {
      // Use tighter padding on mobile to maximize viewport utilization
      const padding = window.innerWidth < 640 ? 4 : 24;
      const scaleX = (window.innerWidth - padding) / 800;
      const scaleY = (window.innerHeight - padding) / 600;
      // Allow scaling of up to 1.5 for extremely clear high resolution tablet and monitor views
      // Clamped minimum of 0.15 prevents full collapse on extremely tight screens or initial mount frames
      const scale = Math.max(0.15, Math.min(scaleX, scaleY, 1.5));
      setScaleFactor(scale);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Countdown overlay timer controller
  useEffect(() => {
    if (countdownVal === null) return;

    if (countdownVal === 3) {
      audioEngine.playCountdown3();
    } else if (countdownVal === 2) {
      audioEngine.playCountdown2();
    } else if (countdownVal === 1) {
      audioEngine.playCountdown1();
    } else if (countdownVal === 'GO') {
      audioEngine.playCountdownGo();
      audioEngine.playMusic(worldNum); // Start background music on GO!
    }

    const timer = setTimeout(() => {
      if (countdownVal === 3) {
        setCountdownVal(2);
      } else if (countdownVal === 2) {
        setCountdownVal(1);
      } else if (countdownVal === 1) {
        setCountdownVal('GO');
      } else if (countdownVal === 'GO') {
        setCountdownVal(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownVal, worldNum]);

  // Retrieve best time from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mirrordrive_best_level_${levelId}`);
      if (stored) {
        setBestTime(parseFloat(stored));
      }
    } catch (e) {
      console.warn('localStorage is not accessible', e);
    }
  }, [levelId]);

  // Viewport HTML5 Canvas Refs
  const canvasLeftRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRightRef = useRef<HTMLCanvasElement | null>(null);

  // HUD DOM element refs for ultra-smooth GBA-style bypassed rendering updates
  const timerSpanRef = useRef<HTMLSpanElement | null>(null);
  const leftDistRef = useRef<HTMLSpanElement | null>(null);
  const rightDistRef = useRef<HTMLSpanElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const leftSpeedBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rightSpeedBarsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Interactive control deck button refs for bypass highlights
  const leftButtonRef = useRef<HTMLButtonElement | null>(null);
  const rightButtonRef = useRef<HTMLButtonElement | null>(null);
  const brakeButtonRef = useRef<HTMLButtonElement | null>(null);
  const gasButtonRef = useRef<HTMLButtonElement | null>(null);

  // Dynamic particle collections
  const pLeftParticles = useRef<Particle[]>([]);
  const pRightParticles = useRef<Particle[]>([]);

  // Physics models for Left (Blue) and Right (Red) cars
  const carLeft = useRef<PlayerStats>({
    speed: 0,
    isCrashed: false,
    crashTimer: 0,
    x: 0, // centered initially (-1 to 1)
    targetX: 0,
    roadOffset: 0, // travel in meters
    hitFlash: 0,
    boostDuration: 0,
    completed: false,
  });

  const carRight = useRef<PlayerStats>({
    speed: 0,
    isCrashed: false,
    crashTimer: 0,
    x: 0,
    targetX: 0,
    roadOffset: 0,
    hitFlash: 0,
    boostDuration: 0,
    completed: false,
  });

  // Level-specific obstacle lists
  const obstaclesLeft = useRef<Obstacle[]>([]);
  const obstaclesRight = useRef<Obstacle[]>([]);

  // Simulated keys helper for unified tap / mouse events
  const setSimulatedKey = (key: string, isPressed: boolean) => {
    keysPressed.current[key.toLowerCase()] = isPressed;
  };

  // Safe wrapper for triggering device haptic vibrations via the Web Vibration API
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (err) {
        // Safe catch-all for potential iframe or permission exceptions
      }
    }
  };

  // Sound toggler
  const handleToggleMute = () => {
    const isNowMuted = audioEngine.toggleMute();
    setIsAudioMuted(isNowMuted);
  };

  // Setup/Reset level parameters
  const initLevel = () => {
    setLevelStatus('DRIVING');
    setIsGamePaused(false);
    timeElapsedRef.current = 0;
    setElapsedTime(0);
    setCelebrationRank(null);

    // Dynamic scale configuration
    const length = levelConfig.length;

    // Reset left car
    carLeft.current = {
      speed: 0,
      isCrashed: false,
      crashTimer: 0,
      x: 0,
      targetX: 0,
      roadOffset: 0,
      hitFlash: 0,
      boostDuration: 0,
      completed: false,
    };

    // Reset right car
    carRight.current = {
      speed: 0,
      isCrashed: false,
      crashTimer: 0,
      x: 0,
      targetX: 0,
      roadOffset: 0,
      hitFlash: 0,
      boostDuration: 0,
      completed: false,
    };

    pLeftParticles.current = [];
    pRightParticles.current = [];

    // Deterministic Obstacle Generator based on Level ID
    let seed = levelId * 54321;
    const seededRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    const obstaclesListL: Obstacle[] = [];
    const obstaclesListR: Obstacle[] = [];

    // Spawning boundaries (skip start 120m and end 80m)
    const startZone = 120;
    const endZone = length - 80;
    // Obstacles density increases with difficulty scale
    const baseSpacing = 110 - Math.min(45, worldNum * 8 + (levelId % 6) * 4);

    for (let currentDist = startZone; currentDist < endZone; ) {
      // Advance spawn pointer
      currentDist += baseSpacing + seededRandom() * 50;

      if (currentDist >= endZone) break;

      // Select lane index (-1: left, 0: center, 1: right)
      const laneRollL = seededRandom();
      const laneL = laneRollL < 0.33 ? -1 : laneRollL < 0.66 ? 0 : 1;

      let laneRollR = seededRandom();
      let laneR = laneRollR < 0.33 ? -1 : laneRollR < 0.66 ? 0 : 1;

      // Obstacle type selection
      const typeRollL = seededRandom();
      let typeL: Obstacle['type'] = 'BARRIER';
      if (typeRollL < 0.4) {
        typeL = 'BARRIER';
      } else if (typeRollL < 0.75) {
        typeL = 'TRAFFIC_CAR';
      } else {
        typeL = 'OIL_SLICK';
      }

      let typeR: Obstacle['type'] = 'BARRIER';

      // World 1: Symmetrical mirrors
      if (worldNum === 1) {
        laneR = -laneL; // exact mirrored lane offset
        typeR = typeL;  // identical type
      } else {
        // Diverse, asymmetrical layouts
        const typeRollR = seededRandom();
        if (typeRollR < 0.4) {
          typeR = 'BARRIER';
        } else if (typeRollR < 0.75) {
          typeR = 'TRAFFIC_CAR';
        } else {
          typeR = 'OIL_SLICK';
        }
      }

      // World 3: Speed Breaks (Asymmetric Boost Pads)
      if (worldNum === 3) {
        if (seededRandom() < 0.28) {
          if (seededRandom() < 0.5) {
            typeL = 'BOOST_PAD';
          } else {
            typeR = 'BOOST_PAD';
          }
        }
      }

      // Push Left Obstacle
      obstaclesListL.push({
        id: `l_${currentDist}`,
        type: typeL,
        lane: laneL,
        worldY: currentDist,
        passed: false,
      });

      // Push Right Obstacle
      obstaclesListR.push({
        id: `r_${currentDist}`,
        type: typeR,
        lane: laneR,
        worldY: currentDist,
        passed: false,
      });
    }

    obstaclesLeft.current = obstaclesListL;
    obstaclesRight.current = obstaclesListR;

    lastTimeRef.current = 0;
    audioEngine.stopMusic();
    setCountdownVal(3);
  };

  // Keyboard hooks setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      if (e.key === 'r' || e.key === 'R') {
        audioEngine.playClick();
        initLevel();
      }
      if (e.key === 'Escape') {
        audioEngine.playClick();
        setIsGamePaused((p) => !p);
      }
      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    initLevel();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      audioEngine.stopMusic();
      audioEngine.setEnginePitch(0, 0, false);
    };
  }, [levelId]);

  // Particles generator
  const spawnParticles = (
    listArr: React.MutableRefObject<Particle[]>,
    x: number,
    y: number,
    color: string,
    qty = 6
  ) => {
    for (let i = 0; i < qty; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 0.5 + Math.random() * 2.5;
      listArr.current.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color,
        size: 2 + Math.random() * 4,
        life: 0,
        maxLife: 20 + Math.random() * 25,
      });
    }
  };

  // Main gameplay clock loop
  useEffect(() => {
    let active = true;

    const updatePhysicsAndRender = (timestamp: number) => {
      if (!active) return;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      // Clamp delta frame spikes to a maximum of 50ms and a minimum of 0ms to prevent glitches and negative temporal warping on frame lag
      const baseDt = Math.max(0, Math.min(50, timestamp - lastTimeRef.current));
      lastTimeRef.current = timestamp;

      if (isGamePaused || levelStatus !== 'DRIVING') {
        // Still redraw if paused or complete to maintain UI consistency
        renderTracks();
        if (active) {
          animationIdRef.current = requestAnimationFrame(updatePhysicsAndRender);
        }
        return;
      }

      const isCountdownActive = countdownValRef.current !== null;

      // Advance game timer only when countdown completes (tracked in unscaled real-world seconds)
      if (!isCountdownActive) {
        timeElapsedRef.current += baseDt;
        
        // High-efficiency DOM bypass timer update for zero React render overhead
        if (timerSpanRef.current) {
          timerSpanRef.current.textContent = `${(timeElapsedRef.current / 1000).toFixed(2)}s`;
        }
      }

      // Physics runs at difficulty-relative speed limit multipliers
      const dt = baseDt * speedMultiplier;

      // --- CRITICAL PERSISTENCE MULTIPLIERS BASED ON WORLD MECHANICS ---
      const levelSpeedLimit = 160 + levelConfig.baseSpeed * 20; // km/h limit
      
      // World 4: Asymmetric Physics handling
      const maxSpeedLeft = worldNum === 4 ? levelSpeedLimit * 1.25 : levelSpeedLimit; // Left is super fast
      const maxSpeedRight = worldNum === 4 ? levelSpeedLimit * 0.8 : levelSpeedLimit;  // Right is slow/grippy
      
      // Snappier, high responsive acceleration as requested
      const accelLeft = worldNum === 4 ? 0.38 : 0.28;
      const accelRight = worldNum === 4 ? 0.20 : 0.28;

      // 1. STEERING AND ACCELERATION CONTROLS
      const isUpPressed = isCountdownActive ? false : (keysPressed.current['arrowup'] || keysPressed.current['w']);
      const isDownPressed = isCountdownActive ? false : (keysPressed.current['arrowdown'] || keysPressed.current['s']);
      
      // Primary steering direction inputs
      let dirLeft = 0;
      if (!isCountdownActive) {
        if (keysPressed.current['arrowleft'] || keysPressed.current['a']) dirLeft = -1;
        if (keysPressed.current['arrowright'] || keysPressed.current['d']) dirLeft = 1;
      }

      // Car B steering is inverted / mirrored
      const dirRight = -dirLeft;

      // Update Left Car Velocity
      const currentMaxL = carLeft.current.boostDuration > 0 ? maxSpeedLeft * 1.5 : maxSpeedLeft;
      if (isCountdownActive || carLeft.current.completed) {
        carLeft.current.speed = 0;
      } else if (carLeft.current.isCrashed) {
        carLeft.current.speed = Math.max(0, carLeft.current.speed - 0.15 * dt);
      } else if (isUpPressed) {
        carLeft.current.speed = Math.min(currentMaxL, carLeft.current.speed + accelLeft * dt);
      } else if (isDownPressed) {
        // Highly responsive, strong brake force to prevent crashing
        carLeft.current.speed = Math.max(-25, carLeft.current.speed - 0.38 * dt);
      } else {
        // Friction roll down slightly reduced for nice coasting
        carLeft.current.speed = Math.max(0, carLeft.current.speed - 0.008 * dt);
      }

      // Update Right Car Velocity
      const currentMaxR = carRight.current.boostDuration > 0 ? maxSpeedRight * 1.5 : maxSpeedRight;
      if (isCountdownActive || carRight.current.completed) {
        carRight.current.speed = 0;
      } else if (carRight.current.isCrashed) {
        carRight.current.speed = Math.max(0, carRight.current.speed - 0.15 * dt);
      } else if (isUpPressed) {
        carRight.current.speed = Math.min(currentMaxR, carRight.current.speed + accelRight * dt);
      } else if (isDownPressed) {
        // Highly responsive, strong brake force to prevent crashing
        carRight.current.speed = Math.max(-25, carRight.current.speed - 0.38 * dt);
      } else {
        carRight.current.speed = Math.max(0, carRight.current.speed - 0.008 * dt);
      }

      // Set engine hum sound pitch
      audioEngine.setEnginePitch(
        carLeft.current.speed / maxSpeedLeft,
        carRight.current.speed / maxSpeedRight,
        levelStatus === 'DRIVING'
      );

      // Travel update
      if (!carLeft.current.completed) {
        // Double progress speed over 0.00035 to make it engaging, but not insanely twitchy
        carLeft.current.roadOffset += (carLeft.current.speed * 0.00085) * dt;
        if (carLeft.current.roadOffset >= levelConfig.length) {
          carLeft.current.roadOffset = levelConfig.length;
          carLeft.current.completed = true;
          carLeft.current.speed = 0;
        }
      }

      if (!carRight.current.completed) {
        carRight.current.roadOffset += (carRight.current.speed * 0.00085) * dt;
        if (carRight.current.roadOffset >= levelConfig.length) {
          carRight.current.roadOffset = levelConfig.length;
          carRight.current.completed = true;
          carRight.current.speed = 0;
        }
      }

      // Handle Boost Duration decaying
      if (carLeft.current.boostDuration > 0) carLeft.current.boostDuration -= dt;
      if (carRight.current.boostDuration > 0) carRight.current.boostDuration -= dt;

      // Handle spinout locks recovery
      if (carLeft.current.isCrashed) {
        carLeft.current.crashTimer -= dt;
        if (carLeft.current.crashTimer <= 0) {
          carLeft.current.isCrashed = false;
        }
      }
      if (carRight.current.isCrashed) {
        carRight.current.crashTimer -= dt;
        if (carRight.current.crashTimer <= 0) {
          carRight.current.isCrashed = false;
        }
      }

      // Hit flashes decay
      if (carLeft.current.hitFlash > 0) carLeft.current.hitFlash -= 0.08;
      if (carRight.current.hitFlash > 0) carRight.current.hitFlash -= 0.08;

      // 2. STEERING HANDLING SCHEMES
      // Left Car Steering
      if (!carLeft.current.isCrashed && !carLeft.current.completed) {
        if (worldNum === 4) {
          // Slippery inertia physics
          // Steering applies side velocity
          const slidePower = 0.0025 * dt;
          carLeft.current.targetX = Math.max(-1.0, Math.min(1.0, carLeft.current.targetX + dirLeft * slidePower));
          carLeft.current.x += (carLeft.current.targetX - carLeft.current.x) * 0.08;
        } else {
          // Sharp, normal physics
          const turnAmount = 0.003 * dt * (0.6 + carLeft.current.speed / levelSpeedLimit);
          carLeft.current.x = Math.max(-1.0, Math.min(1.0, carLeft.current.x + dirLeft * turnAmount));
          carLeft.current.targetX = carLeft.current.x;
        }
      }

      // Right Car Steering
      if (!carRight.current.isCrashed && !carRight.current.completed) {
        // World 4: Slow but grippy (snaps instantly)
        const turnSpeedScale = worldNum === 4 ? 0.0045 : 0.003;
        const turnAmount = turnSpeedScale * dt * (0.6 + carRight.current.speed / levelSpeedLimit);
        carRight.current.x = Math.max(-1.0, Math.min(1.0, carRight.current.x + dirRight * turnAmount));
        carRight.current.targetX = carRight.current.x;
      }

      // Handle World 5 rotational controls adjustments if any (automatic because visual rotation handles coordinate translations!)

      // 3. UPDATE PARTICLES LIFE
      const handleParticlePhysics = (listArr: React.MutableRefObject<Particle[]>) => {
        listArr.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life++;
        });
        listArr.current = listArr.current.filter((p) => p.life < p.maxLife);
      };
      handleParticlePhysics(pLeftParticles);
      handleParticlePhysics(pRightParticles);

      // Dust smoke coming from rear tires when accelerating
      if (isUpPressed && Math.random() < 0.25) {
        const xlVal = 175 + carLeft.current.x * 90;
        const xrVal = 175 + carRight.current.x * 90;
        if (carLeft.current.speed > 10 && !carLeft.current.completed) {
          spawnParticles(pLeftParticles, xlVal - 6, 380, '#333', 1);
          spawnParticles(pLeftParticles, xlVal + 6, 380, '#333', 1);
        }
        if (carRight.current.speed > 10 && !carRight.current.completed) {
          spawnParticles(pRightParticles, xrVal - 6, 380, '#333', 1);
          spawnParticles(pRightParticles, xrVal + 6, 380, '#333', 1);
        }
      }

      // CHECK COLLISIONS AND HAZARDS
      const checkCollisionsForTrack = (
          isLeft: boolean,
          carRef: React.MutableRefObject<PlayerStats>,
          obstaclesRef: React.MutableRefObject<Obstacle[]>,
          particlesRef: React.MutableRefObject<Particle[]>
      ) => {
        if (carRef.current.completed) return;

        obstaclesRef.current.forEach((obs) => {
          if (obs.hit) return; // Skip already triggered obstacles

          // Define half-sizes for forgiving arcade bounding boxes
          let obsHalfW = 16;
          let obsHalfH = 7;

          if (obs.type === 'TRAFFIC_CAR') {
            obsHalfW = 11;
            obsHalfH = 20;
          } else if (obs.type === 'BOOST_PAD') {
            obsHalfW = 14;
            obsHalfH = 11;
          } else if (obs.type === 'OIL_SLICK') {
            obsHalfW = 16;
            obsHalfH = 9;
          } else { // BARRIER or others
            obsHalfW = 16;
            obsHalfH = 7;
          }

          // Compute obstacle screen coordinate (for drawing/particles)
          const screenY = 360 - (obs.worldY - carRef.current.roadOffset) * 1.5;
          const carXPixel = 175 + carRef.current.x * 90;
          const obsXPixel = 175 + obs.lane * 90;

          // SWEPT COLLISION DETECTION SYSTEM (Eliminates vertical & horizontal phasing)
          // 1. Vertical Swept Check: Calculate distance traveled during this frame in world meters
          // 1.5 vertical scanline pixels equal 1 road meter
          const deltaOffset = isCountdownActive ? 0 : (carRef.current.speed * 0.00085) * dt;
          
          const carHalfMeters = 22 / 1.5; // Car bounding half-height is 22 pixels
          const obsHalfMeters = obsHalfH / 1.5;

          // Swept bounding boxes covering entire path traveled between frame start and end
          const carMinWorldY = carRef.current.roadOffset - deltaOffset - carHalfMeters;
          const carMaxWorldY = carRef.current.roadOffset + carHalfMeters;
          const obsMinWorldY = obs.worldY - obsHalfMeters;
          const obsMaxWorldY = obs.worldY + obsHalfMeters;

          const isYOverlapping = (obsMaxWorldY >= carMinWorldY && obsMinWorldY <= carMaxWorldY);

          // 2. Horizontal Lane Check: Guard against hovering between lanes (phasing bypass cheat)
          // Boost pads require specific lane centering, while solid barriers/hazards check 
          // a wider transitioning hitbox to prevent the car from slipping between lanes.
          let maxLaneSpacing = 0.62;
          if (obs.type === 'BOOST_PAD') {
            maxLaneSpacing = 0.35; // Must be centered in the lane to hit boost pads safely
          }
          const isXOverlapping = Math.abs(carRef.current.x - obs.lane) < maxLaneSpacing;

          const isOverlapping = isYOverlapping && isXOverlapping;

          if (isOverlapping) {
            if (obs.type === 'BOOST_PAD') {
              if (carRef.current.boostDuration <= 0) {
                audioEngine.playBoost();
                carRef.current.boostDuration = 1000; // 1 second boost
                spawnParticles(particlesRef, carXPixel, 360, '#22d3ee', 12);
              }
              obs.hit = true;
            } else if (obs.type === 'OIL_SLICK') {
              if (!carRef.current.isCrashed) {
                audioEngine.playOilSlick();
                triggerHaptic([80, 50, 80]); // Dual pulse pattern simulating traction loss
                carRef.current.isCrashed = true;
                carRef.current.crashTimer = 1000; // spinning duration
                carRef.current.hitFlash = 0.8;
                carRef.current.targetX = carRef.current.x + (Math.random() < 0.5 ? -0.4 : 0.4);
                spawnParticles(particlesRef, carXPixel, 360, '#312e81', 8);
              }
              obs.hit = true;
            } else {
              // Barrier or Traffic Car crash results in INSTANT crash failure
              audioEngine.playCrash();
              triggerHaptic([300, 100, 200, 50, 100]); // Rich double-shock rumble representing massive impact
              carRef.current.isCrashed = true;
              carRef.current.speed = 0;
              carRef.current.hitFlash = 1.0;
              
              // Big satisfying explosion sparks
              spawnParticles(particlesRef, carXPixel, 360, '#ff3366', 22);
              spawnParticles(particlesRef, obsXPixel, screenY, '#ffb833', 15);

              // Show state transition
              const completionTimeInSec = timeElapsedRef.current / 1000;
              setElapsedTime(completionTimeInSec);
              setLevelStatus('CRASHED');
              audioEngine.stopMusic();
            }
          }
        });
      };

      checkCollisionsForTrack(true, carLeft, obstaclesLeft, pLeftParticles);
      checkCollisionsForTrack(false, carRight, obstaclesRight, pRightParticles);

      // Check level win completion: BOTH cars must cross the finish line
      if (carLeft.current.completed && carRight.current.completed && levelStatus === 'DRIVING') {
        const completionTimeInSec = timeElapsedRef.current / 1000;
        setElapsedTime(completionTimeInSec);
        setLevelStatus('FINISH');
        audioEngine.stopMusic();
        audioEngine.playSuccess();

        // Submit score to competitive Speed Vault rankings
        try {
          const scoreResult = submitScore(levelId, playerName, completionTimeInSec);
          if (scoreResult.rank && scoreResult.rank <= 3) {
            setCelebrationRank(scoreResult.rank);
          }
        } catch (err) {
          console.warn("Failed to process leaderboard submission:", err);
        }

        // Save best completion record to local store
        let isNewRecord = false;
        try {
          const stored = localStorage.getItem(`mirrordrive_best_level_${levelId}`);
          if (!stored || completionTimeInSec < parseFloat(stored)) {
            localStorage.setItem(`mirrordrive_best_level_${levelId}`, completionTimeInSec.toString());
            setBestTime(completionTimeInSec);
            isNewRecord = true;
          }
        } catch (e) {
          console.warn('Unable to persist level best time', e);
        }
      }

      // Update high-efficiency real-time HUD visual bypass DOM indicators
      const leftDistPercent = Math.min(100, Math.floor((carLeft.current.roadOffset / levelConfig.length) * 100));
      if (leftDistRef.current) {
        leftDistRef.current.textContent = `${leftDistPercent}% DIST`;
      }

      const rightDistPercent = Math.min(100, Math.floor((carRight.current.roadOffset / levelConfig.length) * 100));
      if (rightDistRef.current) {
        rightDistRef.current.textContent = `${rightDistPercent}% DIST`;
      }

      const currentProgressCalculated = Math.min(
        100,
        Math.floor((Math.max(carLeft.current.roadOffset, carRight.current.roadOffset) / levelConfig.length) * 100)
      );
      if (progressFillRef.current) {
        progressFillRef.current.style.height = `${currentProgressCalculated}%`;
      }

      // Update Left Car Speedometer Bars bypassing React renders
      const leftSpeedRatio = carLeft.current.speed / 180;
      for (let idx = 0; idx < 8; idx++) {
        const bar = leftSpeedBarsRef.current[idx];
        if (bar) {
          const activeBar = leftSpeedRatio >= (7 - idx) * 0.12;
          if (activeBar) {
            bar.className = 'w-1.5 h-3.5 rounded-sm bg-sky-400 shadow-[0_0_4px_#38bdf8]';
          } else {
            bar.className = 'w-1.5 h-3.5 rounded-sm bg-[#1e1b29]/60';
          }
        }
      }

      // Update Right Car Speedometer Bars bypassing React renders
      const rightSpeedRatio = carRight.current.speed / 185;
      for (let idx = 0; idx < 8; idx++) {
        const bar = rightSpeedBarsRef.current[idx];
        if (bar) {
          const activeBar = rightSpeedRatio >= (7 - idx) * 0.12;
          if (activeBar) {
            bar.className = 'w-1.5 h-3.5 rounded-sm bg-red-400 shadow-[0_0_4px_#f87171]';
          } else {
            bar.className = 'w-1.5 h-3.5 rounded-sm bg-[#1e1b29]/60';
          }
        }
      }

      // Update control deck buttons highlights bypassing React virtual DOM reconciliation
      const leftBtn = leftButtonRef.current;
      if (leftBtn) {
        const isPressed = keysPressed.current['arrowleft'] || keysPressed.current['a'];
        leftBtn.className = `w-28 h-18 rounded-lg border text-sm font-black flex items-center justify-center cursor-pointer select-none transition-all duration-100 ${
          isPressed
            ? 'bg-sky-500 text-white border-sky-600 scale-98 shadow-sm font-black'
            : 'bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200'
        }`;
      }

      const rightBtn = rightButtonRef.current;
      if (rightBtn) {
        const isPressed = keysPressed.current['arrowright'] || keysPressed.current['d'];
        rightBtn.className = `w-28 h-18 rounded-lg border text-sm font-black flex items-center justify-center cursor-pointer select-none transition-all duration-100 ${
          isPressed
            ? 'bg-sky-500 text-white border-sky-600 scale-98 shadow-sm font-black'
            : 'bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200'
        }`;
      }

      const brakeBtn = brakeButtonRef.current;
      if (brakeBtn) {
        const isPressed = keysPressed.current['arrowdown'] || keysPressed.current['s'];
        brakeBtn.className = `w-28 h-18 rounded-lg border text-[11px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all duration-100 ${
          isPressed
            ? 'bg-rose-500 text-white border-rose-600 scale-98 shadow-sm'
            : 'bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200'
        }`;
      }

      const gasBtn = gasButtonRef.current;
      if (gasBtn) {
        const isPressed = keysPressed.current['arrowup'] || keysPressed.current['w'];
        gasBtn.className = `w-28 h-18 rounded-lg border text-[11px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all duration-100 ${
          isPressed
            ? 'bg-emerald-500 text-white border-emerald-600 scale-98 shadow-sm'
            : 'bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200'
        }`;
      }

      renderTracks();
      if (active) {
        animationIdRef.current = requestAnimationFrame(updatePhysicsAndRender);
      }
    };

    animationIdRef.current = requestAnimationFrame(updatePhysicsAndRender);

    return () => {
      active = false;
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    };
  }, [levelId, isGamePaused, levelStatus]);

  // Unified visual drawing method
  const renderTracks = () => {
    // Left Canvas Drawing
    const canvasL = canvasLeftRef.current;
    if (canvasL) {
      const ctxL = canvasL.getContext('2d');
      if (ctxL) drawTrackViewport(ctxL, true);
    }

    // Right Canvas Drawing
    const canvasR = canvasRightRef.current;
    if (canvasR) {
      const ctxR = canvasR.getContext('2d');
      if (ctxR) {
        ctxR.save();
        // Translate to right coordinate center for potential rotations (World 5 Chaos)
        if (worldNum === 5) {
          ctxR.translate(175, 225);
          if (levelId >= 25 && levelId <= 27) {
            // Rotated 180 degrees (upside down)
            ctxR.rotate(Math.PI);
          } else if (levelId >= 28 && levelId <= 30) {
            // Rotated 90 degrees clockwise
            ctxR.rotate(Math.PI / 2);
          }
          ctxR.translate(-175, -225);
        }

        drawTrackViewport(ctxR, false);
        ctxR.restore();
      }
    }
  };

  // Draws a track view onto its context canvas
  const drawTrackViewport = (ctx: CanvasRenderingContext2D, isLeft: boolean) => {
    const w = 350;
    const h = 450;
    const carRef = isLeft ? carLeft.current : carRight.current;
    const obstacles = isLeft ? obstaclesLeft.current : obstaclesRight.current;
    const particles = isLeft ? pLeftParticles.current : pRightParticles.current;

    // Define world style configurations dynamically based on world area (1-5)
    let bgStyle = '#7ec850';
    let marginStyle = '#dfbe95';
    let roadStyle = '#64748b';
    let curbStyleA = '#ef4444';
    let curbStyleB = '#ffffff';

    switch (worldNum) {
      case 1: // Shibuya Parkway - Urban high-tech concrete block / Grid
        bgStyle = '#27272a'; // Dark zinc pavement
        marginStyle = '#52525b'; // Light concrete sidewalks
        roadStyle = '#0f172a'; // Deep slate asphalt
        curbStyleA = '#eab308'; // Warning yellow
        curbStyleB = '#18181b'; // Sleek dark black
        break;
      case 2: // Shinkansen Bypass - High-speed industrial railroad detour
        bgStyle = '#3f3f46'; // Ballast stone gravel base
        marginStyle = '#27272a'; // Track steel sleepers boundary
        roadStyle = '#334155'; // Industrial blue-grey tarmac
        curbStyleA = '#f97316'; // Vivid hazard orange
        curbStyleB = '#475569'; // Steel grey curb
        break;
      case 3: // Kyoto Cherry Pass - Traditional scenic floral pass (default look)
        bgStyle = '#7ec850'; // Vibrant green grass
        marginStyle = '#dfbe95'; // Kyoto raked sand
        roadStyle = '#64748b'; // Slate grey
        curbStyleA = '#ef4444'; // Traditional red lacquer
        curbStyleB = '#ffffff'; // Pristine white
        break;
      case 4: // Fuji Switchbacks - High altitude frozen volcanic path
        bgStyle = '#111827'; // Black obsidian volcanic rock
        marginStyle = '#f1f5f9'; // Cold snowy banks
        roadStyle = '#374151'; // Silvery frozen asphalt
        curbStyleA = '#06b6d4'; // Glowing frost-cyan
        curbStyleB = '#ffffff'; // White snow
        break;
      case 5: // Akihabara Grid - Virtual mainframe retro digital vector space
        bgStyle = '#030712'; // True pixel black space void
        marginStyle = '#6b21a8'; // Glowing violet buffer rails
        roadStyle = '#090514'; // Cyber slate deck
        curbStyleA = '#d946ef'; // Neon pink
        curbStyleB = '#22d3ee'; // Neon cyan
        break;
    }

    // 1. Draw Background terrain with custom world-based textures & scrolling behaviors
    if (worldNum === 1) {
      // Draw concrete tiling on background
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Side vertical tile grids
      for (let gx = 0; gx <= 40; gx += 10) {
        ctx.moveTo(gx, 0); ctx.lineTo(gx, h);
        ctx.moveTo(w - gx, 0); ctx.lineTo(w - gx, h);
      }
      // Horizontal tiles scrolling downward with road speed
      const scrollYTile = (carRef.roadOffset * 0.5) % 20;
      for (let gy = -20; gy < h + 20; gy += 20) {
        ctx.moveTo(0, gy + scrollYTile); ctx.lineTo(40, gy + scrollYTile);
        ctx.moveTo(w - 40, gy + scrollYTile); ctx.lineTo(w, gy + scrollYTile);
      }
      ctx.stroke();

      // Sidewalk margins
      ctx.fillStyle = marginStyle;
      ctx.fillRect(0, 0, 40, h);
      ctx.fillRect(w - 40, 0, 40, h);

      // Yellow neon warning stripes
      ctx.fillStyle = '#eab308';
      for (let py = 0; py < h; py += 40) {
        const scrollYLeft = (py + (carRef.roadOffset * 0.75)) % h;
        ctx.fillRect(12, Math.floor(scrollYLeft), 3, 10);
        ctx.fillRect(w - 15, Math.floor(scrollYLeft), 3, 10);
      }

    } else if (worldNum === 2) {
      // Railroad ballast rocks
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b'; 
      for (let i = 0; i < 20; i++) {
        const gx = (i * 123) % 36 + 2;
        const rx = w - 38 + ((i * 151) % 36);
        const gy = (i * 97 + carRef.roadOffset * 0.45) % h;
        ctx.fillRect(gx, gy, 3, 3);
        ctx.fillRect(rx, gy, 3, 3);
      }

      // Track sleeper beds
      ctx.fillStyle = marginStyle;
      ctx.fillRect(0, 0, 40, h);
      ctx.fillRect(w - 40, 0, 40, h);

      // Railroad sleeper wooden ties
      ctx.fillStyle = '#78350f'; 
      const sleeperInt = 32;
      const scrollSleeper = (carRef.roadOffset * 0.8) % sleeperInt;
      for (let sy = -sleeperInt; sy < h + sleeperInt; sy += sleeperInt) {
        ctx.fillRect(8, sy + scrollSleeper, 24, 3);
        ctx.fillRect(w - 32, sy + scrollSleeper, 24, 3);
      }
      // Dual high-speed silver rails
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(13, 0, 3, h);
      ctx.fillRect(23, 0, 3, h);
      ctx.fillRect(w - 26, 0, 3, h);
      ctx.fillRect(w - 16, 0, 3, h);

    } else if (worldNum === 4) {
      // Dark Volcanic switchback soils & Obsidian peaks
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);

      // Snowy bank side buffers
      ctx.fillStyle = marginStyle;
      ctx.fillRect(0, 0, 40, h);
      ctx.fillRect(w - 40, 0, 40, h);

      // Dark basalt rocks on snow banks
      ctx.fillStyle = '#1e293b';
      const rockInt = 64;
      const scrollRocks = (carRef.roadOffset * 0.35) % rockInt;
      for (let sy = -rockInt; sy < h + rockInt; sy += rockInt) {
        const lOf = Math.abs(Math.sin(sy)) * 14;
        const rOf = Math.abs(Math.cos(sy)) * 14;
        ctx.fillRect(10 + lOf, sy + scrollRocks, 6, 6);
        ctx.fillRect(w - 16 - rOf, sy + scrollRocks, 6, 6);
      }

    } else if (worldNum === 5) {
      // Digital matrix space void background
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);

      // Clean glowing horizontal & vertical vector grid coordinate lines
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      // Columns
      for (let gx = 0; gx <= 40; gx += 10) {
        ctx.moveTo(gx, 0); ctx.lineTo(gx, h);
        ctx.moveTo(w - gx, 0); ctx.lineTo(w - gx, h);
      }
      // Scrolling rows
      const scrollVirtualGrid = (carRef.roadOffset * 0.95) % 20;
      for (let gy = -20; gy < h + 20; gy += 20) {
        ctx.moveTo(0, gy + scrollVirtualGrid); ctx.lineTo(40, gy + scrollVirtualGrid);
        ctx.moveTo(w - 40, gy + scrollVirtualGrid); ctx.lineTo(w, gy + scrollVirtualGrid);
      }
      ctx.stroke();

      // Cyber margin buffer rails
      ctx.fillStyle = marginStyle;
      ctx.fillRect(0, 0, 40, h);
      ctx.fillRect(w - 40, 0, 40, h);

      // Cyber nodes/dots representation
      ctx.fillStyle = '#38bdf8';
      const cyberInt = 48;
      const scrollCyber = (carRef.roadOffset * 0.72) % cyberInt;
      for (let cy = -cyberInt; cy < h + cyberInt; cy += cyberInt) {
        ctx.fillRect(18, cy + scrollCyber, 4, 4);
        ctx.fillRect(w - 22, cy + scrollCyber, 4, 4);
      }

    } else {
      // Kyoto Cherry Pass or general - traditional grass background
      ctx.fillStyle = bgStyle;
      ctx.fillRect(0, 0, w, h);

      // Sand shoulder margins
      ctx.fillStyle = marginStyle;
      ctx.fillRect(0, 0, 40, h);
      ctx.fillRect(w - 40, 0, 40, h);

      // Fallen sakura petals on shoulders
      ctx.fillStyle = '#f472b6';
      for (let py = 0; py < h; py += 32) {
        const scrollYLeft = (py + (carRef.roadOffset * 0.6)) % h;
        ctx.fillRect(Math.floor(15 + (Math.sin(py) * 10)), Math.floor(scrollYLeft), 3, 3);
        ctx.fillRect(Math.floor(w - 25 + (Math.cos(py) * 10)), Math.floor(scrollYLeft), 3, 3);
      }
    }

    // 2. Main Road Center asphalt body with dynamic world coloring
    ctx.fillStyle = roadStyle;
    ctx.fillRect(40, 0, 270, h);

    // 3. Alternating speed curbs utilizing world-specific accent pairings
    const blockLen = 22;
    const dynamicScroll = carRef.roadOffset % (blockLen * 2);
    for (let py = -blockLen * 2; py < h + blockLen * 2; py += blockLen) {
      const cy = py + dynamicScroll;
      const isAltColor = Math.floor((cy - dynamicScroll) / blockLen) % 2 === 0;
      ctx.fillStyle = isAltColor ? curbStyleA : curbStyleB;
      
      // Left curb strip at X = 35
      ctx.fillRect(35, cy, 5, blockLen);
      // Right curb strip at X = 310
      ctx.fillRect(310, cy, 5, blockLen);
    }

    // 4. White Lane Divider markings (dashed lines)
    ctx.strokeStyle = worldNum === 5 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 20]);
    ctx.lineDashOffset = -carRef.roadOffset * 0.95;

    // Draw 2 dividing lane lines (making 3 lanes total)
    ctx.beginPath();
    ctx.moveTo(130, 0);
    ctx.lineTo(130, h);
    ctx.moveTo(220, 0);
    ctx.lineTo(220, h);
    ctx.stroke();
    ctx.setLineDash([]); // clear lines mask

    // 4b. Draw drifting/fluttering Elements over the road suitable for each world theme
    ctx.save();
    for (let i = 0; i < 9; i++) {
      // Deterministically seed drawing positions based on index
      const seedX = (i * 83) % (w - 70) + 35;
      const seedY = ((carRef.roadOffset * 0.5) + (i * 97)) % (h + 30) - 15;
      const size = 3 + (i % 3);
      const angle = (carRef.roadOffset * 0.012 + i * 1.1) % (Math.PI * 2);

      ctx.save();
      ctx.translate(seedX + Math.sin(carRef.roadOffset * 0.008 + i) * 12, seedY);
      ctx.rotate(angle);
      
      if (worldNum === 1) {
        // Shibuya Parkway - holographic neon cyan & amber data chips
        ctx.fillStyle = i % 2 === 0 ? '#06b6d4' : '#fbbf24';
        ctx.fillRect(-size, -size, size * 2, size * 2);
      } else if (worldNum === 2) {
        // Shinkansen Bypass - sharp yellow warning sparks or metallic glints
        ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.4);
        ctx.lineTo(size * 0.8, size * 0.8);
        ctx.lineTo(-size * 0.8, size * 0.8);
        ctx.closePath();
        ctx.fill();
      } else if (worldNum === 4) {
        // Fuji Switchbacks - white crystalline diamond frozen ice flakes
        ctx.fillStyle = i % 2 === 0 ? '#e2e8f0' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.3);
        ctx.lineTo(size * 0.8, 0);
        ctx.lineTo(0, size * 1.3);
        ctx.lineTo(-size * 0.8, 0);
        ctx.closePath();
        ctx.fill();
      } else if (worldNum === 5) {
        // Akihabara Grid - glowing computer binary green data keys
        ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#34d399';
        ctx.font = `bold ${8 + (i % 2) * 3}px "Courier New", monospace`;
        ctx.fillText(i % 2 === 0 ? "0" : "1", -size / 2, size / 2);
      } else {
        // Kyoto Cherry Pass or general: traditional pink sakura petals
        ctx.fillStyle = i % 2 === 0 ? '#f472b6' : '#ec4899';
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.3, size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Soft light glint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-size * 0.3, -size * 0.1, size * 0.4, size * 0.15, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();

    // 5. Draw Checkered Finish Line if we are near the end of the level
    const finishOffset = levelConfig.length - carRef.roadOffset;
    const finishY = 360 - finishOffset * 1.5;
    if (finishY > -100 && finishY < h + 100) {
      // Symmetrical checkers blocks row
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(40, finishY, 270, 25);
      ctx.fillStyle = '#000000';
      const squareSize = 10;
      for (let rx = 40; rx < 310; rx += squareSize * 2) {
        for (let ry = 0; ry < 25; ry += squareSize) {
          const isOddRow = ry === squareSize;
          const isOddCol = (rx - 40) % (squareSize * 2) === 0;
          if (isOddRow !== isOddCol) {
            ctx.fillRect(rx, finishY + ry, squareSize, squareSize);
          }
        }
      }
      ctx.restore();
    }

    // 6. Spawn and draw obstacles deterministically
    obstacles.forEach((obs) => {
      const screenY = 360 - (obs.worldY - carRef.roadOffset) * 1.5;

      // Only draw if inside bounding viewport
      if (screenY > -100 && screenY < h + 100) {
        const obsX = 175 + obs.lane * 90;

        if (obs.type === 'TRAFFIC_CAR') {
          // Draw slow oncoming traffic car
          // Facing down towards us
          drawPixelCar(
            ctx,
            obsX,
            screenY,
            30,
            58,
            Math.PI, 
            'TRAFFIC_ORANGE', // Traffic car
            false,
            null,
            0,
            false // lights off
          );
        } else if (obs.type === 'BOOST_PAD') {
          // Draw high-visibility glowing cyan arrow booster pad on lane floor
          ctx.save();
          ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
          ctx.beginPath();
          ctx.moveTo(obsX - 18, screenY + 10);
          ctx.lineTo(obsX, screenY - 14);
          ctx.lineTo(obsX + 18, screenY + 10);
          ctx.lineTo(obsX + 8, screenY + 10);
          ctx.lineTo(obsX + 8, screenY + 16);
          ctx.lineTo(obsX - 8, screenY + 16);
          ctx.lineTo(obsX - 8, screenY + 10);
          ctx.closePath();
          ctx.fill();

          // Outer yellow neon lines
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        } else {
          // Draw direct solids (Barriers) or liquids (Oil Slicks)
          drawObstacle(ctx, obsX, screenY, obs.type === 'OIL_SLICK' ? 'OIL_SLICK' : 'BARRIER', 44, obs.type === 'OIL_SLICK' ? 24 : 20);
        }
      }
    });

    // 7. Render Particles
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // 8. Render actual active Player Car
    // Left Car color scheme: Blue GT3RS, Right Car color scheme: Red/Orange model
    const carXPixel = 175 + carRef.x * 90;
    const isSpinning = carRef.isCrashed && carRef.crashTimer > 100 && carRef.crashTimer < 900;
    const angleRotation = isSpinning ? (carRef.crashTimer * 0.04) : 0;
    
    const carTheme = isLeft ? 'WHITE_GREEN' : 'BLACK_RED'; // Left uses Green/White, Right uses Black/Red decals
    
    // Custom headlights overlay colors depending on boosts
    const brakeActive = keysPressed.current['arrowdown'] || keysPressed.current['s'];

    drawPixelCar(
      ctx,
      carXPixel,
      360,
      30,
      58,
      angleRotation,
      carTheme === 'WHITE_GREEN' ? 'TRAFFIC_BLUE' : 'BLACK_RED', // Custom blue track tones vs Orange/red
      brakeActive,
      null,
      carRef.hitFlash,
      true
    );

    // Boost glowing overlay lights
    if (carRef.boostDuration > 0) {
      ctx.save();
      // Draw energetic dual-stroke retro neon frame (Zero CPU shadowBlur cost!)
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(carXPixel - 17, 360 - 31, 34, 62);
      ctx.strokeStyle = '#e0f7fa';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(carXPixel - 15, 360 - 29, 30, 58);
      ctx.restore();
    }
  };

  const currentProgress = Math.min(
    100,
    Math.floor((Math.max(carLeft.current.roadOffset, carRight.current.roadOffset) / levelConfig.length) * 100)
  );

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-100 text-slate-850 p-1 sm:p-4 overflow-hidden select-none">
      {/* Layout wrapper that reports precise scaled dimensions to parent to eliminate double-scrollover on mobile/tablet */}
      <div
        style={{
          width: `${800 * scaleFactor}px`,
          height: `${600 * scaleFactor}px`,
        }}
        className="relative overflow-hidden select-none flex-shrink-0"
      >
        {/* Uniform Scaler for Game & Controls */}
        <div
          style={{
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
            width: '800px',
            height: '600px',
          }}
          className="absolute top-0 left-0 flex flex-col items-center justify-between"
        >
          {/* 800x450 Scaled Sandbox Console View */}
          <div
            className="relative w-[800px] h-[450px] flex items-center bg-slate-100 border-[6px] border-slate-400 rounded-2xl overflow-hidden shadow-2xl select-none"
          >
        {/* Curved Glass CRT Screen Effect Overlay */}
        <div className="pointer-events-none absolute inset-0 z-50 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,rgba(0,0,0,0.45)_100%)]" />

        {/* --- ROAD COUNTDOWN OVERLAY --- */}
        {countdownVal !== null && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-none select-none">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={countdownVal}
                initial={{ scale: 0.25, opacity: 0, rotate: -30 }}
                animate={{ 
                  scale: [0.25, 1.25, 1.0], 
                  opacity: 1,
                  rotate: [-30, 8, 0],
                }}
                exit={{ scale: 2.2, opacity: 0, rotate: 30 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center justify-center text-center p-6"
              >
                <div className={`font-chakra font-extrabold text-[125px] tracking-wider leading-none uppercase select-none font-sans ${
                  countdownVal === 3 ? 'text-[#ff0055] drop-shadow-[0_0_35px_rgba(255,0,85,0.95)]' :
                  countdownVal === 2 ? 'text-[#22d3ee] drop-shadow-[0_0_35px_rgba(34,211,238,0.95)]' :
                  countdownVal === 1 ? 'text-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.95)]' :
                  'text-emerald-400 drop-shadow-[0_0_55px_rgba(16,185,129,0.99)]'
                }`}>
                  {countdownVal}
                </div>
                
                <div className="text-[9px] font-mono font-bold text-slate-300 tracking-[0.25em] uppercase select-none mt-4 max-w-sm">
                  {countdownVal === 3 ? 'MIRROR SYNC INITIATED...' :
                   countdownVal === 2 ? 'COGNITIVE SPLIT READY...' :
                   countdownVal === 1 ? 'STEERING COUPLING ARMED...' :
                   'DRIVE DRIVERS DRIVE!'}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* --- LEFT VIEWPORT --- */}
        <div className="relative w-[350px] h-full overflow-hidden bg-black flex flex-col justify-between">
          <canvas
            ref={canvasLeftRef}
            width={350}
            height={450}
            className="absolute inset-0 w-full h-full"
          />
          {/* Quick left stats label */}
          <div className="absolute top-3 left-4 z-10 flex flex-col gap-0.5 pointer-events-none bg-black/75 p-1.5 px-2 rounded-md border border-sky-500/20 font-mono select-none">
            <span className="text-[7.5px] text-sky-400 font-bold tracking-widest leading-none">CAR ALPHA (BLUE)</span>
            <span ref={leftDistRef} className="text-[10px] text-white font-bold leading-none mt-1">
              0% DIST
            </span>
          </div>

          {/* Left speedometer bar */}
          <div className="absolute top-20 left-4 z-10 flex flex-col gap-0.5 bg-black/80 p-1 rounded border border-slate-900 border-b-sky-500/40 select-none">
            {Array.from({ length: 8 }).map((_, idx) => {
              return (
                <div
                  key={idx}
                  ref={(el) => { leftSpeedBarsRef.current[idx] = el; }}
                  className="w-1.5 h-3.5 rounded-sm bg-[#1e1b29]/60"
                />
              );
            })}
          </div>
        </div>

        {/* --- CENTER UI STRIP (Exactly 100px Wide) --- */}
        <div className="w-[100px] h-full bg-slate-100 border-l border-r border-slate-300 flex flex-col justify-between items-center py-4 z-20 select-none font-mono">
          
          {/* Level Header Info */}
          <div className="flex flex-col items-center">
            <span className="text-[7.5px] text-rose-500 font-bold tracking-widest">SECTOR</span>
            <span className="text-xl font-bold text-slate-800 tracking-tight">
              {String(levelId).padStart(2, '0')}
            </span>
          </div>

          {/* World Badge indicator */}
          <div className="flex flex-col items-center bg-white px-2 py-1 rounded border border-slate-200">
            <span className="text-[7.5px] text-sky-600 font-bold tracking-widest leading-tight">W{worldNum}</span>
            <span className="text-[6.5px] text-slate-650 text-center font-bold max-w-[80px] truncate leading-tight uppercase">
              {levelConfig.worldName.split(' ')[0]}
            </span>
          </div>

          {/* Live Timer Meter */}
          <div className="flex flex-col items-center">
            <span className="text-[7.5px] text-slate-500 font-bold tracking-widest leading-none mb-1">TIMER</span>
            <span ref={timerSpanRef} className="text-sm font-bold text-slate-800 leading-none">
              0.00s
            </span>
          </div>

          {/* Core level completed slider indicator */}
          <div className="h-28 w-2 bg-slate-200 rounded-full relative flex items-end">
            <div
              ref={progressFillRef}
              style={{ height: '0%' }}
              className="w-full bg-rose-500 rounded-full"
            />
            {/* Overlay indicators representing checkpoint markers */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-350" />
          </div>

          {/* Best Record Display */}
          <div className="flex flex-col items-center font-mono">
            <span className="text-[7.5px] text-slate-500 font-bold tracking-wider mb-1">BEST SEC</span>
            <span className="text-[10px] text-emerald-600 font-bold">
              {bestTime ? `${bestTime.toFixed(2)}` : '--.--'}
            </span>
          </div>

          {/* Speaker Sound Utility Button */}
          <button
            onClick={handleToggleMute}
            className="p-1 px-2 rounded-md bg-white border border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="Toggle game audio"
          >
            {isAudioMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        </div>

        {/* --- RIGHT VIEWPORT --- */}
        <div className="relative w-[350px] h-full overflow-hidden bg-black flex flex-col justify-between items-end">
          <canvas
            ref={canvasRightRef}
            width={350}
            height={450}
            className="absolute inset-0 w-full h-full"
          />
          {/* Quick right stats label */}
          <div className="absolute top-3 right-4 z-10 flex flex-col gap-0.5 pointer-events-none bg-black/75 p-1.5 px-2 rounded-md border border-emerald-500/20 font-mono select-none text-right">
            <span className="text-[7.5px] text-emerald-400 font-bold tracking-widest leading-none">CAR BETA (RED)</span>
            <span ref={rightDistRef} className="text-[10px] text-white font-bold leading-none mt-1">
              0% DIST
            </span>
          </div>

          {/* Right speedometer bar */}
          <div className="absolute top-20 right-4 z-10 flex flex-col gap-0.5 bg-black/80 p-1 rounded border border-slate-900 border-b-emerald-500/40 select-none">
            {Array.from({ length: 8 }).map((_, idx) => {
              return (
                <div
                  key={idx}
                  ref={(el) => { rightSpeedBarsRef.current[idx] = el; }}
                  className="w-1.5 h-3.5 rounded-sm bg-[#1e1b29]/60"
                />
              );
            })}
          </div>
        </div>

        {/* --- DETAILED RETRY / CRASH OVERLAYS --- */}
        {levelStatus === 'CRASHED' && (
          <div className="absolute inset-0 bg-rose-500/10 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 animate-in fade-in duration-200 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-xl border-4 border-rose-500 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3">
              <span className="font-sans text-xl font-black tracking-widest text-rose-600 animate-pulse">
                COLLISION!
              </span>
              <span className="font-mono text-[9.5px] text-slate-500 max-w-sm text-center font-bold">
                BOTH TRACK COOP DRIVES REQUIRE PERFECT EXECUTION. DISASTERS FOR EITHER END GAME INSTANTLY!
              </span>
              
              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    initLevel();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-500 hover:bg-rose-600 border-2 border-rose-600 text-white font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all shadow-sm"
                >
                  <RotateCcw size={11} />
                  <span>RETRY (R)</span>
                </button>

                <button
                  onClick={onExit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all shadow-sm"
                >
                  <Home size={11} />
                  <span>MENU</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- LEVEL FINISHED COMPLETED OVERLAYS --- */}
        {levelStatus === 'FINISH' && (
          <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-xl border-4 border-emerald-500 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3">
              <span className="font-sans text-xl font-black tracking-widest text-emerald-600 animate-bounce" style={{ animationDuration: '2s' }}>
                STAGE CLEAR!
              </span>
              
              <div className="flex flex-col gap-1 items-center bg-slate-50 w-full p-2.5 rounded border border-slate-200">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide">COMPLETION TIME</span>
                <span className="text-xl font-bold text-emerald-600">
                  {elapsedTime.toFixed(2)} SECONDS
                </span>
              </div>

              {/* Competitive Speed Vault Ranking Achievement Card */}
              {celebrationRank !== null && (
                <motion.div
                  initial={{ scale: 0.82, rotate: -2, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                  className="bg-amber-450/10 border-2 border-amber-400 rounded-lg p-3 shadow-md flex flex-col items-center gap-1.5 w-full text-center relative overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl animate-spin" style={{ animationDuration: '6s' }}>
                      {celebrationRank === 1 ? '🥇' : celebrationRank === 2 ? '🥈' : '🥉'}
                    </span>
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider font-sans">
                        🏆 NEW RECORD SECURED!
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono font-bold">
                        SPEED VAULT STANDING: RANK #{celebrationRank}
                      </span>
                    </div>
                  </div>

                  {/* Confetti Micro-Animations */}
                  <div className="flex gap-2 justify-center py-1 overflow-hidden w-full h-5 relative">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 15, opacity: 1, scale: 0.4 }}
                        animate={{ 
                          y: -12, 
                          x: (i - 2.5) * 6,
                          opacity: 0,
                          scale: [0.4, 0.9, 0.2]
                        }}
                        transition={{ 
                          duration: 1.2, 
                          repeat: Infinity, 
                          delay: i * 0.15 
                        }}
                        className={`w-2 h-2 rounded-full absolute ${
                          i % 3 === 0 ? 'bg-amber-400' : i % 3 === 1 ? 'bg-cyan-400' : 'bg-rose-450'
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Special milestone message prompt */}
              {levelId === 6 && (
                <span className="px-3 py-1 rounded bg-rose-50 text-rose-600 font-mono text-[9px] uppercase tracking-wide font-bold animate-pulse text-center w-full border border-rose-100">
                  "Your brain is starting to adapt."
                </span>
              )}

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    onLevelComplete(levelId, elapsedTime);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 text-white font-bold text-[10px] uppercase cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <span>CONTINUE</span>
                  <ArrowRight size={12} />
                </button>

                <button
                  onClick={() => {
                    audioEngine.playClick();
                    initLevel();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-705 font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all"
                >
                  <RotateCcw size={11} />
                  <span>RETRY</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- GENERAL IN-GAME PAUSE SCREEN --- */}
        <AnimatePresence>
          {isGamePaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex flex-col justify-center items-center p-4 animate-in fade-in"
            >
              <div className="bg-white p-6 rounded-xl border-4 border-slate-400 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3">
                <motion.span
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
                  className="font-sans text-2xl font-black tracking-widest text-slate-800"
                >
                  GAME PAUSED
                </motion.span>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                  className="flex flex-col gap-2 w-full bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[9.5px] text-slate-650"
                >
                  <div className="flex justify-between border-b border-slate-200 pb-1 font-bold text-slate-850">
                    <span>SECTOR: {levelId}</span>
                    <span>W{worldNum}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1 font-bold text-rose-500 font-sans text-[8.5px] tracking-wider uppercase">
                    <span>BGM TRACK:</span>
                    <span>
                      {worldNum === 1 || worldNum === 2 ? 'SHINJUKU HYPER D&B (148 BPM)' : 
                       worldNum === 3 || worldNum === 4 ? 'TOUGE ROAD HARDFLOOR (160 BPM)' : 
                       'NEO-TOKYO ARTCORE CLIMAX (172 BPM)'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1 font-bold text-amber-500 font-sans text-[8.5px] tracking-wider uppercase">
                    <span>SPEEDWAY RATIO:</span>
                    <span>
                      {difficulty} ({speedMultiplier.toFixed(1)}X SPEED)
                    </span>
                  </div>
                  <p className="mt-1 leading-normal">
                    Avoid all collision obstacles using WASD or Arrow Keys. Left & Right controls steer simultaneously but are MIRRORED across tracks.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
                  className="flex gap-2 mt-2 w-full justify-center"
                >
                  <button
                    onClick={() => {
                      audioEngine.playClick();
                      setIsGamePaused(false);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all border border-rose-600 shadow-sm"
                  >
                    <Play size={11} />
                    <span>RESUME</span>
                  </button>

                  <button
                    onClick={() => {
                      audioEngine.playClick();
                      initLevel();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all border border-slate-300"
                  >
                    <RotateCcw size={11} />
                    <span>REPLAY</span>
                  </button>

                  <button
                    onClick={onExit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase cursor-pointer active:scale-95 transition-all border border-slate-300"
                  >
                    <Home size={11} />
                    <span>EXIT</span>
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- INTEGRATED ARCADE CONTROLS DECK --- */}
      {/* High-polish tactile deck supporting unified mouse clicks, pointer touch-pads & key previews */}
      <div className="mt-4 w-[800px] h-[134px] bg-white border-2 border-slate-300 rounded-xl p-4 flex flex-row items-center justify-between gap-4 font-mono shadow-md">
        
        {/* Left Side: Steering Controller Pad */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[8.5px] text-sky-650 font-extrabold uppercase tracking-widest mb-0.5 select-none">STEERING ALLEY (MIRRORED)</span>
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
            <button
              ref={leftButtonRef}
              onPointerDown={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowleft', true);
                audioEngine.playClick();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowleft', false);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowleft', false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-28 h-18 rounded-lg border text-sm font-black flex items-center justify-center cursor-pointer select-none transition-all duration-100 bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200"
            >
              ◀ LEFT
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-650 text-[9.5px] font-bold select-none shadow-inner">
              D-PAD
            </div>
            <button
              ref={rightButtonRef}
              onPointerDown={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowright', true);
                audioEngine.playClick();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowright', false);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowright', false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-28 h-18 rounded-lg border text-sm font-black flex items-center justify-center cursor-pointer select-none transition-all duration-100 bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200"
            >
              RIGHT ▶
            </button>
          </div>
        </div>

        {/* Center Indicator Dashboard */}
        <div className="flex flex-col items-center justify-center text-center gap-1 max-w-[240px]">
          <span className="text-[9px] text-[#f43f5e] font-extrabold uppercase tracking-widest leading-none">SPLIT-BRAIN DRIVING CHASSIS</span>
          <p className="text-[7.5px] text-slate-500 mt-1 leading-normal select-none font-bold">
            A steering push left makes <span className="text-sky-600 font-bold">Blue</span> go left and <span className="text-rose-500 font-bold">Red</span> go right simultaneously. Slow down to navigate asymmetrical gates!
          </p>
        </div>

        {/* Right Side: Pedal Inputs (Gas & Brake) */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[8.5px] text-emerald-600 font-extrabold uppercase tracking-widest mb-0.5 select-none">COOP FORCE VELOCITY</span>
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
            <button
              ref={brakeButtonRef}
              onPointerDown={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowdown', true);
                audioEngine.playClick();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowdown', false);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowdown', false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-28 h-18 rounded-lg border text-[11px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all duration-100 bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200"
            >
              <ArrowDown size={18} />
              <span className="font-extrabold tracking-widest leading-none">BRAKE</span>
            </button>
            <button
              ref={gasButtonRef}
              onPointerDown={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowup', true);
                audioEngine.playClick();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowup', false);
              }}
              onPointerLeave={(e) => {
                e.preventDefault();
                setSimulatedKey('arrowup', false);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-28 h-18 rounded-lg border text-[11px] font-black flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all duration-100 bg-slate-100 text-slate-705 border-slate-200 hover:bg-slate-200"
            >
              <ArrowUp size={18} />
              <span className="font-extrabold tracking-widest leading-none">GAS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}
